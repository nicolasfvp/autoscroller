import { describe, it, expect } from 'vitest';
import { getInRunLevelBonus, resolveHeroStats } from '../../../src/systems/hero/HeroStatsResolver';
import { getLevel, getXPForNextLevel } from '../../../src/systems/hero/XPSystem';
import type { RunState } from '../../../src/state/RunState';

/** Cumulative XP needed to reach exactly `level`. */
function xpForLevel(level: number): number {
  let total = 0;
  for (let l = 0; l < level; l++) total += getXPForNextLevel(l);
  return total;
}

function makeRun(overrides?: { runXP?: number; className?: string }): RunState {
  return {
    version: 3,
    runId: 'test',
    seed: 'test-seed',
    generation: 1,
    startedAt: 0,
    hero: {
      maxHP: 100, currentHP: 100,
      maxStamina: 50, currentStamina: 50,
      maxMana: 30, currentMana: 30,
      currentDefense: 0, strength: 1,
      defenseMultiplier: 1, moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0, statDeltas: {},
      runXP: overrides?.runXP ?? 0,
      totalXP: 0,
      className: overrides?.className ?? 'warrior',
    },
    deck: { active: [], inventory: {}, upgraded: [], droppedCards: [] },
    loop: { count: 0, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [],
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
    isInCombat: false,
    currentScene: 'Game',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
  } as unknown as RunState;
}

describe('getInRunLevelBonus', () => {
  it('grants nothing at level 0 (no XP)', () => {
    const b = getInRunLevelBonus(0, 'warrior');
    expect(b).toEqual({ maxHP: 0, strength: 0, vitality: 0, dexterity: 0, intellect: 0, spirit: 0 });
  });

  it('scales maxHP at +6 per level', () => {
    const lvl4XP = xpForLevel(4);
    expect(getLevel(lvl4XP)).toBe(4);
    expect(getInRunLevelBonus(lvl4XP, 'warrior').maxHP).toBe(24); // 4 * 6
  });

  it('grants +1 Vitality every 2 levels and +1 DEX every 4 levels', () => {
    const lvl4 = getInRunLevelBonus(xpForLevel(4), 'warrior');
    expect(lvl4.vitality).toBe(2); // floor(4/2)
    expect(lvl4.dexterity).toBe(1); // floor(4/4)
    const lvl6 = getInRunLevelBonus(xpForLevel(6), 'warrior');
    expect(lvl6.vitality).toBe(3); // floor(6/2)
    expect(lvl6.dexterity).toBe(1); // floor(6/4)
  });

  it('routes the offensive axis to Strength for warrior', () => {
    const b = getInRunLevelBonus(xpForLevel(6), 'warrior');
    expect(b.strength).toBe(3); // floor(6/2)
    expect(b.intellect).toBe(0);
  });

  it('routes the offensive axis to Intellect for mage', () => {
    const b = getInRunLevelBonus(xpForLevel(6), 'mage');
    expect(b.intellect).toBe(3); // floor(6/2)
    expect(b.strength).toBe(0);
  });

  it('is monotonically non-decreasing in runXP', () => {
    const low = getInRunLevelBonus(xpForLevel(2), 'warrior');
    const high = getInRunLevelBonus(xpForLevel(8), 'warrior');
    expect(high.maxHP).toBeGreaterThan(low.maxHP);
    expect(high.strength).toBeGreaterThanOrEqual(low.strength);
    expect(high.vitality).toBeGreaterThanOrEqual(low.vitality);
    expect(high.dexterity).toBeGreaterThanOrEqual(low.dexterity);
  });

  it('treats negative runXP as zero (defensive)', () => {
    expect(getInRunLevelBonus(-100, 'warrior').maxHP).toBe(0);
  });
});

describe('resolveHeroStats folds in the in-run level bonus', () => {
  it('raises resolved stats as runXP grows (warrior)', () => {
    const baseRun = makeRun({ runXP: 0 });
    const base = resolveHeroStats(baseRun);

    const leveledRun = makeRun({ runXP: xpForLevel(6) });
    const leveled = resolveHeroStats(leveledRun);

    // +36 maxHP from levels, +15 from the 3 granted VIT * 5 (VIT layer).
    expect(leveled.maxHP).toBe(base.maxHP + 6 * 6 + 3 * 5);
    expect(leveled.str).toBe(base.str + 3);
    expect(leveled.vit).toBe(base.vit + 3);
    expect(leveled.dex).toBe(base.dex + 1);
    expect(leveled.int).toBe(base.int);
  });

  it('routes the offensive axis to Intellect for a mage run', () => {
    const base = resolveHeroStats(makeRun({ runXP: 0, className: 'mage' }));
    const leveled = resolveHeroStats(makeRun({ runXP: xpForLevel(6), className: 'mage' }));
    expect(leveled.int).toBe(base.int + 3);
    expect(leveled.str).toBe(base.str);
  });
});
