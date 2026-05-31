// Visual audit harness — drives the live Vite dev build via Playwright and
// captures screenshots of every major scene. Uses the __game automation hook
// (main.ts) plus dynamic import() of the real source modules to build a run.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL = process.env.GAME_URL || 'http://localhost:5180/';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'audit-shots');
mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log('[visual-audit]', ...a);

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  ],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });

let consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.mouse.click(800, 600); // unlock WebAudio so the Preloader can finish

// Wait for the full asset preload to finish + MainMenu active (first uncached
// serve of ~500 assets via the dev server takes ~25-30s).
await page.waitForFunction(() => {
  const g = globalThis.__game;
  if (!g || !g.scene || !g.scene.isBooted) return false;
  const pre = g.scene.getScene('Preloader');
  const done = pre && pre.load && pre.load.progress >= 1;
  return done && g.scene.getScenes(true).some(s => s.scene.key === 'MainMenu');
}, { timeout: 90000 });
await page.waitForTimeout(1800); // fade-in + theme

const results = [];
async function cap(name, note = '') {
  await page.waitForTimeout(700);
  const file = join(OUT, `${String(results.length).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  // Clear any in-progress camera fade/flash so we don't screenshot a black
  // overlay, then dump active scenes + visible text for diagnostics.
  const diag = await page.evaluate(() => {
    const g = globalThis.__game;
    g.scene.getScenes(true).forEach(s => { try { s.cameras && s.cameras.main && s.cameras.main.resetFX(); } catch {} });
    const active = g.scene.getScenes(true).map(s => s.scene.key);
    const texts = [];
    g.scene.getScenes(true).forEach(s => {
      const walk = (list) => list.forEach(o => {
        if (o.type === 'Text' && o.text && o.visible) texts.push(o.text.replace(/\n/g, ' / ').slice(0, 60));
        if (o.list) walk(o.list);
      });
      if (s.children) walk(s.children.list);
    });
    return { active, texts: texts.slice(0, 40) };
  });
  const errs = consoleErrors.slice(); consoleErrors = [];
  results.push({ name, note, file, active: diag.active, errors: errs, sampleTexts: diag.texts });
  log(`captured ${name} | active=[${diag.active}] | errs=${errs.length}`);
}

// 0. Main menu (natural)
await cap('main-menu');

// Setup: skip tutorial, create a warrior run, enrich the deck with a few
// status-applying cards so combat shows burn/bleed chips + stat bars.
// NOTE: do NOT dynamic-import *.json (Vite serves it as application/json,
// which the browser rejects as a module script). Build state via createNewRun.
const setup = await page.evaluate(async () => {
  try {
    const RunState = await import('/src/state/RunState.ts');
    const Meta = await import('/src/systems/MetaPersistence.ts');
    const meta = await Meta.loadMetaState();
    meta.tutorialSeen = true;
    await Meta.saveMetaState(meta);
    const run = RunState.createNewRun(meta, 1, 'warrior');
    // Known-valid element card ids that apply visible statuses (burn/bleed).
    const extra = ['t1-fire', 't1-counter', 't2-attack-fire'];
    run.deck.active = [...run.deck.active, ...extra];
    run.deck.upgraded = new Array(run.deck.active.length).fill(false);
    run.loop.count = 3;
    RunState.setRun(run);
    return { ok: true, deckSize: run.deck.active.length, className: run.hero.className };
  } catch (e) { return { ok: false, err: String(e && e.stack || e) }; }
});
log('setup => ' + JSON.stringify(setup).slice(0, 300));

function stopAndStart(key, data) {
  return page.evaluate(({ key, data }) => {
    const g = globalThis.__game;
    g.scene.getScenes(true).forEach(s => { if (s.scene.key !== 'GlobalSound' && s.scene.key !== key) g.scene.stop(s.scene.key); });
    g.scene.start(key, data);
  }, { key, data });
}

const enemyId = 'lost_lizard';
const bossId = 'doom_knight';

// Scene captures. Each: [label, sceneKey, data]
const scenes = [
  ['character-select', 'CharacterSelectScene', undefined],
  ['game-overworld', 'GameScene', undefined],
  ['combat-normal', 'CombatScene', { enemyId, terrain: 'forest', isBoss: false }],
  ['combat-boss', 'CombatScene', { enemyId: bossId, terrain: 'forest', isBoss: true }],
  ['shop', 'ShopScene', { parentScene: 'GameScene' }],
  ['forge', 'ForgeScene', { parentScene: 'CityHub' }],
  ['city-hub', 'CityHub', undefined],
  ['deck-customization', 'DeckCustomizationScene', { parentScene: 'GameScene' }],
  ['card-library', 'CardLibraryScene', { parentScene: 'MainMenu' }],
  ['collection', 'CollectionScene', { parentScene: 'CityHub' }],
  ['relic-viewer', 'RelicViewerScene', { parentScene: 'GameScene' }],
  ['settings', 'SettingsScene', { parentScene: 'MainMenu' }],
];

for (const [label, key, data] of scenes) {
  try {
    await stopAndStart(key, data);
    // Combat needs extra time for a few cards to resolve so status chips + the
    // hero/enemy sprites + floating numbers are visible; overworld needs the
    // hero to start walking the loop.
    await page.waitForTimeout(label.startsWith('combat') ? 3200 : label === 'game-overworld' ? 2200 : 1500);
    await cap(label, `${key}`);
  } catch (e) {
    log(`FAILED ${label}: ${e}`);
    results.push({ name: label, note: key, error: String(e) });
  }
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify(results, null, 2));
log('DONE. wrote ' + results.length + ' captures to ' + OUT);
await browser.close();
