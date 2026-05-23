import Phaser from 'phaser';
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
  // Subtiles (8) — keys must match TileRegistry entries.
  subtile_ambush: 'tile_subtile_ambush',
  subtile_magma: 'tile_subtile_magma',
  subtile_manawell: 'tile_subtile_manawell',
  subtile_camp: 'tile_subtile_camp',
  subtile_burnaltar: 'tile_subtile_burnaltar',
  subtile_bleedtotem: 'tile_subtile_bleedtotem',
  subtile_resonance: 'tile_subtile_resonance',
  subtile_warhorn: 'tile_subtile_warhorn',
};

/** Get the terrain key for a tile slot.
 * Wave 5+: also fall back to `kind` (the registry key) so subtile slots —
 * which have type='subtile' and no terrain — resolve to their distinct
 * entries (subtile_ambush, subtile_warhorn, ...) for sprite lookup. */
function getTileTerrainKey(slot: TileSlot): string {
  return slot.terrain ?? slot.kind ?? slot.type;
}

/** Reserved (empty subtile slot) sprite picked from the host combat terrain. */
function getReservedSpriteKey(slot: TileSlot): string | null {
  if (slot.type !== 'basic' || !slot.reserved || !slot.hostTerrain) return null;
  return `tile_reserved_${slot.hostTerrain}`;
}

/**
 * TileVisual -- reusable Phaser Container for rendering a single tile.
 * Used in both the world view (scale=1, TILE_SIZE px) and planning view
 * (scale=0.5, half size). Source PNGs are 256x256; Phaser downscales.
 */
export class TileVisual extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private sprite: Phaser.GameObjects.Image | null = null;
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
      this.sprite = scene.add.image(0, 0, spriteKey);
      this.sprite.setDisplaySize(size, size);
      this.add(this.sprite);
    }

    // Icon text (only for tiles without sprites)
    const tileConfigForIcon = (tileSlot.type !== 'buffer') ? getTileConfig(key) : null;
    const fontSize = Math.round(16 * scale);
    this.iconText = scene.add.text(0, 0, tileConfigForIcon?.icon ?? '', {
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
  }

  private addEnemySprite(scene: Phaser.Scene, enemyId: string, tileSize: number, fadeIn: boolean = false): void {
    // Phase 9 (CR-01 fix): monster texture keys are namespaced `monster_*`
    // to avoid colliding with hero spritesheets (e.g. enemy 'mage' vs hero
    // Mage class). See Preloader.ts monsterIds loop.
    const textureKey = `monster_${enemyId}`;
    if (scene.textures.exists(textureKey)) {
      this.enemySprite = scene.add.sprite(0, 0, textureKey);
      this.enemySprite.setOrigin(0.5, 1.0);
      this.enemySprite.y = tileSize * 0.2; // Sobe os monstros novamente para parear com a nova altura dos itens
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
      this.iconText.setVisible(false);
    } else {
      if (this.sprite) this.sprite.setVisible(false);
      this.iconText.setVisible(true);
    }

    const updateConfig = (tileSlot.type !== 'buffer') ? getTileConfig(key) : null;
    this.iconText.setText(updateConfig?.icon ?? '');

    // Enemy sprite reconcile: pool tiles change enemyId between basic and
    // boss/combat tiles as the loop advances. Without this, the only path
    // that adds an enemy sprite was the full destroy-and-reconstruct on
    // loop completion, which caused a "pop" the first time a boss tile
    // came into view via a pool reuse.
    const size = TILE_SIZE * this.tileScale;
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
}
