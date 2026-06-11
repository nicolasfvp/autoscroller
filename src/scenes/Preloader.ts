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


    // Reserved-slot sprites: sparse extension of each combat terrain. The
    // reserved sprite is picked at render time based on the slot's host
    // terrain (set by LoopRunner.recomputeReservations).
    const reservedIds = ['forest', 'graveyard', 'swamp', 'desert', 'lava'];
    for (const id of reservedIds) {
      this.load.image(`tile_reserved_${id}`, `assets/map/tiles/tile_reserved_${id}.png`);
    }

    // Hero warrior assets
    this.load.image('hero_idle',  'assets/characters/hero/idle/idle_1.png');
    this.load.image('hero_shadow', 'assets/characters/hero/shadow.png');
    this.load.image('glossary_book_icon', 'assets/ui/glossary/book_icon.png');
    this.load.image('glossary_panel_bg', 'assets/ui/glossary/panel_bg.png');
    this.load.image('timer_panel', 'assets/scenes/combat/timer-panel.png');
    this.load.image('hero_idle2', 'assets/characters/hero/idle/idle_2.png');
    this.load.spritesheet('hero_walk',   'assets/characters/hero/scrolling/spritesheet.png', { frameWidth: 512, frameHeight: 512 });
    this.load.spritesheet('hero_attack', 'assets/characters/hero/attack/attack.png', { frameWidth: 532, frameHeight: 568 });
    this.load.spritesheet('hero_channel', 'assets/characters/hero/cast_debuff/cast_debuff_spritesheet.png', { frameWidth: 512, frameHeight: 512 });
    this.load.spritesheet('hero_battle_stance', 'assets/characters/hero/battle_stance/battle_stance_spritesheet.png', { frameWidth: 512, frameHeight: 556 });
    this.load.spritesheet('hero_defend', 'assets/characters/hero/defend/defend_spritesheet.png', { frameWidth: 512, frameHeight: 512 });
    this.load.spritesheet('hero_chibi_warrior', 'assets/characters/hero/pocket/spritesheet.png', { frameWidth: 512, frameHeight: 512 });
    // Warrior selection preview (2-frame idle, 500x437 per frame)
    this.load.spritesheet('warrior_select', 'assets/characters/hero/selection/spritesheet.png', { frameWidth: 500, frameHeight: 437 });

    // Mage selection preview (7-frame idle, 386x514 per frame; sheet is 2702x514)
    this.load.spritesheet('mage_select', 'assets/characters/mage/selection/spritesheet.png', { frameWidth: 386, frameHeight: 514 });
    // Mage combat spritesheets (4-frame idle, 6-frame attack; 768×768 per frame)
    this.load.spritesheet('mage_idle',         'assets/characters/mage/battle_stance/spritesheet.png',       { frameWidth: 768, frameHeight: 768, endFrame: 3 });
    this.load.spritesheet('mage_attack',       'assets/characters/mage/attack/spritesheet.png',              { frameWidth: 768, frameHeight: 768, endFrame: 5 });
    this.load.spritesheet('mage_battle_stance','assets/characters/mage/battle_stance/spritesheet.png',       { frameWidth: 768, frameHeight: 768, endFrame: 3 });
    this.load.spritesheet('mage_defend',       'assets/characters/mage/defense/spritesheet.png',             { frameWidth: 768, frameHeight: 768, endFrame: 3 });
    this.load.spritesheet('mage_cast_debuff',  'assets/characters/mage/cast_debuff/spritesheet.png',          { frameWidth: 768, frameHeight: 768, endFrame: 3 });
    // Mage scrolling animation (10-frame run, 512×512 per frame)
    this.load.spritesheet('mage_walk',   'assets/characters/mage/scrolling/spritesheet.png', { frameWidth: 512, frameHeight: 512 });

    this.load.image('mage_defeat_bg',    'assets/scenes/death/mage_defeat.jpg');
    this.load.spritesheet('hero_chibi_mage', 'assets/characters/mage/pocket/spritesheet.png', { frameWidth: 256, frameHeight: 256, endFrame: 5 });
    this.load.image('warrior_defeat_bg', 'assets/scenes/death/warrior_defeat.jpg');

    // Monster static images — `hasFrame2` flags entries that ship a second
    // animation frame on disk. The `_1.png` suffix in `file` auto-derives the
    // `_2.png` path via the regex below. Entries without a `_2` variant (most
    // single-frame portraits) skip the second load to keep the console clean.
    const staticMonsters: Array<{ id: string; folder: string; file: string; hasFrame2?: boolean; frameCount?: number }> = [
      // Cemetery
      { id: 'corpse_eater',         folder: 'cemetery', file: 'corpse eater_1.png',         hasFrame2: true },
      { id: 'pocket_cat',           folder: 'cemetery', file: 'pocket cat.png' },
      { id: 'skeleton',             folder: 'cemetery', file: 'skeleton_1.png',             hasFrame2: true },
      { id: 'vampire',              folder: 'cemetery', file: 'vampire_1.png',              hasFrame2: true },
      { id: 'werewolf',             folder: 'cemetery', file: 'werewolf_1.png',             hasFrame2: true },
      { id: 'zombie',               folder: 'cemetery', file: 'zombie.png' },
      // Default-terrain bosses. doom_knight has art (default/doom_knight_*.png).
      // iron_golem and lizard_king are live in enemies.json but have NO sprite
      // on disk — they render the missing-texture placeholder until art is added
      // (iron_golem could reuse boss/iron_golem_*.png).
      { id: 'doom_knight',          folder: 'default',  file: 'doom_knight_1.png',          hasFrame2: true },
      // Desert
      { id: 'baby_dragon',          folder: 'desert',   file: 'baby dragon_1.png',          hasFrame2: true },
      { id: 'mutated_salamander',   folder: 'desert',   file: 'mutated_salamander_1.png',   hasFrame2: true },
      { id: 'scorpion',             folder: 'desert',   file: 'scorpion_1.png',             hasFrame2: true },
      // Forest. ancient_tree and mush have art (forest/*.png). giant_spider and
      // giant_spider_2 are live enemies in enemies.json but have NO sprite on
      // disk yet — they show the missing-texture placeholder until art is added.
      // ogre's surviving art lives under 'a melhorar/'.
      { id: 'ancient_tree',         folder: 'forest',   file: 'ancient tree_1.png',         hasFrame2: true },
      { id: 'mush',                 folder: 'forest',   file: 'mush_1.png',                 hasFrame2: true },
      // Lava — note: ids preserve the legacy `forge_slime`/`lava_golen`
      // spellings used in enemies.json; the disk files now use underscored
      // `forge_slime_*.png` / `lava_golem_*.png` after PR #12's rename.
      { id: 'forge_slime',          folder: 'lava',     file: 'forge_slime_1.png',          hasFrame2: true },
      { id: 'lava_golem',           folder: 'lava',     file: 'lava_golem_1.png',           hasFrame2: true },
      { id: 'fire_elemental',       folder: 'lava',     file: 'fire_elemental_1.png',       hasFrame2: true },
      // Swamp
      { id: 'depths_horror',        folder: 'swamp',    file: 'depths_horror_1.png',        hasFrame2: true },
      { id: 'toxic_gooze',          folder: 'swamp',    file: 'toxic gooze_1.png',          hasFrame2: true },
      { id: 'venomous_kobra',       folder: 'swamp',    file: 'venomous_kobra_1.png',       hasFrame2: true },
      // Green Field
      { id: 'slime',               folder: 'green_field', file: 'slime_1.png',              hasFrame2: true },
      { id: 'red_slime',           folder: 'green_field', file: 'red_slime_1.png',          hasFrame2: true },
      { id: 'earth_dragon',        folder: 'green_field', file: 'earth_dragon_1.png',       hasFrame2: true },
      // Root
      { id: 'lost_lizard',          folder: '',         file: 'lost_lizard_1.png',          hasFrame2: true },
      // New bosses — live in `monsters/boss/`. frameCount = total frames on disk.
      // `boss_iron_golem` namespaced to avoid clashing with `iron_golem` at default/.
      // `iron_golem` (Dryas, the iron commander) has its own distinct 3-frame
      // battle-stance art, left-facing — separate from the ancient colossus boss.
      { id: 'iron_golem',           folder: 'boss',     file: 'iron_commander_1.png',       hasFrame2: true, frameCount: 3 },
      { id: 'bog_witch',            folder: 'boss',     file: 'bog_witch_1.png',            hasFrame2: true, frameCount: 4 },
      { id: 'desert_golem',         folder: 'boss',     file: 'desert_golem_1.png',         hasFrame2: true, frameCount: 3 },
      { id: 'infernal_dragon',      folder: 'boss',     file: 'infernal_dragon_1.png',      hasFrame2: true, frameCount: 5 },
      { id: 'boss_iron_golem',      folder: 'boss',     file: 'iron_golem_1.png',           hasFrame2: true },
    ];
    for (const m of staticMonsters) {
      const path = m.folder ? `assets/characters/monsters/${m.folder}/${m.file}` : `assets/characters/monsters/${m.file}`;
      this.load.image(`monster_${m.id}`, path);
      const totalFrames = m.frameCount ?? (m.hasFrame2 ? 2 : 1);
      for (let n = 2; n <= totalFrames; n++) {
        const pathN = path.replace(/(_1)?\.png$/i, `_${n}.png`);
        this.load.image(`monster_${m.id}_${n}`, pathN);
      }
      // Portrait crop (face-only asset in portraits/ folder)
      this.load.image(`portrait_${m.id}`, `assets/characters/monsters/portraits/${m.id}.png`);
    }

    // Scene backgrounds (400x400, scaled to fill 800x600)
    this.load.spritesheet('bg_city', 'assets/scenes/city_hub/bg_city.png', {
      frameWidth: 1280, frameHeight: 720,
    });
    // bg_run.png not yet authored — GameScene falls back to bg_desert when
    // bg_run is missing (see GameScene.ts createDesertBackgrounds).
    this.load.image('bg_battle_basic',     'assets/scenes/combat/bg_battle_basic.png');
    this.load.image('bg_battle_forest',    'assets/scenes/combat/bg_battle_forest.png');
    this.load.image('bg_battle_graveyard', 'assets/scenes/combat/bg_battle_graveyard.png');
    this.load.image('bg_battle_swamp',     'assets/scenes/combat/bg_battle_swamp.png');
    this.load.image('bg_battle_lava',      'assets/scenes/combat/bg_battle_lava.png');
    this.load.image('bg_battle_desert',    'assets/scenes/combat/bg_battle_desert.png');
    this.load.image('bg_battle_ruins',     'assets/scenes/combat/bg_battle_ruins.png');
    this.load.image('homepage', 'assets/scenes/main_menu/homepage.jpg');

    // Parallax backgrounds
    this.load.image('bg_green_field', 'assets/scenes/game/green_field_background.png');
    this.load.image('bg_sky',         'assets/scenes/game/sky-background.png');
    this.load.image('bg_desert',      'assets/scenes/game/desert.png');

    // Special tile sprites (256x256, baked-in decoration).
    this.load.image('tile_event', 'assets/map/tiles/tile_event.png');
    this.load.image('tile_treasure', 'assets/map/tiles/tile_treasure.png');
    this.load.image('tile_boss', 'assets/map/tiles/tile_boss.png');

    // Tile landmarks (shown above special tiles in world view).
    this.load.image('landmark_event',    'assets/map/landmarks/landmark_event.png');
    this.load.image('landmark_treasure', 'assets/map/landmarks/landmark_treasure.png');
    this.load.image('landmark_boss',     'assets/map/landmarks/landmark_boss.png');
    this.load.image('landmark_desert',   'assets/map/landmarks/landmark_desert.png');
    this.load.image('landmark_forest',   'assets/map/landmarks/landmark_forest.png');
    this.load.image('landmark_graveyard','assets/map/landmarks/landmark_graveyard.png');
    this.load.image('landmark_swamp',    'assets/map/landmarks/landmark_swamp.png');
    this.load.image('landmark_lava',     'assets/map/landmarks/landmark_lava.png');
    // Subtile landmarks
    this.load.image('landmark_subtile_camp',      'assets/map/landmarks/landmark_subtile_camp.png');
    this.load.image('landmark_subtile_manawell',  'assets/map/landmarks/landmark_subtile_manawell.png');
    this.load.image('landmark_subtile_ambush',    'assets/map/landmarks/landmark_subtile_ambush.png');
    this.load.image('landmark_subtile_bleedtotem','assets/map/landmarks/landmark_subtile_bleedtotem.png');
    this.load.image('landmark_subtile_burnaltar', 'assets/map/landmarks/landmark_subtile_burnaltar.png');
    this.load.image('landmark_subtile_magma',     'assets/map/landmarks/landmark_subtile_magma.png');
    this.load.image('landmark_subtile_resonance', 'assets/map/landmarks/landmark_subtile_resonance.png');
    this.load.image('landmark_subtile_warhorn',   'assets/map/landmarks/landmark_subtile_warhorn.png');

    // Building panel backgrounds
    this.load.image('forge_frame_01', 'assets/scenes/forge/forge_frame_01.png');
    this.load.spritesheet('forge_fire_sheet', 'assets/scenes/forge/forge_fire_sheet.png', {
      frameWidth: 390, frameHeight: 590,
    });
    this.load.image('arco_forja',     'assets/scenes/forge/arco_forja.png');
    this.load.image('bigorna',        'assets/scenes/forge/bigorna.png');
    this.load.image('forge_moldure',       'assets/scenes/forge/forge_moldure.png');
    this.load.image('forge_status_banner', 'assets/scenes/forge/forge_status_banner.png');
    // Forge-specific ornate element sigils (separate from the small `icon_<id>`
    // tokens used inside card faces).
    for (const id of ['attack','defense','agility','counter','fire','water','air','earth']) {
      this.load.image(`forge_sigil_${id}`, `assets/scenes/forge/forge-sigils/${id}.png`);
    }

    // UI Panels & textures
    this.load.image('combat_hero_panel',    'assets/scenes/combat/combat_hero_panel.png');
    this.load.image('combat_monster_panel', 'assets/scenes/combat/combat_monster_panel.png');
    this.load.spritesheet('hourglass_timer', 'assets/scenes/combat/hourglass_timer.png', { frameWidth: 256, frameHeight: 496 });
    this.load.image('combat_chip_panel', 'assets/scenes/combat/combat_chip_panel.png');
    this.load.image('wood_texture_big', 'assets/scenes/building_panel/wood-texture-big.png');
    this.load.image('bg_character_selection', 'assets/scenes/character_select/background-character-selection.jpg');
    this.load.spritesheet('flame_selection', 'assets/scenes/character_select/flame-spritesheet-selection.png', { frameWidth: 448, frameHeight: 576 });
    this.load.image('icon_table', 'assets/scenes/building_panel/icon-table.png');
    this.load.image('fog', 'assets/scenes/main_menu/fog.png');

    // Combat hit effects — 4-frame spritesheets
    const FX_W = 443; const FX_H = 887;
    this.load.spritesheet('fx_claw',  'assets/effects/combat/fx_claw.png',  { frameWidth: FX_W, frameHeight: FX_H });
    this.load.spritesheet('fx_slash',       'assets/effects/combat/fx_slash.png',       { frameWidth: 512, frameHeight: 512, endFrame: 2 });
    this.load.spritesheet('fx_slash_fire',  'assets/effects/combat/fx_slash_fire.png',  { frameWidth: 1024, frameHeight: 1024, endFrame: 3 });
    this.load.spritesheet('fx_slash_water', 'assets/effects/combat/fx_slash_water.png', { frameWidth: 1024, frameHeight: 1024, endFrame: 3 });
    this.load.spritesheet('fx_slash_wind',  'assets/effects/combat/fx_slash_wind.png',  { frameWidth: 1024, frameHeight: 1024, endFrame: 3 });
    this.load.spritesheet('fx_slash_earth', 'assets/effects/combat/fx_slash_earth.png', { frameWidth: 1024, frameHeight: 1024, endFrame: 3 });
    this.load.spritesheet('fx_shield_fade', 'assets/effects/combat/fx_shield_fade.png', { frameWidth: 1024, frameHeight: 1024 });
    this.load.spritesheet('fx_aura_heal',   'assets/effects/combat/fx_aura_heal.png',   { frameWidth: 1024, frameHeight: 1024, endFrame: 5 });
    this.load.spritesheet('fx_aura_buff',   'assets/effects/combat/fx_aura_buff.png',   { frameWidth: 1024, frameHeight: 1024, endFrame: 5 });
    this.load.spritesheet('fx_leaf_fall',   'assets/effects/combat/fx_leaf_fall.png',   { frameWidth: 512, frameHeight: 512, endFrame: 5 });
    this.load.spritesheet('fx_stomp', 'assets/effects/combat/fx_stomp.png', { frameWidth: 1024, frameHeight: 1024 });
    this.load.spritesheet('fx_bite',  'assets/effects/combat/fx_bite.png',  { frameWidth: 1024, frameHeight: 1024 });
    this.load.spritesheet('fx_fire',  'assets/effects/combat/fx_fire.png',  { frameWidth: 1024, frameHeight: 1024 });
    this.load.spritesheet('fx_bleed', 'assets/effects/combat/fx_bleed.png', { frameWidth: 1024, frameHeight: 1024 });
    this.load.spritesheet('fx_stun',  'assets/effects/combat/fx_stun.png',  { frameWidth: 1024, frameHeight: 1024 });

    // Tutorial step text-box images (pre-rendered via ComfyUI)
    const tutorialSteps = [
      'welcome', 'pick_warrior', 'deck_review', 'map_intro',
      'combat_intro', 'planning_intro', 'place_tile', 'place_subtile',
      'shop_intro', 'shop_buy_relic', 'shop_buy_elements', 'shop_leave',
      'forge_intro', 'forge_craft', 'boss_preview', 'complete',
    ];
    for (const s of tutorialSteps) {
      this.load.image(`tutorial_text_${s}`, `assets/scenes/tutorial/tutorial_${s}.png`);
    }
    this.load.image('tile_selection_board', 'assets/scenes/planning/tile-selection-board.png');
    this.load.image('tile_inventory_panel', 'assets/scenes/planning/tile_inventory_panel.png');
    this.load.image('panel_keyword_frame_v2', 'assets/scenes/combat/panel_keyword_frame_v2.png');
    // Keyword intro panels (baked image per keyword)
    for (const kw of ['brace', 'exhaust', 'haste', 'pierce', 'vengeance']) {
      this.load.image(`keyword_${kw}`, `assets/scenes/combat/keyword_${kw}.png`);
    }
    this.load.image('tutorial_text_panel',    'assets/scenes/tutorial/tutorial_text_panel.png');
    this.load.spritesheet('belt_pillar', 'assets/scenes/planning/belt_pillar_spritesheet.png', {
      frameWidth: 512, frameHeight: 512,
    });
    this.load.image('tile_frame', 'assets/scenes/planning/tile-frame.png');
    this.load.image('card_mold_v2', 'assets/ui/frames/card_mold_v2.png');
    this.load.image('deck_frame', 'assets/ui/frames/deck-frame.png');
    this.load.image('bg_tile_selection', 'assets/scenes/planning/background-tile-selection.png');
    this.load.image('bg_shop_scene', 'assets/scenes/shop/shop.png');
    this.load.image('shop_panel_list',    'assets/scenes/shop/big_panel.png');
    this.load.image('shop_panel_detail',  'assets/scenes/shop/asset description.png');
    this.load.image('shop_tab',           'assets/scenes/shop/shop-section.png');
    this.load.image('shop_row_selected',  'assets/scenes/shop/item_selection.png');
    this.load.image('shop_btn_buy',       'assets/scenes/shop/buy-button.png');
    this.load.image('shop_btn_sell',      'assets/scenes/shop/sell-button.png');
    this.load.image('shop_gold_panel',    'assets/scenes/shop/gold_panel.png');
    this.load.image('confirm_panel',        'assets/scenes/shop_remove_card/confirm_panel.png');
    // Grok-generated painted backdrops for previously-bare scenes. See
    // docs/UI_AUDIT.md for the prompts and re-generation recipe.
    this.load.image('bg_deck_builder', 'assets/scenes/deck_customization/bg_deck_builder.png');
    this.load.image('bg_deck_editor_v2', 'assets/scenes/deck_customization/deck-editor-v2.png');
    this.load.image('bg_relic_vault',  'assets/scenes/relic_viewer/bg_relic_vault.png');
    this.load.image('bg_card_library', 'assets/scenes/card_library/bg_card_library.png');
    this.load.image('book_open',       'assets/scenes/card_library/book_open.png');
    this.load.image('bookmark_tab',    'assets/scenes/card_library/bookmark_tab.png');
    // Page stacks for visual depth in the compendium. Four thickness variants —
    // the active tab picks which side gets which (the book's "open progress").
    this.load.image('page-stack-small',        'assets/scenes/card_library/page-stack - small.png');
    this.load.image('page-stack-medium-small', 'assets/scenes/card_library/page-stack - medium-small.png');
    this.load.image('page-stack-medium-large', 'assets/scenes/card_library/page-stack - medium-large.png');
    this.load.image('page-stack-large',        'assets/scenes/card_library/page-stack - large.png');
    this.load.image('page',            'assets/scenes/card_library/page.png');
    // Central gutter (inner crease where the two facing pages dive into the spine)
    this.load.image('page-gutter',     'assets/scenes/card_library/page-gutter.png');
    // Section bookmark banners (text + emblem baked in, one per compendium tab)
    this.load.image('ribbon_card',     'assets/scenes/card_library/ribbon_card.png');
    this.load.image('ribbon_relics',   'assets/scenes/card_library/ribbon_relics.png');
    this.load.image('ribbon_tiles',    'assets/scenes/card_library/ribbon_tiles.png');
    this.load.image('ribbon_bosses',   'assets/scenes/card_library/ribbon_bosses.png');
    // *_status_panel = painel "rico": a arte é só o fundo e o texto (nome/
    // descrição/deck) é renderizado por cima pelo Phaser em CharacterSelectScene.
    // Tem prioridade sobre *_status (fallback só-imagem) via textures.exists().
    this.load.image('warrior_status_panel',   'assets/scenes/character_select/warrior_status_panel.png');
    this.load.image('mage_status_panel',      'assets/scenes/character_select/mage_status_panel.png');
    // Forge dwarf NPC
    this.load.image('dwarf_talking',          'assets/characters/npc/forge-dwarf/dwarf_talking.png');
    this.load.image('dwarf_hands_on_hips',    'assets/characters/npc/forge-dwarf/dwarf_hands_on_hips.png');
    this.load.image('panel_hover_frame',      'assets/scenes/combat/panel_hover_frame.png');
    this.load.image('bg_settings_scribe',     'assets/ui/backgrounds/bg_settings_scribe.png');
    this.load.image('deck_relic_table', 'assets/scenes/planning/deck-relic-table.png');
    this.load.image('achievements_bg', 'assets/ui/panels/achievments.png');

    // Bitmap fonts (custom game alphabet)
    this.load.bitmapFont('game_font_gold',  'assets/fonts/game_font_gold/game_font_gold.png',   'assets/fonts/game_font_gold/game_font_gold.fnt');
    this.load.bitmapFont('game_font_blue',  'assets/fonts/game_font_blue/game_font_blue.png',   'assets/fonts/game_font_blue/game_font_blue.fnt');
    this.load.bitmapFont('game_font_white', 'assets/fonts/game_font_white/game_font_white.png', 'assets/fonts/game_font_white/game_font_white.fnt');
    // VT323 pixel font variants
    this.load.bitmapFont('vt323_gold',  'assets/fonts/vt323_gold/vt323_gold.png',   'assets/fonts/vt323_gold/vt323_gold.fnt');
    this.load.bitmapFont('vt323_white', 'assets/fonts/vt323_white/vt323_white.png', 'assets/fonts/vt323_white/vt323_white.fnt');
    this.load.bitmapFont('vt323_blue',  'assets/fonts/vt323_blue/vt323_blue.png',   'assets/fonts/vt323_blue/vt323_blue.fnt');

    this.load.image('speed_panel',        'assets/ui/panels/speed_panel.png');
    this.load.image('hud_panel_left',     'assets/scenes/game/hud_panel_left.png');
    this.load.image('hud_hero_panel',     'assets/scenes/game/hero_panel.png');
    this.load.image('hud_loop_panel',     'assets/scenes/game/loop-Panel.png');
    this.load.image('loop_chip_panel',    'assets/scenes/game/loop_chip_panel.png');
    this.load.image('hud_panel_progress', 'assets/scenes/game/hud_panel_progress.png');
    this.load.image('loop_summary_panel', 'assets/scenes/loop_summary/loopcomplete.png');
    this.load.image('txt_loop_complete',  'assets/scenes/loop_summary/txt_loop_complete.png');
    this.load.image('txt_victory',        'assets/scenes/combat/txt_victory.png');
    this.load.image('txt_defeat',         'assets/scenes/combat/txt_defeat.png');
    this.load.image('panel_daily_run',    'assets/ui/panels/panel_daily_run.png');
    this.load.image('txt_daily_run_desc', 'assets/ui/panels/txt_daily_run_desc.png');
    this.load.image('boss_exit_option_panel', 'assets/scenes/boss_exit/option-panel.png');

    // Tile tooltip panels (styled dark/gold panels with baked title + description)
    const tileTooltips = ['forest','graveyard','swamp','desert','lava','event','treasure',
      'ambush','magma','manawell','camp','burnaltar','bleedtotem','resonance','warhorn'];
    for (const t of tileTooltips) {
      this.load.image(`tile_tooltip_${t}`, `assets/scenes/planning/tile_tooltip_${t}.png`);
    }

    // UI Buttons — pre-rendered dark/gold style
    this.load.image('btn_continue_run',    'assets/scenes/main_menu/continue-run.png');
    this.load.image('btn_new_game',        'assets/scenes/main_menu/new-game.png');
    this.load.image('btn_daily_run',       'assets/scenes/main_menu/daily-run.png');
    this.load.image('btn_keep_my_run',     'assets/ui/buttons/btn_keep_my_run.png');
    this.load.image('btn_yes_delete',      'assets/ui/buttons/btn_yes_delete.png');
    this.load.image('btn_resume',          'assets/ui/buttons/btn_resume.png');
    this.load.image('btn_view_deck',       'assets/ui/buttons/btn_view_deck.png');
    this.load.image('btn_settings',        'assets/ui/buttons/btn_settings.png');
    this.load.image('btn_tutorial',        'assets/ui/buttons/btn_tutorial.png');
    // Building buttons (city hub)
    this.load.image('btn_forge',         'assets/scenes/city_hub/btn_forge.png');
    this.load.image('btn_library',       'assets/scenes/city_hub/btn_library.png');
    this.load.image('btn_workshop',      'assets/scenes/city_hub/btn_workshop.png');
    this.load.image('btn_vault',         'assets/scenes/city_hub/btn_vault.png');
    this.load.image('btn_melhorar',          'assets/scenes/city_hub/btn_melhorar.png');
    this.load.image('btn_start_run_hub',     'assets/scenes/city_hub/btn_start_run_hub.png');
    this.load.image('label_requer',          'assets/scenes/city_hub/label_requer.png');
    // Building upgrade text panels (one per level per building)
    const buildingPanels: [string, number][] = [
      ['forge', 6], ['library', 3], ['workshop', 3], ['oracle', 4], ['vault', 8],
    ];
    for (const [name, max] of buildingPanels) {
      for (let l = 1; l <= max; l++) {
        this.load.image(`building_${name}_l${l}`, `assets/scenes/building_panel/building_${name}_l${l}.png`);
      }
    }
