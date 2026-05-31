// Pure helpers for resolving hero stats across the per-run / per-combat layer split.
// No Phaser imports. No mutation -- read-only over RunState and a minimal
// shape from CombatState.
//
// Layer model (Phase 9 / Design v2):
//   * baseStats from ClassDef (immutable per class)
//   * RunState.hero.statDeltas (per-run, persists across combats)
//   * Passive `stat_bonus` relics in RunState.relics (per-run, recomputed each read)
//   * CombatState.heroVitality/heroDexterity/heroIntellect/heroSpirit (per-combat)
//
// resolveHeroStats(run) sums baseStats + statDeltas + passive relic bonuses.
// It does NOT include per-combat buffs -- those are read directly off CombatState
// via readStat(). Driving relic bonuses through this single source lets both the
// LoopHUD (out of combat) and createCombatState (in combat) reflect them.

import type { RunState } from '../../state/RunState';
import type { StatId } from '../../data/types';
import type { ActiveAura } from '../combat/StatusEffects';
import { sumModifier } from '../combat/StatusEffects';
import { getLevel } from './XPSystem';
import relicsData from '../../data/json/relics.json';

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

interface RelicStatBonusEntry {
  id: string;
  trigger?: string;
  effectType?: string;
  stat?: string;
  stats?: Record<string, number>;
  value?: number;
}

const RELIC_BONUS_INDEX: Map<string, RelicStatBonusEntry> = new Map(
  (relicsData as RelicStatBonusEntry[])
    .filter(r => r.trigger === 'passive' && r.effectType === 'stat_bonus')
    .map(r => [r.id, r]),
);

/** Stat-name aliases used in relics.json -> the resolved stat keys. */
function statKeyFor(name: string): keyof ResolvedHeroStats | null {
  switch (name) {
    case 'maxHP': return 'maxHP';
    case 'maxStamina': return 'maxStamina';
    case 'maxMana': return 'maxMana';
    case 'strength': case 'str': return 'str';
    case 'vitality': case 'vit': return 'vit';
    case 'dexterity': case 'dex': return 'dex';
    case 'intellect': case 'int': return 'int';
    case 'spirit': case 'spi': return 'spi';
    default: return null;
  }
}

/**
 * Sum passive `stat_bonus` relic contributions for a run. Exported so callers
 * acquiring a relic (shop / treasure) can mirror the change into current pool
 * values (currentHP / currentStamina / currentMana) without re-implementing the
 * relic-parsing rules.
 */
