// Libraries and pending uploads can exceed localStorage's small, fixed quota.
// Share one cache/transaction queue with the same-origin editor iframe.
const isLibraryKey = key => /^escandador\.(?:poemMemory\.|cloudPoemMap\.|cloudOutbox\.|anonymousImports\.|cloudSnapshot\.)/.test(key);

function mergeSnapshots(current, incoming) {
  if (!current || current === incoming) return incoming;
  const base = JSON.parse(current), extra = JSON.parse(incoming);
  base.poems ||= {};base.trash ||= {};
  for (const [key, versions] of Object.entries(extra.poems || {})) {
    const stored = base.poems[key] ||= [];
    const signatures = new Set(stored.map(v => JSON.stringify({...v,id:''})));
    const ids = new Set(stored.map(v => v.id));
    for (const entry of versions) {
      const signature = JSON.stringify({...entry,id:''});
      if (signatures.has(signature)) continue;
      const version = {...entry};
      if (ids.has(version.id)) version.id = `legacy-${entry.id}-${stored.length}`;
      stored.push(version);ids.add(version.id);signatures.add(signature);
    }
  }
  for (const [key, groups] of Object.entries(extra.trash || {})) {
    const stored = base.trash[key] ||= [];
    for (const group of groups) if (!stored.some(existing => JSON.stringify(existing) === JSON.stringify(group))) stored.push(group);
  }
  return JSON.stringify(base);
}

function mergeLegacyValue(key,current,incoming){
  if(!current||current===incoming)return incoming;
  const base=JSON.parse(current),extra=JSON.parse(incoming);
  if(key.startsWith('escandador.cloudOutbox.')){
    const ids=new Set(base.map(op=>op.id));
    return JSON.stringify([...base,...extra.filter(op=>!ids.has(op.id))]);
  }
  if(key.startsWith('escandador.cloudPoemMap.')){
    for(const [poem,record] of Object.entries(extra))base[poem]=base[poem]?{...record,...base[poem],versions:{...record.versions,...base[poem].versions}}:record;
    return JSON.stringify(base);
  }
  if(key.startsWith('escandador.anonymousImports.'))return JSON.stringify({...extra,...base});
  return current;
}

async function openStorage(host) {
  const legacy = host.localStorage;
  if (!host.indexedDB) return legacy;
  const db = await new Promise((resolve, reject) => {
    const request = host.indexedDB.open('mesa-poetry-library', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('values');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.onversionchange = () => db.close();
  const cache = new Map();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction('values');
    const request = transaction.objectStore('values').openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) { cache.set(cursor.key, cursor.value); cursor.continue(); }
    };
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
  });
  let writes = Promise.resolve(), error = null;
  const pending = new Map();
  const inFlight = new Set();
  let scheduled = false;
  const channel = typeof host.BroadcastChannel === 'function' ? new host.BroadcastChannel('mesa-poetry-storage') : null;
  function queue(key, value) {
    pending.set(key, value);
    if (scheduled) return;
    scheduled = true;
    let batch;
    writes = writes.catch(() => {}).then(async () => {
      batch = [...pending]; pending.clear(); scheduled = false;
      for(const [key] of batch)inFlight.add(key);
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('values', 'readwrite');
        const store = transaction.objectStore('values');
        for (const [key, value] of batch) value === null ? store.delete(key) : store.put(value, key);
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
      });
      error = null;
      for(const [key] of batch)inFlight.delete(key);
      channel?.postMessage(batch.map(([key]) => key));
    }).catch(cause => {
      error = cause;
      for(const [key] of batch||[])inFlight.delete(key);
      for (const [key, value] of batch || []) if (!pending.has(key)) pending.set(key, value);
      host.dispatchEvent(new host.CustomEvent('mesa:storage-error', { detail: cause.message }));
    });
  }
  const storage = {
    getItem(key) { return isLibraryKey(key) ? cache.get(key) ?? null : legacy.getItem(key); },
    setItem(key, value) {
      if (!isLibraryKey(key)) { legacy.setItem(key, value); return; }
      value = String(value); cache.set(key, value); queue(key, value);
    },
    removeItem(key) {
      if (!isLibraryKey(key)) { legacy.removeItem(key); return; }
      cache.delete(key); queue(key, null);
    },
    async flush() {
      if (error && pending.size && !scheduled) queue(...pending.entries().next().value);
      let checkpoint;
      do { checkpoint = writes; await checkpoint; } while (checkpoint !== writes);
      if (error) throw error;
    },
    keys() { return [...cache.keys()]; },
  };
  // Migrate only after the durable copy commits; leave the old copy on any error.
  const migrated = [], entries = [];
  for (let index = 0; index < legacy.length; index++) {
    const key = legacy.key(index);
    if (isLibraryKey(key)) entries.push([key,legacy.getItem(key)]);
  }
  const active = 'escandador.poemMemory.v1', owner = 'escandador.poemMemory.activeOwner.v1';
  const incomingOwner = legacy.getItem(owner) || 'anonymous', previousOwner = cache.get(owner) || 'anonymous';
  if (entries.some(([key]) => key === active) && previousOwner !== incomingOwner && cache.has(active)) {
    const profile = previousOwner === 'anonymous' ? 'escandador.poemMemory.anonymous.v1' : `escandador.poemMemory.user.${previousOwner}.v1`;
    storage.setItem(profile,mergeSnapshots(cache.get(profile),cache.get(active)));
  }
  for (const [key,value] of entries) {
    const snapshot = /^escandador\.poemMemory\.(?:v1$|anonymous\.|user\.)/.test(key);
    const current = key === active && previousOwner !== incomingOwner ? null : cache.get(key);
    storage.setItem(key,snapshot ? mergeSnapshots(current,value) : mergeLegacyValue(key,current,value));
    migrated.push(key);
  }
  if(entries.some(([key])=>key===active))storage.setItem(owner,incomingOwner);
  await storage.flush();
  for (const key of migrated) legacy.removeItem(key);
  channel?.addEventListener('message', async ({ data: keys }) => {
    const transaction = db.transaction('values');
    for (const key of keys) {
      const request = transaction.objectStore('values').get(key);
      request.onsuccess = () => {
        if (pending.has(key)||inFlight.has(key)) return;
        request.result === undefined ? cache.delete(key) : cache.set(key, request.result);
        host.dispatchEvent(new host.CustomEvent('mesa:library-storage-changed', { detail: { key } }));
      };
    }
  });
  return storage;
}

let host = typeof window === 'undefined' ? null : window;
if (host) {
  try { if (window.parent.location.origin === location.origin) host = window.parent; } catch {}
}
export const poemStorage = host
  ? await (host.__mesaPoemStorage ??= openStorage(host))
  : undefined;
