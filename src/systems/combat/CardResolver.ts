// Card effect application with cost payment and targeting.
// Zero Phaser imports.

import type { CardDefinition, CardEffect, CardEffectCondition, SynergyDefinition, StatId, StackId } from '../../data/types';
import type { CombatState } from './CombatState';
import type { SynergyBuff } from '../SynergyResolver';
import { readStat } from '../hero/HeroStatsResolver';
import { applyHeroDamage } from './EnemyAI';
import { createAura, sumModifier } from './StatusEffects';

export interface ResolveResult {
  totalDamage: number;
  healed: number;
  armorGained: number;
}

// Module-level active adjacency buffs from LoopRunner.
// `damageBonus` is summed and added as a flat damage multiplier (e.g. 0.20 → +20%).
let activeBuffs: SynergyBuff[] = [];

export function setActiveBuffs(buffs: SynergyBuff[]): void {
  activeBuffs = buffs ?? [];
}

export function clearActiveBuffs(): void {
  activeBuffs = [];
}

function getDamageBuffMultiplier(): number {
  let bonus = 0;
  for (const buff of activeBuffs) {
    if (buff.type === 'damageBonus') bonus += buff.value;
  }
  return 1 + bonus;
}

export class CardResolver {
  /**
   * Check if the hero can afford to play a card given current state.
   * `isUpgraded` is supplied by the caller (CombatEngine reads
   * `state.upgraded[deckPointer]`).
   */
  canAfford(card: CardDefinition, state: CombatState, isUpgraded: boolean = false): boolean {
    const cost = (isUpgraded && card.upgraded?.cost) ? card.upgraded.cost : card.cost;
    if (!cost) return true;
    if (cost.stamina !== undefined && state.heroStamina < cost.stamina) return false;
    if (cost.mana !== undefined && state.heroMana < cost.mana) return false;
    if (cost.defense !== undefined && state.heroDefense < cost.defense) return false;
    return true;
  }

  /**
   * Resolve a card: pay costs, apply effects, apply synergy bonus.
   * Mutates state in-place. Returns summary of what happened.
   */
  resolve(
    card: CardDefinition,
    state: CombatState,
    synergyBonus: SynergyDefinition | null,
    extraDamageMultiplier: number = 1.0,
    isUpgraded: boolean = false,
  ): ResolveResult {
    const result: ResolveResult = { totalDamage: 0, healed: 0, armorGained: 0 };

    // Determine effective card properties (base or upgraded). Caller passes
    // the per-position upgrade flag from `state.upgraded[deckPointer]`.
    const effectiveEffects = (isUpgraded && card.upgraded?.effects) ? card.upgraded.effects : card.effects;
    const effectiveCost = (isUpgraded && card.upgraded?.cost) ? card.upgraded.cost : card.cost;

    // Pay costs (unless synergy provides cost_waive)
    const waiveCost = synergyBonus?.bonus.type === 'cost_waive';
    if (effectiveCost && !waiveCost) {
      if (effectiveCost.stamina) state.heroStamina -= effectiveCost.stamina;
      if (effectiveCost.mana) state.heroMana -= effectiveCost.mana;
      if (effectiveCost.defense) state.heroDefense -= effectiveCost.defense;
    }

    // Apply each card effect (Phase 9: pass scale + stack for new effect types)
    for (const effect of effectiveEffects) {
      this.applyCardEffect(effect, state, result, extraDamageMultiplier, card);
    }

    // Apply synergy bonus effect (if not cost_waive). Phase 9 (D-13 b) routes
    // new bonus types through the same applyEffect dispatcher via a
    // bonus -> effect type map. stat_buff carries a stat (encoded via a
    // synthesized scale shim so existing applyEffect signature is reused).
    if (synergyBonus && synergyBonus.bonus.type !== 'cost_waive') {
      const bonus = synergyBonus.bonus;
      const effectType = mapBonusToEffectType(bonus.type);
      const scaleShim: { stat: StatId; per: number; value: number } | undefined =
        bonus.type === 'stat_buff' && bonus.stat
          ? { stat: bonus.stat, per: 1, value: 0 } // carries stat axis for `buff` case
          : undefined;
      const synergyEffect: CardEffect = {
        type: effectType as CardEffect['type'],
        value: bonus.value,
        target: bonus.target as CardEffect['target'],
        scale: scaleShim,
        stack: bonus.stack as StackId | undefined,
      };
      this.applyCardEffect(synergyEffect, state, result, extraDamageMultiplier, card);
    }

    return result;
  }

