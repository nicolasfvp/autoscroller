// Applies the v3 archetype redesigns (52 cards) to cards.json.
// Idempotent: re-running yields the same final state.
//
// For each id in REDESIGNS, the script merges:
//   - effects (replaced wholesale)
//   - name, description, cooldown, cost, targeting, rarity (replaced if specified)
//   - exhaust, frenzy, cooldown_scale, spend_armor (added/replaced)
// and preserves:
//   - id, category, tier, elements, unlockSource, unlockTier, classRestriction, locked
//
// Run with: node scripts/apply-redesigns.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Aura kept short: aura(ttl, opts) builds an aura CardEffect.
function aura(opts) {
  return { type: 'aura', value: 0, target: 'self', ...opts };
}
function dmg(value, opts = {}) {
  return { type: 'damage', value, target: 'enemy', ...opts };
}
function selfDmg(value, opts = {}) {
  return { type: 'damage', value, target: 'self', ...opts };
}
function armor(value, opts = {}) {
  return { type: 'armor', value, target: 'self', ...opts };
}
function heal(value, opts = {}) {
  return { type: 'heal', value, target: 'self', ...opts };
}
function dot(value, stack, opts = {}) {
  return { type: 'dot', value, target: opts.target ?? 'enemy', stack, ...opts };
}
function stack(value, stk, opts = {}) {
  return { type: 'stack', value, target: opts.target ?? 'self', stack: stk, ...opts };
}

