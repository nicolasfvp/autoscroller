---
phase: 04-content-meta-progression-persistence
plan: 03
subsystem: ui
tags: [phaser, scenes, city-hub, meta-progression, collection, relic-hud, seed-display]

# Dependency graph
requires:
  - phase: 04-01
    provides: "MetaState, buildings.json, SeededRNG, MetaPersistence"
  - phase: 04-02
    provides: "MetaProgressionSystem, CollectionRegistry, UnlockManager"
provides:
  - "CityHubScene -- between-run hub with 5 clickable buildings in cross layout"
  - "BuildingPanelScene -- overlay showing tier, upgrade preview, and upgrade button"
  - "TavernPanelScene -- seed input, Start Run button, run history"
  - "CollectionScene -- tabbed grid viewer for cards, relics, tiles, events, bosses"
  - "RelicHudStrip -- compact relic icons with hover tooltips during runs"
  - "SeedDisplay -- bottom-right seed text with click-to-copy"
  - "UnlockCelebration -- animated overlay on building upgrade"
  - "DeathScene meta-loot summary with Return to City flow"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Overlay scenes launched via scene.launch with delayed backdrop interactivity to prevent click-through"
    - "CityHub disables input when launching overlays, re-enabled on close"

key-files:
  created:
    - src/scenes/CityHubScene.ts
    - src/scenes/BuildingPanelScene.ts
    - src/scenes/TavernPanelScene.ts
    - src/scenes/CollectionScene.ts
    - src/ui/RelicHudStrip.ts
    - src/ui/RelicTooltip.ts
    - src/ui/SeedDisplay.ts
    - src/ui/UnlockCelebration.ts
  modified:
    - src/scenes/DeathScene.ts
    - src/scenes/Game.ts
    - src/main.ts
    - src/systems/deck/LootSystem.ts

key-decisions:
  - "Overlay backdrop uses 100ms delayed interactivity to prevent same-frame click-through from parent scene"
  - "BuildingPanelScene stops both itself and CityHub then restarts CityHub on close to refresh display"
  - "LootSystem generateCardReward falls back to any available rarity when target pool is empty"
  - "LootSystem deduplicates card picks within a single reward to prevent offering the same card twice"

patterns-established:
  - "Overlay panel pattern: parent disables input, overlay delays backdrop, close re-enables parent input"

requirements-completed: [META-01, RELC-01, RELC-02, RELC-03]

# Metrics
duration: 4min
completed: 2026-03-27
---

# Phase 04 Plan 03: Meta-Progression UI Summary

**City hub with 5 buildings, building upgrade panels, tavern seed input, tabbed collection viewer, relic HUD strip, seed display, and death-screen meta-loot summary**

## Performance

- **Duration:** 4 min (bug-fix continuation; original tasks ~15 min)
- **Started:** 2026-03-27T01:33:28Z
- **Completed:** 2026-03-27T01:37:27Z
- **Tasks:** 4 (3 from previous session + 1 checkpoint with bug fixes)
- **Files modified:** 15

## Accomplishments
- CityHubScene renders 5 buildings in cross layout with meta-loot balance, class XP, and Collection button
- BuildingPanelScene shows tier progress, unlock preview with transparency, and handles upgrade purchases
- TavernPanelScene provides seed input, Start Run flow, and run history display
- CollectionScene shows tabbed grid (Cards/Relics/Tiles/Events/Bosses) with unlock status and hints
- RelicHudStrip shows compact relic icons with hover tooltips during gameplay
- SeedDisplay shows seed in bottom-right with click-to-copy and toast feedback
- DeathScene shows meta-loot/XP earned and transitions to CityHub via "Return to City"
- Card reward screen reliably shows 3 cards with rarity fallback
- Building overlay panels open and close without freezing

## Task Commits

Each task was committed atomically:

1. **Task 1: CityHubScene + BuildingPanelScene + TavernPanelScene + UnlockCelebration** - `d3489be` (feat)
2. **Task 2: CollectionScene -- tabbed content viewer** - `cb69dda` (feat)
3. **Task 3: RelicHudStrip + SeedDisplay + DeathScene meta-loot + Game wiring** - `3fe9ef0` (feat)
4. **Task 4: Bug fixes from visual checkpoint** - `380df39` (fix)

## Files Created/Modified
- `src/scenes/CityHubScene.ts` - Between-run hub with 5 buildings in cross layout
- `src/scenes/BuildingPanelScene.ts` - Overlay panel for building upgrades with tier preview
- `src/scenes/TavernPanelScene.ts` - Tavern overlay with seed input and run history
- `src/scenes/CollectionScene.ts` - Tabbed collection viewer for all content categories
- `src/ui/RelicHudStrip.ts` - Compact horizontal relic display for Game HUD
- `src/ui/RelicTooltip.ts` - Hover tooltip for relic icons
- `src/ui/SeedDisplay.ts` - Seed text with click-to-copy in Game HUD
- `src/ui/UnlockCelebration.ts` - Animated celebration overlay on unlock
- `src/scenes/DeathScene.ts` - Extended with meta-loot summary and Return to City
- `src/scenes/Game.ts` - Integrated RelicHudStrip and SeedDisplay
- `src/main.ts` - Registered all new scenes
- `src/systems/deck/LootSystem.ts` - Fixed card reward generation with rarity fallback

## Decisions Made
- Overlay backdrop interactivity delayed 100ms to prevent same-frame click propagation from parent scene
- BuildingPanelScene restarts CityHub on close to refresh displayed data after upgrades
- LootSystem.generateCardReward uses fallback to any rarity when target pool is empty (fixes 1-card reward bug)
- Card picks are deduplicated within a single reward generation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Card reward screen showed only 1 card instead of 3**
- **Found during:** Task 4 (human-verify checkpoint)
- **Issue:** generateCardReward filtered out all common cards (already in starter deck), and 60% of rarity rolls target common, resulting in empty pool and skipped picks
- **Fix:** Added fallback to any available rarity when target pool is empty; added deduplication of picks within a reward
- **Files modified:** src/systems/deck/LootSystem.ts
- **Verification:** Logic review confirms 3 cards will always be offered when the total pool has 3+ cards
- **Committed in:** 380df39

**2. [Rule 1 - Bug] Clicking Forge building in CityHub froze the game**
- **Found during:** Task 4 (human-verify checkpoint)
- **Issue:** CityHubScene click event propagated to BuildingPanelScene backdrop on the same frame, causing immediate close which restarted CityHub, triggering the click again in an infinite loop
- **Fix:** CityHubScene disables input when launching overlays; backdrop interactivity delayed 100ms; BuildingPanelScene properly stops both scenes then restarts CityHub
- **Files modified:** src/scenes/CityHubScene.ts, src/scenes/BuildingPanelScene.ts, src/scenes/TavernPanelScene.ts
- **Verification:** Logic review confirms click-through is prevented
- **Committed in:** 380df39

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered
None beyond the user-reported bugs fixed in Task 4.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 04 UI layer complete: all meta-progression systems have visual interfaces
- Full player loop works: CityHub -> Tavern -> Run -> Death -> CityHub with meta-loot persisting
- Collection screen creates completionist pull with unlock hints

## Self-Check: PASSED

All 9 key files verified present. All 4 task commits verified in git log.

---
*Phase: 04-content-meta-progression-persistence*
*Completed: 2026-03-27*
