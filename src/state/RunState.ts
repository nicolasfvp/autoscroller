// Central run state -- zero Phaser dependency.
// Single source of truth for all mutable run data.
// Fully JSON-serializable: no Map, no class instances, no functions.

import { nanoid } from 'nanoid';

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
}

export interface DeckState {
  /** Card IDs in play order (the active deck) */
  active: string[];
  /** Card IDs in inventory (not currently in deck) mapped to quantity */
  inventory: Record<string, number>;
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
}

// ── Factory ─────────────────────────────────────────────────

export function createNewRun(generation: number = 1): RunState {
  return {
    runId: nanoid(),
    generation,
    startedAt: Date.now(),
    hero: {
      maxHP: 100,
      currentHP: 100,
      maxStamina: 50,
      currentStamina: 50,
      maxMana: 30,
      currentMana: 30,
      currentDefense: 0,
      strength: 1,
      defenseMultiplier: 1,
      moveSpeed: 2,
    },
    deck: {
      active: [],
      inventory: {},
    },
    loop: {
      count: 0,
      tiles: [],
      difficulty: 1,
      tileLength: 20,
    },
    economy: {
      gold: 0,
      tilePoints: 0,
      tileInventory: {},
    },
    relics: [],
    isInCombat: false,
    currentScene: 'Game',
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