const REDESIGNS = {
  // ─────────────────────────── BURN ───────────────────────────
  't1-attack-fire': {
    name: 'Kindle Strike',
    description: 'Deal 5 (scales STR). Burn 2 (scales INT). Vulnerable Fire 1 (5s).',
    cooldown: 1.5,
    cost: { stamina: 1 },
    targeting: 'single',
    rarity: 'common',
    effects: [
      dmg(5, { scale: { stat: 'str', per: 2, value: 1 } }),
      dot(2, 'burn', { scale: { stat: 'int', per: 3, value: 1 } }),
      aura({
        ttl_ms: 5000,
        target: 'enemy',
        modifier: { kind: 'burn_taken', value: 1 },
      }),
    ],
  },
  't1-counter-fire': {
    name: 'Cinderscar',
    description: 'Burn 2 (scales INT). Vengeance (<60% HP): convert 2 Burn into Bleed.',
    cooldown: 1.4,
    cost: { stamina: 1 },
    targeting: 'single',
    rarity: 'common',
    effects: [
      dot(2, 'burn', { scale: { stat: 'int', per: 3, value: 1 } }),
      {
        type: 'convert_stack',
        value: 2,
        target: 'enemy',
        from: 'burn',
        to: 'bleed',
        condition: { hero_hp_pct_below: 60 },
      },
    ],
  },
  't2-fire-fire-fire': {
    name: 'Supernova',
    description: 'Exhaust. Consume all Burn: 5 Pierce per stack consumed (AoE, scales INT).',
    cooldown: 4.0,
    cost: { stamina: 2, mana: 1 },
    targeting: 'aoe',
    rarity: 'rare',
    exhaust: true,
    effects: [
      dmg(5, {
        pierce_armor: true,
        target: 'aoe',
        consume_stack_value: 'burn',
        scale: { stat: 'int', per: 3, value: 1 },
      }),
      stack(-999, 'burn', { target: 'enemy', consume_stack: true }),
    ],
  },
  't2-fire-fire-water': {
    name: 'Quench Lance',
    description: 'Convert 3 Burn into Bleed. Deal 4 per Bleed (scales STR). Burn 2 (scales INT).',
    cooldown: 2.4,
    cost: { stamina: 1, mana: 1 },
    targeting: 'single',
    rarity: 'uncommon',
    effects: [
      {
        type: 'convert_stack',
        value: 3,
        target: 'enemy',
        from: 'burn',
        to: 'bleed',
      },
      dmg(4, {
        scale: { stat: 'str', per: 2, value: 1 },
        condition: { enemy_has_stack: 'bleed', per_stack: true },
      }),
      dot(2, 'burn', { scale: { stat: 'int', per: 3, value: 1 } }),
    ],
  },
  't2-air-fire-fire': {
    name: 'Pyre Surge',
    description: '+2 to every Burn on enemy (scales INT). Vulnerable Fire 3 (8s).',
    cooldown: 2.8,
    cost: { stamina: 1, mana: 1 },
    targeting: 'single',
    rarity: 'uncommon',
    effects: [
      { type: 'stack_boost', value: 2, target: 'enemy', stack: 'burn',
        scale: { stat: 'int', per: 4, value: 1 } },
      aura({
        ttl_ms: 8000,
        target: 'enemy',
        modifier: { kind: 'burn_taken', value: 3 },
      }),
    ],
  },
  't2-earth-fire-fire': {
    name: 'Magma Welling',
    description: 'Armor 14 (scales VIT). Burn 8 (scales INT). Slow cooldown.',
    cooldown: 4.5,
    cost: { stamina: 2 },
    targeting: 'single',
    rarity: 'uncommon',
    effects: [
      armor(14, { scale: { stat: 'vit', per: 2, value: 2 } }),
      dot(8, 'burn', { scale: { stat: 'int', per: 3, value: 1 } }),
    ],
  },
  't2-agility-agility-fire': {
    name: 'Twinflame Flicker',
    description: 'Burn 3 (scales INT). Echo: re-apply Burn 2 after 1.5s.',
    cooldown: 1.6,
    cost: { stamina: 1 },
    targeting: 'single',
    rarity: 'uncommon',
    effects: [
      dot(3, 'burn', { scale: { stat: 'int', per: 3, value: 1 } }),
      aura({
        ttl_ms: 1600,
        tick_ms: 1500,
        then: dot(2, 'burn', { scale: { stat: 'int', per: 3, value: 1 } }),
      }),
    ],
  },

  // ─────────────────────────── POISON ───────────────────────────
  't2-defense-defense-water': {
    name: 'Stagnant Bulwark',
    description: 'Armor 10 (scales VIT). Aura 12s: every 2s apply Poison 1 (scales INT).',
    cooldown: 2.6,
    cost: { stamina: 1, mana: 1 },
    targeting: 'self',
    rarity: 'uncommon',
    effects: [
      armor(10, { scale: { stat: 'vit', per: 2, value: 2 } }),
      aura({
        ttl_ms: 12000,
        tick_ms: 2000,
        then: dot(1, 'poison', { scale: { stat: 'int', per: 3, value: 1 } }),
      }),
    ],
  },
  't2-earth-earth-water': {
    name: 'Bog Catalyst',
    description: 'Poison 2 (scales INT). Catalyze x2: doubles Poison on enemy.',
    cooldown: 4.0,
    cost: { stamina: 1, mana: 1 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      dot(2, 'poison', { scale: { stat: 'int', per: 3, value: 1 } }),
      { type: 'multiply_stack', value: 0, target: 'enemy', stack: 'poison', factor: 2 },
    ],
  },
  't2-attack-water-water': {
    name: 'Drowning Lance',
    description: 'Consume all Poison: 3 Pierce per stack consumed (scales INT).',
    cooldown: 3.2,
    cost: { stamina: 2, mana: 1 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      dmg(0, {
        pierce_armor: true,
        consume_stack_value: 'poison',
        scale: { stat: 'int', per: 2, value: 3 },
      }),
      stack(-999, 'poison', { target: 'enemy', consume_stack: true }),
    ],
  },
  't2-air-earth-water': {
    name: 'Marsh Squall',
    description: 'Exhaust. Spread 50% Poison AoE. 4 Pierce per Poison consumed (scales INT).',
    cooldown: 5.0,
    cost: { stamina: 2, mana: 2 },
    targeting: 'aoe',
    rarity: 'rare',
    exhaust: true,
    effects: [
      {
        type: 'stack',
        value: 0,
        target: 'enemy',
        stack: 'poison',
        spread: { ratio: 0.5, target: 'aoe', max_targets: 4 },
      },
      dmg(0, {
        target: 'aoe',
        pierce_armor: true,
        consume_stack_value: 'poison',
        scale: { stat: 'int', per: 2, value: 4 },
      }),
      stack(-999, 'poison', { target: 'enemy', consume_stack: true }),
    ],
  },
  't2-agility-counter-water': {
    name: 'Venom Dance',
    description: 'Poison 3 (scales INT). Spread to 2 targets (50%). Vengeance: convert 5 Bleed→Poison.',
    cooldown: 1.8,
    cost: { stamina: 1 },
    targeting: 'single',
    rarity: 'uncommon',
    effects: [
      dot(3, 'poison', { scale: { stat: 'int', per: 3, value: 1 } }),
      {
        type: 'stack',
        value: 0,
        target: 'enemy',
        stack: 'poison',
        spread: { ratio: 0.5, target: 'aoe', max_targets: 2 },
      },
      {
        type: 'convert_stack',
        value: 5,
        target: 'self',
        from: 'bleed',
        to: 'poison',
        condition: { hero_hp_pct_below: 60 },
      },
    ],
  },
  't2-agility-water-water': {
    name: 'Slipvenom Tempo',
    description: 'Poison 3 (scales INT). Haste 15% (6s). Echo if Poison ≥ 10.',
    cooldown: 1.6,
    cost: { stamina: 1, mana: 1 },
    targeting: 'single',
    rarity: 'uncommon',
    effects: [
      dot(3, 'poison', { scale: { stat: 'int', per: 3, value: 1 } }),
      aura({ ttl_ms: 6000, modifier: { kind: 'cd_reduction', value: 0.15 } }),
      dot(3, 'poison', {
        scale: { stat: 'int', per: 3, value: 1 },
        condition: { enemy_stack_atleast: { stack: 'poison', value: 10 } },
      }),
    ],
  },
  't2-earth-fire-water': {
    name: 'Alchemic Drain',
    description: 'Consume up to 4 Poison: Heal 4 per stack consumed (scales SPI).',
    cooldown: 3.0,
    cost: { stamina: 1, mana: 1 },
    targeting: 'single',
    rarity: 'uncommon',
    effects: [
      heal(4, {
        consume_stack_value: 'poison',
        scale: { stat: 'spi', per: 3, value: 1 },
      }),
      stack(-4, 'poison', { target: 'enemy', consume_stack: true }),
    ],
  },
  't2-attack-counter-water': {
    name: 'Necrotic Festering',
    description: 'Self Bleed 3 (scales DEX). Apply Poison = Self Bleed (scales INT). Pierce per stack pair.',
    cooldown: 2.2,
    cost: { stamina: 2 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      dot(3, 'bleed', { target: 'self_dot', scale: { stat: 'dex', per: 3, value: 1 } }),
      {
        type: 'stack',
        value: 0,
        target: 'enemy',
        stack: 'poison',
        scale: { stat: 'int', per: 4, value: 1, source: 'self_stack', stack: 'bleed' },
      },
      dmg(0, {
        pierce_armor: true,
        consume_stack_value: 'bleed',
        scale: { stat: 'str', per: 2, value: 4 },
      }),
      stack(-99, 'bleed', { target: 'self', consume_stack: true }),
    ],
  },
  't2-air-fire-water': {
    name: 'Steaming Plague',
    description: 'Poison 3 AoE (scales INT). +2 extra Poison on already-poisoned enemies.',
    cooldown: 2.4,
    cost: { stamina: 1, mana: 1 },
    targeting: 'aoe',
    rarity: 'uncommon',
    effects: [
      dot(3, 'poison', { target: 'aoe', scale: { stat: 'int', per: 3, value: 1 } }),
      dot(2, 'poison', {
        target: 'aoe',
        scale: { stat: 'int', per: 4, value: 1 },
        condition: { enemy_has_stack: 'poison' },
      }),
    ],
  },

  // ─────────────────────────── BLEED ───────────────────────────
  't1-counter-counter': {
    name: 'Razor Stance',
    description: 'Aura 10s: your hits apply Bleed 1 (scales DEX). Vengeance: +4s.',
    cooldown: 2.0,
    cost: { stamina: 1 },
    targeting: 'self',
    rarity: 'common',
    effects: [
      aura({
        ttl_ms: 10000,
        trigger: 'on_hit_dealt',
        then: dot(1, 'bleed', { scale: { stat: 'dex', per: 3, value: 1 } }),
      }),
      aura({
        ttl_ms: 4000,
        trigger: 'on_hit_dealt',
        then: dot(1, 'bleed', { scale: { stat: 'dex', per: 3, value: 1 } }),
        condition: { hero_hp_pct_below: 50 },
      }),
    ],
  },
  't2-attack-attack-counter': {
    name: 'Bloodlash Salvo',
    description: 'Per Bleed: 3 Pierce (scales STR). Vengeance: +2 Pierce per Bleed. No consume.',
    cooldown: 2.6,
    cost: { stamina: 2 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      dmg(3, {
        pierce_armor: true,
        scale: { stat: 'str', per: 2, value: 1 },
        condition: { enemy_has_stack: 'bleed', per_stack: true },
      }),
      dmg(2, {
        pierce_armor: true,
        scale: { stat: 'str', per: 2, value: 1 },
        condition: { enemy_has_stack: 'bleed', per_stack: true, hero_hp_pct_below: 50 },
      }),
    ],
  },
  't2-agility-attack-counter': {
    name: 'Vein Splitter',
    description: 'Deal 4 ×3 (scales DEX). Each hit: Bleed +1 per existing Bleed.',
    cooldown: 2.4,
    cost: { stamina: 2 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      dmg(4, {
        scale: { stat: 'dex', per: 3, value: 1 },
        multi_hit: 2,
      }),
      dot(1, 'bleed', { per_hit: true, scale: { stat: 'dex', per: 4, value: 1 } }),
      dot(1, 'bleed', {
        per_hit: true,
        scale: { stat: 'dex', per: 4, value: 1 },
        condition: { enemy_has_stack: 'bleed' },
      }),
    ],
  },
  't2-counter-counter-water': {
    name: 'Crimson Cascade',
    description: 'Self Bleed 1. Aura 15s: on enemy kill with Bleed, spread 50% Bleed to nearest.',
    cooldown: 3.5,
    cost: { stamina: 1, mana: 1 },
    targeting: 'self',
    rarity: 'rare',
    effects: [
      dot(1, 'bleed', { target: 'self_dot' }),
      aura({
        ttl_ms: 15000,
        trigger: 'on_kill_with_stack',
        threshold_stack: 'bleed',
        then: dot(4, 'bleed', {
          target: 'enemy_nearest',
          scale: { stat: 'spi', per: 3, value: 2 },
        }),
      }),
    ],
  },
  't2-agility-counter-fire': {
    name: 'Searing Razor',
    description: 'Bleed 2 (scales DEX). Burn 2 (scales INT). Aura 10s: CD -10% per 25% missing HP.',
    cooldown: 2.2,
    cost: { stamina: 1, mana: 1 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      dot(2, 'bleed', { scale: { stat: 'dex', per: 3, value: 1 } }),
      dot(2, 'burn', { scale: { stat: 'int', per: 3, value: 1 } }),
      aura({
        ttl_ms: 10000,
        modifier: { kind: 'cd_reduction', value: 0.10 },
        // Approximation: 10% flat haste during ttl. Full HP-scaled CD lives in
        // cooldown_scale at card level — but using aura keeps it simple for v1.
      }),
    ],
  },
  't2-agility-counter-counter': {
    name: 'Razor Cadence',
    description: 'Deal 5 ×3 (scales DEX). Each hit: Bleed 1. Vengeance: ×4 hits.',
    cooldown: 2.0,
    cost: { stamina: 2 },
    targeting: 'single',
    rarity: 'uncommon',
    effects: [
      dmg(5, {
        scale: { stat: 'dex', per: 3, value: 1 },
        multi_hit: 2,
      }),
      dot(1, 'bleed', { per_hit: true, scale: { stat: 'dex', per: 4, value: 1 } }),
      dmg(5, {
        scale: { stat: 'dex', per: 3, value: 1 },
        condition: { hero_hp_pct_below: 50 },
      }),
      dot(1, 'bleed', {
        scale: { stat: 'dex', per: 4, value: 1 },
        condition: { hero_hp_pct_below: 50 },
      }),
    ],
  },

  // ─────────────────────────── RAGE ───────────────────────────
  't1-attack-attack': {
    name: 'Reckless Strike',
    description: 'Deal 7 (scales STR). +1 Rage. Self Bleed 1.',
    cooldown: 1.0,
    cost: { stamina: 1 },
    targeting: 'single',
    rarity: 'common',
    effects: [
      dmg(7, { scale: { stat: 'str', per: 2, value: 1 } }),
      stack(1, 'rage'),
      dot(1, 'bleed', { target: 'self_dot' }),
    ],
  },
  't1-counter-defense': {
    name: 'Iron Reckoning',
    description: 'Armor 4 (scales VIT). Stance 8s: hits +1 per Rage (scales STR).',
    cooldown: 1.6,
    cost: { stamina: 1 },
    targeting: 'self',
    rarity: 'common',
    effects: [
      armor(4, { scale: { stat: 'vit', per: 2, value: 2 } }),
      aura({
        ttl_ms: 8000,
        // value 1 × current Rage stacks = hit bonus while stance is active.
        modifier: { kind: 'hero_hit_bonus', value: 1, stack: 'rage' },
      }),
    ],
  },
  't2-counter-counter-counter': {
    name: 'Crimson Spiral',
    description: 'Damage = Rage × 2 (Pierce, scales STR). +1 Bleed per Rage. Consume all Rage.',
    cooldown: 4.5,
    cost: { stamina: 2 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      dmg(0, {
        pierce_armor: true,
        consume_stack_value: 'rage',
        scale: { stat: 'str', per: 2, value: 2 },
      }),
      dot(1, 'bleed', {
        condition: { self_has_stack: 'rage', per_stack: true },
        scale: { stat: 'dex', per: 4, value: 1 },
      }),
      stack(-99, 'rage', { target: 'self', consume_stack: true }),
    ],
  },
  't2-counter-counter-defense': {
    name: 'Wrathshell Vow',
    description: 'Exhaust. Channel 4s, then aura: +1 Rage every 3s (scales STR). On hit taken: +1 Rage.',
    cooldown: 6.0,
    cost: { stamina: 2 },
    targeting: 'self',
    rarity: 'epic',
    exhaust: true,
    effects: [
      aura({
        ttl_ms: null,
        channel_ms: 4000,
        tick_ms: 3000,
        then: stack(1, 'rage'),
      }),
      aura({
        ttl_ms: null,
        channel_ms: 4000,
        trigger: 'on_hit_taken',
        cooldown_ms: 800,
        then: stack(1, 'rage'),
      }),
    ],
  },
  't2-attack-counter-counter': {
    name: "Cleaver's Tax",
    description: 'Deal 12 Pierce (scales STR). Overload: -5 Rage, +20 dmg, lockout 4s.',
    cooldown: 2.0,
    cost: { stamina: 2 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      dmg(12, {
        pierce_armor: true,
        scale: { stat: 'str', per: 2, value: 1 },
      }),
      dmg(20, {
        pierce_armor: true,
        scale: { stat: 'str', per: 2, value: 2 },
        condition: { self_stack_atleast: { stack: 'rage', value: 5 } },
        overload_lockout_ms: 4000,
      }),
      stack(-5, 'rage', {
        target: 'self',
        consume_stack: true,
        condition: { self_stack_atleast: { stack: 'rage', value: 5 } },
      }),
    ],
  },
  't2-air-counter-counter': {
    name: 'Wrath Squall',
    description: 'On 30 Rage: deal 40 (scales STR) + Slow 8 (scales INT). Reset Rage.',
    cooldown: 6.0,
    cost: { stamina: 2 },
    targeting: 'self',
    rarity: 'rare',
    effects: [
      aura({
        ttl_ms: null,
        trigger: 'on_stack_threshold',
        threshold_stack: 'rage',
        threshold: 30,
        cooldown_ms: 8000,
        then: [
          dmg(40, { scale: { stat: 'str', per: 2, value: 2 } }),
          dot(8, 'slow', { scale: { stat: 'int', per: 3, value: 1 } }),
          stack(-99, 'rage', { target: 'self', consume_stack: true }),
        ],
      }),
    ],
  },
  't2-counter-counter-fire': {
    name: 'Vengeful Pyre',
    description: 'Exhaust. Devour 1 common: +12 Rage (scales STR). Burn 6 (scales INT).',
    cooldown: 3.0,
    cost: { stamina: 2 },
    targeting: 'self',
    rarity: 'rare',
    exhaust: true,
    effects: [
      { type: 'devour', value: 0, target: 'self_deck', devour: { from_deck: true, rarity: 'common', count: 1 } },
      stack(12, 'rage', {
        scale: { stat: 'str', per: 3, value: 1 },
        condition: { devour_succeeded: true },
      }),
      dot(6, 'burn', {
        scale: { stat: 'int', per: 3, value: 1 },
        condition: { devour_succeeded: true },
      }),
    ],
  },

  // ─────────────────────────── ARMOR ───────────────────────────
  't1-attack-earth': {
    name: 'Granite Lunge',
    description: 'Armor 4 (scales VIT). Deal 3 + 1 per 4 Armor (scales STR). +1 Stamina.',
    cooldown: 1.4,
    cost: { stamina: 1 },
    targeting: 'single',
    rarity: 'common',
    effects: [
      armor(4, { scale: { stat: 'vit', per: 2, value: 1 } }),
      dmg(3, {
        scale: { stat: 'str', per: 4, value: 1, source: 'armor' },
      }),
      { type: 'stamina', value: 1, target: 'self' },
    ],
  },
  't1-defense-fire': {
    name: 'Forge Spike Ward',
    description: 'Armor 5 (scales VIT). Aura 8s: on hit taken, deal 2 + 1 per 6 Armor (scales STR).',
    cooldown: 1.8,
    cost: { stamina: 1 },
    targeting: 'self',
    rarity: 'common',
    effects: [
      armor(5, { scale: { stat: 'vit', per: 2, value: 1 } }),
      aura({
        ttl_ms: 8000,
        trigger: 'on_hit_taken',
        cooldown_ms: 1000,
        then: dmg(2, {
          scale: { stat: 'str', per: 6, value: 1, source: 'armor' },
        }),
      }),
    ],
  },
  't2-attack-attack-defense': {
    name: 'Bulwark Salvo',
    description: 'Deal 6 + 1 per 2 Armor ×2 (scales STR, no consume).',
    cooldown: 2.5,
    cost: { stamina: 2 },
    targeting: 'single',
    rarity: 'uncommon',
    effects: [
      dmg(6, {
        scale: { stat: 'str', per: 2, value: 1, source: 'armor' },
        multi_hit: 1,
      }),
    ],
  },
  't2-counter-defense-defense': {
    name: 'Reforge Vow',
    description: 'Aura 12s: Armor gained +50%. Armor 8 (scales VIT).',
    cooldown: 3.0,
    cost: { stamina: 1, mana: 1 },
    targeting: 'self',
    rarity: 'rare',
    effects: [
      aura({
        ttl_ms: 12000,
        trigger: 'passive_armor_scaler',
        modifier: { kind: 'armor_bonus_pct', value: 0.5 },
      }),
      armor(8, { scale: { stat: 'vit', per: 2, value: 2 } }),
    ],
  },
  't2-defense-defense-fire': {
    name: 'Pyric Bulwark',
    description: 'Armor 12 (scales VIT). Aura 14s: on Armor gained ≥ 4 → Burn 1 (scales INT).',
    cooldown: 2.6,
    cost: { stamina: 1, mana: 1 },
    targeting: 'self',
    rarity: 'uncommon',
    effects: [
      armor(12, { scale: { stat: 'vit', per: 2, value: 2 } }),
      aura({
        ttl_ms: 14000,
        trigger: 'on_armor_gained',
        min_amount: 4,
        then: dot(1, 'burn', { scale: { stat: 'int', per: 4, value: 1 } }),
      }),
    ],
  },
  't2-defense-fire-fire': {
    name: 'Citadel Inferno',
    description: 'Exhaust. Spend ALL Armor: AoE Pierce = Armor × 2 (scales STR). Requires Armor ≥ 10.',
    cooldown: 4.0,
    cost: { stamina: 2, mana: 1 },
    targeting: 'aoe',
    rarity: 'epic',
    exhaust: true,
    spend_armor: 'all',
    effects: [
      dmg(0, {
        target: 'aoe',
        pierce_armor: true,
        scale: { stat: 'str', per: 1, value: 2, source: 'armor' },
        condition: { self_armor_atleast: 10 },
      }),
    ],
  },
  't2-defense-earth-earth': {
    name: 'Bedrock Bulwark',
    description: 'Armor 16 (scales VIT). Aura 15s: on Armor break → re-arm Armor 6 (scales VIT).',
    cooldown: 3.0,
    cost: { stamina: 2 },
    targeting: 'self',
    rarity: 'rare',
    effects: [
      armor(16, { scale: { stat: 'vit', per: 2, value: 3 } }),
      aura({
        ttl_ms: 15000,
        trigger: 'on_armor_break',
        then: armor(6, { scale: { stat: 'vit', per: 3, value: 1 } }),
      }),
    ],
  },

  // ─────────────────────────── CC (slow + stun) ───────────────────────────
  't1-air-earth': {
    name: 'Bedrock Snare',
    description: 'Slow 2 (scales INT). If enemy has Slow ≥ 4: Stun 1.',
    cooldown: 1.6,
    cost: { stamina: 1 },
    targeting: 'single',
    rarity: 'common',
    effects: [
      dot(2, 'slow', { scale: { stat: 'int', per: 3, value: 1 } }),
      dot(1, 'stun', {
        scale: { stat: 'int', per: 5, value: 1 },
        condition: { enemy_stack_atleast: { stack: 'slow', value: 4 } },
      }),
    ],
  },
  't2-agility-air-air': {
    name: 'Gale Echo',
    description: 'Aura 12s: Slow effects apply +1 extra (scales INT). Haste 15% (6s).',
    cooldown: 2.4,
    cost: { stamina: 1, mana: 1 },
    targeting: 'self',
    rarity: 'uncommon',
    effects: [
      aura({
        ttl_ms: 12000,
        trigger: 'on_slow_applied',
        then: dot(1, 'slow', { scale: { stat: 'int', per: 4, value: 1 } }),
      }),
      aura({ ttl_ms: 6000, modifier: { kind: 'cd_reduction', value: 0.15 } }),
    ],
  },
  't2-air-air-fire': {
    name: 'Cinder Squall',
    description: 'Slow 3 AoE (scales INT). If Slow ≥ 5: Stun 1. 2 damage per Slow stack.',
    cooldown: 2.6,
    cost: { stamina: 1, mana: 1 },
    targeting: 'aoe',
    rarity: 'uncommon',
    effects: [
      dot(3, 'slow', { target: 'aoe', scale: { stat: 'int', per: 3, value: 1 } }),
      dot(1, 'stun', {
        target: 'aoe',
        scale: { stat: 'int', per: 5, value: 1 },
        condition: { enemy_stack_atleast: { stack: 'slow', value: 5 } },
      }),
      dmg(2, {
        target: 'aoe',
        scale: { stat: 'int', per: 2, value: 1 },
        condition: { enemy_has_stack: 'slow', per_stack: true },
      }),
    ],
  },
  't2-air-attack-counter': {
    name: 'Thunderstrike Catalyst',
    description: 'Deal 6 (scales STR). Consume 4 Slow: +6 Pierce per stack consumed (scales INT).',
    cooldown: 2.4,
    cost: { stamina: 2 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      dmg(6, { scale: { stat: 'str', per: 2, value: 1 } }),
      dmg(6, {
        pierce_armor: true,
        consume_stack_value: 'slow',
        scale: { stat: 'int', per: 2, value: 1 },
        condition: { enemy_has_stack: 'slow' },
      }),
      stack(-4, 'slow', { target: 'enemy', consume_stack: true }),
    ],
  },
  't2-air-air-earth': {
    name: 'Dust Plague',
    description: 'Armor 8 (scales VIT). Aura 12s: every 2.5s apply Slow 1 AoE (scales INT). ≥5 Slow → Stun.',
    cooldown: 2.8,
    cost: { stamina: 1, mana: 2 },
    targeting: 'self',
    rarity: 'rare',
    effects: [
      armor(8, { scale: { stat: 'vit', per: 2, value: 1 } }),
      aura({
        ttl_ms: 12000,
        tick_ms: 2500,
        then: dot(1, 'slow', { target: 'aoe', scale: { stat: 'int', per: 4, value: 1 } }),
      }),
      aura({
        ttl_ms: 12000,
        trigger: 'on_enemy_stack_threshold',
        threshold_stack: 'slow',
        threshold: 5,
        then: dot(1, 'stun', { scale: { stat: 'int', per: 5, value: 1 } }),
      }),
    ],
  },
  't2-air-counter-earth': {
    name: 'Tectonic Reckoning',
    description: 'Exhaust. Stun 3 AoE (scales INT). Force-trigger every card you own once.',
    cooldown: 5.0,
    cost: { stamina: 3, mana: 2 },
    targeting: 'aoe',
    rarity: 'epic',
    exhaust: true,
    effects: [
      dot(3, 'stun', { target: 'aoe', scale: { stat: 'int', per: 4, value: 1 } }),
      { type: 'force_trigger_all_cards', value: 0, target: 'self_deck' },
    ],
  },
  't2-agility-air-earth': {
    name: 'Stormstone Tempo',
    description: 'Channel: Deal 6 (scales DEX, +25%/s held, max +100%). Shatter: 6 Pierce (scales STR).',
    cooldown: 3.0,
    cost: { stamina: 2 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      dmg(6, {
        scale: { stat: 'dex', per: 3, value: 1 },
        channel: { max_bonus: 1.0, ramp_per_sec: 0.25 },
      }),
      dmg(6, {
        pierce_armor: true,
        scale: { stat: 'str', per: 2, value: 1 },
        condition: { enemy_stunned: true },
      }),
    ],
  },

  // ─────────────────────────── CROSS-ARCHETYPE ───────────────────────────
  't2-air-counter-defense': {
    name: 'Glacial Pact',
    description: 'Slow 4 (scales INT). Armor 8 (scales VIT). Frenzy: CD -30% below 50% HP.',
    cooldown: 2.4,
    cost: { stamina: 1, mana: 1 },
    targeting: 'self',
    rarity: 'uncommon',
    frenzy: { hero_hp_pct_below: 50, cd_mult: 0.7 },
    effects: [
      dot(4, 'slow', { scale: { stat: 'int', per: 3, value: 1 } }),
      armor(8, { scale: { stat: 'vit', per: 2, value: 2 } }),
    ],
  },
  't2-counter-fire-fire': {
    name: 'Brine Crucible',
    description: 'Overload (+3s next CD): convert all Burn → Bleed (1:2, scales DEX).',
    cooldown: 2.4,
    cost: { stamina: 1, mana: 1 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      { type: 'convert_stack', value: 99, target: 'enemy', from: 'burn', to: 'bleed', factor: 2,
        scale: { stat: 'dex', per: 4, value: 1 } },
      dot(2, 'bleed', { scale: { stat: 'dex', per: 4, value: 1 } }), // floor
      { type: 'cd_debt', value: 3.0, target: 'self' },
    ],
  },
  't2-counter-water-water': {
    name: 'Tidefoot Bloom',
    description: 'Convert all Poison → Bleed 1:1 (scales DEX). Echo 1 (6s, scales INT).',
    cooldown: 2.2,
    cost: { stamina: 1, mana: 1 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      { type: 'convert_stack', value: 99, target: 'enemy', from: 'poison', to: 'bleed',
        scale: { stat: 'dex', per: 4, value: 1 } },
      { type: 'echo', value: 1, target: 'self', ttl_ms: 6000,
        scale: { stat: 'int', per: 8, value: 1 } },
    ],
  },
  't2-air-defense-fire': {
    name: 'Ember Aegis Gust',
    description: 'Convert all Burn → Armor (cap 20, scales VIT). Haste 15% (6s, scales INT).',
    cooldown: 2.6,
    cost: { stamina: 1, mana: 1 },
    targeting: 'self',
    rarity: 'rare',
    effects: [
      { type: 'convert_stack', value: 99, target: 'enemy', from: 'burn', to: 'armor', cap: 20,
        scale: { stat: 'vit', per: 4, value: 1 } },
      aura({ ttl_ms: 6000, modifier: { kind: 'cd_reduction', value: 0.15 } }),
    ],
  },
  't2-attack-fire-water': {
    name: 'Tremor Detonate',
    description: 'Exhaust. Deal 6 + 3× (Poison + Bleed + Burn) (scales STR). Consume all.',
    cooldown: 5.5,
    cost: { stamina: 3 },
    targeting: 'single',
    rarity: 'epic',
    exhaust: true,
    effects: [
      dmg(6, { pierce_armor: true, scale: { stat: 'str', per: 2, value: 1 } }),
      dmg(3, { pierce_armor: true, consume_stack_value: 'poison', scale: { stat: 'str', per: 3, value: 1 } }),
      dmg(3, { pierce_armor: true, consume_stack_value: 'bleed',  scale: { stat: 'str', per: 3, value: 1 } }),
      dmg(3, { pierce_armor: true, consume_stack_value: 'burn',   scale: { stat: 'str', per: 3, value: 1 } }),
      stack(-99, 'poison', { target: 'enemy', consume_stack: true }),
      stack(-99, 'bleed',  { target: 'enemy', consume_stack: true }),
      stack(-99, 'burn',   { target: 'enemy', consume_stack: true }),
    ],
  },

  // ─────────────────────────── HP-LOSS ENABLERS ───────────────────────────
  't1-attack-counter': {
    name: 'Bloodprice Strike',
    description: 'Lose 4 HP (Pierce). Deal 12 (scales STR). +2 Rage. +1 Stamina.',
    cooldown: 1.6,
    cost: { stamina: 1 },
    targeting: 'single',
    rarity: 'common',
    effects: [
      selfDmg(4, { pierce_armor: true }),
      dmg(12, { scale: { stat: 'str', per: 2, value: 2 } }),
      stack(2, 'rage', { scale: { stat: 'str', per: 4, value: 1 } }),
      { type: 'stamina', value: 1, target: 'self' },
    ],
  },
  't1-attack-water': {
    name: 'Crimson Tithe',
    description: 'Lose 5 HP. +1 Stamina, +1 Mana (scales SPI). Aura 6s: HP loss → +1 Rage.',
    cooldown: 1.6,
    cost: {},
    targeting: 'self',
    rarity: 'common',
    effects: [
      selfDmg(5),
      { type: 'stamina', value: 1, target: 'self', scale: { stat: 'spi', per: 4, value: 0 } },
      { type: 'mana', value: 1, target: 'self', scale: { stat: 'spi', per: 4, value: 0 } },
      aura({
        ttl_ms: 6000,
        trigger: 'on_self_damage',
        then: stack(1, 'rage'),
      }),
    ],
  },
  't2-attack-counter-defense': {
    name: 'Last Stand Bulwark',
    description: 'Armor 10 (scales VIT). Berserk (<50% HP): +10 Armor and 12 Pierce (scales STR).',
    cooldown: 2.6,
    cost: { stamina: 2 },
    targeting: 'self',
    rarity: 'uncommon',
    effects: [
      armor(10, { scale: { stat: 'vit', per: 2, value: 2 } }),
      armor(10, {
        scale: { stat: 'vit', per: 2, value: 2 },
        condition: { hero_hp_pct_below: 50 },
      }),
      dmg(12, {
        pierce_armor: true,
        scale: { stat: 'str', per: 2, value: 2 },
        condition: { hero_hp_pct_below: 50 },
      }),
    ],
  },
  't2-counter-defense-water': {
    name: 'Crimson Regen Mantle',
    description: 'Armor 8 (scales VIT). Aura 12s: while HP<50%, heal 3/s (scales SPI). DR 20%.',
    cooldown: 2.8,
    cost: { stamina: 1, mana: 1 },
    targeting: 'self',
    rarity: 'rare',
    effects: [
      armor(8, { scale: { stat: 'vit', per: 2, value: 2 } }),
      aura({
        ttl_ms: 12000,
        tick_ms: 1000,
        // Condition moves to inner `then` so the aura stays alive while HP
        // is high but only heals once the hero is wounded.
        then: heal(3, {
          scale: { stat: 'spi', per: 3, value: 1 },
          condition: { hero_hp_pct_below: 50 },
        }),
      }),
      aura({
        ttl_ms: 12000,
        modifier: { kind: 'damage_taken_pct', value: -0.20 },
        // damage_taken_pct modifier honors hp_pct gating at sumModifier
        // boundary in Wave 3; for Wave 2 it's an always-on 20% mitigation
        // for the 12s window. Acceptable given the cooldown.
      }),
    ],
  },

  // ─────────────────────────── RESTORED ORIGINALS ───────────────────────────
  // These IDs lost their v3 redesign during the element-realignment swap.
  // The original card's effects are restored here, with v3-style stat scaling
  // applied so every card still scales with at least one stat.
  't1-water-water': {
    name: 'Frostbind',
    description: 'Stun 1 (scales INT). Armor 4 (scales VIT).',
    cooldown: 2.0,
    cost: { mana: 1 },
    targeting: 'single',
    rarity: 'common',
    effects: [
      dot(1, 'stun', { scale: { stat: 'int', per: 4, value: 1 } }),
      armor(4, { scale: { stat: 'vit', per: 2, value: 1 } }),
    ],
  },
  't2-defense-water-water': {
    name: 'Brineward',
    description: 'Armor 14 (scales VIT). Heal 8 (scales SPI). Poison 2 (scales INT).',
    cooldown: 2.8,
    cost: { mana: 2 },
    targeting: 'self',
    rarity: 'rare',
    effects: [
      armor(14, { scale: { stat: 'vit', per: 2, value: 2 } }),
      heal(8, { scale: { stat: 'spi', per: 3, value: 1 } }),
      dot(2, 'poison', { scale: { stat: 'int', per: 3, value: 1 } }),
    ],
  },
  't2-attack-attack-earth': {
    name: 'Concussive Smash',
    description: 'Deal 12 (scales STR). Stun 2 (scales INT).',
    cooldown: 3.0,
    cost: { stamina: 2 },
    targeting: 'single',
    rarity: 'rare',
    effects: [
      dmg(12, { scale: { stat: 'str', per: 2, value: 2 } }),
      dot(2, 'stun', { scale: { stat: 'int', per: 4, value: 1 } }),
    ],
  },
  't2-agility-defense-water': {
    name: 'Tidefoot Guard',
    description: 'Armor 12 (scales VIT). Poison 2 (scales INT). Haste 15% (6s).',
    cooldown: 2.4,
    cost: { mana: 1 },
    targeting: 'self',
    rarity: 'uncommon',
    effects: [
      armor(12, { scale: { stat: 'vit', per: 2, value: 2 } }),
      dot(2, 'poison', { scale: { stat: 'int', per: 3, value: 1 } }),
      aura({ ttl_ms: 6000, modifier: { kind: 'cd_reduction', value: 0.15 } }),
    ],
  },
  't2-agility-attack-attack': {
    name: 'Triple Slash',
    description: 'Deal 6 ×3 (scales DEX).',
    cooldown: 1.6,
    cost: { stamina: 2 },
    targeting: 'aoe',
    rarity: 'uncommon',
    effects: [
      dmg(6, { scale: { stat: 'dex', per: 3, value: 1 }, multi_hit: 2 }),
    ],
  },
  't1-earth-earth': {
    name: 'Tremor Lock',
    description: 'Stun 2 (scales INT).',
    cooldown: 2.5,
    cost: { mana: 1 },
    targeting: 'single',
    rarity: 'common',
    effects: [
      dot(2, 'stun', { scale: { stat: 'int', per: 4, value: 1 } }),
    ],
  },
  't1-agility-earth': {
    name: 'Tremor Dash',
    description: 'Deal 5 (scales DEX). Armor 4 (scales VIT). +1 Stamina.',
    cooldown: 1.6,
    cost: {},
    targeting: 'single',
    rarity: 'common',
    effects: [
      dmg(5, { scale: { stat: 'dex', per: 3, value: 1 } }),
      armor(4, { scale: { stat: 'vit', per: 2, value: 1 } }),
      { type: 'stamina', value: 1, target: 'self' },
    ],
  },
};

