// RelicSystem -- applies relic effects to CombatState.
// Zero Phaser imports. Pure data-driven logic from relics.json.

import relicsData from '../../data/json/relics.json';
import type { CombatState } from './CombatState';
import type { CardDefinition } from '../../data/types';
import { rand } from '../SharedRNG';

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
        // Evaluated per-card in resolveRelicBonus — registered here for tracking.
        // Don't double-register: CombatState.create already seeds activeRelicIds
        // from run.relics, so re-pushing here causes multiplier double-application.
        if (!state.activeRelicIds.includes(id)) state.activeRelicIds.push(id);
        break;
      }
      // C5 — Constellation Sigil: +1 to primary stat of each unique element in the deck.
      case 'constellation_sigil': {
        applyConstellationSigil(state);
        break;
      }
      // C7 — Heavy Tome (HP portion): +N Max HP per card beyond 10 in the deck.
      case 'heavy_tome': {
        if (!state.activeRelicIds.includes(id)) state.activeRelicIds.push(id);
        const excess = Math.max(0, state.deckOrder.length - 10);
        if (excess > 0) {
          const perCard = relic.stats?.hpPerExcess ?? 4;
          const bonus = excess * perCard;
          state.heroMaxHP += bonus;
          state.heroHP = Math.min(state.heroMaxHP, state.heroHP + bonus);
        }
        break;
      }
      default: {
        // Register for later evaluation (same dedup rationale as above).
        if (!state.activeRelicIds.includes(id)) state.activeRelicIds.push(id);
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
    case 'vitality':
      // Match the VIT seeding in createCombatState: +5 Max HP per VIT point.
      // We bump max + current symmetrically so a +1 VIT common feels like +5 HP.
      state.heroVitality += value;
      state.heroMaxHP += value * 5;
      state.heroHP = Math.min(state.heroHP + value * 5, state.heroMaxHP);
      break;
    case 'dexterity':
      state.heroDexterity += value;
      break;
    case 'intellect':
      state.heroIntellect += value;
      break;
    case 'spirit':
      state.heroSpirit += value;
      break;
  }
}

// C5 — Constellation Sigil: parse element multiset from card IDs (format
// `t{tier}-{el1}-{el2}[-el3][-el4]`). For each unique element across the deck,
// grant +1 to its primary stat per elements.json mapping.
const ELEMENT_PRIMARY_STAT: Record<string, string> = {
  attack: 'strength', counter: 'strength',
  defense: 'vitality', earth: 'vitality',
  agility: 'dexterity', air: 'dexterity',
  fire: 'intellect',
  water: 'spirit',
};

function parseElementsFromCardId(id: string): string[] {
  const parts = id.split('-');
  if (parts.length < 2) return [];
  return parts.slice(1);
}

function applyConstellationSigil(state: CombatState): void {
  const uniqueElements = new Set<string>();
  for (const cardId of state.deckOrder) {
    for (const el of parseElementsFromCardId(cardId)) uniqueElements.add(el);
  }
  for (const el of uniqueElements) {
    const stat = ELEMENT_PRIMARY_STAT[el];
    if (stat) applySingleStatBonus(stat, 1, state);
  }
}

function applyStatMultiplier(stat: string, mult: number, state: CombatState): void {
  switch (stat) {
    case 'maxHP':
      state.heroMaxHP = Math.floor(state.heroMaxHP * mult);
      state.heroHP = Math.min(state.heroHP, state.heroMaxHP);
      break;
    case 'strength':
      // Round (not floor) so a 1.5x multiplier on strength=1 actually
      // grants the bonus instead of floor()'ing back to 1.
      state.heroStrength = Math.max(state.heroStrength, Math.round(state.heroStrength * mult));
      break;
  }
}

// ── Combat start relics ───────────────────────────────────────

/**
 * Apply 'combat_start' relics and return the first-card damage multiplier (if any).
 *
 * C1 extension: combat_start_bundle now accepts a stats object containing any
 * mix of immediate grants (armor, rage, stamina, mana, hp, damage) and
 * combat-flag setters (firstCardCostsZero, firstNStaminaDiscount,
 * firstAttackDamage, firstFireBurn, barrier, enemyBleed).
 */
