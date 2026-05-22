import { describe, it, expect } from 'vitest';
import { createCombatState } from '../../../src/systems/combat/CombatState';
import { applyHeroDamage } from '../../../src/systems/combat/EnemyAI';
import { CardResolver } from '../../../src/systems/combat/CardResolver';
import type { RunState } from '../../../src/state/RunState';
import type { CardDefinition, EnemyDefinition } from '../../../src/data/types';

// Minimal RunState factory mirroring tests/systems/combat/combat-state.test.ts.
function makeRun(relicIds: string[] = []): RunState {
  return {
    version: 3,
    runId: 'test-c1',
    seed: 'c1-seed',
    generation: 1,
    startedAt: Date.now(),
    hero: {
      maxHP: 100,
      currentHP: 100,
      maxStamina: 10,
      currentStamina: 10,
      maxMana: 10,
      currentMana: 10,
      currentDefense: 0,
      strength: 0,
      defenseMultiplier: 1,
      moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
    },
    deck: { active: ['t2-attack-attack'], inventory: {}, upgraded: [false], droppedCards: [] },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: relicIds,
    isInCombat: false,
    currentScene: 'Game',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
  };
}

function makeEnemy(): EnemyDefinition {
  return {
    id: 'dummy',
    name: 'Dummy',
    type: 'normal',
    baseHP: 100,
    baseDefense: 0,
    attack: { damage: 5, pattern: 'fixed' },
    attackCooldown: 2000,
    goldReward: { min: 1, max: 1 },
    color: 0x00ff00,
  };
}

function makeAttackCard(stamina = 1): CardDefinition {
  return {
    id: 'test-strike',
    name: 'Test Strike',
    description: '',
    category: 'attack',
    effects: [{ type: 'damage', value: 10, target: 'enemy' }],
    cost: { stamina },
    cooldown: 1,
    targeting: 'single',
    rarity: 'common',
  };
}

describe('Relics C1 — stat axis commons', () => {
  it('whetting_stone grants +1 STR', () => {
    const state = createCombatState(makeRun(['whetting_stone']), makeEnemy());
    expect(state.heroStrength).toBe(1);
  });

  it('iron_brace grants +1 VIT and +5 Max HP (VIT scaling)', () => {
    const baseline = createCombatState(makeRun([]), makeEnemy());
    const withRelic = createCombatState(makeRun(['iron_brace']), makeEnemy());
    expect(withRelic.heroVitality).toBe(baseline.heroVitality + 1);
    expect(withRelic.heroMaxHP).toBe(baseline.heroMaxHP + 5);
  });

  it('quick_boots grants +1 DEX', () => {
    const baseline = createCombatState(makeRun([]), makeEnemy());
    const withRelic = createCombatState(makeRun(['quick_boots']), makeEnemy());
    expect(withRelic.heroDexterity).toBe(baseline.heroDexterity + 1);
  });

  it('scholars_quill grants +1 INT', () => {
    const baseline = createCombatState(makeRun([]), makeEnemy());
    const withRelic = createCombatState(makeRun(['scholars_quill']), makeEnemy());
    expect(withRelic.heroIntellect).toBe(baseline.heroIntellect + 1);
  });

  it('soul_locket grants +1 SPI', () => {
    const baseline = createCombatState(makeRun([]), makeEnemy());
    const withRelic = createCombatState(makeRun(['soul_locket']), makeEnemy());
    expect(withRelic.heroSpirit).toBe(baseline.heroSpirit + 1);
  });

  it('bronze_scale grants +15 Max HP', () => {
    const baseline = createCombatState(makeRun([]), makeEnemy());
    const withRelic = createCombatState(makeRun(['bronze_scale']), makeEnemy());
    expect(withRelic.heroMaxHP).toBe(baseline.heroMaxHP + 15);
  });
});

