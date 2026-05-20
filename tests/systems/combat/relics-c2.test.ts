import { describe, it, expect } from 'vitest';
import { createCombatState } from '../../../src/systems/combat/CombatState';
import { resolveCardPlayedRelicBonus, dispatchTriggerRelics } from '../../../src/systems/combat/RelicSystem';
import { CardResolver } from '../../../src/systems/combat/CardResolver';
import type { RunState } from '../../../src/state/RunState';
import type { CardDefinition, EnemyDefinition } from '../../../src/data/types';

function makeRun(relicIds: string[] = []): RunState {
  return {
    version: 3,
    runId: 'test-c2',
    seed: 'c2-seed',
    generation: 1,
    startedAt: Date.now(),
    hero: {
      maxHP: 100, currentHP: 100,
      maxStamina: 10, currentStamina: 10,
      maxMana: 10, currentMana: 10,
      currentDefense: 0, strength: 0, defenseMultiplier: 1, moveSpeed: 2,
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
    id: 'dummy', name: 'Dummy', type: 'normal', baseHP: 100, baseDefense: 0,
    attack: { damage: 5, pattern: 'fixed' }, attackCooldown: 2000,
    goldReward: { min: 1, max: 1 }, color: 0x00ff00,
  };
}

function makeAttackCard(): CardDefinition {
  return {
    id: 'attack-card', name: 'Attack', description: '', category: 'attack',
    effects: [{ type: 'damage', value: 10, target: 'enemy' }],
    cost: { stamina: 1 }, cooldown: 1, targeting: 'single', rarity: 'common',
  };
}

function makeUtilityCard(): CardDefinition {
  return {
    id: 'util-card', name: 'Util', description: '', category: 'attack',
    effects: [{ type: 'mana', value: 1, target: 'self' }],
    cost: { stamina: 1 }, cooldown: 1, targeting: 'single', rarity: 'common',
  };
}

function makeDefenseCard(armor = 10): CardDefinition {
  return {
    id: 'defend-card', name: 'Defend', description: '', category: 'defense',
    effects: [{ type: 'armor', value: armor, target: 'self' }],
    cost: { stamina: 1 }, cooldown: 1, targeting: 'self', rarity: 'common',
  };
}

describe('Relics C2 — every-Nth card_played', () => {
  it('iron_cestus fires on the 4th damage card (+50% dmg + 3 Bleed)', () => {
    const state = createCombatState(makeRun(['iron_cestus']), makeEnemy());
    const card = makeAttackCard();
    let bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    expect(bonus.damageMultiplier).toBe(1.0); // 1st
    bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    expect(bonus.damageMultiplier).toBe(1.0); // 2nd
    bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    expect(bonus.damageMultiplier).toBe(1.0); // 3rd
    const before = state.bleedStacks;
    bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    expect(bonus.damageMultiplier).toBe(1.5); // 4th
    expect(state.bleedStacks).toBe(before + 3);
  });

  it('iron_cestus does not count non-damage cards', () => {
    const state = createCombatState(makeRun(['iron_cestus']), makeEnemy());
    const util = makeUtilityCard();
    for (let i = 0; i < 4; i++) resolveCardPlayedRelicBonus(state.activeRelicIds, util, state);
    const bonus = resolveCardPlayedRelicBonus(state.activeRelicIds, util, state);
    expect(bonus.damageMultiplier).toBe(1.0); // no trigger
  });

  it('echoing_chime refunds 2 Mana every 6th card', () => {
    const state = createCombatState(makeRun(['echoing_chime']), makeEnemy());
    state.heroMana = 0;
    const card = makeAttackCard();
    for (let i = 0; i < 5; i++) resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    expect(state.heroMana).toBe(0);
    resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    expect(state.heroMana).toBe(2);
  });

  it('librarians_seal refunds 3 Mana every 5th card', () => {
    const state = createCombatState(makeRun(['librarians_seal']), makeEnemy());
    state.heroMana = 0;
    const card = makeAttackCard();
    for (let i = 0; i < 4; i++) resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    expect(state.heroMana).toBe(0);
    resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    expect(state.heroMana).toBe(3);
  });

  it('burnished_sigil multiplies the next armor by 1.5 every 3rd Defense card', () => {
    const state = createCombatState(makeRun(['burnished_sigil']), makeEnemy());
    const defend = makeDefenseCard(10);
    const resolver = new CardResolver();

    // First 2 defense cards just grant base 10 armor each.
    resolveCardPlayedRelicBonus(state.activeRelicIds, defend, state);
    resolver.resolve(defend, state, null);
    resolveCardPlayedRelicBonus(state.activeRelicIds, defend, state);
    resolver.resolve(defend, state, null);
    expect(state.heroDefense).toBe(20);

    // Third defense card sets nextArmorMultiplier=1.5; resolver applies +50%.
    resolveCardPlayedRelicBonus(state.activeRelicIds, defend, state);
    expect(state.nextArmorMultiplier).toBe(1.5);
    resolver.resolve(defend, state, null);
    expect(state.heroDefense).toBe(20 + 15); // 10 * 1.5
    expect(state.nextArmorMultiplier).toBe(1.0); // consumed
  });

  it('whisperwind_sash grants +1 DEX every 3 cards capped at 5', () => {
    const state = createCombatState(makeRun(['whisperwind_sash']), makeEnemy());
    const baseDex = state.heroDexterity;
    const card = makeAttackCard();
    // 5 triggers = +5 DEX; 6th trigger should be capped.
    for (let trigger = 0; trigger < 7; trigger++) {
      for (let i = 0; i < 3; i++) resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    }
    expect(state.heroDexterity).toBe(baseDex + 5);
  });

  it('vampiric_fang heals 1 HP per damaging hit (cap 3 per 1s)', () => {
    const state = createCombatState(makeRun(['vampiric_fang']), makeEnemy());
    state.heroHP = state.heroMaxHP - 20;
    state.combatElapsedMs = 0;
    const card = makeAttackCard();
    for (let i = 0; i < 5; i++) resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    // 3 heals fired in the first window; rest ignored.
    expect(state.heroHP).toBe(state.heroMaxHP - 20 + 3);
    // Advance past 1s, new window resets the cap.
    state.combatElapsedMs = 1500;
    resolveCardPlayedRelicBonus(state.activeRelicIds, card, state);
    expect(state.heroHP).toBe(state.heroMaxHP - 20 + 4);
  });
});

describe('Relics C2 — kill bonuses', () => {
  it('lucky_coin queues +2 gold per kill', () => {
    const state = createCombatState(makeRun(['lucky_coin']), makeEnemy());
    dispatchTriggerRelics('enemy_killed', state.activeRelicIds, state);
    expect(state.pendingGoldBonus).toBe(2);
  });

  it('gravediggers_tag queues +3 gold and heals +3 HP per kill', () => {
    const state = createCombatState(makeRun(['gravediggers_tag']), makeEnemy());
    state.heroHP = 50;
    dispatchTriggerRelics('enemy_killed', state.activeRelicIds, state);
    expect(state.pendingGoldBonus).toBe(3);
    expect(state.heroHP).toBe(53);
  });

  it('huntmasters_eye grants +1 STR per kill, capped at +6', () => {
    const state = createCombatState(makeRun(['huntmasters_eye']), makeEnemy());
    const baseStr = state.heroStrength;
    for (let i = 0; i < 10; i++) {
      dispatchTriggerRelics('enemy_killed', state.activeRelicIds, state);
    }
    expect(state.heroStrength).toBe(baseStr + 6);
  });
});

describe('Relics C2 — DoT-tick relics', () => {
  it('burnt_tome grants +1 Mana per Burn tick while Burn is active (cap 8)', () => {
    const state = createCombatState(makeRun(['burnt_tome']), makeEnemy());
    state.burnStacks = 5;
    state.heroMana = 0;
    state.heroMaxMana = 20;
    for (let i = 0; i < 12; i++) {
      dispatchTriggerRelics('dot_tick', state.activeRelicIds, state);
    }
    expect(state.heroMana).toBe(8); // capped
  });

  it('burnt_tome does not fire when no Burn stacks present', () => {
    const state = createCombatState(makeRun(['burnt_tome']), makeEnemy());
    state.burnStacks = 0;
    state.heroMana = 0;
    dispatchTriggerRelics('dot_tick', state.activeRelicIds, state);
    expect(state.heroMana).toBe(0);
  });

  it('linen_wrap heals 1 HP per self-DoT tick (cancels out the tick damage)', () => {
    const state = createCombatState(makeRun(['linen_wrap']), makeEnemy());
    state.heroBleedStacks = 2;
    state.heroHP = 50;
    dispatchTriggerRelics('dot_tick', state.activeRelicIds, state);
    expect(state.heroHP).toBe(51);
  });

  it('bloodgorged_heart heals 1 HP and grants +1 Rage per self-DoT tick', () => {
    const state = createCombatState(makeRun(['bloodgorged_heart']), makeEnemy());
    state.heroBurnStacks = 1;
    state.heroHP = 80;
    state.rageStacks = 0;
    dispatchTriggerRelics('dot_tick', state.activeRelicIds, state);
    expect(state.heroHP).toBe(81);
    expect(state.rageStacks).toBe(1);
  });
});
