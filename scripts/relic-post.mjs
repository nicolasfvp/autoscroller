#!/usr/bin/env node
// Post-process relic PNGs:
//  1. Key out the off-white background to transparent (preserves colored glow halos).
//  2. Find the bounding box of remaining opaque pixels.
//  3. Crop with a small padding and resize so the relic fills a 1024x1024 square.
//
// Tunables via env: WHITE_RAMP, CHROMA_RAMP, MIN_ALPHA_FOR_BBOX, PAD_PCT, OUT_SIZE.
//
// Usage:
//   node scripts/relic-post.mjs <file1.png> [file2.png ...]
//   node scripts/relic-post.mjs --all     # process every PNG in public/assets/relics

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Background paper is cream (~RGB 238-245), not pure white — floor + ramp.
const WHITE_FLOOR = Number(process.env.WHITE_FLOOR || 30);    // pixels within this distance of pure white → fully transparent
const WHITE_RAMP = Number(process.env.WHITE_RAMP || 35);      // distance over which alpha ramps from 0 to 255
const CHROMA_FLOOR = Number(process.env.CHROMA_FLOOR || 10);  // chroma below this is treated as grey/cream → transparent
const CHROMA_RAMP = Number(process.env.CHROMA_RAMP || 30);    // saturation ramp — keeps colored glow opaque
const MIN_ALPHA_FOR_BBOX = Number(process.env.MIN_ALPHA_FOR_BBOX || 32); // pixels at or below this alpha don't count for bbox
const PAD_PCT = Number(process.env.PAD_PCT || 0.04);          // padding around bbox, as fraction of bbox max-side
const OUT_SIZE = Number(process.env.OUT_SIZE || 1024);

async function keyOutWhite(inputPath) {
  const src = sharp(inputPath).ensureAlpha();
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) throw new Error(`expected RGBA, got ${channels}`);

  const out = Buffer.alloc(data.length);
  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], origA = data[i + 3];
      const minC = Math.min(r, g, b);
      const maxC = Math.max(r, g, b);
      const whiteDist = 255 - minC;        // 0 = pure white, 255 = black
      const chroma = maxC - minC;          // 0 = grey, high = saturated
      // alpha is the *more confident* of "not white" and "is colored"
      const aWhite = Math.max(0, Math.min(1, (whiteDist - WHITE_FLOOR) / WHITE_RAMP));
      const aChroma = Math.max(0, Math.min(1, (chroma - CHROMA_FLOOR) / CHROMA_RAMP));
      const a = Math.round(Math.min(origA, Math.max(aWhite, aChroma) * 255));

      out[i]     = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = a;

      if (a > MIN_ALPHA_FOR_BBOX) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    // Empty bbox — bail and return source as-is to avoid destroying the asset.
    return { buffer: out, width, height, bbox: null };
  }
  return { buffer: out, width, height, bbox: { minX, minY, maxX, maxY } };
}

async function processFile(file) {
  const { buffer, width, height, bbox } = await keyOutWhite(file);
  // Write the keyed RGBA back to a sharp pipeline.
  let img = sharp(buffer, { raw: { width, height, channels: 4 } });

  if (bbox) {
    const bboxW = bbox.maxX - bbox.minX + 1;
    const bboxH = bbox.maxY - bbox.minY + 1;
    const pad = Math.round(Math.max(bboxW, bboxH) * PAD_PCT);
    let left = Math.max(0, bbox.minX - pad);
    let top = Math.max(0, bbox.minY - pad);
    let right = Math.min(width - 1, bbox.maxX + pad);
    let bottom = Math.min(height - 1, bbox.maxY + pad);
    let cropW = right - left + 1;
    let cropH = bottom - top + 1;

    // Make crop square by centering it on the bbox center within the source bounds.
    const side = Math.max(cropW, cropH);
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    let sLeft = Math.round(cx - side / 2);
    let sTop = Math.round(cy - side / 2);
    // Clamp inside source.
    if (sLeft < 0) sLeft = 0;
    if (sTop < 0) sTop = 0;
    if (sLeft + side > width) sLeft = width - side;
    if (sTop + side > height) sTop = height - side;
    const finalSide = Math.min(side, width - sLeft, height - sTop);

    img = img.extract({ left: sLeft, top: sTop, width: finalSide, height: finalSide });
  }

  img = img.resize(OUT_SIZE, OUT_SIZE, { kernel: 'lanczos3' });

  const tmp = file + '.tmp.png';
  await img.png({ compressionLevel: 9 }).toFile(tmp);
  fs.renameSync(tmp, file);
}

async function main() {
  let files = process.argv.slice(2);
  if (files[0] === '--all') {
    const dir = 'public/assets/relics';
    files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).map(f => path.join(dir, f));
  }
  if (files.length === 0) {
    console.error('Usage: relic-post.mjs <file.png ...>  OR  relic-post.mjs --all');
    process.exit(1);
  }

  const conc = Number(process.env.CONCURRENCY || 6);
  let idx = 0, done = 0, failed = 0;
  const errors = [];

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= files.length) return;
      const f = files[i];
      try {
        await processFile(f);
        done++;
        console.log(`OK ${done + failed}/${files.length} ${path.basename(f)}`);
      } catch (e) {
        failed++;
        errors.push({ file: f, error: e.message });
        console.error(`FAIL ${path.basename(f)}: ${e.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: conc }, worker));
  console.log(`\n${done} ok, ${failed} failed.`);
  if (errors.length) console.log(errors);
}

main().catch(err => { console.error(err); process.exit(1); });
