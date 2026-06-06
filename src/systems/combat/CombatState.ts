// Transient combat state -- created at combat start, discarded at end.
// Zero Phaser imports. Fully mutable during combat tick loop.

import type { RunState } from '../../state/RunState';
import type { EnemyDefinition, BossBehavior } from '../../data/types';
import type { ElementId } from '../ElementSystem';
import { applyPassiveRelics, applyOnCombatStartRelics } from './RelicSystem';
import { resolveHeroStats } from '../hero/HeroStatsResolver';
import { resolvePassives, applyPassiveModifiersToCombatState } from '../hero/PassiveSkillSystem';
import type { ActiveAura } from './StatusEffects';

export interface CombatState {
  heroHP: number;
  heroMaxHP: number;
  heroStamina: number;
  heroMaxStamina: number;
  heroMana: number;
  heroMaxMana: number;
  heroDefense: number;
  heroStrength: number;
  heroDefenseMultiplier: number;
  heroClass: string;

  deckOrder: string[];

  enemyId: string;
  enemyName: string;
  enemyType: 'normal' | 'elite' | 'boss';
  enemyHP: number;
  enemyMaxHP: number;
  enemyDefense: number;
  enemyDamage: number;
  /** Current attack cooldown in ms (may be temporarily shaved by agility affinity; decays back to base). */
  enemyAttackCooldown: number;
  /** Base attack cooldown (unchanging during combat) — decay target for the agility shave. */
  enemyBaseAttackCooldown: number;
  enemyPattern: string;
  enemySpecialEffect: string | null;
  /** Phase 10: element affinity for the on-hit secondary effect. */
  enemyAffinity: ElementId | null;

  /** IDs of relics currently active in this combat */
  activeRelicIds: string[];
  /** Passives applied from class XP */
  activePassives: unknown[];

  /** Flag set by EnemyAI stun effect -- skips next hero card */
  heroStunned: boolean;
  /**
   * Scaled self-stun pool (e.g. Bloodlash Salvo's STR-scaled self-stun). Each
   * stack skips one hero card. Distinct from `heroStunned` (the enemy-inflicted
   * single-card skip) so a card can self-stun for N>1 cards. Optional for
   * back-compat with test fixtures that build CombatState literals. */
  heroStunStacks?: number;
  /**
   * Rebalance: stun diminishing-returns window. While `combatElapsedMs` is
   * below this timestamp the enemy RESISTS new stun applications (set after a
   * freeze fully decays, so stun can't be perma-chained). Optional for
   * back-compat with test fixtures that build CombatState literals. */
  stunImmuneUntilMs?: number;
  /**
   * Per-deck-position upgrade flags for this combat. Length matches
   * `deckOrder`. Index `i` corresponds to `deckOrder[i]`.
   */
  upgraded: boolean[];
  /** Boss behavioral patterns (empty for non-boss enemies) */
  behaviors: BossBehavior[];

  // ── Relic effect tracking ──────────────────
  /** Global card cooldown multiplier from relics (e.g. swift_boots) */
  cooldownMultiplier: number;
  /** Multiplier for the next card only (first_strike_amulet) */
  firstCardDamageMultiplier: number;
  /** First card each combat is free (Smoldering Torch). Consumed on first played card. */
  firstCardCostsZero: boolean;
  /** Remaining count of cards that get -1 Stamina cost (Vanguard Cuffs). Decremented per card. */
  firstNCardsStaminaDiscount: number;
  /** Flat damage bonus on the first damage card (Whetstone Shard, Iron Tooth). Consumed on first damage card. */
  firstAttackDamageBonus: number;
  /** Extra Burn applied by the first Fire-element card (Ember Wick). Consumed once. */
  firstFireCardBurnBonus: number;
  /** One-shot Barrier (Apothecary's Vial) — absorbs the next hit fully, then resets. */
  barrierActive: boolean;
  /** C2: pending gold credited to RunState.economy.gold after combat ends (kill-bonus relics). */
  pendingGoldBonus: number;
  /** C2: generic per-relic numeric counters (card-played counts, cap trackers, time windows). */
  relicCounters: Record<string, number>;
  /** C2: next armor effect resolved by hero is multiplied by this (Burnished Sigil). 1.0 = no effect. Consumed once. */
  nextArmorMultiplier: number;
  /** Temp strength bonus from blood_pact (applied per card) */
  _bloodPactBonus: number;
  /** C5 — Sanguine Pact temp STR/INT bonuses applied around resolve. */
  _sanguinePactStrBonus: number;
  _sanguinePactIntBonus: number;
  /** Whether phoenix_feather has already been used this combat */
  phoenixUsed: boolean;

  // ── Phase 9: per-combat stat axes (seeded from resolveHeroStats(run)) ─
  heroVitality: number;
  heroDexterity: number;
  heroIntellect: number;
  heroSpirit: number;

  // ── Phase 9: DoT + status stack pools (reset per combat) ─────────────
  poisonStacks: number;
  bleedStacks: number;
  burnStacks: number;
  stunStacks: number;
  slowStacks: number;
  rageStacks: number;

