import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
import {attributionGroups} from '../attribution-resources.js';
const base=process.env.WORKSHOP_QA_ORIGIN||'http://localhost:8794';
const out=base.startsWith('https:')?'qa/taller-creditos/produccion':'qa/taller-creditos/local';
await mkdir(out,{recursive:true});
const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9246',`--user-data-dir=${process.cwd()}\\.wrangler\\credits-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket,send;const errors=[];
try{
  let targets;for(let i=0;i<50;i++){try{targets=await fetch('http://127.0.0.1:9246/json').then(r=>r.json());break;}catch{await sleep(200);}}
  assert.ok(targets,'Browser startup');
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.once('open',r));
  let id=0;const pending=new Map();socket.on('message',raw=>{const message=JSON.parse(raw);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);if(pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}});
  send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,m=>m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result));socket.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
  const until=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(200);}throw Error('Timed out: '+expression);};
  const shot=async name=>{await sleep(250);const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${out}/${name}.png`,Buffer.from(r.data,'base64'));};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
  await send('Network.clearBrowserCookies');await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage'});
  await send('Page.navigate',{url:base+'/taller/'});await until('!!document.querySelector("[data-account=login]")');
  const poem='Con diez cañones por banda,\nviento en popa, a toda vela,';
  const versions=[{id:'credits-qa',versionNumber:1,kind:'manual',label:'Primera versión',poemTitle:'Canción del pirata',poemText:poem,savedAt:'2026-10-14T14:00:00Z'}];
  await evaluate(`localStorage.setItem('escandador.poemMemory.v1',JSON.stringify({schemaVersion:2,poems:{'Canción del pirata':${JSON.stringify(versions)}},trash:{}}))`);
  const previousLoad=await evaluate('performance.timeOrigin');await send('Page.reload');await until(`performance.timeOrigin!==${previousLoad} && !!document.querySelector('[data-view=editor]') && !!document.querySelector('#workshop-footer a')`);
  await click('[data-view=editor]');await until('!!document.querySelector("#workshop-editor").contentDocument?.querySelector("#poemInput")');
  await evaluate(`window.d=document.querySelector('#workshop-editor').contentDocument`);
  await evaluate(`(async()=>{window.parentApp=(await import('/application-state.js')).applicationState;})()`);
  await until('parentApp.workshop?.startupComplete');
  await until(`d.querySelector('#savedPoemName')?.options.length>0`);
  await evaluate(`(()=>{const s=d.querySelector('#savedPoemName');s.value='Canción del pirata';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until(`d.querySelector('#poemInput').value.includes('Con diez cañones')`);
  assert.equal(await evaluate('document.querySelectorAll(".sidebar-resources a").length'),5);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await shot('01-taller-cabecera');
  await evaluate(`(()=>{const e=d.querySelector('#poemInput');e.value='Me aúlla en';e.dispatchEvent(new Event('input',{bubbles:true}));const t=d.querySelector('#poemTitle');t.value='Prueba de sinalefas';t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(250);
  // Obtain the editor state in its own realm, rather than depending on globals.
  await evaluate(`(async()=>{window.ea=await d.defaultView.eval("import('./application-state.js').then(m=>m.applicationState)");})()`);
  await until(`d.querySelectorAll('.sinalefa-toggle').length===2`);
  const boundaries=await evaluate(`Array.from(d.querySelectorAll('.sinalefa-toggle')).map(b=>({index:Number(b.dataset.boundary),active:b.classList.contains('is-active')}))`);
  for(const b of boundaries){if(!b.active)await evaluate(`d.querySelector('.sinalefa-toggle[data-boundary="${b.index}"]').click()`);}
  assert.deepEqual(await evaluate(`Array.from(d.querySelectorAll('.sinalefa-toggle')).map(b=>b.classList.contains('is-active'))`),[true,true]);
  assert.match(await evaluate(`d.querySelector('#analysisOutput').textContent`),/ú/);
  assert.equal(await evaluate(`!!d.querySelector('.sinalefa-toggle[title^="Triptongo:"]')`),false);
  await evaluate(`d.querySelector('#savePoem').click()`);await until('document.querySelector("#toast").style.display==="block"');
  assert.match(await evaluate('document.querySelector("#toast").textContent'),/guardado|Sin cambios para guardar/);
  const popup=await evaluate(`(()=>{const r=document.querySelector('#toast').getBoundingClientRect();return {right:document.documentElement.clientWidth-r.right,bottom:innerHeight-r.bottom,position:getComputedStyle(document.querySelector('#toast')).position};})()`);
  assert.equal(popup.position,'fixed');assert.ok(popup.right<=17&&popup.bottom<=17,JSON.stringify(popup));
  await shot('02-sinalefas-y-aviso-guardado');
  await evaluate(`d.querySelector('.info-click').click()`);await until('document.querySelector("#toast").textContent!=="Poema guardado."');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#toast")).position'),'fixed');
  await shot('03-ayuda-esquina-inferior');
  // Break and restore each join through the controls; never label a triphthong.
  for(const index of [0,1]){
    await evaluate(`d.querySelector('.sinalefa-toggle[data-boundary="${index}"]').click()`);
    assert.equal(await evaluate(`d.querySelector('.sinalefa-toggle[data-boundary="${index}"]').classList.contains('is-active')`),false);
    await evaluate(`d.querySelector('.sinalefa-toggle[data-boundary="${index}"]').click()`);
    assert.equal(await evaluate(`!!d.querySelector('.sinalefa-toggle[title^="Triptongo:"]')`),false);
  }
  await evaluate(`(()=>{d.querySelector('#lookupShell').open=true;const e=d.querySelector('#selectedLookupWord');e.value='mar';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until(`!!d.querySelector('.lookup-synonym-groups') && !!d.querySelector('.lookup-rhyme-list')`);
  await sleep(1200);
  await until('!ea.editor.lookupLoadingRhymes && !ea.editor.lookupLoadingDefinition');
  const lookup=await evaluate(`({height:d.querySelector('#lookupResults').getBoundingClientRect().height,synonyms:d.querySelector('.lookup-synonym-groups').getBoundingClientRect().height,rhymes:d.querySelector('.lookup-rhyme-list').getBoundingClientRect().height,columns:getComputedStyle(d.querySelector('#lookupResults')).flexDirection})`);
  assert.equal(lookup.columns,'column');assert.equal(lookup.synonyms,252);assert.equal(lookup.rhymes,184);
  assert.equal(await evaluate(`d.defaultView.getComputedStyle(d.querySelector('#lookupResults')).overflowY`),'visible');
  assert.ok(await evaluate(`d.querySelector('#lookupResults').scrollHeight<=d.querySelector('#lookupResults').clientHeight+1`));
  assert.ok(await evaluate(`!!d.querySelector('.lookup-rhymes-column a[href^="https://iedra.es/rimas/"]')`));
  await evaluate(`document.querySelector('#toast').style.display='none';window.scrollTo(0,document.querySelector('#workshop-editor').getBoundingClientRect().top+scrollY+d.querySelector('#lookupShell').getBoundingClientRect().top-20)`);
  await shot('04-consultas-columna-fija');
  await evaluate(`(()=>{const e=d.querySelector('#selectedLookupWord');e.value='luz';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(1200);
  await until('!ea.editor.lookupLoadingRhymes && !ea.editor.lookupLoadingDefinition');
  assert.equal(await evaluate(`d.querySelector('#lookupResults').getBoundingClientRect().height`),lookup.height);
  await evaluate(`d.querySelector('.lookup-definition-section>summary').click()`);
  assert.equal(await evaluate(`d.querySelector('.lookup-definition-section').open`),false);
  assert.equal(await evaluate(`d.querySelector('.lookup-synonyms-section').open`),true);
  await evaluate(`d.querySelector('.lookup-synonyms-section>summary').click()`);
  assert.equal(await evaluate(`d.querySelector('.lookup-synonyms-section').open`),false);
  assert.ok(await evaluate(`d.querySelector('#lookupResults').getBoundingClientRect().height`)<lookup.height-300);
  await evaluate(`(()=>{const e=d.querySelector('#selectedLookupWord');e.value='casa';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(1200);await until('!ea.editor.lookupLoadingRhymes && !ea.editor.lookupLoadingDefinition');
  assert.equal(await evaluate(`d.querySelector('.lookup-definition-section').open`),false);
  assert.equal(await evaluate(`d.querySelector('.lookup-synonyms-section').open`),false);
  assert.equal(await evaluate(`d.querySelector('.lookup-rhyme-list').getBoundingClientRect().height`),184);
  await shot('12-definicion-sinonimos-plegados');
  for(const view of ['editor','library','contests','reminders']){
    await click(`[data-view=${view}]`);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#workshop-footer")).display!=="none"'),true);
  }
  await click('[data-view=library]');
  assert.equal(await evaluate('!!document.querySelector(".library-inspector-head [data-lib=delete-one]")'),true);
  await click('.library-inspector-head [data-lib=delete-one]');
  assert.equal(await evaluate('document.querySelector("#modal").open'),true);
  assert.ok(await evaluate('document.querySelector("#modal").textContent.includes("copia recuperable")'));
  await click('#modal [data-action=close]');
  await evaluate('window.scrollTo(0,0)');await shot('05-biblioteca-borrar-poema');
  await evaluate(`document.querySelector('#workshop-footer').scrollIntoView({block:'end'})`);await shot('06-pie-materiales');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate('window.scrollTo(0,0)');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('07-movil-cabecera');
  await evaluate(`document.querySelector('#workshop-footer').scrollIntoView({block:'start'})`);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('08-movil-creditos');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:base+'/agradecimientos.html'});await until('document.querySelectorAll(".credits-resource").length>0 && document.querySelectorAll("#credits-font-list>div").length===20');
  await shot('09-atribuciones');
  await evaluate(`document.querySelector('#fuentes').scrollIntoView()`);await shot('10-fuentes-comunidad');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('window.scrollTo(0,0)');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('11-atribuciones-movil');
  const localLinks=attributionGroups.flatMap(g=>g.items.flatMap(row=>row.slice(4))).filter(href=>href.startsWith('/'));
  const fonts=await fetch(base+'/licenses/fonts/catalog.json').then(r=>r.json());
  for(const href of [...new Set([...localLinks,...fonts.map(f=>'/'+f.path),'/FLEXOKI-LICENSE.txt'])]){
    const response=await fetch(base+href.split('#')[0]);assert.equal(response.status,200,href);assert.ok(!(await response.text()).trimStart().startsWith('<!doctype'),href+' must contain a license, not fallback HTML');
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
  await writeFile(`${out}/verificacion.json`,JSON.stringify({checkedAt:new Date().toISOString(),allWorkshopViews:true,headerLinks:true,footerCredits:true,licensesPublished:true,fontFamilies:20,deleteBesideRename:true,viewportToasts:true,independentSinalefas:true,neverTriphthong:true,fixedLookup:lookup,mobile:true,consoleErrors:0},null,2));
  const images=['01-taller-cabecera','02-sinalefas-y-aviso-guardado','03-ayuda-esquina-inferior','04-consultas-columna-fija','05-biblioteca-borrar-poema','06-pie-materiales','07-movil-cabecera','08-movil-creditos','09-atribuciones','10-fuentes-comunidad','11-atribuciones-movil'];
  await writeFile(`${out}/galeria.html`,`<!doctype html><meta charset="utf-8"><title>Taller y atribuciones</title><style>body{font:16px system-ui;background:#e6e4d9;margin:24px;color:#100f0f}img{display:block;max-width:100%;margin:12px 0 36px;border:1px solid #ccc}a{color:inherit}</style><h1>Taller y atribuciones</h1>${images.map(name=>`<h2>${name.slice(3).replaceAll('-',' ')}</h2><a href="${name}.png"><img src="${name}.png" loading="lazy"></a>`).join('')}`);
  console.log('Verified credits, all licenses, mobile, fixed lookup, viewport toasts, delete action and Me aúlla en UI. Screenshots: '+out);
}finally{
  try{await send?.('Browser.close');}catch{}
  socket?.close();if(browser.exitCode===null)browser.kill();
}
