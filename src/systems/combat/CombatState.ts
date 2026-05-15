// Transient combat state -- created at combat start, discarded at end.
// Zero Phaser imports. Fully mutable during combat tick loop.

import type { RunState } from '../../state/RunState';
import type { EnemyDefinition, BossBehavior } from '../../data/types';
import type { ElementId } from '../ElementSystem';
import { applyPassiveRelics, applyOnCombatStartRelics } from './RelicSystem';
import { resolveHeroStats } from '../hero/HeroStatsResolver';
import { resolvePassives, applyPassiveModifiersToCombatState } from '../hero/PassiveSkillSystem';

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
  enemyAttackCooldown: number;
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
  /** Temp strength bonus from blood_pact (applied per card) */
  _bloodPactBonus: number;
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
  freezeStacks: number;
  shockStacks: number;
  arcaneStacks: number;         // cap = arcaneStacksCap (Pitfall 8: cap-and-drop)
  arcaneStacksCap: number;      // default 10
  rageStacks: number;

  /**
   * Phase 9: one-shot cooldown shave consumed by the NEXT card's cooldown.
   * Set by SynergySystem cooldown_reduction bonus type; consumed by
   * CombatEngine.playNextCard immediately after that card resolves.
   */
  nextCardCooldownReduction: number;
}

/**
 * Create a fresh CombatState from RunState and enemy definition.
 * HP persists from run. Stamina/mana recover 50% of deficit. Defense resets to 0.
 * Passive relics and class passives are applied immediately.
 */
export function createCombatState(run: RunState, enemy: EnemyDefinition): CombatState {
  const state: CombatState = {
    heroHP: run.hero.currentHP,
    heroMaxHP: run.hero.maxHP,
    heroStamina: run.hero.currentStamina + Math.floor((run.hero.maxStamina - run.hero.currentStamina) * 0.5),
    heroMaxStamina: run.hero.maxStamina,
    heroMana: run.hero.currentMana + Math.floor((run.hero.maxMana - run.hero.currentMana) * 0.5),
    heroMaxMana: run.hero.maxMana,
    heroDefense: 0,
    heroStrength: run.hero.strength,
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
    enemyPattern: enemy.attack.pattern,
    enemySpecialEffect: enemy.attack.specialEffect ?? null,
    enemyAffinity: enemy.affinity ?? null,

    activeRelicIds: [...(run.relics ?? [])],
    activePassives: [],
    heroStunned: false,
    upgraded: [...run.deck.upgraded],
    behaviors: (enemy as any).behaviors ?? [],

    cooldownMultiplier: 1.0,
    firstCardDamageMultiplier: 1.0,
    _bloodPactBonus: 0,
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
    freezeStacks: 0,
    shockStacks: 0,
    arcaneStacks: 0,
    arcaneStacksCap: 10,
    rageStacks: 0,
    nextCardCooldownReduction: 0,
  };

  // -- Phase 9: seed per-combat stat axes from resolved per-run stats --
  const resolved = resolveHeroStats(run);
  state.heroVitality = resolved.vit;
  state.heroDexterity = resolved.dex;
  state.heroIntellect = resolved.int;
  state.heroSpirit = resolved.spi;

  // -- Phase 9: VIT scales combat-start maxHP (+5 per point per design/00 §3).
  // Applied here so heroMaxHP is the post-VIT value before relic passives
  // (which may further raise it via stat_bonus.maxHP). currentHP is NOT
  // re-floored — entering combat with full HP is a separate concern (run-end
  // healing) that already runs in RunEndResolver / GameScene.
  if (state.heroVitality > 0) {
    const vitBonus = state.heroVitality * 5;
    state.heroMaxHP += vitBonus;
    // Bump currentHP so the hero benefits from VIT on the FIRST combat after
    // the stat was gained (otherwise the buff appears only after a heal). We
    // only top up the bonus amount, not to full, so HP attrition still bites.
    state.heroHP = Math.min(state.heroMaxHP, state.heroHP + vitBonus);
  }

  // Apply passive (stat) relics immediately
  applyPassiveRelics(run.relics ?? [], state);

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
