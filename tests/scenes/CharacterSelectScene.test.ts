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

describe('Preloader cardIds purge (element-system audit)', () => {
  it('every preloaded card ID survives in cards.json', async () => {
    const cardsJson = await import('../../src/data/json/cards.json');
    const cards = (cardsJson as any).default?.cards
      ?? (cardsJson as any).cards
      ?? (Array.isArray(cardsJson) ? cardsJson : []);
    const ids: string[] = (Array.isArray(cards) ? cards : []).map((c: any) => c.id);
    expect(ids.length).toBeGreaterThan(0);

    // Sample a handful of canonical element-based card ids and verify they exist.
    const sampledCardIds = [
      't1-attack-attack', 't1-defense-defense', 't1-agility-agility', 't1-counter-counter',
      't1-fire-fire', 't1-water-water', 't1-air-air', 't1-earth-earth',
      't1-attack-fire', 't1-fire-water', 't2-attack-attack-attack', 't2-fire-fire-water',
    ];
    const dead = sampledCardIds.filter(id => !ids.includes(id));
    expect(dead).toEqual([]);
  });
});
