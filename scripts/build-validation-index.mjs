#!/usr/bin/env node
// Build canonical index files for the full card+enemy validation pass.
// Outputs to tests/audit/val/:
//   cards-index.json   — every card with tier/category/elements/cost/cd/OPS/archetypes
//   enemies-index.json — every enemy with stats/affinity/first-appear-loop/terrains
//   stage-model.json   — loop-band -> runXP / difficulty mult / boss
//   data-warnings.json — data inconsistencies (phantom enemies, unreachable enemies)
//
// Pure read-only over game data; no game state touched.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const r = (p) => resolve(root, p);
const readJSON = (p) => JSON.parse(readFileSync(r(p), 'utf-8'));

const outDir = r('tests/audit/val');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// ── Load data ──────────────────────────────────────────────
const cardsRaw = readJSON('src/data/json/cards.json');
const cards = Array.isArray(cardsRaw) ? cardsRaw : cardsRaw.cards;
const enemies = readJSON('src/data/json/enemies.json');
const terrain = readJSON('src/data/terrain-enemies.json');
const catalog = readJSON('tests/audit/card-catalog.json');

// per-card OPS: parse from catalog.md (format: `<id>` **Name** (... peakOPS 28.44 ...)
let opsById = {};
try {
  const md = readFileSync(r('tests/audit/card-catalog.md'), 'utf-8');
  const re = /`([a-z0-9-]+)`[^\n]*?peakOPS\s+([0-9.]+)/g;
  let m;
  while ((m = re.exec(md)) !== null) opsById[m[1]] = parseFloat(m[2]);
} catch { /* fallback: no OPS */ }

// archetype groups (a card can be in several)
const groupsByCard = {};
for (const [group, ids] of Object.entries(catalog.groups ?? {})) {
  for (const id of ids) (groupsByCard[id] ??= []).push(group);
}

// ── cards-index ────────────────────────────────────────────
function costStr(cost) {
  if (!cost) return 'free';
  const parts = [];
  if (cost.stamina) parts.push(`${cost.stamina}s`);
  if (cost.mana) parts.push(`${cost.mana}m`);
  if (cost.defense) parts.push(`${cost.defense}d`);
  return parts.join('+') || 'free';
}
// crude resource classification for class realism
function resourceKind(card) {
  const c = card.cost ?? {};
  if (c.mana && !c.stamina) return 'mana';
  if (c.stamina && !c.mana) return 'stamina';
  if (c.mana && c.stamina) return 'both';
  return 'free';
}

const cardsIndex = cards.map((c) => ({
  id: c.id,
  name: c.name,
  tier: c.tier ?? null,
  category: c.category,
  elements: c.elements ?? [],
  cost: c.cost ?? null,
  costStr: costStr(c.cost),
  resource: resourceKind(c),
  cooldown: c.cooldown,
  exhaust: !!c.exhaust,
  description: c.description,
  archetypes: groupsByCard[c.id] ?? [],
  peakOPS: opsById[c.id] ?? null,
  effectTypes: [...new Set((c.effects ?? []).map((e) => e.type))],
}));

// ── enemies-index ──────────────────────────────────────────
// first-appear loop from terrain pools
const firstAppear = {};
const terrainsByEnemy = {};
for (const [terr, pool] of Object.entries(terrain)) {
  for (const id of pool.base ?? []) {
    firstAppear[id] = Math.min(firstAppear[id] ?? 1, 1);
    (terrainsByEnemy[id] ??= new Set()).add(terr);
  }
  for (const [loopStr, ids] of Object.entries(pool.addAtLoop ?? {})) {
    const loop = Number(loopStr);
    for (const id of ids) {
      firstAppear[id] = Math.min(firstAppear[id] ?? Infinity, loop);
      (terrainsByEnemy[id] ??= new Set()).add(terr);
    }
  }
}

const BOSS_ROTATION = ['doom_knight', 'iron_golem', 'lizard_king', 'bog_witch', 'desert_golem', 'infernal_dragon', 'boss_iron_golem'];
const bossLoopOf = (id) => {
  const i = BOSS_ROTATION.indexOf(id);
  return i === -1 ? null : (i + 1) * 10;
};

const enemiesIndex = enemies.map((e) => ({
  id: e.id,
  name: e.name,
  type: e.type,
  bossType: e.bossType ?? null,
  baseHP: e.baseHP,
  baseDefense: e.baseDefense,
  damage: e.attack?.damage,
  pattern: e.attack?.pattern,
  attackCooldown: e.attackCooldown,
  affinity: e.affinity ?? null,
  behaviors: e.behaviors ?? [],
  firstAppearLoop: e.type === 'boss' ? bossLoopOf(e.id) : (firstAppear[e.id] ?? null),
  terrains: e.type === 'boss' ? [] : [...(terrainsByEnemy[e.id] ?? [])],
  bossRotationIndex: e.type === 'boss' ? BOSS_ROTATION.indexOf(e.id) : null,
}));

