import { describe, it, expect } from 'vitest';
import { getAvailableCards, getAvailableRelics, getAvailableTiles } from '../../src/systems/UnlockManager';

// In the element-based card system there are 164 implemented cards (8 Tier 0
// teaching cards + 36 Tier 1 + 120 Tier 2), none of which carry an
// unlockSource — so every card is universally available regardless of
// metaUnlockedCards.
// Relics: 80 total. 26 strong/rare relics are gated behind the Shrine building
// (unlockSource:'shrine'); the remaining 54 are always-available in the base pool.
const TOTAL_CARDS = 164;
const BASE_RELICS = 54; // ungated (no unlockSource); 26 more gated behind the Shrine

describe('UnlockManager', () => {
  describe('getAvailableCards', () => {
    it('returns all cards when unlockedCards is empty (no unlockSource gates)', () => {
      const cards = getAvailableCards([]);
      // All 164 cards have no unlockSource → always available.
      expect(cards.length).toBe(TOTAL_CARDS);
      const ids = cards.map(c => c.id);
      // Spot-check a representative Tier 1 spread (pure-element + mixed).
      expect(ids).toContain('t2-attack-attack');
      expect(ids).toContain('t2-defense-defense');
      expect(ids).toContain('t2-fire-fire');
      expect(ids).toContain('t2-water-water');
      expect(ids).toContain('t2-attack-fire');
      expect(ids).toContain('t2-agility-defense');
    });

    it('still returns all cards even when unlockedCards lists specific ids', () => {
      const cards = getAvailableCards(['t2-attack-attack']);
      const ids = cards.map(c => c.id);
      expect(ids).toContain('t2-attack-attack');
      expect(ids).toContain('t2-fire-fire');
      // Listing an id is a no-op when no card is gated — pool is still 164.
      expect(cards.length).toBe(TOTAL_CARDS);
    });

    it('returns all 164 cards regardless of the gated list contents', () => {
      const someIds = [
        't2-attack-attack', 't2-defense-defense', 't2-fire-fire',
        't3-attack-attack-attack', 't3-fire-fire-fire',
      ];
      const cards = getAvailableCards(someIds);
      expect(cards.length).toBe(TOTAL_CARDS);
    });
  });

  describe('getAvailableRelics', () => {
    it('returns only the base (ungated) relics when unlockedRelics is empty', () => {
      const relics = getAvailableRelics([]);
      expect(relics.length).toBe(BASE_RELICS);
      const ids = relics.map(r => r.id);
      // Base-pool relics are always available.
      expect(ids).toContain('bronze_scale');
      expect(ids).toContain('energy_tonic');
      expect(ids).toContain('arcane_crystal');
      expect(ids).toContain('vitality_ring');
      // Shrine-gated relics are NOT in the base pool.
      expect(ids).not.toContain('phoenix_feather');
      expect(ids).not.toContain('demon_heart');
    });

    it('unlocking a shrine-gated relic adds it to the available pool', () => {
      const relics = getAvailableRelics(['phoenix_feather']);
      expect(relics.length).toBe(BASE_RELICS + 1);
      expect(relics.map(r => r.id)).toContain('phoenix_feather');
    });
  });

  describe('getAvailableTiles', () => {
    it('returns only base tile types when unlockedTiles is empty', () => {
      const tiles = getAvailableTiles([]);
      const ids = tiles.map(t => t.id);
      expect(ids).toContain('basic');
      expect(ids).toContain('forest');
      expect(ids).toContain('event');
      expect(ids).toContain('treasure');
      expect(ids).toContain('boss');
      // Two utility sub-tiles ship unlocked by default.
      expect(ids).toContain('subtile_camp');
      expect(ids).toContain('subtile_manawell');
      expect(ids).not.toContain('rest');
      expect(ids).not.toContain('shop');
      expect(ids).not.toContain('graveyard');
      expect(ids).not.toContain('subtile_ambush'); // gated behind Workshop
      expect(tiles.length).toBe(7);
    });

    it('returns base tiles plus graveyard when unlocked', () => {
      const tiles = getAvailableTiles(['graveyard']);
      const ids = tiles.map(t => t.id);
      expect(ids).toContain('graveyard');
      expect(tiles.length).toBe(8); // 5 base + 2 default sub-tiles + graveyard
    });
  });
});
