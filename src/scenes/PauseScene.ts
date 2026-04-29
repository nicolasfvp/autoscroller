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

    // Fullscreen semi-transparent backdrop
    this.add.rectangle(400, 300, 800, 600, 0x000000, 0.75).setInteractive();

    // Overlay panel (wood texture with rounded corners)
    const panel = this.add.image(400, 300, 'wood_texture_big').setDisplaySize(360, 460);
    panel.setInteractive();

    const shape = this.make.graphics();
    shape.fillStyle(0xffffff);
    shape.fillRoundedRect(220, 70, 360, 460, 16);
    panel.setMask(shape.createGeometryMask());

    // Title
    this.add.text(400, 120, 'PAUSED', {
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8,
      fontFamily: '"Impact", "Arial Black", sans-serif',
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', fill: true }
    }).setOrigin(0.5);

    // Buttons
    this.createChunkyButton(400, 210, 260, 50, 'Resume', 0xffa000, '#111111', () => this.resume());
    
    this.createChunkyButton(400, 280, 260, 50, 'View Deck', 0xdab988, '#111111', () => {
      this.scene.pause();
      this.scene.launch('DeckCustomizationScene', { parentScene: 'PauseScene' });
    });
    
    this.createChunkyButton(400, 350, 260, 50, 'Settings', 0xdab988, '#111111', () => {
      this.scene.pause();
      this.scene.launch('SettingsScene');
    });

    this.createChunkyButton(400, 420, 260, 50, 'Abandon Run', 0xcc0000, '#ffffff', () => {
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

  private createChunkyButton(x: number, y: number, w: number, h: number, text: string, bgColor: number, textColor: string, onClick: () => void): void {
    const container = this.add.container(x, y);
    
    // Background with thick stroke
    const bg = this.add.rectangle(0, 0, w, h, bgColor).setStrokeStyle(4, 0x111111).setInteractive({ useHandCursor: true });
    
    // Drop shadow effect for text (or thin stroke depending on color)
    const txt = this.add.text(0, 0, text, {
      fontSize: '24px',
      fontStyle: 'bold',
      color: textColor,
      stroke: textColor === '#ffffff' ? '#000000' : undefined,
      strokeThickness: textColor === '#ffffff' ? 4 : 0,
      fontFamily: '"Impact", "Arial Black", sans-serif',
    }).setOrigin(0.5);

    container.add([bg, txt]);

    bg.on('pointerover', () => {
      container.setScale(1.05);
      // Lighten the background slightly
      const colorObj = Phaser.Display.Color.IntegerToColor(bgColor);
      colorObj.lighten(10);
      bg.setFillStyle(colorObj.color);
    });
    
    bg.on('pointerout', () => {
      container.setScale(1.0);
      bg.setFillStyle(bgColor);
    });
    
    bg.on('pointerdown', () => {
      container.setScale(0.95);
    });

    bg.on('pointerup', () => {
      container.setScale(1.05);
      onClick();
    });
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
