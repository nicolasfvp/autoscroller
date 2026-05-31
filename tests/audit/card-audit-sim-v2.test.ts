// Deep card audit simulator (v2). Loads every card, runs each through
// CardResolver across an expanded scenario battery, captures more deltas
// (stat boosts, event-counter aura state, multi-play sequences), and
// writes tests/audit/sim-report-v2.json.
//
// Run: npx vitest run tests/audit/card-audit-sim-v2.test.ts

import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { CardResolver } from '../../src/systems/combat/CardResolver';
import { applyHeroDamage } from '../../src/systems/combat/EnemyAI';
import type { CombatState } from '../../src/systems/combat/CombatState';
import type { CardDefinition } from '../../src/data/types';
import cardsJson from '../../src/data/json/cards.json';

function makeState(overrides: Partial<CombatState> = {}): CombatState {
  return {
    heroHP: 100, heroMaxHP: 100,
    heroStamina: 50, heroMaxStamina: 50,
    heroMana: 30, heroMaxMana: 30,
    heroDefense: 0,
    heroStrength: 1, heroDefenseMultiplier: 1,
    heroClass: 'warrior',
    deckOrder: [],
    enemyId: 'dummy', enemyName: 'Dummy',
    enemyType: 'normal',
    enemyHP: 1000, enemyMaxHP: 1000,
    enemyDefense: 0, enemyDamage: 8,
    enemyAttackCooldown: 2500,
    enemyBaseAttackCooldown: 2500,
    enemyPattern: 'fixed',
    firstCardCostsZero: false,
    firstNCardsStaminaDiscount: 0,
    firstAttackDamageBonus: 0,
    firstFireCardBurnBonus: 0,
    barrierActive: false,
    pendingGoldBonus: 0,
    relicCounters: {},
    nextArmorMultiplier: 1.0,
    enemySpecialEffect: null,
    enemyAffinity: null,
    activePassives: [],
    heroStunned: false,
    upgraded: [],
    activeRelicIds: [],
    behaviors: [],
    cooldownMultiplier: 1.0,
    firstCardDamageMultiplier: 1.0,
    _bloodPactBonus: 0,
    _sanguinePactStrBonus: 0,
    _sanguinePactIntBonus: 0,
    phoenixUsed: false,
    heroVitality: 0, heroDexterity: 0, heroIntellect: 0, heroSpirit: 0,
    poisonStacks: 0, bleedStacks: 0, burnStacks: 0,
    stunStacks: 0, slowStacks: 0, rageStacks: 0,
    subtileBurnApplyBonus: 0,
    subtileBleedTickBonus: 0,
    subtileSpellDamageMult: 1,
    combatElapsedMs: 0,
    lastHeroDamageMs: null,
    enemyAttackedSinceLastBleedTick: false,
    poisonTickParity: 0,
    nextCardCooldownReduction: 0,
    buffMagnitudePerCard: {},
    heroAuras: [],
    enemyAuras: [],
    heroBurnStacks: 0,
    heroBleedStacks: 0,
    spentThisCombat: new Set<string>(),
    cdDebtBySlot: {},
    echoCharges: 0,
    echoExpiresAt: 0,
    freeEchoCharges: 0,
    devouredSlots: new Set<number>(),
    statBoostsThisCombat: {},
    cardStatGainCounters: {},
    ...overrides,
  } as CombatState;
}

interface Snapshot {
  enemyHP: number;
  heroHP: number;
  heroDefense: number;
  heroStamina: number;
  heroMana: number;
  poison: number;
  bleed: number;
  burn: number;
  stun: number;
  slow: number;
  rage: number;
  heroBleed: number;
  heroBurn: number;
  heroStunned: boolean;
  heroAuras: number;
  enemyAuras: number;
  // v2 additions:
  eventCounterAuras: number;
  statGainStr: number;
  statGainVit: number;
  statGainDex: number;
  statGainInt: number;
  statGainSpi: number;
}

function snap(s: CombatState): Snapshot {
  const eventCounters = (s.heroAuras ?? []).filter((a: any) => a.eventKind).length;
  const sb = s.statBoostsThisCombat ?? {};
  return {
    enemyHP: s.enemyHP,
    heroHP: s.heroHP,
    heroDefense: s.heroDefense,
    heroStamina: s.heroStamina,
    heroMana: s.heroMana,
    poison: s.poisonStacks,
    bleed: s.bleedStacks,
    burn: s.burnStacks,
    stun: s.stunStacks,
    slow: s.slowStacks,
    rage: s.rageStacks,
    heroBleed: s.heroBleedStacks,
    heroBurn: s.heroBurnStacks,
    heroStunned: !!s.heroStunned,
    heroAuras: (s.heroAuras ?? []).length,
    enemyAuras: (s.enemyAuras ?? []).length,
    eventCounterAuras: eventCounters,
    statGainStr: sb.str ?? 0,
    statGainVit: sb.vit ?? 0,
    statGainDex: sb.dex ?? 0,
    statGainInt: sb.int ?? 0,
    statGainSpi: sb.spi ?? 0,
  };
}

