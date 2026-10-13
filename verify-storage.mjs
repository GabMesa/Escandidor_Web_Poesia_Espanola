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
 const quota=await evaluate(`(()=>{
  localStorage.clear();
  const memory={schemaVersion:2,poems:{'local:keep':[{id:'keep-1',poemTitle:'Conservar',poemText:'Conservar este poema',kind:'autosave',versionNumber:1,savedAt:'2026-10-13T12:00:00Z',settings:{}}]},trash:{}};
  localStorage.setItem('escandador.poemMemory.v1',JSON.stringify(memory));
  localStorage.setItem('escandador.poemMemory.activeOwner.v1','anonymous');
  localStorage.setItem('escandador.poemMemory.user.7.v1',JSON.stringify({schemaVersion:2,poems:{},trash:{}}));
  let size=0;for(let length=100000;length<7000000;length+=100000){try{localStorage.setItem('escandador.wordfreqWords.v1','x'.repeat(length));size=length;}catch(error){let low=size,high=length;while(high-low>1){const mid=Math.floor((low+high)/2);try{localStorage.setItem('escandador.wordfreqWords.v1','x'.repeat(mid));low=mid;}catch{high=mid;}}return {name:error.name,size:low};}}
 })()`);
 assert.equal(quota.name,'QuotaExceededError');assert.ok(quota.size>2000000);
 await evaluate(`(()=>{document.getElementById('openLogin').click();document.getElementById('authIdentifier').value='poeta';document.getElementById('authPassword').value='test-only';document.getElementById('authForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));})()`);
 for(let i=0;i<30;i++){if(await evaluate('document.getElementById("accountIdentity").textContent === "poeta"'))break;await sleep(100);}
 assert.equal(await evaluate('document.getElementById("accountIdentity").textContent'),'poeta');
 assert.equal(await evaluate('document.getElementById("authDialog").open'),false);
 assert.equal(await evaluate('document.getElementById("localImportDialog").open'),true);
 assert.equal(await evaluate('localStorage.getItem("escandador.wordfreqWords.v1") === null'),true);
 assert.equal(await evaluate('JSON.parse(localStorage.getItem("escandador.poemMemory.anonymous.v1")).poems["local:keep"][0].poemText'),'Conservar este poema');
 assert.equal(await evaluate('localStorage.getItem("escandador.poemMemory.activeOwner.v1")'),'7');
 // Exercise actual browser Cache Storage, including the old localStorage migration.
 const cacheResult=await evaluate(`(async()=>{const module=await import('/browser-storage.js');localStorage.setItem('escandador.wordfreqWords.v1',JSON.stringify({version:1,buckets:[['poema','verso']]}));const first=await module.loadWordCorpusCache();const second=await module.loadWordCorpusCache();return {first,second,legacy:localStorage.getItem('escandador.wordfreqWords.v1')};})()`);
 assert.deepEqual(cacheResult,{first:[['poema','verso']],second:[['poema','verso']],legacy:null});
 assert.deepEqual(errors,[]);console.log('PASS: actual browser quota, successful login, preserved anonymous poem, separate corpus cache and migration.');
}finally{try{await Promise.race([browserClose?.(),sleep(2000)]);}catch{}ws?.close();proc.kill();server.close();}
