const POEM_MEMORY_KEY = 'escandador.poemMemory.v1';
const ANONYMOUS_MEMORY_KEY = 'escandador.poemMemory.anonymous.v1';
const ACTIVE_OWNER_KEY = 'escandador.poemMemory.activeOwner.v1';
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
  onTrash = () => {},
  onLibrary = () => {},
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

  function userMemoryKey(userId) {
    return `escandador.poemMemory.user.${userId}.v1`;
  }

  function readMemory(key) {
    try {
      const memory = JSON.parse(storage.getItem(key) || '{}');
      return memory && typeof memory === 'object' ? memory : {};
    } catch {
      return {};
    }
  }

  function activateMemory(memory, owner) {
    const normalized = {
      poems: memory?.poems && typeof memory.poems === 'object' ? memory.poems : {},
      trash: memory?.trash && typeof memory.trash === 'object' ? memory.trash : {},
    };
    storage.setItem(POEM_MEMORY_KEY, JSON.stringify(normalized));
    storage.setItem(ACTIVE_OWNER_KEY, owner);
    onLibrary(normalized);
  }

  function preserveActiveMemory() {
    const owner = storage.getItem(ACTIVE_OWNER_KEY) || 'anonymous';
    const targetKey = owner === 'anonymous' ? ANONYMOUS_MEMORY_KEY : userMemoryKey(owner);
    storage.setItem(targetKey, JSON.stringify(readMemory(POEM_MEMORY_KEY)));
  }

  function localVersion(poem, version) {
    const settings = poem.settings && typeof poem.settings === 'object' ? { ...poem.settings } : {};
    const sinalefaOverrides = settings.sinalefaOverrides || {};
    const lineOverrides = settings.lineOverrides || {};
    delete settings.sinalefaOverrides;
    delete settings.lineOverrides;
    return {
      id: `cloud-${poem.id}-${version.version}`,
      label: version.versionName,
      versionNumber: version.version,
      savedAt: version.createdAt || poem.updatedAt,
      poemText: version.content,
      settings,
      sinalefaOverrides,
      lineOverrides,
      kind: 'manual',
    };
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
    const mappedVersion = record.versions[versionId];
    if (versionId && (mappedVersion?.signature || mappedVersion) === signature) return;

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
    if (versionId) {
      record.versions[versionId] = {
        signature,
        cloudVersion: Number(result?.poem?.version) || null,
      };
    }
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
      const previousUser = user;
      preserveActiveMemory();
      user = nextUser || null;
      if (!user) {
        activateMemory(readMemory(ANONYMOUS_MEMORY_KEY), 'anonymous');
        onStatus('ready', 'Nube desconectada');
      } else if (!previousUser || previousUser.id !== user.id) {
        activateMemory(readMemory(userMemoryKey(user.id)), String(user.id));
      }
    },

    syncSavedVersion(detail) {
      if (!user) return Promise.resolve();
      return enqueue(() => syncOne(detail));
    },

    deleteSavedVersions({ title, versionIds = [], wholePoem = false }) {
      if (!user || !title) return Promise.resolve();
      return enqueue(async () => {
        const map = loadMap();
        const record = map[title];
        if (!record?.poemId) return;

        if (wholePoem) {
          await api(`/api/poems/${record.poemId}`, { method: 'DELETE' });
          delete map[title];
          saveMap(map);
          return;
        }

        for (const versionId of versionIds) {
          const mapped = record.versions?.[versionId];
          const cloudVersion = Number(mapped?.cloudVersion);
          let legacyPayload = null;
          if (!cloudVersion && typeof mapped === 'string') {
            try { legacyPayload = JSON.parse(mapped); } catch {}
          }
          if (!cloudVersion && !legacyPayload) continue;
          await api(`/api/poems/${record.poemId}${cloudVersion ? `?version=${cloudVersion}` : ''}`, {
            method: 'DELETE',
            body: legacyPayload ? JSON.stringify({
              versionName: legacyPayload.versionName,
              content: legacyPayload.content,
            }) : undefined,
          });
          delete record.versions[versionId];
        }
        if (!Object.keys(record.versions || {}).length) delete map[title];
        saveMap(map);
      });
    },

    loadFromServer() {
      if (!user) return Promise.resolve();
      return enqueue(async () => {
        const remote = await api('/api/poems');
        const remoteTrash = await api('/api/trash');
        const memory = { poems: {}, trash: {} };
        const map = {};
        for (const poem of remote.poems || []) {
          const versions = (poem.versions || []).map((version) => localVersion(poem, version));
          memory.poems[poem.title] = versions;
          map[poem.title] = { poemId: poem.id, versions: {} };
          for (const version of versions) {
            map[poem.title].versions[version.id] = {
              signature: JSON.stringify(buildPayload(poem.title, version)),
              cloudVersion: version.versionNumber,
            };
          }
        }
        for (const entry of remoteTrash.trash || []) {
          (memory.trash[entry.title] ||= []).push({
            deletedAt: entry.deletedAt,
            versions: entry.versions || [],
          });
        }
        saveMap(map);
        storage.setItem(userMemoryKey(user.id), JSON.stringify(memory));
        activateMemory(memory, String(user.id));
        onTrash(remoteTrash.trash || []);
      });
    },

    syncLibrary() {
      return this.loadFromServer();
    },

    emptyTrash() {
      if (!user) return Promise.resolve();
      return enqueue(() => api('/api/trash', { method: 'DELETE' }));
    },

    whenIdle() {
      return queue;
    },
  };
}