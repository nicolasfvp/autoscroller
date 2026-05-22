import { Scene } from 'phaser';
import { saveManager } from '../core/SaveManager';
import { eventBus } from '../core/EventBus';
import { LAYOUT } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';

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
    this.load.image('tile_desert', 'assets/map/tiles/tile_desert.png');
    // tile_lava.png not yet authored — TileVisual falls back to color fill.

    // Background objects (64x64, transparent)
    this.load.image('bg_basic', 'assets/map/tiles/bg_path.png');
    // bg_forest.png not yet authored — TileVisual.BG_SPRITE_MAP falls back
    // via textures.exists() and renders no decoration for forest tiles.
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

    // Monster static images
    const staticMonsters = [
      { id: 'corpse_eater', folder: 'cemetery', file: 'corpse eater.png' },
      { id: 'headless_fire_horse', folder: 'cemetery', file: 'headless fire horse.png' },
      { id: 'pocket_cat', folder: 'cemetery', file: 'pocket cat.png' },
      { id: 'doom_knight', folder: 'default', file: 'doom knight.png' },
      { id: 'iron_golem', folder: 'default', file: 'iron golem.png' },
      { id: 'lizard_king', folder: 'default', file: 'lizard king.png' },
      { id: 'baby_dragon', folder: 'desert', file: 'baby dragon.png' },
      { id: 'giant_beetle', folder: 'desert', file: 'giant beetle.png' },
      { id: 'mutated_salamander', folder: 'desert', file: 'mutated salamander.png' },
      { id: 'ancient_tree', folder: 'forest', file: 'ancient tree.png' },
      { id: 'giant_spider_2', folder: 'forest', file: 'giant spider 2.png' },
      { id: 'giant_spider', folder: 'forest', file: 'giant spider.png' },
      { id: 'mush', folder: 'forest', file: 'mush.png' },
      { id: 'forge_slime', folder: 'lava', file: 'forge slime.png' },
      { id: 'lava_golen', folder: 'lava', file: 'lava golen.png' },
      { id: 'mecha_warrior', folder: 'lava', file: 'mecha warrior.png' },
      { id: 'depths_horror', folder: 'swamp', file: 'depths horror.png' },
      { id: 'toxic_gooze', folder: 'swamp', file: 'toxic gooze.png' },
      { id: 'venomous_kobra', folder: 'swamp', file: 'venomous kobra.png' },
      { id: 'lost_lizard', folder: '', file: 'lost_lizard_1.png' }
    ];
    for (const m of staticMonsters) {
      const path = m.folder ? `assets/characters/monsters/${m.folder}/${m.file}` : `assets/characters/monsters/${m.file}`;
      this.load.image(`monster_${m.id}`, path);
      const path2 = path.replace(/(_1)?\.png$/i, '_2.png');
      this.load.image(`monster_${m.id}_2`, path2);
    }

    // Scene backgrounds (400x400, scaled to fill 800x600)
    this.load.image('bg_city', 'assets/backgrounds/bg_city.png');
    // bg_run.png not yet authored — GameScene falls back to bg_desert when
    // bg_run is missing (see GameScene.ts createDesertBackgrounds).
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
    this.load.image('mat_herbs', 'assets/icons/herbs.png');
    this.load.image('deck_icon', 'assets/icons/deck-icon.png');
    this.load.image('relic_icon', 'assets/icons/relic-icon.png');

    // Relic Illustrations
    // Phase 9 (Design v2) purge: removed `spell_focus` and `warrior_spirit`
    // -- both dropped by the v2 wholesale rewrite (09-02-SUMMARY: "5 v1 relic
    // IDs removed; iron_will retained as a neutral rare"). All remaining
    // IDs verified to exist in v2 relics.json on 2026-05-11.
    const relicIds = [
      'arcane_crystal', 'berserker_ring', 'blood_pact', 'bronze_scale', 'demon_heart',
      'energy_potion', 'first_strike_amulet', 'iron_will', 'mana_stone', 'phoenix_feather',
      'swift_boots', 'thin_deck_charm', 'vitality_ring'
    ];

    for (const id of relicIds) {
      this.load.image(`relic_${id}`, `assets/relics/${id}.png`);
    }

    // Card Illustrations
    // Legacy card art (old system — kept for compatibility with any remaining references)
    const legacyJpgCards = new Set([
      'chain-lightning', 'energy-surge', 'haste', 'poison-cloud', 'sacrifice', 'soul-rend',
      'berserker', 'bulwark', 'doom-blade', 'heavy-hit', 'last-stand', 'mana-drain',
      'meditate', 'parry', 'strike', 'vampiric-touch', 'weaken'
    ]);
    const legacyCardIds = [
      'strike', 'heavy-hit', 'fury', 'berserker', 'counter-strike', 'defend', 'shield-wall',
      'fortify', 'iron-skin', 'fireball', 'heal', 'arcane-shield', 'rejuvenate', 'mana-drain',
      'weaken', 'cleave', 'reckless-charge', 'execute', 'doom-blade', 'parry', 'bulwark',
      'last-stand', 'meditate', 'vampiric-touch', 'haste', 'energy-surge', 'poison-cloud',
      'soul-rend', 'sacrifice', 'chain-lightning'
    ];
    for (const id of legacyCardIds) {
      const ext = legacyJpgCards.has(id) ? '.jpg' : '.png';
      this.load.image(`card_${id}`, `assets/cards/${id}${ext}`);
    }

    // New element-based card art (Tier 1 + Tier 2, all PNG)
    const newCardIds = [
      // T1 — pure elements
      't1-attack-attack', 't1-defense-defense', 't1-agility-agility', 't1-counter-counter',
      't1-fire-fire', 't1-water-water', 't1-air-air', 't1-earth-earth',
      // T1 — cross elements
      't1-agility-attack', 't1-agility-counter', 't1-agility-defense', 't1-agility-fire',
      't1-agility-water', 't1-agility-air', 't1-agility-earth',
      't1-attack-counter', 't1-attack-defense', 't1-attack-fire', 't1-attack-water',
      't1-air-attack', 't1-attack-earth', 't1-counter-defense', 't1-counter-fire',
      't1-counter-water', 't1-air-counter', 't1-counter-earth', 't1-defense-fire',
      't1-defense-water', 't1-air-defense', 't1-defense-earth', 't1-fire-water',
      't1-air-fire', 't1-earth-fire', 't1-air-water', 't1-earth-water', 't1-air-earth',
      // T2 — physical pure
      't2-attack-attack-attack', 't2-defense-defense-defense',
      't2-agility-agility-agility', 't2-counter-counter-counter',
      // T2 — elemental pure
      't2-fire-fire-fire', 't2-water-water-water', 't2-air-air-air', 't2-earth-earth-earth',
      // T2 — physical mixed
      't2-attack-attack-defense', 't2-agility-attack-attack', 't2-attack-attack-counter',
      't2-attack-defense-defense', 't2-agility-defense-defense', 't2-counter-defense-defense',
      't2-agility-agility-attack', 't2-agility-agility-defense', 't2-agility-agility-counter',
      't2-attack-counter-counter', 't2-counter-counter-defense', 't2-agility-counter-counter',
      't2-agility-attack-defense', 't2-attack-counter-defense', 't2-agility-attack-counter',
      't2-agility-counter-defense',
      // T2 — elemental mixed
      't2-fire-fire-water', 't2-air-fire-fire', 't2-earth-fire-fire',
      't2-fire-water-water', 't2-air-water-water', 't2-earth-water-water',
      't2-air-air-fire', 't2-air-air-water', 't2-air-air-earth',
      't2-earth-earth-fire', 't2-earth-earth-water', 't2-air-earth-earth',
      't2-air-fire-water', 't2-earth-fire-water', 't2-air-earth-fire',
      't2-air-earth-water',
      // T2 — physical × elemental
      't2-attack-attack-fire', 't2-attack-attack-water', 't2-air-attack-attack', 't2-attack-attack-earth',
      't2-defense-defense-fire', 't2-defense-defense-water', 't2-air-defense-defense', 't2-defense-defense-earth',
      't2-agility-agility-fire', 't2-agility-agility-water', 't2-agility-agility-air', 't2-agility-agility-earth',
      't2-counter-counter-fire', 't2-counter-counter-water', 't2-air-counter-counter', 't2-counter-counter-earth',
      't2-attack-defense-fire', 't2-attack-defense-water', 't2-air-attack-defense', 't2-attack-defense-earth',
      't2-agility-attack-fire', 't2-agility-attack-water', 't2-agility-air-attack', 't2-agility-attack-earth',
      't2-attack-counter-fire', 't2-attack-counter-water', 't2-air-attack-counter', 't2-attack-counter-earth',
      't2-agility-defense-fire', 't2-agility-defense-water', 't2-agility-air-defense', 't2-agility-defense-earth',
      't2-counter-defense-fire', 't2-counter-defense-water', 't2-air-counter-defense', 't2-counter-defense-earth',
      't2-agility-counter-fire', 't2-agility-counter-water', 't2-agility-air-counter', 't2-agility-counter-earth',
      't2-attack-fire-fire', 't2-attack-water-water', 't2-air-air-attack', 't2-attack-earth-earth',
      't2-attack-fire-water', 't2-air-attack-fire', 't2-attack-earth-fire', 't2-air-attack-water',
      't2-attack-earth-water', 't2-air-attack-earth',
      't2-defense-fire-fire', 't2-defense-water-water', 't2-air-air-defense', 't2-defense-earth-earth',
      't2-defense-fire-water', 't2-air-defense-fire', 't2-defense-earth-fire', 't2-air-defense-water',
      't2-defense-earth-water', 't2-air-defense-earth',
      't2-agility-fire-fire', 't2-agility-water-water', 't2-agility-air-air', 't2-agility-earth-earth',
      't2-agility-fire-water', 't2-agility-air-fire', 't2-agility-earth-fire', 't2-agility-air-water',
      't2-agility-earth-water', 't2-agility-air-earth',
      't2-counter-fire-fire', 't2-counter-water-water', 't2-air-air-counter', 't2-counter-earth-earth',
      't2-counter-fire-water', 't2-air-counter-fire', 't2-counter-earth-fire', 't2-air-counter-water',
      't2-counter-earth-water', 't2-air-counter-earth',
    ];
    for (const id of newCardIds) {
      this.load.image(`card_${id}`, `assets/cards/${id}.png`);
    }

    // Hero-test sprites (temporary test assets)
    this.load.image('hero_test_idle', 'assets/hero_test/idle.png');
    this.load.image('hero_test_idle2', 'assets/hero_test/idle2.png');
    this.load.spritesheet('hero_test_attack', 'assets/hero_test/atack.png', { frameWidth: 451, frameHeight: 553 });

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

    // Pass saved run info to MainMenu via registry as a fast-paint hint.
    // Invalidation contract: MainMenu always re-loads from IDB before
    // deciding whether to show "Continue", and removes this key after
    // reading. Other scenes that clear the run also null this out via
    // the run:cleared listener below, so a stale hint can never survive
    // long enough to mislead the menu.
    this.registry.set('savedRun', savedRun);

    // Keep the registry copy in sync when the active run is cleared elsewhere
    // (PauseScene "Abandon Run", BossExitScene safe path, DeathScene, etc.)
    const game = this.game;
    eventBus.on('run:cleared', () => {
      game.registry.set('savedRun', null);
    });

    this.scene.launch('GlobalSound');
    this.scene.launch(SCENE_KEYS.SPEED_PANEL);
    this.scene.start('MainMenu');
  }
}
