import { Scene } from 'phaser';
import { saveManager } from '../core/SaveManager';
import { LAYOUT } from '../ui/StyleConstants';

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  preload(): void {
    // Ground tiles (64x64, seamless, extracted from tilesets)
    this.load.image('tile_basic', 'assets/map/tiles/tile_basic.png');
    this.load.image('tile_sand', 'assets/map/tiles/sand_tile.jpg');
    this.load.image('tile_forest', 'assets/map/tiles/tile_meadow.png');
    this.load.image('tile_graveyard', 'assets/map/tiles/tile_graveyard.png');
    this.load.image('tile_swamp', 'assets/map/tiles/tile_swamp.png');

    // Background objects (64x64, transparent)
    this.load.image('bg_basic', 'assets/map/tiles/bg_path.png');
    this.load.image('bg_forest', 'assets/map/tiles/bg_forest.png');
    this.load.image('bg_graveyard', 'assets/map/tiles/bg_graveyard.png');
    this.load.image('bg_swamp', 'assets/map/tiles/bg_swamp.png');

    // Special Floating/Resting objects
    this.load.image('bg_event', 'assets/map/objects/event_icon.png');
    this.load.image('bg_treasure', 'assets/map/objects/treasure_chest.png');
    this.load.image('bg_rest', 'assets/map/objects/rest_tent.png');
    this.load.image('bg_shop', 'assets/map/objects/shop_stall.png');

    // Building Icons
    this.load.image('icon_forge', 'assets/buildings/icons/icon_forge.png');
    this.load.image('icon_library', 'assets/buildings/icons/icon_library.png');
    this.load.image('icon_tavern', 'assets/buildings/icons/icon_tavern.png');
    this.load.image('icon_workshop', 'assets/buildings/icons/icon_workshop.png');
    this.load.image('icon_shrine', 'assets/buildings/icons/icon_shrine.png');
    this.load.image('icon_storehouse', 'assets/buildings/icons/icon_storehouse.png');

    // Character preview sprites (IA gerado)
    this.load.image('archer_preview', 'assets/characters/sprites/archer_generated.png');
    this.load.image('slime_sprite', 'assets/characters/sprites/slime_generated.png');
    this.load.image('orc_sprite', 'assets/characters/sprites/orc_generated.png');
    this.load.image('goblin_sprite', 'assets/characters/sprites/goblin_generated.png');
    this.load.image('dragon_sprite', 'assets/characters/sprites/dragon_generated.png');
    this.load.image('snake_sprite', 'assets/characters/sprites/snake_generated.png');
    this.load.image('judge_sprite', 'assets/characters/sprites/judge_generated.png');

    // Knight spritesheet (legacy character)
    this.load.spritesheet('knight_idle', 'assets/characters/sprites/FreeKnight_v1/Colour1/Outline/120x80_PNGSheets/_Idle.png', {
      frameWidth: 120,
      frameHeight: 80
    });

    // Hero spritesheets (64x64 per frame, horizontal strips)
    this.load.spritesheet('hero_walk', 'assets/characters/hero/spritesheets/hero_walk.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('hero_idle', 'assets/characters/hero/spritesheets/hero_idle.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('hero_attack', 'assets/characters/hero/spritesheets/hero_attack.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('hero_death', 'assets/characters/hero/spritesheets/hero_death.png', { frameWidth: 64, frameHeight: 64 });

    // Mage hero spritesheets (64x64 per frame, horizontal strips)
    this.load.spritesheet('mage_walk', 'assets/characters/mage/spritesheets/mage_walk.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('mage_idle', 'assets/characters/mage/spritesheets/mage_idle.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('mage_attack', 'assets/characters/mage/spritesheets/mage_attack.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('mage_death', 'assets/characters/mage/spritesheets/mage_death.png', { frameWidth: 64, frameHeight: 64 });

    // Monster spritesheets (64x64 per frame, horizontal strips)
    const monsterIds = ['slime', 'goblin', 'orc', 'mage', 'elite_knight', 'boss_demon'];
    for (const id of monsterIds) {
      this.load.spritesheet(`${id}_idle`, `assets/characters/monsters/${id}/spritesheets/${id}_idle.png`, { frameWidth: 64, frameHeight: 64 });
      this.load.spritesheet(`${id}_attack`, `assets/characters/monsters/${id}/spritesheets/${id}_attack.png`, { frameWidth: 64, frameHeight: 64 });
      this.load.spritesheet(`${id}_death`, `assets/characters/monsters/${id}/spritesheets/${id}_death.png`, { frameWidth: 64, frameHeight: 64 });
    }

    // Scene backgrounds (400x400, scaled to fill 800x600)
    this.load.image('bg_city', 'assets/backgrounds/bg_city.png');
    this.load.image('bg_run', 'assets/backgrounds/bg_run.png');
    this.load.image('bg_battle_basic', 'assets/backgrounds/bg_battle_basic.png');
    this.load.image('bg_battle_forest', 'assets/backgrounds/bg_battle_forest.png');
    this.load.image('bg_battle_graveyard', 'assets/backgrounds/bg_battle_graveyard.png');
    this.load.image('bg_battle_swamp', 'assets/backgrounds/bg_battle_swamp.png');
    this.load.image('homepage', 'assets/backgrounds/homepage.jpg');

    // Desert Parallax backgrounds
    this.load.image('bg_desert', 'assets/backgrounds/desert.png');
    this.load.image('bg_desert_sky', 'assets/backgrounds/desert-background.jpg');

    // Special tile icons (64x64)
    this.load.image('tile_shop', 'assets/map/tiles/tile_shop.png');
    this.load.image('tile_rest', 'assets/map/tiles/tile_rest.png');
    this.load.image('tile_event', 'assets/map/tiles/tile_event.png');
    this.load.image('tile_treasure', 'assets/map/tiles/tile_treasure.png');
    this.load.image('tile_boss', 'assets/map/tiles/tile_boss.png');

    // Building panel backgrounds
    this.load.image('library_table', 'assets/buildings/backgrounds/library-table.png');
    this.load.image('workshop_table', 'assets/buildings/backgrounds/workshop-table.png');
    this.load.image('forge_table', 'assets/buildings/backgrounds/forge-table.png');
    this.load.image('tavern_table', 'assets/buildings/backgrounds/tavern.png');
    this.load.image('shrine_table', 'assets/buildings/backgrounds/shrine.png');
    this.load.image('vault_table', 'assets/buildings/backgrounds/vault.png');

    // UI Panels & textures
    this.load.image('bar_wood', 'assets/ui/panels/bar-wood.png');
    this.load.image('wood_texture', 'assets/ui/panels/wood-texture.png');
    this.load.image('wood_texture_big', 'assets/ui/panels/wood-texture-big.png');
    this.load.image('bg_character_selection', 'assets/ui/panels/background-character-selection.jpg');
    this.load.image('icon_table', 'assets/ui/panels/icon-table.png');
    this.load.image('wood_board_collection', 'assets/ui/panels/wood-board-collection.png');
    this.load.image('icons_up_table', 'assets/ui/panels/icons-up-table.png');
    this.load.image('base_icon_place', 'assets/ui/panels/base-icon-place.png');
    this.load.image('collection_headline', 'assets/ui/panels/collection-headline.png');
    this.load.image('bg_base_option', 'assets/ui/panels/base-option.png');
    this.load.image('fog', 'assets/ui/panels/fog.png');
    this.load.image('tile_selection_board', 'assets/ui/panels/tile-selection-board.png');
    this.load.image('tile_frame', 'assets/ui/panels/tile-frame.png');
    this.load.image('deck_frame', 'assets/ui/panels/deck-frame.png');
    this.load.image('deck_status_board', 'assets/ui/panels/deck-status-board.png');
    this.load.image('bg_tile_selection', 'assets/ui/panels/background-tile-selection.png');
    this.load.image('bg_shop_scene', 'assets/buildings/backgrounds/shop.png');
    this.load.image('healthbar', 'assets/ui/panels/healthbar.png');
    this.load.image('deck_relic_table', 'assets/ui/panels/deck-relic-table.png');
    this.load.image('achievements_bg', 'assets/ui/panels/achievments.png');

    // UI Buttons
    this.load.image('btn_continue_run', 'assets/ui/buttons/continue-run.png');
    this.load.image('btn_new_game', 'assets/ui/buttons/new-game.png');
    this.load.image('btn_keep_my_run', 'assets/ui/buttons/keep-my-run.png');
    this.load.image('btn_yes_delete', 'assets/ui/buttons/yes, delete.png');
    this.load.image('btn_start_loop', 'assets/ui/buttons/start-loop.png');

    // Material Icons
    this.load.image('mat_iron', 'assets/icons/iron.png');
    this.load.image('mat_crystal', 'assets/icons/crystal.png');
    this.load.image('mat_scroll', 'assets/icons/scroll.png');
    this.load.image('mat_wood', 'assets/icons/wood.png');
    this.load.image('mat_stone', 'assets/icons/stone.png');
    this.load.image('mat_bone', 'assets/icons/stone.png');
    this.load.image('mat_essence', 'assets/icons/essence.png');
    this.load.image('deck_icon', 'assets/icons/deck-icon.png');
    this.load.image('relic_icon', 'assets/icons/relic-icon.png');

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
    this.load.audio('theme_song', 'assets/audio/theme-song.mp3');
    this.load.audio('town_song', 'assets/audio/town-song.mp3');
    this.load.audio('walk_forward', 'assets/audio/walk-forward.mp3');
    this.load.audio('sfx_click', 'assets/audio/select.mp3');
    this.load.audio('sfx_slash', 'assets/audio/slash.mp3');
    this.load.audio('sfx_fireball', 'assets/audio/fire.m4a');
    this.load.audio('sfx_hurt', 'assets/audio/hurt.m4a');
    this.load.audio('sfx_cashing', 'assets/audio/cashing.m4a');
    this.load.audio('ambience_wind', 'assets/audio/wind.wav');
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

    this.scene.launch('GlobalSound');
    this.scene.start('MainMenu');
  }
}
