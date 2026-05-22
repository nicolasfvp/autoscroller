import { describe, it, expect, afterEach } from 'vitest';
import { openTreasure } from '../../src/systems/TreasureSystem';
import { setRNG, resetRNG } from '../../src/systems/LootGenerator';

function makeRunState(): any {
  return {
    hero: { currentHP: 100, maxHP: 100, currentStamina: 50, maxStamina: 50, currentMana: 30, maxMana: 30, runXP: 0, totalXP: 0, currentDefense: 0, strength: 1, defenseMultiplier: 1, moveSpeed: 2 },
    deck: { active: ['strike', 'defend'], inventory: {}, upgraded: [false, false], droppedCards: [] },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 15, positionInLoop: 0, difficultyMultiplier: 1.0 },
    economy: { gold: 50, tilePoints: 5, tileInventory: {}, materials: {} },
    relics: [],
    runId: 'test',
    generation: 1,
    startedAt: 0,
    isInCombat: false,
    currentScene: 'GameScene',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
  };
}

describe('TreasureSystem', () => {
  afterEach(() => {
    resetRNG();
  });

  it('openTreasure returns 1-3 items', () => {
    // Use a deterministic RNG that produces 1 item (gold)
    let callCount = 0;
    const values = [0.0, 0.1, 0.5]; // itemCount=1, weight roll=gold, goldAmount roll
    setRNG({ next: () => values[callCount++] ?? 0.5 });

    const run = makeRunState();
    const result = openTreasure(run, 1);
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items.length).toBeLessThanOrEqual(3);
  });

  it('openTreasure gold items add to economy.gold', () => {
    let callCount = 0;
    // itemCount: floor(0.0*3)+1=1, weight roll: 0.1 < 0.40 = gold, goldAmount: floor((20+0.5*30)*sqrt(1)) = floor(35) = 35
    const values = [0.0, 0.1, 0.5];
    setRNG({ next: () => values[callCount++] ?? 0.5 });

    const run = makeRunState();
    openTreasure(run, 1);
    expect(run.economy.gold).toBe(85); // 50 + 35
  });

  it('openTreasure tile items add to tileInventory', () => {
    let callCount = 0;
    // itemCount: floor(0.0*3)+1=1, weight roll: 0.75 (>0.70 <0.90 = tile), tileIndex roll: 0.0 (first placeable)
    const values = [0.0, 0.75, 0.0];
    setRNG({ next: () => values[callCount++] ?? 0.5 });

    const run = makeRunState();
    openTreasure(run, 1);
    expect(Object.keys(run.economy.tileInventory).length).toBeGreaterThan(0);
  });

  it('openTreasure returns TreasureResult with item descriptions', () => {
    let callCount = 0;
    const values = [0.0, 0.1, 0.5];
    setRNG({ next: () => values[callCount++] ?? 0.5 });

    const run = makeRunState();
    const result = openTreasure(run, 1);
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.type).toBeTruthy();
    }
  });

  it('openTreasure card items add to deck.active', () => {
    let callCount = 0;
    // itemCount: 1, weight roll: 0.5 (>0.40 <0.70 = card)
    const values = [0.0, 0.5];
    setRNG({ next: () => values[callCount++] ?? 0.5 });

    const run = makeRunState();
    const origLen = run.deck.active.length;
    openTreasure(run, 1);
    expect(run.deck.active.length).toBe(origLen + 1);
  });

  it('openTreasure relic items add to relics', () => {
    let callCount = 0;
    // itemCount: 1, weight roll: 0.95 (>0.90 = relic)
    const values = [0.0, 0.95];
    setRNG({ next: () => values[callCount++] ?? 0.5 });

    const run = makeRunState();
    openTreasure(run, 1);
    expect(run.relics.length).toBe(1);
  });
});
