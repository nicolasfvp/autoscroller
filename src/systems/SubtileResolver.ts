import type { TileSlot, SubtileEffectKey } from './TileRegistry';

/**
 * One resolved subtile effect targeting a single combat/boss tile.
 * Overlapping AOEs from same-effect subtiles accumulate via `stacks`.
 */
export interface SubtileEffect {
  /** Combat/boss tile index this effect targets. */
  tileIndex: number;
  /** Which effect (ambush / war_horn / burn_altar / ...). */
  effect: SubtileEffectKey;
  /** Additive stack count across overlapping AOEs. */
  stacks: number;
}

/**
 * Resolve all subtile effects across a loop.
 *
 * Each subtile slot S projects its effect onto combat/boss tiles at
 * positions S-2, S-1, S+1, S+2 (4-tile AOE, host inclusive at distance 1).
 * Same-effect overlaps on the same target tile sum into `stacks`.
 *
 * Distinct subtile keys produce distinct entries on the same target.
 */
export function resolveSubtileEffects(tiles: TileSlot[]): SubtileEffect[] {
  if (tiles.length === 0) return [];

  const isCombatTarget = (t: TileSlot): boolean =>
    t.type === 'terrain' || t.type === 'boss';

  const acc = new Map<string, SubtileEffect>();

  for (let s = 0; s < tiles.length; s++) {
    const slot = tiles[s];
    if (slot.type !== 'subtile' || !slot.subtileEffect) continue;
    for (const offset of [-2, -1, 1, 2] as const) {
      const t = s + offset;
      if (t < 0 || t >= tiles.length) continue;
      if (!isCombatTarget(tiles[t])) continue;
      const key = `${t}|${slot.subtileEffect}`;
      const existing = acc.get(key);
      if (existing) existing.stacks++;
      else acc.set(key, { tileIndex: t, effect: slot.subtileEffect, stacks: 1 });
    }
  }

  return Array.from(acc.values());
}

/**
 * Filter a pre-resolved effect bag down to one combat target.
 * Wave 6 / Wave 4 consumers call this with the tile index they're
 * about to resolve combat for.
 */
export function effectsForTile(bag: SubtileEffect[], tileIndex: number): SubtileEffect[] {
  return bag.filter(e => e.tileIndex === tileIndex);
}
