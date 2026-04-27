// XP earn, bank, and lose operations.
// No Phaser dependency. Pure functions operating on RunState.

import type { RunState } from '../../state/RunState';

// ── XP Rewards ──────────────────────────────────────────────

const XP_PER_ENEMY_TYPE: Record<string, number> = {
  normal: 10,
  elite: 30,
  boss: 80,
};

// ── XP Level Curve (feedback #18) ───────────────────────────
// Exponential cost: each level requires ~15% more XP than the last.
const XP_BASE_PER_LEVEL = 50;
const XP_GROWTH_RATE = 1.15;

/**
 * XP required to go from `level` to `level+1`.
 */
export function getXPForNextLevel(level: number): number {
  return Math.floor(XP_BASE_PER_LEVEL * Math.pow(XP_GROWTH_RATE, level));
}

/**
 * Total cumulative XP required to reach a given level from 0.
 */
function cumulativeXPForLevel(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += getXPForNextLevel(i);
  }
  return total;
}

/**
 * Calculate the level for a given total XP amount.
 */
export function getLevel(totalXP: number): number {
  let level = 0;
  let remaining = totalXP;
  while (remaining >= getXPForNextLevel(level)) {
    remaining -= getXPForNextLevel(level);
    level++;
  }
  return level;
}

// ── Functions ───────────────────────────────────────────────

/**
 * Get XP reward amount for defeating an enemy type.
 */
export function getXPForEnemy(enemyType: 'normal' | 'elite' | 'boss'): number {
  return XP_PER_ENEMY_TYPE[enemyType] ?? 0;
}

/**
 * Add XP to the current run (not yet banked).
 */
export function earnXP(run: RunState, amount: number): void {
  run.hero.runXP = (run.hero.runXP ?? 0) + amount;
}

/**
 * Bank run XP into lifetime total (on safe boss exit).
 * Adds runXP to totalXP, resets runXP to 0.
 */
export function bankXP(run: RunState): void {
  run.hero.totalXP = (run.hero.totalXP ?? 0) + (run.hero.runXP ?? 0);
  run.hero.runXP = 0;
}

/**
 * Lose all run XP (on death). totalXP is preserved.
 */
export function loseAllRunXP(run: RunState): void {
  run.hero.runXP = 0;
}
