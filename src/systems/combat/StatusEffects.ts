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

import type { CardEffect, AuraModifierKind, AuraTriggerKind, StackId } from '../../data/types';
import type { CombatState } from './CombatState';

/** Legacy alias kept for callers that name the narrow v1 trigger set explicitly. */
export type AuraTrigger = "on_armor_break" | "on_hp_pct_below";

export interface ActiveAura {
  /** Remaining lifetime in milliseconds. Decremented every tick. null = no decay. */
  remainingMs: number;
  /** Modifier this aura contributes while alive (omit for trigger-only auras). */
  modifier?: { kind: AuraModifierKind; value: number; stack?: StackId };
  /** Armed trigger — when fired, `then` is applied once and the aura is removed. */
  trigger?: AuraTriggerKind;
  /** Threshold (0-100, hero HP %) for on_hp_pct_below triggers, OR stack count. */
  threshold?: number;
  /** v3: stack name for on_stack_threshold / on_kill_with_stack. */
  threshold_stack?: StackId;
  /** v3: minimum amount for on_armor_gained triggers. */
  min_amount?: number;
  /** v3: cooldown between refires of this trigger (anti-farm in multi-hit). */
  cooldownMs?: number;
  /** v3: time until next allowed refire (counts down with remainingMs). */
  nextFireInMs?: number;
  /** v3: periodic tick interval — when set, fires `then` every tick_ms ms. */
  tickMs?: number;
  /** v3: ms until next tick (counts down). */
  nextTickInMs?: number;
  /** v3: channel warm-up — aura is inactive until this hits 0. */
  channelMsRemaining?: number;
  /** Effect applied when `trigger` fires or `tick_ms` elapses. May be array (v3). */
  then?: CardEffect | CardEffect[];
}

export type AuraTarget = "self" | "enemy";

export function createAura(effect: CardEffect): ActiveAura {
  const ttl = effect.ttl_ms ?? 5000;
  return {
    remainingMs: ttl === null ? Number.POSITIVE_INFINITY : ttl,
    modifier: effect.modifier,
    trigger: effect.trigger,
    threshold: effect.threshold,
    threshold_stack: effect.threshold_stack,
    min_amount: effect.min_amount,
    cooldownMs: effect.cooldown_ms,
    nextFireInMs: 0,
    tickMs: effect.tick_ms,
    nextTickInMs: effect.tick_ms,
    channelMsRemaining: effect.channel_ms,
    then: effect.then,
  };
}

/** Normalize a `then` value (which may be a single effect or an array) to an array. */
function thenToArray(then: CardEffect | CardEffect[] | undefined): CardEffect[] {
  if (!then) return [];
  return Array.isArray(then) ? then : [then];
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
      for (const e of thenToArray(a.then)) fired.push(e);
      auras.splice(i, 1);
    }
  }
  return fired;
}

/** Tick decay: subtract `deltaMs` from every aura, advance tick/cooldown counters,
 *  prune expired ones. Infinity-ttl auras never decay (Demon Form). */
