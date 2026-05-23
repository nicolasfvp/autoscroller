import { describe, it, expect, vi } from 'vitest';
import { createCombatState } from '../../../src/systems/combat/CombatState';
import { applyHeroDamage } from '../../../src/systems/combat/EnemyAI';
import type { RunState } from '../../../src/state/RunState';
import type { EnemyDefinition } from '../../../src/data/types';

function makeRun(relicIds: string[] = []): RunState {
  return {
    version: 3, runId: 'test-c3', seed: 'c3', generation: 1, startedAt: Date.now(),
    hero: {
      maxHP: 100, currentHP: 100,
      maxStamina: 10, currentStamina: 10,
      maxMana: 10, currentMana: 10,
      currentDefense: 0, strength: 0, defenseMultiplier: 1, moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
    },
    deck: { active: ['t2-attack-attack'], inventory: {}, upgraded: [false], droppedCards: [] },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: relicIds, isInCombat: false, currentScene: 'Game',
    stopAtShop: true, combatSpeed: 1, mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
  };
}

function makeEnemy(): EnemyDefinition {
  return {
    id: 'dummy', name: 'D', type: 'normal', baseHP: 100, baseDefense: 0,
    attack: { damage: 5, pattern: 'fixed' }, attackCooldown: 2000,
    goldReward: { min: 1, max: 1 }, color: 0x00ff00,
  };
}

describe('Relics C3 — damage_taken triggers', () => {
  it('iron_will grants +3 Armor per hit, capped at +15/combat', () => {
    const state = createCombatState(makeRun(['iron_will']), makeEnemy());
    for (let i = 0; i < 10; i++) {
      state.heroDefense = 0;
      applyHeroDamage(2, state);
    }
    // Iron Will cap is 15; we shouldn't exceed it across the combat.
    const counter = state.relicCounters['iron_will_armorGained'] ?? 0;
    expect(counter).toBe(15);
  });

  it('counterweight_sigil flags next card free on hit', () => {
    const state = createCombatState(makeRun(['counterweight_sigil']), makeEnemy());
    expect(state.firstCardCostsZero).toBe(false);
    applyHeroDamage(5, state);
    expect(state.firstCardCostsZero).toBe(true);
  });

  it('tarnished_mirror refunds Stamina or Mana with 25% chance', () => {
    const state = createCombatState(makeRun(['tarnished_mirror']), makeEnemy());
    state.heroStamina = 0;
    state.heroMana = 0;
    const rng = vi.spyOn(Math, 'random');
    // First call decides whether to refund; second decides stamina vs mana.
    // 0.1 < 25% → refund; 0.4 < 0.5 → stamina.
    rng.mockReturnValueOnce(0.1).mockReturnValueOnce(0.4);
    applyHeroDamage(5, state);
    expect(state.heroStamina + state.heroMana).toBe(1);
    rng.mockRestore();
  });

  it('tarnished_mirror does nothing on the 75% miss', () => {
    const state = createCombatState(makeRun(['tarnished_mirror']), makeEnemy());
    state.heroStamina = 0;
    state.heroMana = 0;
    const rng = vi.spyOn(Math, 'random');
    rng.mockReturnValueOnce(0.9); // miss
    applyHeroDamage(5, state);
    expect(state.heroStamina).toBe(0);
    expect(state.heroMana).toBe(0);
    rng.mockRestore();
  });

  it('banded_greaves grants armor from prevented damage + 1 Rage', () => {
    const state = createCombatState(makeRun(['banded_greaves']), makeEnemy());
    state.heroDefense = 20;
    state.rageStacks = 0;
    applyHeroDamage(8, state);
    // 8 damage absorbed by armor; 25% of 8 = 2 armor gained.
    // Armor went 20 → 12, +2 from relic = 14.
    expect(state.heroDefense).toBe(14);
    expect(state.rageStacks).toBe(1);
  });

  it('banded_greaves caps armor gain at 12/combat', () => {
    const state = createCombatState(makeRun(['banded_greaves']), makeEnemy());
    state.heroDefense = 1000;
    state.rageStacks = 0;
    // Burn through 60 damage prevented in chunks to exceed cap.
    for (let i = 0; i < 5; i++) applyHeroDamage(12, state);
    const counter = state.relicCounters['banded_greaves_armorGained'] ?? 0;
    expect(counter).toBe(12);
  });

  it('mana_shield spends Mana 1:1 to heal HP after a hit', () => {
    const state = createCombatState(makeRun(['mana_veil']), makeEnemy());
    state.heroDefense = 0;
    state.heroMana = 10;
    state.heroMaxMana = 20;
    state.heroHP = 50;
    applyHeroDamage(8, state);
    // Hit deals 8 HP damage (no armor) → HP 42. Mana spends min(6, 10, 8) = 6 → HP 48, Mana 4.
    expect(state.heroHP).toBe(48);
    expect(state.heroMana).toBe(4);
  });
});

describe('Relics C3 — Brace triggers', () => {
  it('battered_vambrace grants +3 Armor and +2 Rage on armor break', () => {
    const state = createCombatState(makeRun(['battered_vambrace']), makeEnemy());
    state.heroDefense = 5;
    state.rageStacks = 0;
    // Hit of 5 reduces armor to 0 → brace fires.
    applyHeroDamage(5, state);
    expect(state.heroDefense).toBe(3); // 0 + 3
    expect(state.rageStacks).toBe(2);
  });

  it('battered_vambrace does NOT fire when armor merely chipped (no break)', () => {
    const state = createCombatState(makeRun(['battered_vambrace']), makeEnemy());
    state.heroDefense = 10;
    state.rageStacks = 0;
    applyHeroDamage(3, state);
    expect(state.heroDefense).toBe(7); // no brace bonus
    expect(state.rageStacks).toBe(0);
  });

  it('smoking_censer applies 4 Burn on armor break', () => {
    const state = createCombatState(makeRun(['smoking_censer']), makeEnemy());
    state.heroDefense = 6;
    state.burnStacks = 0;
    applyHeroDamage(6, state);
    expect(state.burnStacks).toBe(4);
  });
});

describe('Relics C3 — Cracked Crystal', () => {
  it('takes 6 self-damage and grants +3 STR / +3 INT at combat start', () => {
    const state = createCombatState(makeRun(['cracked_crystal']), makeEnemy());
    expect(state.heroHP).toBe(state.heroMaxHP - 6);
    expect(state.heroStrength).toBe(3);
    expect(state.heroIntellect).toBe(3);
  });
});
