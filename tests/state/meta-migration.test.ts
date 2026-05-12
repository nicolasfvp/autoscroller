import { describe, it, expect } from 'vitest';
import { migrateMetaState, createDefaultMetaState } from '../../src/state/MetaState';

describe('migrateMetaState', () => {
  it('returns a valid default MetaState v4 when passed null', () => {
    const result = migrateMetaState(null);
    const defaults = createDefaultMetaState();
    expect({ ...result, _wipedFromVersion: undefined }).toEqual({ ...defaults, _wipedFromVersion: undefined });
    expect(result.version).toBe(6);
    expect(result.materials).toEqual({});
  });

  it('returns a valid default MetaState v4 when passed undefined', () => {
    const result = migrateMetaState(undefined);
    const defaults = createDefaultMetaState();
    expect({ ...result, _wipedFromVersion: undefined }).toEqual({ ...defaults, _wipedFromVersion: undefined });
    expect(result.version).toBe(6);
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
    expect(result.materials).toEqual({}); // D-06 wipes materials
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
    expect(result.buildings.storehouse).toEqual({ level: 0 }); // D-06 wipe also produces 0
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
    expect(result.runHistory).toEqual([]); // D-06 wipes runHistory

  });

  it('migrates v2 state to v4 with new fields', () => {
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
    expect(result.version).toBe(6);
    expect(result.materials).toEqual({}); // D-06 wipes materials
    expect(result.tutorialSeen).toBe(false);
    expect(result.audioPrefs).toEqual({ sfxVolume: 1, sfxEnabled: true });
    expect(result.gameSpeed).toBe(1);
    expect(result.autoSave).toBe(true);
  });

  it('v2 state with existing tutorialSeen: true preserves it', () => {
    const v2State = {
      buildings: {
        forge: { level: 0 },
        library: { level: 0 },
        tavern: { level: 0 },
        workshop: { level: 0 },
        shrine: { level: 0 },
        storehouse: { level: 0 },
      },
      materials: {},
      classXP: { warrior: 0 },
      passivesUnlocked: [],
      unlockedCards: [],
      unlockedRelics: [],
      unlockedTiles: [],
      runHistory: [],
      totalRuns: 0,
      tutorialSeen: true,
      version: 2,
    };

    const result = migrateMetaState(v2State);
    expect(result.tutorialSeen).toBe(false); // D-06 wipes tutorialSeen
    expect(result.version).toBe(6);
  });

  it('sets version: 4 on migrated v1 state', () => {
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
    expect(result.version).toBe(6);
    expect(result.tutorialSeen).toBe(false);
    expect(result.audioPrefs).toEqual({ sfxVolume: 1, sfxEnabled: true });
  });

  it('v1 state with metaLoot produces v4 with materials.essence and new fields', () => {
    const v1State = {
      buildings: {
        forge: { level: 1 },
        library: { level: 0 },
        tavern: { level: 0 },
        workshop: { level: 0 },
        shrine: { level: 0 },
      },
      metaLoot: 50,
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
    expect(result.version).toBe(6);
    expect(result.materials).toEqual({}); // D-06 wipes materials
    expect(result.tutorialSeen).toBe(false);
  });

  it('migrates v4 state to v5, backfilling className on existing run history entries', () => {
    const v4State = {
      buildings: {
        forge: { level: 2 },
        library: { level: 1 },
        tavern: { level: 0 },
        workshop: { level: 1 },
        shrine: { level: 0 },
        storehouse: { level: 3 },
      },
      materials: { wood: 10 },
      classXP: { warrior: 200, mage: 0 },
      passivesUnlocked: ['power_strike'],
      unlockedCards: ['fury'],
      unlockedRelics: ['iron_will'],
      unlockedTiles: ['swamp'],
      runHistory: [
        { seed: 'old-run', loopsCompleted: 4, bossesDefeated: 1, exitType: 'safe', materialsEarned: { wood: 5 }, xpEarned: 80, timestamp: 4000 },
      ],
      totalRuns: 10,
      tutorialSeen: true,
      audioPrefs: { sfxVolume: 0.8, sfxEnabled: true },
      gameSpeed: 2,
      autoSave: false,
      version: 4,
    };

    const result = migrateMetaState(v4State);
    expect(result.version).toBe(6);
    expect(result.runHistory).toEqual([]); // D-06 wipes runHistory
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
    expect(result.buildings.forge.level).toBe(0); // D-06 wipes buildings
    expect(result.buildings.library.level).toBe(0); // D-06 wipes buildings
    expect(result.buildings.workshop.level).toBe(0); // D-06 wipes buildings
    expect(result.unlockedCards).toEqual([]); // D-06 wipes unlocks
    expect(result.passivesUnlocked).toEqual([]); // D-06 wipes passives
    expect(result.unlockedTiles).toEqual([]); // D-06 wipes tiles
    expect(result.classXP.warrior).toBe(0); // D-06 wipes XP
    expect(result.totalRuns).toBe(0); // D-06 wipes counters
  });
});
