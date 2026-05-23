// Spot-check the formatter output for representative cards. This is a
// temporary diagnostic test — prints sample bodies so we can compare with
// CARD_AUDIT §12 by eye. Once cards.json catches up, replace with a snapshot.

import { describe, it } from 'vitest';
import { formatCardDescription } from '../../src/systems/cards/CardText';
import cardsData from '../../src/data/json/cards.json';
import type { CardDefinition } from '../../src/data/types';

const cards = cardsData.cards as CardDefinition[];

const SAMPLES = [
  't1-attack',                  // Jab
  't2-fire-fire',               // Pyre
  't3-attack-counter-defense',  // Last Stand Bulwark
  't3-counter-counter-counter', // Crimson Spiral
  't3-earth-fire-water',        // Alchemic Drain
];

describe('card-text formatter — sample bodies', () => {
  it('prints sample formatted bodies for §11.H + iconic cards', () => {
    console.log('');
    for (const id of SAMPLES) {
      const card = cards.find(c => c.id === id);
      if (!card) { console.log(`MISSING ${id}`); continue; }
      const body = formatCardDescription(card);
      console.log(`[${id}] ${card.name}\n    body: ${body}`);
    }
  });
});
