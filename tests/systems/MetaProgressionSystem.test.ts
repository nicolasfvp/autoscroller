import { describe, it, expect } from 'vitest';
import { createDefaultMetaState } from '../../src/state/MetaState';
import {
  upgradeBuilding,
  bankRunRewards,
  checkPassiveUnlocks,
  getBuildingTierData,
} from '../../src/systems/MetaProgressionSystem';

describe('MetaProgressionSystem', () => {
  describe('upgradeBuilding', () => {
    it('upgrades forge from 0 to 1 when metaLoot >= 50, deducting cost and unlocking cards', () => {
      const state = createDefaultMetaState();
      state.metaLoot = 100;
      const result = upgradeBuilding('forge', state);
      expect(result.success).toBe(true);
      expect(result.updatedState!.metaLoot).toBe(50);
      expect(result.updatedState!.buildings.forge.level).toBe(1);
      expect(result.updatedState!.unlockedCards).toContain('counter-strike');
      expect(result.updatedState!.unlockedCards).toContain('shield-wall');
      expect(result.newUnlocks!.cards).toEqual(['counter-strike', 'shield-wall']);
    });

    it('returns insufficient_meta_loot when metaLoot < cost', () => {
      const state = createDefaultMetaState();
      state.metaLoot = 10;
      const result = upgradeBuilding('forge', state);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('insufficient_meta_loot');
    });

    it('returns max_level when forge is already at maxLevel', () => {
      const state = createDefaultMetaState();
      state.metaLoot = 9999;
      state.buildings.forge.level = 4;
      const result = upgradeBuilding('forge', state);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('max_level');
    });

    it('upgrades shrine from 0 to 1 and adds relics to unlockedRelics', () => {
      const state = createDefaultMetaState();
      state.metaLoot = 200;
      const result = upgradeBuilding('shrine', state);
      expect(result.success).toBe(true);
      expect(result.updatedState!.buildings.shrine.level).toBe(1);
      expect(result.updatedState!.unlockedRelics).toContain('warrior_spirit');
      expect(result.updatedState!.unlockedRelics).toContain('iron_will');
      expect(result.newUnlocks!.relics).toEqual(['warrior_spirit', 'iron_will']);
    });

    it('upgrades workshop from 0 to 1 and adds tiles to unlockedTiles', () => {
      const state = createDefaultMetaState();
      state.metaLoot = 200;
      const result = upgradeBuilding('workshop', state);
      expect(result.success).toBe(true);
      expect(result.updatedState!.buildings.workshop.level).toBe(1);
      expect(result.updatedState!.unlockedTiles).toContain('graveyard');
      expect(result.newUnlocks!.tiles).toEqual(['graveyard']);
    });
  });

  describe('bankRunRewards', () => {
    it('adds 100% metaLoot and 100% XP on safe exit', () => {
      const state = createDefaultMetaState();
      const result = bankRunRewards(100, 50, 'safe', { seed: 'abc', loopsCompleted: 3, bossesDefeated: 1 }, state);
      expect(result.metaLoot).toBe(100);
      expect(result.classXP.warrior).toBe(50);
    });

    it('adds 25% metaLoot and 0 XP on death', () => {
      const state = createDefaultMetaState();
      const result = bankRunRewards(100, 50, 'death', { seed: 'abc', loopsCompleted: 3, bossesDefeated: 1 }, state);
      expect(result.metaLoot).toBe(25);
      expect(result.classXP.warrior).toBe(0);
    });

    it('appends a RunHistoryEntry with correct fields', () => {
      const state = createDefaultMetaState();
      const result = bankRunRewards(100, 50, 'safe', { seed: 'test-seed', loopsCompleted: 5, bossesDefeated: 2 }, state);
      expect(result.runHistory).toHaveLength(1);
      const entry = result.runHistory[0];
      expect(entry.seed).toBe('test-seed');
      expect(entry.loopsCompleted).toBe(5);
      expect(entry.bossesDefeated).toBe(2);
      expect(entry.exitType).toBe('safe');
      expect(entry.metaLootEarned).toBe(100);
      expect(entry.xpEarned).toBe(50);
      expect(typeof entry.timestamp).toBe('number');
    });

    it('increments totalRuns by 1', () => {
      const state = createDefaultMetaState();
      state.totalRuns = 5;
      const result = bankRunRewards(100, 50, 'safe', { seed: 'abc', loopsCompleted: 1, bossesDefeated: 0 }, state);
      expect(result.totalRuns).toBe(6);
    });
  });

  describe('checkPassiveUnlocks', () => {
    it('unlocks passive_attack_up when warrior XP >= 100', () => {
      const state = createDefaultMetaState();
      state.classXP.warrior = 100;
      const { updatedState, newPassives } = checkPassiveUnlocks(state);
      expect(updatedState.passivesUnlocked).toContain('passive_attack_up');
      expect(newPassives).toContain('passive_attack_up');
    });

    it('does not unlock passive_attack_up when warrior XP < 100', () => {
      const state = createDefaultMetaState();
      state.classXP.warrior = 50;
      const { updatedState, newPassives } = checkPassiveUnlocks(state);
      expect(updatedState.passivesUnlocked).not.toContain('passive_attack_up');
      expect(newPassives).toHaveLength(0);
    });

    it('does not re-unlock already unlocked passives', () => {
      const state = createDefaultMetaState();
      state.classXP.warrior = 200;
      state.passivesUnlocked = ['passive_attack_up'];
      const { newPassives } = checkPassiveUnlocks(state);
      expect(newPassives).not.toContain('passive_attack_up');
    });
  });

  describe('getBuildingTierData', () => {
    it('returns forge tier data with name, maxLevel, and tiers', () => {
      const data = getBuildingTierData('forge');
      expect(data.name).toBe('Forge');
      expect(data.maxLevel).toBe(4);
      expect(data.tiers).toHaveLength(4);
      expect(data.tiers[0].level).toBe(1);
      expect(data.tiers[0].cost).toBe(50);
      expect(data.tiers[0].unlocks.cards).toEqual(['counter-strike', 'shield-wall']);
    });
  });
});
