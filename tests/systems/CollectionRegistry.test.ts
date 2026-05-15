import { describe, it, expect } from 'vitest';
import { createDefaultMetaState } from '../../src/state/MetaState';
import {
  getCollectionStatus,
  getCompletionPercent,
  getItemDetails,
} from '../../src/systems/CollectionRegistry';

// In the element-based card system (see docs/CARDS_SYSTEM.md), the card pool is:
//   - 156 implemented cards (36 Tier 1 + 120 Tier 2)
//   - 0 cards with unlockSource (all cards are universally available; the Forge
//     gate is enforced via tier unlock at the Forge, not unlockSource)
// And the relic pool is 39 relics, 28 always-available and 11 gated (forge unlocks).
const TOTAL_CARDS = 156;
const TOTAL_RELICS = 39;
const ALWAYS_AVAILABLE_RELICS = 28;
const GATED_RELIC_IDS = [
  'wargods_mantle', 'bloodgorged_heart', 'the_last_banner',
  'tempest_resonator', 'tideheart_amulet', 'archon_codex',
  'blood_pact', 'berserker_ring', 'crown_of_pact',
  'phoenix_feather', 'demon_heart',
];

describe('CollectionRegistry', () => {
  describe('getCollectionStatus', () => {
    it('returns cards total=156 and all cards unlocked (no unlockSource gates in element system)', () => {
      const state = createDefaultMetaState();
      const status = getCollectionStatus(state);
      expect(status.cards.total).toBe(TOTAL_CARDS);
      // Since no card carries unlockSource in the element-based pool, every
      // card is considered unlocked from a default meta state.
      expect(status.cards.unlocked).toBe(TOTAL_CARDS);
    });

    it('returns cards total=156 and unlocked=156 when unlockedCards is populated', () => {
      const state = createDefaultMetaState();
      state.unlockedCards = ['t1-attack-attack', 't1-fire-fire', 't1-defense-defense'];
      const status = getCollectionStatus(state);
      expect(status.cards.total).toBe(TOTAL_CARDS);
      // Still all unlocked — there's no gate to fail.
      expect(status.cards.unlocked).toBe(TOTAL_CARDS);
    });

    it('returns relics total=39 and unlocked=28 for default state (28 always available)', () => {
      const state = createDefaultMetaState();
      const status = getCollectionStatus(state);
      expect(status.relics.total).toBe(TOTAL_RELICS);
      expect(status.relics.unlocked).toBe(ALWAYS_AVAILABLE_RELICS);
    });

    it('returns bosses total matching boss-type enemies in data', () => {
      const state = createDefaultMetaState();
      const status = getCollectionStatus(state);
      // enemies.json currently has 3 bosses: doom_knight, iron_golem, lizard_king
      expect(status.bosses.total).toBe(3);
    });

    it('returns tiles with base tiles unlocked and unlockable tiles locked', () => {
      const state = createDefaultMetaState();
      const status = getCollectionStatus(state);
      expect(status.tiles.total).toBe(10); // 7 base + 3 unlockable
      expect(status.tiles.unlocked).toBe(7); // only base tiles
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
      // Cards have no gates, so unlocking a card has no effect. Unlock a gated
      // relic instead to drive the completion percent up.
      unlockedState.unlockedRelics = ['phoenix_feather', 'demon_heart', 'berserker_ring'];
      expect(getCompletionPercent(unlockedState)).toBeGreaterThan(getCompletionPercent(defaultState));
    });
  });

  describe('getItemDetails', () => {
    it('returns relic data with isUnlocked=false and unlockHint for gated relic', () => {
      const state = createDefaultMetaState();
      const details = getItemDetails('phoenix_feather', state);
      expect(details).toBeDefined();
      expect(details!.id).toBe('phoenix_feather');
      expect(details!.isUnlocked).toBe(false);
      expect(details!.unlockHint).toContain('Forge');
    });

    it('returns relic data with isUnlocked=true for unlocked relic', () => {
      const state = createDefaultMetaState();
      state.unlockedRelics = ['phoenix_feather'];
      const details = getItemDetails('phoenix_feather', state);
      expect(details!.isUnlocked).toBe(true);
    });

    it('returns card data with isUnlocked=true for a Tier 1 card (no gates in element system)', () => {
      const state = createDefaultMetaState();
      const details = getItemDetails('t1-attack-attack', state);
      expect(details!.isUnlocked).toBe(true);
      expect(details!.unlockHint).toBeUndefined();
    });

    it('returns undefined for unknown item', () => {
      const state = createDefaultMetaState();
      const details = getItemDetails('nonexistent', state);
      expect(details).toBeUndefined();
    });
  });

  // Reference: confirm the GATED_RELIC_IDS list stays in sync with the data
  // (this is a sanity guard against silent fixture drift).
  it('GATED_RELIC_IDS sanity: every id is a real gated relic in relics.json', async () => {
    const relicsData = (await import('../../src/data/json/relics.json')).default as any[];
    for (const id of GATED_RELIC_IDS) {
      const relic = relicsData.find((r) => r.id === id);
      expect(relic, `relic ${id} should exist in relics.json`).toBeDefined();
      expect(relic.unlockSource, `relic ${id} should have unlockSource`).toBeDefined();
    }
  });
});
