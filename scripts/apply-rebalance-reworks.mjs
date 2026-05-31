#!/usr/bin/env node
// One-shot rewrite of 15 cards per tests/audit/REBALANCE-SPEC.md.
// After running, re-run the sim to verify deltas.
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = 'src/data/json/cards.json';
const r = JSON.parse(readFileSync(PATH, 'utf-8'));
const find = (id) => r.cards.find((c) => c.id === id);

function rewrite(id, desc, effects, extra) {
  const c = find(id);
  if (!c) { console.log('  MISS', id); return; }
  c.description = desc;
  c.effects = effects;
  if (extra) for (const k of Object.keys(extra)) c[k] = extra[k];
  console.log('  rewrote', id, '|', c.name);
}

// 1. Searing Razor
rewrite('t3-agility-counter-fire',
  'Apply 3[burn]([dex]). For 8 seconds: if you lose HP 4+ times, gain 2[dex] this combat (max 4 per combat).',
  [
    { type: 'dot', stack: 'burn', value: 3, target: 'enemy', scale: { stat: 'dex', per: 3, value: 1 } },
    { type: 'aura', value: 0, target: 'self', ttl_ms: 8000,
      event_counter: { event: 'hp_lost', threshold: 4 },
      then: { type: 'stat_gain', stat: 'dex', value: 2, max_per_combat: 4, target: 'self' } },
  ]);

// 2. Twinflame Flicker
rewrite('t3-agility-agility-fire',
  'Apply 4[burn]. For 8 seconds: if you apply [burn] 4 times, gain 2[int] this combat (max 4 per combat).',
  [
    { type: 'dot', stack: 'burn', value: 4, target: 'enemy' },
    { type: 'aura', value: 0, target: 'self', ttl_ms: 8000,
      event_counter: { event: 'stack_applied', filter: { stack: 'burn' }, threshold: 4 },
      then: { type: 'stat_gain', stat: 'int', value: 2, max_per_combat: 4, target: 'self' } },
  ]);

// 3. Bloodtide Mend
rewrite('t2-counter-water',
  'Heal 5([spi]). Apply 2[bleed] to yourself. Vengeance: gain 1[spi] this combat (max 4 per combat).',
  [
    { type: 'heal', value: 5, target: 'self', scale: { stat: 'spi', per: 3, value: 1 } },
    { type: 'dot', value: 2, target: 'self_dot', stack: 'bleed' },
    { type: 'stat_gain', stat: 'spi', value: 1, max_per_combat: 4, target: 'self',
      condition: { took_damage_within_ms: 2000 } },
  ]);

// 4. Firestorm
rewrite('t2-air-fire',
  'For 4 seconds: if you play 3 or more cards, apply 10([int])[burn].',
  [
    { type: 'aura', value: 0, target: 'self', ttl_ms: 4000,
      event_counter: { event: 'card_played', threshold: 3 },
      then: { type: 'dot', stack: 'burn', value: 10, target: 'enemy', scale: { stat: 'int', per: 3, value: 1 } } },
  ],
  { targeting: 'aoe', category: 'magic', cost: { mana: 1 } });

// 5. Bloodlash Salvo
rewrite('t3-attack-attack-counter',
  'Exhaust. Apply 2([str])[stun] to yourself. Gain 4[str] this combat.',
  [
    { type: 'dot', stack: 'stun', value: 2, target: 'self_dot', scale: { stat: 'str', per: 3, value: 1 } },
    { type: 'stat_gain', stat: 'str', value: 4, max_per_combat: 4, target: 'self' },
  ],
  { exhaust: true });

// 6. Vengeful Pyre
rewrite('t3-counter-counter-fire',
  'Exhaust. Exhaust the next card in order. Double all [rage] gained this combat.',
  [
    { type: 'devour', value: 1, target: 'self_deck', devour: { exhaust_next: true } },
    { type: 'aura', value: 0, target: 'self', ttl_ms: 9999999,
      modifier: { kind: 'stack_gain_mult', stack: 'rage', value: 1 } },
  ],
  { exhaust: true });

// 7. Tidefoot Bloom
rewrite('t3-counter-water-water',
  'Exhaust. For this combat: each time you heal, apply 1([int])[poison].',
  [
    { type: 'aura', value: 0, target: 'self', ttl_ms: 9999999,
      event_counter: { event: 'heal_received', threshold: 1, repeat: true },
      then: { type: 'dot', stack: 'poison', value: 1, target: 'enemy', scale: { stat: 'int', per: 3, value: 1 } } },
  ],
  { exhaust: true });

