import { getTileConfig } from './TileRegistry';
import { getAvailableCards, getAvailableRelics } from './UnlockManager';
import difficultyConfig from '../data/difficulty.json';
import { type RunState, addRelicToRun } from '../state/RunState';
import { rand } from './SharedRNG';
import { eventBus } from '../core/EventBus';
import { getRelicData } from './combat/RelicSystem';

const pricing = (difficultyConfig as any).pricing;

/** Minimum number of cards the deck must retain after any removal. The shop's
 *  Remove Card service refuses to thin the deck below this floor. */
export const MIN_DECK_SIZE = 5;

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

  static getRelicPrice(rarity: string, loopCount: number, runState?: RunState): number {
    const base = pricing.relicPriceByRarity[rarity] ?? 180;
    const cap = pricing.relicPriceCap[rarity] ?? 320;
    const perLoop = pricing.relicPricePerLoop[rarity] ?? 12;
    let price = Math.min(base + loopCount * perLoop, cap);
    // C7 — Beacon Lantern: -10% relic prices while held.
    if (runState && (runState.relics ?? []).includes('beacon_lantern')) {
      price = Math.floor(price * 0.9);
    }
    return price;
  }

  // ── Shop operations ────────────────────────────────────────

  static getShopCards(_runState: RunState, availableCardIds: string[], loopCount: number = 0): ShopCard[] {
    const shuffled = fisherYates([...availableCardIds]);
    const picked = shuffled.slice(0, 3);
    const price = ShopSystem.getCardPrice(loopCount);
    return picked.map(id => ({ cardId: id, name: id, price }));
  }

  static buyCard(runState: RunState, cardId: string, price: number): boolean {
    if (runState.economy.gold < price) return false;
    runState.economy.gold -= price;
    runState.deck.active.push(cardId);
    runState.deck.upgraded.push(false);
    return true;
  }

  static getRemoveCardCost(removalCount: number): number {
    return ShopSystem.getRemovalPrice(removalCount);
  }

  static removeCard(runState: RunState, cardIndex: number, removalCount: number = 0): boolean {
    if (runState.deck.active.length <= MIN_DECK_SIZE) return false;
    const cost = ShopSystem.getRemovalPrice(removalCount);
    if (runState.economy.gold < cost) return false;
    runState.economy.gold -= cost;
    runState.deck.active.splice(cardIndex, 1);
    runState.deck.upgraded.splice(cardIndex, 1);
    return true;
  }

  static startReorderSession(runState: RunState, reorderCount: number = 0): boolean {
    const cost = ShopSystem.getReorderPrice(reorderCount);
    if (runState.economy.gold < cost) return false;
    runState.economy.gold -= cost;
    return true;
  }

  static reorderCard(runState: RunState, fromIndex: number, toIndex: number): void {
    const [card] = runState.deck.active.splice(fromIndex, 1);
    runState.deck.active.splice(toIndex, 0, card);
    const [flag] = runState.deck.upgraded.splice(fromIndex, 1);
    runState.deck.upgraded.splice(toIndex, 0, flag);
  }

  static getShopRelics(runState: RunState, availableRelicIds: string[], loopCount: number = 0): ShopRelic[] {
    const unowned = availableRelicIds.filter(id => !runState.relics.includes(id));
    const shuffled = fisherYates([...unowned]);
    // C7 — Beacon Lantern: +2 relics per shop. Base shop size is 5.
    const baseCount = 5;
    const lanternBonus = (runState.relics ?? []).includes('beacon_lantern') ? 2 : 0;
    const count = Math.min(baseCount + lanternBonus, shuffled.length);
    return shuffled.slice(0, count).map(id => {
      // Read the relic's actual rarity so pricing is correct per tier.
      const relic = getRelicData(id);
      const rarity = relic?.rarity ?? 'common';
      return {
        relicId: id,
        name: relic?.name ?? id,
        price: ShopSystem.getRelicPrice(rarity, loopCount, runState),
      };
    });
  }

  static buyRelic(runState: RunState, relicId: string, price: number): boolean {
    if (runState.economy.gold < price) return false;
    runState.economy.gold -= price;
    addRelicToRun(runState, relicId);
    return true;
  }

  static buildAvailableCardIds(metaUnlockedCards: string[]): string[] {
    return getAvailableCards(metaUnlockedCards).map(c => c.id);
  }

  // ── Card upgrade operations ──────────────────────────────────

  static getUpgradePrice(rarity: string): number {
    const basePrices: Record<string, number> = {
      common: 50, uncommon: 80, rare: 120, epic: 200,
    };
    return basePrices[rarity] ?? 100;
  }

  static upgradeCard(
    runState: RunState,
    deckIndex: number,
    rarity: string,
  ): boolean {
    if (deckIndex < 0 || deckIndex >= runState.deck.active.length) return false;
    if (runState.deck.upgraded[deckIndex]) return false;
    // Tile-adjacency Library+Shop discount removed in Wave 2; upgrade
    // pricing is now the base price by rarity.
    const price = ShopSystem.getUpgradePrice(rarity);
    if (runState.economy.gold < price) return false;
    runState.economy.gold -= price;
    runState.deck.upgraded[deckIndex] = true;
    return true;
  }

  static buildAvailableRelicIds(metaUnlockedRelics: string[]): string[] {
    return getAvailableRelics(metaUnlockedRelics).map(r => r.id);
  }

  /**
   * Phase 9 Task 5: notify the rest of the engine that a shop visit started.
   * ShopScene calls this in its `create()` hook so shop_visited relic
   * triggers fire exactly once per visit (not once per UI interaction).
   */
  static notifyShopVisited(): void {
    eventBus.emit('combat:shop-visited', {});
  }

  static sellTile(runState: RunState, tileType: string): boolean {
    const count = runState.economy.tileInventory[tileType] ?? 0;
    if (count <= 0) return false;
    if (count === 1) {
      delete runState.economy.tileInventory[tileType];
    } else {
      runState.economy.tileInventory[tileType] = count - 1;
    }
    const config = getTileConfig(tileType);
    runState.economy.tilePoints += Math.floor(config.tilePointCost * 0.5);
    return true;
  }
}

/**
 * Unbiased Fisher-Yates shuffle. Replaces sort(() => Math.random() - 0.5),
 * which produces a heavily biased distribution and can throw under strict V8.
 * Routed through the run's seeded RNG (SharedRNG) for replays.
 */
function fisherYates<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
