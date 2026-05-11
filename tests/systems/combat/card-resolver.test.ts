import { describe, it, expect } from 'vitest';
import { CardResolver } from '../../../src/systems/combat/CardResolver';
import type { CombatState } from '../../../src/systems/combat/CombatState';
import type { CardDefinition, SynergyDefinition } from '../../../src/data/types';

function makeState(overrides: Partial<CombatState> = {}): CombatState {
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
    comboPoints: 0, comboPointsCap: 5, stealthCharges: 0, stealthCap: 4, evadeNextHit: false,
    poisonStacks: 0, poisonDecayDisabled: false, bleedStacks: 0, burnStacks: 0,
    freezeStacks: 0, shockStacks: 0, arcaneStacks: 0, arcaneStacksCap: 10, rageStacks: 0,
    ...overrides,
  };
}

function makeCard(overrides: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id: 'strike', name: 'Strike', description: 'Deal 10 damage.',
    category: 'attack',
    effects: [{ type: 'damage', value: 10, target: 'enemy' }],
    cooldown: 1.2, targeting: 'single', rarity: 'common',
    ...overrides,
  };
}

describe('CardResolver', () => {
  const resolver = new CardResolver();

  describe('canAfford', () => {
    it('returns true for a card with no cost', () => {
      const state = makeState();
      const card = makeCard(); // strike has no cost
      expect(resolver.canAfford(card, state)).toBe(true);
    });

    it('returns true when stamina >= cost.stamina', () => {
      const state = makeState({ heroStamina: 10 });
      const card = makeCard({ cost: { stamina: 5 } });
      expect(resolver.canAfford(card, state)).toBe(true);
    });

    it('returns false when stamina < cost.stamina', () => {
      const state = makeState({ heroStamina: 3 });
      const card = makeCard({ cost: { stamina: 5 } });
      expect(resolver.canAfford(card, state)).toBe(false);
    });

    it('returns false when mana < cost.mana', () => {
      const state = makeState({ heroMana: 2 });
      const card = makeCard({ cost: { mana: 5 } });
      expect(resolver.canAfford(card, state)).toBe(false);
    });

    it('returns false when defense < cost.defense', () => {
      const state = makeState({ heroDefense: 5 });
      const card = makeCard({ cost: { defense: 10 } });
      expect(resolver.canAfford(card, state)).toBe(false);
    });

    it('checks all cost components together', () => {
      const state = makeState({ heroStamina: 20, heroDefense: 10 });
      const card = makeCard({ cost: { stamina: 15, defense: 5 } });
      expect(resolver.canAfford(card, state)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('resolve("strike") deals 10 damage to enemy, costs nothing', () => {
      const state = makeState();
      const card = makeCard(); // strike: 10 damage, no cost
      const result = resolver.resolve(card, state, null);

      expect(result.totalDamage).toBe(10);
      expect(state.enemyHP).toBe(90);
      expect(state.heroStamina).toBe(50); // unchanged
    });

    it('resolve("heavy-hit") deals 20 damage, costs 5 stamina', () => {
      const state = makeState();
      const card = makeCard({
        id: 'heavy-hit',
        effects: [{ type: 'damage', value: 20, target: 'enemy' }],
        cost: { stamina: 5 },
      });
      const result = resolver.resolve(card, state, null);

      expect(result.totalDamage).toBe(20);
      expect(state.enemyHP).toBe(80);
      expect(state.heroStamina).toBe(45);
    });

    it('resolve("fireball") deals 15 damage, costs 5 mana', () => {
      const state = makeState();
      const card = makeCard({
        id: 'fireball',
        effects: [{ type: 'damage', value: 15, target: 'enemy' }],
        cost: { mana: 5 },
      });
      const result = resolver.resolve(card, state, null);

      expect(result.totalDamage).toBe(15);
      expect(state.enemyHP).toBe(85);
      expect(state.heroMana).toBe(25);
    });

    it('damage accounts for hero strength', () => {
      const state = makeState({ heroStrength: 2 });
      const card = makeCard(); // 10 damage * 2 strength = 20
      const result = resolver.resolve(card, state, null);

      expect(result.totalDamage).toBe(20);
      expect(state.enemyHP).toBe(80);
    });

    it('damage reduced by enemy defense (minimum 1 for damage cards)', () => {
      const state = makeState({ enemyDefense: 15 });
      const card = makeCard(); // 10 * 1 - 15 = clamped to 1 (B.5 floor)
      const result = resolver.resolve(card, state, null);

      expect(result.totalDamage).toBe(1);
      expect(state.enemyHP).toBe(99);
    });

    it('heal card restores HP capped at max', () => {
      const state = makeState({ heroHP: 90, heroMaxHP: 100 });
      const card = makeCard({
        id: 'heal',
        effects: [{ type: 'heal', value: 15, target: 'self' }],
        cost: { mana: 8 },
      });
      const result = resolver.resolve(card, state, null);

      expect(result.healed).toBe(10); // capped: 90+15=105 -> 100, healed=10
      expect(state.heroHP).toBe(100);
    });

    it('armor card adds to heroDefense', () => {
      const state = makeState();
      const card = makeCard({
        id: 'defend',
        effects: [{ type: 'armor', value: 5, target: 'self' }],
      });
      const result = resolver.resolve(card, state, null);

      expect(result.armorGained).toBe(5);
      expect(state.heroDefense).toBe(5);
    });

    it('resolve with synergy bonus adds bonus damage on top', () => {
      const state = makeState();
      const card = makeCard(); // 10 damage
      const synergy: SynergyDefinition = {
        cardA: 'defend', cardB: 'strike',
        bonus: { type: 'damage', value: 8, target: 'enemy' },
        displayName: 'Counter Attack!',
      };
      const result = resolver.resolve(card, state, synergy);

      // 10 base + 8 synergy = 18
      expect(result.totalDamage).toBe(18);
      expect(state.enemyHP).toBe(82);
    });

    it('resolve with synergy bonus adds armor bonus', () => {
      const state = makeState();
      const card = makeCard({
        id: 'arcane-shield',
        effects: [{ type: 'armor', value: 10, target: 'self' }],
        cost: { mana: 6 },
      });
      const synergy: SynergyDefinition = {
        cardA: 'mana-drain', cardB: 'arcane-shield',
        bonus: { type: 'armor', value: 5, target: 'self' },
        displayName: 'Arcane Conversion!',
      };
      const result = resolver.resolve(card, state, synergy);

      expect(result.armorGained).toBe(15); // 10 + 5
      expect(state.heroDefense).toBe(15);
    });

    it('debuff effect reduces enemy defense', () => {
      const state = makeState({ enemyDefense: 10 });
      const card = makeCard({
        id: 'weaken',
        effects: [
          { type: 'damage', value: 5, target: 'enemy' },
          { type: 'debuff', value: 5, target: 'enemy' },
        ],
        cost: { mana: 7 },
      });
      resolver.resolve(card, state, null);

      // damage: 5*1 - 10 defense = 0 (clamped), then debuff: 10 - 5 = 5
      expect(state.enemyDefense).toBe(5);
    });

    it('stamina effect restores stamina capped at max', () => {
      const state = makeState({ heroStamina: 45, heroMaxStamina: 50 });
      const card = makeCard({
        id: 'rejuvenate',
        effects: [{ type: 'stamina', value: 10, target: 'self' }],
        cost: { mana: 5 },
      });
      resolver.resolve(card, state, null);

      expect(state.heroStamina).toBe(50); // capped at max
    });

    it('mana effect restores mana capped at max', () => {
      const state = makeState({ heroMana: 28, heroMaxMana: 30 });
      const card = makeCard({
        id: 'mana-drain',
        effects: [
          { type: 'damage', value: 8, target: 'enemy' },
          { type: 'mana', value: 5, target: 'self' },
        ],
      });
      resolver.resolve(card, state, null);

      expect(state.heroMana).toBe(30); // capped at max
    });
  });

  describe('upgrade resolution', () => {
    it('uses upgraded effects when isUpgraded=true', () => {
      const state = makeState();
      const card = makeCard({
        id: 'strike',
        effects: [{ type: 'damage', value: 10, target: 'enemy' }],
        upgraded: {
          effects: [{ type: 'damage', value: 15, target: 'enemy' }],
        },
      });
      const result = resolver.resolve(card, state, null, 1.0, true);
      expect(result.totalDamage).toBe(15);
      expect(state.enemyHP).toBe(85);
    });

    it('uses base effects when isUpgraded=false', () => {
      const state = makeState();
      const card = makeCard({
        id: 'strike',
        effects: [{ type: 'damage', value: 10, target: 'enemy' }],
        upgraded: {
          effects: [{ type: 'damage', value: 15, target: 'enemy' }],
        },
      });
      const result = resolver.resolve(card, state, null, 1.0, false);
      expect(result.totalDamage).toBe(10);
      expect(state.enemyHP).toBe(90);
    });

    it('uses upgraded cost when isUpgraded=true', () => {
      const state = makeState({ heroMana: 30 });
      const card = makeCard({
        id: 'fireball',
        effects: [{ type: 'damage', value: 15, target: 'enemy' }],
        cost: { mana: 5 },
        upgraded: {
          cost: { mana: 3 },
        },
      });
      resolver.resolve(card, state, null, 1.0, true);
      expect(state.heroMana).toBe(27); // 30 - 3 (upgraded cost)
    });

    it('uses base cost when isUpgraded=false', () => {
      const state = makeState({ heroMana: 30 });
      const card = makeCard({
        id: 'fireball',
        effects: [{ type: 'damage', value: 15, target: 'enemy' }],
        cost: { mana: 5 },
        upgraded: {
          cost: { mana: 3 },
        },
      });
      resolver.resolve(card, state, null, 1.0, false);
      expect(state.heroMana).toBe(25); // 30 - 5 (base cost)
    });

    it('canAfford uses upgraded cost when isUpgraded=true', () => {
      const state = makeState({ heroMana: 4 });
      const card = makeCard({
        id: 'fireball',
        cost: { mana: 5 },
        upgraded: { cost: { mana: 3 } },
      });
      // base cost 5 > mana 4, but upgraded cost 3 <= mana 4
      expect(resolver.canAfford(card, state, true)).toBe(true);
    });
  });
});
