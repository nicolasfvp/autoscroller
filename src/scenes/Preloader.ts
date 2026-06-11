import { Scene } from 'phaser';
import { saveManager } from '../core/SaveManager';
import { eventBus } from '../core/EventBus';
import { LAYOUT } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';
import { loadMenuCritical, loaderTarget } from './AssetManifest';

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  preload(): void {
    // Load ONLY the ~2MB menu-critical set (MainMenu art + buttons + bitmap
    // fonts + menu audio) so the first screen paints in ~1s instead of waiting
    // for the full ~800MB library. Everything else is streamed in the
    // background by GlobalSound (warmAllAssets) and guaranteed by per-scene
    // preloads on GameScene / CharacterSelect / CombatScene. See AssetManifest.
    loadMenuCritical(loaderTarget(this.load));
  }

  async create(): Promise<void> {
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);
    // Show a simple loading indicator
    this.add.rectangle(400, 300, 468, 32).setStrokeStyle(1, 0xffffff);
    const bar = this.add.rectangle(400 - 230, 300, 4, 28, 0xffffff);

    // Simulate brief load
    bar.width = 464;

    // Check for existing saved run
    const savedRun = await saveManager.load();

    // Pass saved run info to MainMenu via registry as a fast-paint hint.
    // Invalidation contract: MainMenu always re-loads from IDB before
    // deciding whether to show "Continue", and removes this key after
    // reading. Other scenes that clear the run also null this out via
    // the run:cleared listener below, so a stale hint can never survive
    // long enough to mislead the menu.
    this.registry.set('savedRun', savedRun);

    // Keep the registry copy in sync when the active run is cleared elsewhere
    // (PauseScene "Abandon Run", BossExitScene safe path, DeathScene, etc.)
    const game = this.game;
    eventBus.on('run:cleared', () => {
      game.registry.set('savedRun', null);
    });

    this.scene.launch('GlobalSound');
    this.scene.launch(SCENE_KEYS.SPEED_PANEL);
    this.scene.start('MainMenu');
  }
}
