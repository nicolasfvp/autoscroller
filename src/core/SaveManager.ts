import { get, set, del, createStore } from 'idb-keyval';
import { migrateRunState, RUN_STATE_VERSION, type RunState } from '../state/RunState';
import { eventBus } from './EventBus';
import { loadMetaState } from '../systems/MetaPersistence';
import { dailySeedString } from '../systems/DailySeed';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';

const gameStore = createStore('rogue-scroll-db', 'save-store');
const SAVE_KEY = 'active-run';
const DAILY_SAVE_KEY = 'active-daily-run';

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
    // Route daily runs to their own slot so they never clobber a normal save.
    const key = state.mode === 'daily' ? DAILY_SAVE_KEY : SAVE_KEY;
    try {
      const toSave = { ...state };
      if (toSave.isInCombat) {
        toSave.isInCombat = false;
        toSave.currentScene = 'GameScene';
      }
      // Persist scripted first-run tutorial progress with the run. The
      // director is an in-memory singleton, so without this a reload +
      // Continue lands back in the run with the tutorial silently gone.
      // Daily runs never run the tutorial, so they don't record one.
      if (state.mode !== 'daily') {
        toSave.tutorial = tutorialDirector.snapshot();
      }
      await set(key, toSave, gameStore);
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
      const migrated = migrateRunState(saved);
      if (!migrated) return null;
      // D-07: incompatible save -- clear and start fresh.
      if (!migrated.version || migrated.version < RUN_STATE_VERSION) {
        await this.clear();
        // Phase 9 (Plan 4): surface to MainMenu for one-shot notice.
        // globalThis side-channel chosen over a custom event because the
        // boot path runs before any scene/eventBus listeners are wired.
        if (typeof globalThis !== 'undefined') {
          (globalThis as { __runStateClearedOnBoot?: boolean }).__runStateClearedOnBoot = true;
        }
        return null;
      }
      return migrated;
    } catch (err) {
      console.error('Load failed:', err);
      return null;
    }
  }

  /**
   * Load the daily save, but only if its seed matches today's daily seed.
   * Yesterday's save (still sitting in IDB from a previous session) is
   * silently cleared rather than returned — the broker topic and ticker key
   * off today's date and there's no value in resuming a stale run.
   */
  async loadDaily(): Promise<RunState | null> {
    try {
      const saved = await get<unknown>(DAILY_SAVE_KEY, gameStore);
      if (!saved) return null;
      const migrated = migrateRunState(saved);
      if (!migrated) return null;
      if (!migrated.version || migrated.version < RUN_STATE_VERSION) {
        await this.clearDaily();
        return null;
      }
      if (migrated.mode !== 'daily' || migrated.seed !== dailySeedString()) {
        await this.clearDaily();
        return null;
      }
      return migrated;
    } catch (err) {
      console.error('Daily load failed:', err);
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

  async clearDaily(): Promise<void> {
    try {
      await del(DAILY_SAVE_KEY, gameStore);
    } catch (err) {
      console.error('Daily clear failed:', err);
    }
  }

  /**
   * Clear the slot that matches the supplied mode. Used by death / abandon
   * paths so a daily-run death never wipes a normal-run save and vice versa.
   * Emits run:cleared regardless of mode so downstream singletons drain.
   */
  async clearByMode(mode: 'normal' | 'daily' | undefined): Promise<void> {
    if (mode === 'daily') {
      await this.clearDaily();
      eventBus.emit('run:cleared', {});
      return;
    }
    await this.clear();
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
