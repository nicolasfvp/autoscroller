/* eslint-disable */
// One-shot script: rewrites the 36 tier-1 cards in cards.json with the
// approved redesigns. Preserves id, category, tier, elements, targeting,
// rarity, classRestriction; replaces name, description, effects, cost,
// cooldown.
const fs = require('fs');
const path = require('path');

const CARDS_PATH = path.join(__dirname, '..', 'src', 'data', 'json', 'cards.json');
const data = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8'));
const cards = Array.isArray(data) ? data : data.cards;

// Targeting overrides for cards whose redesign changes targeting.
const TARGETING_OVERRIDES = {
  't1-agility-fire': 'random',
  't1-air-fire': 'aoe',
};

const REDESIGNS = {
  't1-attack-attack': {
    name: 'Strike',
    description: 'Deal 7. Restore 1 stamina.',
    cooldown: 1.0,
    cost: { stamina: 1 },
    effects: [
      { type: 'damage', value: 7, target: 'enemy', scale: { stat: 'str', per: 2, value: 1 } },
      { type: 'stamina', value: 1, target: 'self' },
    ],
  },
  't1-defense-defense': {
    name: 'Bulwark Vow',
    description: 'Gain 6 armor (scales VIT). On break: +2 rage.',
    cooldown: 1.6,
    cost: { stamina: 1 },
    effects: [
      { type: 'armor', value: 6, target: 'self', scale: { stat: 'vit', per: 2, value: 4 } },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 12000, trigger: 'on_armor_break',
        then: { type: 'stack', value: 2, target: 'self', stack: 'rage' } },
    ],
  },
  't1-agility-agility': {
    name: 'Flurry Step',
    description: 'Hit twice; second swing scales DEX.',
    cooldown: 0.9,
    cost: { stamina: 1 },
    effects: [
      { type: 'damage', value: 4, target: 'enemy' },
      { type: 'damage', value: 4, target: 'enemy', scale: { stat: 'dex', per: 3, value: 1 } },
    ],
  },
  't1-counter-counter': {
    name: 'Vengeful Riposte',
    description: 'Deal 6 (pierces armor below 50% HP). Bleed 4.',
    cooldown: 1.5,
    effects: [
      { type: 'damage', value: 6, target: 'enemy', pierce_armor: true, condition: { hero_hp_pct_below: 50 } },
      { type: 'damage', value: 6, target: 'enemy', condition: { hero_hp_pct_atleast: 50 } },
      { type: 'dot', value: 4, target: 'enemy', stack: 'bleed' },
    ],
  },
  't1-fire-fire': {
    name: 'Pyre',
    description: 'Deal 4 + 2 per burn stack. Burn 5.',
    cooldown: 1.4,
    effects: [
      { type: 'damage', value: 4, target: 'enemy' },
      { type: 'damage', value: 2, target: 'enemy', condition: { enemy_has_stack: 'burn', per_stack: true } },
      { type: 'dot', value: 5, target: 'enemy', stack: 'burn' },
    ],
  },
  't1-water-water': {
    name: 'Wellspring',
    description: 'Heal 4 (scales SPI). Restore 2 mana. +2 SPI aura.',
    cooldown: 1.5,
    effects: [
      { type: 'heal', value: 4, target: 'self', scale: { stat: 'spi', per: 2, value: 2 } },
      { type: 'mana', value: 2, target: 'self' },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 6000, modifier: { kind: 'spi', value: 2 } },
    ],
  },
  't1-air-air': {
    name: 'Tailwind',
    description: 'Deal 4. Next cards cooldown -25% (5s).',
    cooldown: 1.2,
    cost: { mana: 1 },
    effects: [
      { type: 'damage', value: 4, target: 'enemy' },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 5000, modifier: { kind: 'cd_reduction', value: 0.25 } },
    ],
  },
  't1-earth-earth': {
    name: 'Avalanche',
    description: 'Gain 14 armor (scales VIT). Deal 12 (scales VIT).',
    cooldown: 2.8,
    cost: { stamina: 2 },
    effects: [
      { type: 'armor', value: 14, target: 'self', scale: { stat: 'vit', per: 2, value: 2 } },
      { type: 'damage', value: 12, target: 'enemy', scale: { stat: 'vit', per: 2, value: 1 } },
    ],
  },
  't1-agility-attack': {
    name: 'Quickstrike',
    description: 'Deal 6 (scales DEX).',
    cooldown: 0.8,
    cost: { stamina: 1 },
    effects: [
      { type: 'damage', value: 6, target: 'enemy', scale: { stat: 'dex', per: 2, value: 2 } },
    ],
  },
  't1-agility-counter': {
    name: "Sidestep & Slash",
    description: 'Deal 5; +5 below 60% HP. Bleed 2. Restore 1 stamina.',
    cooldown: 1.1,
    effects: [
      { type: 'damage', value: 5, target: 'enemy' },
      { type: 'damage', value: 5, target: 'enemy', condition: { hero_hp_pct_below: 60 } },
      { type: 'dot', value: 2, target: 'enemy', stack: 'bleed' },
      { type: 'stamina', value: 1, target: 'self' },
    ],
  },
  't1-agility-defense': {
    name: 'Parrying Stance',
    description: 'Gain 5 armor (scales DEX). Restore 1 stamina. On break: deal 4.',
    cooldown: 1.3,
    effects: [
      { type: 'armor', value: 5, target: 'self', scale: { stat: 'dex', per: 2, value: 1 } },
      { type: 'stamina', value: 1, target: 'self' },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 12000, trigger: 'on_armor_break',
        then: { type: 'damage', value: 4, target: 'enemy' } },
    ],
  },
  't1-agility-fire': {
    name: 'Flame Dart',
    description: 'Deal 5 to random foe (scales DEX). Burn 3.',
    cooldown: 1.1,
    effects: [
      { type: 'damage', value: 5, target: 'enemy', scale: { stat: 'dex', per: 3, value: 1 } },
      { type: 'dot', value: 3, target: 'enemy', stack: 'burn' },
    ],
  },
  't1-agility-water': {
    name: 'Mist Step',
    description: 'Heal 3. Restore 1 stamina. +1 DEX aura. Drain 1 enemy mana.',
    cooldown: 1.3,
    effects: [
      { type: 'heal', value: 3, target: 'self' },
      { type: 'stamina', value: 1, target: 'self' },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 6000, modifier: { kind: 'dex', value: 1 } },
      { type: 'mana', value: -1, target: 'enemy' },
    ],
  },
  't1-agility-air': {
    name: 'Gale Cut',
    description: 'Deal 5. Next cards cooldown -15% (4s).',
    cooldown: 1.0,
    effects: [
      { type: 'damage', value: 5, target: 'enemy' },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 4000, modifier: { kind: 'cd_reduction', value: 0.15 } },
    ],
  },
  't1-agility-earth': {
    name: 'Tremor Dash',
    description: 'Deal 5. Gain 4 armor. Restore 1 stamina.',
    cooldown: 1.6,
    effects: [
      { type: 'damage', value: 5, target: 'enemy' },
      { type: 'armor', value: 4, target: 'self' },
      { type: 'stamina', value: 1, target: 'self' },
    ],
  },
  't1-attack-counter': {
    name: 'Brutal Reprisal',
    description: 'Deal 7 (pierces armor below 40% HP). Scales STR.',
    cooldown: 1.5,
    cost: { stamina: 2 },
    effects: [
      { type: 'damage', value: 7, target: 'enemy', scale: { stat: 'str', per: 3, value: 2 }, pierce_armor: true, condition: { hero_hp_pct_below: 40 } },
      { type: 'damage', value: 7, target: 'enemy', scale: { stat: 'str', per: 3, value: 2 }, condition: { hero_hp_pct_atleast: 40 } },
    ],
  },
  't1-attack-defense': {
    name: 'Shield Bash',
    description: 'Spend 4 armor: deal 8 (scales STR). Taunt.',
    cooldown: 1.5,
    cost: { defense: 4 },
    effects: [
      { type: 'damage', value: 8, target: 'enemy', scale: { stat: 'str', per: 2, value: 2 } },
      { type: 'taunt', value: 1, target: 'enemy' },
    ],
  },
  't1-attack-fire': {
    name: 'Searing Cleave',
    description: 'Deal 6 (+4 if burning). Burn 4.',
    cooldown: 1.3,
    cost: { stamina: 1 },
    effects: [
      { type: 'damage', value: 6, target: 'enemy' },
      { type: 'damage', value: 4, target: 'enemy', condition: { enemy_has_stack: 'burn' } },
      { type: 'dot', value: 4, target: 'enemy', stack: 'burn' },
    ],
  },
  't1-attack-water': {
    name: 'Tide-Tempered Blade',
    description: 'Deal 6 (scales STR). Heal 2. Self-burn 1.',
    cooldown: 1.4,
    effects: [
      { type: 'damage', value: 6, target: 'enemy', scale: { stat: 'str', per: 2, value: 1 } },
      { type: 'heal', value: 2, target: 'self' },
      { type: 'dot', value: 1, target: 'self_dot', stack: 'burn' },
    ],
  },
  't1-air-attack': {
    name: 'Stormstrike',
    description: 'Deal 6 (scales STR). Next cards cooldown -20% (5s).',
    cooldown: 1.4,
    effects: [
      { type: 'damage', value: 6, target: 'enemy', scale: { stat: 'str', per: 3, value: 1 } },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 5000, modifier: { kind: 'cd_reduction', value: 0.20 } },
    ],
  },
  't1-attack-earth': {
    name: 'Crushing Blow',
    description: 'Deal 10 (scales STR). Gain 5 armor. -2 enemy defense (8s).',
    cooldown: 2.2,
    cost: { stamina: 2 },
    effects: [
      { type: 'damage', value: 10, target: 'enemy', scale: { stat: 'str', per: 2, value: 2 } },
      { type: 'armor', value: 5, target: 'self' },
      { type: 'aura', value: 0, target: 'enemy', ttl_ms: 8000, modifier: { kind: 'def', value: -2 } },
    ],
  },
  't1-counter-defense': {
    name: 'Iron Reckoning',
    description: 'Gain 5 armor (scales VIT). +2 rage. On break: deal 6 (scales rage).',
    cooldown: 1.7,
    cost: { stamina: 1 },
    effects: [
      { type: 'armor', value: 5, target: 'self', scale: { stat: 'vit', per: 2, value: 2 } },
      { type: 'stack', value: 2, target: 'self', stack: 'rage' },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 12000, trigger: 'on_armor_break',
        then: { type: 'damage', value: 6, target: 'enemy', scale: { stat: 'rage', per: 1, value: 1 } } },
    ],
  },
  't1-counter-fire': {
    name: 'Flickering Vengeance',
    description: 'Burn 5; +3 burn below 60% HP. Bleed 2.',
    cooldown: 1.4,
    effects: [
      { type: 'dot', value: 5, target: 'enemy', stack: 'burn' },
      { type: 'dot', value: 3, target: 'enemy', stack: 'burn', condition: { hero_hp_pct_below: 60 } },
      { type: 'dot', value: 2, target: 'enemy', stack: 'bleed' },
    ],
  },
  't1-counter-water': {
    name: 'Bloodtide Mend',
    description: 'Heal 5 (scales SPI); +4 below 50% HP. Self-bleed 2.',
    cooldown: 1.5,
    effects: [
      { type: 'heal', value: 5, target: 'self', scale: { stat: 'spi', per: 2, value: 2 } },
      { type: 'heal', value: 4, target: 'self', condition: { hero_hp_pct_below: 50 } },
      { type: 'dot', value: 2, target: 'self_dot', stack: 'bleed' },
    ],
  },
  't1-air-counter': {
    name: 'Hollow Echo',
    description: 'Deal 5; +3 below 50% HP. Next cards cooldown -15% (4s).',
    cooldown: 1.3,
    effects: [
      { type: 'damage', value: 5, target: 'enemy' },
      { type: 'damage', value: 3, target: 'enemy', condition: { hero_hp_pct_below: 50 } },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 4000, modifier: { kind: 'cd_reduction', value: 0.15 } },
    ],
  },
  't1-counter-earth': {
    name: 'Thornwall',
    description: 'Gain 8 armor (scales VIT). Deal 5. On break: deal 6.',
    cooldown: 2.0,
    cost: { stamina: 1 },
    effects: [
      { type: 'armor', value: 8, target: 'self', scale: { stat: 'vit', per: 2, value: 1 } },
      { type: 'damage', value: 5, target: 'enemy' },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 12000, trigger: 'on_armor_break',
        then: { type: 'damage', value: 6, target: 'enemy' } },
    ],
  },
  't1-defense-fire': {
    name: 'Forge Aegis',
    description: 'Gain 6 armor (scales VIT). Burn 3.',
    cooldown: 1.6,
    cost: { stamina: 1 },
    effects: [
      { type: 'armor', value: 6, target: 'self', scale: { stat: 'vit', per: 2, value: 1 } },
      { type: 'dot', value: 3, target: 'enemy', stack: 'burn' },
    ],
  },
  't1-defense-water': {
    name: 'Vow of the Tide',
    description: 'Gain 5 armor (scales VIT). Heal 3. Restore 1 stamina. +1 SPI aura.',
    cooldown: 1.6,
    cost: { mana: 1 },
    effects: [
      { type: 'armor', value: 5, target: 'self', scale: { stat: 'vit', per: 3, value: 1 } },
      { type: 'heal', value: 3, target: 'self' },
      { type: 'stamina', value: 1, target: 'self' },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 6000, modifier: { kind: 'spi', value: 1 } },
    ],
  },
  't1-air-defense': {
    name: 'Cyclone Ward',
    description: 'Gain 5 armor (scales VIT). Next cards cooldown -15% (4s).',
    cooldown: 1.4,
    effects: [
      { type: 'armor', value: 5, target: 'self', scale: { stat: 'vit', per: 3, value: 1 } },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 4000, modifier: { kind: 'cd_reduction', value: 0.15 } },
    ],
  },
  't1-defense-earth': {
    name: 'Bramble Bulwark',
    description: 'Gain 8 armor (scales VIT). Deal 6 piercing if armored ≥10.',
    cooldown: 2.0,
    cost: { stamina: 1 },
    effects: [
      { type: 'armor', value: 8, target: 'self', scale: { stat: 'vit', per: 2, value: 1 } },
      { type: 'damage', value: 6, target: 'enemy', pierce_armor: true, condition: { self_armor_atleast: 10 } },
    ],
  },
  't1-fire-water': {
    name: 'Steam Surge',
    description: 'Deal 4 (+4 if burning). Heal 4. Restore 1 stamina.',
    cooldown: 1.3,
    cost: { mana: 1 },
    effects: [
      { type: 'damage', value: 4, target: 'enemy' },
      { type: 'damage', value: 4, target: 'enemy', condition: { enemy_has_stack: 'burn' } },
      { type: 'heal', value: 4, target: 'self' },
      { type: 'stamina', value: 1, target: 'self' },
    ],
  },
  't1-air-fire': {
    name: 'Firestorm',
    description: 'AoE deal 4. Burn 3 AoE. Drain 1 enemy stamina.',
    cooldown: 1.8,
    cost: { mana: 1 },
    effects: [
      { type: 'damage', value: 4, target: 'enemy' },
      { type: 'dot', value: 3, target: 'enemy', stack: 'burn' },
      { type: 'stamina', value: -1, target: 'enemy' },
    ],
  },
  't1-earth-fire': {
    name: 'Magma Vein',
    description: 'Gain 7 armor. Deal 8. Burn 4.',
    cooldown: 2.3,
    cost: { mana: 2 },
    effects: [
      { type: 'armor', value: 7, target: 'self' },
      { type: 'damage', value: 8, target: 'enemy' },
      { type: 'dot', value: 4, target: 'enemy', stack: 'burn' },
    ],
  },
  't1-air-water': {
    name: 'Misting Veil',
    description: 'Heal 3. Next cards cooldown -20% (5s). +1 INT aura.',
    cooldown: 1.4,
    cost: { mana: 1 },
    effects: [
      { type: 'heal', value: 3, target: 'self' },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 5000, modifier: { kind: 'cd_reduction', value: 0.20 } },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 6000, modifier: { kind: 'int', value: 1 } },
    ],
  },
  't1-earth-water': {
    name: 'Mire Bloom',
    description: 'Gain 6 armor. Heal 4. Deal 5.',
    cooldown: 1.8,
    effects: [
      { type: 'armor', value: 6, target: 'self' },
      { type: 'heal', value: 4, target: 'self' },
      { type: 'damage', value: 5, target: 'enemy' },
    ],
  },
  't1-air-earth': {
    name: 'Sandstorm Wall',
    description: 'Gain 5 armor. Deal 4. Next cards cooldown -15% (4s).',
    cooldown: 1.8,
    cost: { mana: 1 },
    effects: [
      { type: 'armor', value: 5, target: 'self' },
      { type: 'damage', value: 4, target: 'enemy' },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 4000, modifier: { kind: 'cd_reduction', value: 0.15 } },
    ],
  },
};

let touched = 0;
for (const card of cards) {
  if (card.tier !== 1) continue;
  const r = REDESIGNS[card.id];
  if (!r) {
    console.warn('NO REDESIGN for', card.id);
    continue;
  }
  card.name = r.name;
  card.description = r.description;
  card.effects = r.effects;
  card.cooldown = r.cooldown;
  if (r.cost !== undefined) card.cost = r.cost;
  else delete card.cost;
  if (TARGETING_OVERRIDES[card.id]) card.targeting = TARGETING_OVERRIDES[card.id];
  // Strip any legacy upgraded variant so it doesn't reference stale effects.
  delete card.upgraded;
  touched++;
}
fs.writeFileSync(CARDS_PATH, JSON.stringify(data, null, 2) + '\n');
console.log('Tier-1 cards rewritten:', touched);
