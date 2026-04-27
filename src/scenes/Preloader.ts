import { Scene } from 'phaser';
import { saveManager } from '../core/SaveManager';
import { LAYOUT } from '../ui/StyleConstants';

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  preload(): void {
    // Ground tiles (64x64, seamless, extracted from tilesets)
    this.load.image('tile_basic', 'assets/tiles/tile_basic.png');
    this.load.image('tile_sand', 'assets/tiles/sand_tile.jpg');
    this.load.image('tile_forest', 'assets/tiles/tile_forest.png');
    this.load.image('tile_graveyard', 'assets/tiles/tile_graveyard.png');
    this.load.image('tile_swamp', 'assets/tiles/tile_swamp.png');

    // Background objects (64x64, transparent)
    this.load.image('bg_basic', 'assets/tiles/bg_path.png');
    this.load.image('bg_forest', 'assets/tiles/tile_forest.png');
    this.load.image('bg_graveyard', 'assets/tiles/bg_graveyard.png');
    this.load.image('bg_swamp', 'assets/tiles/bg_swamp.png');

    // Special Floating/Resting objects
    this.load.image('bg_event', 'assets/objects/event_icon.png');
    this.load.image('bg_treasure', 'assets/objects/treasure_chest.png');
    this.load.image('bg_rest', 'assets/objects/rest_tent.png');
    this.load.image('bg_shop', 'assets/objects/shop_stall.png');

    // Building Icons
    this.load.image('icon_forge', 'assets/buildings/icon_forge.png');
    this.load.image('icon_library', 'assets/buildings/icon_library.png');
    this.load.image('icon_tavern', 'assets/buildings/icon_tavern.png');
    this.load.image('icon_workshop', 'assets/buildings/icon_workshop.png');
    this.load.image('icon_shrine', 'assets/buildings/icon_shrine.png');
    this.load.image('icon_storehouse', 'assets/buildings/icon_storehouse.png');

    // Carregando os monstros e herois em batch (IA gerado)
    this.load.image('archer_preview', 'assets/sprites/archer_generated.png');
    this.load.image('archer_reference', 'assets/sprites/archer.png');
    this.load.image('bar_wood', 'assets/objects/bar-wood.png');
    this.load.image('wood_texture', 'assets/objects/wood-texture.png');
    
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

    // Hero spritesheets (64x64 per frame, horizontal strips)
    this.load.spritesheet('hero_walk', 'assets/hero/spritesheets/hero_walk.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('hero_idle', 'assets/hero/spritesheets/hero_idle.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('hero_attack', 'assets/hero/spritesheets/hero_attack.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('hero_death', 'assets/hero/spritesheets/hero_death.png', { frameWidth: 64, frameHeight: 64 });

    // Mage hero spritesheets (64x64 per frame, horizontal strips)
    this.load.spritesheet('mage_walk', 'assets/mage/spritesheets/mage_walk.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('mage_idle', 'assets/mage/spritesheets/mage_idle.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('mage_attack', 'assets/mage/spritesheets/mage_attack.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('mage_death', 'assets/mage/spritesheets/mage_death.png', { frameWidth: 64, frameHeight: 64 });

    // Monster spritesheets (64x64 per frame, horizontal strips)
    const monsterIds = ['slime', 'goblin', 'orc', 'mage', 'elite_knight', 'boss_demon'];
    for (const id of monsterIds) {
      this.load.spritesheet(`${id}_idle`, `assets/monsters/${id}/spritesheets/${id}_idle.png`, { frameWidth: 64, frameHeight: 64 });
      this.load.spritesheet(`${id}_attack`, `assets/monsters/${id}/spritesheets/${id}_attack.png`, { frameWidth: 64, frameHeight: 64 });
      this.load.spritesheet(`${id}_death`, `assets/monsters/${id}/spritesheets/${id}_death.png`, { frameWidth: 64, frameHeight: 64 });
    }

    // Scene backgrounds (400x400, scaled to fill 800x600)
    this.load.image('bg_city', 'assets/backgrounds/bg_city.png');
    this.load.image('bg_run', 'assets/backgrounds/bg_run.png');
    this.load.image('bg_battle_basic', 'assets/backgrounds/bg_battle_basic.png');
    this.load.image('bg_battle_forest', 'assets/backgrounds/bg_battle_forest.png');
    this.load.image('bg_battle_graveyard', 'assets/backgrounds/bg_battle_graveyard.png');
    this.load.image('bg_battle_swamp', 'assets/backgrounds/bg_battle_swamp.png');

    // Desert Parallax backgrounds
    this.load.image('bg_desert', 'assets/backgrounds/desert.png');
    this.load.image('bg_desert_sky', 'assets/backgrounds/desert-background.jpg');

    // Special tile icons (64x64)
    this.load.image('tile_shop', 'assets/tiles/tile_shop.png');
    this.load.image('tile_rest', 'assets/tiles/tile_rest.png');
    this.load.image('tile_event', 'assets/tiles/tile_event.png');
    this.load.image('tile_treasure', 'assets/tiles/tile_treasure.png');
    this.load.image('tile_boss', 'assets/tiles/tile_boss.png');

    // Card Illustrations
    const cardIds = [
      'strike', 'heavy-hit', 'fury', 'berserker', 'counter-strike', 'defend', 'shield-wall', 
      'fortify', 'iron-skin', 'fireball', 'heal', 'arcane-shield', 'rejuvenate', 'mana-drain', 
      'weaken', 'cleave', 'reckless-charge', 'execute', 'doom-blade', 'parry', 'bulwark', 
      'last-stand', 'meditate', 'vampiric-touch', 'haste', 'energy-surge', 'poison-cloud', 
      'soul-rend', 'sacrifice', 'chain-lightning'
    ];

    const jpgCards = new Set([
      'chain-lightning', 'energy-surge', 'haste', 'poison-cloud', 'sacrifice', 'soul-rend',
      'berserker', 'bulwark', 'doom-blade', 'heavy-hit', 'last-stand', 'mana-drain',
      'meditate', 'parry', 'strike', 'vampiric-touch', 'weaken'
    ]);

    for (const id of cardIds) {
      const ext = jpgCards.has(id) ? '.jpg' : '.png';
      this.load.image(`card_${id}`, `assets/cards/${id}${ext}`);
    }

    // Audio
    this.load.audio('walk_forward', 'assets/songs/walk-forward.mp3');
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
