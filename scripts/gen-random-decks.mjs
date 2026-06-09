#!/usr/bin/env node
// Generate the RANDOM / "bad build" tier for the balance matrix: seeded, reproducible,
// class-resource-appropriate random decks (a clueless-but-not-self-sabotaging player),
// plus a few CHAOTIC decks (fully random, may stall) for the absolute floor.
//
// Usage: node scripts/gen-random-decks.mjs <out-decks.json> [perCell=4] [seed=1234]
//
// Output schema matches the deck library: { decks: [ { id,label,archetype,class,stage,
//   quality:"random", deck:[ids], notes } ] }
//
// Realism rules:
//  - warrior drafts from stamina/free/both cards (50 stamina pool); mage from mana/free/both.
//    A small fraction (~15%) of off-resource cards is allowed (players misdraft).
//  - tier availability scales with stage: a fresh player has mostly T1/T2 early, T3 appears
//    by loop8+ (T3 needs 3-element crafting), any tier deep.
//  - deck size scales with stage (5 early -> up to 15 deep).
//  - duplicates capped at 2 per card; every deck guaranteed >=2 damage-dealing cards
//    (even a clueless player drafts a couple attacks) so we test "bad" not "impossible".

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const r = (p) => resolve(root, p);

const cards = JSON.parse(readFileSync(r('tests/audit/val/cards-index.json'), 'utf-8'));
const stageModel = JSON.parse(readFileSync(r('tests/audit/val/stage-model.json'), 'utf-8'));
const STAGES = stageModel.stages.map((s) => s.stage);

const [, , outPath, perCellArg, seedArg] = process.argv;
if (!outPath) { console.error('Usage: node scripts/gen-random-decks.mjs <out.json> [perCell=4] [seed=1234]'); process.exit(1); }
const perCell = perCellArg ? parseInt(perCellArg, 10) : 4;
let seed = seedArg ? parseInt(seedArg, 10) : 1234;

// mulberry32 seeded PRNG (deterministic, reproducible across runs).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(seed);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

// damage-dealing predicate (has a damage/dot effect or a detonator) — used to guarantee playability.
const dealsDamage = (c) => c.effectTypes.includes('damage') || c.effectTypes.includes('dot') || c.category === 'attack';

// per-stage config: deck size + per-TIER draw weights + count of decks per class.
// IMPORTANT (integrity fix): the catalog is 73% T3 (120/164), so UNIFORM sampling
// produced "random" decks that were ~70% T3 — i.e. random piles of the STRONGEST
// cards, not a struggling player's deck. We now WEIGHT draws by tier to model a
// realistic per-loop collection: a new/bad player owns mostly T1/T2 early; the T3
// share (which requires 3-element crafting, a mastery activity) grows slowly with
// depth but never dominates the "bad/random" tier. tierW = [T1, T2, T3] weights.
const STAGE_CFG = {
  loop2:  { size: [5, 6],   tierW: [0.35, 0.65, 0.00], n: perCell + 2 },
  loop5:  { size: [6, 8],   tierW: [0.25, 0.75, 0.00], n: perCell + 1 },
  loop8:  { size: [8, 10],  tierW: [0.15, 0.70, 0.15], n: perCell },
  boss1:  { size: [9, 11],  tierW: [0.15, 0.65, 0.20], n: perCell + 2 },
  loop15: { size: [11, 13], tierW: [0.10, 0.60, 0.30], n: perCell },
  boss2:  { size: [11, 13], tierW: [0.10, 0.55, 0.35], n: perCell },
  loop25: { size: [12, 14], tierW: [0.10, 0.50, 0.40], n: perCell },
  boss3:  { size: [12, 14], tierW: [0.10, 0.45, 0.45], n: perCell },
  boss4:  { size: [13, 15], tierW: [0.05, 0.45, 0.50], n: perCell },
  boss5:  { size: [13, 15], tierW: [0.05, 0.45, 0.50], n: perCell },
  boss6:  { size: [13, 15], tierW: [0.05, 0.40, 0.55], n: perCell },
  boss7:  { size: [14, 15], tierW: [0.05, 0.35, 0.60], n: perCell },
};

