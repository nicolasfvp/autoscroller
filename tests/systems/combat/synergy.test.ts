import { describe, it, expect } from 'vitest';
import { SynergySystem, applyDirectSynergyBonus } from '../../../src/systems/combat/SynergySystem';
import type { SynergyDefinition } from '../../../src/data/types';
import type { CombatState } from '../../../src/systems/combat/CombatState';

function makeMinimalState(overrides: Partial<CombatState> = {}): CombatState {
  return {
    heroHP: 100, heroMaxHP: 100,
    heroStamina: 50, heroMaxStamina: 50,
    heroMana: 30, heroMaxMana: 30,
    heroDefense: 0,
    heroStrength: 1, heroDefenseMultiplier: 1,
    heroClass: 'warrior',
    deckOrder: [],
    enemyId: 'slime', enemyName: 'Slime',
    enemyHP: 100, enemyMaxHP: 100,
    enemyDefense: 0, enemyDamage: 8,
    enemyAttackCooldown: 2500,
    enemyPattern: 'fixed',
    enemySpecialEffect: null,
    activePassives: [],
    heroStunned: false,
    upgraded: [],
    activeRelicIds: [],
    behaviors: [],
    cooldownMultiplier: 1.0,
    firstCardDamageMultiplier: 1.0,
    _bloodPactBonus: 0,
    phoenixUsed: false,
    heroVitality: 0, heroDexterity: 0, heroIntellect: 0, heroSpirit: 0,
    poisonStacks: 0, bleedStacks: 0, burnStacks: 0,
    freezeStacks: 0, shockStacks: 0, arcaneStacks: 0, arcaneStacksCap: 10, rageStacks: 0,
    nextCardCooldownReduction: 0,
    ...overrides,
  };
}

describe('SynergySystem', () => {
  const system = new SynergySystem();

  it('returns null for an undefined card pair (order matters / non-existent IDs)', () => {
    expect(system.check('strike', 'defend', 'warrior')).toBeNull();
    expect(system.check('strike', 'strike', 'warrior')).toBeNull();
  });

  it('returns null when lastPlayedCardId is null', () => {
    const result = system.check(null, 'strike', 'warrior');
    expect(result).toBeNull();
  });
});

describe('Phase 9 — v2 SynergyDefinition.bonus types (Task 5)', () => {
  it('applyDirectSynergyBonus with bonus.type=cooldown_reduction adds to nextCardCooldownReduction', () => {
    const state = makeMinimalState();
    const synergy: SynergyDefinition = {
      cardA: 'a', cardB: 'b',
      bonus: { type: 'cooldown_reduction', value: 0.5, target: 'self' },
      displayName: 'Quick Step!',
    };
    applyDirectSynergyBonus(synergy, state);
    expect(state.nextCardCooldownReduction).toBe(0.5);
  });

  it('applyDirectSynergyBonus accumulates multiple cooldown_reduction calls', () => {
    const state = makeMinimalState();
    const synergyA: SynergyDefinition = {
      cardA: 'a', cardB: 'b',
      bonus: { type: 'cooldown_reduction', value: 0.3, target: 'self' },
      displayName: 'A',
    };
    const synergyB: SynergyDefinition = {
      cardA: 'c', cardB: 'd',
      bonus: { type: 'cooldown_reduction', value: 0.2, target: 'self' },
      displayName: 'B',
    };
    applyDirectSynergyBonus(synergyA, state);
    applyDirectSynergyBonus(synergyB, state);
    expect(state.nextCardCooldownReduction).toBeCloseTo(0.5);
  });

  it('applyDirectSynergyBonus is a no-op for non-cooldown_reduction bonus types', () => {
    const state = makeMinimalState();
    const synergy: SynergyDefinition = {
      cardA: 'a', cardB: 'b',
      bonus: { type: 'damage', value: 5, target: 'enemy' },
      displayName: 'X',
    };
    applyDirectSynergyBonus(synergy, state);
    expect(state.nextCardCooldownReduction).toBe(0);
  });
});
