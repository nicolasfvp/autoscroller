#!/usr/bin/env node
// Auto-rebalances cards.json so every card sits within its tier band
// and no tier-1 card strictly dominates another tier-1 card (or a tier-2).
//
// Strategy:
//  1) For each card outside the [low,high] band, iteratively tweak numeric
//     fields (damage, armor, heal, dot, scaling, costs, CD) until the score
//     falls inside the band. Apply changes in a fixed priority order to keep
//     the card's identity intact (i.e. don't zero out the dominant effect).
//  2) Enforce DoT caps (t1: 3, t2: 6) and Heal caps (t1: 12, t2: 22) by
//     clamping.
//  3) Re-check tier-1-vs-tier-1 dominance and bump the weaker card up
//     (or lower the dominant card's CD) to break the dominance.
//  4) Re-check tier-1-vs-tier-2 dominance — if a t1 dominates a t2, push
//     the t1 down or the t2 up just enough.
//  5) Round all numbers to integers (or .5 step) for readability.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsPath = resolve(__dirname, '..', 'src', 'data', 'json', 'cards.json');
const data = JSON.parse(readFileSync(cardsPath, 'utf-8'));

const BANDS = {
  1: { low: 4, high: 12 },
  2: { low: 10, high: 22 },
};
const CAPS = {
  1: { dot: 3, heal: 12 },
  2: { dot: 6, heal: 22 },
};

function scoreCard(card) {
  let s = 0;
  const isAoe = card.targeting === 'aoe';
  for (const e of card.effects || []) {
    const v = e.value || 0;
    switch (e.type) {
      case 'damage':
        s += isAoe ? v * 1.4 : v;
        break;
      case 'armor':
        s += v * 0.8;
        break;
      case 'heal':
        s += v * 1.2;
        break;
      case 'dot':
        s += isAoe ? v * 2 * 1.4 : v * 2;
        break;
      case 'stamina':
      case 'mana':
        s += v * 1;
        break;
      case 'buff':
        s += v * 1.5;
        break;
      case 'stack':
        s += v * 2;
        break;
      case 'debuff':
        s += isAoe ? v * 1.2 * 1.4 : v * 1.2;
        break;
    }
    if (e.scale && typeof e.scale.value === 'number') {
      s += e.scale.value * 1.5;
    }
  }
  if (card.cost) {
    s -= (card.cost.stamina || 0) * 0.6;
    s -= (card.cost.mana || 0) * 0.6;
    s -= (card.cost.defense || 0) * 0.8;
  }
  const cd = card.cooldown ?? 1;
  const cdDiffTenths = Math.round((cd - 1.0) * 10);
  if (cdDiffTenths < 0) s += -cdDiffTenths * 1;
  else if (cdDiffTenths > 0) s -= cdDiffTenths * 0.3;
  return Math.round(s * 10) / 10;
}

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

function dominates(a, b) {
  const A = statBlock(a);
  const B = statBlock(b);
  const aLeq = (k) => A[k] <= B[k];
  const aGeq = (k) => A[k] >= B[k];
  const cheaperOrSame = aLeq('cost') && aLeq('cd');
  const impactKeys = ['dmg', 'armor', 'heal', 'dot', 'stam', 'mana', 'buff', 'stack', 'debuff'];
  const impactGeq = impactKeys.every(aGeq);
  const strictlyBetter =
    A.cost < B.cost ||
    A.cd < B.cd ||
    impactKeys.some((k) => A[k] > B[k]);
  return cheaperOrSame && impactGeq && strictlyBetter;
}

