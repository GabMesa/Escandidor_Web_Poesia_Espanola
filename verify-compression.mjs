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
 await setWidth(1440);await navigate('/escandidor.html');await evaluate('localStorage.clear()');await send('Page.reload');await sleep(350);await ready();
 assert.equal(await evaluate('document.getElementById("autoCompressVersions").checked'),true);
 const save=async text=>evaluate(`document.getElementById('poemTitle').value='Poema de prueba';document.getElementById('poemInput').value=${JSON.stringify(text)};document.getElementById('savePoem').click()`);
 const groups=()=>evaluate('Object.values(JSON.parse(localStorage.getItem("escandador.poemMemory.v1")).poems)');
 for(const text of ['la','la luna','la casa','la casa canta'])await save(text);
 let versions=(await groups())[0];assert.deepEqual(versions.map(v=>v.poemText),['la luna','la casa canta']);assert.deepEqual(versions.map(v=>v.versionNumber),[2,4]);
 assert.deepEqual(await evaluate('Object.values(JSON.parse(localStorage.getItem("escandador.poemMemory.v1")).trash).flatMap(g=>g.flatMap(e=>e.versions)).map(v=>v.poemText).sort()'),['la','la casa']);
 assert.equal(await evaluate('document.getElementById("compressPoemVersions").disabled'),true);
 await evaluate('document.getElementById("autoCompressVersions").click()');await save('la casa canta de noche');assert.equal((await groups())[0].length,3);
 await send('Page.reload');await sleep(350);await ready();assert.equal(await evaluate('document.getElementById("autoCompressVersions").checked'),false);
 await evaluate('document.querySelector(".poem-select-all").click()');
 assert.equal(await evaluate('document.getElementById("compressPoemVersions").disabled'),false);
 await evaluate('document.getElementById("compressPoemVersions").click()');versions=(await groups())[0];assert.deepEqual(versions.map(v=>v.poemText),['la luna','la casa canta de noche']);assert.deepEqual(versions.map(v=>v.versionNumber),[2,5]);
 assert.equal(await evaluate('document.getElementById("autoCompressVersions").checked'),false);
 await evaluate('document.getElementById("autoCompressVersions").click();document.getElementById("newPoemTop").click()');
 await evaluate(`document.getElementById('poemTitle').value='Mar';document.getElementById('poemInput').value='El mar';document.getElementById('savePoem').click();document.getElementById('poemInput').value='El mar canta';document.getElementById('savePoem').click()`);
 let all=await groups();assert.equal(all.length,2);assert.equal(all[0].length,2);assert.deepEqual(all[1].map(v=>v.poemText),['El mar canta']);
 await evaluate(`document.getElementById('poemInput').value='El mar canta de noche';document.getElementById('poemInput').dispatchEvent(new Event('input',{bubbles:true}))`);
 await sleep(10200);all=await groups();assert.deepEqual(all[1].map(v=>v.poemText),['El mar canta de noche']);assert.equal(all[1][0].kind,'autosave');
 // Manual compression follows checked poems even when a different poem is open.
 await evaluate('document.getElementById("autoCompressVersions").click()');
 for(const title of ['Bosque','Rio','Sol']){
  await evaluate(`document.getElementById('newPoemTop').click();document.getElementById('poemTitle').value=${JSON.stringify(title)};document.getElementById('poemInput').value='canta';document.getElementById('savePoem').click();document.getElementById('poemInput').value='canta de noche';document.getElementById('savePoem').click()`);
 }
 await send('Page.reload');await sleep(350);await ready();
 assert.equal(await evaluate('document.getElementById("compressPoemVersions").disabled'),true);
 const beforeSelection=await groups();
 await evaluate(`for(const node of document.querySelectorAll('.poem-tree-node')){const title=node.querySelector('.poem-title-input').value;if(title==='Bosque')node.querySelector('.poem-select-all').click();}`);
 // Selecting one version also identifies its poem for full-history compression.
 await evaluate(`for(const node of document.querySelectorAll('.poem-tree-node')){if(node.querySelector('.poem-title-input').value==='Rio')node.querySelector('.saved-version-checkbox').click();}`);
 assert.equal(await evaluate('document.getElementById("compressPoemVersions").disabled'),false);
 await evaluate('window.compressionEvents=[];window.addEventListener("escandidor:versions-compressed",event=>window.compressionEvents.push(event.detail));document.getElementById("compressPoemVersions").click()');
 all=await groups();
 for(const title of ['Bosque','Rio'])assert.deepEqual(all.find(v=>v[0].poemTitle===title).map(v=>v.poemText),['canta de noche']);
 assert.deepEqual(all.find(v=>v[0].poemTitle==='Sol'),beforeSelection.find(v=>v[0].poemTitle==='Sol'));
 assert.equal(await evaluate('document.getElementById("poemTitle").value'),'Sol');
 assert.equal(await evaluate('document.getElementById("poemInput").value'),'canta de noche');
 assert.deepEqual(await evaluate('window.compressionEvents.map(e=>e.title).sort()'),['Bosque','Rio']);
 await evaluate('document.getElementById("selectAllVersions").click();document.getElementById("selectAllVersions").click()');
 assert.equal(await evaluate('document.getElementById("compressPoemVersions").disabled'),true);
 for(const theme of ['light','dark']){await evaluate(`document.documentElement.dataset.theme='${theme}';document.getElementById('compressPoemVersions').closest('details').open=true`);await setWidth(320);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);}
 assert.deepEqual(errors,[]);console.log('PASS: enabled by default; approved sequence; preserved numbers; trash; persistent toggle; manual compression with auto disabled; checked poems with another poem open; multiple and partial selections; no-selection disabled; separate poems; real autosave compression; mobile light/dark.');
}finally{try{await Promise.race([browserClose?.(),sleep(2000)]);}catch{}ws?.close();proc.kill();server.close();}
