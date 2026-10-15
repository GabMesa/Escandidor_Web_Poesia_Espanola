import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
const base=process.env.WORKSHOP_QA_ORIGIN||'http://localhost:8794';
const out='qa/cabecera-taller/'+(base.startsWith('https:')?'produccion':'local');
await mkdir(out,{recursive:true});
const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9251',`--user-data-dir=${process.cwd()}\\.wrangler\\header-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket,send,created=false;const checks=[],errors=[];
try{
 let targets;for(let i=0;i<50;i++){try{targets=await fetch('http://127.0.0.1:9251/json').then(r=>r.json());break;}catch{await sleep(200);}}
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
 await evaluate(`localStorage.setItem('mesa.colorTheme','light')`);await reload();
 await dimensions(1440);await shot('01-escritorio-sin-cuenta');await dimensions(390);await shot('02-movil-sin-cuenta');
 await click('[data-account=login]');assert.equal(await evaluate('document.querySelector("#modal").open'),true);await click('#modal [data-action=close]');
 const name='Taller'+String(Date.now()).slice(-7);
 const status=await evaluate(`fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:${JSON.stringify(name)},email:${JSON.stringify(name+'@example.test')},password:'HeaderQA123!'})}).then(r=>r.status)`);assert.equal(status,200);created=true;
 await reload();await evaluate(`window.d=document.querySelector('#workshop-editor').contentDocument`);
 await evaluate(`(()=>{const t=d.querySelector('#poemTitle');t.value='Canción del pirata';t.dispatchEvent(new Event('input',{bubbles:true}));const e=d.querySelector('#poemInput');e.value=${JSON.stringify('Con diez cañones por banda,\nviento en popa, a toda vela,')};e.dispatchEvent(new Event('input',{bubbles:true}));d.querySelector('#savePoem').click();})()`);
 await evaluate(`(async()=>{window.ea=await d.defaultView.eval("import('./application-state.js').then(m=>m.applicationState)");await ea.sync.queue;})()`);
 await evaluate(`document.querySelector('#workshop-editor').contentWindow.postMessage({type:'workshop:library-command',requestId:'header-color',command:{action:'color',poemKey:ea.editor.loadedVersionTitle,value:'#536907'}},location.origin)`);
 await until(`getComputedStyle(document.documentElement).getPropertyValue('--working-poem-color').trim()==='#536907'`);
 await until('app.runtime.workshopPersistence.pending===null');
 assert.equal(await evaluate('document.querySelector("#workshop-save-status").textContent'),'Guardado');
 assert.equal(await evaluate('document.querySelector("#workshop-save-status").title'),'Guardado en tu cuenta');
 await dimensions(1440);await shot('03-escritorio-con-cuenta');
 await click('.workshop-user-menu>summary');assert.equal(await evaluate('document.querySelector(".workshop-user-menu").open'),true);await shot('04-menu-cuenta');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.equal(await evaluate('document.querySelector(".workshop-user-menu").open'),false);
 await click('.workshop-user-menu>summary');await click('.brand span');await until('document.readyState==="complete" && !!document.querySelector("#intro-title")');
 assert.equal(await evaluate('location.pathname'),'/');
 await send('Page.navigate',{url:base+'/taller/?view=editor'});await ready();
 await dimensions(390);await shot('05-movil-con-cuenta');
 await click('.workshop-user-menu>summary');await shot('06-menu-cuenta-movil');await click('.workshop-public-links a');
 await until('document.readyState==="complete" && location.pathname.includes("agradecimientos")');
 await send('Page.navigate',{url:base+'/taller/?view=editor'});await ready();
 await dimensions(320);await dimensions(900);await dimensions(1024);
 await click('[data-theme-toggle]');await until('document.documentElement.dataset.theme==="dark"');await dimensions(1440);await shot('07-escritorio-oscuro');await dimensions(390);await shot('08-movil-oscuro');
 await click('.workshop-user-menu>summary');await click('.topbar .theme-toggle');assert.equal(await evaluate('document.querySelector(".workshop-user-menu").open'),false);
 const stateResponse=await evaluate('fetch("/api/state").then(r=>r.status)');assert.equal(stateResponse,200);
 assert.equal(errors.length,0,JSON.stringify(errors));
 await writeFile(out+'/verificacion.json',JSON.stringify({checkedAt:new Date().toISOString(),dimensions:checks,anonymousAndSignedIn:true,accountMenu:true,escapeAndOutsideClick:true,themeToggle:true,saveAndBackupAccessible:true,linksAccessible:true,consoleErrors:0},null,2));
 await writeFile(out+'/galeria.html',`<!doctype html><meta charset="utf-8"><title>Cabecera del Taller</title><style>body{font:16px system-ui;background:#e6e4d9;margin:20px}img{display:block;max-width:100%;margin:16px 0 30px}</style><h1>Cabecera del Taller</h1>${['01-escritorio-sin-cuenta','02-movil-sin-cuenta','03-escritorio-con-cuenta','04-menu-cuenta','05-movil-con-cuenta','06-menu-cuenta-movil','07-escritorio-oscuro','08-movil-oscuro'].map(name=>`<h2>${name.slice(3).replaceAll('-',' ')}</h2><img src="${name}.png">`).join('')}`);
 console.log('Verified compact header, signed in/out, account menu, theme and responsive widths: '+JSON.stringify(checks));
}finally{
 if(created&&send){try{const r=await send('Runtime.evaluate',{expression:`fetch('${base}/api/auth/account',{method:'DELETE',credentials:'include'}).then(r=>r.status)`,awaitPromise:true,returnByValue:true});assert.equal(r.result.value,200);console.log('Temporary QA account deleted.');}catch(e){console.error('QA cleanup failed:',e.message);process.exitCode=1;}}
 try{await send?.('Browser.close');}catch{}socket?.close();if(browser.exitCode===null)browser.kill();
}
