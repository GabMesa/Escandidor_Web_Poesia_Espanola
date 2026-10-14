import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { WebSocket } from 'ws';

const out = 'qa/local/versiones';
await mkdir(out, { recursive: true });
const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9243',
  `--user-data-dir=${process.cwd()}\\.versions-qa-browser`, 'about:blank'
], { stdio: 'ignore', windowsHide: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, send;
try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await fetch('http://127.0.0.1:9243/json').then(r => r.json()); break; }
    catch { await sleep(200); }
  }
  assert.ok(targets, 'Edge must start');
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.once('open', resolve));
  let id = 0;
  const pending = new Map();
  socket.on('message', raw => {
    const reply = JSON.parse(raw);
    if (pending.has(reply.id)) { pending.get(reply.id)(reply); pending.delete(reply.id); }
  });
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, reply => reply.error ? reject(Error(JSON.stringify(reply.error))) : resolve(reply.result));
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    assert.equal(reply.exceptionDetails, undefined, JSON.stringify(reply.exceptionDetails));
    return reply.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await sleep(200); }
    throw Error('Timed out: ' + expression);
  };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  const history=[
    {id:'manual-old',kind:'manual',versionNumber:1,label:'Primera idea',savedAt:'2026-10-01T12:00:00Z',poemText:'La primera idea.',poemTitle:'Versiones de prueba'},
    {id:'manual-new',kind:'manual',versionNumber:2,label:'Lista para trabajar',savedAt:'2026-10-02T12:00:00Z',poemText:'La idea revisada.',poemTitle:'Versiones de prueba'},
    {id:'auto-old',kind:'autosave',versionNumber:3,savedAt:'2026-10-03T12:00:00Z',poemText:'Un borrador automático.',poemTitle:'Versiones de prueba'},
    {id:'auto-new',kind:'autosave',versionNumber:4,savedAt:'2026-10-04T12:00:00Z',poemText:'El último borrador automático.',poemTitle:'Versiones de prueba'}
  ];
  for(const version of history){version.settings={poemFont:'atkinson',poeticForm:'custom',rioplatenseY:true,stressPatterns:{},hemistichPatterns:{}};version.sinalefaOverrides={};version.lineOverrides={};}
  await send('Page.navigate',{url:'http://localhost:8794/'});
  await until('!!document.querySelector("h1")');
  await evaluate(`localStorage.clear();localStorage.setItem('escandador.poemMemory.v1',${JSON.stringify(JSON.stringify({schemaVersion:2,poems:{'local:versions-qa':history},trash:{}}))})`);
  await send('Page.navigate',{url:'http://localhost:8794/escandidor'});
  await until(`!!document.querySelector('#workshop-editor')?.contentDocument?.querySelector('#savedPoemName')`);
  await evaluate(`(async()=>{window.qaState=(await import('/application-state.js')).applicationState.workshop;window.d=document.querySelector('#workshop-editor').contentDocument;})()`);
  await until('qaState.editorReady');
  await until(`Array.from(d.querySelector('#savedPoemName').options).some(o=>o.value==='local:versions-qa')`);
  await evaluate(`const name=d.querySelector('#savedPoemName');name.value='local:versions-qa';name.dispatchEvent(new Event('change',{bubbles:true}));`);
  const readSelect = expression => evaluate(`(()=>{const s=${expression};return {value:s.value,groups:Array.from(s.querySelectorAll('optgroup'),g=>({label:g.label,ids:Array.from(g.querySelectorAll('option'),o=>o.value)}))};})()`);
  const expected=[{label:'Guardadas manualmente',ids:['manual-new','manual-old']},{label:'Autoguardados',ids:['auto-new','auto-old']}];
  assert.deepEqual((await readSelect(`d.querySelector('#savedPoemVersion')`)).groups,expected);
  assert.equal((await readSelect(`d.querySelector('#savedPoemVersion')`)).value,'auto-new');
  await evaluate(`const s=d.querySelector('#savedPoemVersion');s.value='manual-old';s.dispatchEvent(new Event('change',{bubbles:true}));`);
  assert.equal(await evaluate(`d.querySelector('#poemInput').value`),'La primera idea.');
  assert.equal((await readSelect(`d.querySelector('#savedPoemVersion')`)).value,'manual-old');
  await evaluate(`document.querySelector('[data-view=library]').click()`);
  await until(`!!document.querySelector('#library-version')`);
  assert.deepEqual((await readSelect(`document.querySelector('#library-version')`)).groups,expected);
  const latest=await evaluate(`(async()=>{const model=await import('/taller/model.js');return model.latestVersion(model.readEditorLibrary(localStorage)[0]).id;})()`);
  assert.equal(latest,'auto-new');
  await writeFile(`${out}/verificacion.json`,JSON.stringify({checkedAt:new Date().toISOString(),editorManualsFirst:true,libraryManualsFirst:true,loadsOlderManual:true,selectionPreserved:true,latestStillAutosave:true},null,2));
  console.log('Verified mixed history groups in editor and library, loading older manual saves, preserving selection and chronological latest.');
}finally{
  if(send){try{await send('Browser.close');}catch{}}
  socket?.close();if(browser.exitCode===null)browser.kill();
}
