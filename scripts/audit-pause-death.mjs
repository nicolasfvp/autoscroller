// Per-scene shots for scenes the main isolated audit can't drive correctly
// (Pause + Death need an active GameScene parent; the wholesale stop-all in
// the main script collides with the modal lifecycle).

import fs from 'node:fs/promises';
import path from 'node:path';

const DEBUG_PORT = 9224;
const APP_URL = 'http://localhost:5178/';
const SHOTS_DIR = path.resolve('verify-shots/audit2');

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
    expression: `(async () => { try { ${expression} } catch (e) { return 'ERR: ' + (e?.stack || e.message); } })()`,
    awaitPromise: true, returnByValue: true,
  });
  return r.result?.value;
}

async function main() {
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  const wsUrl = await getTabWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  const idRef = { id: 0 };
  await rpc(ws, idRef, 'Page.enable');
  await rpc(ws, idRef, 'Runtime.enable');
  await rpc(ws, idRef, 'Emulation.setDeviceMetricsOverride', {
    width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false,
  });
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

  // PAUSE — start GameScene with a real seeded run, then launch Pause on top.
  await evalJs(ws, idRef, `
    const g = globalThis.__game;
    const all = g.scene.getScenes();
    for (const sc of all) {
      if (!['GlobalSound','Boot','Preloader'].includes(sc.scene.key)) {
        try { g.scene.stop(sc.scene.key); } catch {}
      }
    }
    const rsMod = await import('/src/state/RunState.ts');
    const mpMod = await import('/src/systems/MetaPersistence.ts');
    const meta = await mpMod.loadMetaState();
    const run = rsMod.createNewRun(meta, 1, 'warrior');
    run.economy.gold = 120;
    rsMod.setRun(run);
    g.scene.start('GameScene');
  `);
  await new Promise(r => setTimeout(r, 1500));
  await evalJs(ws, idRef, `
    const g = globalThis.__game;
    g.scene.pause('GameScene');
    g.scene.launch('PauseScene');
    g.scene.bringToTop('PauseScene');
  `);
  await new Promise(r => setTimeout(r, 1000));
  await shot(ws, idRef, '12_pause.png');

  // DEATH — fresh start; seed run, launch Death directly with stats.
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
    rsMod.setRun(run);
    g.scene.start('DeathScene', { enemyName: 'Demo Lizard', stats: { damageDealt: 120, cardsPlayed: 8, combosTriggered: 2, goldEarned: 40 } });
  `);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '16_death.png');

  ws.close();
  console.log('\n✓ Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
