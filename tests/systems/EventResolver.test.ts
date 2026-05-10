import { describe, it, expect } from 'vitest';
import {
  getRandomEvent,
  getEvent,
  getAllEvents,
  isChoiceAvailable,
  resolveEventChoice,
} from '../../src/systems/EventResolver';

function makeRunState(overrides: any = {}): any {
  const base = {
    hero: { currentHP: 80, maxHP: 100, currentStamina: 50, maxStamina: 50, currentMana: 30, maxMana: 30, runXP: 0, totalXP: 0, currentDefense: 0, strength: 1, defenseMultiplier: 1, moveSpeed: 2 },
    deck: { active: ['strike', 'defend', 'fury', 'fireball'], inventory: {}, upgradedCards: [], droppedCards: [] },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 15, positionInLoop: 0, difficultyMultiplier: 1.0 },
    economy: { gold: 100, tilePoints: 10, tileInventory: {}, materials: {} },
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
  };
  // Field-name compat: tests pass { hero: { hp, maxHp } } and { economy: { gold, ..., metaLoot } }.
  // Translate those overrides to canonical names while still supporting partial overrides.
  if (overrides.hero) {
    const h: any = overrides.hero;
    overrides = { ...overrides, hero: {
      ...base.hero,
      ...(h.hp !== undefined ? { currentHP: h.hp } : {}),
      ...(h.maxHp !== undefined ? { maxHP: h.maxHp } : {}),
      ...(h.stamina !== undefined ? { currentStamina: h.stamina } : {}),
      ...(h.maxStamina !== undefined ? { maxStamina: h.maxStamina } : {}),
      ...(h.mana !== undefined ? { currentMana: h.mana } : {}),
      ...(h.maxMana !== undefined ? { maxMana: h.maxMana } : {}),
      ...(h.xp !== undefined ? { runXP: h.xp } : {}),
      // Allow direct canonical overrides too
      ...Object.fromEntries(Object.entries(h).filter(([k]) =>
        ['currentHP','maxHP','currentStamina','maxStamina','currentMana','maxMana','runXP','totalXP','currentDefense','strength','defenseMultiplier','moveSpeed','className'].includes(k)
      )),
    }};
  }
  if (overrides.economy) {
    const e: any = overrides.economy;
    overrides = { ...overrides, economy: {
      ...base.economy,
      ...e,
      tileInventory: e.tileInventory ?? base.economy.tileInventory,
      materials: e.materials ?? base.economy.materials,
    }};
  }
  return { ...base, ...overrides };
}

