import { describe, it, expect, beforeEach } from 'vitest';
import { LoopRunner, TILE_SIZE, type LoopRunState } from '../../src/systems/LoopRunner';

interface EmittedEvent {
  event: string;
  data: any;
}

function createTestRunState(): LoopRunState {
  return {
    loop: {
      count: 0,
      length: 0,
      tiles: [],
      positionInLoop: 0,
      difficultyMultiplier: 1.0,
    },
    economy: { gold: 0, tilePoints: 0, materials: { essence: 50, wood: 20 } },
    tileInventory: [],
    hero: { xp: 30 },
  };
}

describe('LoopRunner', () => {
  let events: EmittedEvent[];
  let emit: (event: string, data: any) => void;
  let runner: LoopRunner;
  let runState: LoopRunState;

  beforeEach(() => {
    events = [];
    emit = (event, data) => events.push({ event, data });
    // Use deterministic rng that always returns 0 (triggers basic tile combat)
    runner = new LoopRunner(emit, () => 0);
    runState = createTestRunState();
  });

  it('initial state is idle', () => {
    expect(runner.getState()).toBe('idle');
  });

  it('idle state does not advance on tick', () => {
    runner.tick(1000);
    expect(runner.getState()).toBe('idle');
  });

  it('startRun sets state to traversing with 15 basic tiles', () => {
    runner.startRun(runState);
    expect(runner.getState()).toBe('traversing');
    expect(runState.loop.count).toBe(1);
    expect(runState.loop.length).toBe(15);
    expect(runState.loop.tiles).toHaveLength(15);
    expect(runState.loop.tiles.every(t => t.type === 'basic')).toBe(true);
    expect(runState.loop.positionInLoop).toBe(0);
  });

  it('tick advances positionInLoop', () => {
    runner.startRun(runState);
    runner.tick(1000); // speed=60 at loop 1, so position += 60
    expect(runState.loop.positionInLoop).toBeGreaterThan(0);
  });

  it('tile boundary crossing triggers onTileEntered', () => {
    runner.startRun(runState);
    // Move enough to cross into tile 1 (need > 80px)
    // speed=60px/s, so at 2000ms = 120px -> tile index 1
    // But rng=0 < 0.10 triggers combat on basic tile
    runner.tick(2000);
    // Should have entered tile 0 first (position starts at 0, so tile 0 is entered immediately on first tick)
    // Actually tile index 0 is entered when lastTileIndex changes from -1 to 0
    expect(runner.getState()).toBe('tile-interaction');
    expect(events.some(e => e.event === 'combat-start')).toBe(true);
  });

  it('defeated tiles are skipped', () => {
    runner.startRun(runState);
    // Mark tile 0 as defeated
    runState.loop.tiles[0].defeatedThisLoop = true;
    // Tick to tile 0 - should be skipped (speed=240px/s, 100ms=24px, still on tile 0)
    runner.tick(100);
    // State should still be traversing since tile 0 is already defeated
    expect(runner.getState()).toBe('traversing');
  });

  it('loop wraps when position exceeds loop length * TILE_SIZE', () => {
    runner.startRun(runState);
    // Mark all tiles as defeated so no interaction stops traversal
    for (const t of runState.loop.tiles) {
      t.defeatedThisLoop = true;
    }
    // Total loop = 15 * 80 = 1200px. Speed = 60px/s.
    // Need 1200/60 = 20 seconds to complete a loop
    // Tick in big chunks
    for (let i = 0; i < 25; i++) {
      if (runner.getState() !== 'traversing') break;
      runner.tick(1000);
    }
    // After wrapping, state should be planning
    expect(runner.getState()).toBe('planning');
    expect(runState.loop.count).toBe(2);
    expect(events.some(e => e.event === 'loop-completed')).toBe(true);
  });

  it('loop completion adds 2 tile points to existing balance', () => {
    runner.startRun(runState);
    // Start with 0 TP, after loop completion should have 2
    for (const t of runState.loop.tiles) {
      t.defeatedThisLoop = true;
    }
    for (let i = 0; i < 25; i++) {
      if (runner.getState() !== 'traversing') break;
      runner.tick(1000);
    }
    // baseTilePointsPerLoop=2, tilePointScalePerLoop=0 → +2
    expect(runState.economy.tilePoints).toBe(2);
  });

  it('loop completion resets defeatedThisLoop flags', () => {
    runner.startRun(runState);
    for (const t of runState.loop.tiles) {
      t.defeatedThisLoop = true;
    }
    for (let i = 0; i < 25; i++) {
      if (runner.getState() !== 'traversing') break;
      runner.tick(1000);
    }
    expect(runState.loop.tiles.every(t => t.defeatedThisLoop === false)).toBe(true);
  });

  it('boss tile injected at last position on loop 5', () => {
    runner.startRun(runState);
    // Simulate completing loops 1-4 to reach loop 5
    for (let loop = 0; loop < 4; loop++) {
      for (const t of runState.loop.tiles) {
        t.defeatedThisLoop = true;
      }
      for (let i = 0; i < 30; i++) {
        if (runner.getState() !== 'traversing') break;
        runner.tick(1000);
      }
      // After loop completion, state is 'planning'
      if (runner.getState() === 'planning') {
        runner.confirmPlanning();
      }
    }
    // After 4 loops complete, count is 5. Boss tile should be injected.
    // We need to check when count%5===0 which is loop 5
    expect(runState.loop.count).toBe(5);
    expect(runState.loop.tiles[runState.loop.length - 1].type).toBe('boss');
  });

  it('state transitions to planning after loop completion', () => {
    runner.startRun(runState);
    for (const t of runState.loop.tiles) {
      t.defeatedThisLoop = true;
    }
    for (let i = 0; i < 25; i++) {
      if (runner.getState() !== 'traversing') break;
      runner.tick(1000);
    }
    expect(runner.getState()).toBe('planning');
    expect(events.some(e => e.event === 'planning-phase-started')).toBe(true);
  });

  it('confirmPlanning transitions to traversing', () => {
    runner.startRun(runState);
    for (const t of runState.loop.tiles) {
      t.defeatedThisLoop = true;
    }
    for (let i = 0; i < 25; i++) {
      if (runner.getState() !== 'traversing') break;
      runner.tick(1000);
    }
    expect(runner.getState()).toBe('planning');
    runner.confirmPlanning();
    expect(runner.getState()).toBe('traversing');
    expect(events.some(e => e.event === 'loop-started')).toBe(true);
  });

  it('placeTile replaces basic slot with given tile type', () => {
    runner.startRun(runState);
    for (const t of runState.loop.tiles) {
      t.defeatedThisLoop = true;
    }
    for (let i = 0; i < 25; i++) {
      if (runner.getState() !== 'traversing') break;
      runner.tick(1000);
    }
    expect(runner.getState()).toBe('planning');
    const result = runner.placeTile(0, 'forest');
    expect(result).toBe(true);
    expect(runState.loop.tiles[0].type).toBe('terrain');
    expect(runState.loop.tiles[0].terrain).toBe('forest');
  });

  it('placeTile rejects non-basic slot', () => {
    runner.startRun(runState);
    for (const t of runState.loop.tiles) {
      t.defeatedThisLoop = true;
    }
    for (let i = 0; i < 25; i++) {
      if (runner.getState() !== 'traversing') break;
      runner.tick(1000);
    }
    // Place a forest tile first
    runner.placeTile(0, 'forest');
    // Try to place again on the same slot (now terrain, not basic)
    const result = runner.placeTile(0, 'shop');
    expect(result).toBe(false);
  });

  it('placeTile rejects when not in planning state', () => {
    runner.startRun(runState);
    expect(runner.getState()).toBe('traversing');
    const result = runner.placeTile(0, 'forest');
    expect(result).toBe(false);
  });

  it('onBossChoice exit resolves run with 100% materials', () => {
    runner.startRun(runState);
    runState.economy.materials = { essence: 100, wood: 30 };
    runState.hero = { xp: 50 };
    // Simulate boss defeat
    runner.onBossDefeated();
    expect(runner.getState()).toBe('boss-choice');
    const result = runner.onBossChoice('exit');
    expect(runner.getState()).toBe('run-ended');
    expect(result).toEqual({ exitType: 'safe', materials: { essence: 100, wood: 30 }, xp: 50 });
    expect(events.some(e => e.event === 'run-exited')).toBe(true);
  });

  it('onBossChoice continue grows loop by first schedule value (3 tiles)', () => {
    runner.startRun(runState);
    const originalLength = runState.loop.length;
    runner.onBossDefeated();
    runner.onBossChoice('continue');
    // First boss kill: schedule[0] = 3
    expect(runState.loop.length).toBe(originalLength + 3);
    expect(runState.loop.tiles).toHaveLength(originalLength + 3);
    expect(runner.getState()).toBe('planning');
  });

  it('terrain tile entry emits combat-start with terrain enemy', () => {
    // Use rng=0 so it picks first enemy from pool
    runner = new LoopRunner(emit, () => 0);
    runner.startRun(runState);
    // Place a forest tile at position 1 with pre-assigned enemy
    runState.loop.tiles[1] = { type: 'terrain', terrain: 'forest', defeatedThisLoop: false, enemyId: 'slime' };
    // Skip tile 0 by marking it defeated
    runState.loop.tiles[0].defeatedThisLoop = true;
    // Tick to reach tile 1
    for (let i = 0; i < 5; i++) {
      if (runner.getState() !== 'traversing') break;
      runner.tick(500);
    }
    const combatEvent = events.find(e => e.event === 'combat-start');
    expect(combatEvent).toBeDefined();
    expect(combatEvent!.data.terrain).toBe('forest');
    expect(combatEvent!.data.enemyId).toBe('slime'); // first in forest pool
  });

  it('shop tile entry emits open-scene with ShopScene', () => {
    runner.startRun(runState);
    runState.loop.tiles[1] = { type: 'shop', defeatedThisLoop: false };
    runState.loop.tiles[0].defeatedThisLoop = true;
    for (let i = 0; i < 5; i++) {
      if (runner.getState() !== 'traversing') break;
      runner.tick(500);
    }
    const sceneEvent = events.find(e => e.event === 'open-scene');
    expect(sceneEvent).toBeDefined();
    expect(sceneEvent!.data.scene).toBe('ShopScene');
  });

  it('resumeTraversal transitions back to traversing', () => {
    runner.startRun(runState);
    // Trigger a tile interaction
    runner.tick(500);
    // rng=0 triggers combat on basic tile
    if (runner.getState() === 'tile-interaction') {
      runner.resumeTraversal();
      expect(runner.getState()).toBe('traversing');
    }
  });

  it('tick does nothing when state is not traversing', () => {
    runner.startRun(runState);
    runner.onBossDefeated(); // state -> boss-choice
    const posBefore = runState.loop.positionInLoop;
    runner.tick(1000);
    expect(runState.loop.positionInLoop).toBe(posBefore);
  });

  it('onBossDefeated emits boss-defeated event', () => {
    runner.startRun(runState);
    runner.onBossDefeated();
    expect(events.some(e => e.event === 'boss-defeated')).toBe(true);
    expect(runner.getState()).toBe('boss-choice');
  });

  it('confirmPlanning recalculates synergy buffs', () => {
    runner.startRun(runState);
    for (const t of runState.loop.tiles) {
      t.defeatedThisLoop = true;
    }
    for (let i = 0; i < 25; i++) {
      if (runner.getState() !== 'traversing') break;
      runner.tick(1000);
    }
    // Place two adjacent forest tiles
    runner.placeTile(0, 'forest');
    runner.placeTile(1, 'forest');
    runner.confirmPlanning();
    const buffs = runner.getActiveBuffs();
    expect(buffs.some(b => b.type === 'goldDropBonus')).toBe(true);
  });
});
