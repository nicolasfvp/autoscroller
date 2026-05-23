// Map/loop-side relic effects (tile-entered and loop-completed triggers).
// Pulled out of LoopRunner because the runner's LoopRunState slice doesn't
// expose hero HP/stamina/mana or the relics list — those live on the live
// RunState. Until the relics were extracted here, the in-runner checks
// silently read undefined and produced NaN, so Travel Boots /
// Trailblazer's Brand / Lodestone Pendant never fired in production.
//
// All three helpers no-op gracefully if no run is active (e.g. when
// LoopRunner is exercised by isolated tests).

import { hasActiveRun, getRun } from '../state/RunState';
import type { TileSlot } from './TileRegistry';

function clampHero(): void {
  if (!hasActiveRun()) return;
  const hero = getRun().hero;
  if (hero.maxHP > 0 && hero.currentHP > hero.maxHP) hero.currentHP = hero.maxHP;
  if (hero.maxStamina > 0 && hero.currentStamina > hero.maxStamina) hero.currentStamina = hero.maxStamina;
  if (hero.maxMana > 0 && hero.currentMana > hero.maxMana) hero.currentMana = hero.maxMana;
}

/** Travel Boots: +1 HP on entering each new tile. */
export function applyTravelBoots(): void {
  if (!hasActiveRun()) return;
  const run = getRun();
  if (!run.relics.includes('travel_boots')) return;
  run.hero.currentHP = Math.min(run.hero.maxHP, run.hero.currentHP + 1);
}

/**
 * Trailblazer's Brand: first combat tile entered each loop heals 5 HP and
 * +1 stamina / +1 mana. The "fired this loop" flag lives on run.loop and
 * is reset by applyLodestonePendant (or the loop-completed code path that
 * also drives Lodestone).
 */
export function applyTrailblazersBrand(tile: TileSlot): void {
  if (!hasActiveRun()) return;
  const run = getRun();
  if (!run.relics.includes('trailblazers_brand')) return;
  if (run.loop.trailblazerFiredThisLoop) return;
  const isCombatTile =
    (tile.type === 'basic' && !!tile.enemyId) ||
    (tile.type === 'terrain' && !!tile.enemyId) ||
    (tile.type === 'subtile' && !!tile.enemyId) ||
    tile.type === 'boss';
  if (!isCombatTile) return;
  run.hero.currentHP = Math.min(run.hero.maxHP, run.hero.currentHP + 5);
  run.hero.currentStamina = Math.min(run.hero.maxStamina, run.hero.currentStamina + 1);
  run.hero.currentMana = Math.min(run.hero.maxMana, run.hero.currentMana + 1);
  run.loop.trailblazerFiredThisLoop = true;
}

/**
 * Lodestone Pendant: on loop completion, heal 8 HP and +1 stamina / +1 mana.
 * Also resets Trailblazer's per-loop flag (always, even if the relic isn't
 * equipped) so the next loop's first combat tile re-arms it.
 */
export function applyLodestonePendant(): void {
  if (!hasActiveRun()) return;
  const run = getRun();
  // Always reset the per-loop trailblazer flag on loop boundary.
  run.loop.trailblazerFiredThisLoop = false;
  if (!run.relics.includes('lodestone_pendant')) return;
  run.hero.currentHP = Math.min(run.hero.maxHP, run.hero.currentHP + 8);
  run.hero.currentStamina = Math.min(run.hero.maxStamina, run.hero.currentStamina + 1);
  run.hero.currentMana = Math.min(run.hero.maxMana, run.hero.currentMana + 1);
  clampHero();
}
