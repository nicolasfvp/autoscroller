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

  it('every Tier 1 card has tier === 1 and every Tier 2 card has tier === 2', () => {
    // Element-based system (post-Phase 10): cards are tagged by tier.
    // Verify the canonical t1-/t2- prefix matches the tier field.
    const offenders: string[] = [];
    for (const card of cards as any[]) {
      if (card.id.startsWith('t1-') && card.tier !== 1) {
        offenders.push(`${card.id}: tier=${card.tier}, expected 1`);
      } else if (card.id.startsWith('t2-') && card.tier !== 2) {
        offenders.push(`${card.id}: tier=${card.tier}, expected 2`);
      }
    }
    expect(offenders, offenders.join('; ')).toEqual([]);
  });

  it('has starterDecks.warrior and starterDecks.mage (both length 5)', () => {
    const sd = (cardsData as any).starterDecks;
    expect(sd).toBeDefined();
    expect(Array.isArray(sd.warrior)).toBe(true);
    expect(sd.warrior.length).toBe(5);
    expect(Array.isArray(sd.mage)).toBe(true);
    expect(sd.mage.length).toBe(5);
  });

  it('has at least 3 cards with rarity rare or higher', () => {
    const strong = cards.filter((c: any) => c.rarity === 'rare' || c.rarity === 'epic');
    expect(strong.length).toBeGreaterThanOrEqual(3);
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
    // Phase 10: roster trimmed to 3 boss variants (doom_knight, iron_golem, lizard_king).
    const bossVariants = enemies.filter((e: any) => e.bossType);
    expect(bossVariants.length).toBeGreaterThanOrEqual(3);
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
  it('is empty in Phase 10 (synergy system replaced by element combinations)', () => {
    expect((synergiesData as any[]).length).toBe(0);
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
    // Phase 10 new fields (element/forge system):
    expect(state).toHaveProperty('forgeRecipes');
    expect(state).toHaveProperty('deckPresets');
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
    // Phase 10 / Design v3: bumped to v8 with forgeRecipes + deckPresets.
    expect(state.version).toBe(8);
    expect(state.buildings.forge.level).toBe(0);
    expect(state.buildings.library.level).toBe(0);
    expect(state.buildings.tavern.level).toBe(0);
    expect(state.buildings.workshop.level).toBe(0);
    expect(state.buildings.shrine.level).toBe(0);
    // Phase 10 element/forge system fields:
    expect(state.forgeRecipes).toEqual([]);
    expect(state.deckPresets).toBeDefined();
    expect(Array.isArray(state.deckPresets.warrior)).toBe(true);
    expect(Array.isArray(state.deckPresets.mage)).toBe(true);
  });
});

describe('Phase 10 (element system) content totals + coverage', () => {
  const cards = cardsData.cards;
  const relics = relicsData as any[];

  it('cards.json has exactly 156 entries (36 Tier 1 + 120 Tier 2)', () => {
    expect(cards.length).toBe(156);
  });

  it('cards.json contains exactly 36 Tier 1 cards', () => {
    const t1 = (cards as any[]).filter((c) => c.tier === 1);
    expect(t1.length).toBe(36);
  });

  it('cards.json contains exactly 120 Tier 2 cards', () => {
    const t2 = (cards as any[]).filter((c) => c.tier === 2);
    expect(t2.length).toBe(120);
  });

  it('relics.json has exactly 39 entries', () => {
    expect(relics.length).toBe(39);
  });

  it('synergies.json has exactly 0 entries (system removed)', () => {
    expect((synergiesData as any[]).length).toBe(0);
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

  it('every card is class-neutral (no classRestriction or classRestriction === "neutral")', () => {
    // Phase 10 / Design v3 §7: cards are universal. classRestriction defaults to "neutral"
    // (or is omitted). Per-class identity comes from shard drop bias + starter deck presets.
    const offenders: string[] = [];
    for (const card of cards as any[]) {
      const cr = card.classRestriction;
      if (cr !== undefined && cr !== 'neutral') {
        offenders.push(`${card.id}: classRestriction=${cr}`);
      }
    }
    expect(offenders, offenders.join('; ')).toEqual([]);
  });
});
