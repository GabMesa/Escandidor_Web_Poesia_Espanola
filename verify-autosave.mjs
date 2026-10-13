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
await new Promise(r=>server.listen(8793,'127.0.0.1',r));
const proc=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9235',`--user-data-dir=${root}\\.autosave-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws, browserClose;const errors=[];
try{
 let targets;for(let i=0;i<30;i++){try{targets=await fetch('http://127.0.0.1:9235/json').then(r=>r.json());if(targets.some(t=>t.type==='page'))break;await sleep(200);}catch{await sleep(200);}}assert.ok(targets);
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));
 let id=0;const waiting=new Map();ws.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(waiting.has(m.id)){waiting.get(m.id)(m);waiting.delete(m.id);}});
 const send=(method,params={})=>new Promise((r,reject)=>{const key=++id;waiting.set(key,m=>m.error?reject(Error(JSON.stringify(m.error))):r(m.result));ws.send(JSON.stringify({id:key,method,params}));});
 browserClose=()=>send('Browser.close');
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.equal(result.exceptionDetails,undefined,JSON.stringify(result.exceptionDetails));return result.result.value;};
 const ready=async()=>{for(let i=0;i<40;i++){if(await evaluate('!!document.body && document.readyState !== \"loading\"'))return;await sleep(200);}throw Error(await evaluate('location.href + \" \" + document.readyState'));};
 const navigate=async path=>{await send('Page.navigate',{url:'http://127.0.0.1:8793'+path});await ready();};
 const setWidth=async width=>send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
 const shot=async(file,clip)=>{const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,...(clip?{clip}:{})});await writeFile(file,Buffer.from(result.data,'base64'));};
 await send('Runtime.enable');await send('Page.enable');await mkdir('qa',{recursive:true});
 await setWidth(1440);await navigate('/escandidor.html');await evaluate('localStorage.clear()');await send('Page.reload');await sleep(300);await ready();await sleep(400);
 const input=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const versions=()=>evaluate(`import('/application-state.js').then(m=>Object.values(m.applicationState.library.poems).flat().map(v=>({id:v.id,text:v.poemText,number:v.versionNumber,kind:v.kind,savedAt:v.savedAt})))`);
 await evaluate('document.getElementById("autoCompressVersions").checked=false;document.getElementById("autoCompressVersions").dispatchEvent(new Event("change"))');
 await input('poemTitle','Pausas de escritura');await input('poemInput','Primer verso');await evaluate('document.getElementById("savePoem").click()');assert.equal((await versions()).length,1);
 await input('poemInput','Primer verso, empezando');await sleep(5500);assert.equal((await versions()).length,1);
 await input('poemInput','Primer verso, terminado');await sleep(5500);assert.equal((await versions()).length,1,'each input restarts the full ten-second delay');
 await sleep(4900);let saved=await versions();assert.equal(saved.length,2);assert.equal(saved[1].text,'Primer verso, terminado');assert.equal(saved[1].kind,'autosave');const checkpoint=structuredClone(saved[1]);console.log('First ten-second pause saved version 2.');
 await input('poemInput','Primer verso, terminado\nSegundo verso');await sleep(10400);saved=await versions();assert.equal(saved.length,3);assert.deepEqual(saved[1],checkpoint,'earlier autosave is immutable');assert.equal(saved[2].number,3);const last=structuredClone(saved[2]);
 await evaluate('document.getElementById("savePoem").click()');saved=await versions();assert.equal(saved.length,3,'manual saving same text does not duplicate');assert.equal(saved[2].kind,'manual');assert.equal(saved[2].id,last.id);assert.equal(saved[2].savedAt,last.savedAt);console.log('Second pause appended version 3; manual save kept its identity.');
 await input('poemInput','Primer verso, terminado\nSegundo verso');await sleep(10400);assert.equal((await versions()).length,3,'unchanged input does not create duplicate checkpoints');
 await evaluate('document.getElementById("exportPoemVideo").click()');assert.match(await evaluate('document.getElementById("poemVideoSummary").textContent'),/3 ediciones/);await evaluate('document.querySelector("[data-close-video]").click()');
 await send('Page.reload');await sleep(300);await ready();await sleep(350);assert.equal((await versions()).length,3,'checkpoints persist on reload');
 await input('poemTitle','Nuevo título');await sleep(10400);assert.equal((await versions()).length,3,'title edits persist without a duplicate text revision');assert.equal(await evaluate(`import('/application-state.js').then(m=>Object.values(m.applicationState.library.poems).flat().at(-1).poemTitle)`),'Nuevo título');
 assert.deepEqual(errors,[]);console.log('Autosave QA passed: real ten-second debounce, appended history, no overwritten autosaves, no duplicate saves, manual promotion, video timeline and reload persistence.');
}finally{try{await Promise.race([browserClose?.(),sleep(2000)]);}catch{}ws?.close();proc.kill();server.close();}
