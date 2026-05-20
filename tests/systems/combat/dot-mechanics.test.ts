import { describe, it, expect, vi, beforeAll } from 'vitest';
import { CombatEngine } from '../../../src/systems/combat/CombatEngine';
import { CardResolver } from '../../../src/systems/combat/CardResolver';
import { EnemyAI } from '../../../src/systems/combat/EnemyAI';
import { createEmptyCombatStats } from '../../../src/systems/combat/CombatStats';
import { type RunState, setRun, clearRun } from '../../../src/state/RunState';
import type { CombatState } from '../../../src/systems/combat/CombatState';
import type { CardDefinition, CardEffect } from '../../../src/data/types';
import { loadAllData } from '../../../src/data/DataLoader';

// Silence the EventBus.
vi.mock('../../../src/core/EventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

function makeMockRun(): RunState {
  return {
    version: 5,
    runId: 'dot-test',
    seed: 'dot',
    generation: 1,
    startedAt: Date.now(),
    hero: {
      maxHP: 100, currentHP: 100,
      maxStamina: 50, currentStamina: 50,
      maxMana: 30, currentMana: 30,
      currentDefense: 0,
      strength: 1, defenseMultiplier: 1,
      moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
    },
    deck: {
      active: ['t1-attack-attack'],
      inventory: {},
      upgraded: [false],
      droppedCards: [],
    },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [],
    isInCombat: false,
    currentScene: 'Game',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
  };
}

function makeState(over: Partial<CombatState> = {}): CombatState {
  return {
    heroHP: 100, heroMaxHP: 100,
    heroStamina: 50, heroMaxStamina: 50,
    heroMana: 30, heroMaxMana: 30,
    heroDefense: 0,
    heroStrength: 1,
    heroVitality: 0, heroDexterity: 0, heroIntellect: 0, heroSpirit: 0,
    heroDefenseMultiplier: 1,
    heroClass: 'warrior',
    deckOrder: [],
    enemyId: 'dummy', enemyName: 'Dummy', enemyType: 'normal',
    enemyHP: 1000, enemyMaxHP: 1000, enemyDefense: 0,
    enemyDamage: 5, enemyAttackCooldown: 2000, enemyBaseAttackCooldown: 2000,
    enemyPattern: 'fixed', enemySpecialEffect: null, enemyAffinity: null,
    activeRelicIds: [], activePassives: [],
    heroStunned: false, upgraded: [], behaviors: [],
    cooldownMultiplier: 1.0, firstCardDamageMultiplier: 1.0,
    _bloodPactBonus: 0, phoenixUsed: false,
    poisonStacks: 0, bleedStacks: 0, burnStacks: 0, stunStacks: 0,
    slowStacks: 0, arcaneStacks: 0, arcaneStacksCap: 10, rageStacks: 0,
    enemyAttackedSinceLastBleedTick: false, poisonTickParity: 0,
    nextCardCooldownReduction: 0,
    buffMagnitudePerCard: {},
    heroAuras: [], enemyAuras: [],
    heroBurnStacks: 0, heroBleedStacks: 0,
    ...over,
  } as CombatState;
}

function makeCard(effects: CardEffect[]): CardDefinition {
  return {
    id: 'pyre-test-card',
    name: 'Pyre Test',
    description: '',
    category: 'attack',
    effects,
    cooldown: 1.0,
    targeting: 'single',
    rarity: 'common',
  } as CardDefinition;
}

/** Invoke the engine's private DoT tick method directly. */
function tickDoTs(engine: CombatEngine, cardId: string = 't1-attack-attack'): void {
  (engine as unknown as { tickActiveDoTs: (id: string) => void }).tickActiveDoTs(cardId);
}

describe('DoT mechanics — Burn (non-decaying flat 2)', () => {
  beforeAll(async () => { await loadAllData(); });

  it('deals flat 2 damage per tick regardless of stack count and does NOT decay', () => {
    const run = makeMockRun();
    setRun(run);
    try {
      // Build a CombatState manually so we can tick DoTs without a card play.
      const state = makeState({ burnStacks: 5, enemyHP: 1000 });
      const engine = new (CombatEngine as unknown as new (s: CombatState) => CombatEngine)(state);

      const startHP = state.enemyHP;
      tickDoTs(engine);
      tickDoTs(engine);
      tickDoTs(engine);

      expect(startHP - state.enemyHP).toBe(6); // 2+2+2
      expect(state.burnStacks).toBe(5); // stacks unchanged
    } finally {
      clearRun();
    }
  });

  it('Burn 1 still deals 2 damage per tick (flat, not per-stack)', () => {
    const run = makeMockRun();
    setRun(run);
    try {
      const state = makeState({ burnStacks: 1, enemyHP: 1000 });
      const engine = new (CombatEngine as unknown as new (s: CombatState) => CombatEngine)(state);
      tickDoTs(engine);
      expect(state.enemyHP).toBe(998);
      expect(state.burnStacks).toBe(1);
    } finally {
      clearRun();
    }
  });
});

describe('DoT mechanics — Pyre consume', () => {
  it('Pyre damage effect deals value * burnStacks and consumes burn pool', () => {
    const state = makeState({ burnStacks: 5, enemyHP: 1000, enemyDefense: 0, heroStrength: 1 });
    const resolver = new CardResolver();
    // Pyre 3: damage 3 per burn stack — total = 15 — then burn consumed.
    const card = makeCard([{
      type: 'damage', value: 3, target: 'enemy',
      condition: { enemy_has_stack: 'burn', per_stack: true },
    }]);
    const result = resolver.resolve(card, state, null, 1.0, false);
    expect(result.totalDamage).toBe(15);
    expect(state.enemyHP).toBe(1000 - 15);
    expect(state.burnStacks).toBe(0);
  });

  it('plain "Empowered (if Burn)" (no per_stack) does NOT consume burn', () => {
    const state = makeState({ burnStacks: 4, enemyHP: 1000, enemyDefense: 0, heroStrength: 1 });
    const resolver = new CardResolver();
    // Empowered (if Burn): +6 damage — flat bonus, burn pool untouched.
    const card = makeCard([{
      type: 'damage', value: 6, target: 'enemy',
      condition: { enemy_has_stack: 'burn' },
    }]);
    resolver.resolve(card, state, null, 1.0, false);
    expect(state.burnStacks).toBe(4);
  });
});

describe('DoT mechanics — Bleed (swing-amplified)', () => {
  beforeAll(async () => { await loadAllData(); });

  it('with NO enemy attack between ticks, bleed deals stacks * 1 per tick', () => {
    const run = makeMockRun();
    setRun(run);
    try {
      const state = makeState({ bleedStacks: 3, enemyHP: 1000 });
      const engine = new (CombatEngine as unknown as new (s: CombatState) => CombatEngine)(state);
      const startHP = state.enemyHP;
      tickDoTs(engine); // 3 stacks * 1 = 3, decays to 2
      tickDoTs(engine); // 2 stacks * 1 = 2, decays to 1
      tickDoTs(engine); // 1 stack  * 1 = 1, decays to 0
      expect(startHP - state.enemyHP).toBe(3 + 2 + 1);
      expect(state.bleedStacks).toBe(0);
    } finally {
      clearRun();
    }
  });

  it('WITH enemy attack between every tick, bleed deals stacks * 2 per tick', () => {
    const run = makeMockRun();
    setRun(run);
    try {
      const state = makeState({ bleedStacks: 3, enemyHP: 1000 });
      const engine = new (CombatEngine as unknown as new (s: CombatState) => CombatEngine)(state);
      const startHP = state.enemyHP;

      state.enemyAttackedSinceLastBleedTick = true;
      tickDoTs(engine); // 3 * 2 = 6, stacks 3->2
      state.enemyAttackedSinceLastBleedTick = true;
      tickDoTs(engine); // 2 * 2 = 4, stacks 2->1
      state.enemyAttackedSinceLastBleedTick = true;
      tickDoTs(engine); // 1 * 2 = 2, stacks 1->0

      expect(startHP - state.enemyHP).toBe(6 + 4 + 2);
      expect(state.bleedStacks).toBe(0);
    } finally {
      clearRun();
    }
  });

  it('flag resets to false after each bleed tick', () => {
    const run = makeMockRun();
    setRun(run);
    try {
      const state = makeState({ bleedStacks: 2, enemyHP: 1000 });
      const engine = new (CombatEngine as unknown as new (s: CombatState) => CombatEngine)(state);
      state.enemyAttackedSinceLastBleedTick = true;
      tickDoTs(engine);
      expect(state.enemyAttackedSinceLastBleedTick).toBe(false);
    } finally {
      clearRun();
    }
  });
});

describe('DoT mechanics — Poison (slow decay every 2nd tick)', () => {
  beforeAll(async () => { await loadAllData(); });

  it('damage curve for 4 stacks over 6 ticks is 4+4+3+3+2+2 = 18, then continues to drain', () => {
    const run = makeMockRun();
    setRun(run);
    try {
      const state = makeState({ poisonStacks: 4, enemyHP: 1000 });
      const engine = new (CombatEngine as unknown as new (s: CombatState) => CombatEngine)(state);
      const startHP = state.enemyHP;
      // Tick 1: dmg=4, parity 0->1, stacks stay at 4.
      tickDoTs(engine);
      expect(startHP - state.enemyHP).toBe(4);
      // Tick 2: dmg=4, parity 1->0, stacks 4->3.
      tickDoTs(engine);
      expect(startHP - state.enemyHP).toBe(8);
      expect(state.poisonStacks).toBe(3);
      // Tick 3: dmg=3, parity 0->1, stacks stay.
      tickDoTs(engine);
      expect(startHP - state.enemyHP).toBe(11);
      // Tick 4: dmg=3, parity 1->0, stacks 3->2.
      tickDoTs(engine);
      expect(startHP - state.enemyHP).toBe(14);
      expect(state.poisonStacks).toBe(2);
      // Tick 5: dmg=2, parity 0->1.
      tickDoTs(engine);
      expect(startHP - state.enemyHP).toBe(16);
      // Tick 6: dmg=2, parity 1->0, stacks 2->1.
      tickDoTs(engine);
      expect(startHP - state.enemyHP).toBe(18);
      expect(state.poisonStacks).toBe(1);
    } finally {
      clearRun();
    }
  });

  it('poison eventually clears after enough ticks', () => {
    const run = makeMockRun();
    setRun(run);
    try {
      const state = makeState({ poisonStacks: 4, enemyHP: 1000 });
      const engine = new (CombatEngine as unknown as new (s: CombatState) => CombatEngine)(state);
      // 4 stacks decay 1 every 2 ticks → 8 ticks to fully clear.
      for (let i = 0; i < 8; i++) tickDoTs(engine);
      expect(state.poisonStacks).toBe(0);
    } finally {
      clearRun();
    }
  });
});

describe('Status — Stun (renamed from Freeze) lockdown', () => {
  it('while stunStacks >= 1, enemy cooldown timer does NOT advance', () => {
    const state = makeState({ stunStacks: 3, enemyAttackCooldown: 2000, enemyBaseAttackCooldown: 2000 });
    const ai = new EnemyAI(state);
    const stats = createEmptyCombatStats('dummy', 'Dummy');

    // Cooldown timer starts at enemyAttackCooldown (2000). Tick 1000ms three
    // times — under stun, the timer must NOT decrement (so no attack).
    ai.tick(1000, state, stats);
    ai.tick(1000, state, stats);
    ai.tick(1000, state, stats);
    expect(stats.damageReceived).toBe(0);
    expect(ai.getCooldownTimer()).toBe(2000);
  });

  it('after stun decays to 0, enemy cooldown resumes normally', () => {
    const state = makeState({ stunStacks: 1, enemyAttackCooldown: 2000, enemyBaseAttackCooldown: 2000 });
    const ai = new EnemyAI(state);
    const stats = createEmptyCombatStats('dummy', 'Dummy');

    // While stunned: no advance.
    ai.tick(1500, state, stats);
    expect(ai.getCooldownTimer()).toBe(2000);
    // Manually decay stun (in real combat, CombatEngine.tickActiveDoTs does this).
    state.stunStacks = 0;
    // Now cooldown progresses.
    ai.tick(2000, state, stats);
    expect(stats.damageReceived).toBe(state.enemyDamage); // attack fired
  });
});
