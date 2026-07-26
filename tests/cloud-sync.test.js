import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudSync } from '../cloud-sync.js';

class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
  }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function version(id, number, text, settings = {}) {
  return {
    id,
    versionNumber: number,
    savedAt: `2026-01-0${number}T00:00:00.000Z`,
    poemText: text,
    settings,
    sinalefaOverrides: { '0:1': true },
    lineOverrides: { 0: { stress: '6-10' } },
    kind: 'manual',
  };
}

test('creates one cloud poem, appends versions, and preserves all settings', async () => {
  const calls = [];
  const storage = new MemoryStorage();
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (path === '/api/poems' && !options.method) return jsonResponse({ ok: true, poems: [] });
    if (path === '/api/poems' && options.method === 'POST') {
      return jsonResponse({ ok: true, poem: { id: 41, version: 1 } }, 201);
    }
    if (path === '/api/poems/41' && options.method === 'PUT') {
      return jsonResponse({ ok: true, poem: { id: 41, version: 2 } });
    }
    throw new Error(`Solicitud inesperada: ${options.method || 'GET'} ${path}`);
  };
  const sync = createCloudSync({ request, storage });
  sync.setUser({ id: 9, username: 'poeta' });

  const first = version('local-v1', 1, 'Primer texto', { rhymeMode: 'consonante' });
  await sync.syncSavedVersion({ title: 'Mi poema', version: first });
  await sync.syncSavedVersion({ title: 'Mi poema', version: first });
  await sync.syncSavedVersion({
    title: 'Mi poema',
    version: version('local-v2', 2, 'Segundo texto', { rhymeMode: 'asonante', repeatRhymeScheme: true }),
  });

  const writes = calls.filter((call) => call.method !== 'GET');
  assert.equal(writes.length, 2);
  assert.deepEqual(writes.map(({ method, path }) => `${method} ${path}`), [
    'POST /api/poems',
    'PUT /api/poems/41',
  ]);
  assert.deepEqual(writes[1].body.settings, {
    rhymeMode: 'asonante',
    repeatRhymeScheme: true,
    sinalefaOverrides: { '0:1': true },
    lineOverrides: { 0: { stress: '6-10' } },
  });
  assert.equal(writes[1].body.content, 'Segundo texto');
  assert.equal(writes[1].body.versionName, 'v2');

  await sync.deleteSavedVersions({ title: 'Mi poema', versionIds: ['local-v2'] });
  await sync.deleteSavedVersions({ title: 'Mi poema', wholePoem: true });
  assert.deepEqual(calls.slice(-2).map(({ method, path }) => `${method} ${path}`), [
    'DELETE /api/poems/41?version=2',
    'DELETE /api/poems/41',
  ]);
});

test('replaces account data from the server and restores anonymous data on logout', async () => {
  const anonymousMemory = { poems: { Anonimo: [version('anon-1', 1, 'Local')] }, trash: {} };
  const storage = new MemoryStorage({
    'escandador.poemMemory.v1': JSON.stringify(anonymousMemory),
  });
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (path === '/api/poems' && !options.method) {
      return jsonResponse({ ok: true, poems: [{
        id: 88,
        title: 'Servidor',
        settings: { rhymeMode: 'asonante', sinalefaOverrides: { a: true } },
        updatedAt: '2026-02-02T00:00:00.000Z',
        versions: [
          { version: 1, versionName: 'borrador', content: 'Anterior', createdAt: '2026-02-01T00:00:00.000Z' },
          { version: 2, versionName: 'final', content: 'Actual', createdAt: '2026-02-02T00:00:00.000Z' },
        ],
      }] });
    }
    if (path === '/api/trash' && !options.method) {
      return jsonResponse({ ok: true, trash: [] });
    }
    if (path === '/api/poems/88?version=2' && options.method === 'DELETE') {
      return jsonResponse({ ok: true });
    }
    throw new Error(`Solicitud inesperada: ${options.method || 'GET'} ${path}`);
  };
  const sync = createCloudSync({ request, storage });
  sync.setUser({ id: 5, username: 'autora' });

  await sync.loadFromServer();

  const active = JSON.parse(storage.getItem('escandador.poemMemory.v1'));
  assert.deepEqual(Object.keys(active.poems), ['Servidor']);
  assert.equal(active.poems.Servidor.length, 2);
  assert.equal(active.poems.Servidor[1].id, 'cloud-88-2');
  assert.equal(calls.filter((call) => call.method !== 'GET').length, 0);

  await sync.deleteSavedVersions({ title: 'Servidor', versionIds: ['cloud-88-2'] });
  assert.equal(calls.at(-1).path, '/api/poems/88?version=2');

  sync.setUser(null);
  assert.deepEqual(JSON.parse(storage.getItem('escandador.poemMemory.v1')), anonymousMemory);
});

test('empties the database trash for an authenticated user', async () => {
  const calls = [];
  const sync = createCloudSync({
    storage: new MemoryStorage(),
    request: async (path, options = {}) => {
      calls.push({ path, method: options.method || 'GET' });
      return jsonResponse({ ok: true });
    },
  });
  sync.setUser({ id: 3 });

  await sync.emptyTrash();

  assert.deepEqual(calls, [{ path: '/api/trash', method: 'DELETE' }]);
});

test('keeps autosaves local instead of creating backend version spam', async () => {
  let requests = 0;
  const sync = createCloudSync({
    storage: new MemoryStorage(),
    request: async () => { requests += 1; return jsonResponse({}); },
  });
  sync.setUser({ id: 2 });

  await sync.syncSavedVersion({
    title: 'Borrador',
    version: { ...version('auto-1', 1, 'Cambio'), kind: 'autosave' },
  });

  assert.equal(requests, 0);
});