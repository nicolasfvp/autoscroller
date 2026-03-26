import { createStore, get, set } from 'idb-keyval';
import { MetaState, createDefaultMetaState } from '../state/MetaState';

const metaStore = createStore('autoscroller-meta', 'meta-state');

export async function loadMetaState(): Promise<MetaState> {
  const saved = await get<MetaState>('meta', metaStore);
  if (!saved) return createDefaultMetaState();
  // Schema migration: merge with defaults so new fields get default values
  const defaults = createDefaultMetaState();
  return { ...defaults, ...saved, version: defaults.version };
}

export async function saveMetaState(state: MetaState): Promise<void> {
  await set('meta', state, metaStore);
}
