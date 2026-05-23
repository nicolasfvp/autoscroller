import { describe, it, expect } from 'vitest';
import { resolveRunEnd } from '../../src/systems/RunEndResolver';

describe('RunEndResolver', () => {
  it('safe exit returns full materials and all XP', () => {
    const result = resolveRunEnd('safe', { wood: 100, iron: 50 }, 50);
    expect(result).toEqual({ exitType: 'safe', materials: { wood: 100, iron: 50 }, xp: 50 });
  });

  it('death returns 25% materials and 30% XP (no storehouse)', () => {
    // deathXpPercent: 0.30 — floor(50 * 0.30) = 15
    const result = resolveRunEnd('death', { wood: 100, iron: 50 }, 50);
    expect(result).toEqual({ exitType: 'death', materials: { wood: 25, iron: 12 }, xp: 15 });
  });

  it('safe exit with empty materials returns empty', () => {
    const result = resolveRunEnd('safe', {}, 0);
    expect(result).toEqual({ exitType: 'safe', materials: {}, xp: 0 });
  });

  it('death with tiny amounts floors to at least 1 (no full vanish)', () => {
    // floor(7 * 0.25) = floor(1.75) = 1; floor(30 * 0.30) = 9
    const result = resolveRunEnd('death', { wood: 7 }, 30);
    expect(result.materials.wood).toBe(1);
    expect(result.xp).toBe(9);
  });

  it('death with storehouseLevel=5 retains 40% materials', () => {
    const result = resolveRunEnd('death', { wood: 100, iron: 40 }, 50, 5);
    expect(result.materials.wood).toBe(40);
    expect(result.materials.iron).toBe(16);
    expect(result.xp).toBe(15);
  });

  it('death with storehouseLevel=8 retains 50% materials', () => {
    const result = resolveRunEnd('death', { essence: 100 }, 50, 8);
    expect(result.materials.essence).toBe(50);
  });
});
