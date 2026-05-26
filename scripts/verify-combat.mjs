// Drives directly into combat. Tries to: navigate to MainMenu, click New Run
// (via mouse event at button position), pick character, screenshot each step.

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

async function shot(ws, idRef, name) {
  const s = await rpc(ws, ++idRef.id, 'Page.captureScreenshot', { format: 'png' });
  const out = path.join(SHOTS_DIR, name);
  await fs.writeFile(out, Buffer.from(s.data, 'base64'));
  console.log(`Wrote ${out}`);
}

async function main() {
  const wsUrl = await getTabWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const idRef = { id: 0 };
  await rpc(ws, ++idRef.id, 'Page.enable');
  await rpc(ws, ++idRef.id, 'Runtime.enable');
  await rpc(ws, ++idRef.id, 'Emulation.setDeviceMetricsOverride', {
    width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false,
  });
  await rpc(ws, ++idRef.id, 'Page.navigate', { url: APP_URL });

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const r = await rpc(ws, ++idRef.id, 'Runtime.evaluate', {
        expression: 'typeof globalThis.__game !== "undefined" && globalThis.__game.scene && globalThis.__game.scene.getScenes(true).length > 0',
        returnByValue: true,
      });
      if (r.result.value === true) { ready = true; break; }
    } catch (e) {}
  }
  if (!ready) throw new Error('Phaser never ready');

  await fs.mkdir(SHOTS_DIR, { recursive: true });
  await new Promise(r => setTimeout(r, 2500));

  // Call MainMenu.startNewRun() directly (it's a "private" method but JS doesn't enforce that).
  await rpc(ws, ++idRef.id, 'Runtime.evaluate', {
    expression: `
      (async () => {
        const g = globalThis.__game;
        const mm = g.scene.getScene('MainMenu');
        if (!mm) return 'no MainMenu';
        await mm.startNewRun();
        return 'ok';
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  }).then(r => console.log('startNewRun:', r.result?.value));

  await new Promise(r => setTimeout(r, 2500));
  await shot(ws, idRef, 'combat_step1_after_newrun.png');

  // Now on CharacterSelect — call confirmSelection() directly on the first card.
  await rpc(ws, ++idRef.id, 'Runtime.evaluate', {
    expression: `
      (async () => {
        const g = globalThis.__game;
        const cs = g.scene.getScene('CharacterSelectScene');
        if (!cs) return 'no CS';
        cs.selectedIndex = 0;
        await cs.confirmSelection();
        return 'confirmed';
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  }).then(r => console.log('confirmSelection:', r.result?.value));
  await new Promise(r => setTimeout(r, 4000));

  await shot(ws, idRef, 'combat_step2_after_char.png');

  // Likely now in GameScene or Tutorial. Skip tutorial if present.
  const sceneInfo = await rpc(ws, ++idRef.id, 'Runtime.evaluate', {
    expression: `
      (() => {
        const g = globalThis.__game;
        return JSON.stringify({
          active: g.scene.getScenes(true).map(s => s.scene.key),
        });
      })()
    `,
    returnByValue: true,
  });
  console.log('Active scenes:', sceneInfo.result.value);

  // If Tutorial is up, skip it via Enter spam
  for (let i = 0; i < 5; i++) {
    await rpc(ws, ++idRef.id, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await rpc(ws, ++idRef.id, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await new Promise(r => setTimeout(r, 600));
  }

  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, 'combat_step3_after_tutorial.png');

  // Click "Start Run" button in StartingDeckScene. Find it via text search and dispatch click.
  await rpc(ws, ++idRef.id, 'Runtime.evaluate', {
    expression: `
      (() => {
        const g = globalThis.__game;
        const db = g.scene.getScene('StartingDeckScene');
        if (!db) return 'no StartingDeckScene';
        const search = (list) => {
          for (const obj of list) {
            if (obj.text && obj.text.includes('Start Run') && obj.input) return obj;
            if (obj.list) { const f = search(obj.list); if (f) return f; }
          }
          return null;
        };
        const btn = search(db.children?.list || []);
        if (!btn) return 'no btn';
        btn.emit('pointerdown', { button: 0, x: btn.x, y: btn.y, event: { preventDefault: () => {} } });
        btn.emit('pointerup', { button: 0, x: btn.x, y: btn.y, event: { preventDefault: () => {} } });
        return 'clicked at ' + btn.x + ',' + btn.y;
      })()
    `,
    returnByValue: true,
  }).then(r => console.log('Start Run:', r.result?.value));

  // Wait for combat
  await new Promise(r => setTimeout(r, 8000));
  await shot(ws, idRef, 'combat_step4_during_run.png');

  // Also navigate into combat: wait, then if GameScene is active, force a combat
  await rpc(ws, ++idRef.id, 'Runtime.evaluate', {
    expression: `JSON.stringify(globalThis.__game.scene.getScenes(true).map(s => s.scene.key))`,
    returnByValue: true,
  }).then(r => console.log('Mid scenes:', r.result?.value));

  await new Promise(r => setTimeout(r, 4000));
  await shot(ws, idRef, 'combat_step5_later.png');

  // Click "Start Game" on Tutorial
  await rpc(ws, ++idRef.id, 'Runtime.evaluate', {
    expression: `
      (() => {
        const g = globalThis.__game;
        const sc = g.scene.getScene('TutorialScene');
        if (!sc) return 'no Tutorial';
        const search = (list) => {
          for (const obj of list) {
            if (obj.text && (obj.text === 'Start Game' || obj.text.includes('Start Game')) && obj.input) return obj;
            if (obj.list) { const f = search(obj.list); if (f) return f; }
          }
          return null;
        };
        const btn = search(sc.children?.list || []);
        if (!btn) return 'no btn';
        btn.emit('pointerdown', { button: 0 });
        btn.emit('pointerup', { button: 0 });
        return 'clicked';
      })()
    `,
    returnByValue: true,
  }).then(r => console.log('Start Game:', r.result?.value));

  await new Promise(r => setTimeout(r, 6000));
  await shot(ws, idRef, 'combat_step6_in_game.png');

  await new Promise(r => setTimeout(r, 5000));
  await shot(ws, idRef, 'combat_step7_combat.png');

  // Click on the Tavern building. World position (400, 310) at zoom 2 = canvas (800, 620).
  // At 1920x1080 with letterbox (240px sides), viewport position ~= (960, 558).
  const tx = 960, ty = 558;
  await rpc(ws, ++idRef.id, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: tx, y: ty });
  await rpc(ws, ++idRef.id, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: tx, y: ty, button: 'left', clickCount: 1 });
  await rpc(ws, ++idRef.id, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: tx, y: ty, button: 'left', clickCount: 1 });

  await new Promise(r => setTimeout(r, 3000));
  await shot(ws, idRef, 'combat_step8_tavern.png');

  // Click "Start" in TavernPanelScene
  await rpc(ws, ++idRef.id, 'Runtime.evaluate', {
    expression: `
      (() => {
        const g = globalThis.__game;
        const sc = g.scene.getScene('TavernPanelScene');
        if (!sc) return 'no Tavern';
        const search = (list) => {
          for (const obj of list) {
            if (obj.text && (obj.text === 'Start' || obj.text.toLowerCase().includes('start')) && obj.input) return obj;
            if (obj.list) { const f = search(obj.list); if (f) return f; }
          }
          return null;
        };
        const btn = search(sc.children?.list || []);
        if (!btn) return 'no btn (children: ' + (sc.children?.list || []).map(o => o.text || o.type).slice(0, 10).join(', ') + ')';
        btn.emit('pointerdown', { button: 0 });
        btn.emit('pointerup', { button: 0 });
        return 'clicked';
      })()
    `,
    returnByValue: true,
  }).then(r => console.log('Tavern Start:', r.result?.value));

  await new Promise(r => setTimeout(r, 6000));
  await shot(ws, idRef, 'combat_step9_loop.png');

  await new Promise(r => setTimeout(r, 6000));
  await shot(ws, idRef, 'combat_step10_after.png');

  const lastInfo = await rpc(ws, ++idRef.id, 'Runtime.evaluate', {
    expression: `JSON.stringify(globalThis.__game.scene.getScenes(true).map(s => s.scene.key))`,
    returnByValue: true,
  });
  console.log('Last scenes:', lastInfo.result.value);

  const finalInfo = await rpc(ws, ++idRef.id, 'Runtime.evaluate', {
    expression: `JSON.stringify(globalThis.__game.scene.getScenes(true).map(s => s.scene.key))`,
    returnByValue: true,
  });
  console.log('Final scenes:', finalInfo.result.value);

  ws.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
