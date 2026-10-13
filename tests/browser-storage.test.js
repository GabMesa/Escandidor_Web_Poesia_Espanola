import test from 'node:test';
import assert from 'node:assert/strict';
import { writePersistentStorage, writeDisposableStorage, loadWordCorpusCache, saveWordCorpusCache } from '../browser-storage.js';
import { createCloudSync } from '../cloud-sync.js';

class LimitedStorage {
  constructor(values = {}, limit = Infinity) {
    this.values = new Map(Object.entries(values));
    this.limit = limit;
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  removeItem(key) { this.values.delete(key); }
  setItem(key, value) {
    const next = new Map(this.values).set(key, String(value));
    const size = [...next].reduce((total, [name, content]) => total + (name.length + content.length) * 2, 0);
    if (size > this.limit) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    this.values = next;
  }
}

const library = text => ({ schemaVersion: 2, poems: { 'local:one': [{ poemTitle: 'Poema', poemText: text, kind: 'autosave' }] }, trash: {} });

test('login recovers from a full word cache and preserves anonymous and account libraries', () => {
  const local = library('Borrador local');
  const account = library('Poema de mi cuenta');
  const storage = new LimitedStorage({
    'escandador.wordfreqWords.v1': 'x'.repeat(3000),
    'escandador.poemMemory.v1': JSON.stringify(local),
    'escandador.poemMemory.user.7.v1': JSON.stringify(account),
    'escandador.cloudOutbox.v1:7': '[{"id":"pending"}]',
  }, 7000);
  const sync = createCloudSync({ storage });
  sync.setUser({ id: 7 });
  assert.equal(storage.getItem('escandador.wordfreqWords.v1'), null);
  assert.deepEqual(JSON.parse(storage.getItem('escandador.poemMemory.anonymous.v1')), local);
  assert.deepEqual(JSON.parse(storage.getItem('escandador.poemMemory.v1')), account);
  assert.equal(storage.getItem('escandador.poemMemory.activeOwner.v1'), '7');
  assert.equal(storage.getItem('escandador.cloudOutbox.v1:7'), '[{"id":"pending"}]');
  sync.setUser(null);
  assert.deepEqual(JSON.parse(storage.getItem('escandador.poemMemory.v1')), local);
});

test('failed account activation leaves the active library, owner and sync identity intact', () => {
  const local = library('Local');
  const account = library('x'.repeat(1500));
  const values = {
    'escandador.poemMemory.v1': JSON.stringify(local),
    'escandador.poemMemory.activeOwner.v1': 'anonymous',
    'escandador.poemMemory.user.7.v1': JSON.stringify(account),
  };
  const initialSize = Object.entries(values).reduce((total, [key, value]) => total + (key.length + value.length) * 2, 0);
  const storage = new LimitedStorage(values, initialSize + 600);
  const state = { user: null, queue: Promise.resolve() };
  let libraries = 0;
  const sync = createCloudSync({ storage, state, onLibrary: () => libraries++ });
  assert.throws(() => sync.setUser({ id: 7 }), /Tus poemas existentes se conservan/);
  assert.equal(state.user, null);
  assert.equal(libraries, 0);
  assert.equal(storage.getItem('escandador.poemMemory.activeOwner.v1'), 'anonymous');
  assert.deepEqual(JSON.parse(storage.getItem('escandador.poemMemory.v1')), local);
  assert.deepEqual(JSON.parse(storage.getItem('escandador.poemMemory.user.7.v1')), account);
});

test('persistent writes never evict poem histories or pending cloud operations', () => {
  const storage = new LimitedStorage({ poem: 'original', pending: 'operation', 'escandador.wordfreqQueries.v1': 'cached' }, 1);
  assert.throws(() => writePersistentStorage(storage, 'poem', 'updated'), { name: 'QuotaExceededError' });
  assert.equal(storage.getItem('poem'), 'original');
  assert.equal(storage.getItem('pending'), 'operation');
  assert.equal(storage.getItem('escandador.wordfreqQueries.v1'), null);
});

test('non-quota storage errors do not delete caches', () => {
  const error = new DOMException('Denied', 'SecurityError');
  let deleted = false;
  const storage = { setItem() { throw error; }, removeItem() { deleted = true; } };
  assert.throws(() => writePersistentStorage(storage, 'poem', 'text'), error);
  assert.equal(deleted, false);
});

test('optional caches stay small and leave headroom for poems', () => {
  const storage = new LimitedStorage({ poem: 'x'.repeat(1600000) });
  assert.equal(writeDisposableStorage(storage, 'escandador.wordfreqQueries.v1', 'query'), false);
  assert.equal(storage.getItem('poem').length, 1600000);
  assert.equal(writeDisposableStorage(storage, 'escandador.wordfreqWords.v1', 'corpus'), false);
});

test('legacy corpus migrates out of localStorage and remains cached separately', async () => {
  const buckets = [['poema', 'verso']];
  const storage = new LimitedStorage({ 'escandador.wordfreqWords.v1': JSON.stringify({ version: 1, buckets }), poem: 'keep' });
  const entries = new Map();
  const cacheStorage = { async open() { return {
    async put(key, response) { entries.set(key, response.clone()); },
    async match(key) { return entries.get(key)?.clone(); },
  }; } };
  assert.deepEqual(await loadWordCorpusCache(storage, cacheStorage), buckets);
  assert.equal(storage.getItem('escandador.wordfreqWords.v1'), null);
  assert.equal(storage.getItem('poem'), 'keep');
  assert.deepEqual(await loadWordCorpusCache(storage, cacheStorage), buckets);
});

test('corpus still works if the separate cache is unavailable or full', async () => {
  const buckets = [['poema']];
  const storage = new LimitedStorage({ 'escandador.wordfreqWords.v1': JSON.stringify({ version: 1, buckets }) });
  const cacheStorage = { async open() { throw new DOMException('Full', 'QuotaExceededError'); } };
  assert.deepEqual(await loadWordCorpusCache(storage, cacheStorage), buckets);
  assert.equal(storage.getItem('escandador.wordfreqWords.v1'), null);
  assert.equal(await saveWordCorpusCache(buckets, cacheStorage), false);
});

test('session refresh does not rewrite or duplicate the active library', () => {
  const storage = new LimitedStorage();
  const state = { user: null, queue: Promise.resolve() };
  const sync = createCloudSync({ storage, state });
  sync.setUser({ id: 7, username: 'poeta' });
  storage.limit = 0;
  assert.doesNotThrow(() => sync.setUser({ id: 7, username: 'poeta', role: 'admin' }));
  assert.equal(state.user.role, 'admin');
});
