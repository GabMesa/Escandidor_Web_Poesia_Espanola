import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
const base=process.env.WORKSHOP_QA_ORIGIN||'http://localhost:8794';
const out='qa/sincronizacion/'+(base.startsWith('https:')?'produccion':'local');
await mkdir(out,{recursive:true});
const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9257',`--user-data-dir=${process.cwd()}\\.wrangler\\sync-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket,send,browserB,created=false;const checks=[],errors=[];
try{
 let targets;for(let i=0;i<50;i++){try{targets=await fetch('http://127.0.0.1:9257/json').then(r=>r.json());break;}catch{await sleep(200);}}
 assert.ok(targets);socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.once('open',r));
 let id=0;const pending=new Map();socket.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
 send=(method,params={})=>new Promise((ok,fail)=>{const key=++id;pending.set(key,m=>m.error?fail(Error(JSON.stringify(m.error))):ok(m.result));socket.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await sleep(100);}console.log(await evaluate(`({status:document.querySelector('#workshop-save-status')?.outerHTML,cloud:app.workshop.cloudSync})`));throw Error('Timed out: '+expression);};
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const shot=async name=>{await evaluate('document.querySelector("#toast").style.display="none"');await sleep(150);const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(out+'/'+name+'.png',Buffer.from(r.data,'base64'));};
 const dimensions=async(width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width<761?844:950,deviceScaleFactor:1,mobile:width<761});await sleep(80);const value=await evaluate(`({width:innerWidth,height:document.querySelector('.topbar').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth})`);assert.equal(value.overflow,false,JSON.stringify(value));assert.ok(value.height<=(width>980?56:108),JSON.stringify(value));checks.push(value);};
 const ready=async()=>{await until('document.readyState==="complete" && !!document.querySelector("#workshop-save-status")');await evaluate(`(async()=>{window.app=(await import('/application-state.js')).applicationState;})()`);await until('app.workshop?.startupComplete');};
 const reload=async()=>{const previous=await evaluate('performance.timeOrigin');await send('Page.reload');await until(`performance.timeOrigin!==${previous} && document.readyState==='complete'`);await ready();};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.clearBrowserCookies');await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage,indexeddb'});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:base+'/taller/?view=editor'});await ready();

 const name='syncqa'+Date.now(),email=name+'@example.test';
 assert.equal(await evaluate(`fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:${JSON.stringify(name)},email:${JSON.stringify(email)},password:'SyncQA123!'})}).then(r=>r.status)`),200);created=true;
 await reload();
 const fill=async(ev,text)=>ev(`(()=>{const d=document.querySelector('#workshop-editor').contentDocument;d.querySelector('#poemTitle').value='Prueba entre dos dispositivos';const e=d.querySelector('#poemInput');e.value=${JSON.stringify(text)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const input=ev=>ev('document.querySelector("#workshop-editor").contentDocument.querySelector("#poemInput").value');
 const saved=async(ev,wait)=>wait('document.querySelector("#workshop-save-status").dataset.state==="saved" && !document.querySelector("[data-account=retry]").disabled && !document.querySelector("[data-account=refresh]").disabled');
 const clickOn=(ev,selector)=>ev(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const setNoCompression=ev=>ev(`(async()=>{const w=document.querySelector('#workshop-editor').contentWindow,a=await w.eval("import('./application-state.js').then(m=>m.applicationState)");a.editor.autoCompressVersions=false;})()`);
 await setNoCompression(evaluate);await fill(evaluate,'Primer texto del dispositivo A.');await click('[data-account=retry]');await saved(evaluate,until);
 browserB=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9258',`--user-data-dir=${process.cwd()}\\.wrangler\\sync-device-b-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
 let targetsB;for(let i=0;i<50;i++){try{targetsB=await fetch('http://127.0.0.1:9258/json').then(r=>r.json());break;}catch{await sleep(200);}}
 const wsB=new WebSocket(targetsB.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>wsB.once('open',r));
 let bid=0;const bp=new Map();wsB.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(bp.has(m.id)){bp.get(m.id)(m);bp.delete(m.id);}});
 const sendB=(method,params={})=>new Promise((ok,fail)=>{const id=++bid;bp.set(id,m=>m.error?fail(Error(JSON.stringify(m.error))):ok(m.result));wsB.send(JSON.stringify({id,method,params}));});
 const evB=async expression=>{const r=await sendB('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
 const waitB=async expr=>{for(let i=0;i<300;i++){if(await evB(expr))return;await sleep(100);}throw Error('Device B timeout: '+expr);};
 const readyB=async()=>{await waitB('document.readyState==="complete" && !!document.querySelector("#workshop-save-status")');await evB(`(async()=>{window.app=(await import('/application-state.js')).applicationState;})()`);await waitB('app.workshop?.startupComplete');};
 await sendB('Runtime.enable');await sendB('Page.enable');await sendB('Network.enable');await sendB('Network.setCacheDisabled',{cacheDisabled:true});await sendB('Network.clearBrowserCookies');await sendB('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage,indexeddb'});await sendB('Page.navigate',{url:base+'/taller/?view=editor'});await readyB();
 assert.equal(await evB(`fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:${JSON.stringify(email)},password:'SyncQA123!'})}).then(r=>r.status)`),200);
 const previous=await evB('performance.timeOrigin');await sendB('Page.reload');await waitB(`performance.timeOrigin!==${previous}`);await readyB();await setNoCompression(evB);
 assert.equal(await input(evB),'Primer texto del dispositivo A.');
 await fill(evaluate,'Un autoguardado distinto, enviado sin pulsar Guardar.');await sleep(10700);
 await until(`fetch('/api/poems').then(r=>r.json()).then(p=>p.poems.some(x=>x.versions.some(v=>v.content==='Un autoguardado distinto, enviado sin pulsar Guardar.')))`);
 await clickOn(evB,'[data-account=refresh]');await saved(evB,waitB);assert.equal(await input(evB),'Un autoguardado distinto, enviado sin pulsar Guardar.');
 await fill(evB,'Borrador B que sigue en edición.');await fill(evaluate,'Una revisión manual completamente nueva en A.');await click('[data-account=retry]');await saved(evaluate,until);
 await evB(`document.querySelector('#workshop-editor').contentWindow.eval("import('./application-state.js').then(m=>m.applicationState.runtime.syncPoemsNow())")`);
 assert.equal(await input(evB),'Borrador B que sigue en edición.');
 await sendB('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await fill(evB,'Versión guardada sin conexión que se recupera al reconectar.');await clickOn(evB,'[data-account=retry]');await waitB('document.querySelector("#workshop-save-status").dataset.state==="error" && !document.querySelector("[data-account=retry]").disabled');
 assert.equal(await input(evB),'Versión guardada sin conexión que se recupera al reconectar.');
 assert.ok(await evB(`import('/poem-storage.js').then(({poemStorage:s})=>s.keys().filter(k=>k.startsWith('escandador.cloudOutbox.v1:')).some(k=>JSON.parse(s.getItem(k)).length>0))`));
 await sendB('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await evB(`document.querySelector('#workshop-editor').contentWindow.dispatchEvent(new Event('online'))`);await saved(evB,waitB);
 await click('[data-account=refresh]');await saved(evaluate,until);assert.equal(await input(evaluate),'Versión guardada sin conexión que se recupera al reconectar.');
 const before=await evaluate('fetch("/api/poems").then(r=>r.json()).then(p=>p.poems[0].versions.length)');
 for(let i=0;i<2;i++){await click('[data-account=refresh]');await saved(evaluate,until);}
 assert.equal(await evaluate('fetch("/api/poems").then(r=>r.json()).then(p=>p.poems[0].versions.length)'),before);
 await dimensions(1440);await shot('01-actualizar-escritorio');await dimensions(320);await dimensions(390);await shot('02-actualizar-movil');
 await dimensions(1440);await fill(evaluate,'Butiá y es');
 const joinBoth=()=>evaluate(`(()=>{const d=document.querySelector('#workshop-editor').contentDocument;for(const index of [0,1]){const b=d.querySelector('.sinalefa-toggle[data-boundary="'+index+'"]');if(b&&!b.classList.contains('is-active'))b.click();}})()`);
 await joinBoth();
 assert.ok(await evaluate(`!!document.querySelector('#workshop-editor').contentDocument.querySelector('.is-triphthong .triphthong-mark')`));
 await evaluate(`(()=>{const f=document.querySelector('#workshop-editor'),d=f.contentDocument;const a=d.querySelector('.is-triphthong');window.scrollTo(0,scrollY+f.getBoundingClientRect().top+a.getBoundingClientRect().top-220);})()`);await shot('03-triptongo-visual');
 await evaluate(`document.querySelector('#workshop-editor').contentDocument.querySelector('#analysisModeToggle').click()`);
 assert.ok(await evaluate(`document.querySelector('#workshop-editor').contentDocument.querySelector('#analysisTextOutput').textContent.includes('Triptongo')`));await shot('04-triptongo-texto');
 await evaluate(`document.querySelector('#workshop-editor').contentDocument.querySelector('#analysisModeToggle').click()`);
 await fill(evaluate,'Me aúlla en');await joinBoth();
 assert.equal(await evaluate(`document.querySelector('#workshop-editor').contentDocument.querySelectorAll('.is-triphthong').length`),0);
 const aullaJoins=await evaluate(`Array.from(document.querySelector('#workshop-editor').contentDocument.querySelectorAll('.sinalefa-toggle.is-active')).map(e=>e.textContent)`);
 assert.ok(aullaJoins.some(text=>text.toLowerCase().replace(/[^a-záéíóúü]/g,'')==='mea'),JSON.stringify(aullaJoins));
 await shot('05-me-aulla-en');
 assert.equal(errors.length,0,JSON.stringify(errors));
 await writeFile(out+'/verificacion.json',JSON.stringify({checkedAt:new Date().toISOString(),twoIsolatedDevices:true,autoSavesReachServer:true,refreshDownloads:true,preservesDraftDuringDownload:true,offlineSavedPersistently:true,retriesOnReconnect:true,noDuplicatesOnRepeatedRefresh:true,headerWidths:[320,390,1440],consoleErrors:0},null,2));
 await writeFile(out+'/galeria.html',`<!doctype html><meta charset="utf-8"><title>Sincronización y triptongos</title><style>body{font:16px system-ui;background:#e6e4d9;margin:20px}img{display:block;max-width:100%;margin:16px 0 30px}</style><h1>Sincronización y triptongos</h1>${['01-actualizar-escritorio','02-actualizar-movil','03-triptongo-visual','04-triptongo-texto','05-me-aulla-en'].map(n=>'<h2>'+n+'</h2><img src="'+n+'.png">').join('')}`);
 console.log('Verified two isolated devices: autosave upload, refresh download, draft protection, offline retry, no duplicates, mobile header.');await sendB('Browser.close');wsB.close();
}finally{
 if(created&&send){try{const r=await send('Runtime.evaluate',{expression:`fetch('${base}/api/auth/account',{method:'DELETE',credentials:'include'}).then(r=>r.status)`,awaitPromise:true,returnByValue:true});assert.equal(r.result.value,200);console.log('Temporary QA account deleted.');}catch(e){console.error('QA cleanup failed:',e.message);process.exitCode=1;}}
 try{await send?.('Browser.close');}catch{}socket?.close();if(browser.exitCode===null)browser.kill();if(browserB&&browserB.exitCode===null)browserB.kill();
}
