// Coverage for the relic audit repairs (2026-06-11). These tests deliberately
// exercise the REAL runtime paths (createCombatState seeding, CombatEngine's
// tickActiveDoTs, applyHeroDamage, CardResolver.resolve, the relic dispatchers)
// rather than calling effect handlers in isolation — the audit found that
// handler-only tests gave false positives for relics that never actually fired.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCombatState, type CombatState } from '../../../src/systems/combat/CombatState';
import { CombatEngine } from '../../../src/systems/combat/CombatEngine';
import {
  resolveCardPlayedRelicBonus,
  applyDamageTakenRelics,
} from '../../../src/systems/combat/RelicSystem';
import { applyHeroDamage } from '../../../src/systems/combat/EnemyAI';
import { CardResolver } from '../../../src/systems/combat/CardResolver';
import { setRun, clearRun, type RunState } from '../../../src/state/RunState';
import type { CardDefinition, EnemyDefinition } from '../../../src/data/types';

function makeRun(relicIds: string[] = [], over: Partial<RunState['hero']> = {}, deck: string[] = ['t2-attack-attack']): RunState {
  return {
    version: 6, runId: 'r', seed: 's', generation: 1, startedAt: 1,
    hero: {
      maxHP: 100, currentHP: 100, maxStamina: 20, currentStamina: 20,
      maxMana: 30, currentMana: 30, currentDefense: 0, strength: 1,
      defenseMultiplier: 1, moveSpeed: 2, runXP: 0, totalXP: 0, className: 'warrior',
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {}, ...over,
    },
    deck: { active: deck, inventory: {}, upgraded: deck.map(() => false), droppedCards: [] },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: relicIds,
    relicRunState: { phoenixUsedThisRun: false, huntmasterKills: 0, veteranKills: 0 },
    isInCombat: false, currentScene: 'Game', stopAtShop: true, combatSpeed: 1, mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
  };
}

function makeEnemy(over: Partial<EnemyDefinition> = {}): EnemyDefinition {
  return {
    id: 'd', name: 'D', type: 'normal', baseHP: 200, baseDefense: 0,
    attack: { damage: 5, pattern: 'fixed' }, attackCooldown: 5000,
    goldReward: { min: 1, max: 1 }, color: 0x00ff00, ...over,
  };
}

// A full CombatState literal for the CardResolver/applyHeroDamage unit paths.
function makeState(over: Partial<CombatState> = {}): CombatState {
  return {
    heroHP: 100, heroMaxHP: 100, heroStamina: 20, heroMaxStamina: 20,
    heroMana: 30, heroMaxMana: 30, heroDefense: 0, heroStrength: 1,
    heroDefenseMultiplier: 1, heroClass: 'warrior', deckOrder: [],
    enemyId: 'd', enemyName: 'D', enemyType: 'normal', enemyHP: 200, enemyMaxHP: 200,
    enemyDefense: 0, enemyDamage: 5, enemyAttackCooldown: 5000, enemyBaseAttackCooldown: 5000,
    enemyPattern: 'fixed', enemySpecialEffect: null, enemyAffinity: null,
    activeRelicIds: [], activePassives: [], heroStunned: false, heroStunStacks: 0,
    stunImmuneUntilMs: 0, stunPierceUntilMs: 0, bonusOpeningCards: 0, upgraded: [], behaviors: [],
    cooldownMultiplier: 1, firstCardDamageMultiplier: 1, firstCardCostsZero: false,
    firstNCardsStaminaDiscount: 0, firstAttackDamageBonus: 0, firstFireCardBurnBonus: 0,
    barrierActive: false, pendingGoldBonus: 0, relicCounters: {}, nextArmorMultiplier: 1,
    _bloodPactBonus: 0, _sanguinePactStrBonus: 0, _sanguinePactIntBonus: 0, phoenixUsed: false,
    bannerUsed: false, heroVitality: 0, heroDexterity: 0, heroIntellect: 0, heroSpirit: 0,
    poisonStacks: 0, bleedStacks: 0, burnStacks: 0, stunStacks: 0, slowStacks: 0, rageStacks: 0,
    subtileBurnApplyBonus: 0, subtileBleedTickBonus: 0, subtileSpellDamageMult: 1,
    combatElapsedMs: 0, lastHeroDamageMs: null, enemyAttackedSinceLastBleedTick: false,
    bleedAppliedSinceLastTick: false, poisonTickParity: 0, nextCardCooldownReduction: 0,
    buffMagnitudePerCard: {}, heroAuras: [], enemyAuras: [], heroBurnStacks: 0, heroBleedStacks: 0,
    spentThisCombat: new Set(), cdDebtBySlot: {}, echoCharges: 0, echoExpiresAt: 0,
    freeEchoCharges: 0, devouredSlots: new Set(), statBoostsThisCombat: {}, cardStatGainCounters: {},
    ...over,
  } as CombatState;
}

