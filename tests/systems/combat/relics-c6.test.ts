import { describe, it, expect, vi } from 'vitest';
import { createCombatState } from '../../../src/systems/combat/CombatState';
import { resolveCardPlayedRelicBonus } from '../../../src/systems/combat/RelicSystem';
import { CardResolver } from '../../../src/systems/combat/CardResolver';
import { applyRestChoice } from '../../../src/systems/RestSiteSystem';
import type { RunState } from '../../../src/state/RunState';
import type { CardDefinition, EnemyDefinition } from '../../../src/data/types';

function makeRun(relicIds: string[] = []): RunState {
  return {
    version: 3, runId: 't', seed: 'c6', generation: 1, startedAt: Date.now(),
    hero: {
      maxHP: 100, currentHP: 50,
      maxStamina: 10, currentStamina: 10,
      maxMana: 10, currentMana: 10,
      currentDefense: 0, strength: 1, defenseMultiplier: 1, moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
    },
    deck: { active: ['t1-attack-attack'], inventory: {}, upgraded: [false], droppedCards: [] },
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

describe('Relics C6 — HP-gated damage multipliers', () => {
  it('glasswork_lens multiplies damage by 1.25 when enemy HP > 75%', () => {
    const state = createCombatState(makeRun(['glasswork_lens']), makeEnemy());
    state.enemyHP = 200; // full HP
    const bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(bonus.damageMultiplier).toBeCloseTo(1.25);
  });

  it('glasswork_lens does NOT fire when enemy below 75% HP', () => {
    const state = createCombatState(makeRun(['glasswork_lens']), makeEnemy());
    state.enemyHP = 50; // 25% HP
    const bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(bonus.damageMultiplier).toBe(1);
  });

  it('executioners_brand multiplies damage by 1.35 when enemy HP < 30%', () => {
    const state = createCombatState(makeRun(['executioners_brand']), makeEnemy());
    state.enemyHP = 30; // 15% HP
    const bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(bonus.damageMultiplier).toBeCloseTo(1.35);
  });

  it('executioners_brand does NOT fire above 30% HP', () => {
    const state = createCombatState(makeRun(['executioners_brand']), makeEnemy());
    state.enemyHP = 100; // 50% HP
    const bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, attackCard(), state);
    expect(bonus.damageMultiplier).toBe(1);
  });
});

describe('Relics C6 — Pandora\'s Embers', () => {
  it('applies 3 of a random non-Rage stack to enemy at combat start', () => {
    // Force the RNG to pick the first slot — burnStacks.
    const rng = vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const state = createCombatState(makeRun(['pandoras_embers']), makeEnemy());
    expect(state.burnStacks).toBe(3);
    rng.mockRestore();
  });

  it('picks bleed when RNG hits slot 1', () => {
    const rng = vi.spyOn(Math, 'random').mockReturnValue(0.25); // 0.25 * 5 = 1.25 → idx 1
    const state = createCombatState(makeRun(['pandoras_embers']), makeEnemy());
    expect(state.bleedStacks).toBe(3);
    rng.mockRestore();
  });
});

describe('Relics C6 — Stamina Reservoir', () => {
  it('converts every 3 unspent Stamina from previous combat to +1 STR (cap +5)', () => {
    const run = makeRun(['stamina_reservoir']);
    run.hero.currentStamina = 9; // 9 / 3 = 3 STR.
    const state = createCombatState(run, makeEnemy());
    expect(state.heroStrength).toBe(run.hero.strength + 3);
  });

  it('caps STR bonus at +5 even with very high carry stamina', () => {
    const run = makeRun(['stamina_reservoir']);
    run.hero.maxStamina = 30;
    run.hero.currentStamina = 30; // would map to +10, capped to +5.
    const state = createCombatState(run, makeEnemy());
    expect(state.heroStrength).toBe(run.hero.strength + 5);
  });
});

describe('Relics C6 — Ash Eater', () => {
  it('grants +1 Mana / +1 Stamina on Pyre detonation and discounts next card', () => {
    const state = createCombatState(makeRun(['ash_eater']), makeEnemy());
    state.burnStacks = 4;
    state.heroMana = 1; // afford the pyre cast cost
    state.heroStamina = 0;
    state.heroMaxMana = 20;
    state.heroMaxStamina = 20;

    const pyreCard: CardDefinition = {
      id: 'pyre', name: 'Pyre', description: '', category: 'magic',
      effects: [{
        type: 'damage', value: 2, target: 'enemy',
        condition: { enemy_has_stack: 'burn', per_stack: true },
      }],
      cost: { mana: 1 }, cooldown: 1, targeting: 'single', rarity: 'common',
    };
    new CardResolver().resolve(pyreCard, state, null);
    // Pyre paid 1 Mana, then Ash Eater refunded +1 → net 1 Mana. Stamina +1 from 0.
    expect(state.heroMana).toBe(1);
    expect(state.heroStamina).toBe(1);
    expect(state.relicCounters['ash_eater_pending']).toBe(1);

    // Next card pays normal cost - 1 of each.
    const next: CardDefinition = {
      id: 'spend', name: 'Spend', description: '', category: 'magic',
      effects: [{ type: 'damage', value: 5, target: 'enemy' }],
      cost: { stamina: 2, mana: 2 }, cooldown: 1, targeting: 'single', rarity: 'common',
    };
    state.heroMana = 5; state.heroStamina = 5;
    new CardResolver().resolve(next, state, null);
    // Paid stamina 1 (2-1), mana 1 (2-1).
    expect(state.heroStamina).toBe(4);
    expect(state.heroMana).toBe(4);
    expect(state.relicCounters['ash_eater_pending']).toBe(0);
  });
});

describe('Relics C6 — Hearty Meal', () => {
  it('rest heals 50% more and grants +2 Stamina', () => {
    const baseline = makeRun([]);
    baseline.hero.currentStamina = 0;
    applyRestChoice('rest', baseline);
    const baselineHpHealed = baseline.hero.currentHP - 50;
    const baselineStamina = baseline.hero.currentStamina;

    const withRelic = makeRun(['hearty_meal']);
    withRelic.hero.currentStamina = 0;
    applyRestChoice('rest', withRelic);
    const withHealed = withRelic.hero.currentHP - 50;
    expect(withHealed).toBeGreaterThan(baselineHpHealed); // +50% heal
    expect(withRelic.hero.currentStamina).toBe(baselineStamina + 2);
  });
});
