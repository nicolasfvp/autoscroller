// AssetManifest — the single source of truth for every Phaser asset the game
// loads, partitioned into tiers so the first screen can paint after loading a
// tiny menu-critical set instead of the full ~800MB library up front.
//
// Tiers (loaded in this priority order by the background warmer):
//   0. menu-critical  — the ~2MB MainMenu + global-sound + bitmap-font set that
//                        blocks first paint (Preloader.preload only loads this).
//   1. light chrome    — all small/medium UI + run-entry visuals (hero/mage
//                        sheets, tiles, landmarks, parallax, HUD, buttons,
//                        panels, icons, tooltips, fonts already in tier 0). The
//                        scenes reachable directly from the menu (GameScene /
//                        CharacterSelect / CombatScene) preload this so a fast
//                        cold click is always pixel-correct.
//   2. relic art       — relic illustrations (blind sites in RelicHudStrip /
//                        RelicViewer are also guarded as a backstop).
//   3. combat art      — monster sprites + portraits, hit-effect spritesheets,
//                        battle backgrounds (CombatScene preloads this).
//   4. card art        — the ~300MB of card illustrations. CardFace renders a
//                        procedural mold + emoji placeholder when art is absent,
//                        so this is purely progressive and never blocks.
//   5. scene art       — large one-off scene backgrounds (city/forge/shop/editor
//                        /defeat). Consumers guard with textures.exists().
//
// Every load goes through the cache-guarded helpers below so the warmer and any
// per-scene preload dedupe against the global cache (Phaser keys are global).

import Phaser from 'phaser';

type Loader = Phaser.Loader.LoaderPlugin;
type SheetCfg = Phaser.Types.Loader.FileTypes.ImageFrameConfig;

// A target the tier functions write into. Two implementations exist:
//  • loaderTarget()    — queues straight onto a scene's LoaderPlugin (used by
//                        the blocking Preloader + per-scene preloads).
//  • collectorTarget() — records load specs so the background warmer can pace
//                        them through the loader in small chunks (warmAllAssets).
// Keeping both behind one interface means the tier bodies below are the single
// source of truth for every key→path pair regardless of how they're loaded.
interface LoadTarget {
  image(key: string, url: string): void;
  spritesheet(key: string, url: string, cfg: SheetCfg): void;
  audio(key: string, url: string): void;
  bitmapFont(key: string, png: string, fnt: string): void;
}

// Thin pass-throughs so each tier body reads as a flat list of loads.
function image(t: LoadTarget, key: string, url: string): void { t.image(key, url); }
function sheet(t: LoadTarget, key: string, url: string, cfg: SheetCfg): void { t.spritesheet(key, url, cfg); }
function audio(t: LoadTarget, key: string, url: string): void { t.audio(key, url); }
function bitmapFont(t: LoadTarget, key: string, png: string, fnt: string): void { t.bitmapFont(key, png, fnt); }

// Queues onto a real loader, skipping keys already in the global cache so the
// warmer and per-scene preloads dedupe instead of refetching.
export function loaderTarget(load: Loader): LoadTarget {
  return {
    image: (k, u) => { if (!load.scene.textures.exists(k)) load.image(k, u); },
    spritesheet: (k, u, c) => { if (!load.scene.textures.exists(k)) load.spritesheet(k, u, c); },
    audio: (k, u) => { if (!load.scene.cache.audio.exists(k)) load.audio(k, u); },
    bitmapFont: (k, p, f) => { if (!load.scene.cache.bitmapFont.exists(k)) load.bitmapFont(k, p, f); },
  };
}

