#!/usr/bin/env node
// Expands a DECK LIBRARY into a full matchup spec for deck-battle-sim.test.ts.
//
// Agents author decks (the creative part); this attaches the canonical, grounded
// stage profile (hero level/stats/relics) and the stage's enemy battery, so every
// matchup is realistic and consistent. Stage profiles are derived from the real
// progression model (HeroStatsResolver runXP leveling + boss-kill difficulty).
//
// Usage:
//   node scripts/expand-matchups.mjs <decks.json> <out-matchups.json> [repeats]
//
// decks.json = { "decks": [ { id, label, archetype, class, stage, deck:[ids],
//                            upgraded?:[ids], relics?:[ids], stats?:{...},
//                            runXP?:N, vsEnemies?:[ids], vsBoss?:bool } ] }
//   stage ∈ early | mid | boss1 | late   (sets level/relics/enemy battery defaults)
//   Any of relics/stats/runXP/vsEnemies override the stage defaults.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Canonical stage profiles (grounded in the progression model) ──────────
// Loops 1-10 run at difficulty multiplier 1.0 (scaling advances only on boss
// kills: mult = 1 + bossKills*0.10). So early/mid/boss1 enemies are UNSCALED;
// only `late` (post-boss-1) applies a >1.0 multiplier.
//
// runXP → in-run level → stat bonus (warrior offense=STR, mage offense=INT):
//   ~120 ≈ L2, ~350 ≈ L5, ~520 ≈ L6, ~720 ≈ L7-8.
const STAGES = {
  early: {
    runXP: 120, relics: [],
    enemies: ['lost_lizard', 'giant_spider', 'corpse_eater', 'pocket_cat'],
    boss: null, loopMultiplier: 1.0, loopCount: 2,
  },
  mid: {
    runXP: 350, relics: [],
    enemies: ['mutated_salamander', 'venomous_kobra', 'lava_golen', 'skeleton', 'werewolf'],
    boss: null, loopMultiplier: 1.0, loopCount: 6,
  },
  boss1: {
    runXP: 520, relics: [],
    // The "should-be-easy" first boss at loop 10, difficulty mult 1.0.
    enemies: [],
    boss: { id: 'doom_knight', loopMultiplier: 1.0 },
    loopMultiplier: 1.0, loopCount: 10,
  },
  late: {
    runXP: 720, relics: [],
    // Loops 11-30: normals scaled by ~1.15 (after 1-2 boss kills),
    // plus the 2nd/3rd bosses at their half-rate boss multipliers.
    enemies: ['depths_horror', 'fire_elemental', 'werewolf', 'mutated_salamander'],
    boss: { id: 'iron_golem', loopMultiplier: 1.05 },
    enemyLoopMultiplier: 1.15, loopMultiplier: 1.15, loopCount: 18,
  },
};

const [, , decksPath, outPath, repeatsArg] = process.argv;
if (!decksPath || !outPath) {
  console.error('Usage: node scripts/expand-matchups.mjs <decks.json> <out.json> [repeats]');
  process.exit(1);
}
const repeats = repeatsArg ? parseInt(repeatsArg, 10) : 3;

const lib = JSON.parse(readFileSync(resolve(root, decksPath), 'utf-8'));
const decks = Array.isArray(lib) ? lib : lib.decks;

// Validate card ids against the catalog (catch typos before a long sim run).
const catalog = JSON.parse(readFileSync(resolve(root, 'tests/audit/card-catalog.json'), 'utf-8'));
const validIds = new Set(catalog.cards.map((c) => c.id));

const matchups = [];
const warnings = [];
for (const d of decks) {
  const stage = STAGES[d.stage];
  if (!stage) { warnings.push(`deck ${d.id}: unknown stage '${d.stage}'`); continue; }
  for (const cid of d.deck) if (!validIds.has(cid)) warnings.push(`deck ${d.id}: unknown card '${cid}'`);

  const relics = d.relics ?? stage.relics;
  const stats = d.stats ?? undefined;
  const runXP = d.runXP ?? stage.runXP;

  const enemyList = d.vsEnemies ?? stage.enemies;
  const enemyMult = stage.enemyLoopMultiplier ?? stage.loopMultiplier;
  for (const enemy of enemyList) {
    matchups.push({
      id: `${d.id}__vs__${enemy}`,
      label: `${d.label ?? d.id} vs ${enemy} (${d.stage})`,
      archetype: d.archetype, stage: d.stage, class: d.class,
      deck: d.deck, upgraded: d.upgraded, stats, runXP, relics,
      enemy, loopMultiplier: enemyMult, isBoss: false,
      loopCount: stage.loopCount, repeats,
    });
  }
  // Boss matchup (stage default or explicit vsBoss)
  const boss = d.vsBoss === false ? null : stage.boss;
  if (boss) {
    matchups.push({
      id: `${d.id}__vs__${boss.id}`,
      label: `${d.label ?? d.id} vs BOSS ${boss.id} (${d.stage})`,
      archetype: d.archetype, stage: d.stage, class: d.class,
      deck: d.deck, upgraded: d.upgraded, stats, runXP, relics,
      enemy: boss.id, loopMultiplier: boss.loopMultiplier, isBoss: true,
      loopCount: stage.loopCount, repeats,
    });
  }
}

writeFileSync(resolve(root, outPath), JSON.stringify({ matchups }, null, 2), 'utf-8');
console.log(`Expanded ${decks.length} decks -> ${matchups.length} matchups -> ${outPath}`);
if (warnings.length) {
  console.log(`\n${warnings.length} WARNING(S):`);
  for (const w of warnings.slice(0, 40)) console.log('  ' + w);
}
