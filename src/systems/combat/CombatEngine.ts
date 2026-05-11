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
import { rand } from '../SharedRNG';
import { getRun } from '../../state/RunState';

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
        // Unknown ID — skip and advance.
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

      const isUpgraded = this.state.upgraded[this.deckPointer] ?? false;
      if (waivedByCost || this.cardResolver.canAfford(card, this.state, isUpgraded)) {
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
      this.stats.synergiesTriggered++;
      getRun().stats.combosTriggered++;
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

    // Per-position upgrade flag for the card we're about to resolve.
    const isUpgraded = this.state.upgraded[this.deckPointer] ?? false;

    // spell_focus relic: refund mana cost difference for magic cards before resolve.
    let manaRefund = 0;
    if (relicBonus.manaOverride !== null && card.category === 'magic') {
      const effectiveCost = (isUpgraded && card.upgraded?.cost) ? card.upgraded.cost : card.cost;
      const baseManaCost = effectiveCost?.mana ?? 0;
      if (baseManaCost > relicBonus.manaOverride) {
        manaRefund = baseManaCost - relicBonus.manaOverride;
      }
    }

    // Resolve card (with damage multiplier from relics)
    const result = this.cardResolver.resolve(card, this.state, synergy, relicBonus.damageMultiplier, isUpgraded);

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
    
    const globalStats = getRun().stats;
    globalStats.cardsPlayed++;
    globalStats.damageDealt += result.totalDamage;

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

    // Phase 9: INT adds +1 flat damage per point on magic-category cards
    // (design/00 §3). Applied AFTER the resolver returns so it survives the
    // defense subtraction floor (Pitfall: applying INT pre-defense would let
    // high-defense enemies eat the entire INT bonus).
    if (card.category === 'magic' && result.totalDamage > 0 && this.state.heroIntellect > 0) {
      const intBonus = this.state.heroIntellect;
      this.state.enemyHP -= intBonus;
      this.stats.damageDealt += intBonus;
      result.totalDamage += intBonus;
      getRun().stats.damageDealt += intBonus;
    }

    // Phase 9: DoT tick cadence is "every card play" (INDEX §7 #2, RESEARCH
    // A2). Tick BEFORE deck-pointer advance so attribution to the triggering
    // card is preserved (Pitfall 4).
    this.tickActiveDoTs(card.id);

    // Set cooldown for next card. Upgraded variants override base cooldown.
    // `isUpgraded` is already resolved above for this deck position.
    const effectiveCooldown = (isUpgraded && card.upgraded?.cooldown !== undefined)
      ? card.upgraded.cooldown
      : card.cooldown;
    // Phase 9: DEX scales card cooldown by -2% per point, capped at -60%
    // (design/00 §3). cardCooldown * (1 - dexReduction) * cooldownMultiplier.
    const dexReduction = Math.min(0.60, this.state.heroDexterity * 0.02);
    // Phase 9 (Task 5): synergy bonus cooldown_reduction shaves the NEXT
    // card's cooldown. Stored as a one-shot field on state; consumed here.
    const cooldownShave = this.state.nextCardCooldownReduction;
    if (cooldownShave > 0) {
      this.state.nextCardCooldownReduction = 0;
    }
    this.heroCooldownTimer = Math.max(
      0,
      (effectiveCooldown - cooldownShave) * 1000 * (1 - dexReduction) * (this.state.cooldownMultiplier ?? 1.0),
    );

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

  /**
   * Phase 9: Resolve active DoT stacks once per card play (DoT cadence per
   * INDEX §7 #2 + RESEARCH A2). Per-tick damage = stacks * (1 + floor(DEX/4))
   * for poison. Bleed / burn / freeze / shock follow the same shape per
   * design/00 §3 with class-internal formulas. After the tick, each stack
   * decays by 1 unless state.poisonDecayDisabled (widows-kiss / empress-fang
   * relics flip this on).
   */
  private tickActiveDoTs(triggeringCardId: string): void {
    const state = this.state;
    const dexBonus = 1 + Math.floor(state.heroDexterity / 4);

    // Poison: stacks * (1 + floor(DEX/4)) damage; -1 stack/tick unless disabled.
    if (state.poisonStacks > 0) {
      const dmg = state.poisonStacks * dexBonus;
      state.enemyHP -= dmg;
      this.stats.damageDealt += dmg;
      getRun().stats.damageDealt += dmg;
      eventBus.emit('combat:dot-tick', {
        stack: 'poison', damage: dmg, sourceCard: triggeringCardId,
      });
      if (!state.poisonDecayDisabled) state.poisonStacks = Math.max(0, state.poisonStacks - 1);
    }

    // Bleed: per design/00 §3, similar shape — class-internal (warrior-leaning).
    // Use stack * 1 baseline; class-specific formulas land in their per-class plans.
    if (state.bleedStacks > 0) {
      const dmg = state.bleedStacks;
      state.enemyHP -= dmg;
      this.stats.damageDealt += dmg;
      getRun().stats.damageDealt += dmg;
      eventBus.emit('combat:dot-tick', { stack: 'bleed', damage: dmg, sourceCard: triggeringCardId });
      state.bleedStacks = Math.max(0, state.bleedStacks - 1);
    }

    // Burn: mage-leaning DoT. INT-scaling per design/00 §3 — baseline +INT.
    if (state.burnStacks > 0) {
      const dmg = state.burnStacks + Math.floor(state.heroIntellect / 2);
      state.enemyHP -= dmg;
      this.stats.damageDealt += dmg;
      getRun().stats.damageDealt += dmg;
      eventBus.emit('combat:dot-tick', { stack: 'burn', damage: dmg, sourceCard: triggeringCardId });
      state.burnStacks = Math.max(0, state.burnStacks - 1);
    }

    // Freeze: not pure DoT — slows enemy cooldown. Stack still decays per tick.
    if (state.freezeStacks > 0) {
      state.freezeStacks = Math.max(0, state.freezeStacks - 1);
    }

    // Shock: small DoT + stamina drain placeholder (design/02 mage burn line).
    if (state.shockStacks > 0) {
      const dmg = state.shockStacks;
      state.enemyHP -= dmg;
      this.stats.damageDealt += dmg;
      getRun().stats.damageDealt += dmg;
      eventBus.emit('combat:dot-tick', { stack: 'shock', damage: dmg, sourceCard: triggeringCardId });
      state.shockStacks = Math.max(0, state.shockStacks - 1);
    }

    // Shadowblade class branch: combo_played trigger fires when a synergy
    // resolved AND poison just ticked (Task 5 wires the relic dispatch).
    if (state.heroClass === 'shadowblade') {
      // Class-specific hooks go here. Currently the only Shadowblade-specific
      // tick logic is the poison cadence above (DEX-scaled per RESEARCH A2);
      // additional hooks (e.g. Stealth refresh on N CP spent) are deferred
      // to a future balance pass.
    }
  }

  private advanceDeckPointer(): void {
    this.deckPointer++;
    if (this.deckPointer >= this.state.deckOrder.length) {
      this.deckPointer = 0;
      this.stats.reshuffles++;
      this.consecutiveAttacks = 0; // reset on reshuffle

      // Actually re-randomize order — emitting the event without shuffling
      // gave the player the same card sequence forever. Shuffle deckOrder
      // and the parallel `upgraded` flags in lockstep so per-position
      // upgrade tracking survives the reshuffle.
      this.fisherYatesPair(this.state.deckOrder, this.state.upgraded);

      eventBus.emit('combat:deck-reshuffled', { reshuffleCount: this.stats.reshuffles });

      // second_wind passive: recover 5 stamina on reshuffle
      const activePassives = this.state.activePassives as any[];
      const windBonus = checkConditionalTrigger('deck_reshuffled', { deckReshuffled: true }, activePassives);
      if (windBonus && windBonus.type === 'stamina') {
        this.state.heroStamina = Math.min(this.state.heroMaxStamina, this.state.heroStamina + windBonus.value);
      }

      // Phase 9: SPI grants stamina regen on shuffle (+1 per 2 SPI per
      // design/00 §3). INT grants +1 mana per 2 INT on the same trigger.
      if (this.state.heroSpirit > 0) {
        const spiStamina = Math.floor(this.state.heroSpirit / 2);
        this.state.heroStamina = Math.min(this.state.heroMaxStamina, this.state.heroStamina + spiStamina);
      }
      if (this.state.heroIntellect > 0) {
        const intMana = Math.floor(this.state.heroIntellect / 2);
        this.state.heroMana = Math.min(this.state.heroMaxMana, this.state.heroMana + intMana);
      }
    }
  }

  /** Shuffle two parallel arrays in lockstep (same swaps). */
  private fisherYatesPair<A, B>(a: A[], b: B[]): void {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
      if (j < b.length && i < b.length) {
        [b[i], b[j]] = [b[j], b[i]];
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
    if (!card) return 1000;
    const isUpgraded = this.state.upgraded[this.deckPointer] ?? false;
    const effectiveCooldown = (isUpgraded && card.upgraded?.cooldown !== undefined)
      ? card.upgraded.cooldown
      : card.cooldown;
    // Mirror playNextCard's DEX scaling so the HUD bar fills at the same
    // visual rate the engine actually schedules cards.
    const dexReduction = Math.min(0.60, this.state.heroDexterity * 0.02);
    return effectiveCooldown * 1000 * (1 - dexReduction);
  }
}
