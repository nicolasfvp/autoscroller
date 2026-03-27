import { describe, it, expect } from 'vitest';
import cardsData from '../../src/data/json/cards.json';
import relicsData from '../../src/data/json/relics.json';
import enemiesData from '../../src/data/json/enemies.json';
import eventsData from '../../src/data/json/events.json';
import buildingsData from '../../src/data/json/buildings.json';
import passivesData from '../../src/data/json/passives.json';
import { MetaState, RunHistoryEntry, createDefaultMetaState } from '../../src/state/MetaState';

describe('cards.json', () => {
  const cards = cardsData.cards;

  it('has >= 15 entries', () => {
    expect(cards.length).toBeGreaterThanOrEqual(15);
  });

  it('each card has id, name, category, cooldown (number), rarity (string), effects (array)', () => {
    for (const card of cards) {
      expect(card).toHaveProperty('id');
      expect(card).toHaveProperty('name');
      expect(card).toHaveProperty('category');
      expect(typeof card.cooldown).toBe('number');
      expect(typeof card.rarity).toBe('string');
      expect(Array.isArray(card.effects)).toBe(true);
    }
  });

  it('starter cards (strike, defend, heavy-hit, fireball) have no unlockSource field', () => {
    const starterIds = ['strike', 'defend', 'heavy-hit', 'fireball'];
    for (const id of starterIds) {
      const card = cards.find((c: any) => c.id === id);
      expect(card).toBeDefined();
      expect(card).not.toHaveProperty('unlockSource');
    }
  });

  it('has starterDeckIds top-level array', () => {
    expect(Array.isArray(cardsData.starterDeckIds)).toBe(true);
    expect(cardsData.starterDeckIds.length).toBe(10);
  });
});

describe('relics.json', () => {
  const relics = relicsData as any[];

  it('has exactly 8 entries', () => {
    expect(relics.length).toBe(8);
  });

  it('each relic has id, name, rarity, trigger, effectType, and icon', () => {
    for (const relic of relics) {
      expect(relic).toHaveProperty('id');
      expect(relic).toHaveProperty('name');
      expect(relic).toHaveProperty('rarity');
      expect(relic).toHaveProperty('trigger');
      expect(relic).toHaveProperty('effectType');
      expect(relic).toHaveProperty('icon');
    }
  });

  it('3 common relics (bronze_scale, energy_potion, arcane_crystal) have NO unlockSource', () => {
    const commonIds = ['bronze_scale', 'energy_potion', 'arcane_crystal'];
    for (const id of commonIds) {
      const relic = relics.find((r: any) => r.id === id);
      expect(relic).toBeDefined();
      expect(relic).not.toHaveProperty('unlockSource');
    }
  });

  it('5 relics (warrior_spirit, iron_will, berserker_ring, demon_heart, phoenix_feather) DO have unlockSource', () => {
    const gatedIds = ['warrior_spirit', 'iron_will', 'berserker_ring', 'demon_heart', 'phoenix_feather'];
    for (const id of gatedIds) {
      const relic = relics.find((r: any) => r.id === id);
      expect(relic).toBeDefined();
      expect(relic).toHaveProperty('unlockSource');
    }
  });
});

describe('enemies.json', () => {
  const enemies = enemiesData as any[];

  it('has >= 9 entries (6 base + 3 boss variants)', () => {
    expect(enemies.length).toBeGreaterThanOrEqual(9);
  });

  it('boss variants have bossType field', () => {
    const bossVariants = enemies.filter((e: any) => e.bossType);
    expect(bossVariants.length).toBe(3);
    const bossTypes = bossVariants.map((e: any) => e.bossType).sort();
    expect(bossTypes).toEqual(['berserker', 'mage', 'tank']);
  });
});

describe('events.json', () => {
  const events = eventsData as any[];

  it('has >= 5 entries', () => {
    expect(events.length).toBeGreaterThanOrEqual(5);
  });

  it('each event has id, title, description, choices (array with >= 2 items)', () => {
    for (const event of events) {
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('title');
      expect(event).toHaveProperty('description');
      expect(Array.isArray(event.choices)).toBe(true);
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('buildings.json', () => {
  const buildings = buildingsData as any;

  it('has exactly 5 buildings (forge, library, tavern, workshop, shrine)', () => {
    const keys = Object.keys(buildings);
    expect(keys).toContain('forge');
    expect(keys).toContain('library');
    expect(keys).toContain('tavern');
    expect(keys).toContain('workshop');
    expect(keys).toContain('shrine');
    expect(keys.length).toBe(5);
  });

  it('each building has tiers array of length 3-5', () => {
    for (const key of Object.keys(buildings)) {
      const b = buildings[key];
      expect(Array.isArray(b.tiers)).toBe(true);
      expect(b.tiers.length).toBeGreaterThanOrEqual(3);
      expect(b.tiers.length).toBeLessThanOrEqual(5);
    }
  });

  it('shrine has maxLevel 3', () => {
    expect(buildings.shrine.maxLevel).toBe(3);
  });
});

describe('passives.json', () => {
  const passives = passivesData as any;

  it('has >= 5 warrior passive nodes', () => {
    expect(passives.warrior.length).toBeGreaterThanOrEqual(5);
  });

  it('each passive has id, name, xpCost, effect', () => {
    for (const p of passives.warrior) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('xpCost');
      expect(p).toHaveProperty('effect');
    }
  });
});

describe('MetaState', () => {
  it('createDefaultMetaState returns object with all required fields', () => {
    const state = createDefaultMetaState();
    expect(state).toHaveProperty('buildings');
    expect(state).toHaveProperty('materials');
    expect(state).toHaveProperty('classXP');
    expect(state).toHaveProperty('unlockedCards');
    expect(state).toHaveProperty('unlockedRelics');
    expect(state).toHaveProperty('unlockedTiles');
    expect(state).toHaveProperty('runHistory');
    expect(state).toHaveProperty('version');
  });

  it('default state has correct initial values', () => {
    const state = createDefaultMetaState();
    expect(state.materials).toEqual({});
    expect(state.classXP.warrior).toBe(0);
    expect(state.unlockedCards).toEqual([]);
    expect(state.unlockedRelics).toEqual([]);
    expect(state.unlockedTiles).toEqual([]);
    expect(state.runHistory).toEqual([]);
    expect(state.totalRuns).toBe(0);
    expect(state.version).toBe(2);
    expect(state.buildings.forge.level).toBe(0);
    expect(state.buildings.library.level).toBe(0);
    expect(state.buildings.tavern.level).toBe(0);
    expect(state.buildings.workshop.level).toBe(0);
    expect(state.buildings.shrine.level).toBe(0);
  });
});
