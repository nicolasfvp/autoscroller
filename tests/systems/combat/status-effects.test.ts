import { describe, it, expect } from 'vitest';
import {
  createAura,
  tickAuras,
  sumModifier,
  fireTrigger,
  applyTriggeredPayload,
  getCdReductionFactor,
} from '../../../src/systems/combat/StatusEffects';
import type { CardEffect } from '../../../src/data/types';
import type { CombatState } from '../../../src/systems/combat/CombatState';

function makeMinState(overrides: Partial<CombatState> = {}): CombatState {
  // Minimal state shape — only the fields applyTriggeredPayload touches.
  return {
    enemyHP: 100,
    enemyMaxHP: 100,
    enemyDefense: 5,
    enemyAuras: [],
    heroHP: 100,
    heroMaxHP: 100,
    heroDefense: 0,
    heroStrength: 1,
    heroVitality: 0,
    heroDexterity: 0,
    heroIntellect: 0,
    heroSpirit: 0,
    heroAuras: [],
    poisonStacks: 0,
    bleedStacks: 0,
    burnStacks: 0,
    stunStacks: 0,
    slowStacks: 0,
    enemyAttackedSinceLastBleedTick: false,
    poisonTickParity: 0,
    arcaneStacks: 0,
    arcaneStacksCap: 10,
    rageStacks: 0,
    heroBurnStacks: 0,
    heroBleedStacks: 0,
    ...overrides,
  } as unknown as CombatState;
}

describe('StatusEffects', () => {
  describe('createAura', () => {
    it('defaults ttl to 5000ms when not provided', () => {
      const a = createAura({ type: 'aura', value: 0, target: 'self' });
      expect(a.remainingMs).toBe(5000);
    });

    it('carries modifier and trigger from source effect', () => {
      const effect: CardEffect = {
        type: 'aura', value: 0, target: 'self',
        ttl_ms: 6000,
        modifier: { kind: 'dex', value: 2 },
      };
      const a = createAura(effect);
      expect(a.remainingMs).toBe(6000);
      expect(a.modifier?.kind).toBe('dex');
      expect(a.modifier?.value).toBe(2);
    });
  });

  describe('tickAuras', () => {
    it('decays remainingMs by deltaMs and prunes expired entries', () => {
      const auras = [createAura({ type: 'aura', value: 0, target: 'self', ttl_ms: 1000 })];
      tickAuras(auras, 400);
      expect(auras).toHaveLength(1);
      expect(auras[0].remainingMs).toBe(600);
      tickAuras(auras, 700);
      expect(auras).toHaveLength(0);
    });

    it('handles undefined/null aura arrays safely', () => {
      expect(() => tickAuras(undefined, 100)).not.toThrow();
      expect(() => tickAuras(null, 100)).not.toThrow();
    });
  });

  describe('sumModifier', () => {
    it('sums modifier values across auras matching the kind', () => {
      const auras = [
        createAura({ type: 'aura', value: 0, target: 'self', modifier: { kind: 'dex', value: 2 } }),
        createAura({ type: 'aura', value: 0, target: 'self', modifier: { kind: 'dex', value: 3 } }),
        createAura({ type: 'aura', value: 0, target: 'self', modifier: { kind: 'vit', value: 1 } }),
      ];
      expect(sumModifier(auras, 'dex')).toBe(5);
      expect(sumModifier(auras, 'vit')).toBe(1);
      expect(sumModifier(auras, 'str')).toBe(0);
    });

    it('returns 0 for null/undefined input', () => {
      expect(sumModifier(undefined, 'dex')).toBe(0);
      expect(sumModifier(null, 'dex')).toBe(0);
    });
  });

  describe('getCdReductionFactor', () => {
    it('returns 1.0 when no auras present', () => {
      expect(getCdReductionFactor([])).toBe(1.0);
    });

    it('applies a single sub-30% reduction at face value', () => {
      const auras = [createAura({ type: 'aura', value: 0, target: 'self', modifier: { kind: 'cd_reduction', value: 0.25 } })];
      expect(getCdReductionFactor(auras)).toBeCloseTo(0.75, 5);
    });

    it('halves reductions above the 30% soft cap (diminishing returns)', () => {
      // 0.25 + 0.25 = 0.50 raw -> 0.30 + (0.20 * 0.5) = 0.40 effective -> factor 0.60
      const auras = [
        createAura({ type: 'aura', value: 0, target: 'self', modifier: { kind: 'cd_reduction', value: 0.25 } }),
        createAura({ type: 'aura', value: 0, target: 'self', modifier: { kind: 'cd_reduction', value: 0.25 } }),
      ];
      expect(getCdReductionFactor(auras)).toBeCloseTo(0.60, 5);
    });

    it('hard caps at 60% reduction (floor 0.40)', () => {
      // 1.0 raw -> 0.30 + 0.70*0.5 = 0.65 -> hard cap 0.60 -> factor 0.40
      const auras = [createAura({ type: 'aura', value: 0, target: 'self', modifier: { kind: 'cd_reduction', value: 1.0 } })];
      expect(getCdReductionFactor(auras)).toBeCloseTo(0.40, 5);
    });
  });

  describe('fireTrigger', () => {
    it('fires matching triggered auras and removes them from the list', () => {
      const auras = [
        createAura({
          type: 'aura', value: 0, target: 'self', ttl_ms: 10000,
          trigger: 'on_armor_break',
          then: { type: 'damage', value: 4, target: 'enemy' },
        }),
        createAura({ type: 'aura', value: 0, target: 'self', modifier: { kind: 'dex', value: 1 } }),
      ];
      const fired = fireTrigger(auras, 'on_armor_break');
      expect(fired).toHaveLength(1);
      expect(fired[0].type).toBe('damage');
      // Triggered aura removed; modifier aura still present.
      expect(auras).toHaveLength(1);
      expect(auras[0].modifier?.kind).toBe('dex');
    });
  });

  describe('applyTriggeredPayload', () => {
    it('damage payload subtracts enemy defense and updates enemyHP', () => {
      const state = makeMinState({ enemyHP: 100, enemyDefense: 3, heroStrength: 1 });
      const payload: CardEffect = { type: 'damage', value: 10, target: 'enemy' };
      const r = applyTriggeredPayload(state, payload);
      expect(state.enemyHP).toBe(93); // 10 - 3 def = 7
      expect(r.totalDamage).toBe(7);
    });

    it('pierce_armor damage skips enemy defense', () => {
      const state = makeMinState({ enemyHP: 100, enemyDefense: 8, heroStrength: 1 });
      const payload: CardEffect = { type: 'damage', value: 10, target: 'enemy', pierce_armor: true };
      applyTriggeredPayload(state, payload);
      expect(state.enemyHP).toBe(90);
    });

    it('scale.stat="rage" reads rageStacks for the multiplier', () => {
      const state = makeMinState({ enemyHP: 100, enemyDefense: 0, heroStrength: 1, rageStacks: 4 });
      const payload: CardEffect = {
        type: 'damage', value: 6, target: 'enemy',
        scale: { stat: 'rage' as any, per: 1, value: 1 },
      };
      applyTriggeredPayload(state, payload);
      // 6 + floor(4/1)*1 = 10 damage; no enemy def.
      expect(state.enemyHP).toBe(90);
    });

    it('dot payload adds to the named enemy stack pool', () => {
      const state = makeMinState({ poisonStacks: 0 });
      const payload: CardEffect = { type: 'dot', value: 3, target: 'enemy', stack: 'poison' };
      applyTriggeredPayload(state, payload);
      expect(state.poisonStacks).toBe(3);
    });
  });
});