  /**
   * Wrapper around applyEffect that evaluates the optional `condition` block
   * before dispatch. A condition either gates the effect entirely (skip if
   * predicate fails) OR multiplies its value by an enemy-stack count when
   * `per_stack` is true. Threaded through so synergy bonuses share the same
   * path.
   */
  private applyCardEffect(
    effect: CardEffect,
    state: CombatState,
    result: ResolveResult,
    damageMultiplier: number,
    card?: CardDefinition,
  ): void {
    const cond = effect.condition;
    let effectiveValue = effect.value;

    if (cond) {
      if (cond.enemy_has_stack !== undefined) {
        const stacks = readStackCount(state, cond.enemy_has_stack, 'enemy');
        if (!cond.per_stack) {
          if (stacks <= 0) return;
        } else {
          if (stacks <= 0) return;
          effectiveValue *= stacks;
        }
      }
      if (cond.self_has_stack !== undefined) {
        const stacks = readStackCount(state, cond.self_has_stack, 'self');
        if (stacks <= 0) return;
      }
      if (cond.hero_hp_pct_below !== undefined) {
        const pct = (state.heroHP / Math.max(1, state.heroMaxHP)) * 100;
        if (pct >= cond.hero_hp_pct_below) return;
      }
      if (cond.hero_hp_pct_atleast !== undefined) {
        const pct = (state.heroHP / Math.max(1, state.heroMaxHP)) * 100;
        if (pct < cond.hero_hp_pct_atleast) return;
      }
      if (cond.self_armor_atleast !== undefined) {
        if (state.heroDefense < cond.self_armor_atleast) return;
      }
    }

    this.applyEffect(
      effect.type, effectiveValue, effect.target, state, result,
      damageMultiplier, effect.scale, effect.stack, card,
      effect.pierce_armor, effect,
    );
  }

