import { rollTreasureLoot, type LootResult, type UnlockState } from './LootGenerator';
import type { RunState } from '../state/RunState';

export interface TreasureItem {
  type: string;
  name: string;
  amount?: number;
  id?: string;
}

export interface TreasureResult {
  items: TreasureItem[];
}

export function openTreasure(runState: RunState, loopCount: number, unlockState?: UnlockState): TreasureResult {
  const loot: LootResult = rollTreasureLoot(loopCount, undefined, unlockState);
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
        const resolvedId = cardId === 'random' ? 'strike' : cardId;
        runState.deck.active.push(resolvedId);
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
        runState.economy.tileInventory[tileName] = (runState.economy.tileInventory[tileName] ?? 0) + 1;
        treasureItems.push({ type: 'tile', name: tileName, id: tileName });
        break;
      }
    }
  }

  return { items: treasureItems };
}
