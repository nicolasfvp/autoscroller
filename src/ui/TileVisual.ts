import Phaser from 'phaser';
import { getTileConfig, type TileSlot } from '../systems/TileRegistry';

/**
 * TileVisual -- reusable Phaser Container for rendering a single tile.
 * Used in both the world view (scale=1, 80x80) and planning view (scale=0.5, 40x40).
 */
export class TileVisual extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private iconText: Phaser.GameObjects.Text;
  private leftSynergy: Phaser.GameObjects.Rectangle | null = null;
  private rightSynergy: Phaser.GameObjects.Rectangle | null = null;
  private tileScale: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    tileSlot: TileSlot,
    scale: number = 1,
    index: number = 0
  ) {
    super(scene, x, y);

    this.tileScale = scale;
    const size = 80 * scale;

    // Determine fill color
    const key = tileSlot.terrain ?? tileSlot.type;
    let fillColor: number;
    if (tileSlot.type === 'basic') {
      fillColor = index % 2 === 0 ? 0x666666 : 0x888888;
    } else {
      const config = getTileConfig(key);
      fillColor = config.color;
    }

    // Background rectangle
    this.bg = scene.add.rectangle(0, 0, size, size, fillColor);
    this.bg.setStrokeStyle(2, 0x000000, 0); // transparent stroke by default
    this.add(this.bg);

    // Icon text
    const config = getTileConfig(key);
    const fontSize = Math.round(16 * scale);
    this.iconText = scene.add.text(0, 0, config.icon, {
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
    }).setOrigin(0.5);
    this.add(this.iconText);

    // Make interactive for hover
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => {
      this.bg.setStrokeStyle(2, 0xffffff, 1);
    });
    this.bg.on('pointerout', () => {
      this.bg.setStrokeStyle(2, 0x000000, 0);
    });

    scene.add.existing(this);
  }

  /** Highlight with accent color (selected state) */
  setSelected(selected: boolean): void {
    if (selected) {
      this.bg.setStrokeStyle(2, 0xffd700, 1);
    } else {
      this.bg.setStrokeStyle(2, 0x000000, 0);
    }
  }

  /** Show synergy indicator strip on left/right/both/none */
  setSynergyEdge(side: 'left' | 'right' | 'both' | 'none'): void {
    const size = 80 * this.tileScale;
    const stripW = 4 * this.tileScale;

    // Clean up existing
    if (this.leftSynergy) { this.leftSynergy.destroy(); this.leftSynergy = null; }
    if (this.rightSynergy) { this.rightSynergy.destroy(); this.rightSynergy = null; }

    if (side === 'left' || side === 'both') {
      this.leftSynergy = this.scene.add.rectangle(
        -size / 2 + stripW / 2, 0, stripW, size, 0xff00ff
      );
      this.add(this.leftSynergy);
    }

    if (side === 'right' || side === 'both') {
      this.rightSynergy = this.scene.add.rectangle(
        size / 2 - stripW / 2, 0, stripW, size, 0xff00ff
      );
      this.add(this.rightSynergy);
    }
  }

  /** Update tile data (for pool recycling) */
  updateTile(tileSlot: TileSlot, index: number = 0): void {
    const key = tileSlot.terrain ?? tileSlot.type;
    let fillColor: number;
    if (tileSlot.type === 'basic') {
      fillColor = index % 2 === 0 ? 0x666666 : 0x888888;
    } else {
      const config = getTileConfig(key);
      fillColor = config.color;
    }

    this.bg.setFillStyle(fillColor);

    const config = getTileConfig(key);
    this.iconText.setText(config.icon);

    // Reset synergy
    this.setSynergyEdge('none');
  }
}
