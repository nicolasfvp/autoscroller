import { describe, it, expect } from 'vitest';
import { scaleEnemyForLoop, getLoopSpeed, getDifficultyConfig, getLoopGrowth, getLoopLength } from '../../src/systems/DifficultyScaler';

const baseEnemy = {
  baseHP: 100,
  attack: { damage: 10 },
  baseDefense: 5,
  goldReward: { min: 10, max: 20 },
};

describe('DifficultyScaler', () => {
  it('loop 1: multiplier is 1.0 (no scaling)', () => {
    const stats = scaleEnemyForLoop(baseEnemy, 1);
    expect(stats.hp).toBe(100);
    expect(stats.damage).toBe(10);
    expect(stats.defense).toBe(5);
    expect(stats.goldReward).toBe(15);
  });

  it('loop 5: multiplier is 1.48', () => {
    const stats = scaleEnemyForLoop(baseEnemy, 5);
    // 1 + 4*0.12 = 1.48
    expect(stats.hp).toBe(148);
    expect(stats.damage).toBe(14); // floor(10 * 1.48) = 14
    expect(stats.defense).toBe(7); // floor(5 * 1.48) = 7
    // goldReward = floor(15 * log2(1.48 + 1)) = floor(15 * 1.31034) = 19
    expect(stats.goldReward).toBe(19);
  });

  it('boss multiplier stacks on top of loop multiplier', () => {
    const stats = scaleEnemyForLoop(baseEnemy, 5, true);
    // loopMult = 1.48 * 2.0 = 2.96
    expect(stats.hp).toBe(296);
    expect(stats.damage).toBe(29); // floor(10 * 2.96)
    expect(stats.defense).toBe(14); // floor(5 * 2.96)
    // goldReward = floor(15 * log2(2.96 + 1)) = floor(15 * 1.98542) = 29
    expect(stats.goldReward).toBe(29);
  });

  it('getLoopSpeed returns base speed at loop 1', () => {
    const speed = getLoopSpeed(1);
    expect(speed).toBe(240);
  });

  it('getLoopSpeed is now player-controlled (constant baseSpeed)', () => {
    // Per feedback #28, map speed is now player-controlled via RunState.mapSpeed
    // and getLoopSpeed always returns the base speed regardless of loop count.
    const speed = getLoopSpeed(10);
    expect(speed).toBe(240);
  });

  it('getDifficultyConfig returns full config', () => {
    const cfg = getDifficultyConfig();
    expect(cfg.percentPerLoop).toBe(0.12);
    expect(cfg.bossMultiplier).toBe(2.0);
    expect(cfg.bossEveryNLoops).toBe(5);
    expect(cfg.baseLoopLength).toBe(15);
  });

  // ── Loop growth (new) ─────────────────────────────────────
  describe('getLoopGrowth', () => {
    it('returns schedule[0] for bossKillCount=0', () => {
      expect(getLoopGrowth(0)).toBe(3);
    });

    it('returns schedule[2] for bossKillCount=2', () => {
      expect(getLoopGrowth(2)).toBe(2);
    });

    it('repeats last schedule value beyond array length', () => {
      expect(getLoopGrowth(5)).toBe(1); // schedule has 5 entries, idx=4 is last -> 1
      expect(getLoopGrowth(10)).toBe(1);
    });
  });

  describe('getLoopLength', () => {
    it('returns base for 0 boss kills', () => {
      expect(getLoopLength(15, 0)).toBe(15);
    });

    it('accumulates growth over boss kills', () => {
      // 15 + 3 + 2 + 2 = 22
      expect(getLoopLength(15, 3)).toBe(22);
    });

    it('caps at maxTileLength', () => {
      expect(getLoopLength(15, 30)).toBe(40);
    });
  });
});
