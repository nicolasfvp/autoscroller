#!/usr/bin/env node
// Balance metrics engine.
//
// Reads src/data/json/cards.json + tests/audit/sim-report-v2.json and produces
// a DoT-aware "output per second" (OPS) model per card, plus archetype/tier
// rollups and tier-inversion flags. Writes tests/audit/balance-metrics.json.
//
// WHY a new metric (vs scripts/audit-card-balance.mjs):
//   - The old power score ignores cooldown-as-divisor and prices every DoT
//     stack at a flat ~2. But the engine's DoTs are NON-LINEAR:
//       poison: deals `stacks`/tick, decays 1 per 2 ticks   -> total ~= n*(n+1)   (quadratic)
//       bleed:  deals `stacks`*~1.5/tick, decays 1/tick      -> total ~= 0.75*n*(n+1)
//       slow:   deals `stacks`/tick, decays 1/tick (+enemy slow) -> dmg ~= n*(n+1)/2
//       burn:   deals min(stacks,8)/tick, NO decay (consumed only by Pyre)
//       stun:   no damage; freezes enemy cooldown (pure mitigation)
//   - Output-per-second is per-cast value / cooldown, gated by cost vs regen
//     (1 stamina + 1 mana per 4500ms passive, + floor(SPI/2) stam & floor(INT/2)
//     mana per deck cycle).
//
// These conversions are HEURISTICS for triage/ranking, not verdicts. Burn in
// particular is fight-length-dependent; see `burnNote`.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const cards = JSON.parse(readFileSync(resolve(root, 'src/data/json/cards.json'), 'utf-8')).cards;
const sim = JSON.parse(readFileSync(resolve(root, 'tests/audit/sim-report-v2.json'), 'utf-8'));
const simById = new Map(sim.map((s) => [s.id, s]));

// ---- DoT damage-equivalent model (greenfield, from 0 stacks) ----
const BURN_PER_STACK_EQUIV = 4; // sustained tick, soft-capped (8+floor((n-8)/2)); bank-and-cash
function dotDamageEquiv(stack, n) {
  if (!n || n <= 0) return 0;
  switch (stack) {
    case 'poison': return n * (n + 1);          // quadratic; wall-clock realized, chunk-capped 60
    case 'bleed':  return 0.75 * n * (n + 1);   // avg 1.5/stack, decays 1/tick; gate-only payoffs
    case 'slow':   return 0;                     // REBALANCE: slow deals NO damage now — pure soft control (see slowUtility)
    case 'burn':   return Math.min(n, 8) * BURN_PER_STACK_EQUIV;
    default: return 0;
  }
}
// Pure-control / mitigation value (kept separate from damage-equivalent). Slow &
// stun no longer deal damage; their value is denied/throttled enemy output.
function stunValue(n) { return n > 0 ? n * 6 : 0; }   // ~1 denied enemy attack/stack (hard control)
function slowUtility(n) { return n > 0 ? n * 2 : 0; } // soft control: 8%/stack cd-throttle, cap 50%

// ---- archetype tagging ----
const STACKS = ['poison', 'bleed', 'burn', 'slow', 'stun', 'rage'];
function archetypeTags(card) {
  const tags = new Set();
  const walk = (effs) => {
    for (const e of effs || []) {
      if (!e) continue;
      if (e.type === 'damage' && e.target !== 'self') tags.add('damage');
      if (e.type === 'armor') tags.add('armor');
      if (e.type === 'heal') tags.add('heal');
      if (e.type === 'buff' || e.type === 'stat_gain') tags.add('scaling');
      const stk = e.stack || e.from || e.to;
      if (stk && STACKS.includes(stk)) tags.add(stk);
      if (e.consume_stack_value) tags.add(e.consume_stack_value);
      if (e.condition?.enemy_has_stack) tags.add(e.condition.enemy_has_stack);
      if (e.condition?.self_has_stack) tags.add(e.condition.self_has_stack);
      if (e.then) walk(Array.isArray(e.then) ? e.then : [e.then]);
    }
  };
  walk(card.effects);
  if (card.exhaust) tags.add('exhaust');
  return [...tags];
}

