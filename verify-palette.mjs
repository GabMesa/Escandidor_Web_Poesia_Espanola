import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {WebSocket} from 'ws';
const root=process.cwd();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
 if(req.url.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url.includes('acknowledgements')?{ok:true,donors:[]}:req.url.includes('supporters')?{count:0}:{user:null}));return;}
 let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';
 const file=resolve(root,'.'+path);if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(8794,'127.0.0.1',r));
const proc=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9236',`--user-data-dir=${root}\\.palette-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,browserClose;const errors=[];
try{
 let targets;for(let i=0;i<30;i++){try{targets=await fetch('http://127.0.0.1:9236/json').then(r=>r.json());if(targets.some(t=>t.type==='page'))break;await sleep(200);}catch{await sleep(200);}}assert.ok(targets);
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));
 let id=0;const waiting=new Map();ws.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(waiting.has(m.id)){waiting.get(m.id)(m);waiting.delete(m.id);}});
 const send=(method,params={})=>new Promise((r,reject)=>{const key=++id;waiting.set(key,m=>m.error?reject(Error(JSON.stringify(m.error))):r(m.result));ws.send(JSON.stringify({id:key,method,params}));});
 browserClose=()=>send('Browser.close');
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.equal(result.exceptionDetails,undefined,JSON.stringify(result.exceptionDetails));return result.result.value;};
 const ready=async()=>{for(let i=0;i<50;i++){if(await evaluate('!!document.body && document.readyState === \"complete\"'))return;await sleep(200);}throw Error('La pagina no termino de cargar');};
 const navigate=async path=>{await send('Page.navigate',{url:'http://127.0.0.1:8794'+path});await ready();await sleep(200);};
 const setWidth=async width=>send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
 const shot=async(file,clip)=>{const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,...(clip?{clip}:{})});await writeFile(file,Buffer.from(result.data,'base64'));};
 await send('Runtime.enable');await send('Page.enable');await mkdir('qa',{recursive:true});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
 await setWidth(1440);await navigate('/');await evaluate('localStorage.clear()');await send('Page.reload');await sleep(350);await ready();
 assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');
 await evaluate('document.querySelector("[data-theme-toggle]").click()');
 assert.equal(await evaluate('document.documentElement.dataset.theme'),'dark');
 assert.equal(await evaluate('localStorage.getItem("mesa.colorTheme")'),'dark');
 await navigate('/apoyar.html');assert.equal(await evaluate('document.documentElement.dataset.theme'),'dark');
 await evaluate('document.querySelector("[data-theme-toggle]").click()');assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');
 await send('Page.reload');await sleep(350);await ready();assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');
 // Without an explicit choice, follow the device preference and later changes.
 await evaluate('localStorage.removeItem("mesa.colorTheme")');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});await send('Page.reload');await sleep(350);await ready();
 assert.equal(await evaluate('document.documentElement.dataset.theme'),'dark');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});await sleep(100);assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');
 const routes=[['/','portada'],['/escandidor.html','escandidor'],['/apoyar.html','donaciones'],['/agradecimientos.html','agradecimientos'],['/privacidad.html','privacidad'],['/admin.html','administracion'],['/404.html','404'],['/landing.html','landing-compatibilidad']];
 for(const theme of ['light','dark']) {
  await evaluate(`localStorage.setItem('mesa.colorTheme','${theme}')`);
  for(const [path,name] of routes) {
   await setWidth(1440);await navigate(path);
   assert.equal(await evaluate('document.documentElement.dataset.theme'),theme,name+' saved theme');
   assert.equal(await evaluate('document.querySelectorAll("h1").length'),1,name+' heading');
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,name+' desktop overflow');
   assert.equal(await evaluate('getComputedStyle(document.documentElement).colorScheme'),theme);
   const rgb=await evaluate('getComputedStyle(document.body).backgroundColor');assert.ok(theme==='dark'?rgb.startsWith('rgb(16,'):rgb.startsWith('rgb(230,'),name+' page background '+rgb);
   if(name==='escandidor'){
    await evaluate(`(()=>{const poem=document.getElementById('poemInput');poem.value='La luna brilla sola la noche canta clara\\nLa luna brilla sola';poem.dispatchEvent(new Event('input',{bubbles:true}));const form=document.getElementById('poeticForm');form.value='cuadernaVia';form.dispatchEvent(new Event('change',{bubbles:true}));document.querySelectorAll('details').forEach(d=>{if(d.querySelector('#syllablePattern'))d.open=true;});})()`);
    assert.equal(await evaluate("[...document.querySelectorAll('[data-hemi-count]')].find(e=>e.dataset.hemiCount==='14').value"),'7');
    assert.ok(await evaluate('!!document.querySelector(".hemistich-marker")'));
    await evaluate('document.getElementById("openLogin").click()');
    assert.equal(await evaluate('document.getElementById("authDialog").open'),true);
    assert.equal(await evaluate('getComputedStyle(document.getElementById("authDialog")).backgroundColor'),theme==='dark'?'rgb(28, 27, 26)':'rgb(242, 240, 229)');
    await shot('qa/login-'+theme+'.png');await evaluate('document.getElementById("closeAuthDialog").click()');
    await evaluate('document.getElementById("currentPoemColorBtn").click()');await shot('qa/color-picker-'+theme+'.png');await evaluate('document.querySelector("#colorPickerModal").classList.remove("is-open")');
   }
   if(!path.includes('landing'))await shot('qa/'+name+'-'+theme+'.png');
   await setWidth(390);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,name+' mobile overflow');
   if(['portada','escandidor','donaciones'].includes(name))await shot('qa/'+name+'-'+theme+'-movil.png');
   await setWidth(320);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,name+' small mobile overflow');
   console.log('OK',theme,name);
  }
 }
 // Refresh the actual social preview; this affects only the temporary QA view.
 await evaluate('localStorage.setItem("mesa.colorTheme","light")');await setWidth(1200);await navigate('/');
 await evaluate(`(()=>{const style=document.createElement('style');style.textContent='html{overflow:hidden}.newspaper-masthead{font-size:70px;padding-block:14px}.newspaper-hero{padding-block:24px!important}.newspaper-hero h1{font-size:51px!important}.poem-column{padding:22px}.poem-column h2{font-size:30px;margin:12px 0}.poem-column .poem{font-size:22px}.annotation{margin-top:14px;padding-top:10px}';document.head.append(style);})()`);
 await shot('assets/social-preview.png',{x:0,y:0,width:1200,height:630,scale:1});
 assert.deepEqual(errors,[]);console.log('Flexoki palette QA passed: theme persistence, system preference, 8 routes, 2 themes, desktop/390/320 widths, metric controls and dialogs.');
}finally{try{await Promise.race([browserClose?.(),sleep(2000)]);}catch{}ws?.close();proc.kill();server.close();}
