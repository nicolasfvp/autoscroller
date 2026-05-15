// Generates all 330 Tier-3 mock cards (multisets of size 4 from 8 elements).
// These appear as locked placeholders in the gallery.
// Output: src/data/json/cards-tier3-mocks.json

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const OUT = join(ROOT, 'src', 'data', 'json', 'cards-tier3-mocks.json');

const ELEMENTS = ['attack', 'defense', 'agility', 'counter', 'fire', 'water', 'air', 'earth'];
// Note: sorted alphabetically: agility, air, attack, counter, defense, earth, fire, water
const SORTED = [...ELEMENTS].sort();

// Generate multisets of size 4 from 8 elements (with repetition, order ignored)
function generateMultisets(elements, k) {
  const result = [];
  function recurse(start, current) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < elements.length; i++) {
      current.push(elements[i]);
      recurse(i, current);
      current.pop();
    }
  }
  recurse(0, []);
  return result;
}

const combinations = generateMultisets(SORTED, 4);

if (combinations.length !== 330) {
  throw new Error(`Expected 330 combinations, got ${combinations.length}`);
}

const cards = combinations.map((combo) => {
  const id = `t3-${combo.join('-')}`;
  return {
    id,
    name: '???',
    description: 'Tier 3 — Locked. Reach Forge level 4 to unlock.',
    category: 'magic',
    tier: 3,
    elements: combo,
    effects: [],
    cooldown: 0,
    targeting: 'single',
    rarity: 'epic',
    locked: true,
  };
});

const output = { tier: 3, cards };
writeFileSync(OUT, JSON.stringify(output, null, 2));
console.log(`Wrote ${cards.length} Tier-3 mocks to ${OUT}`);
