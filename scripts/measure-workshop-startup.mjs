import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
const base=process.env.WORKSHOP_QA_ORIGIN||'http://localhost:8794';
const out='qa/rendimiento/'+(base.startsWith('https:')?'produccion':'local');
await mkdir(out,{recursive:true});
const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9256',`--user-data-dir=${process.cwd()}\\.wrangler\\performance-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket,send;const checks=[],errors=[];
try{
 let targets;for(let i=0;i<50;i++){try{targets=await fetch('http://127.0.0.1:9256/json').then(r=>r.json());break;}catch{await sleep(200);}}
 assert.ok(targets);socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.once('open',r));
 let id=0;const pending=new Map();socket.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
 send=(method,params={})=>new Promise((ok,fail)=>{const key=++id;pending.set(key,m=>m.error?fail(Error(JSON.stringify(m.error))):ok(m.result));socket.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await sleep(100);}throw Error('Timed out: '+expression);};
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const shot=async name=>{await evaluate('document.querySelector("#toast").style.display="none"');await sleep(150);const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(out+'/'+name+'.png',Buffer.from(r.data,'base64'));};
 const dimensions=async(width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width<761?844:950,deviceScaleFactor:1,mobile:width<761});await sleep(80);const value=await evaluate(`({width:innerWidth,height:document.querySelector('.topbar').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth})`);assert.equal(value.overflow,false,JSON.stringify(value));assert.ok(value.height<=(width>980?56:108),JSON.stringify(value));checks.push(value);};
 const ready=async()=>{await until('document.readyState==="complete" && !!document.querySelector("#workshop-save-status")');await evaluate(`(async()=>{window.app=(await import('/application-state.js')).applicationState;})()`);await until('app.workshop?.startupComplete');};
 const reload=async()=>{const previous=await evaluate('performance.timeOrigin');await send('Page.reload');await until(`performance.timeOrigin!==${previous} && document.readyState==='complete'`);await ready();};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.clearBrowserCookies');await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'local_storage'});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});

 await send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:750000,uploadThroughput:250000});
 await send('Emulation.setCPUThrottlingRate',{rate:4});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.longTasks=[];new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});`});
 const start=Date.now();await send('Page.navigate',{url:base+'/taller/?view=editor'});
 await until('!!document.querySelector("#workshop-save-status")');
 await evaluate(`(async()=>{window.app=(await import('/application-state.js')).applicationState;})()`);
 await until('app.workshop?.startupComplete');const readyMs=Date.now()-start;
 await sleep(3000);
 const result=await evaluate(`(()=>{const frames=[window,document.querySelector('#workshop-editor').contentWindow];return {navigation:performance.getEntriesByType('navigation')[0].toJSON(),frames:frames.map(w=>({url:w.location.pathname,ready:w.document.readyState,longTasks:w.longTasks,resources:w.performance.getEntriesByType('resource').map(e=>({url:e.name,duration:e.duration,bytes:e.transferSize,size:e.decodedBodySize}))}))};})()`);

 // Theme flips must update the Workshop and editor synchronously, without color transitions.
 for(let i=0;i<6;i++){
   const state=await evaluate(`(()=>{document.querySelector('[data-theme-toggle]').click();const f=document.querySelector('#workshop-editor').contentWindow;return {parent:document.documentElement.dataset.theme,editor:f.document.documentElement.dataset.theme,transitions:[...document.getAnimations(),...f.document.getAnimations()].filter(a=>a.constructor.name==='CSSTransition').length};})()`);
   assert.equal(state.parent,state.editor);assert.equal(state.transitions,0,JSON.stringify(state));
 }
 const fontSheet=await evaluate('document.querySelector("#workshop-editor").contentDocument.querySelector("#editorFontSheet").href');
 if(process.env.WORKSHOP_QA_LABEL!=='antes'){
   assert.equal((fontSheet.match(/family=/g)||[]).length,1);
   assert.equal(result.frames[1].resources.some(r=>/sinonimos.json|wordfreq-worker|wordfreq\/data/.test(r.url)),false);
 }
 await evaluate(`(()=>{const d=document.querySelector('#workshop-editor').contentDocument,e=d.querySelector('.poem-font-selector:not(#defaultPoemFont)');e.value='lora';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 assert.equal(await evaluate(`!!document.querySelector('#workshop-editor').contentDocument.querySelector('link[href*="family=Lora"]')`),true);
 result.readyMs=readyMs;result.checkedAt=new Date().toISOString();
 await writeFile(out+'/'+(process.env.WORKSHOP_QA_LABEL||'measure')+'.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({readyMs,dcl:Math.round(result.navigation.domContentLoadedEventEnd),resources:result.frames.map(f=>({page:f.url,requests:f.resources.length,bytes:f.resources.reduce((n,r)=>n+r.bytes,0),external:f.resources.filter(r=>!r.url.startsWith(base)).map(r=>r.url),longTasks:f.longTasks?.length,longTaskMs:Math.round(f.longTasks?.reduce((n,t)=>n+t.duration,0)||0)}))},null,2));
}finally{try{await send?.('Browser.close');}catch{}socket?.close();if(browser.exitCode===null)browser.kill();}
