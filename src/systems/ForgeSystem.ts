// Forge system — recipe lookup, cost calculation, in-run crafting.
// See docs/CARDS_SYSTEM.md §5 for the spec.

import type { CardDefinition } from '../data/types';
import type { ElementId, CardTier } from './ElementSystem';
import {
  canonicalCardId,
  multisetKey,
  FORGE_BASE_COST,
  FORGE_DISCOUNT_BY_LEVEL,
  FORGE_TIER_UNLOCK,
} from './ElementSystem';
import { hasElementsForRecipe, spendElements, type ElementInventory } from './ShardSystem';
import { getAllCards, getCardById } from '../data/DataLoader';

/** A recipe entry stored in MetaState — meta-persistent. */
export interface ForgeRecipe {
  /** Canonical key: alphabetical join of element ids with '+'. */
  key: string;
  elements: ElementId[];
  cardId: string;
  firstForgedAt: number;
}

// TEMPORARY: forge restrictions disabled — all tiers always unlocked, and the
// per-level discount is bypassed so FORGE_BASE_COST values are charged exactly.
// To re-enable progression, revert getForgeDiscount and isTierUnlocked to use
// FORGE_DISCOUNT_BY_LEVEL / FORGE_TIER_UNLOCK.

/** Discount multiplier (0 - 1) given forge meta-building level. */
export function getForgeDiscount(_forgeLevel: number): number {
  return 0;
}

/** Final gold cost after discount, rounded down. */
export function getForgeGoldCost(tier: CardTier, forgeLevel: number): number {
  const base = FORGE_BASE_COST[tier];
  const discount = getForgeDiscount(forgeLevel);
  return Math.floor(base * (1 - discount));
}

/** Is this tier unlocked at this forge level? */
export function isTierUnlocked(_tier: CardTier, _forgeLevel: number): boolean {
  return true;
}

/** Look up a card definition by its element multiset. Returns null if no card matches. */
export function findCardForElements(elements: ElementId[]): CardDefinition | null {
  if (elements.length < 2 || elements.length > 4) return null;
  const id = canonicalCardId(elements);
  // First try canonical id (alphabetical sort) — matches our spec.
  const direct = getCardById(id);
  if (direct) return direct;
  // Fallback: scan all cards comparing element multisets.
  // (Handles legacy non-strictly-alphabetical IDs.)
  const targetKey = multisetKey(elements);
  for (const card of getAllCards()) {
    if (!card.elements || card.elements.length !== elements.length) continue;
    if (multisetKey(card.elements as ElementId[]) === targetKey) return card;
  }
  return null;
}

/** Validation result for a forge attempt. */
export interface ForgeValidation {
  ok: boolean;
  reason?: 'tier_locked' | 'no_card' | 'insufficient_elements' | 'insufficient_gold' | 'deck_full';
  cardId?: string;
  goldCost?: number;
}

export function validateForge(
  elements: ElementId[],
  elementInv: ElementInventory,
  gold: number,
  forgeLevel: number,
  deckSize: number,
  deckMax: number,
): ForgeValidation {
  if (elements.length < 2 || elements.length > 4) return { ok: false, reason: 'no_card' };
  // Tier mapping: 2 elements → tier 1, 3 → tier 2, 4 → tier 3. See ElementSystem.canonicalCardId.
  const tier = (elements.length - 1) as CardTier;
  if (!isTierUnlocked(tier, forgeLevel)) return { ok: false, reason: 'tier_locked' };
  const card = findCardForElements(elements);
  if (!card || card.locked) return { ok: false, reason: 'no_card' };
  if (!hasElementsForRecipe(elementInv, elements)) return { ok: false, reason: 'insufficient_elements' };
  const cost = getForgeGoldCost(tier, forgeLevel);
  if (gold < cost) return { ok: false, reason: 'insufficient_gold', goldCost: cost, cardId: card.id };
  if (deckSize >= deckMax) return { ok: false, reason: 'deck_full', goldCost: cost, cardId: card.id };
  return { ok: true, goldCost: cost, cardId: card.id };
}

/** Result of a successful forge. */
export interface ForgeResult {
  cardId: string;
  goldSpent: number;
  elementsSpent: ElementId[];
  isNewRecipe: boolean;
}

/**
 * Execute a forge attempt. Mutates the inventories and gold pointer.
 * Caller must call validateForge first; this function trusts inputs.
 */
export function executeForge(
  elements: ElementId[],
  elementInv: ElementInventory,
  spendGold: (amount: number) => void,
  forgeLevel: number,
  knownRecipes: ForgeRecipe[],
): ForgeResult {
  if (elements.length < 2 || elements.length > 4) {
    throw new Error(`executeForge: invalid element count ${elements.length} (must be 2-4)`);
  }
  // Tier mapping: 2 elements → tier 1, 3 → tier 2, 4 → tier 3. See ElementSystem.canonicalCardId.
  const tier = (elements.length - 1) as CardTier;
  const card = findCardForElements(elements)!;
  const cost = getForgeGoldCost(tier, forgeLevel);
  spendElements(elementInv, elements);
  spendGold(cost);
  const recipeKey = multisetKey(elements);
  const isNewRecipe = !knownRecipes.some(r => r.key === recipeKey);
  return {
    cardId: card.id,
    goldSpent: cost,
    elementsSpent: [...elements],
    isNewRecipe,
  };
}

/** Add a recipe to the meta list if not already present. */
export function discoverRecipe(
  knownRecipes: ForgeRecipe[],
  elements: ElementId[],
  cardId: string,
): ForgeRecipe[] {
  const key = multisetKey(elements);
  if (knownRecipes.some(r => r.key === key)) return knownRecipes;
  return [
    ...knownRecipes,
    { key, elements: [...elements].sort() as ElementId[], cardId, firstForgedAt: Date.now() },
  ];
}
