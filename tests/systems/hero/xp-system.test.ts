import { describe, it, expect } from 'vitest';
import {
  getXPForEnemy,
  earnXP,
  bankXP,
  loseAllRunXP,
} from '../../../src/systems/hero/XPSystem';
import type { RunState } from '../../../src/state/RunState';

function makeRun(overrides?: { runXP?: number; totalXP?: number }): RunState {
  return {
    runId: 'test',
    generation: 1,
    startedAt: 0,
    hero: {
      maxHP: 100, currentHP: 100,
      maxStamina: 50, currentStamina: 50,
      maxMana: 30, currentMana: 30,
      currentDefense: 0, strength: 1,
      defenseMultiplier: 1, moveSpeed: 2,
      runXP: overrides?.runXP ?? 0,
      totalXP: overrides?.totalXP ?? 0,
    },
    deck: { active: [], inventory: {} },
    loop: { count: 0, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [],
    isInCombat: false,
    currentScene: 'Game',
  } as RunState;
}

describe('XPSystem', () => {
  describe('getXPForEnemy', () => {
    it('normal returns 10', () => {
      expect(getXPForEnemy('normal')).toBe(10);
    });

    it('elite returns 30', () => {
      expect(getXPForEnemy('elite')).toBe(30);
    });

    it('boss returns 80', () => {
      expect(getXPForEnemy('boss')).toBe(80);
    });
  });

  describe('earnXP', () => {
    it('adds amount to run.hero.runXP', () => {
      const run = makeRun({ runXP: 5 });
      earnXP(run, 10);
      expect(run.hero.runXP).toBe(15);
    });

    it('works from zero', () => {
      const run = makeRun();
      earnXP(run, 10);
      expect(run.hero.runXP).toBe(10);
    });
  });

  describe('bankXP', () => {
    it('adds runXP to totalXP and resets runXP to 0', () => {
      const run = makeRun({ runXP: 50, totalXP: 100 });
      bankXP(run);
      expect(run.hero.totalXP).toBe(150);
      expect(run.hero.runXP).toBe(0);
    });
  });

  describe('loseAllRunXP', () => {
    it('sets runXP to 0 without changing totalXP', () => {
      const run = makeRun({ runXP: 50, totalXP: 100 });
      loseAllRunXP(run);
      expect(run.hero.runXP).toBe(0);
      expect(run.hero.totalXP).toBe(100);
    });
  });
});
