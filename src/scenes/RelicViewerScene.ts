import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { COLORS, FONTS, createButton } from '../ui/StyleConstants';
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

    // Opaque backdrop covering the full canvas — RelicViewerScene runs as
    // an overlay with the parent scene paused but still visible underneath.
    this.add.rectangle(400, 300, 800, 600, 0x0a0a14, 0.96).setInteractive();

    // Title
    this.add.text(400, 60, 'Your Relics', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: COLORS.accent,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    if (run.relics.length === 0) {
      this.add.text(400, 300, 'No relics yet.\n\nFind them in treasure chests and events!', {
        fontSize: '16px',
        color: COLORS.textSecondary,
        fontFamily: FONTS.family,
        align: 'center',
      }).setOrigin(0.5);
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
          fontFamily: FONTS.family,
          align: 'center',
          wordWrap: { width: 90 }
        }).setOrigin(0.5, 0);

        if (relDef?.description) {
          this.add.text(x, y + 58, relDef.description, {
            fontSize: '10px',
            color: '#998877',
            fontFamily: FONTS.family,
            align: 'center',
            wordWrap: { width: 95 }
          }).setOrigin(0.5, 0);
        }
      });
    }

    // Close button
    createButton(this, 400, 520, 'Close (R)', () => this.close(), 'primary');

    this.input.keyboard?.on('keydown-R', () => this.close());

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
