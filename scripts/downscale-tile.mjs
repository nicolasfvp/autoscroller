#!/usr/bin/env node
import sharp from 'sharp';
import path from 'node:path';

const [, , inputPath, sizeArg] = process.argv;
if (!inputPath) {
  console.error('Usage: node scripts/downscale-tile.mjs <inputPath> [size=256]');
  process.exit(1);
}
const size = Number(sizeArg) || 256;
const { dir, name } = path.parse(inputPath);
const cleanName = name.replace(/_raw$/, '');
const outPath = path.join(dir, `${cleanName}_${size}.png`);

await sharp(inputPath, { unlimited: true })
  .resize(size, size, { kernel: sharp.kernel.nearest })
  .png({ compressionLevel: 9 })
  .toFile(outPath);
console.log(`Saved ${size}x${size} -> ${outPath}`);
