// Central run state -- zero Phaser dependency.
// Single source of truth for all mutable run data.
// Fully JSON-serializable: no Map, no class instances, no functions.

import { nanoid } from 'nanoid';
import { getClassDef } from '../systems/hero/ClassRegistry';
import { SeededRNG } from '../systems/SeededRNG';

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

export interface TileData {
  type: string;
  index: number;
  defeated: boolean;
}

export interface LoopState {
  count: number;
  /** The tile layout for the current loop */
  tiles: TileData[];
  difficulty: number;
  tileLength: number;
}

export interface EconomyState {
  gold: number;
  tilePoints: number;
  /** Tile type -> quantity owned */
  tileInventory: Record<string, number>;
  /** Materials accumulated during the current run (banked at run end) */
  materials: Record<string, number>;
}

export interface RunState {
  /** Unique run identifier */
  runId: string;
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
}

// ── Factory ─────────────────────────────────────────────────

export function createNewRun(generation: number = 1, className: string = 'warrior'): RunState {
  const classDef = getClassDef(className);
  const stats = classDef.baseStats;
  const runId = nanoid();
  return {
    runId,
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
      active: new SeededRNG(`${runId}-initial-deck`).shuffle([...classDef.starterDeck]),
      inventory: {},
      upgradedCards: [],
      droppedCards: [],
    },
    loop: {
      count: 0,
      tiles: [],
      difficulty: 1,
      tileLength: 20,
    },
    economy: {
      gold: 0,
      tilePoints: 2,
      tileInventory: {},
      materials: {},
    },
    relics: [],
    isInCombat: false,
    currentScene: 'Game',
    stopAtShop: true,
    combatSpeed: 1,
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
}
