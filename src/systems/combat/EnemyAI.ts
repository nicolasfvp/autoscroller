// Enemy attack logic with independent cooldown and boss behavioral patterns.
// Zero Phaser imports.

import { eventBus } from '../../core/EventBus';
import type { CombatState } from './CombatState';
import type { CombatStats } from './CombatStats';
import type { BossBehavior } from '../../data/types';
import { applyDamageTakenRelics } from './RelicSystem';
import { rand } from '../SharedRNG';
import { applyEnemyAffinityEffect } from './EnemyAffinity';
import { fireTrigger, applyTriggeredPayload, fireHpThresholdTriggers, fireRecurringTrigger, sumModifier, bumpEventCounters } from './StatusEffects';
import { readStat } from '../hero/HeroStatsResolver';

export class EnemyAI {
  private cooldownTimer: number;
  private shieldTimer: number = 0;

  constructor(state: CombatState) {
    this.cooldownTimer = state.enemyAttackCooldown;
  }

  tick(deltaMs: number, state: CombatState, stats: CombatStats): void {
    // Stun (renamed from freeze): while stunStacks >= 1, the enemy's attack
    // cooldown timer must not advance at all. We override the effectiveDelta
    // BEFORE applying the Slow scaling — stun outranks slow.
    let effectiveDelta = deltaMs;
    if (state.stunStacks > 0) {
      effectiveDelta = 0;
    } else {
      // Slow (renamed from shock) slows the enemy attack timer: 8% per stack,
      // capped at 50%. The stack count decays in CombatEngine.tickActiveDoTs
      // (~1/sec), so the slow naturally fades. Cooldown-shave recovery below
      // still uses real deltaMs so the agility affinity speedup decays at a
      // constant real-time rate.
      // C4 — Stormcaller's Rod: slow cap raised from 50% to 80%.
      const slowCap = state.activeRelicIds.includes('stormcallers_rod') ? 0.8 : 0.5;
      const slowFactor = Math.min(slowCap, state.slowStacks * 0.08);
      effectiveDelta = deltaMs * (1 - slowFactor);
    }
    this.cooldownTimer -= effectiveDelta;

    // Agility affinity gives a temporary cooldown shave; decay it back toward
    // the enemy's base cooldown so the speedup fades instead of ratcheting
    // forever. Rate: 100ms recovered per 1000ms of real time.
    if (state.enemyAttackCooldown < state.enemyBaseAttackCooldown) {
      const recover = deltaMs * 0.1;
      state.enemyAttackCooldown = Math.min(
        state.enemyBaseAttackCooldown,
        state.enemyAttackCooldown + recover,
      );
    }

    if (this.cooldownTimer <= 0) {
      this.attack(state, stats);
      this.cooldownTimer += this.getEffectiveCooldown(state);
    }

    // Apply periodic behaviors
    this.applyPeriodicBehaviors(deltaMs, state);
  }

  /** Returns the current cooldown timer (used for tie-break ordering with hero). */
  public getCooldownTimer(): number {
    return this.cooldownTimer;
  }

  private getEffectiveCooldown(state: CombatState): number {
    let cooldown = state.enemyAttackCooldown;
    // Enrage: reduce cooldown when below HP threshold
    const behaviors: BossBehavior[] | undefined = state.behaviors;
    const enrage = behaviors?.find(b => b.type === 'enrage');
    if (enrage && enrage.hpThreshold && enrage.attackSpeedMultiplier) {
      if (state.enemyHP / state.enemyMaxHP <= enrage.hpThreshold) {
        cooldown = cooldown / enrage.attackSpeedMultiplier;
      }
    }
    return cooldown;
  }

  private applyPeriodicBehaviors(deltaMs: number, state: CombatState): void {
    const behaviors: BossBehavior[] | undefined = state.behaviors;
    if (!behaviors || behaviors.length === 0) return;

    // Shield behavior: periodic armor gain
    const shield = behaviors.find(b => b.type === 'shield');
    if (shield && shield.interval && shield.shieldAmount) {
      this.shieldTimer += deltaMs;
      if (this.shieldTimer >= shield.interval) {
        this.shieldTimer -= shield.interval;
        state.enemyDefense += shield.shieldAmount;
        eventBus.emit('combat:boss-behavior', { type: 'shield', value: shield.shieldAmount });
      }
    }
  }

