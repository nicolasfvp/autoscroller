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

  // Gold: reduced scaling via log2 to prevent hyperinflation (feedback #26)
  const goldAmount = Math.floor((15 + Math.random() * 20) * Math.log2(loopCount + 1));
  if (goldAmount > 0) {
    run.economy.gold += goldAmount;
    entries.push({ label: `+${goldAmount} Gold`, color: '#ffd700' });
  }

  // Material drop: 30% chance (diversifies loot beyond gold)
  if (Math.random() < 0.3) {
    const mats = ['wood', 'stone', 'iron', 'crystal', 'herbs'];
    const mat = mats[Math.floor(Math.random() * mats.length)];
    const amount = 1 + Math.floor(Math.random() * 2);
    if (!run.economy.materials) run.economy.materials = {};
    run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
    entries.push({ label: `+${amount} ${mat}`, color: '#e040fb' });
  }

  // Card drop: 50% chance (increased from 40%)
  if (Math.random() < 0.5) {
    const allCards = getAllCards();
    const pool = allCards.filter((c: CardDefinition & { rarity?: string }) =>
      run.pool.cards.includes(c.id) && (c.rarity === 'common' || c.rarity === 'uncommon')
    );
    if (pool.length > 0) {
      const card = pool[Math.floor(Math.random() * pool.length)];
      run.deck.droppedCards.push(card.id);
      entries.push({ label: `+Card: ${card.name}`, color: '#ffffff' });
    }
  }

  addPendingLoot(entries);
}