// 8. Quench Lance
rewrite('t3-fire-fire-water',
  'Apply 2([int])[burn]. For 6 seconds: if you consume 10+ [burn], gain 2[int] this combat (max 4 per combat).',
  [
    { type: 'dot', stack: 'burn', value: 2, target: 'enemy', scale: { stat: 'int', per: 3, value: 1 } },
    { type: 'aura', value: 0, target: 'self', ttl_ms: 6000,
      event_counter: { event: 'stack_consumed', filter: { stack: 'burn', min_amount: 10 }, threshold: 1 },
      then: { type: 'stat_gain', stat: 'int', value: 2, max_per_combat: 4, target: 'self' } },
  ]);

// 9. Forge Spike Ward
rewrite('t2-defense-fire',
  'Gain 5[armor]([vit]). For 6 seconds: if you gain 12+ [armor], gain 1[vit] this combat (max 3 per combat).',
  [
    { type: 'armor', value: 5, target: 'self', scale: { stat: 'vit', per: 2, value: 1 } },
    { type: 'aura', value: 0, target: 'self', ttl_ms: 6000,
      event_counter: { event: 'armor_gained', filter: { min_amount: 12 }, threshold: 1 },
      then: { type: 'stat_gain', stat: 'vit', value: 1, max_per_combat: 3, target: 'self' } },
  ]);

// 10. Quicksilver Bleed
rewrite('t3-agility-agility-counter',
  'Apply 3[bleed]([dex]). For 6 seconds: if you apply [bleed] 3+ times, gain 2[dex] this combat (max 4 per combat).',
  [
    { type: 'dot', stack: 'bleed', value: 3, target: 'enemy', scale: { stat: 'dex', per: 3, value: 1 } },
    { type: 'aura', value: 0, target: 'self', ttl_ms: 6000,
      event_counter: { event: 'stack_applied', filter: { stack: 'bleed' }, threshold: 3 },
      then: { type: 'stat_gain', stat: 'dex', value: 2, max_per_combat: 4, target: 'self' } },
  ]);

// 11. Quickearth Rite
rewrite('t3-agility-counter-earth',
  'Gain 8[armor]([vit]). For 6 seconds: if you take HP damage 2+ times, gain 2[vit] this combat (max 4 per combat).',
  [
    { type: 'armor', value: 8, target: 'self', scale: { stat: 'vit', per: 2, value: 1 } },
    { type: 'aura', value: 0, target: 'self', ttl_ms: 6000,
      event_counter: { event: 'hp_lost', threshold: 2 },
      then: { type: 'stat_gain', stat: 'vit', value: 2, max_per_combat: 4, target: 'self' } },
  ]);

// 12. Kindle Strike
rewrite('t2-attack-fire',
  'Apply 3[burn]([int]). If enemy has [bleed], apply again.',
  [
    { type: 'dot', stack: 'burn', value: 3, target: 'enemy', scale: { stat: 'int', per: 3, value: 1 } },
    { type: 'dot', stack: 'burn', value: 3, target: 'enemy', scale: { stat: 'int', per: 3, value: 1 },
      condition: { enemy_has_stack: 'bleed' } },
  ],
  { cooldown: 1.5, cost: { stamina: 1 } });

// 13. Wrath Squall (2 parallel auras)
rewrite('t3-air-counter-counter',
  'Exhaust. For 8 seconds: each time you lose HP, gain 1[str] (max 5 per combat) and 3([vit])[rage].',
  [
    { type: 'aura', value: 0, target: 'self', ttl_ms: 8000,
      event_counter: { event: 'hp_lost', threshold: 1, repeat: true },
      then: { type: 'stat_gain', stat: 'str', value: 1, max_per_combat: 5, target: 'self' } },
    { type: 'aura', value: 0, target: 'self', ttl_ms: 8000,
      event_counter: { event: 'hp_lost', threshold: 1, repeat: true },
      then: { type: 'stack', stack: 'rage', value: 3, target: 'self', scale: { stat: 'vit', per: 3, value: 1 } } },
  ],
  { exhaust: true, cooldown: 2.0, cost: { stamina: 2 } });

// 14. Stonepacer
rewrite('t3-agility-earth-earth',
  'Exhaust. Gain 3[vit] this combat. Haste 30% for 12 seconds.',
  [
    { type: 'stat_gain', stat: 'vit', value: 3, max_per_combat: 3, target: 'self' },
    { type: 'aura', value: 0, target: 'self', ttl_ms: 12000, modifier: { kind: 'cd_reduction', value: 0.3 } },
  ],
  { exhaust: true, cooldown: 2.8, cost: { stamina: 1 }, category: 'defense' });

// 15. Tidesong Aura
rewrite('t3-water-water-water',
  'Heal 12([spi]). Gain 2[spi] this combat (max 4 per combat). Gain 3[mana].',
  [
    { type: 'heal', value: 12, target: 'self', scale: { stat: 'spi', per: 2, value: 2 } },
    { type: 'stat_gain', stat: 'spi', value: 2, max_per_combat: 4, target: 'self' },
    { type: 'mana', value: 3, target: 'self' },
  ]);

writeFileSync(PATH, JSON.stringify(r, null, 2) + '\n');
console.log('Done.');
