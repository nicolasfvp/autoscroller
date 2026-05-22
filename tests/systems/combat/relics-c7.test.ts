import { describe, it, expect } from 'vitest';
import { createCombatState } from '../../../src/systems/combat/CombatState';
import { resolveCardPlayedRelicBonus } from '../../../src/systems/combat/RelicSystem';
import { ShopSystem } from '../../../src/systems/ShopSystem';
import type { RunState } from '../../../src/state/RunState';
import type { CardDefinition, EnemyDefinition } from '../../../src/data/types';

function makeRun(relicIds: string[] = [], deckSize = 5): RunState {
  const deck: string[] = [];
  for (let i = 0; i < deckSize; i++) deck.push('t1-attack-attack');
  return {
    version: 3, runId: 't', seed: 'c7', generation: 1, startedAt: Date.now(),
    hero: {
      maxHP: 100, currentHP: 100,
      maxStamina: 10, currentStamina: 10,
      maxMana: 10, currentMana: 10,
      currentDefense: 0, strength: 1, defenseMultiplier: 1, moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
    },
    deck: { active: deck, inventory: {}, upgraded: deck.map(() => false), droppedCards: [] },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 1000, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: relicIds, isInCombat: false, currentScene: 'Game',
    stopAtShop: true, combatSpeed: 1, mapSpeed: 1,
    pool: { cards: [], relics: ['phoenix_feather', 'demon_heart', 'glass_cannon', 'echo_chamber', 'iron_will', 'sanguine_pact', 'catalyst_core'], tiles: [] },
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
  };
}

function makeEnemy(): EnemyDefinition {
  return {
    id: 'd', name: 'D', type: 'normal', baseHP: 200, baseDefense: 0,
    attack: { damage: 5, pattern: 'fixed' }, attackCooldown: 2000,
    goldReward: { min: 1, max: 1 }, color: 0x00ff00,
  };
}

function attackCard(): CardDefinition {
  return {
    id: 'hit', name: 'Hit', description: '', category: 'attack',
    effects: [{ type: 'damage', value: 10, target: 'enemy' }],
    cost: { stamina: 1 }, cooldown: 1, targeting: 'single', rarity: 'common',
  };
}

describe('Relics C7 — Heavy Tome', () => {
  it('grants +20% damage when deck size >= 10', () => {
    const state = createCombatState(makeRun(['heavy_tome'], 10), makeEnemy());
    const bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(bonus.damageMultiplier).toBeCloseTo(1.2);
  });

  it('does NOT grant damage bonus below 10 cards', () => {
    const state = createCombatState(makeRun(['heavy_tome'], 9), makeEnemy());
    const bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(bonus.damageMultiplier).toBe(1);
  });

  it('grants +4 Max HP per card past 10 at combat start', () => {
    // 13 cards = 3 excess → +12 Max HP.
    const baseline = createCombatState(makeRun([], 13), makeEnemy());
    const withRelic = createCombatState(makeRun(['heavy_tome'], 13), makeEnemy());
    expect(withRelic.heroMaxHP).toBe(baseline.heroMaxHP + 12);
  });

  it('no HP bonus when at exactly 10 cards', () => {
    const baseline = createCombatState(makeRun([], 10), makeEnemy());
    const withRelic = createCombatState(makeRun(['heavy_tome'], 10), makeEnemy());
    expect(withRelic.heroMaxHP).toBe(baseline.heroMaxHP);
  });
});

describe('Relics C7 — Beacon Lantern (ShopSystem integration)', () => {
  it('shop without Beacon Lantern returns 5 relics (or fewer if pool small)', () => {
    const run = makeRun([]);
    const relics = ShopSystem.getShopRelics(run, run.pool.relics);
    expect(relics.length).toBeLessThanOrEqual(5);
    expect(relics.length).toBeGreaterThan(0);
  });

  it('Beacon Lantern bumps shop size by +2 (up to pool size)', () => {
    const run = makeRun(['beacon_lantern']);
    const relics = ShopSystem.getShopRelics(run, run.pool.relics);
    // pool has 7 entries → 5 + 2 = 7 (= full pool).
    expect(relics.length).toBe(Math.min(7, run.pool.relics.length));
  });

  it('Beacon Lantern reduces relic prices by 10%', () => {
    const run = makeRun(['beacon_lantern']);
    const basePriceCommon = ShopSystem.getRelicPrice('common', 0);
    const discountedCommon = ShopSystem.getRelicPrice('common', 0, run);
    expect(discountedCommon).toBe(Math.floor(basePriceCommon * 0.9));
  });
});

describe('Relics C7 — Trailblazer\'s Brand (RunState field)', () => {
  it('has the trailblazerFiredThisLoop flag on run.loop (initialized undefined)', () => {
    const run = makeRun(['trailblazers_brand']);
    expect(run.loop.trailblazerFiredThisLoop).toBeUndefined();
    // Simulate the LoopRunner setting it.
    run.loop.trailblazerFiredThisLoop = true;
    expect(run.loop.trailblazerFiredThisLoop).toBe(true);
  });
});

describe('Relics C7 — Echo cost-zero on relic-triggered echoes', () => {
  it('echo_chamber sets freeEchoCharges on the trigger card', () => {
    const state = createCombatState(makeRun(['echo_chamber']), makeEnemy());
    const card = attackCard();
    for (let i = 0; i < 4; i++) resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    expect(state.freeEchoCharges).toBe(0);
    resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    expect(state.echoCharges).toBe(1);
    expect(state.freeEchoCharges).toBe(1);
  });

  it('tempest_resonator sets freeEchoCharges on the 4th Magic card', () => {
    const state = createCombatState(makeRun(['tempest_resonator']), makeEnemy());
    const magic: CardDefinition = {
      id: 's', name: 's', description: '', category: 'magic',
      effects: [{ type: 'damage', value: 5, target: 'enemy' }],
      cost: { mana: 2 }, cooldown: 1, targeting: 'single', rarity: 'common',
    };
    for (let i = 0; i < 3; i++) resolveCardPlayedRelicBonus(state.activeRelicIds, magic, state);
    expect(state.freeEchoCharges).toBe(0);
    resolveCardPlayedRelicBonus(state.activeRelicIds, magic, state);
    expect(state.freeEchoCharges).toBe(1);
  });
});
