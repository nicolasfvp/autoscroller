// Pure (Phaser-free) helpers for CardFilterBar. Keeping this isolated lets
// node-environment unit tests import `applyFilters` without pulling Phaser
// (which throws on import in a non-DOM context).

import type { CardDefinition, ElementId } from '../data/types';
import { formatCardDescription } from '../systems/cards/CardText';

export interface CardFilters {
  element: string;         // "All" | "Fire" | "Attack" | ...
  tiers: Set<1 | 2 | 3>;
  search: string;          // lowercased
}

// ── Sort ────────────────────────────────────────────────────
// Deckbuilder/browsing sort modes. 'tier' is the default browse order.
export type CardSortMode = 'tier' | 'cost' | 'cooldown' | 'name';

export const CARD_SORT_MODES: CardSortMode[] = ['tier', 'cost', 'cooldown', 'name'];

export const CARD_SORT_LABEL: Record<CardSortMode, string> = {
  tier: 'Tier',
  cost: 'Cost',
  cooldown: 'Cooldown',
  name: 'Name',
};

/** Total numeric cost of a card (stamina + mana + defense). Missing -> 0. */
function totalCost(card: CardDefinition): number {
  const c = card.cost;
  if (!c) return 0;
  return (c.stamina ?? 0) + (c.mana ?? 0) + (c.defense ?? 0);
}

/**
 * Pure, stable card sort. Returns a NEW array (does not mutate input). Each
 * mode falls back to name (then id) as a deterministic tie-breaker so the
 * order is stable across calls regardless of the engine's Array.sort.
 *   - 'tier'     : ascending tier (no-tier cards treated as T1).
 *   - 'cost'     : ascending total resource cost.
 *   - 'cooldown' : ascending base cooldown.
 *   - 'name'     : alphabetical by display name.
 */
export function sortCards(cards: CardDefinition[], mode: CardSortMode): CardDefinition[] {
  const byName = (a: CardDefinition, b: CardDefinition): number => {
    const n = (a.name ?? '').localeCompare(b.name ?? '');
    if (n !== 0) return n;
    return (a.id ?? '').localeCompare(b.id ?? '');
  };
  const out = cards.slice();
  out.sort((a, b) => {
    let primary = 0;
    switch (mode) {
      case 'tier':     primary = (a.tier ?? 1) - (b.tier ?? 1); break;
      case 'cost':     primary = totalCost(a) - totalCost(b); break;
      case 'cooldown': primary = (a.cooldown ?? 0) - (b.cooldown ?? 0); break;
      case 'name':     return byName(a, b);
    }
    return primary !== 0 ? primary : byName(a, b);
  });
  return out;
}

// Dropdown options in spec order: All -> physical -> elemental.
export const FILTER_ELEMENT_OPTIONS: string[] = [
  'All',
  'Attack', 'Defense', 'Agility', 'Counter',
  'Fire', 'Water', 'Earth', 'Air',
];

export const ELEMENT_LABEL_TO_ID: Record<string, ElementId | null> = {
  All:      null,
  Attack:   'attack',
  Defense:  'defense',
  Agility:  'agility',
  Counter:  'counter',
  Fire:     'fire',
  Water:    'water',
  Earth:    'earth',
  Air:      'air',
};

// Search haystacks are expensive to build (per-card formatCardDescription is
// non-trivial) and stable for the lifetime of the card object. We memoize by
// card-object identity so repeated filtering — every keystroke in a search box
// — only pays the construction cost once per card per session.
const haystackCache = new WeakMap<CardDefinition, string>();

function getHaystack(card: CardDefinition): string {
  const cached = haystackCache.get(card);
  if (cached !== undefined) return cached;
  const rendered = formatCardDescription({
    effects: card.effects,
    exhaust: card.exhaust,
    spend_armor: card.spend_armor,
  });
  const hay = `${card.name} ${card.description ?? ''} ${rendered}`.toLowerCase();
  haystackCache.set(card, hay);
  return hay;
}

/**
 * Pure filter — exported for tests and for callers that need to re-apply
 * filters to a card subset (e.g. a deck-browsing pool).
 */
export function applyFilters(allCards: CardDefinition[], filters: CardFilters): CardDefinition[] {
  const elemId = ELEMENT_LABEL_TO_ID[filters.element] ?? null;
  const q = (filters.search ?? '').trim().toLowerCase();
  return allCards.filter((card) => {
    // Tier gate. Cards with no tier field are treated as Tier 1 (legacy).
    const tier = (card.tier ?? 1) as 1 | 2 | 3;
    if (!filters.tiers.has(tier)) return false;
    // Element gate.
    if (elemId) {
      if (!card.elements || !card.elements.includes(elemId)) return false;
    }
    // Search gate (name OR description, case-insensitive substring). The
    // haystack includes BOTH the static description AND the dynamic formatter
    // output — the static text holds flavor, the dynamic text holds the
    // canonical rendered vocabulary (modifier keywords like "Vengeance" and
    // stack/stat tokens like "Burn", "Bleed", "STR", …).
    if (q.length > 0) {
      if (!getHaystack(card).includes(q)) return false;
    }
    return true;
  });
}
