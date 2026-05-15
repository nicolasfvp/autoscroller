// Merges all generated card JSONs into src/data/json/cards.json.
// Normalizes IDs to canonical alphabetical format: t{tier}-{elements-sorted}.
// Validates uniqueness and elements integrity.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);

const GEN_DIR = join(ROOT, 'data', 'generated');
const OUT = join(ROOT, 'src', 'data', 'json', 'cards.json');

const SOURCES = [
  'tier1-cards.json',
  'tier2-phys.json',
  'tier2-elem.json',
  'tier2-mix-2p1e.json',
  'tier2-mix-1p2e.json',
];

function canonicalId(elements) {
  const sorted = [...elements].sort();
  // Tier 1 = 2 elements; Tier 2 = 3; Tier 3 = 4
  const tier = sorted.length - 1;
  return `t${tier}-${sorted.join('-')}`;
}

const merged = [];
const idMap = new Map(); // canonical id -> source card (track collisions)

for (const file of SOURCES) {
  const fp = join(GEN_DIR, file);
  if (!existsSync(fp)) {
    console.error(`MISSING: ${fp}`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(fp, 'utf8'));
  const cards = data.cards || [];
  console.log(`${file}: ${cards.length} cards`);
  for (const card of cards) {
    if (!card.elements || !Array.isArray(card.elements)) {
      throw new Error(`Card ${card.id} missing elements array`);
    }
    // Normalize id to canonical
    const canon = canonicalId(card.elements);
    if (card.id !== canon) {
      console.log(`  Normalizing id: ${card.id} -> ${canon}`);
      card.id = canon;
    }
    // Normalize elements array to alphabetical
    card.elements = [...card.elements].sort();
    if (idMap.has(canon)) {
      const prev = idMap.get(canon);
      console.error(`DUPLICATE id ${canon} in ${file} (was in ${prev.source})`);
      process.exit(1);
    }
    idMap.set(canon, { source: file, card });
    merged.push(card);
  }
}

// Default starter decks — must reference existing card IDs.
// Warrior: 7-10 physical / 0-3 elemental; 5 cards summing to 10 elements.
const starterDecks = {
  warrior: [
    't1-attack-attack',     // 2 phys
    't1-defense-defense',   // 2 phys
    't1-attack-defense',    // 2 phys
    't1-agility-agility',   // 2 phys
    't1-attack-fire',       // 1 phys + 1 elem
  ],
  mage: [
    't1-fire-fire',         // 2 elem
    't1-water-water',       // 2 elem
    't1-fire-water',        // 2 elem
    't1-air-earth',         // 2 elem
    't1-attack-fire',       // 1 phys + 1 elem
  ],
};

// Verify starter deck cards exist
for (const [className, ids] of Object.entries(starterDecks)) {
  for (const id of ids) {
    if (!idMap.has(id)) {
      console.error(`Starter deck ${className} references missing card: ${id}`);
      process.exit(1);
    }
  }
}

const output = {
  starterDecks,
  cards: merged,
};

writeFileSync(OUT, JSON.stringify(output, null, 2));
console.log(`\nWrote ${merged.length} cards to ${OUT}`);
console.log(`Starter decks: warrior=${starterDecks.warrior.length}, mage=${starterDecks.mage.length}`);

// Summary
const byTier = {};
for (const card of merged) {
  byTier[card.tier] = (byTier[card.tier] ?? 0) + 1;
}
console.log('By tier:', byTier);
