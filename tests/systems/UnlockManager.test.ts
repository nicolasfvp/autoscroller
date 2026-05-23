import { describe, it, expect } from 'vitest';
import { getAvailableCards, getAvailableRelics, getAvailableTiles } from '../../src/systems/UnlockManager';

// In the element-based card system there are 164 implemented cards (8 Tier 0
// teaching cards + 36 Tier 1 + 120 Tier 2), none of which carry an
// unlockSource — so every card is universally available regardless of
// metaUnlockedCards.
// Relics v2: 80 total, none gated — every relic is always-available.
const TOTAL_CARDS = 164;
const TOTAL_RELICS = 80;
const ALWAYS_AVAILABLE_RELICS = 80;

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
    it('returns all relics when unlockedRelics is empty (v2: no gating)', () => {
      const relics = getAvailableRelics([]);
      expect(relics.length).toBe(ALWAYS_AVAILABLE_RELICS);
      const ids = relics.map(r => r.id);
      // Spot-check a representative spread across class + rarity.
      expect(ids).toContain('bronze_scale');
      expect(ids).toContain('energy_tonic');
      expect(ids).toContain('arcane_crystal');
      expect(ids).toContain('vitality_ring');
      // v2: rare relics are now in the default pool too.
      expect(ids).toContain('phoenix_feather');
      expect(ids).toContain('demon_heart');
    });

    it('extra entries in unlockedRelics is a no-op when nothing is gated', () => {
      const relics = getAvailableRelics(['phoenix_feather']);
      expect(relics.length).toBe(TOTAL_RELICS);
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
      expect(ids).not.toContain('rest');
      expect(ids).not.toContain('shop');
      expect(ids).not.toContain('graveyard');
      expect(tiles.length).toBe(5);
    });

    it('returns base tiles plus graveyard when unlocked', () => {
      const tiles = getAvailableTiles(['graveyard']);
      const ids = tiles.map(t => t.id);
      expect(ids).toContain('graveyard');
      expect(tiles.length).toBe(6);
    });
  });
});
