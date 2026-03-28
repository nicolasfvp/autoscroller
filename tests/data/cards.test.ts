import { describe, it, expect, beforeAll } from 'vitest';
import cardsData from '../../src/data/json/cards.json';
import type { CardDefinition } from '../../src/data/types';

const cards: CardDefinition[] = cardsData.cards as CardDefinition[];

const EXPECTED_IDS = [
  'strike', 'heavy-hit', 'fury', 'berserker',
  'defend', 'shield-wall', 'fortify', 'iron-skin',
  'fireball', 'heal', 'arcane-shield', 'rejuvenate',
  'mana-drain', 'weaken',
  // Phase 6 additions
  'cleave', 'reckless-charge', 'execute', 'chain-lightning', 'doom-blade',
  'parry', 'bulwark', 'last-stand',
  'meditate', 'vampiric-touch', 'haste', 'energy-surge', 'poison-cloud',
  'soul-rend', 'sacrifice',
];

describe('cards.json data validation', () => {
  it('should contain all expected cards', () => {
    expect(cards.length).toBeGreaterThanOrEqual(30);
    const ids = cards.map((c) => c.id);
    for (const expectedId of EXPECTED_IDS) {
      expect(ids).toContain(expectedId);
    }
  });

  it('every card has cooldown as a number between 0.5 and 5.0', () => {
    for (const card of cards) {
      expect(card.cooldown).toBeTypeOf('number');
      expect(card.cooldown).toBeGreaterThanOrEqual(0.5);
      expect(card.cooldown).toBeLessThanOrEqual(5.0);
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

  it('original cards retain expected cooldown values', () => {
    const cooldownMap: Record<string, number> = {
      'strike': 1.0,
      'heavy-hit': 1.5,
      'fury': 2.0,
      'berserker': 2.5,
      'defend': 1.0,
      'shield-wall': 1.5,
      'fortify': 2.0,
      'iron-skin': 2.0,
      'fireball': 1.5,
      'heal': 1.5,
      'arcane-shield': 2.0,
      'rejuvenate': 2.0,
      'mana-drain': 2.0,
      'weaken': 2.5,
    };
    for (const card of cards) {
      if (cooldownMap[card.id] !== undefined) {
        expect(card.cooldown).toBe(cooldownMap[card.id]);
      }
    }
  });
});
