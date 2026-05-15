// Reproduces the user-reported bug: a custom starter deck selected in
// DeckBuilder ends up shuffled / replaced by the class default when the run
// starts. Pin-down test for the customStarterDeck flow in createNewRun.

import { describe, it, expect, beforeAll } from 'vitest';
import { createNewRun } from '../../src/state/RunState';
import { loadAllData } from '../../src/data/DataLoader';

describe('createNewRun(customStarterDeck)', () => {
  beforeAll(() => {
    loadAllData();
  });

  it('uses customStarterDeck verbatim when provided', () => {
    const customDeck = [
      't1-earth-earth',       // Stoneskin
      't1-counter-fire',      // Ember Riposte
      't1-counter-defense',   // Thorn Wall
      't1-agility-defense',   // Dancer's Guard
      't1-attack-defense',    // Shield Slam
    ];
    const run = createNewRun(undefined, 1, 'warrior', undefined, customDeck);
    expect(run.deck.active).toEqual(customDeck);
  });

  it('falls back to class default (shuffled) when customStarterDeck is undefined', () => {
    const run = createNewRun(undefined, 1, 'warrior', undefined, undefined);
    // Warrior default ids — order will be shuffled but the set must match.
    const expected = new Set([
      't1-attack-attack', 't1-defense-defense', 't1-attack-defense',
      't1-agility-agility', 't1-attack-fire',
    ]);
    expect(new Set(run.deck.active)).toEqual(expected);
  });

  it('falls back to class default when customStarterDeck is empty array', () => {
    const run = createNewRun(undefined, 1, 'warrior', undefined, []);
    const expected = new Set([
      't1-attack-attack', 't1-defense-defense', 't1-attack-defense',
      't1-agility-agility', 't1-attack-fire',
    ]);
    expect(new Set(run.deck.active)).toEqual(expected);
  });

  it('upgraded array length matches active length for custom decks', () => {
    const customDeck = ['t1-earth-earth', 't1-counter-fire', 't1-counter-defense', 't1-agility-defense', 't1-attack-defense'];
    const run = createNewRun(undefined, 1, 'warrior', undefined, customDeck);
    expect(run.deck.upgraded.length).toBe(customDeck.length);
    expect(run.deck.upgraded.every((u) => u === false)).toBe(true);
  });
});
