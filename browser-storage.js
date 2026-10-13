// Only these resources may be evicted: poems, account libraries and outboxes are never caches.
export const DISPOSABLE_STORAGE_KEYS = [
  'escandador.wordfreqWords.v1',
  'escandador.wordfreqQueries.v1',
  'escandador.lookupWordTypeCache.v1',
];

export function isStorageQuotaError(error) {
  return error?.name === 'QuotaExceededError'
    || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || error?.code === 22 || error?.code === 1014;
}

export function writePersistentStorage(storage, key, value) {
  try {
    storage.setItem(key, value);
    return;
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
  }
  for (const cacheKey of DISPOSABLE_STORAGE_KEYS) {
    storage.removeItem?.(cacheKey);
  }
  try {
    storage.setItem(key, value);
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    const capacityError = new Error('No queda espacio en este navegador para guardar la biblioteca. Tus poemas existentes se conservan. Exporta una copia en Markdown antes de liberar espacio.');
    capacityError.name = 'QuotaExceededError';
    capacityError.cause = error;
    throw capacityError;
  }
}

// Small optional caches leave room for library snapshots and pending cloud saves.
export function writeDisposableStorage(storage, key, value) {
  if (!DISPOSABLE_STORAGE_KEYS.includes(key) || key === DISPOSABLE_STORAGE_KEYS[0]) return false;
  try {
    let size = (key.length + value.length) * 2;
    for (let index = 0; index < storage.length; index += 1) {
      const existingKey = storage.key(index);
      if (existingKey !== key) size += (existingKey.length + (storage.getItem(existingKey)?.length || 0)) * 2;
    }
    if (value.length * 2 > 256 * 1024 || size > 3 * 1024 * 1024) {
      storage.removeItem(key);
      return false;
    }
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

const WORD_CACHE = 'escandador-word-corpus-v1';
const WORD_CACHE_URL = 'https://escandador.invalid/cache/wordfreq-v1';
const validBuckets = data => data?.version === 1 && Array.isArray(data.buckets);

export async function saveWordCorpusCache(buckets, cacheStorage = globalThis.caches) {
  try {
    if (!cacheStorage) return false;
    const cache = await cacheStorage.open(WORD_CACHE);
    await cache.put(WORD_CACHE_URL, new Response(JSON.stringify({ version: 1, buckets }), {
      headers: { 'Content-Type': 'application/json' },
    }));
    return true;
  } catch {
    return false; // The downloaded corpus remains usable in memory.
  }
}

export async function loadWordCorpusCache(storage = globalThis.localStorage, cacheStorage = globalThis.caches) {
  let legacy;
  try {
    const raw = storage.getItem(DISPOSABLE_STORAGE_KEYS[0]);
    // Release the old optional cache even if Cache Storage is unavailable.
    storage.removeItem(DISPOSABLE_STORAGE_KEYS[0]);
    legacy = JSON.parse(raw || 'null');
  } catch { /* Optional storage may be disabled. */ }
  if (validBuckets(legacy)) {
    await saveWordCorpusCache(legacy.buckets, cacheStorage);
    return legacy.buckets;
  }
  try {
    if (!cacheStorage) return null;
    const cache = await cacheStorage.open(WORD_CACHE);
    const response = await cache.match(WORD_CACHE_URL);
    const data = response ? await response.json() : null;
    return validBuckets(data) ? data.buckets : null;
  } catch {
    return null;
  }
}
