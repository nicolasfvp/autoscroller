import Phaser from 'phaser';
import { getTileConfig, type TileSlot } from '../systems/TileRegistry';
import { TILE_SIZE } from '../systems/LoopRunner';

/** Maps tile keys to their sprite texture keys */
const TILE_SPRITE_MAP: Record<string, string> = {
  basic: 'tile_sand',
  forest: 'tile_sand',
  graveyard: 'tile_sand',
  swamp: 'tile_sand',
  shop: 'tile_sand',
  rest: 'tile_sand',
  event: 'tile_sand',
  treasure: 'tile_sand',
  boss: 'tile_sand',
};

/** Maps tile keys to their background object texture keys */
const BG_SPRITE_MAP: Record<string, string> = {
  forest: 'bg_forest',
  graveyard: 'bg_graveyard',
  swamp: 'bg_swamp',
  shop: 'bg_shop',
  rest: 'bg_rest',
  event: 'bg_event',
  treasure: 'bg_treasure',
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
  private enemySprite: Phaser.GameObjects.Sprite | null = null;
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
    isInventory: boolean = false
  ) {
    super(scene, x, y);

    this.tileScale = scale;
    const size = TILE_SIZE * scale;

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

    // Background object (trees, tombstones, tents, chests, etc.)
    const bgKey = BG_SPRITE_MAP[key];
    if (bgKey && scene.textures.exists(bgKey)) {
      // Escala conservadora para evitar overlap contínuo
      const objectMultipler = isInventory ? 1.0 : 1.15;
      
      this.bgObject = scene.add.image(0, 0, bgKey);
      // Foca a âncora de todo item na base dele (0.5, 1.0) para "ficar em pé" sobre a areia sem ter que advinhar offets loucos
      this.bgObject.setOrigin(0.5, 1.0);
      // Retorna os objetos para cima do topo do bloco (pois a base dupla foi desativada)
      this.bgObject.y = isInventory ? size * 0.1 : size * 0.1;
      
      this.bgObject.setDisplaySize(size * objectMultipler, size * objectMultipler);
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

    // Enemy sprite (pre-assigned combat tiles)
    if (tileSlot.enemyId && !tileSlot.defeatedThisLoop) {
      this.addEnemySprite(scene, tileSlot.enemyId, size);
    }

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

  private addEnemySprite(scene: Phaser.Scene, enemyId: string, tileSize: number): void {
    const idleKey = `${enemyId}_idle`;
    if (scene.textures.exists(idleKey)) {
      // Create idle animation if it doesn't exist
      if (!scene.anims.exists(idleKey)) {
        scene.anims.create({
          key: idleKey,
          frames: scene.anims.generateFrameNumbers(idleKey, {}),
          frameRate: 4,
          repeat: -1,
        });
      }
      this.enemySprite = scene.add.sprite(0, -tileSize * 0.15, idleKey);
      this.enemySprite.setOrigin(0.5, 1.0);
      this.enemySprite.y = tileSize * 0.2; // Sobe os monstros novamente para parear com a nova altura dos itens
      this.enemySprite.setScale(tileSize / 26); // reduzido a ~75% de tileSize / 20 
      this.enemySprite.play(idleKey);
      this.add(this.enemySprite);
    } else {
      // Fallback: small colored circle
      const dot = scene.add.circle(0, -tileSize * 0.1, tileSize * 0.15, 0xff0000, 0.8);
      this.add(dot);
    }
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
    const size = TILE_SIZE * this.tileScale;
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

  hideFloor(): void {
    if (this.bg) this.bg.setVisible(false);
    if (this.sprite) this.sprite.setVisible(false);
  }
}
