import { describe, it, expect, beforeAll } from 'vitest';
import {
  loadAllData,
  getAllCards,
  getCardById,
  getStarterDeckIds,
  getAllEnemies,
  getEnemyById,
  getAllTiles,
  getAllRelics,
  getDifficultyConfig,
  getDefaultHeroStats,
  getEnemyDropTable,
} from '../../src/data/DataLoader';

describe('DataLoader', () => {
  beforeAll(() => {
    loadAllData();
  });

  it('getAllCards() returns at least 14 cards', () => {
    expect(getAllCards().length).toBeGreaterThanOrEqual(14);
  });

  it('getCardById("strike") returns a card', () => {
    const card = getCardById('strike');
    expect(card).toBeDefined();
    expect(card!.id).toBe('strike');
    expect(card!.name).toBe('Strike');
  });

  it('every card has cooldown and targeting fields', () => {
    for (const card of getAllCards()) {
      expect(card.cooldown).toBeDefined();
      expect(typeof card.cooldown).toBe('number');
      expect(card.targeting).toBeDefined();
      expect(['single', 'aoe', 'lowest-hp', 'random', 'self']).toContain(card.targeting);
    }
  });

  it('getStarterDeckIds() returns non-empty array', () => {
    const ids = getStarterDeckIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('strike');
    expect(ids).toContain('defend');
  });

  it('getAllEnemies() returns at least 6 enemies', () => {
    expect(getAllEnemies().length).toBeGreaterThanOrEqual(6);
  });

  it('getEnemyById("slime") returns Slime', () => {
    const enemy = getEnemyById('slime');
    expect(enemy).toBeDefined();
    expect(enemy!.name).toBe('Slime');
  });

  it('getAllTiles() returns at least 8 tile configs', () => {
    expect(getAllTiles().length).toBeGreaterThanOrEqual(8);
  });

  it('getAllRelics() returns at least 8 relics', () => {
    expect(getAllRelics().length).toBeGreaterThanOrEqual(8);
  });

  it('getDifficultyConfig() returns normal config with expected fields', () => {
    const config = getDifficultyConfig('normal');
    expect(config.baseEnemyHPMultiplier).toBe(1.0);
    expect(config.shopCost.cardBase).toBe(60);
  });

  it('getDefaultHeroStats() returns stats with maxHP=100', () => {
    const stats = getDefaultHeroStats();
    expect(stats.maxHP).toBe(100);
    expect(stats.maxStamina).toBe(50);
    expect(stats.maxMana).toBe(30);
  });

  it('getEnemyDropTable("Slime") returns drop config', () => {
    const table = getEnemyDropTable('Slime');
    expect(table).toBeDefined();
    expect(table!.cardDrops.cardPool.length).toBeGreaterThan(0);
  });
});