// Does the card's payoff depend on pre-existing enemy/self stacks? (detonator/synergy)
function isConditional(card) {
  return (card.effects || []).some(
    (e) => e?.condition?.enemy_has_stack || e?.condition?.self_has_stack ||
           e?.consume_stack_value || e?.condition?.enemy_stack_atleast ||
           e?.condition?.self_stack_atleast || e?.consume_stack,
  );
}

// ---- composite value for one sim scenario delta ----
function scenarioValue(d) {
  if (!d || d.error) return 0;
  const dmg = Math.max(0, d.resultTotalDamage || 0);
  const armor = Math.max(0, d.resultArmorGained || d.armorGained || 0);
  const heal = Math.max(0, d.resultHealed || 0);
  const burn = dotDamageEquiv('burn', d.enemyBurn);
  const bleed = dotDamageEquiv('bleed', d.enemyBleed);
  const poison = dotDamageEquiv('poison', d.enemyPoison);
  const slow = dotDamageEquiv('slow', d.enemySlow) + slowUtility(d.enemySlow);
  const stun = stunValue(d.enemyStun);
  const rage = Math.max(0, d.heroRage || 0) * 2; // rage ~ pending damage/buff
  // self damage is a cost, not value
  const selfDmgPenalty = Math.max(0, d.selfDamage || 0) * 0.5;
  return dmg + 0.8 * armor + 1.2 * heal + burn + bleed + poison + slow + stun + rage - selfDmgPenalty;
}

const SINGLE_SCENARIOS = [
  'baseline', 'str_10', 'dex_10', 'int_10', 'spi_10', 'vit_10',
  'str10_dex10', 'int10_spi10', 'all_stats_5',
  'enemy_bleed_5', 'enemy_burn_5', 'enemy_poison_5', 'enemy_slow_5', 'enemy_stunned',
  'enemy_burn_10_int10', 'hero_rage_5', 'hero_rage_15', 'hero_low_hp',
  'hero_armored', 'hero_armored_low_hp', 'hero_full_stacks', 'enemy_armored',
  'vengeance_active', 'mid_combat_str_dex',
];

// passive resource cadence: 1 stamina + 1 mana / 4.5s
const REGEN_PER_SEC = 1 / 4.5;

function analyzeCard(card) {
  const s = simById.get(card.id);
  const cd = card.cooldown ?? 1;
  const cost = (card.cost?.stamina || 0) + (card.cost?.mana || 0);
  const tags = archetypeTags(card);

  // peak single-cast value across all single scenarios (best realistic build)
  let peakValue = 0, peakScenario = 'baseline';
  let baselineValue = 0;
  const perScenario = {};
  for (const name of SINGLE_SCENARIOS) {
    const v = scenarioValue(s?.scenarios?.[name]);
    perScenario[name] = Math.round(v * 10) / 10;
    if (v > peakValue) { peakValue = v; peakScenario = name; }
    if (name === 'baseline') baselineValue = v;
  }

  // 8x sequence: cumulative output of playing the card repeatedly (captures
  // stat-gain investment, event-counter auras, burn ramp). Mid-build stats.
  const seq = s?.sequence_8x && !s.sequence_8x.error ? s.sequence_8x : null;
  const seqDmg = seq?.totalDamageDealt ?? 0;
  const seqArmor = seq?.totalArmorGained ?? 0;
  const seqStats = seq?.final_statBoosts ?? {};
  const seqFinalStacks = seq?.finalEnemyStacks ?? {};

  const peakOPS = Math.round((peakValue / cd) * 100) / 100;
  const baseOPS = Math.round((baselineValue / cd) * 100) / 100;
  // value per resource committed (cost+1 to avoid div0); higher = more efficient
  const valuePerCost = Math.round((peakValue / (cost + 1)) * 100) / 100;
  // sustainability: can passive regen keep up with the play cadence (1 play/cd)?
  const drainPerSec = cost / cd;
  const sustainable = cost === 0 || drainPerSec <= REGEN_PER_SEC + 0.5; // +0.5 fudge for deck-cycle regen

  return {
    id: card.id, name: card.name, tier: card.tier ?? null,
    elements: card.elements ?? [], category: card.category,
    cooldown: cd, cost: card.cost ?? null, exhaust: !!card.exhaust,
    tags, conditional: isConditional(card),
    description: card.description,
    peakValue: Math.round(peakValue * 10) / 10,
    baselineValue: Math.round(baselineValue * 10) / 10,
    peakOPS, baseOPS, valuePerCost,
    peakScenario, sustainable, drainPerSec: Math.round(drainPerSec * 100) / 100,
    seq8x: { dmg: seqDmg, armor: seqArmor, finalStats: seqStats, finalStacks: seqFinalStacks },
    perScenario,
  };
}

