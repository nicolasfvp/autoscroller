// Like audit-scenes.mjs but captures each scene in isolation — stops all
// non-system scenes, starts the target, screenshots. For scenes that need
// active RunState, we seed a minimal run first.

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
  await new Promise(r => setTimeout(r, 700));
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
  // Set up a minimal RunState so scenes that depend on it don't crash.
  const rsMod = await import('/src/state/RunState.ts');
  const mpMod = await import('/src/systems/MetaPersistence.ts');
  const meta = await mpMod.loadMetaState();
  const run = rsMod.createNewRun(meta, 1, 'warrior');
  // Add some resources so the shop / forge show interesting content.
  run.economy.gold = 200;
  run.economy.tilePoints = 12;
  run.economy.elements = { attack: 3, fire: 3, water: 2, agility: 4 };
  rsMod.setRun(run);
`;

async function go(ws, idRef, sceneKey, opts = {}) {
  const { seedRun = false, launchData = null, postEval = null } = opts;
  await evalJs(ws, idRef, `
    const g = globalThis.__game;
    for (const sc of g.scene.getScenes(true)) {
      if (!['GlobalSound','SpeedPanelScene'].includes(sc.scene.key)) g.scene.stop(sc.scene.key);
    }
    ${seedRun ? SEED_RUN : ''}
    g.scene.start(${JSON.stringify(sceneKey)}${launchData ? ', ' + JSON.stringify(launchData) : ''});
    ${postEval ?? ''}
  `);
  await new Promise(r => setTimeout(r, 1500));
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

  // 1. MainMenu
  await go(ws, idRef, 'MainMenu');
  await shot(ws, idRef, '01_main_menu.png');

  // 2. CharacterSelect
  await go(ws, idRef, 'CharacterSelectScene');
  await shot(ws, idRef, '02_character_select.png');

  // 3. CityHub
  await go(ws, idRef, 'CityHub', { seedRun: true });
  await shot(ws, idRef, '03_city_hub.png');

  // 4. Building Panel
  await go(ws, idRef, 'BuildingPanelScene', { seedRun: true });
  await shot(ws, idRef, '04_building_panel.png');

  // 5. Tavern Panel
  await go(ws, idRef, 'TavernPanelScene', { seedRun: true });
  await shot(ws, idRef, '05_tavern_panel.png');

  // 6. Card Library
  await go(ws, idRef, 'CardLibraryScene', { seedRun: true });
  await shot(ws, idRef, '06_card_library.png');

  // 7. Collection
  await go(ws, idRef, 'CollectionScene', { seedRun: true });
  await shot(ws, idRef, '07_collection.png');

  // 8. Forge — empty
  await go(ws, idRef, 'ForgeScene', { seedRun: true, launchData: { parentScene: 'MainMenu' } });
  await shot(ws, idRef, '08_forge_empty.png');

  // 9. Forge — with selected elements
  await evalJs(ws, idRef, `
    const fs = globalThis.__game.scene.getScene('ForgeScene');
    fs.forgeSlots = ['attack', 'fire'];
    fs.renderForge();
  `);
  await new Promise(r => setTimeout(r, 600));
  await shot(ws, idRef, '09_forge_with_recipe.png');

  // 10. Shop
  await go(ws, idRef, 'ShopScene', { seedRun: true, launchData: { parentScene: 'MainMenu' } });
  await shot(ws, idRef, '10_shop.png');

  // 11. Settings
  await go(ws, idRef, 'SettingsScene', { seedRun: true });
  await shot(ws, idRef, '11_settings.png');

  // 12. Pause (needs GameScene parent)
  await evalJs(ws, idRef, `
    const g = globalThis.__game;
    for (const sc of g.scene.getScenes(true)) {
      if (!['GlobalSound','SpeedPanelScene'].includes(sc.scene.key)) g.scene.stop(sc.scene.key);
    }
    ${SEED_RUN}
    g.scene.start('GameScene');
  `);
  await new Promise(r => setTimeout(r, 1500));
  await evalJs(ws, idRef, `globalThis.__game.scene.launch('PauseScene');`);
  await new Promise(r => setTimeout(r, 1000));
  await shot(ws, idRef, '12_pause.png');

  // 13. Tutorial (replay mode)
  await go(ws, idRef, 'TutorialScene', { launchData: { replay: true } });
  await shot(ws, idRef, '13_tutorial.png');

  // 14. Relic Viewer (empty)
  await go(ws, idRef, 'RelicViewerScene', { seedRun: true });
  await shot(ws, idRef, '14_relic_viewer_empty.png');

  // 15. Relic Viewer (with relics)
  await evalJs(ws, idRef, `
    const g = globalThis.__game;
    const run = (await import('/src/state/RunState.ts')).getRun();
    run.relics = ['heartstone', 'warhorn', 'phoenix-feather'];
    g.scene.stop('RelicViewerScene');
    g.scene.start('RelicViewerScene', { parentScene: 'MainMenu' });
  `);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '15_relic_viewer_full.png');

  // 16. Death scene
  await go(ws, idRef, 'DeathScene', { seedRun: true, launchData: { enemyName: 'Demo Lizard', stats: { damageDealt: 120, cardsPlayed: 8, combosTriggered: 2, goldEarned: 40 } } });
  await shot(ws, idRef, '16_death.png');

  // 17. Boss Exit
  await go(ws, idRef, 'BossExitScene', { seedRun: true });
  await shot(ws, idRef, '17_boss_exit.png');

  // 18. Deck Customization
  await go(ws, idRef, 'DeckCustomizationScene', { seedRun: true, launchData: { parentScene: 'MainMenu' } });
  await shot(ws, idRef, '18_deck_customization.png');

  // 19. Starting Deck (template picker)
  await evalJs(ws, idRef, `
    const g = globalThis.__game;
    for (const sc of g.scene.getScenes(true)) {
      if (!['GlobalSound','SpeedPanelScene'].includes(sc.scene.key)) g.scene.stop(sc.scene.key);
    }
    ${SEED_RUN}
    g.scene.start('StartingDeckScene', { className: 'warrior', onConfirm: () => {}, onCancel: () => {} });
  `);
  await new Promise(r => setTimeout(r, 1500));
  await shot(ws, idRef, '19_starting_deck.png');

  ws.close();
  console.log('\n✓ Done. Shots in', SHOTS_DIR);
}

main().catch(e => { console.error(e); process.exit(1); });
