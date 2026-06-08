import Phaser from 'phaser';
import { FONTS } from '../ui/StyleConstants';
import { getTileConfig, type TileSlot } from '../systems/TileRegistry';
import { TILE_SIZE } from '../systems/LoopRunner';

/** Maps tile registry keys to their sprite texture keys. Single layer per
 * tile — decorations are baked into the source PNG, no overlay system. */
const TILE_SPRITE_MAP: Record<string, string> = {
  // Path / buffer / fallback
  basic: 'tile_basic',
  buffer: 'tile_basic',
  // Combat terrains
  forest: 'tile_forest',
  graveyard: 'tile_graveyard',
  swamp: 'tile_swamp',
  desert: 'tile_desert',
  lava: 'tile_lava',
  // Specials
  event: 'tile_event',
  treasure: 'tile_treasure',
  boss: 'tile_boss',
  // Subtiles have no ground sprite — they sit on top of the reserved tile.
  // Their identity is shown via landmark overlay (see LANDMARK_MAP).
};

/** Maps tile keys to their landmark overlay texture key.
 * Landmarks are rendered above the tile sprite, centered and scaled to fit. */
export const LANDMARK_MAP: Record<string, string> = {
  // Combat biomes
  forest:   'landmark_forest',
  graveyard:'landmark_graveyard',
  swamp:    'landmark_swamp',
  desert:   'landmark_desert',
  lava:     'landmark_lava',
  // Specials
  event:    'landmark_event',
  treasure: 'landmark_treasure',
  boss:     'landmark_boss',
  // Subtiles — landmark is the only visual identity on the reserved slot
  subtile_ambush:    'landmark_subtile_ambush',
  subtile_magma:     'landmark_subtile_magma',
  subtile_manawell:  'landmark_subtile_manawell',
  subtile_camp:      'landmark_subtile_camp',
  subtile_burnaltar: 'landmark_subtile_burnaltar',
  subtile_bleedtotem:'landmark_subtile_bleedtotem',
  subtile_resonance: 'landmark_subtile_resonance',
  subtile_warhorn:   'landmark_subtile_warhorn',
};

/** Get the terrain key for a tile slot.
 * Wave 5+: also fall back to `kind` (the registry key) so subtile slots —
 * which have type='subtile' and no terrain — resolve to their distinct
 * entries (subtile_ambush, subtile_warhorn, ...) for sprite lookup. */
function getTileTerrainKey(slot: TileSlot): string {
  return slot.terrain ?? slot.kind ?? slot.type;
}

/** Sprite for reserved slots (empty or occupied by a subtile), picked from host combat terrain. */
function getReservedSpriteKey(slot: TileSlot): string | null {
  if (!slot.hostTerrain) return null;
  if (slot.type === 'basic' && slot.reserved) return `tile_reserved_${slot.hostTerrain}`;
  if (slot.type === 'subtile') return `tile_reserved_${slot.hostTerrain}`;
  return null;
}

/**
 * TileVisual -- reusable Phaser Container for rendering a single tile.
 * Used in both the world view (scale=1, TILE_SIZE px) and planning view
 * (scale=0.5, half size). Source PNGs are 256x256; Phaser downscales.
 */
