// Measures startup: time until the MainMenu is interactive, and how many
// /assets/ requests fire BEFORE that moment (the blocking set). Proves the
// tiered-loading split: the menu should paint after ~a dozen assets, not ~750.
import { chromium } from 'playwright';

const URL = process.env.PROBE_URL ?? 'http://localhost:5191/';

function launch() {
  // Prefer system Chrome/Edge so we don't need Playwright's bundled browser.
  for (const channel of ['chrome', 'msedge']) {
    try { return chromium.launch({ channel, headless: true }); } catch {}
  }
  return chromium.launch({ headless: true });
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const assetReqs = [];
let menuReadyAt = null;
const t0 = Date.now();
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('/assets/')) {
    assetReqs.push({ t: Date.now() - t0, url: u.split('/assets/')[1], beforeMenu: menuReadyAt === null });
  }
});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });

// Poll for "menu interactive": MainMenu scene active AND its button texture present.
const deadline = Date.now() + 60000;
while (Date.now() < deadline) {
  const ready = await page.evaluate(() => {
    const g = globalThis.__game;
    if (!g || !g.scene) return false;
    const active = g.scene.isActive('MainMenu');
    const hasBtn = g.textures && (g.textures.exists('btn_new_game') || g.textures.exists('btn_continue_run'));
    return active && hasBtn;
  }).catch(() => false);
  if (ready) { menuReadyAt = Date.now() - t0; break; }
  await page.waitForTimeout(50);
}

const beforeMenu = assetReqs.filter(a => a.beforeMenu);
// Give the background warmer a moment to prove it streams the rest.
await page.waitForTimeout(4000);
const after4s = assetReqs.length;

console.log('=== STARTUP PROBE ===');
console.log('menu interactive at:', menuReadyAt === null ? 'TIMEOUT (>60s)' : `${menuReadyAt} ms`);
console.log('asset requests BEFORE menu interactive:', beforeMenu.length);
console.log('  ->', beforeMenu.map(a => a.url).sort().join(', '));
console.log(`asset requests total after +4s warm: ${after4s} (warmer streaming the deferred library)`);
console.log('page/console errors:', errors.length ? errors.slice(0, 8) : 'none');

await browser.close();
