import { get, set, del, createStore } from 'idb-keyval';
import type { RunState } from '../state/RunState';
import { eventBus } from './EventBus';

const gameStore = createStore('rogue-scroll-db', 'save-store');
const SAVE_KEY = 'active-run';

export class SaveManager {
  async save(state: RunState): Promise<void> {
    try {
      const toSave = { ...state };
      if (toSave.isInCombat) {
        toSave.isInCombat = false;
        toSave.currentScene = 'Game';
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
      const saved = await get<RunState>(SAVE_KEY, gameStore);
      if (saved) {
        // Migrate old saves
        if (!saved.deck.droppedCards) {
          saved.deck.droppedCards = [];
        }
        if (saved.stopAtShop === undefined) {
          saved.stopAtShop = true;
        }
        if (saved.combatSpeed === undefined) {
          saved.combatSpeed = 1;
        }
      }
      return saved ?? null;
    } catch (err) {
      console.error('Load failed:', err);
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      await del(SAVE_KEY, gameStore);
    } catch (err) {
      console.error('Clear failed:', err);
    }
  }

  setupAutoSave(getState: () => RunState): void {
    const doSave = () => this.save(getState());
    eventBus.on('combat:end', doSave);
    eventBus.on('loop:completed', doSave);
  }
}

export const saveManager = new SaveManager();
