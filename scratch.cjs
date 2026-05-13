const fs = require('fs');

const normalMonsters = [
  { id: 'lost_lizard', name: 'Lost Lizard', color: 0x00ff00 },
  { id: 'corpse_eater', name: 'Corpse Eater', color: 0x888888 },
  { id: 'headless_fire_horse', name: 'Headless Fire Horse', color: 0xff4400 },
  { id: 'pocket_cat', name: 'Pocket Cat', color: 0x444444 },
  { id: 'baby_dragon', name: 'Baby Dragon', color: 0xeeccaa },
  { id: 'giant_beetle', name: 'Giant Beetle', color: 0xddbb99 },
  { id: 'mutated_salamander', name: 'Mutated Salamander', color: 0xffaa00 },
  { id: 'ancient_tree', name: 'Ancient Tree', color: 0x228822 },
  { id: 'giant_spider_2', name: 'Giant Spider 2', color: 0x333333 },
  { id: 'giant_spider', name: 'Giant Spider', color: 0x222222 },
  { id: 'mush', name: 'Mush', color: 0xaaaa55 },
  { id: 'forge_slime', name: 'Forge Slime', color: 0xff3300 },
  { id: 'lava_golen', name: 'Lava Golem', color: 0xcc4400 },
  { id: 'mecha_warrior', name: 'Mecha Warrior', color: 0xaaaaaa },
  { id: 'depths_horror', name: 'Depths Horror', color: 0x224422 },
  { id: 'toxic_gooze', name: 'Toxic Gooze', color: 0x44ff44 },
  { id: 'venomous_kobra', name: 'Venomous Kobra', color: 0x22cc22 }
];

const bosses = [
  { id: 'doom_knight', name: 'Doom Knight', type: 'boss', bossType: 'knight', baseHP: 1200, color: 0x333333 },
  { id: 'iron_golem', name: 'Iron Golem', type: 'boss', bossType: 'tank', baseHP: 1500, color: 0x888888 },
  { id: 'lizard_king', name: 'Lizard King', type: 'boss', bossType: 'dragon', baseHP: 1000, color: 0x00cc00 }
];

const allEnemies = [];

for (const m of normalMonsters) {
  const hpBase = 100 + Math.floor(Math.random() * 80);
  const dmgBase = 2 + Math.floor(Math.random() * 4);
  const defBase = Math.floor(Math.random() * 3);
  
  allEnemies.push({
    id: m.id,
    name: m.name,
    type: 'normal',
    baseHP: hpBase,
    baseDefense: defBase,
    attack: {
      damage: dmgBase,
      pattern: 'fixed'
    },
    attackCooldown: 2000 + Math.floor(Math.random() * 1000),
    goldReward: { min: 10, max: 25 },
    materialReward: {
      chance: 0.3,
      bonusMaterial: 'essence',
      bonusAmount: { min: 1, max: 2 }
    },
    color: m.color
  });
}

for (const b of bosses) {
  allEnemies.push({
    id: b.id,
    name: b.name,
    type: 'boss',
    bossType: b.bossType,
    baseHP: b.baseHP,
    baseDefense: 5,
    attack: {
      damage: 10,
      pattern: 'scaling'
    },
    attackCooldown: 2500,
    behaviors: [],
    goldReward: { min: 100, max: 150 },
    materialReward: {
      chance: 1,
      bonusMaterial: 'essence',
      bonusAmount: { min: 3, max: 6 }
    },
    color: b.color
  });
}

fs.writeFileSync('src/data/json/enemies.json', JSON.stringify(allEnemies, null, 2));
