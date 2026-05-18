import { describe, it, expect, vi, beforeAll } from 'vitest';
import { CombatEngine } from '../../../src/systems/combat/CombatEngine';
import { createCombatState } from '../../../src/systems/combat/CombatState';
import { scaleEnemyForLoop } from '../../../src/systems/DifficultyScaler';
import { loadAllData } from '../../../src/data/DataLoader';
import { setRun } from '../../../src/state/RunState';
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

// Phase 10 element starter decks (cards.json). The warrior starter is a
// 5-card mix of attack + defense; we approximate "attack-light" and
// "tank-light" loadouts with proxies that bias damage vs survivability.
const ATTACK_LIGHT_DECK = [
  't1-attack-attack',
  't1-attack-attack',
  't1-attack-attack',
  't1-attack-defense',
  't1-defense-defense',
];

const TANK_LIGHT_DECK = [
  't1-defense-defense',
  't1-defense-defense',
  't1-defense-defense',
  't1-attack-defense',
  't1-attack-attack',
];

function makeStarterRun(deck: string[] = ATTACK_LIGHT_DECK): RunState {
  return {
    version: 5,
    runId: 'balance-test',
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
      className: 'warrior',
    },
    deck: {
      active: [...deck],
      inventory: {},
      upgraded: new Array(deck.length).fill(false),
      droppedCards: [],
    },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [],
    isInCombat: false,
    currentScene: 'Game',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
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
function simulateCombat(engine: CombatEngine, maxMs: number = 120000, tickSize: number = 100): { elapsedMs: number; heroSurvived: boolean } {
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

// Post-element-rewrite, the 5-card warrior starter has lower raw DPS than
// the old 10-card deck (no heavy-hit/fireball burst), so fight durations
// shift longer. Use a coarse [10s, 90s] band sized to whichever proxy
// starter (attack-light vs tank-light) we're running.
const MIN_FIGHT_MS = 10_000;
const MAX_FIGHT_MS = 90_000;

describe('Combat Balance Validation', () => {
  beforeAll(() => {
    loadAllData();
  });

  describe('fight duration with starter deck', () => {
    it('attack-light starter vs loop 1 Slime finishes within [10s, 90s]', () => {
      const run = makeStarterRun(ATTACK_LIGHT_DECK);
      const enemy = makeSlimeEnemy();
      setRun(run);
      const state = createCombatState(run, enemy);
      const engine = new CombatEngine(state);

      const result = simulateCombat(engine);

      expect(result.elapsedMs).toBeGreaterThanOrEqual(MIN_FIGHT_MS);
      expect(result.elapsedMs).toBeLessThanOrEqual(MAX_FIGHT_MS);
    });

    it('attack-light starter vs loop 1 Goblin finishes within [10s, 90s]', () => {
      const run = makeStarterRun(ATTACK_LIGHT_DECK);
      const enemy = makeGoblinEnemy();
      setRun(run);
      const state = createCombatState(run, enemy);
      const engine = new CombatEngine(state);

      const result = simulateCombat(engine);

      expect(result.elapsedMs).toBeGreaterThanOrEqual(MIN_FIGHT_MS);
      expect(result.elapsedMs).toBeLessThanOrEqual(MAX_FIGHT_MS);
    });

    it('tank-light starter vs loop 1 Slime -- hero survives', () => {
      const run = makeStarterRun(TANK_LIGHT_DECK);
      const enemy = makeSlimeEnemy();
      setRun(run);
      const state = createCombatState(run, enemy);
      const engine = new CombatEngine(state);

      const result = simulateCombat(engine);

      expect(result.heroSurvived).toBe(true);
    });
  });

  describe('fight duration scales with difficulty multiplier (boss kills)', () => {
    it('post-boss Slime (mult 1.4) takes at least as long as base Slime', () => {
      const slimeBase = makeSlimeEnemy();

      // Base difficulty (no boss kills yet)
      const run1 = makeStarterRun(ATTACK_LIGHT_DECK);
      setRun(run1);
      const state1 = createCombatState(run1, slimeBase);
      const engine1 = new CombatEngine(state1);
      const result1 = simulateCombat(engine1);

      // After 4 boss kills: difficultyMultiplier = 1 + 4*0.10 = 1.4
      const scaled = scaleEnemyForLoop(slimeBase, 1, false, 1.4);
      const slimeScaled: EnemyDefinition = {
        ...slimeBase,
        baseHP: scaled.hp,
        baseDefense: scaled.defense,
        attack: { ...slimeBase.attack, damage: scaled.damage },
      };
      const run3 = makeStarterRun(ATTACK_LIGHT_DECK);
      setRun(run3);
      const state3 = createCombatState(run3, slimeScaled);
      const engine3 = new CombatEngine(state3);
      const result3 = simulateCombat(engine3);

      expect(result3.elapsedMs).toBeGreaterThanOrEqual(result1.elapsedMs);
    });
  });
});
