import { get, set, del, createStore } from 'idb-keyval';
import { migrateRunState, type RunState } from '../state/RunState';
import { eventBus } from './EventBus';

const gameStore = createStore('rogue-scroll-db', 'save-store');
const SAVE_KEY = 'active-run';

export class SaveManager {
  async save(state: RunState): Promise<void> {
    try {
      const toSave = { ...state };
      if (toSave.isInCombat) {
        toSave.isInCombat = false;
        toSave.currentScene = 'GameScene';
      }
      await set(SAVE_KEY, toSave, gameStore);
      eventBus.emit('save:completed', { timestamp: Date.now() });
    } catch (err) {
      console.error('Save failed:', err);
      // Do not throw -- save failure should not crash the game
    }
  }

  async load(): Promise<RunState | null> {
    try {
      const saved = await get<unknown>(SAVE_KEY, gameStore);
      if (!saved) return null;
      // Route every load through migrateRunState — versioned schema
      // means future field additions are one-line migrations instead
      // of more ad-hoc field-presence checks here.
      return migrateRunState(saved);
    } catch (err) {
      console.error('Load failed:', err);
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      await del(SAVE_KEY, gameStore);
      eventBus.emit('run:cleared', {});
    } catch (err) {
      console.error('Clear failed:', err);
    }
  }

  /**
   * Subscribes save() to combat:end and loop:completed events.
   * Returns an unsubscribe function — call it from the scene's shutdown
   * handler to avoid stacked listeners across scene restarts.
   *
   * Optional `isEnabled` predicate is checked before each save so users
   * can disable auto-save via MetaState.autoSave without re-subscribing.
   */
  setupAutoSave(getState: () => RunState, isEnabled?: () => boolean): () => void {
    const doSave = () => {
      if (isEnabled && !isEnabled()) return;
      this.save(getState());
    };
    eventBus.on('combat:end', doSave);
    eventBus.on('loop:completed', doSave);
    return () => {
      eventBus.off('combat:end', doSave);
      eventBus.off('loop:completed', doSave);
    };
  }
}

export const saveManager = new SaveManager();
