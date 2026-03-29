import { Scene } from 'phaser';
import { saveManager } from '../core/SaveManager';
import { LAYOUT } from '../ui/StyleConstants';

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  preload(): void {
    // Ground tilesets (4x4 Wang tilesets, 32x32 per tile, 128x128 spritesheet)
    this.load.spritesheet('tileset_basic', 'assets/tiles/tileset_path.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('tileset_forest', 'assets/tiles/tileset_forest.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('tileset_graveyard', 'assets/tiles/tileset_graveyard.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('tileset_swamp', 'assets/tiles/tileset_swamp.png', { frameWidth: 32, frameHeight: 32 });

    // Background objects (64x64, transparent)
    this.load.image('bg_basic', 'assets/tiles/bg_path.png');
    this.load.image('bg_forest', 'assets/tiles/bg_forest.png');
    this.load.image('bg_graveyard', 'assets/tiles/bg_graveyard.png');
    this.load.image('bg_swamp', 'assets/tiles/bg_swamp.png');
  }

  async create(): Promise<void> {
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);
    // Show a simple loading indicator
    this.add.rectangle(400, 300, 468, 32).setStrokeStyle(1, 0xffffff);
    const bar = this.add.rectangle(400 - 230, 300, 4, 28, 0xffffff);

    // Simulate brief load
    bar.width = 464;

    // Check for existing saved run
    const savedRun = await saveManager.load();

    // Pass saved run info to MainMenu via registry
    this.registry.set('savedRun', savedRun);

    this.scene.start('MainMenu');
  }
}
