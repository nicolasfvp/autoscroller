// RelicSystem -- applies relic effects to CombatState.
// Zero Phaser imports. Pure data-driven logic from relics.json.

import relicsData from '../../data/json/relics.json';
import type { CombatState } from './CombatState';
import type { CardDefinition } from '../../data/types';

export interface RelicData {
  id: string;
  name: string;
  description: string;
  rarity: string;
  trigger: string;
  effectType: string;
  stat?: string;
  stats?: Record<string, number>;
  value?: number;
  condition?: string;
  once_per?: string;
  icon?: string;
  color?: number;
}

const RELIC_MAP: Map<string, RelicData> = new Map(
  (relicsData as RelicData[]).map(r => [r.id, r])
);

export function getRelicData(id: string): RelicData | undefined {
  return RELIC_MAP.get(id);
}

// ── Passive relics applied at combat start ────────────────────

/**
 * Apply all passive (trigger='passive') relics from the run relic list
 * to the CombatState. Mutates state in-place.
 */
export function applyPassiveRelics(relicIds: string[], state: CombatState): void {
  for (const id of relicIds) {
    const relic = RELIC_MAP.get(id);
    if (!relic || relic.trigger !== 'passive') continue;

    switch (relic.effectType) {
      case 'stat_bonus': {
        // Single stat bonus
        if (relic.stat && relic.value != null) {
          applySingleStatBonus(relic.stat, relic.value, state);
        }
        // Multi-stat bonus
        if (relic.stats) {
          for (const [stat, val] of Object.entries(relic.stats)) {
            applySingleStatBonus(stat, val, state);
          }
        }
        break;
      }
      case 'stat_multiplier': {
        if (relic.stats) {
          for (const [stat, mult] of Object.entries(relic.stats)) {
            applyStatMultiplier(stat, mult, state);
          }
        }
        break;
      }
      case 'cooldown_reduction': {
        // Stored as a flag; CombatEngine reads it via getCardCooldownMultiplier
        state.cooldownMultiplier = (state.cooldownMultiplier ?? 1.0) * (1.0 - (relic.value ?? 0));
        break;
      }
      case 'conditional_strength':
      case 'conditional_damage_mult': {
        // Evaluated per-card in resolveRelicBonus — registered here for tracking
        state.activeRelicIds.push(id);
        break;
      }
      default: {
        // Register for later evaluation
        state.activeRelicIds.push(id);
        break;
      }
    }
  }
}

function applySingleStatBonus(stat: string, value: number, state: CombatState): void {
  switch (stat) {
    case 'maxHP':
      state.heroMaxHP += value;
      state.heroHP = Math.min(state.heroHP + value, state.heroMaxHP);
      break;
    case 'maxStamina':
      state.heroMaxStamina += value;
      state.heroStamina = Math.min(state.heroStamina + value, state.heroMaxStamina);
      break;
    case 'maxMana':
      state.heroMaxMana += value;
      state.heroMana = Math.min(state.heroMana + value, state.heroMaxMana);
      break;
    case 'strength':
      state.heroStrength += value;
      break;
    case 'defense':
      state.heroDefense += value;
      break;
  }
}

function applyStatMultiplier(stat: string, mult: number, state: CombatState): void {
  switch (stat) {
    case 'maxHP':
      state.heroMaxHP = Math.floor(state.heroMaxHP * mult);
      state.heroHP = Math.min(state.heroHP, state.heroMaxHP);
      break;
    case 'strength':
      state.heroStrength = Math.floor(state.heroStrength * mult);
      break;
  }
}

// ── Combat start relics ───────────────────────────────────────

/**
 * Apply 'combat_start' relics and return the first-card damage multiplier (if any).
 */
