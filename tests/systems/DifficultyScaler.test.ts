import { describe, it, expect } from 'vitest';
import { scaleEnemyForLoop, getLoopSpeed, getDifficultyConfig, getLoopGrowth, getLoopLength } from '../../src/systems/DifficultyScaler';

const baseEnemy = {
  baseHP: 100,
  attack: { damage: 10 },
  baseDefense: 5,
  goldReward: { min: 10, max: 20 },
};

describe('DifficultyScaler', () => {
  it('no precomputed multiplier: stats unscaled (per-loop scaling removed)', () => {
    // Loop count is now ignored without a precomputed multiplier — bossKill
    // scaling lives in LoopRunner.difficultyMultiplier.
    const stats = scaleEnemyForLoop(baseEnemy, 1);
    expect(stats.hp).toBe(100);
    expect(stats.damage).toBe(10);
    expect(stats.defense).toBe(5);
    expect(stats.goldReward).toBe(15);

    const stats5 = scaleEnemyForLoop(baseEnemy, 5);
    expect(stats5.hp).toBe(100);
    expect(stats5.damage).toBe(10);
    expect(stats5.defense).toBe(5);
  });

  it('precomputed multiplier scales stats directly', () => {
    // 4 boss kills → 1 + 4*0.10 = 1.4
    const stats = scaleEnemyForLoop(baseEnemy, 1, false, 1.4);
    expect(stats.hp).toBe(140);
    expect(stats.damage).toBe(14);
    expect(stats.defense).toBe(7);
    // goldReward = floor(15 * log2(1.4 + 1)) = floor(15 * 1.26303) = 18
    expect(stats.goldReward).toBe(18);
  });

  it('bosses use half the post-kill growth rate and the boss multiplier', () => {
    // precomputed 1.4 → boss halves growth: 1 + 0.4*0.5 = 1.2, then * 1.0
    const stats = scaleEnemyForLoop(baseEnemy, 1, true, 1.4);
    expect(stats.hp).toBe(120);
    expect(stats.damage).toBe(12);
    expect(stats.defense).toBe(6);
    // goldReward = floor(15 * log2(1.2 + 1)) = floor(15 * 1.13750) = 17
    expect(stats.goldReward).toBe(17);
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
    expect(cfg.percentPerLoop).toBe(0);
    expect(cfg.percentPerBossKill).toBe(0.10);
    expect(cfg.bossMultiplier).toBe(1.0);
    expect(cfg.bossEveryNLoops).toBe(25);
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
