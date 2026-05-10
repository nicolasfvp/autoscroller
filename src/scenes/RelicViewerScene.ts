import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { COLORS, FONTS, createButton } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';

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
      // List relic IDs (full display with names/icons is Phase 2+)
      run.relics.forEach((relicId, i) => {
        this.add.text(400, 140 + i * 30, relicId, {
          fontSize: '14px',
          color: COLORS.textPrimary,
          fontFamily: FONTS.family,
        }).setOrigin(0.5);
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
