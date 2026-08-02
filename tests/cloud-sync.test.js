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
      return jsonResponse({ ok: true, trash: [], deletedPoemIds: [] });
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
  assert.deepEqual(Object.keys(active.poems), ['server:88']);
  assert.equal(active.poems['server:88'].length, 2);
  assert.equal(active.poems['server:88'][1].id, 'cloud-88-2');
  assert.equal(active.poems['server:88'][1].poemTitle, 'Servidor');
  assert.equal(calls.filter((call) => call.method !== 'GET').length, 0);

  await sync.deleteSavedVersions({
    poemKey: 'server:88', title: 'Servidor', versionIds: ['cloud-88-2'],
  });
  assert.equal(calls.at(-1).path, '/api/poems/88?version=2');

  sync.setUser(null);
  assert.deepEqual(JSON.parse(storage.getItem('escandador.poemMemory.v1')), {
    schemaVersion: 2,
    ...anonymousMemory,
  });
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

test('records a whole-poem deletion by cloud ID even without a local mapping', async () => {
  const calls = [];
  const sync = createCloudSync({
    storage: new MemoryStorage(),
    request: async (path, options = {}) => {
      calls.push({
        path,
        method: options.method || 'GET',
        body: options.body ? JSON.parse(options.body) : null,
      });
      return jsonResponse({ ok: true });
    },
  });
  sync.setUser({ id: 4 });

  await sync.deleteSavedVersions({
    title: 'Poema borrado', versionIds: ['cloud-73-2'], wholePoem: true,
  });

  assert.deepEqual(calls, [{
    path: '/api/trash',
    method: 'POST',
    body: { poemId: 73, title: 'Poema borrado' },
  }]);
});