const analyzed = cards.map(analyzeCard);
const byId = new Map(analyzed.map((a) => [a.id, a]));

// ---- rollups ----
function quantiles(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return { min: s[0], q25: q(0.25), median: q(0.5), q75: q(0.75), max: s[s.length - 1], mean: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100) / 100 };
}

const tiers = {};
for (const t of [1, 2, 3]) {
  const rows = analyzed.filter((a) => a.tier === t);
  tiers[t] = {
    count: rows.length,
    peakOPS: quantiles(rows.map((r) => r.peakOPS)),
    baseOPS: quantiles(rows.map((r) => r.baseOPS)),
    peakValue: quantiles(rows.map((r) => r.peakValue)),
  };
}

// archetype rollups (by tag)
const ALL_TAGS = ['damage', 'armor', 'heal', 'scaling', 'poison', 'bleed', 'burn', 'slow', 'stun', 'rage', 'exhaust'];
const archetypes = {};
for (const tag of ALL_TAGS) {
  const rows = analyzed.filter((a) => a.tags.includes(tag));
  archetypes[tag] = {
    count: rows.length,
    peakOPS: quantiles(rows.map((r) => r.peakOPS)),
    peakValue: quantiles(rows.map((r) => r.peakValue)),
    avgCooldown: rows.length ? Math.round((rows.reduce((s, r) => s + r.cooldown, 0) / rows.length) * 100) / 100 : 0,
  };
}

// element-family rollups
const ELEMENTS = ['attack', 'defense', 'agility', 'counter', 'fire', 'water', 'air', 'earth'];
const elementRollup = {};
for (const el of ELEMENTS) {
  const rows = analyzed.filter((a) => a.elements.includes(el));
  elementRollup[el] = {
    count: rows.length,
    peakOPS: quantiles(rows.map((r) => r.peakOPS)),
  };
}

// ---- tier-inversion: T3 cards weaker than comparable T2 ----
// Comparable = shares >=1 element. Flag T3 whose peakOPS < T2-median peakOPS,
// and list specific T2 cards (lower CD) that out-OPS it.
const t2 = analyzed.filter((a) => a.tier === 2);
const t3 = analyzed.filter((a) => a.tier === 3);
const t2MedianPeakOPS = quantiles(t2.map((r) => r.peakOPS)).median;

const tierInversions = [];
for (const c3 of t3) {
  const comparableT2 = t2.filter((c2) => c2.elements.some((e) => c3.elements.includes(e)));
  const beaters = comparableT2
    .filter((c2) => c2.peakOPS > c3.peakOPS && c2.cooldown <= c3.cooldown)
    .map((c2) => ({ id: c2.id, name: c2.name, peakOPS: c2.peakOPS, cd: c2.cooldown }))
    .sort((a, b) => b.peakOPS - a.peakOPS);
  if (beaters.length || c3.peakOPS < t2MedianPeakOPS) {
    tierInversions.push({
      id: c3.id, name: c3.name, peakOPS: c3.peakOPS, cd: c3.cooldown,
      vsT2Median: t2MedianPeakOPS, beatenByCount: beaters.length,
      topBeaters: beaters.slice(0, 5),
    });
  }
}
tierInversions.sort((a, b) => a.peakOPS - b.peakOPS);

