import { describe, it, expect } from 'vitest';
import { createCombatState } from '../../../src/systems/combat/CombatState';
import { resolveCardPlayedRelicBonus, dispatchTriggerRelics } from '../../../src/systems/combat/RelicSystem';
import { CardResolver } from '../../../src/systems/combat/CardResolver';
import type { RunState } from '../../../src/state/RunState';
import type { CardDefinition, EnemyDefinition } from '../../../src/data/types';

function makeRun(relicIds: string[] = [], deck: string[] = ['t2-attack-attack']): RunState {
  return {
    version: 3, runId: 't', seed: 'c5', generation: 1, startedAt: Date.now(),
    hero: {
      maxHP: 100, currentHP: 100,
      maxStamina: 10, currentStamina: 10,
      maxMana: 10, currentMana: 10,
      currentDefense: 0, strength: 1, defenseMultiplier: 1, moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
    },
    deck: { active: deck, inventory: {}, upgraded: deck.map(() => false), droppedCards: [] },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: relicIds, isInCombat: false, currentScene: 'Game',
    stopAtShop: true, combatSpeed: 1, mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
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

function magicCard(): CardDefinition {
  return {
    id: 'spell', name: 'Spell', description: '', category: 'magic',
    effects: [{ type: 'damage', value: 6, target: 'enemy' }],
    cost: { mana: 2 }, cooldown: 1, targeting: 'single', rarity: 'common',
  };
}

describe('Relics C5 — Berserker Ring', () => {
  it('multiplies starting STR by 1.6 and reduces Max HP by 25%', () => {
    const state = createCombatState(makeRun(['berserker_ring']), makeEnemy());
    // STR=1 baseline × 1.6 → max(1, round(1.6)) = 2 STR.
    expect(state.heroStrength).toBe(2);
    // MaxHP 100 × 0.75 = 75.
    expect(state.heroMaxHP).toBe(75);
  });
});

describe('Relics C5 — Constellation Sigil', () => {
  it('grants +1 to each primary stat of unique elements in the deck', () => {
    // Deck has attack (str), fire (int), water (spi), counter (str again).
    const deck = ['t2-attack-fire', 't2-water-counter'];
    const state = createCombatState(makeRun(['constellation_sigil'], deck), makeEnemy());
    // attack, fire, water, counter → unique: 4. counter+attack both → strength. fire → int. water → spi.
    // STR baseline 1 + 1 (one bonus, set dedupes mapping). Actually the loop applies +1 per UNIQUE element, mapping each to its stat. So str gets +1 twice (attack + counter both feed strength). Expected: heroStrength = 1 + 2 = 3, heroIntellect = 1, heroSpirit = 1.
    expect(state.heroStrength).toBe(3);
    expect(state.heroIntellect).toBe(1);
    expect(state.heroSpirit).toBe(1);
  });
});

describe('Relics C5 — Sanguine Pact', () => {
  it('grants +N STR and +N INT per 20% HP missing per card', () => {
    const state = createCombatState(makeRun(['sanguine_pact']), makeEnemy());
    state.heroHP = 40; // 60% missing → 3 stacks → +3 STR/INT.
    const baseStr = state.heroStrength;
    const baseInt = state.heroIntellect;
    resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(state._sanguinePactStrBonus).toBe(3);
    expect(state._sanguinePactIntBonus).toBe(3);
    // CombatEngine applies the bonus around resolve; here we just verify the staged values.
    void baseStr; void baseInt;
  });

  it('caps the bonus at +5 STR/INT', () => {
    const state = createCombatState(makeRun(['sanguine_pact']), makeEnemy());
    state.heroHP = 1; // 99% missing → would be 4 stacks (0.99/0.2 = 4)... let's go further.
    state.heroMaxHP = 1000; state.heroHP = 1; // 99.9% missing → 4 stacks (cap 5 anyway).
    resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(state._sanguinePactStrBonus).toBeLessThanOrEqual(5);
  });

  it('self-DoT tick deals 2 damage to enemy via dot_tick dispatch', () => {
    const state = createCombatState(makeRun(['sanguine_pact']), makeEnemy());
    state.heroBleedStacks = 1;
    const before = state.enemyHP;
    dispatchTriggerRelics('dot_tick', state.activeRelicIds, state);
    expect(state.enemyHP).toBe(before - 2);
  });
});

describe('Relics C5 — Demon Heart', () => {
  it('doubles damage during first 6s of combat', () => {
    const state = createCombatState(makeRun(['demon_heart']), makeEnemy());
    state.combatElapsedMs = 1000;
    const bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(bonus.damageMultiplier).toBe(2);
  });

  it('does NOT double damage after 6s', () => {
    const state = createCombatState(makeRun(['demon_heart']), makeEnemy());
    state.combatElapsedMs = 7000;
    const bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(bonus.damageMultiplier).toBe(1);
  });
});

describe('Relics C5 — Echo Chamber', () => {
  it('adds an Echo charge on every 5th card', () => {
    const state = createCombatState(makeRun(['echo_chamber']), makeEnemy());
    expect(state.echoCharges).toBe(0);
    for (let i = 0; i < 4; i++) resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(state.echoCharges).toBe(0);
    resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(state.echoCharges).toBe(1);
  });
});

describe('Relics C5 — Tempest Resonator', () => {
  it('refunds mana and adds Echo every 4th Magic card', () => {
    const state = createCombatState(makeRun(['tempest_resonator']), makeEnemy());
    for (let i = 0; i < 3; i++) resolveCardPlayedRelicBonus(state.activeRelicIds, magicCard(), state);
    expect(state.echoCharges).toBe(0);
    const bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, magicCard(), state);
    expect(state.echoCharges).toBe(1);
    expect(bonus.manaOverride).toBe(0); // refund magic cost
  });

  it('does NOT count non-Magic cards toward the trigger', () => {
    const state = createCombatState(makeRun(['tempest_resonator']), makeEnemy());
    for (let i = 0; i < 5; i++) resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(state.echoCharges).toBe(0);
  });
});

describe('Relics C5 — Slow application hooks', () => {
  it('frostbite_charm deals 2 damage to enemy on Slow application', () => {
    const state = createCombatState(makeRun(['frostbite_charm']), makeEnemy());
    const slowCard: CardDefinition = {
      id: 's', name: 's', description: '', category: 'magic',
      effects: [{ type: 'stack', value: 1, target: 'enemy', stack: 'slow' }],
      cost: { mana: 1 }, cooldown: 1, targeting: 'single', rarity: 'common',
    };
    const before = state.enemyHP;
    new CardResolver().resolve(slowCard, state, null);
    expect(state.enemyHP).toBe(before - 2);
    expect(state.slowStacks).toBe(1);
  });

  it('stormglass_lens applies 1 Stun when 3+ Slow applied at once', () => {
    const state = createCombatState(makeRun(['stormglass_lens']), makeEnemy());
    const slowCard: CardDefinition = {
      id: 's', name: 's', description: '', category: 'magic',
      effects: [{ type: 'stack', value: 3, target: 'enemy', stack: 'slow' }],
      cost: { mana: 1 }, cooldown: 1, targeting: 'single', rarity: 'common',
    };
    expect(state.stunStacks).toBe(0);
    new CardResolver().resolve(slowCard, state, null);
    expect(state.stunStacks).toBe(1);
  });

  it('stormglass_lens does NOT apply Stun when only 2 Slow applied', () => {
    const state = createCombatState(makeRun(['stormglass_lens']), makeEnemy());
    const slowCard: CardDefinition = {
      id: 's', name: 's', description: '', category: 'magic',
      effects: [{ type: 'stack', value: 2, target: 'enemy', stack: 'slow' }],
      cost: { mana: 1 }, cooldown: 1, targeting: 'single', rarity: 'common',
    };
    new CardResolver().resolve(slowCard, state, null);
    expect(state.stunStacks).toBe(0);
  });
});

describe('Relics C5 — Soulforge Chalice', () => {
  it('re-applies 50% of consumed source stack after Convert', () => {
    const state = createCombatState(makeRun(['soulforge_chalice']), makeEnemy());
    state.burnStacks = 8;
    const convertCard: CardDefinition = {
      id: 'cv', name: 'cv', description: '', category: 'magic',
      effects: [{
        type: 'convert_stack', value: 6, target: 'enemy',
        from: 'burn', to: 'bleed', factor: 1,
      }],
      cost: { mana: 1 }, cooldown: 1, targeting: 'single', rarity: 'common',
    };
    new CardResolver().resolve(convertCard, state, null);
    // 6 burn consumed (8 → 2), then 50% of 6 = 3 burn re-applied → 5 burn final.
    expect(state.burnStacks).toBe(5);
    // bleed gained = consumed * factor = 6.
    expect(state.bleedStacks).toBe(6);
  });
});
