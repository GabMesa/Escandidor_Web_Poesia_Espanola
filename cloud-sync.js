const POEM_MEMORY_KEY = 'escandador.poemMemory.v1';
const CLOUD_MAP_PREFIX = 'escandador.cloudPoemMap.v1';

export function buildCloudSettings(version) {
  return {
    ...(version?.settings && typeof version.settings === 'object' ? version.settings : {}),
    sinalefaOverrides: version?.sinalefaOverrides ?? {},
    lineOverrides: version?.lineOverrides ?? {},
  };
}

function versionLabel(version) {
  const label = String(version?.label ?? '').trim();
  return label || `v${Number(version?.versionNumber) || 1}`;
}

function buildPayload(title, version) {
  return {
    title,
    versionName: versionLabel(version),
    content: String(version?.poemText ?? ''),
    settings: buildCloudSettings(version),
    colorIndex: null,
  };
}

export function createCloudSync({
  request = fetch,
  storage = localStorage,
  onStatus = () => {},
} = {}) {
  let user = null;
  let queue = Promise.resolve();

  function mapKey() {
    return `${CLOUD_MAP_PREFIX}:${user?.id ?? 'anonymous'}`;
  }

  function loadMap() {
    try {
      return JSON.parse(storage.getItem(mapKey()) || '{}');
    } catch {
      return {};
    }
  }

  function saveMap(map) {
    storage.setItem(mapKey(), JSON.stringify(map));
  }

  async function api(path, options = {}) {
    const response = await request(path, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'No se pudo guardar en la nube.');
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function syncOne({ title, previousTitle = '', version }) {
    if (!user || !title || !version || version.kind === 'autosave') return;
    const map = loadMap();
    if (previousTitle && previousTitle !== title && map[previousTitle] && !map[title]) {
      map[title] = map[previousTitle];
      delete map[previousTitle];
    }

    const record = map[title] || { poemId: null, versions: {} };
    record.versions ||= {};
    const versionId = String(version.id ?? '');
    const payload = buildPayload(title, version);
    const signature = JSON.stringify(payload);
    if (versionId && record.versions[versionId] === signature) return;

    let result;
    if (record.poemId) {
      try {
        result = await api(`/api/poems/${record.poemId}`, {
          method: 'PUT', body: JSON.stringify(payload),
        });
      } catch (error) {
        if (error.status !== 404) throw error;
        record.poemId = null;
      }
    }
    if (!record.poemId) {
      result = await api('/api/poems', { method: 'POST', body: JSON.stringify(payload) });
      record.poemId = result.poem.id;
    }
    if (versionId) record.versions[versionId] = signature;
    map[title] = record;
    saveMap(map);
  }

  function enqueue(work) {
    queue = queue.then(async () => {
      onStatus('syncing', 'Guardando en nube…');
      await work();
      onStatus('ready', 'Guardado en nube');
    }).catch((error) => {
      onStatus('error', error.message || 'Error de nube');
    });
    return queue;
  }

  return {
    setUser(nextUser) {
      user = nextUser || null;
      if (!user) onStatus('ready', 'Nube desconectada');
    },

    syncSavedVersion(detail) {
      if (!user) return Promise.resolve();
      return enqueue(() => syncOne(detail));
    },

    syncLibrary() {
      if (!user) return Promise.resolve();
      return enqueue(async () => {
        const remote = await api('/api/poems');
        const map = loadMap();
        for (const poem of remote.poems || []) {
          if (!map[poem.title]) map[poem.title] = { poemId: poem.id, versions: {} };
        }
        saveMap(map);

        let memory = {};
        try {
          memory = JSON.parse(storage.getItem(POEM_MEMORY_KEY) || '{}');
        } catch {}
        for (const [title, versions] of Object.entries(memory.poems || {})) {
          const ordered = Array.isArray(versions)
            ? [...versions].sort((a, b) => new Date(a.savedAt || 0) - new Date(b.savedAt || 0))
            : [];
          for (const version of ordered) {
            await syncOne({ title, version });
          }
        }
      });
    },

    whenIdle() {
      return queue;
    },
  };
}