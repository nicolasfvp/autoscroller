#!/usr/bin/env node
/**
 * test-upscale.mjs
 * Compare Option 2 (sharp nearest-neighbor) vs Option 3 (waifu2x)
 * on a single test monster. Outputs to test-upscale/ folder.
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONSTER   = 'public/assets/characters/monsters/default/doom knight.png';
const OUT_DIR   = path.join(__dirname, 'test-upscale');
const TARGET    = 500;

fs.mkdirSync(OUT_DIR, { recursive: true });

const src = path.join(__dirname, MONSTER);
console.log(`\nTest image : ${MONSTER}`);
console.log(`Output dir : test-upscale/\n`);

// ── Option 2: sharp nearest-neighbor ─────────────────────────────
console.log('── Option 2: sharp nearest-neighbor ──');
try {
  const sharp = (await import('sharp')).default;
  const meta  = await sharp(src).metadata();
  console.log(`  Input: ${meta.width}×${meta.height}`);

  const buf = await sharp(src)
    .resize(TARGET, TARGET, {
      kernel:     'nearest',
      fit:        'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 8 })
    .toBuffer();

  const out2 = path.join(OUT_DIR, 'doom_knight_nearest.png');
  fs.writeFileSync(out2, buf);
  console.log(`  ✓ Saved ${(buf.length/1024).toFixed(0)} KB → ${out2}\n`);
} catch (e) {
  console.error(`  ✗ ${e.message}\n`);
}

// ── Option 3a: waifu2x-ncnn-vulkan ───────────────────────────────
console.log('── Option 3a: waifu2x (ncnn-vulkan) ──');
try {
  const m = await import('waifu2x');
  const Waifu2x = m.default?.default ?? m.default;
  const out3a = path.join(OUT_DIR, 'doom_knight_waifu2x.png');
  await Waifu2x.upscaleImage(src, out3a, {
    upscaler: 'waifu2x',
    scale: 8,            // 64×8 = 512 → will crop/fit to 500 after
    rename: '',
  });
  if (fs.existsSync(out3a)) {
    // Resize to 500×500 keeping exact pixels
    const sharp = (await import('sharp')).default;
    const buf = await sharp(out3a).resize(500, 500, { kernel: 'nearest', fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } }).png().toBuffer();
    fs.writeFileSync(out3a, buf);
    console.log(`  ✓ Saved ${(buf.length/1024).toFixed(0)} KB → ${out3a}\n`);
  } else {
    console.log('  ✗ Output file not created\n');
  }
} catch (e) {
  console.error(`  ✗ ${e.message}\n`);
}

// ── Option 3b: real-esrgan ────────────────────────────────────────
console.log('── Option 3b: real-esrgan ──');
try {
  const m = await import('waifu2x');
  const Waifu2x = m.default?.default ?? m.default;
  const out3b = path.join(OUT_DIR, 'doom_knight_esrgan.png');
  await Waifu2x.upscaleImage(src, out3b, {
    upscaler: 'real-esrgan',
    scale: 8,
    rename: '',
  });
  if (fs.existsSync(out3b)) {
    const sharp = (await import('sharp')).default;
    const buf = await sharp(out3b).resize(500, 500, { kernel: 'nearest', fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } }).png().toBuffer();
    fs.writeFileSync(out3b, buf);
    console.log(`  ✓ Saved ${(buf.length/1024).toFixed(0)} KB → ${out3b}\n`);
  } else {
    console.log('  ✗ Output file not created\n');
  }
} catch (e) {
  console.error(`  ✗ ${e.message}\n`);
}

console.log('Done. Open test-upscale/ to compare both outputs.');
