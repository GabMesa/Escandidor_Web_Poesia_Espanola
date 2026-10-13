import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {WebSocket} from 'ws';
const root=process.cwd();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ico':'image/x-icon','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(path.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(path.includes('supporters')?{count:0}:{user:null}));return;}
 const file=resolve(root,'.'+(path==='/'?'/index.html':path));
 if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(8788,'127.0.0.1',r));
const proc=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9225',`--user-data-dir=${root}\\.site-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws; const errors=[];
try{
 let targets;
 for(let attempt=0;attempt<30;attempt++){try{targets=await fetch('http://127.0.0.1:9225/json').then(r=>r.json());break;}catch{await sleep(200);}}
 assert.ok(targets,'Edge did not start');
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));
 let id=0;const waiting=new Map();ws.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(waiting.has(m.id)){waiting.get(m.id)(m);waiting.delete(m.id);}});
 const send=(method,params={})=>new Promise((r,reject)=>{const key=++id;waiting.set(key,m=>m.error?reject(new Error(JSON.stringify(m.error))):r(m.result));ws.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
 const navigate=async path=>{await send('Page.navigate',{url:'http://127.0.0.1:8788'+path});await sleep(1200);};
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await mkdir('qa',{recursive:true});
 await mkdir('assets',{recursive:true});
 const screenshot=async name=>{await writeFile('qa/'+name,Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));};
 for(const path of ['/','/escandidor.html','/apoyar.html']){
  await navigate(path);
  if (path === '/') await evaluate('localStorage.clear()');
  assert.equal(await evaluate('document.querySelectorAll("h1").length'),1);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,path+' desktop overflow');
  assert.ok(await evaluate('document.querySelector("link[rel=canonical]")?.href'));
  await screenshot(path==='/'?'landing-desktop.png':path.includes('escandidor')?'escandidor-desktop.png':'donaciones-desktop.png');
 }
 await navigate('/');
 await send('Emulation.setDeviceMetricsOverride',{width:1200,height:630,deviceScaleFactor:1,mobile:false});
 await evaluate(`(()=>{const style=document.createElement('style');style.textContent='html{overflow:hidden}.intro{padding-block:36px 40px}.verse-sheet{padding:20px 26px}.sheet-heading{font-size:30px;margin:22px 0}.demo-line{padding-block:15px}.sheet-bottom{padding-top:12px}.sheet-legend{margin-top:15px}figcaption{margin-block:12px 18px}h1{font-size:78px}';document.head.append(style);})()`);
 await writeFile('assets/social-preview.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1200,height:630,scale:1}})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await navigate('/escandidor.html');
 const input=async(selector,value,event='input')=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));return true;})()`);
 assert.equal(await evaluate('document.getElementById("assonanceRangeField").hidden'),true);
 for(const [mode,hidden] of [['consonante',false],['asonante',true],['palabra-final',true]]){await input('#rhymeMode',mode,'change');assert.equal(await evaluate('document.getElementById("assonanceRangeField").hidden'),hidden);}
 await input('#syllablePattern','7 14');
 assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-hemi-group]")].map(e=>e.dataset.hemiGroup)'),['7','14']);
 await input('#poemInput','La luna brilla sola la noche canta clara\nLa luna brilla sola');
 await input('[data-hemi-count="14"]','6');
 await evaluate('document.querySelector("[data-add-hemi=\\"14\\"]").click()');
 await input('[data-hemi-group="14"] .stress-pattern-entry:last-child input','7');
 const text=await evaluate('document.getElementById("analysisOutput").innerText');
 console.log('Hemistich result:',text.slice(0,450));
 assert.ok(await evaluate('document.querySelector(".hemistich-marker")'),'alternative cut must render');
 assert.equal(await evaluate('document.querySelectorAll(".hemistich-marker").length'),1,'cut only applies to 14 syllables');
 assert.equal(await evaluate('document.querySelectorAll(".invalid-hemi").length'),0,'blank 7-syllable group does not inherit 14-syllable cuts');
 await input('#hemistichVerses','2');
 assert.equal(await evaluate('document.querySelectorAll(".hemistich-marker").length'),0);
 await input('#hemistichVerses','1');
 assert.equal(await evaluate('document.querySelectorAll(".hemistich-marker").length'),1);
 await input('#hemistichVerses','');
 await input('#rhymeMode','consonante','change');
 await input('#poemTitle','Prueba de hemistiquios');
 await evaluate('window.__saved=null;window.addEventListener("escandidor:poem-saved",e=>window.__saved=e.detail);document.getElementById("savePoem").click()');
 assert.deepEqual(await evaluate('window.__saved.version.settings.hemistichPatterns'),{'7':[''],'14':['6','7']});
 await send('Page.reload');await sleep(1200);
 assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-hemi-count=\\"14\\"]")].map(e=>e.value)'),['6','7']);
 assert.equal(await evaluate('document.getElementById("assonanceRangeField").hidden'),false);
 await evaluate('document.querySelector("[data-remove-hemi]").click()');
 assert.equal(await evaluate('document.querySelectorAll("[data-hemi-count=\\"14\\"]").length'),1);
 await input('#poeticForm','cuadernaVia','change');
 assert.equal(await evaluate('document.querySelector("[data-hemi-count=\\"14\\"]").value'),'7');
 await evaluate('document.querySelector("details.config-shell").open=true;document.querySelector(".poetic-form-shell")?.setAttribute("open","");document.querySelectorAll("details").forEach(e=>{if(e.querySelector("#syllablePattern"))e.open=true;})');
 await screenshot('configuracion-desktop.png');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 for(const path of ['/','/escandidor.html','/apoyar.html']){await navigate(path);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,path+' mobile overflow');await screenshot(path==='/'?'landing-mobile.png':path.includes('escandidor')?'escandidor-mobile.png':'donaciones-mobile.png');}
 assert.deepEqual(errors,[],'browser exceptions');console.log('Browser QA passed: routes, metadata, rhyme visibility, per-count alternatives, save/reload, preset and responsive widths.');
}finally{ws?.close();proc.kill();server.close();}
