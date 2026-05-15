import { describe, it, expect } from 'vitest';
import {
  WARRIOR_BASE_STATS,
  WARRIOR_STARTER_DECK,
  WARRIOR,
} from '../../../src/systems/hero/WarriorClass';

describe('WarriorClass', () => {
  describe('WARRIOR_BASE_STATS', () => {
    it('has maxHP 100', () => {
      expect(WARRIOR_BASE_STATS.maxHP).toBe(100);
    });

    it('has maxStamina 50', () => {
      expect(WARRIOR_BASE_STATS.maxStamina).toBe(50);
    });

    it('has maxMana 30', () => {
      expect(WARRIOR_BASE_STATS.maxMana).toBe(30);
    });

    it('has strength 1', () => {
      expect(WARRIOR_BASE_STATS.strength).toBe(1);
    });

    it('has defenseMultiplier 1', () => {
      expect(WARRIOR_BASE_STATS.defenseMultiplier).toBe(1);
    });
  });

  describe('WARRIOR_STARTER_DECK', () => {
    it('contains 5 card IDs (element system)', () => {
      expect(WARRIOR_STARTER_DECK).toHaveLength(5);
    });

    it('uses element-based card IDs (t1-*)', () => {
      for (const id of WARRIOR_STARTER_DECK) {
        expect(id).toMatch(/^t1-/);
      }
    });
  });

  describe('WARRIOR class definition', () => {
    it('has className warrior', () => {
      expect(WARRIOR.className).toBe('warrior');
    });

    it('references WARRIOR_BASE_STATS', () => {
      expect(WARRIOR.baseStats).toBe(WARRIOR_BASE_STATS);
    });

    it('references WARRIOR_STARTER_DECK', () => {
      expect(WARRIOR.starterDeck).toBe(WARRIOR_STARTER_DECK);
    });
  });
});