function makeCard(over: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id: 'c', name: 'C', description: '', category: 'attack',
    effects: [{ type: 'damage', value: 10, target: 'enemy' }],
    cooldown: 1.2, targeting: 'single', rarity: 'common', ...over,
  } as CardDefinition;
}

const resolver = new CardResolver();

afterEach(() => clearRun());

// ── Bug #1: self-DoT dot_tick gate (the systemic fix) ────────────────────────
describe('Bug #1 — self-DoT dot_tick dispatch (via tickActiveDoTs)', () => {
  function tick(relics: string[], over: Partial<CombatState>): CombatState {
    const run = makeRun(relics);
    setRun(run);
    const state = createCombatState(run, makeEnemy());
    Object.assign(state, over);
    const engine = new CombatEngine(state);
    (engine as unknown as { tickActiveDoTs(id: string): void }).tickActiveDoTs('');
    return state;
  }

  it('bloodgorged_heart heals +1 and grants +1 Rage on a PURE self-burn tick', () => {
    const state = tick(['bloodgorged_heart'], { heroHP: 50, heroBurnStacks: 5, rageStacks: 0, enemyHP: 200 });
    expect(state.rageStacks).toBe(1);            // proof the dispatch fired
    // heal +1 (capped) then self-burn -5 → 50 +1 -5 = 46
    expect(state.heroHP).toBe(46);
  });

  it('does NOT fire bloodgorged_heart when there is no self-DoT', () => {
    const state = tick(['bloodgorged_heart'], { heroHP: 50, heroBurnStacks: 0, rageStacks: 0 });
    expect(state.rageStacks).toBe(0);
  });

  it('linen_wrap reduces self-DoT tick damage by 1 (net)', () => {
    const withRelic = tick(['linen_wrap'], { heroHP: 50, heroBurnStacks: 3 });
    const without = tick([], { heroHP: 50, heroBurnStacks: 3 });
    expect(without.heroHP).toBe(47);    // 50 - 3
    expect(withRelic.heroHP).toBe(48);  // 50 + 1 heal - 3 burn
  });

  it('sanguine_pact deals 2 enemy damage per self-DoT tick', () => {
    const state = tick(['sanguine_pact'], { heroHP: 50, heroBleedStacks: 2, enemyHP: 200 });
    expect(state.enemyHP).toBe(198);
  });
});

// ── Bug #3: combat-start resource grants ─────────────────────────────────────
describe('Bug #3 — combat-start current-resource grants', () => {
  it('stamina_flask grants +2 Stamina at combat start (plus +4 Max)', () => {
    const run = makeRun(['stamina_flask'], { currentStamina: 5, maxStamina: 20 });
    const state = createCombatState(run, makeEnemy());
    // 50%-deficit recovery from 5→ (5 + floor((24-5)*0.5)=9)=14, then +2 = 16.
    expect(state.heroMaxStamina).toBe(24);
    expect(state.heroStamina).toBe(16);
  });

  it('aether_lens grants +3 Mana at combat start (plus +8 Max)', () => {
    const run = makeRun(['aether_lens'], { currentMana: 10, maxMana: 30 });
    const state = createCombatState(run, makeEnemy());
    expect(state.heroMaxMana).toBe(38);
    // recovery 10 + floor((38-10)*0.5)=14 → 24, then +3 = 27
    expect(state.heroMana).toBe(27);
  });
});

// ── thin_deck_charm condition fix + opening draw ─────────────────────────────
describe('thin_deck_charm', () => {
  it('applies +35% card damage when deck size <= 7 (condition bug fixed)', () => {
    const state = makeState({ deckOrder: ['a', 'b', 'c', 'd', 'e'], activeRelicIds: ['thin_deck_charm'] });
    const r = resolveCardPlayedRelicBonus(['thin_deck_charm'], makeCard(), state);
    expect(r.damageMultiplier).toBeCloseTo(1.35);
  });

  it('does NOT apply when deck size > 7', () => {
    const state = makeState({ deckOrder: new Array(8).fill('x'), activeRelicIds: ['thin_deck_charm'] });
    const r = resolveCardPlayedRelicBonus(['thin_deck_charm'], makeCard(), state);
    expect(r.damageMultiplier).toBeCloseTo(1.0);
  });

  it('grants +1 opening card at combat start when deck qualifies', () => {
    const run = makeRun(['thin_deck_charm'], {}, ['a', 'b', 'c']);
    const state = createCombatState(run, makeEnemy());
    expect(state.bonusOpeningCards).toBe(1);
  });
});

