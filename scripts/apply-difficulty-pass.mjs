// Difficulty tuning (user-approved "tunar modelo atual"): shorten normal fights.
// Normal-enemy baseHP was ~158-266 (avg ~200) vs a low-DPS starter deck, pushing
// fights well past the intended ~8-14s. Scale normal baseHP by 0.6 (keep the
// lost_lizard intro low). Bosses untouched. Elites apply a 1.6x premium at
// runtime, so an elite lands near the OLD normal HP — a deliberate "tougher" feel.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'json', 'enemies.json');
const enemies = JSON.parse(readFileSync(PATH, 'utf8'));
const FACTOR = 0.6;
const KEEP = new Set(['lost_lizard']); // gentle first-encounter, already low
let changed = 0;
for (const e of enemies) {
  if (e.type === 'normal' && !KEEP.has(e.id)) {
    const before = e.baseHP;
    e.baseHP = Math.round(e.baseHP * FACTOR);
    changed++;
    console.log(`  ${e.id.padEnd(20)} HP ${before} -> ${e.baseHP}`);
  }
}
writeFileSync(PATH, JSON.stringify(enemies, null, 2) + '\n');
console.log(`Scaled ${changed} normal enemies by ${FACTOR}x.`);
