import { describe, it, expect } from 'vitest';
import { resolveRunEnd } from '../../src/systems/RunEndResolver';

describe('RunEndResolver', () => {
  it('safe exit returns 100% meta-loot and all XP', () => {
    const result = resolveRunEnd('safe', 100, 50);
    expect(result).toEqual({ exitType: 'safe', metaLoot: 100, xp: 50 });
  });

  it('death returns 25% meta-loot and 0 XP', () => {
    const result = resolveRunEnd('death', 100, 50);
    expect(result).toEqual({ exitType: 'death', metaLoot: 25, xp: 0 });
  });

  it('safe exit with zero meta-loot returns zeros', () => {
    const result = resolveRunEnd('safe', 0, 0);
    expect(result).toEqual({ exitType: 'safe', metaLoot: 0, xp: 0 });
  });

  it('death with odd meta-loot floors correctly', () => {
    const result = resolveRunEnd('death', 7, 30);
    // floor(7 * 0.25) = floor(1.75) = 1
    expect(result.metaLoot).toBe(1);
    expect(result.xp).toBe(0);
  });
});
