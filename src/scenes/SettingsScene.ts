import { Scene } from 'phaser';

/**
 * SettingsScene -- placeholder overlay with Back button.
 * No RunState dependency -- settings are global, not per-run.
 */
export class SettingsScene extends Scene {
  constructor() {
    super('SettingsScene');
  }

  create(): void {
    // Overlay panel
    this.add.rectangle(400, 300, 500, 400, 0x222222, 0.9).setInteractive();

    // Title
    this.add.text(400, 150, 'Settings', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Placeholder content
    this.add.text(400, 250, 'SFX Volume: 100%', {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.add.text(400, 290, 'Music Volume: 100%', {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Back button
    const backBtn = this.add.text(400, 400, 'Back', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#ffd700'));
    backBtn.on('pointerdown', () => this.close());

    this.events.on('shutdown', this.cleanup, this);
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('PauseScene');
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
