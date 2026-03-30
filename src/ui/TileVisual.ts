import Phaser from 'phaser';
import { getTileConfig, type TileSlot } from '../systems/TileRegistry';

/** Maps tile keys to their sprite texture keys */
const TILE_SPRITE_MAP: Record<string, string> = {
  basic: 'tile_basic',
  forest: 'tile_forest',
  graveyard: 'tile_graveyard',
  swamp: 'tile_swamp',
  shop: 'tile_shop',
  rest: 'tile_rest',
  event: 'tile_event',
  treasure: 'tile_treasure',
  boss: 'tile_boss',
};

/** Maps tile keys to their background object texture keys */
const BG_SPRITE_MAP: Record<string, string> = {
  basic: 'bg_basic',
  forest: 'bg_forest',
  graveyard: 'bg_graveyard',
  swamp: 'bg_swamp',
};

/** Get the terrain key for a tile slot */
function getTileTerrainKey(slot: TileSlot): string {
  return slot.terrain ?? slot.type;
}

/**
 * TileVisual -- reusable Phaser Container for rendering a single tile.
 * Used in both the world view (scale=1, 80x80) and planning view (scale=0.5, 40x40).
 */
export class TileVisual extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private sprite: Phaser.GameObjects.Image | null = null;
  private bgObject: Phaser.GameObjects.Image | null = null;
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
    index: number = 0,
    interactive: boolean = false
  ) {
    super(scene, x, y);

    this.tileScale = scale;
    const size = 80 * scale;

    const key = getTileTerrainKey(tileSlot);
    let fillColor: number;
    if (tileSlot.type === 'basic') {
      fillColor = index % 2 === 0 ? 0x666666 : 0x888888;
    } else {
      const config = getTileConfig(key);
      fillColor = config.color;
    }

    // Background rectangle (fallback fill / hit area)
    this.bg = scene.add.rectangle(0, 0, size, size, fillColor);
    this.add(this.bg);

    // Tile sprite (64x64 image scaled to fill)
    const spriteKey = TILE_SPRITE_MAP[key];
    if (spriteKey && scene.textures.exists(spriteKey)) {
      this.sprite = scene.add.image(0, 0, spriteKey);
      this.sprite.setDisplaySize(size, size);
      this.add(this.sprite);
    }

    // Background object (trees, tombstones, etc.)
    const bgKey = BG_SPRITE_MAP[key];
    if (bgKey && scene.textures.exists(bgKey)) {
      this.bgObject = scene.add.image(0, -size * 0.3, bgKey);
      this.bgObject.setDisplaySize(size, size);
      this.add(this.bgObject);
    }

    // Icon text (only for tiles without sprites)
    const config = getTileConfig(key);
    const fontSize = Math.round(16 * scale);
    this.iconText = scene.add.text(0, 0, config.icon, {
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
    }).setOrigin(0.5);
    if (this.sprite) {
      this.iconText.setVisible(false);
    }
    this.add(this.iconText);

    // Only enable hover/click in planning mode
    if (interactive) {
      this.bg.setStrokeStyle(2, 0x000000, 0);
      this.bg.setInteractive({ useHandCursor: true });
      this.bg.on('pointerover', () => {
        if (this.sprite) this.sprite.setTint(0xdddddd);
        this.bg.setStrokeStyle(2, 0xffffff, 1);
      });
      this.bg.on('pointerout', () => {
        if (this.sprite) this.sprite.clearTint();
        this.bg.setStrokeStyle(2, 0x000000, 0);
      });
    }

    scene.add.existing(this);
  }

  onClick(callback: () => void): void {
    this.bg.on('pointerdown', callback);
  }

  setSelected(selected: boolean): void {
    if (selected) {
      this.bg.setStrokeStyle(2, 0xffd700, 1);
    } else {
      this.bg.setStrokeStyle(2, 0x000000, 0);
    }
  }

  setSynergyEdge(side: 'left' | 'right' | 'both' | 'none'): void {
    const size = 80 * this.tileScale;
    const stripW = 4 * this.tileScale;

    if (this.leftSynergy) { this.leftSynergy.destroy(); this.leftSynergy = null; }
    if (this.rightSynergy) { this.rightSynergy.destroy(); this.rightSynergy = null; }

    if (side === 'left' || side === 'both') {
      this.leftSynergy = this.scene.add.rectangle(-size / 2 + stripW / 2, 0, stripW, size, 0xff00ff);
      this.add(this.leftSynergy);
    }
    if (side === 'right' || side === 'both') {
      this.rightSynergy = this.scene.add.rectangle(size / 2 - stripW / 2, 0, stripW, size, 0xff00ff);
      this.add(this.rightSynergy);
    }
  }

  updateTile(tileSlot: TileSlot, index: number = 0): void {
    const key = getTileTerrainKey(tileSlot);
    let fillColor: number;
    if (tileSlot.type === 'basic') {
      fillColor = index % 2 === 0 ? 0x666666 : 0x888888;
    } else {
      const config = getTileConfig(key);
      fillColor = config.color;
    }

    this.bg.setFillStyle(fillColor);

    const spriteKey = TILE_SPRITE_MAP[key];
    if (spriteKey && this.scene.textures.exists(spriteKey)) {
      if (this.sprite) {
        this.sprite.setTexture(spriteKey);
        this.sprite.setVisible(true);
      }
      this.iconText.setVisible(false);
    } else {
      if (this.sprite) this.sprite.setVisible(false);
      this.iconText.setVisible(true);
    }

    const bgKey = BG_SPRITE_MAP[key];
    if (bgKey && this.scene.textures.exists(bgKey)) {
      if (this.bgObject) {
        this.bgObject.setTexture(bgKey);
        this.bgObject.setVisible(true);
      }
    } else {
      if (this.bgObject) this.bgObject.setVisible(false);
    }

    const config = getTileConfig(key);
    this.iconText.setText(config.icon);
    this.setSynergyEdge('none');
  }
}
