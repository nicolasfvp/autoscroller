// Inline treasure loot generation -- produces gold + cards without a blocking scene.
// Cards go to droppedCards, notifications queued via PendingLoot.
// Zero Phaser dependency.

import type { RunState } from '../state/RunState';
import { getAllCards } from '../data/DataLoader';
import type { CardDefinition } from '../data/types';
import { addPendingLoot, type LootEntry } from './PendingLoot';

/**
 * Generate treasure loot and apply it directly to RunState.
 * Gold is added to economy, cards go to droppedCards.
 */
export function generateTreasureLoot(run: RunState): void {
  const entries: LootEntry[] = [];
  const loopCount = run.loop.count || 1;

  // Gold: 20-50 scaled by loop
  const goldAmount = Math.floor((20 + Math.random() * 30) * Math.sqrt(loopCount));
  if (goldAmount > 0) {
    run.economy.gold += goldAmount;
    entries.push({ label: `+${goldAmount} Gold`, color: '#ffd700' });
  }

  // Card drop: 40% chance
  if (Math.random() < 0.4) {
    const allCards = getAllCards();
    const pool = allCards.filter((c: CardDefinition & { rarity?: string }) =>
      c.rarity === 'common' || c.rarity === 'uncommon'
    );
    if (pool.length > 0) {
      const card = pool[Math.floor(Math.random() * pool.length)];
      run.deck.droppedCards.push(card.id);
      entries.push({ label: `+Card: ${card.name}`, color: '#ffffff' });
    }
  }

  addPendingLoot(entries);
}
