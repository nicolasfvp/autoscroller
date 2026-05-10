// Core tick-driven combat loop with zero Phaser imports.
// All combat logic driven by tick(deltaMs) calls from the scene layer.

import { eventBus } from '../../core/EventBus';
import { getCardById, getCurseById } from '../../data/DataLoader';
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
/** Maximum total combat duration (ms) before a deadlock fail-safe defeats the hero */
const DEADLOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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
  /** Total elapsed ms in this combat — used by the deadlock fail-safe. */
  private totalElapsedMs = 0;

  constructor(state: CombatState) {
    this.state = state;
    this.stats = createEmptyCombatStats(state.enemyId, state.enemyName);
    this.cardResolver = new CardResolver();
    this.enemyAI = new EnemyAI(state);
    this.synergies = new SynergySystem();
  }

  tick(deltaMs: number): void {
    if (this.isFinished) return;

    // Deadlock fail-safe: cap total combat duration. If no side has won
    // after DEADLOCK_TIMEOUT_MS (e.g. empty deck + immortal enemy, or a
    // bug producing 0-damage attacks), force a defeat.
    this.totalElapsedMs += deltaMs;
    if (this.totalElapsedMs >= DEADLOCK_TIMEOUT_MS) {
      this.state.heroHP = 0;
      this.checkEndConditions();
      return;
    }

    // Decrement both timers up front, then resolve in fairness order.
    this.heroCooldownTimer -= deltaMs;
    // Determine who reached 0 first using *projected* post-decrement enemy
    // timer. If both are overdue this tick, the more-negative one acts first.
    const projectedEnemyTimer = this.enemyAI.getCooldownTimer() - deltaMs;
    const heroReady = this.heroCooldownTimer <= 0;
    const enemyReady = projectedEnemyTimer <= 0;

    // Default to hero-first (preserves existing behavior when only one side
    // is ready). Swap only when both are ready AND enemy was more overdue.
    const enemyGoesFirst = heroReady && enemyReady && projectedEnemyTimer < this.heroCooldownTimer;

    if (enemyGoesFirst) {
      this.enemyAI.tick(deltaMs, this.state, this.stats);
      if (this.checkEndConditions()) return;

      if (this.heroCooldownTimer <= 0) this.playNextCard();
      if (this.checkEndConditions()) return;
    } else {
      if (this.heroCooldownTimer <= 0) this.playNextCard();
      if (this.checkEndConditions()) return;

      this.enemyAI.tick(deltaMs, this.state, this.stats);
      if (this.checkEndConditions()) return;
    }

    // Passive regen
    this.applyPassiveRegen(deltaMs);
  }

  private playNextCard(): void {
    if (this.state.deckOrder.length === 0) {
      this.heroCooldownTimer = RETRY_DELAY;
      return;
    }

    // If hero is stunned, the next card is *skipped* (not just delayed).
    // We advance the deck pointer past the current card and re-arm the
    // cooldown so the *following* card plays on its normal cadence.
    if (this.state.heroStunned) {
      this.state.heroStunned = false;
      const skippedCardId = this.state.deckOrder[this.deckPointer];
      eventBus.emit('combat:card-skipped', { cardId: skippedCardId, reason: 'stunned' });
      this.stats.cardsSkipped++;
      this.advanceDeckPointer();
      this.heroCooldownTimer = RETRY_DELAY;
      return;
    }

    const maxAttempts = this.state.deckOrder.length;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const cardId = this.state.deckOrder[this.deckPointer];
      const card = getCardById(cardId);

      if (!card) {
        // Not a regular card — could be a curse pushed onto the deck via
        // EventResolver.add_curse. Resolve curse effects and advance.
        const curse = getCurseById(cardId);
        if (curse) {
          this.applyCurseEffects(curse);
          eventBus.emit('combat:card-played', {
            cardId,
            damage: 0,
            healed: 0,
            armorGained: 0,
          });
          this.lastPlayedCardId = cardId;
          this.heroCooldownTimer = 1000; // curses use a flat 1s cooldown
          this.consecutiveAttacks = 0; // curses never count as attacks
          this.advanceDeckPointer();
          return;
        }
        // Truly unknown ID — skip and advance.
        this.advanceDeckPointer();
        continue;
      }

      // Check cost-waiver synergy BEFORE the affordability gate so cards
      // like Fortified Fury can fire even when the hero can't afford the
      // base cost. (Without this, the card is skipped before synergy is
      // even checked.)
      const synergyForAffordability = this.synergies.check(
        this.lastPlayedCardId,
        card.id,
        this.state.heroClass,
      );
      const waivedByCost = synergyForAffordability?.bonus.type === 'cost_waive';

      if (waivedByCost || this.cardResolver.canAfford(card, this.state)) {
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

    // spell_focus relic: refund mana cost difference for magic cards before resolve.
    let manaRefund = 0;
    if (relicBonus.manaOverride !== null && card.category === 'magic') {
      const isUpgraded = this.state.upgradedCards?.includes(card.id) ?? false;
      const effectiveCost = (isUpgraded && card.upgraded?.cost) ? card.upgraded.cost : card.cost;
      const baseManaCost = effectiveCost?.mana ?? 0;
      if (baseManaCost > relicBonus.manaOverride) {
        manaRefund = baseManaCost - relicBonus.manaOverride;
      }
    }

    // Resolve card (with damage multiplier from relics)
    const result = this.cardResolver.resolve(card, this.state, synergy, relicBonus.damageMultiplier);

    if (manaRefund > 0) {
      this.state.heroMana = Math.min(this.state.heroMaxMana, this.state.heroMana + manaRefund);
    }

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

    // Track consecutive *attack* cards only — utility/heal cards reset the
    // streak so triggers like Battle Rage represent real combat aggression.
    if (result.totalDamage > 0) {
      this.consecutiveAttacks++;
    } else {
      this.consecutiveAttacks = 0;
    }

    // Check battle_rage passive (consecutive attacks)
    const activePassives = this.state.activePassives as any[];
    const passiveBonus = checkConditionalTrigger('consecutive_attacks_2', { consecutiveAttacks: this.consecutiveAttacks }, activePassives);
    if (passiveBonus && passiveBonus.type === 'damage_bonus_percent') {
      // Apply bonus as extra damage to enemy
      const bonusDmg = Math.floor(result.totalDamage * (passiveBonus.value / 100));
      this.state.enemyHP -= bonusDmg;
      this.stats.damageDealt += bonusDmg;
    }

    // Set cooldown for next card. Upgraded variants override base cooldown.
    const isUpgraded = this.state.upgradedCards?.includes(card.id) ?? false;
    const effectiveCooldown = (isUpgraded && card.upgraded?.cooldown !== undefined)
      ? card.upgraded.cooldown
      : card.cooldown;
    this.heroCooldownTimer = effectiveCooldown * 1000 * (this.state.cooldownMultiplier ?? 1.0);

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

      // Actually re-randomize order — emitting the event without shuffling
      // gave the player the same card sequence forever.
      this.fisherYatesInPlace(this.state.deckOrder);

      eventBus.emit('combat:deck-reshuffled', { reshuffleCount: this.stats.reshuffles });

      // second_wind passive: recover 5 stamina on reshuffle
      const activePassives = this.state.activePassives as any[];
      const windBonus = checkConditionalTrigger('deck_reshuffled', { deckReshuffled: true }, activePassives);
      if (windBonus && windBonus.type === 'stamina') {
        this.state.heroStamina = Math.min(this.state.heroMaxStamina, this.state.heroStamina + windBonus.value);
      }
    }
  }

  /**
   * Apply effects from a curse card. Curses are pushed onto the deck via
   * EventResolver.add_curse and were previously skipped silently because
   * CombatEngine.getCardById didn't know about them.
   *
   *   pain     -> nothing (clogs deck)
   *   wound    -> hero loses 2 HP
   *   weakness -> next damage card deals -2 damage
   *   fragility-> next incoming attack deals +50% damage
   */
  private applyCurseEffects(curse: { id: string; effects: Array<{ type: string; value?: number }> }): void {
    for (const eff of curse.effects ?? []) {
      switch (eff.type) {
        case 'damage_self': {
          const amount = Math.max(0, eff.value ?? 0);
          this.state.heroHP = Math.max(0, this.state.heroHP - amount);
          break;
        }
        case 'reduce_damage': {
          // Stash a one-shot damage debuff on the state. CardResolver consumes it.
          (this.state as any)._pendingDamagePenalty = (this.state as any)._pendingDamagePenalty ?? 0;
          (this.state as any)._pendingDamagePenalty += Math.max(0, eff.value ?? 0);
          break;
        }
        case 'increase_damage_taken': {
          // Stash a one-shot incoming-damage multiplier (percent).
          const mult = 1 + Math.max(0, eff.value ?? 0) / 100;
          (this.state as any)._pendingFragilityMultiplier = mult;
          break;
        }
        case 'nothing':
        default:
          break;
      }
    }
  }

  private fisherYatesInPlace<T>(arr: T[]): void {
    // TODO(B.7/B.8): route through the run's seeded RNG instead of Math.random
    // once a shared SeededRNG is exposed via RunState/CombatState.
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
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
    if (!card) return 1000;
    const isUpgraded = this.state.upgradedCards?.includes(card.id) ?? false;
    const effectiveCooldown = (isUpgraded && card.upgraded?.cooldown !== undefined)
      ? card.upgraded.cooldown
      : card.cooldown;
    return effectiveCooldown * 1000;
  }
}