  private attack(state: CombatState, stats: CombatStats): void {
    // Bleed swing-amplification: flag is consumed by CombatEngine.tickActiveDoTs
    // on the next bleed tick to deal 2-per-stack instead of 1.
    state.enemyAttackedSinceLastBleedTick = true;
    let damage = this.calculateDamage(state, stats);
    let specialEffect: string | null = null;

    // Apply special effects
    if (state.enemySpecialEffect) {
      specialEffect = state.enemySpecialEffect;

      switch (state.enemySpecialEffect) {
        case 'double': {
          // 30% chance to double damage
          if (rand() < 0.3) {
            damage *= 2;
          }
          break;
        }
        case 'stun': {
          state.heroStunned = true;
          break;
        }
        // debuff and lifesteal applied after damage
      }
    }

    const behaviors: BossBehavior[] | undefined = state.behaviors;

    // Multi-hit behavior
    const multiHit = behaviors?.find(b => b.type === 'multi_hit');
    if (multiHit && multiHit.hitCount && multiHit.damageMultiplier) {
      let totalDamage = 0;
      const perHitDamage = Math.floor(damage * multiHit.damageMultiplier);
      for (let i = 0; i < multiHit.hitCount; i++) {
        // Skip per-hit damage_taken relic application; we run it once after
        // the full multi-hit lands. Otherwise iron_will defense compounds
        // hit-over-hit and phoenix can revive mid-loop only to be
        // re-killed by the next hit.
        const actualDmg = this.applyDamage(perHitDamage, state, /*skipRelics=*/true);
        totalDamage += actualDmg;
      }
      // Apply damage_taken relics once for the *attack*, using cumulative damage.
      if (totalDamage > 0) {
        applyDamageTakenRelics(state.activeRelicIds ?? [], totalDamage, state);
      }
      stats.damageReceived += totalDamage;

      // Drain behavior (heal from total damage)
      const drain = behaviors?.find(b => b.type === 'drain');
      if (drain && drain.healPercent) {
        const healAmount = Math.floor(totalDamage * drain.healPercent / 100);
        state.enemyHP = Math.min(state.enemyMaxHP, state.enemyHP + healAmount);
      }

      // Post-damage effects
      if (state.enemySpecialEffect === 'debuff') {
        state.heroDefense = Math.max(0, state.heroDefense - 1);
      }

      // Phase 10: element affinity (fires once per multi-hit attack)
      let mhAffinityFx = null;
      if (state.enemyAffinity) {
        mhAffinityFx = applyEnemyAffinityEffect(state, state.enemyAffinity, state.enemyType === 'boss');
        if (mhAffinityFx) {
          eventBus.emit('combat:enemy-affinity', { affinity: state.enemyAffinity, ...mhAffinityFx });
        }
      }

      eventBus.emit('combat:enemy-attack', { damage: totalDamage, specialEffect, multiHit: true, hitCount: multiHit.hitCount, affinityFx: mhAffinityFx });
      return;
    }

    // Single hit (existing logic)
    const actualDamage = this.applyDamage(damage, state);
    stats.damageReceived += actualDamage;

    // Post-damage special effects
    if (state.enemySpecialEffect === 'debuff') {
      state.heroDefense = Math.max(0, state.heroDefense - 1);
    }

    if (state.enemySpecialEffect === 'lifesteal') {
      // Lifesteal scales off the *attempted* damage, not the post-defense
      // amount — otherwise high hero armor nullifies lifesteal entirely.
      const healAmount = Math.floor(damage * 0.5);
      state.enemyHP = Math.min(state.enemyMaxHP, state.enemyHP + healAmount);
    }

    // Drain behavior (for single-hit bosses without multi_hit)
    const drain = behaviors?.find(b => b.type === 'drain');
    if (drain && drain.healPercent && state.enemySpecialEffect !== 'lifesteal') {
      const healAmount = Math.floor(actualDamage * drain.healPercent / 100);
      state.enemyHP = Math.min(state.enemyMaxHP, state.enemyHP + healAmount);
    }

    // Phase 10: element affinity secondary effect — fires on every landed
    // attack. Bosses get a 2x multiplier; effects are capped to prevent runaway.
    let affinityFx = null;
    if (state.enemyAffinity) {
      affinityFx = applyEnemyAffinityEffect(state, state.enemyAffinity, state.enemyType === 'boss');
      if (affinityFx) {
        eventBus.emit('combat:enemy-affinity', { affinity: state.enemyAffinity, ...affinityFx });
      }
    }

    eventBus.emit('combat:enemy-attack', { damage: actualDamage, specialEffect, affinityFx });
  }

