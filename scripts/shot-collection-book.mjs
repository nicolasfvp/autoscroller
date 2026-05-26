// One-off: drive the dev server with Playwright, jump straight to the
// CollectionScene + CardLibraryScene, screenshot each, and try a tab change
// + page flip on the Collection. The screenshots land in verify-shots/.

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5174/';
const OUT = path.resolve('verify-shots');

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
  });
  await page.goto(URL, { waitUntil: 'networkidle' });

  // Wait for Phaser game to expose globalThis.__game (the project's debug handle).
  await page.waitForFunction(() => {
    const g = globalThis.__game;
    return g && g.scene && g.scene.getScenes(true).length > 0;
  }, { timeout: 30000 });

  // Helper: jump to a scene by stopping every running scene first, then starting target.
  async function jumpTo(key, data = {}) {
    await page.evaluate(({ key, data }) => {
      const g = globalThis.__game;
      const sm = g.scene;
      sm.getScenes(true).forEach((s) => { sm.stop(s.scene.key); });
      sm.start(key, data);
    }, { key, data });
    await page.waitForTimeout(900);
  }

  async function shot(name) {
    const p = path.join(OUT, name);
    await page.screenshot({ path: p, fullPage: false });
    console.log('shot ->', p);
  }

  // 1) Collection — Cards tab
  await jumpTo('CollectionScene');
  await shot('collection-book.png');

  // 2) Click "Relics" tab — tabs are at y ~115, second of four tabs (Cards, Relics, Tiles, Bosses).
  //    Tab width 130, gap 6, centered around spine_x=400 (canvas coord, but page renders 1024x768
  //    via aspect-fit so canvas is centered/scaled). We compute the actual canvas screen location.
  const tabBox = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const r = canvas.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  // The phaser game is 800x600 canvas; it's been letterboxed into the page. Compute scale.
  const scaleX = tabBox.w / 800;
  const scaleY = tabBox.h / 600;
  // Relics tab center: spine 400 + offset. Tabs total = 4*130 + 3*6 = 538.
  // startX = 400 - 538/2 + 130/2 = 400 - 269 + 65 = 196 (center of first tab)
  // 2nd tab center: 196 + 130 + 6 = 332. y = 115.
  const relicsCx = tabBox.x + 332 * scaleX;
  const relicsCy = tabBox.y + 115 * scaleY;
  await page.mouse.click(relicsCx, relicsCy);
  await page.waitForTimeout(700);
  await shot('collection-book-relics.png');

  // Tiles tab (3rd)
  const tilesCx = tabBox.x + (332 + 136) * scaleX;
  await page.mouse.click(tilesCx, relicsCy);
  await page.waitForTimeout(700);
  await shot('collection-book-tiles.png');

  // Bosses tab (4th)
  const bossesCx = tabBox.x + (332 + 136 * 2) * scaleX;
  await page.mouse.click(bossesCx, relicsCy);
  await page.waitForTimeout(700);
  await shot('collection-book-bosses.png');

  // 3) Go back to Cards and click the next-page arrow on the right side.
  //    nextArrow center: x = SPINE_X + PAGE_GAP + PAGE_WIDTH - 36 = 400 + 6 + 335 - 36 = 705
  //    y = BOOK_BOTTOM - 22 = 558 - 22 = 536
  // Click Cards tab first
  const cardsCx = tabBox.x + 196 * scaleX;
  const cardsCy = tabBox.y + 115 * scaleY;
  await page.mouse.click(cardsCx, cardsCy);
  await page.waitForTimeout(600);
  // Then next arrow
  const nextCx = tabBox.x + 705 * scaleX;
  const nextCy = tabBox.y + 536 * scaleY;
  await page.mouse.click(nextCx, nextCy);
  // mid-flip — phase 1 (220ms collapsing) so ~100ms in we should see partial scale
  await page.waitForTimeout(100);
  await shot('collection-book-page2-midflip.png');
  await page.waitForTimeout(700);
  await shot('collection-book-page2.png');

  // 4) Card Library overlay — launch over MainMenu so it has a parent.
  await page.evaluate(() => {
    const g = globalThis.__game;
    const sm = g.scene;
    sm.getScenes(true).forEach((s) => { sm.stop(s.scene.key); });
    sm.start('MainMenu');
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const g = globalThis.__game;
    // scene manager is the per-scene plugin OR the global manager. Use the manager.
    const mainMenu = g.scene.getScene('MainMenu');
    mainMenu.scene.launch('CardLibraryScene', { parentKey: 'MainMenu' });
  });
  await page.waitForTimeout(1000);
  await shot('library-book.png');

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
