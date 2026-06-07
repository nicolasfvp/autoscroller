import { Scene } from 'phaser';
import { getRun, clearRun } from '../state/RunState';
import { saveManager } from '../core/SaveManager';
import { SCENE_KEYS, REGISTRY_KEYS, stopAllRunScenes } from '../state/SceneKeys';

/**
 * PauseScene -- overlay with Resume, Settings, Abandon Run buttons.
 * No RunState mutation. Reads run only for display context.
 */
export class PauseScene extends Scene {
  constructor() {
    super(SCENE_KEYS.PAUSE);
  }

  create(): void {
    // PauseScene is launched on top of an already-running GameScene; bringToTop
    // ensures the overlay is actually visible above it.
    this.scene.bringToTop();

    // Previously this called getRun() as a "verify active state" guard, but
    // getRun() THROWS when no run exists, which aborts create() before any
    // GameObject is added — the user sees a paused game with no overlay.
    // The pause UI itself doesn't depend on RunState; Abandon Run consults
    // it defensively below.

    // Fullscreen semi-transparent backdrop — delay interactivity so the ESC
    // press that *opened* the pause doesn't immediately dismiss it.
    const backdrop = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.75);
    this.time.delayedCall(100, () => {
      backdrop.setInteractive();
      this.input.keyboard?.on('keydown-ESC', () => this.resume());
    });

    // Título — y=105, fontSize=42
    this.add.bitmapText(400, 105, 'game_font_white', 'PAUSED', 42).setOrigin(0.5);

    this.makePauseBtn('btn_resume_pause',     401.6, 171.6, 204, 50, () => this.resume());
    this.makePauseBtn('btn_view_deck_pause',  400.5, 236.8, 196, 50, () => {
      this.scene.pause();
      this.scene.launch(SCENE_KEYS.DECK_CUSTOMIZATION, { parentScene: SCENE_KEYS.PAUSE });
    });
    this.makePauseBtn('btn_tutorial_pause',   400,   300,   196, 50, () => {
      this.scene.pause();
      this.scene.launch(SCENE_KEYS.TUTORIAL, { replay: true, parentScene: SCENE_KEYS.PAUSE });
    });
    this.makePauseBtn('btn_settings_pause',   400,   365.8, 200, 50, () => {
      this.scene.pause();
      this.scene.launch(SCENE_KEYS.SETTINGS);
    });
    this.makePauseBtn('btn_abandon_run_pause', 402.6, 432.1, 210, 50, async () => {
      const mode = (() => { try { return getRun().mode; } catch { return undefined; } })();
      this.registry.set(REGISTRY_KEYS.SAVED_RUN, null);
      stopAllRunScenes(this, SCENE_KEYS.PAUSE);
      await saveManager.clearByMode(mode);
      clearRun();
      this.scene.start(SCENE_KEYS.MAIN_MENU);
    });

    this.events.on('shutdown', this.cleanup, this);
  }

  private makePauseBtn(key: string, x: number, y: number, w: number, _h: number, cb: () => void): void {
    const img = this.add.image(0, 0, key);
    const sc = w / img.width;
    img.setScale(sc);
    const dh = img.height * sc;
    const cont = this.add.container(x, y, [img]).setSize(w, dh).setInteractive({ useHandCursor: true });
    cont.on('pointerover', () => this.tweens.add({ targets: cont, scale: 1.05, duration: 100 }));
    cont.on('pointerout',  () => this.tweens.add({ targets: cont, scale: 1,    duration: 100 }));
    cont.on('pointerdown', cb);
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume(SCENE_KEYS.GAME);
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
