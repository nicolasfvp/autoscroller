import { describe, it, expect } from 'vitest';
import {
  applyFilters, sortCards, FILTER_ELEMENT_OPTIONS, CARD_SORT_MODES,
  type CardFilters,
} from '../../src/ui/CardFilterBar.pure';
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
    card({ id: 'a5', name: 'Maelstrom', description: 'Tier 3 card.',    elements: ['earth', 'fire', 'air'], tier: 3 }),
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

describe('CardFilterBar / sortCards', () => {
  const pool: CardDefinition[] = [
    card({ id: 's1', name: 'Cinder',  tier: 3, cooldown: 2, cost: { stamina: 3 } as any }),
    card({ id: 's2', name: 'Aegis',   tier: 1, cooldown: 5, cost: { mana: 1 } as any }),
    card({ id: 's3', name: 'Bolt',    tier: 2, cooldown: 1, cost: { stamina: 1, mana: 1 } as any }),
    card({ id: 's4', name: 'Drift',   tier: 1, cooldown: 3 }),
  ];

  it('exposes the four sort modes in order', () => {
    expect(CARD_SORT_MODES).toEqual(['tier', 'cost', 'cooldown', 'name']);
  });

  it('does not mutate the input array', () => {
    const before = pool.map((c) => c.id);
    sortCards(pool, 'name');
    expect(pool.map((c) => c.id)).toEqual(before);
  });

  it('sorts by tier ascending (name tie-break)', () => {
    const ids = sortCards(pool, 'tier').map((c) => c.id);
    // T1: Aegis(s2), Drift(s4); T2: Bolt(s3); T3: Cinder(s1)
    expect(ids).toEqual(['s2', 's4', 's3', 's1']);
  });

  it('sorts by total cost ascending', () => {
    const ids = sortCards(pool, 'cost').map((c) => c.id);
    // costs: s4=0, s2=1, s3=2, s1=3
    expect(ids).toEqual(['s4', 's2', 's3', 's1']);
  });

  it('sorts by cooldown ascending', () => {
    const ids = sortCards(pool, 'cooldown').map((c) => c.id);
    // cd: s3=1, s1=2, s4=3, s2=5
    expect(ids).toEqual(['s3', 's1', 's4', 's2']);
  });

  it('sorts by name alphabetically', () => {
    const ids = sortCards(pool, 'name').map((c) => c.id);
    // Aegis, Bolt, Cinder, Drift
    expect(ids).toEqual(['s2', 's3', 's1', 's4']);
  });

  it('treats missing tier as T1', () => {
    const legacy = [card({ id: 'L', name: 'Zzz' }), card({ id: 'T2', name: 'Aaa', tier: 2 })];
    const ids = sortCards(legacy, 'tier').map((c) => c.id);
    expect(ids).toEqual(['L', 'T2']);
  });
});
