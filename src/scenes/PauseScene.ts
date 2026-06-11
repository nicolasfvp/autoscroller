import { Scene } from 'phaser';
import { t, getLocale } from '../i18n/i18n';
import { FONTS } from '../ui/StyleConstants';
import { getRun, clearRun } from '../state/RunState';
import { saveManager } from '../core/SaveManager';
import { SCENE_KEYS, REGISTRY_KEYS, stopAllRunScenes } from '../state/SceneKeys';

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

    // Título — y=105, fontSize=42
    this.add.bitmapText(400, 105, 'game_font_white', t('pause.title'), 42).setOrigin(0.5);

    this.makePauseBtn('btn_resume_pause',     t('pause.resume'),     401.6, 171.6, 204, 50, () => this.resume());
    this.makePauseBtn('btn_view_deck_pause',  t('pause.viewDeck'),   400.5, 236.8, 196, 50, () => {
      this.scene.pause();
      this.scene.launch(SCENE_KEYS.DECK_CUSTOMIZATION, { parentScene: SCENE_KEYS.PAUSE });
    });
    this.makePauseBtn('btn_tutorial_pause',   t('pause.tutorial'),   400,   300,   196, 50, () => {
      this.scene.pause();
      this.scene.launch(SCENE_KEYS.TUTORIAL, { replay: true, parentScene: SCENE_KEYS.PAUSE });
    });
    this.makePauseBtn('btn_settings_pause',   t('pause.settings'),   400,   365.8, 200, 50, () => {
      this.scene.pause();
      this.scene.launch(SCENE_KEYS.SETTINGS);
    });
    this.makePauseBtn('btn_abandon_run_pause', t('pause.abandonRun'), 402.6, 432.1, 210, 50, async () => {
      const mode = (() => { try { return getRun().mode; } catch { return undefined; } })();
      this.registry.set(REGISTRY_KEYS.SAVED_RUN, null);
      stopAllRunScenes(this, SCENE_KEYS.PAUSE);
      await saveManager.clearByMode(mode);
      clearRun();
      this.scene.start(SCENE_KEYS.MAIN_MENU);
    });

    this.events.on('shutdown', this.cleanup, this);
  }

  private makePauseBtn(key: string, label: string, x: number, y: number, w: number, h: number, cb: () => void): void {
    const cont = this.add.container(x, y);
    let dh = h;
    if (getLocale() === 'pt-br') {
      // The baked button art has English text baked in — render a wood-texture
      // + translated-text button instead so the pause menu reads in pt-BR.
      if (this.textures.exists('wood_texture')) {
        cont.add(this.add.image(0, 0, 'wood_texture').setDisplaySize(w, dh));
      } else {
        cont.add(this.add.rectangle(0, 0, w, dh, 0x2a1a0a));
      }
      cont.add(this.add.rectangle(0, 0, w, dh, 0x000000, 0).setStrokeStyle(2, 0xd4a04a, 0.95));
      cont.add(this.add.text(0, 0, label, {
        fontSize: '22px', fontStyle: 'bold', color: '#f0d080',
        fontFamily: FONTS.body, stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true));
    } else {
      const img = this.add.image(0, 0, key);
      const sc = w / img.width;
      img.setScale(sc);
      dh = img.height * sc;
      cont.add(img);
    }
    cont.setSize(w, dh).setInteractive({ useHandCursor: true });
    cont.on('pointerover', () => this.tweens.add({ targets: cont, scale: 1.05, duration: 100 }));
    cont.on('pointerout',  () => this.tweens.add({ targets: cont, scale: 1,    duration: 100 }));
    cont.on('pointerdown', cb);
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume(SCENE_KEYS.GAME);
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