// ── stage-model ────────────────────────────────────────────
// runXP grounded in getLevel curve (base 50 * 1.15^L cumulative).
// Difficulty: normals mult = 1 + bossKills*0.10; boss mult = 1 + (norm-1)*0.5.
const STAGE_MODEL = {
  _notes: 'normalMult applies to normal enemies at that loop band; bossMult is the half-rate boss scaling. runXP grounded in the in-run leveling curve.',
  stages: [
    { stage: 'loop2',  loopCount: 2,  bossKills: 0, runXP: 120,  approxLevel: 2,  normalMult: 1.00, boss: null,             bossMult: null },
    { stage: 'loop5',  loopCount: 5,  bossKills: 0, runXP: 336,  approxLevel: 5,  normalMult: 1.00, boss: null,             bossMult: null },
    { stage: 'loop8',  loopCount: 8,  bossKills: 0, runXP: 480,  approxLevel: 6,  normalMult: 1.00, boss: null,             bossMult: null },
    { stage: 'boss1',  loopCount: 10, bossKills: 0, runXP: 560,  approxLevel: 6,  normalMult: 1.00, boss: 'doom_knight',    bossMult: 1.00 },
    { stage: 'loop15', loopCount: 15, bossKills: 1, runXP: 900,  approxLevel: 9,  normalMult: 1.10, boss: null,             bossMult: null },
    { stage: 'boss2',  loopCount: 20, bossKills: 1, runXP: 1150, approxLevel: 10, normalMult: 1.10, boss: 'iron_golem',     bossMult: 1.05 },
    { stage: 'loop25', loopCount: 25, bossKills: 2, runXP: 1450, approxLevel: 12, normalMult: 1.20, boss: null,             bossMult: null },
    { stage: 'boss3',  loopCount: 30, bossKills: 2, runXP: 1700, approxLevel: 13, normalMult: 1.20, boss: 'lizard_king',    bossMult: 1.10 },
    { stage: 'boss4',  loopCount: 40, bossKills: 3, runXP: 2300, approxLevel: 15, normalMult: 1.30, boss: 'bog_witch',      bossMult: 1.15 },
    { stage: 'boss5',  loopCount: 50, bossKills: 4, runXP: 2900, approxLevel: 16, normalMult: 1.40, boss: 'desert_golem',   bossMult: 1.20 },
    { stage: 'boss6',  loopCount: 60, bossKills: 5, runXP: 3600, approxLevel: 18, normalMult: 1.50, boss: 'infernal_dragon',bossMult: 1.25 },
    { stage: 'boss7',  loopCount: 70, bossKills: 6, runXP: 4400, approxLevel: 19, normalMult: 1.60, boss: 'boss_iron_golem',bossMult: 1.30 },
  ],
  bossRotation: BOSS_ROTATION,
};

// ── data warnings ──────────────────────────────────────────
const enemyIds = new Set(enemies.map((e) => e.id));
const referenced = new Set();
for (const pool of Object.values(terrain)) {
  for (const id of pool.base ?? []) referenced.add(id);
  for (const ids of Object.values(pool.addAtLoop ?? {})) for (const id of ids) referenced.add(id);
}
const phantomEnemies = [...referenced].filter((id) => !enemyIds.has(id));
const unreachableNormals = enemies
  .filter((e) => e.type === 'normal' && !referenced.has(e.id))
  .map((e) => e.id);

const warnings = {
  phantomEnemies_referencedButMissing: phantomEnemies,
  unreachableNormals_inRosterButNoTerrain: unreachableNormals,
  note: 'phantom enemies are referenced by terrain-enemies.json (green_field etc.) but absent from enemies.json — would crash spawn if that terrain is placed.',
};

// ── write ──────────────────────────────────────────────────
writeFileSync(r('tests/audit/val/cards-index.json'), JSON.stringify(cardsIndex, null, 2));
writeFileSync(r('tests/audit/val/enemies-index.json'), JSON.stringify(enemiesIndex, null, 2));
writeFileSync(r('tests/audit/val/stage-model.json'), JSON.stringify(STAGE_MODEL, null, 2));
writeFileSync(r('tests/audit/val/data-warnings.json'), JSON.stringify(warnings, null, 2));

// ── console summary ────────────────────────────────────────
console.log(`cards: ${cardsIndex.length} | with OPS: ${cardsIndex.filter((c) => c.peakOPS != null).length}`);
const tierCount = {};
for (const c of cardsIndex) tierCount[c.tier] = (tierCount[c.tier] ?? 0) + 1;
console.log('cards by tier:', JSON.stringify(tierCount));
console.log(`enemies: ${enemiesIndex.length} (normals ${enemiesIndex.filter((e) => e.type === 'normal').length}, bosses ${enemiesIndex.filter((e) => e.type === 'boss').length})`);
console.log('normal first-appear loops:', JSON.stringify(
  enemiesIndex.filter((e) => e.type === 'normal').reduce((a, e) => { (a[e.firstAppearLoop ?? 'none'] ??= []).push(e.id); return a; }, {}),
));
console.log('PHANTOM enemies (referenced, missing from roster):', JSON.stringify(phantomEnemies));
console.log('UNREACHABLE normals (in roster, no terrain):', JSON.stringify(unreachableNormals));
