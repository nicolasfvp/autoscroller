import { Scene } from 'phaser';
import { getRun } from '../state/RunState';

/**
 * RewardScene -- overlay after combat victory.
 * Reads RunState for context. Actual reward logic is Phase 2.
 */
export class RewardScene extends Scene {
  constructor() {
    super('RewardScene');
  }

  create(): void {
    const run = getRun();

    // Overlay panel
    this.add.rectangle(400, 300, 600, 400, 0x222222, 0.9).setInteractive();

    // Title
    this.add.text(400, 140, 'Victory!', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5);

    // Gold display
    this.add.text(400, 200, `Gold: ${run.economy.gold}`, {
      fontSize: '16px',
      color: '#ffd700',
    }).setOrigin(0.5);

    // Placeholder for card reward selection (Phase 2)
    this.add.text(400, 280, 'Card rewards: Phase 2', {
      fontSize: '14px',
      color: '#888888',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Continue button
    const continueBtn = this.add.text(400, 400, 'Continue', {
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
    // No eventBus listeners to clean -- placeholder scene
  }
}
