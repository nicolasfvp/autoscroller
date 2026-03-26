// Passive skill resolution from XP and class data.
// No Phaser dependency. Pure functions operating on RunState + passive data.

import passiveData from '../../data/json/warrior-passives.json';
import type { RunState, HeroState } from '../../state/RunState';

// ── Types ───────────────────────────────────────────────────

export interface PassiveSkill {
  id: string;
  name: string;
  description: string;
  xpThreshold: number;
  effect: {
    type: 'stat_modifier' | 'conditional_trigger';
    stat?: string;
    value?: number;
    condition?: string;
    triggerEffect?: { type: string; value: number; target: string };
  };
}

export interface TriggerContext {
  consecutiveAttacks?: number;
  deckReshuffled?: boolean;
}

// ── Resolve Passives ────────────────────────────────────────

/**
 * Return all passive skills unlocked by the hero's total XP.
 * Passives unlock at fixed XP thresholds in order.
 */
export function resolvePassives(run: RunState): PassiveSkill[] {
  const totalXP = run.hero.totalXP ?? 0;
  return (passiveData as PassiveSkill[])
    .filter((p) => totalXP >= p.xpThreshold)
    .sort((a, b) => a.xpThreshold - b.xpThreshold);
}

// ── Apply Stat Modifiers ────────────────────────────────────

/**
 * Apply all stat_modifier passives to a hero state (in-place mutation).
 */
export function applyPassiveModifiers(
  hero: HeroState,
  passives: PassiveSkill[],
): void {
  for (const p of passives) {
    if (p.effect.type === 'stat_modifier' && p.effect.stat && p.effect.value != null) {
      (hero as Record<string, unknown>)[p.effect.stat] =
        ((hero as Record<string, unknown>)[p.effect.stat] as number) + p.effect.value;
    }
  }
}

// ── Check Conditional Trigger ───────────────────────────────

/**
 * Check if a conditional trigger should fire given the current context.
 * Returns the trigger effect if conditions are met, null otherwise.
 */
export function checkConditionalTrigger(
  condition: string,
  context: TriggerContext,
  passives: PassiveSkill[],
): { type: string; value: number; target: string } | null {
  const passive = passives.find(
    (p) => p.effect.type === 'conditional_trigger' && p.effect.condition === condition,
  );
  if (!passive || !passive.effect.triggerEffect) return null;

  switch (condition) {
    case 'consecutive_attacks_2':
      if ((context.consecutiveAttacks ?? 0) >= 2) return passive.effect.triggerEffect;
      return null;
    case 'deck_reshuffled':
      if (context.deckReshuffled) return passive.effect.triggerEffect;
      return null;
    default:
      return null;
  }
}
