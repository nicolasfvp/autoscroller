import { describe, it, expect } from 'vitest';
import { CardResolver } from '../../../src/systems/combat/CardResolver';
import { applyHeroDamage } from '../../../src/systems/combat/EnemyAI';
import {
  createAura,
  fireHpThresholdTriggers,
  applyTriggeredPayload,
} from '../../../src/systems/combat/StatusEffects';
import type { CombatState } from '../../../src/systems/combat/CombatState';
import type { CardDefinition, CardEffect } from '../../../src/data/types';

function makeState(over: Partial<CombatState> = {}): CombatState {
  return {
    heroHP: 100, heroMaxHP: 100,
    heroStamina: 50, heroMaxStamina: 50,
    heroMana: 30, heroMaxMana: 30,
    heroDefense: 0,
    heroStrength: 1,
    heroVitality: 0, heroDexterity: 0, heroIntellect: 0, heroSpirit: 0,
    heroDefenseMultiplier: 1,
    heroClass: 'warrior',
    deckOrder: [],
    enemyId: 'dummy', enemyName: 'Dummy', enemyType: 'normal',
    enemyHP: 200, enemyMaxHP: 200, enemyDefense: 0,
    enemyDamage: 5, enemyAttackCooldown: 2000, enemyBaseAttackCooldown: 2000,
    enemyPattern: 'fixed', enemySpecialEffect: null, enemyAffinity: null,
    activeRelicIds: [], activePassives: [],
    heroStunned: false, upgraded: [], behaviors: [],
    cooldownMultiplier: 1.0, firstCardDamageMultiplier: 1.0,
    _bloodPactBonus: 0, phoenixUsed: false,
    poisonStacks: 0, bleedStacks: 0, burnStacks: 0, stunStacks: 0,
    slowStacks: 0, arcaneStacks: 0, arcaneStacksCap: 10, rageStacks: 0,
    enemyAttackedSinceLastBleedTick: false, poisonTickParity: 0,
    nextCardCooldownReduction: 0,
    buffMagnitudePerCard: {},
    heroAuras: [], enemyAuras: [],
    heroBurnStacks: 0, heroBleedStacks: 0,
    ...over,
  } as CombatState;
}

function makeCard(effects: CardEffect[]): CardDefinition {
  return {
    id: 'test-card',
    name: 'Test',
    description: '',
    category: 'attack',
    effects,
    cooldown: 1.0,
    targeting: 'single',
    rarity: 'common',
    tier: 2,
  } as CardDefinition;
}

