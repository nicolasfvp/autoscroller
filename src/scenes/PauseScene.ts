import { Scene } from 'phaser';
import { getRun, clearRun } from '../state/RunState';
import { saveManager } from '../core/SaveManager';
import { FONTS } from '../ui/StyleConstants';
import { SCENE_KEYS, REGISTRY_KEYS, stopAllRunScenes } from '../state/SceneKeys';
import { createWoodButton } from '../ui/WoodButton';

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

    // Overlay panel (wood texture with rounded corners)
    const panel = this.add.image(400, 300, 'wood_texture_big').setDisplaySize(360, 460);
    panel.setInteractive();

    const shape = this.make.graphics();
    shape.fillStyle(0xffffff);
    shape.fillRoundedRect(220, 70, 360, 460, 16);
    panel.setMask(shape.createGeometryMask());

    // Title
    this.add.text(400, 105, 'PAUSED', {
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8,
      fontFamily: FONTS.body,
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', fill: true }
    }).setOrigin(0.5);

    createWoodButton(this, 400, 180, 'Resume', () => this.resume(),
      { width: 260, height: 52, fontSize: 22, variant: 'primary' });

    createWoodButton(this, 400, 240, 'View Deck', () => {
      this.scene.pause();
      this.scene.launch(SCENE_KEYS.DECK_CUSTOMIZATION, { parentScene: SCENE_KEYS.PAUSE });
    }, { width: 260, height: 52, fontSize: 22 });

    createWoodButton(this, 400, 300, 'Tutorial', () => {
      this.scene.pause();
      this.scene.launch(SCENE_KEYS.TUTORIAL, { replay: true, parentScene: SCENE_KEYS.PAUSE });
    }, { width: 260, height: 52, fontSize: 22 });

    createWoodButton(this, 400, 360, 'Settings', () => {
      this.scene.pause();
      this.scene.launch(SCENE_KEYS.SETTINGS);
    }, { width: 260, height: 52, fontSize: 22 });

    createWoodButton(this, 400, 420, 'Abandon Run', async () => {
      const mode = (() => { try { return getRun().mode; } catch { return undefined; } })();
      this.registry.set(REGISTRY_KEYS.SAVED_RUN, null);
      stopAllRunScenes(this, SCENE_KEYS.PAUSE);
      await saveManager.clearByMode(mode);
      clearRun();
      this.scene.start(SCENE_KEYS.MAIN_MENU);
    }, { width: 260, height: 52, fontSize: 22, variant: 'danger' });

    this.events.on('shutdown', this.cleanup, this);
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume(SCENE_KEYS.GAME);
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
