// Deck builder validation & preset helpers.
// See docs/CARDS_SYSTEM.md §6 for the spec.

import type { ElementId } from './ElementSystem';
import {
  DECK_MIN,
  DECK_MAX,
  STARTER_DECK_SIZE,
  STARTER_ELEMENT_BUDGET,
  CLASS_DECK_RATIO,
  PRESETS_PER_CLASS,
  countElementCategories,
} from './ElementSystem';
import { getCardById } from '../data/DataLoader';

export interface DeckPreset {
  name: string;
  cardIds: string[];
}

export interface DeckValidation {
  valid: boolean;
  errors: string[];
  size: number;
  totalElements: number;
  physical: number;
  elemental: number;
}

/** Validate a starter deck for a given class. */
export function validateStarterDeck(cardIds: string[], className: string): DeckValidation {
  const errors: string[] = [];
  if (cardIds.length !== STARTER_DECK_SIZE) {
    errors.push(`Starter deck must have exactly ${STARTER_DECK_SIZE} cards (got ${cardIds.length}).`);
  }

  let physical = 0;
  let elemental = 0;
  let totalElements = 0;
  for (const id of cardIds) {
    const card = getCardById(id);
    if (!card) {
      errors.push(`Unknown card id: ${id}`);
      continue;
    }
    const elements = (card.elements ?? []) as ElementId[];
    const counts = countElementCategories(elements);
    physical += counts.physical;
    elemental += counts.elemental;
    totalElements += counts.total;
  }

  if (totalElements !== STARTER_ELEMENT_BUDGET) {
    errors.push(`Starter deck elements must total ${STARTER_ELEMENT_BUDGET} (got ${totalElements}).`);
  }

  const ratio = CLASS_DECK_RATIO[className];
  if (ratio) {
    if (physical < ratio.physicalMin || physical > ratio.physicalMax) {
      errors.push(`${className}: physical elements ${physical} must be in [${ratio.physicalMin}, ${ratio.physicalMax}].`);
    }
    if (elemental < ratio.elementalMin || elemental > ratio.elementalMax) {
      errors.push(`${className}: elemental elements ${elemental} must be in [${ratio.elementalMin}, ${ratio.elementalMax}].`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    size: cardIds.length,
    totalElements,
    physical,
    elemental,
  };
}

/** Validate a deck for general-deck rules (size 5-15, no class ratio check). */
export function validateRunDeck(cardIds: string[]): DeckValidation {
  const errors: string[] = [];
  if (cardIds.length < DECK_MIN) errors.push(`Deck must have at least ${DECK_MIN} cards (got ${cardIds.length}).`);
  if (cardIds.length > DECK_MAX) errors.push(`Deck must have at most ${DECK_MAX} cards (got ${cardIds.length}).`);

  let physical = 0;
  let elemental = 0;
  let totalElements = 0;
  for (const id of cardIds) {
    const card = getCardById(id);
    if (!card) {
      errors.push(`Unknown card id: ${id}`);
      continue;
    }
    const elements = (card.elements ?? []) as ElementId[];
    const counts = countElementCategories(elements);
    physical += counts.physical;
    elemental += counts.elemental;
    totalElements += counts.total;
  }

  return {
    valid: errors.length === 0,
    errors,
    size: cardIds.length,
    totalElements,
    physical,
    elemental,
  };
}

/** Can a new card be added to this deck? */
export function canAddCard(currentDeck: string[]): boolean {
  return currentDeck.length < DECK_MAX;
}

/** Generate a sensible default starter preset for a class. Picks Tier 1 cards to satisfy ratio. */
export function getDefaultStarterPreset(className: string): DeckPreset {
  if (className === 'mage') {
    return {
      name: 'Default Mage',
      cardIds: [
        't1-fire-fire',     // 2 elemental
        't1-water-water',   // 2 elemental
        't1-fire-water',    // 2 elemental
        't1-air-earth',     // 2 elemental
        't1-attack-fire',   // 1 physical + 1 elemental
      ],
    };
  }
  // Default: warrior
  return {
    name: 'Default Warrior',
    cardIds: [
      't1-attack-attack',     // 2 physical
      't1-defense-defense',   // 2 physical
      't1-attack-defense',    // 2 physical
      't1-agility-agility',   // 2 physical
      't1-attack-fire',       // 1 physical + 1 elemental
    ],
  };
}

/** Returns the canonical class deck preset array (5 slots, default-filled). */
export function makeDefaultPresets(className: string): DeckPreset[] {
  const def = getDefaultStarterPreset(className);
  const presets: DeckPreset[] = [];
  for (let i = 0; i < PRESETS_PER_CLASS; i++) {
    presets.push({ name: i === 0 ? def.name : `Preset ${i + 1}`, cardIds: i === 0 ? [...def.cardIds] : [] });
  }
  return presets;
}