describe('Tier-2 new primitives', () => {
  describe('multi_hit', () => {
    it('applies damage value N+1 times when multi_hit:N', () => {
      const state = makeState({ enemyHP: 200, enemyDefense: 0 });
      const r = new CardResolver().resolve(
        makeCard([{ type: 'damage', value: 6, target: 'enemy', multi_hit: 2 }]),
        state, null, 1.0, false,
      );
      // 6 * 3 = 18 (3 hits because multi_hit:2 means 2 extra hits)
      expect(r.totalDamage).toBe(18);
      expect(state.enemyHP).toBe(200 - 18);
    });

    it('multi_hit re-applies pierce_armor on every hit', () => {
      const state = makeState({ enemyHP: 200, enemyDefense: 50 });
      const r = new CardResolver().resolve(
        makeCard([{ type: 'damage', value: 5, target: 'enemy', multi_hit: 1, pierce_armor: true }]),
        state, null, 1.0, false,
      );
      // pierce ignores armor; 5 * 2 = 10
      expect(r.totalDamage).toBe(10);
    });
  });

  describe('consume_stack', () => {
    it('removes up to |value| stacks from enemy pool', () => {
      const state = makeState({ enemyHP: 100, burnStacks: 7 });
      new CardResolver().resolve(
        makeCard([{ type: 'stack', value: -3, target: 'enemy', stack: 'burn', consume_stack: true }]),
        state, null, 1.0, false,
      );
      expect(state.burnStacks).toBe(4);
    });

    it('caps consume at current stack count (no negative pools)', () => {
      const state = makeState({ rageStacks: 2 });
      new CardResolver().resolve(
        makeCard([{ type: 'stack', value: -10, target: 'self', stack: 'rage', consume_stack: true }]),
        state, null, 1.0, false,
      );
      expect(state.rageStacks).toBe(0);
    });

    it('consume_stack:99 wipes the whole pool', () => {
      const state = makeState({ enemyHP: 100, burnStacks: 14 });
      new CardResolver().resolve(
        makeCard([{ type: 'stack', value: -99, target: 'enemy', stack: 'burn', consume_stack: true }]),
        state, null, 1.0, false,
      );
      expect(state.burnStacks).toBe(0);
    });
  });

  describe('scale.source:"armor"', () => {
    it('reads current hero armor as the scaling source', () => {
      const state = makeState({ heroDefense: 12, enemyDefense: 0, enemyHP: 200 });
      const r = new CardResolver().resolve(
        makeCard([{
          type: 'damage', value: 2, target: 'enemy', pierce_armor: true,
          scale: { stat: 'vit', per: 1, value: 1, source: 'armor' },
        }]),
        state, null, 1.0, false,
      );
      // resolvedValue = 2 + floor(12/1)*1 = 14; pierce → no armor subtraction
      expect(r.totalDamage).toBe(14);
    });

    it('falls back to stat scaling when source is omitted', () => {
      const state = makeState({ heroDefense: 50, heroStrength: 1, heroDexterity: 6, enemyHP: 200 });
      const r = new CardResolver().resolve(
        makeCard([{ type: 'damage', value: 4, target: 'enemy', scale: { stat: 'dex', per: 2, value: 1 } }]),
        state, null, 1.0, false,
      );
      // resolvedValue = 4 + floor(6/2)*1 = 7; no armor on enemy
      expect(r.totalDamage).toBe(7);
    });
  });

  describe('on_hp_pct_below trigger', () => {
    it('fires when hero HP crosses below threshold', () => {
      const state = makeState({ heroHP: 60, heroMaxHP: 100, enemyHP: 100 });
      const aura = createAura({
        type: 'aura', value: 0, target: 'self', ttl_ms: 15000,
        trigger: 'on_hp_pct_below', threshold: 50,
        then: { type: 'damage', value: 10, target: 'enemy' },
      });
      state.heroAuras.push(aura);
      // First check: hero still at 60% — should NOT fire.
      let payloads = fireHpThresholdTriggers(state.heroAuras, 60);
      expect(payloads).toHaveLength(0);
      expect(state.heroAuras).toHaveLength(1);
      // Hero drops to 40% — fires.
      payloads = fireHpThresholdTriggers(state.heroAuras, 40);
      expect(payloads).toHaveLength(1);
      expect(state.heroAuras).toHaveLength(0);
      // Apply the payload — enemy takes damage.
      applyTriggeredPayload(state, payloads[0]);
      expect(state.enemyHP).toBe(90);
    });

    it('does not fire again once consumed', () => {
      const state = makeState();
      const aura = createAura({
        type: 'aura', value: 0, target: 'self', ttl_ms: 15000,
        trigger: 'on_hp_pct_below', threshold: 50,
        then: { type: 'armor', value: 20, target: 'self' },
      });
      state.heroAuras.push(aura);
      fireHpThresholdTriggers(state.heroAuras, 30);
      const again = fireHpThresholdTriggers(state.heroAuras, 25);
      expect(again).toHaveLength(0);
    });
  });

  describe('integration: applyHeroDamage triggers on_hp_pct_below', () => {
    it('fires the aura when damage drops HP below threshold', () => {
      const state = makeState({ heroHP: 60, heroMaxHP: 100, heroDefense: 0, enemyHP: 100 });
      state.heroAuras.push(createAura({
        type: 'aura', value: 0, target: 'self', ttl_ms: 15000,
        trigger: 'on_hp_pct_below', threshold: 50,
        then: { type: 'damage', value: 12, target: 'enemy' },
      }));
      // Hero takes 20 damage → HP = 40 (40% < 50% threshold) → aura fires.
      applyHeroDamage(20, state, /*skipRelics=*/true);
      expect(state.heroHP).toBe(40);
      expect(state.heroAuras).toHaveLength(0);
      expect(state.enemyHP).toBe(88);
    });
  });
});
