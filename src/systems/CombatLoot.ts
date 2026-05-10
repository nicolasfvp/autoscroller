// Combat loot generation -- produces gold + card + material drops after victory.
// Uses enemy drop tables, EnemyDefinition goldReward, and material config.
// Zero Phaser dependency.

import type { RunState } from '../state/RunState';
import { getAllCards } from '../data/DataLoader';
import type { CardDefinition } from '../data/types';
import { addPendingLoot } from './PendingLoot';
import { rollMaterialDrops, rollTileDrops } from './LootGenerator';
import enemyDropsData from '../data/json/enemy-drops.json';
import { rand } from './SharedRNG';

interface CardDropTable {
  cardPool: string[];
  minDrops: number;
  maxDrops: number;
}

interface EnemyDropEntry {
  cardDrops?: CardDropTable;
}

const dropTables = enemyDropsData as Record<string, EnemyDropEntry>;

/**
 * Generate and apply combat loot after a victory.
 * - Awards gold directly to RunState
 * - Drops materials from terrain and enemy pools
 * - Drops a random card into droppedCards (not active deck)
 * - Queues floating notifications via PendingLoot
 */
export function generateAndApplyCombatLoot(
  run: RunState,
  enemyName: string,
  enemyId: string,
  enemyType: string,
  terrain: string,
  goldAmount: number,
  xpAmount: number,
): void {
  const entries: Array<{ label: string; color: string }> = [];

  // Gold
  if (goldAmount > 0) {
    run.economy.gold += goldAmount;
    entries.push({ label: `+${goldAmount} Gold`, color: '#ffd700' });
  }

  // XP
  if (xpAmount > 0) {
    entries.push({ label: `+${xpAmount} XP`, color: '#00ccff' });
  }

  // Storehouse gathering boost — cached on RunState at run start.
  const gatheringBoost = run.economy.gatheringBoost ?? 0;

  // Material drops from terrain
  const terrainMats = rollMaterialDrops('terrain', terrain, run.loop.count, undefined, gatheringBoost);
  for (const [mat, amount] of Object.entries(terrainMats)) {
    if (amount > 0) {
      run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
      entries.push({ label: `+${amount} ${mat}`, color: '#e040fb' });
    }
  }

  // Material drops from enemy
  const enemyMats = rollMaterialDrops('enemy', enemyId, run.loop.count, undefined, gatheringBoost);
  for (const [mat, amount] of Object.entries(enemyMats)) {
    if (amount > 0) {
      run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
      entries.push({ label: `+${amount} ${mat}`, color: '#e040fb' });
    }
  }

  // Boss material drops
  if (enemyType === 'boss') {
    const bossMats = rollMaterialDrops('boss', enemyId, run.loop.count, undefined, gatheringBoost);
    for (const [mat, amount] of Object.entries(bossMats)) {
      if (amount > 0) {
        run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
        entries.push({ label: `+${amount} ${mat}`, color: '#e040fb' });
      }
    }
  }

  // Tile drops (rare; 15% chance per terrain combat). Writes to the
  // canonical RunState tile inventory; LoopRunState rehydrates from there
  // on next GameScene.create / planning entry.
  const tileDrops = rollTileDrops(terrain, run.loop.count);
  for (const drop of tileDrops) {
    const current = run.economy.tileInventory[drop.tileType] ?? 0;
    run.economy.tileInventory[drop.tileType] = current + drop.count;
    entries.push({ label: `+${drop.count} ${drop.tileType} tile`, color: '#80ffd0' });
  }

  // Card drop from enemy-specific pool
  const dropTable = dropTables[enemyName];
  if (dropTable?.cardDrops) {
    const { cardPool, minDrops, maxDrops } = dropTable.cardDrops;
    const dropCount = minDrops + Math.floor(rand() * (maxDrops - minDrops + 1));

    const allCards = getAllCards();
    const validPool = cardPool.filter(id => allCards.some((c: CardDefinition) => c.id === id));

    for (let i = 0; i < dropCount && validPool.length > 0; i++) {
      const cardId = validPool[Math.floor(rand() * validPool.length)];
      run.deck.droppedCards.push(cardId);
      const cardDef = allCards.find((c: CardDefinition) => c.id === cardId);
      const cardName = cardDef?.name ?? cardId;
      entries.push({ label: `+Card: ${cardName}`, color: '#ffffff' });
    }
  } else {
    const allCards = getAllCards();
    const commons = allCards.filter((c: CardDefinition & { rarity?: string }) => c.rarity === 'common');
    if (commons.length > 0) {
      const card = commons[Math.floor(rand() * commons.length)];
      run.deck.droppedCards.push(card.id);
      entries.push({ label: `+Card: ${card.name}`, color: '#ffffff' });
    }
  }

  addPendingLoot(entries);
}
