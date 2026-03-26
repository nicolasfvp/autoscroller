import { describe, it, expect } from 'vitest';
import { ShopSystem } from '../../src/systems/ShopSystem';

function makeRunState(overrides: any = {}) {
  return {
    hero: { hp: 100, maxHp: 100, stamina: 50, maxStamina: 50, mana: 30, maxMana: 30, xp: 0 },
    deck: { cards: [], order: ['strike', 'strike', 'defend', 'defend', 'fireball'] },
    loop: { count: 1, length: 15, tiles: [], positionInLoop: 0, difficultyMultiplier: 1.0 },
    economy: { gold: 200, tilePoints: 10, metaLoot: 0 },
    tileInventory: [
      { tileType: 'forest', count: 2 },
      { tileType: 'treasure', count: 1 },
    ],
    relics: [],
    ...overrides,
  };
}

describe('ShopSystem', () => {
  it('getShopCards returns 3 cards with prices', () => {
    const run = makeRunState();
    const cards = ShopSystem.getShopCards(run, ['strike', 'defend', 'fury', 'fireball', 'heal']);
    expect(cards).toHaveLength(3);
    for (const c of cards) {
      expect(c.price).toBe(60);
      expect(c.cardId).toBeTruthy();
    }
  });

  it('buyCard deducts gold and adds card to deck', () => {
    const run = makeRunState();
    const result = ShopSystem.buyCard(run, 'fury', 60);
    expect(result).toBe(true);
    expect(run.economy.gold).toBe(140);
    expect(run.deck.order).toContain('fury');
  });

  it('buyCard returns false when insufficient gold', () => {
    const run = makeRunState({ economy: { gold: 10, tilePoints: 0, metaLoot: 0 } });
    const result = ShopSystem.buyCard(run, 'fury', 60);
    expect(result).toBe(false);
    expect(run.economy.gold).toBe(10);
  });

  it('getRemoveCardCost returns ceil(75/deckSize) -- deck of 10 = 8 gold', () => {
    expect(ShopSystem.getRemoveCardCost(10)).toBe(8);
  });

  it('getRemoveCardCost returns ceil(75/deckSize) -- deck of 5 = 15 gold', () => {
    expect(ShopSystem.getRemoveCardCost(5)).toBe(15);
  });

  it('removeCard deducts scaled gold and removes card', () => {
    const run = makeRunState();
    // deck has 5 cards, cost = ceil(75/5) = 15
    const result = ShopSystem.removeCard(run, 0);
    expect(result).toBe(true);
    expect(run.economy.gold).toBe(185);
    expect(run.deck.order).toHaveLength(4);
  });

  it('removeCard returns false when deck size <= 3', () => {
    const run = makeRunState({
      deck: { cards: [], order: ['strike', 'defend', 'fireball'] },
    });
    const result = ShopSystem.removeCard(run, 0);
    expect(result).toBe(false);
  });

  it('startReorderSession deducts 30 gold', () => {
    const run = makeRunState();
    const result = ShopSystem.startReorderSession(run);
    expect(result).toBe(true);
    expect(run.economy.gold).toBe(170);
  });

  it('startReorderSession returns false when insufficient gold', () => {
    const run = makeRunState({ economy: { gold: 20, tilePoints: 0, metaLoot: 0 } });
    const result = ShopSystem.startReorderSession(run);
    expect(result).toBe(false);
    expect(run.economy.gold).toBe(20);
  });

  it('reorderCard moves card from index to index', () => {
    const run = makeRunState({
      deck: { cards: [], order: ['a', 'b', 'c', 'd'] },
    });
    ShopSystem.reorderCard(run, 0, 2);
    expect(run.deck.order).toEqual(['b', 'c', 'a', 'd']);
  });

  it('sellTile gives 50% tile points -- forest (3 TP cost) gives 1 TP', () => {
    const run = makeRunState({ economy: { gold: 100, tilePoints: 0, metaLoot: 0 } });
    const result = ShopSystem.sellTile(run, 'forest');
    expect(result).toBe(true);
    expect(run.economy.tilePoints).toBe(1); // floor(3 * 0.5) = 1
    expect(run.tileInventory.find((t: any) => t.tileType === 'forest')!.count).toBe(1);
  });

  it('sellTile gives 50% tile points -- treasure (6 TP cost) gives 3 TP', () => {
    const run = makeRunState({ economy: { gold: 100, tilePoints: 0, metaLoot: 0 } });
    const result = ShopSystem.sellTile(run, 'treasure');
    expect(result).toBe(true);
    expect(run.economy.tilePoints).toBe(3); // floor(6 * 0.5) = 3
  });

  it('sellTile returns false when tile not in inventory', () => {
    const run = makeRunState({ tileInventory: [] });
    const result = ShopSystem.sellTile(run, 'swamp');
    expect(result).toBe(false);
  });

  it('sellTile removes entry when count reaches 0', () => {
    const run = makeRunState({ tileInventory: [{ tileType: 'treasure', count: 1 }] });
    ShopSystem.sellTile(run, 'treasure');
    const entry = run.tileInventory.find((t: any) => t.tileType === 'treasure');
    expect(!entry || entry.count === 0).toBe(true);
  });

  it('buyRelic deducts gold and adds relic', () => {
    const run = makeRunState();
    const result = ShopSystem.buyRelic(run, 'fire_ring', 150);
    expect(result).toBe(true);
    expect(run.economy.gold).toBe(50);
    expect(run.relics).toContain('fire_ring');
  });

  it('buyRelic returns false when insufficient gold', () => {
    const run = makeRunState({ economy: { gold: 100, tilePoints: 0, metaLoot: 0 } });
    const result = ShopSystem.buyRelic(run, 'fire_ring', 150);
    expect(result).toBe(false);
  });

  it('getShopRelics excludes already owned relics', () => {
    const run = makeRunState({ relics: ['fire_ring'] });
    const relics = ShopSystem.getShopRelics(run, ['fire_ring', 'ice_crown', 'shadow_cloak']);
    for (const r of relics) {
      expect(r.relicId).not.toBe('fire_ring');
    }
  });
});