// ── harmonics_charm: every-5th refund ────────────────────────────────────────
describe('harmonics_charm', () => {
  it('refunds 1 Stamina AND 1 Mana on every 5th card', () => {
    const state = makeState({ heroStamina: 5, heroMana: 5, activeRelicIds: ['harmonics_charm'] });
    for (let i = 0; i < 4; i++) resolveCardPlayedRelicBonus(['harmonics_charm'], makeCard(), state);
    expect(state.heroStamina).toBe(5);
    resolveCardPlayedRelicBonus(['harmonics_charm'], makeCard(), state); // 5th
    expect(state.heroStamina).toBe(6);
    expect(state.heroMana).toBe(6);
  });
});

// ── wargods_mantle: defense cost 0 + Fortified ───────────────────────────────
describe('wargods_mantle', () => {
  it('makes defense cards cost 0 Stamina', () => {
    const state = makeState({ heroStamina: 0, activeRelicIds: ['wargods_mantle'] });
    const def = makeCard({ category: 'defense', cost: { stamina: 3 }, effects: [{ type: 'armor', value: 5, target: 'self' }] });
    expect(resolver.canAfford(def, state)).toBe(true);
    resolver.resolve(def, state, null);
    expect(state.heroStamina).toBe(0); // nothing paid
  });

  it('Fortified: takes 25% less damage while Armor >= 10', () => {
    const state = makeState({ heroDefense: 10, activeRelicIds: ['wargods_mantle'] });
    applyHeroDamage(40, state); // 40*0.75=30 dealt; armor 10 blocks 10 → 20 HP loss
    expect(state.heroHP).toBe(80);
  });
});

// ── steady_compass: first-3s cost reduction ──────────────────────────────────
describe('steady_compass', () => {
  it('halves cost in the first 3s, full cost after', () => {
    const card = makeCard({ cost: { stamina: 4 } });
    const early = makeState({ heroStamina: 2, combatElapsedMs: 0, activeRelicIds: ['steady_compass'] });
    expect(resolver.canAfford(card, early)).toBe(true); // ceil(4*0.5)=2 affordable
    const late = makeState({ heroStamina: 2, combatElapsedMs: 4000, activeRelicIds: ['steady_compass'] });
    expect(resolver.canAfford(card, late)).toBe(false);
  });
});

// ── tideheart_amulet ─────────────────────────────────────────────────────────
describe('tideheart_amulet', () => {
  it('combat start: +1 Max Mana per 10% Max HP missing', () => {
    const run = makeRun(['tideheart_amulet'], { currentHP: 50, maxHP: 100, maxMana: 30 });
    const state = createCombatState(run, makeEnemy());
    expect(state.heroMaxMana).toBe(35); // 50% missing → +5
  });

  it('on heal: +2 Max Mana (cap +12) and applies 2 Slow', () => {
    const state = makeState({ heroHP: 50, heroMaxMana: 30, activeRelicIds: ['tideheart_amulet'] });
    resolver.resolve(makeCard({ effects: [{ type: 'heal', value: 10, target: 'self' }] }), state, null);
    expect(state.heroMaxMana).toBe(32);
    expect(state.slowStacks).toBe(2);
  });
});

// ── veterans_stripe / huntmasters_eye: run-level STR ─────────────────────────
describe('kill-STR relics persist across the run', () => {
  it('seeds STR from run-level kill counters at combat start (capped)', () => {
    const run = makeRun(['huntmasters_eye', 'veterans_stripe']);
    run.relicRunState = { huntmasterKills: 4, veteranKills: 9 }; // veteran over cap
    const state = createCombatState(run, makeEnemy());
    // base str 1 + huntmaster 4 + veteran min(5,9)=5 = 10
    expect(state.heroStrength).toBe(10);
  });
});

// ── phoenix_feather: once-per-run + Empower ──────────────────────────────────
describe('phoenix_feather', () => {
  it('revives at 60% HP and grants Empower 100% for 8s', () => {
    const state = makeState({ heroHP: 0, heroMaxHP: 100, phoenixUsed: false });
    const prevented = applyDamageTakenRelics(['phoenix_feather'], { actualDamage: 50, armorPrevented: 0, armorJustBroke: false, rawDamage: 50 }, state);
    expect(prevented).toBe(true);
    expect(state.heroHP).toBe(60);
    expect(state.heroAuras.some(a => a.modifier?.kind === 'damage_dealt_pct' && a.modifier.value === 1.0)).toBe(true);
  });

  it('does not revive again once used this run (phoenixUsed seeded true)', () => {
    const state = makeState({ heroHP: 0, phoenixUsed: true });
    const prevented = applyDamageTakenRelics(['phoenix_feather'], { actualDamage: 50, armorPrevented: 0, armorJustBroke: false, rawDamage: 50 }, state);
    expect(prevented).toBe(false);
    expect(state.heroHP).toBe(0);
  });

  it('phoenixUsed is seeded from the run-level flag', () => {
    const run = makeRun(['phoenix_feather']);
    run.relicRunState = { phoenixUsedThisRun: true };
    const state = createCombatState(run, makeEnemy());
    expect(state.phoenixUsed).toBe(true);
  });
});

