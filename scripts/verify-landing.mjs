import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { WebSocket } from 'ws';

const out = 'qa/local/landing';
await mkdir(out, { recursive: true });
const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9242',
  `--user-data-dir=${process.cwd()}\\.landing-qa-browser`, 'about:blank'
], { stdio: 'ignore', windowsHide: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, send;
try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await fetch('http://127.0.0.1:9242/json').then(r => r.json()); break; }
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
  const screenshots=[];
  for(const theme of ['light','dark']){
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
      await send('Page.navigate',{url:'http://localhost:8794/'});
      await until('!!document.querySelector("#tools-title")');
      await evaluate(`localStorage.setItem('mesa.colorTheme','${theme}')`);
      await send('Page.reload');
      await until(`document.documentElement.dataset.theme==='${theme}'&&!!document.querySelector('#tools-title')`);
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`${theme}/${width} overflow`);
      assert.equal(await evaluate('document.querySelectorAll(".workshop-features article").length'),6);
      assert.equal(await evaluate('document.querySelectorAll("h1").length'),1);
      const structured=await evaluate(`JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)`);
      assert.equal(structured['@graph'][2].name,'Mesa de Poesía');
      await evaluate('document.fonts.ready');
      const metrics=await send('Page.getLayoutMetrics');
      const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.ceil(metrics.cssContentSize.height),scale:1}});
      const name=`${theme}-${width}.png`;
      await writeFile(`${out}/${name}`,Buffer.from(image.data,'base64'));screenshots.push(name);
    }
  }
  await send('Page.navigate',{url:'http://localhost:8794/'});
  await until('!!document.querySelector(".hero .cta")');
  await evaluate('document.querySelector(".hero .cta").click()');
  await until(`location.pathname==='/taller/'&&!!document.querySelector('#editor-host')&&!document.querySelector('#editor-host').hidden`);
  assert.equal(await evaluate('new URLSearchParams(location.search).get("view")'),'editor');
  await writeFile(`${out}/verificacion.json`,JSON.stringify({checkedAt:new Date().toISOString(),screenshots,overflow:false,tools:6,ctaOpensWorkshop:true,localHomepage:true},null,2));
  console.log('Verified landing in light/dark desktop/mobile, all six tool areas, metadata and CTA to local workshop.');
}finally{
  if(send){try{await send('Browser.close');}catch{}}
  socket?.close();if(browser.exitCode===null)browser.kill();
}
