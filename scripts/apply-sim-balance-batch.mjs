#!/usr/bin/env node
// Applies the questioning-phase VERIFIED card-side balance batch to cards.json.
// All changes BUFF the card (cost/CD per C1; T3>T2 by buffing the T3); no T2 nerfs.
// Run, then `node scripts/regenerate-card-descriptions.mjs` to sync stored text.
// Evidence: tests/audit/SIM-PROPOSAL-QUESTIONED.md §1/§2.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = resolve(__dirname, '..', 'src', 'data', 'json', 'cards.json');
const data = JSON.parse(readFileSync(path, 'utf-8'));
const byId = new Map(data.cards.map((c) => [c.id, c]));
const get = (id) => { const c = byId.get(id); if (!c) throw new Error(`missing ${id}`); return c; };
const log = [];

// 1. Aegis of Returning Wrath — dead Brace payoff → unconditional armor-scaling pierce.
{
  const c = get('t3-defense-defense-defense');
  c.cooldown = 2.0;
  c.effects[1] = { type: 'damage', value: 6, target: 'enemy', pierce_armor: true, scale: { source: 'armor', per: 4, value: 1 } };
  log.push('Aegis: payoff → uncond Deal 6 Pierce +1/4armor; cd 2.4→2.0');
}
// 2. Stagnant Bulwark — aura poison 1→2 per tick; cd 2.4→1.6.
{
  const c = get('t3-defense-defense-water');
  c.cooldown = 1.6;
  c.effects[1].then.value = 2;
  log.push('Stagnant Bulwark: aura poison 1→2/2s; cd 2.4→1.6');
}
// 3. Stoneward Reprisal — cd 2.4→1.6.
{
  const c = get('t3-defense-defense-earth');
  c.cooldown = 1.6;
  log.push('Stoneward Reprisal: cd 2.4→1.6');
}
// 4. Earthcleaver — base 14→18 + Pierce; armor gate 15→10; cd 2.4→1.8.
{
  const c = get('t3-attack-defense-earth');
  c.cooldown = 1.8;
  c.effects[0].value = 18;
  c.effects[0].pierce_armor = true;
  c.effects[1].condition.self_armor_atleast = 10;
  log.push('Earthcleaver: base 14→18 Pierce; gate 15→10; cd 2.4→1.8');
}
// 5. Crimson Spiral — rage gate 8→5; cd 2.4→1.8.
{
  const c = get('t3-counter-counter-counter');
  c.cooldown = 1.8;
  for (const e of c.effects) if (e.condition?.self_stack_atleast?.stack === 'rage') e.condition.self_stack_atleast.value = 5;
  log.push('Crimson Spiral: rage gate 8→5; cd 2.4→1.8');
}
// 6-9. Control CD cuts (pure control — no damage added; C1/C3/C5).
get('t2-water-water').cooldown = 1.4;          log.push('Frostbind: cd 2→1.4');
get('t1-earth').cooldown = 1.4;                log.push('Quake: cd 2→1.4');
get('t3-air-attack-counter').cooldown = 2.0;   log.push('Thunderstrike Catalyst: cd 2.4→2.0');
get('t3-agility-air-counter').cooldown = 1.6;  log.push('Static Skirmish: cd 1.8→1.6');
// 10. Steam Surge — base Deal 4→6 (low-INT mage staple).
{
  get('t2-fire-water').effects[0].value = 6;
  log.push('Steam Surge: base Deal 4→6');
}
// 11. Spark — add a token Deal 2 alongside its 3 burn; cd 1.4→1.2.
{
  const c = get('t1-fire');
  c.cooldown = 1.2;
  if (!c.effects.some((e) => e.type === 'damage')) {
    c.effects.push({ type: 'damage', value: 2, target: 'enemy' });
  }
  log.push('Spark: +Deal 2; cd 1.4→1.2');
}

writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`Applied ${log.length} card changes:`);
for (const l of log) console.log('  - ' + l);
