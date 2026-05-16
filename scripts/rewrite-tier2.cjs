/* eslint-disable */
// One-shot tier-2 rewrite using the four new primitives:
//   multi_hit:N           N extra damage hits in one effect
//   consume_stack:true    on stack effect with negative value, consumes stacks
//   scale.source:'armor'  damage scales off current hero armor
//   trigger:'on_hp_pct_below' + threshold(0-100)  HP-edge triggered aura
const fs = require('fs');
const path = require('path');

const CARDS_PATH = path.join(__dirname, '..', 'src', 'data', 'json', 'cards.json');
const data = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8'));
const cards = Array.isArray(data) ? data : data.cards;

// Shorthand effect builders
const dmg = (v, opt = {}) => ({ type: 'damage', value: v, target: 'enemy', ...opt });
const pdmg = (v, opt = {}) => ({ type: 'damage', value: v, target: 'enemy', pierce_armor: true, ...opt });
const heal = (v, opt = {}) => ({ type: 'heal', value: v, target: 'self', ...opt });
const armor = (v, opt = {}) => ({ type: 'armor', value: v, target: 'self', ...opt });
const stam = (v) => ({ type: 'stamina', value: v, target: 'self' });
const mana = (v) => ({ type: 'mana', value: v, target: 'self' });
const drainStam = (v) => ({ type: 'stamina', value: -v, target: 'enemy' });
const drainMana = (v) => ({ type: 'mana', value: -v, target: 'enemy' });
const dot = (stack, v, opt = {}) => ({ type: 'dot', value: v, target: 'enemy', stack, ...opt });
const sdot = (stack, v) => ({ type: 'dot', value: v, target: 'self_dot', stack });
const stk = (stack, v, target = 'self') => ({ type: 'stack', value: v, target, stack });
const consumeRage = (n) => ({ type: 'stack', value: -n, target: 'self', stack: 'rage', consume_stack: true });
const consumeBurn = (n) => ({ type: 'stack', value: -n, target: 'enemy', stack: 'burn', consume_stack: true });
const consumeShock = (n) => ({ type: 'stack', value: -n, target: 'enemy', stack: 'shock', consume_stack: true });
const consumePoison = (n) => ({ type: 'stack', value: -n, target: 'enemy', stack: 'poison', consume_stack: true });
const debuff = (v) => ({ type: 'debuff', value: v, target: 'enemy' });
const auraMod = (kind, value, ttl_ms) => ({ type: 'aura', value: 0, target: 'self', ttl_ms, modifier: { kind, value } });
const auraEnemyDef = (value, ttl_ms) => ({ type: 'aura', value: 0, target: 'enemy', ttl_ms, modifier: { kind: 'def', value } });
const auraArmorBreak = (then, ttl_ms = 12000) => ({ type: 'aura', value: 0, target: 'self', ttl_ms, trigger: 'on_armor_break', then });
const auraHpBelow = (threshold, then, ttl_ms = 15000) => ({ type: 'aura', value: 0, target: 'self', ttl_ms, trigger: 'on_hp_pct_below', threshold, then });

const COND = {
  enemyBurn: { enemy_has_stack: 'burn' },
  enemyBurnPer: { enemy_has_stack: 'burn', per_stack: true },
  enemyPoison: { enemy_has_stack: 'poison' },
  enemyPoisonPer: { enemy_has_stack: 'poison', per_stack: true },
  enemyShock: { enemy_has_stack: 'shock' },
  enemyShockPer: { enemy_has_stack: 'shock', per_stack: true },
  enemyBleedPer: { enemy_has_stack: 'bleed', per_stack: true },
  selfRagePer: { self_has_stack: 'rage', per_stack: true },
  hpBelow: (p) => ({ hero_hp_pct_below: p }),
  hpAtleast: (p) => ({ hero_hp_pct_atleast: p }),
  armorAtleast: (n) => ({ self_armor_atleast: n }),
};

