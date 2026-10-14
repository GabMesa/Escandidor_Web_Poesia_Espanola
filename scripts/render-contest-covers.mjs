import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
const out='qa/prototipo/portadas',report=JSON.parse(await readFile(`${out}/auditoria.json`,'utf8'));
const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9243',`--user-data-dir=${process.cwd()}\\.covers-qa-browser`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket,send;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let targets;for(let i=0;i<50;i++){try{targets=await fetch('http://127.0.0.1:9243/json').then(r=>r.json());break;}catch{await sleep(200);}}
  assert.ok(targets);socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.once('open',r));
  const pending=new Map();let seq=0;socket.on('message',raw=>{const result=JSON.parse(raw);if(pending.has(result.id)){pending.get(result.id)(result);pending.delete(result.id);}});
  send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,r=>r.error?reject(Error(JSON.stringify(r.error))):resolve(r.result));socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');
  for(const c of report.cases){
    await send('Page.navigate',{url:`http://127.0.0.1:8793/${out}/${c.id}.html`});
    for(let i=0;i<50;i++){const value=await send('Runtime.evaluate',{expression:`document.readyState==='complete'&&document.querySelector('h2')?.textContent===${JSON.stringify(c.profile.workTitle)}`,returnByValue:true});if(value.result.value)break;await sleep(100);}
    await send('Runtime.evaluate',{expression:'document.fonts.ready',awaitPromise:true});
    const pdf=await send('Page.printToPDF',{preferCSSPageSize:true,displayHeaderFooter:false,printBackground:true});
    await writeFile(`${out}/${c.id}.pdf`,Buffer.from(pdf.data,'base64'));
    console.log('Rendered PDF:',c.id);
  }
}finally{if(send){try{await send('Browser.close');}catch{}}socket?.close();if(browser.exitCode===null)browser.kill();}
