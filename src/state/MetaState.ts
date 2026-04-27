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
  classXP: { warrior: number; mage: number };
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
}

export interface RunHistoryEntry {
  seed: string;
  loopsCompleted: number;
  bossesDefeated: number;
  exitType: 'safe' | 'death';
  materialsEarned: Record<string, number>;
  xpEarned: number;
  timestamp: number;
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
    classXP: { warrior: 0, mage: 0 },
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
    version: 4,
  };
}

export function migrateMetaState(raw: any): MetaState {
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
  if (raw.version === 3) {
    raw = {
      ...raw,
      classXP: {
        warrior: raw.classXP?.warrior ?? 0,
        mage: raw.classXP?.mage ?? 0,
      },
      version: 4,
    };
  }

  return raw as MetaState;
}
