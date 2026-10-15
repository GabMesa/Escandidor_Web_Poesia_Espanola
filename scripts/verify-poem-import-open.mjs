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
 const until=async expression=>{for(let i=0;i<300;i++){if(await ev(expression))return;await sleep(100);}throw Error('Timeout: '+expression);};
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
 // The real file input drives the same change handler as a chosen Markdown file.
 await ev(`(()=>{const input=document.querySelector('#library-import-file'),transfer=new DataTransfer();transfer.items.add(new File([markdown],'poemario.md',{type:'text/markdown'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await until(`document.querySelector('#toast').textContent.includes('importad')||document.querySelector('#toast').textContent.includes('No se')||document.querySelector('#toast').textContent.includes('Antes de importar')`);
 console.log('Import result:',await ev(`({message:document.querySelector('#toast').textContent,count:document.querySelector('#poem-count').textContent})`));
 const imported=await ev(`(()=>{const poems=Object.values(JSON.parse(storage.getItem('escandador.poemMemory.v1')||'{}').poems||{}).map(v=>v.at(-1));return {count:poems.length,exact:expected.every(p=>poems.some(v=>v.poemTitle===p.title&&v.poemText===p.text))};})()`);
 assert.equal(imported.count,expected.length);assert.equal(imported.exact,true);
 assert.equal(await ev(`document.querySelector('#workshop-editor').contentDocument.querySelector('#poemInput').value`),'Un borrador todavía sin título.');
 assert.equal(await ev(`document.querySelector('#workshop-editor').contentDocument.querySelector('#poemTitle').value`),'Sin título');
 await ev(`document.querySelector('#workshop-editor').contentDocument.querySelector('#poemTitle').value='Mi borrador conservado'`);
 // Watch every visible editor frame: it must already contain the requested poem.
 await ev(`(()=>{const button=document.querySelector('[data-action="edit-poem"]'),title=button.closest('.library-row').querySelector('.library-row-title').textContent.trim();window.targetText=expected.find(p=>p.title===title).text;window.framesSeen=[];window.openStart=performance.now();const tick=()=>{const host=document.querySelector('#editor-host');if(!host.hidden){framesSeen.push({text:document.querySelector('#workshop-editor').contentDocument.querySelector('#poemInput').value,ms:performance.now()-openStart});}if(framesSeen.length<12)requestAnimationFrame(tick);};requestAnimationFrame(tick);button.click();})()`);
 await until(`framesSeen.length>=12`);
 const opening=await ev(`({correct:framesSeen.every(f=>f.text===targetText),firstVisibleMs:framesSeen[0].ms,firstCorrectMs:framesSeen.find(f=>f.text===targetText)?.ms,observed:framesSeen.length,openingId:app.workshop.openingEditorId,view:app.workshop.view})`);
 console.log('Opening:',opening);assert.equal(opening.correct,true);
 if(created){
  await ev(`document.querySelector('#workshop-editor').contentWindow.eval("import('./application-state.js').then(m=>m.applicationState.runtime.syncPoemsNow())")`);
  const uploaded=await ev(`fetch('/api/poems').then(r=>r.json()).then(({poems})=>expected.every(p=>poems.some(saved=>saved.title===p.title&&saved.versions.some(v=>v.content===p.text))))`);
  assert.equal(uploaded,true);console.log('All imported poems also verified on the server.');
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
 await mkdir('qa/importacion',{recursive:true});const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('qa/importacion/escandidor.png',Buffer.from(shot.data,'base64'));
 console.log(`Verified ${expected.length} complete poems and opening without stale frames.`);
}finally{
 if(created&&send){const r=await send('Runtime.evaluate',{expression:`fetch('/api/auth/account',{method:'DELETE'}).then(r=>r.status)`,awaitPromise:true,returnByValue:true});assert.equal(r.result.value,200);console.log('Temporary QA account deleted.');}
 try{await send?.('Browser.close');}catch{}socket?.close();if(browser.exitCode===null)browser.kill();
}
