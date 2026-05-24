const fs = require('fs');
const terrain = {
  "forest": {
    "base": ["mush", "giant_spider"],
    "addAtLoop": { "5": ["giant_spider_2"], "10": ["ancient_tree"] }
  },
  "graveyard": {
    "base": ["pocket_cat"],
    "addAtLoop": { "5": ["corpse_eater"], "10": ["headless_fire_horse"] }
  },
  "swamp": {
    "base": ["toxic_gooze", "forge_slime"],
    "addAtLoop": { "5": ["venomous_kobra", "lava_golen"], "10": ["depths_horror", "mecha_warrior"] }
  },
  "desert": {
    "base": ["giant_beetle"],
    "addAtLoop": { "5": ["mutated_salamander"], "10": ["baby_dragon"] }
  },
  "basic": {
    "base": ["lost_lizard"],
    "addAtLoop": {}
  }
};
fs.writeFileSync('src/data/terrain-enemies.json', JSON.stringify(terrain, null, 2));

const enemyDrops = {
  "Lost Lizard": {
    "cardDrops": { "enemyType": "Lost Lizard", "cardPool": ["strike", "defend", "heavy-hit", "shield-wall", "fireball", "heal"], "minDrops": 1, "maxDrops": 1, "choicesShown": 3 },
    "tileDrops": [ { "tileType": "combat", "dropChance": 0.3, "minQuantity": 1, "maxQuantity": 1 } ]
  },
  "Corpse Eater": {
    "cardDrops": { "enemyType": "Corpse Eater", "cardPool": ["strike", "defend", "heavy-hit", "berserker", "counter-strike"], "minDrops": 1, "maxDrops": 1, "choicesShown": 3 },
    "tileDrops": [ { "tileType": "combat", "dropChance": 0.4, "minQuantity": 1, "maxQuantity": 2 }, { "tileType": "event", "dropChance": 0.2, "minQuantity": 1, "maxQuantity": 1 } ]
  },
  "Headless Fire Horse": {
    "cardDrops": { "enemyType": "Headless Fire Horse", "cardPool": ["fireball", "heal", "arcane-shield", "chain-lightning"], "minDrops": 1, "maxDrops": 1, "choicesShown": 3 },
    "tileDrops": [ { "tileType": "event", "dropChance": 0.5, "minQuantity": 1, "maxQuantity": 2 }, { "tileType": "shop", "dropChance": 0.3, "minQuantity": 1, "maxQuantity": 1 } ]
  },
  "Doom Knight": {
    "cardDrops": { "enemyType": "Doom Knight", "cardPool": ["heavy-hit", "shield-wall", "fortify", "berserker"], "minDrops": 2, "maxDrops": 2, "choicesShown": 4 },
    "tileDrops": [ { "tileType": "combat", "dropChance": 0.7, "minQuantity": 2, "maxQuantity": 3 }, { "tileType": "elite", "dropChance": 0.4, "minQuantity": 1, "maxQuantity": 1 }, { "tileType": "shop", "dropChance": 0.5, "minQuantity": 1, "maxQuantity": 1 } ]
  },
  "Iron Golem": {
    "cardDrops": { "enemyType": "Iron Golem", "cardPool": ["bulwark", "iron-skin", "shield-wall", "fortify", "last-stand"], "minDrops": 2, "maxDrops": 3, "choicesShown": 5 },
    "tileDrops": [ { "tileType": "combat", "dropChance": 1.0, "minQuantity": 3, "maxQuantity": 4 }, { "tileType": "elite", "dropChance": 0.7, "minQuantity": 1, "maxQuantity": 2 }, { "tileType": "rest", "dropChance": 0.7, "minQuantity": 1, "maxQuantity": 2 }, { "tileType": "shop", "dropChance": 0.6, "minQuantity": 1, "maxQuantity": 1 } ]
  },
  "Lizard King": {
    "cardDrops": { "enemyType": "Lizard King", "cardPool": ["doom-blade", "fury", "fireball", "chain-lightning", "execute", "soul-rend"], "minDrops": 3, "maxDrops": 3, "choicesShown": 6 },
    "tileDrops": [ { "tileType": "combat", "dropChance": 1.0, "minQuantity": 4, "maxQuantity": 6 }, { "tileType": "elite", "dropChance": 0.9, "minQuantity": 1, "maxQuantity": 2 }, { "tileType": "treasure", "dropChance": 0.8, "minQuantity": 1, "maxQuantity": 2 }, { "tileType": "shop", "dropChance": 0.7, "minQuantity": 1, "maxQuantity": 2 }, { "tileType": "rest", "dropChance": 0.7, "minQuantity": 1, "maxQuantity": 2 } ]
  }
};
// I can just omit all others and let LootGenerator handle it with a default fallback, or map them to the same. Let's just create a generic one for all others to avoid crashes.
const genericDrop = {
  "cardDrops": { "enemyType": "Generic", "cardPool": ["strike", "defend", "heavy-hit"], "minDrops": 1, "maxDrops": 1, "choicesShown": 3 },
  "tileDrops": [ { "tileType": "combat", "dropChance": 0.3, "minQuantity": 1, "maxQuantity": 1 } ]
};
const allEnemyNames = [
  "Pocket Cat", "Baby Dragon", "Giant Beetle", "Mutated Salamander", "Ancient Tree", "Giant Spider 2", "Giant Spider", "Mush", "Forge Slime", "Lava Golem", "Mecha Warrior", "Depths Horror", "Toxic Gooze", "Venomous Kobra"
];
for (const n of allEnemyNames) {
  if (!enemyDrops[n]) {
    enemyDrops[n] = JSON.parse(JSON.stringify(genericDrop));
    enemyDrops[n].cardDrops.enemyType = n;
  }
}
fs.writeFileSync('src/data/json/enemy-drops.json', JSON.stringify(enemyDrops, null, 2));

