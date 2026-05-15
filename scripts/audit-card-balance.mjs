#!/usr/bin/env node
// Auditing script for card balance.
// Reads src/data/json/cards.json, computes a "power score" per card,
// and reports out-of-band cards plus tier-1/tier-2 dominance violations.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsPath = resolve(__dirname, '..', 'src', 'data', 'json', 'cards.json');
const data = JSON.parse(readFileSync(cardsPath, 'utf-8'));

const BANDS = {
  1: { low: 4, high: 12 },
  2: { low: 10, high: 22 },
};

// Compute one card's power score.
// Formula (per task spec, baseline):
//   +1 per damage
//   +0.8 per armor
//   +1.2 per heal
//   +2 per DoT stack (any)
//   +1.5 per stat-scaling unit (+N per stat point)
//   +1 per +1 stamina/mana gain
//   -0.6 per 1 stamina cost
//   -0.6 per 1 mana cost
//   (no defense cost in our data, so the -0.8 rule is unused)
//   CD-vs-baseline (1.0s): -0.3 per 0.1s slower, +1 per 0.1s faster
//   AoE: x1.4 multiplier on damage portion only
//   Self-targeted utility: x1.0 baseline (no penalty/bonus)
export function scoreCard(card) {
  let s = 0;
  const isAoe = card.targeting === 'aoe';

  for (const e of card.effects || []) {
    const v = e.value || 0;
    switch (e.type) {
      case 'damage': {
        const base = v * 1;
        s += isAoe ? base * 1.4 : base;
        break;
      }
      case 'armor': {
        s += v * 0.8;
        break;
      }
      case 'heal': {
        s += v * 1.2;
        break;
      }
      case 'dot': {
        // DoT stacks are worth ~2 per stack (more if AoE)
        const base = v * 2;
        s += isAoe ? base * 1.4 : base;
        break;
      }
      case 'stamina':
      case 'mana': {
        // Resource generation (positive value = gain for self)
        s += v * 1;
        break;
      }
      case 'buff': {
        // Stat buffs: treat each +stat as worth ~1.5
        s += v * 1.5;
        break;
      }
      case 'stack': {
        // Rage/arcane stacks: each stack worth ~2 (DoT-equivalent)
        s += v * 2;
        break;
      }
      case 'debuff': {
        // Enemy debuff: each point worth ~1.2 (slightly more than damage,
        // because it lingers)
        const base = v * 1.2;
        s += isAoe ? base * 1.4 : base;
        break;
      }
    }
    // Stat scaling bonus
    if (e.scale && typeof e.scale.value === 'number') {
      s += e.scale.value * 1.5;
    }
  }

  // Costs (negative contributions)
  if (card.cost) {
    s -= (card.cost.stamina || 0) * 0.6;
    s -= (card.cost.mana || 0) * 0.6;
    s -= (card.cost.defense || 0) * 0.8;
  }

  // Cooldown
  const cd = card.cooldown ?? 1;
  // 1.0s baseline; faster = bonus, slower = penalty
  // Below 1.0s: +1 per 0.1s faster
  // Above 1.0s: -0.3 per 0.1s slower
  const cdDiffTenths = Math.round((cd - 1.0) * 10);
  if (cdDiffTenths < 0) {
    s += -cdDiffTenths * 1;
  } else if (cdDiffTenths > 0) {
    s -= cdDiffTenths * 0.3;
  }

  return Math.round(s * 10) / 10;
}

// Returns the canonical pair-key for a card (sorted, deduped elements joined).
function elementMultiset(card) {
  return [...(card.elements || [])].sort();
}

// Compute aggregated stat block for a card (used for dominance test).
function statBlock(card) {
  let dmg = 0,
    armor = 0,
    heal = 0,
    dot = 0,
    stam = 0,
    mana = 0,
    buff = 0,
    stack = 0,
    debuff = 0;
  for (const e of card.effects || []) {
    const v = e.value || 0;
    switch (e.type) {
      case 'damage':
        dmg += v;
        break;
      case 'armor':
        armor += v;
        break;
      case 'heal':
        heal += v;
        break;
      case 'dot':
        dot += v;
        break;
      case 'stamina':
        stam += v;
        break;
      case 'mana':
        mana += v;
        break;
      case 'buff':
        buff += v;
        break;
      case 'stack':
        stack += v;
        break;
      case 'debuff':
        debuff += v;
        break;
    }
  }
  return {
    dmg,
    armor,
    heal,
    dot,
    stam,
    mana,
    buff,
    stack,
    debuff,
    cost: (card.cost?.stamina || 0) + (card.cost?.mana || 0),
    cd: card.cooldown ?? 1,
    aoe: card.targeting === 'aoe' ? 1 : 0,
  };
}

// "Strict dominance" between two cards on same-or-similar effect axes.
// Returns true if `a` is strictly better than `b` (or equal-or-better on
// every axis the user listed, with strictly better on at least one).
function dominates(a, b) {
  const A = statBlock(a);
  const B = statBlock(b);

  // Lower-is-better axes (cost, cd)
  const aLeq = (k) => A[k] <= B[k];
  // Higher-is-better axes (impact)
  const aGeq = (k) => A[k] >= B[k];

  // a must be <= b on cost & cd (cheaper / faster or same)
  const cheaperOrSame = aLeq('cost') && aLeq('cd');
  // a must be >= b on every impact axis
  const impactKeys = ['dmg', 'armor', 'heal', 'dot', 'stam', 'mana', 'buff', 'stack', 'debuff'];
  const impactGeq = impactKeys.every(aGeq);
  // a must be strictly better on at least one axis
  const strictlyBetter =
    A.cost < B.cost ||
    A.cd < B.cd ||
    impactKeys.some((k) => A[k] > B[k]);

  return cheaperOrSame && impactGeq && strictlyBetter;
}

