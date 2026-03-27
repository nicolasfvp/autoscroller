// Card reward generation with weighted rarity.
// No Phaser dependency. Uses DataLoader for card pool.

import { getAllCards } from '../../data/DataLoader';
import type { CardDefinition } from '../../data/types';

// ── Constants ───────────────────────────────────────────────

export const CARD_REWARD_CHANCE_NORMAL = 0.7;
export const CARD_REWARD_CHANCE_ELITE = 1.0;
export const CARD_REWARD_CHANCE_BOSS = 1.0;

// ── RNG Interface ───────────────────────────────────────────

export interface RNG {
  next(): number;
}

// ── Rarity Weights ──────────────────────────────────────────

const RARITY_WEIGHTS = [
  { rarity: 'common' as const, cumWeight: 60 },
  { rarity: 'uncommon' as const, cumWeight: 90 },
  { rarity: 'rare' as const, cumWeight: 100 },
];

// ── Should Offer Reward ─────────────────────────────────────

/**
 * Determine whether a card reward should be offered after combat.
 * Normal enemies: 70% chance. Elite/Boss: always.
 */
export function shouldOfferReward(
  enemyType: 'normal' | 'elite' | 'boss',
  rng: RNG,
): boolean {
  if (enemyType === 'elite' || enemyType === 'boss') return true;
  return rng.next() < CARD_REWARD_CHANCE_NORMAL;
}

// ── Generate Card Reward ────────────────────────────────────

/**
 * Generate a set of card reward options with weighted rarity.
 * Common 60%, Uncommon 30%, Rare 10%.
 *
 * @param availableCardIds - If provided, only cards whose id is in this list
 *   (or that have no unlockSource) will be considered. This integrates with
 *   the meta-progression unlock system so locked cards never appear as rewards.
 */
export function generateCardReward(
  rng: RNG,
  count: number = 3,
  excludeIds: string[] = [],
  availableCardIds?: string[],
): string[] {
  let basePool = getAllCards();

  // If an unlock list is provided, filter to only available cards
  if (availableCardIds) {
    basePool = basePool.filter(
      (c: CardDefinition) => {
        const def = c as CardDefinition & { unlockSource?: string };
        return !def.unlockSource || availableCardIds.includes(c.id);
      },
    );
  }

  // Remove cards already in the deck from the pool
  const allCards = basePool.filter(
    (c: CardDefinition) => !excludeIds.includes(c.id),
  );

  const result: string[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < count; i++) {
    const roll = rng.next() * 100;
    let targetRarity = 'common';
    for (const rw of RARITY_WEIGHTS) {
      if (roll < rw.cumWeight) {
        targetRarity = rw.rarity;
        break;
      }
    }

    // Filter pool by target rarity, excluding already-picked cards
    let pool = allCards.filter(
      (c: CardDefinition) =>
        (c as CardDefinition & { rarity?: string }).rarity === targetRarity &&
        !usedIds.has(c.id),
    );

    // Fallback: if target rarity pool is empty, use any available rarity
    if (pool.length === 0) {
      pool = allCards.filter((c: CardDefinition) => !usedIds.has(c.id));
    }

    if (pool.length > 0) {
      const picked = pool[Math.floor(rng.next() * pool.length)];
      result.push(picked.id);
      usedIds.add(picked.id);
    }
  }
  return result;
}
