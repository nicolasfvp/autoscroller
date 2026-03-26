import { Scene } from 'phaser';
import { getRun } from '../state/RunState';

/**
 * RelicViewerScene -- overlay for viewing collected relics.
 * Reads run.relics. Full display is Phase 2+.
 */
export class RelicViewerScene extends Scene {
  constructor() {
    super('RelicViewerScene');
  }

  create(): void {
    const run = getRun();

    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Title
    this.add.text(400, 60, 'Your Relics', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5);

    if (run.relics.length === 0) {
      this.add.text(400, 300, 'No relics yet.\n\nFind them in treasure chests and events!', {
        fontSize: '16px',
        color: '#888888',
        align: 'center',
      }).setOrigin(0.5);
    } else {
      // List relic IDs (full display with names/icons is Phase 2+)
      run.relics.forEach((relicId, i) => {
        this.add.text(400, 140 + i * 30, relicId, {
          fontSize: '14px',
          color: '#ffffff',
        }).setOrigin(0.5);
      });
    }

    // Close button
    const closeBtn = this.add.text(400, 520, 'Close (R)', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ffd700'));
    closeBtn.on('pointerdown', () => this.close());

    this.input.keyboard?.on('keydown-R', () => this.close());

    this.events.on('shutdown', this.cleanup, this);
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Game');
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
