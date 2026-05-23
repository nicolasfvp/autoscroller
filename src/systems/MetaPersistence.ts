import { createStore, get, set } from 'idb-keyval';
import { MetaState, createDefaultMetaState, migrateMetaState } from '../state/MetaState';

const metaStore = createStore('autoscroller-meta', 'meta-state');

// Synchronous cache of the most recently loaded/saved MetaState. UI code
// (CardFace.ts) needs to read user prefs like cardScale on every render
// and cannot block on IndexedDB; the cache is hydrated by loadMetaState()
// and updated by saveMetaState(). Falls back to defaults when un-hydrated.
let cachedMeta: MetaState | null = null;

export function getMetaStateSync(): MetaState {
  return cachedMeta ?? createDefaultMetaState();
}

export async function loadMetaState(): Promise<MetaState> {
  const raw = await get('meta', metaStore);
  const state = raw ? migrateMetaState(raw) : createDefaultMetaState();
  cachedMeta = state;
  return state;
}

export async function saveMetaState(state: MetaState): Promise<void> {
  // Phase 9 (Design v2) Pitfall 5: strip the transient `_wipedFromVersion`
  // flag before persisting. Defense-in-depth: MainMenu also strips on read,
  // but layering it here guarantees the flag never round-trips through IDB
  // and re-fires the welcome notice on subsequent boots.
  const { _wipedFromVersion, ...clean } = state;
  void _wipedFromVersion; // explicitly drop
  cachedMeta = clean as MetaState;
  await set('meta', clean, metaStore);
}
