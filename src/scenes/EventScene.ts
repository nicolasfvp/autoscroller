import { Scene } from 'phaser';
import { getRun } from '../state/RunState';

/**
 * EventScene -- overlay for random events with choices.
 * Reads RunState for hero/economy state. Actual event logic is Phase 2+.
 */
export class EventScene extends Scene {
  constructor() {
    super('EventScene');
  }

  create(): void {
    const run = getRun();

    // Overlay panel
    this.add.rectangle(400, 300, 600, 400, 0x222222, 0.9).setInteractive();

    // Title
    this.add.text(400, 140, 'Event', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#bb88ff',
    }).setOrigin(0.5);

    // Context info
    this.add.text(400, 200, `HP: ${run.hero.currentHP}/${run.hero.maxHP}  |  Gold: ${run.economy.gold}`, {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Placeholder for event choices (Phase 2+)
    this.add.text(400, 290, 'Event choices: Phase 2', {
      fontSize: '14px',
      color: '#888888',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Continue button
    const continueBtn = this.add.text(400, 420, 'Continue', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    continueBtn.on('pointerover', () => continueBtn.setColor('#ffffff'));
    continueBtn.on('pointerout', () => continueBtn.setColor('#ffd700'));
    continueBtn.on('pointerdown', () => this.close());

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
