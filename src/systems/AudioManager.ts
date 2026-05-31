import { Scene } from 'phaser';
import { SCENE_KEYS } from '../state/SceneKeys';

// Module-level master volume / mute. These multiply into every volume this
// manager passes to Phaser's WebAudio mixer, so the SettingsScene slider/toggle
// actually control the audio the game plays (SFX + BGM + ambience). They live
// at module scope (not on a scene) so they survive scene transitions and apply
// to the next play() even before we have a scene reference.
let masterVolume = 1;
let muted = false;

function effectiveVolume(base: number): number {
  return muted ? 0 : base * masterVolume;
}

/**
 * AudioManager handles cross-fading between soundtracks.
 */
export class AudioManager {
  private static currentKey: string | null = null;
  private static currentSound: Phaser.Sound.BaseSound | null = null;
  /** Remembered so a later setMasterVolume can re-apply to a live music track. */
  private static currentBgmVolume = 0.4;
  private static ambienceVolume = 0.2;

  /**
   * Set the global master volume (0..1). Applied to every subsequent play,
   * and re-applied immediately to any music/ambience already playing.
   */
  static setMasterVolume(v: number): void {
    masterVolume = Math.max(0, Math.min(1, v));
    this.reapplyLiveVolumes();
  }

  /** Get the current master volume multiplier (0..1). */
  static getMasterVolume(): number {
    return masterVolume;
  }

  /** Mute / unmute all audio routed through this manager. */
  static setMuted(m: boolean): void {
    muted = m;
    this.reapplyLiveVolumes();
  }

  static isMuted(): boolean {
    return muted;
  }

  /** Re-apply the current master/mute multiplier to any live BGM + ambience. */
  private static reapplyLiveVolumes(): void {
    const bgm = this.currentSound as
      | Phaser.Sound.WebAudioSound
      | Phaser.Sound.HTML5AudioSound
      | null;
    if (bgm && bgm.isPlaying) bgm.setVolume(effectiveVolume(this.currentBgmVolume));
    const amb = this.ambienceSound as
      | Phaser.Sound.WebAudioSound
      | Phaser.Sound.HTML5AudioSound
      | null;
    if (amb && amb.isPlaying) amb.setVolume(effectiveVolume(this.ambienceVolume));
  }

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

    // Use GlobalSound scene for persistent audio tweens if available
    const audioScene = scene.scene.get(SCENE_KEYS.GLOBAL_SOUND) || scene;

    // 1. If already playing this song, do nothing
    if (this.currentKey === key && this.currentSound?.isPlaying) {
      return;
    }

    // 2. Fade out current sound if exists
    if (this.currentSound) {
      const oldSound = this.currentSound;
      audioScene.tweens.add({
        targets: oldSound,
        volume: 0,
        duration: duration,
        onComplete: () => {
          oldSound.stop();
          oldSound.destroy();
        }
      });
    }

    // 3. Start new sound at volume 0 and fade in to the master-adjusted target.
    this.currentKey = key;
    this.currentBgmVolume = volume;
    const newSound = audioScene.sound.add(key, { loop, volume: 0 });
    this.currentSound = newSound;
    newSound.play();

    audioScene.tweens.add({
      targets: newSound,
      volume: effectiveVolume(volume),
      duration: duration
    });

    // Update registry to keep track globally
    scene.registry.set('current_bgm_key', key);
  }

  /**
   * Plays a one-off sound effect.
   */
  static playSFX(scene: Scene, key: string, volume: number = 0.5): void {
    const v = effectiveVolume(volume);
    if (v <= 0) return;
    scene.sound.play(key, { volume: v });
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
    this.ambienceVolume = volume;

    // Use GlobalSound scene for persistent audio tweens if available
    const audioScene = scene.scene.get(SCENE_KEYS.GLOBAL_SOUND) || scene;

    if (this.ambienceKey === key && this.ambienceSound?.isPlaying) {
      (this.ambienceSound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(effectiveVolume(volume));
      return;
    }

    if (this.ambienceSound) {
      const old = this.ambienceSound;
      audioScene.tweens.add({
        targets: old,
        volume: 0,
        duration,
        onComplete: () => { old.stop(); old.destroy(); }
      });
    }

    this.ambienceKey = key;
    const sound = audioScene.sound.add(key, { loop: true, volume: 0 });
    this.ambienceSound = sound;
    sound.play();

    audioScene.tweens.add({
      targets: sound,
      volume: effectiveVolume(volume),
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
