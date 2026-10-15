import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
import {parsePoemsFromMarkdown} from '../poem-markdown-import.js';
const base=process.env.WORKSHOP_QA_ORIGIN||'http://localhost:8794';
if(process.argv[2]&&base.startsWith('https:'))throw Error('Private collections may only be verified locally.');
const markdown=process.argv[2]?await readFile(process.argv[2],'utf8'):'# Primero\n\nUn verso de prueba.\n\n# Segundo\n\nOtro verso distinto.\n\n# Último\n\nLa memoria permanece.';
const expected=parsePoemsFromMarkdown(markdown),port=9264,errors=[];
const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${port}`,`--user-data-dir=${process.cwd()}\\.wrangler\\import-open-qa`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket,send,created=false;
try{
 let targets;for(let i=0;i<50;i++){try{targets=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());break;}catch{await sleep(100);}}
 socket=new WebSocket(targets.find(t=>t.type==='page'&&!t.url.startsWith('edge://')).webSocketDebuggerUrl);await new Promise(r=>socket.once('open',r));
 let id=0;const pending=new Map();socket.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
 send=(method,params={})=>new Promise((ok,fail)=>{const key=++id;pending.set(key,m=>m.error?fail(Error(JSON.stringify(m.error))):ok(m.result));socket.send(JSON.stringify({id:key,method,params}));});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<300;i++){if(await ev(expression))return;await sleep(100);}console.log('Browser errors:',JSON.stringify(errors));throw Error('Timeout: '+expression);};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.clearBrowserCookies');await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage,indexeddb'});await send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:base+'/taller/?view=library'});
 await until(`document.readyState==='complete'&&document.querySelector('#library-import-file')&&import('/application-state.js').then(m=>m.applicationState.workshop?.startupComplete)`);
 if(process.env.IMPORT_QA_ACCOUNT){
  const username='importqa'+Date.now();
  assert.equal(await ev(`fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'${username}',email:'${username}@example.test',password:'ImportQA123!'})}).then(r=>r.status)`),200);created=true;
  const previous=await ev('performance.timeOrigin');await send('Page.reload');await until(`performance.timeOrigin!==${previous}&&document.readyState==='complete'&&import('/application-state.js').then(m=>m.applicationState.workshop?.startupComplete)`);
 }
 await ev(`(async()=>{window.app=(await import('/application-state.js')).applicationState;window.expected=${JSON.stringify(expected)};window.markdown=${JSON.stringify(markdown)};window.storage=(await import('/poem-storage.js')).poemStorage;})()`);
 await ev(`(()=>{const d=document.querySelector('#workshop-editor').contentDocument;d.querySelector('#poemTitle').value='Sin título';d.querySelector('#poemInput').value='Un borrador todavía sin título.';d.querySelector('#poemInput').dispatchEvent(new Event('input',{bubbles:true}));})()`);
 // Returning from the native picker restores window focus. Background sync
 // can also refresh the library while the picker is open. Keep its original
 // input, just as the browser does, rather than finding a replacement node.
 await ev(`(()=>{window.pickerInput=document.querySelector('#library-import-file');window.dispatchEvent(new Event('focus'));window.dispatchEvent(new StorageEvent('storage',{key:'escandador.cloudPoemMap.v1:qa'}));})()`);
 assert.equal(await ev('pickerInput.isConnected'),true,'The file picker input was removed during focus or synchronization.');
 await ev(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File([markdown],'poemario.md',{type:'text/markdown'}));pickerInput.files=transfer.files;pickerInput.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await until(`!!document.querySelector('#poem-import-form')`);
 assert.equal(await ev(`document.querySelectorAll('#poem-import-form [name=include]').length`),expected.length);
 assert.equal(await ev(`Object.keys(JSON.parse(storage.getItem('escandador.poemMemory.v1')||'{}').poems||{}).length`),0);
 await ev(`document.querySelector('#poem-import-form').requestSubmit()`);
 await until(`!!document.querySelector('#poem-import-progress')&&!document.querySelector('#modal').dataset.importing`);
 assert.equal(await ev(`document.querySelector('#poem-import-progress').value===document.querySelector('#poem-import-progress').max`),true);
 await ev(`document.querySelector('#modal [data-action=close]').click()`);
 console.log('Import result:',await ev(`({message:document.querySelector('#toast').textContent,count:document.querySelector('#poem-count').textContent})`));
 const imported=await ev(`(()=>{const poems=Object.values(JSON.parse(storage.getItem('escandador.poemMemory.v1')||'{}').poems||{}).map(v=>v.at(-1));return {count:poems.length,exact:expected.every(p=>poems.some(v=>v.poemTitle===p.title&&v.poemText===p.text))};})()`);
 assert.equal(imported.count,expected.length);assert.equal(imported.exact,true);
 assert.equal(await ev(`document.querySelector('#workshop-editor').contentDocument.querySelector('#poemInput').value`),'Un borrador todavía sin título.');
 assert.equal(await ev(`document.querySelector('#workshop-editor').contentDocument.querySelector('#poemTitle').value`),'Sin título');
 await ev(`document.querySelector('#workshop-editor').contentDocument.querySelector('#poemTitle').value='Mi borrador conservado'`);
 // Watch every visible editor frame: it must already contain the requested poem.
 await ev(`(()=>{const button=document.querySelector('[data-action="edit-poem"]'),memory=JSON.parse(storage.getItem('escandador.poemMemory.v1')),map=JSON.parse(storage.getItem('escandador.cloudPoemMap.v1:'+storage.getItem('escandador.poemMemory.activeOwner.v1'))||'{}');const key=Object.keys(memory.poems).find(k=>(map[k]?.poemId?'poem:'+map[k].poemId:'local:'+k)===button.dataset.id);window.targetText=memory.poems[key].at(-1).poemText;window.framesSeen=[];window.openStart=performance.now();const tick=()=>{const host=document.querySelector('#editor-host');if(!host.hidden){framesSeen.push({text:document.querySelector('#workshop-editor').contentDocument.querySelector('#poemInput').value,ms:performance.now()-openStart});}if(framesSeen.length<12)requestAnimationFrame(tick);};requestAnimationFrame(tick);button.click();})()`);
 await until(`framesSeen.length>=12`);
 const opening=await ev(`({correct:framesSeen.every(f=>f.text===targetText),firstVisibleMs:framesSeen[0].ms,firstCorrectMs:framesSeen.find(f=>f.text===targetText)?.ms,observed:framesSeen.length,openingId:app.workshop.openingEditorId,view:app.workshop.view,actualTitle:document.querySelector('#workshop-editor').contentDocument.querySelector('#poemTitle').value,actualLength:framesSeen[0].text.length,targetLength:targetText.length})`);
 console.log('Opening:',opening);if(!opening.correct)console.log(await ev(`(()=>{const a=framesSeen.at(-1).text,b=targetText;let i=0;while(a[i]===b[i]&&i<b.length)i++;return {differentAt:i,a:a.slice(i,i+8).split('').map(c=>c.charCodeAt(0)),b:b.slice(i,i+8).split('').map(c=>c.charCodeAt(0)),equalAfterTrim:a.trim()===b.trim()};})()`));assert.equal(opening.correct,true);
 if(created){
  await ev(`document.querySelector('#workshop-editor').contentWindow.eval("import('./application-state.js').then(m=>m.applicationState.runtime.syncPoemsNow())")`);
  const uploaded=await ev(`fetch('/api/poems').then(r=>r.json()).then(({poems})=>expected.every(p=>poems.some(saved=>saved.title===p.title&&saved.versions.some(v=>v.content===p.text))))`);
  assert.equal(uploaded,true);console.log('All imported poems also verified on the server.');
 }
 // Reimport into a populated user library: merge, create separately, skip,
 // cancel without changes, and never duplicate an identical latest version.
 await ev(`(()=>{window.chooseImport=md=>{const input=document.querySelector('#library-import-file'),transfer=new DataTransfer();transfer.items.add(new File([md],'seleccion.md',{type:'text/markdown'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));};document.querySelector('[data-view=library]').click();window.reviewMarkdown='# '+expected[0].title+'\\n\\nUna revisión importada diferente.\\n\\n# '+expected[1].title+'\\n\\nUn poema que se guardará por separado.\\n\\n# No importar este poema\\n\\nEste debe quedar afuera.';window.beforeReview=JSON.parse(storage.getItem('escandador.poemMemory.v1'));window.firstReviewKey=Object.keys(beforeReview.poems).find(k=>beforeReview.poems[k][0].poemTitle===expected[0].title);chooseImport(reviewMarkdown);})()`);
 await until(`!!document.querySelector('#poem-import-form')`);
 assert.equal(await ev(`document.querySelector('[name="target:0"]').value`),await ev('firstReviewKey'));
 await ev(`document.querySelector('#modal [data-action=close]').click()`);
 assert.equal(await ev(`storage.getItem('escandador.poemMemory.v1')===JSON.stringify(beforeReview)`),true);
 await ev(`chooseImport(reviewMarkdown)`);await until(`!!document.querySelector('#poem-import-form')`);
 await ev(`(()=>{document.querySelector('[name="target:1"]').value='';const skipped=document.querySelector('[name=include][value="2"]');skipped.checked=false;skipped.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await mkdir('qa/importacion',{recursive:true});
 let shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('qa/importacion/01-revisar.png',Buffer.from(shot.data,'base64'));
 if(created)await send('Network.emulateNetworkConditions',{offline:false,latency:350,downloadThroughput:-1,uploadThroughput:-1});
 await ev(`document.querySelector('#poem-import-form').requestSubmit()`);
 if(created){await until(`!!document.querySelector('#poem-import-progress')&&document.querySelector('[data-import-stage]').textContent==='Guardando en tu cuenta'&&document.querySelector('#modal').dataset.importing==='true'`);shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('qa/importacion/02-progreso.png',Buffer.from(shot.data,'base64'));}
 await until(`!!document.querySelector('#poem-import-progress')&&!document.querySelector('#modal').dataset.importing`);
 if(created)await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 const reviewed=await ev(`(()=>{const m=JSON.parse(storage.getItem('escandador.poemMemory.v1'));return {count:Object.keys(m.poems).length,history:m.poems[firstReviewKey].length,keepsOriginal:m.poems[firstReviewKey][0].poemText===beforeReview.poems[firstReviewKey][0].poemText,separate:Object.values(m.poems).some(v=>v.at(-1).poemText==='Un poema que se guardará por separado.'),skipped:!Object.values(m.poems).some(v=>v[0].poemTitle==='No importar este poema')};})()`);
 assert.equal(reviewed.count,expected.length+1);assert.equal(reviewed.history,2);assert.equal(reviewed.keepsOriginal,true);assert.equal(reviewed.separate,true);assert.equal(reviewed.skipped,true);
 shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('qa/importacion/03-terminado.png',Buffer.from(shot.data,'base64'));
 await ev(`(()=>{document.querySelector('#modal [data-action=close]').click();const input=document.querySelector('#workshop-editor').contentDocument.querySelector('#importPoemsFile'),transfer=new DataTransfer();transfer.items.add(new File(['# '+expected[0].title+'\\n\\nUna revisión importada diferente.'],'desde-escandidor.md',{type:'text/markdown'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await until(`!!document.querySelector('#poem-import-form')`);await ev(`document.querySelector('#poem-import-form').requestSubmit()`);await until(`!!document.querySelector('#poem-import-progress')&&!document.querySelector('#modal').dataset.importing`);
 assert.ok(await ev(`document.querySelector('[data-import-current]').textContent.includes('0 importados · 1 ya estaban iguales')`));
 assert.equal(await ev(`JSON.parse(storage.getItem('escandador.poemMemory.v1')).poems[firstReviewKey].length`),2);
 await ev(`document.querySelector('#modal [data-action=close]').click();chooseImport(reviewMarkdown)`);await until(`!!document.querySelector('#poem-import-form')`);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert.equal(await ev(`document.querySelector('#modal').scrollWidth>document.querySelector('#modal').clientWidth`),false);
 shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('qa/importacion/04-movil.png',Buffer.from(shot.data,'base64'));
 await ev(`document.querySelector('#modal [data-action=close]').click()`);await send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
 if(created){
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await ev(`chooseImport('# Importado sin conexión\\n\\nEste poema se conserva hasta recuperar la red.')`);await until(`!!document.querySelector('#poem-import-form')`);await ev(`document.querySelector('#poem-import-form').requestSubmit()`);await until(`!!document.querySelector('#poem-import-progress')&&!document.querySelector('#modal').dataset.importing`);
  assert.ok(await ev(`document.querySelector('[data-import-result]').textContent.includes('pendientes de sincronizar')`));
  assert.equal(await ev(`document.querySelector('progress').value<document.querySelector('progress').max`),true);
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await ev(`document.querySelector('#workshop-editor').contentWindow.eval("import('./application-state.js').then(m=>m.applicationState.runtime.syncPoemsNow())")`);
  assert.equal(await ev(`fetch('/api/poems').then(r=>r.json()).then(p=>p.poems.filter(p=>p.title==='Importado sin conexión').length)`),1);
  console.log('Offline import stays local with pending status and uploads once after reconnecting.');
 }
 console.log('Verified review, cancellation, merge into existing history, separate poem, deselection, progress and identical-text deduplication.');
 assert.equal(errors.length,0,JSON.stringify(errors));
 shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('qa/importacion/escandidor.png',Buffer.from(shot.data,'base64'));
 await writeFile('qa/importacion/galeria.html',`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Importar poemas</title><style>body{font:16px system-ui;background:#e6e4d9;margin:24px}img{display:block;max-width:100%;margin-bottom:32px}</style><h1>Importación de poemas</h1>${['01-revisar','02-progreso','03-terminado','04-movil'].map(n=>'<h2>'+n+'</h2><img src="'+n+'.png">').join('')}`);
 console.log(`Verified ${expected.length} complete poems and opening without stale frames.`);
}finally{
 if(created&&send){const r=await send('Runtime.evaluate',{expression:`fetch('/api/auth/account',{method:'DELETE'}).then(r=>r.status)`,awaitPromise:true,returnByValue:true});assert.equal(r.result.value,200);console.log('Temporary QA account deleted.');}
 try{await send?.('Browser.close');}catch{}socket?.close();if(browser.exitCode===null)browser.kill();
}
