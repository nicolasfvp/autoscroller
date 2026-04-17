const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/json/enemies.json', 'utf8'));

data.forEach(e => {
  if (e.id === 'slime') e.spriteKey = 'slime_generated';
  else if (e.id === 'goblin') e.spriteKey = 'goblin_generated';
  else if (e.id === 'orc') e.spriteKey = 'orc_generated';
  else if (e.id === 'boss_demon') e.spriteKey = 'dragon_generated';
  else if (e.id === 'boss_tank') e.spriteKey = 'snake_generated';
});

fs.writeFileSync('src/data/json/enemies.json', JSON.stringify(data, null, 2));
console.log('Successfully updated enemies.json with spriteKeys');
