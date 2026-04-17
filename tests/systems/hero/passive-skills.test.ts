import { describe, it, expect } from 'vitest';
import {
  resolvePassives,
  applyPassiveModifiers,
  checkConditionalTrigger,
} from '../../../src/systems/hero/PassiveSkillSystem';
import type { RunState, HeroState } from '../../../src/state/RunState';

function makeRun(totalXP: number): RunState {
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
      runXP: 0, totalXP,
      className: 'warrior',
    },
    deck: { active: [], inventory: {}, upgradedCards: [], droppedCards: [] },
    loop: { count: 0, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [],
    isInCombat: false,
    currentScene: 'Game',
  } as RunState;
}

function makeHero(): HeroState {
  return {
    maxHP: 100, currentHP: 100,
    maxStamina: 50, currentStamina: 50,
    maxMana: 30, currentMana: 30,
    currentDefense: 0, strength: 1,
    defenseMultiplier: 1, moveSpeed: 2,
    runXP: 0, totalXP: 0,
  };
}

describe('PassiveSkillSystem', () => {
  describe('resolvePassives', () => {
    it('with totalXP=0 returns empty array', () => {
      const run = makeRun(0);
      expect(resolvePassives(run)).toEqual([]);
    });

    it('with totalXP=100 returns 1 passive (vigor)', () => {
      const run = makeRun(100);
      const passives = resolvePassives(run);
      expect(passives).toHaveLength(1);
      expect(passives[0].id).toBe('vigor');
    });

    it('with totalXP=500 returns 3 passives (vigor, endurance, iron_body)', () => {
      const run = makeRun(500);
      const passives = resolvePassives(run);
      expect(passives).toHaveLength(3);
      expect(passives.map((p) => p.id)).toEqual(['vigor', 'endurance', 'iron_body']);
    });

    it('with totalXP=1000 returns all 5 passives', () => {
      const run = makeRun(1000);
      const passives = resolvePassives(run);
      expect(passives).toHaveLength(5);
      expect(passives.map((p) => p.id)).toEqual([
        'vigor', 'endurance', 'iron_body', 'battle_rage', 'second_wind',
      ]);
    });
  });

  describe('applyPassiveModifiers', () => {
    it('vigor adds 10 to maxHP', () => {
      const hero = makeHero();
      const passives = resolvePassives(makeRun(100));
      applyPassiveModifiers(hero, passives);
      expect(hero.maxHP).toBe(110);
    });

    it('iron_body adds 0.1 to defenseMultiplier', () => {
      const hero = makeHero();
      const passives = resolvePassives(makeRun(500)); // vigor, endurance, iron_body
      applyPassiveModifiers(hero, passives);
      expect(hero.defenseMultiplier).toBeCloseTo(1.1);
      expect(hero.maxHP).toBe(110); // vigor
      expect(hero.maxStamina).toBe(55); // endurance
    });
  });

  describe('checkConditionalTrigger', () => {
    it('consecutive_attacks_2 with consecutiveAttacks=2 returns damage bonus', () => {
      const passives = resolvePassives(makeRun(1000));
      const result = checkConditionalTrigger(
        'consecutive_attacks_2',
        { consecutiveAttacks: 2 },
        passives,
      );
      expect(result).toEqual({ type: 'damage_bonus_percent', value: 15, target: 'self' });
    });

    it('consecutive_attacks_2 with consecutiveAttacks=1 returns null', () => {
      const passives = resolvePassives(makeRun(1000));
      const result = checkConditionalTrigger(
        'consecutive_attacks_2',
        { consecutiveAttacks: 1 },
        passives,
      );
      expect(result).toBeNull();
    });

    it('deck_reshuffled returns stamina recovery', () => {
      const passives = resolvePassives(makeRun(1000));
      const result = checkConditionalTrigger(
        'deck_reshuffled',
        { deckReshuffled: true },
        passives,
      );
      expect(result).toEqual({ type: 'stamina', value: 5, target: 'self' });
    });
  });
});
