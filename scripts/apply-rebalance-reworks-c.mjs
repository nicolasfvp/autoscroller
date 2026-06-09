#!/usr/bin/env node
// Rebalance Pass C — dead-card reworks, rage spender→gate conversion, no-armor
// Brace fixes (REBALANCE-PLAN §5/§6 + locked decisions).
//
// - Rage is "Fury" (never spent, passively buffs damage). Convert the 4 rage
//   "spenders" to GATE-on-rage payoffs by removing their consume effects; rage
//   stays banked and keeps feeding Fury. Crimson Spiral becomes a flat rage≥8 bomb.
// - Dead/negative cards reworked to a positive, on-design body (no self-stun,
//   no unreachable Brace, no up-front self-cost gating a conditional payoff).
//
// Changes effects/descriptions, so run regenerate-card-descriptions.mjs after.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsPath = resolve(__dirname, '..', 'src', 'data', 'json', 'cards.json');
const data = JSON.parse(readFileSync(cardsPath, 'utf-8'));
const byId = new Map(data.cards.map((c) => [c.id, c]));

// Full-rework patches (merged onto the card; `effects` replaced wholesale).
const PATCHES = {
  // Dead/negative cards → positive on-design bodies.
  't3-attack-attack-counter': { // Bloodlash Salvo: delete self-stun (it skipped your OWN cards), real body, drop exhaust
    effects: [
      { type: 'damage', value: 9, target: 'enemy', scale: { stat: 'str', per: 2, value: 2 } },
      { type: 'stat_gain', stat: 'str', value: 4, max_per_combat: 4, target: 'self' },
    ],
    exhaust: false, cooldown: 1.8, cost: { stamina: 2 },
  },
  't3-air-counter-fire': { // Static Bleed: drop self-bleed + unreachable Brace → snappy slow+chip control
    effects: [
      { type: 'dot', value: 4, target: 'enemy', stack: 'slow' },
      { type: 'damage', value: 3, target: 'enemy', scale: { stat: 'dex', per: 3, value: 1 } },
    ],
    cooldown: 1.8, cost: { stamina: 1 },
  },
  't3-air-counter-water': { // Tempestbleed: promote the 2 Brace riders to unconditional (magic, spi-scaled)
    effects: [
      { type: 'damage', value: 6, target: 'enemy', scale: { stat: 'spi', per: 3, value: 1 } },
      { type: 'dot', value: 2, target: 'enemy', stack: 'slow' },
    ],
    cooldown: 1.8, cost: { mana: 1 },
  },
  't2-attack-water': { // Crimson Tithe: drop self-damage gimmick, grant rage directly on cast
    effects: [
      { type: 'stamina', value: 1, target: 'self', scale: { stat: 'spi', per: 4, value: 1 } },
      { type: 'mana', value: 1, target: 'self', scale: { stat: 'spi', per: 4, value: 1 } },
      { type: 'stack', value: 3, target: 'self', stack: 'rage' },
    ],
    cooldown: 1.6, cost: { stamina: 1 },
  },
  't3-earth-fire-water': { // Alchemic Drain: un-gate → clean poison + spi heal (drain)
    effects: [
      { type: 'dot', value: 3, target: 'enemy', stack: 'poison' },
      { type: 'heal', value: 6, target: 'self', scale: { stat: 'spi', per: 3, value: 1 } },
    ],
    cooldown: 2.4, cost: { mana: 1 },
  },
  't3-attack-earth-fire': { // Slag Maul: no-armor Brace → promote riders into the guaranteed body
    effects: [
      { type: 'damage', value: 16, target: 'enemy', scale: { stat: 'str', per: 2, value: 1 } },
      { type: 'dot', value: 2, target: 'enemy', stack: 'burn' },
    ],
    cooldown: 2.4, cost: { stamina: 2 },
  },
  't3-counter-counter-counter': { // Crimson Spiral: rage detonator → flat rage≥8 gated bomb (no consume; Fury keeps the rage)
    effects: [
      { type: 'damage', value: 24, target: 'enemy', pierce_armor: true, scale: { stat: 'str', per: 2, value: 2 }, condition: { self_stack_atleast: { stack: 'rage', value: 8 } } },
      { type: 'dot', value: 4, target: 'enemy', stack: 'bleed', scale: { stat: 'dex', per: 4, value: 1 }, condition: { self_stack_atleast: { stack: 'rage', value: 8 } } },
    ],
  },
};

// Rage spenders → remove the consume effect (gate stays, rage is never spent).
const DECONSUME_RAGE = ['t3-attack-counter-counter', 't3-attack-counter-fire', 't3-air-air-counter'];

let patched = 0, deconsumed = 0;
for (const [id, patch] of Object.entries(PATCHES)) {
  const card = byId.get(id);
  if (!card) { console.log('MISSING', id); continue; }
  Object.assign(card, patch);
  patched++;
}
for (const id of DECONSUME_RAGE) {
  const card = byId.get(id);
  if (!card) { console.log('MISSING', id); continue; }
  const before = card.effects.length;
  card.effects = card.effects.filter(
    (e) => !(e.type === 'stack' && e.stack === 'rage' && e.consume_stack && (e.value ?? 0) < 0),
  );
  if (card.effects.length !== before) deconsumed++;
}

writeFileSync(cardsPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`Pass C: ${patched} cards reworked, ${deconsumed} rage spenders de-consumed (gate-only now).`);
