// Core tick-driven combat loop with zero Phaser imports.
// All combat logic driven by tick(deltaMs) calls from the scene layer.

import { eventBus } from '../../core/EventBus';
import { getCardById } from '../../data/DataLoader';
import type { CardDefinition } from '../../data/types';
import type { CombatState } from './CombatState';
import { createEmptyCombatStats, type CombatStats } from './CombatStats';
import { CardResolver } from './CardResolver';
import { EnemyAI } from './EnemyAI';
import { SynergySystem } from './SynergySystem';
import { resolveCardPlayedRelicBonus } from './RelicSystem';
import { checkConditionalTrigger } from '../hero/PassiveSkillSystem';

/** Passive regen interval in milliseconds */
const REGEN_INTERVAL = 3000;
/** Stamina restored per regen tick */
const STAMINA_REGEN = 2;
/** Mana restored per regen tick */
const MANA_REGEN = 1;
/** Retry delay when all cards are unaffordable */
const RETRY_DELAY = 500;

export class CombatEngine {
  private state: CombatState;
  private stats: CombatStats;
  private cardResolver: CardResolver;
  private enemyAI: EnemyAI;
  private synergies: SynergySystem;

  private consecutiveAttacks = 0;
  private heroCooldownTimer = 0; // starts at 0 so first card plays immediately
  private deckPointer = 0;
  private lastPlayedCardId: string | null = null;
  private isFinished = false;

  private regenAccumulator = 0;

  constructor(state: CombatState) {
    this.state = state;
    this.stats = createEmptyCombatStats(state.enemyId, state.enemyName);
    this.cardResolver = new CardResolver();
    this.enemyAI = new EnemyAI(state);
    this.synergies = new SynergySystem();
  }

  tick(deltaMs: number): void {
    if (this.isFinished) return;

    // Hero card play
    this.heroCooldownTimer -= deltaMs;
    if (this.heroCooldownTimer <= 0) {
      this.playNextCard();
    }

    // Check end conditions after hero plays
    if (this.checkEndConditions()) return;

    // Enemy AI
    this.enemyAI.tick(deltaMs, this.state, this.stats);

    // Check end conditions after enemy attacks
    if (this.checkEndConditions()) return;

    // Passive regen
    this.applyPassiveRegen(deltaMs);
  }

  private playNextCard(): void {
    if (this.state.deckOrder.length === 0) {
      this.heroCooldownTimer = RETRY_DELAY;
      return;
    }

    // If hero is stunned, skip this turn
    if (this.state.heroStunned) {
      this.state.heroStunned = false;
      this.heroCooldownTimer = RETRY_DELAY;
      return;
    }

    const maxAttempts = this.state.deckOrder.length;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const cardId = this.state.deckOrder[this.deckPointer];
      const card = getCardById(cardId);

      if (!card) {
        // Card not found in data -- skip it
        this.advanceDeckPointer();
        continue;
      }

      if (this.cardResolver.canAfford(card, this.state)) {
        this.executeCard(card);
        return;
      }

      // Can't afford -- skip
      eventBus.emit('combat:card-skipped', { cardId: card.id, reason: 'unaffordable' });
      this.stats.cardsSkipped++;
      this.advanceDeckPointer();
    }