function applyRedesign(card, spec) {
  card.name = spec.name;
  card.description = spec.description;
  card.cooldown = spec.cooldown;
  if (spec.cost !== undefined) card.cost = spec.cost;
  if (spec.targeting) card.targeting = spec.targeting;
  if (spec.rarity) card.rarity = spec.rarity;
  card.effects = spec.effects;
  if (spec.exhaust !== undefined) card.exhaust = spec.exhaust;
  if (spec.frenzy !== undefined) card.frenzy = spec.frenzy;
  if (spec.cooldown_scale !== undefined) card.cooldown_scale = spec.cooldown_scale;
  if (spec.spend_armor !== undefined) card.spend_armor = spec.spend_armor;
}

function main() {
  const filePath = path.join(__dirname, '..', 'src', 'data', 'json', 'cards.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const ids = Object.keys(REDESIGNS);
  const seen = new Set();
  let applied = 0;
  for (const card of data.cards) {
    const spec = REDESIGNS[card.id];
    if (!spec) continue;
    applyRedesign(card, spec);
    seen.add(card.id);
    applied++;
  }
  const missing = ids.filter((id) => !seen.has(id));

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');

  console.log('apply-redesigns.mjs report:');
  console.log(`  expected redesigns: ${ids.length}`);
  console.log(`  applied:            ${applied}`);
  console.log(`  missing IDs:        ${missing.length}`);
  if (missing.length) console.log('  ', missing.join(', '));
}

main();