// MAIN
const t1 = data.cards.filter((c) => c.tier === 1);
const t2 = data.cards.filter((c) => c.tier === 2);

const oob = [];
const allScores = data.cards.map((c) => ({ id: c.id, name: c.name, tier: c.tier, score: scoreCard(c) }));

for (const row of allScores) {
  const band = BANDS[row.tier];
  if (!band) continue;
  if (row.score < band.low || row.score > band.high) oob.push(row);
}

// "Sanity rule" violations:
// (a) Any t1 card whose score >= some t2 card's score (where t2 contains
//     a strict superset of t1's elements) — t2 should outscore t1.
// (b) Strict-dominance: any t1 -> t2 pair where t1 dominates the t2 on
//     numeric axes despite being a lower tier.
// (c) DoT caps: t1 dot total >3 OR t2 dot total >6.
// (d) Heal caps: t1 heal >12 OR t2 heal >22.
const violations = [];

// Heal/DoT caps
for (const c of t1) {
  const b = statBlock(c);
  if (b.dot > 3) violations.push({ kind: 'dot-cap-t1', id: c.id, value: b.dot });
  if (b.heal > 12) violations.push({ kind: 'heal-cap-t1', id: c.id, value: b.heal });
}
for (const c of t2) {
  const b = statBlock(c);
  if (b.dot > 6) violations.push({ kind: 'dot-cap-t2', id: c.id, value: b.dot });
  if (b.heal > 22) violations.push({ kind: 'heal-cap-t2', id: c.id, value: b.heal });
}

// Sanity rule: for every t2 with 3 elements, if its dominant 2-element subset
// matches a t1 card, the t2 should score strictly higher.
function dominantTwo(elements) {
  // Pick the multiset of size 2 with the highest duplicate first, else
  // the first two alphabetically.
  const counts = {};
  for (const e of elements) counts[e] = (counts[e] || 0) + 1;
  const sorted = Object.entries(counts).sort(
    ([a, ca], [b, cb]) => cb - ca || a.localeCompare(b)
  );
  // Take pairs by count
  const result = [];
  for (const [el, count] of sorted) {
    for (let i = 0; i < count && result.length < 2; i++) result.push(el);
  }
  return result.slice(0, 2).sort();
}

const t1ById = new Map(t1.map((c) => [c.id, c]));
for (const c2 of t2) {
  const dom = dominantTwo(c2.elements || []);
  const t1Id = `t1-${dom[0]}-${dom[1]}`;
  const c1 = t1ById.get(t1Id);
  if (!c1) continue;
  const s1 = scoreCard(c1);
  const s2 = scoreCard(c2);
  if (s1 >= s2) {
    violations.push({
      kind: 'tier-ordering',
      t1: c1.id,
      t2: c2.id,
      s1,
      s2,
    });
  }
}

// Dominance: any t1 strictly dominating ANY t2.
for (const c1 of t1) {
  for (const c2 of t2) {
    if (dominates(c1, c2)) {
      violations.push({
        kind: 'dominance-t1-over-t2',
        t1: c1.id,
        t2: c2.id,
      });
    }
  }
}

// T1 strictly dominating T1 (no T1 may strictly dominate another T1)
for (const a of t1) {
  for (const b of t1) {
    if (a.id === b.id) continue;
    if (dominates(a, b)) {
      violations.push({ kind: 'dominance-t1-over-t1', a: a.id, b: b.id });
    }
  }
}

// Report
const tier1Scores = allScores.filter((r) => r.tier === 1).map((r) => r.score);
const tier2Scores = allScores.filter((r) => r.tier === 2).map((r) => r.score);
const summary = {
  totalCards: data.cards.length,
  tier1: {
    count: t1.length,
    min: Math.min(...tier1Scores),
    max: Math.max(...tier1Scores),
    band: BANDS[1],
  },
  tier2: {
    count: t2.length,
    min: Math.min(...tier2Scores),
    max: Math.max(...tier2Scores),
    band: BANDS[2],
  },
  outOfBand: oob.length,
  violations: violations.length,
};

console.log('=== Summary ===');
console.log(JSON.stringify(summary, null, 2));

if (oob.length) {
  console.log('\n=== Out-of-band cards ===');
  for (const r of oob) {
    const band = BANDS[r.tier];
    console.log(
      `${r.tier}\t${r.id}\t(${r.name})\tscore=${r.score}\tband=[${band.low},${band.high}]`
    );
  }
}

if (violations.length) {
  console.log('\n=== Violations ===');
  const counts = {};
  for (const v of violations) counts[v.kind] = (counts[v.kind] || 0) + 1;
  console.log('Counts:', counts);
  for (const v of violations.slice(0, 60)) {
    console.log(JSON.stringify(v));
  }
  if (violations.length > 60) console.log(`... and ${violations.length - 60} more`);
}

// Exit non-zero on violations.
if (oob.length || violations.length) {
  process.exitCode = 1;
}
