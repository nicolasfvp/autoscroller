// Pure (Phaser-free) helpers for CardFilterBar. Keeping this isolated lets
// node-environment unit tests import `applyFilters` without pulling Phaser
// (which throws on import in a non-DOM context).

import type { CardDefinition, ElementId } from '../data/types';
import { formatCardDescription } from '../systems/cards/CardText';

export interface CardFilters {
  element: string;         // "All" | "Fire" | "Attack" | ...
  tiers: Set<0 | 1 | 2 | 3>;
  search: string;          // lowercased
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

/**
 * Pure filter — exported for tests and for callers that need to re-apply
 * filters to a card subset (e.g. DeckBuilder's available pool).
 */
export function applyFilters(allCards: CardDefinition[], filters: CardFilters): CardDefinition[] {
  const elemId = ELEMENT_LABEL_TO_ID[filters.element] ?? null;
  const q = (filters.search ?? '').trim().toLowerCase();
  return allCards.filter((card) => {
    // Tier gate. Cards with no tier field are treated as Tier 1 (legacy).
    const tier = (card.tier ?? 1) as 0 | 1 | 2 | 3;
    if (!filters.tiers.has(tier)) return false;
    // Element gate.
    if (elemId) {
      if (!card.elements || !card.elements.includes(elemId)) return false;
    }
    // Search gate (name OR description, case-insensitive substring). v4: hay
    // includes BOTH the static description AND the dynamic formatter output —
    // the static text holds flavor/legacy terms, the dynamic text holds the
    // canonical rendered keywords ("Vengeance", "Shatter", "Scales STR", …).
    if (q.length > 0) {
      const rendered = formatCardDescription({
        effects: card.effects,
        exhaust: card.exhaust,
        spend_armor: card.spend_armor,
        cooldown_scale: card.cooldown_scale,
      });
      const hay = `${card.name} ${card.description ?? ''} ${rendered}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
