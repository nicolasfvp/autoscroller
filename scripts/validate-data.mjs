#!/usr/bin/env node
// scripts/validate-data.mjs
// Cross-references IDs across the JSON data layer and fails CI on drift.
// - Every card ID referenced by enemy-drops, events, synergies, buildings,
//   and class starter decks must exist in cards.json.
// - Every relic ID referenced by buildings.json must exist in relics.json.
// - Every passive ID referenced by buildings.json must exist in
//   passives.json (warrior or mage).
// - Every tile key in terrain-enemies.json must exist in src/data/tiles.json.
// - Every material id referenced by terrainDrops/enemyBonusDrops/bossDrops
//   in materials.json must be defined in materials.json.materials[].
//
// Exit code 1 on any failure. Pass cleanly with no output noise on success.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

function loadJSON(relPath) {
  const full = resolve(ROOT, relPath);
  try {
    return JSON.parse(readFileSync(full, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to load ${relPath}: ${err.message}`);
  }
}

const errors = [];
function fail(msg) { errors.push(msg); }

// ── Load all data ──────────────────────────────────────────────
const cards = loadJSON('src/data/json/cards.json');
const enemyDrops = loadJSON('src/data/json/enemy-drops.json');
const events = loadJSON('src/data/json/events.json');
const cardSynergies = loadJSON('src/data/json/synergies.json');
const relics = loadJSON('src/data/json/relics.json');
const passives = loadJSON('src/data/json/passives.json');
const buildings = loadJSON('src/data/json/buildings.json');
const enemies = loadJSON('src/data/json/enemies.json');
const materials = loadJSON('src/data/json/materials.json');
const tilesKeyed = loadJSON('src/data/tiles.json');           // live (object-keyed)
const terrainEnemies = loadJSON('src/data/terrain-enemies.json');
const terrainSynergies = loadJSON('src/data/synergies.json'); // terrain-pair synergies

// ── Build canonical sets ───────────────────────────────────────
const cardIds = new Set((cards.cards ?? []).map(c => c.id));
const relicIds = new Set((relics ?? []).map(r => r.id));
const passiveIds = new Set([
  ...(passives.warrior ?? []).map(p => p.id),
  ...(passives.mage ?? []).map(p => p.id),
]);
const enemyIds = new Set((enemies ?? []).map(e => e.id));
const enemyNames = new Set((enemies ?? []).map(e => e.name));
const materialIds = new Set((materials.materials ?? []).map(m => m.id));
const tileKeys = new Set(Object.keys(tilesKeyed));

// ── Check 1: enemy-drops cardPool IDs ──────────────────────────
for (const [enemyName, table] of Object.entries(enemyDrops)) {
  if (!enemyNames.has(enemyName)) {
    fail(`enemy-drops.json: "${enemyName}" has no matching enemy in enemies.json`);
  }
  const pool = table?.cardDrops?.cardPool ?? [];
  for (const id of pool) {
    if (!cardIds.has(id)) {
      fail(`enemy-drops.json["${enemyName}"].cardPool: card "${id}" not in cards.json`);
    }
  }
}

// ── Check 2: events.json add_card / upgrade_card values ────────
// add_card / remove_card / upgrade_card use generic tokens like
// "random", "random_rare", "choose", "curse" — these are NOT card IDs,
// they're effect-resolver tokens. Skip those. Only fail if a literal
// card id is referenced and doesn't exist. The current schema only
// emits tokens, so this loop is mostly defensive.
const EVENT_CARD_TOKENS = new Set([
  'random', 'random_rare', 'random_uncommon', 'random_common', 'choose', 'curse',
]);
for (const ev of events ?? []) {
  for (const choice of ev.choices ?? []) {
    for (const eff of choice.effects ?? []) {
      if (eff.type === 'add_card' || eff.type === 'upgrade_card') {
        const v = eff.value;
        if (typeof v === 'string' && !EVENT_CARD_TOKENS.has(v) && !cardIds.has(v)) {
          fail(`events.json["${ev.id}"]: ${eff.type} value "${v}" is not a known card id or token`);
        }
      }
    }
  }
}

// ── Check 3: card-synergies card IDs ───────────────────────────
for (const s of cardSynergies ?? []) {
  if (!cardIds.has(s.cardA)) fail(`synergies.json: cardA "${s.cardA}" not in cards.json (${s.displayName ?? '?'})`);
  if (!cardIds.has(s.cardB)) fail(`synergies.json: cardB "${s.cardB}" not in cards.json (${s.displayName ?? '?'})`);
}

// ── Check 4: starterDeckIds in cards.json ──────────────────────
for (const id of cards.starterDeckIds ?? []) {
  if (!cardIds.has(id)) fail(`cards.json starterDeckIds: "${id}" not in cards.json`);
}

// ── Check 5: buildings.json unlocks (cards / relics / passives / tiles) ──
for (const [bldKey, bld] of Object.entries(buildings)) {
  for (const tier of bld.tiers ?? []) {
    const u = tier.unlocks ?? {};
    for (const id of u.cards ?? []) {
      if (!cardIds.has(id)) fail(`buildings.json[${bldKey}] tier ${tier.level}: unlocks card "${id}" not in cards.json`);
    }
    for (const id of u.relics ?? []) {
      if (!relicIds.has(id)) fail(`buildings.json[${bldKey}] tier ${tier.level}: unlocks relic "${id}" not in relics.json`);
    }
    for (const id of u.passives ?? []) {
      if (!passiveIds.has(id)) fail(`buildings.json[${bldKey}] tier ${tier.level}: unlocks passive "${id}" not in passives.json`);
    }
    for (const id of u.tiles ?? []) {
      if (!tileKeys.has(id)) fail(`buildings.json[${bldKey}] tier ${tier.level}: unlocks tile "${id}" not in tiles.json`);
    }
  }
}

// ── Check 6: relics.json self-coherence (unlocks attributable) ──
// Trigger / rarity surface-level checks only; deep schema is in tests.
const validTriggers = new Set(['combat_start', 'turn_start', 'card_played', 'damage_taken', 'heal', 'passive']);
for (const r of relics ?? []) {
  if (r.trigger && !validTriggers.has(r.trigger)) {
    fail(`relics.json["${r.id}"]: trigger "${r.trigger}" is not a known RelicTrigger`);
  }
}

// ── Check 7: tile keys cross-check (terrain-enemies → tiles) ───
for (const key of Object.keys(terrainEnemies)) {
  if (!tileKeys.has(key)) {
    fail(`terrain-enemies.json: terrain "${key}" not in tiles.json`);
  }
}

// ── Check 8: terrain-pair synergies reference real tile keys ───
for (const s of terrainSynergies ?? []) {
  for (const tk of s.pair ?? []) {
    if (!tileKeys.has(tk)) {
      fail(`src/data/synergies.json (terrain): pair key "${tk}" not in tiles.json`);
    }
  }
}

// ── Check 9: materials.json self-references ────────────────────
for (const [terrain, drop] of Object.entries(materials.terrainDrops ?? {})) {
  if (drop.primary && !materialIds.has(drop.primary)) {
    fail(`materials.json terrainDrops[${terrain}].primary "${drop.primary}" not a known material`);
  }
  if (drop.secondary && !materialIds.has(drop.secondary)) {
    fail(`materials.json terrainDrops[${terrain}].secondary "${drop.secondary}" not a known material`);
  }
}
for (const [enemyId, drop] of Object.entries(materials.enemyBonusDrops ?? {})) {
  if (!enemyIds.has(enemyId)) {
    fail(`materials.json enemyBonusDrops: "${enemyId}" not in enemies.json`);
  }
  if (drop.material && !materialIds.has(drop.material)) {
    fail(`materials.json enemyBonusDrops[${enemyId}].material "${drop.material}" not a known material`);
  }
}
for (const matId of Object.keys(materials.bossDrops?.materials ?? {})) {
  if (!materialIds.has(matId)) {
    fail(`materials.json bossDrops.materials: "${matId}" not a known material`);
  }
}

// ── Check 10: enemies.json materialReward.bonusMaterial references ──
for (const e of enemies ?? []) {
  if (e.materialReward?.bonusMaterial && !materialIds.has(e.materialReward.bonusMaterial)) {
    fail(`enemies.json["${e.id}"].materialReward.bonusMaterial "${e.materialReward.bonusMaterial}" not a known material`);
  }
}

// ── Report ─────────────────────────────────────────────────────
if (errors.length > 0) {
  console.error('FAIL: validate-data found', errors.length, 'cross-reference error(s):');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}

console.log('PASS: data cross-references OK');
console.log(`  cards: ${cardIds.size}, enemies: ${enemyIds.size}, relics: ${relicIds.size},`);
console.log(`  passives: ${passiveIds.size}, materials: ${materialIds.size}, tiles: ${tileKeys.size}`);
