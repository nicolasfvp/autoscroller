import { describe, it, expect, beforeEach } from 'vitest';
import {
  RUN_STATE_VERSION,
  createNewRun,
  getRun,
  setRun,
  hasActiveRun,
  clearRun,
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

describe('RunState v4 (Phase 9) — stat axes + statDeltas wiring', () => {
  it('RUN_STATE_VERSION is 4 (Phase 9 stat axes added)', () => {
    // Import inline to avoid colliding with the existing top-level imports.
    // (vitest hoists describe but locally-scoped imports work too.)
    
    expect(RUN_STATE_VERSION).toBe(4);
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

describe('RunState — Shadowblade class (Phase 9 Plan 3)', () => {
  it('createNewRun shadowblade returns base stats per design/03 §2', () => {
    const run = createNewRun(undefined, 1, 'shadowblade');
    expect(run.hero.className).toBe('shadowblade');
    expect(run.hero.maxHP).toBe(60);
    expect(run.hero.currentHP).toBe(60);
    expect(run.hero.maxStamina).toBe(50);
    expect(run.hero.maxMana).toBe(20);
    expect(run.hero.strength).toBe(1);
    expect(run.hero.dexterity).toBe(8);
    expect(run.hero.intellect).toBe(1);
    expect(run.hero.vitality).toBe(0);
    expect(run.hero.spirit).toBe(0);
    expect(run.hero.defenseMultiplier).toBe(0.8);
  });

  it('createNewRun shadowblade has the 10-card starter deck (composition)', () => {
    const run = createNewRun(undefined, 1, 'shadowblade');
    expect(run.deck.active).toHaveLength(10);
    // Composition (order is shuffled by SeededRNG, so check counts).
    const counts = run.deck.active.reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts['backstab']).toBe(4);
    expect(counts['eviscerate']).toBe(2);
    expect(counts['shadowstep']).toBe(2);
    expect(counts['toxic-coat']).toBe(1);
    expect(counts['veil-guard']).toBe(1);
  });

  it('createNewRun shadowblade has empty statDeltas', () => {
    const run = createNewRun(undefined, 1, 'shadowblade');
    expect(run.hero.statDeltas).toEqual({});
  });
});