// --- Mutators ---
// Sorted in order of preference: the FIRST applicable mutator runs first.
function findLargestEffect(card, type) {
  let best = null;
  for (const e of card.effects || []) {
    if (e.type !== type) continue;
    if (!best || e.value > best.value) best = e;
  }
  return best;
}
function totalOf(card, type) {
  let t = 0;
  for (const e of card.effects || []) if (e.type === type) t += e.value || 0;
  return t;
}
function decEffect(card, type, min = 1) {
  const e = findLargestEffect(card, type);
  if (!e || e.value <= min) return false;
  e.value -= 1;
  return true;
}
function incEffect(card, type, max = 50) {
  const e = findLargestEffect(card, type);
  if (!e || e.value >= max) return false;
  e.value += 1;
  return true;
}
function decAllScales(card) {
  let any = false;
  for (const e of card.effects || []) {
    if (e.scale && e.scale.value > 0) {
      e.scale.value -= 1;
      if (e.scale.value === 0) delete e.scale;
      any = true;
    }
  }
  return any;
}
function incAllScales(card) {
  let any = false;
  for (const e of card.effects || []) {
    if (e.scale && e.scale.value > 0 && e.scale.value < 4) {
      e.scale.value += 1;
      any = true;
    }
  }
  return any;
}
function incCost(card, key) {
  if (!card.cost) card.cost = {};
  card.cost[key] = (card.cost[key] || 0) + 1;
  return true;
}
function decCost(card, key) {
  if (!card.cost || !card.cost[key]) return false;
  card.cost[key] -= 1;
  if (card.cost[key] <= 0) delete card.cost[key];
  if (Object.keys(card.cost).length === 0) delete card.cost;
  return true;
}
function incCD(card) {
  const cd = card.cooldown ?? 1;
  if (cd >= 2.5) return false;
  card.cooldown = Math.round((cd + 0.1) * 10) / 10;
  return true;
}
function decCD(card) {
  const cd = card.cooldown ?? 1;
  if (cd <= 0.6) return false;
  card.cooldown = Math.round((cd - 0.1) * 10) / 10;
  return true;
}

// --- Cap enforcement ---
function clampDotsToCap(card, cap) {
  // If total DoT > cap, reduce largest dot effect first.
  let changed = false;
  while (totalOf(card, 'dot') > cap) {
    const e = findLargestEffect(card, 'dot');
    if (!e || e.value <= 1) break;
    e.value -= 1;
    changed = true;
  }
  return changed;
}
function clampHealToCap(card, cap) {
  let changed = false;
  while (totalOf(card, 'heal') > cap) {
    const e = findLargestEffect(card, 'heal');
    if (!e || e.value <= 1) break;
    e.value -= 1;
    changed = true;
  }
  return changed;
}