  private calculateDamage(state: CombatState, stats: CombatStats): number {
    switch (state.enemyPattern) {
      case 'fixed':
        return state.enemyDamage;
      case 'random':
        return state.enemyDamage * (0.8 + rand() * 0.4);
      case 'scaling':
        return state.enemyDamage + Math.floor(stats.cardsPlayed * 0.16);
      case 'conditional':
        if (state.heroHP < state.heroMaxHP * 0.5) {
          return state.enemyDamage * 1.5;
        }
        return state.enemyDamage;
      default:
        return state.enemyDamage;
    }
  }

  /**
   * Apply raw damage to hero, accounting for defense.
   * B.6: heroDefenseMultiplier scales defense *effectiveness*, not capacity:
   *   - Iron Body (1.1) → +10% defense efficiency (less damage taken)
   *   - Mage natural   (0.8) → -20% defense efficiency (more damage taken)
   * Armor itself is consumed at face value (the raw `damage` amount), while
   * the damage-blocked is computed against the scaled effectiveDefense.
   * Returns actual HP damage dealt. `skipRelics=true` is used by multi-hit
   * attacks so iron_will/phoenix fire once for the whole attack.
   */
  private applyDamage(rawDamage: number, state: CombatState, skipRelics: boolean = false): number {
    return applyHeroDamage(rawDamage, state, skipRelics);
  }
}

/**
 * Shared hero-damage helper: routes any HP loss through armor, applying the
 * defenseMultiplier and the damage_taken relics. Exported so all damage
 * sources (basic attacks, affinity bleed/burn, card self-damage) share one
 * code path — armor must always be considered.
 */
