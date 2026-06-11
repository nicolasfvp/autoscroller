import { Scene } from 'phaser';
import { saveManager } from '../core/SaveManager';
import { setRun, createNewDailyRun, getRun } from '../state/RunState';
import type { RunState } from '../state/RunState';
import { COLORS, FONTS, LAYOUT } from '../ui/StyleConstants';
import { AudioManager } from '../systems/AudioManager';
import { SCENE_KEYS, REGISTRY_KEYS } from '../state/SceneKeys';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';
import {
  consumeWipeFlag,
  formatWelcomeNotice,
  SAVE_INCOMPATIBLE_COPY,
} from './MainMenu.helpers';
import {
  ensureNickname,
  setStoredNickname,
} from '../systems/DailySeed';
import { NicknameModal } from '../ui/NicknameModal';
import { t, getLocale } from '../i18n/i18n';
import { localizedImageButton } from '../ui/LocalizedButton';


export class MainMenu extends Scene {
  private savedRun: RunState | null = null;
  private savedDailyRun: RunState | null = null;
  private confirmOverlay: Phaser.GameObjects.Container | null = null;
  private transitioning = false;
  private nicknameModal: NicknameModal | null = null;

  constructor() {
    super(SCENE_KEYS.MAIN_MENU);
  }

  async create(): Promise<void> {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    // Read the registry hint (set by Preloader for fast first paint), but
    // prefer the freshly-loaded IDB value so we never offer "Continue"
    // for a run that was just abandoned/deleted in another scene. After
    // consuming, drop the registry copy so future reads can't pick up
    // stale data.
    // The registry hint is read but intentionally ignored when IDB has
    // no save — IDB is the source of truth, and trusting a stale hint
    // would re-surface an abandoned run.
    this.registry.get(REGISTRY_KEYS.SAVED_RUN);
    this.savedRun = await saveManager.load();
    this.savedDailyRun = await saveManager.loadDaily();
    this.registry.remove(REGISTRY_KEYS.SAVED_RUN);
    this.confirmOverlay = null;
    this.nicknameModal = null;

    // Phase 9 (Design v2) Pitfall 5: consume the one-shot _wipedFromVersion
    // flag from MetaState, then persist the stripped state so it never
    // reappears on subsequent boots. Layered with MetaPersistence's own
    // strip for defense-in-depth.
    try {
      const meta = await loadMetaState();
      const wipedFrom = consumeWipeFlag(meta);
      if (wipedFrom !== undefined) {
        await saveMetaState(meta);
        // Phase 9 (WR-06 fix): defer the visual notice until after the menu's
        // UI is built. The previous `events.once('create', ...)` line was
        // dead — the 'create' event fires before this create() runs, so the
        // callback never fired. A future refactor that hoisted the wipe-flag
        // consumption would have left both callbacks armed and surfaced a
        // duplicate notice. delayedCall(50) alone is sufficient.
        this.time.delayedCall(50, () => this.showWelcomeNotice(wipedFrom));
      }
    } catch (err) {
      console.warn('[MainMenu] wipe-flag consumption failed:', err);
    }

    // D-07: SaveManager.load() set a global flag if an incompatible RunState
    // was cleared on boot. Surface the save-incompatible notice once.
    const g = globalThis as { __runStateClearedOnBoot?: boolean };
    if (g.__runStateClearedOnBoot) {
      g.__runStateClearedOnBoot = false;
      this.time.delayedCall(50, () => this.showSaveIncompatibleNotice());
    }

    // First-run gating: if the player has never seen the tutorial, kick off
    // the scripted director before the next scene mounts.
    try {
      const meta = await loadMetaState();
      if (!meta.tutorialSeen) {
        tutorialDirector.start();
      }
    } catch (err) {
      console.warn('[MainMenu] tutorial gate read failed:', err);
    }

    // Theme Song
    AudioManager.transitionTo(this, 'theme_song', { volume: 0.4, duration: 1500 });

    // Background
    this.cameras.main.setBackgroundColor(COLORS.background);
    if (this.textures.exists('homepage')) {
      this.add.image(LAYOUT.centerX, LAYOUT.centerY, 'homepage').setDisplaySize(LAYOUT.canvasWidth, LAYOUT.canvasHeight).setDepth(-10);
    }

    // Fog Effect — two large images that drift left in lockstep. Use
    // onRepeat to teleport each image back to the right edge so the
    // strip stays seamless across loops (a plain tween with repeat:-1
    // snaps both images back to their starting x simultaneously, which
    // produces a visible gap on the first loop).
    for (let i = 0; i < 2; i++) {
      const startX = LAYOUT.canvasWidth / 2 + (i * LAYOUT.canvasWidth);
      const fogImg = this.add.image(startX, LAYOUT.canvasHeight - 150, 'fog');
      fogImg.setDisplaySize(LAYOUT.canvasWidth * 1.5, LAYOUT.canvasHeight * 0.8);
      fogImg.setAlpha(0.3);
      fogImg.setBlendMode(Phaser.BlendModes.SCREEN);
      fogImg.setDepth(-5);

      const baseY = fogImg.y;

      this.tweens.add({
        targets: fogImg,
        x: startX - LAYOUT.canvasWidth * 2,
        duration: 60000,
        repeat: -1,
        ease: 'Linear',
        onRepeat: () => { fogImg.x = startX; },
      });

      this.tweens.add({
        targets: fogImg,
        y: baseY - 20,
        duration: 5000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }



    if (this.savedRun) {
      this.createImgBtn(LAYOUT.centerX, 355, 'btn_continue_run', () => this.continueRun(), 280);
      this.createImgBtn(LAYOUT.centerX, 412, 'btn_new_game', () => this.showDeleteConfirmation(), 280);
    } else {
      this.createImgBtn(LAYOUT.centerX, 375, 'btn_new_game', () => this.startNewRun(), 280);
    }

    this.createImgBtn(LAYOUT.centerX, this.savedRun ? 468 : 432, 'btn_daily_run', () => this.onDailyButtonClicked(), 280);

    this.events.on('shutdown', this.cleanup, this);
  }


  private createImgBtn(x: number, y: number, key: string, callback: () => void, displayWidth: number = 500) {
    // The baked button art has English text — in pt-BR render a wood+text
    // button of the same size instead (via the shared locale-aware helper).
    const labels: Record<string, string> = {
      btn_new_game: t('btn.newGame'),
      btn_continue_run: t('btn.continueRun'),
      btn_daily_run: t('btn.dailyRun'),
    };
    return localizedImageButton(this, x, y, key, labels[key] ?? key, displayWidth, callback);
  }

  private fadeToScene(sceneKey: string, data?: any): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });
  }

  private continueRun(): void {
    if (this.savedRun) {
      setRun(this.savedRun);
      // create() blindly (re)starts the director at step 0 whenever
      // tutorialSeen is false. For a continued run that resets a mid-tutorial
      // run back to the welcome step (a CharacterSelect step) while the player
      // lands in GameScene — so no overlay shows and the tutorial looks gone.
      // Restore the progress saved on this run instead (deactivates for
      // non-tutorial / legacy saves).
      tutorialDirector.restore(this.savedRun.tutorial);
      this.fadeToScene(SCENE_KEYS.GAME);
    }
  }

  private showDeleteConfirmation(): void {
    if (this.confirmOverlay) return;

    const CX = LAYOUT.centerX;
    const CY = LAYOUT.centerY;

    this.confirmOverlay = this.add.container(0, 0);

    // ── Dim backdrop ──────────────────────────────────────────────────────────
    const dim = this.add.rectangle(CX, CY, LAYOUT.canvasWidth, LAYOUT.canvasHeight, 0x000000, 0.72);
    dim.setInteractive();
    this.confirmOverlay.add(dim);

    if (getLocale() === 'pt-br') {
      // The baked lp_permanent_erase art has English text — render a code-built
      // panel + translated text/buttons for pt-BR.
      const panel = this.add.rectangle(CX, 240, 460, 210, 0x1a0e06, 0.97).setStrokeStyle(2, 0xd4a04a, 0.9);
      this.confirmOverlay.add(panel);
      this.confirmOverlay.add(this.add.text(CX, 185, t('menu.deleteTitle'), {
        fontSize: '22px', fontStyle: 'bold', color: COLORS.accent, fontFamily: FONTS.family,
        stroke: '#000', strokeThickness: 4, align: 'center',
      }).setOrigin(0.5));
      this.confirmOverlay.add(this.add.text(CX, 240, t('menu.deleteBody'), {
        fontSize: '15px', color: '#e8d9b8', fontFamily: FONTS.family, align: 'center',
        wordWrap: { width: 410 }, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5));
      this.confirmOverlay.add(localizedImageButton(this, 314.2, 320, 'lp_delete_run', t('menu.deleteConfirm'), 170, () => { void this.startNewRun(); }, { height: 50, variant: 'danger' }));
      this.confirmOverlay.add(localizedImageButton(this, 504.7, 320, 'lp_keep', t('btn.keep'), 130, () => this.hideConfirmation(), { height: 50 }));
    } else {
      // ── Painel de aviso (permanente-erase.png) ──────────────────────────────
      const erasePanel = this.add.image(403.7, 239.7, 'lp_permanent_erase').setScale(0.3199);
      this.confirmOverlay.add(erasePanel);

      const makeImgBtn = (x: number, y: number, texKey: string, scale: number, onClick: () => void) => {
        const img = this.add.image(x, y, texKey).setScale(scale).setInteractive({ useHandCursor: true });
        img.on('pointerover',  () => img.setTint(0xffffcc));
        img.on('pointerout',   () => img.clearTint());
        img.on('pointerdown',  onClick);
        this.confirmOverlay!.add(img);
      };

      makeImgBtn(314.2, 355.1, 'lp_delete_run', 0.3095, () => { void this.startNewRun(); });
      makeImgBtn(504.7, 354.6, 'lp_keep',       0.3097, () => this.hideConfirmation());
    }

    // Fade-in
    this.confirmOverlay.setAlpha(0);
    this.tweens.add({ targets: this.confirmOverlay, alpha: 1, duration: 200, ease: 'Sine.easeOut' });
  }

  private hideConfirmation(): void {
    if (!this.confirmOverlay) return;
    const overlay = this.confirmOverlay;
    this.confirmOverlay = null;
    this.tweens.add({
      targets: overlay, alpha: 0, duration: 160, ease: 'Sine.easeIn',
      onComplete: () => overlay.destroy(true),
    });
  }

  private async startNewRun(): Promise<void> {
    await saveManager.clear();
    // First-run gating: if the player has never seen the tutorial, kick off
    // the scripted director before the next scene mounts. Every participating
    // scene checks tutorialDirector.isActive() in create() and mounts the
    // TutorialOverlay; completion (last step advance) flips tutorialSeen.
    try {
      const meta = await loadMetaState();
      if (!meta.tutorialSeen) {
        tutorialDirector.start();
        // Mark tutorialSeen now so the player isn't trapped in a tutorial
        // loop if they abandon mid-run. The scripted overlays still play.
        meta.tutorialSeen = true;
        await saveMetaState(meta);
      }
    } catch (err) {
      console.warn('[MainMenu] tutorial gate read failed:', err);
    }
    this.fadeToScene(SCENE_KEYS.CHARACTER_SELECT);
  }

  private onDailyButtonClicked(): void {
    if (this.transitioning || this.nicknameModal) return;
    const initial = ensureNickname();
    this.nicknameModal = new NicknameModal(this, {
      initialValue: initial,
      title: this.savedDailyRun ? t('menu.dailyContinue') : t('menu.dailyEnterNickname'),
      onConfirm: (name) => {
        setStoredNickname(name);
        this.nicknameModal = null;
        void this.startDailyRun();
      },
      onCancel: () => { this.nicknameModal = null; },
    });
  }

  private async startDailyRun(): Promise<void> {
    if (this.transitioning) return;
    try {
      let meta;
      try {
        meta = await loadMetaState();
      } catch (err) {
        console.error('[MainMenu] daily run loadMetaState failed:', err);
        return;
      }
      // Resume the saved daily run if it's still for today; otherwise build
      // a fresh one. createNewDailyRun derives class+deck from today's UTC seed
      // so every player worldwide gets the same starting setup.
      const run = this.savedDailyRun ?? createNewDailyRun(meta);
      setRun(run);
      await saveManager.save(getRun());
    } catch (err) {
      console.error('[MainMenu] startDailyRun failed:', err);
      return;
    }
    // Skip CharacterSelect — daily mode is deterministic, no class pick.
    this.fadeToScene(SCENE_KEYS.GAME);
  }

  /**
   * Phase 9 (Design v2): inline welcome notice after a v3/v4/v5 -> v6
   * MetaState wipe migration. NOT a modal -- per UI-SPEC §Copywriting the
   * wipe is automatic (D-06) and the notice is informational only. Fades in
   * 400ms, auto-dismisses after 6s.
   */
  private showWelcomeNotice(wipedFrom?: number): void {
    const msg = formatWelcomeNotice(wipedFrom);
    const text = this.add.text(LAYOUT.centerX, 100, msg, {
      fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
      fontFamily: FONTS.family,
      wordWrap: { width: 600 }, align: 'center',
    }).setOrigin(0.5).setDepth(50);
    text.setAlpha(0);
    this.tweens.add({ targets: text, alpha: 1, duration: 400 });
    this.time.delayedCall(6000, () => {
      this.tweens.add({
        targets: text, alpha: 0, duration: 400,
        onComplete: () => text.destroy(),
      });
    });
  }

  /**
   * Phase 9 (Design v2): save-incompatible notice surfaced when SaveManager
   * cleared a stale RunState on boot (D-07). Dismissible inline card with
   * "Continue" CTA per UI-SPEC §Copywriting. NOT a hard modal.
   */
  private showSaveIncompatibleNotice(): void {
    const container = this.add.container(0, 0).setDepth(60);

    // Dim panel (NOT full-screen black — informational, not destructive)
    const panel = this.add.rectangle(LAYOUT.centerX, 150, 520, 110, 0x222222, 0.9)
      .setStrokeStyle(2, 0xffaa44, 0.9);
    container.add(panel);

    const title = this.add.text(LAYOUT.centerX, 120, SAVE_INCOMPATIBLE_COPY.title, {
      fontSize: '18px', fontStyle: 'bold', color: '#ffaa44',
      stroke: '#000000', strokeThickness: 3,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);
    container.add(title);

    const body = this.add.text(LAYOUT.centerX, 150, SAVE_INCOMPATIBLE_COPY.body, {
      fontSize: '13px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
      fontFamily: FONTS.family,
      wordWrap: { width: 480 }, align: 'center',
    }).setOrigin(0.5);
    container.add(body);

    const cta = this.add.text(LAYOUT.centerX, 185, SAVE_INCOMPATIBLE_COPY.cta, {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.accent,
      stroke: '#000000', strokeThickness: 3,
      fontFamily: FONTS.family,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cta.on('pointerover', () => cta.setColor(COLORS.accentHover));
    cta.on('pointerout', () => cta.setColor(COLORS.accent));
    cta.on('pointerdown', () => container.destroy(true));
    container.add(cta);
  }

  private cleanup(): void {
    this.confirmOverlay = null;
    this.savedRun = null;
    this.savedDailyRun = null;
    if (this.nicknameModal) { this.nicknameModal.destroy(); this.nicknameModal = null; }
  }
}