  // ── Wave 8: subtile build-amplifier bonuses (set by CombatScene from the
  //    resolved subtile effect bag, consumed by burn application / bleed
  //    tick / magic-card damage paths). Defaults: 0 / 0 / 1.
  subtileBurnApplyBonus: number;
  subtileBleedTickBonus: number;
  subtileSpellDamageMult: number;

  // ── v4 Vengeance: hero damage timing ─────────────────────────────────
  /** Total elapsed combat time in ms — synced from CombatEngine each tick. */
  combatElapsedMs: number;
  /** Timestamp (in combatElapsedMs) of the last HP loss the hero suffered. */
  lastHeroDamageMs: number | null;

  /**
   * Bleed swing-amplification flag. Set to true by EnemyAI whenever the enemy
   * lands an attack; consumed (reset to false) by tickActiveDoTs after the
   * bleed damage for the cycle is applied. When true, each bleed stack
   * deals 2 damage instead of 1.
   */
  enemyAttackedSinceLastBleedTick: boolean;

  /**
   * Poison slow-decay counter. Poison damage applies every tick but stacks
   * only decay every 2nd tick. Increments on each poison tick and modulo-2;
   * when the resulting value is 0, decrement poisonStacks by 1.
   */
  poisonTickParity: number;

  /**
   * Phase 9: one-shot cooldown shave consumed by the NEXT card's cooldown.
   * Set by SynergySystem cooldown_reduction bonus type; consumed by
   * CombatEngine.playNextCard immediately after that card resolves.
   */
  nextCardCooldownReduction: number;

  /**
   * Per-card running total of stat-buff magnitude already applied this
   * combat. CardResolver clamps further buffs against tier-based caps so
   * one card cycled many times through the deck (Stoneskin, Dancer's Guard)
   * can't snowball a stat indefinitely. Resets at combat start.
   */
  buffMagnitudePerCard: Record<string, number>;

  /**
   * Tier-1 redesign: time-decaying status effects. heroAuras host modifier
   * auras (e.g. +1 DEX for 5s, cd_reduction 25% for 5s) and triggered auras
   * (e.g. on_armor_break → deal 4 damage). enemyAuras hold debuffs like
   * timed enemy-defense reductions. Both lists are ticked each combat
   * frame; expired entries self-prune.
   */
  heroAuras: ActiveAura[];
  enemyAuras: ActiveAura[];

  /**
   * Self-DoT pools for cards that pay HP-over-time as a cost (e.g.
   * Tide-Tempered Blade applies 1 burn to the hero). Ticked alongside
   * enemy DoTs on the same cadence.
   */
  heroBurnStacks: number;
  heroBleedStacks: number;

  /**
   * v3: Exhaust tracking. Card IDs that have already fired their once-per-combat
   * payload — CardResolver gates a re-resolve when present. Reset every combat.
   */
  spentThisCombat: Set<string>;

  /**
   * v3: Overload cooldown debt — per-deck-position extra ms added to the next
   * cooldown after the slot resolves (Cleaver's Tax pattern). Keyed by deck
   * position, since CombatState doesn't track card-id slot mapping directly.
   */
  cdDebtBySlot: Record<number, number>;

  /**
   * v3: Echo charges — number of upcoming card resolutions that re-trigger
   * twice. Decremented on resolve. TTL is checked against echoExpiresAt.
   */
  echoCharges: number;
  echoExpiresAt: number;
  /** C7 — Echoes that consume zero cost (granted by Echo Chamber / Tempest
   *  Resonator relics). When the engine consumes an echo, if this is > 0 it
   *  decrements and the replay's cost is waived. */
  freeEchoCharges: number;

  /**
   * v3: Devour markers — deck slots disabled permanently for this combat.
   * Consulted by CombatEngine when advancing the deck pointer.
   */
  devouredSlots: Set<number>;

  /**
   * Rebalance phase: aggregate per-combat permanent stat boost. Added by
   * readStat() to the base stat axis. Reset at combat start. Granted by
   * the `stat_gain` effect type with a per-card cap.
   */
  statBoostsThisCombat: Partial<Record<import('../../data/types').StatId, number>>;
  /**
   * Rebalance phase: per-card accumulated grant tracker — keyed by card ID
   * then stat. Enforces each card's `max_per_combat` independently across
   * repeated plays / copies of the same card.
   */
  cardStatGainCounters: Record<string, Partial<Record<import('../../data/types').StatId, number>>>;
}

/**
 * Create a fresh CombatState from RunState and enemy definition.
 * HP persists from run. Stamina/mana recover 50% of deficit. Defense resets to 0.
 * Passive relics and class passives are applied immediately.
 */
