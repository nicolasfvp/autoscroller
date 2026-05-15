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
  RUN_TRANSITION: 'RunTransitionScene',
  GLOBAL_SOUND: 'GlobalSound',
  FORGE: 'ForgeScene',
  DECK_BUILDER: 'DeckBuilderScene',
} as const;

export type SceneKey = typeof SCENE_KEYS[keyof typeof SCENE_KEYS];

export const REGISTRY_KEYS = {
  SAVED_RUN: 'savedRun',
} as const;

/**
 * Stop all scenes that belong to an active run to prevent leaks
 * when returning to the menu or starting a new run.
 */
export function stopAllRunScenes(scene: Phaser.Scene, exclude?: string): void {
  const runScenes = [
    SCENE_KEYS.GAME,
    SCENE_KEYS.COMBAT,
    SCENE_KEYS.PLANNING,
    SCENE_KEYS.BOSS_EXIT,
    SCENE_KEYS.SHOP,
    SCENE_KEYS.DECK_CUSTOMIZATION,
    SCENE_KEYS.RELIC_VIEWER,
    SCENE_KEYS.PAUSE,
    SCENE_KEYS.SETTINGS,
    SCENE_KEYS.GAME_OVER,
    SCENE_KEYS.DEATH
  ];
  runScenes.forEach(key => {
    if (key !== exclude && scene.scene.get(key)) {
      scene.scene.stop(key);
    }
  });
}
