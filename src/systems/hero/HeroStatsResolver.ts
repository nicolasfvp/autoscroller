// Pure helpers for resolving hero stats across the per-run / per-combat layer split.
// No Phaser imports. No mutation -- read-only over RunState and a minimal
// shape from CombatState.
//
// Layer model (Phase 9 / Design v2):
//   * baseStats from ClassDef (immutable per class)
//   * RunState.hero.statDeltas (per-run, persists across combats)
//   * CombatState.heroVitality/heroDexterity/heroIntellect/heroSpirit (per-combat)
//
// resolveHeroStats(run) sums baseStats + statDeltas. It does NOT include
// per-combat buffs -- those are read directly off CombatState via readStat().

import type { RunState } from '../../state/RunState';
import type { StatId } from '../../data/types';
import type { ActiveAura } from '../combat/StatusEffects';
import { sumModifier } from '../combat/StatusEffects';

export interface ResolvedHeroStats {
  maxHP: number;
  maxStamina: number;
  maxMana: number;
  str: number;
  vit: number;
  dex: number;
  int: number;
  spi: number;
}

/** Resolve final per-run stats: baseStats + statDeltas. */
export function resolveHeroStats(run: RunState): ResolvedHeroStats {
  const h = run.hero;
  const d = h.statDeltas ?? {};
  return {
    maxHP: h.maxHP + (d.maxHP ?? 0),
    maxStamina: h.maxStamina + (d.maxStamina ?? 0),
    maxMana: h.maxMana + (d.maxMana ?? 0),
    str: h.strength + (d.str ?? 0),
    vit: h.vitality + (d.vit ?? 0),
    dex: h.dexterity + (d.dex ?? 0),
    int: h.intellect + (d.int ?? 0),
    spi: h.spirit + (d.spi ?? 0),
  };
}

/**
 * Read a per-combat stat from a CombatState-shaped object. CardResolver's
 * scale-effect logic uses this to apply per-combat stat buffs without
 * touching RunState. Kept structural (just the five fields) so tests can
 * pass a plain object literal without constructing a full CombatState.
 */
export function readStat(
  state: {
    heroStrength: number;
    heroVitality: number;
    heroDexterity: number;
    heroIntellect: number;
    heroSpirit: number;
    /** Optional: aura modifiers add to the resolved value when present. */
    heroAuras?: ActiveAura[];
  },
  stat: StatId,
): number {
  let base: number;
  switch (stat) {
    case 'str': base = state.heroStrength; break;
    case 'vit': base = state.heroVitality; break;
    case 'dex': base = state.heroDexterity; break;
    case 'int': base = state.heroIntellect; break;
    case 'spi': base = state.heroSpirit; break;
  }
  if (state.heroAuras && state.heroAuras.length > 0) {
    base += sumModifier(state.heroAuras, stat);
  }
  return base;
}
