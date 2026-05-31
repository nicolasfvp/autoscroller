// Card audit simulator. Loads every card in src/data/json/cards.json, runs
// it through CardResolver in a battery of canonical scenarios, captures
// per-scenario deltas (damage, healed, armor, stack changes, costs paid),
// and writes a single JSON report to tests/audit/sim-report.json.
//
// Run with: npx vitest run tests/audit/card-audit-sim.test.ts
//
// This file is *not* a real test — it asserts no behavior. It exists to
// reuse the existing vitest TS toolchain as a one-shot simulation runner.

import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { CardResolver } from '../../src/systems/combat/CardResolver';
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
  heroAuras: number;
  enemyAuras: number;
}

function snap(s: CombatState): Snapshot {
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
    heroAuras: s.heroAuras.length,
    enemyAuras: s.enemyAuras.length,
  };
}

interface Delta {
  damageDealt: number;       // enemyHP delta (positive = damage)
  selfDamage: number;        // heroHP delta (positive = self-damage)
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
  heroAurasAdded: number;
  enemyAurasAdded: number;
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
    heroAurasAdded: after.heroAuras - before.heroAuras,
    enemyAurasAdded: after.enemyAuras - before.enemyAuras,
    resultTotalDamage: result?.totalDamage ?? 0,
    resultHealed: result?.healed ?? 0,
    resultArmorGained: result?.armorGained ?? 0,
  };
}

const SCENARIOS: { name: string; overrides: Partial<CombatState> }[] = [
  { name: 'baseline', overrides: {} },
  { name: 'str_10', overrides: { heroStrength: 10 } },
  { name: 'dex_10', overrides: { heroDexterity: 10 } },
  { name: 'int_10', overrides: { heroIntellect: 10 } },
  { name: 'spi_10', overrides: { heroSpirit: 10 } },
  { name: 'vit_10', overrides: { heroVitality: 10 } },
  { name: 'enemy_bleed_5', overrides: { bleedStacks: 5 } },
  { name: 'enemy_burn_5', overrides: { burnStacks: 5 } },
  { name: 'enemy_poison_5', overrides: { poisonStacks: 5 } },
  { name: 'enemy_slow_5', overrides: { slowStacks: 5 } },
  { name: 'enemy_stunned', overrides: { stunStacks: 3 } },
  { name: 'hero_rage_5', overrides: { rageStacks: 5 } },
  { name: 'hero_low_hp', overrides: { heroHP: 25, heroMaxHP: 100 } },
  { name: 'hero_armored', overrides: { heroDefense: 30 } },
  { name: 'enemy_armored', overrides: { enemyDefense: 20 } },
];

describe('card audit simulation', () => {
  it('runs every card in every scenario and writes a JSON report', () => {
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

      // upgraded variant: replay baseline with isUpgraded=true if upgraded data exists
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

    const out = pathResolve(process.cwd(), 'tests/audit/sim-report.json');
    writeFileSync(out, JSON.stringify(report, null, 2), 'utf-8');
    // eslint-disable-next-line no-console
    console.log(`Wrote ${report.length} card entries to ${out}`);
  });
});
