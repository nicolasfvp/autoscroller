// Typed EventBus -- zero Phaser dependency.
// All cross-system communication goes through this bus.

import type { RunState } from '../state/RunState';

// Define ALL event types in a single interface
export interface GameEvents {
  // Combat events
  'combat:start': { enemyId: string; isElite: boolean; isBoss: boolean };
  'combat:end': { victory: boolean; goldEarned: number; cardDrops: string[] };
  'combat:card-played': { cardId: string; damage: number };
  'combat:damage-dealt': { source: string; target: string; amount: number };

  // Hero events
  'hero:damaged': { amount: number; currentHP: number; maxHP: number };
  'hero:healed': { amount: number; currentHP: number };
  'hero:died': { cause: string };

  // Economy events
  'gold:changed': { delta: number; total: number };
  'tile-points:changed': { delta: number; total: number };

  // Deck events
  'deck:card-added': { cardId: string };
  'deck:card-removed': { cardId: string };
  'deck:reordered': Record<string, never>;

  // Loop events
  'loop:completed': { loopNumber: number; difficulty: number };
  'loop:tile-entered': { tileType: string; index: number };
  'loop:tile-placed': { tileType: string; index: number };

  // Relic events
  'relic:acquired': { relicId: string };
  'relic:triggered': { relicId: string; effect: string };

  // Persistence events
  'save:requested': Record<string, never>;
  'save:completed': { timestamp: number };
  'save:loaded': { runState: RunState };

  // Run lifecycle
  'run:started': { runId: string };
  'run:ended': { victory: boolean; loopsCompleted: number };
}

type Listener<T> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof GameEvents>(event: K, fn: Listener<GameEvents[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  off<K extends keyof GameEvents>(event: K, fn: Listener<GameEvents[K]>): void {
    this.listeners.get(event)?.delete(fn);
  }

  emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }

  /** Remove ALL listeners for a specific event, or all events if no argument. */
  removeAllListeners(event?: keyof GameEvents): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /** Get listener count -- useful for leak detection in dev mode. */
  listenerCount(event: keyof GameEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// Module-level singleton
export const eventBus = new EventBus();
