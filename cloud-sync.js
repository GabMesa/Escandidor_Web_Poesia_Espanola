import { poemStorage } from './poem-storage.js';
import { poemValidationError, hasPoemContent, cleanEmptyPoemVersions } from './poem-policy.js';
import { writePersistentStorage } from './browser-storage.js';
import { compressPoemVersions } from './poem-compression.js';

const POEM_MEMORY_KEY = 'escandador.poemMemory.v1';
const ANONYMOUS_MEMORY_KEY = 'escandador.poemMemory.anonymous.v1';
const ACTIVE_OWNER_KEY = 'escandador.poemMemory.activeOwner.v1';
const CLOUD_MAP_PREFIX = 'escandador.cloudPoemMap.v1';
const CLOUD_OUTBOX_PREFIX = 'escandador.cloudOutbox.v1';
const ANONYMOUS_IMPORT_PREFIX = 'escandador.anonymousImports.v1';

export function buildCloudSettings(version) {
  const settings = version?.settings && typeof version.settings === 'object' ? version.settings : {};
  return {
    ...settings,
    poemFont: String(settings.poemFont ?? 'atkinson'),
    sinalefaOverrides: version?.sinalefaOverrides ?? {},
    lineOverrides: version?.lineOverrides ?? {},
  };
}

function versionLabel(version) {
  const label = String(version?.label ?? '').trim();
  return label || `v${Number(version?.versionNumber) || 1}`;
}

function buildPayload(title, version) {
  const settings = buildCloudSettings(version);
  return {
    title,
    versionName: versionLabel(version),
    content: String(version?.poemText ?? ''),
    settings,
    fontFamily: String(settings.poemFont ?? 'atkinson'),
    colorIndex: null,
    sync: { id: String(version.id ?? ''), versionNumber: Number(version.versionNumber) || 1, kind: version.kind === 'autosave' ? 'autosave' : 'manual', savedAt: version.savedAt },
  };
}

function cloudPoemId(versionId) {
  const match = /^cloud-(\d+)-/.exec(String(versionId ?? ''));
  return match ? Number(match[1]) : null;
}

function serverPoemId(poemKey) {
  const match = /^server:(\d+)$/.exec(String(poemKey ?? ''));
  return match ? Number(match[1]) : null;
}

function versionSignature(title, version) {
  const payload = buildPayload(title, version);
  return JSON.stringify({ content: payload.content, settings: payload.settings, colorIndex: payload.colorIndex });
}

function mergeUniqueVersions(title, remoteVersions, localVersions, preferRemote = false) {
  const ids = new Set(localVersions.map(version => String(version.id)));
  const cloudVersions = new Set(localVersions.map(version=>version.cloudVersion).filter(Boolean));
  const legacySignatures = new Set(localVersions.filter(version=>!version.cloudVersion).map(version => versionSignature(title, version)));
  const merged = [...localVersions];
  const positions=new Map(localVersions.map((version,index)=>[String(version.id),index]));
  for (const version of remoteVersions) {
    if(ids.has(String(version.id))){if(preferRemote)merged[positions.get(String(version.id))]=version;continue;}
    if(version.cloudVersion&&cloudVersions.has(version.cloudVersion))continue;
    // Old server checkpoints had different local identities. New stable IDs
    // preserve distinct revisions even when a poem returns to the same text.
    if(/^cloud-\d+-\d+$/.test(version.id)&&legacySignatures.has(versionSignature(title,version)))continue;
    ids.add(String(version.id));
    merged.push(version);
  }
  return merged.sort((left, right) => new Date(left.savedAt ?? 0) - new Date(right.savedAt ?? 0));
}

