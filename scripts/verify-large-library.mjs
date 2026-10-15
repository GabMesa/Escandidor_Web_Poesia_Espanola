import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
const base=process.env.WORKSHOP_QA_ORIGIN||'http://localhost:8794';
const port=base.startsWith('https:')?9262:9259,profile=base.startsWith('https:')?'production':'local';
const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${port}`,`--user-data-dir=${process.cwd()}\\.wrangler\\large-library-qa-${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket,send,created=false;
try{
 let targets;for(let i=0;i<50;i++){try{targets=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());break;}catch{await sleep(200);}}
 socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.once('open',r));
 let id=0;const pending=new Map();socket.on('message',raw=>{const m=JSON.parse(raw);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
 send=(method,params={})=>new Promise((ok,fail)=>{const key=++id;pending.set(key,m=>m.error?fail(Error(JSON.stringify(m.error))):ok(m.result));socket.send(JSON.stringify({id:key,method,params}));});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
 const ready=async()=>{for(let i=0;i<200;i++){if(await ev(`document.readyState==='complete'&&location.pathname.startsWith('/apoyar')`))return;await sleep(100);}throw Error('Page timeout');};
 await send('Page.enable');await send('Network.enable');await send('Network.clearBrowserCookies');await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage,indexeddb'});
 await send('Page.navigate',{url:base+'/apoyar.html'});await ready();
 const name='largeqa'+Date.now();
 assert.equal(await ev(`fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'${name}',email:'${name}@example.test',password:'SyncQA123!'})}).then(r=>r.status)`),200);created=true;
 await ev(`(async()=>{
 window.user=(await fetch('/api/auth/me').then(r=>r.json())).user;
 window.store=(await import('/poem-storage.js')).poemStorage;
 window.syncState={user:null,queue:Promise.resolve()};window.counts={uploads:0,pages:0};window.interruptUpload=true;
 window.makeSync=async()=>{window.sync=(await import('/cloud-sync.js')).createCloudSync({storage:store,state:syncState,request:(path,options)=>{if(path.includes('/versions')){counts.uploads++;if(interruptUpload&&counts.uploads===7){interruptUpload=false;throw Error('QA: conexión interrumpida');}}if(path.includes('?limit='))counts.pages++;return fetch(path,options);}});sync.setUser(user);};
 await makeSync();const poems={};
 for(let p=0;p<100;p++){const title='Poema de prueba '+p;poems['test:'+p]=Array.from({length:50},(_,i)=>({id:'large-'+p+'-'+i,poemTitle:title,versionNumber:i+1,label:'Revisión '+(i+1),kind:i%3?'autosave':'manual',savedAt:new Date(Date.UTC(2026,0,1,0,p,i)).toISOString(),poemText:'Poema '+p+', revisión '+i+'.\\n'+('La memoria del viento conserva cada verso.\\n'.repeat(30)),settings:{poemFont:i%2?'lora':'atkinson',rhymeMode:'asonante'},sinalefaOverrides:{},lineOverrides:{}}));}
 window.expected=Object.values(poems).flat();window.originalBytes=JSON.stringify(poems).length*2;
 store.setItem('escandador.poemMemory.v1',JSON.stringify({schemaVersion:2,poems,trash:{}}));await store.flush();
 })()`);
 const started=Date.now();
 await ev(`sync.loadFromServer()`);
 assert.equal(await ev('syncState.error?.message'),'QA: conexión interrumpida');
 assert.equal(await ev(`Object.values(JSON.parse(store.getItem('escandador.poemMemory.v1')).poems).flat().length`),5000);
 await ev(`sync.loadFromServer()`);
 assert.equal(await ev('syncState.error?.message||null'),null);
 const uploadedMs=Date.now()-started;
 assert.equal(await ev(`Object.values(JSON.parse(store.getItem('escandador.cloudPoemMap.v1:'+user.id))).reduce((n,p)=>n+Object.keys(p.versions).length,0)`),5000);
 console.log('5000 versions uploaded; verifying paginated download and persistent reload.');
 const uploadedCounts=await ev('({...counts})');assert.ok(uploadedCounts.uploads<=301,JSON.stringify(uploadedCounts));
 await ev(`(async()=>{for(const k of store.keys())store.removeItem(k);await store.flush();syncState={user:null,queue:Promise.resolve()};counts={uploads:0,pages:0};await makeSync();await sync.loadFromServer();await store.flush();})()`);
 assert.equal(await ev('syncState.error?.message||null'),null);
 const result=await ev(`(()=>{const versions=Object.values(JSON.parse(store.getItem('escandador.poemMemory.v1')).poems).flat(),found=new Map(versions.map(v=>[v.id,v]));return {versions:versions.length,bytes:originalBytes,pages:counts.pages,writeRequests:counts.uploads,exact:expected.every(v=>{const r=found.get(v.id);return r&&r.poemText===v.poemText&&r.settings.poemFont===v.settings.poemFont&&r.kind===v.kind&&r.savedAt===v.savedAt&&r.versionNumber===v.versionNumber;}),localStorageLibraryKeys:Object.keys(localStorage).filter(k=>k.startsWith('escandador.poemMemory.')).length};})()`);
 assert.equal(result.versions,5000);assert.equal(result.exact,true);assert.equal(result.pages,26);assert.equal(result.writeRequests,0);assert.equal(result.localStorageLibraryKeys,0);assert.ok(result.bytes>10*1024*1024);
 // Idempotent second pull and a full browser reload from IndexedDB.
 await ev('sync.loadFromServer()');assert.equal(await ev('syncState.error?.message||null'),null);
 const previous=await ev('performance.timeOrigin');await send('Page.reload');for(let i=0;i<200;i++){if(await ev(`performance.timeOrigin!==${previous}&&document.readyState==='complete'`))break;await sleep(100);}
 assert.equal(await ev(`import('/poem-storage.js').then(({poemStorage:s})=>Object.values(JSON.parse(s.getItem('escandador.poemMemory.v1')).poems).flat().length)`),5000);
 const uiStarted=Date.now();await send('Page.navigate',{url:base+'/taller/?view=library'});
 let uiReady=false;for(let i=0;i<600;i++){uiReady=await ev(`document.readyState==='complete'&&!!document.querySelector('#workshop-save-status')&&import('/application-state.js').then(m=>!!m.applicationState.workshop?.startupComplete)`);if(uiReady)break;await sleep(100);}
 assert.ok(uiReady,'Workshop failed to open the large library');
 assert.equal(await ev(`document.querySelector('#poem-count').textContent`),'100');
 console.log('Workshop opens with 100 poems and 5000 versions in '+(Date.now()-uiStarted)+' ms.');
 await mkdir('qa/sincronizacion',{recursive:true});await writeFile('qa/sincronizacion/5000-versiones.json',JSON.stringify({...result,uploadedMs,uploadBatches:uploadedCounts.uploads,resumesInterruptedUpload:true,persistentAfterReload:true,checkedAt:new Date().toISOString(),origin:base},null,2));
 console.log(JSON.stringify({...result,uploadedMs,uploadBatches:uploadedCounts.uploads,persistentAfterReload:true}));
}finally{
 if(created&&send){const r=await send('Runtime.evaluate',{expression:`fetch('/api/auth/account',{method:'DELETE'}).then(r=>r.status)`,awaitPromise:true,returnByValue:true});assert.equal(r.result.value,200);console.log('Temporary QA account deleted.');}
 try{await send?.('Browser.close');}catch{}socket?.close();if(browser.exitCode===null)browser.kill();
}