export function applyOnCombatStartRelics(relicIds: string[], state: CombatState): void {
  for (const id of relicIds) {
    const relic = RELIC_MAP.get(id);
    if (!relic || relic.trigger !== 'combat_start') continue;

    if (relic.effectType === 'first_card_multiplier' && relic.value != null) {
      state.firstCardDamageMultiplier = relic.value;
      continue;
    }

    if (relic.effectType === 'combat_start_bundle' && relic.stats) {
      applyCombatStartBundle(relic.stats, state);
    }

    // C6 — Pandora's Embers: apply N of a random non-Rage stack to enemy.
    if (relic.effectType === 'pandoras_embers') {
      const stacks: Array<keyof CombatState> = [
        'burnStacks', 'bleedStacks', 'poisonStacks', 'slowStacks', 'stunStacks',
      ];
      const pick = stacks[Math.floor(rand() * stacks.length)];
      (state as any)[pick] = ((state as any)[pick] ?? 0) + (relic.value ?? 3);
    }
  }
}

function applyCombatStartBundle(stats: Record<string, number>, state: CombatState): void {
  for (const [key, value] of Object.entries(stats)) {
    switch (key) {
      case 'armor':
        state.heroDefense += value;
        break;
      case 'rage':
        state.rageStacks += value;
        break;
      case 'stamina':
        state.heroStamina = Math.min(state.heroMaxStamina, state.heroStamina + value);
        break;
      case 'mana':
        state.heroMana = Math.min(state.heroMaxMana, state.heroMana + value);
        break;
      case 'hp':
        state.heroHP = Math.min(state.heroMaxHP, state.heroHP + value);
        break;
      case 'firstCardCostsZero':
        state.firstCardCostsZero = value > 0;
        break;
      case 'firstNStaminaDiscount':
        state.firstNCardsStaminaDiscount = value;
        break;
      case 'firstAttackDamage':
        state.firstAttackDamageBonus = value;
        break;
      case 'firstFireBurn':
        state.firstFireCardBurnBonus = value;
        break;
      case 'barrier':
        state.barrierActive = value > 0;
        break;
      case 'enemyBleed':
        state.bleedStacks += value;
        break;
      // C3 — Cracked Crystal pieces.
      case 'selfDamage':
        state.heroHP = Math.max(1, state.heroHP - value);
        break;
      case 'strength':
        state.heroStrength += value;
        break;
      case 'intellect':
        state.heroIntellect += value;
        break;
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

  // Consume first-card multiplier — but ONLY when this card actually deals
  // damage. Otherwise utility/heal cards (which don't benefit) would burn
  // the buff for nothing.
  const hasDamageEffect = (card.effects ?? []).some(e => e.type === 'damage' && (e.value ?? 0) > 0);
  if (hasDamageEffect && state.firstCardDamageMultiplier && state.firstCardDamageMultiplier > 1) {
    damageMultiplier *= state.firstCardDamageMultiplier;
    state.firstCardDamageMultiplier = 1.0; // consume once
  }

  for (const id of relicIds) {
    const relic = RELIC_MAP.get(id);
    if (!relic || relic.trigger !== 'card_played') continue;

    switch (relic.effectType) {
      case 'refund_resource': {
        if (relic.condition === 'card_category_attack' && card.category === 'attack') {
          if (relic.stat === 'stamina') staminaRefund += relic.value ?? 0;
        }
        break;
      }
      case 'spell_cost_override': {
        if (relic.condition === 'card_category_magic' && card.category === 'magic') {
          if (relic.stats?.manaCostOverride !== undefined) manaOverride = relic.stats.manaCostOverride;
          if (relic.stats?.damageMultiplier !== undefined) damageMultiplier *= relic.stats.damageMultiplier;
        }
        break;
      }
      // C2: every-Nth damage card pattern (Iron Cestus: +50% dmg + 3 Bleed every 4th).
      case 'every_nth_damage_card': {
        if (!hasDamageEffect) break;
        const period = relic.value ?? 4;
        const counter = (state.relicCounters[id] = (state.relicCounters[id] ?? 0) + 1);
        if (counter % period === 0) {
          if (relic.stats?.damageMultiplier) damageMultiplier *= relic.stats.damageMultiplier;
          if (relic.stats?.bleed) state.bleedStacks += relic.stats.bleed;
        }
        break;
      }
      // C2: every-Nth card mana refund (Echoing Chime, Librarian's Seal).
      case 'every_nth_mana_refund': {
        const period = relic.value ?? 5;
        const counter = (state.relicCounters[id] = (state.relicCounters[id] ?? 0) + 1);
        if (counter % period === 0) {
          const refund = relic.stats?.mana ?? 2;
          state.heroMana = Math.min(state.heroMaxMana, state.heroMana + refund);
        }
        break;
      }
      // C2: every-Nth Defense card multiplies the next armor effect (Burnished Sigil).
      case 'every_nth_defense_armor_mult': {
        if (card.category !== 'defense') break;
        const period = relic.value ?? 3;
        const counter = (state.relicCounters[id] = (state.relicCounters[id] ?? 0) + 1);
        if (counter % period === 0) {
          state.nextArmorMultiplier = relic.stats?.armorMultiplier ?? 1.5;
        }
        break;
      }
      // C2: every-Nth card grants temp DEX with combat cap (Whisperwind Sash).
      case 'every_nth_temp_dex': {
        const period = relic.value ?? 3;
        const capKey = `${id}_cap`;
        const counter = (state.relicCounters[id] = (state.relicCounters[id] ?? 0) + 1);
        const cap = relic.stats?.cap ?? 5;
        const already = state.relicCounters[capKey] ?? 0;
        if (counter % period === 0 && already < cap) {
          state.heroDexterity += 1;
          state.relicCounters[capKey] = already + 1;
        }
        break;
      }
      // C2: per-damaging-hit heal capped per second window (Vampiric Fang).
      case 'per_hit_heal_capped': {
        if (!hasDamageEffect) break;
        const windowMs = 1000;
        const maxPerWindow = relic.stats?.capPerSec ?? 3;
        const winKey = `${id}_winStart`;
        const cntKey = `${id}_winCount`;
        const now = state.combatElapsedMs;
        const winStart = state.relicCounters[winKey] ?? 0;
        if (now - winStart >= windowMs) {
          state.relicCounters[winKey] = now;
          state.relicCounters[cntKey] = 0;
        }
        const count = state.relicCounters[cntKey] ?? 0;
        if (count < maxPerWindow) {
          state.heroHP = Math.min(state.heroMaxHP, state.heroHP + (relic.value ?? 1));
          state.relicCounters[cntKey] = count + 1;
        }
        break;
      }
      // C5 — Echo Chamber: every Nth card triggers Echo 1.
      case 'every_nth_echo': {
        const period = relic.value ?? 5;
        const counter = (state.relicCounters[id] = (state.relicCounters[id] ?? 0) + 1);
        if (counter % period === 0) {
          state.echoCharges += 1;
          state.echoExpiresAt = state.combatElapsedMs + 5000;
          state.freeEchoCharges += 1; // C7 — relic-triggered echo is free
        }
        break;
      }
      // C5 — Tempest Resonator: every Nth Magic card refunds mana cost AND Echo 1.
      case 'every_nth_magic_refund_echo': {
        if (card.category !== 'magic') break;
        const period = relic.value ?? 4;
        const counter = (state.relicCounters[id] = (state.relicCounters[id] ?? 0) + 1);
        if (counter % period === 0) {
          const baseManaCost = card.cost?.mana ?? 0;
          if (baseManaCost > 0) manaOverride = 0;
          state.echoCharges += 1;
          state.echoExpiresAt = state.combatElapsedMs + 5000;
          state.freeEchoCharges += 1; // C7 — relic-triggered echo is free
        }
        break;
      }
    }
  }

  // C5 — Demon Heart: cards deal ×2 damage during the first 6 seconds of combat.
  // The self-damage portion is applied by CombatEngine.executeCard after resolve.
  if (relicIds.includes('demon_heart') && state.combatElapsedMs < 6000) {
    damageMultiplier *= 2;
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
    // C5 — Sanguine Pact: +N STR and +N INT per 20% Max HP missing, capped per stat.
    if (relic.effectType === 'sanguine_pact') {
      const missingPct = 1.0 - (state.heroHP / state.heroMaxHP);
      // Multiply by 5 (1/0.2) instead of divide by 0.2 — floor(0.6/0.2) returns
      // 2 due to floating-point rounding (0.6/0.2 = 2.9999...).
      const stacks = Math.min(relic.stats?.cap ?? 5, Math.floor(missingPct * 5 + 1e-9));
      const bonus = stacks * (relic.value ?? 1);
      state._sanguinePactStrBonus = bonus;
      state._sanguinePactIntBonus = bonus;
    }
    // C7 — Heavy Tome: deck ≥10 cards grants flat +20% damage; HP bonus applied at combat start (see applyPassiveRelics).
    if (relic.effectType === 'heavy_tome') {
      if (state.deckOrder.length >= 10) {
        damageMultiplier *= 1 + ((relic.value ?? 20) / 100);
      }
    }
    // C6 — Glasswork Lens: +25% damage to enemies above 75% HP.
    if (relic.effectType === 'damage_vs_enemy_hp_above') {
      const enemyHpPct = (state.enemyHP / Math.max(1, state.enemyMaxHP)) * 100;
      if (enemyHpPct > (relic.stats?.thresholdPct ?? 75)) {
        damageMultiplier *= 1 + ((relic.value ?? 25) / 100);
      }
    }
    // C6 — Executioner's Brand: +35% damage to enemies below 30% HP.
    if (relic.effectType === 'damage_vs_enemy_hp_below') {
      const enemyHpPct = (state.enemyHP / Math.max(1, state.enemyMaxHP)) * 100;
      if (enemyHpPct < (relic.stats?.thresholdPct ?? 30)) {
        damageMultiplier *= 1 + ((relic.value ?? 35) / 100);
      }
    }
  }

  return { damageMultiplier, staminaRefund, manaOverride };
}

// ── Damage taken relics ───────────────────────────────────────

/**
 * Apply relics triggered when the hero takes damage.
 * Returns true if phoenix_feather prevented death.
 *
 * C3 extension: takes a context object so brace-triggered and
 * damage-absorbed-by-armor relics (Banded Greaves, Battered Vambrace,
 * Smoking Censer) can read the armor side of the hit, not just HP loss.
 */
export interface DamageTakenContext {
  actualDamage: number;       // HP lost (after armor)
  armorPrevented: number;     // damage absorbed by armor this hit
  armorJustBroke: boolean;    // armor transitioned >0 → 0 this hit
  rawDamage: number;          // pre-armor incoming
}
export function applyDamageTakenRelics(
  relicIds: string[],
  contextOrDamage: number | DamageTakenContext,
  state: CombatState,
): boolean {
  const ctx: DamageTakenContext = typeof contextOrDamage === 'number'
    ? { actualDamage: contextOrDamage, armorPrevented: 0, armorJustBroke: false, rawDamage: contextOrDamage }
    : contextOrDamage;
  let preventedDeath = false;

  for (const id of relicIds) {
    const relic = RELIC_MAP.get(id);
    if (!relic || relic.trigger !== 'damage_taken') continue;

    switch (relic.effectType) {
      case 'stat_bonus_temp': {
        // legacy iron_will: gain defense on any HP loss
        if (relic.stat === 'defense' && ctx.actualDamage > 0) {
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
      // C3 — Iron Will (reworked): gain N Armor per hit, capped per combat.
      case 'armor_on_hit_capped': {
        if (ctx.rawDamage <= 0) break;
        const capKey = `${id}_armorGained`;
        const cap = relic.stats?.cap ?? 15;
        const gained = state.relicCounters[capKey] ?? 0;
        if (gained < cap) {
          const grant = Math.min(relic.value ?? 3, cap - gained);
          state.heroDefense += grant;
          state.relicCounters[capKey] = gained + grant;
        }
        break;
      }
      // C3 — Counterweight Sigil: next card after a hit costs 0.
      case 'next_card_free_on_hit': {
        if (ctx.rawDamage > 0) state.firstCardCostsZero = true;
        break;
      }
      // C3 — Tarnished Mirror: 25% chance per hit to refund 1 Stamina or 1 Mana.
      case 'rng_resource_refund': {
        if (ctx.rawDamage <= 0) break;
        const pct = relic.value ?? 25;
        if (rand() * 100 < pct) {
          if (rand() < 0.5) {
            state.heroStamina = Math.min(state.heroMaxStamina, state.heroStamina + 1);
          } else {
            state.heroMana = Math.min(state.heroMaxMana, state.heroMana + 1);
          }
        }
        break;
      }
      // C3 — Banded Greaves: gain armor = 25% of damage prevented (cap per
      // combat) and +1 Rage on any hit (regardless of HP loss).
      case 'armor_from_damage_prevented': {
        if (ctx.rawDamage <= 0) break;
        const capKey = `${id}_armorGained`;
        const cap = relic.stats?.cap ?? 12;
        const pct = (relic.value ?? 25) / 100;
        const gained = state.relicCounters[capKey] ?? 0;
        if (gained < cap) {
          const grant = Math.min(Math.floor(ctx.armorPrevented * pct), cap - gained);
          if (grant > 0) {
            state.heroDefense += grant;
            state.relicCounters[capKey] = gained + grant;
          }
        }
        state.rageStacks += relic.stats?.rage ?? 1;
        break;
      }
      // C3 — Battered Vambrace: on Brace, +2 Rage and +3 Armor at next turn start.
      // Armor is granted immediately (no turn boundary in this engine); rage too.
      case 'brace_armor_rage': {
        if (!ctx.armorJustBroke) break;
        state.heroDefense += relic.stats?.armor ?? 3;
        state.rageStacks += relic.stats?.rage ?? 2;
        break;
      }
      // C3 — Smoking Censer: on Brace, apply N Burn to nearest enemy.
      case 'brace_apply_burn': {
        if (!ctx.armorJustBroke) break;
        state.burnStacks += relic.value ?? 4;
        break;
      }
      // C3 — Mana Veil: on hit, spend up to N Mana to negate damage 1:1.
      // Implemented by healing HP back equal to mana spent (post-hit refund),
      // since armor and HP loss already resolved upstream.
      case 'mana_shield': {
        if (ctx.actualDamage <= 0) break;
        const maxSpend = relic.value ?? 6;
        const spend = Math.min(maxSpend, state.heroMana, ctx.actualDamage);
        if (spend > 0) {
          state.heroMana -= spend;
          state.heroHP = Math.min(state.heroMaxHP, state.heroHP + spend);
        }
        break;
      }
    }
  }

  return preventedDeath;
}

// ── Phase 9: generic trigger dispatch (Task 5) ────────────────

/**
 * Phase 9 Task 5: generic trigger dispatcher for the 6 new RelicTrigger
 * values (enemy_killed, card_drawn, rest_used, shop_visited, stat_changed,
 * dot_tick).
 *
 * Resolves any relic whose `trigger` matches and applies its `effectType` to
 * the supplied CombatState. Effect-type handling here intentionally
 * overlaps the existing applyPassiveRelics / applyDamageTakenRelics shapes
 * so future relic definitions can reuse the same effect vocabulary.
 *
 * Out-of-combat triggers (rest_used, shop_visited) accept a partial state
 * shape via the same function — callers from RestSiteSystem / ShopSystem
 * pass a CombatState-shaped accumulator or use a thin adapter. For now the
 * dispatch is a structural pass-through so JSON-authored relics don't
 * crash at runtime even when their effects target run-state fields that
 * aren't on CombatState.
 */
export function dispatchTriggerRelics(
  trigger: string,
  relicIds: string[],
  state: CombatState,
): void {
  for (const id of relicIds) {
    const relic = RELIC_MAP.get(id);
    if (!relic || relic.trigger !== trigger) continue;

    switch (relic.effectType) {
      case 'stat_bonus': {
        if (relic.stat && relic.value != null) applySingleStatBonus(relic.stat, relic.value, state);
        if (relic.stats) {
          for (const [stat, val] of Object.entries(relic.stats)) {
            applySingleStatBonus(stat, val, state);
          }
        }
        break;
      }
      case 'heal_flat': {
        const v = relic.value ?? 0;
        state.heroHP = Math.min(state.heroMaxHP, state.heroHP + v);
        break;
      }
      case 'damage_flat': {
        const v = relic.value ?? 0;
        state.enemyHP -= v;
        break;
      }
      case 'add_poison': {
        state.poisonStacks += (relic.value ?? 0);
        break;
      }
      // C2 — Lucky Coin: +N gold per kill, queued for the run-end sync.
      case 'gold_bonus': {
        state.pendingGoldBonus += (relic.value ?? 0);
        break;
      }
      // C2 — Gravedigger's Tag: gold + HP combined kill bonus.
      case 'kill_bonus': {
        if (relic.stats?.gold) state.pendingGoldBonus += relic.stats.gold;
        if (relic.stats?.hp) state.heroHP = Math.min(state.heroMaxHP, state.heroHP + relic.stats.hp);
        break;
      }
      // C2 — Huntmaster's Eye: +N STR per kill, capped per combat.
      case 'str_per_kill': {
        const capKey = `${id}_strGained`;
        const cap = relic.stats?.cap ?? 6;
        const gained = state.relicCounters[capKey] ?? 0;
        if (gained < cap) {
          const grant = Math.min(relic.value ?? 1, cap - gained);
          state.heroStrength += grant;
          state.relicCounters[capKey] = gained + grant;
        }
        break;
      }
      // C2 — Burnt Tome: +1 Mana per Burn tick, capped per combat.
      case 'mana_per_burn_tick_capped': {
        if (state.burnStacks <= 0) break;
        const capKey = `${id}_manaGained`;
        const cap = relic.stats?.cap ?? 8;
        const gained = state.relicCounters[capKey] ?? 0;
        if (gained < cap) {
          const grant = Math.min(relic.value ?? 1, cap - gained, state.heroMaxMana - state.heroMana);
          if (grant > 0) {
            state.heroMana += grant;
            state.relicCounters[capKey] = gained + grant;
          }
        }
        break;
      }
      // C2 — Linen Wrap: each self-DoT tick deals -1 damage (min 0). Modeled as
      // a heal equal to the reduction, since the DoT damage already fired.
      case 'self_dot_damage_reduction': {
        const reduction = relic.value ?? 1;
        // Only refund if the hero just took self-DoT damage this tick.
        if (state.heroBurnStacks > 0 || state.heroBleedStacks > 0) {
          state.heroHP = Math.min(state.heroMaxHP, state.heroHP + reduction);
        }
        break;
      }
      // C2 — Bloodgorged Heart: each self-DoT tick heals 1 HP and grants 1 Rage.
      case 'heal_rage': {
        if (state.heroBurnStacks > 0 || state.heroBleedStacks > 0) {
          state.heroHP = Math.min(state.heroMaxHP, state.heroHP + (relic.value ?? 1));
          state.rageStacks += (relic.value ?? 1);
        }
        break;
      }
      default: {
        // Unknown effectType for these triggers: no-op. JSON authors get a
        // safe "effect didn't fire" rather than a runtime crash, and the
        // schema validator in Plan 2 catches the typo at build time.
        break;
      }
    }
  }

  // C5 — Sanguine Pact (passive relic with a dot_tick side-effect): each
  // self-DoT tick deals 2 damage to nearest enemy. Hard-coded by ID because
  // the relic's primary trigger is 'passive', not 'dot_tick'.
  if (trigger === 'dot_tick' && relicIds.includes('sanguine_pact')) {
    if (state.heroBurnStacks > 0 || state.heroBleedStacks > 0) {
      state.enemyHP -= 2;
    }
  }
}
