// Verify that the new card-text formatter (CARD_AUDIT §1 / §11 / §12)
// never emits legacy keywords or comparison operators.
// This test is temporary — once cards.json is fully migrated and every card's
// `description` matches §12 byte-for-byte, it can be replaced by a stricter
// snapshot check.

import { describe, it, expect } from 'vitest';
import { formatCardDescription } from '../../src/systems/cards/CardText';
import cardsData from '../../src/data/json/cards.json';
import type { CardDefinition } from '../../src/data/types';

const cards = cardsData.cards as CardDefinition[];
const BANNED = /\b(Empowered|Guard|Fortified|Shatter|Berserk|Echo|Stance|Cascade|Catalyze|DR|Channel|Reflex|Devour|Spread|Overload|Vulnerable|Convert|Pyre)\b/;

describe('card-text formatter — new prose convention', () => {
  it('emits no comparison operators', () => {
    const offenders: string[] = [];
    for (const card of cards) {
      const d = formatCardDescription(card);
      if (/[<>≥≤]/.test(d)) offenders.push(`${card.id}: ${d}`);
    }
    expect(offenders).toEqual([]);
  });

  it('emits no "Aura Ns:" wrappers', () => {
    const offenders: string[] = [];
    for (const card of cards) {
      const d = formatCardDescription(card);
      if (/Aura \d+s:/.test(d)) offenders.push(`${card.id}: ${d}`);
    }
    expect(offenders).toEqual([]);
  });

  it('emits no "(scales STR)"-style legacy scale tags', () => {
    const offenders: string[] = [];
    for (const card of cards) {
      const d = formatCardDescription(card);
      if (/scales [A-Z]{3}/i.test(d)) offenders.push(`${card.id}: ${d}`);
    }
    expect(offenders).toEqual([]);
  });

  it('emits no banned keywords (Empowered, Guard, Fortified, etc.)', () => {
    const offenders: string[] = [];
    for (const card of cards) {
      const d = formatCardDescription(card);
      if (BANNED.test(d)) offenders.push(`${card.id}: ${d}`);
    }
    expect(offenders).toEqual([]);
  });
});
