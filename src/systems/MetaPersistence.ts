import { createStore, get, set } from 'idb-keyval';
import { MetaState, createDefaultMetaState, migrateMetaState } from '../state/MetaState';

const metaStore = createStore('autoscroller-meta', 'meta-state');

export async function loadMetaState(): Promise<MetaState> {
  const raw = await get('meta', metaStore);
  if (!raw) return createDefaultMetaState();
  return migrateMetaState(raw);
}

export async function saveMetaState(state: MetaState): Promise<void> {
  // Phase 9 (Design v2) Pitfall 5: strip the transient `_wipedFromVersion`
  // flag before persisting. Defense-in-depth: MainMenu also strips on read,
  // but layering it here guarantees the flag never round-trips through IDB
  // and re-fires the welcome notice on subsequent boots.
  const { _wipedFromVersion, ...clean } = state;
  void _wipedFromVersion; // explicitly drop
  await set('meta', clean, metaStore);
}
