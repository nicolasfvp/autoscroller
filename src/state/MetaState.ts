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

/** Renderer supersample preset selectable in SettingsScene → Graphics Quality.
 *  - 'high'        → UI_SCALE 2.0 (canvas 1600×1200, sharpest downscale).
 *  - 'balanced'    → UI_SCALE 1.5 (canvas 1200×900, ~44% less pixel fill).
 *  - 'performance' → UI_SCALE 1.0 (canvas 800×600, native — fastest).
 *
 *  Read at game-init time via the `autoscroller:gfxQuality` localStorage
 *  mirror (see src/main.ts) because Phaser canvas dimensions are locked in
 *  the GameConfig before any async MetaState load can complete. Changing
 *  the setting therefore requires a page reload to take effect. */
export type GraphicsQuality = 'high' | 'balanced' | 'performance';

export const GRAPHICS_QUALITY_TO_UI_SCALE: Record<GraphicsQuality, number> = {
  high: 2,
  balanced: 1.5,
  performance: 1,
};

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
  /** UI scale multiplier for every card visual. Range 0.75..1.25 in
   *  ~6% steps (-25% / -12% / 0 / +12% / +25%). Read by CardFace via
   *  getMetaStateSync(); default is 1. */
  cardScale: number;
  /** Graphics quality preset. Drives the canvas supersample factor (UI_SCALE)
   *  read at game init from localStorage. Default 'balanced'. */
  graphicsQuality: GraphicsQuality;
  version: number;
  /** Discovered forge recipes (element multisets) — meta-persistent. */
  forgeRecipes: ForgeRecipeEntry[];
  /** Saved starter-deck presets, 5 per class. */
  deckPresets: Record<string, DeckPresetEntry[]>;
  /** Keywords the player has encountered in-game at least once. Drives the
   *  contextual keyword-intro overlay (first-encounter pause + explanation)
   *  and gates the persistent glossary panel to learned terms only. */
  seenKeywords: string[];
  /** One-shot flag set by migrateMetaState on a v3/v4/v5 -> v6 wipe.
   *  Plan 4 reads & strips this before MetaPersistence.saveMetaState.
   *  (Pitfall 5: not part of the persisted shape.) */
  _wipedFromVersion?: number;
}

const DEFAULT_PRESETS: Record<string, DeckPresetEntry[]> = {
  warrior: [
    { name: 'Default Warrior', cardIds: ['t2-attack-attack', 't2-defense-defense', 't2-attack-defense', 't2-agility-agility', 't2-attack-fire'] },
    { name: 'Preset 2', cardIds: [] },
    { name: 'Preset 3', cardIds: [] },
    { name: 'Preset 4', cardIds: [] },
    { name: 'Preset 5', cardIds: [] },
  ],
  mage: [
    { name: 'Default Mage', cardIds: ['t2-fire-fire', 't2-water-water', 't2-fire-water', 't2-air-earth', 't2-attack-fire'] },
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
    cardScale: 1,
    graphicsQuality: 'balanced',
    version: 12,
    forgeRecipes: [],
    deckPresets: JSON.parse(JSON.stringify(DEFAULT_PRESETS)),
    seenKeywords: [],
  };
}

/**
 * Shift card IDs from the pre-rename (t0/t1/t2) prefix scheme to the
 * post-rename (t1/t2/t3) one. Done in reverse order to avoid collisions
 * (t2 -> t3 first so the t1 -> t2 step doesn't double-promote).
 */
function shiftCardIdTiers(id: string): string {
  if (id.startsWith('t2-')) return 't3-' + id.slice(3);
  if (id.startsWith('t1-')) return 't2-' + id.slice(3);
  if (id.startsWith('t0-')) return 't1-' + id.slice(3);
  return id;
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

  // v8 -> v9 migration: seenKeywords tracking for beginner-mode contextual
  // teaching. Empty array on existing saves means returning players see the
  // intro overlay once for any keyword they happen to play, then move on.
  if (raw.version === 8) {
    if (!Array.isArray(raw.seenKeywords)) raw.seenKeywords = [];
    raw.version = 9;
  }

  // v9 -> v10 migration: tier renumber (t0/t1/t2 -> t1/t2/t3). Shift every
  // saved card-id reference so older saves don't pin 5 dead IDs into the
  // deck builder (which then refuses to accept any new card because the
  // pre-fill consumes all 5 starter slots with ghosts).
  if (raw.version === 9) {
    if (Array.isArray(raw.unlockedCards)) {
      raw.unlockedCards = raw.unlockedCards.map(shiftCardIdTiers);
    }
    if (raw.deckPresets && typeof raw.deckPresets === 'object') {
      for (const cls of Object.keys(raw.deckPresets)) {
        const presets = raw.deckPresets[cls];
        if (!Array.isArray(presets)) continue;
        for (const p of presets) {
          if (Array.isArray(p?.cardIds)) {
            p.cardIds = p.cardIds.map(shiftCardIdTiers);
          }
        }
      }
    }
    if (Array.isArray(raw.forgeRecipes)) {
      for (const r of raw.forgeRecipes) {
        if (r && typeof r.cardId === 'string') r.cardId = shiftCardIdTiers(r.cardId);
      }
    }
    raw.version = 10;
  }

  // v10 -> v11 migration: cardScale UI preference. Default to 1 (no change).
  if (raw.version === 10) {
    if (typeof raw.cardScale !== 'number') raw.cardScale = 1;
    raw.version = 11;
  }

  // v11 -> v12 migration: graphicsQuality preset. Existing players default to
  // 'balanced' (1.5x supersample) since 2x was previously hardcoded and is
  // the source of the perf regression the v12 setting exists to mitigate.
  // Anyone who wants the old crispness can opt back into 'high' from
  // SettingsScene → Graphics Quality.
  if (raw.version === 11) {
    const q = raw.graphicsQuality;
    if (q !== 'high' && q !== 'balanced' && q !== 'performance') {
      raw.graphicsQuality = 'balanced';
    }
    raw.version = 12;
  }

  return raw as MetaState;
}
