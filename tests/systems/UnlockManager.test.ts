import { describe, it, expect } from 'vitest';
import { getAvailableCards, getAvailableRelics, getAvailableTiles } from '../../src/systems/UnlockManager';

// In the element-based card system there are 156 implemented cards, none of
// which carry an unlockSource — so every card is universally available
// regardless of metaUnlockedCards.
// Relics: 39 total, 28 always-available, 11 forge-gated.
const TOTAL_CARDS = 156;
const TOTAL_RELICS = 39;
const ALWAYS_AVAILABLE_RELICS = 28;
const GATED_RELIC_IDS = [
  'wargods_mantle', 'bloodgorged_heart', 'the_last_banner',
  'tempest_resonator', 'tideheart_amulet', 'archon_codex',
  'blood_pact', 'berserker_ring', 'crown_of_pact',
  'phoenix_feather', 'demon_heart',
];

describe('UnlockManager', () => {
  describe('getAvailableCards', () => {
    it('returns all cards when unlockedCards is empty (no unlockSource gates)', () => {
      const cards = getAvailableCards([]);
      // All 156 cards have no unlockSource → always available.
      expect(cards.length).toBe(TOTAL_CARDS);
      const ids = cards.map(c => c.id);
      // Spot-check a representative Tier 1 spread (pure-element + mixed).
      expect(ids).toContain('t1-attack-attack');
      expect(ids).toContain('t1-defense-defense');
      expect(ids).toContain('t1-fire-fire');
      expect(ids).toContain('t1-water-water');
      expect(ids).toContain('t1-attack-fire');
      expect(ids).toContain('t1-agility-defense');
    });

    it('still returns all cards even when unlockedCards lists specific ids', () => {
      const cards = getAvailableCards(['t1-attack-attack']);
      const ids = cards.map(c => c.id);
      expect(ids).toContain('t1-attack-attack');
      expect(ids).toContain('t1-fire-fire');
      // Listing an id is a no-op when no card is gated — pool is still 156.
      expect(cards.length).toBe(TOTAL_CARDS);
    });

    it('returns all 156 cards regardless of the gated list contents', () => {
      const someIds = [
        't1-attack-attack', 't1-defense-defense', 't1-fire-fire',
        't2-attack-attack-attack', 't2-fire-fire-fire',
      ];
      const cards = getAvailableCards(someIds);
      expect(cards.length).toBe(TOTAL_CARDS);
    });
  });

  describe('getAvailableRelics', () => {
    it('returns only relics with no unlockSource when unlockedRelics is empty', () => {
      const relics = getAvailableRelics([]);
      // 28 always-available relics (those without unlockSource).
      expect(relics.length).toBe(ALWAYS_AVAILABLE_RELICS);
      const ids = relics.map(r => r.id);
      // Spot-check a few always-available relics.
      expect(ids).toContain('bronze_scale');
      expect(ids).toContain('energy_potion');
      expect(ids).toContain('arcane_crystal');
      expect(ids).toContain('vitality_ring');
      expect(ids).toContain('mana_stone');
      // Gated relics should NOT be in the default pool.
      expect(ids).not.toContain('phoenix_feather');
      expect(ids).not.toContain('demon_heart');
    });

    it('returns starters plus phoenix_feather when unlocked', () => {
      const relics = getAvailableRelics(['phoenix_feather']);
      expect(relics.length).toBe(ALWAYS_AVAILABLE_RELICS + 1);
      const ids = relics.map(r => r.id);
      expect(ids).toContain('bronze_scale');
      expect(ids).toContain('phoenix_feather');
    });

    it('returns all 39 relics when all gated relics are unlocked', () => {
      const relics = getAvailableRelics(GATED_RELIC_IDS);
      expect(relics.length).toBe(TOTAL_RELICS);
    });
  });

  describe('getAvailableTiles', () => {
    it('returns only base tile types when unlockedTiles is empty', () => {
      const tiles = getAvailableTiles([]);
      const ids = tiles.map(t => t.id);
      expect(ids).toContain('basic');
      expect(ids).toContain('forest');
      expect(ids).toContain('shop');
      expect(ids).toContain('rest');
      expect(ids).toContain('event');
      expect(ids).toContain('treasure');
      expect(ids).toContain('boss');
      expect(ids).not.toContain('graveyard');
      expect(tiles.length).toBe(7);
    });

    it('returns base tiles plus graveyard when unlocked', () => {
      const tiles = getAvailableTiles(['graveyard']);
      const ids = tiles.map(t => t.id);
      expect(ids).toContain('graveyard');
      expect(tiles.length).toBe(8);
    });
  });
});
