const fs = require('fs');
const path = require('path');

const tsPath = path.join(__dirname, '../src/scenes/Preloader.ts');
const content = fs.readFileSync(tsPath, 'utf8');

const missing = [];

function check(assetPath) {
  const fullPath = path.join(__dirname, '../public', assetPath);
  if (!fs.existsSync(fullPath)) {
    missing.push(assetPath);
  }
}

// Extract direct string literals 'assets/...'
const directRegex = /'assets\/([^']+)'/g;
let match;
while ((match = directRegex.exec(content)) !== null) {
  check('assets/' + match[1]);
}

// Subtile sprites
const subtileIds = [
  'ambush', 'magma', 'manawell', 'camp',
  'burnaltar', 'bleedtotem', 'resonance', 'warhorn',
];
for (const id of subtileIds) {
  check(`assets/map/tiles/tile_subtile_${id}.png`);
}

// Reserved-slot sprites
const reservedIds = ['forest', 'graveyard', 'swamp', 'desert', 'lava'];
for (const id of reservedIds) {
  check(`assets/map/tiles/tile_reserved_${id}.png`);
}

// Monster static images
const staticMonsters = [
  { id: 'corpse_eater',         folder: 'cemetery', file: 'corpse eater_1.png' },
  { id: 'headless_fire_horse',  folder: 'cemetery', file: 'headless fire horse.png' },
  { id: 'pocket_cat',           folder: 'cemetery', file: 'pocket cat.png' },
  { id: 'ogre',                 folder: 'cemetery', file: 'ogre.png' },
  { id: 'zombie',               folder: 'cemetery', file: 'zombie.png' },
  { id: 'doom_knight',          folder: 'default',  file: 'doom knight.png' },
  { id: 'iron_golem',           folder: 'default',  file: 'iron golem.png' },
  { id: 'lizard_king',          folder: 'default',  file: 'lizard king.png' },
  { id: 'baby_dragon',          folder: 'desert',   file: 'baby dragon_1.png' },
  { id: 'giant_beetle',         folder: 'desert',   file: 'giant beetle.png' },
  { id: 'mutated_salamander',   folder: 'desert',   file: 'mutated salamander_1.png' },
  { id: 'ancient_tree',         folder: 'forest',   file: 'ancient tree.png' },
  { id: 'giant_spider_2',       folder: 'forest',   file: 'giant spider 2.png' },
  { id: 'giant_spider',         folder: 'forest',   file: 'giant spider.png' },
  { id: 'mush',                 folder: 'forest',   file: 'mush.png' },
  { id: 'forge_slime',          folder: 'lava',     file: 'forge slime_1.png' },
  { id: 'lava_golen',           folder: 'lava',     file: 'lava golen.png' },
  { id: 'mecha_warrior',        folder: 'lava',     file: 'mecha warrior.png' },
  { id: 'depths_horror',        folder: 'swamp',    file: 'depths horror_1.png' },
  { id: 'toxic_gooze',          folder: 'swamp',    file: 'toxic gooze_1.png' },
  { id: 'venomous_kobra',       folder: 'swamp',    file: 'venomous kobra_1.png' },
  { id: 'lost_lizard',          folder: '',         file: 'lost_lizard_1.png' },
  { id: 'boss_berserker',       folder: '',         file: 'boss_berserker.png' },
  { id: 'boss_demon',           folder: '',         file: 'boss_demon.png' },
  { id: 'boss_hydra',           folder: '',         file: 'boss_hydra.png' },
  { id: 'boss_mage',            folder: '',         file: 'boss_mage.png' },
];
for (const m of staticMonsters) {
  const p = m.folder ? `assets/characters/monsters/${m.folder}/${m.file}` : `assets/characters/monsters/${m.file}`;
  check(p);
  const p2 = p.replace(/(_1)?\.png$/i, '_2.png');
  check(p2);
}

const cardTokenIds = [
  'burn', 'bleed', 'poison', 'slow', 'stun', 'rage',
  'str', 'vit', 'dex', 'int', 'spi',
  'stam', 'mana', 'HP', 'armor', 'exhaust',
  'attack', 'defense', 'agility', 'counter',
  'fire', 'water', 'air', 'earth',
];
for (const token of cardTokenIds) {
  check(`assets/icons/tokens/${token}.png`);
}

const relicIds = [
  'arcane_crystal', 'berserker_ring', 'blood_pact', 'bronze_scale', 'demon_heart',
  'energy_potion', 'first_strike_amulet', 'iron_will', 'mana_stone', 'phoenix_feather',
  'swift_boots', 'thin_deck_charm', 'vitality_ring'
];
for (const id of relicIds) {
  check(`assets/relics/${id}.png`);
}

const legacyJpgCards = new Set([
  'chain-lightning', 'energy-surge', 'haste', 'poison-cloud', 'sacrifice', 'soul-rend',
  'berserker', 'bulwark', 'doom-blade', 'heavy-hit', 'last-stand', 'mana-drain',
  'meditate', 'parry', 'strike', 'vampiric-touch', 'weaken'
]);
const legacyCardIds = [
  'strike', 'heavy-hit', 'fury', 'berserker', 'counter-strike', 'defend', 'shield-wall',
  'fortify', 'iron-skin', 'fireball', 'heal', 'arcane-shield', 'rejuvenate', 'mana-drain',
  'weaken', 'cleave', 'reckless-charge', 'execute', 'doom-blade', 'parry', 'bulwark',
  'last-stand', 'meditate', 'vampiric-touch', 'haste', 'energy-surge', 'poison-cloud',
  'soul-rend', 'sacrifice', 'chain-lightning'
];
for (const id of legacyCardIds) {
  const ext = legacyJpgCards.has(id) ? '.jpg' : '.png';
  check(`assets/cards/${id}${ext}`);
}

