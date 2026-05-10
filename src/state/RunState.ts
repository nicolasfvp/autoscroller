// Central run state -- zero Phaser dependency.
// Single source of truth for all mutable run data.
// Fully JSON-serializable: no Map, no class instances, no functions.

import { nanoid } from 'nanoid';
import { getClassDef } from '../systems/hero/ClassRegistry';
import { SeededRNG } from '../systems/SeededRNG';
import { MetaState, createDefaultMetaState } from './MetaState';
import { getAvailableCards, getAvailableRelics, getAvailableTiles } from '../systems/UnlockManager';
import type { TileSlot } from '../systems/TileRegistry';
import { eventBus } from '../core/EventBus';
import { clearPendingLoot } from '../systems/PendingLoot';
import { getStorehouseEffects } from '../systems/MetaProgressionSystem';
import { resetRNG } from '../systems/LootGenerator';

// ── State Interfaces ────────────────────────────────────────

export interface HeroState {
  maxHP: number;
  currentHP: number;
  maxStamina: number;
  currentStamina: number;
  maxMana: number;
  currentMana: number;
  currentDefense: number;
  strength: number;
  defenseMultiplier: number;
  moveSpeed: number;
  /** XP earned in current run (lost on death) */
  runXP?: number;
  /** Lifetime XP banked across runs (persists on safe exit) */
  totalXP?: number;
  /** Hero class name */
  className?: string;
}

export interface DeckState {
  /** Card IDs in play order (the active deck) */
  active: string[];
  /** Card IDs in inventory (not currently in deck) mapped to quantity */
  inventory: Record<string, number>;
  /** Card IDs that have been upgraded (display as CardName+) */
  upgradedCards: string[];
  /** Card IDs obtained from loot drops, waiting to be added to active deck */
  droppedCards: string[];
}

export interface LoopState {
  count: number;
  /** The tile layout for the current loop (matches LoopRunner's TileSlot shape) */
  tiles: TileSlot[];
  difficulty: number;
  tileLength: number;
  /**
   * Set to true by CombatScene when a boss is defeated, consumed by
   * GameScene's resume handler to launch BossExitScene. Replaces the
   * previous (run as any)._lastBossDefeated cross-scene flag.
   */
  lastBossDefeated?: boolean;
  /** Cumulative boss kills in this run (for run history reporting). */
  bossesDefeated?: number;
  /**
   * Drives the diminishing loop-growth schedule. Persisted so save/load
   * doesn't reset growth back to schedule[0]. Distinct from bossesDefeated
   * because that field counts *defeats* whereas this counts *Continue
   * choices the player made*.
   */
  bossKillCount?: number;
  /** Hero pixel position within the current loop. Persisted on save. */
  positionInLoop?: number;
  /** Difficulty multiplier for the current loop. Persisted on save. */
  difficultyMultiplier?: number;
}

export interface EconomyState {
  gold: number;
  tilePoints: number;
  /** Tile type -> quantity owned */
  tileInventory: Record<string, number>;
  /** Materials accumulated during the current run (banked at run end) */
  materials: Record<string, number>;
  /** Removals used in the current shop visit (for escalating remove prices). Reset on shop open. */
  removalsThisShop?: number;
  /** Reorders used in the current shop visit (for escalating reorder prices). Reset on shop open. */
  reordersThisShop?: number;
  /**
   * Cached Storehouse gathering boost (0–0.25) — sampled at run start so
   * combat loot doesn't have to load MetaState async every kill.
   */
  gatheringBoost?: number;
}

export interface RunState {
  /** Save schema version — bumped when shape changes incompatibly. */
  version?: number;
  /** Unique run identifier */
  runId: string;
  /** Seed string used to construct the run's SeededRNG (deterministic replays). */
  seed: string;
  /** Run generation (heir system) */
  generation: number;
  /** Timestamp of run start */
  startedAt: number;

  hero: HeroState;
  deck: DeckState;
  loop: LoopState;
  economy: EconomyState;
  relics: string[];

  /** Whether hero is currently in combat (for mid-combat save handling) */
  isInCombat: boolean;
  /** Current scene key (for restoring position on load) */
  currentScene: string;
  /** Whether to stop at shop tiles (toggle in HUD) */
  stopAtShop: boolean;
  /** Combat speed multiplier (0.5x - 3x, default 1x) */
  combatSpeed: number;
  /** Map traversal speed multiplier (0.5x - 3x, default 1x) */
  mapSpeed: number;

  /** Unlocked items valid for this run (populated from MetaState at run start) */
  pool: {
    cards: string[];
    relics: string[];
    tiles: string[];
  };
}