// ── Tier 0: menu-critical (blocks first paint) ────────────────────────────────
export function loadMenuCritical(load: LoadTarget): void {
  // MainMenu background + buttons (drawn blind by MainMenu.createImgBtn).
  // Delete-run confirmation overlay (reachable from the menu's New Game button).

  // Menu audio (theme + the global click SFX that fires on the first menu tap).
  audio(load, 'theme_song', 'assets/audio/theme-song.mp3');
  audio(load, 'sfx_click', 'assets/audio/select.mp3');

  // Bitmap fonts (~1.2MB total). Bitmap-font text CANNOT be guarded by
  // textures.exists() and renders empty/garbled if used before load, so the
  // whole set ships in tier 0 to make every later scene's bitmapText safe.
  bitmapFont(load, 'game_font_gold', 'assets/fonts/game_font_gold/game_font_gold.png', 'assets/fonts/game_font_gold/game_font_gold.fnt');
  bitmapFont(load, 'game_font_blue', 'assets/fonts/game_font_blue/game_font_blue.png', 'assets/fonts/game_font_blue/game_font_blue.fnt');
  bitmapFont(load, 'game_font_white', 'assets/fonts/game_font_white/game_font_white.png', 'assets/fonts/game_font_white/game_font_white.fnt');
  bitmapFont(load, 'vt323_gold', 'assets/fonts/vt323_gold/vt323_gold.png', 'assets/fonts/vt323_gold/vt323_gold.fnt');
  bitmapFont(load, 'vt323_white', 'assets/fonts/vt323_white/vt323_white.png', 'assets/fonts/vt323_white/vt323_white.fnt');
  bitmapFont(load, 'vt323_blue', 'assets/fonts/vt323_blue/vt323_blue.png', 'assets/fonts/vt323_blue/vt323_blue.fnt');
}