interface Delta {
  damageDealt: number;
  selfDamage: number;
  armorGained: number;
  staminaSpent: number;
  manaSpent: number;
  enemyPoison: number;
  enemyBleed: number;
  enemyBurn: number;
  enemyStun: number;
  enemySlow: number;
  heroRage: number;
  heroBleed: number;
  heroBurn: number;
  heroStunnedSet: boolean;
  heroAurasAdded: number;
  enemyAurasAdded: number;
  eventCounterAurasAdded: number;
  statGainStr: number;
  statGainVit: number;
  statGainDex: number;
  statGainInt: number;
  statGainSpi: number;
  resultTotalDamage: number;
  resultHealed: number;
  resultArmorGained: number;
}

function diff(before: Snapshot, after: Snapshot, result: any): Delta {
  return {
    damageDealt: before.enemyHP - after.enemyHP,
    selfDamage: before.heroHP - after.heroHP,
    armorGained: after.heroDefense - before.heroDefense,
    staminaSpent: before.heroStamina - after.heroStamina,
    manaSpent: before.heroMana - after.heroMana,
    enemyPoison: after.poison - before.poison,
    enemyBleed: after.bleed - before.bleed,
    enemyBurn: after.burn - before.burn,
    enemyStun: after.stun - before.stun,
    enemySlow: after.slow - before.slow,
    heroRage: after.rage - before.rage,
    heroBleed: after.heroBleed - before.heroBleed,
    heroBurn: after.heroBurn - before.heroBurn,
    heroStunnedSet: !before.heroStunned && after.heroStunned,
    heroAurasAdded: after.heroAuras - before.heroAuras,
    enemyAurasAdded: after.enemyAuras - before.enemyAuras,
    eventCounterAurasAdded: after.eventCounterAuras - before.eventCounterAuras,
    statGainStr: after.statGainStr - before.statGainStr,
    statGainVit: after.statGainVit - before.statGainVit,
    statGainDex: after.statGainDex - before.statGainDex,
    statGainInt: after.statGainInt - before.statGainInt,
    statGainSpi: after.statGainSpi - before.statGainSpi,
    resultTotalDamage: result?.totalDamage ?? 0,
    resultHealed: result?.healed ?? 0,
    resultArmorGained: result?.armorGained ?? 0,
  };
}

const SCENARIOS: { name: string; overrides: Partial<CombatState> }[] = [
  // -- Core stat axes --
  { name: 'baseline', overrides: {} },
  { name: 'str_10', overrides: { heroStrength: 10 } },
  { name: 'dex_10', overrides: { heroDexterity: 10 } },
  { name: 'int_10', overrides: { heroIntellect: 10 } },
  { name: 'spi_10', overrides: { heroSpirit: 10 } },
  { name: 'vit_10', overrides: { heroVitality: 10 } },
  // -- Stat combos --
  { name: 'str10_dex10', overrides: { heroStrength: 10, heroDexterity: 10 } },
  { name: 'int10_spi10', overrides: { heroIntellect: 10, heroSpirit: 10 } },
  { name: 'all_stats_5', overrides: { heroStrength: 5, heroDexterity: 5, heroIntellect: 5, heroSpirit: 5, heroVitality: 5 } },
  // -- Enemy status preloads --
  { name: 'enemy_bleed_5', overrides: { bleedStacks: 5 } },
  { name: 'enemy_burn_5', overrides: { burnStacks: 5 } },
  { name: 'enemy_poison_5', overrides: { poisonStacks: 5 } },
  { name: 'enemy_slow_5', overrides: { slowStacks: 5 } },
  { name: 'enemy_stunned', overrides: { stunStacks: 3 } },
  { name: 'enemy_burn_10_int10', overrides: { burnStacks: 10, heroIntellect: 10 } },
  // -- Hero status preloads --
  { name: 'hero_rage_5', overrides: { rageStacks: 5 } },
  { name: 'hero_rage_15', overrides: { rageStacks: 15 } },
  { name: 'hero_low_hp', overrides: { heroHP: 25, heroMaxHP: 100 } },
  { name: 'hero_armored', overrides: { heroDefense: 30 } },
  { name: 'hero_armored_low_hp', overrides: { heroDefense: 30, heroHP: 25, heroMaxHP: 100 } },
  { name: 'hero_full_stacks', overrides: { rageStacks: 5, heroBleedStacks: 5, heroBurnStacks: 5 } },
  { name: 'enemy_armored', overrides: { enemyDefense: 20 } },
  // -- Combat-time / Vengeance window --
  { name: 'vengeance_active', overrides: { combatElapsedMs: 5000, lastHeroDamageMs: 4500 } },
  { name: 'mid_combat_str_dex', overrides: { combatElapsedMs: 10000, lastHeroDamageMs: null, heroStrength: 5, heroDexterity: 5 } },
];

