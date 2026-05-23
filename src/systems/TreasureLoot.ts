// Inline treasure loot generation -- gold + materials, applied directly to
// RunState. Zero Phaser dependency. Card drops were removed in the post-Phase-10
// economy: cards now come from the Forge only.

import type { RunState } from '../state/RunState';
import { addPendingLoot, type LootEntry } from './PendingLoot';
import { rand } from './SharedRNG';

/**
 * Generate treasure loot and apply it directly to RunState.
 */
export function generateTreasureLoot(run: RunState): void {
  const entries: LootEntry[] = [];
  const loopCount = run.loop.count || 1;

  // Gold: reduced scaling via log2 to prevent hyperinflation (feedback #26)
  const goldAmount = Math.floor((15 + rand() * 20) * Math.log2(loopCount + 1));
  if (goldAmount > 0) {
    run.economy.gold += goldAmount;
    run.stats.goldEarned += goldAmount;
    entries.push({ label: `+${goldAmount} Gold`, color: '#ffd700' });
  }

  // Material drop: 30% chance (diversifies loot beyond gold)
  if (rand() < 0.3) {
    const mats = ['wood', 'stone', 'iron', 'crystal', 'herbs'];
    const mat = mats[Math.floor(rand() * mats.length)];
    const amount = 1 + Math.floor(rand() * 2);
    if (!run.economy.materials) run.economy.materials = {};
    run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
    entries.push({ label: `+${amount} ${mat}`, color: '#e040fb' });
  }

  addPendingLoot(entries);
}
