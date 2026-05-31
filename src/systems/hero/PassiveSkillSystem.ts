// Passive skill resolution from XP and class data.
// No Phaser dependency. Pure functions operating on RunState + passive data.

import warriorPassiveData from '../../data/json/warrior-passives.json';
import magePassiveData from '../../data/json/mage-passives.json';
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
  const className = run.hero.className ?? 'warrior';
  const passiveData = className === 'mage'
    ? (magePassiveData as PassiveSkill[])
    : (warriorPassiveData as PassiveSkill[]);
  return passiveData
    .filter((p) => totalXP >= p.xpThreshold)
    .sort((a, b) => a.xpThreshold - b.xpThreshold);
}

// ── Apply Stat Modifiers ────────────────────────────────────

/**
 * Apply all stat_modifier passives to a hero state (in-place mutation).
 * HeroState fields are named directly (maxHP, maxStamina, ...), matching the
 * passive `stat` keys verbatim.
 */
export function applyPassiveModifiers(
  hero: HeroState,
  passives: PassiveSkill[],
): void {
  const target = hero as unknown as Record<string, number>;
  for (const p of passives) {
    if (p.effect.type === 'stat_modifier' && p.effect.stat && p.effect.value != null) {
      target[p.effect.stat] = (target[p.effect.stat] ?? 0) + p.effect.value;
    }
  }
}

/**
 * Apply stat_modifier passives that aren't already folded into resolveHeroStats.
 *
 * resolveHeroStats sums class passive maxHP / maxStamina / maxMana / attackDamage,
 * so the combat seeding picks those up via resolved.* — re-applying them here
 * would double-count. Only `defenseMultiplier` remains genuinely per-combat
 * because it isn't part of the resolved stat surface.
 */
export function applyPassiveModifiersToCombatState(
  state: import('../combat/CombatState').CombatState,
  passives: PassiveSkill[],
): void {
  const target = state as unknown as Record<string, number>;
  for (const p of passives) {
    if (p.effect.type !== 'stat_modifier' || !p.effect.stat || p.effect.value == null) continue;
    if (p.effect.stat !== 'defenseMultiplier') continue;
    target.heroDefenseMultiplier = (target.heroDefenseMultiplier ?? 0) + p.effect.value;
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
