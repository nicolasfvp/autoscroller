import { describe, it, expect } from 'vitest';
import {
  getRandomEvent,
  getEvent,
  getAllEvents,
  isChoiceAvailable,
  resolveEventChoice,
} from '../../src/systems/EventResolver';

function makeRunState(overrides: any = {}) {
  return {
    hero: { hp: 80, maxHp: 100, stamina: 50, maxStamina: 50, mana: 30, maxMana: 30, xp: 0 },
    deck: { cards: [], order: ['strike', 'defend', 'fury', 'fireball'] },
    loop: { count: 1, length: 15, tiles: [], positionInLoop: 0, difficultyMultiplier: 1.0 },
    economy: { gold: 100, tilePoints: 10, metaLoot: 0 },
    tileInventory: [],
    relics: [],
    ...overrides,
  };
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

  it('getAllEvents returns all 5 events', () => {
    const events = getAllEvents();
    expect(events).toHaveLength(5);
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
    expect(run.hero.hp).toBe(100);
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
    expect(run.hero.hp).toBe(1);
  });

  it('resolveEventChoice add_curse returns applied:false', () => {
    const run = makeRunState();
    // cursed_chest choice 0: gain_relic + add_curse
    const outcome = resolveEventChoice('cursed_chest', 0, run);
    const curseEffect = outcome.effects.find(e => e.type === 'add_curse');
    expect(curseEffect).toBeDefined();
    expect(curseEffect!.applied).toBe(false);
  });
});
