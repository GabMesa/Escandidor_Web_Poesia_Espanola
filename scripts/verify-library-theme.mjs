import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
const base=process.env.WORKSHOP_QA_ORIGIN||'http://localhost:8794';
const out='qa/biblioteca-tema/'+(base.startsWith('https:')?'produccion':'local');
await mkdir(out,{recursive:true});
const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9255',`--user-data-dir=${process.cwd()}\\.wrangler\\library-theme-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket,send;const checks=[],errors=[];
try{
 let targets;for(let i=0;i<50;i++){try{targets=await fetch('http://127.0.0.1:9255/json').then(r=>r.json());break;}catch{await sleep(200);}}
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


 await evaluate(`(()=>{const d=document.querySelector('#workshop-editor').contentDocument;d.querySelector('#poemTitle').value='Un poema en la biblioteca';const e=d.querySelector('#poemInput');e.value=${JSON.stringify('> Al viento, una memoria.\n\nCon diez cañones por banda,\nviento en popa, a toda vela,')};e.dispatchEvent(new Event('input',{bubbles:true}));d.querySelector('#savePoem').click();})()`);
 await evaluate(`(async()=>{window.d=document.querySelector('#workshop-editor').contentDocument;window.ea=await d.defaultView.eval("import('./application-state.js').then(m=>m.applicationState)");})()`);
 await click('[data-view=library]');await until('!!document.querySelector(".library-poem-preview blockquote")');
 const contrast=async()=>evaluate(`(()=>{const e=document.querySelector('.library-poem-preview'),q=e.querySelector('blockquote'),ctx=document.createElement('canvas').getContext('2d');const rgb=c=>{ctx.fillStyle=c;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3);};const lum=arr=>arr.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const bg=rgb(getComputedStyle(e).backgroundColor),ink=rgb(getComputedStyle(e).color),quote=rgb(getComputedStyle(q).color),b=lum(bg),ratio=c=>(Math.max(lum(c),b)+.05)/(Math.min(lum(c),b)+.05);return {theme:document.documentElement.dataset.theme,bg,ink,quote,textRatio:ratio(ink),quoteRatio:ratio(quote)};})()`);
 const inspect=async()=>{const c=await contrast();assert.ok(c.textRatio>=4.5,JSON.stringify(c));assert.ok(c.quoteRatio>=4.5,JSON.stringify(c));if(c.theme==='dark')assert.ok(Math.max(...c.bg)<100,JSON.stringify(c));else assert.ok(Math.min(...c.bg)>180,JSON.stringify(c));checks.push(c);};
 const theme=async value=>{if(await evaluate('document.documentElement.dataset.theme')!==value)await click('[data-theme-toggle]');await until(`document.documentElement.dataset.theme===${JSON.stringify(value)}`);await sleep(350);};
 const photo=async name=>{await evaluate('document.querySelector(".library-inspector").scrollIntoView({block:"start"})');await shot(name);};
 await theme('dark');await inspect();await photo('01-biblioteca-oscura');
 for(const color of ['#536907','#AF3029','#205EA6']){
   await evaluate(`document.querySelector('#workshop-editor').contentWindow.postMessage({type:'workshop:library-command',requestId:'library-tint',command:{action:'color',poemKey:ea.editor.loadedVersionTitle,value:${JSON.stringify(color)}}},location.origin)`);
   await until(`getComputedStyle(document.documentElement).getPropertyValue('--working-poem-color').trim()===${JSON.stringify(color)}`);await inspect();
 }
 await dimensions(390);await photo('02-biblioteca-oscura-movil');await inspect();
 await theme('light');await inspect();await photo('03-biblioteca-clara-movil');
 await dimensions(1440);await photo('04-biblioteca-clara');
 assert.equal(errors.length,0,JSON.stringify(errors));
 await writeFile(out+'/verificacion.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,consoleErrors:0},null,2));
 await writeFile(out+'/galeria.html',`<!doctype html><meta charset="utf-8"><title>Biblioteca en claro y oscuro</title><style>body{font:16px system-ui;background:#e6e4d9;margin:20px}img{display:block;max-width:100%;margin:16px 0 30px}</style><h1>Biblioteca en claro y oscuro</h1>${['01-biblioteca-oscura','02-biblioteca-oscura-movil','03-biblioteca-clara-movil','04-biblioteca-clara'].map(name=>`<h2>${name.slice(3).replaceAll('-',' ')}</h2><img src="${name}.png">`).join('')}`);
 console.log('Verified library preview and quotes: dark/light, mobile/desktop, three poem colors, contrast >= 4.5:1.');
}finally{try{await send?.('Browser.close');}catch{}socket?.close();if(browser.exitCode===null)browser.kill();}