  /**
   * Apply a single effect to combat state. Phase 9: supports the 8 new
   * CardEffect.type cases plus optional stat scaling (scale) and stack
   * discriminator for dot/stack effects.
   */
  private applyEffect(
    type: string,
    value: number,
    target: string,
    state: CombatState,
    result: ResolveResult,
    damageMultiplier: number = 1.0,
    scale?: { stat: StatId; per: number; value: number },
    stack?: StackId,
    card?: CardDefinition,
    pierceArmor: boolean = false,
    rawEffect?: CardEffect,
  ): void {
    // Phase 9 stat scaling: resolvedValue = value + floor(statValue / per) * value
    let resolvedValue = value;
    if (scale && scale.per > 0 && scale.value !== 0) {
      const statValue = readStat(state, scale.stat);
      resolvedValue = value + Math.floor(statValue / scale.per) * scale.value;
    }

    switch (type) {
      case 'damage': {
        if (target === 'self') {
          // Self-damage cards bypass strength scaling and enemy defense —
          // value is the literal HP loss the hero takes. Routed through
          // applyHeroDamage so the player's current armor still absorbs it
          // (all damage paths now respect armor).
          const selfDamage = Math.max(0, Math.floor(resolvedValue));
          applyHeroDamage(selfDamage, state, /*skipRelics=*/true);
          break;
        }

        // B.5: floor damage at 1 for any positive-damage card so high-defense
        // enemies (e.g. Iron Golem def 8) can't soft-lock low-strength heroes.
        // Phase 9: INT adds +1 flat damage per point on magic-category effects
        // (design/00 §3). We don't know the card category at this layer, so
        // INT scaling is applied via the explicit `scale: { stat: 'int' }`
        // metadata on magic cards — keeps the resolver category-agnostic.
        const buffMult = getDamageBuffMultiplier();
        const baseDmg = resolvedValue * state.heroStrength * damageMultiplier * buffMult;
        // Enemy defense is the base value plus any timed 'def' aura modifiers
        // (negative values for debuffs — e.g. Crushing Blow's -2 aura).
        const effectiveEnemyDef = Math.max(0, state.enemyDefense + sumModifier(state.enemyAuras, 'def'));
        // pierce_armor skips the enemy-defense subtraction step.
        const raw = baseDmg > 0
          ? (pierceArmor
              ? Math.max(1, Math.floor(baseDmg))
              : Math.max(1, Math.floor(baseDmg - effectiveEnemyDef)))
          : 0;
        state.enemyHP -= raw;
        result.totalDamage += raw;
        break;
      }
      case 'heal': {
        // Phase 9: SPI scales healing received (+10% per point per design/00
        // §3). Multiplier applied on top of resolvedValue (which already
        // includes any explicit scale clause).
        const spiBonus = Math.floor(resolvedValue * (state.heroSpirit * 0.10));
        const totalHeal = resolvedValue + spiBonus;
        const before = state.heroHP;
        state.heroHP = Math.min(state.heroMaxHP, state.heroHP + totalHeal);
        result.healed += state.heroHP - before;
        break;
      }
      case 'armor': {
        state.heroDefense += resolvedValue;
        result.armorGained += resolvedValue;
        break;
      }
      case 'stamina': {
        state.heroStamina = Math.min(state.heroMaxStamina, state.heroStamina + resolvedValue);
        break;
      }
      case 'mana': {
        state.heroMana = Math.min(state.heroMaxMana, state.heroMana + resolvedValue);
        break;
      }
      case 'debuff': {
        state.enemyDefense = Math.max(0, state.enemyDefense - resolvedValue);
        break;
      }

      // -- Phase 9 (Design v2) new effect types --

      case 'dot': {
        // Discriminate by effect.stack (default: poison).
        const which: StackId = stack ?? 'poison';
        // target='self_dot' routes the stack onto the hero as an HP-over-time
        // cost (Tide-Tempered Blade / Bloodtide Mend). Only burn and bleed
        // are wired to hero pools; other stacks fall through as a no-op when
        // self-targeted because they'd require new hero pools.
        if (target === 'self_dot') {
          if (which === 'burn') state.heroBurnStacks += resolvedValue;
          else if (which === 'bleed') state.heroBleedStacks += resolvedValue;
          break;
        }
        switch (which) {
          case 'poison': state.poisonStacks += resolvedValue; break;
          case 'bleed': state.bleedStacks += resolvedValue; break;
          case 'burn': state.burnStacks += resolvedValue; break;
          case 'freeze': state.freezeStacks += resolvedValue; break;
          case 'shock': state.shockStacks += resolvedValue; break;
          case 'arcane': state.arcaneStacks = Math.min(state.arcaneStacksCap, state.arcaneStacks + resolvedValue); break;
          case 'rage': state.rageStacks += resolvedValue; break;
        }
        break;
      }

      case 'stack': {
        // Pitfall 8: arcane caps at arcaneStacksCap with silent truncation.
        const which: StackId = stack ?? 'arcane';
        switch (which) {
          case 'arcane': state.arcaneStacks = Math.min(state.arcaneStacksCap, state.arcaneStacks + resolvedValue); break;
          case 'rage': state.rageStacks += resolvedValue; break;
          case 'poison': state.poisonStacks += resolvedValue; break;
          case 'bleed': state.bleedStacks += resolvedValue; break;
          case 'burn': state.burnStacks += resolvedValue; break;
          case 'freeze': state.freezeStacks += resolvedValue; break;
          case 'shock': state.shockStacks += resolvedValue; break;
        }
        break;
      }

      case 'buff': {
        // Per-combat additive buff to a CombatState stat axis. Critical
        // boundary (T-09-03-01): mutate state.heroXxx ONLY, NEVER run.hero.
        const which: StatId = scale?.stat ?? 'str';
        // Buff magnitude is always the base `value` — never resolvedValue.
        // The `scale.stat` here names the *target* stat, not a scaling axis;
        // applying the resolved (scaled) value re-enters the same stat each
        // play and produces exponential self-feedback (Stoneskin/Dancer's
        // Guard buffing VIT/DEX off their own current VIT/DEX).
        //
        // Per-card per-battle cap: tier 1 -> 5, tier 2 -> 10. Higher tiers
        // and untagged cards stay uncapped. Without this, a deck that cycles
        // a +1 VIT card many times still snowballs across long boss fights.
        let magnitude = value;
        if (card?.id) {
          const tierCap = card.tier === 1 ? 5 : card.tier === 2 ? 10 : Infinity;
          const already = state.buffMagnitudePerCard[card.id] ?? 0;
          const remaining = Math.max(0, tierCap - already);
          magnitude = Math.min(magnitude, remaining);
          if (magnitude <= 0) break;
          state.buffMagnitudePerCard[card.id] = already + magnitude;
        }
        switch (which) {
          case 'str': state.heroStrength += magnitude; break;
          case 'vit': state.heroVitality += magnitude; break;
          case 'dex': state.heroDexterity += magnitude; break;
          case 'int': state.heroIntellect += magnitude; break;
          case 'spi': state.heroSpirit += magnitude; break;
        }
        break;
      }

      case 'debuff_stat': {
        // Enemies have no stat axes in v2 -- forward-compatible stub.
        // (If a future enemy gains stat axes, this is the seam to extend.)
        break;
      }

      case 'taunt': {
        // No engine behavior specified for v2 -- stub. Future: state.taunted
        // or turn-skip flag. Leaving as no-op so JSON content authored with
        // `taunt` effects compiles and runs without throwing.
        break;
      }

      case 'aura': {
        // Time-decaying status effect. Modifier auras add a value to a stat
        // axis or `cd_reduction` while alive; triggered auras (e.g.
        // on_armor_break) sit armed and fire their `then` effect once.
        if (!rawEffect) break;
        const aura = createAura(rawEffect);
        if (target === 'enemy') state.enemyAuras.push(aura);
        else state.heroAuras.push(aura);
        break;
      }
    }
  }
}

