import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { WebSocket } from 'ws';

const out = 'qa/prototipo/sinalefas';
await mkdir(out, { recursive: true });
const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9240',
  `--user-data-dir=${process.cwd()}\\.sinalefa-qa-browser`, 'about:blank'
], { stdio: 'ignore', windowsHide: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, send;
try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await fetch('http://127.0.0.1:9240/json').then(r => r.json()); break; }
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
  await send('Page.navigate', { url: 'http://127.0.0.1:8793/prototipo/' });
  await until('!!document.querySelector("[data-view=editor]")');
  await evaluate('document.querySelector("[data-view=editor]").click()');
  await until('!!document.querySelector("#workshop-editor")?.contentDocument?.querySelector("#poemInput")');
  await evaluate(`(async()=>{window.qaState=(await import('../application-state.js')).applicationState.prototype;})()`);
  await until('qaState.editorReady');
  await evaluate('document.querySelector("[data-view=editor]").click()');
  await evaluate('window.d = document.querySelector("#workshop-editor").contentDocument');
  const poem = 'butiá y es\náspera. y\náspera, y\nmi a y\nahora y ola\nmí a y\nni eufórico\npuente aerodinámico\nmi ala y';
  await evaluate(`(()=>{d.querySelector('#poemTitle').value='Triptongos y puntuación';const e=d.querySelector('#poemInput');e.value=${JSON.stringify(poem)};e.dispatchEvent(new Event('input',{bubbles:true}));d.querySelector('#sinalefaEnabled').click();})()`);
  await until('d.querySelector("#analysisOutput").textContent.includes("tiá")');
  const shot = async name => {
    assert.equal(await evaluate('document.querySelector("#editor-host").hidden'), false);
    await evaluate(`(()=>{const frame=document.querySelector('#workshop-editor');const target=d.querySelector('#analysisOutput');window.scrollTo(0,frame.getBoundingClientRect().top+scrollY+target.getBoundingClientRect().top-110);})()`);
    await sleep(300);
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(`${out}/${name}.png`, Buffer.from(result.data, 'base64'));
  };
  const buttons = () => evaluate('Array.from(d.querySelectorAll(".sinalefa-toggle"),e=>({line:e.dataset.line,boundary:e.dataset.boundary,text:e.textContent,title:e.title,active:e.classList.contains("is-active")}))');
  let marks = await buttons();
  assert.ok(marks.some(m => m.line === '6' && m.title.startsWith('Triptongo:')));
  assert.ok(marks.some(m => m.line === '1' && m.text === 'ra. y'));
  assert.ok(marks.some(m => m.line === '2' && m.text === 'ra, y'));
  await shot('01-deteccion-automatica');
  // Force both joins; the entire label retains the internal triphthong.
  for (const boundary of [0, 1]) {
    await evaluate(`(()=>{const b=Array.from(d.querySelectorAll('.sinalefa-toggle')).find(e=>e.dataset.line==='0' && e.dataset.boundary==='${boundary}');if(b&&!b.classList.contains('is-active'))b.click();})()`);
  }
  marks = await buttons();
  assert.ok(marks.some(m => m.line === '0' && m.text === 'tiáyes' && m.title.startsWith('Triptongo:')));
  await shot('02-butiayes-unido');
  await evaluate(`d.querySelector('.sinalefa-toggle[data-line="0"]').click()`);
  marks = await buttons();
  assert.ok(marks.some(m => m.line === '0' && !m.active));
  await shot('03-separacion-manual');
  await evaluate(`d.querySelector('.sinalefa-toggle[data-line="1"]').click()`);
  marks = await buttons();
  assert.ok(marks.some(m => m.line === '1' && m.text === 'ra. y'));
  await shot('04-puntuacion-al-alternar');
  const stressPoem = 'El sol y el mar\nTú y tu voz\nÉl ve el sol\nSí, si tú quieres\nSé que se fue\nDé la luz de tu voz\nMi voz es para mí\nMas quiero más\nNi al mar ni del sol\nTan cerca de ti\nAun sin luz\nYo vi un pez';
  await evaluate(`(()=>{d.querySelector('#poemTitle').value='Monosílabos tónicos y átonos';const e=d.querySelector('#poemInput');e.value=${JSON.stringify(stressPoem)};e.dispatchEvent(new Event('input',{bubbles:true}));d.querySelector('#sinalefaEnabled').click();})()`);
  await until('d.querySelector("#analysisOutput").textContent.includes("pez")');
  assert.ok(await evaluate(`Array.from(d.querySelectorAll('#analysisOutput strong')).some(e=>e.textContent==='sol')`));
  await shot('05-monosilabos-tonicos-y-atonos');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await shot('06-movil');
  await writeFile(`${out}/verificacion.json`, JSON.stringify({ checkedAt: new Date().toISOString(), triphthongInChain: true, punctuation: true, manualSeparation: true, monosyllabicStress: true, screenshots: 6 }, null, 2));
  console.log('Verified triphthong chain, punctuation, manual toggles and mobile.');
} finally {
  if (send) { try { await send('Browser.close'); } catch {} }
  socket?.close();
  if (browser.exitCode === null) browser.kill();
}
