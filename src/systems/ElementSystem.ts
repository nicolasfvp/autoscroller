// Element system — canonical types and helpers for the 8-element card system.
// See docs/CARDS_SYSTEM.md for the full spec.

import type { StatId } from '../data/types';

export type ElementId =
  | 'attack' | 'defense' | 'agility' | 'counter'
  | 'fire' | 'water' | 'air' | 'earth';

export type ElementCategory = 'physical' | 'elemental';

export type CardTier = 1 | 2 | 3;

export interface ElementDefinition {
  id: ElementId;
  name: string;
  category: ElementCategory;
  primaryStat: StatId;
  identity: string;
  color: string;
  icon: string;
}

export const ELEMENTS: Record<ElementId, ElementDefinition> = {
  attack:   { id: 'attack',   name: 'Attack',   category: 'physical',  primaryStat: 'str', identity: 'Direct damage, rage stacks',          color: '#DC2626', icon: 'sword' },
  defense:  { id: 'defense',  name: 'Defense',  category: 'physical',  primaryStat: 'vit', identity: 'Armor, mitigation, taunt',            color: '#6B7280', icon: 'shield' },
  agility:  { id: 'agility',  name: 'Agility',  category: 'physical',  primaryStat: 'dex', identity: 'Cooldown reduction, dodge',           color: '#FACC15', icon: 'feather' },
  counter:  { id: 'counter',  name: 'Counter',  category: 'physical',  primaryStat: 'str', identity: 'Reflect damage, retaliate',           color: '#B91C1C', icon: 'crossed-swords' },
  fire:     { id: 'fire',     name: 'Fire',     category: 'elemental', primaryStat: 'int', identity: 'Burn DoT, sustained damage',          color: '#F97316', icon: 'flame' },
  water:    { id: 'water',    name: 'Water',    category: 'elemental', primaryStat: 'spi', identity: 'Heal, shield, freeze',                color: '#0EA5E9', icon: 'droplet' },
  air:      { id: 'air',      name: 'Air',      category: 'elemental', primaryStat: 'dex', identity: 'Speed, multi-strike, weakness',       color: '#C4B5FD', icon: 'wind' },
  earth:    { id: 'earth',    name: 'Earth',    category: 'elemental', primaryStat: 'vit', identity: 'Stun, slow, elemental armor',         color: '#92400E', icon: 'rock' },
};

export const ALL_ELEMENT_IDS: ElementId[] = ['attack', 'defense', 'agility', 'counter', 'fire', 'water', 'air', 'earth'];
export const PHYSICAL_ELEMENTS: ElementId[] = ['attack', 'defense', 'agility', 'counter'];
export const ELEMENTAL_ELEMENTS: ElementId[] = ['fire', 'water', 'air', 'earth'];

export const SHARDS_PER_ELEMENT = 10;

// Pack-based shard drops. Each kill rolls N packs; each pack rolls one element
// (via class bias) and assigns K shards of that element. Boss pack count is fixed.
export const DROP_RATES = {
  normal: { packs: { min: 1, max: 3 }, perPack: { min: 1, max: 4 } },
  elite:  { packs: { min: 1, max: 3 }, perPack: { min: 3, max: 9 } },
  boss:   { packs: { min: 3, max: 3 }, perPack: { min: 5, max: 9 } },
} as const;

export const CLASS_BIAS: Record<string, { physical: number; elemental: number }> = {
  warrior: { physical: 0.75, elemental: 0.25 },
  mage:    { physical: 0.25, elemental: 0.75 },
};

export const FORGE_BASE_COST: Record<CardTier, number> = {
  1: 0,
  2: 100,
  3: 350,
};

export const FORGE_DISCOUNT_BY_LEVEL: Record<number, number> = {
  0: 0, 1: 0, 2: 0.10, 3: 0.15, 4: 0.20, 5: 0.25, 6: 0.30,
};

export const FORGE_TIER_UNLOCK: Record<CardTier, number> = {
  1: 0,
  2: 2,
  3: 4,
};

export const DECK_MIN = 5;
export const DECK_MAX = 15;
export const STARTER_DECK_SIZE = 5;
export const STARTER_ELEMENT_BUDGET = 10;

export const CLASS_DECK_RATIO: Record<string, { physicalMin: number; physicalMax: number; elementalMin: number; elementalMax: number }> = {
  warrior: { physicalMin: 7, physicalMax: 10, elementalMin: 0, elementalMax: 3 },
  mage:    { physicalMin: 0, physicalMax: 3,  elementalMin: 7, elementalMax: 10 },
};

export const PRESETS_PER_CLASS = 5;

// ── Helpers ─────────────────────────────────────────────────

export function elementCategory(id: ElementId): ElementCategory {
  return ELEMENTS[id].category;
}

export function isPhysical(id: ElementId): boolean {
  return ELEMENTS[id].category === 'physical';
}

export function isElemental(id: ElementId): boolean {
  return ELEMENTS[id].category === 'elemental';
}

/** Canonical card id format: "t{tier}-{elements joined with '-' in alphabetical order}". Tier 1 = 2 elements; Tier 2 = 3; Tier 3 = 4. */
export function canonicalCardId(elements: ElementId[]): string {
  const sorted = [...elements].sort();
  const tier = (sorted.length - 1) as CardTier;
  return `t${tier}-${sorted.join('-')}`;
}

/** Returns a stable string key for a multiset (alphabetical join). */
export function multisetKey(elements: ElementId[]): string {
  return [...elements].sort().join('+');
}

/** Counts physical vs elemental elements in a multiset. */
export function countElementCategories(elements: ElementId[]): { physical: number; elemental: number; total: number } {
  let physical = 0;
  let elemental = 0;
  for (const e of elements) {
    if (isPhysical(e)) physical++;
    else elemental++;
  }
  return { physical, elemental, total: elements.length };
}

/** Counts how many elements of each id appear in the multiset. */
export function elementCounts(elements: ElementId[]): Record<ElementId, number> {
  const counts: Record<ElementId, number> = {
    attack: 0, defense: 0, agility: 0, counter: 0,
    fire: 0, water: 0, air: 0, earth: 0,
  };
  for (const e of elements) counts[e]++;
  return counts;
}

/** Returns the dominant element (highest count) — for tiebreak, returns alphabetical first. */
export function dominantElement(elements: ElementId[]): ElementId {
  const counts = elementCounts(elements);
  let best: ElementId = elements[0];
  let bestCount = counts[best];
  for (const id of ALL_ELEMENT_IDS) {
    if (counts[id] > bestCount) {
      best = id;
      bestCount = counts[id];
    }
  }
  return best;
}