/** Read the current stack count of a named DoT/stack on the named target. */
function readStackCount(state: CombatState, which: StackId, side: 'self' | 'enemy'): number {
  if (side === 'self') {
    switch (which) {
      case 'burn': return state.heroBurnStacks;
      case 'bleed': return state.heroBleedStacks;
      case 'rage': return state.rageStacks;
      case 'arcane': return state.arcaneStacks;
      default: return 0;
    }
  }
  switch (which) {
    case 'poison': return state.poisonStacks;
    case 'bleed': return state.bleedStacks;
    case 'burn': return state.burnStacks;
    case 'freeze': return state.freezeStacks;
    case 'shock': return state.shockStacks;
    case 'arcane': return state.arcaneStacks;
    case 'rage': return state.rageStacks;
  }
  return 0;
}

/**
 * Read an aura-modified stat. Stat reads in CardResolver `scale` paths and
 * EnemyAI `getEffectiveStat` should consult this so timed +DEX / +VIT auras
 * actually feed scaling.
 */
export function getEffectiveStat(state: CombatState, stat: 'str' | 'vit' | 'dex' | 'int' | 'spi'): number {
  const baseMap: Record<string, number> = {
    str: state.heroStrength,
    vit: state.heroVitality,
    dex: state.heroDexterity,
    int: state.heroIntellect,
    spi: state.heroSpirit,
  };
  return baseMap[stat] + sumModifier(state.heroAuras, stat as 'str' | 'vit' | 'dex' | 'int' | 'spi');
}

/**
 * Map a SynergyDefinition.bonus.type to the CardResolver effect type the
 * shared applyEffect dispatcher understands. Phase 9 (D-13 b).
 * Existing v1 bonus types pass through; new v2 bonus types route to the
 * new effect cases.
 */
function mapBonusToEffectType(bonusType: string): string {
  switch (bonusType) {
    case 'damage':
    case 'heal':
    case 'armor':
    case 'stamina':
    case 'mana':
    case 'debuff':
      return bonusType;
    // Phase 9
    case 'dot': return 'dot';
    case 'stat_buff': return 'buff';
    // cooldown_reduction is handled outside CardResolver (CombatEngine) —
    // routing it through `buff` would mutate the wrong axis. Return a token
    // that no case matches so applyEffect is a no-op; CombatEngine reads the
    // synergy bonus directly to shorten the next card's cooldown.
    case 'cooldown_reduction': return 'cooldown_reduction';
    default: return bonusType;
  }
}
