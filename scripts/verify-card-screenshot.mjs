// One-shot CDP driver: launches the running Vite dev server in an
// already-started Edge instance (--remote-debugging-port=9223), navigates
// to localhost, waits for Phaser to boot, jumps to the CardLibraryScene
// via the globalThis.__game hook, and saves a screenshot.

import fs from 'node:fs/promises';
import path from 'node:path';

const DEBUG_PORT = 9223;
const APP_URL = 'http://localhost:5176/';
const OUT = path.resolve('verify-shots/card_library.png');

async function getTabWsUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://localhost:${DEBUG_PORT}/json/version`);
      if (!res.ok) throw new Error(`http ${res.status}`);
      const json = await res.json();
      const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json();
      const tab = list.find(t => t.type === 'page') ?? list[0];
      void json;
      return tab.webSocketDebuggerUrl;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('CDP not reachable');
}

function rpc(ws, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const onMsg = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', onMsg);
        if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const wsUrl = await getTabWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let id = 0;
  await rpc(ws, ++id, 'Page.enable');
  await rpc(ws, ++id, 'Runtime.enable');

  // Navigate to the app and wait for Phaser to expose __game.
  await rpc(ws, ++id, 'Page.navigate', { url: APP_URL });

  // Poll for __game with a generous timeout.
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(r => setTimeout(r, 500));
    const r = await rpc(ws, ++id, 'Runtime.evaluate', {
      expression: 'typeof globalThis.__game !== "undefined" && globalThis.__game.scene && globalThis.__game.scene.getScenes(true).length > 0',
      returnByValue: true,
    });
    if (r.result.value === true) { ready = true; break; }
  }
  if (!ready) throw new Error('Phaser game never exposed __game');

  // Jump to CardLibraryScene. Stop active scenes first so the library renders
  // alone, undisturbed by the Main Menu DOM.
  await rpc(ws, ++id, 'Runtime.evaluate', {
    expression: `
      (() => {
        const g = globalThis.__game;
        const sm = g.scene;
        for (const s of sm.getScenes(true)) {
          if (s.scene.key !== 'CardLibraryScene') sm.stop(s.scene.key);
        }
        sm.start('CardLibraryScene');
        return 'started';
      })()
    `,
    returnByValue: true,
  });

  // Give the scene a moment to render.
  await new Promise(r => setTimeout(r, 2500));

  const shot = await rpc(ws, ++id, 'Page.captureScreenshot', { format: 'png' });
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, Buffer.from(shot.data, 'base64'));
  console.log(`Wrote ${OUT} (${(await fs.stat(OUT)).size} bytes)`);

  ws.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
