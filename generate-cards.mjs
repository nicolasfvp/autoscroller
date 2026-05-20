#!/usr/bin/env node
/**
 * generate-cards.mjs
 * Generates 400×500 card art for all 156 new-system cards (t1-* + t2-*)
 * via xAI Aurora/Grok image API and saves to <project>/cards/<id>.png
 *
 * Usage:  node generate-cards.mjs
 * Resume: already-generated files are skipped automatically.
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────── Config ──────────────────────────────
const API_KEY = process.env.XAI_API_KEY
  ?? 'YOUR_API_KEY_HERE';
const API_URL     = 'https://api.x.ai/v1/images/generations';
const MODEL       = 'grok-imagine-image';
const OUT_DIR     = path.join(__dirname, 'cards');
const W = 400, H  = 500;
const DELAY_MS    = 4000;   // ms between requests — conservative vs rate limits
const MAX_RETRIES = 3;

// ─────────────────────────── Style ───────────────────────────────
const STYLE =
  'Detailed dark fantasy pixel art, high-quality pixel illustration with rich fine-grained ' +
  'pixel shading and many color gradients, deep near-black background with subtle dark ' +
  'purple-brown atmospheric tones, dramatic magical glow and light-source effects casting ' +
  'colored shadows, mature gritty dark fantasy tone, cinematic portrait composition, ' +
  'no text no UI no borders, style of Darkest Dungeon and Dead Cells premium pixel art. ';

// ─────────────────────────── Element themes ──────────────────────
const THEME = {
  attack:  'battle-scarred warrior wielding a blood-stained sword, deep crimson (#DC2626) energy glow, dark battlefield atmosphere',
  defense: 'heavy armored knight holding a towering shield with glowing runes, steel-gray (#6B7280) and golden magical engravings',
  agility: 'hooded rogue in mid-dash with motion blur trails, warm golden (#FACC15) speed energy, shadow-cloaked silhouette',
  counter: 'wounded warrior with dark red (#B91C1C) reactive energy coiling around scarred arms, revenge aura in darkness',
  fire:    'roaring pillar of orange-red (#F97316) fire with ember particles, heat distortion in pixel art, dark smoky background',
  water:   'cyan-blue (#0EA5E9) ice shards and frost chains materializing from darkness, cold ethereal pixel glow',
  air:     'swirling lavender-purple (#C4B5FD) wind vortex with pixel particle trails, ethereal speed energy in dark sky',
  earth:   'dark brown (#92400E) stone fists erupting from cracked ground, geological pixel shards, deep shadow tones',
};

// ─────────────────────────── Prompt builder ──────────────────────
function buildPrompt(card) {
  // Deduplicate elements, sorted by frequency (dominant first)
  const counts = {};
  card.elements.forEach(e => { counts[e] = (counts[e] ?? 0) + 1; });
  const uniqueElems = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([e]) => e);

  const elemDesc = uniqueElems.map(e => THEME[e]).join('; blended with ');
  const tier = card.tier === 1
    ? 'common Tier 1 power level, clean readable composition'
    : 'powerful Tier 2 quality, complex layered energy effects';

  return (
    `${STYLE}` +
    `Card name: "${card.name}". ` +
    `Elemental visual: ${elemDesc}. ` +
    `Mechanic context (do NOT show text): ${card.description}. ` +
    `${tier}.`
  );
}

// ─────────────────────────── API call ────────────────────────────
async function callAPI(prompt) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, prompt, n: 1, response_format: 'b64_json' }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err  = new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  const b64  = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error('No b64_json in response: ' + JSON.stringify(json).slice(0, 300));
  return Buffer.from(b64, 'base64');
}

async function generateImage(prompt) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callAPI(prompt);
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const delay = DELAY_MS * attempt * 2;
      console.warn(`    ↻ attempt ${attempt} failed (${err.message.slice(0, 80)}), retry in ${delay / 1000}s…`);
      await sleep(delay);
    }
  }
}

// ─────────────────────────── Resize ──────────────────────────────
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('⚠  sharp not found — images saved at raw API resolution (no resize to 400×500).\n');
  sharp = null;
}

async function toFinalPNG(buf) {
  if (!sharp) return buf;
  return sharp(buf)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 8 })
    .toBuffer();
}

// ─────────────────────────── Helpers ─────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function eta(remaining) {
  const secs = Math.ceil((remaining * (DELAY_MS + 3500)) / 1000);
  const m = Math.floor(secs / 60), s = secs % 60;
  return m > 0 ? `~${m}m ${s}s` : `~${s}s`;
}

function pad(n, w) { return String(n).padStart(w); }

// ─────────────────────────── Main ────────────────────────────────
async function main() {
  // Load card data
  const cardsJsonPath = path.join(__dirname, 'src/data/json/cards.json');
  if (!fs.existsSync(cardsJsonPath)) {
    console.error('ERROR: src/data/json/cards.json not found');
    process.exit(1);
  }
  const { cards } = JSON.parse(fs.readFileSync(cardsJsonPath, 'utf8'));
  const allCards   = cards.filter(c => c.id.startsWith('t1-') || c.id.startsWith('t2-'));

  // Prepare output dir
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Partition: skip already generated
  const pending = allCards.filter(c => !fs.existsSync(path.join(OUT_DIR, `${c.id}.png`)));
  const skipped = allCards.length - pending.length;

  console.log('\n╔════════════════════════════════════╗');
  console.log('║  Card Art Generator — xAI Aurora   ║');
  console.log('╚════════════════════════════════════╝');
  console.log(`  Total cards   : ${allCards.length}`);
  console.log(`  Already done  : ${skipped}`);
  console.log(`  To generate   : ${pending.length}`);
  console.log(`  Output folder : ${OUT_DIR}`);
  console.log(`  Target size   : ${W}×${H}px`);
  if (pending.length > 0) console.log(`  ETA            : ${eta(pending.length)}\n`);

  if (pending.length === 0) {
    console.log('✅  All cards already generated!\n');
    return;
  }

  let done = 0, failed = 0;
  const failures = [];
  const t0 = Date.now();

  for (let i = 0; i < pending.length; i++) {
    const card = pending[i];
    const dest  = path.join(OUT_DIR, `${card.id}.png`);
    const num   = pad(skipped + i + 1, 3);
    const total = pad(allCards.length, 3);

    process.stdout.write(`[${num}/${total}] ${card.id.padEnd(38)} `);

    try {
      const prompt = buildPrompt(card);
      const raw    = await generateImage(prompt);
      const final  = await toFinalPNG(raw);
      fs.writeFileSync(dest, final);
      done++;
      console.log(`✓  ${(final.length / 1024).toFixed(0).padStart(4)} KB`);
    } catch (err) {
      failed++;
      failures.push({ id: card.id, error: err.message });
      console.log(`✗  FAILED: ${err.message.slice(0, 80)}`);
    }

    // delay between calls (skip after last)
    if (i < pending.length - 1) await sleep(DELAY_MS);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log('\n─────────────────────────────────────────────────');
  console.log(`  ✅ Generated : ${done}`);
  console.log(`  ✗  Failed   : ${failed}`);
  console.log(`  ⏭  Skipped  : ${skipped}`);
  console.log(`  ⏱  Elapsed  : ${elapsed}s`);

  if (failures.length > 0) {
    console.log('\n  Failed cards (re-run script to retry):');
    failures.forEach(f => console.log(`    • ${f.id}: ${f.error.slice(0, 100)}`));
  }

  console.log(`\n  Files saved to: ${OUT_DIR}`);
  console.log('  To use in-game: copy *.png to public/assets/cards/ and update Preloader.ts\n');
}

main().catch(err => { console.error('\n❌ Fatal error:', err); process.exit(1); });