    // ALL cards unaffordable -- wait and retry
    this.heroCooldownTimer = RETRY_DELAY;
  }

  private executeCard(card: CardDefinition): void {
    // Check synergy
    const synergy = this.synergies.check(
      this.lastPlayedCardId,
      card.id,
      this.state.heroClass,
    );

    if (synergy) {
      eventBus.emit('combat:synergy-triggered', {
        displayName: synergy.displayName,
        bonus: synergy.bonus,
      });
      this.stats.synergiesTriggered++;
    }

    // Relic bonuses for this card
    const relicBonus = resolveCardPlayedRelicBonus(
      this.state.activeRelicIds,
      card,
      this.state,
    );

    // Apply blood_pact temp strength bonus
    if (this.state._bloodPactBonus > 0) {
      this.state.heroStrength += this.state._bloodPactBonus;
    }

    // Resolve card (with damage multiplier from relics)
    const result = this.cardResolver.resolve(card, this.state, synergy, relicBonus.damageMultiplier);

    // Restore blood_pact temp strength
    if (this.state._bloodPactBonus > 0) {
      this.state.heroStrength -= this.state._bloodPactBonus;
      this.state._bloodPactBonus = 0;
    }

    // Apply relic resource refunds post-resolve
    if (relicBonus.staminaRefund > 0) {
      this.state.heroStamina = Math.min(this.state.heroMaxStamina, this.state.heroStamina + relicBonus.staminaRefund);
    }

    // Update stats
    this.stats.cardsPlayed++;
    this.stats.damageDealt += result.totalDamage;
    this.consecutiveAttacks++;

    // Check battle_rage passive (consecutive attacks)
    const activePassives = this.state.activePassives as any[];
    const passiveBonus = checkConditionalTrigger('consecutive_attacks_2', { consecutiveAttacks: this.consecutiveAttacks }, activePassives);
    if (passiveBonus && passiveBonus.type === 'damage_bonus_percent') {
      // Apply bonus as extra damage to enemy
      const bonusDmg = Math.floor(result.totalDamage * (passiveBonus.value / 100));
      this.state.enemyHP -= bonusDmg;
      this.stats.damageDealt += bonusDmg;
    }

    // Set cooldown for next card (with relic multiplier)
    this.heroCooldownTimer = card.cooldown * 1000 * (this.state.cooldownMultiplier ?? 1.0);

    // Emit event
    eventBus.emit('combat:card-played', {
      cardId: card.id,
      damage: result.totalDamage,
      healed: result.healed,
      armorGained: result.armorGained,
    });

    // Update tracking
    this.lastPlayedCardId = card.id;
    this.advanceDeckPointer();
  }

  private advanceDeckPointer(): void {
    this.deckPointer++;
    if (this.deckPointer >= this.state.deckOrder.length) {
      this.deckPointer = 0;
      this.stats.reshuffles++;
      this.consecutiveAttacks = 0; // reset on reshuffle
      eventBus.emit('combat:deck-reshuffled', { reshuffleCount: this.stats.reshuffles });

      // second_wind passive: recover 5 stamina on reshuffle
      const activePassives = this.state.activePassives as any[];
      const windBonus = checkConditionalTrigger('deck_reshuffled', { deckReshuffled: true }, activePassives);
      if (windBonus && windBonus.type === 'stamina') {
        this.state.heroStamina = Math.min(this.state.heroMaxStamina, this.state.heroStamina + windBonus.value);
      }
    }
  }

  private applyPassiveRegen(deltaMs: number): void {
    this.regenAccumulator += deltaMs;

    while (this.regenAccumulator >= REGEN_INTERVAL) {
      this.regenAccumulator -= REGEN_INTERVAL;
      this.state.heroStamina = Math.min(
        this.state.heroMaxStamina,
        this.state.heroStamina + STAMINA_REGEN,
      );
      this.state.heroMana = Math.min(
        this.state.heroMaxMana,
        this.state.heroMana + MANA_REGEN,
      );
    }
  }

  private checkEndConditions(): boolean {
    if (this.isFinished) return true;

    if (this.state.enemyHP <= 0) {
      this.stats.result = 'victory';
      this.isFinished = true;
      eventBus.emit('combat:end', { result: 'victory', enemyId: this.state.enemyId });
      return true;
    }

    if (this.state.heroHP <= 0) {
      this.stats.result = 'defeat';
      this.isFinished = true;
      eventBus.emit('combat:end', { result: 'defeat', enemyId: this.state.enemyId });
      return true;
    }

    return false;
  }

  getStats(): CombatStats {
    return { ...this.stats };
  }

  getState(): CombatState {
    return this.state;
  }

  isComplete(): boolean {
    return this.isFinished;
  }

  getDeckPointer(): number {
    return this.deckPointer;
  }

  getHeroCooldownTimer(): number {
    return this.heroCooldownTimer;
  }

  getHeroMaxCooldown(): number {
    const cardId = this.state.deckOrder[this.deckPointer];
    if (!cardId) return 1000;
    const card = getCardById(cardId);
    return card ? card.cooldown * 1000 : 1000;
  }
}