describe('card audit simulation v2', () => {
  it('runs every card in every scenario and writes a deeper JSON report', () => {
    const resolver = new CardResolver();
    const cards: CardDefinition[] = (cardsJson as any).cards;

    const report: any[] = [];

    for (const card of cards) {
      const entry: any = {
        id: card.id,
        name: card.name,
        tier: card.tier ?? null,
        elements: (card as any).elements ?? [],
        category: card.category,
        description: card.description,
        cost: card.cost ?? null,
        cooldown: card.cooldown,
        targeting: card.targeting,
        rarity: card.rarity,
        exhaust: (card as any).exhaust ?? false,
        effects: card.effects,
        upgraded: (card as any).upgraded ?? null,
        scenarios: {},
        // Multi-play sequence: simulate playing the card 3 times in a row
        // against a fresh-but-shared state. Lets us observe event_counter
        // triggers + cap behaviour on stat_gain cards.
        sequence_3x: null as any,
        errors: [],
      };

      for (const scen of SCENARIOS) {
        try {
          const state = makeState(scen.overrides);
          const before = snap(state);
          const res = resolver.resolve(card, state, null);
          const after = snap(state);
          entry.scenarios[scen.name] = diff(before, after, res);
        } catch (e: any) {
          entry.scenarios[scen.name] = { error: e?.message ?? String(e) };
          entry.errors.push({ scenario: scen.name, error: e?.message ?? String(e) });
        }
      }

      // sequence_8x: shared state across 8 sequential casts. Lets us observe
      // stat_gain cap behaviour and event_counter threshold firing across
      // repeated plays. Between casts, inject 1 HP damage so hp_lost
      // event_counter cards (Searing Razor, Wrath Squall, Quickearth Rite)
      // also exercise their trigger path.
      try {
        const state = makeState({ heroStrength: 5, heroDexterity: 5, heroIntellect: 5, heroSpirit: 5, heroVitality: 5 });
        const before = snap(state);
        const totals = [];
        // applyHeroDamage is the official ingress for the hp_lost event.
        for (let i = 0; i < 8; i++) {
          const beforeCast = snap(state);
          resolver.resolve(card, state, null);
          // Simulate combat-time progression + hero HP loss so any hp_lost
          // event-counter auras armed by the card actually receive events.
          // Pierce-armor so armor-gain cards don't absorb the test damage.
          state.combatElapsedMs += 1500;
          if (state.heroHP > 5) applyHeroDamage(2, state, /*skipRelics=*/true, /*pierce=*/true);
          const afterCast = snap(state);
          totals.push({
            cast: i + 1,
            dmg: beforeCast.enemyHP - afterCast.enemyHP,
            arm: afterCast.heroDefense - beforeCast.heroDefense,
            heal: afterCast.heroHP - beforeCast.heroHP > 0 ? afterCast.heroHP - beforeCast.heroHP : 0,
            statDeltas: {
              str: afterCast.statGainStr - beforeCast.statGainStr,
              vit: afterCast.statGainVit - beforeCast.statGainVit,
              dex: afterCast.statGainDex - beforeCast.statGainDex,
              int: afterCast.statGainInt - beforeCast.statGainInt,
              spi: afterCast.statGainSpi - beforeCast.statGainSpi,
            },
          });
        }
        const after = snap(state);
        entry.sequence_8x = {
          per_cast: totals,
          final_statBoosts: {
            str: after.statGainStr, vit: after.statGainVit, dex: after.statGainDex,
            int: after.statGainInt, spi: after.statGainSpi,
          },
          final_eventCounterAuras: after.eventCounterAuras,
          totalArmorGained: after.heroDefense - before.heroDefense,
          totalDamageDealt: before.enemyHP - after.enemyHP,
          finalEnemyStacks: {
            poison: after.poison, bleed: after.bleed, burn: after.burn,
            stun: after.stun, slow: after.slow,
          },
        };
      } catch (e: any) {
        entry.sequence_8x = { error: e?.message ?? String(e) };
        entry.errors.push({ scenario: 'sequence_8x', error: e?.message ?? String(e) });
      }

      // Upgraded variant
      if ((card as any).upgraded) {
        try {
          const state = makeState();
          state.deckOrder = [card.id];
          state.upgraded = [true];
          const before = snap(state);
          const res = resolver.resolve(card, state, null, 1.0, true);
          const after = snap(state);
          entry.scenarios['upgraded_baseline'] = diff(before, after, res);
        } catch (e: any) {
          entry.scenarios['upgraded_baseline'] = { error: e?.message ?? String(e) };
          entry.errors.push({ scenario: 'upgraded_baseline', error: e?.message ?? String(e) });
        }
      }

      report.push(entry);
    }

    const out = pathResolve(process.cwd(), 'tests/audit/sim-report-v2.json');
    writeFileSync(out, JSON.stringify(report, null, 2), 'utf-8');
    // eslint-disable-next-line no-console
    console.log(`Wrote ${report.length} card entries (v2) to ${out}`);
  });
});
