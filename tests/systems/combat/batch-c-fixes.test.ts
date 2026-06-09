import { describe, it, expect, vi, beforeAll } from 'vitest';
import { CardResolver } from '../../../src/systems/combat/CardResolver';
import { CombatEngine } from '../../../src/systems/combat/CombatEngine';
import { applyTriggeredPayload, createAura } from '../../../src/systems/combat/StatusEffects';
import { type RunState, setRun, clearRun } from '../../../src/state/RunState';
import { loadAllData } from '../../../src/data/DataLoader';
import type { CombatState } from '../../../src/systems/combat/CombatState';
import type { CardDefinition, CardEffect } from '../../../src/data/types';

// Silence the EventBus for engine-level tests.
vi.mock('../../../src/core/EventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

// ── Full CombatState factory (mirrors createCombatState defaults) ──────────
function makeState(over: Partial<CombatState> = {}): CombatState {
  return {
    heroHP: 100, heroMaxHP: 100,
    heroStamina: 50, heroMaxStamina: 50,
    heroMana: 30, heroMaxMana: 30,
    heroDefense: 0,
    heroStrength: 1, heroDefenseMultiplier: 1,
    heroClass: 'warrior',
    deckOrder: [],
    enemyId: 'dummy', enemyName: 'Dummy', enemyType: 'normal',
    enemyHP: 10000, enemyMaxHP: 10000, enemyDefense: 0,
    enemyDamage: 5, enemyAttackCooldown: 2000, enemyBaseAttackCooldown: 2000,
    enemyPattern: 'fixed', enemySpecialEffect: null, enemyAffinity: null,
    activeRelicIds: [], activePassives: [],
    heroStunned: false, heroStunStacks: 0, stunImmuneUntilMs: 0,
    upgraded: [], behaviors: [],
    cooldownMultiplier: 1.0, firstCardDamageMultiplier: 1.0,
    firstCardCostsZero: false, firstNCardsStaminaDiscount: 0,
    firstAttackDamageBonus: 0, firstFireCardBurnBonus: 0,
    barrierActive: false, pendingGoldBonus: 0, relicCounters: {},
    nextArmorMultiplier: 1.0,
    _bloodPactBonus: 0, _sanguinePactStrBonus: 0, _sanguinePactIntBonus: 0,
    phoenixUsed: false,
    heroVitality: 0, heroDexterity: 0, heroIntellect: 0, heroSpirit: 0,
    poisonStacks: 0, bleedStacks: 0, burnStacks: 0,
    stunStacks: 0, slowStacks: 0, rageStacks: 0,
    subtileBurnApplyBonus: 0, subtileBleedTickBonus: 0, subtileSpellDamageMult: 1,
    combatElapsedMs: 0, lastHeroDamageMs: null,
    enemyAttackedSinceLastBleedTick: false, poisonTickParity: 0,
    nextCardCooldownReduction: 0,
    buffMagnitudePerCard: {},
    heroAuras: [], enemyAuras: [],
    heroBurnStacks: 0, heroBleedStacks: 0,
    spentThisCombat: new Set<string>(),
    cdDebtBySlot: {},
    echoCharges: 0, echoExpiresAt: 0, freeEchoCharges: 0,
    devouredSlots: new Set<number>(),
    statBoostsThisCombat: {},
    cardStatGainCounters: {},
    ...over,
  } as CombatState;
}

function makeCard(over: Partial<CardDefinition> & { effects: CardEffect[] }): CardDefinition {
  return {
    id: 'test-card', name: 'Test', description: '',
    category: 'attack', cooldown: 1.0, targeting: 'single', rarity: 'common',
    ...over,
  } as CardDefinition;
}

function makeMockRun(): RunState {
  return {
    version: 5, runId: 'batchc', seed: 'batchc', generation: 1, startedAt: 0,
    hero: {
      maxHP: 100, currentHP: 100, maxStamina: 50, currentStamina: 50,
      maxMana: 30, currentMana: 30, currentDefense: 0,
      strength: 1, defenseMultiplier: 1, moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
    },
    deck: { active: [], inventory: {}, upgraded: [], droppedCards: [] },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [], isInCombat: false, currentScene: 'Game',
    stopAtShop: true, combatSpeed: 1, mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
  } as unknown as RunState;
}

const resolver = new CardResolver();

// ── Fix 3: Shield Bash literal armor damage ────────────────────────────────
describe('Batch C — Shield Bash literal armor damage', () => {
  const shieldBash = makeCard({
    id: 't2-attack-defense', name: 'Shield Bash', category: 'attack',
    effects: [{
      type: 'damage', value: 0, target: 'enemy',
      literal_damage: true, pierce_armor: true,
      scale: { stat: 'vit', per: 1, value: 1, source: 'armor' },
    }],
  });

  it('deals exactly current armor — no STR, no banked Rage, no enemy-armor subtraction', () => {
    const state = makeState({ heroDefense: 20, heroStrength: 4, rageStacks: 10, enemyDefense: 8 });
    const r = resolver.resolve(shieldBash, state, null);
    expect(r.totalDamage).toBe(20); // literally your armor, not (20+10)*1.75 - 8
  });

  it('scales 1:1 with armor at any value', () => {
    const state = makeState({ heroDefense: 7, heroStrength: 10 });
    const r = resolver.resolve(shieldBash, state, null);
    expect(r.totalDamage).toBe(7);
  });
});

// ── Fix 2: self-gates read the pre-cast snapshot ───────────────────────────
describe('Batch C — self-satisfied gates read the pre-cast pool', () => {
  const steamingPlague = makeCard({
    id: 't3-air-fire-water', name: 'Steaming Plague', category: 'magic',
    targeting: 'aoe',
    effects: [
      { type: 'dot', value: 3, target: 'aoe', stack: 'poison', scale: { stat: 'int', per: 3, value: 1 } },
      { type: 'dot', value: 2, target: 'aoe', stack: 'poison', scale: { stat: 'int', per: 4, value: 1 },
        condition: { enemy_has_stack: 'poison', pre_consume: true } },
    ],
  });

  it('Steaming Plague applies only the base 3 on a clean target (bonus gate not self-satisfied)', () => {
    const state = makeState({ heroIntellect: 1, poisonStacks: 0 });
    resolver.resolve(steamingPlague, state, null);
    expect(state.poisonStacks).toBe(3);
  });

  it('Steaming Plague bonus fires only against PRE-EXISTING poison', () => {
    const state = makeState({ heroIntellect: 1, poisonStacks: 5 });
    resolver.resolve(steamingPlague, state, null);
    expect(state.poisonStacks).toBe(10); // 5 + 3 base + 2 conditional bonus
  });

  const veinSplitter = makeCard({
    id: 't3-agility-attack-counter', name: 'Vein Splitter', category: 'attack',
    effects: [
      { type: 'damage', value: 4, target: 'enemy', scale: { stat: 'dex', per: 3, value: 1 }, multi_hit: 2 },
      { type: 'dot', value: 1, target: 'enemy', stack: 'bleed', per_hit: true, scale: { stat: 'dex', per: 4, value: 1 } },
      { type: 'dot', value: 1, target: 'enemy', stack: 'bleed', per_hit: true, scale: { stat: 'dex', per: 4, value: 1 },
        condition: { enemy_has_stack: 'bleed', pre_consume: true } },
    ],
  });

  it('Vein Splitter applies only the base 3 bleed on a clean target', () => {
    const state = makeState({ heroDexterity: 1, bleedStacks: 0 });
    resolver.resolve(veinSplitter, state, null);
    expect(state.bleedStacks).toBe(3); // 3 unconditional, bonus gated out
  });

  it('Vein Splitter bonus per-hit bleed fires only against PRE-EXISTING bleed', () => {
    const state = makeState({ heroDexterity: 1, bleedStacks: 2 });
    resolver.resolve(veinSplitter, state, null);
    expect(state.bleedStacks).toBe(8); // 2 + 3 base + 3 bonus (1 per hit × 3)
  });

  it('does NOT change a genuine atleast gate (Slipvenom-style: live read still counts self-applied)', () => {
    // No pre_consume flag → gate reads LIVE, so applying 5 then gating on >=10
    // still requires 5 pre-existing (unchanged behavior).
    const slipvenomish = makeCard({
      id: 'slip', category: 'magic',
      effects: [
        { type: 'dot', value: 5, target: 'enemy', stack: 'poison' },
        { type: 'dot', value: 5, target: 'enemy', stack: 'poison',
          condition: { enemy_stack_atleast: { stack: 'poison', value: 10 } } },
      ],
    });
    const fresh = makeState({ poisonStacks: 0 });
    resolver.resolve(slipvenomish, fresh, null);
    expect(fresh.poisonStacks).toBe(5); // 0+5; gate (live 5 < 10) does not fire
    const primed = makeState({ poisonStacks: 5 });
    resolver.resolve(slipvenomish, primed, null);
    expect(primed.poisonStacks).toBe(15); // 5+5=10 live → gate fires → +5
  });
});

// ── Fix 4: Razor Stance Vengeance extends the aura ─────────────────────────
describe('Batch C — Razor Stance Vengeance extends (not duplicates) the bleed aura', () => {
  const razorStance = makeCard({
    id: 't2-counter-counter', name: 'Razor Stance', category: 'attack', targeting: 'self',
    effects: [
      { type: 'aura', value: 0, target: 'self', extend_aura: true, ttl_ms: 10000, trigger: 'on_hit_dealt',
        then: { type: 'dot', value: 1, target: 'enemy', stack: 'bleed', scale: { stat: 'dex', per: 3, value: 1 } } },
      { type: 'aura', value: 0, target: 'self', extend_aura: true, ttl_ms: 4000, trigger: 'on_hit_dealt',
        then: { type: 'dot', value: 1, target: 'enemy', stack: 'bleed', scale: { stat: 'dex', per: 3, value: 1 } },
        condition: { took_damage_within_ms: 2000 } },
    ],
  });

  it('with Vengeance armed: ONE aura extended to 14s (no second double-bleed aura)', () => {
    const state = makeState({ combatElapsedMs: 1000, lastHeroDamageMs: 0 });
    resolver.resolve(razorStance, state, null);
    expect(state.heroAuras).toHaveLength(1);
    expect(state.heroAuras[0].remainingMs).toBe(14000);
  });

  it('without Vengeance: just the 10s base aura', () => {
    const state = makeState({ combatElapsedMs: 1000, lastHeroDamageMs: null });
    resolver.resolve(razorStance, state, null);
    expect(state.heroAuras).toHaveLength(1);
    expect(state.heroAuras[0].remainingMs).toBe(10000);
  });

  it('a SECOND cast extends the same aura (no duplicate stacking bleed-on-hit auras)', () => {
    const state = makeState({ combatElapsedMs: 1000, lastHeroDamageMs: 0 });
    resolver.resolve(razorStance, state, null); // → 1 aura @ 14000
    resolver.resolve(razorStance, state, null); // base +10000, vengeance +4000
    expect(state.heroAuras).toHaveLength(1);
    expect(state.heroAuras[0].remainingMs).toBe(28000);
  });

  it('extend_aura never merges across different source cards', () => {
    const state = makeState({ combatElapsedMs: 1000, lastHeroDamageMs: 0 });
    resolver.resolve(razorStance, state, null); // Razor Stance aura
    // A different card with a byte-identical on_hit_dealt bleed aura body.
    const lookalike = makeCard({
      id: 'other-card', category: 'attack', targeting: 'self',
      effects: [{ type: 'aura', value: 0, target: 'self', extend_aura: true, ttl_ms: 6000, trigger: 'on_hit_dealt',
        then: { type: 'dot', value: 1, target: 'enemy', stack: 'bleed', scale: { stat: 'dex', per: 3, value: 1 } } }],
    });
    resolver.resolve(lookalike, state, null);
    expect(state.heroAuras).toHaveLength(2); // distinct source cards → not merged
  });
});

// ── Fix 5: Marsh Squall — burst pays on the same pool the strip removes ─────
describe('Batch C — Marsh Squall snapshot/removal consistency', () => {
  const marshSquall = makeCard({
    id: 't3-air-earth-water', name: 'Marsh Squall', category: 'magic', targeting: 'aoe', exhaust: true,
    effects: [
      { type: 'damage', value: 6, target: 'aoe', pierce_armor: true, consume_stack_value: 'poison', consume_fraction: 0.5 },
      { type: 'stack', value: -999, target: 'enemy', stack: 'poison', consume_stack: true, consume_fraction: 0.5 },
      { type: 'dot', value: 2, target: 'enemy', stack: 'poison', scale: { stat: 'int', per: 3, value: 1 } },
    ],
  });

  it('burst counts exactly the stacks it strips (no over-strip from self-applied poison)', () => {
    const state = makeState({ heroIntellect: 1, poisonStacks: 10 });
    const r = resolver.resolve(marshSquall, state, null);
    // pre-cast pool 10 → strip ceil(10*0.5)=5 (paid: 6×5=30) → then +2 ramp.
    expect(r.totalDamage).toBe(30);
    expect(state.poisonStacks).toBe(7); // 10 - 5 stripped + 2 applied
  });
});

// ── Fix 6/2 (StatusEffects): triggered heal SPI + triggered rage multiplier ─
describe('Batch C — triggered payloads honor SPI heal mult and rage gain mult', () => {
  it('aura/triggered heal gets the +15%/pt SPI multiplier (parity with direct heal)', () => {
    const state = makeState({ heroHP: 50, heroSpirit: 10 });
    applyTriggeredPayload(state, { type: 'heal', value: 8, target: 'self' });
    expect(state.heroHP).toBe(70); // 8 + floor(8 * 10*0.15)=12 = 20
  });

  it('rage gained via a trigger is doubled by Vengeful Pyre stack_gain_mult', () => {
    const aura = createAura({ type: 'aura', value: 0, target: 'self', ttl_ms: 9999999,
      modifier: { kind: 'stack_gain_mult', stack: 'rage', value: 1 } });
    const state = makeState({ rageStacks: 0, heroAuras: [aura] });
    applyTriggeredPayload(state, { type: 'stack', value: 3, stack: 'rage', target: 'self' });
    expect(state.rageStacks).toBe(6); // 3 × (1 + 1)
  });

  it('rage from a trigger is unchanged without the multiplier aura', () => {
    const state = makeState({ rageStacks: 0 });
    applyTriggeredPayload(state, { type: 'stack', value: 3, stack: 'rage', target: 'self' });
    expect(state.rageStacks).toBe(3);
  });

  it('stun applied via a trigger respects the stun immunity window', () => {
    const blocked = makeState({ stunStacks: 0, combatElapsedMs: 1000, stunImmuneUntilMs: 5000 });
    applyTriggeredPayload(blocked, { type: 'dot', value: 2, stack: 'stun', target: 'enemy' });
    expect(blocked.stunStacks).toBe(0); // inside immunity window → blocked

    const allowed = makeState({ stunStacks: 0, combatElapsedMs: 6000, stunImmuneUntilMs: 5000 });
    applyTriggeredPayload(allowed, { type: 'dot', value: 2, stack: 'stun', target: 'enemy' });
    expect(allowed.stunStacks).toBe(2); // window elapsed → applied
  });
});

// ── Fix 1: Vengeful Pyre exhaust_next ──────────────────────────────────────
describe('Batch C — Vengeful Pyre exhaust_next', () => {
  beforeAll(async () => { await loadAllData(); });

  const vengefulPyre = makeCard({
    id: 't3-counter-counter-fire', name: 'Vengeful Pyre', category: 'defense', targeting: 'self', exhaust: true,
    effects: [
      { type: 'stack', stack: 'rage', value: 3, target: 'self' },
      { type: 'devour', value: 1, target: 'self_deck', devour: { exhaust_next: true } },
      { type: 'aura', value: 0, target: 'self', ttl_ms: 9999999, modifier: { kind: 'stack_gain_mult', stack: 'rage', value: 1 } },
    ],
  });

  it('surfaces exhaustNext on the resolve result and still grants its rage', () => {
    const state = makeState({ rageStacks: 0 });
    const r = resolver.resolve(vengefulPyre, state, null);
    expect(r.exhaustNext).toBe(true);
    expect(state.rageStacks).toBe(3);
  });

  it('CombatEngine marks the next play-order slot devoured', () => {
    const run = makeMockRun(); setRun(run);
    try {
      const state = makeState({ deckOrder: ['a', 'b', 'c'] });
      const engine = new (CombatEngine as unknown as new (s: CombatState) => CombatEngine)(state);
      (engine as unknown as { deckPointer: number }).deckPointer = 0;
      (engine as unknown as { markNextSlotExhausted: () => void }).markNextSlotExhausted();
      expect(state.devouredSlots.has(1)).toBe(true);
      // A second exhaust skips the already-devoured slot.
      (engine as unknown as { markNextSlotExhausted: () => void }).markNextSlotExhausted();
      expect(state.devouredSlots.has(2)).toBe(true);
    } finally { clearRun(); }
  });
});

// ── Fix 7: Dust Plague — tick-applied slow crosses the stun threshold ───────
describe('Batch C — slow applied via aura tick crosses on_enemy_stack_threshold', () => {
  beforeAll(async () => { await loadAllData(); });

  it('a periodic slow tick that reaches the threshold arms the stun payload', () => {
    const run = makeMockRun(); setRun(run);
    try {
      const slowTickAura = createAura({
        type: 'aura', value: 0, target: 'self', ttl_ms: 12000, tick_ms: 2500,
        then: { type: 'dot', value: 5, target: 'aoe', stack: 'slow' },
      });
      const thresholdAura = createAura({
        type: 'aura', value: 0, target: 'self', ttl_ms: 12000,
        trigger: 'on_enemy_stack_threshold', threshold_stack: 'slow', threshold: 5,
        then: { type: 'dot', value: 1, target: 'enemy', stack: 'stun' },
      });
      const state = makeState({ slowStacks: 0, stunStacks: 0, heroAuras: [slowTickAura, thresholdAura] });
      const engine = new (CombatEngine as unknown as new (s: CombatState) => CombatEngine)(state);
      (engine as unknown as { tick: (ms: number) => void }).tick(2500);
      expect(state.slowStacks).toBeGreaterThanOrEqual(5);
      expect(state.stunStacks).toBe(1); // threshold fired from the tick-applied slow
    } finally { clearRun(); }
  });
});
