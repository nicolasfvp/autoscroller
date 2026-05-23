#!/usr/bin/env node
// Generates 24 card-token icons via xAI Grok image API and post-processes
// each JPEG into a transparent PNG. See docs/CARD_AUDIT.md §1.2 for the
// token vocabulary.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const API_KEY = process.env.XAI_API_KEY;
if (!API_KEY) {
  console.error('Set XAI_API_KEY before running this script.');
  process.exit(1);
}
const ENDPOINT = 'https://api.x.ai/v1/images/generations';
const MODEL = 'grok-imagine-image';
const OUT_DIR = 'public/assets/icons/tokens';

const BASE_PROMPT = (subject, color, extra) =>
  `Pixel art game icon, 128x128 pixels, clean pure white background, centered subject: ${subject}. ` +
  `Dominant color ${color}. Style: clean bold black outlines, retro 16-bit RPG aesthetic, ` +
  `flat shading with subtle highlights, no text, no border, fills the canvas with ~10% padding around the subject. ` +
  `Readable at small sizes. ${extra || ''}`;

const ICONS = [
  // Stack DoTs / status
  { token: 'burn',    subject: 'a stylized flame with rising embers and tiny sparks, conveying a burning DoT status effect', color: '#FF8C00 warm orange', extra: 'Distinct from a plain fire element by showing rising embers and ash specks.' },
  { token: 'bleed',   subject: 'a vivid blood droplet falling with a small splash, like a wound dripping', color: '#DD2222 blood red', extra: '' },
  { token: 'poison',  subject: 'a toxic skull with green vapor rising from its eye sockets and mouth', color: '#66CC22 toxic green', extra: '' },
  { token: 'slow',    subject: 'a frost crystal snowflake with sluggish frozen droplet beneath it', color: '#66CCFF light icy blue', extra: '' },
  { token: 'stun',    subject: 'three swirling stars circling a central point, classic dizzy/stun effect', color: '#CCCCCC silver white', extra: '' },
  { token: 'rage',    subject: 'a clenched fist with red aura energy radiating around it', color: '#FF6622 bright orange', extra: '' },

  // Stats (scaling tags)
  { token: 'str',     subject: 'a strong flexed bicep arm muscle, bold and masculine', color: '#CC4444 deep red', extra: '' },
  { token: 'vit',     subject: 'a heart with a small armor plate or metal cuirass wrapped around it', color: '#888888 steel gray', extra: 'Distinct from the plain HP heart icon by having the armor plating.' },
  { token: 'dex',     subject: 'a single long flowing feather angled diagonally', color: '#FFCC44 golden yellow', extra: '' },
  { token: 'int',     subject: 'a stylized brain with a small sparkle or light-bulb glow above it', color: '#9966FF purple', extra: '' },
  { token: 'spi',     subject: 'a magical wisp shaped like a four-point sparkle star with a trailing energy tail', color: '#44CCAA teal mint', extra: '' },

  // Resources / vitals
  { token: 'stam',    subject: 'a sharp lightning bolt zigzag, energetic and crackling', color: '#FFCC44 yellow', extra: 'Distinct from the dex feather: this is energy, lightning-shaped.' },
  { token: 'mana',    subject: 'a faceted magical crystal gem floating with a soft glow', color: '#BB55EE purple', extra: '' },
  { token: 'HP',      subject: 'a plain bright heart, simple and iconic, no decoration', color: '#44DD44 bright green', extra: 'Distinct from the VIT armored heart by being completely plain.' },
  { token: 'armor',   subject: 'a simple round shield with a central boss, plain and clean', color: '#4488DD steel blue', extra: 'Distinct from the defense element shield by having no sword decoration.' },
  { token: 'exhaust', subject: 'an hourglass with sand mostly drained to the bottom, capped at the top, finished timer', color: '#FFAA00 gold', extra: '' },

  // Elements
  { token: 'attack',  subject: 'an upward-pointing classic shortsword with crossguard, sharp edge', color: '#DC2626 red', extra: '' },
  { token: 'defense', subject: 'a heater shield with a small crossed sword decoration on its face', color: '#6B7280 cool gray', extra: 'Distinct from the plain armor resource shield by having the sword decoration.' },
  { token: 'agility', subject: 'a stylized bird wing with multiple feathers spread, swift motion lines', color: '#FACC15 bright yellow', extra: 'Distinct from the dex single feather by being a multi-feather wing.' },
  { token: 'counter', subject: 'two crossed swords forming an X, parry stance', color: '#B91C1C dark crimson red', extra: '' },
  { token: 'fire',    subject: 'a clean simple campfire flame, pure flame with no embers or smoke', color: '#F97316 orange', extra: 'Distinct from the burn DoT by being a pure clean flame without rising embers or sparks.' },
  { token: 'water',   subject: 'a single large teardrop water droplet with a small highlight', color: '#0EA5E9 azure blue', extra: '' },
  { token: 'air',     subject: 'a swirling spiral wind motion symbol, like a small cyclone', color: '#C4B5FD light lavender purple', extra: '' },
  { token: 'earth',   subject: 'a chunky cracked boulder rock with rough irregular edges', color: '#92400E earthy brown', extra: '' },
];

async function callApi(icon) {
  const prompt = BASE_PROMPT(icon.subject, icon.color, icon.extra);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      n: 1,
      response_format: 'url',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API HTTP ${res.status} for ${icon.token}: ${text}`);
  }
  const json = await res.json();
  if (!json.data || !json.data[0]?.url) {
    throw new Error(`No data for ${icon.token}: ${JSON.stringify(json)}`);
  }
  return json.data[0].url;
}

async function downloadAndProcess(icon, url) {
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Download HTTP ${imgRes.status} for ${icon.token}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());

  // Decode to raw RGBA
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // Threshold near-white pixels to alpha=0. Background detection: sample the
  // four corners — if they're all near-white, treat any near-white pixel as bg.
  const corners = [
    [0, 0],
    [info.width - 1, 0],
    [0, info.height - 1],
    [info.width - 1, info.height - 1],
  ];
  let bgIsWhite = true;
  for (const [x, y] of corners) {
    const idx = (y * info.width + x) * 4;
    if (data[idx] < 235 || data[idx + 1] < 235 || data[idx + 2] < 235) {
      bgIsWhite = false;
      break;
    }
  }
  const threshold = 235;
  if (bgIsWhite) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r >= threshold && g >= threshold && b >= threshold) {
        data[i + 3] = 0;
      }
    }
  }

  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(128, 128, { kernel: 'nearest', fit: 'inside' })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const outPath = path.join(OUT_DIR, `${icon.token}.png`);
  await fs.writeFile(outPath, png);
  return outPath;
}

async function generate(icon) {
  const url = await callApi(icon);
  const outPath = await downloadAndProcess(icon, url);
  return { token: icon.token, path: outPath, url };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`Generating ${ICONS.length} icons → ${OUT_DIR}`);

  const concurrency = 4;
  const results = [];
  for (let i = 0; i < ICONS.length; i += concurrency) {
    const batch = ICONS.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map((ic) => generate(ic)));
    batchResults.forEach((r, j) => {
      const tok = batch[j].token;
      if (r.status === 'fulfilled') {
        console.log(`  ✓ ${tok}: ${path.basename(r.value.path)}`);
      } else {
        console.error(`  ✗ ${tok}: ${r.reason?.message ?? r.reason}`);
      }
      results.push({ token: tok, ...r });
    });
  }

  const ok = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`\nDone: ${ok}/${ICONS.length} icons generated successfully.`);
  if (ok < ICONS.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
