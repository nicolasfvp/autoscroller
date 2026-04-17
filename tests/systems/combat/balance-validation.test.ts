import { describe, it, expect, vi, beforeAll } from 'vitest';
import { CombatEngine } from '../../../src/systems/combat/CombatEngine';
import { createCombatState } from '../../../src/systems/combat/CombatState';
import { scaleEnemyForLoop } from '../../../src/systems/DifficultyScaler';
import { loadAllData } from '../../../src/data/DataLoader';
import type { RunState } from '../../../src/state/RunState';
import type { EnemyDefinition } from '../../../src/data/types';

// Mock EventBus
vi.mock('../../../src/core/EventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Starter deck: 4x strike, 4x defend, 1x heavy-hit, 1x fireball
const STARTER_DECK = [
  'strike', 'strike', 'strike', 'strike',
  'defend', 'defend', 'defend', 'defend',
  'heavy-hit', 'fireball',
];

function makeStarterRun(): RunState {
  return {
    runId: 'balance-test',
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
    },
    deck: {
      active: [...STARTER_DECK],
      inventory: {},
      upgradedCards: [],
      droppedCards: [],
    },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [],
    isInCombat: false,
    currentScene: 'Game',
  };
}

function makeSlimeEnemy(): EnemyDefinition {
  return {
    id: 'slime',
    name: 'Slime',
    type: 'normal',
    baseHP: 130,
    baseDefense: 0,
    attack: { damage: 3, pattern: 'fixed' },
    attackCooldown: 2500,
    goldReward: { min: 10, max: 20 },
    color: 0x00ff00,
  };
}

function makeGoblinEnemy(): EnemyDefinition {
  return {
    id: 'goblin',
    name: 'Goblin',
    type: 'normal',
    baseHP: 100,
    baseDefense: 0,
    attack: { damage: 2, pattern: 'random', specialEffect: 'double' },
    attackCooldown: 1500,
    goldReward: { min: 15, max: 25 },
    color: 0x8b4513,
  };
}

/**
 * Simulate a full combat, ticking in small increments.
 * Returns elapsed time in ms and the final combat state.
 */
function simulateCombat(engine: CombatEngine, maxMs: number = 30000, tickSize: number = 100): { elapsedMs: number; heroSurvived: boolean } {
  let elapsed = 0;
  while (!engine.isComplete() && elapsed < maxMs) {
    engine.tick(tickSize);
    elapsed += tickSize;
  }
  const state = engine.getState();
  return {
    elapsedMs: elapsed,
    heroSurvived: state.heroHP > 0,
  };
}

describe('Combat Balance Validation', () => {
  beforeAll(() => {
    loadAllData();
  });

  describe('fight duration with starter deck', () => {
    it('starter deck vs loop 1 Slime (130 HP) finishes in 15-36s', () => {
      const run = makeStarterRun();
      const enemy = makeSlimeEnemy();
      const state = createCombatState(run, enemy);
      const engine = new CombatEngine(state);

      const result = simulateCombat(engine);

      expect(result.elapsedMs).toBeGreaterThanOrEqual(15000);
      expect(result.elapsedMs).toBeLessThanOrEqual(36000);
    });

    it('starter deck vs loop 1 Goblin (100 HP) finishes in 12-30s', () => {
      const run = makeStarterRun();
      const enemy = makeGoblinEnemy();
      const state = createCombatState(run, enemy);
      const engine = new CombatEngine(state);

      const result = simulateCombat(engine);

      expect(result.elapsedMs).toBeGreaterThanOrEqual(12000);
      expect(result.elapsedMs).toBeLessThanOrEqual(30000);
    });

    it('starter deck vs loop 1 Slime -- hero survives', () => {
      const run = makeStarterRun();
      const enemy = makeSlimeEnemy();
      const state = createCombatState(run, enemy);
      const engine = new CombatEngine(state);

      const result = simulateCombat(engine);

      expect(result.heroSurvived).toBe(true);
    });
  });

  describe('fight duration scales with loop count', () => {
    it('loop 3 Slime takes longer than loop 1 Slime', () => {
      const slimeBase = makeSlimeEnemy();

      // Loop 1
      const run1 = makeStarterRun();
      const state1 = createCombatState(run1, slimeBase);
      const engine1 = new CombatEngine(state1);
      const result1 = simulateCombat(engine1);

      // Loop 3: scale enemy stats
      const scaled = scaleEnemyForLoop(slimeBase, 3);
      const slimeLoop3: EnemyDefinition = {
        ...slimeBase,
        baseHP: scaled.hp,
        baseDefense: scaled.defense,
        attack: { ...slimeBase.attack, damage: scaled.damage },
      };
      const run3 = makeStarterRun();
      const state3 = createCombatState(run3, slimeLoop3);
      const engine3 = new CombatEngine(state3);
      const result3 = simulateCombat(engine3);

      expect(result3.elapsedMs).toBeGreaterThanOrEqual(result1.elapsedMs);
    });
  });
});
