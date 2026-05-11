import { describe, it, expect, afterEach } from 'vitest';
import { ShopSystem, setActiveBuffs as setShopActiveBuffs } from '../../src/systems/ShopSystem';

function makeRunState(overrides: any = {}): any {
  return {
    hero: { currentHP: 100, maxHP: 100, currentStamina: 50, maxStamina: 50, currentMana: 30, maxMana: 30, runXP: 0, totalXP: 0, currentDefense: 0, strength: 1, defenseMultiplier: 1, moveSpeed: 2 },
    deck: { active: ['strike', 'strike', 'defend', 'defend', 'fireball'], inventory: {}, upgraded: [false, false, false, false, false], droppedCards: [] },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 15, positionInLoop: 0, difficultyMultiplier: 1.0 },
    economy: { gold: 200, tilePoints: 10, tileInventory: { forest: 2, treasure: 1 }, materials: {} },
    relics: [],
    runId: 'test',
    generation: 1,
    startedAt: 0,
    isInCombat: false,
    currentScene: 'GameScene',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
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
    expect(run.deck.active).toContain('fury');
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
    expect(run.deck.active).toHaveLength(4);
  });

  it('removeCard returns false when deck size <= 3', () => {
    const run = makeRunState({
      deck: { active: ['strike', 'defend', 'fireball'], inventory: {}, upgraded: [false, false, false], droppedCards: [] },
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
      deck: { active: ['a', 'b', 'c', 'd'], inventory: {}, upgraded: [false, false, false, false], droppedCards: [] },
    });
    ShopSystem.reorderCard(run, 0, 2);
    expect(run.deck.active).toEqual(['b', 'c', 'a', 'd']);
  });

  // ── sellTile unchanged ───────────────────────────────────
  it('sellTile gives 50% tile points -- forest (3 TP cost) gives 1 TP', () => {
    const run = makeRunState({ economy: { gold: 100, tilePoints: 0, tileInventory: { forest: 2 }, materials: {} } });
    const result = ShopSystem.sellTile(run, 'forest');
    expect(result).toBe(true);
    expect(run.economy.tilePoints).toBe(1);
    expect(run.economy.tileInventory.forest).toBe(1);
  });

  it('sellTile returns false when tile not in inventory', () => {
    const run = makeRunState({ economy: { gold: 100, tilePoints: 0, tileInventory: {}, materials: {} } });
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

  // ── Card Upgrades ──────────────────────────────────────────
  describe('card upgrades', () => {
    it('getUpgradePrice returns correct prices per rarity', () => {
      expect(ShopSystem.getUpgradePrice('common')).toBe(50);
      expect(ShopSystem.getUpgradePrice('uncommon')).toBe(80);
      expect(ShopSystem.getUpgradePrice('rare')).toBe(120);
      expect(ShopSystem.getUpgradePrice('epic')).toBe(200);
    });

    it('getUpgradePrice returns 100 for unknown rarity', () => {
      expect(ShopSystem.getUpgradePrice('mythic')).toBe(100);
    });

    it('upgradeCard deducts gold and flags only the targeted index', () => {
      const run = makeRunState();
      // Two copies of "strike" at indices 0 and 1; upgrading index 0 must
      // not upgrade index 1 (this is the bug being fixed).
      const result = ShopSystem.upgradeCard(run, 0, 'common');
      expect(result).toBe(true);
      expect(run.economy.gold).toBe(150); // 200 - 50
      expect(run.deck.upgraded[0]).toBe(true);
      expect(run.deck.upgraded[1]).toBe(false);
    });

    it('upgradeCard returns false if insufficient gold', () => {
      const run = makeRunState({ economy: { gold: 10, tilePoints: 0, tileInventory: {}, materials: {} } });
      const result = ShopSystem.upgradeCard(run, 0, 'common');
      expect(result).toBe(false);
      expect(run.economy.gold).toBe(10);
      expect(run.deck.upgraded[0]).toBe(false);
    });

    it('upgradeCard returns false if the slot is already upgraded', () => {
      const run = makeRunState();
      run.deck.upgraded[0] = true;
      const result = ShopSystem.upgradeCard(run, 0, 'common');
      expect(result).toBe(false);
      expect(run.economy.gold).toBe(200); // unchanged
    });

    it('upgradeCard returns false on out-of-range index', () => {
      const run = makeRunState();
      expect(ShopSystem.upgradeCard(run, -1, 'common')).toBe(false);
      expect(ShopSystem.upgradeCard(run, 99, 'common')).toBe(false);
      expect(run.economy.gold).toBe(200);
    });
  });

  // -- Phase 9: Library+Shop cardUpgradeDiscount (design/04 §7) --
  describe('upgradeCard with cardUpgradeDiscount (Library+Shop adjacency)', () => {
    afterEach(() => {
      // Reset module-level buffs so other tests aren't polluted.
      setShopActiveBuffs([]);
    });

    it('applies a 20% discount when cardUpgradeDiscount buff is active', () => {
      setShopActiveBuffs([{ tileIndex: 0, type: 'cardUpgradeDiscount', value: 0.20 }]);
      const run = makeRunState();
      // common upgrade is 50g; with 0.20 discount -> 40g.
      const ok = ShopSystem.upgradeCard(run, 0, 'common');
      expect(ok).toBe(true);
      expect(run.economy.gold).toBe(160); // 200 - 40
      expect(run.deck.upgraded[0]).toBe(true);
    });

    it('falls back to full price when no discount buff is active', () => {
      setShopActiveBuffs([]);
      const run = makeRunState();
      const ok = ShopSystem.upgradeCard(run, 0, 'common');
      expect(ok).toBe(true);
      expect(run.economy.gold).toBe(150); // 200 - 50
    });

    it('sums multiple cardUpgradeDiscount buffs (capped at 95%)', () => {
      setShopActiveBuffs([
        { tileIndex: 0, type: 'cardUpgradeDiscount', value: 0.20 },
        { tileIndex: 1, type: 'cardUpgradeDiscount', value: 0.30 },
      ]);
      const run = makeRunState();
      // 0.50 discount on 50g common -> 25g.
      const ok = ShopSystem.upgradeCard(run, 0, 'common');
      expect(ok).toBe(true);
      expect(run.economy.gold).toBe(175);
    });
  });
});
