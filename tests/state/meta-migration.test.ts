import { describe, it, expect } from 'vitest';
import { migrateMetaState, createDefaultMetaState } from '../../src/state/MetaState';

describe('migrateMetaState', () => {
  it('returns a valid default MetaState v2 when passed null', () => {
    const result = migrateMetaState(null);
    const defaults = createDefaultMetaState();
    expect(result).toEqual(defaults);
    expect(result.version).toBe(2);
    expect(result.materials).toEqual({});
  });

  it('returns a valid default MetaState v2 when passed undefined', () => {
    const result = migrateMetaState(undefined);
    const defaults = createDefaultMetaState();
    expect(result).toEqual(defaults);
    expect(result.version).toBe(2);
  });

  it('converts v1 state with metaLoot: 50 to materials: { essence: 50 }', () => {
    const v1State = {
      buildings: {
        forge: { level: 2 },
        library: { level: 1 },
        tavern: { level: 0 },
        workshop: { level: 1 },
        shrine: { level: 0 },
      },
      metaLoot: 50,
      classXP: { warrior: 100 },
      passivesUnlocked: ['power_strike'],
      unlockedCards: ['fury'],
      unlockedRelics: [],
      unlockedTiles: ['swamp'],
      runHistory: [
        { seed: 'abc', loopsCompleted: 3, bossesDefeated: 1, exitType: 'safe', metaLootEarned: 25, xpEarned: 50, timestamp: 1000 },
      ],
      totalRuns: 5,
      version: 1,
    };

    const result = migrateMetaState(v1State);
    expect(result.materials).toEqual({ essence: 50 });
  });

  it('converts v1 state with metaLoot: 0 to materials: {} (empty)', () => {
    const v1State = {
      buildings: {
        forge: { level: 0 },
        library: { level: 0 },
        tavern: { level: 0 },
        workshop: { level: 0 },
        shrine: { level: 0 },
      },
      metaLoot: 0,
      classXP: { warrior: 0 },
      passivesUnlocked: [],
      unlockedCards: [],
      unlockedRelics: [],
      unlockedTiles: [],
      runHistory: [],
      totalRuns: 0,
      version: 1,
    };

    const result = migrateMetaState(v1State);
    expect(result.materials).toEqual({});
  });

  it('adds storehouse: { level: 0 } when v1 state has no storehouse', () => {
    const v1State = {
      buildings: {
        forge: { level: 1 },
        library: { level: 0 },
        tavern: { level: 0 },
        workshop: { level: 0 },
        shrine: { level: 0 },
      },
      metaLoot: 10,
      classXP: { warrior: 0 },
      passivesUnlocked: [],
      unlockedCards: [],
      unlockedRelics: [],
      unlockedTiles: [],
      runHistory: [],
      totalRuns: 0,
      version: 1,
    };

    const result = migrateMetaState(v1State);
    expect(result.buildings.storehouse).toEqual({ level: 0 });
  });

  it('converts runHistory metaLootEarned to materialsEarned: { essence: N }', () => {
    const v1State = {
      buildings: {
        forge: { level: 0 },
        library: { level: 0 },
        tavern: { level: 0 },
        workshop: { level: 0 },
        shrine: { level: 0 },
      },
      metaLoot: 0,
      classXP: { warrior: 0 },
      passivesUnlocked: [],
      unlockedCards: [],
      unlockedRelics: [],
      unlockedTiles: [],
      runHistory: [
        { seed: 'abc', loopsCompleted: 3, bossesDefeated: 1, exitType: 'safe', metaLootEarned: 25, xpEarned: 50, timestamp: 1000 },
        { seed: 'def', loopsCompleted: 5, bossesDefeated: 2, exitType: 'death', metaLootEarned: 10, xpEarned: 80, timestamp: 2000 },
      ],
      totalRuns: 2,
      version: 1,
    };

    const result = migrateMetaState(v1State);
    expect(result.runHistory[0].materialsEarned).toEqual({ essence: 25 });
    expect(result.runHistory[1].materialsEarned).toEqual({ essence: 10 });
  });

  it('returns v2 state unchanged (passthrough)', () => {
    const v2State = {
      buildings: {
        forge: { level: 2 },
        library: { level: 1 },
        tavern: { level: 0 },
        workshop: { level: 1 },
        shrine: { level: 0 },
        storehouse: { level: 3 },
      },
      materials: { wood: 10, iron: 5 },
      classXP: { warrior: 200 },
      passivesUnlocked: ['power_strike'],
      unlockedCards: ['fury'],
      unlockedRelics: ['iron_will'],
      unlockedTiles: ['swamp'],
      runHistory: [
        { seed: 'xyz', loopsCompleted: 8, bossesDefeated: 3, exitType: 'safe', materialsEarned: { wood: 5 }, xpEarned: 100, timestamp: 3000 },
      ],
      totalRuns: 10,
      version: 2,
    };

    const result = migrateMetaState(v2State);
    expect(result).toEqual(v2State);
    expect(result.materials).toEqual({ wood: 10, iron: 5 });
  });

  it('sets version: 2 on migrated v1 state', () => {
    const v1State = {
      buildings: {
        forge: { level: 0 },
        library: { level: 0 },
        tavern: { level: 0 },
        workshop: { level: 0 },
        shrine: { level: 0 },
      },
      metaLoot: 0,
      classXP: { warrior: 0 },
      passivesUnlocked: [],
      unlockedCards: [],
      unlockedRelics: [],
      unlockedTiles: [],
      runHistory: [],
      totalRuns: 0,
      version: 1,
    };

    const result = migrateMetaState(v1State);
    expect(result.version).toBe(2);
  });

  it('preserves existing buildings, unlockedCards, passivesUnlocked, etc.', () => {
    const v1State = {
      buildings: {
        forge: { level: 2 },
        library: { level: 1 },
        tavern: { level: 0 },
        workshop: { level: 1 },
        shrine: { level: 0 },
      },
      metaLoot: 50,
      classXP: { warrior: 100 },
      passivesUnlocked: ['power_strike'],
      unlockedCards: ['fury'],
      unlockedRelics: [],
      unlockedTiles: ['swamp'],
      runHistory: [
        { seed: 'abc', loopsCompleted: 3, bossesDefeated: 1, exitType: 'safe', metaLootEarned: 25, xpEarned: 50, timestamp: 1000 },
      ],
      totalRuns: 5,
      version: 1,
    };

    const result = migrateMetaState(v1State);
    expect(result.buildings.forge.level).toBe(2);
    expect(result.buildings.library.level).toBe(1);
    expect(result.buildings.workshop.level).toBe(1);
    expect(result.unlockedCards).toContain('fury');
    expect(result.passivesUnlocked).toContain('power_strike');
    expect(result.unlockedTiles).toContain('swamp');
    expect(result.classXP.warrior).toBe(100);
    expect(result.totalRuns).toBe(5);
  });
});
