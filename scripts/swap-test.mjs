#!/usr/bin/env node
// Per-card MARGINAL-VALUE swap test — the gold-standard discriminator that fixes
// win-rate saturation. Holds a fixed baseline deck + profile + enemy battery,
// replaces ONE early slot with each candidate (and a filler control), so the
// win-rate / TTK / cushion / damage DELTA vs the control = that card's value.
//
// Usage:
//   node scripts/swap-test.mjs gen <spec.json> <out-matchups.json>
//     then run the sim on <out-matchups.json>, then:
//   node scripts/swap-test.mjs compare <spec.json> <results.json>
//
// spec.json = {
//   class:"warrior"|"mage", stage:"boss1"|..., baseline:[ids] (>=5), slot:N (0-based, keep early),
//   filler:"t1-attack"|..., candidates:[ids], enemies?:[ids] (default: stage normal battery + boss),
//   repeats?:N
// }
// The engine plays FIXED ORDER — keep `slot` small (0-2) so the candidate actually fires.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const r = (p) => resolve(root, p);
const readJSON = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf-8'));

const NORMAL_BATTERY = {
  loop2: ['mush', 'pocket_cat'], loop5: ['mutated_salamander', 'venomous_kobra'],
  loop8: ['mutated_salamander', 'vampire'], boss1: ['skeleton', 'fire_elemental'],
  loop15: ['werewolf', 'fire_elemental'], boss2: ['werewolf', 'fire_elemental'],
  loop25: ['werewolf', 'baby_dragon'], boss3: ['werewolf', 'baby_dragon'],
  boss4: ['werewolf', 'fire_elemental'], boss5: ['werewolf', 'depths_horror'],
  boss6: ['werewolf', 'fire_elemental'], boss7: ['werewolf', 'baby_dragon'],
};

const [, , mode, specPath, ioPath] = process.argv;
if (!mode || !specPath) { console.error('Usage: swap-test.mjs gen <spec> <out> | compare <spec> <results>'); process.exit(1); }
const spec = readJSON(specPath);
const stageModel = readJSON('tests/audit/val/stage-model.json');
const stage = stageModel.stages.find((s) => s.stage === spec.stage);
if (!stage) { console.error('unknown stage ' + spec.stage); process.exit(1); }
const repeats = spec.repeats ?? 6;

function variantDeck(slotCard) {
  const d = [...spec.baseline];
  d[spec.slot ?? 0] = slotCard;
  return d;
}
// matchup builder mirroring expand-validation-matchups (boss uses normalMult; sim halves it)
function mk(variantId, slotCard, enemy) {
  const isBoss = enemy === stage.boss;
  return {
    id: `${variantId}__vs__${enemy}`,
    label: `${variantId} vs ${enemy}`,
    archetype: 'swaptest', stage: spec.stage, class: spec.class,
    deck: variantDeck(slotCard),
    runXP: stage.runXP, relics: [], isBoss,
    enemy, loopMultiplier: stage.normalMult, loopCount: stage.loopCount, repeats,
  };
}

if (mode === 'gen') {
  const enemies = spec.enemies ?? [...(NORMAL_BATTERY[spec.stage] ?? []), ...(stage.boss ? [stage.boss] : [])];
  const matchups = [];
  for (const enemy of enemies) {
    matchups.push(mk('CONTROL', spec.filler, enemy));
    for (const cand of spec.candidates) matchups.push(mk(`CAND_${cand}`, cand, enemy));
  }
  writeFileSync(r(ioPath), JSON.stringify({ matchups }, null, 2));
  console.log(`Wrote ${matchups.length} swap-test matchups (${spec.candidates.length} candidates + control vs ${enemies.length} enemies) -> ${ioPath}`);
  console.log('Run: SIM_SPEC=' + ioPath + ' SIM_OUT=<res.json> npx vitest run tests/audit/deck-battle-sim.test.ts');
} else if (mode === 'compare') {
  const res = readJSON(ioPath).results;
  const byVariant = {};
  for (const m of res) {
    const [variant, enemy] = m.id.split('__vs__');
    (byVariant[variant] ??= []).push({ enemy, wr: m.winRate, ttk: m.avgTtkMs, cush: m.avgHeroHpPctOnWin, dmg: m.avgDamageDealt });
  }
  const ctrl = byVariant['CONTROL'] ?? [];
  const ctrlBy = Object.fromEntries(ctrl.map((x) => [x.enemy, x]));
  console.log('=== SWAP-TEST: candidate vs CONTROL (deltas; + = candidate better) ===');
  console.log('control filler:', spec.filler, '| slot', spec.slot ?? 0, '| baseline', spec.baseline.join(','));
  const rows = [];
  for (const [variant, list] of Object.entries(byVariant)) {
    if (variant === 'CONTROL') continue;
    const cand = variant.replace('CAND_', '');
    let dWR = 0, dCush = 0, dDmg = 0, dTtk = 0, n = 0;
    for (const x of list) {
      const c = ctrlBy[x.enemy]; if (!c) continue; n++;
      dWR += (x.wr - c.wr);
      dCush += ((x.cush ?? 0) - (c.cush ?? 0));
      dDmg += (x.dmg - c.dmg);
      dTtk += ((x.ttk ?? 0) - (c.ttk ?? 0));
    }
    rows.push({ cand, dWR: +(dWR / n).toFixed(3), dCush: +(dCush / n).toFixed(3), dDmg: Math.round(dDmg / n), dTtk: Math.round(dTtk / n) });
  }
  rows.sort((a, b) => a.dDmg - b.dDmg);
  for (const r2 of rows) console.log(`  ${r2.cand.padEnd(28)} ΔwinRate ${String(r2.dWR).padStart(6)}  Δcushion ${String(r2.dCush).padStart(7)}  Δdamage ${String(r2.dDmg).padStart(5)}  ΔttkMs ${String(r2.dTtk).padStart(7)}`);
}
