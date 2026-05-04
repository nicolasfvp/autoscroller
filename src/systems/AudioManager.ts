import { Scene } from 'phaser';

/**
 * AudioManager handles cross-fading between soundtracks.
 */
export class AudioManager {
  private static currentKey: string | null = null;
  private static currentSound: Phaser.Sound.BaseSound | null = null;

  /**
   * Transitions to a new background music track with a crossfade effect.
   * 
   * @param scene The current active scene to run tweens on.
   * @param key The asset key of the new song.
   * @param config Configuration including volume and duration.
   */
  static transitionTo(
    scene: Scene, 
    key: string, 
    config: { loop?: boolean; volume?: number; duration?: number } = {}
  ): void {
    const { loop = true, volume = 0.4, duration = 1000 } = config;

    // 1. If already playing this song, do nothing
    if (this.currentKey === key && this.currentSound?.isPlaying) {
      return;
    }

    // 2. Fade out current sound if exists
    if (this.currentSound) {
      const oldSound = this.currentSound;
      scene.tweens.add({
        targets: oldSound,
        volume: 0,
        duration: duration,
        onComplete: () => {
          oldSound.stop();
          oldSound.destroy();
        }
      });
    }

    // 3. Start new sound at volume 0 and fade in
    this.currentKey = key;
    const newSound = scene.sound.add(key, { loop, volume: 0 });
    this.currentSound = newSound;
    newSound.play();

    scene.tweens.add({
      targets: newSound,
      volume: volume,
      duration: duration
    });

    // Update registry to keep track globally
    scene.registry.set('current_bgm_key', key);
  }

  /**
   * Plays a one-off sound effect.
   */
  static playSFX(scene: Scene, key: string, volume: number = 0.5): void {
    scene.sound.play(key, { volume });
  }

  private static ambienceSound: Phaser.Sound.BaseSound | null = null;
  private static ambienceKey: string | null = null;

  /**
   * Manages an ambience layer (like wind) that can loop independently of music.
   */
  static transitionAmbience(
    scene: Scene,
    key: string,
    config: { volume?: number; duration?: number } = {}
  ): void {
    const { volume = 0.2, duration = 1000 } = config;

    if (this.ambienceKey === key && this.ambienceSound?.isPlaying) {
      this.ambienceSound.setVolume(volume);
      return;
    }

    if (this.ambienceSound) {
      const old = this.ambienceSound;
      scene.tweens.add({
        targets: old,
        volume: 0,
        duration,
        onComplete: () => { old.stop(); old.destroy(); }
      });
    }

    this.ambienceKey = key;
    const sound = scene.sound.add(key, { loop: true, volume: 0 });
    this.ambienceSound = sound;
    sound.play();

    scene.tweens.add({
      targets: sound,
      volume: volume,
      duration
    });
  }

  /**
   * Helper to stop ambience.
   */
  static stopAmbience(scene: Scene, duration: number = 1000): void {
    if (this.ambienceSound) {
      const s = this.ambienceSound;
      scene.tweens.add({
        targets: s,
        volume: 0,
        duration,
        onComplete: () => { s.stop(); this.ambienceSound = null; this.ambienceKey = null; }
      });
    }
  }

  /**
   * Fades out the current music entirely.
   */
  static fadeOut(scene: Scene, duration: number = 1000): void {
    if (this.currentSound) {
      const sound = this.currentSound;
      scene.tweens.add({
        targets: sound,
        volume: 0,
        duration: duration,
        onComplete: () => {
          sound.stop();
          this.currentSound = null;
          this.currentKey = null;
          scene.registry.set('current_bgm_key', null);
        }
      });
    }
  }

  /**
   * Helper to stop everything immediately without fades.
   */
  static stopAll(scene: Scene): void {
    scene.sound.stopAll();
    this.currentSound = null;
    this.currentKey = null;
    this.ambienceSound = null;
    this.ambienceKey = null;
    scene.registry.set('current_bgm_key', null);
  }

  /**
   * Sets up a listener for the global click sound on a scene's input.
   */
  static setupGlobalClick(scene: Scene): void {
    scene.input.on('pointerdown', () => {
      this.playSFX(scene, 'sfx_click', 0.25);
    });
  }
}
