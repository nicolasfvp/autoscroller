// Ensures every card in cards.json has at least one stat-scaling effect.
// Inference rules:
//   - damage  -> STR (DEX if pure-agility card)
//   - armor   -> VIT
//   - heal    -> SPI
//   - dot/stack on bleed   -> DEX
//   - dot/stack on rage    -> STR
//   - dot/stack otherwise  -> INT (poison/burn/slow/stun/arcane)
//   - debuff  -> INT
// Skips: cards in REDESIGN_IDS (those will receive full replacement), and
// cards that already have `scale` on ANY effect.
// Idempotent: re-running has no effect on already-scaled cards.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REDESIGN_IDS = new Set([
  // Burn
  't1-attack-fire', 't1-counter-fire',
  't2-fire-fire-fire', 't2-fire-fire-water', 't2-air-fire-fire',
  't2-earth-fire-fire', 't2-agility-agility-fire',
  // Poison
  't2-defense-defense-water', 't2-earth-earth-water', 't2-attack-water-water',
  't2-air-earth-water', 't2-agility-counter-water', 't2-agility-water-water',
  't2-earth-fire-water', 't2-attack-counter-water', 't2-air-fire-water',
  // Bleed
  't1-counter-counter',
  't2-attack-attack-counter', 't2-agility-attack-counter',
  't2-counter-counter-water', 't2-agility-counter-fire', 't2-agility-attack-attack',
  // Rage
  't1-attack-attack', 't1-counter-defense',
  't2-counter-counter-counter', 't2-counter-counter-defense',
  't2-attack-counter-counter', 't2-air-counter-counter', 't2-counter-counter-fire',
  // Armor
  't1-agility-earth', 't1-defense-fire',
  't2-attack-attack-defense', 't2-counter-defense-defense',
  't2-defense-defense-fire', 't2-defense-fire-fire', 't2-defense-earth-earth',
  // CC
  't1-earth-earth',
  't2-agility-air-air', 't2-air-air-fire', 't2-air-attack-counter',
  't2-air-air-earth', 't2-air-counter-earth', 't2-agility-air-earth',
  // Cross
  't1-water-water',
  't2-defense-water-water', 't2-agility-defense-water',
  't2-air-defense-fire', 't2-attack-attack-earth',
  // HP-loss enablers
  't1-attack-counter', 't1-attack-water',
  't2-attack-counter-defense', 't2-counter-defense-water',
  // v3 element-realignment swap targets (Wave 6) — already scaled by hand
  // in apply-redesigns.mjs, so apply-scaling.mjs should leave them alone.
  't2-air-counter-defense', 't2-counter-fire-fire',
  't2-attack-fire-water', 't2-counter-water-water',
  't2-agility-counter-counter', 't1-air-earth', 't1-attack-earth',
]);

function pickScale(effect, elements) {
  switch (effect.type) {
    case 'damage': {
      const els = elements ?? [];
      if (els.includes('agility') && !els.includes('attack')) {
        return { stat: 'dex', per: 3, value: 1 };
      }
      return { stat: 'str', per: 2, value: 1 };
    }
    case 'armor':
      return { stat: 'vit', per: 2, value: 1 };
    case 'heal':
      return { stat: 'spi', per: 3, value: 1 };
    case 'dot':
    case 'stack': {
      const stack = effect.stack;
      if (stack === 'bleed') return { stat: 'dex', per: 3, value: 1 };
      if (stack === 'rage') return { stat: 'str', per: 3, value: 1 };
      return { stat: 'int', per: 3, value: 1 };
    }
    case 'debuff':
      return { stat: 'int', per: 3, value: 1 };
    default:
      return null;
  }
}

function findPrimaryScalableEffect(effects) {
  if (!effects?.length) return null;
  const priority = ['damage', 'armor', 'dot', 'stack', 'heal', 'debuff'];
  for (const type of priority) {
    const candidate = effects.find(
      (e) => e.type === type && (e.value ?? 0) > 0 && !e.scale,
    );
    if (candidate) return candidate;
  }
  return null;
}

function process() {
  const filePath = path.join(__dirname, '..', 'src', 'data', 'json', 'cards.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  let inspected = 0;
  let modified = 0;
  let skippedRedesign = 0;
  let skippedAlreadyScaled = 0;
  let unscalable = 0;

  for (const card of data.cards) {
    inspected++;
    if (REDESIGN_IDS.has(card.id)) {
      skippedRedesign++;
      continue;
    }
    const hasAnyScale = card.effects?.some((e) => !!e.scale);
    if (hasAnyScale) {
      skippedAlreadyScaled++;
      continue;
    }
    const primary = findPrimaryScalableEffect(card.effects);
    if (!primary) {
      unscalable++;
      continue;
    }
    const scale = pickScale(primary, card.elements);
    if (!scale) {
      unscalable++;
      continue;
    }
    primary.scale = scale;
    modified++;
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');

  console.log('apply-scaling.mjs report:');
  console.log(`  inspected:            ${inspected}`);
  console.log(`  skipped (redesign):   ${skippedRedesign}`);
  console.log(`  skipped (had scale):  ${skippedAlreadyScaled}`);
  console.log(`  unscalable (pure resource): ${unscalable}`);
  console.log(`  MODIFIED:             ${modified}`);
}

process();
