import { Scene } from 'phaser';
import { getRun } from '../state/RunState';

/**
 * ShopScene -- overlay for purchasing cards/removing cards.
 * Reads RunState for gold. Actual shop logic is Phase 2.
 */
export class ShopScene extends Scene {
  constructor() {
    super('ShopScene');
  }

  create(): void {
    const run = getRun();

    // Overlay panel
    this.add.rectangle(400, 300, 600, 400, 0x222222, 0.9).setInteractive();

    // Title
    this.add.text(400, 140, 'Shop', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5);

    // Gold display
    this.add.text(400, 190, `Gold: ${run.economy.gold}`, {
      fontSize: '24px',
      color: '#ffd700',
    }).setOrigin(0.5);

    // Placeholder for shop items (Phase 2)
    this.add.text(400, 280, 'Shop items: Phase 2', {
      fontSize: '14px',
      color: '#888888',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Leave Shop button
    const closeBtn = this.add.text(400, 420, 'Leave Shop', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ffd700'));
    closeBtn.on('pointerdown', () => this.close());

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
