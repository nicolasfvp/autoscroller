// Measure the rack image: find (a) the wood-content bounding box (chop the
// pure black + dark stone surround) and (b) the centres of the 8 niches.
//
// Approach:
//   1. Sample brightness across rows/cols. The pure-black border has near-zero
//      brightness. The wooden rack has medium-to-high brightness.
//   2. Within the bounded wood region, scan vertically and horizontally along
//      central lines to find the dark pockets (niches) — they are clearly
//      darker than the surrounding wood+iron frame.

import sharp from 'sharp';

const SRC = 'public/assets/buildings/backgrounds/forge-inventory-rack-v2.jpeg';

const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

function pixel(x, y) {
  const i = (y * W + x) * C;
  return { r: data[i], g: data[i+1], b: data[i+2] };
}
function lum(x, y) {
  const p = pixel(x, y);
  return 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
}

// 1) Find wood bounding box: scan inward from edges until brightness > 30.
function findEdge(direction) {
  if (direction === 'top') {
    for (let y = 0; y < H; y++) {
      let max = 0;
      for (let x = 0; x < W; x += 8) max = Math.max(max, lum(x, y));
      if (max > 25) return y;
    }
  }
  if (direction === 'bottom') {
    for (let y = H - 1; y >= 0; y--) {
      let max = 0;
      for (let x = 0; x < W; x += 8) max = Math.max(max, lum(x, y));
      if (max > 25) return y;
    }
  }
  if (direction === 'left') {
    for (let x = 0; x < W; x++) {
      let max = 0;
      for (let y = 0; y < H; y += 8) max = Math.max(max, lum(x, y));
      if (max > 25) return x;
    }
  }
  if (direction === 'right') {
    for (let x = W - 1; x >= 0; x--) {
      let max = 0;
      for (let y = 0; y < H; y += 8) max = Math.max(max, lum(x, y));
      if (max > 25) return x;
    }
  }
}

const top = findEdge('top');
const bottom = findEdge('bottom');
const left = findEdge('left');
const right = findEdge('right');
console.log(`Source: ${W}x${H}`);
console.log(`Wood bbox (loose): top=${top} bottom=${bottom} left=${left} right=${right}`);
console.log(`Wood size: ${right - left + 1} x ${bottom - top + 1}`);

// 2) Find niche centres. Niches are dark pockets surrounded by brighter iron
//    framework. Scan along x at fixed y values picked across the wood; find
//    runs of "dark" pixels to identify each niche's horizontal extent.
//    Then scan along y similarly to find row extents.

const wL = left, wR = right, wT = top, wB = bottom;
const wW = wR - wL + 1;
const wH = wB - wT + 1;

// Vertical scan at horizontal midpoint of each column to find row centres.
function findDarkRuns(getLum, len, threshold = 70, minRun = 30) {
  const dark = new Array(len);
  for (let i = 0; i < len; i++) dark[i] = getLum(i) < threshold;
  const runs = [];
  let runStart = -1;
  for (let i = 0; i < len; i++) {
    if (dark[i]) {
      if (runStart < 0) runStart = i;
    } else {
      if (runStart >= 0 && i - runStart >= minRun) {
        runs.push({ start: runStart, end: i - 1, center: (runStart + i - 1) / 2 });
      }
      runStart = -1;
    }
  }
  if (runStart >= 0 && len - runStart >= minRun) {
    runs.push({ start: runStart, end: len - 1, center: (runStart + len - 1) / 2 });
  }
  return runs;
}

// Sample several y values to find columns; then for each column, scan y to find rows.
// Pick a y near each suspected row, but first find rows by scanning a vertical
// line at midpoint of the rack.

// Step A: Scan vertical line at x = (wL + wR)/2 to find dark intervals → rows.
const xMid = Math.floor((wL + wR) / 2);
// Actually the centre line might run between the two columns of niches (a
// frame bar). Use a column-centred x.

// Try several xs.
for (const xTest of [
  Math.floor(wL + wW * 0.25),
  Math.floor(wL + wW * 0.50),
  Math.floor(wL + wW * 0.75),
]) {
  const runs = findDarkRuns((y) => lum(xTest, y + wT), wH, 70, 40);
  console.log(`Vertical scan at x=${xTest}: ${runs.length} dark runs`);
  for (const r of runs) console.log(`  y=${r.start + wT}..${r.end + wT}  centre=${(r.center + wT).toFixed(0)}  pct(of wood)=${((r.center) / wH).toFixed(3)}`);
}

// Step B: Horizontal scan at chosen y values to find col centres.
for (const yTest of [
  Math.floor(wT + wH * 0.16),
  Math.floor(wT + wH * 0.40),
  Math.floor(wT + wH * 0.62),
  Math.floor(wT + wH * 0.85),
]) {
  const runs = findDarkRuns((x) => lum(x + wL, yTest), wW, 70, 40);
  console.log(`Horizontal scan at y=${yTest}: ${runs.length} dark runs`);
  for (const r of runs) console.log(`  x=${r.start + wL}..${r.end + wL}  centre=${(r.center + wL).toFixed(0)}  pct(of wood)=${((r.center) / wW).toFixed(3)}`);
}
