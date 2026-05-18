// Time-decaying status effect ("aura") registry — owned by CombatState.
// Two flavors:
//   1. Modifier auras: while alive, add a value to a named axis (stat or cd_reduction).
//   2. Triggered auras: armed; when their trigger fires, the inner `then` effect
//      is queued for application and the aura is removed.
//
// Decay is time-based: each tick() call subtracts ms from every aura's
// remaining ttl_ms and prunes expired ones. Caps and diminishing returns for
// cd_reduction live in `getCdReductionFactor` so callers consult one helper
// rather than computing the curve at every cooldown read.

import type { CardEffect, AuraModifierKind, StackId } from '../../data/types';
import type { CombatState } from './CombatState';

export type AuraTrigger = "on_armor_break" | "on_hp_pct_below";

export interface ActiveAura {
  /** Remaining lifetime in milliseconds. Decremented every tick. */
  remainingMs: number;
  /** Modifier this aura contributes while alive (omit for trigger-only auras). */
  modifier?: { kind: AuraModifierKind; value: number };
  /** Armed trigger — when fired, `then` is applied once and the aura is removed. */
  trigger?: AuraTrigger;
  /** Threshold (0-100, hero HP %) for on_hp_pct_below triggers. */
  threshold?: number;
  /** Effect applied when `trigger` fires. */
  then?: CardEffect;
}

export type AuraTarget = "self" | "enemy";

export function createAura(effect: CardEffect): ActiveAura {
  return {
    remainingMs: effect.ttl_ms ?? 5000,
    modifier: effect.modifier,
    trigger: effect.trigger,
    threshold: effect.threshold,
    then: effect.then,
  };
}

/**
 * Fire any on_hp_pct_below auras whose threshold the hero's HP just crossed.
 * Returns the `then` effects to be applied by the caller (CardResolver path).
 * Triggered auras self-remove.
 */
export function fireHpThresholdTriggers(auras: ActiveAura[] | undefined | null, heroHpPct: number): CardEffect[] {
  const fired: CardEffect[] = [];
  if (!auras) return fired;
  for (let i = auras.length - 1; i >= 0; i--) {
    const a = auras[i];
    if (a.trigger === 'on_hp_pct_below' && a.then && a.threshold !== undefined && heroHpPct < a.threshold) {
      fired.push(a.then);
      auras.splice(i, 1);
    }
  }
  return fired;
}

/** Tick decay: subtract `deltaMs` from every aura and prune expired ones. */
export function tickAuras(auras: ActiveAura[] | undefined | null, deltaMs: number): void {
  if (!auras) return;
  for (let i = auras.length - 1; i >= 0; i--) {
    auras[i].remainingMs -= deltaMs;
    if (auras[i].remainingMs <= 0) auras.splice(i, 1);
  }
}

/** Sum the value of all modifier auras on the given axis. Safe against null/undefined input. */
export function sumModifier(auras: ActiveAura[] | undefined | null, kind: AuraModifierKind): number {
  if (!auras) return 0;
  let total = 0;
  for (const a of auras) {
    if (a.modifier?.kind === kind) total += a.modifier.value;
  }
  return total;
}

/**
 * cd_reduction with caps:
 *   - First 30% counts at face value.
 *   - Each additional point counts at 50% (soft cap / diminishing returns).
 *   - Hard cap: total cooldown reduction never exceeds 60% (floor at 40% of
 *     base cooldown).
 *
 * Returns a multiplier in [0.4, 1.0] to apply to a card's base cooldown.
 *
 * UNITS CONTRACT: cd_reduction modifier values are stored as FRACTIONS in
 * cards.json (e.g. 0.25 = 25%), not as percents. sumModifier returns the
 * raw sum of those fractions, so 0.30 / 0.60 here are fractional thresholds.
 * If you change JSON to store percents, divide by 100 at the sumModifier
 * boundary — do not touch these thresholds.
 */
export function getCdReductionFactor(auras: ActiveAura[] | undefined | null): number {
  const raw = sumModifier(auras, "cd_reduction");
  if (raw <= 0) return 1.0;
  const softCapThreshold = 0.30;
  const hardCap = 0.60;
  let effective: number;
  if (raw <= softCapThreshold) {
    effective = raw;
  } else {
    effective = softCapThreshold + (raw - softCapThreshold) * 0.5;
  }
  if (effective > hardCap) effective = hardCap;
  return Math.max(0.4, 1 - effective);
}

/**
 * Fire any triggered auras matching the given event. Each fired aura's `then`
 * effect is returned so the caller (CardResolver) can run it through the
 * normal effect pipeline. Fired auras are removed from the list.
 */
export function fireTrigger(auras: ActiveAura[] | undefined | null, trigger: AuraTrigger): CardEffect[] {
  const fired: CardEffect[] = [];
  if (!auras) return fired;
  for (let i = auras.length - 1; i >= 0; i--) {
    const a = auras[i];
    if (a.trigger === trigger && a.then) {
      fired.push(a.then);
      auras.splice(i, 1);
    }
  }
  return fired;
}

/**
 * Apply a triggered aura's `then` payload directly to combat state. Kept
 * narrow to avoid a CardResolver ↔ EnemyAI import cycle: only the effect
 * shapes the proposed tier-1 trigger payloads use are supported (damage,
 * dot/stack, armor). Anything else is silently dropped.
 *
 * `rageScale` is filled when the payload uses scale.stat='rage' — the caller
 * (typically on-armor-break for Iron Reckoning) passes state.rageStacks so
 * the damage scales off rage even though rage isn't a stat axis.
 */
export function applyTriggeredPayload(state: CombatState, effect: CardEffect): { totalDamage: number } {
  const result = { totalDamage: 0 };
  let value = effect.value;

  // Minimal scaling: support scale that names rage (counter-defense fantasy).
  if (effect.scale && effect.scale.per > 0 && effect.scale.value !== 0) {
    if ((effect.scale.stat as string) === 'rage') {
      value = effect.value + Math.floor(state.rageStacks / effect.scale.per) * effect.scale.value;
    }
  }

  switch (effect.type) {
    case 'damage': {
      const baseDmg = value * state.heroStrength;
      const raw = baseDmg > 0
        ? (effect.pierce_armor
            ? Math.max(1, Math.floor(baseDmg))
            : Math.max(1, Math.floor(baseDmg - state.enemyDefense)))
        : 0;
      state.enemyHP -= raw;
      result.totalDamage += raw;
      break;
    }
    case 'dot':
    case 'stack': {
      const which: StackId = effect.stack ?? 'poison';
      switch (which) {
        case 'poison': state.poisonStacks += value; break;
        case 'bleed': state.bleedStacks += value; break;
        case 'burn': state.burnStacks += value; break;
        case 'stun': state.stunStacks += value; break;
        case 'slow': state.slowStacks += value; break;
        case 'arcane': state.arcaneStacks = Math.min(state.arcaneStacksCap, state.arcaneStacks + value); break;
        case 'rage': state.rageStacks += value; break;
      }
      break;
    }
    case 'armor': {
      state.heroDefense += value;
      break;
    }
    case 'heal': {
      state.heroHP = Math.min(state.heroMaxHP, state.heroHP + value);
      break;
    }
    // Other effect types are not currently used by trigger payloads — silent no-op.
  }
  return result;
}
