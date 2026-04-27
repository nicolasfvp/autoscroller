// Enemy attack logic with independent cooldown and boss behavioral patterns.
// Zero Phaser imports.

import { eventBus } from '../../core/EventBus';
import type { CombatState } from './CombatState';
import type { CombatStats } from './CombatStats';
import type { BossBehavior } from '../../data/types';
import { applyDamageTakenRelics } from './RelicSystem';

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

  private getEffectiveCooldown(state: CombatState): number {
    let cooldown = state.enemyAttackCooldown;
    // Enrage: reduce cooldown when below HP threshold
    const behaviors = (state as any).behaviors as BossBehavior[] | undefined;
    const enrage = behaviors?.find(b => b.type === 'enrage');
    if (enrage && enrage.hpThreshold && enrage.attackSpeedMultiplier) {
      if (state.enemyHP / state.enemyMaxHP <= enrage.hpThreshold) {
        cooldown = cooldown / enrage.attackSpeedMultiplier;
      }
    }
    return cooldown;
  }

  private applyPeriodicBehaviors(deltaMs: number, state: CombatState): void {
    const behaviors = (state as any).behaviors as BossBehavior[] | undefined;
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
          if (Math.random() < 0.3) {
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

    const behaviors = (state as any).behaviors as BossBehavior[] | undefined;

    // Multi-hit behavior
    const multiHit = behaviors?.find(b => b.type === 'multi_hit');
    if (multiHit && multiHit.hitCount && multiHit.damageMultiplier) {
      let totalDamage = 0;
      const perHitDamage = Math.floor(damage * multiHit.damageMultiplier);
      for (let i = 0; i < multiHit.hitCount; i++) {
        const actualDmg = this.applyDamage(perHitDamage, state);
        totalDamage += actualDmg;
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
      const healAmount = Math.floor(actualDamage * 0.5);
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
        return state.enemyDamage * (0.8 + Math.random() * 0.4);
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
   * Defense absorbs damage first, then remaining hits HP.
   * Returns actual HP damage dealt.
   */
  private applyDamage(rawDamage: number, state: CombatState): number {
    const damage = Math.floor(rawDamage);

    if (state.heroDefense >= damage) {
      state.heroDefense -= damage;
      return 0;
    }

    const remaining = damage - state.heroDefense;
    state.heroDefense = 0;
    state.heroHP -= remaining;

    // Apply damage_taken relics (iron_will, phoenix_feather)
    applyDamageTakenRelics(state.activeRelicIds, remaining, state);

    return remaining;
  }
}
