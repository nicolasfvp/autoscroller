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
 * Map from passive `stat` keys to CombatState field names.
 * CombatState prefixes hero fields (heroMaxHP, heroStrength, …) so a direct
 * write would orphan the modifier; we route through this map instead.
 */
const COMBAT_STAT_KEY_MAP: Record<string, keyof import('../combat/CombatState').CombatState> = {
  maxHP: 'heroMaxHP',
  maxStamina: 'heroMaxStamina',
  maxMana: 'heroMaxMana',
  defenseMultiplier: 'heroDefenseMultiplier',
  attackDamage: 'heroStrength',
};

/**
 * Apply stat_modifier passives to a CombatState (in-place mutation).
 * Use this from CombatState.create — fixes the silent no-op caused by
 * casting CombatState to `any` and writing to mismatched field names.
 */
export function applyPassiveModifiersToCombatState(
  state: import('../combat/CombatState').CombatState,
  passives: PassiveSkill[],
): void {
  const target = state as unknown as Record<string, number>;
  for (const p of passives) {
    if (p.effect.type !== 'stat_modifier' || !p.effect.stat || p.effect.value == null) continue;
    const mappedKey = COMBAT_STAT_KEY_MAP[p.effect.stat];
    if (!mappedKey) continue; // unknown stat — skip rather than orphan
    target[mappedKey as string] = (target[mappedKey as string] ?? 0) + p.effect.value;
    // If a maxHP passive lands, also bump current HP so the hero starts at full.
    if (mappedKey === 'heroMaxHP') {
      target.heroHP = (target.heroHP ?? 0) + p.effect.value;
    }
    if (mappedKey === 'heroMaxStamina') {
      target.heroStamina = (target.heroStamina ?? 0) + p.effect.value;
    }
    if (mappedKey === 'heroMaxMana') {
      target.heroMana = (target.heroMana ?? 0) + p.effect.value;
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
