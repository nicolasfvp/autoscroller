# Asset & Texture Audit

## Summary
- **Total assets in `public/`**: 475 files, ~48.9 MB
  - PNG: 312 files (~27.8 MB) · JPG: 22 (~1.87 MB) · GIF: 121 (~0.76 MB)
  - MP3: 6 (~6.83 MB) · WAV: 1 (~8.0 MB) · M4A: 3 (~55 KB) · MP4: 2 (~2.06 MB) · JSON: 7 · ZIP: 1
- **Source asset references**: all loads originate from `src/scenes/Preloader.ts` (the only file with `this.load.*` calls). `src/scenes/Boot.ts` only calls `loadAllData()` (JSON data).
- **Missing referenced files**: **2** (`bg_forest.png`, `bg_run.png`) — guarded by `textures.exists()`, so they silently fall back to color/no-op rather than crash, but the intended art never renders.
- **Orphan files** (in `public/` but never loaded): ~280+ files, ~3.4 MB+ (dominated by the FreeKnight sample pack and per-frame animation directories).

### Top 3 issues
1. **Two referenced textures missing on disk**: `assets/map/tiles/bg_forest.png` and `assets/backgrounds/bg_run.png`. `bg_forest` is the background decoration for forest tiles and is in active use via `BG_SPRITE_MAP` in `TileVisual.ts`. `bg_run` is the run/map screen background drawn in `GameScene.ts:82`.
2. **`hero.zip` shipped to production** (120 KB) — a raw zip archive sitting in `public/assets/characters/hero/`. It will be served as a static file and bundled into the deploy.
3. **Massive orphan asset bloat** — the entire `characters/sprites/FreeKnight_v1/` (242 files / 975 KB), `paladin_generated*` videos+stills, `walk-slowly.mp3` (2.2 MB), `wind.wav` 8 MB uncompressed when an MP3/OGG would be 5-10× smaller. Plus per-frame `animations/*/frame_*.png` and `rotations/*.png` directories for hero+mage that are never referenced (spritesheets are used instead).

---

## Missing referenced assets
| Key | Referenced in | Expected path | Exists? |
|-----|---------------|---------------|---------|
| `bg_forest` | `src/scenes/Preloader.ts:24`; used by `src/ui/TileVisual.ts:22` (`BG_SPRITE_MAP.forest`) | `public/assets/map/tiles/bg_forest.png` | **NO** |
| `bg_run` | `src/scenes/Preloader.ts:99`; rendered in `src/scenes/GameScene.ts:82` | `public/assets/backgrounds/bg_run.png` | **NO** |

Notes:
- Both are wrapped in defensive `textures.exists()` checks (or are top-layer adds, where Phaser shows the "missing texture" green/black checker if the load failed). In Phaser, `this.load.image(key, path)` with a 404 logs a load error and the texture remains unregistered — `add.image(..., 'bg_run')` then renders the engine's __MISSING checker. Verify in DevTools network tab; the user's "missing/bad textures" report most likely traces to `bg_run` (GameScene is the main run screen) and possibly `bg_forest` (forest tiles).
- `tile_lava` is referenced in `TILE_SPRITE_MAP` (`TileVisual.ts:13`) but the loader explicitly skips it (`Preloader.ts:20` comment "tile_lava.png not yet authored — TileVisual falls back to color fill."). Not a bug, but tile_lava-themed loops render as a flat color block.

No other broken references found — every key in `Preloader.ts` resolves to a file on disk except the two above. Monster textures (`monster_*`), relic textures (`relic_*`), and card textures (`card_*`) are all loaded from existing files (cross-verified against the asset listing).

---

## Orphan files (in `public/` but never loaded)