describe('Relics C1 — combat_start_bundle', () => {
  it('bronze_pauldron grants +5 Armor and +1 Rage at combat start', () => {
    const state = createCombatState(makeRun(['bronze_pauldron']), makeEnemy());
    expect(state.heroDefense).toBe(5);
    expect(state.rageStacks).toBe(1);
  });

  it('the_last_banner grants +12 Armor, +5 Rage, +5 Stamina', () => {
    const state = createCombatState(makeRun(['the_last_banner']), makeEnemy());
    expect(state.heroDefense).toBe(12);
    expect(state.rageStacks).toBe(5);
    // Stamina is capped at maxStamina, but bundle should bump it up.
    expect(state.heroStamina).toBe(state.heroMaxStamina);
  });

  it('charm_of_tides grants +1 Mana and +1 Stamina', () => {
    const run = makeRun(['charm_of_tides']);
    run.hero.currentStamina = 5;
    run.hero.currentMana = 5;
    const state = createCombatState(run, makeEnemy());
    // Starting stamina = 5 + 50% of (10-5) = 7, then +1 from relic = 8.
    expect(state.heroStamina).toBe(8);
    expect(state.heroMana).toBe(8);
  });

  it('brass_bell applies 3 Bleed to enemy on combat start', () => {
    const state = createCombatState(makeRun(['brass_bell']), makeEnemy());
    expect(state.bleedStacks).toBe(3);
  });
});

describe('Relics C1 — cost overrides', () => {
  it('smoldering_torch makes the first card cost 0', () => {
    const state = createCombatState(makeRun(['smoldering_torch']), makeEnemy());
    expect(state.firstCardCostsZero).toBe(true);

    const resolver = new CardResolver();
    const card = makeAttackCard(3);
    const staminaBefore = state.heroStamina;
    resolver.resolve(card, state, null);
    // Free: stamina untouched and flag consumed.
    expect(state.heroStamina).toBe(staminaBefore);
    expect(state.firstCardCostsZero).toBe(false);
  });

  it('vanguard_cuffs discounts the first 3 cards by 1 Stamina', () => {
    const state = createCombatState(makeRun(['vanguard_cuffs']), makeEnemy());
    expect(state.firstNCardsStaminaDiscount).toBe(3);

    const resolver = new CardResolver();
    const card = makeAttackCard(1);
    const staminaBefore = state.heroStamina;
    resolver.resolve(card, state, null);
    // 1 cost - 1 discount = free.
    expect(state.heroStamina).toBe(staminaBefore);
    expect(state.firstNCardsStaminaDiscount).toBe(2);

    resolver.resolve(card, state, null);
    resolver.resolve(card, state, null);
    expect(state.firstNCardsStaminaDiscount).toBe(0);

    // Fourth card pays full cost.
    const beforeFourth = state.heroStamina;
    resolver.resolve(card, state, null);
    expect(state.heroStamina).toBe(beforeFourth - 1);
  });

  it('canAfford respects firstCardCostsZero even with empty stamina', () => {
    const run = makeRun(['smoldering_torch']);
    run.hero.currentStamina = 0;
    const state = createCombatState(run, makeEnemy());
    state.heroStamina = 0; // strip any combat-start refill

    const resolver = new CardResolver();
    const expensiveCard: CardDefinition = { ...makeAttackCard(5) };
    expect(resolver.canAfford(expensiveCard, state)).toBe(true);
  });
});

describe('Relics C1 — barrier', () => {
  it('apothecarys_vial fully blocks the next hit, then deactivates', () => {
    const state = createCombatState(makeRun(['apothecarys_vial']), makeEnemy());
    expect(state.barrierActive).toBe(true);

    const blocked = applyHeroDamage(20, state, true);
    expect(blocked).toBe(0);
    expect(state.heroHP).toBe(state.heroMaxHP);
    expect(state.barrierActive).toBe(false);

    // Next hit goes through.
    const next = applyHeroDamage(10, state, true);
    expect(next).toBe(10);
    expect(state.heroHP).toBe(state.heroMaxHP - 10);
  });
});

describe('Relics C1 — combat-start flag setup', () => {
  it('whetstone_shard sets firstAttackDamageBonus to 6', () => {
    const state = createCombatState(makeRun(['whetstone_shard']), makeEnemy());
    expect(state.firstAttackDamageBonus).toBe(6);
  });

  it('iron_tooth sets firstAttackDamageBonus to 5 and grants +3 Armor', () => {
    const state = createCombatState(makeRun(['iron_tooth']), makeEnemy());
    expect(state.firstAttackDamageBonus).toBe(5);
    expect(state.heroDefense).toBe(3);
  });

  it('ember_wick arms firstFireCardBurnBonus to 2', () => {
    const state = createCombatState(makeRun(['ember_wick']), makeEnemy());
    expect(state.firstFireCardBurnBonus).toBe(2);
  });
});
