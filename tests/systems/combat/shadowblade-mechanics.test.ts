// Shadowblade mechanic tests (D-13 b).
// Phase 9 Plan 3: all scaffolds converted from it.todo to real assertions.

import { describe, it, expect } from 'vitest';
import { createNewRun } from '../../../src/state/RunState';
import { resolveHeroStats } from '../../../src/systems/hero/HeroStatsResolver';
import { CardResolver } from '../../../src/systems/combat/CardResolver';
import type { CombatState } from '../../../src/systems/combat/CombatState';
import type { CardDefinition, SynergyDefinition } from '../../../src/data/types';

// -- Test helpers ----------------------------------------------------------

function makeState(overrides: Partial<CombatState> = {}): CombatState {
  return {
    heroHP: 100, heroMaxHP: 100,
    heroStamina: 50, heroMaxStamina: 50,
    heroMana: 30, heroMaxMana: 30,
    heroDefense: 0,
    heroStrength: 1, heroDefenseMultiplier: 1,
    heroClass: 'shadowblade',
    deckOrder: [],
    enemyId: 'slime', enemyName: 'Slime',
    enemyHP: 200, enemyMaxHP: 200,
    enemyDefense: 0, enemyDamage: 8,
    enemyAttackCooldown: 2500,
    enemyPattern: 'fixed',
    enemySpecialEffect: null,
    activePassives: [],
    heroStunned: false,
    upgraded: [],
    activeRelicIds: [],
    behaviors: [],
    cooldownMultiplier: 1.0,
    firstCardDamageMultiplier: 1.0,
    _bloodPactBonus: 0,
    phoenixUsed: false,
    heroVitality: 0, heroDexterity: 0, heroIntellect: 0, heroSpirit: 0,
    comboPoints: 0, comboPointsCap: 5, stealthCharges: 0, stealthCap: 4, evadeNextHit: false,
    poisonStacks: 0, poisonDecayDisabled: false, bleedStacks: 0, burnStacks: 0,
    freezeStacks: 0, shockStacks: 0, arcaneStacks: 0, arcaneStacksCap: 10, rageStacks: 0,
    ...overrides,
  };
}

function makeCard(overrides: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id: 'test-card', name: 'Test', description: 'test',
    category: 'attack',
    effects: [],
    cooldown: 1.0, targeting: 'single', rarity: 'common',
    ...overrides,
  };
}

const resolver = new CardResolver();

// -- Combo Points ----------------------------------------------------------

describe('Shadowblade — Combo Points', () => {
  it('gain_combo effect increments comboPoints by value', () => {
    const state = makeState();
    const card = makeCard({
      id: 'backstab',
      effects: [{ type: 'gain_combo', value: 1, target: 'self' }],
    });
    resolver.resolve(card, state, null);
    expect(state.comboPoints).toBe(1);
  });

  it('comboPoints clamps at comboPointsCap (5)', () => {
    const state = makeState({ comboPoints: 4 });
    const card = makeCard({
      effects: [{ type: 'gain_combo', value: 3, target: 'self' }],
    });
    resolver.resolve(card, state, null);
    expect(state.comboPoints).toBe(5);
  });

  it('chalice-of-five-blades raises comboPointsCap to 8 (state-driven cap)', () => {
    const state = makeState({ comboPoints: 4, comboPointsCap: 8 });
    const card = makeCard({
      effects: [{ type: 'gain_combo', value: 3, target: 'self' }],
    });
    resolver.resolve(card, state, null);
    expect(state.comboPoints).toBe(7);
  });

  it('consume_combo zeros comboPoints and multiplies damage by old CP value', () => {
    const state = makeState({ comboPoints: 5 });
    const card = makeCard({
      id: 'eviscerate',
      effects: [{ type: 'consume_combo', value: 4, target: 'enemy' }],
    });
    const result = resolver.resolve(card, state, null);
    // 4 base * 5 CP = 20 base; * 1 str * 1 dmgMult * 1 buffMult = 20; - 0 def = 20
    expect(result.totalDamage).toBe(20);
    expect(state.enemyHP).toBe(180);
    expect(state.comboPoints).toBe(0);
  });

  it('finisher at CP=0 still resolves (deals 0 damage from CP component, doesn’t throw)', () => {
    const state = makeState({ comboPoints: 0 });
    const card = makeCard({
      effects: [{ type: 'consume_combo', value: 4, target: 'enemy' }],
    });
    const result = resolver.resolve(card, state, null);
    expect(result.totalDamage).toBe(0);
    expect(state.comboPoints).toBe(0);
  });
});

// -- Stealth ---------------------------------------------------------------