// All 120 redesigns — each carries name, description, cooldown, cost, effects
// (targeting kept "single" unless aoe-tagged via TARGETING_OVERRIDES below).
const REDESIGNS = {
  // ── Triple-element rare anchors (8 of the 10 are tri-mono) ──────────────
  't2-attack-attack-attack': {
    name: "Berserker's Ledger",
    description: 'Triple strike; STR scales each hit.',
    cooldown: 3.0,
    cost: { stamina: 2 },
    effects: [
      dmg(8, { scale: { stat: 'str', per: 2, value: 1 }, multi_hit: 2 }),
      sdot('bleed', 2),
    ],
  },
  't2-defense-defense-defense': {
    name: 'Aegis of Returning Wrath',
    description: 'Gain 22 armor; on break: deal 18 pierce.',
    cooldown: 3.6,
    cost: { stamina: 2 },
    effects: [
      armor(22, { scale: { stat: 'vit', per: 2, value: 4 } }),
      auraArmorBreak(pdmg(18), 14000),
    ],
  },
  't2-agility-agility-agility': {
    name: 'Quickstep Sigil',
    description: '−25% cd for 8s; deal 6.',
    cooldown: 3.0,
    cost: { stamina: 2 },
    effects: [
      auraMod('cd_reduction', 0.25, 8000),
      dmg(6, { scale: { stat: 'dex', per: 2, value: 2 } }),
    ],
  },
  't2-counter-counter-counter': {
    name: 'Open Vein',
    description: 'Per rage stack: deal 5 pierce + 1 bleed. Consume all rage.',
    cooldown: 3.5,
    cost: { stamina: 2 },
    effects: [
      pdmg(5, { condition: COND.selfRagePer }),
      dot('bleed', 1, { condition: COND.selfRagePer }),
      consumeRage(99),
    ],
  },
  't2-fire-fire-fire': {
    name: 'Inferno Detonator',
    description: 'Damage 4 per burn stack (pierces); consume all burn. Reseed 2 burn.',
    cooldown: 3.2,
    cost: { mana: 2 },
    effects: [
      pdmg(4, { condition: COND.enemyBurnPer }),
      consumeBurn(99),
      dot('burn', 2),
    ],
  },
  't2-water-water-water': {
    name: 'Tidesong Aura',
    description: 'Heal 12; +3 SPI aura 10s; restore 3 mana.',
    cooldown: 4.0,
    cost: { mana: 2 },
    effects: [
      heal(12, { scale: { stat: 'spi', per: 2, value: 2 } }),
      auraMod('spi', 3, 10000),
      mana(3),
    ],
  },
  't2-air-air-air': {
    name: 'Tempest Cadence',
    description: 'AoE 8 dmg; −30% cd aura 10s.',
    cooldown: 3.5,
    cost: { mana: 2 },
    effects: [
      dmg(8, { scale: { stat: 'dex', per: 2, value: 2 } }),
      auraMod('cd_reduction', 0.30, 10000),
    ],
  },
  't2-earth-earth-earth': {
    name: "Mountain's Answer",
    description: 'Gain 26 armor; if armor ≥20, deal 22 pierce.',
    cooldown: 4.5,
    cost: { stamina: 2 },
    effects: [
      armor(26, { scale: { stat: 'vit', per: 2, value: 4 } }),
      pdmg(22, { condition: COND.armorAtleast(20) }),
    ],
  },

  // ── Attack core (with defense/agility/counter) ──────────────────────────
  't2-attack-attack-defense': {
    name: 'Iron Volley',
    description: 'Hit twice for 9 STR; gain 8 armor.',
    cooldown: 2.0,
    cost: { stamina: 2 },
    effects: [
      dmg(9, { scale: { stat: 'str', per: 2, value: 1 }, multi_hit: 1 }),
      armor(8),
    ],
  },
  't2-agility-attack-attack': {
    name: 'Triple Slash',
    description: 'Hit thrice for 6 (scales DEX).',
    cooldown: 1.6,
    cost: { stamina: 2 },
    effects: [
      dmg(6, { scale: { stat: 'dex', per: 3, value: 1 }, multi_hit: 2 }),
    ],
  },
  't2-attack-attack-counter': {
    name: 'Wounded Beast',
    description: 'Deal 12 STR; below 40% HP, hit again with bleed 3.',
    cooldown: 2.4,
    cost: { stamina: 2 },
    effects: [
      dmg(12, { scale: { stat: 'str', per: 2, value: 2 } }),
      dmg(10, { condition: COND.hpBelow(40), scale: { stat: 'str', per: 2, value: 1 } }),
      dot('bleed', 3, { condition: COND.hpBelow(40) }),
    ],
  },
  't2-attack-defense-defense': {
    name: 'Body Slam Vow',
    description: 'Pierce damage equal to current armor.',
    cooldown: 3.0,
    cost: { stamina: 2 },
    effects: [
      pdmg(2, { scale: { stat: 'vit', per: 1, value: 1, source: 'armor' } }),
      armor(6),
    ],
  },
  't2-agility-defense-defense': {
    name: 'Phalanx Drift',
    description: 'Gain 18 armor; −15% cd aura 6s.',
    cooldown: 2.6,
    cost: { stamina: 1 },
    effects: [
      armor(18, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraMod('cd_reduction', 0.15, 6000),
    ],
  },
  't2-counter-defense-defense': {
    name: 'Crimson Mantle',
    description: 'Gain 16 armor; on break, +3 rage.',
    cooldown: 2.6,
    cost: { stamina: 2 },
    effects: [
      armor(16, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(stk('rage', 3, 'self'), 15000),
    ],
  },
  't2-agility-agility-attack': {
    name: 'Pinprick Volley',
    description: 'Pierce 5 × 3 hits (scales DEX).',
    cooldown: 1.5,
    cost: { stamina: 1 },
    effects: [
      pdmg(5, { scale: { stat: 'dex', per: 3, value: 1 }, multi_hit: 2 }),
    ],
  },
  't2-agility-agility-defense': {
    name: 'Veil of Steps',
    description: 'Gain 14 armor (DEX); −20% cd aura 6s.',
    cooldown: 1.6,
    cost: { stamina: 1 },
    effects: [
      armor(14, { scale: { stat: 'dex', per: 2, value: 1 } }),
      auraMod('cd_reduction', 0.20, 6000),
    ],
  },
  't2-agility-agility-counter': {
    name: 'Quicksilver Bleed',
    description: 'Bleed 5; +2 dmg per bleed stack.',
    cooldown: 1.8,
    cost: { stamina: 1 },
    effects: [
      dot('bleed', 5),
      dmg(2, { condition: COND.enemyBleedPer }),
    ],
  },
  't2-attack-counter-counter': {
    name: 'Vein Splitter',
    description: 'Hit twice for 9; if rage ≥3, +4 pierce hit and consume 3 rage.',
    cooldown: 2.0,
    cost: { stamina: 2 },
    effects: [
      dmg(9, { scale: { stat: 'str', per: 2, value: 1 }, multi_hit: 1 }),
      pdmg(4, { condition: { self_has_stack: 'rage' } }),
      { type: 'stack', value: -3, target: 'self', stack: 'rage', consume_stack: true, condition: { self_has_stack: 'rage' } },
    ],
  },
  't2-counter-counter-defense': {
    name: 'Wrathwall',
    description: 'Gain 14 armor; on break, +5 rage.',
    cooldown: 2.8,
    cost: { stamina: 2 },
    effects: [
      armor(14, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(stk('rage', 5, 'self'), 15000),
    ],
  },
  't2-agility-counter-counter': {
    name: 'Whirlwind of Spite',
    description: 'Hit twice; if rage ≥3, +12 dmg and consume 3 rage.',
    cooldown: 2.2,
    cost: { stamina: 2 },
    effects: [
      dmg(6, { multi_hit: 1 }),
      dmg(12, { condition: { self_has_stack: 'rage' } }),
      { type: 'stack', value: -3, target: 'self', stack: 'rage', consume_stack: true, condition: { self_has_stack: 'rage' } },
    ],
  },
  't2-agility-attack-defense': {
    name: 'Flowstrike',
    description: 'Deal 10; gain 10 armor; −15% cd aura 6s.',
    cooldown: 2.0,
    cost: { stamina: 2 },
    effects: [
      dmg(10, { scale: { stat: 'str', per: 3, value: 1 } }),
      armor(10),
      auraMod('cd_reduction', 0.15, 6000),
    ],
  },
  't2-attack-counter-defense': {
    name: 'Vengeful Bulwark',
    description: 'Gain 12 armor; if armor ≥20, deal 18 pierce.',
    cooldown: 2.6,
    cost: { stamina: 2 },
    effects: [
      armor(12, { scale: { stat: 'vit', per: 2, value: 2 } }),
      pdmg(18, { condition: COND.armorAtleast(20) }),
    ],
  },
  't2-agility-attack-counter': {
    name: 'Cutpurse',
    description: 'Deal 8; bleed 3; +2 dmg per bleed.',
    cooldown: 1.8,
    cost: { stamina: 1 },
    effects: [
      dmg(8, { scale: { stat: 'dex', per: 3, value: 1 } }),
      dot('bleed', 3),
      dmg(2, { condition: COND.enemyBleedPer }),
    ],
  },
  't2-agility-counter-defense': {
    name: 'Bramble Step',
    description: 'Gain 10 armor; on break, bleed 4.',
    cooldown: 2.2,
    cost: { stamina: 1 },
    effects: [
      armor(10, { scale: { stat: 'dex', per: 2, value: 1 } }),
      auraArmorBreak(dot('bleed', 4), 12000),
    ],
  },

  // ── Element triples (already did mono above) ────────────────────────────
  't2-fire-fire-water': {
    name: 'Steam Lash',
    description: 'Deal 12 + 3 burn; consume 3 burn → +10 dmg.',
    cooldown: 2.6,
    cost: { mana: 2 },
    effects: [
      dmg(12),
      dot('burn', 3),
      dmg(10, { condition: { enemy_has_stack: 'burn' } }),
      consumeBurn(3),
    ],
  },
  't2-air-fire-fire': {
    name: 'Updraft Ember',
    description: 'Hit twice for 7; +per burn pierce 3.',
    cooldown: 2.4,
    cost: { mana: 2 },
    effects: [
      dmg(7, { multi_hit: 1 }),
      pdmg(3, { condition: COND.enemyBurnPer }),
    ],
  },
  't2-earth-fire-fire': {
    name: 'Coalwall',
    description: 'Gain 14 armor; on break, dot 5 burn.',
    cooldown: 3.0,
    cost: { mana: 2 },
    effects: [
      armor(14, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(dot('burn', 5), 12000),
    ],
  },
  't2-fire-water-water': {
    name: 'Phoenix Aura',
    description: 'Heal 10; below 50% HP, gain 18 armor.',
    cooldown: 3.5,
    cost: { mana: 2 },
    effects: [
      heal(10, { scale: { stat: 'spi', per: 2, value: 2 } }),
      auraHpBelow(50, armor(18), 12000),
    ],
  },
  't2-air-water-water': {
    name: 'Misted Cadence',
    description: 'Heal 9; −25% cd aura 8s; +3 mana.',
    cooldown: 2.6,
    cost: { mana: 2 },
    effects: [
      heal(9, { scale: { stat: 'spi', per: 2, value: 2 } }),
      auraMod('cd_reduction', 0.25, 8000),
      mana(3),
    ],
  },
  't2-earth-water-water': {
    name: 'Brine Bedrock',
    description: 'Heal 10; below 50% HP, poison 6.',
    cooldown: 3.5,
    cost: { mana: 2 },
    effects: [
      heal(10, { scale: { stat: 'spi', per: 2, value: 2 } }),
      dot('poison', 6, { condition: COND.hpBelow(50) }),
    ],
  },
  't2-air-air-fire': {
    name: 'Cinder Gale',
    description: 'Shock 3 + burn 3; +2 dmg per shock.',
    cooldown: 2.2,
    cost: { mana: 2 },
    effects: [
      dot('shock', 3),
      dot('burn', 3),
      dmg(2, { condition: COND.enemyShockPer }),
    ],
  },
  't2-air-air-water': {
    name: 'Squall Aura',
    description: 'Heal 6; −25% cd aura 8s; +4 mana.',
    cooldown: 2.6,
    cost: { mana: 2 },
    effects: [
      heal(6),
      auraMod('cd_reduction', 0.25, 8000),
      mana(4),
    ],
  },
  't2-air-air-earth': {
    name: 'Dust Cyclone',
    description: 'Gain 10 armor; on break, shock 4.',
    cooldown: 2.8,
    cost: { mana: 2 },
    effects: [
      armor(10),
      auraArmorBreak(dot('shock', 4), 12000),
    ],
  },
  't2-earth-earth-fire': {
    name: 'Magma Vow',
    description: 'Gain 14 armor; below 40% HP, 20 pierce.',
    cooldown: 3.5,
    cost: { mana: 2 },
    effects: [
      armor(14, { scale: { stat: 'vit', per: 2, value: 2 } }),
      pdmg(20, { condition: COND.hpBelow(40) }),
    ],
  },
  't2-earth-earth-water': {
    name: 'Mudbind',
    description: 'Gain 12 armor; poison 3; if armor ≥15, +3 poison.',
    cooldown: 2.8,
    cost: { mana: 2 },
    effects: [
      armor(12, { scale: { stat: 'vit', per: 2, value: 2 } }),
      dot('poison', 3),
      dot('poison', 3, { condition: COND.armorAtleast(15) }),
    ],
  },
  't2-air-earth-earth': {
    name: 'Standing Stone',
    description: 'Gain 16 armor; on break, heal 8.',
    cooldown: 3.5,
    cost: { mana: 2 },
    effects: [
      armor(16, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(heal(8), 12000),
      auraMod('cd_reduction', 0.10, 8000),
    ],
  },
  't2-air-fire-water': {
    name: 'Triadic Hex',
    description: 'Burn 3 + poison 3 + shock 3.',
    cooldown: 3.0,
    cost: { mana: 3 },
    effects: [
      dot('burn', 3),
      dot('poison', 3),
      dot('shock', 3),
    ],
  },
  't2-earth-fire-water': {
    name: "Alchemist's Cauldron",
    description: 'Consume 3 burn → heal 10 + poison 3.',
    cooldown: 3.0,
    cost: { mana: 2 },
    effects: [
      heal(10, { condition: { enemy_has_stack: 'burn' } }),
      dot('poison', 3, { condition: { enemy_has_stack: 'burn' } }),
      consumeBurn(3),
    ],
  },
  't2-air-earth-fire': {
    name: 'Sandstorm Pyre',
    description: 'Hit twice for 8; per shock stack pierce 2.',
    cooldown: 2.6,
    cost: { mana: 2 },
    effects: [
      dmg(8, { multi_hit: 1 }),
      pdmg(2, { condition: COND.enemyShockPer }),
    ],
  },
  't2-air-earth-water': {
    name: 'Stormbog',
    description: 'Poison 3 + shock 3; if enemy poisoned, +14 dmg.',
    cooldown: 3.0,
    cost: { mana: 2 },
    effects: [
      dot('poison', 3),
      dot('shock', 3),
      dmg(14, { condition: { enemy_has_stack: 'poison' } }),
    ],
  },

  // ── Attack + element pairs ──────────────────────────────────────────────
  't2-attack-attack-fire': {
    name: 'Cinder Thrust',
    description: 'Hit twice for 10; burn 2.',
    cooldown: 1.8,
    cost: { stamina: 2 },
    effects: [
      dmg(10, { scale: { stat: 'str', per: 2, value: 1 }, multi_hit: 1 }),
      dot('burn', 2),
    ],
  },
  't2-attack-attack-water': {
    name: 'Soaking Blade',
    description: 'Deal 12; poison 2; if enemy poisoned, +8 dmg.',
    cooldown: 2.0,
    cost: { stamina: 2 },
    effects: [
      dmg(12, { scale: { stat: 'str', per: 2, value: 1 } }),
      dot('poison', 2),
      dmg(8, { condition: { enemy_has_stack: 'poison' } }),
    ],
  },
  't2-air-attack-attack': {
    name: 'Galekick',
    description: 'Hit twice for 7; shock 2.',
    cooldown: 1.6,
    cost: { stamina: 2 },
    effects: [
      dmg(7, { scale: { stat: 'str', per: 2, value: 1 }, multi_hit: 1 }),
      dot('shock', 2),
    ],
  },
  't2-attack-attack-earth': {
    name: 'Boulder Toss',
    description: 'Deal 18 STR; if armor ≥10, pierce.',
    cooldown: 2.4,
    cost: { stamina: 2 },
    effects: [
      dmg(18, { scale: { stat: 'str', per: 2, value: 2 } }),
      pdmg(6, { condition: COND.armorAtleast(10) }),
    ],
  },
  't2-defense-defense-fire': {
    name: 'Heated Plate',
    description: 'Gain 16 armor; on break, burn 4.',
    cooldown: 2.8,
    cost: { stamina: 2 },
    effects: [
      armor(16, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(dot('burn', 4), 12000),
    ],
  },
  't2-defense-defense-water': {
    name: 'Tidewall',
    description: 'Gain 14 armor; heal 8; poison 2.',
    cooldown: 2.6,
    cost: { mana: 1 },
    effects: [
      armor(14, { scale: { stat: 'vit', per: 2, value: 2 } }),
      heal(8),
      dot('poison', 2),
    ],
  },
  't2-air-defense-defense': {
    name: 'Stormgate',
    description: 'Gain 14 armor; −15% cd aura 10s.',
    cooldown: 3.0,
    cost: { stamina: 2 },
    effects: [
      armor(14, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraMod('cd_reduction', 0.15, 10000),
    ],
  },
  't2-defense-defense-earth': {
    name: 'Tectonic Vow',
    description: 'Gain 20 armor; below 50% HP, +12 armor.',
    cooldown: 3.5,
    cost: { stamina: 2 },
    effects: [
      armor(20, { scale: { stat: 'vit', per: 2, value: 4 } }),
      auraHpBelow(50, armor(12), 15000),
    ],
  },
  't2-agility-agility-fire': {
    name: 'Embertrick',
    description: 'Burn 4; +2 dmg per burn.',
    cooldown: 1.4,
    cost: { mana: 1 },
    effects: [
      dot('burn', 4),
      dmg(2, { condition: COND.enemyBurnPer }),
    ],
  },
  't2-agility-agility-water': {
    name: 'Slipstream',
    description: 'Pierce 6 + poison 2; −15% cd aura 6s.',
    cooldown: 1.6,
    cost: { mana: 1 },
    effects: [
      pdmg(6, { scale: { stat: 'dex', per: 3, value: 1 } }),
      dot('poison', 2),
      auraMod('cd_reduction', 0.15, 6000),
    ],
  },
  't2-agility-agility-air': {
    name: 'Zephyr Cascade',
    description: 'Shock 3; +2 dmg per shock.',
    cooldown: 1.4,
    cost: { mana: 1 },
    effects: [
      dot('shock', 3),
      dmg(2, { condition: COND.enemyShockPer }),
    ],
  },
  't2-agility-agility-earth': {
    name: 'Footwork Stone',
    description: 'Gain 10 armor; −20% cd aura 6s.',
    cooldown: 1.8,
    cost: { stamina: 1 },
    effects: [
      armor(10, { scale: { stat: 'vit', per: 2, value: 1 } }),
      auraMod('cd_reduction', 0.20, 6000),
    ],
  },
  't2-counter-counter-fire': {
    name: 'Ragefire',
    description: 'Consume 3 rage → 16 dmg + 3 burn.',
    cooldown: 2.4,
    cost: { stamina: 2 },
    effects: [
      dmg(16, { condition: { self_has_stack: 'rage' } }),
      dot('burn', 3, { condition: { self_has_stack: 'rage' } }),
      consumeRage(3),
    ],
  },
  't2-counter-counter-water': {
    name: 'Bitter Tide',
    description: 'Self-bleed 4; on break, heal 8.',
    cooldown: 2.6,
    cost: { mana: 1 },
    effects: [
      sdot('bleed', 4),
      auraArmorBreak(heal(8), 12000),
    ],
  },
  't2-air-counter-counter': {
    name: 'Thunderhowl',
    description: 'Consume 4 rage → shock 6.',
    cooldown: 2.4,
    cost: { stamina: 2 },
    effects: [
      dot('shock', 6, { condition: { self_has_stack: 'rage' } }),
      consumeRage(4),
    ],
  },
  't2-counter-counter-earth': {
    name: 'Stonewrath',
    description: 'Gain 12 armor; below 50% HP, +6 rage.',
    cooldown: 3.0,
    cost: { stamina: 2 },
    effects: [
      armor(12, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraHpBelow(50, stk('rage', 6, 'self'), 15000),
    ],
  },
  't2-attack-defense-fire': {
    name: 'Forge Strike',
    description: 'Deal 12; gain 8 armor; burn 3.',
    cooldown: 2.4,
    cost: { stamina: 2 },
    effects: [
      dmg(12, { scale: { stat: 'str', per: 2, value: 1 } }),
      armor(8),
      dot('burn', 3),
    ],
  },
  't2-attack-defense-water': {
    name: 'Mire Cleave',
    description: 'Deal 10; gain 8 armor; poison 3.',
    cooldown: 2.4,
    cost: { stamina: 1, mana: 1 },
    effects: [
      dmg(10, { scale: { stat: 'str', per: 2, value: 1 } }),
      armor(8),
      dot('poison', 3),
    ],
  },
  't2-air-attack-defense': {
    name: 'Stormhilt',
    description: 'Hit twice for 8; armor 6; shock 2.',
    cooldown: 2.2,
    cost: { stamina: 2 },
    effects: [
      dmg(8, { multi_hit: 1 }),
      armor(6),
      dot('shock', 2),
    ],
  },
  't2-attack-defense-earth': {
    name: 'Earthcleaver',
    description: 'Deal 14; if armor ≥15, +8 pierce.',
    cooldown: 2.8,
    cost: { stamina: 2 },
    effects: [
      dmg(14, { scale: { stat: 'str', per: 2, value: 2 } }),
      pdmg(8, { condition: COND.armorAtleast(15) }),
    ],
  },
  't2-agility-attack-fire': {
    name: 'Wickfencer',
    description: 'Hit twice for 6; +2 dmg per burn.',
    cooldown: 1.7,
    cost: { stamina: 2 },
    effects: [
      dmg(6, { multi_hit: 1 }),
      dmg(2, { condition: COND.enemyBurnPer }),
    ],
  },
  't2-agility-attack-water': {
    name: "Drowner's Dart",
    description: 'Pierce 8; poison 2.',
    cooldown: 1.6,
    cost: { stamina: 1, mana: 1 },
    effects: [
      pdmg(8, { scale: { stat: 'dex', per: 3, value: 1 } }),
      dot('poison', 2),
    ],
  },
  't2-agility-air-attack': {
    name: 'Skywire',
    description: 'Hit thrice for 5; shock 2.',
    cooldown: 1.5,
    cost: { stamina: 2 },
    effects: [
      dmg(5, { scale: { stat: 'dex', per: 3, value: 1 }, multi_hit: 2 }),
      dot('shock', 2),
    ],
  },
  't2-agility-attack-earth': {
    name: 'Quarry Dance',
    description: 'Deal 10; if armor ≥10, +8 dmg.',
    cooldown: 2.0,
    cost: { stamina: 2 },
    effects: [
      dmg(10, { scale: { stat: 'dex', per: 2, value: 1 } }),
      dmg(8, { condition: COND.armorAtleast(10) }),
    ],
  },
  't2-attack-counter-fire': {
    name: 'Pyre Vengeance',
    description: 'Consume 3 rage → 12 dmg ×2; burn 3.',
    cooldown: 2.6,
    cost: { stamina: 2 },
    effects: [
      dmg(12, { multi_hit: 1, condition: { self_has_stack: 'rage' } }),
      dot('burn', 3, { condition: { self_has_stack: 'rage' } }),
      consumeRage(3),
    ],
  },
  't2-attack-counter-water': {
    name: 'Blood Brine',
    description: 'Self-bleed 3; poison enemy 4.',
    cooldown: 2.4,
    cost: { stamina: 2 },
    effects: [
      sdot('bleed', 3),
      dot('poison', 4),
      dmg(6, { scale: { stat: 'str', per: 3, value: 1 } }),
    ],
  },
  't2-air-attack-counter': {
    name: 'Thunderclap',
    description: 'Deal 10; consume 3 shock → +12 pierce.',
    cooldown: 2.0,
    cost: { stamina: 2 },
    effects: [
      dmg(10),
      pdmg(12, { condition: { enemy_has_stack: 'shock' } }),
      consumeShock(3),
    ],
  },
  't2-attack-counter-earth': {
    name: 'Granitewrath',
    description: 'Deal 14; below 50% HP, +12 pierce.',
    cooldown: 2.8,
    cost: { stamina: 2 },
    effects: [
      dmg(14, { scale: { stat: 'str', per: 2, value: 2 } }),
      pdmg(12, { condition: COND.hpBelow(50) }),
    ],
  },
  't2-agility-defense-fire': {
    name: 'Ember Vault',
    description: 'Gain 10 armor; on break, burn 4.',
    cooldown: 2.4,
    cost: { stamina: 1, mana: 1 },
    effects: [
      armor(10),
      auraArmorBreak(dot('burn', 4), 12000),
    ],
  },
  't2-agility-defense-water': {
    name: 'Tidefoot Guard',
    description: 'Gain 12 armor; poison 2; −15% cd aura 6s.',
    cooldown: 2.4,
    cost: { mana: 1 },
    effects: [
      armor(12),
      dot('poison', 2),
      auraMod('cd_reduction', 0.15, 6000),
    ],
  },
  't2-agility-air-defense': {
    name: 'Galeguard',
    description: 'Gain 10 armor; −25% cd aura 8s.',
    cooldown: 2.4,
    cost: { stamina: 1 },
    effects: [
      armor(10),
      auraMod('cd_reduction', 0.25, 8000),
    ],
  },
  't2-agility-defense-earth': {
    name: 'Quickstone',
    description: 'Gain 14 armor; below 60% HP, −30% cd aura 6s.',
    cooldown: 2.6,
    cost: { stamina: 1, mana: 1 },
    effects: [
      armor(14),
      auraHpBelow(60, auraMod('cd_reduction', 0.30, 6000), 15000),
    ],
  },
  't2-counter-defense-fire': {
    name: 'Ashen Bulwark',
    description: 'Gain 12 armor; on break, 12 dmg + burn 3.',
    cooldown: 2.8,
    cost: { stamina: 2 },
    effects: [
      armor(12, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(dmg(12), 12000),
      auraArmorBreak(dot('burn', 3), 12000),
    ],
  },
  't2-counter-defense-water': {
    name: 'Vengeful Brine',
    description: 'Gain 10 armor; on break, poison 5.',
    cooldown: 2.8,
    cost: { stamina: 1, mana: 1 },
    effects: [
      armor(10, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(dot('poison', 5), 12000),
    ],
  },
  't2-air-counter-defense': {
    name: 'Stormwarden',
    description: 'Gain 10 armor; on break, shock 6.',
    cooldown: 2.8,
    cost: { stamina: 1, mana: 1 },
    effects: [
      armor(10, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(dot('shock', 6), 12000),
    ],
  },
  't2-counter-defense-earth': {
    name: 'Tombplate',
    description: 'Gain 18 armor; below 40% HP, +10 armor + 4 rage.',
    cooldown: 3.5,
    cost: { stamina: 2 },
    effects: [
      armor(18, { scale: { stat: 'vit', per: 2, value: 4 } }),
      auraHpBelow(40, armor(10), 15000),
      auraHpBelow(40, stk('rage', 4, 'self'), 15000),
    ],
  },
  't2-agility-counter-fire': {
    name: 'Sparkbleed',
    description: 'Burn 3 + bleed 3; +2 dmg per bleed.',
    cooldown: 1.8,
    cost: { stamina: 1, mana: 1 },
    effects: [
      dot('burn', 3),
      dot('bleed', 3),
      dmg(2, { condition: COND.enemyBleedPer }),
    ],
  },
  't2-agility-counter-water': {
    name: 'Venom Dance',
    description: 'Poison 4; consume 3 poison → 14 dmg.',
    cooldown: 2.0,
    cost: { mana: 1 },
    effects: [
      dot('poison', 4),
      dmg(14, { condition: { enemy_has_stack: 'poison' } }),
      consumePoison(3),
    ],
  },
  't2-agility-air-counter': {
    name: 'Static Skirmish',
    description: 'Shock 3; +3 pierce per shock.',
    cooldown: 1.8,
    cost: { stamina: 1, mana: 1 },
    effects: [
      dot('shock', 3),
      pdmg(3, { condition: COND.enemyShockPer }),
    ],
  },
  't2-agility-counter-earth': {
    name: 'Quickearth Rite',
    description: 'Gain 8 armor; below 60% HP, 14 pierce.',
    cooldown: 2.4,
    cost: { stamina: 1, mana: 1 },
    effects: [
      armor(8),
      pdmg(14, { condition: COND.hpBelow(60) }),
    ],
  },

  // ── Attack + pure element pairs ─────────────────────────────────────────
  't2-attack-fire-fire': {
    name: 'Cinderlance',
    description: 'Hit twice for 8; +2 pierce per burn.',
    cooldown: 2.2,
    cost: { stamina: 1, mana: 1 },
    effects: [
      dmg(8, { scale: { stat: 'str', per: 2, value: 1 }, multi_hit: 1 }),
      pdmg(2, { condition: COND.enemyBurnPer }),
    ],
  },
  't2-attack-water-water': {
    name: 'Drown Lance',
    description: 'Deal 10 + poison 4; if poisoned, pierce.',
    cooldown: 2.4,
    cost: { stamina: 1, mana: 1 },
    effects: [
      dmg(10, { scale: { stat: 'str', per: 2, value: 1 } }),
      dot('poison', 4),
      pdmg(6, { condition: { enemy_has_stack: 'poison' } }),
    ],
  },
  't2-air-air-attack': {
    name: 'Tempest Pike',
    description: 'Hit thrice for 6; shock 2.',
    cooldown: 1.8,
    cost: { stamina: 2 },
    effects: [
      dmg(6, { multi_hit: 2 }),
      dot('shock', 2),
    ],
  },
  't2-attack-earth-earth': {
    name: "Mountain's Will",
    description: 'Deal 20; if armor ≥20, pierce.',
    cooldown: 3.0,
    cost: { stamina: 2 },
    effects: [
      dmg(20, { scale: { stat: 'str', per: 2, value: 2 } }),
      pdmg(8, { condition: COND.armorAtleast(20) }),
    ],
  },
  't2-attack-fire-water': {
    name: 'Boiling Edge',
    description: 'Deal 12; consume 3 burn → poison 4.',
    cooldown: 2.4,
    cost: { stamina: 1, mana: 1 },
    effects: [
      dmg(12, { scale: { stat: 'str', per: 2, value: 1 } }),
      dot('poison', 4, { condition: { enemy_has_stack: 'burn' } }),
      consumeBurn(3),
    ],
  },
  't2-air-attack-fire': {
    name: 'Galepyre',
    description: 'Deal 8; shock 3 + burn 3.',
    cooldown: 2.0,
    cost: { stamina: 1, mana: 1 },
    effects: [
      dmg(8, { scale: { stat: 'str', per: 3, value: 1 } }),
      dot('shock', 3),
      dot('burn', 3),
    ],
  },
  't2-attack-earth-fire': {
    name: 'Slag Maul',
    description: 'Deal 14; on break, 12 dmg + burn 3.',
    cooldown: 2.6,
    cost: { stamina: 2 },
    effects: [
      dmg(14, { scale: { stat: 'str', per: 2, value: 1 } }),
      auraArmorBreak(dmg(12), 12000),
      auraArmorBreak(dot('burn', 3), 12000),
    ],
  },
  't2-air-attack-water': {
    name: 'Galetide',
    description: 'Pierce 10; poison 3 + shock 2.',
    cooldown: 2.0,
    cost: { stamina: 1, mana: 1 },
    effects: [
      pdmg(10, { scale: { stat: 'str', per: 3, value: 1 } }),
      dot('poison', 3),
      dot('shock', 2),
    ],
  },
  't2-attack-earth-water': {
    name: 'Mirebreaker',
    description: 'Deal 14; if poisoned, pierce +6.',
    cooldown: 2.6,
    cost: { stamina: 1, mana: 1 },
    effects: [
      dmg(14, { scale: { stat: 'str', per: 2, value: 2 } }),
      pdmg(6, { condition: { enemy_has_stack: 'poison' } }),
    ],
  },
  't2-air-attack-earth': {
    name: 'Cliffwind Maul',
    description: 'Deal 12; if armor ≥12, +10 pierce.',
    cooldown: 2.6,
    cost: { stamina: 2 },
    effects: [
      dmg(12, { scale: { stat: 'str', per: 2, value: 2 } }),
      pdmg(10, { condition: COND.armorAtleast(12) }),
    ],
  },

  // ── Defense + pure element pairs ────────────────────────────────────────
  't2-defense-fire-fire': {
    name: 'Forgeward',
    description: 'Gain 16 armor; on break, burn 6.',
    cooldown: 2.8,
    cost: { stamina: 1, mana: 1 },
    effects: [
      armor(16, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(dot('burn', 6), 12000),
    ],
  },
  't2-defense-water-water': {
    name: 'Brineward',
    description: 'Gain 14 armor; heal 8; poison 3.',
    cooldown: 2.8,
    cost: { mana: 2 },
    effects: [
      armor(14, { scale: { stat: 'vit', per: 2, value: 2 } }),
      heal(8),
      dot('poison', 3),
    ],
  },
  't2-air-air-defense': {
    name: 'Galeward',
    description: 'Gain 12 armor; −20% cd aura 10s.',
    cooldown: 3.0,
    cost: { stamina: 1, mana: 1 },
    effects: [
      armor(12, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraMod('cd_reduction', 0.20, 10000),
    ],
  },
  't2-defense-earth-earth': {
    name: 'Granite Aegis',
    description: 'Gain 22 armor; below 50% HP, +10 armor.',
    cooldown: 3.5,
    cost: { stamina: 1, mana: 1 },
    effects: [
      armor(22, { scale: { stat: 'vit', per: 2, value: 4 } }),
      auraHpBelow(50, armor(10), 15000),
    ],
  },
  't2-defense-fire-water': {
    name: 'Steam Bulwark',
    description: 'Gain 14 armor; on break, poison 4 + burn 4.',
    cooldown: 2.8,
    cost: { mana: 2 },
    effects: [
      armor(14, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(dot('poison', 4), 12000),
      auraArmorBreak(dot('burn', 4), 12000),
    ],
  },
  't2-air-defense-fire': {
    name: 'Ember Sailwall',
    description: 'Gain 12 armor; burn 3; −15% cd aura 6s.',
    cooldown: 2.6,
    cost: { mana: 2 },
    effects: [
      armor(12),
      dot('burn', 3),
      auraMod('cd_reduction', 0.15, 6000),
    ],
  },
  't2-defense-earth-fire': {
    name: 'Magmaplate',
    description: 'Gain 16 armor; on break, 14 dmg + burn 4.',
    cooldown: 3.0,
    cost: { stamina: 2 },
    effects: [
      armor(16, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(dmg(14), 12000),
      auraArmorBreak(dot('burn', 4), 12000),
    ],
  },
  't2-air-defense-water': {
    name: 'Mistplate',
    description: 'Gain 12 armor; poison 3 + shock 2.',
    cooldown: 2.6,
    cost: { mana: 2 },
    effects: [
      armor(12),
      dot('poison', 3),
      dot('shock', 2),
    ],
  },
  't2-defense-earth-water': {
    name: 'Bogplate',
    description: 'Gain 14 armor; below 60% HP, poison 5.',
    cooldown: 3.0,
    cost: { stamina: 1, mana: 1 },
    effects: [
      armor(14, { scale: { stat: 'vit', per: 2, value: 2 } }),
      dot('poison', 5, { condition: COND.hpBelow(60) }),
    ],
  },
  't2-air-defense-earth': {
    name: 'Dustward',
    description: 'Gain 16 armor; −10% cd aura 12s; on break, shock 4.',
    cooldown: 3.3,
    cost: { stamina: 1, mana: 1 },
    effects: [
      armor(16, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraMod('cd_reduction', 0.10, 12000),
      auraArmorBreak(dot('shock', 4), 12000),
    ],
  },

  // ── Agility + pure element pairs ────────────────────────────────────────
  't2-agility-fire-fire': {
    name: 'Cinder Sprint',
    description: 'Burn 4; consume 3 burn → 12 dmg.',
    cooldown: 1.6,
    cost: { mana: 1 },
    effects: [
      dot('burn', 4),
      dmg(12, { condition: { enemy_has_stack: 'burn' } }),
      consumeBurn(3),
    ],
  },
  't2-agility-water-water': {
    name: 'Venom Slip',
    description: 'Poison 5; −15% cd aura 6s.',
    cooldown: 1.6,
    cost: { mana: 1 },
    effects: [
      dot('poison', 5),
      auraMod('cd_reduction', 0.15, 6000),
    ],
  },
  't2-agility-air-air': {
    name: 'Stormstep',
    description: 'Shock 4; −20% cd aura 6s.',
    cooldown: 1.4,
    cost: { mana: 1 },
    effects: [
      dot('shock', 4),
      auraMod('cd_reduction', 0.20, 6000),
    ],
  },
  't2-agility-earth-earth': {
    name: 'Stonepacer',
    description: 'Gain 10 armor; −20% cd aura 8s.',
    cooldown: 1.8,
    cost: { stamina: 1 },
    effects: [
      armor(10),
      auraMod('cd_reduction', 0.20, 8000),
    ],
  },
  't2-agility-fire-water': {
    name: 'Boilstep',
    description: 'Pierce 6; burn 2 + poison 2.',
    cooldown: 1.8,
    cost: { mana: 1 },
    effects: [
      pdmg(6, { scale: { stat: 'dex', per: 3, value: 1 } }),
      dot('burn', 2),
      dot('poison', 2),
    ],
  },
  't2-agility-air-fire': {
    name: 'Galecinder',
    description: 'Hit twice for 5; burn 2 + shock 2.',
    cooldown: 1.6,
    cost: { stamina: 1, mana: 1 },
    effects: [
      dmg(5, { multi_hit: 1 }),
      dot('burn', 2),
      dot('shock', 2),
    ],
  },
  't2-agility-earth-fire': {
    name: 'Cinderquake',
    description: 'Deal 10; if armor ≥10, burn 4 pierce.',
    cooldown: 2.0,
    cost: { mana: 1 },
    effects: [
      dmg(10, { scale: { stat: 'dex', per: 2, value: 1 } }),
      pdmg(4, { condition: COND.armorAtleast(10) }),
      dot('burn', 4, { condition: COND.armorAtleast(10) }),
    ],
  },
  't2-agility-air-water': {
    name: 'Stormsplash',
    description: 'Poison 3 + shock 3; +2 dmg per shock.',
    cooldown: 1.6,
    cost: { mana: 1 },
    effects: [
      dot('poison', 3),
      dot('shock', 3),
      dmg(2, { condition: COND.enemyShockPer }),
    ],
  },
  't2-agility-earth-water': {
    name: 'Mireglide',
    description: 'Gain 8 armor; poison 4; −15% cd aura 6s.',
    cooldown: 2.0,
    cost: { mana: 1 },
    effects: [
      armor(8),
      dot('poison', 4),
      auraMod('cd_reduction', 0.15, 6000),
    ],
  },
  't2-agility-air-earth': {
    name: 'Quarrygale',
    description: 'Gain 8 armor; shock 3; −20% cd aura 6s.',
    cooldown: 2.0,
    cost: { mana: 1 },
    effects: [
      armor(8),
      dot('shock', 3),
      auraMod('cd_reduction', 0.20, 6000),
    ],
  },

  // ── Counter + pure element pairs ───────────────────────────────────────
  't2-counter-fire-fire': {
    name: 'Rage Pyre',
    description: 'Consume 4 rage → 14 dmg + burn 4.',
    cooldown: 2.6,
    cost: { stamina: 1, mana: 1 },
    effects: [
      dmg(14, { condition: { self_has_stack: 'rage' } }),
      dot('burn', 4, { condition: { self_has_stack: 'rage' } }),
      consumeRage(4),
    ],
  },
  't2-counter-water-water': {
    name: 'Bleedbrine',
    description: 'Self-bleed 4; on break, poison 6.',
    cooldown: 2.6,
    cost: { stamina: 1, mana: 1 },
    effects: [
      sdot('bleed', 4),
      auraArmorBreak(dot('poison', 6), 12000),
    ],
  },
  't2-air-air-counter': {
    name: 'Stormrage',
    description: 'Consume 4 rage → shock 8.',
    cooldown: 2.6,
    cost: { stamina: 1, mana: 1 },
    effects: [
      dot('shock', 8, { condition: { self_has_stack: 'rage' } }),
      consumeRage(4),
    ],
  },
  't2-counter-earth-earth': {
    name: 'Tombrage',
    description: 'Gain 12 armor; below 40% HP, +8 rage.',
    cooldown: 3.0,
    cost: { stamina: 2 },
    effects: [
      armor(12, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraHpBelow(40, stk('rage', 8, 'self'), 15000),
    ],
  },
  't2-counter-fire-water': {
    name: 'Venompyre',
    description: 'Consume 3 burn → poison 5; +2 dmg per poison.',
    cooldown: 2.8,
    cost: { stamina: 1, mana: 1 },
    effects: [
      dot('poison', 5, { condition: { enemy_has_stack: 'burn' } }),
      consumeBurn(3),
      dmg(2, { condition: COND.enemyPoisonPer }),
    ],
  },
  't2-air-counter-fire': {
    name: 'Static Bleed',
    description: 'Self-bleed 3; on break, shock 4.',
    cooldown: 2.4,
    cost: { stamina: 1, mana: 1 },
    effects: [
      sdot('bleed', 3),
      auraArmorBreak(dot('shock', 4), 12000),
    ],
  },
  't2-counter-earth-fire': {
    name: 'Magmavow',
    description: 'Gain 10 armor; on break, 16 pierce + burn 3.',
    cooldown: 3.0,
    cost: { stamina: 2 },
    effects: [
      armor(10, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(pdmg(16), 12000),
      auraArmorBreak(dot('burn', 3), 12000),
    ],
  },
  't2-air-counter-water': {
    name: 'Tempestbleed',
    description: 'Self-bleed 3; on break, deal 6 + shock 2.',
    cooldown: 2.6,
    cost: { stamina: 1, mana: 1 },
    effects: [
      sdot('bleed', 3),
      auraArmorBreak(dmg(6), 12000),
      auraArmorBreak(dot('shock', 2), 12000),
    ],
  },
  't2-counter-earth-water': {
    name: 'Bogwrath',
    description: 'Gain 10 armor; on break, poison 6 + rage 3.',
    cooldown: 3.0,
    cost: { stamina: 1, mana: 1 },
    effects: [
      armor(10, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraArmorBreak(dot('poison', 6), 12000),
      auraArmorBreak(stk('rage', 3, 'self'), 12000),
    ],
  },
  't2-air-counter-earth': {
    name: 'Stormvow',
    description: 'Gain 10 armor; below 50% HP, shock 6 + −25% cd aura 8s.',
    cooldown: 3.0,
    cost: { stamina: 1, mana: 1 },
    effects: [
      armor(10, { scale: { stat: 'vit', per: 2, value: 2 } }),
      auraHpBelow(50, dot('shock', 6), 15000),
      auraHpBelow(50, auraMod('cd_reduction', 0.25, 8000), 15000),
    ],
  },
};

// Cards that change targeting from the default 'single'
const TARGETING_OVERRIDES = {
  't2-air-air-air': 'aoe',
  't2-air-air-fire': 'aoe',
  't2-air-air-water': 'aoe',
  't2-air-air-earth': 'aoe',
  't2-air-attack-attack': 'aoe',
  't2-air-air-attack': 'aoe',
  't2-air-attack-fire': 'aoe',
  't2-air-fire-water': 'aoe',
  't2-tempest-pike': 'aoe',
  't2-stormbog': 'aoe',
  't2-stormsplash': 'aoe',
};

let touched = 0;
const missing = [];
for (const card of cards) {
  if (card.tier !== 2) continue;
  const r = REDESIGNS[card.id];
  if (!r) {
    missing.push(card.id);
    continue;
  }
  card.name = r.name;
  card.description = r.description;
  card.effects = r.effects;
  card.cooldown = r.cooldown;
  if (r.cost !== undefined) card.cost = r.cost;
  else delete card.cost;
  if (TARGETING_OVERRIDES[card.id]) card.targeting = TARGETING_OVERRIDES[card.id];
  delete card.upgraded;
  touched++;
}
fs.writeFileSync(CARDS_PATH, JSON.stringify(data, null, 2) + '\n');
console.log('Tier-2 cards rewritten:', touched, '/', 120);
if (missing.length) console.log('MISSING REDESIGNS:', missing);
