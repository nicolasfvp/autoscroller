#!/usr/bin/env node
// Apply the user-approved card-DATA balance fixes (2026-06-09 rebalance) by id.
// Engine/code fixes are applied separately as source edits. Run
// `node scripts/regenerate-card-descriptions.mjs` afterwards to re-sync descriptions.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const p = resolve(root, 'src/data/json/cards.json');
const data = JSON.parse(readFileSync(p, 'utf-8'));
const byId = Object.fromEntries(data.cards.map((c) => [c.id, c]));
const log = [];
const get = (id) => { const c = byId[id]; if (!c) throw new Error('missing card ' + id); return c; };

// 1. Supernova: un-exhaust, cd 2.8->2.2, per-burn 5->7
{
  const c = get('t3-fire-fire-fire');
  delete c.exhaust;
  c.cooldown = 2.2;
  c.effects[0].value = 7;
  log.push('Supernova: -exhaust, cd2.2, per-burn 7');
}
// 2. Quench Lance: cd 2.4->1.6, burn 2->4, int-gain threshold 10->6, add a 6-int hit opener
{
  const c = get('t3-fire-fire-water');
  c.cooldown = 1.6;
  c.effects[0].value = 4;
  c.effects[1].event_counter.filter.min_amount = 6;
  c.effects.unshift({ type: 'damage', value: 6, target: 'enemy', scale: { stat: 'int', per: 3, value: 1 } });
  log.push('Quench Lance: cd1.6, burn4, threshold6, +6 hit');
}
// 3. Tidesong Aura: cd 2.4->1.6, heal scaling 2->3
{
  const c = get('t3-water-water-water');
  c.cooldown = 1.6;
  c.effects[0].scale.value = 3;
  log.push('Tidesong: cd1.6, heal scale 3');
}
// 4. Gale Echo: cd 2.4->1.6, add a flat body (deal 4 AoE + apply 3 slow)
{
  const c = get('t3-agility-air-air');
  c.cooldown = 1.6;
  c.effects.unshift(
    { type: 'damage', value: 4, target: 'aoe', scale: { stat: 'dex', per: 2, value: 1 } },
    { type: 'dot', value: 3, target: 'enemy', stack: 'slow', scale: { stat: 'int', per: 4, value: 1 } },
  );
  log.push('Gale Echo: cd1.6, +deal4 +apply3 slow body');
}
// 5. Riposte: cd 2.0->1.2, on-hit 3->5
{
  const c = get('t1-counter');
  c.cooldown = 1.2;
  c.effects[0].then.value = 5;
  log.push('Riposte: cd1.2, on-hit 5');
}
// 6. Cinderlance: per-burn 3->5
{ const c = get('t3-attack-fire-fire'); c.effects[1].value = 5; log.push('Cinderlance: per-burn 5'); }
// 7. Pyre: per-burn 3->5
{ const c = get('t2-fire-fire'); c.effects[1].value = 5; log.push('Pyre: per-burn 5'); }
// 8. Cleaver's Tax: remove the never-applied overload self-cooldown field (text becomes honest)
{ const c = get('t3-attack-counter-counter'); if ('overload_lockout_ms' in c.effects[1]) delete c.effects[1].overload_lockout_ms; log.push("Cleaver's Tax: removed phantom overload_lockout_ms"); }
// 9. Thunderstrike Catalyst: cd 2->1.8, per-slow 6->8 (control win-con)
{ const c = get('t3-air-attack-counter'); c.cooldown = 1.8; c.effects[1].value = 8; log.push('Thunderstrike Catalyst: cd1.8, per-slow 8'); }
// 10. Concussive Smash: base 14->18 (control win-con)
{ const c = get('t3-attack-attack-earth'); c.effects[0].value = 18; log.push('Concussive Smash: base 18'); }

writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log('Applied ' + log.length + ' card-data fixes:');
for (const l of log) console.log('  - ' + l);
