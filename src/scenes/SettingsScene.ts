import { Scene } from 'phaser';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';
import { AudioManager } from '../systems/AudioManager';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import { createDefaultMetaState, type MetaState, type GraphicsQuality } from '../state/MetaState';
import { saveManager } from '../core/SaveManager';
import { SCENE_KEYS } from '../state/SceneKeys';
import { t, getLocale, setLocale, SUPPORTED_LOCALES, LOCALE_LABEL, type Locale } from '../i18n/i18n';
import { localizedImageButton } from '../ui/LocalizedButton';

const GFX_QUALITY_ORDER: GraphicsQuality[] = ['performance', 'balanced', 'high'];
/** Localized graphics-quality label. The "(N.Nx)" supersample factor is kept
 *  language-neutral; only the descriptor word is translated. */
function gfxQualityLabel(q: GraphicsQuality): string {
  const factor = { high: '2.0x', balanced: '1.5x', performance: '1.0x' }[q];
  return `${t(`settings.gfx.${q}`)} (${factor})`;
}
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
    this.add.text(LAYOUT.centerX, 120, t('settings.title'), {
      ...FONTS.title,
      color: COLORS.accent,
      fontFamily: FONTS.body,
      stroke: '#000',
      strokeThickness: 5,
    }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true);
    this.add.rectangle(LAYOUT.centerX, 145, 360, 2, 0xd4a04a, 0.7);

    this.createVolumeSlider();
    this.createMuteToggle();
    this.createLanguageToggle();
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
    this.add.text(200, 192, t('settings.sfxVolume'), {

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
    const sfxLabel = (on: boolean) => `${t('settings.sfx')}: ${on ? t('settings.on') : t('settings.off')}`;
    this.muteBtn = createButton(this, LAYOUT.centerX, 245, sfxLabel(this.sfxEnabled), () => {
      this.sfxEnabled = !this.sfxEnabled;
      AudioManager.setMuted(!this.sfxEnabled);
      this.game.sound.mute = !this.sfxEnabled;
      this.muteBtn.setText(sfxLabel(this.sfxEnabled));
    }, 'secondary');
  }

  // ── Language Toggle (y: 272) ────────────────────────────
  // Cycles through the supported locales. Persists the choice (durable
  // MetaState copy + synchronous localStorage mirror) and reloads the page so
  // every scene re-renders in the new language and all data-content is
  // re-localized from boot — the same reload pattern Graphics Quality uses.
  private createLanguageToggle(): void {
    this.add.text(200, 272, t('settings.language'), {
      color: COLORS.textPrimary,
      fontFamily: FONTS.body,
    }).setOrigin(0, 0.5);

    createButton(this, 540, 272, LOCALE_LABEL[getLocale()], () => {
      void this.switchLanguage();
    }, 'secondary');
  }

  private async switchLanguage(): Promise<void> {
    const locales = SUPPORTED_LOCALES;
    const idx = locales.indexOf(getLocale());
    const next: Locale = locales[(idx + 1) % locales.length];
    // Persist the durable copy before the reload (the synchronous mirror is
    // written by setLocale and is what the engine reads on next boot).
    this.metaState.language = next;
    setLocale(next);
    try {
      await saveMetaState(this.metaState);
    } catch (err) {
      console.warn('[Settings] saving language failed:', err);
    }
    window.location.reload();
  }

  /** Push the loaded sfxVolume / sfxEnabled prefs into the real audio path. */
  private applyAudioPrefs(): void {
    AudioManager.setMasterVolume(this.sfxVolume);
    AudioManager.setMuted(!this.sfxEnabled);
    this.game.sound.mute = !this.sfxEnabled;
  }

  // ── Game Speed Toggle (y: 300) ──────────────────────────
  private createGameSpeedToggle(): void {
    this.add.text(200, 292, t('settings.gameSpeed'), {

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
    this.add.text(200, 342, t('settings.autoSave'), {

      color: COLORS.textPrimary,
      fontFamily: FONTS.body,
    }).setOrigin(0, 0.5);

    const onOff = (on: boolean) => (on ? t('settings.on') : t('settings.off'));
    this.autoSaveBtn = createButton(this, 500, 350, onOff(this.autoSave), () => {
      this.autoSave = !this.autoSave;
      this.autoSaveBtn.setText(onOff(this.autoSave));
    }, 'secondary');
  }

  // ── Graphics Quality Toggle (y: 390) ───────────────────
  // Cycles performance → balanced → high → performance. Drives the supersample
  // factor (UI_SCALE) used to size the Phaser canvas backing-store. Because
  // GameConfig dimensions are locked at boot, changing the preset only takes
  // effect after a reload — we fire that reload from saveAndClose when the
  // value has actually been edited.
  private createGraphicsQualityToggle(): void {
    this.add.text(200, 382, t('settings.graphicsQuality'), {

      color: COLORS.textPrimary,
      fontFamily: FONTS.body,
    }).setOrigin(0, 0.5);

    this.graphicsQualityBtn = createButton(this, 540, 390, gfxQualityLabel(this.graphicsQuality), () => {
      this.cycleGraphicsQuality();
    }, 'secondary');

    this.graphicsQualityNotice = this.add.text(LAYOUT.centerX, 405, t('settings.restartRequired'), {
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
    this.graphicsQualityBtn.setText(gfxQualityLabel(next));
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
    const btn = createButton(this, LAYOUT.centerX, 420, t('settings.deleteRun'), () => {
      this.showConfirmation(
        t('settings.deleteRunConfirm'),
        t('settings.yesDelete'),
        async () => {
          await saveManager.clear();
          this.hideConfirmation();
          // Show brief feedback
          const feedback = this.add.text(LAYOUT.centerX, 420, t('settings.runDeleted'), {
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
    this.add.text(LAYOUT.centerX, 453, `⚠ ${t('settings.dangerZone')}`, {
      fontSize: '9px', color: '#664444', fontFamily: FONTS.body,
    }).setOrigin(0.5, 0);
  }

  // ── Reset All Progress Button (y: 470) ─────────────────
  private createResetAllButton(): void {
    const btn = createButton(this, LAYOUT.centerX, 470, t('settings.resetAll'), () => {
      this.showConfirmation(
        t('settings.resetConfirm1'),
        t('common.yes'),
        () => {
          this.hideConfirmation();
          // Second confirmation
          this.showConfirmation(
            t('settings.resetConfirm2'),
            t('settings.yesResetAll'),
            async () => {
              await saveManager.clear();
              await saveMetaState(createDefaultMetaState());
              this.metaState = createDefaultMetaState();
              this.hideConfirmation();
              const feedback = this.add.text(LAYOUT.centerX, 470, t('settings.allReset'), {
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
    localizedImageButton(this, LAYOUT.centerX, 540, 'btn_back_settings', t('common.back'), 200, () => this.saveAndClose(), { height: 79 });
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

    const noBtn = createButton(this, LAYOUT.centerX + 80, LAYOUT.centerY + 40, t('common.cancel'), () => this.hideConfirmation(), 'secondary');
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
