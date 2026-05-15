// Phase 9 (Design v2): logic-isolated tests for CharacterSelectScene's class
// catalog + LOCKED layout math. Phaser scene is excluded — visual checkpoint
// covers the rendered output. UI-SPEC §Copywriting + §Spacing FLAG.

import { describe, it, expect } from 'vitest';
import {
  CLASS_CARDS,
  getClassCards,
  computeCardLayout,
} from '../../src/scenes/CharacterSelectScene.helpers';

describe('getClassCards / CLASS_CARDS (UI-SPEC §Component Inventory)', () => {
  it('returns exactly 2 classes', () => {
    expect(getClassCards()).toHaveLength(2);
    expect(CLASS_CARDS).toHaveLength(2);
  });

  it('order is warrior, mage', () => {
    expect(CLASS_CARDS.map(c => c.id)).toEqual(['warrior', 'mage']);
  });
});

describe('computeCardLayout (UI-SPEC §Spacing FLAG)', () => {
  it('returns 230px cards with 24px gaps', () => {
    const layout = computeCardLayout(800, 2);
    expect(layout.cardW).toBe(230);
    expect(layout.gap).toBe(24);
    expect(layout.totalW).toBe(2 * 230 + 1 * 24);
    expect(layout.totalW).toBe(484);
  });

  it('2-card layout fits inside 800px canvas with positive margin', () => {
    const layout = computeCardLayout(800, 2);
    expect(layout.totalW).toBeLessThanOrEqual(800);
    expect(layout.margin).toBeGreaterThan(0);
    expect(layout.margin).toBe((800 - 484) / 2);
  });

  it('startX positions the first card center inside canvas', () => {
    const layout = computeCardLayout(800, 2);
    expect(layout.startX).toBe(layout.margin + 230 / 2);
  });
});

describe('Preloader cardIds purge (audit per 09-02-SUMMARY)', () => {
  it('every preloaded card ID survives in v2 cards.json', async () => {
    const cardsJson = await import('../../src/data/json/cards.json');
    const cards = (cardsJson as any).default?.cards
      ?? (cardsJson as any).cards
      ?? (Array.isArray(cardsJson) ? cardsJson : []);
    const ids: string[] = (Array.isArray(cards) ? cards : []).map((c: any) => c.id);
    expect(ids.length).toBeGreaterThan(0);

    const preloadedCardIds = [
      'strike', 'heavy-hit', 'fury', 'berserker', 'counter-strike', 'defend', 'shield-wall',
      'fortify', 'iron-skin', 'fireball', 'heal', 'arcane-shield', 'rejuvenate', 'mana-drain',
      'weaken', 'cleave', 'reckless-charge', 'execute', 'doom-blade', 'parry', 'bulwark',
      'last-stand', 'meditate', 'vampiric-touch', 'haste', 'energy-surge', 'poison-cloud',
      'soul-rend', 'sacrifice', 'chain-lightning',
    ];
    const dead = preloadedCardIds.filter(id => !ids.includes(id));
    expect(dead).toEqual([]);
  });
});
