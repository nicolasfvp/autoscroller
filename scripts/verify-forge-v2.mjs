// Verify the new ForgeScene v2 — captures empty + with-elements screenshots and
// dumps console errors. Adapted from audit-scenes-isolated.mjs.
//
// Pre-req: a vite dev server on http://localhost:5178/ and a Chromium with
// --remote-debugging-port=9224 already pointing at it. The script in
// scripts/verify-forge-v2.bat (or PowerShell wrapper) starts both first.

import fs from 'node:fs/promises';
import path from 'node:path';

const DEBUG_PORT = 9224;
const APP_URL = 'http://localhost:5178/';
const SHOTS_DIR = path.resolve('verify-shots/forge-v2');

async function getTabWsUrl() {
  const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json();
  const tab = list.find(t => t.type === 'page') ?? list[0];
  return tab.webSocketDebuggerUrl;
}

function rpc(ws, idRef, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++idRef.id;
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

async function shot(ws, idRef, name) {
  await new Promise(r => setTimeout(r, 800));
  const s = await rpc(ws, idRef, 'Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(SHOTS_DIR, name), Buffer.from(s.data, 'base64'));
  console.log(`📸 ${name}`);
}

async function evalJs(ws, idRef, expression) {
  const r = await rpc(ws, idRef, 'Runtime.evaluate', {
    expression: `(async () => { try { ${expression} } catch (e) { return 'ERR: ' + e.message; } })()`,
    awaitPromise: true, returnByValue: true,
  });
  return r.result?.value;
}

const SEED_RUN = `
  const rsMod = await import('/src/state/RunState.ts');
  const mpMod = await import('/src/systems/MetaPersistence.ts');
  const meta = await mpMod.loadMetaState();
  const run = rsMod.createNewRun(meta, 1, 'warrior');
  run.economy.gold = 500;
  run.economy.elements = { attack: 4, defense: 2, agility: 1, counter: 0, fire: 3, water: 2, air: 0, earth: 1 };
  run.economy.shards = { attack: 3, defense: 7, fire: 5, water: 2, earth: 9 };
  rsMod.setRun(run);
`;

async function main() {
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  const wsUrl = await getTabWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  const consoleErrors = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
      const text = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      consoleErrors.push(`[${msg.params.type}] ${text}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(`[exception] ${msg.params.exceptionDetails.text}: ${msg.params.exceptionDetails.exception?.description ?? ''}`);
    }
  });

  const idRef = { id: 0 };
  await rpc(ws, idRef, 'Page.enable');
  await rpc(ws, idRef, 'Runtime.enable');
  await rpc(ws, idRef, 'Emulation.setDeviceMetricsOverride', {
    width: 800, height: 600, deviceScaleFactor: 2, mobile: false,
  });
  await rpc(ws, idRef, 'Page.navigate', { url: APP_URL });

  let ready = false;
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 500));
    const rr = await rpc(ws, idRef, 'Runtime.evaluate', {
      expression: 'typeof globalThis.__game !== "undefined" && globalThis.__game.scene.getScenes(true).length > 0',
      returnByValue: true,
    });
    if (rr.result.value === true) { ready = true; break; }
  }
  if (!ready) throw new Error('Phaser never ready');
  await evalJs(ws, idRef, `
    const dbs = await indexedDB.databases?.() ?? [];
    for (const d of dbs) await new Promise(r => { const req = indexedDB.deleteDatabase(d.name); req.onsuccess=r; req.onerror=r; req.onblocked=r; });
    localStorage.clear();
  `);
  await rpc(ws, idRef, 'Page.reload', { ignoreCache: true });
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 500));
    const rr = await rpc(ws, idRef, 'Runtime.evaluate', {
      expression: 'typeof globalThis.__game !== "undefined" && globalThis.__game.scene.getScenes(true).length > 0',
      returnByValue: true,
    });
    if (rr.result.value === true) break;
  }
  await new Promise(r => setTimeout(r, 1500));

  // Go straight to ForgeScene with seeded run.
  await evalJs(ws, idRef, `
    const g = globalThis.__game;
    for (const sc of g.scene.getScenes(true)) {
      if (!['GlobalSound','SpeedPanelScene'].includes(sc.scene.key)) g.scene.stop(sc.scene.key);
    }
    ${SEED_RUN}
    g.scene.start('ForgeScene', { parentScene: 'MainMenu' });
  `);
  await new Promise(r => setTimeout(r, 1800));
  await shot(ws, idRef, '01_forge_empty.png');

  // Fill 1 socket
  await evalJs(ws, idRef, `
    const fs = globalThis.__game.scene.getScene('ForgeScene');
    fs.forgeSlots = ['fire'];
    fs.renderForge();
  `);
  await new Promise(r => setTimeout(r, 700));
  await shot(ws, idRef, '02_forge_one_socket.png');

  // Fill 2 sockets — should match a card
  await evalJs(ws, idRef, `
    const fs = globalThis.__game.scene.getScene('ForgeScene');
    fs.forgeSlots = ['attack', 'fire'];
    fs.renderForge();
  `);
  await new Promise(r => setTimeout(r, 700));
  await shot(ws, idRef, '03_forge_two_sockets.png');

  // Fill 3 sockets
  await evalJs(ws, idRef, `
    const fs = globalThis.__game.scene.getScene('ForgeScene');
    fs.forgeSlots = ['attack', 'fire', 'agility'];
    fs.renderForge();
  `);
  await new Promise(r => setTimeout(r, 700));
  await shot(ws, idRef, '04_forge_three_sockets.png');

  // Check beam animation by waiting a bit
  await new Promise(r => setTimeout(r, 600));
  await shot(ws, idRef, '05_forge_beams_animated.png');

  if (consoleErrors.length > 0) {
    console.log('\n⚠️  Console errors/warnings observed:');
    for (const e of consoleErrors) console.log('  ' + e);
  } else {
    console.log('\n✓ No console errors.');
  }

  ws.close();
  console.log('\nShots in', SHOTS_DIR);
}

main().catch(e => { console.error(e); process.exit(1); });
