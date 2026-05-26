// Pin-down test for the customStarterDeck flow in createNewRun: a deck
// chosen via the StartingDeck template picker must reach the run intact
// (no shuffle, no fallback to the class default) and the upgraded array
// must mirror its length.

import { describe, it, expect, beforeAll } from 'vitest';
import { createNewRun } from '../../src/state/RunState';
import { loadAllData } from '../../src/data/DataLoader';

describe('createNewRun(customStarterDeck)', () => {
  beforeAll(() => {
    loadAllData();
  });

  it('uses customStarterDeck verbatim when provided', () => {
    const customDeck = [
      't2-earth-earth',       // Stoneskin
      't2-counter-fire',      // Ember Riposte
      't2-counter-defense',   // Thorn Wall
      't2-agility-defense',   // Dancer's Guard
      't2-attack-defense',    // Shield Slam
    ];
    const run = createNewRun(undefined, 1, 'warrior', undefined, customDeck);
    expect(run.deck.active).toEqual(customDeck);
  });

  it('falls back to class default (shuffled) when customStarterDeck is undefined', () => {
    const run = createNewRun(undefined, 1, 'warrior', undefined, undefined);
    // Warrior default ids — order will be shuffled but the set must match.
    const expected = new Set([
      't2-attack-attack', 't2-defense-defense', 't2-attack-defense',
      't2-agility-agility', 't2-attack-fire',
    ]);
    expect(new Set(run.deck.active)).toEqual(expected);
  });

  it('falls back to class default when customStarterDeck is empty array', () => {
    const run = createNewRun(undefined, 1, 'warrior', undefined, []);
    const expected = new Set([
      't2-attack-attack', 't2-defense-defense', 't2-attack-defense',
      't2-agility-agility', 't2-attack-fire',
    ]);
    expect(new Set(run.deck.active)).toEqual(expected);
  });

  it('upgraded array length matches active length for custom decks', () => {
    const customDeck = ['t2-earth-earth', 't2-counter-fire', 't2-counter-defense', 't2-agility-defense', 't2-attack-defense'];
    const run = createNewRun(undefined, 1, 'warrior', undefined, customDeck);
    expect(run.deck.upgraded.length).toBe(customDeck.length);
    expect(run.deck.upgraded.every((u) => u === false)).toBe(true);
  });
});