export function createCombatState(run: RunState, enemy: EnemyDefinition): CombatState {
  // Resolved stats fold in statDeltas + passive relic stat_bonus so all per-run
  // bonuses (relics, event grants) propagate into combat from one source. The
  // LoopHUD reads the same resolveHeroStats, keeping in/out-of-combat in sync.
  const resolved = resolveHeroStats(run);
  const state: CombatState = {
    heroHP: Math.min(run.hero.currentHP, resolved.maxHP),
    heroMaxHP: resolved.maxHP,
    heroStamina: Math.min(
      resolved.maxStamina,
      run.hero.currentStamina + Math.floor((resolved.maxStamina - run.hero.currentStamina) * 0.5),
    ),
    heroMaxStamina: resolved.maxStamina,
    heroMana: Math.min(
      resolved.maxMana,
      run.hero.currentMana + Math.floor((resolved.maxMana - run.hero.currentMana) * 0.5),
    ),
    heroMaxMana: resolved.maxMana,
    heroDefense: 0,
    heroStrength: resolved.str,
    heroDefenseMultiplier: run.hero.defenseMultiplier,
    heroClass: run.hero.className ?? 'warrior',

    deckOrder: [...run.deck.active],

    enemyId: enemy.id,
    enemyName: enemy.name,
    enemyType: enemy.type,
    enemyHP: enemy.baseHP,
    enemyMaxHP: enemy.baseHP,
    enemyDefense: enemy.baseDefense,
    enemyDamage: enemy.attack.damage,
    enemyAttackCooldown: enemy.attackCooldown ?? 2000,
    enemyBaseAttackCooldown: enemy.attackCooldown ?? 2000,
    enemyPattern: enemy.attack.pattern,
    enemySpecialEffect: enemy.attack.specialEffect ?? null,
    enemyAffinity: enemy.affinity ?? null,

    activeRelicIds: [...(run.relics ?? [])],
    activePassives: [],
    heroStunned: false,
    heroStunStacks: 0,
    stunImmuneUntilMs: 0,
    upgraded: [...run.deck.upgraded],
    behaviors: (enemy as any).behaviors ?? [],

    cooldownMultiplier: 1.0,
    firstCardDamageMultiplier: 1.0,
    firstCardCostsZero: false,
    firstNCardsStaminaDiscount: 0,
    firstAttackDamageBonus: 0,
    firstFireCardBurnBonus: 0,
    barrierActive: false,
    pendingGoldBonus: 0,
    relicCounters: {},
    nextArmorMultiplier: 1.0,
    _bloodPactBonus: 0,
    _sanguinePactStrBonus: 0,
    _sanguinePactIntBonus: 0,
    phoenixUsed: false,

    // -- Phase 9: per-combat stat axes seeded from resolveHeroStats(run) --
    heroVitality: 0,
    heroDexterity: 0,
    heroIntellect: 0,
    heroSpirit: 0,

    // -- Phase 9: DoT + status stack pools --
    poisonStacks: 0,
    bleedStacks: 0,
    burnStacks: 0,
    stunStacks: 0,
    slowStacks: 0,
    rageStacks: 0,

    // -- Wave 8: subtile build-amplifier defaults --
    subtileBurnApplyBonus: 0,
    subtileBleedTickBonus: 0,
    subtileSpellDamageMult: 1,
    combatElapsedMs: 0,
    lastHeroDamageMs: null,
    enemyAttackedSinceLastBleedTick: false,
    poisonTickParity: 0,
    nextCardCooldownReduction: 0,
    buffMagnitudePerCard: {},
    heroAuras: [],
    enemyAuras: [],
    heroBurnStacks: 0,
    heroBleedStacks: 0,

    // -- v3 archetype redesigns --
    spentThisCombat: new Set<string>(),
    cdDebtBySlot: {},
    echoCharges: 0,
    echoExpiresAt: 0,
    freeEchoCharges: 0,
    devouredSlots: new Set<number>(),

    // -- Rebalance phase: per-combat stat-gain tracking --
    statBoostsThisCombat: {},
    cardStatGainCounters: {},
  };

  // -- Phase 9: seed per-combat stat axes from resolved per-run stats --
  // VIT*5 maxHP, constellation_sigil, heavy_tome, and class passive
  // stat_modifiers are now folded into resolveHeroStats so the LoopHUD shows
  // the same numbers out of combat — don't re-apply them here.
  state.heroVitality = resolved.vit;
  state.heroDexterity = resolved.dex;
  state.heroIntellect = resolved.int;
  state.heroSpirit = resolved.spi;

  // Apply passive (stat) relics immediately
  applyPassiveRelics(run.relics ?? [], state);

  // C6 — Stamina Reservoir: at combat start, every 3 Stamina the hero ended
  // the previous combat with (read from run.hero.currentStamina, which is what
  // CombatScene wrote on combat:end) converts to +1 STR for this combat, cap +5.
  if ((run.relics ?? []).includes('stamina_reservoir')) {
    const carry = Math.min(5, Math.floor((run.hero.currentStamina ?? 0) / 3));
    state.heroStrength += carry;
  }

  // Apply combat_start relics (first_strike_amulet, etc.)
  applyOnCombatStartRelics(run.relics ?? [], state);

  // Apply class passives from XP (writes to CombatState fields via the
  // dedicated combat helper — the HeroState-shaped applyPassiveModifiers
  // would silently orphan modifiers because CombatState prefixes its keys.)
  const passives = resolvePassives(run);
  applyPassiveModifiersToCombatState(state, passives);
  state.activePassives = passives;

  return state;
}
