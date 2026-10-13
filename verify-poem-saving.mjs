import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {WebSocket} from 'ws';
const root=process.cwd();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
 if(req.url.startsWith('/api/')){
  res.setHeader('Content-Type','application/json');
  const payload=req.url.includes('/auth/login')?{user:{id:7,username:'poeta'},otherSessions:0}:req.url.includes('/poems')?{ok:true,poems:[]}:req.url.includes('/trash')?{ok:true,trash:[],deletedPoemIds:[]}: {user:null};
  res.end(JSON.stringify(payload));return;
 }

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
 await send('Runtime.enable');await send('Page.enable');
 await setWidth(1440);await navigate('/escandidor.html');
 await evaluate(`localStorage.clear();localStorage.setItem('escandador.poemMemory.v1',JSON.stringify({schemaVersion:2,poems:{'local:blank':[{poemText:' '}],'local:legacy':[{id:'legacy',versionNumber:2,poemTitle:'Sin título',poemText:'No perder este verso',settings:{}}]},trash:{}}))`);
 await send('Page.reload');await sleep(350);await ready();
 assert.equal(await evaluate('JSON.parse(localStorage.getItem("escandador.poemMemory.v1")).poems["local:blank"] === undefined'),true);
 assert.equal(await evaluate('JSON.parse(localStorage.getItem("escandador.poemMemory.v1")).poems["local:legacy"][0].poemText'),'No perder este verso');
 const count=()=>evaluate('Object.values(JSON.parse(localStorage.getItem("escandador.poemMemory.v1")).poems).flat().length');
 const enter=async(title,text)=>evaluate(`document.getElementById('poemTitle').value=${JSON.stringify(title)};document.getElementById('poemInput').value=${JSON.stringify(text)};document.getElementById('savePoem').click()`);
 await evaluate('document.getElementById("newPoemTop").click()');assert.equal(await count(),1);
 for(const title of ['', 'Sin título', 'SIN TITULO']){await enter(title,'Un verso');assert.equal(await count(),1);}
 await enter('Poema real',' \n\t');assert.equal(await count(),1);
 await enter('Poema real','Primer verso');assert.equal(await count(),2);
 await enter('Poema real','Primer verso');assert.equal(await count(),2);
 await enter('Poema real','Segundo verso');assert.equal(await count(),3);
 await enter('Poema real','Segundo verso\n');assert.equal(await count(),3);
 await enter('Poema real','Primer verso');assert.equal(await count(),4);
 // Changed settings do not create an identical text revision.
 await evaluate(`document.getElementById('assonanceRange').value=9;document.getElementById('assonanceRange').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('savePoem').click()`);
 assert.equal(await count(),4);
 // Autosaving also refuses an untitled draft after the real ten-second delay.
 await evaluate(`document.getElementById('poemTitle').value='Sin título';document.getElementById('poemInput').value='Borrador sin título';document.getElementById('poemInput').dispatchEvent(new Event('input',{bubbles:true}))`);
 await sleep(10200);assert.equal(await count(),4);
 assert.deepEqual(errors,[]);console.log('PASS: local empty cleanup; untitled legacy content preserved; manual/autosave title and content validation; consecutive duplicates blocked; A/B/A retained; settings do not duplicate text.');
}finally{try{await Promise.race([browserClose?.(),sleep(2000)]);}catch{}ws?.close();proc.kill();server.close();}
