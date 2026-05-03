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
    scene.registry.set('current_bgm_key', null);
  }
}
