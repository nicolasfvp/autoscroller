// Enemy attack logic with independent cooldown and boss behavioral patterns.
// Zero Phaser imports.

import { eventBus } from '../../core/EventBus';
import type { CombatState } from './CombatState';
import type { CombatStats } from './CombatStats';
import type { BossBehavior } from '../../data/types';
import { applyDamageTakenRelics } from './RelicSystem';
import { rand } from '../SharedRNG';
import { applyEnemyAffinityEffect } from './EnemyAffinity';
import { fireTrigger, applyTriggeredPayload, fireHpThresholdTriggers } from './StatusEffects';

export class EnemyAI {
  private cooldownTimer: number;
  private shieldTimer: number = 0;

  constructor(state: CombatState) {
    this.cooldownTimer = state.enemyAttackCooldown;
  }

  tick(deltaMs: number, state: CombatState, stats: CombatStats): void {
    this.cooldownTimer -= deltaMs;

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
export function applyHeroDamage(rawDamage: number, state: CombatState, skipRelics: boolean = false): number {
  const damage = Math.max(0, Math.floor(rawDamage));
  if (damage === 0) return 0;
  const multiplier = state.heroDefenseMultiplier ?? 1;
  const effectiveDefense = state.heroDefense * multiplier;

  const remaining = Math.max(0, Math.floor(damage - effectiveDefense));
  // Armor consumed at face value — multiplier only shifts how much damage
  // each point of armor blocks, not how fast armor itself depletes.
  const armorBefore = state.heroDefense;
  state.heroDefense = Math.max(0, state.heroDefense - damage);

  // on_armor_break: triggered auras armed on the hero fire their `then`
  // payload when armor transitions from >0 to 0.
  if (armorBefore > 0 && state.heroDefense === 0 && state.heroAuras && state.heroAuras.length > 0) {
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

    if (!skipRelics) {
      applyDamageTakenRelics(state.activeRelicIds ?? [], remaining, state);
    }

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

  return remaining;
}
