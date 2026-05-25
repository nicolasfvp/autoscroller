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
    // Tile sprites — single 256x256 all-in-one diorama per tile (decorations
    // baked in). No more bg_* overlay layer; one image fully represents the
    // tile. Phaser downscales to TILE_SIZE at draw time.
    this.load.image('tile_basic', 'assets/map/tiles/tile_basic.png');
    this.load.image('tile_forest', 'assets/map/tiles/tile_forest.png');
    this.load.image('tile_graveyard', 'assets/map/tiles/tile_graveyard.png');
    this.load.image('tile_swamp', 'assets/map/tiles/tile_swamp.png');
    this.load.image('tile_desert', 'assets/map/tiles/tile_desert.png');
    this.load.image('tile_lava', 'assets/map/tiles/tile_lava.png');

    // Subtile sprites (8 effect-spot variants).
    const subtileIds = [
      'ambush', 'magma', 'manawell', 'camp',
      'burnaltar', 'bleedtotem', 'resonance', 'warhorn',
    ];
    for (const id of subtileIds) {
      this.load.image(`tile_subtile_${id}`, `assets/map/tiles/tile_subtile_${id}.png`);
    }

    // Reserved-slot sprites: sparse extension of each combat terrain. The
    // reserved sprite is picked at render time based on the slot's host
    // terrain (set by LoopRunner.recomputeReservations).
    const reservedIds = ['forest', 'graveyard', 'swamp', 'desert', 'lava'];
    for (const id of reservedIds) {
      this.load.image(`tile_reserved_${id}`, `assets/map/tiles/tile_reserved_${id}.png`);
    }

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

    // Hero warrior assets
    this.load.image('hero_idle',  'assets/characters/hero/idle/idle_1.png');
    this.load.image('hero_idle2', 'assets/characters/hero/idle/idle_2.png');
    this.load.spritesheet('hero_walk',   'assets/characters/hero/scrolling/hero_walk.png', { frameWidth: 64, frameHeight: 64 });
    // Mage scrolling animation (10-frame run, 512×512 per frame)
    this.load.spritesheet('mage_walk',   'assets/characters/mage/scrolling/spritesheet.png', { frameWidth: 512, frameHeight: 512 });
    this.load.spritesheet('hero_attack', 'assets/characters/hero/attack/attack.png', { frameWidth: 451, frameHeight: 553 });
    // Warrior selection preview (2-frame idle, 500x437 per frame)
    this.load.spritesheet('warrior_select', 'assets/characters/hero/selection/spritesheet.png', { frameWidth: 500, frameHeight: 437 });

    // Mage selection preview (7-frame idle, 386x501 per frame)
    this.load.spritesheet('mage_select', 'assets/characters/mage/selection/spritesheet.png', { frameWidth: 386, frameHeight: 501 });

    // Mage combat spritesheets (9-frame idle, 12-frame attack; 640×562 per frame)
    this.load.spritesheet('mage_idle',   'assets/characters/mage/idle/spritesheet.png',   { frameWidth: 640, frameHeight: 562 });
    this.load.spritesheet('mage_attack', 'assets/characters/mage/attack/spritesheet.png', { frameWidth: 640, frameHeight: 562 });
    this.load.image('mage_defeat_bg',    'assets/characters/mage/defeat/defeat.jpg');
    this.load.spritesheet('hero_chibi_mage', 'assets/characters/mage/pocket/spritesheet.png', { frameWidth: 256, frameHeight: 256 });
    this.load.image('warrior_defeat_bg', 'assets/characters/hero/defeat/defeat.jpg');

    // Monster static images — files with _1.png suffix auto-derive _2 via regex below
    const staticMonsters = [
      { id: 'corpse_eater',         folder: 'cemetery', file: 'corpse eater_1.png' },
      { id: 'headless_fire_horse',  folder: 'cemetery', file: 'headless fire horse.png' },
      { id: 'pocket_cat',           folder: 'cemetery', file: 'pocket cat.png' },
      { id: 'ogre',                 folder: 'cemetery', file: 'ogre.png' },
      { id: 'zombie',               folder: 'cemetery', file: 'zombie.png' },
      { id: 'doom_knight',          folder: 'default',  file: 'doom knight.png' },
      { id: 'iron_golem',           folder: 'default',  file: 'iron golem.png' },
      { id: 'lizard_king',          folder: 'default',  file: 'lizard king.png' },
      { id: 'baby_dragon',          folder: 'desert',   file: 'baby dragon_1.png' },
      { id: 'giant_beetle',         folder: 'desert',   file: 'giant beetle.png' },
      { id: 'mutated_salamander',   folder: 'desert',   file: 'mutated salamander_1.png' },
      { id: 'ancient_tree',         folder: 'forest',   file: 'ancient tree.png' },
      { id: 'giant_spider_2',       folder: 'forest',   file: 'giant spider 2.png' },
      { id: 'giant_spider',         folder: 'forest',   file: 'giant spider.png' },
      { id: 'mush',                 folder: 'forest',   file: 'mush.png' },
      { id: 'forge_slime',          folder: 'lava',     file: 'forge slime_1.png' },
      { id: 'lava_golen',           folder: 'lava',     file: 'lava golen.png' },
      { id: 'mecha_warrior',        folder: 'lava',     file: 'mecha warrior.png' },
      { id: 'depths_horror',        folder: 'swamp',    file: 'depths horror_1.png' },
      { id: 'toxic_gooze',          folder: 'swamp',    file: 'toxic gooze_1.png' },
      { id: 'venomous_kobra',       folder: 'swamp',    file: 'venomous kobra_1.png' },
      { id: 'lost_lizard',          folder: '',         file: 'lost_lizard_1.png' },
      { id: 'boss_berserker',       folder: '',         file: 'boss_berserker.png' },
      { id: 'boss_demon',           folder: '',         file: 'boss_demon.png' },
      { id: 'boss_hydra',           folder: '',         file: 'boss_hydra.png' },
      { id: 'boss_mage',            folder: '',         file: 'boss_mage.png' },
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

    // Special tile sprites (256x256, baked-in decoration).
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
    this.load.image('belt_pillar', 'assets/ui/panels/pilar.png');
    this.load.image('tile_frame', 'assets/ui/panels/tile-frame.png');
    this.load.image('deck_frame', 'assets/ui/panels/deck-frame.png');
    this.load.image('deck_status_board', 'assets/ui/panels/deck-status-board.png');
    this.load.image('bg_tile_selection', 'assets/ui/panels/background-tile-selection.png');
    this.load.image('bg_shop_scene', 'assets/buildings/backgrounds/shop.png');
    this.load.image('healthbar', 'assets/ui/panels/healthbar.png');
    this.load.image('deck_relic_table', 'assets/ui/panels/deck-relic-table.png');
    this.load.image('achievements_bg', 'assets/ui/panels/achievments.png');
    this.load.image('card_mold', 'assets/ui/panels/card_mold.png');

    // UI Buttons
    this.load.image('btn_continue_run', 'assets/ui/buttons/continue-run.png');
    this.load.image('btn_new_game', 'assets/ui/buttons/new-game.png');
    this.load.image('btn_daily_run', 'assets/ui/buttons/daily-run.png');
    this.load.image('btn_keep_my_run', 'assets/ui/buttons/keep-my-run.png');
    this.load.image('btn_yes_delete', 'assets/ui/buttons/yes, delete.png');
    this.load.image('btn_start_loop', 'assets/ui/buttons/start-loop.png');
    this.load.image('btn_start_loop_scene', 'assets/ui/buttons/start-loop-loop-scene.png');
    this.load.image('btn_dont_stop', "assets/ui/buttons/don't-stop.png");
    this.load.image('btn_skip_1',  'assets/ui/buttons/1.png');
    this.load.image('btn_skip_5',  'assets/ui/buttons/5.png');
    this.load.image('btn_skip_10', 'assets/ui/buttons/10.png');
    this.load.image('btn_skip_25', 'assets/ui/buttons/25.png');
    this.load.image('shop_icon', 'assets/icons/shop.png');
    this.load.image('forge_icon', 'assets/icons/forge.png');

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
    this.load.image('icon_coin', 'assets/icons/coin.png');
    this.load.image('icon_brick', 'assets/icons/brick.png');
    this.load.image('icon_card', 'assets/icons/card.jpg');

    // Card token icons (audit §1.2): bracketed icon tokens like [burn], [str].
    // IconTokens.renderTokenText prefers `icon_${token}` textures when present
    // and falls back to colored caps text otherwise.
    const cardTokenIds = [
      // Stack DoTs / status
      'burn', 'bleed', 'poison', 'slow', 'stun', 'rage',
      // Stats
      'str', 'vit', 'dex', 'int', 'spi',
      // Resources / vitals
      'stam', 'mana', 'HP', 'armor', 'exhaust',
      // Elements
      'attack', 'defense', 'agility', 'counter',
      'fire', 'water', 'air', 'earth',
    ];
    for (const token of cardTokenIds) {
      this.load.image(`icon_${token}`, `assets/icons/tokens/${token}.png`);
    }

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
      't2-attack-attack', 't2-defense-defense', 't2-agility-agility', 't2-counter-counter',
      't2-fire-fire', 't2-water-water', 't2-air-air', 't2-earth-earth',
      // T1 — cross elements
      't2-agility-attack', 't2-agility-counter', 't2-agility-defense', 't2-agility-fire',
      't2-agility-water', 't2-agility-air', 't2-agility-earth',
      't2-attack-counter', 't2-attack-defense', 't2-attack-fire', 't2-attack-water',
      't2-air-attack', 't2-attack-earth', 't2-counter-defense', 't2-counter-fire',
      't2-counter-water', 't2-air-counter', 't2-counter-earth', 't2-defense-fire',
      't2-defense-water', 't2-air-defense', 't2-defense-earth', 't2-fire-water',
      't2-air-fire', 't2-earth-fire', 't2-air-water', 't2-earth-water', 't2-air-earth',
      // T2 — physical pure
      't3-attack-attack-attack', 't3-defense-defense-defense',
      't3-agility-agility-agility', 't3-counter-counter-counter',
      // T2 — elemental pure
      't3-fire-fire-fire', 't3-water-water-water', 't3-air-air-air', 't3-earth-earth-earth',
      // T2 — physical mixed
      't3-attack-attack-defense', 't3-agility-attack-attack', 't3-attack-attack-counter',
      't3-attack-defense-defense', 't3-agility-defense-defense', 't3-counter-defense-defense',
      't3-agility-agility-attack', 't3-agility-agility-defense', 't3-agility-agility-counter',
      't3-attack-counter-counter', 't3-counter-counter-defense', 't3-agility-counter-counter',
      't3-agility-attack-defense', 't3-attack-counter-defense', 't3-agility-attack-counter',
      't3-agility-counter-defense',
      // T2 — elemental mixed
      't3-fire-fire-water', 't3-air-fire-fire', 't3-earth-fire-fire',
      't3-fire-water-water', 't3-air-water-water', 't3-earth-water-water',
      't3-air-air-fire', 't3-air-air-water', 't3-air-air-earth',
      't3-earth-earth-fire', 't3-earth-earth-water', 't3-air-earth-earth',
      't3-air-fire-water', 't3-earth-fire-water', 't3-air-earth-fire',
      't3-air-earth-water',
      // T2 — physical × elemental
      't3-attack-attack-fire', 't3-attack-attack-water', 't3-air-attack-attack', 't3-attack-attack-earth',
      't3-defense-defense-fire', 't3-defense-defense-water', 't3-air-defense-defense', 't3-defense-defense-earth',
      't3-agility-agility-fire', 't3-agility-agility-water', 't3-agility-agility-air', 't3-agility-agility-earth',
      't3-counter-counter-fire', 't3-counter-counter-water', 't3-air-counter-counter', 't3-counter-counter-earth',
      't3-attack-defense-fire', 't3-attack-defense-water', 't3-air-attack-defense', 't3-attack-defense-earth',
      't3-agility-attack-fire', 't3-agility-attack-water', 't3-agility-air-attack', 't3-agility-attack-earth',
      't3-attack-counter-fire', 't3-attack-counter-water', 't3-air-attack-counter', 't3-attack-counter-earth',
      't3-agility-defense-fire', 't3-agility-defense-water', 't3-agility-air-defense', 't3-agility-defense-earth',
      't3-counter-defense-fire', 't3-counter-defense-water', 't3-air-counter-defense', 't3-counter-defense-earth',
      't3-agility-counter-fire', 't3-agility-counter-water', 't3-agility-air-counter', 't3-agility-counter-earth',
      't3-attack-fire-fire', 't3-attack-water-water', 't3-air-air-attack', 't3-attack-earth-earth',
      't3-attack-fire-water', 't3-air-attack-fire', 't3-attack-earth-fire', 't3-air-attack-water',
      't3-attack-earth-water', 't3-air-attack-earth',
      't3-defense-fire-fire', 't3-defense-water-water', 't3-air-air-defense', 't3-defense-earth-earth',
      't3-defense-fire-water', 't3-air-defense-fire', 't3-defense-earth-fire', 't3-air-defense-water',
      't3-defense-earth-water', 't3-air-defense-earth',
      't3-agility-fire-fire', 't3-agility-water-water', 't3-agility-air-air', 't3-agility-earth-earth',
      't3-agility-fire-water', 't3-agility-air-fire', 't3-agility-earth-fire', 't3-agility-air-water',
      't3-agility-earth-water', 't3-agility-air-earth',
      't3-counter-fire-fire', 't3-counter-water-water', 't3-air-air-counter', 't3-counter-earth-earth',
      't3-counter-fire-water', 't3-air-counter-fire', 't3-counter-earth-fire', 't3-air-counter-water',
      't3-counter-earth-water', 't3-air-counter-earth',
    ];
    for (const id of newCardIds) {
      this.load.image(`card_${id}`, `assets/cards/${id}.png`);
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

    // ── Meme assets (optional) ─────────────────────────────────────
    // OIIAOIIA spinning cat — ultra-rare event outcome. Loaded best-effort:
    // if the file isn't on disk, Phaser logs a 404 once and the game falls
    // back to a cat-emoji placeholder. Drop your assets at the paths below
    // to enable the full version.
    this.load.image('meme_oiiaoiia', 'assets/meme/oiiaoiia.png');
    this.load.audio('sfx_oiiaoiia', 'assets/audio/oiiaoiia.mp3');
    this.load.on('loaderror', (file: { key: string }) => {
      if (file.key === 'meme_oiiaoiia' || file.key === 'sfx_oiiaoiia') {
        // Expected when the meme assets aren't authored yet; swallow.
      }
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
