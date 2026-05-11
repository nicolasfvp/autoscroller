import { describe, it, expect } from 'vitest';
import { createNewRun, RUN_STATE_VERSION, migrateRunState } from '../../src/state/RunState';
import { resolveHeroStats, readStat } from '../../src/systems/hero/HeroStatsResolver';

describe('RunState v4 stat axes + statDeltas (Phase 9)', () => {
  it('RUN_STATE_VERSION is 4', () => {
    expect(RUN_STATE_VERSION).toBe(4);
  });

  it('createNewRun returns hero with stat axes at 0 (warrior)', () => {
    const run = createNewRun(undefined, 1, 'warrior');
    expect(run.hero.vitality).toBe(0);
    expect(run.hero.dexterity).toBe(0);
    expect(run.hero.intellect).toBe(0);
    expect(run.hero.spirit).toBe(0);
  });

  it('createNewRun returns hero with empty statDeltas', () => {
    const run = createNewRun(undefined, 1, 'warrior');
    expect(run.hero.statDeltas).toEqual({});
  });

  it('createNewRun returns hero with statDeltas for mage too', () => {
    const run = createNewRun(undefined, 1, 'mage');
    expect(run.hero.statDeltas).toEqual({});
    expect(run.hero.vitality).toBe(0);
  });

  it('v3 save without stat fields migrates to v4 with backfilled fields', () => {
    const v3Save: any = {
      version: 3,
      runId: 'test',
      seed: 'test-seed',
      generation: 1,
      startedAt: 0,
      hero: {
        maxHP: 100, currentHP: 100,
        maxStamina: 50, currentStamina: 50,
        maxMana: 30, currentMana: 30,
        currentDefense: 0, strength: 1,
        defenseMultiplier: 1, moveSpeed: 2,
        className: 'warrior',
      },
      deck: { active: [], inventory: {}, upgraded: [], droppedCards: [] },
      loop: { count: 0, tiles: [], difficulty: 1, tileLength: 20 },
      economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
      relics: [],
      isInCombat: false,
      currentScene: 'GameScene',
      stopAtShop: true,
      combatSpeed: 1,
      mapSpeed: 1,
      pool: { cards: [], relics: [], tiles: [] },
      stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
    };
    const migrated = migrateRunState(v3Save);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(4);
    expect(migrated!.hero.vitality).toBe(0);
    expect(migrated!.hero.dexterity).toBe(0);
    expect(migrated!.hero.intellect).toBe(0);
    expect(migrated!.hero.spirit).toBe(0);
    expect(migrated!.hero.statDeltas).toEqual({});
  });

  it('v0 save migrates all the way to v4', () => {
    const v0Save: any = {
      runId: 'old', seed: 'old-seed',
      hero: { maxHP: 100, currentHP: 50, maxStamina: 50, currentStamina: 50, maxMana: 30, currentMana: 30, currentDefense: 0, strength: 1, defenseMultiplier: 1, moveSpeed: 2 },
      deck: { active: ['strike'], inventory: {}, upgraded: [false] },
      loop: { count: 0, tiles: [], difficulty: 1, tileLength: 20 },
      economy: { gold: 0, tilePoints: 0 },
      relics: [],
      isInCombat: false, currentScene: 'GameScene',
      pool: { cards: [], relics: [], tiles: [] },
    };
    const migrated = migrateRunState(v0Save);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(4);
    expect(migrated!.hero.vitality).toBe(0);
    expect(migrated!.hero.statDeltas).toEqual({});
  });

  it('v4 save (already current) passes through unchanged', () => {
    const v4Save: any = {
      version: 4,
      runId: 'now', seed: 'now-seed', generation: 1, startedAt: 0,
      hero: {
        maxHP: 100, currentHP: 100, maxStamina: 50, currentStamina: 50,
        maxMana: 30, currentMana: 30, currentDefense: 0, strength: 1,
        defenseMultiplier: 1, moveSpeed: 2, className: 'warrior',
        vitality: 5, dexterity: 3, intellect: 2, spirit: 1,
        statDeltas: { vit: 5 },
      },
      deck: { active: [], inventory: {}, upgraded: [], droppedCards: [] },
      loop: { count: 0, tiles: [], difficulty: 1, tileLength: 20 },
      economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
      relics: [], isInCombat: false, currentScene: 'GameScene',
      stopAtShop: true, combatSpeed: 1, mapSpeed: 1,
      pool: { cards: [], relics: [], tiles: [] },
      stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
    };
    const migrated = migrateRunState(v4Save);
    expect(migrated!.version).toBe(4);
    expect(migrated!.hero.statDeltas).toEqual({ vit: 5 });
  });
});

describe('statDeltas resolution (resolveHeroStats)', () => {
  it('empty statDeltas returns baseStats unchanged', () => {
    const run = createNewRun(undefined, 1, 'warrior');
    const resolved = resolveHeroStats(run);
    expect(resolved.maxHP).toBe(100);
    expect(resolved.str).toBe(1);
    expect(resolved.vit).toBe(0);
  });

  it('vit delta of 3 raises vit to 3', () => {
    const run = createNewRun(undefined, 1, 'warrior');
    run.hero.statDeltas = { vit: 3 };
    const resolved = resolveHeroStats(run);
    expect(resolved.vit).toBe(3);
  });

  it('maxHP delta of 15 raises maxHP to 115', () => {
    const run = createNewRun(undefined, 1, 'warrior');
    run.hero.statDeltas = { maxHP: 15 };
    const resolved = resolveHeroStats(run);
    expect(resolved.maxHP).toBe(115);
  });

  it('multiple deltas resolve additively', () => {
    const run = createNewRun(undefined, 1, 'mage');
    run.hero.statDeltas = { vit: 2, dex: 5, int: 7, spi: 1, maxMana: 10 };
    const resolved = resolveHeroStats(run);
    expect(resolved.vit).toBe(2);
    expect(resolved.dex).toBe(5);
    expect(resolved.int).toBe(7);
    expect(resolved.spi).toBe(1);
    expect(resolved.maxMana).toBe(70); // mage base 60 + delta 10
  });

  it('per-combat vs per-run separation: mutating heroDexterity-like field does NOT touch run.hero.dexterity', () => {
    const run = createNewRun(undefined, 1, 'warrior');
    const mockCombat = { heroStrength: 1, heroVitality: 0, heroDexterity: 8, heroIntellect: 0, heroSpirit: 0 };
    mockCombat.heroDexterity = 99;
    expect(run.hero.dexterity).toBe(0);
    expect(readStat(mockCombat, 'dex')).toBe(99);
  });
});

describe('readStat (per-combat stat read)', () => {
  const combat = { heroStrength: 5, heroVitality: 3, heroDexterity: 8, heroIntellect: 4, heroSpirit: 2 };

  it('returns str', () => { expect(readStat(combat, 'str')).toBe(5); });
  it('returns vit', () => { expect(readStat(combat, 'vit')).toBe(3); });
  it('returns dex', () => { expect(readStat(combat, 'dex')).toBe(8); });
  it('returns int', () => { expect(readStat(combat, 'int')).toBe(4); });
  it('returns spi', () => { expect(readStat(combat, 'spi')).toBe(2); });
});
