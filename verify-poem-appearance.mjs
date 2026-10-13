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
await new Promise(r=>server.listen(8795,'127.0.0.1',r));
const proc=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9237',`--user-data-dir=${root}\\.colors-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,browserClose;const errors=[];
try{
 let targets;for(let i=0;i<30;i++){try{targets=await fetch('http://127.0.0.1:9237/json').then(r=>r.json());if(targets.some(t=>t.type==='page'))break;await sleep(200);}catch{await sleep(200);}}assert.ok(targets);
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));
 let id=0;const waiting=new Map();ws.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(waiting.has(m.id)){waiting.get(m.id)(m);waiting.delete(m.id);}});
 const send=(method,params={})=>new Promise((r,reject)=>{const key=++id;waiting.set(key,m=>m.error?reject(Error(JSON.stringify(m.error))):r(m.result));ws.send(JSON.stringify({id:key,method,params}));});
 browserClose=()=>send('Browser.close');
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.equal(result.exceptionDetails,undefined,JSON.stringify(result.exceptionDetails));return result.result.value;};
 const ready=async()=>{for(let i=0;i<50;i++){if(await evaluate('!!document.body && document.readyState === \"complete\"'))return;await sleep(200);}throw Error('La pagina no termino de cargar');};
 const navigate=async path=>{await send('Page.navigate',{url:'http://127.0.0.1:8795'+path});await ready();await sleep(200);};
 const setWidth=async width=>send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
 const shot=async(file,clip)=>{const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,...(clip?{clip}:{})});await writeFile(file,Buffer.from(result.data,'base64'));};
 await send('Runtime.enable');await send('Page.enable');await mkdir('qa',{recursive:true});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
 await setWidth(1440);await navigate('/escandidor.html');
 await evaluate('localStorage.clear()');await send('Page.reload');await sleep(350);await ready();

 await evaluate(`(()=>{const style=document.createElement('style');style.textContent='*,*::before,*::after{transition:none!important}';document.head.append(style);})()`);
 const baseline=await evaluate('getComputedStyle(document.querySelector(".panel-header")).backgroundColor');
 for(const theme of ['light','dark']) {
  await evaluate(`localStorage.setItem('mesa.colorTheme','${theme}');document.documentElement.dataset.theme='${theme}'`);
  for(const color of ['#205EA6','#A02F6F','#ECCB60','#100F0F','#E6E4D9']) {
   await evaluate(`document.getElementById('currentPoemColorBtn').click();document.querySelector('.color-picker-swatch[data-color="${color}"]').click();document.getElementById('colorPickerIntensity').value='strong';document.getElementById('colorPickerAccept').click()`);
   await sleep(300); const result=await evaluate(`(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
    const lum=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,1,1);const rgb=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
    const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
    const panel=document.querySelector('.panel-header h2').closest('.panel-header'),heading=panel.querySelector('h2'),button=document.getElementById('savePoem');
    const p=getComputedStyle(panel),h=getComputedStyle(heading),b=getComputedStyle(button);
    const card=getComputedStyle(document.querySelector('.output-panel'));
    return {fillLuminance:lum(card.backgroundColor),borderLuminance:lum(card.borderTopColor),pageLuminance:lum(getComputedStyle(document.body).backgroundColor),panel:p.backgroundColor,headingContrast:contrast(h.color,p.backgroundColor),buttonContrast:contrast(b.color,b.backgroundColor),bg:getComputedStyle(document.body).backgroundColor};
   })()`);
   assert.notEqual(result.panel,baseline);assert.ok(result.headingContrast>=4.5,JSON.stringify({theme,color,...result}));assert.ok(result.buttonContrast>=4.5,JSON.stringify({theme,color,...result}));
   if(theme==='dark'){assert.ok(result.fillLuminance>result.borderLuminance,JSON.stringify(result));assert.ok(result.fillLuminance>result.pageLuminance,JSON.stringify(result));}
   if(color==='#205EA6')await shot('qa/apariencia-poema-'+theme+'.png');
  }
  await setWidth(320);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await setWidth(1440);
  await send('Page.reload');await sleep(350);await ready();assert.equal(await evaluate('document.body.classList.contains("has-poem-theme")'),true);
  await evaluate('document.getElementById("currentPoemColorBtn").click();document.querySelector("[data-action=default]").click()');
  assert.equal(await evaluate('document.body.classList.contains("has-poem-theme")'),false);
 }
 assert.deepEqual(errors,[]);console.log('PASS: themed panels, buttons, contrast >=4.5 with dark/pale colors in both themes, reload, reset and mobile.');
}finally{try{await Promise.race([browserClose?.(),sleep(2000)]);}catch{}ws?.close();proc.kill();server.close();}


