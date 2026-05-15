import { describe, it, expect } from 'vitest';
import cardsData from '../../src/data/json/cards.json';
import relicsData from '../../src/data/json/relics.json';
import enemiesData from '../../src/data/json/enemies.json';
import buildingsData from '../../src/data/json/buildings.json';
import passivesData from '../../src/data/json/passives.json';
import synergiesData from '../../src/data/json/synergies.json';
import { createDefaultMetaState } from '../../src/state/MetaState';

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

  it.skip('upgraded cards have valid upgrade object (deprecated: v2 wholesale replacement dropped upgrade overlays)', () => {
    // Plan 2 / D-05: v1 content replaced wholesale. The v2 design package does not author per-card
    // upgrade overlays — upgrade-on-rest semantics will be re-introduced in a future content pass.
    // Skipped rather than deleted for traceability.
    const upgraded = cards.filter((c: any) => c.upgraded);
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

  it('4 v1-surviving gated relics (iron_will, berserker_ring, demon_heart, phoenix_feather) DO have unlockSource', () => {
    // warrior_spirit dropped from v2 (replaced by warrior-class-exclusive relics per design/01_warrior.md §6).
    const gatedIds = ['berserker_ring', 'demon_heart', 'phoenix_feather'];
    for (const id of gatedIds) {
      const relic = relics.find((r: any) => r.id === id);
      expect(relic, `gated relic ${id} missing`).toBeDefined();
      expect(relic).toHaveProperty('unlockSource');
    }
    // iron_will is now a neutral rare with damage_taken trigger; v2 keeps it ungated (passive bonus).
    const ironWill = relics.find((r: any) => r.id === 'iron_will');
    expect(ironWill, 'iron_will present in v2').toBeDefined();
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
    }
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
    expect(state.version).toBe(7);
    expect(state.buildings.forge.level).toBe(0);
    expect(state.buildings.library.level).toBe(0);
    expect(state.buildings.tavern.level).toBe(0);
    expect(state.buildings.workshop.level).toBe(0);
    expect(state.buildings.shrine.level).toBe(0);
  });
});

describe('Phase 9 (v2) content totals + coverage', () => {
  const cards = cardsData.cards;
  const relics = relicsData as any[];
  const synergies = synergiesData as any[];

  it('cards.json has exactly 125 entries (RED until Plan 2)', () => {
    expect(cards.length).toBe(125);
  });

  it('relics.json has exactly 50 entries (RED until Plan 2)', () => {
    expect(relics.length).toBe(50);
  });

  it('synergies.json has exactly 125 entries (RED until Plan 2)', () => {
    expect(synergies.length).toBe(125);
  });

  it('every card appears in exactly 2 synergy rows (RED until Plan 2)', () => {
    const counts = new Map<string, number>();
    for (const card of cards as any[]) counts.set(card.id, 0);
    for (const row of synergies) {
      counts.set(row.cardA, (counts.get(row.cardA) ?? 0) + 1);
      counts.set(row.cardB, (counts.get(row.cardB) ?? 0) + 1);
    }
    const offenders: Array<{ id: string; count: number }> = [];
    for (const [id, count] of counts) {
      if (count !== 2) offenders.push({ id, count });
    }
    expect(offenders, JSON.stringify(offenders)).toEqual([]);
  });

  it('all card effect.type values are in the known enumeration', () => {
    const allowed = new Set([
      'damage', 'heal', 'armor', 'stamina', 'mana', 'debuff',
      'buff', 'debuff_stat', 'dot', 'stack',
      'consume_combo', 'gain_combo', 'stealth', 'taunt',
    ]);
    for (const card of cards as any[]) {
      for (const eff of card.effects) {
        expect(allowed.has(eff.type), `${card.id}: unknown effect type ${eff.type}`).toBe(true);
      }
    }
  });

  it('every card has rarity in {common, uncommon, rare, epic}', () => {
    const allowed = new Set(['common', 'uncommon', 'rare', 'epic']);
    for (const card of cards as any[]) {
      expect(allowed.has(card.rarity), `${card.id}: rarity ${card.rarity}`).toBe(true);
    }
  });

  it('no v1-only IDs survived into v2 (Plan 2 final dead list)', () => {
    // v1-only IDs that were explicitly cut in v2 per the design docs §9 trim heuristic.
    // Many v1 cards survive by name (strike, defend, fury, etc.) — they appear in their
    // class doc §4 card tables. Only these are truly forbidden:
    const forbidden = [
      'pommel-strike',     // warrior numeric clone of jab (§9 cut)
      'skull-cracker',     // warrior strike clone (§9 cut)
      'catch-breath',      // warrior cantrip (§9 cut)
      'wild-swing',        // warrior 50%-miss noob trap (§9 cut)
      'inner-focus',       // mage filler (§8.3 cut)
      'dim-mind',          // mage filler (§8.3 cut)
      'mind-glimmer',      // mage mana-spark clone (§8.3 cut)
      'galvanize',         // mage filler (§8.3 cut)
      'flash-freeze',      // mage frost-nip clone (§8.3 cut)
    ];
    const cardIds = new Set((cards as any[]).map((c) => c.id));
    const survivors: string[] = [];
    for (const dead of forbidden) if (cardIds.has(dead)) survivors.push(dead);
    expect(survivors, `v1-only IDs survived: ${survivors.join(', ')}`).toEqual([]);
  });

  it('iron-skin is classified as Mage exactly once (Pitfall 9)', () => {
    const ironSkinEntries = (cards as any[]).filter((c) => c.id === 'iron-skin');
    expect(ironSkinEntries.length).toBe(1);
    expect(ironSkinEntries[0].classRestriction).toBe('mage');
  });

  it('every card has class restriction (warrior | mage | neutral)', () => {
    const allowed = new Set(['warrior', 'mage', 'neutral']);
    const offenders: string[] = [];
    for (const card of cards as any[]) {
      if (!allowed.has(card.classRestriction)) {
        offenders.push(`${card.id}: ${card.classRestriction ?? '(unset)'}`);
      }
    }
    expect(offenders, `cards missing classRestriction: ${offenders.join(', ')}`).toEqual([]);
  });
});
