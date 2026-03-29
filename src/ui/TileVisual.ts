import Phaser from 'phaser';
import { getTileConfig, type TileSlot } from '../systems/TileRegistry';

/** Maps tile keys to their tileset spritesheet keys */
const TILE_SPRITE_MAP: Record<string, string> = {
  basic: 'tileset_basic',
  forest: 'tileset_forest',
  graveyard: 'tileset_graveyard',
  swamp: 'tileset_swamp',
};

/** Maps tile keys to their background object texture keys */
const BG_SPRITE_MAP: Record<string, string> = {
  basic: 'bg_basic',
  forest: 'bg_forest',
  graveyard: 'bg_graveyard',
  swamp: 'bg_swamp',
};

/**
 * Wang tile encoding: N = NW*8 + NE*4 + SW*2 + SE*1
 * upper(1) = air/transparent, lower(0) = solid platform
 */
const WANG_TO_FRAME: Record<number, number> = {
  0:6, 1:7, 2:10, 3:9, 4:2, 5:11, 6:4, 7:15,
  8:5, 9:14, 10:1, 11:8, 12:3, 13:0, 14:13, 15:12
};

function wangFrame(nw: number, ne: number, sw: number, se: number): number {
  return WANG_TO_FRAME[nw * 8 + ne * 4 + sw * 2 + se] ?? 6;
}

/**
 * Get the 4 Wang tile frames [TL, TR, BL, BR] for a 2x2 game tile.
 * Air above, stone edge below, left/right edges based on neighbor match.
 * upper(1)=air, lower(0)=solid.
 */
function getWang2x2(sameLeft: boolean, sameRight: boolean): [number, number, number, number] {
  const AIR = 1, SOLID = 0;
  const left = sameLeft ? SOLID : AIR;
  const right = sameRight ? SOLID : AIR;

  // TL: top-left of platform
  const tl = wangFrame(AIR, AIR, left, SOLID);
  // TR: top-right of platform
  const tr = wangFrame(AIR, AIR, SOLID, right);
  // BL: bottom-left of platform
  const bl = wangFrame(left, SOLID, left, SOLID);
  // BR: bottom-right of platform
  const br = wangFrame(SOLID, right, SOLID, right);

  return [tl, tr, bl, br];
}

/** Get the terrain key for a tile slot */
function getTileTerrainKey(slot: TileSlot): string {
  return slot.terrain ?? slot.type;
}

/**
 * TileVisual -- reusable Phaser Container for rendering a single tile.
 * Renders a 2x2 grid of Wang sub-tiles from a sidescroller tileset.
 */
export class TileVisual extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private sprites: Phaser.GameObjects.Image[] = [];
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
    interactive: boolean = false,
    neighbors?: { left?: TileSlot; right?: TileSlot }
  ) {
    super(scene, x, y);

    this.tileScale = scale;
    const size = 80 * scale;
    const half = size / 2;
    const quarter = size / 4;

    // Determine tile key
    const key = getTileTerrainKey(tileSlot);
    let fillColor: number;
    if (tileSlot.type === 'basic') {
      fillColor = index % 2 === 0 ? 0x666666 : 0x888888;
    } else {
      const config = getTileConfig(key);
      fillColor = config.color;
    }

    // Background rectangle (fallback fill / hit area in planning)
    this.bg = scene.add.rectangle(0, 0, size, size, fillColor);
    this.add(this.bg);

    // Render 2x2 Wang sub-tiles from tileset spritesheet
    const spriteKey = TILE_SPRITE_MAP[key];
    if (spriteKey && scene.textures.exists(spriteKey)) {
      const sameLeft = neighbors?.left ? getTileTerrainKey(neighbors.left) === key : false;
      const sameRight = neighbors?.right ? getTileTerrainKey(neighbors.right) === key : false;
      const [frameTL, frameTR, frameBL, frameBR] = getWang2x2(sameLeft, sameRight);

      // Each sub-tile is half the total size, positioned in quadrants
      const positions: [number, number, number][] = [
        [-quarter, -quarter, frameTL],
        [quarter, -quarter, frameTR],
        [-quarter, quarter, frameBL],
        [quarter, quarter, frameBR],
      ];

      for (const [px, py, frame] of positions) {
        const sp = scene.add.image(px, py, spriteKey, frame);
        sp.setDisplaySize(half, half);
        this.sprites.push(sp);
        this.add(sp);
      }
    }

    // Background object (trees, tombstones, etc.) rendered on top of tile
    const bgKey = BG_SPRITE_MAP[key];
    if (bgKey && scene.textures.exists(bgKey)) {
      this.bgObject = scene.add.image(0, -size * 0.3, bgKey);
      this.bgObject.setDisplaySize(size, size);
      this.add(this.bgObject);
    }

    // Icon text (only show if no sprite available)
    const config = getTileConfig(key);
    const fontSize = Math.round(16 * scale);
    this.iconText = scene.add.text(0, 0, config.icon, {
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
    }).setOrigin(0.5);
    if (this.sprites.length > 0) {
      this.iconText.setVisible(false);
    }
    this.add(this.iconText);

    // Only enable hover/click in planning mode
    if (interactive) {
      this.bg.setStrokeStyle(2, 0x000000, 0);
      this.bg.setInteractive({ useHandCursor: true });
      this.bg.on('pointerover', () => {
        for (const sp of this.sprites) sp.setTint(0xdddddd);
        this.bg.setStrokeStyle(2, 0xffffff, 1);
      });
      this.bg.on('pointerout', () => {
        for (const sp of this.sprites) sp.clearTint();
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

  updateTile(tileSlot: TileSlot, index: number = 0, neighbors?: { left?: TileSlot; right?: TileSlot }): void {
    const key = getTileTerrainKey(tileSlot);
    let fillColor: number;
    if (tileSlot.type === 'basic') {
      fillColor = index % 2 === 0 ? 0x666666 : 0x888888;
    } else {
      const config = getTileConfig(key);
      fillColor = config.color;
    }

    this.bg.setFillStyle(fillColor);

    // Update 2x2 sprites
    const spriteKey = TILE_SPRITE_MAP[key];
    if (spriteKey && this.scene.textures.exists(spriteKey)) {
      const sameLeft = neighbors?.left ? getTileTerrainKey(neighbors.left) === key : false;
      const sameRight = neighbors?.right ? getTileTerrainKey(neighbors.right) === key : false;
      const [frameTL, frameTR, frameBL, frameBR] = getWang2x2(sameLeft, sameRight);
      const frames = [frameTL, frameTR, frameBL, frameBR];

      for (let i = 0; i < this.sprites.length; i++) {
        this.sprites[i].setTexture(spriteKey, frames[i]);
        this.sprites[i].setVisible(true);
      }
      this.iconText.setVisible(false);
    } else {
      for (const sp of this.sprites) sp.setVisible(false);
      this.iconText.setVisible(true);
    }

    // Update background object
    const bgKey = BG_SPRITE_MAP[key];
    if (bgKey && this.scene.textures.exists(bgKey)) {
      if (this.bgObject) {
        this.bgObject.setTexture(bgKey);
        this.bgObject.setVisible(true);
      }
    } else {
      if (this.bgObject) {
        this.bgObject.setVisible(false);
      }
    }

    const config = getTileConfig(key);
    this.iconText.setText(config.icon);
    this.setSynergyEdge('none');
  }
}
