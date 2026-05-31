import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { COLORS, FONTS } from '../ui/StyleConstants';
import { createImageButton } from '../ui/WoodButton';
import { SCENE_KEYS } from '../state/SceneKeys';
import { getRelicById } from '../data/DataLoader';

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

    // Painted "reliquary vault" backdrop (Grok-generated). Stacked with the
    // deck_frame corners + a translucent dim layer so the relic icons and
    // text still read clearly against the busy art.
    if (this.textures.exists('bg_relic_vault')) {
      this.add.image(400, 300, 'bg_relic_vault').setDisplaySize(800, 600).setDepth(-2);
    }
    this.add.rectangle(
      400, 300, 800, 600,
      0x14101e, this.textures.exists('bg_relic_vault') ? 0.55 : 0.96,
    ).setInteractive();
    if (this.textures.exists('deck_frame')) {
      this.add.image(400, 300, 'deck_frame').setDisplaySize(792, 596).setDepth(-1);
    }

    // Title with the gold-banner treatment used by Forge/Shop.
    this.add.bitmapText(400, 50, 'game_font_gold', 'Your Relics', 30).setOrigin(0.5);
    this.add.rectangle(400, 80, 480, 2, 0xd4a04a, 0.7);

    if (run.relics.length === 0) {
      this.add.text(400, 280, 'No relics yet.\n\nFind them in the Shop and treasure events!', {
        fontSize: '20px',
        color: '#ffffff',
        fontFamily: FONTS.body,
        align: 'center',
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: { width: 500 },
      }).setOrigin(0.5);
      createImageButton(this, 400, 370, '→ Visit the Shop', () => this.close(), 240, 56);
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

        const img = this.add.image(x, y, `relic_${relicId}`);
        img.setDisplaySize(64, 64);

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
    createImageButton(this, 400, 520, 'Close', () => this.close(), 200, 52);

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
