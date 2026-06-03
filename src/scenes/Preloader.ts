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

    // Hero warrior assets
    this.load.image('hero_idle',  'assets/characters/hero/idle/idle_1.png');
    this.load.image('hero_idle2', 'assets/characters/hero/idle/idle_2.png');
    this.load.spritesheet('hero_walk',   'assets/characters/hero/scrolling/spritesheet.png', { frameWidth: 512, frameHeight: 512 });
    this.load.spritesheet('hero_chibi_warrior', 'assets/characters/hero/pocket/spritesheet.png', { frameWidth: 512, frameHeight: 512 });
    // Mage scrolling animation (10-frame run, 512×512 per frame)
    this.load.spritesheet('mage_walk',   'assets/characters/mage/scrolling/spritesheet.png', { frameWidth: 512, frameHeight: 512 });
    this.load.spritesheet('hero_attack', 'assets/characters/hero/attack/attack.png', { frameWidth: 451, frameHeight: 553 });
    // Warrior selection preview (2-frame idle, 500x437 per frame)
    this.load.spritesheet('warrior_select', 'assets/characters/hero/selection/spritesheet.png', { frameWidth: 500, frameHeight: 437 });

    // Mage selection preview (7-frame idle, 386x514 per frame; sheet is 2702x514)
    this.load.spritesheet('mage_select', 'assets/characters/mage/selection/spritesheet.png', { frameWidth: 386, frameHeight: 514 });

    // Mage combat spritesheets (9-frame idle, 12-frame attack; 640×562 per frame)
    this.load.spritesheet('mage_idle',   'assets/characters/mage/idle/spritesheet.png',   { frameWidth: 640, frameHeight: 562 });
    this.load.spritesheet('mage_attack', 'assets/characters/mage/attack/spritesheet.png', { frameWidth: 640, frameHeight: 562 });
    this.load.image('mage_defeat_bg',    'assets/characters/mage/defeat/defeat.jpg');
    this.load.spritesheet('hero_chibi_mage', 'assets/characters/mage/pocket/spritesheet.png', { frameWidth: 256, frameHeight: 256 });
    this.load.image('warrior_defeat_bg', 'assets/characters/hero/defeat/defeat.jpg');

    // Monster static images — `hasFrame2` flags entries that ship a second
    // animation frame on disk. The `_1.png` suffix in `file` auto-derives the
    // `_2.png` path via the regex below. Entries without a `_2` variant (most
    // single-frame portraits) skip the second load to keep the console clean.
    const staticMonsters: Array<{ id: string; folder: string; file: string; hasFrame2?: boolean }> = [
      // Cemetery
      { id: 'corpse_eater',         folder: 'cemetery', file: 'corpse eater_1.png',         hasFrame2: true },
      { id: 'pocket_cat',           folder: 'cemetery', file: 'pocket cat.png' },
      { id: 'skeleton',             folder: 'cemetery', file: 'skeleton_1.png',             hasFrame2: true },
      { id: 'vampire',              folder: 'cemetery', file: 'vampire_1.png',              hasFrame2: true },
      { id: 'werewolf',             folder: 'cemetery', file: 'werewolf_1.png',             hasFrame2: true },
      { id: 'zombie',               folder: 'a melhorar', file: 'zombie.png' },
      // Default-terrain enemies (single-frame portraits)
      { id: 'doom_knight',          folder: 'default',  file: 'doom knight.png' },
      { id: 'iron_golem',           folder: 'default',  file: 'iron golem.png' },
      { id: 'lizard_king',          folder: 'default',  file: 'lizard king.png' },
      // Desert
      { id: 'baby_dragon',          folder: 'desert',   file: 'baby dragon_1.png',          hasFrame2: true },
      { id: 'mutated_salamander',   folder: 'desert',   file: 'mutated salamander_1.png',   hasFrame2: true },
      { id: 'scorpion',             folder: 'desert',   file: 'scorpion_1.png',             hasFrame2: true },
      // Forest — giant_spider / giant_spider_2 / mush / ogre removed: files no
      // longer exist at forest/; surviving art moved to 'a melhorar/' pending
      // sprite regeneration. doom_knight / iron_golem / lizard_king removed:
      // default/ folder deleted in PR #12; enemies removed from enemies.json.
      { id: 'ancient_tree',         folder: 'forest',   file: 'ancient tree_1.png',         hasFrame2: true },
      { id: 'giant_spider_2',       folder: 'forest',   file: 'giant spider 2.png' },
      { id: 'giant_spider',         folder: 'forest',   file: 'giant spider.png' },
      { id: 'mush',                 folder: 'forest',   file: 'mush.png' },
      { id: 'ogre',                 folder: 'a melhorar', file: 'ogre.png' },
      // Lava — note: ids preserve the legacy `forge_slime`/`lava_golen`
      // spellings used in enemies.json; the disk files now use underscored
      // `forge_slime_*.png` / `lava_golem_*.png` after PR #12's rename.
      { id: 'forge_slime',          folder: 'lava',     file: 'forge_slime_1.png',          hasFrame2: true },
      { id: 'lava_golen',           folder: 'lava',     file: 'lava_golem_1.png',           hasFrame2: true },
      { id: 'fire_elemental',       folder: 'lava',     file: 'fire_elemental_1.png',       hasFrame2: true },
      // Swamp
      { id: 'depths_horror',        folder: 'swamp',    file: 'depths horror_1.png',        hasFrame2: true },
      { id: 'toxic_gooze',          folder: 'swamp',    file: 'toxic gooze_1.png',          hasFrame2: true },
      { id: 'venomous_kobra',       folder: 'swamp',    file: 'venomous kobra_1.png',       hasFrame2: true },
      // Green Field
      { id: 'slime',               folder: 'green_field', file: 'slime_1.png',              hasFrame2: true },
      { id: 'red_slime',           folder: 'green_field', file: 'red_slime_1.png',          hasFrame2: true },
      { id: 'earth_dragon',        folder: 'green_field', file: 'earth_dragon_1.png',       hasFrame2: true },
      // Root
      { id: 'lost_lizard',          folder: '',         file: 'lost_lizard_1.png',          hasFrame2: true },
      // New bosses (PR #12) — live in `monsters/boss/`. Each ships multiple
      // frames on disk (bog_witch _1–_4, desert_golem _1–_3, infernal_dragon
      // _1–_5, iron_golem _1–_2); we expose just the _1/_2 pair to match the
      // rest of the roster. `boss_iron_golem` is namespaced to avoid clashing
      // with the regular `iron_golem` enemy at default/.
      { id: 'bog_witch',            folder: 'boss',     file: 'bog_witch_1.png',            hasFrame2: true },
      { id: 'desert_golem',         folder: 'boss',     file: 'desert_golem_1.png',         hasFrame2: true },
      { id: 'infernal_dragon',      folder: 'boss',     file: 'infernal_dragon_1.png',      hasFrame2: true },
      { id: 'boss_iron_golem',      folder: 'boss',     file: 'iron_golem_1.png',           hasFrame2: true },
    ];
    for (const m of staticMonsters) {
      const path = m.folder ? `assets/characters/monsters/${m.folder}/${m.file}` : `assets/characters/monsters/${m.file}`;
      this.load.image(`monster_${m.id}`, path);
      if (m.hasFrame2) {
        const path2 = path.replace(/(_1)?\.png$/i, '_2.png');
        this.load.image(`monster_${m.id}_2`, path2);
      }
    }

    // Scene backgrounds (400x400, scaled to fill 800x600)
    this.load.spritesheet('bg_city', 'assets/backgrounds/bg_city.png', {
      frameWidth: 1280, frameHeight: 720,
    });
    // bg_run.png not yet authored — GameScene falls back to bg_desert when
    // bg_run is missing (see GameScene.ts createDesertBackgrounds).
    this.load.image('bg_battle_basic', 'assets/backgrounds/bg_battle_basic.png');
    this.load.image('bg_battle_forest', 'assets/backgrounds/bg_battle_forest.png');
    this.load.image('bg_battle_graveyard', 'assets/backgrounds/bg_battle_graveyard.png');
    this.load.image('bg_battle_swamp', 'assets/backgrounds/bg_battle_swamp.png');
    this.load.image('homepage', 'assets/backgrounds/homepage.jpg');

    // Parallax backgrounds
    this.load.image('bg_green_field', 'assets/backgrounds/green_field_background.png');
    this.load.image('bg_sky',         'assets/backgrounds/sky-background.jpg');
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
    this.load.image('forge_backdrop_v2', 'assets/buildings/backgrounds/forge-backdrop-v2.jpeg');
    this.load.spritesheet('forge_background', 'assets/buildings/backgrounds/forge_background.png', {
      frameWidth: 1168, frameHeight: 880,
    });
    this.load.image('forge_frame_01', 'assets/buildings/backgrounds/forge_frame_01.png');
    this.load.spritesheet('forge_fire_sheet', 'assets/buildings/backgrounds/forge_fire_sheet.png', {
      frameWidth: 390, frameHeight: 590,
    });
    this.load.image('forge_rune_socket', 'assets/buildings/backgrounds/forge-rune-socket.jpeg');
    this.load.image('forge_card_altar', 'assets/buildings/backgrounds/forge-card-altar.jpeg');
    this.load.image('forge_inventory_rack', 'assets/buildings/backgrounds/forge-inventory-rack-v2.jpeg');
    this.load.image('arco_forja',     'assets/buildings/items/arco_forja.png');
    this.load.image('bigorna',        'assets/buildings/items/bigorna.png');
    this.load.image('forge_moldure',       'assets/buildings/items/forge_moldure.png');
    this.load.image('forge_status_banner', 'assets/ui/forge/forge_status_banner.png');
    // Forge-specific ornate element sigils (separate from the small `icon_<id>`
    // tokens used inside card faces).
    for (const id of ['attack','defense','agility','counter','fire','water','air','earth']) {
      this.load.image(`forge_sigil_${id}`, `assets/icons/tokens/forge-sigils/${id}.png`);
    }
    this.load.image('tavern_table', 'assets/buildings/backgrounds/tavern.png');
    this.load.image('shrine_table', 'assets/buildings/backgrounds/shrine.png');
    this.load.image('vault_table', 'assets/buildings/backgrounds/vault.png');

    // UI Panels & textures
    this.load.image('status_panel', 'assets/ui/panels/status_panel.png');
    this.load.image('bar_wood', 'assets/ui/panels/bar-wood.png');
    this.load.image('wood_texture', 'assets/ui/panels/wood-texture.png');
    this.load.image('wood_texture_big', 'assets/ui/panels/wood-texture-big.png');
    this.load.image('bg_character_selection', 'assets/ui/backgrounds/background-character-selection.jpg');
    this.load.spritesheet('flame_selection', 'assets/ui/backgrounds/flame-spritesheet-selection.png', { frameWidth: 448, frameHeight: 576 });
    this.load.image('icon_table', 'assets/ui/panels/icon-table.png');
    this.load.image('wood_board_collection', 'assets/ui/panels/wood-board-collection.png');
    this.load.image('icons_up_table', 'assets/ui/panels/icons-up-table.png');
    this.load.image('base_icon_place', 'assets/ui/panels/base-icon-place.png');
    this.load.image('collection_headline', 'assets/ui/panels/collection-headline.png');
    this.load.image('bg_base_option', 'assets/ui/panels/base-option.png');
    this.load.image('fog', 'assets/ui/effects/fog.png');

    // Tutorial step text-box images (pre-rendered via ComfyUI)
    const tutorialSteps = [
      'welcome', 'pick_warrior', 'deck_review', 'map_intro',
      'combat_intro', 'planning_intro', 'place_tile', 'place_subtile',
      'forge_intro', 'forge_craft', 'boss_preview', 'complete',
    ];
    for (const s of tutorialSteps) {
      this.load.image(`tutorial_text_${s}`, `assets/ui/text/tutorial_${s}.png`);
    }
    this.load.image('tile_selection_board', 'assets/ui/panels/tile-selection-board.png');
    this.load.spritesheet('belt_pillar', 'assets/ui/panels/pilar/spritesheet.png', {
      frameWidth: 512, frameHeight: 512,
    });
    this.load.image('tile_frame', 'assets/ui/frames/tile-frame.png');
    this.load.image('deck_frame', 'assets/ui/frames/deck-frame.png');
    this.load.image('deck_status_board', 'assets/ui/panels/deck-status-board.png');
    this.load.image('bg_tile_selection', 'assets/ui/backgrounds/background-tile-selection.png');
    this.load.image('bg_shop_scene', 'assets/buildings/backgrounds/shop.png');
    // v2 (2026-05-26) Grok-generated alchemist-merchant interior. ShopScene
    // prefers this when present and falls back to bg_shop_scene.
    this.load.image('bg_shop_v2', 'assets/ui/backgrounds/bg_shop_v2.png');
    // Shop-specific ornate chrome (Grok-generated 2026-05-26).
    this.load.image('shop_title_banner',  'assets/ui/text/shop_title_banner.png');
    this.load.image('shop_item_frame',    'assets/ui/frames/shop_item_frame.png');
    this.load.image('shop_remove_seal',   'assets/ui/panels/shop_remove_seal.png');
    this.load.image('shop_panel_list',    'assets/ui/shop/big_panel.png');
    this.load.image('shop_panel_detail',  'assets/ui/shop/asset description.png');
    this.load.image('shop_tab',           'assets/ui/shop/shop-section.png');
    this.load.image('shop_row_selected',  'assets/ui/shop/item_selection.png');
    this.load.image('shop_btn_buy',       'assets/ui/shop/buy-button.png');
    this.load.image('banish_confirm_panel', 'assets/ui/panels/banish_confirm_panel.png');
    this.load.image('confirm_dialog',       'assets/ui/panels/confirm_dialog.png');
    this.load.image('confirm_panel',        'assets/ui/confirm_panel.png');
    // Grok-generated painted backdrops for previously-bare scenes. See
    // docs/UI_AUDIT.md for the prompts and re-generation recipe.
    this.load.image('bg_deck_builder', 'assets/ui/backgrounds/bg_deck_builder.png');
    this.load.image('bg_deck_editor_v2', 'assets/ui/backgrounds/deck-editor-v2.png');
    this.load.image('bg_relic_vault',  'assets/ui/backgrounds/bg_relic_vault.png');
    this.load.image('bg_card_library', 'assets/ui/backgrounds/bg_card_library.png');
    // Visual-upgrade pass (audit2): wooden buttons, parchment chrome,
    // hero-card plaques, painted Settings backdrop, modifier-popup banner.
    this.load.image('panel_wood_button',      'assets/ui/panels/panel_wood_button.png');
    this.load.image('panel_parchment_scroll', 'assets/ui/panels/panel_parchment_scroll.png');
    this.load.image('panel_hero_plaque',      'assets/ui/panels/panel_hero_plaque.png');
    this.load.image('warrior_status',         'assets/ui/panels/warrior_status.png');
    this.load.image('mage_status',            'assets/ui/panels/mage_status.png');
    // Forge dwarf NPC
    this.load.image('dwarf_talking',          'assets/characters/npc/forge-dwarf/dwarf_talking.png');
    this.load.image('dwarf_hands_on_hips',    'assets/characters/npc/forge-dwarf/dwarf_hands_on_hips.png');
    this.load.image('dwarf_thumbs_up',        'assets/characters/npc/forge-dwarf/dwarf_thumbs_up.png');
    this.load.image('panel_modifier_banner',  'assets/ui/panels/panel_modifier_banner.png');
    this.load.image('panel_keyword_frame',    'assets/ui/panels/panel_keyword_frame.png');
    this.load.image('panel_hover_frame',      'assets/ui/panels/panel_hover_frame.png');
    this.load.image('bg_settings_scribe',     'assets/ui/backgrounds/bg_settings_scribe.png');
    this.load.image('panel_card_grid',        'assets/ui/panels/panel_card_grid.png');
    this.load.image('panel_card_grid_v2',     'assets/ui/panels/panel_card_grid_v2.png');
    this.load.image('healthbar', 'assets/ui/panels/healthbar.png');
    this.load.image('deck_relic_table', 'assets/ui/panels/deck-relic-table.png');
    this.load.image('achievements_bg', 'assets/ui/panels/achievments.png');
    this.load.image('card_mold',    'assets/ui/frames/card_mold.png');
    this.load.image('card_mold_v2', 'assets/ui/frames/card_mold_v2.png');
    // Bitmap fonts (custom game alphabet)
    this.load.bitmapFont('game_font_gold',  'assets/fonts/game_font_gold/game_font_gold.png',   'assets/fonts/game_font_gold/game_font_gold.fnt');
    this.load.bitmapFont('game_font_blue',  'assets/fonts/game_font_blue/game_font_blue.png',   'assets/fonts/game_font_blue/game_font_blue.fnt');
    this.load.bitmapFont('game_font_white', 'assets/fonts/game_font_white/game_font_white.png', 'assets/fonts/game_font_white/game_font_white.fnt');
    // VT323 pixel font variants
    this.load.bitmapFont('vt323_gold',  'assets/fonts/vt323_gold/vt323_gold.png',   'assets/fonts/vt323_gold/vt323_gold.fnt');
    this.load.bitmapFont('vt323_white', 'assets/fonts/vt323_white/vt323_white.png', 'assets/fonts/vt323_white/vt323_white.fnt');
    this.load.bitmapFont('vt323_blue',  'assets/fonts/vt323_blue/vt323_blue.png',   'assets/fonts/vt323_blue/vt323_blue.fnt');

    this.load.image('ui_panel',           'assets/ui/panels/panel.png');
    this.load.image('speed_panel',        'assets/ui/panels/speed_panel.png');
    this.load.image('hud_panel_left',     'assets/ui/panels/hud_panel_left.png');
    this.load.image('mat_panel',          'assets/ui/panels/mat_panel.png');
    this.load.image('hud_panel_progress', 'assets/ui/panels/hud_panel_progress.png');
    this.load.image('loop_summary_panel', 'assets/ui/panels/loopcomplete.png');

    // Tile tooltip panels (styled dark/gold panels with baked title + description)
    const tileTooltips = ['forest','graveyard','swamp','desert','lava','event','treasure',
      'ambush','magma','manawell','camp','burnaltar','bleedtotem','resonance','warhorn'];
    for (const t of tileTooltips) {
      this.load.image(`tile_tooltip_${t}`, `assets/ui/text/tiles/tile_tooltip_${t}.png`);
    }
    this.load.image('panel_hover', 'assets/ui/panels/panel_hover.png');

    // UI Buttons — pre-rendered dark/gold style
    this.load.image('btn_continue_run',    'assets/ui/buttons/continue-run.png');
    this.load.image('btn_new_game',        'assets/ui/buttons/new-game.png');
    this.load.image('btn_daily_run',       'assets/ui/buttons/daily-run.png');
    this.load.image('btn_keep_my_run',     'assets/ui/btn_keep_my_run.png');
    this.load.image('btn_yes_delete',      'assets/ui/btn_yes_delete.png');
    this.load.image('btn_resume',          'assets/ui/buttons/btn_resume.png');
    this.load.image('btn_view_deck',       'assets/ui/buttons/btn_view_deck.png');
    this.load.image('btn_settings',        'assets/ui/buttons/btn_settings.png');
    this.load.image('btn_tutorial',        'assets/ui/buttons/btn_tutorial.png');
    // Building buttons (city hub)
    this.load.image('btn_forge',         'assets/ui/btn_forge.png');
    this.load.image('btn_library',       'assets/ui/btn_library.png');
    this.load.image('btn_workshop',      'assets/ui/btn_workshop.png');
    this.load.image('btn_oracle',        'assets/ui/btn_oracle.png');
    this.load.image('btn_vault',         'assets/ui/btn_vault.png');
    this.load.image('upgrade_panel',     'assets/ui/upgrade_panel.png');
    this.load.image('btn_sim_melhorar',  'assets/ui/btn_sim_melhorar.png');
    this.load.image('btn_melhorar',          'assets/ui/btn_melhorar.png');
    this.load.image('btn_start_run_hub',     'assets/ui/btn_start_run_hub.png');
    this.load.image('label_requer',          'assets/ui/labels/label_requer.png');
    // Building upgrade text panels (one per level per building)
    const buildingPanels: [string, number][] = [
      ['forge', 6], ['library', 3], ['workshop', 3], ['oracle', 4], ['vault', 8],
    ];
    for (const [name, max] of buildingPanels) {
      for (let l = 1; l <= max; l++) {
        this.load.image(`building_${name}_l${l}`, `assets/ui/text/buildings/building_${name}_l${l}.png`);
      }
    }
