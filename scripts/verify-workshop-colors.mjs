import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { WebSocket } from 'ws';

const out = 'qa/prototipo/colores';
await mkdir(out, { recursive: true });
const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9241',
  `--user-data-dir=${process.cwd()}\\.colors-qa-browser`, 'about:blank'
], { stdio: 'ignore', windowsHide: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, send;
try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await fetch('http://127.0.0.1:9241/json').then(r => r.json()); break; }
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
  const colors = [
    {name:'azul',value:'#205EA6'},
    {name:'violeta',value:'#5E409D'},
    {name:'verde',value:'#1C6C66'},
    {name:'amarillo',value:'#ECCB60'}
  ];
  const results = [];
  const shot = async name => {
    await evaluate('document.querySelector("#toast").style.display="none";window.scrollTo(0,0)');
    await sleep(250);
    const result = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(`${out}/${name}.png`,Buffer.from(result.data,'base64'));
  };
  const metrics = () => evaluate(`(()=>{const s=getComputedStyle(document.documentElement);const b=document.querySelector('.primary');return {active:document.documentElement.classList.contains('working-poem'),color:s.getPropertyValue('--working-poem-color').trim(),action:s.getPropertyValue('--action').trim(),bg:getComputedStyle(document.body).backgroundColor,surface:s.getPropertyValue('--surface').trim(),button:b?getComputedStyle(b).backgroundColor:null,ink:b?getComputedStyle(b).color:null};})()`);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await click('[data-view=library]');
  await click('[data-action=edit-poem][data-id=orilla]');
  await until('d.querySelector("#poemTitle").value==="La orilla que vuelve"');
  for (const color of colors) {
    await click('[data-view=editor]');
    await evaluate('d.querySelector("#currentPoemColorBtn").click()');
    await until('!!document.querySelector(".shared-color-picker")');
    await evaluate(`(()=>{const input=document.querySelector('.shared-color-picker input[type=color]');input.value='${color.value}';input.dispatchEvent(new Event('input',{bubbles:true}));const intensity=document.querySelector('.shared-color-picker select');intensity.value='medium';intensity.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await click('.shared-color-picker [data-picker=accept]');
    await until(`qaState.editorTheme.toLowerCase()==='${color.value.toLowerCase()}'`);
    for (const view of ['editor','library','contests','reminders']) {
      await click(`[data-view=${view}]`);
      await sleep(150);
      const state = await metrics();
      assert.equal(state.active,true,`${color.name}/${view}: active theme`);
      assert.equal(state.color.toLowerCase(),color.value.toLowerCase());
      assert.equal(state.action.toLowerCase(),color.value.toLowerCase());
      if(view==='library') assert.equal(await evaluate('document.querySelector("#editor-host").hidden'),true);
      if(view==='editor') assert.equal(await evaluate('document.querySelector("#editor-host").hidden'),false);
      results.push({colorName:color.name,view,...state});
      await shot(`${color.name}-${view}`);
    }
    await click('[data-view=library]');
    await click('[data-action=manage-tags]');
    assert.equal((await metrics()).color.toLowerCase(),color.value.toLowerCase());
    await shot(`${color.name}-dialogo`);
    await click('#modal [data-action=close]');
  }
  assert.equal(results.find(r=>r.colorName==='amarillo'&&r.view==='library').ink,'rgb(0, 0, 0)');
  assert.equal(results.find(r=>r.colorName==='azul'&&r.view==='library').ink,'rgb(255, 255, 255)');
  // Updating the open poem must reach the parent while the editor is hidden.
  await evaluate(`d.documentElement.style.setProperty('--poem-color','#AF3029')`);
  await until(`qaState.editorTheme.toLowerCase()==='#af3029'`);
  assert.equal((await metrics()).active,true);
  // Clearing the editor theme removes the shared palette from every tab.
  await evaluate(`d.body.classList.remove('has-poem-theme')`);
  await until(`!document.documentElement.classList.contains('working-poem')`);
  await writeFile(`${out}/verificacion.json`,JSON.stringify({checkedAt:new Date().toISOString(),screenshots:20,hiddenEditorUpdates:true,themeReset:true,results},null,2));
  const sections=colors.map(color=>`<section><h2>${color.name} · ${color.value}</h2><div class="grid">${['editor','library','contests','reminders','dialogo'].map(view=>`<figure><a href="${color.name}-${view}.png" target="_blank"><img src="${color.name}-${view}.png" alt="${view} en ${color.name}" loading="lazy"></a><figcaption>${view}</figcaption></figure>`).join('')}</div></section>`).join('');
  await writeFile(`${out}/galeria.html`,`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>El color del poema en todo el taller</title><style>body{background:#f3f0e7;color:#292b27;margin:0;font:16px system-ui}main{padding:30px;max-width:1450px;margin:auto}h1{font:42px Georgia}h2{font:28px Georgia;text-transform:capitalize}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px}figure{margin:0;background:#fff;border-radius:8px;overflow:hidden}img{width:100%;height:280px;object-fit:contain}figcaption{padding:15px;text-transform:capitalize}section{margin:40px 0}</style><main><h1>El color del poema en todo el taller</h1><p>20 capturas reales: Escandidor, Biblioteca, Concursos, Recordatorios y diálogos en azul, violeta, verde y amarillo. El tema se conserva al cambiar de pestaña. Abrí una imagen para verla completa.</p>${sections}</main></html>`);
  console.log('Verified 4 colors across 4 tabs and dialogs, light-color contrast, hidden editor updates and theme reset. 20 screenshots.');
} finally {
  if (send) { try { await send('Browser.close'); } catch {} }
  socket?.close();
  if (browser.exitCode === null) browser.kill();
}
