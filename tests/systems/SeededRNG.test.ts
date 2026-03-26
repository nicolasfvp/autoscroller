import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../src/systems/SeededRNG';

describe('SeededRNG', () => {
  it('produces identical value on two separate instantiations with same seed', () => {
    const rng1 = new SeededRNG('test-seed');
    const rng2 = new SeededRNG('test-seed');
    expect(rng1.random()).toBe(rng2.random());
  });

  it('calling random() 100 times produces identical sequence for same seed', () => {
    const rng1 = new SeededRNG('test-seed');
    const rng2 = new SeededRNG('test-seed');
    const seq1: number[] = [];
    const seq2: number[] = [];
    for (let i = 0; i < 100; i++) {
      seq1.push(rng1.random());
      seq2.push(rng2.random());
    }
    expect(seq1).toEqual(seq2);
  });

  it('two different seeds produce different sequences', () => {
    const rng1 = new SeededRNG('seed-alpha');
    const rng2 = new SeededRNG('seed-beta');
    const val1 = rng1.random();
    const val2 = rng2.random();
    expect(val1).not.toBe(val2);
  });

  it('intRange(1, 6) always returns integer between 1 and 6 inclusive', () => {
    const rng = new SeededRNG('range-test');
    for (let i = 0; i < 200; i++) {
      const val = rng.intRange(1, 6);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('pick() always returns an element from the array', () => {
    const rng = new SeededRNG('pick-test');
    const arr = [1, 2, 3];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it('shuffle() returns same order for same seed', () => {
    const rng1 = new SeededRNG('shuffle-test');
    const rng2 = new SeededRNG('shuffle-test');
    const arr1 = [1, 2, 3, 4, 5];
    const arr2 = [1, 2, 3, 4, 5];
    rng1.shuffle(arr1);
    rng2.shuffle(arr2);
    expect(arr1).toEqual(arr2);
  });

  it('constructor with no argument generates a non-empty seed string', () => {
    const rng = new SeededRNG();
    expect(rng.seed).toBeTruthy();
    expect(rng.seed.length).toBeGreaterThan(0);
  });
});
