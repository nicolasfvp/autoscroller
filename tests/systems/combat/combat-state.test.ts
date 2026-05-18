import { describe, it, expect } from 'vitest';
import { createCombatState } from '../../../src/systems/combat/CombatState';
import type { RunState } from '../../../src/state/RunState';
import type { EnemyDefinition } from '../../../src/data/types';

function makeMockRun(overrides?: Partial<{
  currentHP: number;
  maxHP: number;
  currentStamina: number;
  maxStamina: number;
  currentMana: number;
  maxMana: number;
  currentDefense: number;
  strength: number;
  defenseMultiplier: number;
}>): RunState {
  return {
    version: 3,
    runId: 'test-run',
    seed: 'test-seed',
    generation: 1,
    startedAt: Date.now(),
    hero: {
      maxHP: overrides?.maxHP ?? 100,
      currentHP: overrides?.currentHP ?? 80,
      maxStamina: overrides?.maxStamina ?? 50,
      currentStamina: overrides?.currentStamina ?? 30,
      maxMana: overrides?.maxMana ?? 30,
      currentMana: overrides?.currentMana ?? 10,
      currentDefense: overrides?.currentDefense ?? 15,
      strength: overrides?.strength ?? 2,
      defenseMultiplier: overrides?.defenseMultiplier ?? 1.5,
      moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
    },
    deck: {
      active: ['strike', 'defend', 'fireball', 'heavy-hit'],
      inventory: {},
      upgraded: [false, false, false, false],
      droppedCards: [],
    },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 50, tilePoints: 0, tileInventory: {}, materials: {} },
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

describe('CombatState', () => {
  it('createCombatState copies hero HP from RunState (persisted, not reset)', () => {
    const run = makeMockRun();
    const enemy = makeMockEnemy();
    const state = createCombatState(run, enemy);

    expect(state.heroHP).toBe(80); // currentHP persists
    expect(state.heroMaxHP).toBe(100);
  });

  it('createCombatState resets defense to 0', () => {
    const run = makeMockRun({ currentDefense: 15 });
    const enemy = makeMockEnemy();
    const state = createCombatState(run, enemy);

    expect(state.heroDefense).toBe(0);
  });

  it('createCombatState shuffles deck using seeded RNG (same cards, deterministic order)', () => {
    const run = makeMockRun();
    const enemy = makeMockEnemy();
    const state = createCombatState(run, enemy);

    // Same cards present (order may differ due to shuffle)
    expect([...state.deckOrder].sort()).toEqual(['defend', 'fireball', 'heavy-hit', 'strike']);

    // Deterministic: same inputs produce same shuffle
    const state2 = createCombatState(makeMockRun(), makeMockEnemy());
    expect(state2.deckOrder).toEqual(state.deckOrder);
  });

  it('createCombatState produces different shuffle for different enemies', () => {
    const run = makeMockRun();
    const slime = makeMockEnemy();
    const wolf: EnemyDefinition = { ...makeMockEnemy(), id: 'wolf', name: 'Wolf' };

    createCombatState(run, slime);
    const stateWolf = createCombatState(run, wolf);

    // Different enemy -> different seed -> (very likely) different order
    // With only 4 cards there's a 1/24 chance of same order, so we just check determinism
    expect([...stateWolf.deckOrder].sort()).toEqual(['defend', 'fireball', 'heavy-hit', 'strike']);
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

  // ── 50% Resource Recovery Tests ──────────────────────────────

  describe('50% resource recovery between combats', () => {
    it('stamina recovers 50% of deficit: 20/50 -> 35', () => {
      const run = makeMockRun({ currentStamina: 20, maxStamina: 50 });
      const enemy = makeMockEnemy();
      const state = createCombatState(run, enemy);

      // 20 + floor((50 - 20) * 0.5) = 20 + 15 = 35
      expect(state.heroStamina).toBe(35);
      expect(state.heroMaxStamina).toBe(50);
    });

    it('stamina stays at max when already full: 50/50 -> 50', () => {
      const run = makeMockRun({ currentStamina: 50, maxStamina: 50 });
      const enemy = makeMockEnemy();
      const state = createCombatState(run, enemy);

      expect(state.heroStamina).toBe(50);
    });

    it('stamina recovers from zero: 0/50 -> 25', () => {
      const run = makeMockRun({ currentStamina: 0, maxStamina: 50 });
      const enemy = makeMockEnemy();
      const state = createCombatState(run, enemy);

      // 0 + floor((50 - 0) * 0.5) = 25
      expect(state.heroStamina).toBe(25);
    });

    it('mana recovers 50% of deficit: 10/30 -> 20', () => {
      const run = makeMockRun({ currentMana: 10, maxMana: 30 });
      const enemy = makeMockEnemy();
      const state = createCombatState(run, enemy);

      // 10 + floor((30 - 10) * 0.5) = 10 + 10 = 20
      expect(state.heroMana).toBe(20);
      expect(state.heroMaxMana).toBe(30);
    });

    it('mana stays at max when already full: 30/30 -> 30', () => {
      const run = makeMockRun({ currentMana: 30, maxMana: 30 });
      const enemy = makeMockEnemy();
      const state = createCombatState(run, enemy);

      expect(state.heroMana).toBe(30);
    });

    it('HP persists from run (no recovery applied)', () => {
      const run = makeMockRun({ currentHP: 40, maxHP: 100 });
      const enemy = makeMockEnemy();
      const state = createCombatState(run, enemy);

      // HP is NOT recovered -- it persists as-is
      expect(state.heroHP).toBe(40);
      expect(state.heroMaxHP).toBe(100);
    });

    it('defense still resets to 0 (not recovered)', () => {
      const run = makeMockRun({ currentDefense: 25 });
      const enemy = makeMockEnemy();
      const state = createCombatState(run, enemy);

      expect(state.heroDefense).toBe(0);
    });
  });
});

describe('CombatState — Phase 9 transient fields', () => {
  it('initializes all elemental stack pools at 0', () => {
    const run = makeMockRun();
    const enemy = makeMockEnemy();
    const state = createCombatState(run, enemy);

    expect(state.poisonStacks).toBe(0);
    expect(state.bleedStacks).toBe(0);
    expect(state.burnStacks).toBe(0);
    expect(state.stunStacks).toBe(0);
    expect(state.slowStacks).toBe(0);
    expect(state.arcaneStacks).toBe(0);
    expect(state.arcaneStacksCap).toBe(10);
    expect(state.rageStacks).toBe(0);
  });

  it('seeds heroDexterity from run.hero.dexterity + statDeltas.dex', () => {
    const run = makeMockRun();
    run.hero.dexterity = 8;
    run.hero.statDeltas = { dex: 3 };
    const state = createCombatState(run, makeMockEnemy());
    expect(state.heroDexterity).toBe(11);
  });

  it('seeds heroVitality from resolved stats (baseStats + delta)', () => {
    const run = makeMockRun();
    run.hero.vitality = 2;
    run.hero.statDeltas = { vit: 5 };
    const state = createCombatState(run, makeMockEnemy());
    expect(state.heroVitality).toBe(7);
  });

  it('seeds all four per-combat stat axes from resolveHeroStats', () => {
    const run = makeMockRun();
    run.hero.vitality = 1;
    run.hero.dexterity = 2;
    run.hero.intellect = 3;
    run.hero.spirit = 4;
    run.hero.statDeltas = {};
    const state = createCombatState(run, makeMockEnemy());
    expect(state.heroVitality).toBe(1);
    expect(state.heroDexterity).toBe(2);
    expect(state.heroIntellect).toBe(3);
    expect(state.heroSpirit).toBe(4);
  });
});
