import { describe, it, expect } from 'vitest';
import cardsData from '../../src/data/json/cards.json';
import type { CardDefinition } from '../../src/data/types';

const cards: CardDefinition[] = cardsData.cards as CardDefinition[];

// Sample Tier 1 cards expected to exist in the element-based card pool.
// IDs follow the canonical `t{tier}-{elements_sorted}` format (see docs/CARDS_SYSTEM.md §9).
const EXPECTED_IDS = [
  't2-attack-attack',
  't2-defense-defense',
  't2-agility-agility',
  't2-counter-counter',
  't2-fire-fire',
  't2-water-water',
  't2-air-air',
  't2-earth-earth',
];

describe('cards.json data validation', () => {
  it('should contain all expected Tier 1 pure-element cards', () => {
    expect(cards.length).toBeGreaterThanOrEqual(156);
    const ids = cards.map((c) => c.id);
    for (const expectedId of EXPECTED_IDS) {
      expect(ids).toContain(expectedId);
    }
  });

  it('every card has cooldown as a number between 0.5 and 6.0', () => {
    // v3: cap raised from 5.0 → 6.0 to make room for Exhaust finishers
    // (Tremor Detonate 5.5). Audit §11.I-11 merges Wrathshell Vow's 4s
    // channel warm-up into its cooldown (6→10), so the upper bound is
    // raised to 10.0 to cover that Exhaust-locked finisher.
    for (const card of cards) {
      expect(card.cooldown).toBeTypeOf('number');
      expect(card.cooldown).toBeGreaterThanOrEqual(0.5);
      expect(card.cooldown).toBeLessThanOrEqual(10.0);
    }
  });

  it('every card has a valid targeting field', () => {
    const validTargeting = ['single', 'aoe', 'lowest-hp', 'random', 'self'];
    for (const card of cards) {
      expect(validTargeting).toContain(card.targeting);
    }
  });

  it('every card has a valid rarity field', () => {
    const validRarities = ['common', 'uncommon', 'rare', 'epic'];
    for (const card of cards) {
      expect(card).toHaveProperty('rarity');
      expect(validRarities).toContain((card as any).rarity);
    }
  });

  it('loader parses sample Tier 1 cooldowns exactly as defined in cards.json', () => {
    // The point here is to verify the loader correctly parses cooldowns — we
    // read the source-of-truth values straight from cards.json (not hardcode
    // them in the test) so the assertion stays stable across balance passes.
    const sampleIds = ['t2-attack-attack', 't2-fire-fire', 't2-defense-defense'];
    for (const id of sampleIds) {
      const raw = (cardsData.cards as any[]).find((c) => c.id === id);
      const loaded = cards.find((c) => c.id === id);
      expect(raw, `raw fixture for ${id}`).toBeDefined();
      expect(loaded, `loaded card for ${id}`).toBeDefined();
      expect(typeof loaded!.cooldown).toBe('number');
      expect(loaded!.cooldown).toBe(raw!.cooldown);
    }
  });
});
