/**
 * Centralized scene + registry keys to prevent rename drift across the
 * codebase. Use these constants instead of inline string literals when
 * adding new scene transitions or registry reads.
 *
 * Existing call sites still use literals — migrate opportunistically
 * rather than in a single sweeping diff.
 */

export const SCENE_KEYS = {
  BOOT: 'Boot',
  PRELOADER: 'Preloader',
  MAIN_MENU: 'MainMenu',
  GAME: 'GameScene',
  COMBAT: 'CombatScene',
  PLANNING: 'PlanningOverlay',
  PLANNING_OVERLAY: 'PlanningOverlay',
  BOSS_EXIT: 'BossExitScene',
  DEATH: 'DeathScene',
  GAME_OVER: 'GameOverScene',
  CITY_HUB: 'CityHub',
  SHOP: 'ShopScene',
  PAUSE: 'PauseScene',
  SETTINGS: 'SettingsScene',
  CHARACTER_SELECT: 'CharacterSelectScene',
  TUTORIAL: 'TutorialScene',
  COLLECTION: 'CollectionScene',
  DECK_CUSTOMIZATION: 'DeckCustomizationScene',
  RELIC_VIEWER: 'RelicViewerScene',
  BUILDING_PANEL: 'BuildingPanelScene',
  TAVERN_PANEL: 'TavernPanelScene',
  GLOBAL_SOUND: 'GlobalSound',
} as const;

export type SceneKey = typeof SCENE_KEYS[keyof typeof SCENE_KEYS];

export const REGISTRY_KEYS = {
  SAVED_RUN: 'savedRun',
} as const;
