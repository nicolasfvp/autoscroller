import { describe, it, expect } from 'vitest';
import { applyFilters, FILTER_ELEMENT_OPTIONS, type CardFilters } from '../../src/ui/CardFilterBar.pure';
import type { CardDefinition } from '../../src/data/types';

// Minimal CardDefinition factory — only fields applyFilters reads matter.
function card(overrides: Partial<CardDefinition>): CardDefinition {
  return {
    id: overrides.id ?? 'card_x',
    name: overrides.name ?? 'Generic',
    description: overrides.description ?? 'A card.',
    category: overrides.category ?? 'attack',
    effects: overrides.effects ?? [{ type: 'damage', value: 1, target: 'enemy' }],
    cooldown: overrides.cooldown ?? 1,
    targeting: overrides.targeting ?? 'single',
    rarity: overrides.rarity ?? 'common',
    ...overrides,
  } as CardDefinition;
}

function makeFilters(over: Partial<CardFilters> = {}): CardFilters {
  return {
    element: over.element ?? 'All',
    tiers: over.tiers ?? new Set<1 | 2 | 3>([1, 2, 3]),
    search: over.search ?? '',
  };
}

describe('CardFilterBar / applyFilters', () => {
  const pool: CardDefinition[] = [
    card({ id: 'a1', name: 'Firebolt', description: 'Burn the enemy.', elements: ['fire', 'attack'], tier: 1 }),
    card({ id: 'a2', name: 'Slash',    description: 'A basic attack.', elements: ['attack', 'attack'], tier: 1 }),
    card({ id: 'a3', name: 'Heal',     description: 'Restore HP.',     elements: ['water', 'defense'], tier: 2 }),
    card({ id: 'a4', name: 'Tempest',  description: 'Wind damage.',    elements: ['air', 'fire', 'attack'], tier: 2 }),
    card({ id: 'a5', name: 'Locked',   description: 'Mock T3.',        elements: ['earth', 'fire', 'air', 'water'], tier: 3, locked: true }),
    card({ id: 'a6', name: 'Legacy',   description: 'Old card no tier.' }),
  ];

  it('FILTER_ELEMENT_OPTIONS lists All then physical then elemental in spec order', () => {
    expect(FILTER_ELEMENT_OPTIONS).toEqual([
      'All', 'Attack', 'Defense', 'Agility', 'Counter',
      'Fire', 'Water', 'Earth', 'Air',
    ]);
  });

  it('default filters (All, all tiers, empty search) return everything', () => {
    const result = applyFilters(pool, makeFilters());
    expect(result).toHaveLength(pool.length);
  });

  it('element=Fire keeps only cards whose elements include fire', () => {
    const result = applyFilters(pool, makeFilters({ element: 'Fire' }));
    const ids = result.map((c) => c.id).sort();
    expect(ids).toEqual(['a1', 'a4', 'a5']);
  });

  it('element=Attack keeps only attack-element cards', () => {
    const result = applyFilters(pool, makeFilters({ element: 'Attack' }));
    expect(result.map((c) => c.id).sort()).toEqual(['a1', 'a2', 'a4']);
  });

  it('disabling a tier removes those cards', () => {
    const result = applyFilters(pool, makeFilters({ tiers: new Set<1 | 2 | 3>([1, 2]) }));
    // Excludes a5 (T3). Legacy (a6) has no tier -> treated as T1, kept.
    expect(result.map((c) => c.id).sort()).toEqual(['a1', 'a2', 'a3', 'a4', 'a6']);
  });

  it('tiers set to only [3] keeps just T3 cards', () => {
    const result = applyFilters(pool, makeFilters({ tiers: new Set<1 | 2 | 3>([3]) }));
    expect(result.map((c) => c.id)).toEqual(['a5']);
  });

  it('empty tiers set yields no cards', () => {
    const result = applyFilters(pool, makeFilters({ tiers: new Set<1 | 2 | 3>() }));
    expect(result).toHaveLength(0);
  });

  it('search matches card name case-insensitively', () => {
    const result = applyFilters(pool, makeFilters({ search: 'fire' }));
    // Matches name 'Firebolt' and description 'Wind damage.'? No "fire" word.
    // Only 'Firebolt' name contains 'fire'.
    expect(result.map((c) => c.id)).toEqual(['a1']);
  });

  it('search also matches description substrings', () => {
    const result = applyFilters(pool, makeFilters({ search: 'restore' }));
    expect(result.map((c) => c.id)).toEqual(['a3']);
  });

  it('combines element + tier + search predicates (AND)', () => {
    const result = applyFilters(pool, makeFilters({
      element: 'Fire',
      tiers: new Set<1 | 2 | 3>([1, 2]),
      search: 'damage',
    }));
    // Fire cards with tier in {1,2} whose name/desc include 'damage':
    //   a1 'Burn the enemy.' -> no
    //   a4 'Wind damage.'    -> yes
    expect(result.map((c) => c.id)).toEqual(['a4']);
  });

  it('whitespace-only search is treated as empty', () => {
    const result = applyFilters(pool, makeFilters({ search: '   ' }));
    expect(result).toHaveLength(pool.length);
  });

  it('search with no matches returns empty array', () => {
    const result = applyFilters(pool, makeFilters({ search: 'zzznotacard' }));
    expect(result).toHaveLength(0);
  });
});