test('deletes a stale local poem when the server trash marks its cloud ID', async () => {
  const stale = version('cloud-73-1', 1, 'Copia antigua');
  stale.poemTitle = 'Poema borrado';
  const storage = new MemoryStorage({
    'escandador.poemMemory.user.9.v1': JSON.stringify({
      schemaVersion: 2,
      poems: { 'server:73': [stale] },
      trash: {},
    }),
    'escandador.cloudPoemMap.v1:9': JSON.stringify({
      'server:73': { poemId: 73, versions: {} },
    }),
  });
  const request = async (path) => {
    if (path === '/api/poems') return jsonResponse({ ok: true, poems: [] });
    if (path === '/api/trash') {
      return jsonResponse({ ok: true, trash: [], deletedPoemIds: [73] });
    }
    throw new Error(`Solicitud inesperada: ${path}`);
  };
  const sync = createCloudSync({ request, storage });
  sync.setUser({ id: 9 });

  await sync.loadFromServer();

  const memory = JSON.parse(storage.getItem('escandador.poemMemory.v1'));
  assert.deepEqual(memory.poems, {});
  assert.deepEqual(memory.trash, {});
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

test('promotes an offline autosave once when the account reconnects', async () => {
  const remote = {
    ...version('cloud-81-1', 1, 'Versión en nube'),
    settings: {},
    sinalefaOverrides: {},
    lineOverrides: {},
  };
  remote.poemTitle = 'Borrador recuperado';
  const draft = { ...version('offline-draft', 2, 'Cambios sin conexión'), kind: 'autosave' };
  draft.poemTitle = 'Borrador recuperado';
  const storage = new MemoryStorage({
    'escandador.poemMemory.user.14.v1': JSON.stringify({
      schemaVersion: 2,
      poems: { 'server:81': [remote, draft] },
      trash: {},
    }),
  });
  const writes = [];
  const request = async (path, options = {}) => {
    if (path === '/api/poems' && !options.method) return jsonResponse({ ok: true, poems: [{
      id: 81,
      title: 'Borrador recuperado',
      settings: {},
      versions: [{
        version: 1,
        versionName: 'v1',
        content: 'Versión en nube',
        createdAt: '2026-01-01T00:00:00.000Z',
      }],
    }] });
    if (path === '/api/trash') return jsonResponse({ ok: true, trash: [], deletedPoemIds: [] });
    if (path === '/api/poems/81' && options.method === 'PUT') {
      writes.push(JSON.parse(options.body));
      return jsonResponse({ ok: true, poem: { id: 81, version: 2 } });
    }
    throw new Error(`Solicitud inesperada: ${options.method || 'GET'} ${path}`);
  };
  const sync = createCloudSync({ request, storage });
  sync.setUser({ id: 14 });

  await sync.loadFromServer();
  await sync.loadFromServer();

  assert.equal(writes.length, 1);
  assert.equal(writes[0].content, 'Cambios sin conexión');
  assert.match(writes[0].versionName, /^Recuperación sin conexión/);
  const memory = JSON.parse(storage.getItem('escandador.poemMemory.v1'));
  assert.equal(memory.poems['server:81'].some((entry) => entry.poemText === 'Cambios sin conexión'), true);
});

test('keeps same-title server poems separate by stable poem ID', async () => {
  const request = async (path) => {
    if (path === '/api/poems') return jsonResponse({ ok: true, poems: [
      {
        id: 11, title: 'Igual', settings: {}, versions: [
          { version: 1, versionName: 'uno', content: 'Primero', createdAt: '2026-01-01T00:00:00Z' },
        ],
      },
      {
        id: 12, title: 'Igual', settings: {}, versions: [
          { version: 1, versionName: 'uno', content: 'Segundo', createdAt: '2026-01-02T00:00:00Z' },
        ],
      },
    ] });
    if (path === '/api/trash') return jsonResponse({ ok: true, trash: [], deletedPoemIds: [] });
    throw new Error(`Solicitud inesperada: ${path}`);
  };
  const storage = new MemoryStorage();
  const sync = createCloudSync({ request, storage });
  sync.setUser({ id: 6 });

  await sync.loadFromServer();

  const memory = JSON.parse(storage.getItem('escandador.poemMemory.v1'));
  assert.deepEqual(Object.keys(memory.poems).sort(), ['server:11', 'server:12']);
  assert.equal(memory.poems['server:11'][0].poemText, 'Primero');
  assert.equal(memory.poems['server:12'][0].poemText, 'Segundo');
});

test('reconciles a local-only poem as a named server version', async () => {
  const local = version('local-1', 1, 'Texto local', { rhymeMode: 'consonante' });
  local.poemTitle = 'Inédito';
  const storage = new MemoryStorage({
    'escandador.poemMemory.user.7.v1': JSON.stringify({
      schemaVersion: 2, poems: { 'local:abc': [local] }, trash: {},
    }),
  });
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (path === '/api/poems' && !options.method) return jsonResponse({ ok: true, poems: [] });
    if (path === '/api/trash') return jsonResponse({ ok: true, trash: [], deletedPoemIds: [] });
    if (path === '/api/poems' && options.method === 'POST') {
      return jsonResponse({ ok: true, poem: { id: 90, version: 1 } }, 201);
    }
    throw new Error(`Solicitud inesperada: ${options.method || 'GET'} ${path}`);
  };
  const sync = createCloudSync({ request, storage });
  sync.setUser({ id: 7 });

  await sync.loadFromServer();

  const upload = calls.find((call) => call.method === 'POST');
  assert.equal(upload.body.versionName, 'Inédito_version_1');
  assert.equal(upload.body.content, 'Texto local');
});

test('imports an anonymous poem once and remembers its cloud mapping after reload', async () => {
  const anonymousVersion = version('anon-1', 1, 'Texto anónimo');
  anonymousVersion.poemTitle = 'Desde navegador';
  const anonymousMemory = {
    schemaVersion: 2,
    poems: { 'local:anonymous-1': [anonymousVersion] },
    trash: {},
  };
  const storage = new MemoryStorage({
    'escandador.poemMemory.v1': JSON.stringify(anonymousMemory),
    'escandador.poemMemory.anonymous.v1': JSON.stringify(anonymousMemory),
    'escandador.poemMemory.activeOwner.v1': 'anonymous',
  });
  const calls = [];
  let remotePoem = null;
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (path === '/api/poems' && !options.method) {
      return jsonResponse({ ok: true, poems: remotePoem ? [remotePoem] : [] });
    }
    if (path === '/api/trash') return jsonResponse({ ok: true, trash: [], deletedPoemIds: [] });
    if (path === '/api/poems' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      remotePoem = {
        id: 91,
        title: body.title,
        settings: body.settings,
        updatedAt: '2026-01-01T00:00:00.000Z',
        versions: [{
          version: 1,
          versionName: body.versionName,
          content: body.content,
          createdAt: '2026-01-01T00:00:00.000Z',
        }],
      };
      return jsonResponse({ ok: true, poem: { id: 91, version: 1 } }, 201);
    }
    if (path === '/api/poems/91' && options.method === 'PUT') {
      return jsonResponse({ ok: true, poem: { id: 91, version: 2 } });
    }
    throw new Error(`Solicitud inesperada: ${options.method || 'GET'} ${path}`);
  };

  let sync = createCloudSync({ request, storage });
  sync.setUser({ id: 10 });
  assert.equal(sync.getAnonymousPoemCount(), 1);
  assert.equal(sync.importAnonymousPoems(), 1);
  assert.equal(sync.getAnonymousPoemCount(), 0);

  await sync.loadFromServer();
  await sync.loadFromServer();
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1);

  sync = createCloudSync({ request, storage });
  sync.setUser({ id: 10 });
  assert.equal(sync.getAnonymousPoemCount(), 0);
  assert.equal(sync.importAnonymousPoems(), 0);

  const changedAnonymousMemory = structuredClone(anonymousMemory);
  const changedVersion = version('anon-2', 2, 'Texto anónimo revisado');
  changedVersion.poemTitle = 'Desde navegador';
  changedAnonymousMemory.poems['local:anonymous-1'].push(changedVersion);
  storage.setItem('escandador.poemMemory.anonymous.v1', JSON.stringify(changedAnonymousMemory));
  assert.equal(sync.getAnonymousPoemCount(), 1);
  assert.equal(sync.importAnonymousPoems(), 1);

  const accountMemory = JSON.parse(storage.getItem('escandador.poemMemory.user.10.v1'));
  assert.deepEqual(Object.keys(accountMemory.poems), ['local:anonymous-1']);
  assert.equal(accountMemory.poems['local:anonymous-1'].length, 2);
});

