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
    it('contains 10 card IDs', () => {
      expect(WARRIOR_STARTER_DECK).toHaveLength(10);
    });

    it('matches existing starter deck composition', () => {
      expect(WARRIOR_STARTER_DECK).toEqual([
        'strike', 'strike', 'strike', 'strike',
        'defend', 'defend', 'defend', 'defend',
        'heavy-hit', 'fireball',
      ]);
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