### Large orphan groups
| Path / group | Files | Size | Note |
|--------------|-------|------|------|
| `assets/characters/sprites/FreeKnight_v1/**` | 242 | ~975 KB | Entire vendor sample pack. **Only one** file is used: `Colour1/Outline/120x80_PNGSheets/_Idle.png` (loaded as `knight_idle`). All 241 others — 4 colour/outline variants × PNGSheets + 120x80 GIFs — are dead weight. |
| `assets/videos/paladin-walk.mp4` | 1 | 1.28 MB | Never loaded. |
| `assets/videos/goblin walk.mp4` (note space) | 1 | 823 KB | Never loaded. Filename contains a space. |
| `assets/audio/walk-slowly.mp3` | 1 | 2.25 MB | Never referenced. Loader only has `walk_forward`. |
| `assets/characters/hero/animations/**` (per-frame PNGs) | 23 | ~30 KB | Spritesheets are loaded instead; individual frames unused. |
| `assets/characters/mage/animations/**` (per-frame PNGs) | 23 | ~48 KB | Same — unused. |
| `assets/characters/hero/rotations/**` | 4 | 5 KB | Unused directional rotation sheets. |
| `assets/characters/mage/rotations/south-east.png` | 1 | 3 KB | Unused. |
| `assets/characters/hero/hero.zip` | 1 | 120 KB | **Should not be in `public/`** — raw archive of source art. |
| `assets/characters/hero/metadata.json` | 1 | <1 KB | Never loaded (not in `loadAllData()`). |
| `assets/characters/mage/metadata.json` | 1 | <1 KB | Same. |
| `assets/characters/monsters/character_ids.json` | 1 | <1 KB | Same — pipeline metadata leaking into `public/`. |

### Individual orphan files
| Path | Size | Reason |
|------|------|--------|
| `assets/characters/sprites/angel_generated.png` | 96 KB | No loader entry. Likely planned-but-unused class. |
| `assets/characters/sprites/paladin_generated.png` | 66 KB | Same. |
| `assets/characters/sprites/paladin_generated - Copia.png` | 53 KB | "Copia" = copy. **Accidental duplicate.** |
| `assets/characters/hero/spritesheets/heroAtack.png` | **828 KB** | Typo of `hero_attack.png` (the loaded one) — left behind as an old version. Largest orphan PNG in the project. |
| `assets/backgrounds/night_sky.jpg` | 104 KB | Never loaded. |
| `assets/backgrounds/snow.png` | 8 KB | Never loaded. |
| `assets/backgrounds/snow_bg.png` | 347 KB | Never loaded. (Snow biome stub?) |
| `assets/relics/spell_focus.png` | 61 KB | Removed by Phase 9 v2 purge per `Preloader.ts:166-169` comment; file not deleted. |
| `assets/relics/warrior_spirit.png` | 49 KB | Same. |
| `assets/map/tiles/tileset_forest.png` (+ swamp, graveyard, path) | 4 × 6–8 KB | Tileset atlases never loaded — only the extracted per-tile PNGs are used. |
| `assets/map/tiles/tileset_*_meta.json` | 4 × <1 KB | Companion metadata, also unused. |
| `assets/characters/sprites/FreeKnight_v1/Comparison2x.png` | 2 KB | Sample/promo. |
| `assets/characters/sprites/FreeKnight_v1/PromoAnimated2x.gif` | 71 KB | Sample/promo. |

**Bulk-removal candidates** (totals): FreeKnight pack 975 KB, walk-slowly.mp3 2.25 MB, paladin-walk.mp4 1.28 MB, goblin walk.mp4 823 KB, heroAtack.png 828 KB, hero.zip 120 KB, snow_bg.png 347 KB, animation frame dirs ~78 KB, rotations ~8 KB. **~6.7 MB recoverable** by deleting truly-unreferenced files.

---

## Oversized assets
| Path | Size | Status | Used? |
|------|------|--------|-------|
| `assets/audio/wind.wav` | **8.0 MB** | WAV uncompressed | YES (`ambience_wind`, `GameScene.ts:126`). Convert to OGG/MP3 — expected 0.8–1.5 MB. |
| `assets/backgrounds/bg_battle_graveyard.png` | 5.10 MB | PNG | YES (combat scene). Optimize PNG / convert to JPG (no transparency needed in battle bg). |
| `assets/buildings/backgrounds/shop.png` | 2.78 MB | PNG | YES (shop scene). Same: full-screen opaque bg → JPG. |
| `assets/backgrounds/bg_battle_forest.png` | 2.54 MB | PNG | YES. Same. |
| `assets/ui/panels/deck-frame.png` | 2.36 MB | PNG | YES (`PlanningOverlay.ts`). Likely heavily compressible (UI flat colors). |
| `assets/audio/walk-slowly.mp3` | 2.25 MB | MP3 | **NO** — orphan. Delete. |
| `assets/audio/theme-song.mp3` | 2.07 MB | MP3 | YES. Already MP3; could be re-encoded lower bitrate. |
| `assets/audio/town-song.mp3` | 1.37 MB | MP3 | YES. Same. |
| `assets/videos/paladin-walk.mp4` | 1.28 MB | MP4 | **NO** — orphan. |
| `assets/buildings/backgrounds/forge-table.png` | 1.28 MB | PNG | YES. |
| `assets/ui/panels/background-tile-selection.png` | 1.27 MB | PNG | YES. |
| `assets/audio/walk-forward.mp3` | 1.26 MB | MP3 | YES. |
| `assets/videos/goblin walk.mp4` | 823 KB | MP4 | **NO** — orphan, has space in filename. |
| `assets/characters/hero/spritesheets/heroAtack.png` | 828 KB | PNG | **NO** — orphan typo dup. |
| `assets/ui/panels/bar-wood.png` | 538 KB | PNG | YES. |
| `assets/characters/sprites/judge_generated.png` | 503 KB | PNG | YES (`judge_sprite`). Could compress. |
| `assets/buildings/backgrounds/tavern.png` | 445 KB | PNG | YES. |
| `assets/cards/fortify.png` | 438 KB | PNG | YES. Card art — many cards in 250–450 KB range; consider a bulk compress pass. |