test('persists each imported poem mapping before a later upload fails', async () => {
  const first = version('first-1', 1, 'Primer poema');
  first.poemTitle = 'Primero';
  const second = version('second-1', 1, 'Segundo poema');
  second.poemTitle = 'Segundo';
  const storage = new MemoryStorage({
    'escandador.poemMemory.user.11.v1': JSON.stringify({
      schemaVersion: 2,
      poems: { 'local:first': [first], 'local:second': [second] },
      trash: {},
    }),
  });
  const postTitles = [];
  let firstRemotePoem = null;
  let failSecond = true;
  const request = async (path, options = {}) => {
    if (path === '/api/poems' && !options.method) {
      return jsonResponse({ ok: true, poems: firstRemotePoem ? [firstRemotePoem] : [] });
    }
    if (path === '/api/trash') return jsonResponse({ ok: true, trash: [], deletedPoemIds: [] });
    if (path === '/api/poems' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      postTitles.push(body.title);
      if (body.title === 'Segundo' && failSecond) return jsonResponse({ error: 'Sin conexión' }, 503);
      const poemId = body.title === 'Primero' ? 101 : 102;
      if (body.title === 'Primero') {
        firstRemotePoem = {
          id: poemId,
          title: body.title,
          settings: body.settings,
          versions: [{
            version: 1,
            versionName: body.versionName,
            content: body.content,
            createdAt: '2026-01-01T00:00:00.000Z',
          }],
        };
      }
      return jsonResponse({ ok: true, poem: { id: poemId, version: 1 } }, 201);
    }
    throw new Error(`Solicitud inesperada: ${options.method || 'GET'} ${path}`);
  };
  let sync = createCloudSync({ request, storage });
  sync.setUser({ id: 11 });

  await sync.loadFromServer();
  const savedMap = JSON.parse(storage.getItem('escandador.cloudPoemMap.v1:11'));
  assert.equal(savedMap['local:first'].poemId, 101);
  assert.equal(savedMap['local:second'], undefined);

  failSecond = false;
  sync = createCloudSync({ request, storage });
  sync.setUser({ id: 11 });
  await sync.loadFromServer();

  assert.equal(postTitles.filter((title) => title === 'Primero').length, 1);
  assert.equal(postTitles.filter((title) => title === 'Segundo').length, 2);
});

test('discards anonymous poems without changing the signed-in account library', () => {
  const anonymous = version('anonymous-1', 1, 'Solo local');
  anonymous.poemTitle = 'Local';
  const account = version('account-1', 1, 'En mi cuenta');
  account.poemTitle = 'Cuenta';
  const accountMemory = {
    schemaVersion: 2,
    poems: { 'local:account': [account] },
    trash: {},
  };
  const storage = new MemoryStorage({
    'escandador.poemMemory.v1': JSON.stringify(accountMemory),
    'escandador.poemMemory.activeOwner.v1': '12',
    'escandador.poemMemory.user.12.v1': JSON.stringify(accountMemory),
    'escandador.poemMemory.anonymous.v1': JSON.stringify({
      schemaVersion: 2,
      poems: { 'local:anonymous': [anonymous] },
      trash: { Local: [{ deletedAt: '2026-01-01T00:00:00.000Z', versions: [anonymous] }] },
    }),
    'escandador.anonymousImports.v1:12': JSON.stringify({
      'local:anonymous': { targetKey: 'local:account', fingerprint: 'old' },
    }),
  });
  const sync = createCloudSync({ storage });
  sync.setUser({ id: 12 });

  assert.equal(sync.discardAnonymousPoems(), 1);

  const activeMemory = JSON.parse(storage.getItem('escandador.poemMemory.v1'));
  const savedAccountMemory = JSON.parse(storage.getItem('escandador.poemMemory.user.12.v1'));
  const anonymousMemory = JSON.parse(storage.getItem('escandador.poemMemory.anonymous.v1'));
  assert.deepEqual(activeMemory, accountMemory);
  assert.deepEqual(savedAccountMemory, accountMemory);
  assert.deepEqual(anonymousMemory.poems, {});
  assert.equal(anonymousMemory.trash.Local.length, 1);
  assert.deepEqual(JSON.parse(storage.getItem('escandador.anonymousImports.v1:12')), {});
});

test('keeps failed saves in a persistent outbox until retry succeeds', async () => {
  let shouldFail = true;
  const storage = new MemoryStorage();
  const request = async () => shouldFail
    ? jsonResponse({ error: 'Sin conexión' }, 503)
    : jsonResponse({ ok: true, poem: { id: 55, version: 1 } }, 201);
  const sync = createCloudSync({ request, storage });
  sync.setUser({ id: 8 });

  await sync.syncSavedVersion({ poemKey: 'local:retry', title: 'Pendiente', version: version('v1', 1, 'Texto') });
  assert.equal(sync.pendingCount(), 1);

  shouldFail = false;
  await sync.retryPending();
  assert.equal(sync.pendingCount(), 0);
});