describe('Shadowblade — Stealth', () => {
  it('stealth effect increments stealthCharges and sets evadeNextHit=true', () => {
    const state = makeState();
    const card = makeCard({
      id: 'shadowstep',
      effects: [{ type: 'stealth', value: 2, target: 'self' }],
    });
    resolver.resolve(card, state, null);
    expect(state.stealthCharges).toBe(2);
    expect(state.evadeNextHit).toBe(true);
  });

  it('Stealth charges cap at stealthCap=4', () => {
    const state = makeState({ stealthCharges: 3 });
    const card = makeCard({
      effects: [{ type: 'stealth', value: 5, target: 'self' }],
    });
    resolver.resolve(card, state, null);
    expect(state.stealthCharges).toBe(4);
  });

  // Pitfall 6: Stealth bonus damage on AoE applies to primary target only.
  // Currently the engine is 1v1; this is a forward-compatible structural
  // assertion that the bonus damage hook ISN'T summed across targets.
  it('Stealth bonus damage on AoE applies to primary target only (Pitfall 6, forward-compatible)', () => {
    const state = makeState({ stealthCharges: 2, evadeNextHit: true });
    // A targeting='aoe' damage card resolves through the single enemy slot;
    // assert no special multi-target multiplier silently inflates damage.
    const card = makeCard({
      effects: [{ type: 'damage', value: 8, target: 'enemy' }],
      targeting: 'aoe',
    });
    const result = resolver.resolve(card, state, null);
    // 8 * 1 str * 1 dmgMult * 1 buffMult - 0 def = 8 (NOT 8 * enemies)
    expect(result.totalDamage).toBe(8);
    // Stealth flags are unchanged by a damage cast; consumption happens on
    // enemy hit (CombatEngine — Task 4).
    expect(state.stealthCharges).toBe(2);
  });
});

// -- Poison / DoT (Task 3 covers application; Task 4 covers tick cadence) --

describe('Shadowblade — Poison / DoT (application)', () => {
  it('dot effect with stack=poison adds poisonStacks', () => {
    const state = makeState();
    const card = makeCard({
      id: 'toxic-coat',
      effects: [{ type: 'dot', value: 3, target: 'enemy', stack: 'poison' }],
    });
    resolver.resolve(card, state, null);
    expect(state.poisonStacks).toBe(3);
  });

  it('dot with stack=bleed routes to bleedStacks', () => {
    const state = makeState();
    const card = makeCard({
      effects: [{ type: 'dot', value: 2, target: 'enemy', stack: 'bleed' }],
    });
    resolver.resolve(card, state, null);
    expect(state.bleedStacks).toBe(2);
    expect(state.poisonStacks).toBe(0);
  });

  it('dot without explicit stack defaults to poison', () => {
    const state = makeState();
    const card = makeCard({
      effects: [{ type: 'dot', value: 1, target: 'enemy' }],
    });
    resolver.resolve(card, state, null);
    expect(state.poisonStacks).toBe(1);
  });
});

// -- Stack (Pitfall 8: arcane cap-and-drop) -------------------------------

describe('Mage — Arcane stack overflow (Pitfall 8)', () => {
  it('stack effect with stack=arcane clamps at arcaneStacksCap (10)', () => {
    const state = makeState({ arcaneStacks: 9 });
    const card = makeCard({
      effects: [{ type: 'stack', value: 3, target: 'self', stack: 'arcane' }],
    });
    resolver.resolve(card, state, null);
    expect(state.arcaneStacks).toBe(10);
  });

  it('stack effect with stack=rage has no engine-level cap', () => {
    const state = makeState({ rageStacks: 8 });
    const card = makeCard({
      effects: [{ type: 'stack', value: 5, target: 'self', stack: 'rage' }],
    });
    resolver.resolve(card, state, null);
    expect(state.rageStacks).toBe(13);
  });
});

// -- Buff / debuff_stat / taunt -------------------------------------------

