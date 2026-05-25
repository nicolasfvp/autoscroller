// Drives every player-facing scene via CDP and screenshots each so we can
// audit visual consistency in one pass. Walks the natural run flow where it
// matters (CharSelect → DeckBuilder → Game → Combat → Planning → Forge →
// DeckCustom → Shop → Boss exit → Death), plus standalone screens
// (CityHub, Library, Collection, Settings, Tutorial, RelicViewer).

import fs from 'node:fs/promises';
import path from 'node:path';

const DEBUG_PORT = 9224;
const APP_URL = 'http://localhost:5178/';
const SHOTS_DIR = path.resolve('verify-shots/audit');

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

async function waitForScene(ws, idRef, key, timeoutMs = 20000) {
  let waited = 0;
  while (waited < timeoutMs) {
    await new Promise(r => setTimeout(r, 400));
    waited += 400;
    const scenes = await evalJs(ws, idRef, `return globalThis.__game.scene.getScenes(true).map(s => s.scene.key);`);
    if (scenes.includes(key)) return true;
  }
  return false;
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

  // Wipe + reload for fresh start.
  await rpc(ws, idRef, 'Page.navigate', { url: APP_URL });
  let ready = false;
  for (let i = 0; i < 60; i++) {
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
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    const rr = await rpc(ws, idRef, 'Runtime.evaluate', {
      expression: 'typeof globalThis.__game !== "undefined" && globalThis.__game.scene.getScenes(true).length > 0',
      returnByValue: true,
    });
    if (rr.result.value === true) break;
  }
  await new Promise(r => setTimeout(r, 1500));

  // Drop the director so tutorial doesn't overlay every screen during audit.
  await evalJs(ws, idRef, `
    // Mark tutorialSeen so subsequent flows skip the scripted tutorial.
    const mp = await import('/src/systems/MetaPersistence.ts');
    const meta = await mp.loadMetaState();
    meta.tutorialSeen = true;
    await mp.saveMetaState(meta);
  `);

  // 1. MainMenu (already on it)
  await shot(ws, idRef, '01_main_menu.png');

  // 2. CharacterSelectScene (via startNewRun)
  await evalJs(ws, idRef, `await globalThis.__game.scene.getScene('MainMenu').startNewRun();`);
  await new Promise(r => setTimeout(r, 1800));
  await shot(ws, idRef, '02_character_select.png');

  // 3. DeckBuilderScene (via confirmSelection)
  await evalJs(ws, idRef, `
    const cs = globalThis.__game.scene.getScene('CharacterSelectScene');
    cs.selectedIndex = 0;
    await cs.confirmSelection();
  `);
  await new Promise(r => setTimeout(r, 2200));
  await shot(ws, idRef, '03_deck_builder.png');

  // 4. GameScene — DeckBuilder.confirmDeck would route through CityHub (when
  // tutorialSeen=true). Force a direct start so we capture the run scene.
  await evalJs(ws, idRef, `
    const db = globalThis.__game.scene.getScene('DeckBuilderScene');
    db.confirmDeck();
  `);
  await new Promise(r => setTimeout(r, 1500));
  // Force-start GameScene if we ended up on CityHub.
  await evalJs(ws, idRef, `
    const g = globalThis.__game;
    if (g.scene.isActive('CityHub')) {
      g.scene.stop('CityHub');
      g.scene.start('GameScene');
    }
  `);
  await waitForScene(ws, idRef, 'GameScene');
  await new Promise(r => setTimeout(r, 1800));
  await shot(ws, idRef, '04_game_scene.png');

  // 5. CombatScene
  await waitForScene(ws, idRef, 'CombatScene');
  await new Promise(r => setTimeout(r, 1200));
  await shot(ws, idRef, '05_combat.png');

  // 6. Force win → planning overlay opens
  await evalJs(ws, idRef, `
    for (let i = 0; i < 6; i++) { window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'})); await new Promise(r=>setTimeout(r,150)); }
    const cs = globalThis.__game.scene.getScene('CombatScene');
    if (cs?.engine) { cs.engine.getState().enemyHP = 0; cs.engine.checkEndConditions?.(); }
  `);
  await waitForScene(ws, idRef, 'PlanningOverlay');
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '06_planning.png');

  // 7. ForgeScene (open from planning)
  await evalJs(ws, idRef, `globalThis.__game.scene.getScene('PlanningOverlay').openSubScene('ForgeScene');`);
  await waitForScene(ws, idRef, 'ForgeScene');
  await new Promise(r => setTimeout(r, 1200));
  await shot(ws, idRef, '07_forge.png');

  // 7b. Forge with elements selected (give some, pick 2)
  await evalJs(ws, idRef, `
    const run = (await import('/src/state/RunState.ts')).getRun();
    run.economy.elements = run.economy.elements || {};
    run.economy.elements.attack = 3;
    run.economy.elements.fire = 3;
    const fs = globalThis.__game.scene.getScene('ForgeScene');
    fs.forgeSlots = ['attack', 'fire'];
    fs.renderForge();
  `);
  await new Promise(r => setTimeout(r, 800));
  await shot(ws, idRef, '07b_forge_with_elements.png');

  // Back to planning
  await evalJs(ws, idRef, `globalThis.__game.scene.getScene('ForgeScene').close();`);
  await new Promise(r => setTimeout(r, 1200));

  // 8. DeckCustomizationScene
  await evalJs(ws, idRef, `
    const po = globalThis.__game.scene.getScene('PlanningOverlay');
    po.scene.sleep();
    po.scene.launch('DeckCustomizationScene', { parentScene: 'PlanningOverlay' });
  `);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '08_deck_customization.png');

  // 9. RelicViewerScene
  await evalJs(ws, idRef, `
    globalThis.__game.scene.getScene('DeckCustomizationScene').close();
    await new Promise(r => setTimeout(r, 400));
    const po = globalThis.__game.scene.getScene('PlanningOverlay');
    po.scene.sleep();
    po.scene.launch('RelicViewerScene', { parentScene: 'PlanningOverlay' });
  `);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '09_relic_viewer.png');

  // 10. ShopScene (open from planning)
  await evalJs(ws, idRef, `
    const rv = globalThis.__game.scene.getScene('RelicViewerScene');
    if (rv) rv.scene.stop();
    const po = globalThis.__game.scene.getScene('PlanningOverlay');
    if (po && po.scene.isSleeping('PlanningOverlay')) po.scene.wake('PlanningOverlay');
    await new Promise(r => setTimeout(r, 400));
    const run = (await import('/src/state/RunState.ts')).getRun();
    run.economy.gold = 200; // give cash so shop has stuff visible
    po.openSubScene('ShopScene');
  `);
  await waitForScene(ws, idRef, 'ShopScene');
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '10_shop.png');

  // 11. PauseScene (launch from GameScene)
  await evalJs(ws, idRef, `
    // Close shop first
    const sh = globalThis.__game.scene.getScene('ShopScene');
    if (sh && sh.scene.isActive('ShopScene')) {
      // ShopScene exit varies; just stop it.
      sh.scene.stop();
      const po = globalThis.__game.scene.getScene('PlanningOverlay');
      if (po && po.scene.isSleeping('PlanningOverlay')) po.scene.wake('PlanningOverlay');
    }
    // Open Pause via GameScene
    const g = globalThis.__game;
    // Wake game scene first if needed
    if (g.scene.isPaused('GameScene')) g.scene.resume('GameScene');
    g.scene.launch('PauseScene');
  `);
  await new Promise(r => setTimeout(r, 1000));
  await shot(ws, idRef, '11_pause.png');

  // 12. SettingsScene
  await evalJs(ws, idRef, `globalThis.__game.scene.launch('SettingsScene');`);
  await new Promise(r => setTimeout(r, 1000));
  await shot(ws, idRef, '12_settings.png');

  // 13. TutorialScene (replay mode)
  await evalJs(ws, idRef, `
    const g = globalThis.__game;
    g.scene.stop('SettingsScene');
    g.scene.stop('PauseScene');
    g.scene.launch('TutorialScene', { replay: true });
  `);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '13_tutorial.png');

  // 14. CityHub (start scene)
  await evalJs(ws, idRef, `
    const g = globalThis.__game;
    for (const sc of g.scene.getScenes(true)) {
      if (!['GlobalSound','SpeedPanelScene'].includes(sc.scene.key)) g.scene.stop(sc.scene.key);
    }
    g.scene.start('CityHub');
  `);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '14_city_hub.png');

  // 15. CardLibrary (standalone)
  await evalJs(ws, idRef, `globalThis.__game.scene.start('CardLibraryScene');`);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '15_card_library.png');

  // 16. Collection
  await evalJs(ws, idRef, `globalThis.__game.scene.start('CollectionScene');`);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '16_collection.png');

  // 17. Building panel + Tavern panel + Death scene? Skip the ones that need run-end.
  // Building panel
  await evalJs(ws, idRef, `globalThis.__game.scene.start('BuildingPanelScene');`);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '17_building_panel.png');

  // 18. Tavern panel
  await evalJs(ws, idRef, `globalThis.__game.scene.start('TavernPanelScene');`);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '18_tavern_panel.png');

  // 19. Death scene
  await evalJs(ws, idRef, `globalThis.__game.scene.start('DeathScene', { enemyName: 'Demo Lizard', stats: { damageDealt: 100, cardsPlayed: 10, combosTriggered: 1, goldEarned: 50 }});`);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '19_death.png');

  ws.close();
  console.log('\n✓ Done. Shots in', SHOTS_DIR);
}

main().catch(e => { console.error(e); process.exit(1); });
