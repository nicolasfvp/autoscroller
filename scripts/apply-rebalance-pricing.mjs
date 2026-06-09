#!/usr/bin/env node
// Rebalance Pass A — Cost/CD pricing (REBALANCE-PLAN §3, directive C1).
//
// Cost (stamina/mana) is the PRIMARY balance lever; cooldown stays SNAPPY.
// Tier does NOT mean longer CD: compress every cooldown into a snappy band so
// T3's long-CD tax — the root cause of the T3<T2 output-per-second inversion —
// is removed (this asymmetrically lifts T3, whose CDs were 2.7–3.5 vs T2's
// ≤2.0). Spam outliers are tamed by raising COST + the 1.2s CD floor, never by
// long cooldowns.
//
// Cost/CD do NOT appear in the baked card description (formatCardDescription
// ignores them), so NO description regen is needed after this pass.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsPath = resolve(__dirname, '..', 'src', 'data', 'json', 'cards.json');
const data = JSON.parse(readFileSync(cardsPath, 'utf-8'));

const PHYS = new Set(['attack', 'defense', 'agility', 'counter']);

// CD bands (seconds).
const CD_FLOOR = 1.2;          // no sub-1.2 spam
const CD_CEIL = 2.4;           // non-exhaust: snappy, no long-CD tax
const CD_CEIL_EXHAUST = 2.8;   // one-shots may run a touch longer

// Explicit per-card overrides (applied AFTER the general clamp; win ties).
// Spam outliers → taxed by COST. Weak long-CD bombs → CD cut below the ceiling.
const OVERRIDES = {
  't2-agility-attack':          { cost: { stamina: 2 } },          // Quickstrike (was s1/cd0.8 → 72.5 OPS)
  't2-air-counter':             { cost: { stamina: 1 } },          // Hollow Echo (was FREE-cost)
  't3-agility-agility-agility': { cost: { stamina: 2 } },          // Quickstep Sigil (deck-wide haste)
  't3-agility-air-attack':      { cost: { stamina: 2, mana: 1 } }, // Skywire (honest COST-3 burst)
  't3-counter-counter-defense': { cooldown: 2.0 },                 // Wrathshell Vow (was cd10!)
  't3-attack-fire-water':       { cooldown: 2.4, cost: { stamina: 2 } }, // Tremor Detonate (was s3/cd5.5)
  't3-air-earth-water':         { cooldown: 2.4 },                 // Marsh Squall (was cd5)
};

// Free-cost cards re-enter the regen economy, EXCEPT intentional pure-utility.
const FREE_WHITELIST = new Set(['t1-air']);

function dominantResource(card) {
  let phys = 0, elem = 0;
  for (const e of card.elements ?? []) (PHYS.has(e) ? phys++ : elem++);
  return elem > phys ? 'mana' : 'stamina';
}

let cdChanged = 0, costChanged = 0, freed = 0;
const examples = [];
for (const card of data.cards) {
  const beforeCd = card.cooldown;
  const beforeCost = JSON.stringify(card.cost ?? null);

  // 1. CD clamp (exhaust keeps its floor; only the ceiling bites).
  const ceil = card.exhaust ? CD_CEIL_EXHAUST : CD_CEIL;
  let cd = card.cooldown ?? 1.6;
  cd = Math.min(ceil, card.exhaust ? cd : Math.max(CD_FLOOR, cd));
  card.cooldown = Math.round(cd * 10) / 10;

  // 2. Free-cost fix.
  const totalCost = (card.cost?.stamina ?? 0) + (card.cost?.mana ?? 0) + (card.cost?.defense ?? 0);
  if (totalCost === 0 && !FREE_WHITELIST.has(card.id)) {
    card.cost = { ...(card.cost ?? {}), [dominantResource(card)]: 1 };
    freed++;
  }

  // 3. Overrides win.
  const ov = OVERRIDES[card.id];
  if (ov) {
    if (ov.cooldown !== undefined) card.cooldown = ov.cooldown;
    if (ov.cost) card.cost = { ...ov.cost };
  }

  if (card.cooldown !== beforeCd) cdChanged++;
  if (JSON.stringify(card.cost ?? null) !== beforeCost) {
    costChanged++;
    if (examples.length < 8) examples.push(`${card.id}: cd ${beforeCd}->${card.cooldown}, cost ${beforeCost}->${JSON.stringify(card.cost)}`);
  }
}

writeFileSync(cardsPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`Pricing pass: ${cdChanged} CD changes, ${costChanged} cost changes, ${freed} free cards costed.`);
for (const e of examples) console.log('  ' + e);
