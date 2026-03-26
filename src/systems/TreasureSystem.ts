import { rollTreasureLoot, type LootResult, type LootItem } from './LootGenerator';

export interface TreasureItem {
  type: string;
  name: string;
  amount?: number;
  id?: string;
}

export interface TreasureResult {
  items: TreasureItem[];
}

interface RunState {
  deck: { cards: any[]; order: string[] };
  economy: { gold: number; tilePoints: number; metaLoot: number };
  tileInventory: Array<{ tileType: string; count: number }>;
  relics: string[];
}

export function openTreasure(runState: RunState, loopCount: number): TreasureResult {
  const loot: LootResult = rollTreasureLoot(loopCount);
  const treasureItems: TreasureItem[] = [];

  for (const item of loot.items) {
    switch (item.type) {
      case 'gold': {
        const amount = item.amount ?? 0;
        runState.economy.gold += amount;
        treasureItems.push({ type: 'gold', name: 'Gold', amount });
        break;
      }
      case 'card': {
        const cardId = item.id ?? 'strike';
        // 'random' placeholder resolves to 'strike'
        const resolvedId = cardId === 'random' ? 'strike' : cardId;
        runState.deck.order.push(resolvedId);
        treasureItems.push({ type: 'card', name: resolvedId, id: resolvedId });
        break;
      }
      case 'relic': {
        const relicId = item.id ?? 'mysterious_amulet';
        const resolvedId = relicId === 'random' ? 'mysterious_amulet' : relicId;
        runState.relics.push(resolvedId);
        treasureItems.push({ type: 'relic', name: resolvedId, id: resolvedId });
        break;
      }
      case 'tile': {
        const tileName = item.id ?? 'forest';
        const entry = runState.tileInventory.find(t => t.tileType === tileName);
        if (entry) {
          entry.count++;
        } else {
          runState.tileInventory.push({ tileType: tileName, count: 1 });
        }
        treasureItems.push({ type: 'tile', name: tileName, id: tileName });
        break;
      }
    }
  }

  return { items: treasureItems };
}
