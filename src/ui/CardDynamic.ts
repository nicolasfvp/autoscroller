// CardDynamic — global reactive state shared by every card description for the
// dynamic scaled-value feature:
//   * shiftHeld — true while the player holds SHIFT. Default view shows each
//     scaled number RESOLVED with the current stats (bigger + colored); while
//     SHIFT is held the same spot shows the "base + N per [stat]" equation.
//   * liveStats — the hero's effective stats during combat so resolved numbers
//     track status changes; cleared out of combat, where the value falls back
//     to the current run's resolved stats.
//
// Card faces subscribe(); CombatScene feeds live stats each tick. A single
// window-level SHIFT listener is installed lazily on first subscribe (guarded
// for non-DOM environments such as the test runner).

import { getRun } from '../state/RunState';
import { resolveHeroStats } from '../systems/hero/HeroStatsResolver';

export interface EffectiveStats {
  str: number; vit: number; dex: number; int: number; spi: number;
}

export const ZERO_STATS: EffectiveStats = { str: 0, vit: 0, dex: 0, int: 0, spi: 0 };

type Listener = () => void;

const listeners = new Set<Listener>();
let shiftHeld = false;
let liveStats: EffectiveStats | null = null;
let keyListenerInstalled = false;

function notify(): void {
  // Snapshot — listeners may unsubscribe (destroy) during iteration.
  for (const l of [...listeners]) {
    try { l(); } catch { /* a dead card face must not break the rest */ }
  }
}

function ensureKeyListener(): void {
  if (keyListenerInstalled) return;
  keyListenerInstalled = true;
  if (typeof window === 'undefined') return;
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Shift') setShiftHeld(true);
  });
  window.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.key === 'Shift') setShiftHeld(false);
  });
  // Releasing focus (alt-tab) drops the keyup — clear so SHIFT can't stick.
  window.addEventListener('blur', () => setShiftHeld(false));
}

/** Subscribe to shift / live-stat changes. Returns an unsubscribe fn. */
export function subscribeCardDynamic(cb: Listener): () => void {
  ensureKeyListener();
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function isShiftHeld(): boolean {
  return shiftHeld;
}

export function setShiftHeld(v: boolean): void {
  if (shiftHeld === v) return;
  shiftHeld = v;
  notify();
}

/** Feed the hero's current effective combat stats. No-op if unchanged. */
export function setLiveStats(s: EffectiveStats): void {
  if (liveStats
    && liveStats.str === s.str && liveStats.vit === s.vit && liveStats.dex === s.dex
    && liveStats.int === s.int && liveStats.spi === s.spi) {
    return;
  }
  liveStats = { ...s };
  notify();
}

/** Drop live stats — resolved numbers revert to the run's resolved stats. */
export function clearLiveStats(): void {
  if (liveStats === null) return;
  liveStats = null;
  notify();
}

/** The stats a description should resolve against right now: live combat stats
 *  if present, else the active run's resolved stats, else zero (no active run). */
export function getEffectiveStats(): EffectiveStats {
  if (liveStats) return liveStats;
  try {
    const r = resolveHeroStats(getRun());
    return { str: r.str, vit: r.vit, dex: r.dex, int: r.int, spi: r.spi };
  } catch {
    return ZERO_STATS;
  }
}
