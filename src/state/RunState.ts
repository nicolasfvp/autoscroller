// Central run state -- zero Phaser dependency.
// Single source of truth for all mutable run data.
// Fully JSON-serializable: no Map, no class instances, no functions.

import { nanoid } from 'nanoid';
import { getClassDef } from '../systems/hero/ClassRegistry';
import { SeededRNG } from '../systems/SeededRNG';
import { MetaState, createDefaultMetaState } from './MetaState';
import { getAvailableCards, getAvailableRelics, getAvailableTiles } from '../systems/UnlockManager';
import type { TileSlot } from '../systems/TileRegistry';
import type { StatId } from '../data/types';
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
  // -- Phase 9 (Design v2): status system stat axes --
  // Defaults from class baseStats; mutated via relics/passives/events.
  vitality: number;
  dexterity: number;
  intellect: number;
  spirit: number;
  /**
   * Per-run additive stat deltas applied on top of class baseStats.
   * Mutated in place by cards/relics/events that grant permanent in-run shifts
   * (Worldroot Seed, Crown of Pact, Shrine of Pact, Eternal Veil). Resets to {}
   * on createNewRun. Distinct from per-combat buffs (which live on CombatState).
   */
  statDeltas: Partial<Record<"maxHP" | "maxStamina" | "maxMana" | StatId, number>>;
}

export interface DeckState {
  /** Card IDs in play order (the active deck) */
  active: string[];
  /** Card IDs in inventory (not currently in deck) mapped to quantity */
  inventory: Record<string, number>;
  /**
   * Per-deck-position upgrade flags. Length always matches `active`.
   * `upgraded[i] === true` means the card at `active[i]` is upgraded
   * (displayed as CardName+). Tracking by position lets duplicate
   * card IDs be upgraded independently.
   */
  upgraded: boolean[];
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

export interface RunStats {
  damageDealt: number;
  cardsPlayed: number;
  combosTriggered: number;
  goldEarned: number;
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
  stats: RunStats;

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
export const RUN_STATE_VERSION = 4;

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
    if (!raw.stats) {
      raw.stats = { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: raw.economy?.gold || 0 };
    }
    raw.version = 1;
  }
  // v1 → v2: switch from `deck.upgradedCards: string[]` (per-id tracking)
  // to `deck.upgraded: boolean[]` (per-position tracking). Existing per-id
  // saves can't be reverse-engineered to per-instance, so any duplicate
  // copies of an upgraded ID stay upgraded together (preserves prior behavior).
  if (raw.version === 1) {
    if (raw.deck) {
      const active: string[] = Array.isArray(raw.deck.active) ? raw.deck.active : [];
      const oldUpgraded: string[] = Array.isArray(raw.deck.upgradedCards) ? raw.deck.upgradedCards : [];
      if (!Array.isArray(raw.deck.upgraded)) {
        raw.deck.upgraded = active.map((id: string) => oldUpgraded.includes(id));
      }
      delete raw.deck.upgradedCards;
    }
    raw.version = 2;
  }
  // Older saves predate run.seed; backfill from runId so resumed runs still
  // have a deterministic SeededRNG source (the actual sequence will diverge
  // from the original session, which is unavoidable for pre-seed saves).
  if (typeof raw.seed !== 'string' || raw.seed.length === 0) {
    raw.seed = typeof raw.runId === 'string' ? raw.runId : Date.now().toString(36);
  }
  // v2 → v3: harden loop-resume invariants. The previous LoopState used a
  // typed-but-unenforced `tiles: TileData[]` while runtime stored TileSlot.
  // Saves taken before C.8 wiring may have null/undefined `loop.tiles` or
  // a missing `seed` field; coerce both so resumeRun() has a sane shape.
  if (raw.version === 2) {
    if (raw.loop) {
      if (!Array.isArray(raw.loop.tiles)) {
        raw.loop.tiles = [];
      }
      if (typeof raw.loop.positionInLoop !== 'number') {
        raw.loop.positionInLoop = 0;
      }
    }
    if (typeof raw.seed !== 'string' || raw.seed.length === 0) {
      raw.seed = typeof raw.runId === 'string' && raw.runId.length > 0
        ? raw.runId.slice(0, 8)
        : Date.now().toString(36);
    }
    raw.version = 3;
  }
  // v3 -> v4 (Phase 9 / Design v2): backfill HeroState stat axes
  // (vitality/dexterity/intellect/spirit) and statDeltas. A v3 save that
  // pre-dates the status system gets zero defaults for the new stats and
  // an empty statDeltas object so resolveHeroStats() produces baseStats.
  if (raw.version === 3) {
    if (raw.hero) {
      if (raw.hero.vitality === undefined) raw.hero.vitality = 0;
      if (raw.hero.dexterity === undefined) raw.hero.dexterity = 0;
      if (raw.hero.intellect === undefined) raw.hero.intellect = 0;
      if (raw.hero.spirit === undefined) raw.hero.spirit = 0;
      if (raw.hero.statDeltas === undefined || raw.hero.statDeltas === null) {
        raw.hero.statDeltas = {};
      }
    }
    raw.version = 4;
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
      // Phase 9 stat axes seeded from class baseStats; statDeltas starts empty.
      vitality: stats.vitality,
      dexterity: stats.dexterity,
      intellect: stats.intellect,
      spirit: stats.spirit,
      statDeltas: {},
    },
    deck: (() => {
      // Deterministic starter shuffle: bind to (runSeed, runId) so a fresh run
      // with a user-chosen seed shuffles the starter deck the same way each time.
      const active = new SeededRNG(`${runSeed}-${runId}-initial-deck`).shuffle([...classDef.starterDeck]);
      return {
        active,
        inventory: {},
        upgraded: new Array(active.length).fill(false),
        droppedCards: [],
      };
    })(),
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
    stats: {
      damageDealt: 0,
      cardsPlayed: 0,
      combosTriggered: 0,
      goldEarned: 0,
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

/**
 * Phase 9 (Task 5): mutate statDeltas AND emit the stat_changed trigger.
 * Centralizes the trigger so cards / relics / events all fire stat_changed
 * relics via a single helper instead of inlining the event emit at every
 * statDelta write site.
 */
export function applyStatDelta(
  run: RunState,
  stat: "maxHP" | "maxStamina" | "maxMana" | "str" | "vit" | "dex" | "int" | "spi",
  delta: number,
): void {
  if (delta === 0) return;
  const d = run.hero.statDeltas ?? (run.hero.statDeltas = {});
  d[stat] = (d[stat] ?? 0) + delta;
  eventBus.emit('combat:stat-changed', { stat, delta });
}
