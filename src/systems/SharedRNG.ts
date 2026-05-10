// Module-level shared RNG. Set once at run start (GameScene.create) and
// consumed by every loot/event/combat system that needs deterministic
// rolls. When unset (tests, standalone tooling), helpers fall back to
// Math.random so callers don't crash.

import type { SeededRNG } from './SeededRNG';

let activeRNG: SeededRNG | null = null;

export function setActiveRNG(rng: SeededRNG | null): void {
  activeRNG = rng;
}

export function getActiveRNG(): SeededRNG | null {
  return activeRNG;
}

/** Returns float in [0, 1). Falls back to Math.random when no RNG is set. */
export function rand(): number {
  return activeRNG ? activeRNG.random() : Math.random();
}

/** Returns integer in [min, max] inclusive. */
export function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** Fisher-Yates shuffle in place; returns the same array. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
