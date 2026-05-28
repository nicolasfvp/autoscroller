#!/usr/bin/env node
// Convert pure-black pixels to alpha-transparent for Grok-generated assets
// that came back with a pitch-black mat around their visible content.
//
// SCREEN blend mode (forge sigil trick) works but tints the visible art
// brighter — which the shop redesign exposed as "faded". This script bakes
// the transparency into the PNG itself so the scene can draw the asset with
// the default blend mode (NORMAL) at its true colors.
//
// Usage:
//   node scripts/black-to-alpha.mjs <in.png> [out.png]
//   node scripts/black-to-alpha.mjs file1.png file2.png ...   # in-place
//
// Threshold: pixels with max(R,G,B) <= LOW are fully transparent;
// pixels with max(R,G,B) >= HIGH are fully opaque; in between the alpha
// ramps linearly. This gives a soft edge so the visible art doesn't get
// a hard halo against the new bg.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const LOW = 8;    // below this brightness → fully transparent
const HIGH = 32;  // above this brightness → fully opaque

async function blackToAlpha(input, output) {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) throw new Error(`expected RGBA, got ${channels} channels`);
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const brightness = Math.max(r, g, b);
    let a;
    if (brightness <= LOW) a = 0;
    else if (brightness >= HIGH) a = 255;
    else a = Math.round(((brightness - LOW) / (HIGH - LOW)) * 255);
    out[i]     = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = Math.min(a, data[i + 3]); // never increase existing alpha
  }
  await sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(output);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: black-to-alpha.mjs <file1.png> [file2.png ...]');
  process.exit(1);
}

for (const file of args) {
  const tmp = file + '.tmp';
  try {
    await blackToAlpha(file, tmp);
    fs.renameSync(tmp, file);
    console.log(`OK ${path.basename(file)}`);
  } catch (e) {
    console.error(`FAIL ${file}: ${e.message}`);
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