PNGs >500 KB: 15. Audio >2 MB: 3 (`wind.wav`, `bg_battle_graveyard.png` is PNG not audio — counting WAV+2 MP3s).

---

## Placeholder / suspect assets
| Path | Reason |
|------|--------|
| `assets/characters/sprites/paladin_generated - Copia.png` | Filename ends with `- Copia` (Portuguese Windows copy suffix). Accidental dup. |
| `assets/characters/hero/spritesheets/heroAtack.png` | Misspelled mirror of `hero_attack.png` — looks like an old hand-renamed version left behind. |
| `assets/characters/sprites/*_generated.png` (archer, slime, orc, goblin, dragon, snake, judge, angel, paladin) | Filenames literally tagged `_generated` (pixellab MCP output). These are AI-generated placeholders. archer/slime/orc/goblin/dragon/snake/judge ARE loaded; angel/paladin are not. |
| `assets/relics/spell_focus.png`, `warrior_spirit.png` | Comment in `Preloader.ts:166-169` confirms these are dead v1 art the v2 purge missed. |
| `assets/characters/hero/hero.zip` | Source archive, not a game asset. |
| `assets/characters/sprites/FreeKnight_v1/**` | Free vendor sample pack (4 color/outline variants of one knight). Only `Colour1/Outline/_Idle.png` is actually used. |
| `assets/map/tiles/sand_tile.jpg` (283 KB, `tile_basic`/`tile_sand`) | Filename `sand_tile.jpg` while every sibling is `tile_*.png` — naming + format outlier. Probably a stand-in. |
| `assets/ui/buttons/yes, delete.png` | Filename contains a comma + space. Loadable in Phaser (URL-encoded by Vite) but very fragile. |
| `assets/videos/goblin walk.mp4` | Filename contains a space. |

No `placeholder.png`/`temp.png`/`untitled.png`/`asset-N.png` style filenames found.

---

## Naming inconsistencies

### Style chaos (kebab/snake/camel mix)
The loader-key namespace and the underlying file paths follow three different conventions, sometimes for the same logical asset:
| File path style | Examples |
|---|---|
| `kebab-case.png` | `assets/cards/*.png` (`arcane-shield.png`, `reckless-charge.png`), `assets/ui/panels/*.png` (`deck-frame.png`, `tile-selection-board.png`), `assets/buildings/backgrounds/*.png` (`library-table.png`) |
| `snake_case.png` | `assets/backgrounds/bg_battle_*.png`, `assets/map/tiles/tile_*.png`, `assets/map/tiles/bg_*.png`, `assets/relics/*.png`, `assets/characters/monsters/**` (snake-case **inside** filenames but with spaces in many: `corpse eater.png`, `giant spider 2.png`) |
| `camelCase.png` | `heroAtack.png` (the orphan typo) |
| `Mixed` | `assets/buildings/icons/icon_forge.png` (snake) but `assets/buildings/backgrounds/forge-table.png` (kebab) — same logical building, two conventions. |

### Texture-key prefixes
- `bg_*` is used for **three different things**: ground-tile decoration (`bg_forest`, `bg_swamp`), special floating objects (`bg_event`, `bg_treasure`, `bg_rest`, `bg_shop`), and scene backgrounds (`bg_city`, `bg_run`, `bg_battle_*`, `bg_desert`, `bg_character_selection`, `bg_tile_selection`, `bg_base_option`, `bg_shop_scene`). The overload is harmful when grepping — `bg_shop` (a tile decoration) vs `bg_shop_scene` (a fullscreen background) are unrelated, and `bg_run` (the missing scene bg) is a name collision risk with `bg_*` tiles.
- `tile_*` keys mostly map to ground textures, but `tile_selection_board` and `tile_frame` are UI panels (no relationship to ground tiles).
- `icon_*` is used for buildings (`icon_forge`, `icon_storehouse`) — fine — but `icons_up_table` (UI) and `icon_table` (UI) sneak the prefix back.