// --- Rebalance pass ---
// Brings a card's score into [low, high] by proportionally shrinking
// (or growing) numeric fields. Preserves identity by:
//   - Never letting any effect drop below 50% of its original value (rounded)
//   - Spreading reductions across all effects (round-robin from largest)
//   - Preferring small CD bumps over cost jumps when within reason
function rebalanceCard(card, originalEffects, originalCost, originalCD, relaxFloor = false) {
  const band = BANDS[card.tier];
  if (!band) return false;

  let changed = false;
  // First: hard caps
  const caps = CAPS[card.tier];
  if (caps) {
    if (clampDotsToCap(card, caps.dot)) changed = true;
    if (clampHealToCap(card, caps.heal)) changed = true;
  }

  // Identity floor: each effect must keep at least 50% of its original
  // value (min 1). When relaxFloor is true, allow 25% (min 1) so we can
  // push cards harder back into band after dominance bumps.
  const floorRatio = relaxFloor ? 0.25 : 0.5;
  const floorFor = (origEff) =>
    Math.max(1, Math.ceil((origEff?.value ?? 1) * floorRatio));

  function canDec(card, type) {
    // Iterate matching effects largest-first; return the one above floor.
    const matches = (card.effects || []).filter((e) => e.type === type);
    matches.sort((a, b) => b.value - a.value);
    for (const e of matches) {
      const orig = originalEffects.find(
        (o) => o.type === e.type && o.stack === e.stack && o.target === e.target
      );
      if (e.value > floorFor(orig)) return e;
    }
    return null;
  }
  function decRespectingFloor(card, type) {
    const e = canDec(card, type);
    if (!e) return false;
    e.value -= 1;
    return true;
  }

  // Iterate shrinking. Priority weighted by "how much score gained per unit":
  //   damage (aoe x1.4), armor (x0.8), heal (x1.2), dot (x2 or x2.8 aoe),
  //   scale (x1.5 per unit), buff (x1.5), stack (x2), debuff (x1.2/x1.68),
  //   resource gen (x1).
  // We shrink the BIGGEST scorer first to make fast progress without
  // wrecking small flavor effects.
  function shrinkOneStep() {
    const candidates = [];
    const isAoe = card.targeting === 'aoe';
    for (const e of card.effects || []) {
      const orig = originalEffects.find(
        (o) => o.type === e.type && o.stack === e.stack && o.target === e.target
      );
      const floor = floorFor(orig);
      if (e.value <= floor) continue;
      let weight = 0;
      switch (e.type) {
        case 'damage':
          weight = isAoe ? 1.4 : 1;
          break;
        case 'armor':
          weight = 0.8;
          break;
        case 'heal':
          weight = 1.2;
          break;
        case 'dot':
          weight = isAoe ? 2.8 : 2;
          break;
        case 'buff':
          weight = 1.5;
          break;
        case 'stack':
          weight = 2;
          break;
        case 'debuff':
          weight = isAoe ? 1.68 : 1.2;
          break;
        default:
          weight = 1;
      }
      candidates.push({ e, weight });
    }
    if (candidates.length === 0) return false;
    candidates.sort((a, b) => b.weight - a.weight);
    candidates[0].e.value -= 1;
    return true;
  }

  function shrinkScale() {
    // Shrink scaling values evenly: target the highest scale first.
    const withScale = (card.effects || []).filter(
      (e) => e.scale && typeof e.scale.value === 'number' && e.scale.value > 0
    );
    if (withScale.length === 0) return false;
    withScale.sort((a, b) => b.scale.value - a.scale.value);
    const e = withScale[0];
    const origEff = originalEffects.find(
      (o) => o.type === e.type && o.stack === e.stack && o.target === e.target
    );
    const origScale = origEff?.scale?.value ?? 1;
    const floor = Math.max(1, Math.ceil(origScale * 0.5));
    if (e.scale.value <= floor) return false;
    e.scale.value -= 1;
    return true;
  }

  function bumpCD() {
    const cd = card.cooldown ?? 1;
    // Don't push CD past 2.5s for any tier.
    if (cd >= 2.5) return false;
    // Only bump CD if it stays within +0.5s of original.
    if (cd >= (originalCD ?? 1) + 0.5) return false;
    card.cooldown = Math.round((cd + 0.1) * 10) / 10;
    return true;
  }

  function bumpCost() {
    // Choose mana for elemental-dominant cards, stamina for physical-dominant.
    const elementals = ['fire', 'water', 'air', 'earth'];
    const elemCount = (card.elements || []).filter((e) => elementals.includes(e)).length;
    const useMana = elemCount >= (card.elements?.length || 0) / 2;
    const key = useMana ? 'mana' : 'stamina';
    const origVal = originalCost?.[key] || 0;
    const curVal = card.cost?.[key] || 0;
    // Limit cost growth: at most +2 over original.
    if (curVal >= origVal + 2) return false;
    // Cap absolute cost at 5 for tier 1, 6 for tier 2.
    const maxCost = card.tier === 1 ? 4 : 6;
    if (curVal >= maxCost) return false;
    incCost(card, key);
    return true;
  }

  // Iterate shrinking until score <= high.
  // Order: shrinkOneStep -> shrinkScale -> bumpCD -> bumpCost
  let safety = 300;
  while (scoreCard(card) > band.high && safety-- > 0) {
    if (shrinkOneStep()) {
      changed = true;
      continue;
    }
    if (shrinkScale()) {
      changed = true;
      continue;
    }
    if (bumpCD()) {
      changed = true;
      continue;
    }
    if (bumpCost()) {
      changed = true;
      continue;
    }
    break;
  }

  // Grow priority (rare; only if score < low) — only grows up to original values
  function growOneStep() {
    const candidates = [];
    const isAoe = card.targeting === 'aoe';
    for (const e of card.effects || []) {
      const orig = originalEffects.find(
        (o) => o.type === e.type && o.stack === e.stack && o.target === e.target
      );
      const origV = orig?.value ?? e.value;
      const ceilV = Math.max(origV, e.value); // can grow back to original
      // Respect tier caps
      if (e.type === 'dot' && totalOf(card, 'dot') >= (caps?.dot ?? 99)) continue;
      if (e.type === 'heal' && totalOf(card, 'heal') >= (caps?.heal ?? 99)) continue;
      if (e.value >= ceilV) continue;
      let weight = 0;
      switch (e.type) {
        case 'damage':
          weight = isAoe ? 1.4 : 1;
          break;
        case 'armor':
          weight = 0.8;
          break;
        case 'heal':
          weight = 1.2;
          break;
        case 'dot':
          weight = isAoe ? 2.8 : 2;
          break;
        case 'buff':
          weight = 1.5;
          break;
        case 'stack':
          weight = 2;
          break;
        case 'debuff':
          weight = isAoe ? 1.68 : 1.2;
          break;
        default:
          weight = 1;
      }
      candidates.push({ e, weight });
    }
    if (candidates.length === 0) return false;
    candidates.sort((a, b) => b.weight - a.weight);
    candidates[0].e.value += 1;
    return true;
  }

  safety = 300;
  while (scoreCard(card) < band.low && safety-- > 0) {
    if (growOneStep()) {
      changed = true;
      continue;
    }
    // Try dropping a cost
    if (decCost(card, 'mana') || decCost(card, 'stamina')) {
      changed = true;
      continue;
    }
    // Try dropping CD (but not below 0.6)
    if (decCD(card)) {
      changed = true;
      continue;
    }
    break;
  }

  return changed;
}

