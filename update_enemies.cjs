// update_enemies.cjs
// One-shot maintenance script: stamps a `spriteKey` field onto each enemy
// in src/data/json/enemies.json so runtime code can resolve the in-Phaser
// texture key without a lookup table. Keys use the `_sprite` suffix to
// match the Preloader's `this.load.image('<id>_sprite', ...)` calls in
// src/scenes/Preloader.ts.
//
// This is the surviving copy of two duplicate scripts (the `_generated`
// variant was removed under FIXES A.5). Run with:
//   node update_enemies.cjs
//
// Note: Iron Golem has no dedicated sprite asset; reuses the snake sprite
// (BUGS-DATA MED-15 — replace once a golem sprite ships).
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
