import { getTileConfig } from './TileRegistry';

export interface ShopCard {
  cardId: string;
  name: string;
  price: number;
}

export interface ShopRelic {
  relicId: string;
  name: string;
  price: number;
}

interface RunState {
  deck: { cards: any[]; order: string[] };
  economy: { gold: number; tilePoints: number; metaLoot: number };
  tileInventory: Array<{ tileType: string; count: number }>;
  relics: string[];
}

export class ShopSystem {
  static getShopCards(runState: RunState, availableCardIds: string[]): ShopCard[] {
    const shuffled = [...availableCardIds].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 3);
    return picked.map(id => ({ cardId: id, name: id, price: 60 }));
  }

  static buyCard(runState: RunState, cardId: string, price: number): boolean {
    if (runState.economy.gold < price) return false;
    runState.economy.gold -= price;
    runState.deck.order.push(cardId);
    return true;
  }

  static getRemoveCardCost(deckSize: number): number {
    return Math.ceil(75 / deckSize);
  }

  static removeCard(runState: RunState, cardIndex: number): boolean {
    if (runState.deck.order.length <= 3) return false;
    const cost = ShopSystem.getRemoveCardCost(runState.deck.order.length);
    if (runState.economy.gold < cost) return false;
    runState.economy.gold -= cost;
    runState.deck.order.splice(cardIndex, 1);
    return true;
  }

  static startReorderSession(runState: RunState): boolean {
    if (runState.economy.gold < 30) return false;
    runState.economy.gold -= 30;
    return true;
  }

  static reorderCard(runState: RunState, fromIndex: number, toIndex: number): void {
    const [card] = runState.deck.order.splice(fromIndex, 1);
    runState.deck.order.splice(toIndex, 0, card);
  }

  static getShopRelics(runState: RunState, availableRelicIds: string[]): ShopRelic[] {
    const unowned = availableRelicIds.filter(id => !runState.relics.includes(id));
    const shuffled = [...unowned].sort(() => Math.random() - 0.5);
    const count = Math.min(1 + Math.floor(Math.random() * 2), shuffled.length); // 1-2
    return shuffled.slice(0, count).map(id => ({ relicId: id, name: id, price: 150 }));
  }

  static buyRelic(runState: RunState, relicId: string, price: number): boolean {
    if (runState.economy.gold < price) return false;
    runState.economy.gold -= price;
    runState.relics.push(relicId);
    return true;
  }

  static sellTile(runState: RunState, tileType: string): boolean {
    const entry = runState.tileInventory.find(t => t.tileType === tileType);
    if (!entry || entry.count <= 0) return false;
    entry.count--;
    if (entry.count === 0) {
      const idx = runState.tileInventory.indexOf(entry);
      runState.tileInventory.splice(idx, 1);
    }
    const config = getTileConfig(tileType);
    runState.economy.tilePoints += Math.floor(config.tilePointCost * 0.5);
    return true;
  }
}
