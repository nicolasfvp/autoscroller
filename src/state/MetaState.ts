export interface MaterialDefinition {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare';
}

/** Meta-persistent forge recipe (discovered combinations). */
export interface ForgeRecipeEntry {
  key: string;
  elements: string[];
  cardId: string;
  firstForgedAt: number;
}

/** Saveable starter-deck preset. */
export interface DeckPresetEntry {
  name: string;
  cardIds: string[];
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
  /** Discovered forge recipes (element multisets) — meta-persistent. */
  forgeRecipes: ForgeRecipeEntry[];
  /** Saved starter-deck presets, 5 per class. */
  deckPresets: Record<string, DeckPresetEntry[]>;
  /** One-shot flag set by migrateMetaState on a v3/v4/v5 -> v6 wipe.
   *  Plan 4 reads & strips this before MetaPersistence.saveMetaState.
   *  (Pitfall 5: not part of the persisted shape.) */
  _wipedFromVersion?: number;
}

const DEFAULT_PRESETS: Record<string, DeckPresetEntry[]> = {
  warrior: [
    { name: 'Default Warrior', cardIds: ['t1-attack-attack', 't1-defense-defense', 't1-attack-defense', 't1-agility-agility', 't1-attack-fire'] },
    { name: 'Preset 2', cardIds: [] },
    { name: 'Preset 3', cardIds: [] },
    { name: 'Preset 4', cardIds: [] },
    { name: 'Preset 5', cardIds: [] },
  ],
  mage: [
    { name: 'Default Mage', cardIds: ['t1-fire-fire', 't1-water-water', 't1-fire-water', 't1-air-earth', 't1-attack-fire'] },
    { name: 'Preset 2', cardIds: [] },
    { name: 'Preset 3', cardIds: [] },
    { name: 'Preset 4', cardIds: [] },
    { name: 'Preset 5', cardIds: [] },
  ],
};

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
    version: 8,
    forgeRecipes: [],
    deckPresets: JSON.parse(JSON.stringify(DEFAULT_PRESETS)),
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
  // Wipe returns a v7 default (post-Shadowblade-removal); skip the
  // v6->v7 step below since the fresh state is already v7.
  if (raw.version === 3 || raw.version === 4 || raw.version === 5) {
    const fresh = createDefaultMetaState();
    fresh._wipedFromVersion = raw.version;
    return fresh;
  }

  // v6 -> v7 migration: Shadowblade class removed. Drop classXP.shadowblade
  // and reset any selectedClass === "shadowblade" to "warrior".
  if (raw.version === 6) {
    const classXP = raw.classXP ?? {};
    if ('shadowblade' in classXP) delete classXP.shadowblade;
    raw.classXP = {
      warrior: classXP.warrior ?? 0,
      mage: classXP.mage ?? 0,
    };
    if (raw.selectedClass === 'shadowblade') raw.selectedClass = 'warrior';
    raw.version = 7;
  }

  // v7 -> v8 migration: element/forge system additions.
  // Backfill forgeRecipes (empty list) and deckPresets (defaults per class).
  if (raw.version === 7) {
    if (!Array.isArray(raw.forgeRecipes)) raw.forgeRecipes = [];
    if (!raw.deckPresets || typeof raw.deckPresets !== 'object') {
      raw.deckPresets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
    } else {
      // Ensure both classes have arrays.
      if (!Array.isArray(raw.deckPresets.warrior)) raw.deckPresets.warrior = JSON.parse(JSON.stringify(DEFAULT_PRESETS.warrior));
      if (!Array.isArray(raw.deckPresets.mage)) raw.deckPresets.mage = JSON.parse(JSON.stringify(DEFAULT_PRESETS.mage));
    }
    raw.version = 8;
  }

  return raw as MetaState;
}
