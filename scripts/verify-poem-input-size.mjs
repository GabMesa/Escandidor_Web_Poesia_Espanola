import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
const base=process.env.WORKSHOP_QA_ORIGIN||'http://localhost:8794';
const out='qa/poema-largo/'+(base.startsWith('https:')?'produccion':'local');
await mkdir(out,{recursive:true});
const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9253',`--user-data-dir=${process.cwd()}\\.wrangler\\poem-size-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket,send;const checks=[],errors=[];
try{
 let targets;for(let i=0;i<50;i++){try{targets=await fetch('http://127.0.0.1:9253/json').then(r=>r.json());break;}catch{await sleep(200);}}
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
 await send('Page.navigate',{url:base+'/taller/?view=editor'});await ready();

 const rawPoem=process.env.WORKSHOP_QA_POEM ? await readFile(process.env.WORKSHOP_QA_POEM,'utf8') : Array.from({length:5},()=>Array(8).fill('El viento entre las ramas acompaña mi camino.').join('\n')).join('\n\n');
 const poem=rawPoem.replaceAll('\r\n','\n');
 const fill=async text=>{await evaluate(`(()=>{const e=document.querySelector('#workshop-editor').contentDocument.querySelector('#poemInput');e.value=${JSON.stringify(text)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);};
 const inspect=async label=>{
   await sleep(700);
   const result=await evaluate(`(()=>{const frame=document.querySelector('#workshop-editor'),d=frame.contentDocument,e=d.querySelector('#poemInput'),r=e.getBoundingClientRect(),shell=d.querySelector('.app-shell').getBoundingClientRect();return {font:d.defaultView.getComputedStyle(e).font,lineHeight:d.defaultView.getComputedStyle(e).lineHeight,height:r.height,client:e.clientHeight,scroll:e.scrollHeight,overflow:d.defaultView.getComputedStyle(e).overflowY,frame:frame.clientHeight,shell:shell.height,horizontal:document.documentElement.scrollWidth>innerWidth,iframeHorizontal:d.documentElement.scrollWidth>d.documentElement.clientWidth};})()`);
   assert.ok(result.scroll<=result.client+1,JSON.stringify(result));assert.ok(result.frame>=result.shell-1,JSON.stringify(result));assert.equal(result.horizontal,false);assert.equal(result.iframeHorizontal,false);assert.equal(result.overflow,'hidden');checks.push({label,...result});return result.height;
 };
 const editorClick=selector=>evaluate(`document.querySelector('#workshop-editor').contentDocument.querySelector(${JSON.stringify(selector)}).click()`);
 const editorChange=(selector,value)=>evaluate(`(()=>{const e=document.querySelector('#workshop-editor').contentDocument.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const bottom=async name=>{await evaluate(`(()=>{const f=document.querySelector('#workshop-editor'),e=f.contentDocument.querySelector('#poemInput');window.scrollTo(0,f.getBoundingClientRect().top+scrollY+e.getBoundingClientRect().bottom-innerHeight+80);})()`);await shot(name);};
 await fill(poem);const desktopHeight=await inspect('desktop full poem');assert.ok(desktopHeight>700);await shot('01-escritorio-inicio');await bottom('02-escritorio-final');
 await editorClick('#analysisModeToggle');const textHeight=await inspect('text analysis');assert.equal(textHeight,desktopHeight);await editorClick('#analysisModeToggle');
 await editorChange('#panelViewMode','writing');await inspect('writing only');await editorChange('#panelViewMode','analysis');await editorChange('#panelViewMode','both');await inspect('both after hidden');
 await evaluate(`(()=>{const d=document.querySelector('#workshop-editor').contentDocument;d.querySelector('#poemTitle').value='Prueba de poema largo';d.querySelector('#savePoem').click();})()`);
 await reload();assert.equal(await evaluate('document.querySelector("#workshop-editor").contentDocument.querySelector("#poemInput").value'),poem);await inspect('saved poem reopened');
 await dimensions(390);const mobileHeight=await inspect('mobile wrapping');await evaluate('scrollTo(0,0)');await shot('03-movil-inicio');await bottom('04-movil-final');
 await editorClick('#fontSizeUp');await editorClick('#fontSizeUp');await editorClick('#fontSizeUp');const bigger=await inspect('larger font');assert.ok(bigger>=mobileHeight);
 await editorChange('.poem-font-selector:not(#defaultPoemFont)','lora');await evaluate('document.querySelector("#workshop-editor").contentDocument.fonts.ready');await inspect('different font');
 await dimensions(320);await inspect('narrow mobile');
 await dimensions(1440);await fill('Un verso breve.');const shortHeight=await inspect('shrinks after removing text');assert.ok(shortHeight<desktopHeight);
 await fill(poem+'\nUn verso nuevo al final.');await inspect('grows after adding verse');
 await click('[data-theme-toggle]');await inspect('dark mode');await bottom('05-escritorio-oscuro-final');
 assert.equal(errors.length,0,JSON.stringify(errors));
 await writeFile(out+'/verificacion.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,consoleErrors:0},null,2));
 await writeFile(out+'/galeria.html',`<!doctype html><meta charset="utf-8"><title>Poema completo</title><style>body{font:16px system-ui;background:#e6e4d9;margin:20px}img{display:block;max-width:100%;margin:16px 0 30px}</style><h1>Poema completo</h1>${['01-escritorio-inicio','02-escritorio-final','03-movil-inicio','04-movil-final','05-escritorio-oscuro-final'].map(name=>`<h2>${name.slice(3).replaceAll('-',' ')}</h2><img src="${name}.png">`).join('')}`);
 console.log('Verified full poem, saved/reopened, panel modes, font and size changes, desktop/mobile, no clipping or nested scrolling.');
}finally{try{await send?.('Browser.close');}catch{}socket?.close();if(browser.exitCode===null)browser.kill();}
