import { describe, it, expect, afterEach } from 'vitest';
import { triggerBossCombat, onBossVictory, getBossExitChoiceData } from '../../src/systems/BossSystem';
import { setRNG, resetRNG } from '../../src/systems/LootGenerator';

function makeRunState(): any {
  return {
    hero: { currentHP: 100, maxHP: 100, currentStamina: 50, maxStamina: 50, currentMana: 30, maxMana: 30, runXP: 200, totalXP: 0, currentDefense: 0, strength: 1, defenseMultiplier: 1, moveSpeed: 2 },
    deck: { active: ['strike', 'defend'], inventory: {}, upgraded: [false, false], droppedCards: [] },
    loop: { count: 3, tiles: [], difficulty: 1, tileLength: 15, positionInLoop: 0, difficultyMultiplier: 1.2 },
    economy: { gold: 100, tilePoints: 5, tileInventory: {}, materials: { essence: 20, crystal: 10 } },
    relics: [],
    runId: 'test',
    generation: 1,
    startedAt: 0,
    isInCombat: false,
    currentScene: 'GameScene',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
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
    // BossSystem picks from the boss roster in enemies.json (doom_knight / iron_golem / lizard_king)
    expect(['doom_knight', 'iron_golem', 'lizard_king']).toContain(encounter.enemyId);
    expect(encounter.scaledStats.hp).toBeGreaterThan(0);
    expect(encounter.scaledStats.damage).toBeGreaterThan(0);
  });

  it('triggerBossCombat scales stats with difficultyMultiplier (boss kills)', () => {
    const run1 = makeRunState();
    run1.loop.difficultyMultiplier = 1.0; // 0 boss kills
    const enc1 = triggerBossCombat(run1);

    const run5 = makeRunState();
    run5.loop.difficultyMultiplier = 1.4; // 4 boss kills (1 + 4*0.10)
    const enc5 = triggerBossCombat(run5);

    expect(enc5.scaledStats.hp).toBeGreaterThan(enc1.scaledStats.hp);
  });

  it('onBossVictory awards boss material drops to runState', () => {
    // Boss drops: essence 3-6, crystal 2-4 with rng=0 -> min values
    setRNG({ next: () => 0 });
    const run = makeRunState();
    const origEssence = run.economy.materials.essence;
    const result = onBossVictory(run);
    expect(result.materialsAwarded.essence).toBeGreaterThanOrEqual(3);
    expect(result.materialsAwarded.crystal).toBeGreaterThanOrEqual(2);
    expect(run.economy.materials.essence).toBe(origEssence + result.materialsAwarded.essence);
  });

  it('getBossExitChoiceData returns safe exit with full materials', () => {
    const run = makeRunState();
    const data = getBossExitChoiceData(run);
    expect(data.safeExitReward.exitType).toBe('safe');
    expect(data.safeExitReward.materials).toEqual(run.economy.materials);
    expect(data.safeExitReward.xp).toBe(run.hero.runXP);
  });

  it('getBossExitChoiceData returns continue risk warning string', () => {
    const run = makeRunState();
    const data = getBossExitChoiceData(run);
    expect(data.continueRisk).toContain('Death');
    expect(data.continueRisk.length).toBeGreaterThan(0);
  });
});