// --- Description patcher ---
// Surgically updates the numeric portions of the description so the blurb
// reflects post-rebalance values while preserving the original flavor text.
// We rely on the BEFORE snapshot of effects to find the OLD number, then
// replace its FIRST occurrence in the description.
function patchDescription(card, beforeEffects) {
  if (!card.description) return;
  let desc = card.description;
  const replacements = [];
  // Build matching from beforeEffects to current effects by (type, stack)
  const after = card.effects || [];
  // For each before effect, find a corresponding after effect with same
  // type & stack & target.
  const usedAfter = new Set();
  for (let i = 0; i < beforeEffects.length; i++) {
    const beforeEff = beforeEffects[i];
    let match = -1;
    for (let j = 0; j < after.length; j++) {
      if (usedAfter.has(j)) continue;
      if (after[j].type !== beforeEff.type) continue;
      if (after[j].stack !== beforeEff.stack) continue;
      if (after[j].target !== beforeEff.target) continue;
      match = j;
      break;
    }
    if (match >= 0) {
      usedAfter.add(match);
      const oldV = beforeEff.value;
      const newV = after[match].value;
      if (oldV !== newV) {
        replacements.push({ type: beforeEff.type, stack: beforeEff.stack, old: oldV, neu: newV });
      }
    }
  }
  // Apply replacements one at a time, careful with overlap (e.g. "8" vs "18").
  // For each replacement, find the most distinctive surrounding token.
  for (const r of replacements) {
    let pattern;
    if (r.type === 'damage') pattern = new RegExp(`\\b${r.old}\\s+damage\\b`);
    else if (r.type === 'armor') pattern = new RegExp(`\\b${r.old}\\s+Armor\\b`);
    else if (r.type === 'heal') pattern = new RegExp(`\\b${r.old}\\s+HP\\b`);
    else if (r.type === 'dot' && r.stack === 'burn') pattern = new RegExp(`\\bBurn\\s+${r.old}\\b|\\b${r.old}\\s+Burn\\b`);
    else if (r.type === 'dot' && r.stack === 'freeze') pattern = new RegExp(`\\bFreeze\\s+${r.old}\\b|\\b${r.old}\\s+Freeze\\b`);
    else if (r.type === 'dot' && r.stack === 'bleed') pattern = new RegExp(`\\bBleed\\s+${r.old}\\b|\\b${r.old}\\s+Bleed\\b`);
    else if (r.type === 'stamina') pattern = new RegExp(`\\+${r.old}\\s+Stamina\\b`);
    else if (r.type === 'mana') pattern = new RegExp(`\\+${r.old}\\s+Mana\\b`);
    else if (r.type === 'stack' && r.stack === 'rage') pattern = new RegExp(`\\+${r.old}\\s+Rage\\b`);
    else if (r.type === 'stack' && r.stack === 'arcane') pattern = new RegExp(`\\+${r.old}\\s+Arcane\\b`);
    else if (r.type === 'debuff') pattern = new RegExp(`-${r.old}\\s+Defense\\b`);
    else if (r.type === 'buff') {
      // Stat buff: "+N STR" / "+N DEX" / "+N VIT" — find any stat label
      pattern = new RegExp(`\\+${r.old}\\s+(STR|DEX|VIT|INT|SPI)\\b`);
    }
    if (!pattern) continue;
    const match = desc.match(pattern);
    if (!match) continue;
    const replaced = match[0]
      .replace(new RegExp(`\\b${r.old}\\b`), String(r.neu))
      .replace(new RegExp(`^${r.old}`), String(r.neu))
      .replace(new RegExp(`(^|[+\\-])${r.old}\\b`), (m, p1) => `${p1}${r.neu}`);
    desc = desc.replace(pattern, replaced);
  }
  card.description = desc;
}

