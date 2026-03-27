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
  classXP: { warrior: number };
  passivesUnlocked: string[];
  unlockedCards: string[];
  unlockedRelics: string[];
  unlockedTiles: string[];
  runHistory: RunHistoryEntry[];
  totalRuns: number;
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
    classXP: { warrior: 0 },
    passivesUnlocked: [],
    unlockedCards: [],
    unlockedRelics: [],
    unlockedTiles: [],
    runHistory: [],
    totalRuns: 0,
    version: 2,
  };
}

export function migrateMetaState(raw: any): MetaState {
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
    return {
      ...createDefaultMetaState(),
      ...raw,
      materials,
      buildings,
      runHistory: history,
      version: 2,
    };
  }
  return raw as MetaState;
}