this.load.image('btn_start_run',       'assets/ui/buttons/btn_start_run.png');
    this.load.image('btn_back',            'assets/ui/buttons/btn_back.png');
    this.load.image('btn_leave',           'assets/ui/buttons/btn_leave.png');
    this.load.image('btn_close',           'assets/ui/buttons/btn_close.png');
    this.load.image('btn_cancel',          'assets/ui/buttons/btn_cancel.png');
    this.load.image('btn_return_to_menu',  'assets/ui/buttons/btn_return_to_menu.png');
    this.load.image('btn_change_hero',     'assets/ui/buttons/btn_change_hero.png');
    this.load.image('btn_start_game',      'assets/ui/buttons/btn_start_game.png');
    this.load.image('btn_visit_shop',      'assets/ui/buttons/btn_visit_shop.png');
    this.load.image('btn_abandon_run',     'assets/ui/buttons/btn_abandon_run.png');
    this.load.image('btn_banish',          'assets/ui/buttons/btn_banish.png');
    this.load.image('btn_keep',            'assets/ui/buttons/btn_keep.png');
    this.load.image('btn_delete_run',      'assets/ui/buttons/btn_delete_run.png');
    this.load.image('btn_forge_action',    'assets/ui/buttons/btn_forge_action.png');
    this.load.image('btn_dismiss',         'assets/ui/buttons/btn_dismiss.png');
    // Landing-page delete-run dialog assets
    this.load.image('lp_delete_run',       'assets/ui/text/landing-page/delete-run.png');
    this.load.image('lp_keep',             'assets/ui/text/landing-page/keep.png');
    this.load.image('lp_permanent_erase',  'assets/ui/text/landing-page/permanente-erase.png');
    this.load.image('btn_reset_progress',  'assets/ui/buttons/btn_reset_progress.png');
    this.load.image('btn_next',            'assets/ui/buttons/btn_next.png');
    this.load.image('btn_start_loop', 'assets/ui/buttons/start-loop.png');
    this.load.image('btn_start_loop_scene', 'assets/ui/buttons/start-loop-loop-scene.png');
    this.load.image('skip_loop_panel', 'assets/ui/panels/skip-loop.png');
    this.load.image('remove_tiles_panel', 'assets/ui/panels/remove_tiles.png');
    this.load.image('btn_skip_1',  'assets/ui/buttons/1.png');
    this.load.image('btn_skip_5',  'assets/ui/buttons/5.png');
    this.load.image('btn_skip_10', 'assets/ui/buttons/10.png');
    this.load.image('btn_skip_25', 'assets/ui/buttons/25.png');
    this.load.image('shop_icon', 'assets/icons/shop.png');
    this.load.image('forge_icon', 'assets/icons/forge.png');
    // Text assets — hand-crafted image replacements for Phaser text
    this.load.image('text_victory', 'assets/ui/text/victory_asset.png');

    // Material Icons
    this.load.image('mat_iron', 'assets/icons/iron.png');
    this.load.image('mat_crystal', 'assets/icons/crystal.png');
    this.load.image('mat_scroll', 'assets/icons/scroll.png');
    this.load.image('mat_wood', 'assets/icons/wood.png');
    this.load.image('mat_stone', 'assets/icons/stone.png');
    this.load.image('mat_bone', 'assets/icons/bone.png');
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

    // Painterly v2 element icons (oil-paint style, generated via Grok) for the
    // shop's element frames. Only the 4 physical + 4 elemental ids exist in v2.
    const elementV2Ids = [
      'attack', 'defense', 'agility', 'counter',
      'fire', 'water', 'air', 'earth',
    ];
    for (const token of elementV2Ids) {
      this.load.image(`icon_v2_${token}`, `assets/icons/tokens/elements-v2/${token}.png`);
    }

    // Relic Illustrations — one PNG per relic id in src/data/json/relics.json.
    const relicIds = [
      // Warrior
      'whetstone_shard', 'bronze_pauldron', 'stamina_flask', 'battered_vambrace',
      'iron_cestus', 'banded_greaves', 'stamina_reservoir',
      'wargods_mantle', 'bloodgorged_heart', 'the_last_banner',
      // Mage
      'aether_lens', 'burnt_tome', 'frostbite_charm', 'ember_wick',
      'stormglass_lens', 'cinder_circlet', 'mana_veil',
      'tempest_resonator', 'tideheart_amulet', 'archon_codex',
      // Neutral commons (stat/utility)
      'bronze_scale', 'energy_tonic', 'arcane_crystal', 'whetting_stone',
      'iron_brace', 'quick_boots', 'scholars_quill', 'soul_locket', 'vitality_ring',
      'hearty_meal', 'lucky_coin', 'travel_boots', 'beacon_lantern',
      // Neutral commons (combat)
      'smoldering_torch', 'iron_tooth', 'vanguard_cuffs', 'charm_of_tides',
      'steady_compass', 'linen_wrap', 'tarnished_mirror', 'echoing_chime',
      'brass_bell', 'trailblazers_brand', 'veterans_stripe',
      // Neutral uncommons
      'swift_boots', 'thin_deck_charm', 'heavy_tome', 'iron_will',
      'first_strike_amulet', 'gravediggers_tag', 'huntmasters_eye',
      'librarians_seal', 'apothecarys_vial', 'harmonics_charm', 'glasswork_lens',
      'executioners_brand', 'counterweight_sigil', 'burnished_sigil', 'vampiric_fang',
      'smoking_censer', 'roaring_hourglass', 'lodestone_pendant', 'cracked_crystal',
      'whisperwind_sash', 'ash_eater',
      // Neutral rares
      'sanguine_pact', 'berserker_ring', 'phoenix_feather', 'demon_heart',
      'stoneheart_sigil', 'pandoras_embers', 'cinderkeep', 'crimson_stiletto',
      'stormcallers_rod', 'echo_chamber', 'catalyst_core', 'soulforge_chalice',
      'glass_cannon', 'hemlock_vial', 'constellation_sigil'
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
      // T1 — single elements (the 8 base cards in cards.json)
      't1-attack', 't1-defense', 't1-agility', 't1-counter',
      't1-fire', 't1-water', 't1-air', 't1-earth',
      // T2 — pure pairs
      't2-attack-attack', 't2-defense-defense', 't2-agility-agility', 't2-counter-counter',
      't2-fire-fire', 't2-water-water', 't2-air-air', 't2-earth-earth',
      // T2 — cross pairs
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
