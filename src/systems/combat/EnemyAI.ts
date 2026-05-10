// Enemy attack logic with independent cooldown and boss behavioral patterns.
// Zero Phaser imports.

import { eventBus } from '../../core/EventBus';
import type { CombatState } from './CombatState';
import type { CombatStats } from './CombatStats';
import type { BossBehavior } from '../../data/types';
import { applyDamageTakenRelics } from './RelicSystem';
import { rand } from '../SharedRNG';

export class EnemyAI {
  private cooldownTimer: number;
  private shieldTimer: number = 0;

  constructor(state: CombatState) {
    this.cooldownTimer = state.enemyAttackCooldown;
  }

  tick(deltaMs: number, state: CombatState, stats: CombatStats): void {
    this.cooldownTimer -= deltaMs;

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

      eventBus.emit('combat:enemy-attack', { damage: totalDamage, specialEffect, multiHit: true, hitCount: multiHit.hitCount });
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

    eventBus.emit('combat:enemy-attack', { damage: actualDamage, specialEffect });
  }

  private calculateDamage(state: CombatState, stats: CombatStats): number {
    switch (state.enemyPattern) {
      case 'fixed':
        return state.enemyDamage;
      case 'random':
        return state.enemyDamage * (0.8 + rand() * 0.4);
      case 'scaling':
        return state.enemyDamage + Math.floor(stats.cardsPlayed * 0.5);
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
   * Effective defense = heroDefense * heroDefenseMultiplier — Iron Body
   * (1.1) absorbs more, mage's natural 0.8 absorbs less. Defense absorbs
   * damage first, then remaining hits HP. Returns actual HP damage dealt.
   * `skipRelics=true` is used by multi-hit attacks so iron_will/phoenix
   * fire once for the whole attack, not once per hit.
   */
  private applyDamage(rawDamage: number, state: CombatState, skipRelics: boolean = false): number {
    const damage = rawDamage;
    const multiplier = state.heroDefenseMultiplier ?? 1;
    const effectiveDefense = Math.floor(state.heroDefense * multiplier);

    if (effectiveDefense >= damage) {
      // Consume the unscaled equivalent of `damage` from the raw defense pool.
      const consumed = multiplier > 0 ? Math.ceil(damage / multiplier) : 0;
      state.heroDefense = Math.max(0, state.heroDefense - consumed);
      return 0;
    }

    const remaining = damage - effectiveDefense;
    state.heroDefense = 0;
    state.heroHP = Math.max(0, state.heroHP - remaining);

    // Apply damage_taken relics (iron_will, phoenix_feather) unless caller
    // is batching them (multi-hit attacks invoke them once at the end).
    if (!skipRelics) {
      applyDamageTakenRelics(state.activeRelicIds ?? [], remaining, state);
    }

    return remaining;
  }
}
