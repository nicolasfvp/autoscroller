---
phase: 01-architecture-foundation
plan: 02
subsystem: architecture
tags: [savemanager, idb-keyval, indexeddb, thin-scenes, boot-flow, auto-save]

# Dependency graph
requires:
  - "Typed EventBus (on/off/emit) from Plan 01"
  - "JSON-serializable RunState with getRun/setRun/createNewRun from Plan 01"
  - "DataLoader with loadAllData() from Plan 01"
provides:
  - "SaveManager with IndexedDB persistence via idb-keyval (save/load/clear/setupAutoSave)"
  - "Auto-save on combat:end and loop:completed events"
  - "Mid-combat save handling (isInCombat=false, currentScene='Game')"
  - "Boot flow: loadAllData -> check save -> Continue Run / New Run"
  - "17 thin scene wrappers (all singletons eliminated)"
  - "Shutdown cleanup pattern on all scenes"
affects: [01-03-PLAN, 02-combat-deck-system, 03-loop-world-system, 04-content-meta-progression-persistence]

# Tech tracking
tech-stack:
  added: [idb-keyval]
  patterns: [thin-scene-wrapper, named-event-handlers, shutdown-cleanup, auto-save-on-events, overlay-panel-template]

key-files:
  created:
    - src/core/SaveManager.ts
    - tests/core/savemanager.test.ts
  modified:
    - src/scenes/Boot.ts
    - src/scenes/Preloader.ts
    - src/scenes/MainMenu.ts
    - src/scenes/Game.ts
    - src/scenes/CombatScene.ts
    - src/scenes/RewardScene.ts
    - src/scenes/ShopScene.ts
    - src/scenes/RestScene.ts
    - src/scenes/EventScene.ts
    - src/scenes/PauseScene.ts
    - src/scenes/SettingsScene.ts
    - src/scenes/GameOverScene.ts
    - src/scenes/DeckCustomizationScene.ts
    - src/scenes/RelicViewerScene.ts
    - src/scenes/SelectionScene.ts
    - src/scenes/DeathScene.ts
    - src/scenes/TutorialScene.ts
    - src/main.ts
    - package.json

key-decisions:
  - "Phaser registry used to pass savedRun from Preloader to MainMenu (avoids RunState mutation before user choice)"
  - "Overlay scenes use placeholder content marked for Phase 2 (clean separation of architecture from gameplay logic)"
  - "SettingsScene has no RunState dependency (settings are global, not per-run)"

patterns-established:
  - "Thin scene template: getRun() in create(), named event handlers as class fields, cleanup on shutdown"
  - "Overlay panel: centered Rectangle 0x222222 alpha 0.9, 600x400, setInteractive() to block click-through"
  - "Button pattern: Phaser Text with setInteractive({useHandCursor}), accent #ffd700 default, white on hover"
  - "Save indicator: 14px accent text, bottom-right, fade-in 200ms -> hold 1.5s -> fade-out 500ms"

requirements-completed: [ARCH-01, PERS-01]

# Metrics
duration: 8min
completed: 2026-03-26
---

# Phase 01 Plan 02: SaveManager + Scenes Summary

**SaveManager with idb-keyval IndexedDB persistence, auto-save on combat/loop events, and 17 thin scene wrappers eliminating all singletons**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-26T18:52:44Z
- **Completed:** 2026-03-26T19:01:06Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments
- SaveManager persists RunState to IndexedDB with mid-combat handling (stores pre-combat state)
- All 17 scenes rewritten as thin wrappers over RunState + EventBus with proper shutdown cleanup
- Boot flow implemented: loadAllData -> check save -> MainMenu with Continue/New Run + destructive confirmation
- Auto-save wired on combat:end and loop:completed events with save indicator animation
- Zero singleton references remain in src/scenes/ (getDeckManager, getRelicManager, resetGold, etc. all eliminated)
- 6 new SaveManager tests, all 35 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 0: SaveManager with idb-keyval + auto-save wiring** - `f146806` (feat, TDD)
2. **Task 1: Rewrite core scenes + boot flow wiring** - `fd72418` (feat)
3. **Task 2: Rewrite overlay and secondary scenes** - `fb1b0b2` (feat)

## Files Created/Modified
- `src/core/SaveManager.ts` - IndexedDB persistence via idb-keyval with auto-save
- `tests/core/savemanager.test.ts` - 6 tests for save/load/clear/mid-combat/events
- `src/scenes/Boot.ts` - Calls loadAllData() then transitions to Preloader
- `src/scenes/Preloader.ts` - Checks for saved run, passes to MainMenu via registry
- `src/scenes/MainMenu.ts` - Continue Run / New Run with destructive confirmation
- `src/scenes/Game.ts` - Thin HUD wrapper with auto-save, save indicator, event subscriptions
- `src/scenes/CombatScene.ts` - Thin rendering shell with isInCombat bookkeeping
- `src/scenes/RewardScene.ts` - Overlay with getRun() for gold display (placeholder Phase 2)
- `src/scenes/ShopScene.ts` - Overlay with getRun() for gold display (placeholder Phase 2)
- `src/scenes/RestScene.ts` - Overlay with getRun() for HP display (placeholder Phase 2)
- `src/scenes/EventScene.ts` - Overlay with getRun() for hero/economy context (placeholder Phase 2)
- `src/scenes/PauseScene.ts` - Resume/Settings/Abandon Run buttons
- `src/scenes/SettingsScene.ts` - Placeholder with Back button
- `src/scenes/GameOverScene.ts` - Stats display with saveManager.clear() + createNewRun()
- `src/scenes/DeathScene.ts` - Death stats with saveManager.clear() + createNewRun()
- `src/scenes/DeckCustomizationScene.ts` - Reads run.deck (placeholder Phase 2)
- `src/scenes/RelicViewerScene.ts` - Reads run.relics (placeholder Phase 2)
- `src/scenes/SelectionScene.ts` - Reads run.generation (placeholder Phase 2)
- `src/scenes/TutorialScene.ts` - Static tutorial text, no RunState dependency
- `src/main.ts` - Added DeathScene import, set debug: false
- `package.json` - Added idb-keyval dependency

## Decisions Made
- Used Phaser registry to pass savedRun from Preloader to MainMenu (avoids mutating RunState before user choice)
- Overlay/secondary scenes have placeholder content marked for Phase 2 (clean separation)
- SettingsScene has no RunState dependency since settings are global

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - idb-keyval requires no external configuration.

## Next Phase Readiness
- Architecture foundation complete: EventBus, RunState, SaveManager, thin scenes all in place
- Plan 03 (memory management + cleanup conventions) can proceed
- Phase 2 (combat + deck system) has all scene shells ready for gameplay logic
- All scenes follow consistent patterns for future development

---
*Phase: 01-architecture-foundation*
*Completed: 2026-03-26*
