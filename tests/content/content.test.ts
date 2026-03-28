import { describe, it, expect } from 'vitest';
import cardsData from '../../src/data/json/cards.json';
import relicsData from '../../src/data/json/relics.json';
import enemiesData from '../../src/data/json/enemies.json';
import eventsData from '../../src/data/json/events.json';
import buildingsData from '../../src/data/json/buildings.json';
import passivesData from '../../src/data/json/passives.json';
import synergiesData from '../../src/data/json/synergies.json';
import { MetaState, RunHistoryEntry, createDefaultMetaState } from '../../src/state/MetaState';

describe('cards.json', () => {
  const cards = cardsData.cards;

  it('has >= 30 entries', () => {
    expect(cards.length).toBeGreaterThanOrEqual(30);
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

  it('has at least 3 epic rarity cards', () => {
    const epics = cards.filter((c: any) => c.rarity === 'epic');
    expect(epics.length).toBeGreaterThanOrEqual(3);
  });

  it('upgraded cards have valid upgrade object with effects or cost or cooldown', () => {
    const upgraded = cards.filter((c: any) => c.upgraded);
    expect(upgraded.length).toBeGreaterThanOrEqual(10);
    for (const card of upgraded) {
      const u = (card as any).upgraded;
      expect(u.effects || u.cost || u.cooldown || u.description).toBeTruthy();
    }
  });
});

describe('relics.json', () => {
  const relics = relicsData as any[];

  it('has >= 15 entries', () => {
    expect(relics.length).toBeGreaterThanOrEqual(15);
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
    expect(bossVariants.length).toBeGreaterThanOrEqual(5);
  });

  it('boss enemies with bossType have behaviors array', () => {
    const bossesWithType = enemies.filter((e: any) => e.bossType);
    for (const boss of bossesWithType) {
      expect(Array.isArray(boss.behaviors)).toBe(true);
      expect(boss.behaviors.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('events.json', () => {
  const events = eventsData as any[];

  it('has >= 15 entries', () => {
    expect(events.length).toBeGreaterThanOrEqual(15);
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

  it('at least 3 events reference materials', () => {
    const materialEvents = events.filter((e: any) =>
      e.choices.some((c: any) =>
        c.effects.some((eff: any) => eff.type === 'gain_material' || eff.type === 'lose_material')
      )
    );
    expect(materialEvents.length).toBeGreaterThanOrEqual(3);
  });
});

describe('buildings.json', () => {
  const buildings = buildingsData as any;

  it('has exactly 6 buildings (forge, library, tavern, workshop, shrine, storehouse)', () => {
    const keys = Object.keys(buildings);
    expect(keys).toContain('forge');
    expect(keys).toContain('library');
    expect(keys).toContain('tavern');
    expect(keys).toContain('workshop');
    expect(keys).toContain('shrine');
    expect(keys).toContain('storehouse');
    expect(keys.length).toBe(6);
  });

  it('each building has tiers array of length 3-10', () => {
    for (const key of Object.keys(buildings)) {
      const b = buildings[key];
      expect(Array.isArray(b.tiers)).toBe(true);
      expect(b.tiers.length).toBeGreaterThanOrEqual(3);
      expect(b.tiers.length).toBeLessThanOrEqual(10);
    }
  });

  it('shrine has maxLevel >= 4', () => {
    expect(buildings.shrine.maxLevel).toBeGreaterThanOrEqual(4);
  });

  it('forge has maxLevel >= 5', () => {
    expect(buildings.forge.maxLevel).toBeGreaterThanOrEqual(5);
  });
});

describe('synergies.json', () => {
  it('has >= 10 synergy pairs', () => {
    expect((synergiesData as any[]).length).toBeGreaterThanOrEqual(10);
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
