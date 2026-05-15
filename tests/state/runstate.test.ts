import { describe, it, expect, beforeEach } from 'vitest';
import {
  RUN_STATE_VERSION,
  createNewRun,
  getRun,
  setRun,
  hasActiveRun,
  clearRun,
  migrateRunState,
} from '../../src/state/RunState';

describe('RunState', () => {
  beforeEach(() => {
    clearRun();
  });

  it('createNewRun() returns RunState with all required fields', () => {
    const run = createNewRun();
    expect(run.runId).toBeDefined();
    expect(typeof run.runId).toBe('string');
    expect(run.runId.length).toBeGreaterThan(0);
    expect(run.hero).toBeDefined();
    expect(run.deck).toBeDefined();
    expect(run.loop).toBeDefined();
    expect(run.economy).toBeDefined();
    expect(run.relics).toBeDefined();
    expect(Array.isArray(run.relics)).toBe(true);
  });

  it('JSON.stringify(createNewRun()) does not throw', () => {
    const run = createNewRun();
    expect(() => JSON.stringify(run)).not.toThrow();
  });

  it('JSON round-trip preserves all data', () => {
    const run = createNewRun();
    const json = JSON.stringify(run);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(run);
  });

  it('getRun() throws when no active run', () => {
    expect(() => getRun()).toThrow('No active run');
  });

  it('setRun() then getRun() returns same object', () => {
    const run = createNewRun();
    setRun(run);
    expect(getRun()).toBe(run);
  });

  it('clearRun() then hasActiveRun() returns false', () => {
    const run = createNewRun();
    setRun(run);
    expect(hasActiveRun()).toBe(true);
    clearRun();
    expect(hasActiveRun()).toBe(false);
  });

  it('hero defaults match DEFAULT_HERO_STATS values', () => {
    const run = createNewRun();
    expect(run.hero.maxHP).toBe(100);
    expect(run.hero.currentHP).toBe(100);
    expect(run.hero.maxStamina).toBe(50);
    expect(run.hero.currentStamina).toBe(50);
    expect(run.hero.maxMana).toBe(30);
    expect(run.hero.currentMana).toBe(30);
    expect(run.hero.currentDefense).toBe(0);
    expect(run.hero.strength).toBe(1);
    expect(run.hero.defenseMultiplier).toBe(1);
    expect(run.hero.moveSpeed).toBe(2);
  });
});

describe('RunState v5 (element/shard system) — stat axes + statDeltas wiring', () => {
  it('RUN_STATE_VERSION is 5 (element/shard inventory added)', () => {
    expect(RUN_STATE_VERSION).toBe(5);
  });

  it('createNewRun has hero.statDeltas === {} (new run never has deltas)', () => {
    const run = createNewRun(undefined, 1, 'warrior');
    expect(run.hero.statDeltas).toEqual({});
  });

  it('createNewRun for warrior has vitality/dexterity/intellect/spirit === 0', () => {
    const run = createNewRun(undefined, 1, 'warrior');
    expect(run.hero.vitality).toBe(0);
    expect(run.hero.dexterity).toBe(0);
    expect(run.hero.intellect).toBe(0);
    expect(run.hero.spirit).toBe(0);
  });
});

describe('RunState v4 -> v5 migration (element/shard + shadowblade fallback)', () => {
  it('v4 save backfills economy.shards and economy.elements as objects', () => {
    const v4: any = {
      version: 4,
      runId: 'test-run',
      seed: 'test-seed',
      generation: 1,
      startedAt: 0,
      hero: {
        maxHP: 100, currentHP: 100, maxStamina: 50, currentStamina: 50,
        maxMana: 30, currentMana: 30, currentDefense: 0, strength: 1,
        defenseMultiplier: 1, moveSpeed: 2, className: 'warrior',
        vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
      },
      deck: { active: [], inventory: {}, upgraded: [], droppedCards: [] },
      loop: { count: 0, tiles: [], difficulty: 1, tileLength: 20, bossesDefeated: 0 },
      economy: { gold: 50, tilePoints: 2, tileInventory: {}, materials: {} },
      relics: [],
      stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
      isInCombat: false,
      currentScene: 'GameScene',
      stopAtShop: true,
      combatSpeed: 1,
      mapSpeed: 1,
      pool: { cards: [], relics: [], tiles: [] },
    };

    const result = migrateRunState(v4);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(5);
    expect(typeof result!.economy.shards).toBe('object');
    expect(typeof result!.economy.elements).toBe('object');
    expect(result!.economy.shards).toEqual({});
    expect(result!.economy.elements).toEqual({});
  });

  it('v4 save with hero.className === "shadowblade" falls back to "warrior"', () => {
    const v4: any = {
      version: 4,
      runId: 'test-run',
      seed: 'test-seed',
      generation: 1,
      startedAt: 0,
      hero: {
        maxHP: 100, currentHP: 100, maxStamina: 50, currentStamina: 50,
        maxMana: 30, currentMana: 30, currentDefense: 0, strength: 1,
        defenseMultiplier: 1, moveSpeed: 2, className: 'shadowblade',
        vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
      },
      deck: { active: [], inventory: {}, upgraded: [], droppedCards: [] },
      loop: { count: 0, tiles: [], difficulty: 1, tileLength: 20, bossesDefeated: 0 },
      economy: { gold: 50, tilePoints: 2, tileInventory: {}, materials: {} },
      relics: [],
      stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
      isInCombat: false,
      currentScene: 'GameScene',
      stopAtShop: true,
      combatSpeed: 1,
      mapSpeed: 1,
      pool: { cards: [], relics: [], tiles: [] },
    };

    const result = migrateRunState(v4);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(5);
    expect(result!.hero.className).toBe('warrior');
  });
});