export function applyOnCombatStartRelics(relicIds: string[], state: CombatState): void {
  for (const id of relicIds) {
    const relic = RELIC_MAP.get(id);
    if (!relic || relic.trigger !== 'combat_start') continue;

    if (relic.effectType === 'first_card_multiplier' && relic.value != null) {
      state.firstCardDamageMultiplier = relic.value;
    }
  }
}

// ── Per-card relics ───────────────────────────────────────────

/**
 * Compute an extra damage multiplier from relics when a card is played.
 * Returns 1.0 if no bonus applies.
 */
export function resolveCardPlayedRelicBonus(
  relicIds: string[],
  card: CardDefinition,
  state: CombatState,
): { damageMultiplier: number; staminaRefund: number; manaOverride: number | null } {
  let damageMultiplier = 1.0;
  let staminaRefund = 0;
  let manaOverride: number | null = null;

  // Consume first-card multiplier
  if (state.firstCardDamageMultiplier && state.firstCardDamageMultiplier > 1) {
    damageMultiplier *= state.firstCardDamageMultiplier;
    state.firstCardDamageMultiplier = 1.0; // consume once
  }

  for (const id of relicIds) {
    const relic = RELIC_MAP.get(id);
    if (!relic || relic.trigger !== 'card_played') continue;

    switch (relic.effectType) {
      case 'refund_resource': {
        if (relic.condition === 'card_category_attack' && (card as any).category === 'attack') {
          if (relic.stat === 'stamina') staminaRefund += relic.value ?? 0;
        }
        break;
      }
      case 'spell_cost_override': {
        if (relic.condition === 'card_category_magic' && (card as any).category === 'magic') {
          if (relic.stats?.manaCostOverride !== undefined) manaOverride = relic.stats.manaCostOverride;
          if (relic.stats?.damageMultiplier !== undefined) damageMultiplier *= relic.stats.damageMultiplier;
        }
        break;
      }
    }
  }

  // thin_deck_charm: +50% damage if deck has <= 6 cards
  for (const id of relicIds) {
    const relic = RELIC_MAP.get(id);
    if (!relic) continue;
    if (relic.effectType === 'conditional_damage_mult' && relic.condition === 'deck_size_lte_6') {
      if (state.deckOrder.length <= 6 && relic.value != null) {
        damageMultiplier *= relic.value;
      }
    }
    // blood_pact: +2 strength per 10% HP missing
    if (relic.effectType === 'conditional_strength' && relic.condition === 'hp_missing_per_10pct') {
      const missingPct = 1.0 - (state.heroHP / state.heroMaxHP);
      const stacks = Math.floor(missingPct / 0.1);
      const bonus = stacks * (relic.value ?? 0);
      // Temporarily boost strength for this card (restore after resolve in CombatEngine)
      state._bloodPactBonus = bonus;
    }
  }

  return { damageMultiplier, staminaRefund, manaOverride };
}

// ── Damage taken relics ───────────────────────────────────────

/**
 * Apply relics triggered when the hero takes damage.
 * Returns true if phoenix_feather prevented death.
 */
export function applyDamageTakenRelics(relicIds: string[], actualDamage: number, state: CombatState): boolean {
  let preventedDeath = false;

  for (const id of relicIds) {
    const relic = RELIC_MAP.get(id);
    if (!relic || relic.trigger !== 'damage_taken') continue;

    switch (relic.effectType) {
      case 'stat_bonus_temp': {
        // iron_will: gain defense on any damage
        if (relic.stat === 'defense' && actualDamage > 0) {
          state.heroDefense += relic.value ?? 0;
        }
        break;
      }
      case 'heal_percent': {
        // phoenix_feather: revive at 50% HP when HP hits 0, once per combat
        if (relic.condition === 'hp_zero' && state.heroHP <= 0 && !state.phoenixUsed) {
          state.heroHP = Math.floor(state.heroMaxHP * ((relic.value ?? 50) / 100));
          state.phoenixUsed = true;
          preventedDeath = true;
        }
        break;
      }
    }
  }

  return preventedDeath;
}