// ── Tier 1: light chrome + run-entry visuals ──────────────────────────────────
export function loadLightChrome(load: LoadTarget): void {
  // Combat-terrain tiles (single all-in-one diorama per tile).
  image(load, 'tile_basic', 'assets/map/tiles/tile_basic.png');
  image(load, 'tile_forest', 'assets/map/tiles/tile_forest.png');
  image(load, 'tile_graveyard', 'assets/map/tiles/tile_graveyard.png');
  image(load, 'tile_swamp', 'assets/map/tiles/tile_swamp.png');
  image(load, 'tile_desert', 'assets/map/tiles/tile_desert.png');
  image(load, 'tile_lava', 'assets/map/tiles/tile_lava.png');
  for (const id of ['forest', 'graveyard', 'swamp', 'desert', 'lava']) {
    image(load, `tile_reserved_${id}`, `assets/map/tiles/tile_reserved_${id}.png`);
  }
  image(load, 'tile_event', 'assets/map/tiles/tile_event.png');
  image(load, 'tile_treasure', 'assets/map/tiles/tile_treasure.png');
  image(load, 'tile_boss', 'assets/map/tiles/tile_boss.png');

  // Tile landmarks.
  image(load, 'landmark_event', 'assets/map/landmarks/landmark_event.png');
  image(load, 'landmark_treasure', 'assets/map/landmarks/landmark_treasure.png');
  image(load, 'landmark_boss', 'assets/map/landmarks/landmark_boss.png');
  image(load, 'landmark_desert', 'assets/map/landmarks/landmark_desert.png');
  image(load, 'landmark_forest', 'assets/map/landmarks/landmark_forest.png');
  image(load, 'landmark_graveyard', 'assets/map/landmarks/landmark_graveyard.png');
  image(load, 'landmark_swamp', 'assets/map/landmarks/landmark_swamp.png');
  image(load, 'landmark_lava', 'assets/map/landmarks/landmark_lava.png');
  image(load, 'landmark_subtile_camp', 'assets/map/landmarks/landmark_subtile_camp.png');
  image(load, 'landmark_subtile_manawell', 'assets/map/landmarks/landmark_subtile_manawell.png');
  image(load, 'landmark_subtile_ambush', 'assets/map/landmarks/landmark_subtile_ambush.png');
  image(load, 'landmark_subtile_bleedtotem', 'assets/map/landmarks/landmark_subtile_bleedtotem.png');
  image(load, 'landmark_subtile_burnaltar', 'assets/map/landmarks/landmark_subtile_burnaltar.png');
  image(load, 'landmark_subtile_magma', 'assets/map/landmarks/landmark_subtile_magma.png');
  image(load, 'landmark_subtile_resonance', 'assets/map/landmarks/landmark_subtile_resonance.png');
  image(load, 'landmark_subtile_warhorn', 'assets/map/landmarks/landmark_subtile_warhorn.png');

  // Hero (warrior) sprites.
  image(load, 'hero_idle', 'assets/characters/hero/idle/idle_1.png');
  image(load, 'hero_idle2', 'assets/characters/hero/idle/idle_2.png');
  image(load, 'hero_shadow', 'assets/characters/hero/shadow.png');
  sheet(load, 'hero_walk', 'assets/characters/hero/scrolling/spritesheet.png', { frameWidth: 512, frameHeight: 512 });
  sheet(load, 'hero_attack', 'assets/characters/hero/attack/attack.png', { frameWidth: 532, frameHeight: 568 });
  sheet(load, 'hero_channel', 'assets/characters/hero/cast_debuff/cast_debuff_spritesheet.png', { frameWidth: 512, frameHeight: 512 });
  sheet(load, 'hero_battle_stance', 'assets/characters/hero/battle_stance/battle_stance_spritesheet.png', { frameWidth: 512, frameHeight: 512 });
  sheet(load, 'hero_defend', 'assets/characters/hero/defend/defend_spritesheet.png', { frameWidth: 512, frameHeight: 512 });
  sheet(load, 'hero_chibi_warrior', 'assets/characters/hero/pocket/spritesheet.png', { frameWidth: 512, frameHeight: 512 });
  sheet(load, 'warrior_select', 'assets/characters/hero/selection/spritesheet.png', { frameWidth: 500, frameHeight: 437 });

  // Mage sprites.
  sheet(load, 'mage_select', 'assets/characters/mage/selection/spritesheet.png', { frameWidth: 386, frameHeight: 514 });
  sheet(load, 'mage_idle', 'assets/characters/mage/idle/spritesheet.png', { frameWidth: 640, frameHeight: 562 });
  sheet(load, 'mage_attack', 'assets/characters/mage/attack/spritesheet.png', { frameWidth: 640, frameHeight: 562 });
  sheet(load, 'mage_walk', 'assets/characters/mage/scrolling/spritesheet.png', { frameWidth: 512, frameHeight: 512 });
  sheet(load, 'hero_chibi_mage', 'assets/characters/mage/pocket/spritesheet.png', { frameWidth: 256, frameHeight: 256, endFrame: 5 });

  // Parallax loop backgrounds.

  // Glossary + combat HUD chrome (small, all guarded at use sites).
  image(load, 'glossary_book_icon', 'assets/ui/glossary/book_icon.png');
  image(load, 'glossary_panel_bg', 'assets/ui/glossary/panel_bg.png');

  // Character-select chrome.

  // Forge sigils (element glyphs resolved by ElementSystem/IconTokens) + small
  // forge items. The large forge backdrop lives in tier 5 (scene art).
  for (const id of ['attack', 'defense', 'agility', 'counter', 'fire', 'water', 'air', 'earth']) {
    image(load, `forge_sigil_${id}`, `assets/icons/tokens/forge-sigils/${id}.png`);
  }

  // Tutorial + keyword teaching panels (guarded; appear during first run).
  const tutorialSteps = [
    'welcome', 'pick_warrior', 'deck_review', 'map_intro',
    'combat_intro', 'planning_intro', 'place_tile', 'place_subtile',
    'shop_intro', 'shop_buy_relic', 'shop_buy_elements', 'shop_leave',
    'forge_intro', 'forge_craft', 'boss_preview', 'complete',
  ];
  for (const s of tutorialSteps) {
    image(load, `tutorial_text_${s}`, `assets/ui/text/tutorial/tutorial_${s}.png`);
  }
  for (const kw of ['brace', 'exhaust', 'haste', 'vengeance']) {
    image(load, `keyword_${kw}`, `assets/ui/text/keyword/keyword_${kw}.png`);
  }

  // Planning / tile-selection chrome.
  image(load, 'card_mold_v2', 'assets/ui/frames/card_mold_v2.png');
  image(load, 'deck_frame', 'assets/ui/frames/deck-frame.png');
  const tileTooltips = ['forest', 'graveyard', 'swamp', 'desert', 'lava', 'event', 'treasure',
    'ambush', 'magma', 'manawell', 'camp', 'burnaltar', 'bleedtotem', 'resonance', 'warhorn'];
  for (const t of tileTooltips) {
    image(load, `tile_tooltip_${t}`, `assets/ui/text/tiles/tile_tooltip_${t}.png`);
  }

  // Shop chrome (small panels/buttons; large shop backdrops are tier 5).
  image(load, 'confirm_panel', 'assets/ui/panels/confirm_panel.png');

  // Forge dwarf NPC + wood button skin + settings/keyword frames.
  image(load, 'dwarf_talking', 'assets/characters/npc/forge-dwarf/dwarf_talking.png');
  image(load, 'dwarf_hands_on_hips', 'assets/characters/npc/forge-dwarf/dwarf_hands_on_hips.png');

  // Generic HUD panels.
  image(load, 'speed_panel', 'assets/ui/panels/speed_panel.png');

  // Buttons (all small).
  const buttons = [
    'btn_keep_my_run', 'btn_yes_delete', 'btn_resume', 'btn_view_deck', 'btn_settings', 'btn_tutorial',
    'btn_start_run', 'btn_back', 'btn_close', 'btn_cancel', 'btn_return_to_menu', 'btn_change_hero',
    'btn_abandon_run', 'btn_banish', 'btn_keep', 'btn_delete_run',
    'btn_got_it', 'btn_reset_progress', 'btn_next',
    'btn_keep_my_run', 'btn_yes_delete',
  ];
  for (const b of buttons) {
    image(load, b, `assets/ui/buttons/${b}.png`);
  }
  image(load, 'btn_start_loop', 'assets/ui/buttons/start-loop.png');

  // Building upgrade text panels (one per level per building).
  const buildingPanels: Array<[string, number]> = [
    ['forge', 6], ['library', 3], ['workshop', 3], ['oracle', 4], ['vault', 8],
  ];
  for (const [name, max] of buildingPanels) {
    for (let l = 1; l <= max; l++) {
      image(load, `building_${name}_l${l}`, `assets/ui/text/buildings/building_${name}_l${l}.png`);
    }
  }

  // Material + utility icons (small).
  image(load, 'mat_iron', 'assets/icons/iron.png');
  image(load, 'mat_crystal', 'assets/icons/crystal.png');
  image(load, 'mat_scroll', 'assets/icons/scroll.png');
  image(load, 'mat_wood', 'assets/icons/wood.png');
  image(load, 'mat_stone', 'assets/icons/stone.png');
  image(load, 'mat_bone', 'assets/icons/bone.png');
  image(load, 'mat_essence', 'assets/icons/essence.png');
  image(load, 'mat_herbs', 'assets/icons/herbs.png');
  image(load, 'deck_icon', 'assets/icons/deck-icon.png');
  image(load, 'relic_icon', 'assets/icons/relic-icon.png');
  image(load, 'icon_coin', 'assets/icons/coin.png');
  image(load, 'icon_brick', 'assets/icons/brick.png');
  image(load, 'icon_card', 'assets/icons/card.jpg');

  // Card token glyphs ([burn], [str], elements, …) + painterly v2 element icons.
  const cardTokenIds = [
    'burn', 'bleed', 'poison', 'slow', 'stun', 'rage',
    'str', 'vit', 'dex', 'int', 'spi',
    'stam', 'mana', 'HP', 'armor', 'exhaust',
    'attack', 'defense', 'agility', 'counter',
    'fire', 'water', 'air', 'earth',
  ];
  for (const token of cardTokenIds) {
    image(load, `icon_${token}`, `assets/icons/tokens/${token}.png`);
  }
  for (const token of ['attack', 'defense', 'agility', 'counter', 'fire', 'water', 'air', 'earth']) {
    image(load, `icon_v2_${token}`, `assets/icons/tokens/elements-v2/${token}.png`);
  }

  // Run/town audio (missing audio is silent — never a visual break).
  audio(load, 'town_song', 'assets/audio/town-song.mp3');
  audio(load, 'walk_forward', 'assets/audio/walk-forward.mp3');
  audio(load, 'sfx_slash', 'assets/audio/slash.mp3');
  audio(load, 'sfx_fireball', 'assets/audio/fire.m4a');
  audio(load, 'sfx_hurt', 'assets/audio/hurt.m4a');
  audio(load, 'sfx_cashing', 'assets/audio/cashing.m4a');
  audio(load, 'ambience_wind', 'assets/audio/wind.wav');
}

