import { describe, it, expect } from 'vitest';
import { createCombatState, CombatState } from '../../../src/systems/combat/CombatState';
import type { RunState } from '../../../src/state/RunState';
import type { EnemyDefinition } from '../../../src/data/types';

function makeMockRun(): RunState {
  return {
    runId: 'test-run',
    generation: 1,
    startedAt: Date.now(),
    hero: {
      maxHP: 100,
      currentHP: 80, // intentionally not full
      maxStamina: 50,
      currentStamina: 30, // intentionally not full
      maxMana: 30,
      currentMana: 10, // intentionally not full
      currentDefense: 15, // has some defense
      strength: 2,
      defenseMultiplier: 1.5,
      moveSpeed: 2,
    },
    deck: {
      active: ['strike', 'defend', 'fireball', 'heavy-hit'],
      inventory: {},
    },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 50, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [],
    isInCombat: false,
    currentScene: 'Game',
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
    goldReward: { min: 10, max: 20 },
    color: 0x00ff00,
  };
}

describe('CombatState', () => {
  it('createCombatState copies hero HP from RunState (persisted, not reset)', () => {
    const run = makeMockRun();
    const enemy = makeMockEnemy();
    const state = createCombatState(run, enemy);

    expect(state.heroHP).toBe(80); // currentHP persists
    expect(state.heroMaxHP).toBe(100);
  });

  it('createCombatState resets stamina and mana to max', () => {
    const run = makeMockRun();
    const enemy = makeMockEnemy();
    const state = createCombatState(run, enemy);

    expect(state.heroStamina).toBe(50); // reset to maxStamina
    expect(state.heroMaxStamina).toBe(50);
    expect(state.heroMana).toBe(30); // reset to maxMana
    expect(state.heroMaxMana).toBe(30);
  });

  it('createCombatState resets defense to 0', () => {
    const run = makeMockRun();
    const enemy = makeMockEnemy();
    const state = createCombatState(run, enemy);

    expect(state.heroDefense).toBe(0);
  });

  it('createCombatState copies deck active order', () => {
    const run = makeMockRun();
    const enemy = makeMockEnemy();
    const state = createCombatState(run, enemy);

    expect(state.deckOrder).toEqual(['strike', 'defend', 'fireball', 'heavy-hit']);
  });

  it('createCombatState copies hero strength and defenseMultiplier', () => {
    const run = makeMockRun();
    const enemy = makeMockEnemy();
    const state = createCombatState(run, enemy);

    expect(state.heroStrength).toBe(2);
    expect(state.heroDefenseMultiplier).toBe(1.5);
  });

  it('createCombatState populates enemy fields from definition', () => {
    const run = makeMockRun();
    const enemy = makeMockEnemy();
    const state = createCombatState(run, enemy);

    expect(state.enemyId).toBe('slime');
    expect(state.enemyName).toBe('Slime');
    expect(state.enemyHP).toBe(100);
    expect(state.enemyMaxHP).toBe(100);
    expect(state.enemyDefense).toBe(0);
    expect(state.enemyDamage).toBe(8);
    expect(state.enemyPattern).toBe('fixed');
  });
});
