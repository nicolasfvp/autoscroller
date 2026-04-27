import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';

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
    this.add.image(400, 300, 'wood_texture').setDisplaySize(400, 500).setInteractive();

    // Title
    this.add.text(400, 120, 'PAUSED', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    // Resume button
    createButton(this, 400, 220, 'Resume', () => this.resume(), 'primary');

    // View Deck button
    createButton(this, 400, 280, 'View Deck', () => {
      this.scene.pause();
      this.scene.launch('DeckCustomizationScene', { parentScene: 'PauseScene' });
    }, 'secondary');

    // Settings button
    createButton(this, 400, 340, 'Settings', () => {
      this.scene.pause();
      this.scene.launch('SettingsScene');
    }, 'secondary');

    // Abandon Run button
    const abandonBtn = this.add.text(400, 420, 'Abandon Run', {
      fontSize: '16px',
      color: COLORS.danger,
      fontFamily: FONTS.family,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    abandonBtn.on('pointerover', () => abandonBtn.setColor(COLORS.accentHover));
    abandonBtn.on('pointerout', () => abandonBtn.setColor(COLORS.danger));
    abandonBtn.on('pointerdown', () => {
      this.scene.stop('GameScene');
      this.scene.stop();
      this.scene.start('MainMenu');
    });

    // ESC to resume
    this.input.keyboard?.on('keydown-ESC', () => this.resume());

    this.events.on('shutdown', this.cleanup, this);
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
