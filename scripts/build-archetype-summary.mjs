#!/usr/bin/env node
// Aggregates the v2 sim report into per-archetype power profiles. An
// "archetype" is a meaningful element-tag bucket (burn, bleed, poison,
// stun/slow, rage, armor/defense, heal). A card can belong to several
// buckets — it's counted in each.
//
// Writes tests/audit/archetype-summary.md so audit agents can read one
// concise document with the means/ranges for each archetype.
import { readFileSync, writeFileSync } from 'node:fs';

const r = JSON.parse(readFileSync('tests/audit/sim-report-v2.json', 'utf-8'));

// Classify a card into 0+ archetype tags based on the kinds of outputs it
// has across all scenarios. Use the maximum-observed delta per stack to
// decide membership — a card that applies bleed in any scenario counts as
// a "bleed" card. Same for the others.
function maxAcross(card, key) {
  let m = 0;
  for (const s of Object.values(card.scenarios)) {
    if (typeof s?.[key] === 'number' && s[key] > m) m = s[key];
  }
  return m;
}

function archetypesOf(card) {
  const tags = [];
  if (maxAcross(card, 'enemyBurn') > 0) tags.push('burn');
  if (maxAcross(card, 'enemyBleed') > 0) tags.push('bleed');
  if (maxAcross(card, 'enemyPoison') > 0) tags.push('poison');
  if (maxAcross(card, 'enemyStun') > 0) tags.push('stun');
  if (maxAcross(card, 'enemySlow') > 0) tags.push('slow');
  if (maxAcross(card, 'heroRage') > 0) tags.push('rage');
  if (maxAcross(card, 'armorGained') >= 5) tags.push('armor');
  if (maxAcross(card, 'resultHealed') > 0) tags.push('heal');
  if (maxAcross(card, 'damageDealt') >= 10) tags.push('damage');
  // Elemental archetypes from the card's element tags
  const els = card.elements || [];
  for (const el of ['fire', 'water', 'air', 'earth']) {
    if (els.includes(el)) tags.push(`el:${el}`);
  }
  for (const el of ['attack', 'defense', 'agility', 'counter']) {
    if (els.includes(el)) tags.push(`el:${el}`);
  }
  // Functional bucket
  if (card.exhaust) tags.push('exhaust');
  if (card.category) tags.push(`cat:${card.category}`);
  // Tier
  if (card.tier) tags.push(`t${card.tier}`);
  return tags;
}

function costScore(cost) {
  if (!cost) return 0;
  return (cost.stamina ?? 0) + (cost.mana ?? 0);
}

function summarize(cards) {
  const dmgs = cards.map((c) => maxAcross(c, 'damageDealt'));
  const arms = cards.map((c) => maxAcross(c, 'armorGained'));
  const burns = cards.map((c) => maxAcross(c, 'enemyBurn'));
  const bleeds = cards.map((c) => maxAcross(c, 'enemyBleed'));
  const poisons = cards.map((c) => maxAcross(c, 'enemyPoison'));
  const heals = cards.map((c) => maxAcross(c, 'resultHealed'));
  const costs = cards.map((c) => costScore(c.cost));
  const cds = cards.map((c) => c.cooldown ?? 0);
  const m = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const mx = (a) => (a.length ? Math.max(...a) : 0);
  return {
    n: cards.length,
    avg_max_damage: +m(dmgs).toFixed(1),
    peak_damage: mx(dmgs),
    avg_max_armor: +m(arms).toFixed(1),
    peak_armor: mx(arms),
    avg_max_burn: +m(burns).toFixed(1),
    peak_burn: mx(burns),
    avg_max_bleed: +m(bleeds).toFixed(1),
    peak_bleed: mx(bleeds),
    avg_max_poison: +m(poisons).toFixed(1),
    peak_poison: mx(poisons),
    avg_heal: +m(heals).toFixed(1),
    peak_heal: mx(heals),
    avg_cost: +m(costs).toFixed(2),
    avg_cooldown: +m(cds).toFixed(2),
  };
}

const groups = new Map();
for (const card of r) {
  for (const tag of archetypesOf(card)) {
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag).push(card);
  }
}

// Output
const out = [];
out.push('# Archetype power summary (v2 sim, all 164 cards)\n');
out.push('Each archetype lists membership (cards that touch the mechanic at all), then averaged peak outputs across the 24 scenarios. "Peak" = max observed across scenarios for that metric.\n');
out.push('| Archetype | N | avg dmg | peak dmg | avg armor | peak armor | avg burn | peak burn | avg bleed | peak bleed | avg poison | peak poison | avg heal | peak heal | avg cost | avg CD |');
out.push('|-----------|--:|--------:|---------:|----------:|-----------:|---------:|----------:|----------:|-----------:|-----------:|------------:|---------:|----------:|---------:|-------:|');

const orderedTags = [
  'burn', 'bleed', 'poison', 'stun', 'slow', 'rage', 'armor', 'heal', 'damage', 'exhaust',
  'el:fire', 'el:water', 'el:air', 'el:earth',
  'el:attack', 'el:defense', 'el:agility', 'el:counter',
  'cat:attack', 'cat:defense', 'cat:magic',
  't1', 't2', 't3',
];
for (const tag of orderedTags) {
  const list = groups.get(tag);
  if (!list) continue;
  const s = summarize(list);
  out.push(`| ${tag} | ${s.n} | ${s.avg_max_damage} | ${s.peak_damage} | ${s.avg_max_armor} | ${s.peak_armor} | ${s.avg_max_burn} | ${s.peak_burn} | ${s.avg_max_bleed} | ${s.peak_bleed} | ${s.avg_max_poison} | ${s.peak_poison} | ${s.avg_heal} | ${s.peak_heal} | ${s.avg_cost} | ${s.avg_cooldown} |`);
}

out.push('\n## Cost-efficiency snapshot');
out.push('Damage per resource (peak-damage ÷ cost+1). Higher = more damage per cost. Useful for spotting under/over-tuned archetypes once you account for cost.\n');
out.push('| Archetype | N | (peak dmg) / (avg_cost + 1) | (peak armor) / (avg_cost + 1) |');
out.push('|-----------|--:|----------------------------:|------------------------------:|');
for (const tag of orderedTags) {
  const list = groups.get(tag);
  if (!list) continue;
  const s = summarize(list);
  const dpr = +(s.peak_damage / (s.avg_cost + 1)).toFixed(1);
  const apr = +(s.peak_armor / (s.avg_cost + 1)).toFixed(1);
  out.push(`| ${tag} | ${s.n} | ${dpr} | ${apr} |`);
}

writeFileSync('tests/audit/archetype-summary.md', out.join('\n') + '\n');
console.log('Wrote tests/audit/archetype-summary.md');