describe('EventResolver', () => {
  it('getRandomEvent returns a valid event with id and choices', () => {
    const event = getRandomEvent();
    expect(event.id).toBeTruthy();
    expect(event.title).toBeTruthy();
    expect(event.choices.length).toBeGreaterThan(0);
  });

  it('getEvent returns correct event by id', () => {
    const event = getEvent('mysterious_merchant');
    expect(event).toBeDefined();
    expect(event!.id).toBe('mysterious_merchant');
    expect(event!.title).toBe('Mysterious Merchant');
  });

  it('getEvent returns undefined for unknown id', () => {
    const event = getEvent('nonexistent');
    expect(event).toBeUndefined();
  });

  it('getAllEvents returns all 6 events', () => {
    const events = getAllEvents();
    expect(events).toHaveLength(6);
  });

  it('isChoiceAvailable returns false when gold requirement not met', () => {
    const run = makeRunState({ economy: { gold: 10, tilePoints: 0, metaLoot: 0 } });
    const event = getEvent('mysterious_merchant')!;
    expect(isChoiceAvailable(event.choices[0], run)).toBe(false);
  });

  it('isChoiceAvailable returns false when HP requirement not met', () => {
    const run = makeRunState({ hero: { hp: 15, maxHp: 100, stamina: 50, maxStamina: 50, mana: 30, maxMana: 30, xp: 0 } });
    const event = getEvent('ancient_shrine')!;
    expect(isChoiceAvailable(event.choices[0], run)).toBe(false);
  });

  it('isChoiceAvailable returns true when no requirements', () => {
    const run = makeRunState();
    const event = getEvent('healing_fountain')!;
    expect(isChoiceAvailable(event.choices[0], run)).toBe(true);
  });

  it('isChoiceAvailable returns true when requirements met', () => {
    const run = makeRunState({ economy: { gold: 50, tilePoints: 0, metaLoot: 0 } });
    const event = getEvent('mysterious_merchant')!;
    expect(isChoiceAvailable(event.choices[0], run)).toBe(true);
  });

  it('resolveEventChoice gain_hp adds hp capped at maxHp', () => {
    const run = makeRunState({ hero: { hp: 80, maxHp: 100, stamina: 50, maxStamina: 50, mana: 30, maxMana: 30, xp: 0 } });
    // healing_fountain choice 0: gain_hp 40 => 80+40=120 capped at 100
    const outcome = resolveEventChoice('healing_fountain', 0, run);
    expect(run.hero.currentHP).toBe(100);
    expect(outcome.description).toBeTruthy();
  });

  it('resolveEventChoice lose_gold subtracts gold, min 0', () => {
    const run = makeRunState({ economy: { gold: 20, tilePoints: 0, metaLoot: 0 } });
    // mysterious_merchant choice 0: lose_gold 30 => 20-30 = min 0
    const outcome = resolveEventChoice('mysterious_merchant', 0, run);
    expect(run.economy.gold).toBe(0);
    expect(outcome.effects.length).toBeGreaterThan(0);
  });

  it('resolveEventChoice gain_gold adds gold', () => {
    const run = makeRunState({ economy: { gold: 50, tilePoints: 0, metaLoot: 0 } });
    // ancient_shrine choice 1: gain_gold 30
    resolveEventChoice('ancient_shrine', 1, run);
    expect(run.economy.gold).toBe(80);
  });

  it('resolveEventChoice returns EventOutcome with description', () => {
    const run = makeRunState();
    const outcome = resolveEventChoice('healing_fountain', 2, run); // "Ignore it" - no effects
    expect(outcome.description).toBeTruthy();
    expect(Array.isArray(outcome.effects)).toBe(true);
  });

  it('resolveEventChoice lose_hp subtracts hp, min 1', () => {
    const run = makeRunState({ hero: { hp: 10, maxHp: 100, stamina: 50, maxStamina: 50, mana: 30, maxMana: 30, xp: 0 } });
    // ancient_shrine choice 0: lose_hp 20 => 10-20 = min 1
    resolveEventChoice('ancient_shrine', 0, run);
    expect(run.hero.currentHP).toBe(1);
  });

  it('resolveEventChoice add_curse adds curse card to deck.active', () => {
    const run = makeRunState();
    // cursed_chest choice 0: gain_relic + add_curse
    const outcome = resolveEventChoice('cursed_chest', 0, run);
    const curseEffect = outcome.effects.find(e => e.type === 'add_curse');
    expect(curseEffect).toBeDefined();
    expect(curseEffect!.applied).toBe(true);
    // Curse card should be in deck
    expect(run.deck.active.length).toBeGreaterThan(4);
  });

  // ── Material Effects (crystal_cave event) ──────────────────
  describe('material effects', () => {
    it('gain_material adds to economy.materials', () => {
      const run = makeRunState({ economy: { gold: 100, tilePoints: 10, materials: { stone: 5 } } });
      // crystal_cave choice 0: gain_material stone +3
      const outcome = resolveEventChoice('crystal_cave', 0, run);
      expect(run.economy.materials.stone).toBe(8); // 5 + 3
      const matEffect = outcome.effects.find(e => e.type === 'gain_material');
      expect(matEffect).toBeDefined();
      expect(matEffect!.applied).toBe(true);
    });

    it('lose_material removes from economy.materials (min 0)', () => {
      const run = makeRunState({ economy: { gold: 100, tilePoints: 10, materials: { stone: 2 } } });
      // crystal_cave choice 1: lose_material stone -2, upgrade_card
      const outcome = resolveEventChoice('crystal_cave', 1, run);
      expect(run.economy.materials.stone).toBe(0); // 2 - 2
      const matEffect = outcome.effects.find(e => e.type === 'lose_material');
      expect(matEffect).toBeDefined();
      expect(matEffect!.applied).toBe(true);
    });

    it('lose_material clamps at 0', () => {
      const run = makeRunState({ economy: { gold: 100, tilePoints: 10, materials: { stone: 1 } } });
      // crystal_cave choice 1: lose_material stone -2
      resolveEventChoice('crystal_cave', 1, run);
      expect(run.economy.materials.stone).toBe(0); // max(0, 1-2) = 0
    });

    it('upgrade_card returns applied: true', () => {
      const run = makeRunState({ economy: { gold: 100, tilePoints: 10, materials: { stone: 5 } } });
      // crystal_cave choice 1: lose_material + upgrade_card
      const outcome = resolveEventChoice('crystal_cave', 1, run);
      const upgradeEffect = outcome.effects.find(e => e.type === 'upgrade_card');
      expect(upgradeEffect).toBeDefined();
      expect(upgradeEffect!.applied).toBe(true);
    });

    it('isChoiceAvailable checks minMaterial requirement - not met', () => {
      const run = makeRunState({ economy: { gold: 100, tilePoints: 10, materials: { stone: 1 } } });
      const choice = {
        text: 'Test',
        effects: [],
        requirement: { minMaterial: { stone: 5 } },
      };
      expect(isChoiceAvailable(choice as any, run)).toBe(false);
    });

    it('isChoiceAvailable checks minMaterial requirement - met', () => {
      const run = makeRunState({ economy: { gold: 100, tilePoints: 10, materials: { stone: 10 } } });
      const choice = {
        text: 'Test',
        effects: [],
        requirement: { minMaterial: { stone: 5 } },
      };
      expect(isChoiceAvailable(choice as any, run)).toBe(true);
    });

    it('isChoiceAvailable returns false when material missing entirely', () => {
      const run = makeRunState({ economy: { gold: 100, tilePoints: 10, materials: {} } });
      const choice = {
        text: 'Test',
        effects: [],
        requirement: { minMaterial: { iron: 3 } },
      };
      expect(isChoiceAvailable(choice as any, run)).toBe(false);
    });
  });

  describe('weighted event selection', () => {
    it('getAllEvents returns 6 events including crystal_cave', () => {
      const events = getAllEvents();
      expect(events).toHaveLength(6);
      expect(events.find(e => e.id === 'crystal_cave')).toBeDefined();
    });
  });
});
