import { describe, it, expect } from 'vitest';
import { createDefaultMetaState } from '../../src/state/MetaState';
import {
  getCollectionStatus,
  getCompletionPercent,
  getItemDetails,
} from '../../src/systems/CollectionRegistry';

// In the element-based card system (see docs/CARDS_SYSTEM.md), the card pool is:
//   - 164 implemented cards (8 Tier 0 + 36 Tier 1 + 120 Tier 2)
//   - 0 cards with unlockSource (all cards are universally available; the Forge
//     gate is enforced via tier unlock at the Forge, not unlockSource)
// Relics: 80 total. 26 strong/rare relics are gated behind the Shrine building
// (unlockSource:'shrine'); 54 are always-available in the base pool.
const TOTAL_CARDS = 164;
const TOTAL_RELICS = 80;
const BASE_RELICS = 54; // unlocked from a default meta state (no unlockSource)

describe('CollectionRegistry', () => {
  describe('getCollectionStatus', () => {
    it('returns cards total=164 and all cards unlocked (no unlockSource gates in element system)', () => {
      const state = createDefaultMetaState();
      const status = getCollectionStatus(state);
      expect(status.cards.total).toBe(TOTAL_CARDS);
      // Since no card carries unlockSource in the element-based pool, every
      // card is considered unlocked from a default meta state.
      expect(status.cards.unlocked).toBe(TOTAL_CARDS);
    });

    it('returns cards total=164 and unlocked=164 when unlockedCards is populated', () => {
      const state = createDefaultMetaState();
      state.unlockedCards = ['t2-attack-attack', 't2-fire-fire', 't2-defense-defense'];
      const status = getCollectionStatus(state);
      expect(status.cards.total).toBe(TOTAL_CARDS);
      // Still all unlocked — there's no gate to fail.
      expect(status.cards.unlocked).toBe(TOTAL_CARDS);
    });

    it('returns relics total=80 with only the 54 base relics unlocked by default', () => {
      const state = createDefaultMetaState();
      const status = getCollectionStatus(state);
      expect(status.relics.total).toBe(TOTAL_RELICS);
      expect(status.relics.unlocked).toBe(BASE_RELICS);
    });

    it('returns bosses total matching boss-type enemies in data', () => {
      const state = createDefaultMetaState();
      const status = getCollectionStatus(state);
      // enemies.json bosses: doom_knight, iron_golem, lizard_king,
      // bog_witch, desert_golem, infernal_dragon, boss_iron_golem
      expect(status.bosses.total).toBe(7);
    });

    it('returns tiles with base tiles unlocked and unlockable tiles locked', () => {
      const state = createDefaultMetaState();
      const status = getCollectionStatus(state);
      // 5 base (basic/forest/event/treasure/boss) + 4 unlockable
      // (graveyard/swamp/desert/lava) + 8 subtiles (ambush/bleedtotem/...)
      expect(status.tiles.total).toBe(17);
      // Subtiles are always-unlocked (world-gen seeds them, not the player),
      // so the unlocked count is 5 base + 8 subtiles = 13.
      expect(status.tiles.unlocked).toBe(13);
    });
  });

  describe('getCompletionPercent', () => {
    it('returns 0-100 integer for default state', () => {
      const state = createDefaultMetaState();
      const percent = getCompletionPercent(state);
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
      expect(Number.isInteger(percent)).toBe(true);
    });

    it('returns higher percent when more items are unlocked', () => {
      const defaultState = createDefaultMetaState();
      const unlockedState = createDefaultMetaState();
      // v2 relics have no gating, so move tiles to drive the percent up.
      // ~260 total items — need a multi-tile diff to clear integer rounding.
      unlockedState.unlockedTiles = ['graveyard', 'swamp', 'desert', 'lava'];
      expect(getCompletionPercent(unlockedState)).toBeGreaterThan(getCompletionPercent(defaultState));
    });
  });

  describe('getItemDetails', () => {
    it('shows a base relic unlocked but a shrine-gated relic locked by default', () => {
      const state = createDefaultMetaState();
      const base = getItemDetails('bronze_scale', state);
      expect(base).toBeDefined();
      expect(base!.isUnlocked).toBe(true);
      const gated = getItemDetails('phoenix_feather', state);
      expect(gated).toBeDefined();
      expect(gated!.id).toBe('phoenix_feather');
      expect(gated!.isUnlocked).toBe(false);
    });

    it('returns card data with isUnlocked=true for a Tier 1 card (no gates in element system)', () => {
      const state = createDefaultMetaState();
      const details = getItemDetails('t2-attack-attack', state);
      expect(details!.isUnlocked).toBe(true);
      expect(details!.unlockHint).toBeUndefined();
    });

    it('returns undefined for unknown item', () => {
      const state = createDefaultMetaState();
      const details = getItemDetails('nonexistent', state);
      expect(details).toBeUndefined();
    });
  });

  // 26 strong/rare relics are gated behind the Shrine; the rest are base.
  it('exactly 26 relics carry unlockSource=shrine', async () => {
    const relicsData = (await import('../../src/data/json/relics.json')).default as any[];
    const gated = relicsData.filter((r) => r.unlockSource);
    expect(gated.length).toBe(26);
    for (const r of gated) {
      expect(r.unlockSource, `relic ${r.id} unlockSource`).toBe('shrine');
    }
  });
});
