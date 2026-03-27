import { getTileConfig } from './TileRegistry';
import { getAvailableCards, getAvailableRelics } from './UnlockManager';
import difficultyConfig from '../data/difficulty.json';

const pricing = (difficultyConfig as any).pricing;

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
  economy: { gold: number; tilePoints: number };
  tileInventory: Array<{ tileType: string; count: number }>;
  relics: string[];
}

export class ShopSystem {
  // ── Scaling price formulas ─────────────────────────────────

  static getCardPrice(loopCount: number): number {
    return Math.min(
      pricing.cardBasePrice + loopCount * pricing.cardPricePerLoop,
      pricing.cardPriceCap
    );
  }

  static getRemovalPrice(removalCount: number): number {
    return Math.min(
      pricing.removeBasePrice + removalCount * pricing.removeEscalation,
      pricing.removeCap
    );
  }

  static getReorderPrice(reorderCount: number): number {
    return Math.min(
      pricing.reorderBasePrice + reorderCount * pricing.reorderEscalation,
      pricing.reorderCap
    );
  }

  static getRelicPrice(rarity: string, loopCount: number): number {
    const base = pricing.relicPriceByRarity[rarity] ?? 150;
    const cap = pricing.relicPriceCap[rarity] ?? 300;
    return Math.min(base + loopCount * pricing.relicPricePerLoop, cap);
  }

  // ── Shop operations ────────────────────────────────────────

  static getShopCards(runState: RunState, availableCardIds: string[], loopCount: number = 0): ShopCard[] {
    const shuffled = [...availableCardIds].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 3);
    const price = ShopSystem.getCardPrice(loopCount);
    return picked.map(id => ({ cardId: id, name: id, price }));
  }

  static buyCard(runState: RunState, cardId: string, price: number): boolean {
    if (runState.economy.gold < price) return false;
    runState.economy.gold -= price;
    runState.deck.order.push(cardId);
    return true;
  }

  static getRemoveCardCost(removalCount: number): number {
    return ShopSystem.getRemovalPrice(removalCount);
  }

  static removeCard(runState: RunState, cardIndex: number, removalCount: number = 0): boolean {
    if (runState.deck.order.length <= 3) return false;
    const cost = ShopSystem.getRemovalPrice(removalCount);
    if (runState.economy.gold < cost) return false;
    runState.economy.gold -= cost;
    runState.deck.order.splice(cardIndex, 1);
    return true;
  }

  static startReorderSession(runState: RunState, reorderCount: number = 0): boolean {
    const cost = ShopSystem.getReorderPrice(reorderCount);
    if (runState.economy.gold < cost) return false;
    runState.economy.gold -= cost;
    return true;
  }

  static reorderCard(runState: RunState, fromIndex: number, toIndex: number): void {
    const [card] = runState.deck.order.splice(fromIndex, 1);
    runState.deck.order.splice(toIndex, 0, card);
  }

  static getShopRelics(runState: RunState, availableRelicIds: string[], loopCount: number = 0): ShopRelic[] {
    const unowned = availableRelicIds.filter(id => !runState.relics.includes(id));
    const shuffled = [...unowned].sort(() => Math.random() - 0.5);
    const count = Math.min(1 + Math.floor(Math.random() * 2), shuffled.length);
    return shuffled.slice(0, count).map(id => ({
      relicId: id,
      name: id,
      price: ShopSystem.getRelicPrice('common', loopCount), // default to common; callers can override
    }));
  }

  static buyRelic(runState: RunState, relicId: string, price: number): boolean {
    if (runState.economy.gold < price) return false;
    runState.economy.gold -= price;
    runState.relics.push(relicId);
    return true;
  }

  static buildAvailableCardIds(metaUnlockedCards: string[]): string[] {
    return getAvailableCards(metaUnlockedCards).map(c => c.id);
  }

  static buildAvailableRelicIds(metaUnlockedRelics: string[]): string[] {
    return getAvailableRelics(metaUnlockedRelics).map(r => r.id);
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
