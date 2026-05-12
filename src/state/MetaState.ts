export interface MaterialDefinition {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare';
}

export interface MetaState {
  buildings: {
    forge: { level: number };
    library: { level: number };
    tavern: { level: number };
    workshop: { level: number };
    shrine: { level: number };
    storehouse: { level: number };
  };
  materials: Record<string, number>;
  classXP: { warrior: number; mage: number; shadowblade: number };
  passivesUnlocked: string[];
  unlockedCards: string[];
  unlockedRelics: string[];
  unlockedTiles: string[];
  runHistory: RunHistoryEntry[];
  totalRuns: number;
  tutorialSeen: boolean;
  audioPrefs: {
    sfxVolume: number;   // 0-1 range
    sfxEnabled: boolean;
  };
  gameSpeed: number;     // 1 or 2
  autoSave: boolean;     // default true
  version: number;
  /** One-shot flag set by migrateMetaState on a v3/v4/v5 -> v6 wipe.
   *  Plan 4 reads & strips this before MetaPersistence.saveMetaState.
   *  (Pitfall 5: not part of the persisted shape.) */
  _wipedFromVersion?: number;
}

export interface RunHistoryEntry {
  seed: string;
  loopsCompleted: number;
  bossesDefeated: number;
  exitType: 'safe' | 'death';
  materialsEarned: Record<string, number>;
  xpEarned: number;
  timestamp: number;
  className: string;
}

export function createDefaultMetaState(): MetaState {
  return {
    buildings: {
      forge: { level: 0 },
      library: { level: 0 },
      tavern: { level: 0 },
      workshop: { level: 0 },
      shrine: { level: 0 },
      storehouse: { level: 0 },
    },
    materials: {},
    classXP: { warrior: 0, mage: 0, shadowblade: 0 },
    passivesUnlocked: [],
    unlockedCards: [],
    unlockedRelics: [],
    unlockedTiles: [],
    runHistory: [],
    totalRuns: 0,
    tutorialSeen: false,
    audioPrefs: { sfxVolume: 1, sfxEnabled: true },
    gameSpeed: 1,
    autoSave: true,
    version: 6,
  };
}

export function migrateMetaState(raw: any): MetaState {
  // Coerce version to a number — corrupt saves can have it as a string
  // ("3"), which then doesn't satisfy `< 2` even though it should.
  if (raw && typeof raw === 'object') {
    const v = Number(raw.version);
    raw.version = Number.isFinite(v) ? v : undefined;
  }
  // v1 -> v2 migration
  if (!raw || !raw.version || raw.version < 2) {
    const materials: Record<string, number> = {};
    if (typeof raw?.metaLoot === 'number' && raw.metaLoot > 0) {
      materials['essence'] = raw.metaLoot;
    }
    const buildings = raw?.buildings ?? createDefaultMetaState().buildings;
    if (!buildings.storehouse) {
      buildings.storehouse = { level: 0 };
    }
    const history = (raw?.runHistory ?? []).map((entry: any) => ({
      ...entry,
      materialsEarned: typeof entry.metaLootEarned === 'number'
        ? { essence: entry.metaLootEarned }
        : (entry.materialsEarned ?? {}),
    }));
    raw = {
      ...createDefaultMetaState(),
      ...raw,
      materials,
      buildings,
      runHistory: history,
      version: 2,
    };
  }

  // v2 -> v3 migration
  if (raw.version === 2) {
    raw = {
      ...raw,
      tutorialSeen: raw.tutorialSeen ?? false,
      audioPrefs: raw.audioPrefs ?? { sfxVolume: 1, sfxEnabled: true },
      gameSpeed: raw.gameSpeed ?? 1,
      autoSave: raw.autoSave ?? true,
      version: 3,
    };
  }

  // v3 -> v4 migration: add classXP.mage
  // Phase 9 (CR-02 fix): also widen classXP shape to include shadowblade
  // so a v3 save migrated forward to v4 doesn't leave the field undefined
  // before the v6 wipe. (Migrate path defensively backfills all three.)
  if (raw.version === 3) {
    raw = {
      ...raw,
      classXP: {
        warrior: raw.classXP?.warrior ?? 0,
        mage: raw.classXP?.mage ?? 0,
        shadowblade: raw.classXP?.shadowblade ?? 0,
      },
      version: 4,
    };
  }

  // v4 -> v5 migration: backfill className on existing run history entries
  if (raw.version === 4) {
    const history = (raw.runHistory ?? []).map((entry: any) => ({
      ...entry,
      className: entry.className ?? 'warrior',
    }));
    raw = {
      ...raw,
      runHistory: history,
      version: 5,
    };
  }

  // v3/v4/v5 -> v6 (Phase 9 / Design v2): full save wipe per D-06.
  // The v2 content rewrite (125 cards / 50 relics / 125 synergies) makes
  // preserving any prior unlock state meaningless -- a clean slate for v6
  // players. Re-applies for v3/v4 saves too in case migrate gets called on
  // an already-wiped fresh state with leftover stale fields.
  if (raw.version === 3 || raw.version === 4 || raw.version === 5) {
    const fresh = createDefaultMetaState();
    fresh._wipedFromVersion = raw.version;
    return fresh;
  }

  return raw as MetaState;
}