const newCardIds = [
  't1-attack', 't1-defense', 't1-agility', 't1-counter',
  't1-fire', 't1-water', 't1-air', 't1-earth',
  't2-attack-attack', 't2-defense-defense', 't2-agility-agility', 't2-counter-counter',
  't2-fire-fire', 't2-water-water', 't2-air-air', 't2-earth-earth',
  't2-agility-attack', 't2-agility-counter', 't2-agility-defense', 't2-agility-fire',
  't2-agility-water', 't2-agility-air', 't2-agility-earth',
  't2-attack-counter', 't2-attack-defense', 't2-attack-fire', 't2-attack-water',
  't2-air-attack', 't2-attack-earth', 't2-counter-defense', 't2-counter-fire',
  't2-counter-water', 't2-air-counter', 't2-counter-earth', 't2-defense-fire',
  't2-defense-water', 't2-air-defense', 't2-defense-earth', 't2-fire-water',
  't2-air-fire', 't2-earth-fire', 't2-air-water', 't2-earth-water', 't2-air-earth',
  't3-attack-attack-attack', 't3-defense-defense-defense',
  't3-agility-agility-agility', 't3-counter-counter-counter',
  't3-fire-fire-fire', 't3-water-water-water', 't3-air-air-air', 't3-earth-earth-earth',
  't3-attack-attack-defense', 't3-agility-attack-attack', 't3-attack-attack-counter',
  't3-attack-defense-defense', 't3-agility-defense-defense', 't3-counter-defense-defense',
  't3-agility-agility-attack', 't3-agility-agility-defense', 't3-agility-agility-counter',
  't3-attack-counter-counter', 't3-counter-counter-defense', 't3-agility-counter-counter',
  't3-agility-attack-defense', 't3-attack-counter-defense', 't3-agility-attack-counter',
  't3-agility-counter-defense',
  't3-fire-fire-water', 't3-air-fire-fire', 't3-earth-fire-fire',
  't3-fire-water-water', 't3-air-water-water', 't3-earth-water-water',
  't3-air-air-fire', 't3-air-air-water', 't3-air-air-earth',
  't3-earth-earth-fire', 't3-earth-earth-water', 't3-air-earth-earth',
  't3-air-fire-water', 't3-earth-fire-water', 't3-air-earth-fire',
  't3-air-earth-water',
  't3-attack-attack-fire', 't3-attack-attack-water', 't3-air-attack-attack', 't3-attack-attack-earth',
  't3-defense-defense-fire', 't3-defense-defense-water', 't3-air-defense-defense', 't3-defense-defense-earth',
  't3-agility-agility-fire', 't3-agility-agility-water', 't3-agility-air-air', 't3-agility-earth-earth',
  't3-counter-counter-fire', 't3-counter-counter-water', 't3-air-counter-counter', 't3-counter-counter-earth',
  't3-attack-defense-fire', 't3-attack-defense-water', 't3-air-attack-defense', 't3-attack-defense-earth',
  't3-agility-attack-fire', 't3-agility-attack-water', 't3-agility-air-attack', 't3-agility-attack-earth',
  't3-attack-counter-fire', 't3-attack-counter-water', 't3-air-attack-counter', 't3-attack-counter-earth',
  't3-agility-defense-fire', 't3-agility-defense-water', 't3-agility-air-defense', 't3-agility-defense-earth',
  't3-counter-defense-fire', 't3-counter-defense-water', 't3-air-counter-defense', 't3-counter-defense-earth',
  't3-agility-counter-fire', 't3-agility-counter-water', 't3-agility-air-counter', 't3-agility-counter-earth',
  't3-attack-fire-fire', 't3-attack-water-water', 't3-air-air-attack', 't3-attack-earth-earth',
  't3-attack-fire-water', 't3-air-attack-fire', 't3-attack-earth-fire', 't3-air-attack-water',
  't3-attack-earth-water', 't3-air-attack-earth',
  't3-defense-fire-fire', 't3-defense-water-water', 't3-air-air-defense', 't3-defense-earth-earth',
  't3-defense-fire-water', 't3-air-defense-fire', 't3-defense-earth-fire', 't3-air-defense-water',
  't3-defense-earth-water', 't3-air-defense-earth',
  't3-agility-fire-fire', 't3-agility-water-water', 't3-agility-air-air', 't3-agility-earth-earth',
  't3-agility-fire-water', 't3-agility-air-fire', 't3-agility-earth-fire', 't3-agility-air-water',
  't3-agility-earth-water', 't3-agility-air-earth',
  't3-counter-fire-fire', 't3-counter-water-water', 't3-air-air-counter', 't3-counter-earth-earth',
  't3-counter-fire-water', 't3-air-counter-fire', 't3-counter-earth-fire', 't3-air-counter-water',
  't3-counter-earth-water', 't3-air-counter-earth',
];
for (const id of newCardIds) {
  check(`assets/cards/${id}.png`);
}

const uniqueMissing = [...new Set(missing)];
console.log(JSON.stringify(uniqueMissing, null, 2));
