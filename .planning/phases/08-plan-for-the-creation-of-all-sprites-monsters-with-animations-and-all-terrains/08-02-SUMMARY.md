---
phase: 08-plan-for-the-creation-of-all-sprites-monsters-with-animations-and-all-terrains
plan: 02
subsystem: assets
tags: [sharp, spritesheet, phaser, pixel-art, monsters, tiles]

requires:
  - phase: 08-01
    provides: Raw monster animation frames and special tile PNGs from PixelLab

provides:
  - 12 monster spritesheets (idle + attack for 6 monsters) as horizontal strips
  - Preloader loads all monster and special tile assets
  - TileVisual renders special tiles (shop, rest, event, treasure, boss) with sprites

affects: [combat-scene, game-scene, enemy-rendering]

tech-stack:
  added: []
  patterns: [shared buildSpritesheet function with baseDir/outDir params]

key-files:
  created:
    - public/assets/monsters/*/spritesheets/*_idle.png
    - public/assets/monsters/*/spritesheets/*_attack.png
  modified:
    - scripts/build-spritesheets.mjs
    - src/scenes/Preloader.ts
    - src/ui/TileVisual.ts

key-decisions:
  - "Refactored buildSpritesheet to accept baseDir/outDir instead of hardcoded constants for hero/monster reuse"
  - "Monster spritesheets use same 64x64 frame dimensions as hero for rendering consistency"

patterns-established:
  - "Spritesheet naming: {id}_{anim}.png with monster IDs matching MONSTER_IDS array"
  - "Preloader uses loop over monsterIds array for DRY asset loading"

requirements-completed: [ART-04, ART-05]

duration: 2min
completed: 2026-03-29
---

# Phase 08 Plan 02: Monster Spritesheets and Asset Loading Summary

**12 monster spritesheets built from PixelLab frames via extended sharp pipeline, Preloader loads all monsters + 5 special tiles, TileVisual renders special tile sprites**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29T13:32:10Z
- **Completed:** 2026-03-29T13:33:53Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Extended build-spritesheets.mjs to handle both hero (4) and monster (12) spritesheets with shared builder function
- All 12 monster spritesheets generated: 6 idle (4 frames each) + 6 attack (6-9 frames each)
- Preloader loads 12 monster spritesheets + 5 special tile images in addition to existing hero/terrain assets
- TileVisual TILE_SPRITE_MAP extended from 4 to 9 entries (added shop, rest, event, treasure, boss)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend build-spritesheets.mjs for monsters and build all spritesheets** - `85c28aa` (feat)
2. **Task 2: Update Preloader to load all monster and special tile assets** - `deb118a` (feat)

## Files Created/Modified
- `scripts/build-spritesheets.mjs` - Extended with MONSTER_IDS and monsterAnimations config, refactored buildSpritesheet for reuse
- `public/assets/monsters/*/spritesheets/*_idle.png` - 6 idle spritesheets (horizontal strips, 64x64 frames)
- `public/assets/monsters/*/spritesheets/*_attack.png` - 6 attack spritesheets (horizontal strips, 64x64 frames)
- `src/scenes/Preloader.ts` - Added monster spritesheet loading loop and 5 special tile image loads
- `src/ui/TileVisual.ts` - Extended TILE_SPRITE_MAP with shop, rest, event, treasure, boss entries

## Decisions Made
- Refactored buildSpritesheet to accept baseDir/outDir parameters instead of hardcoded HERO_DIR/OUT_DIR for code reuse across hero and monster pipelines
- Monster spritesheets use same 64x64 frame dimensions as hero for consistent rendering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All monster spritesheets ready for CombatScene enemy rendering
- Special tile sprites ready for world view rendering
- Plan 03 can wire monster sprites into combat animations

---
*Phase: 08-plan-for-the-creation-of-all-sprites-monsters-with-animations-and-all-terrains*
*Completed: 2026-03-29*
