// Card effect application with cost payment and targeting.
// Zero Phaser imports.

import type { CardDefinition, SynergyDefinition } from '../../data/types';
import type { CombatState } from './CombatState';
import type { SynergyBuff } from '../SynergyResolver';

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
   */
  canAfford(card: CardDefinition, state: CombatState): boolean {
    const isUpgraded = state.upgradedCards?.includes(card.id) ?? false;
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
  ): ResolveResult {
    const result: ResolveResult = { totalDamage: 0, healed: 0, armorGained: 0 };

    // Determine effective card properties (base or upgraded)
    const isUpgraded = state.upgradedCards?.includes(card.id) ?? false;
    const effectiveEffects = (isUpgraded && card.upgraded?.effects) ? card.upgraded.effects : card.effects;
    const effectiveCost = (isUpgraded && card.upgraded?.cost) ? card.upgraded.cost : card.cost;

    // Pay costs (unless synergy provides cost_waive)
    const waiveCost = synergyBonus?.bonus.type === 'cost_waive';
    if (effectiveCost && !waiveCost) {
      if (effectiveCost.stamina) state.heroStamina -= effectiveCost.stamina;
      if (effectiveCost.mana) state.heroMana -= effectiveCost.mana;
      if (effectiveCost.defense) state.heroDefense -= effectiveCost.defense;
    }

    // Apply each card effect
    for (const effect of effectiveEffects) {
      this.applyEffect(effect.type, effect.value, effect.target, state, result, extraDamageMultiplier);
    }

    // Apply synergy bonus effect (if not cost_waive)
    if (synergyBonus && synergyBonus.bonus.type !== 'cost_waive') {
      this.applyEffect(
        synergyBonus.bonus.type as 'damage' | 'heal' | 'armor' | 'stamina' | 'mana' | 'debuff',
        synergyBonus.bonus.value,
        synergyBonus.bonus.target as 'enemy' | 'self',
        state,
        result,
        extraDamageMultiplier,
      );
    }

    return result;
  }

  private applyEffect(
    type: string,
    value: number,
    target: string,
    state: CombatState,
    result: ResolveResult,
    damageMultiplier: number = 1.0,
  ): void {
    switch (type) {
      case 'damage': {
        if (target === 'self') {
          // Self-damage cards bypass strength scaling and enemy defense —
          // value is the literal HP loss the hero takes.
          const selfDamage = Math.max(0, Math.floor(value));
          state.heroHP = Math.max(0, state.heroHP - selfDamage);
          break;
        }

        // Floor damage at 1 for any positive-damage card so high-defense
        // enemies (e.g. Iron Golem def 8) can't soft-lock low-strength heroes.
        // Apply tile-adjacency damageBonus buffs (B.1) on top of card/relic
        // multipliers — buffs are flat additive on the multiplier (e.g. 0.20).
        const buffMult = getDamageBuffMultiplier();
        const computed = Math.floor((value * state.heroStrength * damageMultiplier * buffMult) - state.enemyDefense);
        const raw = value > 0 ? Math.max(1, computed) : Math.max(0, computed);
        state.enemyHP -= raw;
        result.totalDamage += raw;
        break;
      }
      case 'heal': {
        const before = state.heroHP;
        state.heroHP = Math.min(state.heroMaxHP, state.heroHP + value);
        result.healed += state.heroHP - before;
        break;
      }
      case 'armor': {
        state.heroDefense += value;
        result.armorGained += value;
        break;
      }
      case 'stamina': {
        state.heroStamina = Math.min(state.heroMaxStamina, state.heroStamina + value);
        break;
      }
      case 'mana': {
        state.heroMana = Math.min(state.heroMaxMana, state.heroMana + value);
        break;
      }
      case 'debuff': {
        state.enemyDefense = Math.max(0, state.enemyDefense - value);
        break;
      }
    }
  }
}