// --- Pass 1: shrink/grow into band & enforce caps ---
const before = data.cards.map((c) => ({
  id: c.id,
  name: c.name,
  score: scoreCard(c),
  cost: JSON.parse(JSON.stringify(c.cost || {})),
  cd: c.cooldown,
  effects: JSON.parse(JSON.stringify(c.effects || [])),
  description: c.description,
}));

// Pre-compute originals so the rebalancer can honor identity floors.
const originalSnapshot = new Map();
for (const c of data.cards) {
  originalSnapshot.set(c.id, {
    effects: JSON.parse(JSON.stringify(c.effects || [])),
    cost: JSON.parse(JSON.stringify(c.cost || {})),
    cd: c.cooldown,
  });
}
for (const c of data.cards) {
  const snap = originalSnapshot.get(c.id);
  rebalanceCard(c, snap.effects, snap.cost, snap.cd);
}

// --- Pass 2: fix tier-1-over-tier-1 dominance ---
// For each (a,b) where a dominates b, prefer to *bump a's CD up by 0.1s*
// (a small differentiator), then nudge b up in impact within its band, then
// fall back to bumping a's cost.
function fixT1Dominance() {
  const t1 = data.cards.filter((c) => c.tier === 1);
  let total = 0;
  let safety = 200;
  while (safety-- > 0) {
    let foundAny = false;
    for (const a of t1) {
      for (const b of t1) {
        if (a.id === b.id) continue;
        if (!dominates(a, b)) continue;
        foundAny = true;
        let resolved = false;
        // Option 1: nudge b up by 1 in its largest impact effect (within cap and band)
        const caps = CAPS[1];
        const growOrder = ['damage', 'armor', 'heal', 'dot'];
        for (const k of growOrder) {
          const e = findLargestEffect(b, k);
          if (!e) continue;
          if (k === 'dot' && totalOf(b, 'dot') >= caps.dot) continue;
          if (k === 'heal' && totalOf(b, 'heal') >= caps.heal) continue;
          if (e.value >= 20) continue;
          e.value += 1;
          if (scoreCard(b) > BANDS[1].high) {
            e.value -= 1;
            continue;
          }
          if (!dominates(a, b)) {
            resolved = true;
            break;
          }
          // Still dominated — keep the bump for now, fall through.
          resolved = !dominates(a, b);
          break;
        }
        if (!resolved && dominates(a, b)) {
          // Option 2: increase a's CD by 0.1s if a's CD is currently <= b's
          const snapA = originalSnapshot.get(a.id);
          const cdA = a.cooldown ?? 1;
          const ceilA = (snapA?.cd ?? 1) + 0.3;
          if (cdA < 2.5 && cdA < ceilA) {
            a.cooldown = Math.round((cdA + 0.1) * 10) / 10;
            if (scoreCard(a) < BANDS[1].low) {
              a.cooldown = cdA; // revert
            } else {
              resolved = !dominates(a, b);
            }
          }
        }
        if (!resolved && dominates(a, b)) {
          // Option 3: shrink a's largest non-floor effect
          const shrinkOrder = ['damage', 'armor', 'heal', 'dot'];
          for (const k of shrinkOrder) {
            const orig = originalSnapshot.get(a.id);
            const e = findLargestEffect(a, k);
            if (!e) continue;
            const origEff = orig?.effects.find((o) => o.type === e.type && o.stack === e.stack);
            const floor = Math.max(1, Math.ceil((origEff?.value ?? 1) * 0.5));
            if (e.value <= floor) continue;
            e.value -= 1;
            if (scoreCard(a) < BANDS[1].low) {
              e.value += 1;
              continue;
            }
            resolved = !dominates(a, b);
            break;
          }
        }
        total += 1;
        if (!resolved) {
          // Final fallback: bump a's cost by 1 (cap +2 from original)
          const snapA = originalSnapshot.get(a.id);
          const useMana = a.elements?.some((e) => ['fire', 'water', 'air', 'earth'].includes(e));
          const key = useMana ? 'mana' : 'stamina';
          const origCost = snapA?.cost?.[key] || 0;
          const curCost = a.cost?.[key] || 0;
          if (curCost < origCost + 2 && curCost < 4) {
            incCost(a, key);
            if (scoreCard(a) < BANDS[1].low) decCost(a, key);
          }
        }
      }
    }
    if (!foundAny) break;
  }
  return total;
}

