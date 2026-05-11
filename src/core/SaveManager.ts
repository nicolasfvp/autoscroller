import { get, set, del, createStore } from 'idb-keyval';
import { migrateRunState, type RunState } from '../state/RunState';
import { eventBus } from './EventBus';
import { loadMetaState } from '../systems/MetaPersistence';

const gameStore = createStore('rogue-scroll-db', 'save-store');
const SAVE_KEY = 'active-run';

// Cache the MetaState autoSave preference briefly so doSave doesn't hit
// IndexedDB on every combat:end / loop:completed event. SettingsScene
// updates MetaState directly, so a short TTL keeps toggles snappy.
const AUTO_SAVE_CACHE_TTL_MS = 1000;
let cachedAutoSaveEnabled: boolean | null = null;
let cachedAutoSaveAt = 0;

async function isAutoSaveAllowedByMeta(): Promise<boolean> {
  const now = Date.now();
  if (cachedAutoSaveEnabled !== null && now - cachedAutoSaveAt < AUTO_SAVE_CACHE_TTL_MS) {
    return cachedAutoSaveEnabled;
  }
  try {
    const meta = await loadMetaState();
    cachedAutoSaveEnabled = meta.autoSave !== false;
  } catch {
    // If MetaState can't be read, default to enabled — saving is the safer
    // failure mode than silently dropping run progress.
    cachedAutoSaveEnabled = true;
  }
  cachedAutoSaveAt = now;
  return cachedAutoSaveEnabled;
}

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
    const doSave = async () => {
      // Caller-provided gate first (legacy callers may pass a closure-cached flag).
      if (isEnabled && !isEnabled()) return;
      // Always honor MetaState.autoSave === false. Read lazily so SettingsScene
      // toggles take effect without re-subscribing. Cached briefly inside
      // isAutoSaveAllowedByMeta() to avoid IDB pressure under bursty events.
      const allowed = await isAutoSaveAllowedByMeta();
      if (!allowed) return;
      await this.save(getState());
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