// ── Tier 2: relic art ─────────────────────────────────────────────────────────
const RELIC_IDS = [
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
  'glass_cannon', 'hemlock_vial', 'constellation_sigil',
];

export function loadRelicArt(load: LoadTarget): void {
  for (const id of RELIC_IDS) {
    image(load, `relic_${id}`, `assets/relics/${id}.png`);
  }
}

// ── Tier 3: combat art (monsters, hit effects, battle backgrounds) ────────────
const STATIC_MONSTERS: Array<{ id: string; folder: string; file: string; hasFrame2?: boolean }> = [
  { id: 'corpse_eater', folder: 'cemetery', file: 'corpse eater_1.png', hasFrame2: true },
  { id: 'pocket_cat', folder: 'cemetery', file: 'pocket cat.png' },
  { id: 'skeleton', folder: 'cemetery', file: 'skeleton_1.png', hasFrame2: true },
  { id: 'vampire', folder: 'cemetery', file: 'vampire_1.png', hasFrame2: true },
  { id: 'werewolf', folder: 'cemetery', file: 'werewolf_1.png', hasFrame2: true },
  { id: 'zombie', folder: 'cemetery', file: 'zombie.png' },
  { id: 'doom_knight', folder: 'default', file: 'doom_knight_1.png', hasFrame2: true },
  { id: 'baby_dragon', folder: 'desert', file: 'baby dragon_1.png', hasFrame2: true },
  { id: 'mutated_salamander', folder: 'desert', file: 'mutated_salamander_1.png', hasFrame2: true },
  { id: 'scorpion', folder: 'desert', file: 'scorpion_1.png', hasFrame2: true },
  { id: 'ancient_tree', folder: 'forest', file: 'ancient tree_1.png', hasFrame2: true },
  { id: 'mush', folder: 'forest', file: 'mush_1.png', hasFrame2: true },
  { id: 'forge_slime', folder: 'lava', file: 'forge_slime_1.png', hasFrame2: true },
  { id: 'lava_golem', folder: 'lava', file: 'lava_golem_1.png', hasFrame2: true },
  { id: 'fire_elemental', folder: 'lava', file: 'fire_elemental_1.png', hasFrame2: true },
  { id: 'depths_horror', folder: 'swamp', file: 'depths_horror_1.png', hasFrame2: true },
  { id: 'toxic_gooze', folder: 'swamp', file: 'toxic gooze_1.png', hasFrame2: true },
  { id: 'venomous_kobra', folder: 'swamp', file: 'venomous_kobra_1.png', hasFrame2: true },
  { id: 'slime', folder: 'green_field', file: 'slime_1.png', hasFrame2: true },
  { id: 'red_slime', folder: 'green_field', file: 'red_slime_1.png', hasFrame2: true },
  { id: 'earth_dragon', folder: 'green_field', file: 'earth_dragon_1.png', hasFrame2: true },
  { id: 'lost_lizard', folder: '', file: 'lost_lizard_1.png', hasFrame2: true },
  { id: 'bog_witch', folder: 'boss', file: 'bog_witch_1.png', hasFrame2: true },
  { id: 'desert_golem', folder: 'boss', file: 'desert_golem_1.png', hasFrame2: true },
  { id: 'infernal_dragon', folder: 'boss', file: 'infernal_dragon_1.png', hasFrame2: true },
  { id: 'iron_golem',      folder: 'boss', file: 'iron_golem_1.png', hasFrame2: true },
  { id: 'boss_iron_golem', folder: 'boss', file: 'iron_golem_1.png', hasFrame2: true },
];