// --- Pass 3: fix tier-1 dominating any tier-2 ---
function fixT1OverT2() {
  const t1 = data.cards.filter((c) => c.tier === 1);
  const t2 = data.cards.filter((c) => c.tier === 2);
  let total = 0;
  let safety = 80;
  while (safety-- > 0) {
    let foundAny = false;
    for (const a of t1) {
      for (const b of t2) {
        if (!dominates(a, b)) continue;
        foundAny = true;
        // Push b up in damage/armor/heal/dot within t2 band+cap
        const caps = CAPS[2];
        const growOrder = ['damage', 'armor', 'heal', 'dot'];
        let pushed = false;
        for (const k of growOrder) {
          const e = findLargestEffect(b, k);
          if (!e) continue;
          if (k === 'dot' && totalOf(b, 'dot') >= caps.dot) continue;
          if (k === 'heal' && totalOf(b, 'heal') >= caps.heal) continue;
          if (e.value >= 30) continue;
          e.value += 1;
          if (scoreCard(b) > BANDS[2].high) {
            e.value -= 1;
            continue;
          }
          pushed = true;
          break;
        }
        if (!pushed) {
          // Lower b's cost or CD
          if (decCost(b, 'mana') || decCost(b, 'stamina') || decCD(b)) {
            if (scoreCard(b) > BANDS[2].high) {
              // revert
              incCost(b, 'mana');
            }
          } else {
            // last resort: push a up in cost
            incCost(a, 'stamina');
            if (scoreCard(a) < BANDS[1].low) decCost(a, 'stamina');
          }
        }
        total += 1;
      }
    }
    if (!foundAny) break;
  }
  return total;
}

