// Core tick-driven combat loop with zero Phaser imports.
// All combat logic driven by tick(deltaMs) calls from the scene layer.

import { eventBus } from '../../core/EventBus';
import { getCardById } from '../../data/DataLoader';
import type { CardDefinition } from '../../data/types';
import type { CombatState } from './CombatState';
import { createEmptyCombatStats, type CombatStats } from './CombatStats';
import { CardResolver } from './CardResolver';
import { EnemyAI, applyHeroDamage } from './EnemyAI';
import { SynergySystem, applyDirectSynergyBonus } from './SynergySystem';
import { resolveCardPlayedRelicBonus, dispatchTriggerRelics } from './RelicSystem';
import { checkConditionalTrigger } from '../hero/PassiveSkillSystem';
import { tickAuras, getCdReductionFactor, collectAuraTicks, applyTriggeredPayload } from './StatusEffects';
import { getRun } from '../../state/RunState';

/** Passive regen interval in milliseconds */
const REGEN_INTERVAL = 4500;
/** Stamina restored per regen tick */
const STAMINA_REGEN = 1;
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

    // Decay any time-limited auras on hero and enemy. Expired entries prune
    // themselves; cd_reduction recalculation happens lazily on next card play.
    tickAuras(this.state.heroAuras, deltaMs);
    tickAuras(this.state.enemyAuras, deltaMs);

    // v3: periodic tick_ms auras fire their `then` payload on every interval.
    // Used by Stagnant Bulwark, Dust Plague, Twinflame Flicker, Wrathshell Vow,
    // Crimson Regen Mantle, etc.
    const heroTickEffects = collectAuraTicks(this.state.heroAuras);
    for (const e of heroTickEffects) applyTriggeredPayload(this.state, e);
    const enemyTickEffects = collectAuraTicks(this.state.enemyAuras);
    for (const e of enemyTickEffects) applyTriggeredPayload(this.state, e);

    // v3: Echo TTL countdown. When the window expires, any leftover charges
    // evaporate so the player can't bank Echos forever between casts.
    if (this.state.echoCharges > 0 || this.state.echoExpiresAt > 0) {
      this.state.echoExpiresAt = Math.max(0, this.state.echoExpiresAt - deltaMs);
      if (this.state.echoExpiresAt === 0) this.state.echoCharges = 0;
    }
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

    // Phase 9 Task 5: cooldown_reduction synergy bonus mutates CombatState
    // directly (CardResolver.applyEffect is a no-op for that bonus type).
    if (synergy) {
      applyDirectSynergyBonus(synergy, this.state);
      eventBus.emit('combat:combo-played', {
        displayName: synergy.displayName,
      });
    }

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
    let effectiveCooldown = (isUpgraded && card.upgraded?.cooldown !== undefined)
      ? card.upgraded.cooldown
      : card.cooldown;
    // v3: Frenzy — card-level multiplier when hero HP is below threshold.
    if (card.frenzy) {
      const pct = (this.state.heroHP / Math.max(1, this.state.heroMaxHP)) * 100;
      if (pct < card.frenzy.hero_hp_pct_below) {
        effectiveCooldown = effectiveCooldown * card.frenzy.cd_mult;
      }
    }
    // v3: Overload — slot's previously-issued cd_debt is added to this CD.
    const slot = this.deckPointer;
    const debtMs = this.state.cdDebtBySlot[slot] ?? 0;
    if (debtMs > 0) this.state.cdDebtBySlot[slot] = 0;
    // v3: cd_debt produced by THIS cast gets stored on the slot for next time.
    if (result.cooldownDebtSec && result.cooldownDebtSec > 0) {
      this.state.cdDebtBySlot[slot] =
        (this.state.cdDebtBySlot[slot] ?? 0) + result.cooldownDebtSec * 1000;
    }
    // Phase 9: DEX scales card cooldown by -2% per point, capped at -60%
    // (design/00 §3). cardCooldown * (1 - dexReduction) * cooldownMultiplier.
    const dexReduction = Math.min(0.60, this.state.heroDexterity * 0.02);
    // Phase 9 (Task 5): synergy bonus cooldown_reduction shaves the NEXT
    // card's cooldown. Stored as a one-shot field on state; consumed here.
    const cooldownShave = this.state.nextCardCooldownReduction;
    if (cooldownShave > 0) {
      this.state.nextCardCooldownReduction = 0;
    }
    // Air-element cd_reduction auras apply on top of DEX scaling; capped to a
    // floor of 40% of the base cooldown (60% max reduction, soft cap above 30%).
    const auraCdFactor = getCdReductionFactor(this.state.heroAuras);
    this.heroCooldownTimer = Math.max(
      0,
      (effectiveCooldown - cooldownShave) * 1000 * (1 - dexReduction) * (this.state.cooldownMultiplier ?? 1.0) * auraCdFactor
        + debtMs,
    );

    // v3: Echo — consume one charge by repeating the same resolution. The
    // `echoExpiresAt` field is treated as a countdown that decays in tick();
    // a positive remaining window means at least one charge is still live.
    if (this.state.echoCharges > 0 && this.state.echoExpiresAt > 0) {
      this.state.echoCharges = Math.max(0, this.state.echoCharges - 1);
      const isUpgradedEcho = this.state.upgraded[slot] ?? false;
      if (this.cardResolver.canAfford(card, this.state, isUpgradedEcho)) {
        this.cardResolver.resolve(card, this.state, null, relicBonus.damageMultiplier, isUpgradedEcho);
      }
    }

    // v3: force_trigger_all_cards — Tectonic Reckoning blasts the deck.
    if (result.forceTriggerAll) {
      this.forceTriggerAllDeck(card.id);
    }

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
   * Resolve active DoT stacks once per card play (DoT cadence per INDEX §7 #2
   * + RESEARCH A2). Per-stack damage formulas differ by stack type:
   *   - Poison: stacks damage, decays every 2nd tick (slow burn).
   *   - Bleed: stacks * (enemyAttackedSinceLastBleedTick ? 2 : 1) damage,
   *            -1 stack/tick (swing-amplified).
   *   - Burn: flat 2 damage while burnStacks > 0; stacks do NOT decay
   *           (only consumed by Pyre cards via CardResolver).
   *   - Slow (renamed from Shock): stacks damage + cooldown slow in EnemyAI;
   *           -1 stack/tick.
   *   - Stun (renamed from Freeze): no damage; freezes enemy cooldown timer
   *           in EnemyAI; -1 stack/tick.
   */
  private tickActiveDoTs(triggeringCardId: string): void {
    const state = this.state;

    // Track whether ANY DoT type ticked this cycle so the `dot_tick` relic
    // dispatch fires once after the pass (WR-01 fix preserved).
    let anyDotTicked = false;

    // Poison: stacks damage every tick; stacks decay every 2nd tick (parity).
    // Apply damage first, then advance parity. On the cycle where parity wraps
    // back to 0, decrement stacks by 1. The first tick after apply does damage
    // but no decay (parity goes 0→1); the second tick does damage and decays
    // (parity goes 1→0).
    if (state.poisonStacks > 0) {
      const dmg = state.poisonStacks;
      state.enemyHP -= dmg;
      this.stats.damageDealt += dmg;
      getRun().stats.damageDealt += dmg;
      eventBus.emit('combat:dot-tick', {
        stack: 'poison', damage: dmg, sourceCard: triggeringCardId,
      });
      state.poisonTickParity = (state.poisonTickParity + 1) % 2;
      if (state.poisonTickParity === 0) {
        state.poisonStacks = Math.max(0, state.poisonStacks - 1);
      }
      anyDotTicked = true;
    }

    // Bleed: swing-amplified. If the enemy attacked since the last bleed tick,
    // each stack deals 2 damage; otherwise 1. Reset the flag AFTER applying
    // damage. Stacks decay -1 per tick regardless.
    if (state.bleedStacks > 0) {
      const perStack = state.enemyAttackedSinceLastBleedTick ? 2 : 1;
      const dmg = state.bleedStacks * perStack;
      state.enemyHP -= dmg;
      this.stats.damageDealt += dmg;
      getRun().stats.damageDealt += dmg;
      eventBus.emit('combat:dot-tick', { stack: 'bleed', damage: dmg, sourceCard: triggeringCardId });
      state.bleedStacks = Math.max(0, state.bleedStacks - 1);
      state.enemyAttackedSinceLastBleedTick = false;
      anyDotTicked = true;
    }

    // Burn: non-decaying, fixed DoT. While burnStacks > 0, deal a flat 2
    // damage per tick regardless of stack count. Stacks are only consumed by
    // Pyre cards (handled in CardResolver post-damage).
    if (state.burnStacks > 0) {
      const dmg = 2;
      state.enemyHP -= dmg;
      this.stats.damageDealt += dmg;
      getRun().stats.damageDealt += dmg;
      eventBus.emit('combat:dot-tick', { stack: 'burn', damage: dmg, sourceCard: triggeringCardId });
      // No decay — Pyre cards consume burnStacks on resolve.
      anyDotTicked = true;
    }

    // Stun (renamed from Freeze): no damage. While stunStacks > 0, EnemyAI
    // halts the cooldown timer. Stacks decay -1 per tick here.
    if (state.stunStacks > 0) {
      state.stunStacks = Math.max(0, state.stunStacks - 1);
    }

    // Slow (renamed from Shock): small DoT + per-stack enemy attack-cooldown
    // slow (applied in EnemyAI.tick — 8% per stack, capped at 50%). Stack
    // decays each tick.
    if (state.slowStacks > 0) {
      const dmg = state.slowStacks;
      state.enemyHP -= dmg;
      this.stats.damageDealt += dmg;
      getRun().stats.damageDealt += dmg;
      eventBus.emit('combat:dot-tick', { stack: 'slow', damage: dmg, sourceCard: triggeringCardId });
      state.slowStacks = Math.max(0, state.slowStacks - 1);
      anyDotTicked = true;
    }

    // Phase 9 (WR-01 fix): dispatch the `dot_tick` relic trigger ONCE per
    // tickActiveDoTs pass, regardless of which DoT type(s) ticked. Previously
    // this dispatch was nested inside the poison branch, so bleed/burn/shock
    // never fired the trigger and `dot_tick` relics for warrior/mage builds
    // were effectively dead. Single dispatch matches the "tick once per card
    // play" cadence (INDEX §7 #2) and avoids over-firing for multi-DoT stacks.
    if (anyDotTicked) {
      dispatchTriggerRelics('dot_tick', state.activeRelicIds ?? [], state);
    }

    // Tier-1 redesign: hero burn / bleed stacks (self_dot cost) tick once per
    // card play. Routed through applyHeroDamage so the hero's current armor
    // can absorb the tick — consistent with the "all damage respects armor"
    // rule. Each stack decays by 1 after the tick.
    if (state.heroBurnStacks > 0) {
      applyHeroDamage(state.heroBurnStacks, state, /*skipRelics=*/true);
      state.heroBurnStacks = Math.max(0, state.heroBurnStacks - 1);
    }
    if (state.heroBleedStacks > 0) {
      applyHeroDamage(state.heroBleedStacks, state, /*skipRelics=*/true);
      state.heroBleedStacks = Math.max(0, state.heroBleedStacks - 1);
    }
  }

  private advanceDeckPointer(): void {
    this.deckPointer++;
    // v3: skip slots that were Devoured during this combat (Vengeful Pyre).
    // Bounded loop — at most one full deck rotation before giving up.
    if (this.state.devouredSlots && this.state.devouredSlots.size > 0) {
      let guard = this.state.deckOrder.length;
      while (guard-- > 0 && this.state.devouredSlots.has(this.deckPointer)) {
        this.deckPointer++;
        if (this.deckPointer >= this.state.deckOrder.length) this.deckPointer = 0;
      }
    }
    // Phase 9 Task 5: card_drawn trigger fires once per advance (the "next"
    // card is now the active card). Dispatched here so it stays in lockstep
    // with whatever the next pointer points at — including post-reshuffle.
    //
    // Phase 9 (WR-02 fix): skip the dispatch if combat has ALREADY ended
    // this card (hero or enemy at 0 HP). Without this guard, a killing-blow
    // card would (1) drop enemy HP to 0, (2) fire card_drawn relics that
    // mutate CombatState on a corpse — potentially dealing more damage,
    // gaining CP, or producing NaN HP — and (3) emit `combat:card-drawn`
    // for a card that will never actually be played. `tick()` re-runs
    // checkEndConditions immediately after executeCard returns, so the
    // win/loss event still fires on the correct tick.
    const combatStillLive = this.state.enemyHP > 0 && this.state.heroHP > 0;

    if (this.deckPointer >= this.state.deckOrder.length) {
      this.deckPointer = 0;
      this.stats.reshuffles++;
      this.consecutiveAttacks = 0; // reset on deck cycle

      // Deck preserves its order across cycles — the player faces the same
      // sequence each loop. The reshuffle event/counter is retained because
      // downstream systems (second_wind, SPI/INT regen) trigger on a deck
      // wrap, regardless of whether order changes.
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

    const nextCardId = this.state.deckOrder[this.deckPointer];
    if (nextCardId && combatStillLive) {
      dispatchTriggerRelics('card_drawn', this.state.activeRelicIds ?? [], this.state);
      eventBus.emit('combat:card-drawn', { cardId: nextCardId });
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
      // v3: on_kill_with_stack — fire any aura whose threshold_stack the
      // dying enemy was still carrying. Cascade triggers must run BEFORE the
      // victory event so spread/copy effects can populate any adjacent
      // target structure (current build only has one enemy slot, so this is
      // mostly a no-op until multi-enemy arrives — but the hook is in place).
      this.fireOnKillWithStack();
      this.stats.result = 'victory';
      this.isFinished = true;
      // Phase 9 Task 5: enemy_killed relic trigger fires once on victory.
      dispatchTriggerRelics('enemy_killed', this.state.activeRelicIds ?? [], this.state);
      eventBus.emit('combat:enemy-killed', { enemyId: this.state.enemyId });
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

  /** v3: walk the hero's auras and fire on_kill_with_stack payloads when the
   *  enemy is being killed AND it still carries the named stack at >0. */
  private fireOnKillWithStack(): void {
    const auras = this.state.heroAuras;
    if (!auras || auras.length === 0) return;
    const stackCount = (which: string): number => {
      switch (which) {
        case 'poison': return this.state.poisonStacks;
        case 'bleed': return this.state.bleedStacks;
        case 'burn': return this.state.burnStacks;
        case 'stun': return this.state.stunStacks;
        case 'slow': return this.state.slowStacks;
        default: return 0;
      }
    };
    const fired: import('../../data/types').CardEffect[] = [];
    for (const a of auras) {
      if (a.trigger !== 'on_kill_with_stack') continue;
      if (!a.threshold_stack) continue;
      if (stackCount(a.threshold_stack) <= 0) continue;
      if (!a.then) continue;
      const arr = Array.isArray(a.then) ? a.then : [a.then];
      for (const e of arr) fired.push(e);
    }
    for (const e of fired) applyTriggeredPayload(this.state, e);
  }

  /** v3: Tectonic Reckoning — force-resolve every non-self, non-devoured,
   *  non-Exhausted deck slot once. Cooldowns are reset to 0 to give the next
   *  card slot a fresh tick. Costs are bypassed (the closer pays for the
   *  combo). Hard guard: only fires once per call to avoid loop recursion. */
  private forceTriggerAllDeck(originatingCardId: string): void {
    const seen = new Set<string>();
    for (let i = 0; i < this.state.deckOrder.length; i++) {
      if (this.state.devouredSlots.has(i)) continue;
      const cid = this.state.deckOrder[i];
      if (!cid || cid === originatingCardId || seen.has(cid)) continue;
      seen.add(cid);
      const c = getCardById(cid);
      if (!c) continue;
      if (c.exhaust && this.state.spentThisCombat.has(cid)) continue;
      const isUp = this.state.upgraded[i] ?? false;
      this.cardResolver.resolve(c, this.state, null, 1.0, isUp);
    }
    this.heroCooldownTimer = 0;
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
