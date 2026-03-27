import { describe, it, expect, beforeEach } from 'vitest';
import {
  addCard,
  removeCard,
  reorderDeck,
  getRemovalCost,
  REMOVAL_BASE_COST,
  REORDER_SESSION_COST,
} from '../../../src/systems/deck/DeckSystem';
import type { RunState } from '../../../src/state/RunState';

function makeRun(overrides?: {
  active?: string[];
  gold?: number;
}): RunState {
  return {
    runId: 'test',
    generation: 1,
    startedAt: 0,
    hero: {
      maxHP: 100, currentHP: 100,
      maxStamina: 50, currentStamina: 50,
      maxMana: 30, currentMana: 30,
      currentDefense: 0, strength: 1,
      defenseMultiplier: 1, moveSpeed: 2,
    },
    deck: {
      active: overrides?.active ?? [],
      inventory: {},
    },
    loop: { count: 0, tiles: [], difficulty: 1, tileLength: 20 },
    economy: {
      gold: overrides?.gold ?? 100,
      tilePoints: 0,
      tileInventory: {},
      materials: {},
    },
    relics: [],
    isInCombat: false,
    currentScene: 'Game',
  } as RunState;
}

describe('DeckSystem', () => {
  describe('addCard', () => {
    it('appends card to deck.active', () => {
      const run = makeRun({ active: ['strike'] });
      addCard('fury', run);
      expect(run.deck.active).toEqual(['strike', 'fury']);
    });

    it('does not change gold', () => {
      const run = makeRun({ gold: 50 });
      addCard('fury', run);
      expect(run.economy.gold).toBe(50);
    });
  });

  describe('getRemovalCost', () => {
    it('with 10-card deck returns 23', () => {
      const run = makeRun({ active: Array(10).fill('strike') });
      // Math.ceil(10 * (1 + 0.25 * Math.max(0, 15 - 10))) = Math.ceil(10 * 2.25) = 23
      expect(getRemovalCost(run)).toBe(23);
    });

    it('with 5-card deck returns 35', () => {
      const run = makeRun({ active: Array(5).fill('strike') });
      // Math.ceil(10 * (1 + 0.25 * Math.max(0, 15 - 5))) = Math.ceil(10 * 3.5) = 35
      expect(getRemovalCost(run)).toBe(35);
    });

    it('with 20-card deck returns 10 (no penalty above 15)', () => {
      const run = makeRun({ active: Array(20).fill('strike') });
      // Math.ceil(10 * (1 + 0.25 * Math.max(0, 15 - 20))) = Math.ceil(10 * 1) = 10
      expect(getRemovalCost(run)).toBe(10);
    });
  });

  describe('removeCard', () => {
    it('removes first occurrence from deck.active and deducts gold', () => {
      const run = makeRun({ active: ['strike', 'fury', 'strike'], gold: 100 });
      const cost = getRemovalCost(run);
      const result = removeCard('strike', run);
      expect(result).toBe(true);
      expect(run.deck.active).toEqual(['fury', 'strike']);
      expect(run.economy.gold).toBe(100 - cost);
    });

    it('returns false if gold < cost', () => {
      const run = makeRun({ active: Array(5).fill('strike'), gold: 10 });
      // cost is 35 > 10
      const result = removeCard('strike', run);
      expect(result).toBe(false);
      expect(run.deck.active).toHaveLength(5);
    });

    it('returns false if card not in deck', () => {
      const run = makeRun({ active: ['strike'], gold: 100 });
      expect(removeCard('fury', run)).toBe(false);
    });
  });

  describe('reorderDeck', () => {
    it('sets deck.active to new order and deducts 30 gold', () => {
      const run = makeRun({ active: ['strike', 'fury', 'defend'], gold: 50 });
      const result = reorderDeck(['defend', 'fury', 'strike'], run);
      expect(result).toBe(true);
      expect(run.deck.active).toEqual(['defend', 'fury', 'strike']);
      expect(run.economy.gold).toBe(20);
    });

    it('returns false if gold < 30', () => {
      const run = makeRun({ active: ['strike', 'fury'], gold: 20 });
      const result = reorderDeck(['fury', 'strike'], run);
      expect(result).toBe(false);
      expect(run.deck.active).toEqual(['strike', 'fury']);
    });

    it('returns false if newOrder has different cards', () => {
      const run = makeRun({ active: ['strike', 'fury'], gold: 50 });
      const result = reorderDeck(['strike', 'heal'], run);
      expect(result).toBe(false);
    });
  });

  describe('constants', () => {
    it('REMOVAL_BASE_COST is 10', () => {
      expect(REMOVAL_BASE_COST).toBe(10);
    });

    it('REORDER_SESSION_COST is 30', () => {
      expect(REORDER_SESSION_COST).toBe(30);
    });
  });
});