export class TileVisual extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private sprite: Phaser.GameObjects.Image | null = null;
  private landmarkSprite: Phaser.GameObjects.Image | null = null;
  private enemySprite: Phaser.GameObjects.Sprite | null = null;
  private iconText: Phaser.GameObjects.Text;
  private tileScale: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    tileSlot: TileSlot,
    scale: number = 1,
    index: number = 0,
    interactive: boolean = false,
  ) {
    super(scene, x, y);

    this.tileScale = scale;
    const size = TILE_SIZE * scale;

    const key = getTileTerrainKey(tileSlot);
    let fillColor: number;
    if (tileSlot.type === 'basic' || tileSlot.type === 'buffer') {
      fillColor = index % 2 === 0 ? 0x666666 : 0x888888;
    } else {
      const config = getTileConfig(key);
      fillColor = config.color;
    }

    // Background rectangle (fallback fill / hit area)
    this.bg = scene.add.rectangle(0, 0, size, size, fillColor);
    this.add(this.bg);

    // Tile sprite (single all-in-one diorama, decoration baked in). Reserved
    // slots use the host terrain's sparse extension sprite when available.
    const reservedKey = getReservedSpriteKey(tileSlot);
    const spriteKey = reservedKey && scene.textures.exists(reservedKey)
      ? reservedKey
      : TILE_SPRITE_MAP[key];
    if (spriteKey && scene.textures.exists(spriteKey)) {
      // y offset only applies at full scale (GameScene world view).
      // In planning view (scale=0.5) the tile is small enough that centering at 0 is correct.
      const spriteOffsetY = scale >= 1 ? -50 : 0;
      this.sprite = scene.add.image(0, spriteOffsetY, spriteKey);
      this.sprite.setDisplaySize(size, size);
      this.add(this.sprite);
      // Sprite covers the tile — hide the fallback rectangle so it doesn't bleed through
      this.bg.setVisible(false);
    }

    // Icon text (only for tiles without sprites)
    const tileConfigForIcon = (tileSlot.type !== 'buffer') ? getTileConfig(key) : null;
    const fontSize = Math.round(16 * scale);
    this.iconText = scene.add.text(0, 0, tileConfigForIcon?.icon ?? '', {
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontFamily: FONTS.body,
    }).setOrigin(0.5);
    if (this.sprite) {
      this.iconText.setVisible(false);
    }
    this.add(this.iconText);

    // Landmark overlay — shown above the tile sprite for biomes, specials and subtiles.
    // Hidden when an enemy sprite occupies the tile (enemy takes visual priority).
    const landmarkKey = LANDMARK_MAP[key];
    const hasEnemy = !!(tileSlot.enemyId && !tileSlot.defeatedThisLoop);
    if (landmarkKey && scene.textures.exists(landmarkKey)) {
      this.landmarkSprite = this._makeLandmark(scene, landmarkKey, size);
      if (hasEnemy) this.landmarkSprite.setVisible(false);
    }

    // Enemy sprite (pre-assigned combat tiles)
    if (hasEnemy) {
      this.addEnemySprite(scene, tileSlot.enemyId!, size);
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
  }

  private _makeLandmark(scene: Phaser.Scene, textureKey: string, tileSize: number): Phaser.GameObjects.Image {
    const img = scene.add.image(0, this.tileScale >= 1 ? -tileSize * 0.75 : -tileSize * 0.9, textureKey);
    // Scale landmark to fit 80% of the tile width, preserving aspect ratio
    const src = scene.textures.get(textureKey).getSourceImage() as HTMLImageElement;
    const scale = (tileSize * 0.8) / Math.max(src.width, src.height);
    img.setScale(scale);
    this.add(img);
    return img;
  }

  private addEnemySprite(scene: Phaser.Scene, enemyId: string, tileSize: number, fadeIn: boolean = false): void {
    // Phase 9 (CR-01 fix): monster texture keys are namespaced `monster_*`
    // to avoid colliding with hero spritesheets (e.g. enemy 'mage' vs hero
    // Mage class). See Preloader.ts monsterIds loop.
    const textureKey = `monster_${enemyId}`;
    if (scene.textures.exists(textureKey)) {
      this.enemySprite = scene.add.sprite(0, 0, textureKey);
      this.enemySprite.setOrigin(0.5, 1.0);
      this.enemySprite.y = this.tileScale >= 1 ? -71.2 : -tileSize * 0.35;
      // Bound enemy sprite to tile size regardless of source dimensions.
      // Previous setScale(tileSize / 32) assumed 32px source but the PNGs
      // are 64x64, causing a 2x "pop" (128px) on first appearance.
      this.enemySprite.setDisplaySize(tileSize, tileSize);
      this.add(this.enemySprite);
      if (fadeIn) {
        this.enemySprite.setAlpha(0);
        scene.tweens.add({ targets: this.enemySprite, alpha: 1, duration: 150 });
      }
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

  updateTile(tileSlot: TileSlot, index: number = 0): void {
    const key = getTileTerrainKey(tileSlot);
    let fillColor: number;
    if (tileSlot.type === 'basic' || tileSlot.type === 'buffer') {
      fillColor = index % 2 === 0 ? 0x666666 : 0x888888;
    } else {
      const config = getTileConfig(key);
      fillColor = config.color;
    }

    this.bg.setFillStyle(fillColor);

    const reservedKey = getReservedSpriteKey(tileSlot);
    const spriteKey = reservedKey && this.scene.textures.exists(reservedKey)
      ? reservedKey
      : TILE_SPRITE_MAP[key];
    if (spriteKey && this.scene.textures.exists(spriteKey)) {
      if (this.sprite) {
        this.sprite.setTexture(spriteKey);
        this.sprite.setVisible(true);
      }
      this.bg.setVisible(false);
      this.iconText.setVisible(false);
    } else {
      if (this.sprite) this.sprite.setVisible(false);
      this.bg.setVisible(true);
      this.iconText.setVisible(true);
    }

    const updateConfig = (tileSlot.type !== 'buffer') ? getTileConfig(key) : null;
    this.iconText.setText(updateConfig?.icon ?? '');

    // Landmark reconcile
    const size = TILE_SIZE * this.tileScale;
    const newLandmarkKey = LANDMARK_MAP[key];
    if (newLandmarkKey && this.scene.textures.exists(newLandmarkKey)) {
      if (!this.landmarkSprite) {
        this.landmarkSprite = this._makeLandmark(this.scene, newLandmarkKey, size);
      } else if (this.landmarkSprite.texture.key !== newLandmarkKey) {
        this.landmarkSprite.setTexture(newLandmarkKey);
        const src = this.scene.textures.get(newLandmarkKey).getSourceImage() as HTMLImageElement;
        const scale = (size * 0.8) / Math.max(src.width, src.height);
        this.landmarkSprite.setScale(scale);
      }
      this.landmarkSprite.setVisible(true);
    } else if (this.landmarkSprite) {
      this.landmarkSprite.setVisible(false);
    }

    // Enemy sprite reconcile: pool tiles change enemyId between basic and
    // boss/combat tiles as the loop advances. Without this, the only path
    // that adds an enemy sprite was the full destroy-and-reconstruct on
    // loop completion, which caused a "pop" the first time a boss tile
    // came into view via a pool reuse.
    const shouldHaveEnemy = !!(tileSlot.enemyId && !tileSlot.defeatedThisLoop);
    if (shouldHaveEnemy) {
      const textureKey = `monster_${tileSlot.enemyId}`;
      if (!this.enemySprite) {
        this.addEnemySprite(this.scene, tileSlot.enemyId!, size, true);
      } else if (this.enemySprite.texture.key !== textureKey && this.scene.textures.exists(textureKey)) {
        this.enemySprite.setTexture(textureKey);
        this.enemySprite.setDisplaySize(size, size);
      }
    } else if (this.enemySprite) {
      this.enemySprite.destroy();
      this.enemySprite = null;
    }
    // Landmark visibility follows enemy presence: enemy takes visual priority.
    if (this.landmarkSprite) {
      this.landmarkSprite.setVisible(!shouldHaveEnemy);
    }
  }

  /**
   * Hide the colored fallback rectangle so the tile_frame card art (or any
   * other backdrop) shows around the tile sprite. Used by the planning
   * inventory previews. The tile sprite itself stays visible — with the
   * unified-card-face tile system, the sprite IS the icon (decoration baked
   * in), so hiding it would leave the inventory card blank.
   */
  hideFloor(): void {
    if (this.bg) this.bg.setVisible(false);
  }

  hideLandmark(): void {
    if (this.landmarkSprite) this.landmarkSprite.setVisible(false);
  }
}
