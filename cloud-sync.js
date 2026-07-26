const POEM_MEMORY_KEY = 'escandador.poemMemory.v1';
const ANONYMOUS_MEMORY_KEY = 'escandador.poemMemory.anonymous.v1';
const ACTIVE_OWNER_KEY = 'escandador.poemMemory.activeOwner.v1';
const CLOUD_MAP_PREFIX = 'escandador.cloudPoemMap.v1';
const CLOUD_OUTBOX_PREFIX = 'escandador.cloudOutbox.v1';

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

function cloudPoemId(versionId) {
  const match = /^cloud-(\d+)-/.exec(String(versionId ?? ''));
  return match ? Number(match[1]) : null;
}

function versionSignature(title, version) {
  const payload = buildPayload(title, version);
  return JSON.stringify({ content: payload.content, settings: payload.settings, colorIndex: payload.colorIndex });
}

function mergeUniqueVersions(title, remoteVersions, localVersions) {
  const signatures = new Set(remoteVersions.map((version) => versionSignature(title, version)));
  const merged = [...remoteVersions];
  for (const version of localVersions) {
    const signature = versionSignature(title, version);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    merged.push(version);
  }
  return merged.sort((left, right) => new Date(left.savedAt ?? 0) - new Date(right.savedAt ?? 0));
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

  function outboxKey(userId = user?.id) {
    return `${CLOUD_OUTBOX_PREFIX}:${userId ?? 'anonymous'}`;
  }

  function loadOutbox(userId = user?.id) {
    try {
      const pending = JSON.parse(storage.getItem(outboxKey(userId)) || '[]');
      return Array.isArray(pending) ? pending : [];
    } catch {
      return [];
    }
  }

  function saveOutbox(pending, userId = user?.id) {
    storage.setItem(outboxKey(userId), JSON.stringify(pending));
  }

  function addPending(type, detail) {
    const ownerId = user?.id;
    const operation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      type,
      detail,
      createdAt: new Date().toISOString(),
    };
    saveOutbox([...loadOutbox(ownerId), operation], ownerId);
    return operation;
  }

  function removePending(operationId, ownerId) {
    saveOutbox(loadOutbox(ownerId).filter((operation) => operation.id !== operationId), ownerId);
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
      schemaVersion: 2,
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

  async function syncOne({ poemKey, title, version }) {
    if (!user || !title || !version || version.kind === 'autosave') return;
    const map = loadMap();
    const stableKey = String(poemKey || title);
    const record = map[stableKey] || { poemId: null, versions: {} };
    record.versions ||= {};
    const versionId = String(version.id ?? '');
    const payload = buildPayload(title, version);
    const sourcePoemId = Number(record.poemId) || cloudPoemId(versionId);
    const requestPayload = sourcePoemId ? { ...payload, sourcePoemId } : payload;
    const signature = JSON.stringify(payload);
    const mappedVersion = record.versions[versionId];
    if (versionId && (mappedVersion?.signature || mappedVersion) === signature) return;

    let result;
    if (record.poemId) {
      try {
        result = await api(`/api/poems/${record.poemId}`, {
          method: 'PUT', body: JSON.stringify(requestPayload),
        });
      } catch (error) {
        if (error.status !== 404) throw error;
        record.poemId = null;
      }
    }
    if (!record.poemId) {
      result = await api('/api/poems', { method: 'POST', body: JSON.stringify(requestPayload) });
      record.poemId = result.poem.id;
    }
    if (versionId) {
      record.versions[versionId] = {
        signature,
        cloudVersion: Number(result?.poem?.version) || null,
      };
    }
    map[stableKey] = record;
    saveMap(map);
  }

  async function deleteOne({ poemKey, title, versionIds = [], wholePoem = false }) {
    const map = loadMap();
    const stableKey = String(poemKey || title);
    const record = map[stableKey];

    if (wholePoem) {
      const poemId = Number(record?.poemId)
        || versionIds.map(cloudPoemId).find(Number.isInteger)
        || null;
      if (record?.poemId) {
        try {
          await api(`/api/poems/${record.poemId}`, { method: 'DELETE' });
        } catch (error) {
          if (error.status !== 404) throw error;
          await api('/api/trash', {
            method: 'POST', body: JSON.stringify({ poemId, title }),
          });
        }
      } else if (poemId) {
        await api('/api/trash', {
          method: 'POST', body: JSON.stringify({ poemId, title }),
        });
      }
      delete map[stableKey];
      saveMap(map);
      return;
    }

    if (!record?.poemId) return;
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
    if (!Object.keys(record.versions || {}).length) delete map[stableKey];
    saveMap(map);
  }

  function enqueue(work) {
    const ownerId = user?.id ?? null;
    queue = queue.then(async () => {
      if (!ownerId || user?.id !== ownerId) return;
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
      const ownerId = user.id;
      const operation = addPending('save', detail);
      return enqueue(async () => {
        await syncOne(detail);
        removePending(operation.id, ownerId);
      });
    },

    deleteSavedVersions({ poemKey, title, versionIds = [], wholePoem = false }) {
      if (!user || !title) return Promise.resolve();
      const detail = { poemKey, title, versionIds, wholePoem };
      const ownerId = user.id;
      const operation = addPending('delete', detail);
      return enqueue(async () => {
        await deleteOne(detail);
        removePending(operation.id, ownerId);
      });
    },

    loadFromServer() {
      if (!user) return Promise.resolve();
      return enqueue(async () => {
        preserveActiveMemory();
        const remote = await api('/api/poems');
        const remoteTrash = await api('/api/trash');
        const memory = readMemory(userMemoryKey(user.id));
        memory.schemaVersion = 2;
        memory.poems = memory.poems && typeof memory.poems === 'object' ? memory.poems : {};
        memory.trash = memory.trash && typeof memory.trash === 'object' ? memory.trash : {};
        const map = loadMap();
        const deletedPoemIds = new Set(
          (remoteTrash.deletedPoemIds || []).map(Number).filter(Number.isInteger)
        );
        for (const [poemKey, record] of Object.entries(map)) {
          if (!deletedPoemIds.has(Number(record?.poemId))) continue;
          delete memory.poems[poemKey];
          delete map[poemKey];
        }
        for (const poemKey of Object.keys(memory.poems)) {
          const match = /^server:(\d+)$/.exec(poemKey);
          if (match && deletedPoemIds.has(Number(match[1]))) delete memory.poems[poemKey];
        }
        for (const poem of remote.poems || []) {
          const poemKey = Object.keys(map).find((key) => Number(map[key]?.poemId) === Number(poem.id))
            || `server:${poem.id}`;
          const remoteVersions = (poem.versions || []).map((version) => ({
            ...localVersion(poem, version), poemTitle: poem.title,
          }));
          const localVersions = Array.isArray(memory.poems[poemKey]) ? memory.poems[poemKey] : [];
          memory.poems[poemKey] = mergeUniqueVersions(poem.title, remoteVersions, localVersions)
            .map((version) => ({ ...version, poemTitle: poem.title }));
          map[poemKey] = { poemId: poem.id, versions: map[poemKey]?.versions || {} };
          for (const version of remoteVersions) {
            map[poemKey].versions[version.id] = {
              signature: JSON.stringify(buildPayload(poem.title, version)),
              stateSignature: versionSignature(poem.title, version),
              cloudVersion: version.versionNumber,
            };
          }
        }
        for (const [poemKey, versions] of Object.entries(memory.poems)) {
          if (!Array.isArray(versions) || !versions.length) continue;
          const title = String(versions[0]?.poemTitle || 'Sin título');
          const record = map[poemKey] || { poemId: null, versions: {} };
          record.versions ||= {};
          const knownSignatures = new Set(
            Object.values(record.versions).map((entry) => entry?.stateSignature).filter(Boolean)
          );
          for (const version of versions) {
            if (version.kind === 'autosave') continue;
            const stateSignature = versionSignature(title, version);
            if (knownSignatures.has(stateSignature)) continue;
            const nextNumber = Object.keys(record.versions).length + 1;
            const payload = {
              ...buildPayload(title, version),
              versionName: `${title}_version_${nextNumber}`.slice(0, 60),
              ...(record.poemId ? { sourcePoemId: record.poemId } : {}),
            };
            const result = record.poemId
              ? await api(`/api/poems/${record.poemId}`, { method: 'PUT', body: JSON.stringify(payload) })
              : await api('/api/poems', { method: 'POST', body: JSON.stringify(payload) });
            record.poemId = result.poem.id;
            record.versions[String(version.id ?? `local-${nextNumber}`)] = {
              signature: JSON.stringify(buildPayload(title, version)),
              stateSignature,
              cloudVersion: Number(result.poem.version) || nextNumber,
            };
            knownSignatures.add(stateSignature);
          }
          map[poemKey] = record;
        }
        for (const entry of remoteTrash.trash || []) {
          const existingGroups = memory.trash[entry.title] ||= [];
          if (existingGroups.some((group) => group.deletedAt === entry.deletedAt)) continue;
          existingGroups.push({
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

    getAnonymousPoemCount() {
      return Object.keys(readMemory(ANONYMOUS_MEMORY_KEY).poems || {}).length;
    },

    importAnonymousPoems() {
      if (!user) return 0;
      preserveActiveMemory();
      const anonymousMemory = readMemory(ANONYMOUS_MEMORY_KEY);
      const accountMemory = readMemory(userMemoryKey(user.id));
      accountMemory.schemaVersion = 2;
      accountMemory.poems = accountMemory.poems && typeof accountMemory.poems === 'object'
        ? accountMemory.poems
        : {};
      let imported = 0;
      for (const [sourceKey, versions] of Object.entries(anonymousMemory.poems || {})) {
        if (!Array.isArray(versions) || !versions.length) continue;
        const hasStableKey = /^(?:local|server):/.test(sourceKey);
        let targetKey = hasStableKey ? sourceKey : `local:${crypto.randomUUID()}`;
        while (accountMemory.poems[targetKey]) targetKey = `local:${crypto.randomUUID()}`;
        const fallbackTitle = hasStableKey ? 'Sin título' : sourceKey;
        accountMemory.poems[targetKey] = versions.map((version) => ({
          ...version,
          poemTitle: String(version.poemTitle || fallbackTitle),
        }));
        imported += 1;
      }
      storage.setItem(userMemoryKey(user.id), JSON.stringify(accountMemory));
      activateMemory(accountMemory, String(user.id));
      return imported;
    },

    pendingCount() {
      return user ? loadOutbox(user.id).length : 0;
    },

    retryPending() {
      if (!user) return Promise.resolve();
      const ownerId = user.id;
      const pending = loadOutbox(ownerId);
      for (const operation of pending) {
        enqueue(async () => {
          if (operation.type === 'save') {
            await syncOne(operation.detail);
          } else if (operation.type === 'delete') {
            await deleteOne(operation.detail);
          }
          removePending(operation.id, ownerId);
        });
      }
      return queue;
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