// ---- dead cards: bottom decile of peakOPS within tier ----
const deadCards = [];
for (const t of [1, 2, 3]) {
  const rows = analyzed.filter((a) => a.tier === t).sort((a, b) => a.peakOPS - b.peakOPS);
  const cut = Math.max(1, Math.ceil(rows.length * 0.12));
  for (const r of rows.slice(0, cut)) {
    deadCards.push({ id: r.id, name: r.name, tier: t, peakOPS: r.peakOPS, baseOPS: r.baseOPS, peakValue: r.peakValue, cd: r.cooldown, cost: r.cost, conditional: r.conditional, tags: r.tags });
  }
}

const out = {
  meta: {
    generated: 'balance-metrics.mjs',
    cards: analyzed.length,
    model: {
      ops: 'peakValue / cooldown; peakValue = max composite across 24 single-cast scenarios',
      dotEquiv: 'poison=n(n+1); bleed=0.75n(n+1); slow=n(n+1)/2; burn=min(n,8)*4 (fight-length dependent!)',
      stun: 'mitigation only, 6/stack; not damage',
      regen: '1 stamina + 1 mana / 4.5s passive; sustainable flag uses drain<=0.72/s',
      caveat: 'Heuristic for triage. Burn/stun/scaling especially need design judgment + source reading.',
    },
  },
  tiers, archetypes, elementRollup,
  tierInversions, deadCards,
  cards: analyzed,
};

const outPath = resolve(root, 'tests/audit/balance-metrics.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');

// ---- console summary ----
console.log('=== TIER OPS (peakValue / cooldown) ===');
for (const t of [1, 2, 3]) {
  const q = tiers[t].peakOPS;
  console.log(`T${t} (n=${tiers[t].count}): peakOPS min=${q.min} q25=${q.q25} median=${q.median} q75=${q.q75} max=${q.max} mean=${q.mean}`);
}
console.log('\n=== ARCHETYPE peakOPS (median) ===');
for (const tag of ALL_TAGS) {
  const a = archetypes[tag];
  if (!a.count) continue;
  console.log(`${tag.padEnd(8)} n=${String(a.count).padStart(3)}  medianPeakOPS=${String(a.peakOPS.median).padStart(6)}  meanPeakOPS=${String(a.peakOPS.mean).padStart(6)}  avgCD=${a.avgCooldown}`);
}
console.log(`\n=== TIER INVERSIONS: ${tierInversions.length} T3 cards at/below T2 median peakOPS (${t2MedianPeakOPS}) or beaten by a lower-CD T2 ===`);
for (const ti of tierInversions.slice(0, 25)) {
  const top = ti.topBeaters[0];
  console.log(`  ${ti.id.padEnd(34)} peakOPS=${String(ti.peakOPS).padStart(6)} cd=${ti.cd}  beatenBy=${ti.beatenByCount}${top ? `  e.g. ${top.id}(OPS ${top.peakOPS},cd ${top.cd})` : ''}`);
}
if (tierInversions.length > 25) console.log(`  ... and ${tierInversions.length - 25} more`);
console.log(`\n=== DEAD CARDS (bottom ~12% peakOPS per tier): ${deadCards.length} ===`);
for (const d of deadCards) {
  console.log(`  T${d.tier} ${d.id.padEnd(34)} peakOPS=${String(d.peakOPS).padStart(6)} peakValue=${String(d.peakValue).padStart(6)} cd=${d.cd} ${d.conditional ? '[conditional]' : ''} [${d.tags.join(',')}]`);
}
console.log(`\nWrote ${outPath}`);