this.load.image('btn_start_run',       'assets/ui/buttons/btn_start_run.png');
    this.load.image('btn_back',            'assets/ui/buttons/btn_back.png');
    this.load.image('btn_leave',           'assets/scenes/shop/btn_leave.png');
    this.load.image('btn_close',           'assets/ui/buttons/btn_close.png');
    this.load.image('btn_cancel',          'assets/ui/buttons/btn_cancel.png');
    this.load.image('btn_return_to_menu',  'assets/ui/buttons/btn_return_to_menu.png');
    this.load.image('btn_change_hero',     'assets/ui/buttons/btn_change_hero.png');
    this.load.image('btn_start_game',      'assets/scenes/tutorial/btn_start_game.png');
    this.load.image('btn_visit_shop',      'assets/scenes/relic_viewer/btn_visit_shop.png');
    this.load.image('btn_abandon_run',     'assets/ui/buttons/btn_abandon_run.png');
    this.load.image('btn_banish',          'assets/ui/buttons/btn_banish.png');
    this.load.image('btn_keep',            'assets/ui/buttons/btn_keep.png');
    this.load.image('btn_delete_run',      'assets/ui/buttons/btn_delete_run.png');
    this.load.image('btn_forge_action',    'assets/scenes/forge/btn_forge_action.png');
    this.load.image('btn_dismiss',         'assets/scenes/forge/btn_dismiss.png');
    this.load.image('btn_got_it',          'assets/ui/buttons/btn_got_it.png');
    this.load.image('btn_continue_loop',   'assets/scenes/loop_summary/btn_continue_loop.png');
    // New wood-style buttons (generated 2026-06-06)
    this.load.image('btn_forge_leave',      'assets/scenes/forge/btn_forge_leave.png');
    this.load.image('btn_recipes',          'assets/scenes/forge/btn_recipes.png');
    this.load.image('btn_resume_pause',     'assets/scenes/pause/btn_resume_pause.png');
    this.load.image('btn_view_deck_pause',  'assets/scenes/pause/btn_view_deck_pause.png');
    this.load.image('btn_tutorial_pause',   'assets/scenes/pause/btn_tutorial_pause.png');
    this.load.image('btn_abandon_run_pause','assets/scenes/pause/btn_abandon_run_pause.png');
    this.load.image('btn_back_settings',    'assets/scenes/deck_customization/btn_back_settings.png');
    this.load.image('btn_cancel_remove',    'assets/scenes/shop_remove_card/btn_cancel_remove.png');
    this.load.image('btn_banish_remove',    'assets/scenes/shop_remove_card/btn_banish_remove.png');
    this.load.image('btn_keep_remove',      'assets/scenes/shop_remove_card/btn_keep_remove.png');
    this.load.image('btn_start_run_deck',   'assets/scenes/starting_deck/btn_start_run_deck.png');
    // Landing-page delete-run dialog assets
    this.load.image('lp_delete_run',       'assets/scenes/main_menu/delete-run.png');
    this.load.image('lp_keep',             'assets/scenes/main_menu/keep.png');
    this.load.image('lp_permanent_erase',  'assets/scenes/main_menu/permanente-erase.png');
    this.load.image('btn_reset_progress',  'assets/ui/buttons/btn_reset_progress.png');
    this.load.image('btn_next',            'assets/ui/buttons/btn_next.png');
    this.load.image('btn_start_loop', 'assets/ui/buttons/start-loop.png');
    this.load.image('btn_start_loop_scene', 'assets/scenes/planning/start-loop-loop-scene.png');
    this.load.image('skip_loop_panel', 'assets/scenes/planning/skip-loop.png');
    this.load.image('remove_tiles_panel', 'assets/scenes/planning/remove_tiles.png');
    this.load.image('btn_skip_1',  'assets/scenes/planning/1.png');
    this.load.image('btn_skip_5',  'assets/scenes/planning/5.png');
    this.load.image('btn_skip_10', 'assets/scenes/planning/10.png');
    this.load.image('btn_skip_25', 'assets/scenes/planning/25.png');
    this.load.image('shop_icon', 'assets/scenes/planning/shop.png');
    this.load.image('forge_icon', 'assets/scenes/planning/forge.png');
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
      'smoking_censer', 'lodestone_pendant', 'cracked_crystal',
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

    // Card Illustrations — element-based system (Tier 1 + Tier 2 + Tier 3, all PNG)
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

    // Enemy attack cards (generic attacks shared across many enemies)
    const enemyAttackIds = [
      'claw', 'bite', 'slash', 'smash', 'slam', 'pierce', 'bone_throw',
      'spit', 'thorn_spike', 'fire_breath', 'water_surge', 'poison',
      'drain', 'curse',
    ];
    for (const id of enemyAttackIds) {
      this.load.image(`enemy/enemy_${id}`, `assets/cards/enemy/enemy_${id}.png`);
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
