// Enemy elemental affinity — applies a secondary effect on each attack.
// See docs/CARDS_SYSTEM.md §16 for the spec.

import type { CombatState } from './CombatState';
import type { ElementId } from '../ElementSystem';
import { rand } from '../SharedRNG';

export interface AffinityResult {
  /** Short kind tag (e.g. 'enemy_armor_up', 'hero_burn') for HUD feedback. */
  type: string;
  /** Magnitude shown next to the icon — meaning depends on `type`. */
  value: number;
}

/**
 * Apply the affinity-flavored secondary effect after the enemy lands an attack.
 * Effects are *additive* to base damage and stack across attacks. Boss
 * variants use a 2x multiplier so each tick of affinity bites harder.
 *
 * Effects are immediate (no DoT state added) so the existing CombatState
 * doesn't need new pools — keeps the data model lean.
 */
export function applyEnemyAffinityEffect(
  state: CombatState,
  affinity: ElementId,
  isBoss: boolean,
): AffinityResult | null {
  const m = isBoss ? 2 : 1;

  switch (affinity) {
    case 'attack':
      // Pure damage identity: bonus damage on the attack itself (already in base).
      // No secondary effect needed; the enemy's base damage is the budget.
      return null;

    case 'defense': {
      // Stoic / armor-stacking: enemy gains armor each turn.
      // Capped to prevent runaway stacking across long fights.
      const gain = 3 * m;
      const cap = isBoss ? 60 : 25;
      const next = Math.min(cap, state.enemyDefense + gain);
      const applied = next - state.enemyDefense;
      state.enemyDefense = next;
      return { type: 'enemy_armor_up', value: applied };
    }

    case 'agility': {
      // Speed identity: enemy attack cooldown shrinks (capped at 500ms).
      const shave = 100 * m;
      state.enemyAttackCooldown = Math.max(500, state.enemyAttackCooldown - shave);
      return { type: 'enemy_speedup', value: shave };
    }

    case 'counter': {
      // Reactive bleed: extra direct HP loss simulating riposte/retaliation.
      const bleed = 2 * m;
      state.heroHP = Math.max(0, state.heroHP - bleed);
      return { type: 'hero_bleed', value: bleed };
    }

    case 'fire': {
      // Burn theme: small extra HP loss + stamina drain (the burn "fades" gear).
      const hp = 1 * m;
      const stam = 1 * m;
      state.heroHP = Math.max(0, state.heroHP - hp);
      state.heroStamina = Math.max(0, state.heroStamina - stam);
      return { type: 'hero_burn', value: hp };
    }

    case 'water': {
      // Restorative current: enemy heals on each hit.
      const heal = 4 * m;
      state.enemyHP = Math.min(state.enemyMaxHP, state.enemyHP + heal);
      return { type: 'enemy_heal', value: heal };
    }

    case 'air': {
      // Disruptive gust: chance to stun + mana drain.
      const stunChance = 0.15 * m;
      const manaDrain = 1 * m;
      state.heroMana = Math.max(0, state.heroMana - manaDrain);
      if (rand() < stunChance) {
        state.heroStunned = true;
        return { type: 'hero_stun', value: 1 };
      }
      return { type: 'hero_drain', value: manaDrain };
    }

    case 'earth': {
      // Crushing weight: stamina drain + enemy armor sprout (also capped).
      const stam = 2 * m;
      const armor = 1 * m;
      const cap = isBoss ? 40 : 15;
      state.heroStamina = Math.max(0, state.heroStamina - stam);
      if (state.enemyDefense < cap) {
        state.enemyDefense = Math.min(cap, state.enemyDefense + armor);
      }
      return { type: 'hero_slow', value: stam };
    }
  }

  return null;
}
