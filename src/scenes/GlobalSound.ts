import { Scene } from 'phaser';
import { AudioManager } from '../systems/AudioManager';

/**
 * GlobalSound scene stays active throughout the entire game.
 * It handles cross-scene audio logic like the global click sound.
 */
export class GlobalSound extends Scene {
  constructor() {
    super({ key: 'GlobalSound' });
  }

  create(): void {
    // Listen for any pointer down event in the entire game
    // Note: We use the game's input manager to catch events even if scenes are paused or overlaid
    this.input.on('pointerdown', () => {
      AudioManager.playSFX(this, 'sfx_click', 0.25);
    });
    
    console.log('GlobalSound scene active - Global click listener initialized');
  }
}
