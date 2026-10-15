import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
const base=process.env.WORKSHOP_QA_ORIGIN||'http://localhost:8794',port=9267;
const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${port}`,`--user-data-dir=${process.cwd()}\\.wrangler\\editor-loading-qa`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket,send,created=false;const paused=[],errors=[];
try{
 let targets;for(let i=0;i<50;i++){try{targets=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());break;}catch{await sleep(100);}}
 socket=new WebSocket(targets.find(t=>t.type==='page'&&!t.url.startsWith('edge://')).webSocketDebuggerUrl);await new Promise(r=>socket.once('open',r));
 let id=0;const pending=new Map();socket.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Fetch.requestPaused')paused.push(m.params);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
 send=(method,params={})=>new Promise((ok,fail)=>{const key=++id;pending.set(key,m=>m.error?fail(Error(JSON.stringify(m.error))):ok(m.result));socket.send(JSON.stringify({id:key,method,params}));});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression:'(()=>eval('+JSON.stringify(expression)+'))()',awaitPromise:true,returnByValue:true,userGesture:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<300;i++){if(await ev(expression))return;await sleep(100);}throw Error('Timeout: '+expression+' '+JSON.stringify(errors));};
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.clearBrowserCookies');await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage,indexeddb'});await send('Emulation.setDeviceMetricsOverride',{width:1360,height:950,deviceScaleFactor:1,mobile:false});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.loadingHistory=[];new MutationObserver(()=>{const loader=document.querySelector('[data-editor-loader]');if(!loader)return;const stage=loader.querySelector('[aria-current=step]')?.dataset.loadingStep,detail=loader.querySelector('[data-loading-detail]')?.textContent;if(stage&&JSON.stringify(loadingHistory.at(-1))!==JSON.stringify({stage,detail}))loadingHistory.push({stage,detail});}).observe(document,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-current']});`});
 await send('Page.navigate',{url:base+'/taller/?view=editor'});await until(`import('/application-state.js').then(m=>m.applicationState.workshop?.startupComplete)`);
 const username='loadingqa'+Date.now();
 assert.equal(await ev(`fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'${username}',email:'${username}@example.test',password:'LoadingQA123!'})}).then(r=>r.status)`),200);created=true;
 assert.equal(await ev(`fetch('/api/poems',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'El poema que vuelve a la mesa',content:'La mañana abre sus hojas.\\nUn verso vuelve a empezar.',settings:{poemFont:'atkinson'},sync:{id:'loading-qa-first',versionNumber:1}})}).then(r=>r.status)`),201);
 await send('Fetch.enable',{patterns:[{urlPattern:'*/api/auth/me',requestStage:'Request'},{urlPattern:'*/api/poems?*',requestStage:'Request'}]});
 await send('Page.reload');await until(`!!document.querySelector('[data-editor-loader] [data-loading-step=session][aria-current=step]')`);
 await mkdir('qa/carga-escandidor',{recursive:true});
 const shot=async name=>{await sleep(320);const r=await send('Page.captureScreenshot',{format:'png'});await writeFile('qa/carga-escandidor/'+name+'.png',Buffer.from(r.data,'base64'));return r.data;};
 const frame=await shot('01-sesion');await sleep(250);assert.ok(await shot('01-animacion')!==frame,'The loader animation did not advance.');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await ev(`getComputedStyle(document.querySelector('.loading-pen')).animationName`),'none');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 // Let both parent and editor session checks finish; the poem download remains paused.
 for(let i=0;i<50;i++){for(const request of paused.filter(p=>p.request.url.includes('/api/auth/me'))) {paused.splice(paused.indexOf(request),1);await send('Fetch.continueRequest',{requestId:request.requestId});}if(paused.some(p=>p.request.url.includes('/api/poems?')))break;await sleep(100);}
 await until(`!!document.querySelector('[data-editor-loader] [data-loading-step=library][aria-current=step]')`);await shot('02-biblioteca');
 for(const request of paused.splice(0))await send('Fetch.continueRequest',{requestId:request.requestId});await send('Fetch.disable');
 await until(`import('/application-state.js').then(m=>m.applicationState.workshop?.startupComplete)`);
 const history=await ev('loadingHistory');assert.deepEqual([...new Set(history.map(p=>p.stage))],['session','library','preferences','poem','analysis']);
 assert.ok(history.some(p=>p.detail.includes('1 poema')&&p.detail.includes('1 versión')));
 assert.equal(await ev(`document.querySelector('#editor-host').hidden`),false);assert.equal(await ev(`document.querySelector('[data-editor-loader]')===null`),true);
 await ev(`document.querySelector('[data-view=library]').click();document.querySelector('[data-action=edit-poem]').click()`);await until(`import('/application-state.js').then(m=>m.applicationState.workshop?.view==='editor'&&!m.applicationState.workshop.openingEditorId)`);
 const opening=await ev('loadingHistory.slice(-8)');assert.ok(opening.some(p=>p.stage==='draft'));assert.ok(opening.some(p=>p.stage==='analysis'));
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify({startupStages:[...new Set(history.map(p=>p.stage))],realDownloadCounts:true,animated:true,reducedMotion:true,openingStages:true}));
}finally{
 if(send){try{await send('Fetch.disable');}catch{}if(created){const result=await send('Runtime.evaluate',{expression:`fetch('/api/auth/account',{method:'DELETE'}).then(r=>r.status)`,awaitPromise:true,returnByValue:true});assert.equal(result.result.value,200);}}
 try{await send?.('Browser.close');}catch{}socket?.close();if(browser.exitCode===null)browser.kill();
}
