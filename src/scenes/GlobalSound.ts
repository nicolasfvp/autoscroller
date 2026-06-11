import { Scene } from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { SCENE_KEYS } from '../state/SceneKeys';
import { warmAllAssets } from './AssetManifest';

/**
 * GlobalSound scene stays active throughout the entire game.
 * It handles cross-scene audio logic like the global click sound, and hosts
 * the background asset pre-warm: because this scene is never shut down, its
 * loader keeps streaming the deferred (non-menu) asset library into the global
 * cache across every scene transition. See AssetManifest.warmAllAssets.
 */
export class GlobalSound extends Scene {
  constructor() {
    super({ key: SCENE_KEYS.GLOBAL_SOUND });
  }

  create(): void {
    // Listen for any pointer down event in the entire game
    // Note: We use the game's input manager to catch events even if scenes are paused or overlaid
    this.input.on('pointerdown', () => {
      AudioManager.playSFX(this, 'sfx_click', 0.25);
    });

    // Kick off the background pre-warm one tick after the menu paints so the
    // first frame isn't competing with the warmer's first fetches/uploads.
    this.time.delayedCall(300, () => warmAllAssets(this));
  }
}
