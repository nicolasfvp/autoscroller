// XP earn, bank, and lose operations.
// No Phaser dependency. Pure functions operating on RunState.

import type { RunState } from '../../state/RunState';

// ── XP Rewards ──────────────────────────────────────────────

const XP_PER_ENEMY_TYPE: Record<string, number> = {
  normal: 10,
  elite: 30,
  boss: 80,
};

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
