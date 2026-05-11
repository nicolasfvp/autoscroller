// Reward-Per-Unit-cost validator for Design v2 cards.
// Source of truth: design/00_framework.md ss10.1-ss10.5 (RPU bands + cost/reward tables).
// Source of exceptions: ss10.3 per-class audits (aggregated below).
//
// Wave 0 (Plan 1) state: tests COMPILE AND RUN. They are RED for any
// out-of-band card; that is the intended state until Plan 2 ships content
// with audited values. The RPU_EXCEPTIONS list ships with the 8 documented
// Shadowblade exceptions; Plan 2 must aggregate Warrior + Mage + Neutral
// exceptions before content can pass.

import { describe, it, expect } from 'vitest';
import cardsData from '../../src/data/json/cards.json';
import type { CardDefinition } from '../../src/data/types';

export const RPU_BANDS = {
  common:   { min: 6.0, max: 9.0 },
  uncommon: { min: 8.5, max: 11.5 },
  rare:     { min: 11.0, max: 14.5 },
  epic:     { min: 13.5, max: 19.0 },
} as const;

// Aggregated from design/03_shadowblade.md ss10.3.
// TODO Plan 2: aggregate warrior + mage + neutral exception lists from
// design/01_warrior.md ss10, design/02_mage.md ss10, design/04_neutral_and_combos.md ss9.
export const RPU_EXCEPTIONS: Set<string> = new Set([
  // Shadowblade starter & finisher exceptions (design/03_shadowblade.md ss10.3)
  'backstab', 'eviscerate', 'toxic-coat',
  'crimson-edge', 'death-blossom', 'coup-de-grace',
  'crimson-recital', 'eternal-veil',
]);

/**
 * Compute Reward-Per-Unit-cost (RPU) for a card per design ss10.1-2.
 * Returns R/max(C,1). Effect types not in the table contribute 0 to R.
 */
export function computeRPU(card: CardDefinition): number {
  // Cost units (C) per design ss10.2
  let C = 0;
  if (card.cost?.stamina) C += card.cost.stamina * 0.5;
  if (card.cost?.mana) C += card.cost.mana * 0.6;
  if (card.cost?.defense) C += card.cost.defense * 0.7;
  // Cooldown over 1.0s baseline
  if (card.cooldown > 1.0) C += (card.cooldown - 1.0) * 0.8;

  // Reward units (R) per design ss10.1
  let R = 0;
  for (const eff of card.effects) {
    switch (eff.type) {
      case 'damage':
        if (eff.target === 'enemy') R += eff.value * 1.0;
        break;
      case 'armor':       R += eff.value * 0.7; break;
      case 'heal':        R += eff.value * 0.9; break;
      case 'stamina':     R += eff.value * 0.5; break;
      case 'mana':        R += eff.value * 0.6; break;
      case 'dot':         R += eff.value * 2.5; break;
      case 'gain_combo':  R += eff.value * 2.0; break;
      case 'stealth':     R += eff.value * 3.0; break;
      case 'buff':        R += eff.value * 3.0; break;
      case 'debuff':      R += eff.value * 1.0; break;
      // consume_combo is evaluated at 5 CP per design ss10 — finisher case
      // handled by the rarity exception list (eviscerate etc.).
    }
  }

  return R / Math.max(C, 1);
}

describe('RPU band audit (Wave 0 -- RED until Plan 2 content)', () => {
  const cards = cardsData.cards as CardDefinition[];
  for (const card of cards) {
    if (RPU_EXCEPTIONS.has(card.id)) {
      it.skip(`${card.id}: exception per design ss10.3`, () => {});
      continue;
    }
    it(`${card.id} (${card.rarity}) RPU within band`, () => {
      const rpu = computeRPU(card);
      const band = RPU_BANDS[card.rarity as keyof typeof RPU_BANDS];
      if (!band) {
        throw new Error(`${card.id}: unknown rarity ${card.rarity}`);
      }
      expect(rpu, `RPU=${rpu.toFixed(2)} band=${band.min}-${band.max}`)
        .toBeGreaterThanOrEqual(band.min);
      expect(rpu).toBeLessThanOrEqual(band.max);
    });
  }
});

describe('RPU_EXCEPTIONS list completeness', () => {
  it('contains all 8 documented Shadowblade exceptions', () => {
    const sbExceptions = [
      'backstab', 'eviscerate', 'toxic-coat',
      'crimson-edge', 'death-blossom', 'coup-de-grace',
      'crimson-recital', 'eternal-veil',
    ];
    for (const id of sbExceptions) {
      expect(RPU_EXCEPTIONS.has(id), `Missing exception: ${id}`).toBe(true);
    }
  });
});
