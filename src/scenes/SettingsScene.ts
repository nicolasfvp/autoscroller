import { Scene } from 'phaser';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';
import { AudioManager } from '../systems/AudioManager';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import { createDefaultMetaState, type MetaState, type GraphicsQuality } from '../state/MetaState';
import { saveManager } from '../core/SaveManager';
import { SCENE_KEYS } from '../state/SceneKeys';

const GFX_QUALITY_ORDER: GraphicsQuality[] = ['performance', 'balanced', 'high'];
const GFX_QUALITY_LABEL: Record<GraphicsQuality, string> = {
  high: 'High (2.0x)',
  balanced: 'Balanced (1.5x)',
  performance: 'Performance (1.0x)',
};
const GFX_QUALITY_STORAGE_KEY = 'autoscroller:gfxQuality';

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
  private graphicsQuality: GraphicsQuality = 'balanced';
  private initialGraphicsQuality: GraphicsQuality = 'balanced';

  // UI references for dynamic updates
  private volumeThumb!: Phaser.GameObjects.Rectangle;
  private volumeLabel!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;
  private speedBtn!: Phaser.GameObjects.Text;
  private autoSaveBtn!: Phaser.GameObjects.Text;
  private graphicsQualityBtn!: Phaser.GameObjects.Text;
  private graphicsQualityNotice!: Phaser.GameObjects.Text;
  private confirmContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super(SCENE_KEYS.SETTINGS);
  }

  async create(): Promise<void> {
    this.scene.bringToTop();
    // Load current settings
    this.metaState = await loadMetaState();
    this.sfxVolume = this.metaState.audioPrefs.sfxVolume;
    this.sfxEnabled = this.metaState.audioPrefs.sfxEnabled;
    this.gameSpeed = this.metaState.gameSpeed;
    this.autoSave = this.metaState.autoSave;
    // Graphics quality preference; prefer the localStorage mirror so a player
    // who reload-applied a setting last session sees the actually-active value
    // even if MetaState save hadn't flushed yet (idb-keyval is async).
    const storedQ = this.readStoredGraphicsQuality();
    this.graphicsQuality = storedQ ?? this.metaState.graphicsQuality ?? 'balanced';
    this.initialGraphicsQuality = this.graphicsQuality;

    // Apply loaded audio prefs to the REAL audio path (the static
    // systems/AudioManager that every in-game SFX/BGM routes through).
    this.applyAudioPrefs();

    // Painted scribe-study backdrop — falls back to flat panel if missing.
    if (this.textures.exists('bg_settings_scribe')) {
      this.add.image(LAYOUT.centerX, LAYOUT.centerY, 'bg_settings_scribe')
        .setDisplaySize(LAYOUT.canvasWidth, LAYOUT.canvasHeight)
        .setDepth(-2);
    }
    this.add.rectangle(LAYOUT.centerX, LAYOUT.centerY, 800, 600, 0x000000,
      this.textures.exists('bg_settings_scribe') ? 0.55 : 0,
    ).setDepth(-1);
    this.add.rectangle(LAYOUT.centerX, LAYOUT.centerY, 600, 500,
      0x1a0e06, this.textures.exists('bg_settings_scribe') ? 0.82 : LAYOUT.panelAlpha,
    ).setStrokeStyle(2, 0xd4a04a, 0.85).setInteractive();

    // Title
    this.add.text(LAYOUT.centerX, 120, 'Settings', {
      ...FONTS.title,
      color: COLORS.accent,
      fontFamily: FONTS.body,
      stroke: '#000',
      strokeThickness: 5,
    }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true);
    this.add.rectangle(LAYOUT.centerX, 145, 360, 2, 0xd4a04a, 0.7);

    this.createVolumeSlider();
    this.createMuteToggle();
    this.createGameSpeedToggle();
    this.createAutoSaveToggle();
    this.createGraphicsQualityToggle();
    this.createDeleteRunButton();
    this.createDangerZoneSeparator();
    this.createResetAllButton();
    this.createBackButton();

    this.events.on('shutdown', this.cleanup, this);
  }

  // ── SFX Volume Slider (y: 200) ──────────────────────────
  private createVolumeSlider(): void {
    // Label
    this.add.text(200, 192, 'SFX Volume', {

      color: COLORS.textPrimary,
      fontFamily: FONTS.body,
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

      color: COLORS.textPrimary,
      fontFamily: FONTS.body,
    }).setOrigin(0, 0.5);

    this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number) => {
      if (gameObject !== this.volumeThumb) return;
      const clampedX = Math.max(400, Math.min(700, dragX));
      this.volumeThumb.x = clampedX;
      this.sfxVolume = (clampedX - 400) / 300;
      this.volumeLabel.setText(`${Math.round(this.sfxVolume * 100)}%`);
      AudioManager.setMasterVolume(this.sfxVolume);
    });
  }

  // ── Mute Toggle (y: 245) ────────────────────────────────
  private createMuteToggle(): void {
    const label = this.sfxEnabled ? 'SFX: ON' : 'SFX: OFF';
    this.muteBtn = createButton(this, LAYOUT.centerX, 245, label, () => {
      this.sfxEnabled = !this.sfxEnabled;
      AudioManager.setMuted(!this.sfxEnabled);
      this.game.sound.mute = !this.sfxEnabled;
      this.muteBtn.setText(this.sfxEnabled ? 'SFX: ON' : 'SFX: OFF');
    }, 'secondary');
  }

  /** Push the loaded sfxVolume / sfxEnabled prefs into the real audio path. */
  private applyAudioPrefs(): void {
    AudioManager.setMasterVolume(this.sfxVolume);
    AudioManager.setMuted(!this.sfxEnabled);
    this.game.sound.mute = !this.sfxEnabled;
  }

  // ── Game Speed Toggle (y: 300) ──────────────────────────
  private createGameSpeedToggle(): void {
    this.add.text(200, 292, 'Game Speed', {

      color: COLORS.textPrimary,
      fontFamily: FONTS.body,
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

      color: COLORS.textPrimary,
      fontFamily: FONTS.body,
    }).setOrigin(0, 0.5);

    const label = this.autoSave ? 'ON' : 'OFF';
    this.autoSaveBtn = createButton(this, 500, 350, label, () => {
      this.autoSave = !this.autoSave;
      this.autoSaveBtn.setText(this.autoSave ? 'ON' : 'OFF');
    }, 'secondary');
  }

  // ── Graphics Quality Toggle (y: 390) ───────────────────
  // Cycles performance → balanced → high → performance. Drives the supersample
  // factor (UI_SCALE) used to size the Phaser canvas backing-store. Because
  // GameConfig dimensions are locked at boot, changing the preset only takes
  // effect after a reload — we fire that reload from saveAndClose when the
  // value has actually been edited.
  private createGraphicsQualityToggle(): void {
    this.add.text(200, 382, 'Graphics Quality', {

      color: COLORS.textPrimary,
      fontFamily: FONTS.body,
    }).setOrigin(0, 0.5);

    this.graphicsQualityBtn = createButton(this, 540, 390, GFX_QUALITY_LABEL[this.graphicsQuality], () => {
      this.cycleGraphicsQuality();
    }, 'secondary');

    this.graphicsQualityNotice = this.add.text(LAYOUT.centerX, 405, 'Restart required to apply', {
      fontSize: '10px',
      color: '#ffcc66',
      fontStyle: 'italic',
      fontFamily: FONTS.body,
    }).setOrigin(0.5).setVisible(false);
  }

  private cycleGraphicsQuality(): void {
    const idx = GFX_QUALITY_ORDER.indexOf(this.graphicsQuality);
    const next = GFX_QUALITY_ORDER[(idx + 1) % GFX_QUALITY_ORDER.length];
    this.graphicsQuality = next;
    this.graphicsQualityBtn.setText(GFX_QUALITY_LABEL[next]);
    this.graphicsQualityNotice.setVisible(this.graphicsQuality !== this.initialGraphicsQuality);
  }

  private readStoredGraphicsQuality(): GraphicsQuality | null {
    try {
      const v = localStorage.getItem(GFX_QUALITY_STORAGE_KEY);
      if (v === 'high' || v === 'balanced' || v === 'performance') return v;
    } catch { /* localStorage unavailable (sandbox/private mode) — ignore */ }
    return null;
  }

  private writeStoredGraphicsQuality(value: GraphicsQuality): void {
    try { localStorage.setItem(GFX_QUALITY_STORAGE_KEY, value); }
    catch { /* swallow — saved MetaState is still the canonical record */ }
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
            color: COLORS.accent, fontFamily: FONTS.body,
          }).setOrigin(0.5);
          this.time.delayedCall(1500, () => feedback.destroy());
        },
      );
    }, 'secondary');
    btn.setColor(COLORS.danger);
  }

  // ── Danger Zone separator ─────────────────────────────
  private createDangerZoneSeparator(): void {
    this.add.rectangle(LAYOUT.centerX, 448, 360, 1, 0x4a3020, 0.6);
    this.add.text(LAYOUT.centerX, 453, '⚠ Danger Zone', {
      fontSize: '9px', color: '#664444', fontFamily: FONTS.body,
    }).setOrigin(0.5, 0);
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
                color: COLORS.accent, fontFamily: FONTS.body,
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
    const backImg = this.add.image(0, 0, 'btn_back_settings').setScale(200 / 1995);
    const backCont = this.add.container(LAYOUT.centerX, 540, [backImg])
      .setSize(200, 79).setInteractive({ useHandCursor: true });
    backCont.on('pointerover', () => this.tweens.add({ targets: backCont, scale: 1.05, duration: 100 }));
    backCont.on('pointerout',  () => this.tweens.add({ targets: backCont, scale: 1,    duration: 100 }));
    backCont.on('pointerdown', () => this.saveAndClose());
  }

  // ── Confirmation overlay ───────────────────────────────
  private showConfirmation(message: string, confirmLabel: string, onConfirm: () => void): void {
    this.hideConfirmation();
    this.confirmContainer = this.add.container(0, 0);

    const bg = this.add.rectangle(LAYOUT.centerX, LAYOUT.centerY, 500, 180, 0x000000, 0.85).setInteractive();
    this.confirmContainer.add(bg);

    const msg = this.add.text(LAYOUT.centerX, LAYOUT.centerY - 30, message, {
      color: COLORS.textPrimary, fontFamily: FONTS.body,
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
    this.metaState.graphicsQuality = this.graphicsQuality;
    // Mirror the quality preset to localStorage so main.ts can read it
    // synchronously on next page load — Phaser's GameConfig dimensions are
    // locked at boot before the async MetaState load completes.
    this.writeStoredGraphicsQuality(this.graphicsQuality);
    await saveMetaState(this.metaState);

    // If the player flipped graphics quality, the canvas backing-store size
    // is already locked in this session and the only way to apply the change
    // is a page reload. Reloading directly from Back keeps the workflow as a
    // single click and skips a confusing "you need to restart" dialog.
    if (this.graphicsQuality !== this.initialGraphicsQuality) {
      window.location.reload();
      return;
    }

    this.scene.stop();
    this.scene.resume(SCENE_KEYS.PAUSE);
  }

  private cleanup(): void {
    this.confirmContainer = null;
  }
}