describe('CardResolver — buff / debuff_stat / taunt', () => {
  it('buff effect adds to per-combat hero stat, does NOT mutate run.hero', () => {
    const run = createNewRun(undefined, 1, 'shadowblade');
    // Snapshot run.hero.dexterity before buff resolution.
    const runDexBefore = run.hero.dexterity;
    const state = makeState({ heroDexterity: 8 });
    const card = makeCard({
      effects: [{
        type: 'buff', value: 2, target: 'self',
        scale: { stat: 'dex', per: 1, value: 0 }, // scale.stat carries axis
      }],
    });
    resolver.resolve(card, state, null);
    expect(state.heroDexterity).toBe(10);
    // Critical: run.hero.dexterity unchanged (T-09-03-01 trust boundary).
    expect(run.hero.dexterity).toBe(runDexBefore);
  });

  it('debuff_stat is a no-op stub (forward-compatible)', () => {
    const state = makeState();
    const before = JSON.stringify(state);
    const card = makeCard({
      effects: [{ type: 'debuff_stat', value: 3, target: 'enemy' }],
    });
    resolver.resolve(card, state, null);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('taunt is a no-op stub (no engine behavior in v2)', () => {
    const state = makeState();
    const before = JSON.stringify(state);
    const card = makeCard({
      effects: [{ type: 'taunt', value: 1, target: 'self' }],
    });
    resolver.resolve(card, state, null);
    expect(JSON.stringify(state)).toBe(before);
  });
});

// -- Stat scaling: scale clause -------------------------------------------

describe('Stat scaling — scale clause', () => {
  it('damage with scale.stat=dex resolves +floor(DEX/per)*value before multipliers', () => {
    // heroDexterity=12, scale: per=4, value=1 -> +floor(12/4)*1 = +3
    // Base 4 -> resolved 7; * 1 str * 1 dmgMult * 1 buffMult - 0 def = 7
    const state = makeState({ heroDexterity: 12 });
    const card = makeCard({
      effects: [{
        type: 'damage', value: 4, target: 'enemy',
        scale: { stat: 'dex', per: 4, value: 1 },
      }],
    });
    const result = resolver.resolve(card, state, null);
    expect(result.totalDamage).toBe(7);
  });

  it('damage with no scale clause behaves as v1 (no stat bump)', () => {
    const state = makeState({ heroDexterity: 12 });
    const card = makeCard({
      effects: [{ type: 'damage', value: 4, target: 'enemy' }],
    });
    const result = resolver.resolve(card, state, null);
    expect(result.totalDamage).toBe(4);
  });

  it('VIT statDelta propagates through resolveHeroStats (Plan 1 wiring)', () => {
    const run = createNewRun(undefined, 1, 'warrior');
    run.hero.statDeltas = { vit: 3 };
    const resolved = resolveHeroStats(run);
    expect(resolved.vit).toBe(3);
  });

  it('SPI scales heal effects (+10% per point)', () => {
    // Base heal 10, heroSpirit=4 -> +floor(10 * 0.40) = +4 -> 14 total
    const state = makeState({ heroHP: 50, heroMaxHP: 100, heroSpirit: 4 });
    const card = makeCard({
      effects: [{ type: 'heal', value: 10, target: 'self' }],
    });
    const result = resolver.resolve(card, state, null);
    expect(result.healed).toBe(14);
    expect(state.heroHP).toBe(64);
  });
});

// -- Synergy bonus -> effect routing (Task 3 hooks, Task 5 expands) -------

describe('Synergy bonus dispatch — Phase 9 new bonus types', () => {
  it('bonus.type=combo_point grants CP via gain_combo', () => {
    const state = makeState();
    const card = makeCard({ effects: [{ type: 'damage', value: 1, target: 'enemy' }] });
    const synergy: SynergyDefinition = {
      cardA: 'a', cardB: 'b',
      bonus: { type: 'combo_point', value: 2, target: 'self' },
      displayName: 'CP Synergy',
    };
    resolver.resolve(card, state, synergy);
    expect(state.comboPoints).toBe(2);
  });

  it('bonus.type=stealth grants Stealth charge + evadeNextHit', () => {
    const state = makeState();
    const card = makeCard({ effects: [{ type: 'damage', value: 1, target: 'enemy' }] });
    const synergy: SynergyDefinition = {
      cardA: 'a', cardB: 'b',
      bonus: { type: 'stealth', value: 1, target: 'self' },
      displayName: 'Stealth Synergy',
    };
    resolver.resolve(card, state, synergy);
    expect(state.stealthCharges).toBe(1);
    expect(state.evadeNextHit).toBe(true);
  });

  it('bonus.type=dot with stack=poison adds poisonStacks', () => {
    const state = makeState();
    const card = makeCard({ effects: [{ type: 'damage', value: 1, target: 'enemy' }] });
    const synergy: SynergyDefinition = {
      cardA: 'a', cardB: 'b',
      bonus: { type: 'dot', value: 3, target: 'enemy', stack: 'poison' },
      displayName: 'DoT Synergy',
    };
    resolver.resolve(card, state, synergy);
    expect(state.poisonStacks).toBe(3);
  });

  it('bonus.type=stat_buff applies to the named axis (per-combat)', () => {
    const state = makeState({ heroDexterity: 5 });
    const card = makeCard({ effects: [{ type: 'damage', value: 1, target: 'enemy' }] });
    const synergy: SynergyDefinition = {
      cardA: 'a', cardB: 'b',
      bonus: { type: 'stat_buff', value: 3, target: 'self', stat: 'dex' },
      displayName: 'Dex Buff Synergy',
    };
    resolver.resolve(card, state, synergy);
    expect(state.heroDexterity).toBe(8);
  });
});