export function relicStatBonusFor(relicId: string): Partial<Record<keyof ResolvedHeroStats, number>> {
  const out: Partial<Record<keyof ResolvedHeroStats, number>> = {};
  const r = RELIC_BONUS_INDEX.get(relicId);
  if (!r) return out;
  if (r.stat && r.value != null) {
    const k = statKeyFor(r.stat);
    if (k) out[k] = (out[k] ?? 0) + r.value;
  }
  if (r.stats) {
    for (const [s, v] of Object.entries(r.stats)) {
      const k = statKeyFor(s);
      if (k) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

// ── Per-run passive effects that depend on the deck or class XP ──────
// These were historically applied per-combat (heavy_tome, constellation_sigil,
// class passive stat_modifier, VIT*5 → maxHP). Folding them into resolveHeroStats
// makes the LoopHUD show the same numbers as the CombatHUD for any state that
// persists between battles.

const ELEMENT_PRIMARY_STAT_KEY: Record<string, keyof ResolvedHeroStats> = {
  attack: 'str', counter: 'str',
  defense: 'vit', earth: 'vit',
  agility: 'dex', air: 'dex',
  fire: 'int',
  water: 'spi',
};

/** Returns +1 for each unique element across the deck whose primary stat maps to a status. */
function constellationSigilBonus(run: RunState): Partial<Record<keyof ResolvedHeroStats, number>> {
  if (!run.relics?.includes('constellation_sigil')) return {};
  const out: Partial<Record<keyof ResolvedHeroStats, number>> = {};
  const seen = new Set<string>();
  for (const id of run.deck?.active ?? []) {
    const parts = id.split('-');
    if (parts.length < 2) continue;
    for (const el of parts.slice(1)) seen.add(el);
  }
  for (const el of seen) {
    const k = ELEMENT_PRIMARY_STAT_KEY[el];
    if (k) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Heavy Tome: +4 Max HP per deck card past 10. */
function heavyTomeBonus(run: RunState): number {
  if (!run.relics?.includes('heavy_tome')) return 0;
  const excess = Math.max(0, (run.deck?.active?.length ?? 0) - 10);
  return excess * 4;
}

/**
 * Class passive `stat_modifier` effects unlocked by totalXP. Mirrors
 * applyPassiveModifiersToCombatState's key mapping so combat seeding and
 * out-of-combat display agree.
 */
function classPassiveBonus(run: RunState): Partial<Record<keyof ResolvedHeroStats, number>> {
  const totalXP = run.hero.totalXP ?? 0;
  if (totalXP <= 0) return {};
  const className = run.hero.className ?? 'warrior';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const data: Array<{ xpThreshold: number; effect: { type: string; stat?: string; value?: number } }> =
    className === 'mage'
      ? require('../../data/json/mage-passives.json')
      : require('../../data/json/warrior-passives.json');
  const out: Partial<Record<keyof ResolvedHeroStats, number>> = {};
  for (const p of data) {
    if (totalXP < p.xpThreshold) continue;
    if (p.effect.type !== 'stat_modifier' || !p.effect.stat || p.effect.value == null) continue;
    let k: keyof ResolvedHeroStats | null = null;
    switch (p.effect.stat) {
      case 'maxHP': k = 'maxHP'; break;
      case 'maxStamina': k = 'maxStamina'; break;
      case 'maxMana': k = 'maxMana'; break;
      case 'attackDamage': k = 'str'; break;
      default: k = null;
    }
    if (k) out[k] = (out[k] ?? 0) + p.effect.value;
  }
  return out;
}

// ── In-run leveling (TASK 1) ────────────────────────────────────────
// The hero gains MEANINGFUL power from XP earned WITHIN the current run.
// This is DERIVED from run.hero.runXP only (the XP earned this run, which
// resets to 0 on death / on bank). It is intentionally SEPARATE from
// totalXP/classXP (which drives cross-run passives via classPassiveBonus).
//
// Curve (getLevel: base 50, growth 1.15 — cumulative L4≈249, L6≈436, L8≈683):
//   per level:        +6 maxHP
//   every 2 levels:   +1 Vitality, +1 to the class offensive axis
//                     (warrior → Strength, mage → Intellect)
//   every 4 levels:   +1 Dexterity
// A ~10-loop run (≈30-50 combats, mostly normals @10 XP + a few elites @30)
// lands around level 5-7: e.g. L6 → +36 maxHP, +3 VIT (also +15 maxHP via
// the VIT*5 layer), +3 to the offensive axis, +1 DEX. Rewarding, not broken.

const IN_RUN_MAXHP_PER_LEVEL = 6;
const IN_RUN_VIT_EVERY = 2;
const IN_RUN_OFFENSE_EVERY = 2;
const IN_RUN_DEX_EVERY = 4;

export interface InRunLevelBonus {
  maxHP: number;
  strength: number;
  vitality: number;
  dexterity: number;
  intellect: number;
  spirit: number;
}

/**
 * Pure, Phaser-free in-run level bonus derived from XP earned THIS run.
 * Class-aware: the offensive axis is Strength for warrior, Intellect for mage
 * (any other class defaults to Strength). spirit is never granted here.
 */
export function getInRunLevelBonus(runXP: number, className: string): InRunLevelBonus {
  const level = getLevel(Math.max(0, runXP));
  const bonus: InRunLevelBonus = {
    maxHP: level * IN_RUN_MAXHP_PER_LEVEL,
    strength: 0,
    vitality: Math.floor(level / IN_RUN_VIT_EVERY),
    dexterity: Math.floor(level / IN_RUN_DEX_EVERY),
    intellect: 0,
    spirit: 0,
  };
  const offense = Math.floor(level / IN_RUN_OFFENSE_EVERY);
  if (className === 'mage') bonus.intellect += offense;
  else bonus.strength += offense;
  return bonus;
}

/**
 * Resolve final per-run stats. Layers:
 *   1. ClassDef baseStats (already on run.hero.*)
 *   2. RunState.hero.statDeltas (event-granted permanent shifts)
 *   3. Passive `stat_bonus` relics in run.relics
 *   4. Class passive `stat_modifier` unlocked by totalXP
 *   5. constellation_sigil (deck-element-based)
 *   6. heavy_tome (deck-size-based maxHP)
 *   7. In-run level bonus derived from runXP (TASK 1)
 *   8. VIT*5 → maxHP scaling
 *
 * Per-combat buffs (card buffs, combat_start_bundle armor/rage, stamina_reservoir,
 * auras) are still owned by CombatState and read via readStat — they intentionally
 * don't show in the LoopHUD because they don't persist between battles.
 */
export function resolveHeroStats(run: RunState): ResolvedHeroStats {
  const h = run.hero;
  const d = h.statDeltas ?? {};
  const resolved: ResolvedHeroStats = {
    maxHP: h.maxHP + (d.maxHP ?? 0),
    maxStamina: h.maxStamina + (d.maxStamina ?? 0),
    maxMana: h.maxMana + (d.maxMana ?? 0),
    str: h.strength + (d.str ?? 0),
    vit: h.vitality + (d.vit ?? 0),
    dex: h.dexterity + (d.dex ?? 0),
    int: h.intellect + (d.int ?? 0),
    spi: h.spirit + (d.spi ?? 0),
  };
  for (const id of run.relics ?? []) {
    const bonus = relicStatBonusFor(id);
    for (const k of Object.keys(bonus) as Array<keyof ResolvedHeroStats>) {
      resolved[k] += bonus[k] ?? 0;
    }
  }
  const passive = classPassiveBonus(run);
  for (const k of Object.keys(passive) as Array<keyof ResolvedHeroStats>) {
    resolved[k] += passive[k] ?? 0;
  }
  const constellation = constellationSigilBonus(run);
  for (const k of Object.keys(constellation) as Array<keyof ResolvedHeroStats>) {
    resolved[k] += constellation[k] ?? 0;
  }
  resolved.maxHP += heavyTomeBonus(run);
  // TASK 1: in-run level bonus from runXP. Folded in BEFORE the VIT*5 layer so
  // the granted Vitality also scales into maxHP (matching the relic/passive
  // pattern above). Class-aware via run.hero.className.
  const inRun = getInRunLevelBonus(h.runXP ?? 0, h.className ?? 'warrior');
  resolved.maxHP += inRun.maxHP;
  resolved.str += inRun.strength;
  resolved.vit += inRun.vitality;
  resolved.dex += inRun.dexterity;
  resolved.int += inRun.intellect;
  resolved.spi += inRun.spirit;
  // VIT*5 → maxHP must layer LAST so it scales the post-relic, post-passive VIT.
  if (resolved.vit > 0) resolved.maxHP += resolved.vit * 5;
  return resolved;
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
    /** Rebalance phase: per-combat permanent stat boost (capped per card). */
    statBoostsThisCombat?: Partial<Record<StatId, number>>;
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
  if (state.statBoostsThisCombat) {
    base += state.statBoostsThisCombat[stat] ?? 0;
  }
  return base;
}
