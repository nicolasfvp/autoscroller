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

    // Carregando os monstros e herois em batch (IA gerado)
    this.load.image('archer_preview', 'assets/sprites/archer_generated.png');
    this.load.image('archer_reference', 'assets/sprites/archer.png');
    
    this.load.image('slime_sprite', 'assets/sprites/slime_generated.png');
    this.load.image('orc_sprite', 'assets/sprites/orc_generated.png');
    this.load.image('goblin_sprite', 'assets/sprites/goblin_generated.png');
    this.load.image('dragon_sprite', 'assets/sprites/dragon_generated.png');
    this.load.image('snake_sprite', 'assets/sprites/snake_generated.png');
    this.load.image('judge_sprite', 'assets/sprites/judge_generated.png');

    // Carregando a SpriteSheet do Cavaleiro (Idle)
    this.load.spritesheet('knight_idle', 'assets/sprites/FreeKnight_v1/Colour1/Outline/120x80_PNGSheets/_Idle.png', {
      frameWidth: 120,
      frameHeight: 80
    });
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
