import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveManager } from '../../src/core/SaveManager';
import { eventBus } from '../../src/core/EventBus';
import { createNewRun, type RunState } from '../../src/state/RunState';

describe('SaveManager', () => {
  let manager: SaveManager;

  beforeEach(async () => {
    manager = new SaveManager();
    await manager.clear();
    eventBus.removeAllListeners();
  });

  it('save then load returns deep-equal RunState', async () => {
    const run = createNewRun();
    run.hero.currentHP = 42;
    run.economy.gold = 100;

    await manager.save(run);
    const loaded = await manager.load();

    expect(loaded).not.toBeNull();
    expect(loaded!.hero.currentHP).toBe(42);
    expect(loaded!.economy.gold).toBe(100);
    expect(loaded!.runId).toBe(run.runId);
  });

  it('load returns null when no save exists', async () => {
    const fresh = new SaveManager();
    // Use a separate store key to ensure isolation
    const loaded = await fresh.load();
    expect(loaded).toBeNull();
  });

  it('clear then load returns null', async () => {
    const run = createNewRun();
    await manager.save(run);
    await manager.clear();
    const loaded = await manager.load();
    expect(loaded).toBeNull();
  });

  it('save with isInCombat=true stores isInCombat=false and currentScene=Game', async () => {
    const run = createNewRun();
    run.isInCombat = true;
    run.currentScene = 'CombatScene';

    await manager.save(run);
    const loaded = await manager.load();

    expect(loaded).not.toBeNull();
    expect(loaded!.isInCombat).toBe(false);
    expect(loaded!.currentScene).toBe('Game');
  });

  it('save emits save:completed event with timestamp', async () => {
    const run = createNewRun();
    const handler = vi.fn();
    eventBus.on('save:completed', handler);

    await manager.save(run);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toHaveProperty('timestamp');
    expect(typeof handler.mock.calls[0][0].timestamp).toBe('number');
  });

  it('setupAutoSave registers listeners on combat:end and loop:completed', async () => {
    const run = createNewRun();
    const getState = () => run;

    const saveSpy = vi.spyOn(manager, 'save');
    manager.setupAutoSave(getState);

    // Emit combat:end
    eventBus.emit('combat:end', { victory: true, goldEarned: 10, cardDrops: [] });
    // Wait for async save
    await new Promise((r) => setTimeout(r, 50));
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Emit loop:completed
    eventBus.emit('loop:completed', { loopNumber: 1, difficulty: 1 });
    await new Promise((r) => setTimeout(r, 50));
    expect(saveSpy).toHaveBeenCalledTimes(2);
  });
});
