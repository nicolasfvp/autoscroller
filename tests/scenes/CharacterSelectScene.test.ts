// Phase 9 (Design v2): logic-isolated tests for CharacterSelectScene's class
// catalog + LOCKED layout math. Phaser scene is excluded — visual checkpoint
// (Task 5) covers the rendered output. UI-SPEC §Copywriting + §Spacing FLAG.

import { describe, it, expect } from 'vitest';
import {
  CLASS_CARDS,
  getClassCards,
  computeCardLayout,
} from '../../src/scenes/CharacterSelectScene.helpers';
import { SHADOWBLADE_PALETTE } from '../../src/ui/StyleConstants';

describe('getClassCards / CLASS_CARDS (UI-SPEC §Component Inventory)', () => {
  it('returns exactly 3 classes', () => {
    expect(getClassCards()).toHaveLength(3);
    expect(CLASS_CARDS).toHaveLength(3);
  });

  it('order is warrior, mage, shadowblade', () => {
    expect(CLASS_CARDS.map(c => c.id)).toEqual(['warrior', 'mage', 'shadowblade']);
  });

  it('Shadowblade copy matches UI-SPEC §Copywriting verbatim', () => {
    const sb = CLASS_CARDS.find(c => c.id === 'shadowblade');
    expect(sb).toBeDefined();
    expect(sb!.name).toBe('Shadowblade');
    expect(sb!.description).toBe('Stealth assassin.\nBuilds Combo Points, detonates finishers.');
    expect(sb!.deckHint).toBe('Backstab, Toxic Coat, Veil Guard');
  });

  it('Shadowblade placeholder uses mage_idle sprite tinted with locked color', () => {
    const sb = CLASS_CARDS.find(c => c.id === 'shadowblade')!;
    expect(sb.spriteKey).toBe('mage_idle');
    expect(sb.spriteTint).toBe(SHADOWBLADE_PALETTE.shadowblade);
    expect(sb.spriteTint).toBe(0x7E5BEF);
    expect(sb.fallbackColor).toBe(0x7E5BEF);
  });
});

describe('computeCardLayout (UI-SPEC §Spacing FLAG)', () => {
  it('returns 230px cards with 24px gaps to fit 3 cards in 800px canvas', () => {
    const layout = computeCardLayout(800, 3);
    expect(layout.cardW).toBe(230);
    expect(layout.gap).toBe(24);
    expect(layout.totalW).toBe(3 * 230 + 2 * 24);
    expect(layout.totalW).toBe(738);
  });

  it('3-card layout fits inside 800px canvas with positive margin', () => {
    const layout = computeCardLayout(800, 3);
    expect(layout.totalW).toBeLessThanOrEqual(800);
    expect(layout.margin).toBeGreaterThan(0);
    expect(layout.margin).toBe((800 - 738) / 2);
    expect(layout.margin).toBe(31);
  });

  it('startX positions the first card center 31px from canvas edge + half cardW', () => {
    const layout = computeCardLayout(800, 3);
    expect(layout.startX).toBe(31 + 230 / 2);
    expect(layout.startX).toBe(146);
  });

  it('legacy 2-card layout still fits with the new dimensions', () => {
    const layout = computeCardLayout(800, 2);
    expect(layout.totalW).toBe(2 * 230 + 1 * 24);
    expect(layout.totalW).toBe(484);
    expect(layout.totalW).toBeLessThanOrEqual(800);
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
