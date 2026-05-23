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
// Relics v2: 80 relics, none gated — every relic is always-available.
const TOTAL_CARDS = 164;
const TOTAL_RELICS = 80;
const ALWAYS_AVAILABLE_RELICS = 80;

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

    it('returns relics total=80 and all unlocked for default state (v2: no gating)', () => {
      const state = createDefaultMetaState();
      const status = getCollectionStatus(state);
      expect(status.relics.total).toBe(TOTAL_RELICS);
      expect(status.relics.unlocked).toBe(ALWAYS_AVAILABLE_RELICS);
    });

    it('returns bosses total matching boss-type enemies in data', () => {
      const state = createDefaultMetaState();
      const status = getCollectionStatus(state);
      // enemies.json bosses: doom_knight, iron_golem, lizard_king,
      // boss_demon, boss_berserker, boss_mage, boss_hydra
      expect(status.bosses.total).toBe(7);
    });

    it('returns tiles with base tiles unlocked and unlockable tiles locked', () => {
      const state = createDefaultMetaState();
      const status = getCollectionStatus(state);
      // 5 base (basic/forest/event/treasure/boss) + 4 unlockable (graveyard/swamp/desert/lava)
      expect(status.tiles.total).toBe(9);
      expect(status.tiles.unlocked).toBe(5); // only base tiles
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
    it('returns relic data with isUnlocked=true for any relic (v2: no gating)', () => {
      const state = createDefaultMetaState();
      const details = getItemDetails('phoenix_feather', state);
      expect(details).toBeDefined();
      expect(details!.id).toBe('phoenix_feather');
      expect(details!.isUnlocked).toBe(true);
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

  // v2 invariant: no relic carries unlockSource.
  it('no relic in v2 carries unlockSource', async () => {
    const relicsData = (await import('../../src/data/json/relics.json')).default as any[];
    for (const relic of relicsData) {
      expect(relic.unlockSource, `relic ${relic.id} should not be gated in v2`).toBeUndefined();
    }
  });
});