// class-appropriate cards grouped by tier (1/2/3). chaotic ignores resource fit.
function classPoolByTier(cls, chaotic) {
  const fits = (c) => chaotic ? true
    : (cls === 'warrior' ? (c.resource === 'stamina' || c.resource === 'free' || c.resource === 'both')
                         : (c.resource === 'mana' || c.resource === 'free' || c.resource === 'both'));
  return { 1: cards.filter((c) => c.tier === 1 && fits(c)), 2: cards.filter((c) => c.tier === 2 && fits(c)), 3: cards.filter((c) => c.tier === 3 && fits(c)) };
}

function weightedTier(tierW) {
  const r2 = rng();
  if (r2 < tierW[0]) return 1;
  if (r2 < tierW[0] + tierW[1]) return 2;
  return 3;
}

function buildDeck(cls, stage, idx, chaotic) {
  const cfg = STAGE_CFG[stage];
  const size = cfg.size[0] + Math.floor(rng() * (cfg.size[1] - cfg.size[0] + 1));
  // chaotic = fully uniform across the whole catalog (the absolute floor); realistic
  // random = tier-weighted draw from the class-appropriate pool.
  const byTier = classPoolByTier(cls, chaotic);
  const chaoticPool = cards.slice();
  const deck = [];
  const counts = {};
  let guard = 0;
  while (deck.length < size && guard++ < size * 60) {
    let c;
    if (chaotic) {
      c = pick(chaoticPool);
    } else {
      let t = weightedTier(cfg.tierW);
      // fall back to an available tier if the weighted one is empty (e.g. T3=0 early)
      if (!byTier[t] || byTier[t].length === 0) t = byTier[2].length ? 2 : (byTier[1].length ? 1 : 3);
      // ~12% off-resource misdraft: pull from the full catalog of that tier
      const pool = (rng() < 0.12) ? cards.filter((x) => x.tier === t) : byTier[t];
      c = pick(pool);
    }
    if (!c) break;
    if ((counts[c.id] ?? 0) >= 2) continue; // cap duplicates at 2
    counts[c.id] = (counts[c.id] ?? 0) + 1;
    deck.push(c.id);
  }
  // guarantee >=2 damage cards (playable-but-bad, not impossible)
  const cardById = Object.fromEntries(cards.map((c) => [c.id, c]));
  let dmgCount = deck.filter((id) => dealsDamage(cardById[id])).length;
  // damage pool drawn from the realistic tier mix (T1/T2 weighted like the deck),
  // so the guarantee doesn't sneak in high-tier nukes.
  const dmgPool = (chaotic ? cards : [...byTier[1], ...byTier[2], ...byTier[2], ...byTier[3]]).filter(dealsDamage);
  let g2 = 0;
  while (dmgCount < 2 && dmgPool.length && g2++ < 20) {
    const c = pick(dmgPool);
    // replace a random slot
    deck[Math.floor(rng() * deck.length)] = c.id;
    dmgCount = deck.filter((id) => dealsDamage(cardById[id])).length;
  }
  return {
    id: `rand-${stage}-${cls}-${idx}${chaotic ? 'c' : ''}`,
    label: `Random ${chaotic ? 'CHAOTIC ' : ''}${cls} (${stage})`,
    archetype: chaotic ? 'random-chaotic' : 'random',
    class: cls,
    stage,
    quality: 'random',
    deck,
    notes: `Seeded-random ${chaotic ? 'fully-random (may stall)' : 'class-appropriate'} deck — the "bad build" tier.`,
  };
}

const decks = [];
for (const stage of STAGES) {
  const cfg = STAGE_CFG[stage];
  for (const cls of ['warrior', 'mage']) {
    for (let i = 0; i < cfg.n; i++) decks.push(buildDeck(cls, stage, i, false));
    // one chaotic floor deck per (class, stage) at boss stages
    if (/^boss/.test(stage)) decks.push(buildDeck(cls, stage, 0, true));
  }
}

writeFileSync(r(outPath), JSON.stringify({ decks }, null, 2));
// coverage of cards by random decks
const covered = new Set();
for (const d of decks) for (const id of d.deck) covered.add(id);
console.log(`Generated ${decks.length} random decks -> ${outPath}`);
console.log(`  random-deck card coverage: ${covered.size}/${cards.length}`);
const byStage = {};
for (const d of decks) byStage[d.stage] = (byStage[d.stage] ?? 0) + 1;
console.log('  by stage:', JSON.stringify(byStage));
