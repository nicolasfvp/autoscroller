// Phase 9 (Design v2): Phaser-free helpers for MainMenu's wipe-notice flow.
// Pitfall 5: `_wipedFromVersion` is a transient flag that MUST NOT persist
// past the boot it was created on. consumeWipeFlag mutates the MetaState
// in-place to strip the field after reading it once.

import type { MetaState } from '../state/MetaState';

/**
 * Read + strip the one-shot `_wipedFromVersion` flag from MetaState.
 * Returns the value (or undefined if not set). Mutates the input.
 *
 * Pattern: register the value somewhere transient (Phaser registry / module
 * global / closure) and immediately delete it from MetaState so the next
 * MetaPersistence.saveMetaState call doesn't reanimate the notice.
 */
export function consumeWipeFlag(meta: MetaState): number | undefined {
  const value = meta._wipedFromVersion;
  if (value !== undefined) {
    delete meta._wipedFromVersion;
  }
  return value;
}

/**
 * UI-SPEC §Copywriting: welcome notice copy shown ONCE on first v4+ boot
 * after a save wipe migration. The notice is informational (D-06: wipe is
 * automatic, not opt-in).
 */
export function formatWelcomeNotice(_wipedFrom?: number): string {
  // Copy is independent of the wiped-from version per UI-SPEC §Copywriting.
  return 'Welcome. Your previous progress has been reset for Design v2. Choose your hero.';
}

/**
 * UI-SPEC §Copywriting: save-incompatible notice copy used when SaveManager.load
 * cleared an in-progress RunState that was on an older version (D-07).
 */
export const SAVE_INCOMPATIBLE_COPY = {
  title: 'Save incompatible',
  body: 'Your previous save is from an earlier version of the game. Starting fresh.',
  cta: 'Continue',
} as const;