/** Current RunState save schema version. Bump when shape changes incompatibly. */
export const RUN_STATE_VERSION = 1;

/**
 * Apply schema migrations to a raw save blob and return a usable RunState.
 * Existing ad-hoc field-presence backfills (droppedCards, stopAtShop,
 * combatSpeed, mapSpeed) are folded in here so SaveManager.load is one call.
 */
export function migrateRunState(raw: any): RunState | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = Number(raw.version);
  // Treat unversioned saves as v0 — apply v0→v1 backfills.
  if (!Number.isFinite(v) || v < 1) {
    if (raw.deck && !raw.deck.droppedCards) raw.deck.droppedCards = [];
    if (raw.stopAtShop === undefined) raw.stopAtShop = true;
    if (raw.combatSpeed === undefined) raw.combatSpeed = 1;
    if (raw.mapSpeed === undefined) raw.mapSpeed = 1;
    if (raw.currentScene === 'Game') raw.currentScene = 'GameScene';
    if (raw.economy && raw.economy.tileInventory === undefined) raw.economy.tileInventory = {};
    if (raw.economy && raw.economy.materials === undefined) raw.economy.materials = {};
    if (raw.deck && !Array.isArray(raw.deck.upgradedCards)) raw.deck.upgradedCards = [];
    if (raw.loop && raw.loop.bossesDefeated === undefined) raw.loop.bossesDefeated = 0;
    raw.version = 1;
  }
  // Older saves predate run.seed; backfill from runId so resumed runs still
  // have a deterministic SeededRNG source (the actual sequence will diverge
  // from the original session, which is unavoidable for pre-seed saves).
  if (typeof raw.seed !== 'string' || raw.seed.length === 0) {
    raw.seed = typeof raw.runId === 'string' ? raw.runId : Date.now().toString(36);
  }
  return raw as RunState;
}

// ── Factory ─────────────────────────────────────────────────

export function createNewRun(
  metaState?: MetaState,
  generation: number = 1,
  className: string = 'warrior',
  seed?: string,
): RunState {
  const meta = metaState ?? createDefaultMetaState();
  const classDef = getClassDef(className);
  const stats = classDef.baseStats;
  const runId = nanoid();
  const runSeed = seed && seed.length > 0 ? seed : Date.now().toString(36);
  return {
    version: RUN_STATE_VERSION,
    runId,
    seed: runSeed,
    generation,
    startedAt: Date.now(),
    hero: {
      maxHP: stats.maxHP,
      currentHP: stats.maxHP,
      maxStamina: stats.maxStamina,
      currentStamina: stats.maxStamina,
      maxMana: stats.maxMana,
      currentMana: stats.maxMana,
      currentDefense: 0,
      strength: stats.strength,
      defenseMultiplier: stats.defenseMultiplier,
      moveSpeed: 2,
      className: stats.className,
    },
    deck: {
      // Deterministic starter shuffle: bind to (runSeed, runId) so a fresh run
      // with a user-chosen seed shuffles the starter deck the same way each time.
      active: new SeededRNG(`${runSeed}-${runId}-initial-deck`).shuffle([...classDef.starterDeck]),
      inventory: {},
      upgradedCards: [],
      droppedCards: [],
    },
    loop: {
      count: 0,
      tiles: [],
      difficulty: 1,
      tileLength: 20,
      bossesDefeated: 0,
    },
    economy: {
      gold: 0,
      tilePoints: 2,
      tileInventory: {},
      materials: {},
      // Cache Storehouse gathering boost so CombatLoot can multiply drops
      // without an async metaState read on every combat.
      gatheringBoost: getStorehouseEffects(meta.buildings.storehouse.level).gatheringBoost,
    },
    relics: [],
    isInCombat: false,
    currentScene: 'GameScene',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
    pool: {
      cards: getAvailableCards(meta.unlockedCards).map(c => c.id),
      relics: getAvailableRelics(meta.unlockedRelics).map(r => r.id),
      tiles: getAvailableTiles(meta.unlockedTiles).map(t => t.id),
    },
  };
}

// ── Module-level accessor ───────────────────────────────────

let currentRun: RunState | null = null;

export function getRun(): RunState {
  if (!currentRun) throw new Error('No active run -- call createNewRun() or setRun() first');
  return currentRun;
}

export function setRun(state: RunState): void {
  currentRun = state;
}

export function hasActiveRun(): boolean {
  return currentRun !== null;
}

export function clearRun(): void {
  currentRun = null;
  // Drain module-level singletons that survive across runs.
  clearPendingLoot();
  resetRNG();
  eventBus.emit('run:cleared', {});
}
