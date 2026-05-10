import { Scene } from 'phaser';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';
import { getAudioManager } from '../audio/AudioManager';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import { createDefaultMetaState, type MetaState } from '../state/MetaState';
import { saveManager } from '../core/SaveManager';
import { SCENE_KEYS } from '../state/SceneKeys';

/**
 * SettingsScene -- full settings overlay with volume, speed, save management.
 * No RunState dependency -- settings are global, not per-run.
 */
export class SettingsScene extends Scene {
  private metaState!: MetaState;
  private gameSpeed: number = 1;
  private autoSave: boolean = true;
  private sfxVolume: number = 1;
  private sfxEnabled: boolean = true;

  // UI references for dynamic updates
  private volumeThumb!: Phaser.GameObjects.Rectangle;
  private volumeLabel!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;
  private speedBtn!: Phaser.GameObjects.Text;
  private autoSaveBtn!: Phaser.GameObjects.Text;
  private confirmContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super(SCENE_KEYS.SETTINGS);
  }

  async create(): Promise<void> {
    // Load current settings
    this.metaState = await loadMetaState();
    this.sfxVolume = this.metaState.audioPrefs.sfxVolume;
    this.sfxEnabled = this.metaState.audioPrefs.sfxEnabled;
    this.gameSpeed = this.metaState.gameSpeed;
    this.autoSave = this.metaState.autoSave;

    // Apply loaded audio prefs
    const audio = getAudioManager();
    audio.setSFXVolume(this.sfxVolume);
    audio.setEnabled(this.sfxEnabled);

    // Overlay panel
    this.add.rectangle(LAYOUT.centerX, LAYOUT.centerY, 600, 500, COLORS.panel, LAYOUT.panelAlpha).setInteractive();

    // Title
    this.add.text(LAYOUT.centerX, 120, 'Settings', {
      ...FONTS.title,
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    this.createVolumeSlider();
    this.createMuteToggle();
    this.createGameSpeedToggle();
    this.createAutoSaveToggle();
    this.createDeleteRunButton();
    this.createResetAllButton();
    this.createBackButton();

    this.events.on('shutdown', this.cleanup, this);
  }

  // ── SFX Volume Slider (y: 200) ──────────────────────────
  private createVolumeSlider(): void {
    // Label
    this.add.text(200, 192, 'SFX Volume', {
      ...FONTS.body,
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
    }).setOrigin(0, 0.5);

    // Track
    this.add.rectangle(400, 200, 300, 10, COLORS.panel).setOrigin(0, 0.5);

    // Thumb
    const thumbX = 400 + this.sfxVolume * 300;
    this.volumeThumb = this.add.rectangle(thumbX, 200, 20, 30, 0x000000)
      .setInteractive({ useHandCursor: true, draggable: true });
    // Set accent color as number
    this.volumeThumb.setFillStyle(0xffd700);

    this.input.setDraggable(this.volumeThumb);

    // Volume percentage label
    this.volumeLabel = this.add.text(710, 192, `${Math.round(this.sfxVolume * 100)}%`, {
      ...FONTS.body,
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
    }).setOrigin(0, 0.5);

    this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number) => {
      if (gameObject !== this.volumeThumb) return;
      const clampedX = Math.max(400, Math.min(700, dragX));
      this.volumeThumb.x = clampedX;
      this.sfxVolume = (clampedX - 400) / 300;
      this.volumeLabel.setText(`${Math.round(this.sfxVolume * 100)}%`);
      getAudioManager().setSFXVolume(this.sfxVolume);
    });
  }

  // ── Mute Toggle (y: 245) ────────────────────────────────
  private createMuteToggle(): void {
    const label = this.sfxEnabled ? 'SFX: ON' : 'SFX: OFF';
    this.muteBtn = createButton(this, LAYOUT.centerX, 245, label, () => {
      this.sfxEnabled = !this.sfxEnabled;
      getAudioManager().setEnabled(this.sfxEnabled);
      this.muteBtn.setText(this.sfxEnabled ? 'SFX: ON' : 'SFX: OFF');
    }, 'secondary');
  }

  // ── Game Speed Toggle (y: 300) ──────────────────────────
  private createGameSpeedToggle(): void {
    this.add.text(200, 292, 'Game Speed', {
      ...FONTS.body,
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
    }).setOrigin(0, 0.5);

    const label = this.gameSpeed === 1 ? '1x' : '2x';
    this.speedBtn = createButton(this, 500, 300, label, () => {
      this.gameSpeed = this.gameSpeed === 1 ? 2 : 1;
      this.speedBtn.setText(this.gameSpeed === 1 ? '1x' : '2x');
    }, 'secondary');
  }

  // ── Auto-Save Toggle (y: 350) ──────────────────────────
  private createAutoSaveToggle(): void {
    this.add.text(200, 342, 'Auto-Save', {
      ...FONTS.body,
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
    }).setOrigin(0, 0.5);

    const label = this.autoSave ? 'ON' : 'OFF';
    this.autoSaveBtn = createButton(this, 500, 350, label, () => {
      this.autoSave = !this.autoSave;
      this.autoSaveBtn.setText(this.autoSave ? 'ON' : 'OFF');
    }, 'secondary');
  }

  // ── Delete Run Button (y: 420) ──────────────────────────
  private createDeleteRunButton(): void {
    const btn = createButton(this, LAYOUT.centerX, 420, 'Delete Current Run', () => {
      this.showConfirmation(
        'Are you sure? This deletes the current run but keeps meta progress.',
        'Yes, Delete',
        async () => {
          await saveManager.clear();
          this.hideConfirmation();
          // Show brief feedback
          const feedback = this.add.text(LAYOUT.centerX, 420, 'Run Deleted', {
            ...FONTS.body, color: COLORS.accent, fontFamily: FONTS.family,
          }).setOrigin(0.5);
          this.time.delayedCall(1500, () => feedback.destroy());
        },
      );
    }, 'secondary');
    btn.setColor(COLORS.danger);
  }

  // ── Reset All Progress Button (y: 470) ─────────────────
  private createResetAllButton(): void {
    const btn = createButton(this, LAYOUT.centerX, 470, 'Reset All Progress', () => {
      this.showConfirmation(
        'This erases ALL progress. Are you sure?',
        'Yes',
        () => {
          this.hideConfirmation();
          // Second confirmation
          this.showConfirmation(
            'FINAL WARNING: All buildings, unlocks, and materials will be lost.',
            'Yes, Reset Everything',
            async () => {
              await saveManager.clear();
              await saveMetaState(createDefaultMetaState());
              this.metaState = createDefaultMetaState();
              this.hideConfirmation();
              const feedback = this.add.text(LAYOUT.centerX, 470, 'All Progress Reset', {
                ...FONTS.body, color: COLORS.accent, fontFamily: FONTS.family,
              }).setOrigin(0.5);
              this.time.delayedCall(1500, () => feedback.destroy());
            },
          );
        },
      );
    }, 'secondary');
    btn.setColor(COLORS.danger);
  }

  // ── Back Button (y: 540) ───────────────────────────────
  private createBackButton(): void {
    createButton(this, LAYOUT.centerX, 540, 'Back', () => this.saveAndClose(), 'primary');
  }

  // ── Confirmation overlay ───────────────────────────────
  private showConfirmation(message: string, confirmLabel: string, onConfirm: () => void): void {
    this.hideConfirmation();
    this.confirmContainer = this.add.container(0, 0);

    const bg = this.add.rectangle(LAYOUT.centerX, LAYOUT.centerY, 500, 180, 0x000000, 0.85).setInteractive();
    this.confirmContainer.add(bg);

    const msg = this.add.text(LAYOUT.centerX, LAYOUT.centerY - 30, message, {
      ...FONTS.body, color: COLORS.textPrimary, fontFamily: FONTS.family,
      align: 'center', wordWrap: { width: 440 },
    }).setOrigin(0.5);
    this.confirmContainer.add(msg);

    const yesBtn = createButton(this, LAYOUT.centerX - 80, LAYOUT.centerY + 40, confirmLabel, onConfirm, 'secondary');
    this.confirmContainer.add(yesBtn);

    const noBtn = createButton(this, LAYOUT.centerX + 80, LAYOUT.centerY + 40, 'Cancel', () => this.hideConfirmation(), 'secondary');
    this.confirmContainer.add(noBtn);
  }

  private hideConfirmation(): void {
    if (this.confirmContainer) {
      this.confirmContainer.destroy(true);
      this.confirmContainer = null;
    }
  }

  // ── Save and Close ─────────────────────────────────────
  private async saveAndClose(): Promise<void> {
    this.metaState.audioPrefs = {
      sfxVolume: this.sfxVolume,
      sfxEnabled: this.sfxEnabled,
    };
    this.metaState.gameSpeed = this.gameSpeed;
    this.metaState.autoSave = this.autoSave;
    await saveMetaState(this.metaState);

    this.scene.stop();
    this.scene.resume(SCENE_KEYS.PAUSE);
  }

  private cleanup(): void {
    this.confirmContainer = null;
  }
}
