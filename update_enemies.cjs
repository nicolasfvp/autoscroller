const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/json/enemies.json', 'utf8'));

data.forEach(e => {
  if (e.id === 'slime') e.spriteKey = 'slime_sprite';
  else if (e.id === 'goblin') e.spriteKey = 'goblin_sprite';
  else if (e.id === 'orc') e.spriteKey = 'orc_sprite';
  else if (e.id === 'boss_demon') e.spriteKey = 'dragon_sprite';
  else if (e.id === 'boss_tank') e.spriteKey = 'snake_sprite';
  else if (e.id === 'elite_knight') e.spriteKey = 'judge_sprite';
});

fs.writeFileSync('src/data/json/enemies.json', JSON.stringify(data, null, 2));
console.log('Successfully updated enemies.json with spriteKeys');
