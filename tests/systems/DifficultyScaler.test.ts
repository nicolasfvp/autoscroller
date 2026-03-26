import { describe, it, expect } from 'vitest';
import { scaleEnemyForLoop, getLoopSpeed, getDifficultyConfig } from '../../src/systems/DifficultyScaler';

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
    expect(stats.goldReward).toBe(15); // avg(10,20) * sqrt(1) = 15
  });

  it('loop 5: multiplier is 1.4', () => {
    const stats = scaleEnemyForLoop(baseEnemy, 5);
    // 1 + 4*0.10 = 1.4
    expect(stats.hp).toBe(140);
    expect(stats.damage).toBe(14);
    expect(stats.defense).toBe(7);
    // goldReward = floor(15 * sqrt(1.4)) = floor(15 * 1.1832) = floor(17.748) = 17
    expect(stats.goldReward).toBe(17);
  });

  it('loop 10: multiplier is 1.9', () => {
    const stats = scaleEnemyForLoop(baseEnemy, 10);
    // 1 + 9*0.10 = 1.9
    expect(stats.hp).toBe(190);
    expect(stats.damage).toBe(19);
    expect(stats.defense).toBe(9); // floor(5 * 1.9) = 9
    // goldReward = floor(15 * sqrt(1.9)) = floor(15 * 1.3784) = floor(20.676) = 20
    expect(stats.goldReward).toBe(20);
  });

  it('boss multiplier stacks on top of loop multiplier', () => {
    const stats = scaleEnemyForLoop(baseEnemy, 5, true);
    // loopMult = 1.4 * 2.0 = 2.8
    expect(stats.hp).toBe(280);
    expect(stats.damage).toBe(28);
    expect(stats.defense).toBe(14);
    // goldReward = floor(15 * sqrt(2.8)) = floor(15 * 1.6733) = floor(25.099) = 25
    expect(stats.goldReward).toBe(25);
  });

  it('getLoopSpeed returns base speed at loop 1', () => {
    const speed = getLoopSpeed(1);
    expect(speed).toBe(60);
  });

  it('getLoopSpeed scales with loop count', () => {
    const speed = getLoopSpeed(10);
    // 60 * 1.02^9 = 60 * 1.19509 ~ 71.705
    expect(speed).toBeCloseTo(60 * Math.pow(1.02, 9), 2);
  });

  it('getDifficultyConfig returns full config', () => {
    const cfg = getDifficultyConfig();
    expect(cfg.percentPerLoop).toBe(0.10);
    expect(cfg.bossMultiplier).toBe(2.0);
    expect(cfg.bossEveryNLoops).toBe(5);
    expect(cfg.baseLoopLength).toBe(15);
  });
});
