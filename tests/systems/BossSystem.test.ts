import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { triggerBossCombat, onBossVictory, getBossExitChoiceData } from '../../src/systems/BossSystem';
import { setRNG, resetRNG } from '../../src/systems/LootGenerator';

function makeRunState() {
  return {
    hero: { hp: 100, maxHp: 100, stamina: 50, maxStamina: 50, mana: 30, maxMana: 30, xp: 200 },
    deck: { cards: [], order: ['strike', 'defend'] },
    loop: { count: 3, length: 15, tiles: [], positionInLoop: 0, difficultyMultiplier: 1.2 },
    economy: { gold: 100, tilePoints: 5, metaLoot: 20 },
    tileInventory: [],
    relics: [],
  };
}

describe('BossSystem', () => {
  afterEach(() => {
    resetRNG();
  });

  it('triggerBossCombat returns scaled boss stats with isBoss=true', () => {
    const run = makeRunState();
    const encounter = triggerBossCombat(run);
    expect(encounter.isBoss).toBe(true);
    expect(encounter.enemyId).toBe('boss_demon');
    expect(encounter.scaledStats.hp).toBeGreaterThan(0);
    expect(encounter.scaledStats.damage).toBeGreaterThan(0);
  });

  it('triggerBossCombat scales stats with loop count', () => {
    const run1 = makeRunState();
    run1.loop.count = 1;
    const enc1 = triggerBossCombat(run1);

    const run5 = makeRunState();
    run5.loop.count = 5;
    const enc5 = triggerBossCombat(run5);

    expect(enc5.scaledStats.hp).toBeGreaterThan(enc1.scaledStats.hp);
  });

  it('onBossVictory awards meta-loot to runState', () => {
    // metaLootPerBoss = 10 from difficulty.json
    setRNG({ next: () => 0.5 });
    const run = makeRunState();
    const origMetaLoot = run.economy.metaLoot;
    const result = onBossVictory(run);
    expect(result.metaLootAwarded).toBe(10);
    expect(run.economy.metaLoot).toBe(origMetaLoot + 10);
  });

  it('getBossExitChoiceData returns safe exit with 100% meta-loot', () => {
    const run = makeRunState();
    const data = getBossExitChoiceData(run);
    expect(data.safeExitReward.exitType).toBe('safe');
    expect(data.safeExitReward.metaLoot).toBe(run.economy.metaLoot);
    expect(data.safeExitReward.xp).toBe(run.hero.xp);
  });

  it('getBossExitChoiceData returns continue risk warning string', () => {
    const run = makeRunState();
    const data = getBossExitChoiceData(run);
    expect(data.continueRisk).toContain('Death');
    expect(data.continueRisk.length).toBeGreaterThan(0);
  });
});
