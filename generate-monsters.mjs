#!/usr/bin/env node
/**
 * generate-monsters.mjs
 * Two-step pipeline per monster:
 *   1. Feed the original 64×64 sprite to Grok vision → get a detailed description
 *   2. Generate a 500×500 improved sprite using that description + style
 *
 * Usage: node generate-monsters.mjs
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────── Config ──────────────────────────────
const API_KEY   = process.env.XAI_API_KEY
  ?? 'REDACTED_XAI_API_KEY';
const VISION_URL = 'https://api.x.ai/v1/chat/completions';
const IMG_URL    = 'https://api.x.ai/v1/images/generations';
const VISION_MDL = 'grok-2-vision-1212';
const IMG_MDL    = 'grok-imagine-image';
const OUT_DIR    = path.join(__dirname, 'public/assets/characters/monsters');
const SIZE       = 500;
const DELAY_MS   = 4500;
const MAX_RETRY  = 3;

// ─────────────────────────── Style anchor ────────────────────────
// Matches the hand-improved lost_lizard style the user approved
const STYLE =
  'High-resolution dark fantasy pixel art sprite, crisp pixel-perfect shading, ' +
  'rich saturated colors on a pure transparent background, ' +
  'isolated character with no floor shadow no environment no background whatsoever, ' +
  'same visual quality and aesthetic as professional RPG pixel art (Darkest Dungeon, Dead Cells), ' +
  'full body visible, slightly left-facing combat-ready pose, ' +
  'no text no UI no border. ';

// ─────────────────────────── Monster list ────────────────────────
const MONSTERS = [
  { path: 'cemetery/corpse eater.png',        name: 'Corpse Eater'       },
  { path: 'cemetery/headless fire horse.png', name: 'Headless Fire Horse'},
  { path: 'cemetery/pocket cat.png',          name: 'Pocket Cat'         },
  { path: 'default/doom knight.png',          name: 'Doom Knight'        },
  { path: 'default/iron golem.png',           name: 'Iron Golem'         },
  { path: 'default/lizard king.png',          name: 'Lizard King'        },
  { path: 'desert/baby dragon.png',           name: 'Baby Dragon'        },
  { path: 'desert/giant beetle.png',          name: 'Giant Beetle'       },
  { path: 'desert/mutated salamander.png',    name: 'Mutated Salamander' },
  { path: 'forest/ancient tree.png',          name: 'Ancient Tree'       },
  { path: 'forest/giant spider 2.png',        name: 'Giant Spider 2'     },
  { path: 'forest/giant spider.png',          name: 'Giant Spider'       },
  { path: 'forest/mush.png',                  name: 'Mush'               },
  { path: 'lava/forge slime.png',             name: 'Forge Slime'        },
  { path: 'lava/lava golen.png',              name: 'Lava Golem'         },
  { path: 'lava/mecha warrior.png',           name: 'Mecha Warrior'      },
  { path: 'swamp/depths horror.png',          name: 'Depths Horror'      },
  { path: 'swamp/toxic gooze.png',            name: 'Toxic Gooze'        },
  { path: 'swamp/venomous kobra.png',         name: 'Venomous Kobra'     },
  // Bosses (no original — describe from name only, still pixel art style)
  { path: 'boss_demon.png',     name: 'Demon Lord',   noOriginal: true },
  { path: 'boss_berserker.png', name: 'Blood Reaver', noOriginal: true },
  { path: 'boss_mage.png',      name: 'Lich King',    noOriginal: true },
  { path: 'boss_hydra.png',     name: 'Swamp Hydra',  noOriginal: true },
];

// ─────────────────────────── Helpers ─────────────────────────────
const sleep   = ms => new Promise(r => setTimeout(r, ms));
const headers = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

function alreadyDone(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const buf = fs.readFileSync(filePath);
    return buf.readUInt32BE(16) >= 500 && buf.readUInt32BE(20) >= 500;
  } catch { return false; }
}

async function retry(fn) {
  for (let i = 1; i <= MAX_RETRY; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === MAX_RETRY) throw err;
      const d = DELAY_MS * i * 2;
      console.warn(`    ↻ attempt ${i} failed (${err.message.slice(0, 70)}), retry in ${d/1000}s…`);
      await sleep(d);
    }
  }
}

// ── Step 1: describe original sprite via vision ───────────────────
async function describeSprite(imagePath, monsterName) {
  const b64 = fs.readFileSync(imagePath).toString('base64');
  const res = await fetch(VISION_URL, {
    method: 'POST', headers,
    body: JSON.stringify({
      model: VISION_MDL,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${b64}`, detail: 'high' },
          },
          {
            type: 'text',
            text:
              `This is a 64×64 pixel art sprite of "${monsterName}" from a dark fantasy RPG. ` +
              'Describe it in detail so an artist can recreate it at higher resolution: ' +
              'body shape, colors, distinctive features, armor/weapons, pose, and overall silhouette. ' +
              'Be specific. Keep it under 120 words.',
          },
        ],
      }],
      max_tokens: 200,
    }),
  });
  if (!res.ok) throw new Error(`Vision HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

// ── Step 2: generate high-res sprite ─────────────────────────────
async function generateSprite(prompt) {
  const res = await fetch(IMG_URL, {
    method: 'POST', headers,
    body: JSON.stringify({ model: IMG_MDL, prompt, n: 1, response_format: 'b64_json' }),
  });
  if (!res.ok) throw new Error(`Image HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const json = await res.json();
  const b64  = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error('No b64_json: ' + JSON.stringify(json).slice(0, 150));
  return Buffer.from(b64, 'base64');
}

// ── Resize to 500×500 ─────────────────────────────────────────────
let sharp;
try { sharp = (await import('sharp')).default; }
catch { console.warn('⚠  sharp not found — saving at raw API size.\n'); sharp = null; }

async function toFinalPNG(buf) {
  if (!sharp) return buf;
  return sharp(buf).resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 8 }).toBuffer();
}

// ── Boss fallback descriptions (no original sprite) ───────────────
const BOSS_DESC = {
  'Demon Lord':  'towering winged demon with massive curved horns, four arms, dark plate armor with fire runes, hellfire aura',
  'Blood Reaver':'massive berserker with twin blood-dripping axes, war paint, wild hair, blood-red fury aura',
  'Lich King':   'skeletal lich in tattered robes with glowing purple eye sockets, death staff with soul orb, undead hands',
  'Swamp Hydra': 'three-headed hydra with venom-dripping maws, massive scaled body, swamp-green coloring',
};

// ─────────────────────────── Main ────────────────────────────────
async function main() {
  const pending = MONSTERS.filter(m => !alreadyDone(path.join(OUT_DIR, m.path)));
  const skipped = MONSTERS.length - pending.length;

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  Monster Art Generator v2 — xAI Grok ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Total   : ${MONSTERS.length}  |  To do: ${pending.length}  |  Skipped: ${skipped}\n`);

  if (pending.length === 0) { console.log('✅  All done!\n'); return; }

  let done = 0, failed = 0;
  const failures = [];

  for (let i = 0; i < pending.length; i++) {
    const m    = pending[i];
    const dest = path.join(OUT_DIR, m.path);
    const src  = path.join(OUT_DIR, m.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    const label = `[${String(i+1).padStart(2)}/${pending.length}] ${m.name.padEnd(22)}`;
    console.log(`${label}`);

    try {
      // Step 1 — describe
      let description;
      if (!m.noOriginal && fs.existsSync(src)) {
        process.stdout.write('    👁  Analysing original… ');
        description = await retry(() => describeSprite(src, m.name));
        console.log('done');
      } else {
        description = BOSS_DESC[m.name] ?? m.name;
      }

      // Step 2 — generate
      process.stdout.write('    🎨 Generating sprite…   ');
      const prompt =
        `${STYLE}` +
        `Character: "${m.name}". ` +
        `Visual description based on original pixel art sprite: ${description}. ` +
        `Improve resolution and detail while preserving the original character design, colors, and silhouette exactly.`;

      const raw   = await retry(() => generateSprite(prompt));
      const final = await toFinalPNG(raw);
      fs.writeFileSync(dest, final);
      done++;
      console.log(`✓  ${(final.length/1024).toFixed(0)} KB`);
    } catch (err) {
      failed++;
      failures.push({ name: m.name, error: err.message });
      console.log(`✗  ${err.message.slice(0, 80)}`);
    }

    if (i < pending.length - 1) await sleep(DELAY_MS);
  }

  console.log('\n──────────────────────────────────────────');
  console.log(`  ✅ ${done}  ✗ ${failed}  ⏭ ${skipped}`);
  if (failures.length) failures.forEach(f => console.log(`  • ${f.name}: ${f.error.slice(0,100)}`));
  console.log('');
}

main().catch(err => { console.error('\n❌', err); process.exit(1); });
