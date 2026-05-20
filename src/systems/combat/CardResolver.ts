// Card effect application with cost payment and targeting.
// Zero Phaser imports.

import type { CardDefinition, CardEffect, SynergyDefinition, StatId, StackId, ScaleSourceKind } from '../../data/types';
import type { CombatState } from './CombatState';
import type { SynergyBuff } from '../SynergyResolver';
import { readStat } from '../hero/HeroStatsResolver';
import { applyHeroDamage } from './EnemyAI';
import { createAura, sumModifier, sumModifierStackScaled, fireRecurringTrigger, applyTriggeredPayload } from './StatusEffects';

export interface ResolveResult {
  totalDamage: number;
  healed: number;
  armorGained: number;
  /** v3: Overload — extra seconds to add to this card's next cooldown. */
  cooldownDebtSec?: number;
  /** v3: Tectonic Reckoning — request the engine to force-trigger all cards. */
  forceTriggerAll?: boolean;
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

/** v3: stack pool snapshot taken at the start of every card resolution. Used
 *  by `consume_stack_value` to multiply detonator damage by pre-cast count. */
export type PreConsumeSnapshot = Partial<Record<StackId, number>> & {
  hero_bleed?: number;
  hero_burn?: number;
  armor?: number;
};

export function snapshotStacks(state: CombatState): PreConsumeSnapshot {
  return {
    poison: state.poisonStacks,
    bleed: state.bleedStacks,
    burn: state.burnStacks,
    stun: state.stunStacks,
    slow: state.slowStacks,
    arcane: state.arcaneStacks,
    rage: state.rageStacks,
    hero_bleed: state.heroBleedStacks,
    hero_burn: state.heroBurnStacks,
    armor: state.heroDefense,
  };
}

/** Read the current stack count on either side. Mirrors readStackCount but
 *  is exported so other modules can use it during trigger payload resolution. */
export function getStackCount(state: CombatState, which: StackId, side: 'enemy' | 'self'): number {
  return readStackCount(state, which, side);
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

    // v3: Exhaust — a card with `exhaust:true` resolves at most once per combat.
    if (card.exhaust && state.spentThisCombat && state.spentThisCombat.has(card.id)) {
      return result;
    }

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

    // v3: capture pre-consume snapshot of every relevant stack pool so that
    // detonator effects with `consume_stack_value: <stack>` can read the
    // pre-cast count even when consume happens later in the same effects[].
    const preConsume: PreConsumeSnapshot = snapshotStacks(state);

    // v3: track consecutive multi-hit damage so that follow-up effects with
    // `per_hit: true` replicate once per individual hit.
    let lastMultiHitReps = 1;

    // Apply each card effect (Phase 9: pass scale + stack for new effect types)
    for (const effect of effectiveEffects) {
      const reps = (effect.per_hit && lastMultiHitReps > 1) ? lastMultiHitReps : 1;
      for (let i = 0; i < reps; i++) {
        this.applyCardEffect(effect, state, result, extraDamageMultiplier, card, preConsume);
      }
      if (effect.type === 'damage') {
        lastMultiHitReps = 1 + Math.max(0, effect.multi_hit ?? 0);
      }
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

    // v3: mark Exhaust card as spent for the remainder of this combat.
    if (card.exhaust) {
      if (!state.spentThisCombat) state.spentThisCombat = new Set<string>();
      state.spentThisCombat.add(card.id);
    }

    // v3: spend_armor — Citadel Inferno consumes ALL hero armor after detonator
    // damage resolves. Runs after damage scaling so source:"armor" reads the
    // pre-spend value, then drains.
    if (card.spend_armor === 'all') {
      state.heroDefense = 0;
    } else if (typeof card.spend_armor === 'number') {
      state.heroDefense = Math.max(0, state.heroDefense - card.spend_armor);
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
    preConsume?: PreConsumeSnapshot,
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
        if (cond.per_stack) effectiveValue *= stacks;
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
      // v3 conditions
      if (cond.enemy_stunned !== undefined) {
        const stunned = state.stunStacks > 0;
        if (stunned !== cond.enemy_stunned) return;
      }
      if (cond.enemy_stack_atleast) {
        const c = readStackCount(state, cond.enemy_stack_atleast.stack, 'enemy');
        if (c < cond.enemy_stack_atleast.value) return;
      }
      if (cond.self_stack_atleast) {
        const c = readStackCount(state, cond.self_stack_atleast.stack, 'self');
        if (c < cond.self_stack_atleast.value) return;
      }
      if (cond.devour_succeeded === true) {
        // v3 (Wave 3): chained payoff effects fire only if an earlier
        // `devour` effect in the same cast successfully consumed a slot.
        const ok = (result as ResolveResult & { _devourSucceeded?: boolean })._devourSucceeded === true;
        if (!ok) return;
      }
    }

    // v3: consume_stack_value multiplies the (post-scale) value by the
    // pre-cast snapshot of the named stack. This lets a single effect express
    // "deal N per <stack> consumed" for detonators (Supernova, Drowning Lance,
    // Crimson Spiral, Tremor Detonate, Thunderstrike Catalyst, ...).
    if (effect.consume_stack_value && preConsume) {
      const snap = preConsume[effect.consume_stack_value] ?? 0;
      effectiveValue *= snap;
      if (effectiveValue === 0) {
        // Nothing to do — but allow the dispatcher to still handle 0-value
        // armor/stamina/mana effects below (they'd be no-ops anyway).
      }
    }

    this.applyEffect(
      effect.type, effectiveValue, effect.target, state, result,
      damageMultiplier, effect.scale, effect.stack, card,
      effect.pierce_armor, effect,
    );

    // Pyre consume semantic: a damage effect gated by `enemy_has_stack: 'burn'`
    // AND `per_stack: true` is the Pyre keyword — after the damage applies,
    // consume the entire burn pool. Plain `Empowered (if Burn)` (no per_stack)
    // is NOT consumed; it remains a passive scaler. This MUST run only when
    // the effect actually fired (we early-returned above if the condition
    // gated the effect out, so by here, the burn stack count was > 0).
    if (
      effect.type === 'damage' &&
      cond?.enemy_has_stack === 'burn' &&
      cond?.per_stack === true
    ) {
      state.burnStacks = 0;
    }

    // v3: on_hit_dealt — fire recurring triggers when the hero lands a damage
    // hit on an enemy. Used by Razor Stance (bleed engine), among others.
    if (
      effect.type === 'damage' &&
      effect.target === 'enemy' &&
      state.heroAuras && state.heroAuras.length > 0
    ) {
      const payloads = fireRecurringTrigger(state.heroAuras, 'on_hit_dealt');
      for (const p of payloads) applyTriggeredPayload(state, p);
    }

    // v3: on_armor_gained — fire recurring triggers when armor goes up.
    // Used by Pyric Bulwark and Juggernaut-style cards. min_amount filter
    // is checked inside fireRecurringTrigger.
    if (
      effect.type === 'armor' &&
      effect.target === 'self' &&
      effectiveValue > 0 &&
      state.heroAuras && state.heroAuras.length > 0
    ) {
      const payloads = fireRecurringTrigger(state.heroAuras, 'on_armor_gained', Math.floor(effectiveValue));
      for (const p of payloads) applyTriggeredPayload(state, p);
    }
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
    scale?: { stat: StatId; per: number; value: number; source?: ScaleSourceKind; stack?: StackId; side?: 'enemy' | 'self'; pre_consume?: boolean },
    stack?: StackId,
    card?: CardDefinition,
    pierceArmor: boolean = false,
    rawEffect?: CardEffect,
  ): void {
    // Phase 9 stat scaling: resolvedValue = value + floor(statValue / per) * value
    // Tier-2: scale.source:"armor" reads current hero armor instead of a stat.
    let resolvedValue = value;
    if (scale && scale.per > 0 && scale.value !== 0) {
      const statValue = scale.source === 'armor'
        ? state.heroDefense
        : readStat(state, scale.stat);
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
        // v3: hero_hit_bonus — flat-per-hit addend, optionally scaled per
        // stack named in the aura's modifier.stack field (Iron Reckoning =
        // +value × Rage). Applied to the pre-multiplier value so STR scales it.
        const hitBonus = sumModifierStackScaled(state.heroAuras, 'hero_hit_bonus', state, 'self');
        // v3: Channel — payload scales with the card's base cooldown.
        // Longer-cooldown casts pay out a higher multiplier, capped by max_bonus.
        let channelMult = 1;
        if (rawEffect?.channel && card?.cooldown) {
          const cd = card.cooldown;
          const bonus = Math.min(rawEffect.channel.max_bonus, rawEffect.channel.ramp_per_sec * cd);
          channelMult = 1 + Math.max(0, bonus);
        }
        // v3: damage_dealt_pct — outgoing damage multiplier from hero auras
        // (Empower-style buffs). Combined multiplicatively with buffMult.
        const dealtPct = sumModifier(state.heroAuras, 'damage_dealt_pct');
        const dealtMult = 1 + dealtPct;
        const baseDmg = (resolvedValue + hitBonus) * state.heroStrength * damageMultiplier * buffMult * channelMult * dealtMult;
        // Enemy defense is the base value plus any timed 'def' aura modifiers
        // (negative values for debuffs — e.g. Crushing Blow's -2 aura).
        const effectiveEnemyDef = Math.max(0, state.enemyDefense + sumModifier(state.enemyAuras, 'def'));
        // pierce_armor skips the enemy-defense subtraction step.
        const perHit = baseDmg > 0
          ? (pierceArmor
              ? Math.max(1, Math.floor(baseDmg))
              : Math.max(1, Math.floor(baseDmg - effectiveEnemyDef)))
          : 0;
        // Tier-2: multi_hit:N applies the damage N+1 times in one effect.
        const totalHits = 1 + Math.max(0, rawEffect?.multi_hit ?? 0);
        const totalRaw = perHit * totalHits;
        state.enemyHP -= totalRaw;
        result.totalDamage += totalRaw;
        // v3: Siphon — heal a fraction of dealt damage. Capped at 50% of
        // current max HP per hit to prevent unlimited regen loops.
        if (rawEffect?.siphon && totalRaw > 0) {
          const lifesteal = Math.min(
            Math.floor(state.heroMaxHP * 0.5),
            Math.floor(totalRaw * rawEffect.siphon),
          );
          if (lifesteal > 0) {
            const before = state.heroHP;
            state.heroHP = Math.min(state.heroMaxHP, state.heroHP + lifesteal);
            result.healed += state.heroHP - before;
          }
        }
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
        // v3: armor_bonus_pct multiplies and armor_bonus_flat adds to every
        // armor gain while the aura (Reforge Vow's Reforce) is alive.
        let armorAmt = resolvedValue;
        if (state.heroAuras && state.heroAuras.length > 0) {
          const pct = sumModifier(state.heroAuras, 'armor_bonus_pct');
          const flat = sumModifier(state.heroAuras, 'armor_bonus_flat');
          armorAmt = Math.floor(armorAmt * (1 + pct) + flat);
        }
        state.heroDefense += armorAmt;
        result.armorGained += armorAmt;
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
        // v3: burn_taken — adds N to every burn application landed on the
        // bearer (enemy auras carry the vulnerability). Kindle Strike,
        // Pyre Surge apply this aura on the enemy.
        let appliedValue = resolvedValue;
        if (which === 'burn' && target === 'enemy' && state.enemyAuras && state.enemyAuras.length > 0) {
          appliedValue += sumModifier(state.enemyAuras, 'burn_taken');
        }
        switch (which) {
          case 'poison': state.poisonStacks += appliedValue; break;
          case 'bleed': state.bleedStacks += appliedValue; break;
          case 'burn': state.burnStacks += appliedValue; break;
          case 'stun': state.stunStacks += appliedValue; break;
          case 'slow': state.slowStacks += appliedValue; break;
          case 'arcane': state.arcaneStacks = Math.min(state.arcaneStacksCap, state.arcaneStacks + appliedValue); break;
          case 'rage': state.rageStacks += appliedValue; break;
        }
        // v3: on_slow_applied — Gale Echo's per-apply +1 slow extra.
        if (which === 'slow' && resolvedValue > 0 && state.heroAuras && state.heroAuras.length > 0) {
          const payloads = fireRecurringTrigger(state.heroAuras, 'on_slow_applied');
          for (const p of payloads) applyTriggeredPayload(state, p);
        }
        // v3: on_enemy_stack_threshold — Cinder Squall / Dust Plague follow-up.
        checkEnemyStackThreshold(state, which);
        // v3: on_stack_threshold (self-side stacks like rage).
        if (target === 'self' || target === 'self_dot') checkSelfStackThreshold(state, which);
        break;
      }

      case 'stack': {
        // Pitfall 8: arcane caps at arcaneStacksCap with silent truncation.
        // Tier-2 consume_stack: negative values that consume up to |value|
        // from the named target's current pool (clamped to existing count).
        // Used for threshold-and-spend payoffs (rage vents, burn detonators).
        const which: StackId = stack ?? 'arcane';
        if (rawEffect?.consume_stack && resolvedValue < 0) {
          const wantConsume = -resolvedValue;
          const consumeFrom = (cur: number) => Math.max(0, cur - Math.min(cur, wantConsume));
          if (target === 'enemy') {
            switch (which) {
              case 'poison': state.poisonStacks = consumeFrom(state.poisonStacks); break;
              case 'bleed': state.bleedStacks = consumeFrom(state.bleedStacks); break;
              case 'burn': state.burnStacks = consumeFrom(state.burnStacks); break;
              case 'stun': state.stunStacks = consumeFrom(state.stunStacks); break;
              case 'slow': state.slowStacks = consumeFrom(state.slowStacks); break;
              case 'arcane': state.arcaneStacks = consumeFrom(state.arcaneStacks); break;
              case 'rage': state.rageStacks = consumeFrom(state.rageStacks); break;
            }
          } else {
            // self consume — rage / bleed / burn pools live on hero side
            switch (which) {
              case 'rage': state.rageStacks = consumeFrom(state.rageStacks); break;
              case 'burn': state.heroBurnStacks = consumeFrom(state.heroBurnStacks); break;
              case 'bleed': state.heroBleedStacks = consumeFrom(state.heroBleedStacks); break;
              case 'arcane': state.arcaneStacks = consumeFrom(state.arcaneStacks); break;
              default: break;
            }
          }
          break;
        }
        switch (which) {
          case 'arcane': state.arcaneStacks = Math.min(state.arcaneStacksCap, state.arcaneStacks + resolvedValue); break;
          case 'rage': state.rageStacks += resolvedValue; break;
          case 'poison': state.poisonStacks += resolvedValue; break;
          case 'bleed': state.bleedStacks += resolvedValue; break;
          case 'burn': state.burnStacks += resolvedValue; break;
          case 'stun': state.stunStacks += resolvedValue; break;
          case 'slow': state.slowStacks += resolvedValue; break;
        }
        // v3: threshold triggers fire after the stack mutation. Target=self
        // routes to checkSelfStackThreshold (Wrath Squall rage cap, etc.).
        if (target === 'self') {
          checkSelfStackThreshold(state, which);
        } else if (target === 'enemy') {
          checkEnemyStackThreshold(state, which);
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

      // -- v3 archetype redesign effect types --

      case 'multiply_stack': {
        // Multiplica os stacks atuais do alvo por `factor` (Catalyst pattern).
        const stk = stack;
        const factor = Math.max(1, rawEffect?.factor ?? 2);
        if (!stk) break;
        const cur = readStackCount(state, stk, target === 'self' ? 'self' : 'enemy');
        const after = Math.floor(cur * factor);
        const delta = after - cur;
        if (delta <= 0) break;
        addStack(state, stk, target === 'self' ? 'self' : 'enemy', delta);
        break;
      }

      case 'stack_boost': {
        // Soma `value` (already scaled) PRESENTE PARA CADA stack do alvo.
        // Não cria novos stacks; engrossa os atuais. Pyre Surge pattern.
        const stk = stack;
        if (!stk) break;
        const cur = readStackCount(state, stk, target === 'self' ? 'self' : 'enemy');
        if (cur <= 0) break;
        const add = Math.max(0, Math.floor(resolvedValue) * cur);
        if (add <= 0) break;
        addStack(state, stk, target === 'self' ? 'self' : 'enemy', add);
        break;
      }

      case 'convert_stack': {
        // Gasta até `value` stacks de `from` do alvo, gera `to` stacks
        // (multiplicados por `factor` se presente) no mesmo alvo. Convert
        // de stacks-para-armor é um caso especial: o `to:"armor"` empurra
        // pro heroDefense via tipo `armor`. cap limita o resultado.
        const fromStack = rawEffect?.from;
        const toStack = rawEffect?.to;
        if (!fromStack) break;
        const side = target === 'self' ? 'self' : 'enemy';
        const cur = readStackCount(state, fromStack, side);
        const requested = Math.max(0, resolvedValue);
        const consumed = Math.min(cur, requested === 0 ? cur : requested);
        if (consumed <= 0 && (toStack !== 'armor' as StackId)) break;
        // consume
        addStack(state, fromStack, side, -consumed);
        if (toStack) {
          let produced = consumed * (rawEffect?.factor ?? 1);
          if (rawEffect?.cap !== undefined) produced = Math.min(produced, rawEffect.cap);
          if ((toStack as string) === 'armor') {
            state.heroDefense += produced;
            result.armorGained += produced;
          } else {
            addStack(state, toStack as StackId, side, produced);
          }
        }
        break;
      }

      case 'echo': {
        // v3: Echo — next N card resolutions repeat. `echoExpiresAt` is treated
        // as a countdown timer (ms remaining) by CombatEngine.tick(), so any
        // unused charges decay with the window.
        const charges = Math.max(0, Math.floor(resolvedValue));
        if (charges <= 0) break;
        state.echoCharges += charges;
        const ttl = rawEffect?.ttl_ms;
        const finiteTtl = ttl == null || ttl === undefined ? 8000 : (ttl as number);
        state.echoExpiresAt = Math.max(state.echoExpiresAt, finiteTtl);
        break;
      }
      case 'cd_debt': {
        // v3: Overload — push extra seconds onto this card's next cooldown.
        // Surfaced through ResolveResult and consumed by CombatEngine.
        result.cooldownDebtSec = (result.cooldownDebtSec ?? 0) + Math.max(0, resolvedValue);
        break;
      }
      case 'devour': {
        // v3: Vengeful Pyre — consume a random deck slot matching rarity for
        // the remainder of this combat. The mark is read by
        // CombatEngine.advanceDeckPointer to skip the slot.
        if (!rawEffect?.devour?.from_deck) break;
        const wantRarity = rawEffect.devour.rarity;
        const wantCount = Math.max(1, rawEffect.devour.count ?? 1);
        const candidates: number[] = [];
        for (let i = 0; i < state.deckOrder.length; i++) {
          if (state.devouredSlots.has(i)) continue;
          if (card && state.deckOrder[i] === card.id) continue; // don't eat self
          // Rarity check needs a card lookup; since the resolver doesn't have
          // getCardById imported, fall back to "any non-self slot". This
          // keeps the keyword functional; balance via card cost/cooldown.
          void wantRarity;
          candidates.push(i);
        }
        // Pick deterministic-ish slot to avoid RNG plumbing here: pick the
        // farthest-forward candidate (oldest non-self). Players still feel
        // the loss; engine doesn't care about randomness for this.
        let chosenCount = 0;
        for (const idx of candidates) {
          if (chosenCount >= wantCount) break;
          state.devouredSlots.add(idx);
          chosenCount++;
        }
        // Mark devour_succeeded for chained conditional effects in the same
        // effects[] array via a transient field on the result.
        (result as ResolveResult & { _devourSucceeded?: boolean })._devourSucceeded = chosenCount > 0;
        break;
      }
      case 'force_trigger_all_cards': {
        // v3: Tectonic Reckoning — request CombatEngine to force-resolve every
        // non-self, non-exhausted deck slot once. Bubbles up via ResolveResult.
        result.forceTriggerAll = true;
        break;
      }
    }
  }
}

/** v3: fire on_stack_threshold auras on the hero side when a stack crosses
 *  its named threshold. Each aura runs at most once per its internal cooldown. */
function checkSelfStackThreshold(state: CombatState, which: StackId): void {
  if (!state.heroAuras || state.heroAuras.length === 0) return;
  const cur = readStackCount(state, which, 'self');
  const fired: CardEffect[] = [];
  for (const a of state.heroAuras) {
    if (a.trigger !== 'on_stack_threshold') continue;
    if (a.threshold_stack !== which) continue;
    if (a.threshold === undefined || cur < a.threshold) continue;
    if (a.nextFireInMs && a.nextFireInMs > 0) continue;
    if (!a.then) continue;
    const arr = Array.isArray(a.then) ? a.then : [a.then];
    for (const e of arr) fired.push(e);
    if (a.cooldownMs && a.cooldownMs > 0) a.nextFireInMs = a.cooldownMs;
  }
  for (const e of fired) applyTriggeredPayload(state, e);
}

function checkEnemyStackThreshold(state: CombatState, which: StackId): void {
  if (!state.heroAuras || state.heroAuras.length === 0) return;
  const cur = readStackCount(state, which, 'enemy');
  const fired: CardEffect[] = [];
  for (const a of state.heroAuras) {
    if (a.trigger !== 'on_enemy_stack_threshold') continue;
    if (a.threshold_stack !== which) continue;
    if (a.threshold === undefined || cur < a.threshold) continue;
    if (a.nextFireInMs && a.nextFireInMs > 0) continue;
    if (!a.then) continue;
    const arr = Array.isArray(a.then) ? a.then : [a.then];
    for (const e of arr) fired.push(e);
    if (a.cooldownMs && a.cooldownMs > 0) a.nextFireInMs = a.cooldownMs;
  }
  for (const e of fired) applyTriggeredPayload(state, e);
}

/** Add (or subtract via negative `amount`) stacks of a given name on a side. */
function addStack(state: CombatState, which: StackId, side: 'enemy' | 'self', amount: number): void {
  if (amount === 0) return;
  if (side === 'self') {
    switch (which) {
      case 'rage': state.rageStacks = Math.max(0, state.rageStacks + amount); return;
      case 'burn': state.heroBurnStacks = Math.max(0, state.heroBurnStacks + amount); return;
      case 'bleed': state.heroBleedStacks = Math.max(0, state.heroBleedStacks + amount); return;
      case 'arcane':
        state.arcaneStacks = Math.min(state.arcaneStacksCap, Math.max(0, state.arcaneStacks + amount));
        return;
      default: return;
    }
  }
  switch (which) {
    case 'poison': state.poisonStacks = Math.max(0, state.poisonStacks + amount); return;
    case 'bleed': state.bleedStacks = Math.max(0, state.bleedStacks + amount); return;
    case 'burn': state.burnStacks = Math.max(0, state.burnStacks + amount); return;
    case 'stun': state.stunStacks = Math.max(0, state.stunStacks + amount); return;
    case 'slow': state.slowStacks = Math.max(0, state.slowStacks + amount); return;
    case 'rage': state.rageStacks = Math.max(0, state.rageStacks + amount); return;
    case 'arcane':
      state.arcaneStacks = Math.min(state.arcaneStacksCap, Math.max(0, state.arcaneStacks + amount));
      return;
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
    case 'stun': return state.stunStacks;
    case 'slow': return state.slowStacks;
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
