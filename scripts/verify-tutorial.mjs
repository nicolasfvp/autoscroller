// Drives the scripted tutorial step-by-step over CDP, screenshotting each
// state. Advances by clicking the overlay's Next button or invoking real
// scene methods (confirmSelection, confirmDeck, etc.) so the director's
// state lives in ONE singleton — Vite gives the dynamically-imported module
// a different instance under HMR, which breaks direct director calls.

import fs from 'node:fs/promises';
import path from 'node:path';

const DEBUG_PORT = 9224;
const APP_URL = 'http://localhost:5178/';
const SHOTS_DIR = path.resolve('verify-shots/tutorial');

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
  await new Promise(r => setTimeout(r, 500));
  const s = await rpc(ws, idRef, 'Page.captureScreenshot', { format: 'png' });
  const out = path.join(SHOTS_DIR, name);
  await fs.writeFile(out, Buffer.from(s.data, 'base64'));
  console.log(`📸 ${name}`);
}

async function evalJs(ws, idRef, expression) {
  const r = await rpc(ws, idRef, 'Runtime.evaluate', {
    expression: `(async () => { try { ${expression} } catch (e) { return 'ERR: ' + e.message; } })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  return r.result?.value;
}

/** Click the tutorial overlay's "Next →" button if it exists, on any active scene. */
async function clickOverlayNext(ws, idRef) {
  return evalJs(ws, idRef, `
    const g = globalThis.__game;
    for (const sc of g.scene.getScenes(true)) {
      const overlay = sc.children?.list?.find(c => c.depth === 15000);
      if (overlay) {
        const next = overlay.list?.find(cc => cc.text === 'Next →');
        if (next?.emit) { next.emit('pointerdown'); return 'clicked Next on ' + sc.scene.key; }
      }
    }
    return 'no Next found';
  `);
}

async function getActiveScenes(ws, idRef) {
  return evalJs(ws, idRef, `
    return globalThis.__game.scene.getScenes(true).map(s => s.scene.key);
  `);
}

/** Wait until the given scene is active or timeout. */
async function waitForScene(ws, idRef, sceneKey, timeoutMs = 25000) {
  let waited = 0;
  while (waited < timeoutMs) {
    await new Promise(r => setTimeout(r, 500));
    waited += 500;
    const scenes = await getActiveScenes(ws, idRef);
    if (scenes.includes(sceneKey)) return true;
  }
  return false;
}

async function main() {
  await fs.mkdir(SHOTS_DIR, { recursive: true });

  const wsUrl = await getTabWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const idRef = { id: 0 };
  await rpc(ws, idRef, 'Page.enable');
  await rpc(ws, idRef, 'Runtime.enable');
  await rpc(ws, idRef, 'Emulation.setDeviceMetricsOverride', {
    width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false,
  });

  // Wipe IDB BEFORE navigating so the tutorial gate sees a fresh meta.
  await rpc(ws, idRef, 'Page.navigate', { url: APP_URL });
  // Wait for game ready
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const r = await rpc(ws, idRef, 'Runtime.evaluate', {
        expression: 'typeof globalThis.__game !== "undefined" && globalThis.__game.scene.getScenes(true).length > 0',
        returnByValue: true,
      });
      if (r.result.value === true) { ready = true; break; }
    } catch {}
  }
  if (!ready) throw new Error('Phaser never ready');
  await new Promise(r => setTimeout(r, 1000));

  console.log('🧹 Wiping IDB then reloading...');
  await evalJs(ws, idRef, `
    const dbs = await indexedDB.databases?.() ?? [];
    for (const d of dbs) {
      await new Promise(r => { const req = indexedDB.deleteDatabase(d.name); req.onsuccess=r; req.onerror=r; req.onblocked=r; });
    }
    localStorage.clear();
    return 'wiped';
  `);
  await rpc(ws, idRef, 'Page.reload', { ignoreCache: true });
  ready = false;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const r = await rpc(ws, idRef, 'Runtime.evaluate', {
        expression: 'typeof globalThis.__game !== "undefined" && globalThis.__game.scene.getScenes(true).length > 0',
        returnByValue: true,
      });
      if (r.result.value === true) { ready = true; break; }
    } catch {}
  }
  if (!ready) throw new Error('Phaser never ready after reload');
  await new Promise(r => setTimeout(r, 1500));

  await shot(ws, idRef, '00_main_menu.png');

  // Click New Run via the MainMenu instance.
  console.log('▶ startNewRun');
  await evalJs(ws, idRef, `
    await globalThis.__game.scene.getScene('MainMenu').startNewRun();
    return 'ok';
  `);
  await new Promise(r => setTimeout(r, 2000));
  await shot(ws, idRef, '01_welcome_modal.png');

  // Welcome step: click Next via the overlay button.
  await clickOverlayNext(ws, idRef);
  await new Promise(r => setTimeout(r, 600));
  await shot(ws, idRef, '02_pick_warrior.png');

  // Pick warrior → tutorial path skips the template picker and launches
  // the DeckCustomization scene as the deck-review step.
  await evalJs(ws, idRef, `
    const cs = globalThis.__game.scene.getScene('CharacterSelectScene');
    cs.selectedIndex = 0;
    await cs.confirmSelection();
    return 'confirmed';
  `);
  await new Promise(r => setTimeout(r, 2500));
  await shot(ws, idRef, '03_deck_review.png');

  // Close the deck panel — advances 'deck-review' and starts GameScene.
  await evalJs(ws, idRef, `
    const dc = globalThis.__game.scene.getScene('DeckCustomizationScene');
    dc.close();
    return 'closed deck';
  `);
  await new Promise(r => setTimeout(r, 2500));
  await shot(ws, idRef, '04_game_map_intro.png');

  // Click Next on map-intro modal.
  await clickOverlayNext(ws, idRef);
  await new Promise(r => setTimeout(r, 800));
  await shot(ws, idRef, '05_game_walking.png');

  // Wait for combat to start (auto-advances map-intro via 'combat-start').
  console.log('⌛ waiting for combat...');
  await waitForScene(ws, idRef, 'CombatScene');
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '06_combat_intro.png');

  // Click Next on combat-intro → step becomes planning-intro on PLANNING.
  await clickOverlayNext(ws, idRef);
  await new Promise(r => setTimeout(r, 800));
  await shot(ws, idRef, '07_combat_post_intro.png');

  // Dismiss any keyword-intro overlay (force seen), then force-win combat.
  console.log('▶ dismiss keyword intro + force-win');
  await evalJs(ws, idRef, `
    // Repeatedly Enter-keypress in case multiple keywords queued, then
    // force-emit combat:end so the scene flow runs even if engine.tick is
    // stalled by a residual keyword overlay.
    for (let i = 0; i < 6; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await new Promise(r => setTimeout(r, 150));
    }
    const cs = globalThis.__game.scene.getScene('CombatScene');
    if (cs?.engine) {
      const st = cs.engine.getState();
      st.enemyHP = 0;
      // Manually checkEndConditions if tick is paused.
      if (cs.engine.checkEndConditions) cs.engine.checkEndConditions();
    }
    return 'forced';
  `);
  // Wait for planning overlay to open.
  console.log('⌛ waiting for planning overlay...');
  await waitForScene(ws, idRef, 'PlanningOverlay', 30000);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '08_planning_intro.png');

  // Click Next on planning-intro → place-tile.
  await clickOverlayNext(ws, idRef);
  await new Promise(r => setTimeout(r, 600));
  await shot(ws, idRef, '09_place_tile.png');

  // Simulate placing a combat tile (forest, the leftmost combat tile).
  // We click the first inventory card then an empty path slot.
  await evalJs(ws, idRef, `
    const po = globalThis.__game.scene.getScene('PlanningOverlay');
    po.selectedTileKey = 'forest';
    // Find an empty basic non-reserved slot.
    const slots = po.loopRunState.loop.tiles;
    const target = slots.findIndex(s => s.type === 'basic' && !s.reserved && !s.enemyId);
    po.onSlotClicked(target);
    return 'placed forest at ' + target;
  `);
  await new Promise(r => setTimeout(r, 800));
  await shot(ws, idRef, '10_place_subtile.png');

  // Place a subtile.
  await evalJs(ws, idRef, `
    const po = globalThis.__game.scene.getScene('PlanningOverlay');
    po.selectedTileKey = 'subtile_ambush';
    const slots = po.loopRunState.loop.tiles;
    const target = slots.findIndex(s => s.type === 'basic' && s.reserved && !s.enemyId);
    if (target < 0) return 'no reserved slot';
    po.onSlotClicked(target);
    return 'placed subtile at ' + target;
  `);
  await new Promise(r => setTimeout(r, 800));
  await shot(ws, idRef, '11_forge_intro.png');

  // Click Forge button (advances forge-intro).
  await evalJs(ws, idRef, `
    const po = globalThis.__game.scene.getScene('PlanningOverlay');
    po.openSubScene('ForgeScene');
    return 'opened forge';
  `);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '12_forge_craft.png');

  // Leave forge (advances forge-craft).
  await evalJs(ws, idRef, `
    const fs = globalThis.__game.scene.getScene('ForgeScene');
    fs.close();
    return 'left forge';
  `);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '13_boss_preview.png');

  // Click Start Loop — find the text button and fire pointerdown so the
  // real startLoop closure runs (which calls director.advanceIfMatches
  // through PlanningOverlay's statically-imported singleton).
  await evalJs(ws, idRef, `
    const po = globalThis.__game.scene.getScene('PlanningOverlay');
    const startBtn = po.children.list.find(c =>
      c.type === 'Text' && c.text === 'Start Loop'
    );
    if (!startBtn) return 'no Start Loop button';
    startBtn.emit('pointerdown', { button: 0 });
    return 'clicked Start Loop';
  `);
  await new Promise(r => setTimeout(r, 2000));
  await shot(ws, idRef, '14_complete.png');

  ws.close();
  console.log('\n✓ Done. Shots in', SHOTS_DIR);
}

main().catch(e => { console.error(e); process.exit(1); });
