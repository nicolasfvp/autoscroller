import { getTileConfig } from './TileRegistry';
import { getAvailableCards, getAvailableRelics } from './UnlockManager';
import difficultyConfig from '../data/difficulty.json';
import type { RunState } from '../state/RunState';
import { rand } from './SharedRNG';
import type { SynergyBuff } from './SynergyResolver';
import { eventBus } from '../core/EventBus';

const pricing = (difficultyConfig as any).pricing;

// Phase 9: tile-adjacency cardUpgradeDiscount (Library+Shop) is sourced from
// SynergyResolver via the same setActiveBuffs() module pattern CardResolver
// and RestSiteSystem use. The LoopRunner pushes the current buff set here
// when it pushes to the other consumers, so ShopSystem.upgradeCard can shave
// the upgrade price without a synergy-resolver dependency injection rewrite.
let activeBuffs: SynergyBuff[] = [];

export function setActiveBuffs(buffs: SynergyBuff[]): void {
  activeBuffs = buffs ?? [];
}

export function getCardUpgradeDiscount(): number {
  let bonus = 0;
  for (const buff of activeBuffs) {
    if (buff.type === 'cardUpgradeDiscount') bonus += buff.value;
  }
  // Clamp to [0, 1) — the math below survives 1.0 but a 100%+ discount would
  // negate the gold sink the relic was tuned around.
  return Math.min(0.95, Math.max(0, bonus));
}

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

  static getRelicPrice(rarity: string, loopCount: number): number {
    const base = pricing.relicPriceByRarity[rarity] ?? 150;
    const cap = pricing.relicPriceCap[rarity] ?? 300;
    return Math.min(base + loopCount * pricing.relicPricePerLoop, cap);
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
    if (runState.deck.active.length <= 3) return false;
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
    const count = Math.min(1 + Math.floor(rand() * 2), shuffled.length);
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
    // Phase 9: shave the upgrade price by the active cardUpgradeDiscount buff
    // (Library + Shop adjacency = 0.20 per design/04 §7). The discount is
    // floored after the multiplier so a 20% discount on a 50g common upgrade
    // costs 40g, not 39.99g.
    const basePrice = ShopSystem.getUpgradePrice(rarity);
    const discount = getCardUpgradeDiscount();
    const price = Math.max(0, Math.floor(basePrice * (1 - discount)));
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
