---
phase: 08-plan-for-the-creation-of-all-sprites-monsters-with-animations-and-all-terrains
plan: 01
subsystem: assets
tags: [pixellab, pixel-art, sprites, animations, monsters, tiles, mcp]

requires:
  - phase: 07-polish-and-release
    provides: Complete game with placeholder enemy rectangles and text tile icons
provides:
  - 6 monster characters with idle and attack animations (64x64 pixel art)
  - 5 special tile icon sprites (64x64 pixel art)
  - Monster asset directory structure with metadata.json
  - PixelLab asset generation scripts for reproducibility
affects: [08-02, 08-03, spritesheet-pipeline, combat-scene, game-scene]

tech-stack:
  added: [pixellab-mcp-api, sharp]
  patterns: [mcp-api-via-curl, zip-extract-organize, idempotent-asset-generation]

key-files:
  created:
    - public/assets/monsters/slime/metadata.json
    - public/assets/monsters/goblin/metadata.json
    - public/assets/monsters/orc/metadata.json
    - public/assets/monsters/mage/metadata.json
    - public/assets/monsters/elite_knight/metadata.json
    - public/assets/monsters/boss_demon/metadata.json
    - public/assets/tiles/tile_shop.png
    - public/assets/tiles/tile_rest.png
    - public/assets/tiles/tile_event.png
    - public/assets/tiles/tile_treasure.png
    - public/assets/tiles/tile_boss.png
    - scripts/download-all.mjs
  modified: []

key-decisions:
  - "Used 8-direction characters (not 4) for south-east animation compatibility with hero pipeline"
  - "Used template animations (breathing-idle, cross-punch/fireball/jumping-1) for cost efficiency (1 gen/direction)"
  - "Boss demon gets extra walking animation for menacing approach sequence"
  - "Tile icons generated as batch of 6 via create_tiles_pro (n_tiles must be in [1,2,4,6,8,9,10,12,16])"

patterns-established:
  - "Monster asset structure: public/assets/monsters/{id}/animations/{anim}/south-east/frame_NNN.png"
  - "PixelLab MCP API accessed via curl with JSON body in temp file (avoids shell escaping)"
  - "ZIP download and PowerShell extraction for frame organization"

requirements-completed: [ART-01, ART-02, ART-03]

duration: 44min
completed: 2026-03-29
---

# Phase 08 Plan 01: Asset Generation Summary

**6 monster characters with idle+attack animations and 5 special tile sprites generated via PixelLab MCP API, all 64x64 pixel art**

## Performance

- **Duration:** 44 min
- **Started:** 2026-03-29T12:44:58Z
- **Completed:** 2026-03-29T13:29:00Z
- **Tasks:** 2
- **Files modified:** 88

## Accomplishments
- Generated all 6 enemy types (slime, goblin, orc, mage, elite_knight, boss_demon) as PixelLab characters with breathing-idle and attack animations
- Downloaded and organized 76 animation frame PNGs into standardized directory structure
- Generated 5 special tile icon sprites (shop, rest, event, treasure, boss) as 64x64 top-down tiles
- Created metadata.json for each monster with character IDs, frame references, and creation parameters

## Task Commits

Each task was committed atomically:

1. **Task 1: Create all 6 monster characters via PixelLab and animate them** - `0ac59bc` (feat)
2. **Task 2: Create special tile icon sprites via PixelLab** - `df067f7` (feat)
3. **Scripts: PixelLab asset generation helpers** - `803c158` (chore)

## Files Created/Modified
- `public/assets/monsters/{slime,goblin,orc,mage,elite_knight,boss_demon}/` - Monster directories with rotations, animations, metadata
- `public/assets/monsters/character_ids.json` - PixelLab character UUID mapping
- `public/assets/tiles/tile_{shop,rest,event,treasure,boss}.png` - Special tile icon sprites
- `scripts/download-all.mjs` - Main download and extraction script
- `scripts/generate-monsters.mjs` - Character creation workflow
- `scripts/pixellab-helper.mjs` - MCP API utility functions

## Decisions Made
- Used 8-direction characters instead of 4-direction to include south-east facing, matching the hero's pipeline convention
- Template animations used for cost efficiency (1 generation per direction vs 20-40 for custom)
- Slime uses jumping-1 for attack (no weapons); mage uses fireball; others use cross-punch; boss uses high-kick
- n_tiles=6 for tile batch (5 needed + 1 extra) since API requires specific tile counts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Recreated 4-direction characters as 8-direction**
- **Found during:** Task 1 (animation queueing)
- **Issue:** Initially created 4-direction characters, but south-east direction required for animations
- **Fix:** Deleted all 6 characters and recreated with n_directions=8
- **Files modified:** N/A (PixelLab cloud)
- **Verification:** All animations successfully queued with south-east direction

**2. [Rule 3 - Blocking] Recreated failed mage and boss_demon characters**
- **Found during:** Task 1 (character status polling)
- **Issue:** mage and boss_demon character generation failed at 90%
- **Fix:** Deleted failed characters and recreated with simplified prompts
- **Files modified:** N/A (PixelLab cloud)
- **Verification:** Both characters completed successfully on second attempt

**3. [Rule 3 - Blocking] Fixed shell escaping for MCP API calls in download script**
- **Found during:** Task 1 (download script execution)
- **Issue:** execSync curl commands with JSON bodies failed due to single-quote escaping on Windows
- **Fix:** Changed to write JSON body to temp file and use -d @tempfile approach
- **Files modified:** scripts/download-all.mjs
- **Verification:** All 6 monsters downloaded successfully

**4. [Rule 1 - Bug] Used n_tiles=6 instead of 5 for tile generation**
- **Found during:** Task 2 (tile creation)
- **Issue:** PixelLab API requires n_tiles from set [1,2,4,6,8,9,10,12,16], not arbitrary numbers
- **Fix:** Used n_tiles=6 and added an extra description entry, discarded tile_5
- **Files modified:** N/A (API parameter)
- **Verification:** All 5 required tiles downloaded at correct 64x64 size

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking)
**Impact on plan:** All fixes necessary for correct asset generation. No scope creep.

## Issues Encountered
- PixelLab MCP tools not available as direct function calls in session; worked around by calling MCP API via curl
- Job queue limit of 8 concurrent jobs required sequential batching of animation requests
- Character generation at 90% completion took longer than estimated ETA (required multiple polling cycles)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All monster sprites ready for spritesheet assembly pipeline (Plan 02)
- All special tile sprites ready for tile rendering integration (Plan 03)
- Directory structure matches expected conventions for Phaser atlas loading

---
*Phase: 08-plan-for-the-creation-of-all-sprites-monsters-with-animations-and-all-terrains*
*Completed: 2026-03-29*
