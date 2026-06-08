import { describe, it, expect } from 'vitest';
import { resolveHeroStats } from '../../../src/systems/hero/HeroStatsResolver';
import type { RunState } from '../../../src/state/RunState';

// Regression guard for the `require is not defined` crash: classPassiveBonus
// used CommonJS require() to load the per-class passives JSON, which throws in
// Vite's ESM browser runtime. It only fired once totalXP > 0 (cross-run XP),
// so a fresh save masked it. These tests exercise that exact path for both
// classes via resolveHeroStats.

function makeRun(overrides?: { totalXP?: number; className?: string }): RunState {
  return {
    version: 6,
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
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
      runXP: 0,
      totalXP: overrides?.totalXP ?? 0,
      className: overrides?.className ?? 'warrior',
    },
    deck: { active: [], inventory: {}, upgraded: [], droppedCards: [] },
    loop: { count: 0, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [],
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
    isInCombat: false,
    currentScene: 'Game',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
  } as unknown as RunState;
}

describe('classPassiveBonus via resolveHeroStats', () => {
  it('does not throw when a warrior has cross-run XP (the require() regression)', () => {
    expect(() => resolveHeroStats(makeRun({ totalXP: 150, className: 'warrior' }))).not.toThrow();
  });

  it('does not throw when a mage has cross-run XP', () => {
    expect(() => resolveHeroStats(makeRun({ totalXP: 150, className: 'mage' }))).not.toThrow();
  });

  it('applies warrior Vigor (+10 maxHP) once totalXP reaches 100', () => {
    expect(resolveHeroStats(makeRun({ totalXP: 99, className: 'warrior' })).maxHP).toBe(100);
    expect(resolveHeroStats(makeRun({ totalXP: 150, className: 'warrior' })).maxHP).toBe(110);
  });

  it('applies warrior Endurance (+5 maxStamina) once totalXP reaches 250', () => {
    expect(resolveHeroStats(makeRun({ totalXP: 150, className: 'warrior' })).maxStamina).toBe(50);
    expect(resolveHeroStats(makeRun({ totalXP: 300, className: 'warrior' })).maxStamina).toBe(55);
  });

  it('applies mage Arcane Affinity (+8 maxMana) once totalXP reaches 100', () => {
    expect(resolveHeroStats(makeRun({ totalXP: 99, className: 'mage' })).maxMana).toBe(30);
    expect(resolveHeroStats(makeRun({ totalXP: 150, className: 'mage' })).maxMana).toBe(38);
  });
});
