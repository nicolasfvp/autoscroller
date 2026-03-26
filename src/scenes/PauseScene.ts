import { Scene } from 'phaser';
import { getRun } from '../state/RunState';

/**
 * PauseScene -- overlay with Resume, Settings, Abandon Run buttons.
 * No RunState mutation. Reads run only for display context.
 */
export class PauseScene extends Scene {
  constructor() {
    super('PauseScene');
  }

  create(): void {
    // Read run to verify active state exists
    getRun();

    // Overlay panel
    this.add.rectangle(400, 300, 400, 500, 0x222222, 0.9).setInteractive();

    // Title
    this.add.text(400, 120, 'PAUSED', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Resume button
    const resumeBtn = this.add.text(400, 220, 'Resume', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    resumeBtn.on('pointerover', () => resumeBtn.setColor('#ffffff'));
    resumeBtn.on('pointerout', () => resumeBtn.setColor('#ffd700'));
    resumeBtn.on('pointerdown', () => this.resume());

    // View Deck button
    const deckBtn = this.add.text(400, 280, 'View Deck', {
      fontSize: '16px',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    deckBtn.on('pointerover', () => deckBtn.setColor('#ffffff'));
    deckBtn.on('pointerout', () => deckBtn.setColor('#ffd700'));
    deckBtn.on('pointerdown', () => {
      this.scene.pause();
      this.scene.launch('DeckCustomizationScene');
    });

    // Settings button
    const settingsBtn = this.add.text(400, 340, 'Settings', {
      fontSize: '16px',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    settingsBtn.on('pointerover', () => settingsBtn.setColor('#ffffff'));
    settingsBtn.on('pointerout', () => settingsBtn.setColor('#ffd700'));
    settingsBtn.on('pointerdown', () => {
      this.scene.pause();
      this.scene.launch('SettingsScene');
    });

    // Abandon Run button
    const abandonBtn = this.add.text(400, 420, 'Abandon Run', {
      fontSize: '16px',
      color: '#ff0000',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    abandonBtn.on('pointerover', () => abandonBtn.setColor('#ffffff'));
    abandonBtn.on('pointerout', () => abandonBtn.setColor('#ff0000'));
    abandonBtn.on('pointerdown', () => {
      this.scene.stop('Game');
      this.scene.stop();
      this.scene.start('MainMenu');
    });

    // ESC to resume
    this.input.keyboard?.on('keydown-ESC', () => this.resume());

    this.events.on('shutdown', this.cleanup, this);
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume('Game');
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
