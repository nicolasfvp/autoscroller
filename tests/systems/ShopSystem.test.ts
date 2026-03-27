import { describe, it, expect } from 'vitest';
import { ShopSystem } from '../../src/systems/ShopSystem';

function makeRunState(overrides: any = {}) {
  return {
    hero: { hp: 100, maxHp: 100, stamina: 50, maxStamina: 50, mana: 30, maxMana: 30, xp: 0 },
    deck: { cards: [], order: ['strike', 'strike', 'defend', 'defend', 'fireball'], active: ['strike', 'strike', 'defend', 'defend', 'fireball'], inventory: {} },
    loop: { count: 1, length: 15, tiles: [], positionInLoop: 0, difficultyMultiplier: 1.0 },
    economy: { gold: 200, tilePoints: 10, tileInventory: {}, materials: {} },
    tileInventory: [
      { tileType: 'forest', count: 2 },
      { tileType: 'treasure', count: 1 },
    ],
    relics: [],
    ...overrides,
  };
}

describe('ShopSystem', () => {
  // ── Scaling card prices ──────────────────────────────────
  describe('getCardPrice', () => {
    it('returns base + loop*perLoop at loop 1', () => {
      expect(ShopSystem.getCardPrice(1)).toBe(68); // 60 + 1*8
    });

    it('caps at cardPriceCap at high loops', () => {
      expect(ShopSystem.getCardPrice(12)).toBe(150); // 60+12*8=156 > 150
    });

    it('returns base price at loop 0', () => {
      expect(ShopSystem.getCardPrice(0)).toBe(60); // 60 + 0*8
    });
  });

  // ── Scaling removal prices ───────────────────────────────
  describe('getRemovalPrice', () => {
    it('returns base at 0 removals', () => {
      expect(ShopSystem.getRemovalPrice(0)).toBe(50);
    });

    it('escalates per removal', () => {
      expect(ShopSystem.getRemovalPrice(3)).toBe(125); // 50 + 3*25
    });

    it('caps at removeCap', () => {
      expect(ShopSystem.getRemovalPrice(10)).toBe(200); // 50+250=300 > 200
    });
  });

  // ── Scaling reorder prices ───────────────────────────────
  describe('getReorderPrice', () => {
    it('returns base at 0 reorders', () => {
      expect(ShopSystem.getReorderPrice(0)).toBe(15);
    });

    it('escalates per reorder', () => {
      expect(ShopSystem.getReorderPrice(5)).toBe(115); // 15 + 5*20
    });

    it('caps at reorderCap', () => {
      expect(ShopSystem.getReorderPrice(10)).toBe(150); // 15+200=215 > 150
    });
  });

  // ── Scaling relic prices ─────────────────────────────────
  describe('getRelicPrice', () => {
    it('common relic at loop 1', () => {
      expect(ShopSystem.getRelicPrice('common', 1)).toBe(90); // 80 + 1*10
    });

    it('legendary relic at loop 5 below cap', () => {
      expect(ShopSystem.getRelicPrice('legendary', 5)).toBe(450); // 400 + 5*10 = 450 < 600
    });

    it('common relic caps at high loop', () => {
      expect(ShopSystem.getRelicPrice('common', 100)).toBe(150); // capped
    });
  });

  // ── getShopCards uses scaling price ──────────────────────
  it('getShopCards returns 3 cards with scaled prices', () => {
    const run = makeRunState();
    const cards = ShopSystem.getShopCards(run, ['strike', 'defend', 'fury', 'fireball', 'heal'], 2);
    expect(cards).toHaveLength(3);
    for (const c of cards) {
      expect(c.price).toBe(76); // 60 + 2*8
      expect(c.cardId).toBeTruthy();
    }
  });

  // ── buyCard ──────────────────────────────────────────────
  it('buyCard deducts gold and adds card to deck', () => {
    const run = makeRunState();
    const result = ShopSystem.buyCard(run, 'fury', 60);
    expect(result).toBe(true);
    expect(run.economy.gold).toBe(140);
    expect(run.deck.order).toContain('fury');
  });

  it('buyCard returns false when insufficient gold', () => {
    const run = makeRunState({ economy: { gold: 10, tilePoints: 0, tileInventory: {}, materials: {} } });
    const result = ShopSystem.buyCard(run, 'fury', 60);
    expect(result).toBe(false);
    expect(run.economy.gold).toBe(10);
  });

  // ── removeCard uses scaling price ────────────────────────
  it('removeCard uses getRemovalPrice with removalCount', () => {
    const run = makeRunState();
    // removalCount=0 -> cost=50
    const result = ShopSystem.removeCard(run, 0, 0);
    expect(result).toBe(true);
    expect(run.economy.gold).toBe(150); // 200 - 50
    expect(run.deck.order).toHaveLength(4);
  });

  it('removeCard returns false when deck size <= 3', () => {
    const run = makeRunState({
      deck: { cards: [], order: ['strike', 'defend', 'fireball'], active: ['strike', 'defend', 'fireball'], inventory: {} },
    });
    const result = ShopSystem.removeCard(run, 0, 0);
    expect(result).toBe(false);
  });

  // ── startReorderSession uses scaling price ───────────────
  it('startReorderSession uses getReorderPrice with reorderCount', () => {
    const run = makeRunState();
    // reorderCount=0 -> cost=15
    const result = ShopSystem.startReorderSession(run, 0);
    expect(result).toBe(true);
    expect(run.economy.gold).toBe(185); // 200 - 15
  });

  it('startReorderSession returns false when insufficient gold', () => {
    const run = makeRunState({ economy: { gold: 10, tilePoints: 0, tileInventory: {}, materials: {} } });
    const result = ShopSystem.startReorderSession(run, 0);
    expect(result).toBe(false);
    expect(run.economy.gold).toBe(10);
  });

  // ── reorderCard unchanged ────────────────────────────────
  it('reorderCard moves card from index to index', () => {
    const run = makeRunState({
      deck: { cards: [], order: ['a', 'b', 'c', 'd'], active: ['a', 'b', 'c', 'd'], inventory: {} },
    });
    ShopSystem.reorderCard(run, 0, 2);
    expect(run.deck.order).toEqual(['b', 'c', 'a', 'd']);
  });

  // ── sellTile unchanged ───────────────────────────────────
  it('sellTile gives 50% tile points -- forest (3 TP cost) gives 1 TP', () => {
    const run = makeRunState({ economy: { gold: 100, tilePoints: 0, tileInventory: {}, materials: {} } });
    const result = ShopSystem.sellTile(run, 'forest');
    expect(result).toBe(true);
    expect(run.economy.tilePoints).toBe(1);
    expect(run.tileInventory.find((t: any) => t.tileType === 'forest')!.count).toBe(1);
  });

  it('sellTile returns false when tile not in inventory', () => {
    const run = makeRunState({ tileInventory: [] });
    const result = ShopSystem.sellTile(run, 'swamp');
    expect(result).toBe(false);
  });

  // ── buyRelic ─────────────────────────────────────────────
  it('buyRelic deducts gold and adds relic', () => {
    const run = makeRunState();
    const result = ShopSystem.buyRelic(run, 'fire_ring', 150);
    expect(result).toBe(true);
    expect(run.economy.gold).toBe(50);
    expect(run.relics).toContain('fire_ring');
  });

  it('buyRelic returns false when insufficient gold', () => {
    const run = makeRunState({ economy: { gold: 100, tilePoints: 0, tileInventory: {}, materials: {} } });
    const result = ShopSystem.buyRelic(run, 'fire_ring', 150);
    expect(result).toBe(false);
  });

  it('getShopRelics excludes already owned relics', () => {
    const run = makeRunState({ relics: ['fire_ring'] });
    const relics = ShopSystem.getShopRelics(run, ['fire_ring', 'ice_crown', 'shadow_cloak'], 1);
    for (const r of relics) {
      expect(r.relicId).not.toBe('fire_ring');
    }
  });
});