export function createCloudSync({
  request = fetch,
  storage = poemStorage ?? globalThis.localStorage,
  state = { user: null, queue: Promise.resolve() },
  onStatus = () => {},
  onTrash = () => {},
  onTrashPolicy = () => {},
  onLibrary = () => {},
  shouldAutoCompress = () => false,
} = {}) {
  let user = state.user;
  let queue = state.queue;

  function mapKey() {
    return `${CLOUD_MAP_PREFIX}:${user?.id ?? 'anonymous'}`;
  }

  function outboxKey(userId = user?.id) {
    return `${CLOUD_OUTBOX_PREFIX}:${userId ?? 'anonymous'}`;
  }

  function anonymousImportKey(userId = user?.id) {
    return `${ANONYMOUS_IMPORT_PREFIX}:${userId ?? 'anonymous'}`;
  }

  function loadAnonymousImports(userId = user?.id) {
    try {
      const imports = JSON.parse(storage.getItem(anonymousImportKey(userId)) || '{}');
      return imports && typeof imports === 'object' ? imports : {};
    } catch {
      return {};
    }
  }

  function anonymousPoemFingerprint(sourceKey, versions) {
    const title = String(versions?.[0]?.poemTitle || sourceKey || 'Sin título');
    return JSON.stringify({
      title,
      versions: versions.map((version) => versionSignature(title, version)),
    });
  }

  function loadOutbox(userId = user?.id) {
    try {
      const pending = JSON.parse(storage.getItem(outboxKey(userId)) || '[]');
      return Array.isArray(pending) ? pending.filter(operation => operation.type !== 'save' || hasPoemContent(operation.detail?.version?.poemText)) : [];
    } catch {
      return [];
    }
  }

  function saveOutbox(pending, userId = user?.id) {
    writePersistentStorage(storage, outboxKey(userId), JSON.stringify(pending));
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
    writePersistentStorage(storage, mapKey(), JSON.stringify(map));
  }

  function userMemoryKey(userId) {
    return `escandador.poemMemory.user.${userId}.v1`;
  }

  function readMemory(key) {
    try {
      const memory = JSON.parse(storage.getItem(key) || '{}');
      return memory && typeof memory === 'object' ? cleanEmptyPoemVersions(memory).memory : {};
    } catch {
      return {};
    }
  }

  function activateMemory(memory, owner, preserveDraft = false) {
    const normalized = {
      schemaVersion: 2,
      poems: memory?.poems && typeof memory.poems === 'object' ? memory.poems : {},
      trash: memory?.trash && typeof memory.trash === 'object' ? memory.trash : {},
    };
    const previousOwner = storage.getItem(ACTIVE_OWNER_KEY);
    if (preserveDraft && previousOwner === owner && storage.getItem(POEM_MEMORY_KEY) === JSON.stringify(normalized)) return;
    writePersistentStorage(storage, ACTIVE_OWNER_KEY, owner);
    try {
      writePersistentStorage(storage, POEM_MEMORY_KEY, JSON.stringify(normalized));
    } catch (error) {
      if (previousOwner === null) storage.removeItem?.(ACTIVE_OWNER_KEY);
      else storage.setItem(ACTIVE_OWNER_KEY, previousOwner);
      throw error;
    }
    onLibrary(normalized, { preserveDraft });
  }

  function preserveActiveMemory() {
    const owner = storage.getItem(ACTIVE_OWNER_KEY) || 'anonymous';
    const targetKey = owner === 'anonymous' ? ANONYMOUS_MEMORY_KEY : userMemoryKey(owner);
    writePersistentStorage(storage, targetKey, JSON.stringify(readMemory(POEM_MEMORY_KEY)));
  }

  function localVersion(poem, version) {
    const sourceSettings = version.sync?.settings ?? poem.settings;
    const settings = sourceSettings && typeof sourceSettings === 'object' ? { ...sourceSettings } : {};
    settings.poemFont = version.sync?.settings?.poemFont ?? poem.fontFamily ?? settings.poemFont ?? 'atkinson';
    const sinalefaOverrides = settings.sinalefaOverrides || {};
    const lineOverrides = settings.lineOverrides || {};
    delete settings.sinalefaOverrides;
    delete settings.lineOverrides;
    return {
      id: version.sync?.id || `cloud-${poem.id}-${version.version}`,
      label: version.versionName,
      versionNumber: Number(version.sync?.versionNumber) || version.version,
      savedAt: String(version.sync?.savedAt||version.createdAt||poem.updatedAt||'').replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, '$1T$2Z'),
      poemText: version.content,
      settings,
      sinalefaOverrides,
      lineOverrides,
      kind: version.sync?.kind === 'autosave' ? 'autosave' : 'manual',
      cloudVersion: version.version,
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
    if (!user || !title || !version) return;
    const ownerId = user.id;
    const map = loadMap();
    const stableKey = String(poemKey || title);
    const record = map[stableKey] || { poemId: null, versions: {} };
    record.versions ||= {};
    const versionId = String(version.id ?? '');
    const payload = buildPayload(title, version);
    const validationError = poemValidationError(title, payload.content);
    if (validationError) throw new Error(validationError);
    const sourcePoemId = Number(record.poemId) || cloudPoemId(versionId) || serverPoemId(stableKey);
    if (sourcePoemId) record.poemId = sourcePoemId;
    const signature = JSON.stringify(payload);
    const mappedVersion = record.versions[versionId];
    const cloudVersion=Number(mappedVersion?.cloudVersion||version.cloudVersion);
    const requestPayload = {...payload,...(sourcePoemId?{sourcePoemId}:{}),sync:{...payload.sync,...(cloudVersion?{cloudVersion}:{})}};
    const legacyPayload = { ...payload }; delete legacyPayload.sync;
    if (versionId && [(signature), JSON.stringify(legacyPayload)].includes(mappedVersion?.signature || mappedVersion)) return;

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
    if (user?.id !== ownerId) return;
    if (versionId) {
      record.versions[versionId] = {
        signature,
        stateSignature: versionSignature(title, version),
        cloudVersion: Number(result?.syncedVersion ?? result?.poem?.version) || null,
        ...(result.compressed?{retired:true}:{}),
      };
    }
    saveMap({...loadMap(),[stableKey]:record});
  }

  async function syncMany(details) {
    if (!details.length) return;
    const ownerId = user?.id, {poemKey,title} = details[0];
    const key = String(poemKey || title);
    if (!loadMap()[key]?.poemId) await syncOne(details.shift());
    const map = loadMap(), record = map[key];
    if (!record?.poemId || user?.id !== ownerId) return;
    const remaining = details.filter(({version}) => record.versions?.[version.id]?.signature !== JSON.stringify(buildPayload(title,version)));
    for (let offset=0;offset<remaining.length;offset+=20) {
      const batch=remaining.slice(offset,offset+20);
      const result=await api(`/api/poems/${record.poemId}/versions`,{method:'POST',body:JSON.stringify({title,versions:batch.map(({version})=>{const payload=buildPayload(title,version),cloudVersion=Number(record.versions?.[version.id]?.cloudVersion||version.cloudVersion);if(cloudVersion)payload.sync.cloudVersion=cloudVersion;return payload;})})});
      if(user?.id!==ownerId)return;
      const uploaded=new Map(result.uploaded.map(v=>[v.id,v]));
      for(const {version} of batch){
        if(!uploaded.has(String(version.id)))throw Error('El servidor no confirmó todas las versiones del bloque.');
        const confirmed=uploaded.get(String(version.id));
        record.versions[version.id]={signature:JSON.stringify(buildPayload(title,version)),stateSignature:versionSignature(title,version),cloudVersion:confirmed.cloudVersion,...(confirmed.compressed?{retired:true}:{})};
      }
      saveMap({...loadMap(),[key]:record});
    }
  }

  async function downloadLibrary() {
    const poems=new Map();let cursor=null;
    do {
      const query=new URLSearchParams({limit:'200'});
      if(cursor){query.set('afterPoem',cursor.poemId);query.set('afterVersion',cursor.version);}
      const page=await api('/api/poems?'+query);
      for(const poem of page.poems||[]){
        const existing=poems.get(poem.id);
        if(existing){existing.versions.push(...poem.versions);existing.version=poem.version;existing.content=poem.content;}
        else poems.set(poem.id,poem);
      }
      cursor=page.nextCursor;
    }while(cursor);
    return {poems:[...poems.values()]};
  }

  async function deleteOne({ poemKey, title, versionIds = [], wholePoem = false, protectedVersionIds = [] }) {
    const map = loadMap();
    const stableKey = String(poemKey || title);
    const record = map[stableKey] || (wholePoem ? null : { poemId: serverPoemId(stableKey) || versionIds.map(cloudPoemId).find(Number.isInteger), versions: {} });

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
    const protectedCloudVersions = new Set(protectedVersionIds.map(id => Number(record.versions?.[id]?.cloudVersion) || Number(/^cloud-\d+-(\d+)$/.exec(id)?.[1])).filter(Boolean));
    for (const versionId of versionIds) {
      const mapped = record.versions?.[versionId];
      const cloudVersion = Number(mapped?.cloudVersion) || Number(/^cloud-\d+-(\d+)$/.exec(versionId)?.[1]);
      if (protectedCloudVersions.has(cloudVersion)) {
        delete record.versions[versionId];
        continue;
      }
      let legacyPayload = null;
      if (!cloudVersion && typeof mapped === 'string') {
        try { legacyPayload = JSON.parse(mapped); } catch {}
      }
      if (!cloudVersion && !legacyPayload) continue;
      try {
        await api(`/api/poems/${record.poemId}${cloudVersion ? `?version=${cloudVersion}` : ''}`, {
          method: 'DELETE',
          body: legacyPayload ? JSON.stringify({ versionName: legacyPayload.versionName, content: legacyPayload.content }) : undefined,
        });
      } catch (error) {
        if (error.status !== 404) throw error; // A partially completed retry may already have deleted it.
      }
      delete record.versions[versionId];
    }
    if (!Object.keys(record.versions || {}).length) delete map[stableKey];
    saveMap(map);
  }

  async function compressRemotePoem(poemId) {
    const ownerId = user?.id;
    let result, removed = 0;
    do {
      if (!ownerId || user?.id !== ownerId) throw Error('Cambió la cuenta durante la compresión.');
      result = await api(`/api/poems/${poemId}/compress`, { method: 'POST', body: '{}' });
      removed += result.removed || 0;
    } while (result.more);
    return removed;
  }

  async function autoCompressSavedPoems(details, ownerId) {
    if (user?.id !== ownerId || !shouldAutoCompress()) return;
    const map = loadMap();
    const ids = new Set(details.map(detail => map[String(detail.poemKey || detail.title)]?.poemId).filter(Boolean));
    for (const id of ids) {
      if (user?.id !== ownerId) return;
      await compressRemotePoem(id);
    }
  }

  async function syncCompression(detail) {
    const { poemKey, title, versionIds, retainedVersions } = detail;
    const record = loadMap()[String(poemKey || title)];
    const supersededSaves = loadOutbox().filter(operation => operation.type === 'save'
      && String(operation.detail?.poemKey || operation.detail?.title) === String(poemKey || title)
      && versionIds.includes(String(operation.detail?.version?.id)));
    const hasCloudVersions = (detail.force && record?.poemId) || supersededSaves.length > 0
      || versionIds.some(id => cloudPoemId(id) || record?.versions?.[id]);
    if (!hasCloudVersions) return;
    // Never delete the last remote copy before the replacement has been saved.
    for (const version of retainedVersions) {
      await syncOne({ poemKey, title, version });
    }
    const key=String(poemKey||title),current=loadMap()[key];
    const cloudNumber=id=>Number(current?.versions?.[id]?.cloudVersion||/^cloud-\d+-(\d+)$/.exec(id)?.[1]);
    const protectedCloud=new Set((detail.retainedVersionIds||retainedVersions.map(v=>String(v.id))).map(cloudNumber).filter(Boolean));
    const remoteRemovals=versionIds.filter(id=>!protectedCloud.has(cloudNumber(id))&&(current?.versions?.[id]||cloudPoemId(id)));
    if(current?.poemId&&(detail.force||remoteRemovals.length))await compressRemotePoem(current.poemId);
    const map=loadMap();if(map[key]){for(const id of versionIds)delete map[key].versions[id];saveMap(map);}
    for (const operation of supersededSaves) removePending(operation.id, user.id);
  }

  async function runPending(operation) {
    if (operation.type === 'save') await syncOne(operation.detail);
    else if (operation.type === 'delete') await deleteOne(operation.detail);
    else if (operation.type === 'compress') await syncCompression(operation.detail);
  }

  function enqueue(work) {
    const ownerId = user?.id ?? null;
    queue = queue.then(async () => {
      if (!ownerId || user?.id !== ownerId) return;
      onStatus('syncing', 'Guardando en nube…');
      await storage.flush?.();
      await work();
      await storage.flush?.();
      const pending = loadOutbox(ownerId).length;
      if (!pending) state.error = null;
      onStatus(state.error ? 'error' : pending ? 'syncing' : 'ready', state.error?.message || (pending ? 'Guardando en nube…' : 'Guardado en nube'));
    }).catch((error) => {
      state.error = error;
      onStatus('error', error.message || 'Error de nube');
    });
    state.queue = queue;
    return queue;
  }

  return {
    setUser(nextUser) {
      const previousUser = user;
      const next = nextUser || null;
      if (next && previousUser?.id === next.id) {
        user = next;
        state.user = user;
        return;
      }
      preserveActiveMemory();
      const nextOwner = next ? String(next.id) : 'anonymous';
      const nextKey = next ? userMemoryKey(next.id) : ANONYMOUS_MEMORY_KEY;
      activateMemory(readMemory(nextKey), nextOwner);
      user = next;
      state.user = user;
      if (!user) onStatus('ready', 'Nube desconectada');
    },

    syncSavedVersion(detail) {
      if (!user) return Promise.resolve();
      const ownerId = user.id;
      const operation = addPending('save', detail);
      return enqueue(async () => {
        await syncOne(detail);
        await autoCompressSavedPoems([detail], ownerId);
        removePending(operation.id, ownerId);
      });
    },

    syncImportedVersions(details,onProgress=()=>{}) {
      if(!user)return Promise.resolve();
      const ownerId=user.id;
      // Persist every operation before the first request so a closed tab or
      // interrupted connection can resume the entire confirmed selection.
      const operations=details.map(detail=>addPending('save',detail));
      return enqueue(async()=>{
        for(let index=0;index<operations.length;index++){
          if(user?.id!==ownerId)throw Error('Cambió la cuenta durante la importación.');
          const operation=operations[index];
          onProgress({completed:index,total:operations.length,title:operation.detail.title,index:index+1});
          await syncOne(operation.detail);
          removePending(operation.id,ownerId);
          onProgress({completed:index+1,total:operations.length,title:operation.detail.title,index:index+1});
        }
        await autoCompressSavedPoems(details, ownerId);
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

    compressVersions(detail) {
      if (!user || (!detail.force && (!detail.versionIds?.length || !detail.retainedVersions?.length))) return Promise.resolve();
      const ownerId = user.id;
      const record = loadMap()[String(detail.poemKey || detail.title)];
      const compactDetail = {
        ...detail,
        retainedVersionIds: detail.retainedVersions.map(version => String(version.id)),
        retainedVersions: detail.retainedVersions.filter(version => {
          const mapped = record?.versions?.[version.id];
          return (mapped?.signature || mapped) !== JSON.stringify(buildPayload(detail.title, version));
        }),
      };
      const operation = addPending('compress', compactDetail);
      return enqueue(async () => {
        await syncCompression(compactDetail);
        removePending(operation.id, ownerId);
      });
    },

    loadFromServer() {
      if (!user) return Promise.resolve();
      return enqueue(async () => {
        // Replay in order before fetching so compressed versions are not reimported.
        const syncOwner = user.id;
        const operations=loadOutbox(syncOwner),completed=new Set();
        for(let index=0;index<operations.length;){
          const operation=operations[index];
          if(operation.type==='save'){
            const groups=new Map();
            while(index<operations.length&&operations[index].type==='save'){
              const next=operations[index++],key=String(next.detail.poemKey||next.detail.title);
              if(!groups.has(key))groups.set(key,[]);groups.get(key).push(next);
            }
            for(const group of groups.values()){
              try{
                if(group.length>=20)await syncMany(group.map(op=>op.detail));
                else for(const op of group)await runPending(op);
                for(const op of group)completed.add(op.id);
              }catch(error){state.error=error;}
              if(user?.id!==syncOwner)return;
            }
          }else{
            index++;
            try{await runPending(operation);completed.add(operation.id);}catch(error){state.error=error;}
            if(user?.id!==syncOwner)return;
          }
        }
        if(completed.size)saveOutbox(loadOutbox(syncOwner).filter(op=>!completed.has(op.id)),syncOwner);
        preserveActiveMemory();
        const beforeDownload=readMemory(POEM_MEMORY_KEY);
        let remote = await downloadLibrary();
        if (shouldAutoCompress()) {
          let removed = 0;
          for (const poem of remote.poems || []) {
            if (user?.id !== syncOwner) return;
            // Inspect once per complete history, never once per transfer page.
            if (compressPoemVersions((poem.versions || []).map(version => localVersion(poem, version))).removed.length) {
              removed += await compressRemotePoem(poem.id);
            }
          }
          if (removed) remote = await downloadLibrary();
        }
        const remoteTrash = await api('/api/trash');
        if (user?.id !== syncOwner) return;
        if (remoteTrash.policy) onTrashPolicy(remoteTrash.policy);
        const memory = readMemory(userMemoryKey(user.id));
        memory.schemaVersion = 2;
        memory.poems = memory.poems && typeof memory.poems === 'object' ? memory.poems : {};
        memory.trash = memory.trash && typeof memory.trash === 'object' ? memory.trash : {};
        const map = loadMap();
        const mergeAliases=new Map((remoteTrash.mergedPoems||[]).map(p=>[Number(p.sourceId),Number(p.targetId)]));
        function consolidatePoemKeys(){
          const keysById=new Map();
          for(const [key,versions] of Object.entries(memory.poems)){
            if(!versions?.length)continue;
            const oldId=Number(map[key]?.poemId)||serverPoemId(key),id=mergeAliases.get(oldId)||oldId;
            if(!id)continue;
            const remotePoem=(remote.poems||[]).find(p=>Number(p.id)===id);
            map[key] ||= {poemId:id,versions:{}};
            if(id!==oldId){
              map[key]={poemId:id,versions:{}};
              memory.poems[key]=versions.map(v=>{
                const match=remotePoem?.versions.find(r=>r.sync?.id===String(v.id));
                const next={...v};delete next.cloudVersion;
                if(match){next.cloudVersion=match.version;map[key].versions[v.id]={cloudVersion:match.version,signature:JSON.stringify(buildPayload(remotePoem.title,next)),stateSignature:versionSignature(remotePoem.title,next)};}
                return next;
              });
            }
            const targetKey=keysById.get(id);
            if(!targetKey){keysById.set(id,key);continue;}
            const title=remotePoem?.title||versions[0].poemTitle||key;
            memory.poems[targetKey]=mergeUniqueVersions(title,memory.poems[targetKey],memory.poems[key]);
            map[targetKey]={poemId:id,versions:{...map[targetKey]?.versions,...map[key]?.versions}};
            delete memory.poems[key];
          }
        }
        consolidatePoemKeys();
        const retiredByKey=new Map(),pendingVersionIds=new Set(loadOutbox(syncOwner).filter(op=>op.type==='save').map(op=>String(op.detail.version.id)));
        for(const [key,versions] of Object.entries(memory.poems)){
          const poemId=Number(map[key]?.poemId)||serverPoemId(key);
          const retired=(remoteTrash.compressedVersions||[]).filter(v=>Number(v.poemId)===poemId);
          if(!retired.length)continue;
          const ids=new Set(retired.map(v=>v.clientId)),numbers=new Set(retired.map(v=>Number(v.version))),localIds=new Set();
          for(const version of versions){const cloud=Number(version.cloudVersion||map[key]?.versions?.[version.id]?.cloudVersion||/^cloud-\d+-(\d+)$/.exec(version.id)?.[1]);if(map[key]?.versions?.[version.id]?.retired||ids.has(String(version.id))||numbers.has(cloud))localIds.add(String(version.id));}
          retiredByKey.set(key,localIds);
          memory.poems[key]=versions.filter(v=>!localIds.has(String(v.id))||pendingVersionIds.has(String(v.id)));
          if(map[key])for(const [id,record] of Object.entries(map[key].versions||{}))if((record.retired||ids.has(id)||numbers.has(Number(record.cloudVersion)))&&!pendingVersionIds.has(id))delete map[key].versions[id];
        }
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
          memory.poems[poemKey] = mergeUniqueVersions(poem.title, remoteVersions, localVersions, true)
            .map((version) => ({ ...version, poemTitle: poem.title }));
          map[poemKey] = { poemId: poem.id, versions: map[poemKey]?.versions || {} };
          for (const version of remoteVersions) {
            map[poemKey].versions[version.id] = {
              signature: JSON.stringify(buildPayload(poem.title, version)),
              stateSignature: versionSignature(poem.title, version),
              cloudVersion: version.cloudVersion || version.versionNumber,
            };
          }
        }
        const bulkUploads=[];
        for (const [poemKey, versions] of Object.entries(memory.poems)) {
          if (!Array.isArray(versions) || !versions.length) continue;
          const title = String(versions[0]?.poemTitle || 'Sin título');
          if (poemValidationError(title, versions[0]?.poemText)) continue;
          const record = map[poemKey] || { poemId: null, versions: {} };
          record.versions ||= {};
          const knownSignatures = new Set(
            Object.entries(record.versions).filter(([id])=>/^cloud-\d+-\d+$/.test(id)).map(([,entry]) => entry?.stateSignature).filter(Boolean)
          );
          const unsent=versions.filter(version=>!record.versions[String(version.id)]&&!knownSignatures.has(versionSignature(title,version)));
          if(unsent.length>=20){
            bulkUploads.push({poemKey,details:unsent.map(version=>({poemKey,title,version}))});
            continue;
          }
          for (const version of unsent) {
            const stateSignature = versionSignature(title, version);
            if (knownSignatures.has(stateSignature)) continue;
            const nextNumber = Object.keys(record.versions).length + 1;
            const isOfflineDraft = version.kind === 'autosave';
            const payload = {
              ...buildPayload(title, version),
              versionName: (isOfflineDraft
                ? `Recuperación sin conexión ${version.savedAt || ''}`
                : `${title}_version_${nextNumber}`).trim().slice(0, 60),
              ...(record.poemId ? { sourcePoemId: record.poemId } : {}),
            };
            const result = record.poemId
              ? await api(`/api/poems/${record.poemId}`, { method: 'PUT', body: JSON.stringify(payload) })
              : await api('/api/poems', { method: 'POST', body: JSON.stringify(payload) });
            if (user?.id !== syncOwner) return;
            record.poemId = result.poem.id;
            record.versions[String(version.id ?? `local-${nextNumber}`)] = {
              signature: JSON.stringify(buildPayload(title, version)),
              stateSignature,
              cloudVersion: Number(result.syncedVersion ?? result.poem.version) || nextNumber,
            };
            map[poemKey] = record;
            saveMap(map);
          }
          map[poemKey] = record;
        }
        if(bulkUploads.length){
          saveMap(map);
          // Different poems can transfer independently. Keep each poem's
          // checkpoints ordered, and wait for every worker before a retry.
          for(let offset=0;offset<bulkUploads.length;offset+=4){
            const batch=bulkUploads.slice(offset,offset+4);
            const results=await Promise.allSettled(batch.map(job=>syncMany(job.details)));
            if(user?.id!==syncOwner)return;
            const current=loadMap();for(const job of batch)if(current[job.poemKey])map[job.poemKey]=current[job.poemKey];
            const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;
          }
        }
        for (const entry of remoteTrash.trash || []) {
          const existingGroups = memory.trash[entry.title] ||= [];
          if (existingGroups.some((group) => group.deletedAt === entry.deletedAt)) continue;
          existingGroups.push({
            id: entry.id,
            poemId: entry.poemId,
            deletedAt: entry.deletedAt,
            versions: entry.versions || [],
          });
        }
        saveMap(map);
        // Saves made while the network requests were in flight must survive the pull.
        if (storage.getItem(ACTIVE_OWNER_KEY) === String(user.id)) {
          const current = readMemory(POEM_MEMORY_KEY);
          for (const [key, versions] of Object.entries(current.poems || {})) {
            const id = Number(map[key]?.poemId) || serverPoemId(key);
            if (deletedPoemIds.has(id)) continue;
            const title = String(versions[0]?.poemTitle || key);
            const previous=new Map((beforeDownload.poems?.[key]||[]).map(version=>[String(version.id),JSON.stringify(version)]));
            const currentPending=new Set(loadOutbox(syncOwner).filter(op=>op.type==='save').map(op=>String(op.detail.version.id)));
            const edited=versions.filter(version=>(!retiredByKey.get(key)?.has(String(version.id))||currentPending.has(String(version.id)))&&previous.get(String(version.id))!==JSON.stringify(version));
            memory.poems[key] = mergeUniqueVersions(title, memory.poems[key] || [], edited);
          }
        }
        consolidatePoemKeys();
        saveMap(map);
        writePersistentStorage(storage, userMemoryKey(user.id), JSON.stringify(memory));
        activateMemory(memory, String(user.id), true);
        onTrash(remoteTrash.trash || []);
      });
    },

    syncLibrary() {
      return this.loadFromServer();
    },

    getAnonymousPoemCount() {
      if (!user) return 0;
      const imports = loadAnonymousImports(user.id);
      return Object.entries(readMemory(ANONYMOUS_MEMORY_KEY).poems || {})
        .filter(([sourceKey, versions]) => Array.isArray(versions)
          && versions.length
          && imports[sourceKey]?.fingerprint !== anonymousPoemFingerprint(sourceKey, versions))
        .length;
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
      const importRecords = loadAnonymousImports(user.id);
      let imported = 0;
      for (const [sourceKey, versions] of Object.entries(anonymousMemory.poems || {})) {
        if (!Array.isArray(versions) || !versions.length) continue;
        const fingerprint = anonymousPoemFingerprint(sourceKey, versions);
        const previousImport = importRecords[sourceKey];
        if (previousImport?.fingerprint === fingerprint) continue;

        const hasStableKey = /^(?:local|server):/.test(sourceKey);
        let targetKey = String(previousImport?.targetKey || '');
        if (!targetKey && hasStableKey) targetKey = sourceKey;
        if (!targetKey) targetKey = `local:${crypto.randomUUID()}`;
        const fallbackTitle = hasStableKey ? 'Sin título' : sourceKey;
        const sourceTitle = String(versions[0]?.poemTitle || fallbackTitle);
        const existingVersions = Array.isArray(accountMemory.poems[targetKey])
          ? accountMemory.poems[targetKey]
          : [];
        const targetTitle = String(existingVersions[0]?.poemTitle || sourceTitle);
        const importedVersions = versions.map((version) => ({
          ...version,
          poemTitle: targetTitle,
        }));
        accountMemory.poems[targetKey] = mergeUniqueVersions(
          targetTitle,
          existingVersions,
          importedVersions,
        );
        importRecords[sourceKey] = { targetKey, fingerprint };
        imported += 1;
      }
      writePersistentStorage(storage, userMemoryKey(user.id), JSON.stringify(accountMemory));
      writePersistentStorage(storage, anonymousImportKey(user.id), JSON.stringify(importRecords));
      activateMemory(accountMemory, String(user.id));
      return imported;
    },

    discardAnonymousPoems() {
      if (!user) return 0;
      preserveActiveMemory();
      const anonymousMemory = readMemory(ANONYMOUS_MEMORY_KEY);
      const discarded = Object.keys(anonymousMemory.poems || {}).length;
      writePersistentStorage(storage, ANONYMOUS_MEMORY_KEY, JSON.stringify({
        schemaVersion: 2,
        poems: {},
        trash: anonymousMemory.trash && typeof anonymousMemory.trash === 'object'
          ? anonymousMemory.trash
          : {},
      }));
      writePersistentStorage(storage, anonymousImportKey(user.id), '{}');
      return discarded;
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
          await runPending(operation);
          removePending(operation.id, ownerId);
        });
      }
      return queue;
    },

    loadTrashPolicy() {
      if (!user) return Promise.resolve();
      return enqueue(async () => {
        const result = await api('/api/trash');
        if (result.policy) onTrashPolicy(result.policy);
      });
    },

    setTrashAutoCleanup(autoCleanup) {
      if (!user) return Promise.resolve();
      return enqueue(async () => {
        const result = await api('/api/trash', { method: 'PATCH', body: JSON.stringify({ autoCleanup }) });
        onTrashPolicy(result.policy);
      });
    },

    emptyTrash() {
      if (!user) return Promise.resolve();
      return enqueue(() => api('/api/trash', { method: 'DELETE' }));
    },

    restoreTrashEntry(trashId) {
      if (!user || !Number.isInteger(Number(trashId))) return Promise.resolve();
      return enqueue(() => api('/api/trash', {
        method: 'POST', body: JSON.stringify({ trashId: Number(trashId) }),
      }));
    },

    whenIdle() {
      return queue;
    },
  };
}
