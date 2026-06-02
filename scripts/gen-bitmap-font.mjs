/**
 * Gera atlas de bitmap font (PNG + XML .fnt) compatível com Phaser load.bitmapFont.
 * O atlas é branco sobre fundo transparente — o Phaser aplica tint para gold/blue/white.
 * Usage: node scripts/gen-bitmap-font.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from 'canvas';
import opentype from 'opentype.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const TTF_PATH  = join(ROOT, 'public/assets/fonts/CrimsonText-Bold.ttf');
const FONT_SIZE = 64;
const PADDING   = 6;
const ATLAS_W   = 1024;
const ATLAS_H   = 1024;

const CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz' +
  '0123456789' +
  ' .,!?:;\'"()-+/←♦✦★×%#&_<>=';

// ── Carrega fonte ─────────────────────────────────────────────────────────────
const fontBuffer = readFileSync(TTF_PATH);
const font = opentype.parse(fontBuffer.buffer);
const scale = FONT_SIZE / font.unitsPerEm;
const ascender  = Math.round(font.ascender  * scale);
const descender = Math.round(Math.abs(font.descender) * scale);
const lineHeight = ascender + descender;
const base = ascender;

// ── Mede cada glifo ───────────────────────────────────────────────────────────
const glyphs = [];
for (const ch of new Set(CHARSET)) {
  const code = ch.codePointAt(0);
  const g = font.charToGlyph(ch);
  if (g.index === 0 && ch !== ' ') continue; // glifo ausente na fonte

  const adv = Math.round(g.advanceWidth * scale);

  if (ch === ' ') {
    glyphs.push({ ch, code, g, adv, gw: 0, gh: 0, x1: 0, y1: 0, y2: 0 });
    continue;
  }

  const bb = g.getBoundingBox();
  const x1 = Math.floor(bb.x1 * scale);
  const y1 = Math.floor(bb.y1 * scale);
  const y2 = Math.ceil(bb.y2  * scale);
  const x2 = Math.ceil(bb.x2  * scale);
  const gw = Math.max(1, x2 - x1);
  const gh = Math.max(1, y2 - y1);

  glyphs.push({ ch, code, g, adv, gw, gh, x1, y1, y2 });
}

// ── Empacota em linhas ────────────────────────────────────────────────────────
let cx = PADDING, cy = PADDING, rowH = 0;
const placed = [];

for (const info of glyphs) {
  if (info.gw === 0) {
    // Espaço: sem pixel, só xadvance
    placed.push({ ...info, atlasX: 0, atlasY: 0 });
    continue;
  }
  const cellW = info.gw + PADDING * 2;
  const cellH = info.gh + PADDING * 2;

  if (cx + cellW > ATLAS_W) { cx = PADDING; cy += rowH + PADDING; rowH = 0; }
  if (cy + cellH > ATLAS_H) { console.error('Atlas overflow!'); process.exit(1); }

  placed.push({ ...info, atlasX: cx, atlasY: cy });
  cx += cellW;
  rowH = Math.max(rowH, cellH);
}

// ── Renderiza no canvas ───────────────────────────────────────────────────────
const canvas = createCanvas(ATLAS_W, ATLAS_H);
const ctx = canvas.getContext('2d');
ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
ctx.fillStyle = '#ffffff';
ctx.antialias = 'subpixel';

for (const p of placed) {
  if (p.gw === 0) continue;
  const drawX = p.atlasX + PADDING - p.x1;
  const drawY = p.atlasY + PADDING + p.y2;
  const path = p.g.getPath(drawX, drawY, FONT_SIZE);
  ctx.beginPath();
  for (const cmd of path.commands) {
    if      (cmd.type === 'M') ctx.moveTo(cmd.x, cmd.y);
    else if (cmd.type === 'L') ctx.lineTo(cmd.x, cmd.y);
    else if (cmd.type === 'C') ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
    else if (cmd.type === 'Q') ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
    else if (cmd.type === 'Z') ctx.closePath();
  }
  ctx.fill();
}

// ── Gera XML .fnt ─────────────────────────────────────────────────────────────
const charLines = placed.map(p => {
  const ax = p.gw === 0 ? 0 : p.atlasX + PADDING;
  const ay = p.gw === 0 ? 0 : p.atlasY + PADDING;
  const w  = p.gw;
  const h  = p.gh;
  const xoffset  = p.x1;
  const yoffset  = base - p.y2;
  return `    <char id="${p.code}" x="${ax}" y="${ay}" width="${w}" height="${h}" xoffset="${xoffset}" yoffset="${yoffset}" xadvance="${p.adv}" page="0" chnl="15" />`;
}).join('\n');

const fntTemplate = (filename) => `<?xml version="1.0"?>
<font>
  <info face="game_font" size="${FONT_SIZE}" bold="1" italic="0" charset="" unicode="1" stretchH="100" smooth="1" aa="1" padding="0,0,0,0" spacing="1,1" outline="0" />
  <common lineHeight="${lineHeight}" base="${base}" scaleW="${ATLAS_W}" scaleH="${ATLAS_H}" pages="1" packed="0" />
  <pages><page id="0" file="${filename}.png" /></pages>
  <chars count="${placed.length}">
${charLines}
  </chars>
</font>`;

// ── Escreve os 3 variants com cores baked ─────────────────────────────────────
const VARIANTS = [
  { name: 'game_font_gold',  color: '#ffd700' },
  { name: 'game_font_white', color: '#ffffff' },
  { name: 'game_font_blue',  color: '#4499ff' },
];

for (const { name, color } of VARIANTS) {
  // Recolore: cria canvas com a cor desejada mascarada pela alpha do atlas branco
  const colored = createCanvas(ATLAS_W, ATLAS_H);
  const cctx = colored.getContext('2d');
  cctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
  // Pinta a cor sólida usando o atlas branco como máscara de alpha
  cctx.drawImage(canvas, 0, 0);               // copia alpha+white
  cctx.globalCompositeOperation = 'source-in'; // só onde há pixels
  cctx.fillStyle = color;
  cctx.fillRect(0, 0, ATLAS_W, ATLAS_H);

  const dir = join(ROOT, `public/assets/fonts/${name}`);
  writeFileSync(join(dir, `${name}.png`), colored.toBuffer('image/png'));
  writeFileSync(join(dir, `${name}.fnt`), fntTemplate(name), 'utf8');
  console.log(`✓  ${name}  (${color})`);
}

console.log(`\n${placed.length} glifos, atlas ${ATLAS_W}×${ATLAS_H}px @ ${FONT_SIZE}px`);
