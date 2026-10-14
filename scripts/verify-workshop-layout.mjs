import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
const base=process.env.WORKSHOP_QA_ORIGIN||'http://localhost:8794';
const root=process.cwd(),url=base+'/taller/',out=base.startsWith('https:')?'qa/taller-compacto/produccion':'qa/taller-compacto/local';
let createdAccount=false;
await mkdir(out,{recursive:true});
const proc=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9245',`--user-data-dir=${root}\\.wrangler\\compact-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket,send;const errors=[];
try{
  let targets;for(let i=0;i<40;i++){try{targets=await fetch('http://127.0.0.1:9245/json').then(r=>r.json());break;}catch{await sleep(200);}}
  assert.ok(targets,'Edge did not start');socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.once('open',r));
  let id=0;const pending=new Map();socket.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
  send=(method,params={})=>new Promise((ok,fail)=>{const key=++id;pending.set(key,m=>m.error?fail(Error(JSON.stringify(m.error))):ok(m.result));socket.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(200);}throw Error('Timed out: '+expression+' '+JSON.stringify(await evaluate(`({view:window.qaState?.view,ready:window.qaState?.editorReady,pending:window.qaState?.pendingOpen,title:document.querySelector('#workshop-editor')?.contentDocument?.querySelector('#poemTitle')?.value,toast:document.querySelector('#toast')?.textContent,poems:window.qaState?.data?.poems.map(p=>({id:p.id,title:p.title,linked:p.linkedLocalId}))})`)));};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const fill=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const change=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const shot=async name=>{await evaluate('document.querySelector("#toast").style.display="none"');await sleep(180);const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${out}/${name}.png`,Buffer.from(screenshot.data,'base64'));};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});

  await send('Network.clearBrowserCookies');
  await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage'});
  await send('Page.navigate',{url});await until('!!document.querySelector("[data-account=login]")');
  await click('[data-account=login]');
  if(base.startsWith('https:')){
    assert.equal(await evaluate('!!document.querySelector(".discord-login .discord-logo")'),true);
    await until('document.querySelector(".discord-logo").complete');
    await shot('01-discord-con-logo');
  }
  await click('[data-account=register]');
  const name='compactqa'+Date.now();
  await fill('#workshop-auth-form [name=username]',name);
  await fill('#workshop-auth-form [name=identifier]',name+'@example.test');
  await fill('#workshop-auth-form [name=password]','CompactQA123!');
  await click('#workshop-auth-form [type=submit]');
  await until('!!document.querySelector("[data-account=logout]")');createdAccount=true;
  await evaluate(`(async()=>{window.qaApp=(await import('../application-state.js')).applicationState;})()`);
  await until('qaApp.workshop?.startupComplete');
  await evaluate(`window.qaState=qaApp.workshop;window.d=document.querySelector('#workshop-editor').contentDocument`);
  const settings={poemFont:'atkinson',poeticForm:'custom',rioplatenseY:true,rhymeMode:'asonante'};
  await evaluate(`fetch('/api/poems',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Primer borrador',content:'La primera idea vuelve al mar.',settings:${JSON.stringify(settings)}})}).then(r=>{if(!r.ok)throw Error('No se pudo crear el poema de QA');})`);
  await sleep(1100);
  const poem='Con diez cañones por banda,\nviento en popa, a toda vela,\nno corta el mar, sino vuela\nun velero bergantín;\nbajel pirata que llaman,\npor su bravura el Temido,\nen todo el mar conocido\ndel uno al otro confín.';
  await evaluate(`fetch('/api/poems',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Canción del pirata',content:${JSON.stringify(poem.replaceAll('\\n','\n'))},settings:${JSON.stringify(settings)}})}).then(r=>{if(!r.ok)throw Error('No se pudo crear el último poema de QA');})`);
  await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage'});
  await send('Page.reload');await until('!!document.querySelector("[data-account=logout]")');
  await evaluate(`(async()=>{window.qaApp=(await import('../application-state.js')).applicationState;})()`);
  await until('qaApp.workshop?.startupComplete');
  await evaluate(`window.qaState=qaApp.workshop;window.d=document.querySelector('#workshop-editor').contentDocument`);
  assert.equal(await evaluate('qaState.view'),'editor');
  assert.equal(await evaluate('d.querySelector("#poemTitle").value'),'Canción del pirata');
  assert.match(await evaluate('d.querySelector("#poemInput").value'),/Con diez cañones/);
  assert.equal(await evaluate('document.querySelector(".brand").getAttribute("href")'),'/');
  assert.ok(await evaluate('document.querySelector(".topbar").getBoundingClientRect().height')<80);
  assert.ok(await evaluate('parseFloat(getComputedStyle(document.querySelector(".workspace")).paddingLeft)')<=14);
  await shot('02-editor-compacto-ultimo-poema');
  const original=await evaluate('d.querySelector("#poemInput").value');
  await evaluate(`(()=>{const e=d.querySelector('#poemInput');e.value=Array(8).fill(e.value).join(${JSON.stringify('\n\n')});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const before=await evaluate('d.querySelector("#poemInput").getBoundingClientRect().height');
  await evaluate('d.querySelector("#analysisModeToggle").click()');await sleep(250);
  assert.ok(Math.abs(before-await evaluate('d.querySelector("#poemInput").getBoundingClientRect().height'))<=1,'Textarea must not shrink in text analysis');
  await shot('03-analisis-texto-sin-comprimir');
  await evaluate('d.querySelector("#analysisModeToggle").click()');
  assert.ok(Math.abs(before-await evaluate('d.querySelector("#poemInput").getBoundingClientRect().height'))<=1);
  await evaluate(`(()=>{const e=d.querySelector('#poemInput');e.value=${JSON.stringify(original)};e.dispatchEvent(new Event('input',{bubbles:true}));d.querySelector('#lookupShell').open=true;const word=d.querySelector('#selectedLookupWord');word.value='mar';word.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until('!!d.querySelector(".lookup-rhyme-list")');
  await sleep(1600);
  assert.ok(await evaluate('d.querySelector(".lookup-rhyme-list").getBoundingClientRect().height')<=114);
  assert.ok(await evaluate('d.querySelector("#lookupResults").getBoundingClientRect().height')<=280);
  await shot('04-definiciones-rimas-compactas');
  await evaluate(`d.querySelector('#lookupShell').open=false`);
  await click('[data-view=library]');await shot('05-biblioteca-con-mas-ancho');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await click('[data-view=editor]');await sleep(300);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await shot('06-editor-movil');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
  await click('[data-view=editor]');
  await evaluate(`(()=>{const s=d.querySelector('#savedPoemName');s.value=Array.from(s.options).find(o=>o.textContent==='Primer borrador').value;s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert.equal(await evaluate('d.querySelector("#poemTitle").value'),'Primer borrador');
  await evaluate(`d.defaultView.parent.postMessage({type:'workshop:ready'},location.origin)`);await sleep(300);
  assert.equal(await evaluate('d.querySelector("#poemTitle").value'),'Primer borrador','Repeated readiness must not replace the poem being worked on');
  await click('.brand');await until('!!document.querySelector("#intro-title")');
  assert.equal(await evaluate('location.pathname'),'/');
  assert.equal(errors.length,0,JSON.stringify(errors));
  await writeFile(`${out}/verificacion.json`,JSON.stringify({checkedAt:new Date().toISOString(),latestPoemAfterLogin:true,recoveredWithoutCache:true,brandReturnsToLanding:true,compactHeaders:true,narrowMargins:true,stableEditorInBothAnalysisModes:true,compactLookup:true,mobile:true,doesNotReopenDuringWork:true,discordButton:base.startsWith('https:'),consoleErrors:0},null,2));
  console.log('Verified compact workshop, last saved poem after login without cache, stable editor height, lookup, brand navigation and mobile.');
}finally{
  if(send){
    if(createdAccount){try{const r=await send('Runtime.evaluate',{expression:`fetch('${base}/api/auth/account',{method:'DELETE',credentials:'include'}).then(r=>r.status)`,awaitPromise:true,returnByValue:true});assert.equal(r.result.value,200);}catch(error){console.error('QA account cleanup failed:',error.message);}}
    try{await send('Browser.close');}catch{}
  }
  socket?.close();if(proc.exitCode===null)proc.kill();
}