// --- Pass 4: fix tier-ordering (t2 with same dominant 2-element subset must outscore the t1) ---
function dominantTwo(elements) {
  const counts = {};
  for (const e of elements) counts[e] = (counts[e] || 0) + 1;
  const sorted = Object.entries(counts).sort(
    ([a, ca], [b, cb]) => cb - ca || a.localeCompare(b)
  );
  const result = [];
  for (const [el, count] of sorted) {
    for (let i = 0; i < count && result.length < 2; i++) result.push(el);
  }
  return result.slice(0, 2).sort();
}
function fixTierOrdering() {
  const t1 = data.cards.filter((c) => c.tier === 1);
  const t2 = data.cards.filter((c) => c.tier === 2);
  const t1ById = new Map(t1.map((c) => [c.id, c]));
  let total = 0;
  let safety = 50;
  while (safety-- > 0) {
    let foundAny = false;
    for (const c2 of t2) {
      const dom = dominantTwo(c2.elements || []);
      const t1Id = `t1-${dom[0]}-${dom[1]}`;
      const c1 = t1ById.get(t1Id);
      if (!c1) continue;
      const s1 = scoreCard(c1);
      const s2 = scoreCard(c2);
      if (s1 >= s2) {
        foundAny = true;
        total += 1;
        // Push t2 up
        const caps = CAPS[2];
        const growOrder = ['damage', 'armor', 'heal', 'dot'];
        let pushed = false;
        for (const k of growOrder) {
          const e = findLargestEffect(c2, k);
          if (!e) continue;
          if (k === 'dot' && totalOf(c2, 'dot') >= caps.dot) continue;
          if (k === 'heal' && totalOf(c2, 'heal') >= caps.heal) continue;
          if (e.value >= 30) continue;
          e.value += 1;
          if (scoreCard(c2) > BANDS[2].high) {
            e.value -= 1;
            continue;
          }
          pushed = true;
          break;
        }
        if (!pushed) {
          // Lower c1 within band
          const shrinkOrder = ['damage', 'armor', 'heal', 'dot'];
          let shrunk = false;
          for (const k of shrinkOrder) {
            const e = findLargestEffect(c1, k);
            if (!e || e.value <= 1) continue;
            e.value -= 1;
            if (scoreCard(c1) < BANDS[1].low) {
              e.value += 1;
              continue;
            }
            shrunk = true;
            break;
          }
        }
      }
    }
    if (!foundAny) break;
  }
  return total;
}

// Run all passes
fixT1Dominance();
fixT1OverT2();
fixTierOrdering();
// Second sweep of dominance after ordering tweaks
fixT1Dominance();
fixT1OverT2();
// Final shrink: any card pushed above its band by dominance bumps
// gets one more rebalance pass — with relaxed identity floor (25%)
// so we can always force back into band.
for (const c of data.cards) {
  const band = BANDS[c.tier];
  if (!band) continue;
  if (scoreCard(c) > band.high) {
    const snap = originalSnapshot.get(c.id);
    rebalanceCard(c, snap.effects, snap.cost, snap.cd, /*relaxFloor*/ true);
  }
}
// Final pass: enforce caps once more
for (const c of data.cards) {
  const caps = CAPS[c.tier];
  if (caps) {
    clampDotsToCap(c, caps.dot);
    clampHealToCap(c, caps.heal);
  }
}

// Patch descriptions on every card using the original "before" snapshot.
// This preserves the original flavor text but updates the numeric values.
for (let i = 0; i < data.cards.length; i++) {
  const c = data.cards[i];
  const bef = before[i];
  patchDescription(c, bef.effects);
}

// Round all numeric values to integers
for (const c of data.cards) {
  for (const e of c.effects || []) {
    if (typeof e.value === 'number') e.value = Math.max(0, Math.round(e.value));
  }
  if (c.cost) {
    for (const k of Object.keys(c.cost)) c.cost[k] = Math.max(0, Math.round(c.cost[k]));
  }
  if (typeof c.cooldown === 'number') c.cooldown = Math.round(c.cooldown * 10) / 10;
}

// Write out
writeFileSync(cardsPath, JSON.stringify(data, null, 2) + '\n');

// Diff report
const after = data.cards.map((c) => ({
  id: c.id,
  name: c.name,
  score: scoreCard(c),
  cost: JSON.parse(JSON.stringify(c.cost || {})),
  cd: c.cooldown,
  effects: JSON.parse(JSON.stringify(c.effects || [])),
  description: c.description,
}));

const diffs = [];
for (let i = 0; i < before.length; i++) {
  const a = before[i];
  const b = after[i];
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    diffs.push({ id: a.id, beforeScore: a.score, afterScore: b.score });
  }
}
console.log(`Cards adjusted: ${diffs.length} / ${data.cards.length}`);
const sorted = diffs
  .map((d) => ({ ...d, diff: Math.abs(d.afterScore - d.beforeScore) }))
  .sort((a, b) => b.diff - a.diff);
console.log('\nTop 10 most-changed:');
for (const d of sorted.slice(0, 10)) {
  console.log(
    `  ${d.id}\tbefore=${d.beforeScore}\tafter=${d.afterScore}\t(Δ=${d.diff.toFixed(1)})`
  );
}
