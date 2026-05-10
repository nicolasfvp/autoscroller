import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadMetaState, saveMetaState } from '../../src/systems/MetaPersistence';
import { createDefaultMetaState } from '../../src/state/MetaState';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Reset IndexedDB between tests
beforeEach(() => {
  // Delete all databases to ensure clean state
  indexedDB = new IDBFactory();
});

describe('MetaPersistence', () => {
  it('loadMetaState returns createDefaultMetaState() on first call (no saved data)', async () => {
    const state = await loadMetaState();
    const defaults = createDefaultMetaState();
    expect(state).toEqual(defaults);
  });

  it('saveMetaState then loadMetaState returns the saved state with matching fields', async () => {
    const state = createDefaultMetaState();
    state.materials = { essence: 150, wood: 30 };
    state.classXP.warrior = 500;
    state.buildings.forge.level = 2;
    state.unlockedCards = ['fury', 'iron-skin'];
    state.totalRuns = 5;

    await saveMetaState(state);
    const loaded = await loadMetaState();

    expect(loaded.materials).toEqual({ essence: 150, wood: 30 });
    expect(loaded.classXP.warrior).toBe(500);
    expect(loaded.buildings.forge.level).toBe(2);
    expect(loaded.unlockedCards).toEqual(['fury', 'iron-skin']);
    expect(loaded.totalRuns).toBe(5);
    expect(loaded.version).toBe(5);
  });

  it('uses a separate store name from run state (autoscroller-meta)', async () => {
    // This test validates the import path references the correct store name
    // We verify by checking the module source contains the expected store name
    const moduleSource = readFileSync(resolve(__dirname, '../../src/systems/MetaPersistence.ts'), 'utf8');
    expect(moduleSource).toContain('autoscroller-meta');
  });
});
