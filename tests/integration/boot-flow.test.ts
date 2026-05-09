import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from '../../src/core/SaveManager';
import { createNewRun, clearRun } from '../../src/state/RunState';
import { eventBus } from '../../src/core/EventBus';

describe('Boot Flow Integration', () => {
  let saveManager: SaveManager;

  beforeEach(async () => {
    saveManager = new SaveManager();
    await saveManager.clear();
    clearRun();
    eventBus.removeAllListeners();
  });

  it('save then load round-trips gold and loop count', async () => {
    const run = createNewRun();
    run.economy.gold = 50;
    run.loop.count = 3;

    await saveManager.save(run);
    const loaded = await saveManager.load();

    expect(loaded).not.toBeNull();
    expect(loaded!.economy.gold).toBe(50);
    expect(loaded!.loop.count).toBe(3);
  });

  it('save then clear then load returns null', async () => {
    const run = createNewRun();
    run.economy.gold = 100;

    await saveManager.save(run);
    await saveManager.clear();
    const loaded = await saveManager.load();

    expect(loaded).toBeNull();
  });

  it('createNewRun produces JSON-serializable state (round-trip)', () => {
    const run = createNewRun();
    const serialized = JSON.stringify(run);
    const deserialized = JSON.parse(serialized);

    expect(deserialized).toEqual(run);
  });

  it('save with isInCombat=true loads as isInCombat=false and currentScene=GameScene', async () => {
    const run = createNewRun();
    run.isInCombat = true;
    run.currentScene = 'CombatScene';

    await saveManager.save(run);
    const loaded = await saveManager.load();

    expect(loaded).not.toBeNull();
    expect(loaded!.isInCombat).toBe(false);
    expect(loaded!.currentScene).toBe('GameScene');
  });

  it('two sequential saves: load returns the latest state', async () => {
    const run = createNewRun();

    // First save: combat end state
    run.economy.gold = 25;
    run.loop.count = 1;
    await saveManager.save(run);

    // Second save: loop complete state
    run.economy.gold = 40;
    run.loop.count = 2;
    await saveManager.save(run);

    const loaded = await saveManager.load();

    expect(loaded).not.toBeNull();
    expect(loaded!.economy.gold).toBe(40);
    expect(loaded!.loop.count).toBe(2);
  });
});
