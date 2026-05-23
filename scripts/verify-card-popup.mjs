// Variant of verify-card-screenshot.mjs that opens the CardDetailPopup
// for a single hardcoded card so the popup base size (400×640) gets
// exercised, and screenshots the result.

import fs from 'node:fs/promises';
import path from 'node:path';

const DEBUG_PORT = 9223;
const APP_URL = 'http://localhost:5176/';
const OUT = path.resolve('verify-shots/card_popup.png');
const TARGET_CARD_ID = 't1-attack-attack';   // a basic attack card

async function getTabWsUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json();
      const tab = list.find(t => t.type === 'page') ?? list[0];
      return tab.webSocketDebuggerUrl;
    } catch { await new Promise(r => setTimeout(r, 500)); }
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
  await rpc(ws, ++id, 'Page.navigate', { url: APP_URL });

  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(r => setTimeout(r, 500));
    const r = await rpc(ws, ++id, 'Runtime.evaluate', {
      expression: 'typeof globalThis.__game !== "undefined" && globalThis.__game.scene && globalThis.__game.scene.getScenes(true).length > 0',
      returnByValue: true,
    });
    if (r.result.value === true) break;
  }

  const r = await rpc(ws, ++id, 'Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const g = globalThis.__game;
          for (const s of g.scene.getScenes(true)) {
            if (s.scene.key !== 'CardLibraryScene') g.scene.stop(s.scene.key);
          }
          g.scene.start('CardLibraryScene');
          await new Promise(r => setTimeout(r, 1500));
          const lib = g.scene.getScene('CardLibraryScene');
          if (!lib) return 'NO_LIB';
          // Find any loaded card id from the data store.
          const mod = await import('/src/ui/CardFace.ts');
          const dl = await import('/src/data/DataLoader.ts');
          const allIds = (dl.getAllCards ? dl.getAllCards() : []).map(c => c.id);
          const id = allIds.length ? allIds[0] : ${JSON.stringify(TARGET_CARD_ID)};
          // Clear the library children so the popup-size card stands alone.
          lib.children.removeAll(true);
          lib.add.rectangle(400, 300, 800, 600, 0x000000, 0.85);
          // Use explicit size that fits the 800x600 canvas with margins.
          const face = mod.createCardFace(lib, 400, 300, id, { baseSize: { w: 340, h: 540 }, hover: false });
          return 'OK:' + id;
        } catch (err) {
          return 'ERR:' + (err && err.message ? err.message : String(err));
        }
      })()
    `,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log('eval result:', r.result.value);

  await new Promise(r => setTimeout(r, 2000));

  const shot = await rpc(ws, ++id, 'Page.captureScreenshot', { format: 'png' });
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, Buffer.from(shot.data, 'base64'));
  console.log(`Wrote ${OUT} (${(await fs.stat(OUT)).size} bytes)`);

  ws.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
