import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudSync as createRevisionCloudSync } from '../cloud-sync.js';
import { compressPoemVersions } from '../poem-compression.js';

// Legacy fixtures model a server without revision support. Revision-aware
// requests and invalidation are exercised separately below.
function createCloudSync(options) {
  return createRevisionCloudSync({...options,request:(path,...args)=>path==='/api/sync-status'
    ? Promise.resolve(jsonResponse({ok:true})) : options.request(path,...args)});
}

test('unchanged 5000-version libraries avoid all history and trash reads; remote edits, local drafts and refresh invalidate the snapshot',async()=>{
 const storage=new MemoryStorage(),calls=[];let revision='1',content='Original';
 const sync=createRevisionCloudSync({storage,request:async(path,options={})=>{
  calls.push(path);
  if(path==='/api/sync-status')return jsonResponse({revision});
  if(path==='/api/trash')return jsonResponse({trash:[],deletedPoemIds:[]});
  if(options.method)return jsonResponse({poem:{id:11,version:2}});
  const after=Number(new URL(path,'https://example.test').searchParams.get('afterVersion'))||0;
  const versions=Array.from({length:Math.min(200,5000-after)},(_,i)=>({version:after+i+1,content:after+i===0?content:'Verso '+(after+i),sync:{id:after+i===0?'one':'version-'+(after+i)}}));
  return jsonResponse({poems:[{id:11,title:'Luna',versions}],nextCursor:after+200<5000?{poemId:11,version:after+200}:null});
 }});
 sync.setUser({id:93});await sync.loadFromServer();
 assert.equal(JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:11'].length,5000);
 assert.equal(calls.filter(path=>path.startsWith('/api/poems?')).length,25);calls.length=0;
 for(let i=0;i<120;i++)await sync.loadFromServer();
 assert.equal(calls.length,120);assert.ok(calls.every(path=>path==='/api/sync-status'));
 content='Cambio del otro dispositivo';revision='2';calls.length=0;await sync.loadFromServer();
 assert.ok(calls.some(path=>path.startsWith('/api/poems?')));
 assert.equal(JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:11'][0].poemText,content);
 calls.length=0;await sync.loadFromServer({force:true});assert.ok(calls.includes('/api/trash'));
 const memory=JSON.parse(storage.getItem('escandador.poemMemory.v1'));memory.poems['server:11'].push({...version('offline',2,'Borrador sin subir'),poemTitle:'Luna'});
 storage.setItem('escandador.poemMemory.v1',JSON.stringify(memory));calls.length=0;await sync.loadFromServer();
 assert.ok(calls.includes('/api/poems/11'));
 calls.length=0;sync.setUser(null);sync.setUser({id:93});await sync.loadFromServer();assert.ok(calls.includes('/api/trash'));
});

test('incremental replacement uses stable IDs when a deleted numeric position is reused',async()=>{
 const storage=new MemoryStorage();let cursor=2;
 const poem={id:11,title:'Luna',versions:[{version:1,content:'Original',sync:{id:'one'}},{version:2,content:'Versión retirada',sync:{id:'old'}}]};
 const sync=createRevisionCloudSync({storage,request:async path=>{
  if(path==='/api/sync-status')return jsonResponse({revision:String(cursor),changeCursor:cursor});
  if(path==='/api/trash')return jsonResponse({trash:[]});
  if(path.startsWith('/api/poems/changes'))return jsonResponse({changes:[{poemId:11,version:2,poem:{id:11,title:'Luna'},versionData:{version:2,content:'Otra versión con identidad nueva',sync:{id:'new'}}}],nextCursor:null});
  return jsonResponse({poems:[poem]});
 }});
 sync.setUser({id:93});await sync.loadFromServer();cursor=4;await sync.loadFromServer();
 const versions=JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:11'];
 assert.deepEqual(versions.map(v=>v.id),['one','new']);assert.equal(versions[1].poemText,'Otra versión con identidad nueva');
});

test('revision checks retry pending uploads and never hide network failures',async()=>{
 const storage=new MemoryStorage(),state={user:null,queue:Promise.resolve()};let offline=false,uploads=0,reads=0;
 const sync=createRevisionCloudSync({storage,state,request:async(path,options={})=>{
  if(offline)return jsonResponse({error:'Sin conexión'},503);
  if(options.method){uploads++;return jsonResponse({poem:{id:11,version:1}});}
  if(path==='/api/sync-status')return jsonResponse({revision:'stable'});
  if(path==='/api/trash')return jsonResponse({trash:[]});
  reads++;return jsonResponse({poems:[]});
 }});
 sync.setUser({id:94});await sync.loadFromServer();offline=true;
 await sync.syncSavedVersion({poemKey:'luna',title:'Luna',version:version('one',1,'Luna primera')});
 await sync.loadFromServer();assert.ok(state.error);assert.equal(sync.pendingCount(),1);
 offline=false;await sync.loadFromServer();assert.equal(uploads,1);assert.equal(sync.pendingCount(),0);assert.equal(state.error,null);
 assert.equal(reads,1);
});

test('merged server poems and multiple local keys converge to one poem without losing an offline revision',async()=>{
 const storage=new MemoryStorage(),writes=[];
 const remote={id:11,title:'Luna',versions:[{version:1,content:'Original',sync:{id:'one'}},{version:2,content:'Otra revisión',sync:{id:'two'}}]};
 const sync=createCloudSync({storage,request:async(path,options={})=>{
  if(path==='/api/trash')return jsonResponse({trash:[],mergedPoems:[{sourceId:22,targetId:11}]});
  if(!options.method)return jsonResponse({poems:[remote]});
  writes.push(path);return jsonResponse({poem:{id:11,version:3},syncedVersion:3});
 }});
 sync.setUser({id:93});
 storage.setItem('escandador.poemMemory.v1',JSON.stringify({poems:{'server:11':[version('one',1,'Original')],'server:22':[version('two',1,'Otra revisión'),version('offline',2,'Cambio sin conexión')]},trash:{}}));
 await sync.loadFromServer();
 const poems=Object.values(JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems).filter(v=>v.length);
 assert.equal(poems.length,1);assert.deepEqual(new Set(poems[0].map(v=>v.poemText)),new Set(['Original','Otra revisión','Cambio sin conexión']));
 assert.deepEqual(writes,['/api/poems/11']);
});

test('automatic compression reconciles complete histories for multiple poems and remains stable on later pulls', async () => {
  const storage = new MemoryStorage(), compressed = [], archived = [];
  const poems = [11, 22, 33].map(id => ({ id, title: `Poema ${id}`, versions: Array.from({length: 1700}, (_, index) => ({
    version: index + 1, content: `Estado ${index % 7} del poema ${id}`,
    sync: {id: `${id}-${index}`, versionNumber: index + 1, savedAt: new Date(2026, 0, 1, 0, 0, index).toISOString(), settings: {poemFont: index === 0 ? 'lora' : 'atkinson'}}
  })) }));
  const sync = createCloudSync({storage, shouldAutoCompress: () => true, request: async (path, options = {}) => {
    if (path === '/api/trash') return jsonResponse({trash: [], compressedVersions: archived});
    if (!options.method) return jsonResponse({poems});
    const id = Number(/^\/api\/poems\/(\d+)\/compress$/.exec(path)?.[1]);
    assert.ok(id, `Unexpected write: ${path}`);
    const poem = poems.find(p => p.id === id);
    const plan = compressPoemVersions(poem.versions.map(v => ({id: v.sync.id, versionNumber: v.version, poemText: v.content, settings: v.sync.settings})));
    const retired = new Set(plan.removed.map(v => v.id));
    archived.push(...poem.versions.filter(v => retired.has(v.sync.id)).map(v => ({poemId: id, version: v.version, clientId: v.sync.id})));
    poem.versions = poem.versions.filter(v => !retired.has(v.sync.id));
    compressed.push(id);
    return jsonResponse({removed: retired.size, more: false});
  }});
  sync.setUser({id: 90});
  await sync.loadFromServer();
  await sync.loadFromServer();
  assert.deepEqual(compressed, [11, 22, 33]);
  const memory = JSON.parse(storage.getItem('escandador.poemMemory.v1'));
  for (const id of [11, 22, 33]) {
    assert.equal(memory.poems[`server:${id}`].length, 8);
    assert.equal(memory.poems[`server:${id}`].at(-1).id, `${id}-1699`);
  }
  assert.equal(archived.length, 5076);
});

test('automatic compression covers manual saves, autosaves and grouped imports, and respects disabling it', async () => {
  let enabled = false;
  const calls = [];
  const sync = createCloudSync({storage: new MemoryStorage(), shouldAutoCompress: () => enabled, request: async (path, options) => {
    calls.push(path);
    if (path.endsWith('/compress')) return jsonResponse({removed: 0, more: false});
    const body = JSON.parse(options.body);
    return jsonResponse({poem: {id: body.title === 'Luna' ? 11 : 22, version: 1}});
  }});
  sync.setUser({id: 91});
  await sync.syncSavedVersion({poemKey: 'luna', title: 'Luna', version: version('one', 1, 'Luna primera')});
  assert.ok(!calls.some(path => path.endsWith('/compress')));
  enabled = true;
  await sync.syncSavedVersion({poemKey: 'luna', title: 'Luna', version: {...version('two', 2, 'Luna segunda'), kind: 'autosave'}});
  await sync.syncSavedVersion({poemKey: 'luna', title: 'Luna', version: version('three', 3, 'Luna tercera')});
  const before = calls.length;
  await sync.syncImportedVersions([
    {poemKey: 'luna', title: 'Luna', version: version('four', 4, 'Luna cuarta')},
    {poemKey: 'luna', title: 'Luna', version: version('five', 5, 'Luna quinta')},
    {poemKey: 'sol', title: 'Sol', version: version('sun', 1, 'Sol primero')},
  ]);
  assert.deepEqual(calls.slice(before).filter(path => path.endsWith('/compress')), ['/api/poems/11/compress', '/api/poems/22/compress']);
  assert.equal(calls.filter(path => path.endsWith('/compress')).length, 4);
  assert.equal(sync.pendingCount(), 0);
});

test('explicit compression checks the server even when the local history has no redundant versions', async () => {
  const storage = new MemoryStorage(), calls = [];
  const sync = createCloudSync({storage, request: async (path) => {
    calls.push(path);
    return jsonResponse({removed: 0, more: false});
  }});
  sync.setUser({id: 92});
  storage.setItem('escandador.cloudPoemMap.v1:92', JSON.stringify({poem: {poemId: 11, versions: {}}}));
  await sync.compressVersions({poemKey: 'poem', title: 'Cualquier poema', force: true, versionIds: [], retainedVersions: []});
  assert.deepEqual(calls, ['/api/poems/11/compress']);
  assert.equal(sync.pendingCount(), 0);
});

test('a legacy local ID confirmed as compressed is removed on the next pull',async()=>{
 const storage=new MemoryStorage();
 const sync=createCloudSync({storage,request:async(path,options={})=>{
  if(options.method==='PUT'){assert.equal(JSON.parse(options.body).sync.cloudVersion,1);return jsonResponse({poem:{id:64,version:2},syncedVersion:2,compressed:true});}
  if(path==='/api/trash')return jsonResponse({trash:[],compressedVersions:[{poemId:64,version:1,clientId:'server-old',replacementVersion:2}]});
  return jsonResponse({poems:[{id:64,title:'Golem',versions:[{version:2,content:'Texto conservado',sync:{id:'kept',settings:{poemFont:'atkinson'}}}]}]});
 }});
 sync.setUser({id:9});const old=version('legacy-local',1,'Texto anterior');
 storage.setItem('escandador.poemMemory.v1',JSON.stringify({poems:{'server:64':[old]},trash:{}}));
 storage.setItem('escandador.cloudPoemMap.v1:9',JSON.stringify({'server:64':{poemId:64,versions:{'legacy-local':{cloudVersion:1}}}}));
 await sync.syncSavedVersion({poemKey:'server:64',title:'Golem',version:old});await sync.loadFromServer();
 assert.deepEqual(JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:64'].map(v=>v.id),['kept']);
});

test('a device pulling a compressed poem removes retired cached checkpoints instead of restoring them',async()=>{
 const storage=new MemoryStorage();
 const request=async path=>path==='/api/trash'?jsonResponse({trash:[],deletedPoemIds:[],compressedVersions:[{poemId:64,version:1,clientId:'old',replacementVersion:2}]}):jsonResponse({poems:[{id:64,title:'Golem',settings:{poemFont:'atkinson'},versions:[{version:2,content:'Texto distinto',sync:{id:'kept',settings:{poemFont:'atkinson'},savedAt:'2026-10-15T00:00:02Z'}}]}]});
 const sync=createCloudSync({storage,request});sync.setUser({id:9});
 storage.setItem('escandador.poemMemory.v1',JSON.stringify({schemaVersion:2,poems:{'server:64':[{...version('old',1,'Texto viejo'),cloudVersion:1},{...version('kept',2,'Texto distinto'),cloudVersion:2}]},trash:{}}));
 await sync.loadFromServer();
 assert.deepEqual(JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:64'].map(v=>v.id),['kept']);
});

test('import progress confirms actual uploads and preserves the remaining selection after a cut',async()=>{
 const storage=new MemoryStorage(),state={user:null,queue:Promise.resolve()},seen=[];let offline=false;
 const sync=createCloudSync({storage,state,request:async()=>{if(offline)throw Error('Sin conexión');offline=true;return jsonResponse({poem:{id:81,version:1}});}});
 sync.setUser({id:13});
 await sync.syncImportedVersions([1,2,3].map(n=>({poemKey:'p'+n,title:'Poema '+n,version:version('import-'+n,n,'Verso '+n)})),p=>seen.push(p));
 assert.deepEqual(seen.map(p=>p.completed),[0,1,1]);assert.equal(sync.pendingCount(),2);assert.equal(state.error.message,'Sin conexión');
 assert.equal(seen.at(-1).title,'Poema 2');
});

test('distinct stable versions with identical text survive repeated downloads and receive remote metadata',async()=>{
 const storage=new MemoryStorage();let font='lora';
 const sync=createCloudSync({storage,request:async(path)=>path==='/api/trash'?jsonResponse({trash:[],deletedPoemIds:[]}):jsonResponse({poems:[{id:45,title:'Repetición',settings:{},versions:[1,2].map(n=>({version:n,content:'Mismo texto',versionName:'Revisión '+n,sync:{id:'stable-'+n,kind:'manual',versionNumber:n,savedAt:new Date(2026,0,n).toISOString(),settings:{poemFont:font}}}))}]})});
 sync.setUser({id:12});await sync.loadFromServer();font='atkinson';await sync.loadFromServer();
 const versions=JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems['server:45'];
 assert.equal(versions.length,2);assert.deepEqual(versions.map(v=>v.id),['stable-1','stable-2']);assert.ok(versions.every(v=>v.settings.poemFont==='atkinson'));
});

test('a save arriving during a download survives and is uploaded afterward', async () => {
  let release, started;
  const gate = new Promise(r => { release = r; });
  const fetching = new Promise(r => { started = r; });
  const storage = new MemoryStorage();
  const writes = [];
  const sync = createCloudSync({ storage, request: async (path, options = {}) => {
    if (path.split('?')[0] === '/api/poems' && !options.method) {
      started(); await gate;
      return jsonResponse({poems:[]});
    }
    if (path === '/api/trash') return jsonResponse({trash:[],deletedPoemIds:[]});
    writes.push(JSON.parse(options.body));
    return jsonResponse({poem:{id:81,version:writes.length}});
  }});
  sync.setUser({id:19});
  const downloading = sync.loadFromServer();
  await fetching;
  const latest = {...version('during-download',43,'El texto escrito mientras llegaba la nube.'),kind:'autosave',poemTitle:'Mi poema'};
  storage.setItem('escandador.poemMemory.v1',JSON.stringify({schemaVersion:2,poems:{'local:poem':[latest]},trash:{}}));
  const saving = sync.syncSavedVersion({poemKey:'local:poem',title:'Mi poema',version:latest});
  release(); await downloading; await saving;
  const memory = JSON.parse(storage.getItem('escandador.poemMemory.v1'));
  assert.equal(memory.poems['local:poem'][0].poemText,latest.poemText);
  assert.equal(writes.length,1);
  assert.equal(writes[0].sync.versionNumber,43);
  assert.equal(writes[0].sync.kind,'autosave');
});

test('a successful later save cannot hide an earlier failed upload', async () => {
  let offline = true;
  const storage = new MemoryStorage(), state = {user:null,queue:Promise.resolve()}, statuses=[];
  const sync = createCloudSync({storage,state,onStatus:status=>statuses.push(status),request:async()=>{
    if(offline)throw Error('Sin conexión');
    return jsonResponse({poem:{id:81,version:1}});
  }});
  sync.setUser({id:20});
  await sync.syncSavedVersion({title:'Mi poema',version:version('offline',1,'Primera versión')});
  offline=false;
  await sync.syncSavedVersion({title:'Mi poema',version:version('online',2,'Segunda versión')});
  assert.equal(sync.pendingCount(),1);
  assert.equal(statuses.at(-1),'error');
  assert.ok(state.error);
  await sync.retryPending();
  assert.equal(sync.pendingCount(),0);
  assert.equal(statuses.at(-1),'ready');
  assert.equal(state.error,null);
});

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
    if (path.split('?')[0] === '/api/poems' && !options.method) return jsonResponse({ ok: true, poems: [] });
    if (path.split('?')[0] === '/api/poems' && options.method === 'POST') {
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
    version: version('local-v2', 2, 'Segundo texto', {
      poemFont: 'garamond', poeticForm: 'silva', syllablePattern: '7 11',
      stressPatterns: { 7: '3-6', 11: '6-10' },
      rhymeMode: 'asonante', repeatRhymeScheme: true, rhymeSchemeSharedRhymes: false, rhymeScheme: "-aab'-ccb', -AAB'-CCB'",
    }),
  });

  const writes = calls.filter((call) => call.method !== 'GET');
  assert.equal(writes.length, 2);
  assert.deepEqual(writes.map(({ method, path }) => `${method} ${path}`), [
    'POST /api/poems',
    'PUT /api/poems/41',
  ]);
  assert.deepEqual(writes[1].body.settings, {
    poemFont: 'garamond',
    poeticForm: 'silva',
    syllablePattern: '7 11',
    stressPatterns: { 7: '3-6', 11: '6-10' },
    rhymeMode: 'asonante',
    repeatRhymeScheme: true,
    rhymeSchemeSharedRhymes: false,
    rhymeScheme: "-aab'-ccb', -AAB'-CCB'",
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

test('appends to a server poem when its local cloud mapping is missing', async () => {
  const calls = [];
  const sync = createCloudSync({
    storage: new MemoryStorage(),
    request: async (path, options = {}) => {
      calls.push({ path, method: options.method || 'GET' });
      if (path === '/api/poems/73' && options.method === 'PUT') {
        return jsonResponse({ ok: true, poem: { id: 73, version: 2 } });
      }
      throw new Error(`Solicitud inesperada: ${options.method || 'GET'} ${path}`);
    },
  });
  sync.setUser({ id: 9 });

  await sync.syncSavedVersion({
    poemKey: 'server:73',
    title: 'Poema existente',
    version: version('cloud-73-1', 2, 'Nueva versión'),
  });

  assert.deepEqual(calls, [{ path: '/api/poems/73', method: 'PUT' }]);
});

test('replaces account data from the server and restores anonymous data on logout', async () => {
  const anonymousMemory = { poems: { Anonimo: [version('anon-1', 1, 'Local')] }, trash: {} };
  const storage = new MemoryStorage({
    'escandador.poemMemory.v1': JSON.stringify(anonymousMemory),
  });
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (path.split('?')[0] === '/api/poems' && !options.method) {
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

test('restores a database trash entry for an authenticated user', async () => {
  const calls = [];
  const sync = createCloudSync({
    storage: new MemoryStorage(),
    request: async (path, options = {}) => {
      calls.push({
        path,
        method: options.method || 'GET',
        body: options.body ? JSON.parse(options.body) : null,
      });
      return jsonResponse({ ok: true, poemId: 73 });
    },
  });
  sync.setUser({ id: 3 });

  await sync.restoreTrashEntry(12);

  assert.deepEqual(calls, [{
    path: '/api/trash', method: 'POST', body: { trashId: 12 },
  }]);
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
    if (path.split('?')[0] === '/api/poems') return jsonResponse({ ok: true, poems: [] });
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

test('uploads autosaves automatically and deduplicates retries', async () => {
  let requests = 0;
  const sync = createCloudSync({
    storage: new MemoryStorage(),
    request: async () => { requests += 1; return jsonResponse({poem:{id:91,version:1}}); },
  });
  sync.setUser({ id: 2 });

  await sync.syncSavedVersion({
    title: 'Borrador',
    version: { ...version('auto-1', 1, 'Cambio'), kind: 'autosave' },
  });

  assert.equal(requests, 1);
  await sync.syncSavedVersion({title:'Borrador',version:{...version('auto-1',1,'Cambio'),kind:'autosave'}});
  assert.equal(requests,1);
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
    if (path.split('?')[0] === '/api/poems' && !options.method) return jsonResponse({ ok: true, poems: [{
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
    if (path.split('?')[0] === '/api/poems') return jsonResponse({ ok: true, poems: [
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
    if (path.split('?')[0] === '/api/poems' && !options.method) return jsonResponse({ ok: true, poems: [] });
    if (path === '/api/trash') return jsonResponse({ ok: true, trash: [], deletedPoemIds: [] });
    if (path.split('?')[0] === '/api/poems' && options.method === 'POST') {
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
    if (path.split('?')[0] === '/api/poems' && !options.method) {
      return jsonResponse({ ok: true, poems: remotePoem ? [remotePoem] : [] });
    }
    if (path === '/api/trash') return jsonResponse({ ok: true, trash: [], deletedPoemIds: [] });
    if (path.split('?')[0] === '/api/poems' && options.method === 'POST') {
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
    if (path.split('?')[0] === '/api/poems' && !options.method) {
      return jsonResponse({ ok: true, poems: firstRemotePoem ? [firstRemotePoem] : [] });
    }
    if (path === '/api/trash') return jsonResponse({ ok: true, trash: [], deletedPoemIds: [] });
    if (path.split('?')[0] === '/api/poems' && options.method === 'POST') {
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

test('compression saves a replacement autosave before deleting its old cloud version', async () => {
  const calls = [];
  const storage = new MemoryStorage();
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method });
    return jsonResponse({ ok: true, poem: { id: 55, version: options.method === 'PUT' ? 2 : 1 } });
  };
  const sync = createCloudSync({ storage, request });
  sync.setUser({ id: 8 });
  await sync.syncSavedVersion({ poemKey: 'local:poem', title: 'Luna', version: version('v1', 1, 'la') });
  const replacement = { ...version('v2', 2, 'la luna'), kind: 'autosave' };
  await sync.compressVersions({ poemKey: 'local:poem', title: 'Luna', versionIds: ['v1'], retainedVersions: [replacement] });
  assert.deepEqual(calls.map(call => `${call.method} ${call.path}`), ['POST /api/poems', 'PUT /api/poems/55', 'POST /api/poems/55/compress']);
  assert.equal(replacement.kind, 'autosave');
  assert.equal(sync.pendingCount(), 0);
});

test('a failed replacement upload keeps the old cloud copy and compression pending', async () => {
  let offline = false;
  const calls = [];
  const storage = new MemoryStorage();
  const request = async (path, options = {}) => {
    calls.push(options.method);
    return offline ? jsonResponse({ error: 'Sin conexión' }, 503) : jsonResponse({ ok: true, poem: { id: 55, version: options.method === 'PUT' ? 2 : 1 } });
  };
  const sync = createCloudSync({ storage, request });
  sync.setUser({ id: 8 });
  await sync.syncSavedVersion({ poemKey: 'local:poem', title: 'Luna', version: version('v1', 1, 'la') });
  offline = true;
  await sync.compressVersions({ poemKey: 'local:poem', title: 'Luna', versionIds: ['v1'], retainedVersions: [version('v2', 2, 'la luna')] });
  assert.equal(calls.includes('DELETE'), false);
  assert.equal(sync.pendingCount(), 1);
  offline = false;
  await sync.retryPending();
  assert.equal(calls.at(-1), 'POST');
  assert.equal(sync.pendingCount(), 0);
});

test('compression without cloud versions stays local', async () => {
  const sync = createCloudSync({ storage: new MemoryStorage(), request: () => { throw Error('No se esperaba una petición'); } });
  sync.setUser({ id: 8 });
  await sync.compressVersions({ poemKey: 'local:poem', title: 'Luna', versionIds: ['local-v1'], retainedVersions: [version('local-v2', 2, 'la luna')] });
  assert.equal(sync.pendingCount(), 0);
});

test('compression protects a retained alias of the same cloud version', async () => {
  const calls = [];
  const sync = createCloudSync({ storage: new MemoryStorage(), request: async (path, options) => {
    calls.push(options.method);
    return jsonResponse({ ok: true, poem: { id: 55, version: 1 } });
  } });
  sync.setUser({ id: 8 });
  const first = version('v1', 1, 'la luna');
  const second = { ...first, id: 'v2' };
  await sync.syncSavedVersion({ poemKey: 'local:poem', title: 'Luna', version: first });
  await sync.syncSavedVersion({ poemKey: 'local:poem', title: 'Luna', version: second });
  await sync.compressVersions({ poemKey: 'local:poem', title: 'Luna', versionIds: ['v1'], retainedVersions: [second] });
  assert.equal(calls.includes('DELETE'), false);
  assert.equal(sync.pendingCount(), 0);
});

test('compression supersedes an unsent old save without resurrecting it on retry', async () => {
  let offline = true;
  const calls = [];
  const sync = createCloudSync({ storage: new MemoryStorage(), request: async (path, options) => {
    if (offline) return jsonResponse({ error: 'Sin conexión' }, 503);
    calls.push({ method: options.method, content: JSON.parse(options.body || '{}').content });
    return jsonResponse({ ok: true, poem: { id: 55, version: 1 } });
  } });
  sync.setUser({ id: 8 });
  await sync.syncSavedVersion({ poemKey: 'local:poem', title: 'Luna', version: version('v1', 1, 'la') });
  offline = false;
  await sync.compressVersions({ poemKey: 'local:poem', title: 'Luna', versionIds: ['v1'], retainedVersions: [version('v2', 2, 'la luna')] });
  assert.equal(sync.pendingCount(), 0);
  await sync.retryPending();
  assert.deepEqual(calls, [{ method: 'POST', content: 'la luna' }]);
});