export function tickAuras(auras: ActiveAura[] | undefined | null, deltaMs: number): void {
  if (!auras) return;
  for (let i = auras.length - 1; i >= 0; i--) {
    const a = auras[i];
    if (Number.isFinite(a.remainingMs)) a.remainingMs -= deltaMs;
    if (a.channelMsRemaining !== undefined && a.channelMsRemaining > 0) {
      a.channelMsRemaining = Math.max(0, a.channelMsRemaining - deltaMs);
    }
    if (a.nextFireInMs !== undefined && a.nextFireInMs > 0) {
      a.nextFireInMs = Math.max(0, a.nextFireInMs - deltaMs);
    }
    if (a.nextTickInMs !== undefined && a.tickMs !== undefined && a.tickMs > 0) {
      a.nextTickInMs = Math.max(0, a.nextTickInMs - deltaMs);
    }
    if (Number.isFinite(a.remainingMs) && a.remainingMs <= 0) auras.splice(i, 1);
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

/** v3: same as sumModifier, but when an aura's modifier carries `stack`, the
 *  contribution is `value * <current count of that stack on the named side>`.
 *  Used by Iron Reckoning ("hits +1 per Rage") and other dynamically scaled
 *  modifiers. */
export function sumModifierStackScaled(
  auras: ActiveAura[] | undefined | null,
  kind: AuraModifierKind,
  state: CombatState,
  side: 'self' | 'enemy',
): number {
  if (!auras) return 0;
  let total = 0;
  for (const a of auras) {
    if (a.modifier?.kind !== kind) continue;
    if (!a.modifier.stack) {
      total += a.modifier.value;
      continue;
    }
    const which = a.modifier.stack;
    let cur = 0;
    if (side === 'self') {
      switch (which) {
        case 'burn': cur = state.heroBurnStacks; break;
        case 'bleed': cur = state.heroBleedStacks; break;
        case 'rage': cur = state.rageStacks; break;
        case 'arcane': cur = state.arcaneStacks; break;
        default: cur = 0;
      }
    } else {
      switch (which) {
        case 'poison': cur = state.poisonStacks; break;
        case 'bleed': cur = state.bleedStacks; break;
        case 'burn': cur = state.burnStacks; break;
        case 'stun': cur = state.stunStacks; break;
        case 'slow': cur = state.slowStacks; break;
        case 'arcane': cur = state.arcaneStacks; break;
        case 'rage': cur = state.rageStacks; break;
      }
    }
    total += a.modifier.value * cur;
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
export function fireTrigger(auras: ActiveAura[] | undefined | null, trigger: AuraTriggerKind): CardEffect[] {
  const fired: CardEffect[] = [];
  if (!auras) return fired;
  for (let i = auras.length - 1; i >= 0; i--) {
    const a = auras[i];
    if (a.trigger === trigger && a.then) {
      for (const e of thenToArray(a.then)) fired.push(e);
      auras.splice(i, 1);
    }
  }
  return fired;
}

/** v3: fire matching triggers without removing them (persistent auras like
 *  on_hit_dealt, on_hit_taken, on_armor_gained that should keep working for
 *  their full ttl). Honors per-aura internal cooldown to prevent multi-hit
 *  farming. */
export function fireRecurringTrigger(
  auras: ActiveAura[] | undefined | null,
  trigger: AuraTriggerKind,
  amount?: number,
): CardEffect[] {
  const fired: CardEffect[] = [];
  if (!auras) return fired;
  for (const a of auras) {
    if (a.trigger !== trigger || !a.then) continue;
    if (a.channelMsRemaining && a.channelMsRemaining > 0) continue;
    if (a.nextFireInMs && a.nextFireInMs > 0) continue;
    if (a.min_amount !== undefined && (amount ?? 0) < a.min_amount) continue;
    for (const e of thenToArray(a.then)) fired.push(e);
    if (a.cooldownMs && a.cooldownMs > 0) a.nextFireInMs = a.cooldownMs;
  }
  return fired;
}

/** v3: collect periodic-tick payloads from any aura whose `tickMs` rolled to 0. */
export function collectAuraTicks(auras: ActiveAura[] | undefined | null): CardEffect[] {
  const fired: CardEffect[] = [];
  if (!auras) return fired;
  for (const a of auras) {
    if (a.tickMs === undefined || a.tickMs <= 0) continue;
    if (a.channelMsRemaining && a.channelMsRemaining > 0) continue;
    if (a.nextTickInMs && a.nextTickInMs > 0) continue;
    if (!a.then) continue;
    for (const e of thenToArray(a.then)) fired.push(e);
    a.nextTickInMs = a.tickMs;
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

  // v3: honor condition gates on the then-payload (tick auras, recurring trigs).
  const cond = effect.condition;
  if (cond) {
    if (cond.hero_hp_pct_below !== undefined) {
      const pct = (state.heroHP / Math.max(1, state.heroMaxHP)) * 100;
      if (pct >= cond.hero_hp_pct_below) return result;
    }
    if (cond.hero_hp_pct_atleast !== undefined) {
      const pct = (state.heroHP / Math.max(1, state.heroMaxHP)) * 100;
      if (pct < cond.hero_hp_pct_atleast) return result;
    }
    if (cond.self_armor_atleast !== undefined && state.heroDefense < cond.self_armor_atleast) return result;
    if (cond.enemy_stunned !== undefined && (state.stunStacks > 0) !== cond.enemy_stunned) return result;
  }

  let value = effect.value;

  // Scale: stat (str/vit/dex/int/spi), plus rage as a pseudo-stat. SPI bonus
  // for heal is applied at the caller (or here for heal type).
  if (effect.scale && effect.scale.per > 0 && effect.scale.value !== 0) {
    const stat = effect.scale.stat as string;
    let statValue = 0;
    switch (stat) {
      case 'rage': statValue = state.rageStacks; break;
      case 'str': statValue = state.heroStrength; break;
      case 'vit': statValue = state.heroVitality; break;
      case 'dex': statValue = state.heroDexterity; break;
      case 'int': statValue = state.heroIntellect; break;
      case 'spi': statValue = state.heroSpirit; break;
    }
    value = effect.value + Math.floor(statValue / effect.scale.per) * effect.scale.value;
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
