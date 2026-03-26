import { Scene } from 'phaser';
import { getRun } from '../state/RunState';

/**
 * RestScene -- overlay for rest site choices (heal/purify).
 * Reads RunState for hero HP. Actual rest logic is Phase 2+.
 */
export class RestScene extends Scene {
  constructor() {
    super('RestScene');
  }

  create(): void {
    const run = getRun();

    // Overlay panel
    this.add.rectangle(400, 300, 600, 400, 0x222222, 0.9).setInteractive();

    // Title
    this.add.text(400, 140, 'Rest Site', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#88ccff',
    }).setOrigin(0.5);

    // HP display
    this.add.text(400, 190, `HP: ${run.hero.currentHP}/${run.hero.maxHP}`, {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Heal option placeholder
    const healAmount = Math.floor(run.hero.maxHP * 0.3);
    this.add.text(400, 260, `Heal (+${healAmount} HP) -- Phase 2`, {
      fontSize: '14px',
      color: '#888888',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Skip button
    const skipBtn = this.add.text(400, 420, 'Skip', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    skipBtn.on('pointerover', () => skipBtn.setColor('#ffffff'));
    skipBtn.on('pointerout', () => skipBtn.setColor('#ffd700'));
    skipBtn.on('pointerdown', () => this.close());

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
