#!/usr/bin/env node
// Expand a deck library into a FULL-COVERAGE matchup spec for deck-battle-sim.test.ts.
//
// Unlike scripts/expand-matchups.mjs (which only covered early/mid/boss1/late and
// 2 bosses), this covers the ENTIRE enemy roster (19 normals + 7 bosses) across the
// real loop-band progression, with difficulty multipliers grounded in the engine
// (normals: 1 + bossKills*0.10; bosses: half-rate then ×1.0).
//
// Usage:
//   node scripts/expand-validation-matchups.mjs <decks.json> <out-matchups.json> [normalRepeats] [bossRepeats]
//
// decks.json = { decks: [ { id,label,archetype,class,stage,deck:[ids],
//                           relics?, runXP?, stats?, vsEnemies?, vsBoss? } ] }
//   stage must be one of the STAGES keys below. Per-deck vsEnemies/vsBoss override.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const r = (p) => resolve(root, p);

const stageModel = JSON.parse(readFileSync(r('tests/audit/val/stage-model.json'), 'utf-8'));
const STAGE_BY_NAME = Object.fromEntries(stageModel.stages.map((s) => [s.stage, s]));

// Curated per-stage NORMAL battery. Designed so EVERY normal appears in >=1
// battery (coverage), enemies are tested at the multiplier matching when a
// player realistically faces them, and well-populated stages (boss1..boss3)
// give every normal many archetype data-points. Bosses come from the stage model.
const NORMAL_BATTERY = {
  loop2:  ['lost_lizard', 'giant_spider', 'mush', 'pocket_cat', 'forge_slime', 'toxic_gooze', 'scorpion'],
  loop5:  ['corpse_eater', 'mutated_salamander', 'giant_spider_2', 'lava_golen', 'venomous_kobra', 'pocket_cat'],
  loop8:  ['mutated_salamander', 'venomous_kobra', 'lava_golen', 'vampire', 'pocket_cat', 'corpse_eater'],
  boss1:  ['skeleton', 'fire_elemental', 'depths_horror', 'mutated_salamander'],
  loop15: ['werewolf', 'ancient_tree', 'baby_dragon', 'skeleton', 'fire_elemental'],
  boss2:  ['werewolf', 'fire_elemental', 'depths_horror'],
  loop25: ['werewolf', 'ancient_tree', 'baby_dragon'],
  boss3:  ['werewolf', 'mutated_salamander', 'baby_dragon'],
  boss4:  ['werewolf', 'fire_elemental', 'vampire'],
  boss5:  ['werewolf', 'depths_horror', 'skeleton'],
  boss6:  ['werewolf', 'fire_elemental', 'ancient_tree'],
  boss7:  ['werewolf', 'baby_dragon', 'depths_horror'],
};

const [, , decksPath, outPath, normalRepeatsArg, bossRepeatsArg] = process.argv;
if (!decksPath || !outPath) {
  console.error('Usage: node scripts/expand-validation-matchups.mjs <decks.json> <out.json> [normalRepeats=4] [bossRepeats=8]');
  process.exit(1);
}
const normalRepeats = normalRepeatsArg ? parseInt(normalRepeatsArg, 10) : 4;
const bossRepeats = bossRepeatsArg ? parseInt(bossRepeatsArg, 10) : 8;

const lib = JSON.parse(readFileSync(r(decksPath), 'utf-8'));
const decks = Array.isArray(lib) ? lib : lib.decks;

// Validate card ids against the canonical index.
const cardsIndex = JSON.parse(readFileSync(r('tests/audit/val/cards-index.json'), 'utf-8'));
const validCardIds = new Set(cardsIndex.map((c) => c.id));
const enemiesIndex = JSON.parse(readFileSync(r('tests/audit/val/enemies-index.json'), 'utf-8'));
const validEnemyIds = new Set(enemiesIndex.map((e) => e.id));

const matchups = [];
const warnings = [];
let droppedDecks = 0;

for (const d of decks) {
  const stage = STAGE_BY_NAME[d.stage];
  if (!stage) { warnings.push(`deck ${d.id}: unknown stage '${d.stage}'`); droppedDecks++; continue; }

  // Validate + clean card ids.
  const cleanDeck = d.deck.filter((id) => {
    if (!validCardIds.has(id)) { warnings.push(`deck ${d.id}: unknown card '${id}' (dropped)`); return false; }
    return true;
  });
  if (cleanDeck.length < 5) { warnings.push(`deck ${d.id}: <5 valid cards after cleaning (dropped)`); droppedDecks++; continue; }

  const runXP = d.runXP ?? stage.runXP;
  const relics = d.relics ?? [];
  const stats = d.stats ?? undefined;

  // Normal-enemy battery.
  const normals = (d.vsEnemies ?? NORMAL_BATTERY[d.stage] ?? []).filter((e) => {
    if (!validEnemyIds.has(e)) { warnings.push(`deck ${d.id}: unknown enemy '${e}'`); return false; }
    return true;
  });
  for (const enemy of normals) {
    matchups.push({
      id: `${d.id}__vs__${enemy}`,
      label: `${d.label ?? d.id} vs ${enemy} (${d.stage})`,
      archetype: d.archetype, stage: d.stage, class: d.class,
      deck: cleanDeck, relics, stats, runXP,
      enemy, loopMultiplier: stage.normalMult, isBoss: false,
      loopCount: stage.loopCount, repeats: normalRepeats,
    });
  }

  // Stage boss. IMPORTANT: pass the NORMAL multiplier (1 + bossKills*0.10) here,
  // exactly like the real engine (LoopRunner sets loop.difficultyMultiplier to
  // the normal rate; scaleEnemyForLoop applies the boss HALF-RATE once via the
  // isBoss flag). stage.bossMult is the already-halved scalar and is kept for
  // documentation ONLY — passing it would double-apply the half-rate and
  // under-scale deep bosses.
  const wantBoss = d.vsBoss === false ? false : !!stage.boss;
  if (wantBoss) {
    matchups.push({
      id: `${d.id}__vs__BOSS_${stage.boss}`,
      label: `${d.label ?? d.id} vs BOSS ${stage.boss} (${d.stage})`,
      archetype: d.archetype, stage: d.stage, class: d.class,
      deck: cleanDeck, relics, stats, runXP,
      enemy: stage.boss, loopMultiplier: stage.normalMult, isBoss: true,
      loopCount: stage.loopCount, repeats: bossRepeats,
    });
  }
}

writeFileSync(r(outPath), JSON.stringify({ matchups }, null, 2));
console.log(`Expanded ${decks.length} decks (${droppedDecks} dropped) -> ${matchups.length} matchups -> ${outPath}`);
console.log(`  repeats: normal=${normalRepeats}, boss=${bossRepeats}`);

// Coverage report.
const enemyHit = {};
for (const m of matchups) enemyHit[m.enemy] = (enemyHit[m.enemy] ?? 0) + 1;
const allEnemies = enemiesIndex.map((e) => e.id);
const missedEnemies = allEnemies.filter((e) => !enemyHit[e]);
console.log(`  enemies covered: ${Object.keys(enemyHit).length}/${allEnemies.length}` + (missedEnemies.length ? ` | MISSED: ${missedEnemies.join(', ')}` : ' (ALL)'));
console.log(`  enemy matchup counts: ${JSON.stringify(enemyHit)}`);
if (warnings.length) {
  console.log(`\n${warnings.length} WARNING(S):`);
  for (const w of warnings.slice(0, 60)) console.log('  ' + w);
}
