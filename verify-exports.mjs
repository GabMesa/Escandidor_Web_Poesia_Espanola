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
await new Promise(r=>server.listen(8792,'127.0.0.1',r));
const proc=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9228',`--user-data-dir=${root}\\.exports-qa-browser`,'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws, browserClose;const errors=[];
try{
 let targets;for(let i=0;i<30;i++){try{targets=await fetch('http://127.0.0.1:9228/json').then(r=>r.json());break;}catch{await sleep(200);}}assert.ok(targets);
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));
 let id=0;const waiting=new Map();ws.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(waiting.has(m.id)){waiting.get(m.id)(m);waiting.delete(m.id);}});
 const send=(method,params={})=>new Promise((r,reject)=>{const key=++id;waiting.set(key,m=>m.error?reject(Error(JSON.stringify(m.error))):r(m.result));ws.send(JSON.stringify({id:key,method,params}));});
 browserClose=()=>send('Browser.close');
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.equal(result.exceptionDetails,undefined,JSON.stringify(result.exceptionDetails));return result.result.value;};
 const ready=async()=>{for(let i=0;i<40;i++){if(await evaluate('!!document.body && document.readyState !== \"loading\"'))return;await sleep(200);}throw Error(await evaluate('location.href + \" \" + document.readyState'));};
 const navigate=async path=>{await send('Page.navigate',{url:'http://127.0.0.1:8792'+path});await ready();};
 const setWidth=async width=>send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
 const shot=async(file,clip)=>{const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,...(clip?{clip}:{})});await writeFile(file,Buffer.from(result.data,'base64'));};
 await send('Runtime.enable');await send('Page.enable');await mkdir('qa',{recursive:true});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
 await setWidth(1440);await navigate('/');await evaluate('localStorage.clear()');await send('Page.reload');await sleep(300);await ready();
 assert.equal(await evaluate('getComputedStyle(document.body).backgroundColor'),'rgb(230, 228, 217)');
 await shot('qa/portada-crema.png');
 await navigate('/escandidor.html');
 await evaluate(`(()=>{window.__downloads=[];HTMLAnchorElement.prototype.click=function(){if(this.download){window.__downloads.push({name:this.download,blob:fetch(this.href).then(r=>r.blob())});}};})()`);
 const input=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await evaluate('document.getElementById("autoCompressVersions").checked=false;document.getElementById("autoCompressVersions").dispatchEvent(new Event("change"))');
 await input('poemTitle','Poema de prueba');await input('poemInput','La luna');await evaluate('document.getElementById("savePoem").click()');await sleep(30);
 await input('poemInput','La luna brilla');await evaluate('document.getElementById("savePoem").click()');await sleep(30);
 await input('poemInput','La luna brilla sobre el mar');
 await evaluate('document.getElementById("exportPoemsMd").click()');assert.equal(await evaluate('document.getElementById("markdownExportDialog").open'),true);
 await shot('qa/exportar-markdown.png');await evaluate('document.getElementById("markdownExportAll").click()');
 const all=await evaluate('window.__downloads.at(-1).blob.then(b=>b.text())');
 assert.match(all,/La luna brilla sobre el mar/);assert.match(all,/<!-- Versión/);assert.match(all,/Borrador actual/);
 assert.ok((all.match(/^# Poema de prueba$/gm)||[]).length>=3);
 await evaluate('document.getElementById("exportPoemsMd").click();document.getElementById("markdownExportLatest").click()');
 const last=await evaluate('window.__downloads.at(-1).blob.then(b=>b.text())');assert.equal((last.match(/^# /gm)||[]).length,1);assert.match(last,/La luna brilla sobre el mar/);assert.doesNotMatch(last,/<!--/);
 const count=await evaluate('window.__downloads.length');await evaluate('document.getElementById("exportPoemsMd").click();document.querySelector("[data-close-markdown]").click()');assert.equal(await evaluate('window.__downloads.length'),count);
 await evaluate('document.getElementById("exportPoemVideo").click()');assert.equal(await evaluate('document.getElementById("poemVideoDialog").open'),true);
 assert.match(await evaluate('document.getElementById("poemVideoSummary").textContent'),/3 ediciones/);
 await input('poemVideoSpeed','.5');await shot('qa/exportar-video.png');
 await evaluate('document.getElementById("previewPoemVideo").click()');await sleep(3000);assert.match(await evaluate('document.getElementById("poemVideoStatus").textContent'),/terminada/);
 assert.equal(await evaluate('document.getElementById("downloadPoemVideo").disabled'),false);
 await evaluate('document.getElementById("downloadPoemVideo").click()');await sleep(3500);
 assert.match(await evaluate('document.getElementById("poemVideoStatus").textContent'),/descargado/);
 const videoInfo=await evaluate(`(async()=>{const d=window.__downloads.at(-1),b=await d.blob;window.__videoBlob=b;const player=document.createElement('video');player.muted=true;player.src=URL.createObjectURL(b);document.body.append(player);await new Promise((ok,fail)=>{player.onloadeddata=ok;player.onerror=()=>fail(Error('Video inválido'));});return {name:d.name,size:b.size,type:b.type,width:player.videoWidth,height:player.videoHeight};})()`);
 assert.ok(videoInfo.size>1000);assert.equal(videoInfo.width,1280);assert.equal(videoInfo.height,720);console.log('Video decoded:',videoInfo);
 // Preserve one actual output to review, not just a mocked successful export.
 const bytes=await evaluate('window.__videoBlob.arrayBuffer().then(buffer=>Array.from(new Uint8Array(buffer)))');
 await writeFile('qa/poema-evolucion.'+(videoInfo.type.includes('mp4')?'mp4':'webm'),Buffer.from(bytes));
 const beforeCancel=await evaluate('window.__downloads.length');await evaluate('document.getElementById("downloadPoemVideo").click()');await sleep(150);await evaluate('document.querySelector("[data-close-video]").click()');await sleep(850);assert.equal(await evaluate('window.__downloads.length'),beforeCancel);
 // Opening an older saved revision must still export the actual latest revision.
 await evaluate('document.getElementById("savePoem").click()');
 await evaluate(`(()=>{const s=document.getElementById('savedPoemVersion');s.value=s.options[s.options.length-1].value;s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await evaluate('document.getElementById("exportPoemsMd").click();document.getElementById("markdownExportLatest").click()');
 assert.match(await evaluate('window.__downloads.at(-1).blob.then(b=>b.text())'),/La luna brilla sobre el mar/);
 await setWidth(390);await evaluate('document.getElementById("exportPoemVideo").click()');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('qa/video-movil.png');await evaluate('document.querySelector("[data-close-video]").click()');
 await evaluate('document.querySelector("[data-theme-toggle]").click()');await evaluate('document.getElementById("exportPoemsMd").click()');await shot('qa/markdown-oscuro.png');await evaluate('document.querySelector("[data-close-markdown]").click()');
 await setWidth(1200);await navigate('/');await evaluate('localStorage.setItem("mesa.colorTheme","light")');await send('Page.reload');await sleep(300);await ready();
 await evaluate(`(()=>{const style=document.createElement('style');style.textContent='html{overflow:hidden}.newspaper-masthead{font-size:70px;padding-block:14px}.newspaper-hero{padding-block:24px!important}.newspaper-hero h1{font-size:51px!important}';document.head.append(style);})()`);
 await shot('assets/social-preview.png',{x:0,y:0,width:1200,height:630,scale:1});
 assert.deepEqual(errors,[]);console.log('Export QA passed: cream background, all/latest/draft/cancel Markdown, actual video encoding and playback, cancellation, mobile and dark dialogs.');
}finally{try{await Promise.race([browserClose?.(),sleep(2000)]);}catch{}ws?.close();proc.kill();server.close();}
