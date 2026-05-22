#!/usr/bin/env node
/**
 * upscale-monsters.mjs
 * Upscales all monster sprites 64×64 → 500×500 using waifu2x-ncnn-vulkan.
 * Skips files that are already ≥ 500px.
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require  = createRequire(import.meta.url);
const Waifu2x  = require('waifu2x').default;
const sharp    = (await import('sharp')).default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, 'public/assets/characters/monsters');
const TARGET    = 500;
const SCALE     = 8; // 64 × 8 = 512, then trim to 500

const MONSTERS = [
  'cemetery/corpse eater.png',
  'cemetery/headless fire horse.png',
  'cemetery/pocket cat.png',
  'default/doom knight.png',
  'default/iron golem.png',
  'default/lizard king.png',
  'desert/baby dragon.png',
  'desert/giant beetle.png',
  'desert/mutated salamander.png',
  'forest/ancient tree.png',
  'forest/giant spider 2.png',
  'forest/giant spider.png',
  'forest/mush.png',
  'lava/forge slime.png',
  'lava/lava golen.png',
  'lava/mecha warrior.png',
  'swamp/depths horror.png',
  'swamp/toxic gooze.png',
  'swamp/venomous kobra.png',
  'boss_demon.png',
  'boss_berserker.png',
  'boss_mage.png',
  'boss_hydra.png',
];

function alreadyDone(p) {
  if (!fs.existsSync(p)) return false;
  try {
    const buf = fs.readFileSync(p);
    return buf.readUInt32BE(16) >= TARGET && buf.readUInt32BE(20) >= TARGET;
  } catch { return false; }
}

const pending = MONSTERS.filter(m => !alreadyDone(path.join(OUT_DIR, m)));
const skipped = MONSTERS.length - pending.length;

console.log('\n╔══════════════════════════════════════╗');
console.log('║   Monster Upscaler — waifu2x ×8      ║');
console.log('╚══════════════════════════════════════╝');
console.log(`  Total: ${MONSTERS.length}  |  To do: ${pending.length}  |  Skipped: ${skipped}\n`);

if (pending.length === 0) { console.log('✅  All done!\n'); process.exit(0); }

let done = 0, failed = 0;

for (let i = 0; i < pending.length; i++) {
  const rel  = pending[i];
  const dest = path.join(OUT_DIR, rel);
  const tmp  = dest + '.tmp.png';
  const label = `[${String(i+1).padStart(2)}/${pending.length}] ${path.basename(rel, '.png').padEnd(24)}`;
  process.stdout.write(label);

  try {
    await Waifu2x.upscaleImage(dest, tmp, { upscaler: 'waifu2x', scale: SCALE, rename: '' });

    const outPath = tmp.replace('.tmp.png.tmp.png', '.tmp.png'); // guard double-ext
    const srcForSharp = fs.existsSync(tmp) ? tmp : dest;

    const buf = await sharp(srcForSharp)
      .resize(TARGET, TARGET, {
        kernel:     'nearest',
        fit:        'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 8 })
      .toBuffer();

    fs.writeFileSync(dest, buf);
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);

    done++;
    console.log(`✓  ${(buf.length / 1024).toFixed(0)} KB`);
  } catch (err) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    failed++;
    console.log(`✗  ${err.message.slice(0, 80)}`);
  }
}

console.log('\n──────────────────────────────────────────');
console.log(`  ✅ ${done}  ✗ ${failed}  ⏭ ${skipped}\n`);