const ENEMY_ATTACK_IDS = [
  'claw', 'bite', 'slash', 'smash', 'slam', 'pierce', 'bone_throw',
  'spit', 'thorn_spike', 'fire_breath', 'water_surge', 'poison',
  'drain', 'curse',
];

export function loadCombatArt(load: LoadTarget): void {
  for (const m of STATIC_MONSTERS) {
    const path = m.folder
      ? `assets/characters/monsters/${m.folder}/${m.file}`
      : `assets/characters/monsters/${m.file}`;
    image(load, `monster_${m.id}`, path);
    if (m.hasFrame2) {
      image(load, `monster_${m.id}_2`, path.replace(/(_1)?\.png$/i, '_2.png'));
    }
    image(load, `portrait_${m.id}`, `assets/characters/monsters/portraits/${m.id}.png`);
  }

  // Enemy attack cards (rendered via CardFace, which guards art).
  for (const id of ENEMY_ATTACK_IDS) {
    image(load, `enemy/enemy_${id}`, `assets/cards/enemy/enemy_${id}.png`);
  }

  // Battle backgrounds.

  // Hit-effect spritesheets (CombatEffects early-returns when absent).
  const FX_W = 443; const FX_H = 887;
  sheet(load, 'fx_slash', 'assets/effects/combat/fx_slash.png', { frameWidth: FX_W, frameHeight: FX_H });
  sheet(load, 'fx_shield_fade', 'assets/effects/combat/fx_shield_fade.png', { frameWidth: 1024, frameHeight: 1024 });
  sheet(load, 'fx_aura_heal', 'assets/effects/combat/fx_aura_heal.png', { frameWidth: 1024, frameHeight: 1024, endFrame: 5 });
  sheet(load, 'fx_aura_buff', 'assets/effects/combat/fx_aura_buff.png', { frameWidth: 1024, frameHeight: 1024, endFrame: 5 });
  sheet(load, 'fx_leaf_fall', 'assets/effects/combat/fx_leaf_fall.png', { frameWidth: 512, frameHeight: 512, endFrame: 5 });
  sheet(load, 'fx_stomp', 'assets/effects/combat/fx_stomp.png', { frameWidth: 1024, frameHeight: 1024 });
  sheet(load, 'fx_bite', 'assets/effects/combat/fx_bite.png', { frameWidth: 1024, frameHeight: 1024 });
  sheet(load, 'fx_fire', 'assets/effects/combat/fx_fire.png', { frameWidth: 1024, frameHeight: 1024 });
  sheet(load, 'fx_bleed', 'assets/effects/combat/fx_bleed.png', { frameWidth: 1024, frameHeight: 1024 });
  sheet(load, 'fx_stun', 'assets/effects/combat/fx_stun.png', { frameWidth: 1024, frameHeight: 1024 });
}