export function applyHeroDamage(rawDamage: number, state: CombatState, skipRelics: boolean = false, pierceArmor: boolean = false, selfInflicted: boolean = false): number {
  // C1 — Apothecary's Vial: a one-time Barrier absorbs the next ENEMY hit fully.
  // It must NOT eat the hero's own self-damage card costs or self-DoT ticks —
  // those (incl. pierce_armor HP costs) are meant to be paid in full.
  let damage = Math.max(0, Math.floor(rawDamage));
  if (damage > 0 && state.barrierActive && !selfInflicted) {
    state.barrierActive = false;
    return 0;
  }
  // v3: damage_taken_pct — flat fractional mitigation summed across hero auras
  // (Crimson Regen Mantle: -0.20). Applied BEFORE armor so armor still
  // absorbs the post-mitigation amount.
  if (state.heroAuras && state.heroAuras.length > 0) {
    const dtp = sumModifier(state.heroAuras, 'damage_taken_pct');
    if (dtp !== 0) {
      damage = Math.max(0, Math.floor(damage * (1 + dtp)));
    }
  }
  // C5 — Glass Cannon: +50% damage taken from all sources.
  if (state.activeRelicIds.includes('glass_cannon')) {
    damage = Math.floor(damage * 1.5);
  }
  if (damage === 0) return 0;
  // pierceArmor: self-damage cards tagged `(Pierce)` skip armor absorption
  // entirely so the HP cost is paid in full regardless of current armor.
  if (pierceArmor) {
    state.heroHP = Math.max(0, state.heroHP - damage);
    if (state.lastHeroDamageMs !== undefined) state.lastHeroDamageMs = state.combatElapsedMs;
    // Rebalance phase: emit hp_lost for event_counter auras.
    const payloads = bumpEventCounters(state, 'hp_lost', { amount: damage });
    for (const p of payloads) applyTriggeredPayload(state, p.effect, p.sourceCardId);
    return damage;
  }
  // Rebalance (C3): VIT raises armor mitigation EFFICIENCY (not capacity) —
  // +3% per point above 1, capped at +50% — giving VIT a defensive identity
  // with NO armor→damage conversion. Reads effective VIT (auras + stat-gains).
  const vitMitigation = Math.min(0.5, Math.max(0, readStat(state, 'vit') - 1) * 0.03);
  const multiplier = (state.heroDefenseMultiplier ?? 1) + vitMitigation;
  const effectiveDefense = state.heroDefense * multiplier;

  let remaining = Math.max(0, Math.floor(damage - effectiveDefense));
  // C4 — Stoneheart Sigil: 5 flat damage-reduction floor (always blocks at least 5).
  if (state.activeRelicIds.includes('stoneheart_sigil')) {
    remaining = Math.max(0, remaining - 5);
  }
  // Armor consumed at face value — multiplier only shifts how much damage
  // each point of armor blocks, not how fast armor itself depletes.
  const armorBefore = state.heroDefense;
  state.heroDefense = Math.max(0, state.heroDefense - damage);
  const armorPrevented = armorBefore - state.heroDefense;
  const armorJustBroke = armorBefore > 0 && state.heroDefense === 0;

  // on_armor_break: triggered auras armed on the hero fire their `then`
  // payload when armor transitions from >0 to 0.
  if (armorJustBroke && state.heroAuras && state.heroAuras.length > 0) {
    const payloads = fireTrigger(state.heroAuras, 'on_armor_break');
    for (const p of payloads) {
      const r = applyTriggeredPayload(state, p);
      // Triggered damage goes to a transient bucket; not added to per-card
      // result tracking here. Stats are summed via the global combat:enemy-attack
      // path; trigger damage is incidental and small.
      void r;
    }
  }

  if (remaining > 0) {
    state.heroHP = Math.max(0, state.heroHP - remaining);

    // v4 Vengeance: mark the moment HP loss happened so cards with
    // `took_damage_within_ms` can detect a recent hit. Stored against the
    // synced combatElapsedMs from CombatEngine.tick. Self-DoT ticks and card
    // self-damage also route through here, so all real HP loss is captured.
    state.lastHeroDamageMs = state.combatElapsedMs;

    // Rebalance phase: emit hp_lost event for event_counter auras
    // (Searing Razor, Wrath Squall, Quickearth Rite). `amount` carries the
    // actual HP loss after mitigation+armor so filters like min_amount work.
    const payloads = bumpEventCounters(state, 'hp_lost', { amount: remaining });
    for (const p of payloads) applyTriggeredPayload(state, p.effect, p.sourceCardId);
  }

  // C3: dispatch damage_taken relics on every non-zero hit (even armor-only),
  // so brace, banded greaves, and iron will fire regardless of HP loss.
  if (!skipRelics && damage > 0) {
    applyDamageTakenRelics(state.activeRelicIds ?? [], {
      actualDamage: remaining,
      armorPrevented,
      armorJustBroke,
      rawDamage: damage,
    }, state);
  }

  if (remaining > 0) {

    // Tier-2 on_hp_pct_below trigger: any aura whose threshold the hero just
    // crossed downward fires its payload once.
    if (state.heroAuras && state.heroAuras.length > 0) {
      const heroHpPct = (state.heroHP / Math.max(1, state.heroMaxHP)) * 100;
      const hpPayloads = fireHpThresholdTriggers(state.heroAuras, heroHpPct);
      for (const p of hpPayloads) {
        applyTriggeredPayload(state, p);
      }
    }
  }

  // v3: recurring on_hit_taken triggers fire on every applied hit (regardless
  // of armor absorption). Persistent — aura stays alive for its full ttl.
  // Used by Forge Spike Ward, Wrathshell Vow, Last Stand reflexes.
  if (state.heroAuras && state.heroAuras.length > 0) {
    const hitTakenPayloads = fireRecurringTrigger(state.heroAuras, 'on_hit_taken', damage);
    for (const p of hitTakenPayloads) applyTriggeredPayload(state, p);
  }

  // v3: on_self_damage fires when the hit came from a card effect (skipRelics
  // is the proxy — card self-damage routes through here with skipRelics=true).
  if (skipRelics && state.heroAuras && state.heroAuras.length > 0) {
    const selfDmgPayloads = fireRecurringTrigger(state.heroAuras, 'on_self_damage', damage);
    for (const p of selfDmgPayloads) applyTriggeredPayload(state, p);
  }

  return remaining;
}
