import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatEngine } from '../../../src/systems/combat/CombatEngine';
import { createCombatState } from '../../../src/systems/combat/CombatState';
import { type RunState, setRun, clearRun } from '../../../src/state/RunState';
import type { EnemyDefinition } from '../../../src/data/types';
import { loadAllData } from '../../../src/data/DataLoader';

// Mock EventBus so we can track emitted events
const mockEmit = vi.fn();
vi.mock('../../../src/core/EventBus', () => ({
  eventBus: {
    emit: (...args: unknown[]) => mockEmit(...args),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

function makeMockRun(deckActive: string[] = ['t1-attack-attack', 't1-defense-defense', 't1-fire-fire']): RunState {
  return {
    version: 5,
    runId: 'test-run',
    seed: 'test-seed',
    generation: 1,
    startedAt: Date.now(),
    hero: {
      maxHP: 100,
      currentHP: 100,
      maxStamina: 50,
      currentStamina: 50,
      maxMana: 30,
      currentMana: 30,
      currentDefense: 0,
      strength: 1,
      defenseMultiplier: 1,
      moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
    },
    deck: {
      active: deckActive,
      inventory: {},
      upgraded: deckActive.map(() => false),
      droppedCards: [],
    },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 50, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [],
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
    isInCombat: false,
    currentScene: 'Game',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
  };
}

function makeMockEnemy(): EnemyDefinition {
  return {
    id: 'slime',
    name: 'Slime',
    type: 'normal',
    baseHP: 100,
    baseDefense: 0,
    attack: { damage: 8, pattern: 'fixed' },
    attackCooldown: 2500,
    goldReward: { min: 10, max: 20 },
    color: 0x00ff00,
  };
}

describe('CombatEngine', () => {
  let engine: CombatEngine;

  beforeEach(() => {
    loadAllData();
    mockEmit.mockClear();
    const run = makeMockRun();
    setRun(run);
    const enemy = makeMockEnemy();
    const state = createCombatState(run, enemy);
    // Pin deck order for deterministic engine tests
    state.deckOrder = ['t1-attack-attack', 't1-defense-defense', 't1-fire-fire'];
    engine = new CombatEngine(state);
  });

  afterEach?.(() => {
    clearRun();
  });

  it('tick() plays top card when heroCooldownTimer reaches 0 (starts at 0)', () => {
    // First tick with deltaMs > 0 should immediately try to play a card
    // because heroCooldownTimer starts at 0
    engine.tick(100);

    const cardPlayedCalls = mockEmit.mock.calls.filter(
      (c: unknown[]) => c[0] === 'combat:card-played'
    );
    expect(cardPlayedCalls.length).toBe(1);
    expect(cardPlayedCalls[0][1].cardId).toBe('t1-attack-attack');
  });

  it('heroCooldownTimer set to card.cooldown * 1000 after playing', async () => {
    const { getCardById } = await import('../../../src/data/DataLoader');
    const cd = (getCardById('t1-attack-attack')!.cooldown) * 1000; // ms

    engine.tick(100);

    // After playing, next card should NOT play until the cooldown passes.
    // Tick slightly under the cooldown.
    engine.tick(Math.max(0, cd - 200));
    const cardPlayedCalls = mockEmit.mock.calls.filter(
      (c: unknown[]) => c[0] === 'combat:card-played'
    );
    expect(cardPlayedCalls.length).toBe(1);

    // Now complete the cooldown with a generous overage.
    engine.tick(300);
    const cardPlayedCalls2 = mockEmit.mock.calls.filter(
      (c: unknown[]) => c[0] === 'combat:card-played'
    );
    expect(cardPlayedCalls2.length).toBe(2);
  });

  it('skips unaffordable card and tries next', () => {
    // Pin an expensive card (3-stamina) first then a free card; with hero stamina at 0,
    // the engine must skip the expensive one and play the free one.
    // Tier-1 redesign: Pyre (t1-fire-fire) is one of the free cards in the
    // new set, used here instead of Bulwark Vow (now costs 1 stamina).
    const run = makeMockRun(['t2-attack-attack-attack', 't1-fire-fire']);
    run.hero.currentStamina = 0;
    const enemy = makeMockEnemy();
    const state = createCombatState(run, enemy);
    setRun(run);
    state.heroStamina = 0; // mirror per-combat
    state.deckOrder = ['t2-attack-attack-attack', 't1-fire-fire'];
    const eng = new CombatEngine(state);

    eng.tick(100);

    const skippedCalls = mockEmit.mock.calls.filter(
      (c: unknown[]) => c[0] === 'combat:card-skipped'
    );
    const playedCalls = mockEmit.mock.calls.filter(
      (c: unknown[]) => c[0] === 'combat:card-played'
    );
    expect(skippedCalls.length).toBe(1);
    expect(skippedCalls[0][1].cardId).toBe('t2-attack-attack-attack');
    expect(playedCalls.length).toBe(1);
    expect(playedCalls[0][1].cardId).toBe('t1-fire-fire');
  });

  it('deck pointer resets to 0 when exhausted', () => {
    // Deck with 1 card -- after playing it, pointer should reset
    const run = makeMockRun(['t1-attack-attack']);
    const enemy = makeMockEnemy();
    enemy.baseHP = 500; // won't die quickly
    const state = createCombatState(run, enemy);
    const eng = new CombatEngine(state);

    // Play card 1 (strike)
    eng.tick(100);
    // Wait for cooldown (1200ms for strike)
    eng.tick(1200);
    // Should reshuffle and play strike again

    const reshuffleCalls = mockEmit.mock.calls.filter(
      (c: unknown[]) => c[0] === 'combat:deck-reshuffled'
    );
    expect(reshuffleCalls.length).toBeGreaterThanOrEqual(1);

    const stats = eng.getStats();
    expect(stats.reshuffles).toBeGreaterThanOrEqual(1);
  });

  it('passive regen adds +2 stamina per 3s, +1 mana per 3s', () => {
    const run = makeMockRun(['t1-attack-attack']);
    run.hero.currentStamina = 40; // not full
    run.hero.currentMana = 20; // not full
    const enemy = makeMockEnemy();
    enemy.baseHP = 500;
    const state = createCombatState(run, enemy);
    const eng = new CombatEngine(state);

    // Tick 3000ms to trigger one regen cycle
    eng.tick(3000);

    const currentState = eng.getState();
    expect(currentState.heroStamina).toBeGreaterThanOrEqual(42); // +2 stamina
    expect(currentState.heroMana).toBeGreaterThanOrEqual(21); // +1 mana (might have spent on fireball)
  });

  it('combat ends with "victory" when enemy HP <= 0', () => {
    // Create a weak enemy that will die from one strike
    const run = makeMockRun(['t1-attack-attack']);
    run.hero.strength = 100; // massive damage
    const enemy = makeMockEnemy();
    enemy.baseHP = 5;
    const state = createCombatState(run, enemy);
    const eng = new CombatEngine(state);

    eng.tick(100);

    expect(eng.isComplete()).toBe(true);
    const stats = eng.getStats();
    expect(stats.result).toBe('victory');

    const endCalls = mockEmit.mock.calls.filter(
      (c: unknown[]) => c[0] === 'combat:end'
    );
    expect(endCalls.length).toBe(1);
    expect(endCalls[0][1].result).toBe('victory');
  });

  it('combat ends with "defeat" when hero HP <= 0', () => {
    // Create powerful enemy that kills hero in one hit
    const run = makeMockRun(['t1-attack-attack']);
    run.hero.currentHP = 1;
    const enemy = makeMockEnemy();
    enemy.attack.damage = 100;
    enemy.attackCooldown = 100; // very fast
    const state = createCombatState(run, enemy);
    const eng = new CombatEngine(state);

    eng.tick(100); // plays card + enemy attacks

    expect(eng.isComplete()).toBe(true);
    const stats = eng.getStats();
    expect(stats.result).toBe('defeat');
  });

  it('emits "combat:card-played" event on card play', () => {
    engine.tick(100);

    const calls = mockEmit.mock.calls.filter(
      (c: unknown[]) => c[0] === 'combat:card-played'
    );
    expect(calls.length).toBe(1);
    expect(calls[0][1]).toHaveProperty('cardId');
    expect(calls[0][1]).toHaveProperty('damage');
  });

  it.skip('emits "combat:synergy-triggered" when synergy fires (removed in Phase 10)', () => {
    // The card-pair synergy system was retired when the element-based card
    // system shipped — synergy now lives in the element combinations
    // themselves. synergies.json is empty, so no synergy event can fire.
  });

  it('emits "combat:end" when combat finishes', () => {
    const run = makeMockRun(['t1-attack-attack']);
    run.hero.strength = 200;
    const enemy = makeMockEnemy();
    enemy.baseHP = 1;
    const state = createCombatState(run, enemy);
    const eng = new CombatEngine(state);

    eng.tick(100);

    const endCalls = mockEmit.mock.calls.filter(
      (c: unknown[]) => c[0] === 'combat:end'
    );
    expect(endCalls.length).toBe(1);
  });

  it('does not tick further after combat is finished', () => {
    const run = makeMockRun(['t1-attack-attack']);
    run.hero.strength = 200;
    const enemy = makeMockEnemy();
    enemy.baseHP = 1;
    const state = createCombatState(run, enemy);
    const eng = new CombatEngine(state);

    eng.tick(100); // kills enemy
    const callsAfterEnd = mockEmit.mock.calls.length;

    eng.tick(5000); // should do nothing
    expect(mockEmit.mock.calls.length).toBe(callsAfterEnd);
  });

  it('getStats returns combat statistics', () => {
    engine.tick(100);
    const stats = engine.getStats();

    expect(stats.cardsPlayed).toBeGreaterThanOrEqual(1);
    expect(stats.enemyId).toBe('slime');
    expect(stats.enemyName).toBe('Slime');
  });

  it('getState returns combat state reference', () => {
    const state = engine.getState();
    expect(state.enemyId).toBe('slime');
    expect(state.heroMaxHP).toBe(100);
  });
});
