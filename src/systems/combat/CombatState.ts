// Transient combat state -- created at combat start, discarded at end.
// Zero Phaser imports. Fully mutable during combat tick loop.

import type { RunState } from '../../state/RunState';
import type { EnemyDefinition, BossBehavior } from '../../data/types';
import { applyPassiveRelics, applyOnCombatStartRelics } from './RelicSystem';
import { resolvePassives, applyPassiveModifiers } from '../hero/PassiveSkillSystem';

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
  enemyHP: number;
  enemyMaxHP: number;
  enemyDefense: number;
  enemyDamage: number;
  enemyAttackCooldown: number;
  enemyPattern: string;
  enemySpecialEffect: string | null;

  /** IDs of relics currently active in this combat */
  activeRelicIds: string[];
  /** Passives applied from class XP */
  activePassives: unknown[];

  /** Flag set by EnemyAI stun effect -- skips next hero card */
  heroStunned: boolean;
  /** Card IDs that are upgraded for this combat */
  upgradedCards: string[];
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
    enemyHP: enemy.baseHP,
    enemyMaxHP: enemy.baseHP,
    enemyDefense: enemy.baseDefense,
    enemyDamage: enemy.attack.damage,
    enemyAttackCooldown: enemy.attackCooldown ?? 2000,
    enemyPattern: enemy.attack.pattern,
    enemySpecialEffect: enemy.attack.specialEffect ?? null,

    activeRelicIds: [...(run.relics ?? [])],
    activePassives: [],
    heroStunned: false,
    upgradedCards: run.deck.upgradedCards ?? [],
    behaviors: (enemy as any).behaviors ?? [],

    cooldownMultiplier: 1.0,
    firstCardDamageMultiplier: 1.0,
    _bloodPactBonus: 0,
    phoenixUsed: false,
  };

  // Apply passive (stat) relics immediately
  applyPassiveRelics(run.relics ?? [], state);

  // Apply combat_start relics (first_strike_amulet, etc.)
  applyOnCombatStartRelics(run.relics ?? [], state);

  // Apply class passives from XP
  const passives = resolvePassives(run);
  applyPassiveModifiers(state as any, passives as any);
  state.activePassives = passives;

  return state;
}
