import { describe, it, expect } from 'vitest';
import {
  TOKEN_GLOSSARY,
  lookupToken,
} from '../../src/ui/KeywordDefinitions';

// TOKEN_GLOSSARY is the player-facing reference for the new combat vocabulary
// (the colored stack/stat tokens). It is intentionally separate from
// KEYWORD_DEFINITIONS (the four detected modifier keywords).

describe('TOKEN_GLOSSARY', () => {
  it('contains all 7 stacks', () => {
    const stacks = TOKEN_GLOSSARY.filter((d) => d.category === 'stack').map((d) => d.keyword).sort();
    expect(stacks).toEqual(['Armor', 'Bleed', 'Burn', 'Poison', 'Rage', 'Slow', 'Stun']);
  });

  it('contains all 5 stats', () => {
    const stats = TOKEN_GLOSSARY.filter((d) => d.category === 'stat').map((d) => d.keyword).sort();
    expect(stats).toEqual(['Dexterity', 'Intellect', 'Spirit', 'Strength', 'Vitality']);
  });

  it('has exactly 12 entries (7 stacks + 5 stats)', () => {
    expect(TOKEN_GLOSSARY).toHaveLength(12);
  });

  it('every entry has a non-empty definition and a stack/stat category', () => {
    for (const def of TOKEN_GLOSSARY) {
      expect(def.definition.length).toBeGreaterThan(0);
      expect(['stack', 'stat']).toContain(def.category);
    }
  });

  it('has no duplicate keywords', () => {
    const keys = TOKEN_GLOSSARY.map((d) => d.keyword);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('lookupToken()', () => {
  it('resolves a plain stack name (case-insensitive)', () => {
    expect(lookupToken('burn')?.keyword).toBe('Burn');
    expect(lookupToken('Burn')?.keyword).toBe('Burn');
    expect(lookupToken('BURN')?.keyword).toBe('Burn');
  });

  it('strips bracket tokens', () => {
    expect(lookupToken('[burn]')?.keyword).toBe('Burn');
    expect(lookupToken('[armor]')?.keyword).toBe('Armor');
    expect(lookupToken('[STR]')?.keyword).toBe('Strength');
  });

  it('maps stat abbreviations to full stat names', () => {
    expect(lookupToken('str')?.keyword).toBe('Strength');
    expect(lookupToken('STR')?.keyword).toBe('Strength');
    expect(lookupToken('dex')?.keyword).toBe('Dexterity');
    expect(lookupToken('int')?.keyword).toBe('Intellect');
    expect(lookupToken('vit')?.keyword).toBe('Vitality');
    expect(lookupToken('spi')?.keyword).toBe('Spirit');
  });

  it('resolves full stat names too', () => {
    expect(lookupToken('Strength')?.keyword).toBe('Strength');
    expect(lookupToken('vitality')?.keyword).toBe('Vitality');
  });

  it('resolves every stack token', () => {
    for (const s of ['burn', 'bleed', 'poison', 'stun', 'slow', 'rage', 'armor']) {
      expect(lookupToken(s)).toBeDefined();
    }
  });

  it('returns undefined for unknown / empty tokens', () => {
    expect(lookupToken('')).toBeUndefined();
    expect(lookupToken('   ')).toBeUndefined();
    expect(lookupToken('frobnicate')).toBeUndefined();
    expect(lookupToken('[]')).toBeUndefined();
  });
});
