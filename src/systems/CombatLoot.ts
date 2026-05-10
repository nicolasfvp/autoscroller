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
import type { SynergyBuff } from './SynergyResolver';

// B.1: tile-adjacency loot buffs. goldDropBonus / tileDropBonus uplift the
// rolled gold and tile drop counts at combat resolution time.
let activeBuffs: SynergyBuff[] = [];

export function setActiveBuffs(buffs: SynergyBuff[]): void {
  activeBuffs = buffs ?? [];
}

function sumBuff(type: string): number {
  let total = 0;
  for (const buff of activeBuffs) {
    if (buff.type === type) total += buff.value;
  }
  return total;
}

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

  // Gold (apply tile-adjacency goldDropBonus on top of base reward)
  const goldMult = 1 + sumBuff('goldDropBonus');
  const finalGold = Math.floor(goldAmount * goldMult);
  if (finalGold > 0) {
    run.economy.gold += finalGold;
    entries.push({ label: `+${finalGold} Gold`, color: '#ffd700' });
  }

  // XP
  if (xpAmount > 0) {
    entries.push({ label: `+${xpAmount} XP`, color: '#00ccff' });
  }

  // Storehouse gathering boost is applied once at banking time in
  // MetaProgressionSystem.bankRunRewards — drops here remain raw.

  // Material drops from terrain
  const terrainMats = rollMaterialDrops('terrain', terrain, run.loop.count);
  for (const [mat, amount] of Object.entries(terrainMats)) {
    if (amount > 0) {
      run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
      entries.push({ label: `+${amount} ${mat}`, color: '#e040fb' });
    }
  }

  // Material drops from enemy
  const enemyMats = rollMaterialDrops('enemy', enemyId, run.loop.count);
  for (const [mat, amount] of Object.entries(enemyMats)) {
    if (amount > 0) {
      run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
      entries.push({ label: `+${amount} ${mat}`, color: '#e040fb' });
    }
  }

  // Boss material drops
  if (enemyType === 'boss') {
    const bossMats = rollMaterialDrops('boss', enemyId, run.loop.count);
    for (const [mat, amount] of Object.entries(bossMats)) {
      if (amount > 0) {
        run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
        entries.push({ label: `+${amount} ${mat}`, color: '#e040fb' });
      }
    }
  }

  // Tile drops (rare; 15% chance per terrain combat). Writes to the
  // canonical RunState tile inventory; LoopRunState rehydrates from there
  // on next GameScene.create / planning entry. tileDropBonus uplifts count.
  const tileDrops = rollTileDrops(terrain, run.loop.count);
  const tileMult = 1 + sumBuff('tileDropBonus');
  for (const drop of tileDrops) {
    const finalCount = Math.max(drop.count, Math.floor(drop.count * tileMult));
    const current = run.economy.tileInventory[drop.tileType] ?? 0;
    run.economy.tileInventory[drop.tileType] = current + finalCount;
    entries.push({ label: `+${finalCount} ${drop.tileType} tile`, color: '#80ffd0' });
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
