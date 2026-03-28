import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCardReward,
  shouldOfferReward,
  CARD_REWARD_CHANCE_NORMAL,
  CARD_REWARD_CHANCE_ELITE,
  CARD_REWARD_CHANCE_BOSS,
} from '../../../src/systems/deck/LootSystem';

// Mock DataLoader so we control the card pool
vi.mock('../../../src/data/DataLoader', () => ({
  getAllCards: () => [
    { id: 'strike', name: 'Strike', rarity: 'common', category: 'attack', effects: [], cooldown: 1, targeting: 'single' },
    { id: 'defend', name: 'Defend', rarity: 'common', category: 'defense', effects: [], cooldown: 1, targeting: 'self' },
    { id: 'cleave', name: 'Cleave', rarity: 'common', category: 'attack', effects: [], cooldown: 1, targeting: 'aoe' },
    { id: 'heavy-hit', name: 'Heavy Hit', rarity: 'common', category: 'attack', effects: [], cooldown: 1, targeting: 'single' },
    { id: 'fury', name: 'Fury', rarity: 'uncommon', category: 'attack', effects: [], cooldown: 1, targeting: 'single' },
    { id: 'shield-wall', name: 'Shield Wall', rarity: 'uncommon', category: 'defense', effects: [], cooldown: 1, targeting: 'self' },
    { id: 'berserker', name: 'Berserker', rarity: 'rare', category: 'attack', effects: [], cooldown: 1, targeting: 'single' },
    { id: 'heal', name: 'Heal', rarity: 'rare', category: 'magic', effects: [], cooldown: 1, targeting: 'self' },
    { id: 'doom-blade', name: 'Doom Blade', rarity: 'epic', category: 'attack', effects: [], cooldown: 1, targeting: 'single' },
  ],
}));

function makeRng(values: number[]) {
  let i = 0;
  return { next: () => values[i++ % values.length] };
}

describe('LootSystem', () => {
  describe('shouldOfferReward', () => {
    it('normal enemy with rng 0.5 returns true (0.5 < 0.7)', () => {
      expect(shouldOfferReward('normal', makeRng([0.5]))).toBe(true);
    });

    it('normal enemy with rng 0.8 returns false (0.8 >= 0.7)', () => {
      expect(shouldOfferReward('normal', makeRng([0.8]))).toBe(false);
    });

    it('elite always returns true', () => {
      expect(shouldOfferReward('elite', makeRng([0.99]))).toBe(true);
    });

    it('boss always returns true', () => {
      expect(shouldOfferReward('boss', makeRng([0.99]))).toBe(true);
    });
  });

  describe('generateCardReward', () => {
    it('returns requested number of card IDs', () => {
      // rng: 0.0 for rarity roll (< 60, common), 0.0 for pick
      const result = generateCardReward(makeRng([0.0]), 3);
      expect(result).toHaveLength(3);
      result.forEach((id) => expect(typeof id).toBe('string'));
    });

    it('with rng returning 0.0, all cards are common rarity', () => {
      // 0.0 * 100 = 0 < 60 (common), 0.0 * pool.length = 0 (first common)
      const result = generateCardReward(makeRng([0.0]), 3);
      // All should be common cards from mock pool
      const commonIds = ['strike', 'defend', 'cleave', 'heavy-hit'];
      result.forEach((id) => expect(commonIds).toContain(id));
    });

    it('with rng returning 0.95, cards are rare or fallback rarity', () => {
      // 0.95 * 100 = 95 >= 90 (rare), picks from rare pool first then falls back
      const result = generateCardReward(makeRng([0.95]), 3);
      // First 2 should be rare (berserker, heal), 3rd falls back to any available
      expect(result).toHaveLength(3);
      expect(result).toContain('berserker');
      expect(result).toContain('heal');
    });
  });

  describe('constants', () => {
    it('CARD_REWARD_CHANCE_NORMAL is 0.7', () => {
      expect(CARD_REWARD_CHANCE_NORMAL).toBe(0.7);
    });

    it('CARD_REWARD_CHANCE_ELITE is 1.0', () => {
      expect(CARD_REWARD_CHANCE_ELITE).toBe(1.0);
    });

    it('CARD_REWARD_CHANCE_BOSS is 1.0', () => {
      expect(CARD_REWARD_CHANCE_BOSS).toBe(1.0);
    });
  });
});
