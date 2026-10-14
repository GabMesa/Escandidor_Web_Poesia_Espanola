import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {WebSocket} from 'ws';
import {parsePoemsFromMarkdown} from '../poem-markdown-import.js';

const file=process.argv[2];
if(!file)throw Error('Usage: node scripts/verify-poem-markdown-import.mjs <collection.md>');
const path=resolve(file),poems=parsePoemsFromMarkdown(await readFile(path,'utf8'));
assert.ok(poems.length);
const base='http://localhost:8794';
const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9247',`--user-data-dir=${process.cwd()}\\.wrangler\\markdown-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket,send,accountCreated=false;const errors=[];
try{
  let targets;for(let i=0;i<50;i++){try{targets=await fetch('http://127.0.0.1:9247/json').then(r=>r.json());break;}catch{await sleep(200);}}
  assert.ok(targets);socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.once('open',r));
  let id=0;const pending=new Map();socket.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
  send=(method,params={})=>new Promise((ok,fail)=>{const key=++id;pending.set(key,m=>m.error?fail(Error(JSON.stringify(m.error))):ok(m.result));socket.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
  const until=async expression=>{for(let i=0;i<300;i++){if(await evaluate(expression))return;await sleep(200);}throw Error('Timed out: '+expression+' '+await evaluate('document.querySelector("#toast")?.textContent'));};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const fill=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await send('Page.enable');await send('Runtime.enable');await send('Network.clearBrowserCookies');await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage'});
  await send('Page.navigate',{url:base+'/taller/'});await until('!!document.querySelector("[data-account=login]")');
  await click('[data-account=login]');await click('[data-account=register]');
  const name='markdownqa'+Date.now();await fill('#workshop-auth-form [name=username]',name);await fill('#workshop-auth-form [name=identifier]',name+'@example.test');await fill('#workshop-auth-form [name=password]','MarkdownQA123!');await click('#workshop-auth-form [type=submit]');
  await until('!!document.querySelector("[data-account=logout]")');accountCreated=true;
  await evaluate(`(async()=>{window.parentApp=(await import('/application-state.js')).applicationState;})()`);await until('parentApp.workshop?.startupComplete');
  await evaluate(`window.d=document.querySelector('#workshop-editor').contentDocument`);
  await evaluate(`(async()=>{window.ea=await d.defaultView.eval("import('./application-state.js').then(m=>m.applicationState)");})()`);
  await evaluate(`(()=>{const title=d.querySelector('#poemTitle');title.value='Poema anterior de QA';title.dispatchEvent(new Event('input',{bubbles:true}));const e=d.querySelector('#poemInput');e.value='Primer verso anterior';e.dispatchEvent(new Event('input',{bubbles:true}));d.querySelector('#savePoem').click();})()`);
  await evaluate('ea.sync.queue');
  const previousKey=await evaluate('ea.editor.loadedVersionTitle');
  await evaluate(`(()=>{const e=d.querySelector('#poemInput');e.value=${JSON.stringify('Primer verso anterior\nUn cambio pendiente')};e.dispatchEvent(new Event('input',{bubbles:true}));d.defaultView.qaImportEvents=[];d.defaultView.addEventListener('escandidor:poem-saved',event=>d.defaultView.qaImportEvents.push(event.detail));})()`);
  await click('[data-view=library]');
  const doc=await send('DOM.getDocument',{depth:1});
  let input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#library-import-file'});
  await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});
  await until(`document.querySelector('#toast').textContent.includes('${poems.length} poemas importados')`);
  const memory=await evaluate(`JSON.parse(localStorage.getItem('escandador.poemMemory.v1'))`);
  assert.equal(Object.keys(memory.poems).length,poems.length+1);
  for(const expected of poems){
    const entries=Object.values(memory.poems).filter(v=>v[0].poemTitle===expected.title);
    assert.equal(entries.length,poems.filter(p=>p.title===expected.title).length,expected.title);
    assert.ok(entries.some(v=>v[0].poemText===expected.text),expected.title+' text');
    assert.equal(entries[0][0].kind,'manual');assert.equal(entries[0][0].settings.poeticForm,'custom');
    assert.deepEqual(entries[0][0].settings.stressPatterns,{});
  }
  assert.equal(memory.poems[previousKey].at(-1).poemText,'Primer verso anterior\nUn cambio pendiente');
  assert.notEqual(await evaluate('ea.editor.loadedVersionTitle'),previousKey);
  assert.equal(await evaluate('d.querySelector("#poemTitle").value'),poems[0].title);
  assert.equal(await evaluate('d.querySelector("#poemInput").value'),poems[0].text);
  const events=await evaluate('d.defaultView.qaImportEvents.map(e=>({title:e.title,text:e.version.poemText}))');
  for(const p of poems)assert.ok(events.some(e=>e.title===p.title&&e.text===p.text),p.title+' save event');
  await evaluate('ea.sync.queue');
  const remote=await evaluate(`fetch('/api/poems').then(r=>r.json()).then(v=>v.poems)`);
  assert.equal(remote.length,poems.length+1);
  for(const p of poems)assert.ok(remote.some(r=>r.title===p.title&&r.content===p.text),p.title+' in local API');
  assert.equal(remote.find(p=>p.title==='Poema anterior de QA').content,'Primer verso anterior\nUn cambio pendiente');
  // Editing the imported first poem must append to its own history.
  await click('[data-view=editor]');
  await evaluate(`(()=>{const control=d.querySelector('#autoCompressVersions');control.checked=false;control.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate(`(()=>{const e=d.querySelector('#poemInput');e.value+=${JSON.stringify('\nVerso de comprobación de QA')};e.dispatchEvent(new Event('input',{bubbles:true}));d.querySelector('#savePoem').click();})()`);
  await evaluate('ea.sync.queue');
  const changed=await evaluate(`fetch('/api/poems').then(r=>r.json()).then(v=>v.poems)`);
  assert.equal(changed.find(p=>p.title==='Poema anterior de QA').content,'Primer verso anterior\nUn cambio pendiente');
  assert.equal(changed.find(p=>p.title===poems[0].title)?.versions.length,2);
  await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage'});await send('Page.reload');
  await until('!!document.querySelector("[data-account=logout]")');
  await evaluate(`(async()=>{window.parentApp=(await import('/application-state.js')).applicationState;})()`);await until('parentApp.workshop?.startupComplete');
  const restored=await evaluate(`JSON.parse(localStorage.getItem('escandador.poemMemory.v1'))`);
  assert.equal(Object.keys(restored.poems).length,poems.length+1);
  for(const p of poems)assert.ok(Object.values(restored.poems).some(v=>v[0].poemTitle===p.title&&v.some(x=>x.poemText===p.text)),p.title+' restored');
  // Storage failures must not be reported as a successful import or replace
  // the active editor content. Use a synthetic poem for this failure case.
  await evaluate(`window.d=document.querySelector('#workshop-editor').contentDocument;d.defaultView.qaStorageSet=d.defaultView.Storage.prototype.setItem;d.defaultView.Storage.prototype.setItem=function(key,value){if(key==='escandador.poemMemory.v1')throw Error('QA simulated storage failure');return d.defaultView.qaStorageSet.call(this,key,value);}`);
  const activeText=await evaluate('d.querySelector("#poemInput").value');
  await click('[data-view=library]');
  await evaluate(`(()=>{const input=document.querySelector('#library-import-file');const files=new DataTransfer();files.items.add(new File([${JSON.stringify('# Poema sintético de QA\n\nUn verso')}], 'prueba.md', {type:'text/markdown'}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until('document.querySelector("#toast").textContent.includes("No se pudieron guardar")');
  assert.equal(await evaluate('Object.keys(JSON.parse(localStorage.getItem("escandador.poemMemory.v1")).poems).length'),poems.length+1);
  assert.equal(await evaluate('d.querySelector("#poemInput").value'),activeText);
  assert.equal(await evaluate('document.querySelector("#library-import-file").value'),'');
  await evaluate('d.defaultView.Storage.prototype.setItem=d.defaultView.qaStorageSet');
  assert.equal(errors.length,0,JSON.stringify(errors));
  await mkdir('qa/importacion-markdown',{recursive:true});
  await writeFile('qa/importacion-markdown/verificacion.json',JSON.stringify({checkedAt:new Date().toISOString(),poems:poems.length,allTitlesAndVerses:true,quotationsAndStanzas:true,manualVersions:true,independentMeter:true,allSaveEvents:true,preservedPreviousDraft:true,editUsesImportedIdentity:true,savedInLocalDatabase:true,recoveredWithoutCache:true,reportsStorageFailure:true,consoleErrors:0},null,2));
  console.log(`Verified ${poems.length} poems through the file import UI, local database sync, independent edits and recovery without cache.`);
}finally{
  if(accountCreated&&send){
    try{const r=await send('Runtime.evaluate',{expression:`fetch('${base}/api/auth/account',{method:'DELETE',credentials:'include'}).then(r=>r.status)`,awaitPromise:true,returnByValue:true});assert.equal(r.result.value,200);console.log('Temporary local QA account deleted.');}catch(error){console.error('QA cleanup failed:',error.message);process.exitCode=1;}
  }
  try{await send?.('Browser.close');}catch{}
  socket?.close();if(browser.exitCode===null)browser.kill();
}
