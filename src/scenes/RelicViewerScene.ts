import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { COLORS, FONTS } from '../ui/StyleConstants';
import { createImageButton } from '../ui/WoodButton';
import { SCENE_KEYS } from '../state/SceneKeys';
import { getRelicById } from '../data/DataLoader';
import { t } from '../i18n/i18n';

/**
 * RelicViewerScene -- overlay for viewing collected relics.
 * Reads run.relics. Full display is Phase 2+.
 */
export class RelicViewerScene extends Scene {
  private parentScene: string = SCENE_KEYS.GAME;

  constructor() {
    super(SCENE_KEYS.RELIC_VIEWER);
  }

  create(data?: { parentScene?: string }): void {
    this.scene.bringToTop();
    const run = getRun();
    this.parentScene = data?.parentScene ?? SCENE_KEYS.GAME;

    // Pixel-art "reliquary vault" backdrop (dark-wood + gold, matches the
    // game's UI identity). Stacked with the deck_frame corners + a translucent
    // dim layer so the relic icons and text still read clearly against it.
    if (this.textures.exists('bg_relic_vault')) {
      this.add.image(400, 300, 'bg_relic_vault').setDisplaySize(800, 600).setDepth(-2);
    }
    this.add.rectangle(
      400, 300, 800, 600,
      0x14101e, this.textures.exists('bg_relic_vault') ? 0.55 : 0.96,
    ).setInteractive();
    // Title with the gold-banner treatment used by Forge/Shop.
    this.add.bitmapText(400, 50, 'game_font_gold', t('relicViewer.title'), 30).setOrigin(0.5);
    this.add.rectangle(400, 80, 480, 2, 0xd4a04a, 0.7);

    if (run.relics.length === 0) {
      this.add.text(400, 280, t('relicViewer.empty'), {
        fontSize: '20px',
        color: '#ffffff',
        fontFamily: FONTS.body,
        align: 'center',
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: { width: 500 },
      }).setOrigin(0.5);
      createImageButton(this, 400, 370, t('relicViewer.visitShop'), () => this.close(), 120, 28);
    } else {
      const COLS = 5;
      const START_X = 200;
      const START_Y = 140;
      const SPACING_X = 100;
      const SPACING_Y = 130;

      run.relics.forEach((relicId, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = START_X + col * SPACING_X;
        const y = START_Y + row * SPACING_Y;

        const relDef = getRelicById(relicId);
        const name = relDef?.name ?? relicId.replace(/_/g, ' ');

        // Relic art streams in via the background warm; guard the texture so a
        // not-yet-loaded relic shows a neutral placeholder tile rather than a
        // missing-texture box. (RelicViewer is reached deep in a run, so the
        // warm has almost always delivered it by now.)
        if (this.textures.exists(`relic_${relicId}`)) {
          this.add.image(x, y, `relic_${relicId}`).setDisplaySize(64, 64);
        } else {
          this.add.rectangle(x, y, 64, 64, 0x2a1a0a).setStrokeStyle(2, 0x9a6030);
        }

        this.add.text(x, y + 42, name, {
          fontSize: '13px',
          fontStyle: 'bold',
          color: COLORS.textPrimary,
          fontFamily: FONTS.body,
          align: 'center',
          wordWrap: { width: 90 }
        }).setOrigin(0.5, 0);

        if (relDef?.description) {
          this.add.text(x, y + 58, relDef.description, {
            fontSize: '10px',
            color: '#998877',
            fontFamily: FONTS.body,
            align: 'center',
            wordWrap: { width: 95 }
          }).setOrigin(0.5, 0);
        }
      });
    }

    // Close button
    createImageButton(this, 400, 520, t('relicViewer.close'), () => this.close(), 100, 26);

    this.events.on('shutdown', this.cleanup, this);
  }

  private close(): void {
    // PlanningOverlay sleeps before launching us; GameScene pauses. Pick
    // the matching wake/resume so the parent actually comes back.
    if (this.scene.isSleeping(this.parentScene)) {
      this.scene.wake(this.parentScene);
    } else {
      this.scene.resume(this.parentScene);
    }
    this.scene.stop();
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
