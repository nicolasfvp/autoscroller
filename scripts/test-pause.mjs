import fs from 'node:fs/promises';
import path from 'node:path';

const DEBUG_PORT = 9224;
const APP_URL = 'http://localhost:5178/';
const OUT = path.resolve('verify-shots/pause-test.png');

async function getTabWsUrl() {
  const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json();
  return (list.find(t => t.type === 'page') ?? list[0]).webSocketDebuggerUrl;
}
function rpc(ws, idRef, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++idRef.id;
    const on = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === id) { ws.removeEventListener('message', on); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
    };
    ws.addEventListener('message', on);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(ws, idRef, expression) {
  const r = await rpc(ws, idRef, 'Runtime.evaluate', {
    expression: `(async () => { try { ${expression} } catch (e) { return 'ERR: ' + (e?.stack || e.message); } })()`,
    awaitPromise: true, returnByValue: true,
  });
  return r.result?.value;
}

const ws = new WebSocket(await getTabWsUrl());
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const idRef = { id: 0 };
await rpc(ws, idRef, 'Page.enable');
await rpc(ws, idRef, 'Runtime.enable');
await rpc(ws, idRef, 'Page.navigate', { url: APP_URL });

for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 500));
  const rr = await rpc(ws, idRef, 'Runtime.evaluate', {
    expression: 'typeof globalThis.__game !== "undefined" && globalThis.__game.scene.getScenes(true).length > 0',
    returnByValue: true,
  });
  if (rr.result.value === true) break;
}
await new Promise(r => setTimeout(r, 1200));

// Capture any thrown errors from PauseScene.create()
await evalJs(ws, idRef, `
  globalThis.__captured = [];
  const orig = window.onerror;
  window.onerror = (msg, src, line, col, err) => {
    globalThis.__captured.push({ msg: String(msg), stack: err?.stack || '' });
    if (orig) orig(msg, src, line, col, err);
  };
`);

// Start a fresh run, then launch pause.
await evalJs(ws, idRef, `
  const g = globalThis.__game;
  for (const sc of g.scene.getScenes()) {
    if (!['GlobalSound','Boot','Preloader'].includes(sc.scene.key)) {
      try { g.scene.stop(sc.scene.key); } catch {}
    }
  }
  const rsMod = await import('/src/state/RunState.ts');
  const mpMod = await import('/src/systems/MetaPersistence.ts');
  const meta = await mpMod.loadMetaState();
  const run = rsMod.createNewRun(meta, 1, 'warrior');
  run.economy.gold = 200;
  rsMod.setRun(run);
  g.scene.start('GameScene');
`);
await new Promise(r => setTimeout(r, 2000));

await evalJs(ws, idRef, `
  const g = globalThis.__game;
  g.scene.pause('GameScene');
  g.scene.launch('PauseScene');
  await new Promise(r => setTimeout(r, 600));
  globalThis.__pauseInfo = {
    active: g.scene.getScenes(true).map(s => s.scene.key),
    pauseChildren: g.scene.getScene('PauseScene')?.children?.list?.length ?? -1,
    pauseVisible: g.scene.isActive('PauseScene'),
  };
`);

const info = await evalJs(ws, idRef, `return JSON.stringify(globalThis.__pauseInfo);`);
const errs = await evalJs(ws, idRef, `return JSON.stringify(globalThis.__captured);`);
console.log('PauseInfo:', info);
console.log('Errors:', errs);

const s = await rpc(ws, idRef, 'Page.captureScreenshot', { format: 'png' });
await fs.writeFile(OUT, Buffer.from(s.data, 'base64'));
console.log('Shot saved:', OUT);

ws.close();