// ── Tier 4: card art (~300MB; CardFace renders emoji placeholder when absent) ──
const CARD_IDS = [
  // T1 — single elements
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
  // T3 — physical pure
  't3-attack-attack-attack', 't3-defense-defense-defense',
  't3-agility-agility-agility', 't3-counter-counter-counter',
  // T3 — elemental pure
  't3-fire-fire-fire', 't3-water-water-water', 't3-air-air-air', 't3-earth-earth-earth',
  // T3 — physical mixed
  't3-attack-attack-defense', 't3-agility-attack-attack', 't3-attack-attack-counter',
  't3-attack-defense-defense', 't3-agility-defense-defense', 't3-counter-defense-defense',
  't3-agility-agility-attack', 't3-agility-agility-defense', 't3-agility-agility-counter',
  't3-attack-counter-counter', 't3-counter-counter-defense', 't3-agility-counter-counter',
  't3-agility-attack-defense', 't3-attack-counter-defense', 't3-agility-attack-counter',
  't3-agility-counter-defense',
  // T3 — elemental mixed
  't3-fire-fire-water', 't3-air-fire-fire', 't3-earth-fire-fire',
  't3-fire-water-water', 't3-air-water-water', 't3-earth-water-water',
  't3-air-air-fire', 't3-air-air-water', 't3-air-air-earth',
  't3-earth-earth-fire', 't3-earth-earth-water', 't3-air-earth-earth',
  't3-air-fire-water', 't3-earth-fire-water', 't3-air-earth-fire',
  't3-air-earth-water',
  // T3 — physical × elemental
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

export function loadCardArt(load: LoadTarget): void {
  for (const id of CARD_IDS) {
    image(load, `card_${id}`, `assets/cards/${id}.png`);
  }
}

// ── Tier 5: large one-off scene backgrounds (all guarded at use sites) ────────
export function loadSceneArt(load: LoadTarget): void {
  image(load, 'bg_settings_scribe', 'assets/ui/backgrounds/bg_settings_scribe.png');
  image(load, 'achievements_bg', 'assets/ui/panels/achievments.png');
}

// ── Background warmer ─────────────────────────────────────────────────────────
// Streams the deferred (non-menu) library into the global cache AFTER the menu
// has painted, in small PACED chunks so texture decode + GPU upload work spreads
// across frames instead of bursting (a single bulk load() of ~568MB uploads
// hundreds of textures back-to-back on the main thread and visibly lags early
// gameplay). Hosted on the persistent GlobalSound scene so it completes across
// scene transitions. Idempotent — re-entering the menu never re-arms it.

type LoadSpec =
  | { kind: 'image'; key: string; url: string }
  | { kind: 'spritesheet'; key: string; url: string; cfg: SheetCfg }
  | { kind: 'audio'; key: string; url: string }
  | { kind: 'bitmapFont'; key: string; png: string; fnt: string };

function collectorTarget(out: LoadSpec[]): LoadTarget {
  return {
    image: (key, url) => out.push({ kind: 'image', key, url }),
    spritesheet: (key, url, cfg) => out.push({ kind: 'spritesheet', key, url, cfg }),
    audio: (key, url) => out.push({ kind: 'audio', key, url }),
    bitmapFont: (key, png, fnt) => out.push({ kind: 'bitmapFont', key, png, fnt }),
  };
}

// Queue one spec onto a loader, skipping anything already cached. Returns true
// if it actually queued a fetch.
function queueSpec(load: Loader, s: LoadSpec): boolean {
  switch (s.kind) {
    case 'image':
      if (load.scene.textures.exists(s.key)) return false;
      load.image(s.key, s.url); return true;
    case 'spritesheet':
      if (load.scene.textures.exists(s.key)) return false;
      load.spritesheet(s.key, s.url, s.cfg); return true;
    case 'audio':
      if (load.scene.cache.audio.exists(s.key)) return false;
      load.audio(s.key, s.url); return true;
    case 'bitmapFont':
      if (load.scene.cache.bitmapFont.exists(s.key)) return false;
      load.bitmapFont(s.key, s.png, s.fnt); return true;
  }
}

let warmStarted = false;

export function warmAllAssets(scene: Phaser.Scene): void {
  if (warmStarted) return;
  warmStarted = true;

  // Priority order: light chrome + relics first (most likely hit early), then
  // combat art, then the heavy card pile, then large scene backdrops.
  const specs: LoadSpec[] = [];
  const collector = collectorTarget(specs);
  loadLightChrome(collector);
  loadRelicArt(collector);
  loadCombatArt(collector);
  loadCardArt(collector);
  loadSceneArt(collector);

  const load = scene.load;
  load.maxParallelDownloads = 4; // gentle on disk / OneDrive hydration

  const CHUNK = 4;    // fetches queued per batch
  const GAP_MS = 90;  // breathing room between batches so frames render
  let i = 0;

  const pump = (): void => {
    // Queue up to CHUNK *uncached* specs (cached ones are skipped for free).
    let queued = 0;
    while (i < specs.length && queued < CHUNK) {
      if (queueSpec(load, specs[i])) queued++;
      i++;
    }
    if (queued === 0) {
      console.log('[AssetWarm] background asset pre-warm complete');
      return;
    }
    load.once(Phaser.Loader.Events.COMPLETE, () => {
      scene.time.delayedCall(GAP_MS, pump);
    });
    load.start();
  };

  pump();
}
