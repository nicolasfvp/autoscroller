// Connects to headless Chrome on CDP port 9224, navigates to the dev server,
// waits for Phaser to boot, captures screenshots, AND reports the actual
// canvas CSS / backing-store dimensions so we can debug FIT scaling.

import fs from 'node:fs/promises';
import path from 'node:path';

const DEBUG_PORT = 9224;
const APP_URL = 'http://localhost:5178/';
const SHOTS_DIR = path.resolve('verify-shots');

async function getTabWsUrl() {
  const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json();
  const tab = list.find(t => t.type === 'page') ?? list[0];
  return tab.webSocketDebuggerUrl;
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
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      if (args.includes('[RESP]')) console.log('  >>>', args);
    }
  });

  const sizes = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1024x768',  width: 1024, height: 768  },
    { name: '800x600',   width: 800,  height: 600  },
  ];

  await fs.mkdir(SHOTS_DIR, { recursive: true });

  for (const s of sizes) {
    // Set viewport BEFORE navigation so initial render is at that size.
    await rpc(ws, ++id, 'Emulation.setDeviceMetricsOverride', {
      width: s.width, height: s.height, deviceScaleFactor: 1, mobile: false,
    });
    await rpc(ws, ++id, 'Page.navigate', { url: APP_URL });

    // Wait for Phaser
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const r = await rpc(ws, ++id, 'Runtime.evaluate', {
          expression: 'typeof globalThis.__game !== "undefined" && globalThis.__game.scene && globalThis.__game.scene.getScenes(true).length > 0',
          returnByValue: true,
        });
        if (r.result.value === true) { ready = true; break; }
      } catch (e) { /* keep polling */ }
    }
    if (!ready) { console.error('Phaser never ready'); continue; }

    // Wait extra for MainMenu render
    await new Promise(r => setTimeout(r, 1500));

    // Report dimensions for debugging
    const info = await rpc(ws, ++id, 'Runtime.evaluate', {
      expression: `
        (() => {
          const c = document.querySelector('canvas');
          if (!c) return 'no canvas';
          const r = c.getBoundingClientRect();
          const g = globalThis.__game;
          const sm = g.scale;
          return JSON.stringify({
            viewport: { w: window.innerWidth, h: window.innerHeight },
            canvasIntrinsic: { w: c.width, h: c.height },
            canvasCSS: { w: r.width, h: r.height },
            canvasPos: { x: r.left, y: r.top },
            parent: { w: c.parentElement?.clientWidth, h: c.parentElement?.clientHeight },
            scaleMode: sm.scaleMode,
            displaySize: { w: sm.displaySize.width, h: sm.displaySize.height },
            baseSize: { w: sm.baseSize.width, h: sm.baseSize.height },
            gameSize: { w: sm.gameSize.width, h: sm.gameSize.height },
            parentSize: { w: sm.parentSize.width, h: sm.parentSize.height },
            zoom: sm.zoom,
            mainCamZoom: g.scene.getScenes(true)[0]?.cameras?.main?.zoom,
          });
        })()
      `,
      returnByValue: true,
    });
    console.log(`\n[${s.name}] ${info.result.value}`);

    const shot = await rpc(ws, ++id, 'Page.captureScreenshot', { format: 'png' });
    const out = path.join(SHOTS_DIR, `responsive_${s.name}.png`);
    await fs.writeFile(out, Buffer.from(shot.data, 'base64'));
    const stat = await fs.stat(out);
    console.log(`Wrote ${out} (${stat.size} bytes)`);
  }

  ws.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
