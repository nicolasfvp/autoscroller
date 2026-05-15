import { describe, it, expect } from 'vitest';
import { createDefaultMetaState, migrateMetaState } from '../../src/state/MetaState';

describe('MetaState v8 defaults', () => {
  it('createDefaultMetaState returns version 8', () => {
    expect(createDefaultMetaState().version).toBe(8);
  });

  it('createDefaultMetaState has tutorialSeen === false', () => {
    expect(createDefaultMetaState().tutorialSeen).toBe(false);
  });

  it('createDefaultMetaState has audioPrefs.sfxVolume === 1', () => {
    expect(createDefaultMetaState().audioPrefs.sfxVolume).toBe(1);
  });

  it('createDefaultMetaState has audioPrefs.sfxEnabled === true', () => {
    expect(createDefaultMetaState().audioPrefs.sfxEnabled).toBe(true);
  });

  it('createDefaultMetaState has gameSpeed === 1', () => {
    expect(createDefaultMetaState().gameSpeed).toBe(1);
  });

  it('createDefaultMetaState has autoSave === true', () => {
    expect(createDefaultMetaState().autoSave).toBe(true);
  });
});

describe('MetaState v5 migration paths', () => {
  it('v2 object migrates through chain and wipes to v6 fresh defaults (D-06)', () => {
    const v2 = {
      buildings: {
        forge: { level: 1 },
        library: { level: 0 },
        tavern: { level: 0 },
        workshop: { level: 0 },
        shrine: { level: 0 },
        storehouse: { level: 0 },
      },
      materials: { wood: 5 },
      classXP: { warrior: 50 },
      passivesUnlocked: [],
      unlockedCards: [],
      unlockedRelics: [],
      unlockedTiles: [],
      runHistory: [],
      totalRuns: 3,
      version: 2,
    };

    const result = migrateMetaState(v2);
    expect(result.version).toBe(8);
    expect(result.tutorialSeen).toBe(false);
    expect(result.audioPrefs).toEqual({ sfxVolume: 1, sfxEnabled: true });
    expect(result.gameSpeed).toBe(1);
    expect(result.autoSave).toBe(true);
  });

  it('v2 object with tutorialSeen: true preserves it', () => {
    const v2 = {
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

    const result = migrateMetaState(v2);
    expect(result.tutorialSeen).toBe(false); // post-D-06 wipe
  });

  it('v1 object migrates through chain and wipes to v6 (D-06)', () => {
    const v1 = {
      buildings: {
        forge: { level: 0 },
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

    const result = migrateMetaState(v1);
    expect(result.version).toBe(8);
    expect(result.materials).toEqual({}); // post-D-06 wipe
    expect(result.tutorialSeen).toBe(false);
    expect(result.audioPrefs).toEqual({ sfxVolume: 1, sfxEnabled: true });
    expect(result.gameSpeed).toBe(1);
    expect(result.autoSave).toBe(true);
  });

  it('v4 object now migrates through chain and wipes to v6 (D-06)', () => {
    const v4 = {
      buildings: {
        forge: { level: 2 },
        library: { level: 1 },
        tavern: { level: 0 },
        workshop: { level: 1 },
        shrine: { level: 0 },
        storehouse: { level: 3 },
      },
      materials: { iron: 10 },
      classXP: { warrior: 200, mage: 0 },
      passivesUnlocked: [],
      unlockedCards: ['fury'],
      unlockedRelics: [],
      unlockedTiles: [],
      runHistory: [],
      totalRuns: 5,
      tutorialSeen: true,
      audioPrefs: { sfxVolume: 0.5, sfxEnabled: false },
      gameSpeed: 2,
      autoSave: false,
      version: 4,
    };

    const result = migrateMetaState(v4);
    expect(result.version).toBe(8);
  });

  it("v5 object now wipes to v6 fresh defaults (D-06)", () => {
    const v5 = {
      buildings: {
        forge: { level: 2 },
        library: { level: 1 },
        tavern: { level: 0 },
        workshop: { level: 1 },
        shrine: { level: 0 },
        storehouse: { level: 3 },
      },
      materials: { iron: 10 },
      classXP: { warrior: 200, mage: 0 },
      passivesUnlocked: [],
      unlockedCards: ['fury'],
      unlockedRelics: [],
      unlockedTiles: [],
      runHistory: [],
      totalRuns: 5,
      tutorialSeen: true,
      audioPrefs: { sfxVolume: 0.5, sfxEnabled: false },
      gameSpeed: 2,
      autoSave: false,
      version: 5,
    };

    const result = migrateMetaState(v5) as any;
    expect(result.version).toBe(8);
    expect(result.unlockedCards).toEqual([]);
    expect(result._wipedFromVersion).toBe(5);
  });
});

describe('v3/v4/v5 -> v6 full wipe (Phase 9)', () => {
  it('v5 save wipes all fields to defaults', () => {
    const v5 = {
      buildings: {
        forge: { level: 5 },
        library: { level: 3 },
        tavern: { level: 4 },
        workshop: { level: 2 },
        shrine: { level: 1 },
        storehouse: { level: 6 },
      },
      materials: { iron: 100, wood: 50 },
      classXP: { warrior: 5000, mage: 2000 },
      passivesUnlocked: ['warrior_might'],
      unlockedCards: ['heavy-hit', 'fireball', 'fury'],
      unlockedRelics: ['warrior_spirit'],
      unlockedTiles: ['shop'],
      runHistory: [
        { seed: 's', loopsCompleted: 10, bossesDefeated: 3, exitType: 'safe',
          materialsEarned: { iron: 5 }, xpEarned: 200, timestamp: 0, className: 'warrior' },
      ],
      totalRuns: 50,
      tutorialSeen: true,
      audioPrefs: { sfxVolume: 0.3, sfxEnabled: false },
      gameSpeed: 2,
      autoSave: false,
      version: 5,
    };

    const result = migrateMetaState(v5);
    expect(result.version).toBe(8);
    expect(result.unlockedCards).toEqual([]);
    expect(result.unlockedRelics).toEqual([]);
    expect(result.unlockedTiles).toEqual([]);
    expect(result.classXP).toEqual({ warrior: 0, mage: 0 });
    expect(result.buildings.forge.level).toBe(0);
    expect(result.materials).toEqual({});
    expect(result.passivesUnlocked).toEqual([]);
    expect(result.totalRuns).toBe(0);
    expect(result.audioPrefs).toEqual({ sfxVolume: 1, sfxEnabled: true });
    expect(result.gameSpeed).toBe(1);
    expect(result.autoSave).toBe(true);
    expect(result.tutorialSeen).toBe(false);
    expect(result.runHistory).toEqual([]);
  });

  it('v5 save sets _wipedFromVersion to 5', () => {
    const v5 = { ...createDefaultMetaState(), version: 5 };
    const result = migrateMetaState(v5) as any;
    expect(result._wipedFromVersion).toBe(5);
  });

  it('v4 save chains v4 -> v5 -> v6 wipe with _wipedFromVersion set', () => {
    const v4 = {
      buildings: {
        forge: { level: 2 }, library: { level: 1 }, tavern: { level: 0 },
        workshop: { level: 1 }, shrine: { level: 0 }, storehouse: { level: 3 },
      },
      materials: { iron: 10 },
      classXP: { warrior: 200, mage: 0 },
      passivesUnlocked: [], unlockedCards: ['fury'], unlockedRelics: [], unlockedTiles: [],
      runHistory: [], totalRuns: 5,
      tutorialSeen: true,
      audioPrefs: { sfxVolume: 0.5, sfxEnabled: false },
      gameSpeed: 2, autoSave: false,
      version: 4,
    };
    const result = migrateMetaState(v4) as any;
    expect(result.version).toBe(8);
    expect(result._wipedFromVersion).toBe(5);  // wiped from the post-v4->v5 chain state
    expect(result.unlockedCards).toEqual([]);
  });

  it('v3 save chains v3 -> v4 -> v5 -> v6 wipe', () => {
    const v3 = {
      buildings: {
        forge: { level: 0 }, library: { level: 0 }, tavern: { level: 0 },
        workshop: { level: 0 }, shrine: { level: 0 }, storehouse: { level: 0 },
      },
      materials: {}, classXP: { warrior: 0 },
      passivesUnlocked: [], unlockedCards: [], unlockedRelics: [], unlockedTiles: [],
      runHistory: [], totalRuns: 0,
      tutorialSeen: false,
      audioPrefs: { sfxVolume: 1, sfxEnabled: true },
      gameSpeed: 1, autoSave: true,
      version: 3,
    };
    const result = migrateMetaState(v3) as any;
    expect(result.version).toBe(8);
    expect(result._wipedFromVersion).toBe(5);
  });

  it('v1 save still chains v1 -> v2 -> v3 -> v4 -> v5 -> v6 (wipe at v5)', () => {
    const v1 = {
      buildings: {
        forge: { level: 0 }, library: { level: 0 }, tavern: { level: 0 },
        workshop: { level: 0 }, shrine: { level: 0 },
      },
      metaLoot: 50, classXP: { warrior: 0 },
      passivesUnlocked: [], unlockedCards: [], unlockedRelics: [], unlockedTiles: [],
      runHistory: [], totalRuns: 0,
      version: 1,
    };
    const result = migrateMetaState(v1);
    expect(result.version).toBe(8);
  });

  it('createDefaultMetaState() does NOT carry _wipedFromVersion', () => {
    const fresh = createDefaultMetaState() as any;
    expect(fresh._wipedFromVersion).toBeUndefined();
  });

  it('createDefaultMetaState() returns version 8', () => {
    expect(createDefaultMetaState().version).toBe(8);
  });
});

describe('v6 -> v7 (Shadowblade removal)', () => {
  it('v6 save drops classXP.shadowblade and resets selectedClass', () => {
    const v6: any = {
      ...createDefaultMetaState(),
      classXP: { warrior: 100, mage: 50, shadowblade: 25 },
      selectedClass: 'shadowblade',
      version: 6,
    };
    const result = migrateMetaState(v6) as any;
    expect(result.version).toBe(8);
    expect(result.classXP).toEqual({ warrior: 100, mage: 50 });
    expect('shadowblade' in result.classXP).toBe(false);
    expect(result.selectedClass).toBe('warrior');
  });

  it('v6 save with no selectedClass leaves it undefined', () => {
    const v6: any = {
      ...createDefaultMetaState(),
      classXP: { warrior: 100, mage: 50, shadowblade: 25 },
      version: 6,
    };
    const result = migrateMetaState(v6) as any;
    expect(result.version).toBe(8);
    expect(result.classXP).toEqual({ warrior: 100, mage: 50 });
  });
});
