// Card effect application with cost payment and targeting.
// Zero Phaser imports.

import type { CardDefinition, SynergyDefinition, StatId, StackId } from '../../data/types';
import type { CombatState } from './CombatState';
import type { SynergyBuff } from '../SynergyResolver';
import { readStat } from '../hero/HeroStatsResolver';

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
      this.applyEffect(
        effect.type, effect.value, effect.target, state, result,
        extraDamageMultiplier, effect.scale, effect.stack,
      );
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
      this.applyEffect(
        effectType,
        bonus.value,
        bonus.target as 'enemy' | 'self',
        state,
        result,
        extraDamageMultiplier,
        scaleShim,
        bonus.stack,
      );
    }

    return result;
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
          // value is the literal HP loss the hero takes. (Use resolvedValue
          // so DEX/INT scaling on self-cost cards still tracks the formula.)
          const selfDamage = Math.max(0, Math.floor(resolvedValue));
          state.heroHP = Math.max(0, state.heroHP - selfDamage);
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
        const raw = baseDmg > 0 ? Math.max(1, Math.floor(baseDmg - state.enemyDefense)) : 0;
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

      case 'gain_combo': {
        state.comboPoints = Math.min(
          state.comboPointsCap,
          state.comboPoints + resolvedValue,
        );
        break;
      }

      case 'consume_combo': {
        const cp = state.comboPoints;
        // Finisher damage = base * CP. Run through the same damage pipeline
        // (strength + buffs + defense) as a normal damage hit. value/cp=0 is
        // a valid (whiff) finisher per RESEARCH Pattern.
        const buffMult = getDamageBuffMultiplier();
        const baseDmg = resolvedValue * cp * state.heroStrength * damageMultiplier * buffMult;
        const raw = baseDmg > 0 ? Math.max(1, Math.floor(baseDmg - state.enemyDefense)) : 0;
        state.enemyHP -= raw;
        result.totalDamage += raw;
        state.comboPoints = 0;
        break;
      }

      case 'stealth': {
        // Stealth charge + 1-hit dodge guarantee per RESEARCH Pattern.
        state.stealthCharges = Math.min(
          state.stealthCap,
          state.stealthCharges + resolvedValue,
        );
        if (state.stealthCharges > 0) state.evadeNextHit = true;
        break;
      }

      case 'dot': {
        // Discriminate by effect.stack (default: poison).
        const which: StackId = stack ?? 'poison';
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
        // For stat_buff synergies, value carries the magnitude (scale.value=0
        // by shim). For card buff effects, resolvedValue may include the
        // scale boost; either way the per-axis write is the same.
        const magnitude = resolvedValue;
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
    }
  }
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
    case 'combo_point': return 'gain_combo';
    case 'stealth': return 'stealth';
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
