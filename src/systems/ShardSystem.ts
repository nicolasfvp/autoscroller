// Shard drop & auto-conversion system.
// See docs/CARDS_SYSTEM.md §4 for the spec.

import type { ElementId } from './ElementSystem';
import {
  ALL_ELEMENT_IDS,
  PHYSICAL_ELEMENTS,
  ELEMENTAL_ELEMENTS,
  SHARDS_PER_ELEMENT,
  DROP_RATES,
  CLASS_BIAS,
} from './ElementSystem';
import { rand as sharedRand } from './SharedRNG';

type RandFn = () => number;

export type ShardInventory = Partial<Record<ElementId, number>>;
export type ElementInventory = Partial<Record<ElementId, number>>;

/** Initializes a zeroed inventory for all 8 elements. */
export function emptyShardInventory(): ShardInventory {
  const inv: ShardInventory = {};
  for (const id of ALL_ELEMENT_IDS) inv[id] = 0;
  return inv;
}
export function emptyElementInventory(): ElementInventory {
  return emptyShardInventory(); // same shape
}

/** Reads a counter, defaulting to 0 for absent keys. */
export function readShards(inv: ShardInventory | undefined, id: ElementId): number {
  return inv?.[id] ?? 0;
}

/**
 * Apply a shard delta and auto-convert any pile ≥10 into element-units.
 * Mutates both inventories in-place.
 * Returns the element-unit deltas (for UI feedback).
 */
export function addShardsAndConvert(
  shardInv: ShardInventory,
  elementInv: ElementInventory,
  delta: ShardInventory,
): ElementInventory {
  const elementsAdded: ElementInventory = {};
  for (const id of ALL_ELEMENT_IDS) {
    const incoming = delta[id] ?? 0;
    if (incoming <= 0) continue;
    const current = shardInv[id] ?? 0;
    const total = current + incoming;
    const converted = Math.floor(total / SHARDS_PER_ELEMENT);
    const remaining = total % SHARDS_PER_ELEMENT;
    shardInv[id] = remaining;
    if (converted > 0) {
      elementInv[id] = (elementInv[id] ?? 0) + converted;
      elementsAdded[id] = converted;
    }
  }
  return elementsAdded;
}

/**
 * Roll shard drops for an enemy kill.
 * - Count is determined by enemy type (normal/elite/boss)
 * - Each shard rolls category by class bias, then uniform among 4 subtypes
 * - Uses SharedRNG by default (deterministic when a run RNG is active).
 */
export function rollShardDrops(
  enemyType: 'normal' | 'elite' | 'boss',
  className: string,
  rng: RandFn = sharedRand,
): ShardInventory {
  const { min, max } = DROP_RATES[enemyType];
  const totalShards = min + Math.floor(rng() * (max - min + 1));
  const bias = CLASS_BIAS[className] ?? CLASS_BIAS.warrior;
  const result: ShardInventory = emptyShardInventory();
  for (let i = 0; i < totalShards; i++) {
    const isPhysical = rng() < bias.physical;
    const pool = isPhysical ? PHYSICAL_ELEMENTS : ELEMENTAL_ELEMENTS;
    const pick = pool[Math.floor(rng() * pool.length)];
    result[pick] = (result[pick] ?? 0) + 1;
  }
  return result;
}

/** Returns a flat shard total across all 8 types. */
export function shardTotal(inv: ShardInventory): number {
  let sum = 0;
  for (const id of ALL_ELEMENT_IDS) sum += inv[id] ?? 0;
  return sum;
}

/** Returns a flat element total across all 8 types. */
export function elementTotal(inv: ElementInventory): number {
  return shardTotal(inv);
}

/** Checks if an inventory has at least the required element multiset. */
export function hasElementsForRecipe(elementInv: ElementInventory, recipe: ElementId[]): boolean {
  const need: Partial<Record<ElementId, number>> = {};
  for (const id of recipe) need[id] = (need[id] ?? 0) + 1;
  for (const id of ALL_ELEMENT_IDS) {
    if ((need[id] ?? 0) > (elementInv[id] ?? 0)) return false;
  }
  return true;
}

/** Spends elements from the inventory (mutates). Caller must validate first. */
export function spendElements(elementInv: ElementInventory, recipe: ElementId[]): void {
  for (const id of recipe) {
    elementInv[id] = (elementInv[id] ?? 0) - 1;
  }
}
