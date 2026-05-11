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
    heroClass: 'shadowblade',
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
    comboPoints: 0, comboPointsCap: 5, stealthCharges: 0, stealthCap: 4, evadeNextHit: false,
    poisonStacks: 0, poisonDecayDisabled: false, bleedStacks: 0, burnStacks: 0,
    freezeStacks: 0, shockStacks: 0, arcaneStacks: 0, arcaneStacksCap: 10, rageStacks: 0,
    nextCardCooldownReduction: 0,
    ...overrides,
  };
}

describe('SynergySystem', () => {
  const system = new SynergySystem();

  it('check("defend","strike") returns Counter Attack synergy for warrior class', () => {
    const result = system.check('defend', 'strike', 'warrior');
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe('Counter Attack!');
    expect(result!.bonus.type).toBe('damage');
    expect(result!.bonus.value).toBe(15);
  });

  it('check("defend","strike") returns null for non-warrior class (class-restricted)', () => {
    const result = system.check('defend', 'strike', 'mage');
    expect(result).toBeNull();
  });

  it('check("heal","fireball") returns Channeled Fire for any class', () => {
    const result = system.check('heal', 'fireball', 'warrior');
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe('Channeled Fire!');

    const result2 = system.check('heal', 'fireball', 'mage');
    expect(result2).not.toBeNull();
    expect(result2!.displayName).toBe('Channeled Fire!');
  });

  it('check("strike","defend") returns null (order matters)', () => {
    const result = system.check('strike', 'defend', 'warrior');
    expect(result).toBeNull();
  });

  it('check("strike","strike") returns null (not a defined pair)', () => {
    const result = system.check('strike', 'strike', 'warrior');
    expect(result).toBeNull();
  });

  it('check("heavy-hit","heavy-hit") returns Berserker Rage for warrior', () => {
    const result = system.check('heavy-hit', 'heavy-hit', 'warrior');
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe('Berserker Rage!');
    expect(result!.bonus.value).toBe(40);
  });

  it('returns null when lastPlayedCardId is null', () => {
    const result = system.check(null, 'strike', 'warrior');
    expect(result).toBeNull();
  });

  it('check("mana-drain","arcane-shield") returns Arcane Conversion for any class', () => {
    const result = system.check('mana-drain', 'arcane-shield', 'warrior');
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe('Arcane Conversion!');
    expect(result!.bonus.type).toBe('armor');
    expect(result!.bonus.value).toBe(12);
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
