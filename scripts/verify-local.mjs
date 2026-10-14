import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
const root=process.cwd(),url='http://localhost:8794/escandidor',out='qa/local';
await mkdir(out,{recursive:true});
const proc=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9240',`--user-data-dir=${root}\\.local-app-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket,send;const errors=[];
try{
  let targets;for(let i=0;i<40;i++){try{targets=await fetch('http://127.0.0.1:9240/json').then(r=>r.json());break;}catch{await sleep(200);}}
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

  await send('Network.clearBrowserCookies');await send('Storage.clearDataForOrigin',{origin:'http://localhost:8794',storageTypes:'local_storage'});
  for(const path of ['/escandidor','/escandidor/','/escandidor.html']){
    const response=await fetch('http://localhost:8794'+path,{redirect:'manual'});
    assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/taller/?view=editor');
  }
  assert.equal((await fetch('http://localhost:8794/escandidor.html?taller=1',{redirect:'manual'})).status,200);
  await send('Page.navigate',{url});await until("!!document.querySelector('[data-account=login]')");
  await evaluate("import('../application-state.js').then(m=>window.qaState=m.applicationState.workshop)");
  await until('qaState.editorReady && qaState.view==="editor"');
  assert.equal(await evaluate('document.querySelector("#editor-host").hidden'),false);
  await shot('00-entrada-escandidor-local');
  await send('Page.navigate',{url:'http://localhost:8794/taller/'});
  await until("!!document.querySelector('[data-account=login]')");
  await evaluate("import('../application-state.js').then(m=>window.qaState=m.applicationState.workshop)");
  assert.equal(await evaluate('qaState.data.contests.length'),0);assert.equal(await evaluate('document.querySelectorAll(".poem-card").length'),0);
  await shot('01-biblioteca-real-vacia');
  const username='localqa'+Date.now(),email=username+'@example.test';
  await click('[data-account=login]');await click('[data-account=register]');await fill('#workshop-auth-form [name=username]',username);await fill('#workshop-auth-form [name=identifier]',email);await fill('#workshop-auth-form [name=password]','LocalQA123!');await click('#workshop-auth-form [type=submit]');
  await until("!!document.querySelector('[data-account=logout]')");
  await evaluate("import('../application-state.js').then(m=>window.qaState=m.applicationState.workshop)");await until('qaState.editorReady');assert.equal(await evaluate('document.querySelector("#workshop-editor").contentDocument.querySelector("#poemInput").value'),'');
  await click('[data-action=new-poem]');await evaluate(`(()=>{const d=document.querySelector('#workshop-editor').contentDocument;const title=d.querySelector('#poemTitle');title.value='Poema local de prueba';title.dispatchEvent(new Event('input',{bubbles:true}));const text=d.querySelector('#poemInput');text.value='> Una cita para probar\\n\\nLa tarde vuelve al patio\\ny el viento aprende a hablar.';text.dispatchEvent(new Event('input',{bubbles:true}));d.querySelector('#savePoem').click();})()`);
  await until(`fetch('/api/state').then(r=>r.json()).then(v=>v.state?.poems.length===1)`);
  await click('[data-view=library]');await until('document.querySelectorAll(".poem-card").length===1');
  await click('[data-action=manage-tags]');await fill('#create-tag-form [name=name]','terminado');await click('#create-tag-form [type=submit]');await click('#modal [data-action=close]');
  const poemId=await evaluate('document.querySelector("[data-action=edit-tags]").dataset.id');assert.match(poemId,/^poem:/);
  await click(`[data-action=edit-tags][data-id="${poemId}"]`);await click('#tags-form [name=tags][value=terminado]');await click('#tags-form [type=submit]');
  await click('[data-lib=appearance]');await click('[data-lib=pick-color]');await fill('.shared-color-picker input[type=color]','#8b4b73');await click('.shared-color-picker [data-picker=accept]');await click('#library-appearance-form [type=submit]');await until('!document.querySelector("#modal").open');
  await shot('02-biblioteca-real-tags');
  await until(`getComputedStyle(document.documentElement).getPropertyValue('--working-poem-color').trim().toLowerCase()==='#8b4b73'`);
  for(const view of ['editor','library','contests','reminders']){
    await click(`[data-view=${view}]`);
    assert.equal(await evaluate('document.documentElement.classList.contains("working-poem")'),true);
    assert.equal(await evaluate('getComputedStyle(document.documentElement).getPropertyValue("--action").trim().toLowerCase()'),'#8b4b73');
  }
  await click('[data-view=contests]');await click('[data-action=import]');await fill('#import-form [name=url]','https://www.escritores.org/recursos-para-escritores/42187-48-concurso-literario-dr-alberto-manini-rios-2026');await click('#import-form [type=submit]');
  await until('!!document.querySelector("#contest-form")');assert.equal(await evaluate('document.querySelector("#contest-form [name=deadline]").value'),'2026-11-27');await click('#contest-form [type=submit]');
  await until('qaState.view==="detail"');const contestId=await evaluate('qaState.contestId');
  await click(`[data-associate="${poemId}"]`);
  await until(`fetch('/api/workshop').then(r=>r.json()).then(v=>v.data?.contests[0]?.selections.length===1)`);
  await click('[data-action=prepare]');await click('[data-action=plica]');await until('!!document.querySelector("#plica-form")');await fill('#plica-form [name=fullName]','Poeta de prueba local');await fill('#plica-form [name=identityDocument]','QA documento');await click('#plica-form button[value=save]');await until('document.querySelector("#plica-status").textContent.includes("Datos guardados")');await click('#modal [data-action=close]');
  await shot('03-exportacion-real');
  const persisted=await evaluate("fetch('/api/workshop').then(r=>r.json())");assert.equal(persisted.data.tagColors.terminado.length,7);assert.equal(persisted.data.preferences.poemColors[poemId],'#8b4b73');
  const conflict=await evaluate(`fetch('/api/workshop',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:0,data:${JSON.stringify(persisted.data)}})}).then(r=>r.status)`);assert.equal(conflict,409);
  // A new browser cache must recover server poems, tags, colors, contests and plica.
  await send('Storage.clearDataForOrigin',{origin:'http://localhost:8794',storageTypes:'local_storage'});await send('Page.reload');await until('document.querySelectorAll(".poem-card").length===1');await evaluate("import('../application-state.js').then(m=>window.qaState=m.applicationState.workshop)");
  assert.equal(await evaluate('qaState.data.contests.length'),1);assert.ok(await evaluate(`qaState.data.localTags[${JSON.stringify(poemId)}].includes('terminado')`));assert.equal(await evaluate(`qaState.data.preferences.poemColors[${JSON.stringify(poemId)}]`),'#8b4b73');assert.equal(await evaluate("fetch('/api/plicas').then(r=>r.json()).then(v=>v.plica.identityDocument)"),'QA documento');
  await click('[data-view=contests]');await click(`[data-action=open-contest][data-id="${contestId}"]`);await click(`[data-action=open-contest-poem][data-id="${poemId}"]`);await until('document.querySelector("#workshop-editor").contentDocument.querySelector("#poemTitle").value==="Poema local de prueba"');
  await evaluate(`(()=>{const d=document.querySelector('#workshop-editor').contentDocument;const text=d.querySelector('#poemInput');text.value+='\\nUn verso nuevo.';text.dispatchEvent(new Event('input',{bubbles:true}));d.querySelector('#savePoem').click();})()`);await until(`fetch('/api/state').then(r=>r.json()).then(v=>v.state.poems[0].versions.some(v=>v.content.includes("Un verso nuevo")))`);
  await click('[data-view=contests]');await click(`[data-action=open-contest][data-id="${contestId}"]`);await click('[data-action=prepare]');assert.match(await evaluate('document.querySelector(".paper-stage").textContent'),/Un verso nuevo/);
  await click('[data-view=contests]');await click(`[data-action=open-contest][data-id="${contestId}"]`);await click('[data-action=toggle-agenda]');await until(`fetch('/api/workshop').then(r=>r.json()).then(v=>v.data.contests[0].agendaEnabled===false)`);
  await shot('04-concurso-real');
  await click('[data-account=logout]');await until('!!document.querySelector("[data-account=login]")');assert.equal(await evaluate('document.querySelectorAll(".poem-card").length'),0);
  await click('[data-account=login]');await click('[data-account=register]');await fill('#workshop-auth-form [name=username]',username+'b');await fill('#workshop-auth-form [name=identifier]',username+'b@example.test');await fill('#workshop-auth-form [name=password]','LocalQA123!');await click('#workshop-auth-form [type=submit]');await until('!!document.querySelector("[data-account=logout]")');await evaluate("import('../application-state.js').then(m=>window.qaState=m.applicationState.workshop)");await until('qaState.editorReady');assert.equal(await evaluate('qaState.data.contests.length'),0);assert.equal(await evaluate('document.querySelectorAll(".poem-card").length'),0);assert.equal(await evaluate("fetch('/api/plicas').then(r=>r.json()).then(v=>v.plica)"),null);
  await click('[data-account=logout]');await until('!!document.querySelector("[data-account=login]")');await click('[data-account=login]');await fill('#workshop-auth-form [name=identifier]',email);await fill('#workshop-auth-form [name=password]','LocalQA123!');await click('#workshop-auth-form [type=submit]');await until('document.querySelectorAll(".poem-card").length===1');

  await click('[data-account=migrate]');
  let migrationTarget;
  for(let attempt=0;attempt<40;attempt++){migrationTarget=(await send('Target.getTargets')).targetInfos.find(t=>t.url.includes('/prototipo/migrate.html'));if(migrationTarget)break;await sleep(100);}
  assert.ok(migrationTarget,'Prototype migration popup');
  const {sessionId}=await send('Target.attachToTarget',{targetId:migrationTarget.targetId,flatten:true});
  const sessionSend=(method,params={})=>new Promise((ok,fail)=>{const key=++id;pending.set(key,m=>m.error?fail(Error(JSON.stringify(m.error))):ok(m.result));socket.send(JSON.stringify({id:key,method,params,sessionId}));});
  const sourceMemory={schemaVersion:2,poems:{'local:migration-qa':[{id:'migration-v2',kind:'manual',label:'Nueva',versionNumber:2,savedAt:'2026-10-13T15:00:00Z',poemTitle:'Poema del prototipo',poemText:'La tarde vuelve.\nY trae un verso nuevo.',settings:{poemFont:'atkinson'}},{id:'migration-v1',kind:'manual',label:'Anterior',versionNumber:1,savedAt:'2026-10-12T15:00:00Z',poemTitle:'Poema del prototipo',poemText:'La tarde vuelve.',settings:{poemFont:'atkinson'}}]},trash:{}};
  const sourceData={poems:[{id:'source-poem',linkedLocalId:'local:local:migration-qa',tags:['importado']}],contests:[{...persisted.data.contests[0],id:'migration-contest',name:'Concurso traido del prototipo',selections:[{poemId:'source-poem',versionId:'latest'}]}],localTags:{},tagCatalog:['importado'],tagColors:{importado:'#3d7164'}};
  const transfer=await sessionSend('Runtime.evaluate',{expression:`(()=>{localStorage.setItem('escandador.poemMemory.v1',${JSON.stringify(JSON.stringify(sourceMemory))});localStorage.setItem('escandador.contestsPrototype.v1',${JSON.stringify(JSON.stringify(sourceData))});document.querySelector('#transfer').click();})()`,returnByValue:true,userGesture:true});assert.equal(transfer.exceptionDetails,undefined);
  await until("fetch('/api/state').then(r=>r.json()).then(v=>v.state.poems.length===2)");
  await until("fetch('/api/workshop').then(r=>r.json()).then(v=>v.data.contests.some(c=>c.id==='migration-contest'))");
  const migrated=await evaluate("fetch('/api/state').then(r=>r.json()).then(v=>v.state.poems.find(p=>p.title==='Poema del prototipo'))");assert.equal(migrated.versions.length,2);assert.match(migrated.versions.at(-1).content,/verso nuevo/);
  await send('Target.closeTarget',{targetId:migrationTarget.targetId});
  await click('[data-view=library]');await until('document.querySelectorAll(".poem-card").length===2');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(300);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('05-taller-real-movil');
  assert.equal(errors.length,0,JSON.stringify(errors));
  await writeFile(out+'/verificacion.json',JSON.stringify({checkedAt:new Date().toISOString(),realAccounts:true,userIsolation:true,realDatabase:true,recoversWithoutBrowserCache:true,realContestImport:true,latestVersion:true,tags:true,colors:true,plica:true,agenda:true,revisionConflict:true,prototypeMigration:true,mobile:true,consoleErrors:0},null,2));console.log('Verified real local accounts, database persistence, isolation, cache recovery, importer, tags, colors, plica, latest versions, agenda and revision conflicts.');
}finally{if(send){try{await send('Browser.close');}catch{}}socket?.close();if(proc.exitCode===null)proc.kill();}
