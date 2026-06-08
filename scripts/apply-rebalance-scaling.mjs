#!/usr/bin/env node
// Rebalance Pass B — Scaling data fixes (REBALANCE-PLAN §4, directive C2).
//
// Re-point hard-coded off-element scale.stat so scaling aligns with element
// identity. Two cases:
//   1. DIRECT-DAMAGE clauses on MAGIC cards: str -> element-primary (int/dex)
//      so the new magic-only `elemMult` (CardResolver) actually engages and
//      INT/DEX/SPI mages scale competitively (STR stays the universal mult).
//   2. ARMOR clauses scaling DEX -> VIT (armor is a VIT axis; C3).
// D-14 honored: DoT/control magnitude (poison/burn/stun/slow stacks) is NOT
// re-pointed — those stay as-authored (stack/tempo-driven, not damage-scaled).
//
// scale.stat appears in the baked description ("([int])"), so this pass MUST be
// followed by `node scripts/regenerate-card-descriptions.mjs`.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsPath = resolve(__dirname, '..', 'src', 'data', 'json', 'cards.json');
const data = JSON.parse(readFileSync(cardsPath, 'utf-8'));
const byId = new Map(data.cards.map((c) => [c.id, c]));

// cardId -> [{ i: effectIndex, to: stat, expectType }]
const REPOINTS = {
  // magic direct-damage: str -> int (fire/water/earth-magic damage)
  't2-fire-fire':               [{ i: 0, to: 'int', expectType: 'damage' }],
  't2-fire-water':              [{ i: 0, to: 'int', expectType: 'damage' }],
  't2-earth-fire':              [{ i: 1, to: 'int', expectType: 'damage' }],
  't2-earth-water':             [{ i: 2, to: 'int', expectType: 'damage' }],
  // magic direct-damage: str -> dex (air-magic damage)
  't2-air-air':                 [{ i: 0, to: 'dex', expectType: 'damage' }],
  't2-air-earth':               [{ i: 0, to: 'dex', expectType: 'damage' }],
  // agility attack: align the additive with the deck's stat (DEX)
  't3-agility-air-earth':       [{ i: 2, to: 'dex', expectType: 'damage' }],
  // armor: DEX -> VIT (armor is a VIT axis)
  't2-agility-defense':         [{ i: 0, to: 'vit', expectType: 'armor' }],
  't3-agility-agility-defense': [{ i: 0, to: 'vit', expectType: 'armor' }],
  't3-agility-counter-defense': [{ i: 0, to: 'vit', expectType: 'armor' }],
  't3-agility-agility-earth':   [{ i: 0, to: 'vit', expectType: 'armor' }],
};

let changed = 0;
const log = [];
for (const [id, edits] of Object.entries(REPOINTS)) {
  const card = byId.get(id);
  if (!card) { log.push(`MISSING ${id}`); continue; }
  for (const { i, to, expectType } of edits) {
    const eff = card.effects?.[i];
    if (!eff || !eff.scale) { log.push(`SKIP ${id}[${i}] (no scale)`); continue; }
    if (expectType && eff.type !== expectType) { log.push(`SKIP ${id}[${i}] (type ${eff.type} != ${expectType})`); continue; }
    if (eff.scale.stat === to) continue;
    log.push(`${id}[${i}] ${eff.type}: scale ${eff.scale.stat} -> ${to}`);
    eff.scale.stat = to;
    changed++;
  }
}

writeFileSync(cardsPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`Scaling pass: ${changed} clause re-points.`);
for (const l of log) console.log('  ' + l);