### Filenames with spaces (Windows-friendly, web-fragile)
- All monsters in `assets/characters/monsters/*/` use spaces: `corpse eater.png`, `headless fire horse.png`, `giant spider 2.png`, `lava golen.png` (sic — typo of "golem"), `mecha warrior.png`, etc. **20+ files.** These work because the loader's `staticMonsters` list builds the paths literally — but any URL-handling code that does not URI-encode (or any future CDN with strict path normalization) will break them.
- `assets/ui/buttons/yes, delete.png` — comma + space.
- `assets/videos/goblin walk.mp4` — space.

### Typos in filenames (real, ships to prod)
- `assets/ui/panels/achievments.png` — missing 'e' (loaded as `achievements_bg`).
- `assets/characters/monsters/lava/lava golen.png` — should be `lava_golem`. Loaded as `monster_lava_golen` (the typo is now baked into the loader and `EnemyDefinitions`).
- `assets/characters/hero/spritesheets/heroAtack.png` — extra typo'd dup, **not** loaded.

### Same texture loaded under a different alias
- `Preloader.ts:160`: `this.load.image('mat_bone', 'assets/icons/stone.png');` — `mat_bone` and `mat_stone` resolve to the **same PNG**. Loading the same file twice under different keys works, but Phaser will register two separate texture entries (RAM cost is small here but still wasteful). Either rename the second to alias the first (`textures.addAlias`) or supply a real bone icon.

### Duplicate / collision
- `paladin_generated.png` vs `paladin_generated - Copia.png` — accidental duplicate.
- `hero_attack.png` (loaded) vs `heroAtack.png` (not loaded) — old version not deleted.

---

## Findings (severity-ranked)

### S1 — Broken (will render the engine's missing-texture checker)
- **`bg_run` 404**: `GameScene.ts:82` does `this.add.image(400, 300, 'bg_run')...` unconditionally. With the file missing, Phaser draws the green/black "MISSING" placeholder behind the run map. This is almost certainly the visible texture issue the user reported.
- **`bg_forest` 404**: `TileVisual.ts:88-95` guards with `textures.exists()`, so this silently degrades to "no decoration" rather than checker — but the intended forest-tile decoration is invisible.

### S2 — Production-quality / payload
- **`hero.zip` (120 KB) shipping in `public/`** — strip from build.
- **`wind.wav` is 8 MB uncompressed** for an ambience loop. Encoding to 96 kbps OGG would drop it to ~500 KB with no audible loss; matches the rest of the audio's codec policy.
- **Battle backgrounds are oversized PNGs** (`bg_battle_graveyard.png` 5.1 MB, `bg_battle_forest.png` 2.5 MB, `shop.png` 2.8 MB). These are fullscreen opaque backgrounds — JPG at 85 q would save ~70%.

### S3 — Cleanup / orphan removal
- ~6.7 MB recoverable by deleting confirmed orphans listed above (FreeKnight pack, walk-slowly.mp3, both .mp4s, heroAtack.png, hero.zip, snow_bg.png, paladin/angel/copia stills, spell_focus/warrior_spirit relics, per-frame animation dirs, rotation PNGs, tileset_*.png/_meta.json).
- Move `metadata.json`, `character_ids.json`, `hero.zip`, `tileset_*_meta.json` out of `public/` — they're authoring artefacts, not runtime data.

### S4 — Naming hygiene
- Pick one convention (kebab-case is dominant in newer assets) and rename file paths to match, or accept the split and at least document it. The mix of `forge-table.png` and `icon_forge.png` for the same building is the most jarring example.
- Fix the `lava golen` typo (file + loader id + enemy definitions in lock-step).
- `mat_bone` aliasing `mat_stone` — either supply a real `bone.png` or call `textures.addAlias` instead of double-loading.
- Replace spaces in monster filenames with underscores (and update the `staticMonsters` table accordingly) to avoid URL-encoding fragility.

### S5 — Cosmetic
- The `bg_*` prefix is overloaded across three asset categories. Consider `dec_*` for tile decorations, `obj_*` for floating objects, `scene_*` for fullscreen scene backgrounds. (Pure refactor; not blocking.)
