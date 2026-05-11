// Phase 9 (Design v2): logic-isolated tests for MainMenu's wipe-notice flow.
// Pitfall 5: `_wipedFromVersion` MUST NOT persist past the boot it was created
// on. consumeWipeFlag + MetaPersistence.saveMetaState layer the defense.

import { describe, it, expect } from 'vitest';
import {
  consumeWipeFlag,
  formatWelcomeNotice,
  SAVE_INCOMPATIBLE_COPY,
} from '../../src/scenes/MainMenu.helpers';
import { createDefaultMetaState, migrateMetaState } from '../../src/state/MetaState';

describe('consumeWipeFlag (Pitfall 5)', () => {
  it('returns the wipedFromVersion value when set', () => {
    const meta = createDefaultMetaState();
    meta._wipedFromVersion = 3;
    expect(consumeWipeFlag(meta)).toBe(3);
  });

  it('returns undefined when the flag is absent', () => {
    const meta = createDefaultMetaState();
    expect(consumeWipeFlag(meta)).toBeUndefined();
  });

  it('strips the flag from MetaState after reading (mutates input)', () => {
    const meta = createDefaultMetaState();
    meta._wipedFromVersion = 5;
    consumeWipeFlag(meta);
    expect(meta._wipedFromVersion).toBeUndefined();
    expect('_wipedFromVersion' in meta).toBe(false);
  });

  it('subsequent calls return undefined after consumption (idempotent)', () => {
    const meta = createDefaultMetaState();
    meta._wipedFromVersion = 4;
    expect(consumeWipeFlag(meta)).toBe(4);
    expect(consumeWipeFlag(meta)).toBeUndefined();
  });
});

describe('formatWelcomeNotice (UI-SPEC §Copywriting)', () => {
  it('returns the LOCKED welcome copy verbatim', () => {
    expect(formatWelcomeNotice(3)).toBe(
      'Welcome. Your previous progress has been reset for Design v2. Choose your hero.'
    );
  });

  it('copy does not vary with the wipedFromVersion input', () => {
    expect(formatWelcomeNotice(3)).toBe(formatWelcomeNotice(5));
    expect(formatWelcomeNotice(undefined)).toBe(formatWelcomeNotice(4));
  });
});

describe('SAVE_INCOMPATIBLE_COPY (UI-SPEC §Copywriting)', () => {
  it('title is "Save incompatible"', () => {
    expect(SAVE_INCOMPATIBLE_COPY.title).toBe('Save incompatible');
  });
  it('body matches UI-SPEC verbatim', () => {
    expect(SAVE_INCOMPATIBLE_COPY.body).toBe(
      'Your previous save is from an earlier version of the game. Starting fresh.'
    );
  });
  it('CTA is "Continue"', () => {
    expect(SAVE_INCOMPATIBLE_COPY.cta).toBe('Continue');
  });
});

describe('migrateMetaState ↔ wipe flag round-trip (Pitfall 5)', () => {
  it('migrating any pre-v6 save lands at v6 with the wipe flag set', () => {
    // The migration chain promotes v3→v4→v5→v6; the wipe captures the
    // version IMMEDIATELY BEFORE the wipe block (so always 5 after chain).
    const v3 = { ...createDefaultMetaState(), version: 3 };
    const migrated = migrateMetaState(v3);
    expect(migrated.version).toBe(6);
    expect(migrated._wipedFromVersion).toBeGreaterThanOrEqual(3);
    expect(migrated._wipedFromVersion).toBeLessThanOrEqual(5);
  });

  it('migrating a v5 save sets _wipedFromVersion = 5', () => {
    const v5 = { ...createDefaultMetaState(), version: 5 };
    const migrated = migrateMetaState(v5);
    expect(migrated.version).toBe(6);
    expect(migrated._wipedFromVersion).toBe(5);
  });

  it('after consumeWipeFlag, _wipedFromVersion is gone — defense-in-depth ready', () => {
    const v5 = { ...createDefaultMetaState(), version: 5 };
    const migrated = migrateMetaState(v5);
    expect(migrated._wipedFromVersion).toBeDefined();
    consumeWipeFlag(migrated);
    expect(migrated._wipedFromVersion).toBeUndefined();
    // The shape passed to saveMetaState would now persist clean.
  });
});
