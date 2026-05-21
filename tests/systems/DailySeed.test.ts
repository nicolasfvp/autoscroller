import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// vitest runs in 'node' env in this repo (vitest.config.ts), so no DOM.
// Mock localStorage on globalThis before importing DailySeed so its module
// top-level reads bind to the mock.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string): void { this.store.set(k, String(v)); }
  removeItem(k: string): void { this.store.delete(k); }
  clear(): void { this.store.clear(); }
  key(i: number): string | null { return Array.from(this.store.keys())[i] ?? null; }
  get length(): number { return this.store.size; }
}
const memStorage = new MemoryStorage();
(globalThis as unknown as { localStorage: Storage }).localStorage = memStorage as unknown as Storage;

import {
  utcDateString,
  dailySeedString,
  deriveDailyRunConfig,
  generateDefaultNickname,
  getStoredNickname,
  setStoredNickname,
  ensureNickname,
} from '../../src/systems/DailySeed';

beforeEach(() => { memStorage.clear(); });
afterEach(() => { memStorage.clear(); });

describe('DailySeed.utcDateString', () => {
  it('formats as YYYY-MM-DD in UTC regardless of locale', () => {
    const d = new Date(Date.UTC(2026, 0, 5)); // 2026-01-05 UTC
    expect(utcDateString(d)).toBe('2026-01-05');
  });

  it('pads single-digit month and day', () => {
    const d = new Date(Date.UTC(2026, 2, 9)); // 2026-03-09 UTC
    expect(utcDateString(d)).toBe('2026-03-09');
  });

  it('stays UTC across negative-offset zones (timestamp on UTC day boundary)', () => {
    // 2026-05-20T00:30:00Z — still day 20 in UTC even though many local zones
    // would call this the 19th.
    const d = new Date('2026-05-20T00:30:00Z');
    expect(utcDateString(d)).toBe('2026-05-20');
  });
});

describe('DailySeed.dailySeedString', () => {
  it('prefixes the UTC date with "daily-"', () => {
    const d = new Date(Date.UTC(2026, 4, 20));
    expect(dailySeedString(d)).toBe('daily-2026-05-20');
  });
});

describe('DailySeed.deriveDailyRunConfig', () => {
  it('is deterministic — same seed yields same class + deck', () => {
    const a = deriveDailyRunConfig('daily-2026-05-20');
    const b = deriveDailyRunConfig('daily-2026-05-20');
    expect(a).toEqual(b);
  });

  it('different seeds produce different decks (overwhelmingly likely)', () => {
    const a = deriveDailyRunConfig('daily-2026-05-20');
    const b = deriveDailyRunConfig('daily-2026-05-21');
    // The class may collide (only 2 classes today), so compare decks.
    expect(a.starterDeck).not.toEqual(b.starterDeck);
  });

  it('produces a 5-card starter deck of unique ids', () => {
    const cfg = deriveDailyRunConfig('daily-2026-05-20');
    expect(cfg.starterDeck).toHaveLength(5);
    expect(new Set(cfg.starterDeck).size).toBe(5);
    for (const id of cfg.starterDeck) {
      expect(id.startsWith('t1-')).toBe(true);
    }
  });

  it('picks a valid registered class', () => {
    const cfg = deriveDailyRunConfig('daily-2026-05-20');
    expect(['warrior', 'mage']).toContain(cfg.className);
  });
});

describe('DailySeed nickname helpers', () => {
  it('generates a default in anon-XXXX shape', () => {
    const n = generateDefaultNickname();
    expect(n).toMatch(/^anon-[A-Z0-9]{4}$/);
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredNickname()).toBeNull();
  });

  it('trims, caps at 16 chars, and persists', () => {
    setStoredNickname('  hello-there!  ');
    // '!' is filtered by Edit chars but setStoredNickname doesn't filter —
    // the modal handles input validation. setStoredNickname just trims+caps.
    expect(getStoredNickname()).toBe('hello-there!');
  });

  it('caps length at 16', () => {
    setStoredNickname('abcdefghijklmnopqrstuvwxyz');
    expect(getStoredNickname()).toBe('abcdefghijklmnop');
  });

  it('falls back to a generated default for empty input', () => {
    const result = setStoredNickname('   ');
    expect(result).toMatch(/^anon-[A-Z0-9]{4}$/);
    expect(getStoredNickname()).toBe(result);
  });

  it('ensureNickname returns existing if present, otherwise creates one', () => {
    expect(getStoredNickname()).toBeNull();
    const first = ensureNickname();
    expect(first).toMatch(/^anon-[A-Z0-9]{4}$/);
    // Second call should return the same persisted value, not generate a new one.
    expect(ensureNickname()).toBe(first);
  });
});
