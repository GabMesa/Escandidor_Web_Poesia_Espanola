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

test('uploads a pre-login local library in chronological order and reuses remote IDs', async () => {
  const memory = {
    poems: {
      Existente: [version('old-1', 1, 'Anterior'), version('old-2', 2, 'Actual')],
    },
  };
  const storage = new MemoryStorage({
    'escandador.poemMemory.v1': JSON.stringify(memory),
  });
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (path === '/api/poems' && !options.method) {
      return jsonResponse({ ok: true, poems: [{ id: 88, title: 'Existente' }] });
    }
    if (path === '/api/trash' && !options.method) {
      return jsonResponse({ ok: true, trash: [] });
    }
    if (path === '/api/poems/88' && options.method === 'PUT') {
      return jsonResponse({ ok: true, poem: { id: 88 } });
    }
    throw new Error(`Solicitud inesperada: ${options.method || 'GET'} ${path}`);
  };
  const sync = createCloudSync({ request, storage });
  sync.setUser({ id: 5, username: 'autora' });

  await sync.syncLibrary();

  const writes = calls.filter((call) => call.method === 'PUT');
  assert.equal(writes.length, 2);
  assert.deepEqual(writes.map((call) => call.body.content), ['Anterior', 'Actual']);
  assert.ok(writes.every((call) => call.path === '/api/poems/88'));
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