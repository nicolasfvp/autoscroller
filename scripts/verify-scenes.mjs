// Drives multiple scenes and screenshots each to verify responsive scaling
// works across the game. Connects to headless Chrome on CDP port 9224.

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

const VIEWPORT = { width: 1920, height: 1080 };

// Scene-specific drivers — each returns a JS snippet to evaluate after page is ready.
// The script stops all scenes and starts the target scene with appropriate data.
const scenes = [
  { name: 'MainMenu', start: `g.scene.start('MainMenu');` },
  { name: 'CharacterSelectScene', start: `g.scene.start('CharacterSelectScene');` },
  { name: 'CardLibraryScene', start: `g.scene.start('CardLibraryScene');` },
  { name: 'CityHubScene', start: `g.scene.start('CityHubScene');` },
  { name: 'SettingsScene', start: `g.scene.start('SettingsScene');` },
];

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
  await rpc(ws, ++id, 'Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false,
  });
  await rpc(ws, ++id, 'Page.navigate', { url: APP_URL });

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const r = await rpc(ws, ++id, 'Runtime.evaluate', {
        expression: 'typeof globalThis.__game !== "undefined" && globalThis.__game.scene && globalThis.__game.scene.getScenes(true).length > 0',
        returnByValue: true,
      });
      if (r.result.value === true) { ready = true; break; }
    } catch (e) {}
  }
  if (!ready) throw new Error('Phaser never ready');

  await fs.mkdir(SHOTS_DIR, { recursive: true });
  await new Promise(r => setTimeout(r, 2000));

  for (const s of scenes) {
    // Stop all non-system scenes, then start target
    await rpc(ws, ++id, 'Runtime.evaluate', {
      expression: `
        (() => {
          const g = globalThis.__game;
          for (const sc of g.scene.getScenes(true)) {
            if (sc.scene.key !== 'GlobalSound') g.scene.stop(sc.scene.key);
          }
          ${s.start}
          return 'started ' + ${JSON.stringify(s.name)};
        })()
      `,
      returnByValue: true,
    });

    await new Promise(r => setTimeout(r, 2500));
    const shot = await rpc(ws, ++id, 'Page.captureScreenshot', { format: 'png' });
    const out = path.join(SHOTS_DIR, `responsive_scene_${s.name}.png`);
    await fs.writeFile(out, Buffer.from(shot.data, 'base64'));
    const stat = await fs.stat(out);
    console.log(`Wrote ${out} (${stat.size} bytes)`);
  }

  // Final: check for any console errors
  const errs = await rpc(ws, ++id, 'Runtime.evaluate', {
    expression: `JSON.stringify((globalThis.__phaserErrors || []))`,
    returnByValue: true,
  });
  console.log('Phaser errors:', errs.result.value);

  ws.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
