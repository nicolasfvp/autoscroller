import { describe, it, expect, beforeEach } from 'vitest';
import {
  addCard,
  removeCard,
  reorderDeck,
  getRemovalCost,
  REMOVAL_MIN_COST,
  REMOVAL_MAX_COST,
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
      upgradedCards: [],
      droppedCards: [],
    },
    loop: { count: 0, tiles: [], difficulty: 1, tileLength: 20 },
    economy: {
      gold: overrides?.gold ?? 500,
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
    it('with 15+ cards returns min cost 30', () => {
      const run = makeRun({ active: Array(15).fill('strike') });
      expect(getRemovalCost(run)).toBe(30);
    });

    it('with 20 cards returns min cost 30 (clamped)', () => {
      const run = makeRun({ active: Array(20).fill('strike') });
      expect(getRemovalCost(run)).toBe(30);
    });

    it('with 3 cards returns max cost 200', () => {
      const run = makeRun({ active: Array(3).fill('strike') });
      expect(getRemovalCost(run)).toBe(200);
    });

    it('with 9 cards returns interpolated value (100)', () => {
      const run = makeRun({ active: Array(9).fill('strike') });
      // t = (9-3)/12 = 0.5, cost = 200 + 0.5*(30-200) = 200 - 85 = 115
      expect(getRemovalCost(run)).toBe(115);
    });
  });

  describe('removeCard', () => {
    it('removes first occurrence from deck.active and deducts gold', () => {
      const run = makeRun({ active: ['strike', 'fury', 'strike'], gold: 500 });
      const cost = getRemovalCost(run);
      const result = removeCard('strike', run);
      expect(result).toBe(true);
      expect(run.deck.active).toEqual(['fury', 'strike']);
      expect(run.economy.gold).toBe(500 - cost);
    });

    it('returns false if gold < cost', () => {
      const run = makeRun({ active: Array(5).fill('strike'), gold: 10 });
      const result = removeCard('strike', run);
      expect(result).toBe(false);
      expect(run.deck.active).toHaveLength(5);
    });

    it('returns false if card not in deck', () => {
      const run = makeRun({ active: ['strike'], gold: 500 });
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
    it('REMOVAL_MIN_COST is 30', () => {
      expect(REMOVAL_MIN_COST).toBe(30);
    });

    it('REMOVAL_MAX_COST is 200', () => {
      expect(REMOVAL_MAX_COST).toBe(200);
    });

    it('REORDER_SESSION_COST is 30', () => {
      expect(REORDER_SESSION_COST).toBe(30);
    });
  });
});