// ── the_last_banner: survive-at-1HP + Empower (combat_start trigger) ──────────
describe('the_last_banner', () => {
  it('survives at 1 HP and grants Empower 50% for 6s', () => {
    const state = makeState({ heroHP: 0, bannerUsed: false, activeRelicIds: ['the_last_banner'] });
    const prevented = applyDamageTakenRelics(['the_last_banner'], { actualDamage: 99, armorPrevented: 0, armorJustBroke: false, rawDamage: 99 }, state);
    expect(prevented).toBe(true);
    expect(state.heroHP).toBe(1);
    expect(state.heroAuras.some(a => a.modifier?.kind === 'damage_dealt_pct' && a.modifier.value === 0.5)).toBe(true);
  });
});

// ── cinderkeep / cinder_circlet burn-tick amplifiers ─────────────────────────
describe('burn-tick amplifier relics (via tickActiveDoTs)', () => {
  function burnTickDamage(relics: string[], over: Partial<CombatState>): number {
    const run = makeRun(relics);
    setRun(run);
    const state = createCombatState(run, makeEnemy());
    Object.assign(state, over);
    const before = state.enemyHP;
    const engine = new CombatEngine(state);
    (engine as unknown as { tickActiveDoTs(id: string): void }).tickActiveDoTs('');
    return before - state.enemyHP;
  }

  it('cinderkeep adds ceil(Burn/4) (min 2) on top of base — no longer a no-op', () => {
    expect(burnTickDamage([], { burnStacks: 8 })).toBe(8);              // base only
    expect(burnTickDamage(['cinderkeep'], { burnStacks: 8 })).toBe(10); // base 8 + max(2, ceil(8/4)=2)
  });

  it('cinder_circlet adds +1 burn-tick damage per 3 INT', () => {
    const dmg = burnTickDamage(['cinder_circlet'], { burnStacks: 4, heroIntellect: 6 });
    expect(dmg).toBe(6); // base 4 + floor(6/3)=2
  });
});

// ── crimson_stiletto: no decay on the application tick ───────────────────────
describe('crimson_stiletto', () => {
  it('skips bleed decay on a tick where bleed was freshly applied', () => {
    const run = makeRun(['crimson_stiletto']);
    setRun(run);
    const state = createCombatState(run, makeEnemy());
    state.bleedStacks = 5;
    state.bleedAppliedSinceLastTick = true;
    const engine = new CombatEngine(state);
    const tickFn = (engine as unknown as { tickActiveDoTs(id: string): void }).tickActiveDoTs.bind(engine);
    tickFn(''); // fresh-application tick → no decay
    expect(state.bleedStacks).toBe(5);
    tickFn(''); // flag now cleared → normal -1 decay
    expect(state.bleedStacks).toBe(4);
  });
});

// ── stormglass_lens: strips stun-immunity for 2s ─────────────────────────────
describe('stormglass_lens', () => {
  it('applying 3+ Slow strips the stun-immunity window', () => {
    const state = makeState({ combatElapsedMs: 1000, stunImmuneUntilMs: 5000, activeRelicIds: ['stormglass_lens'] });
    resolver.resolve(makeCard({ effects: [{ type: 'dot', stack: 'slow', value: 3, target: 'enemy' }] }), state, null);
    expect(state.stunStacks).toBe(1);            // the bonus stun lands
    expect(state.stunImmuneUntilMs).toBe(0);     // immunity stripped
    expect(state.stunPierceUntilMs).toBe(3000);  // pierce window = now + 2s
  });
});

// ── banded_greaves: fires on multi-hit attacks (context gap fix) ─────────────
describe('banded_greaves multi-hit', () => {
  it('grants armor-from-prevented and +1 Rage on a multi-hit boss attack', async () => {
    const { EnemyAI } = await import('../../../src/systems/combat/EnemyAI');
    const { createEmptyCombatStats } = await import('../../../src/systems/combat/CombatStats');
    const run = makeRun(['banded_greaves']);
    setRun(run);
    const state = createCombatState(run, makeEnemy());
    state.heroDefense = 40;
    state.behaviors = [{ type: 'multi_hit', hitCount: 3, damageMultiplier: 1 } as never];
    const ai = new EnemyAI(state);
    const stats = createEmptyCombatStats('normal', 'D');
    ai.tick(state.enemyAttackCooldown + 10, state, stats);
    // banded_greaves: +1 Rage on any hit + armor from damage prevented (cap 12).
    expect(state.rageStacks).toBeGreaterThanOrEqual(1);
    expect(state.relicCounters['banded_greaves_armorGained'] ?? 0).toBeGreaterThan(0);
  });
});
