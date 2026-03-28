---
phase: 07-polish-release
plan: 02
subsystem: ui
tags: [tutorial, settings, game-speed, hud-animation, tweens, phaser]

requires:
  - phase: 07-01
    provides: StyleConstants, AudioManager, MetaState v3 with tutorialSeen/audioPrefs/gameSpeed
provides:
  - Rewritten 6-screen tutorial with first-run gate and skip button
  - Full settings scene with volume slider, mute, speed, auto-save, save management
  - Game speed 2x multiplier wired into GameScene and CombatScene
  - Tweened number counters (300ms) in LoopHUD and CombatHUD
  - CMBT-05 and PLSH-01 requirements marked complete
affects: [07-03]

tech-stack:
  added: []
  patterns: [tweened-counter-pattern, game-speed-multiplier]

key-files:
  created:
    - tests/systems/GameSpeed.test.ts
  modified:
    - src/scenes/TutorialScene.ts
    - src/scenes/MainMenu.ts
    - src/scenes/SettingsScene.ts
    - src/scenes/GameScene.ts
    - src/scenes/CombatScene.ts
    - src/ui/LoopHUD.ts
    - src/ui/CombatHUD.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Tutorial uses in-place text updates instead of scene.restart() per step for smoother UX"
  - "Game speed loaded from MetaState in async create() rather than passed as scene data"
  - "Tweened counters use addCounter with stop-before-start guard to prevent stacking"

patterns-established:
  - "Tweened counter pattern: track displayedValue, compare to actual, tween with addCounter(300ms), stop existing tween first"
  - "Game speed multiplier: load from MetaState in create(), apply as delta * gameSpeed in update()"

requirements-completed: [POLISH-TUTORIAL, POLISH-SETTINGS, POLISH-SPEED, POLISH-HUD-ANIM, CMBT-05, PLSH-01]

duration: 5min
completed: 2026-03-28
---

# Phase 07 Plan 02: Feature Polish Summary

**6-screen tutorial with first-run gate, full settings with volume/speed/save controls, 2x game speed in loop and combat, tweened HUD counters over 300ms**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T05:12:43Z
- **Completed:** 2026-03-28T05:17:44Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Tutorial rewritten with 6 accurate screens (tile placement, deck ordering, auto-combat, shop), first-run gate via tutorialSeen, skip button
- SettingsScene fully functional: SFX volume slider, mute toggle, game speed toggle, auto-save toggle, delete run with confirmation, reset all with double confirmation
- Game speed 2x wired into both GameScene (LoopRunner.tick) and CombatScene (CombatEngine.tick) via delta multiplication
- LoopHUD and CombatHUD use tweened number counters (gold, HP, stamina, mana, tile points, enemy HP) animating over 300ms
- CMBT-05 and PLSH-01 marked complete in REQUIREMENTS.md

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite TutorialScene with accurate content and first-run gate** - `0809bc8` (feat)
2. **Task 2: Expand SettingsScene + wire game speed + mark CMBT-05/PLSH-01** - `5f8344a` (feat)
3. **Task 3: Add tweened number counters to LoopHUD and CombatHUD** - `41c2525` (feat)

## Files Created/Modified
- `src/scenes/TutorialScene.ts` - 6-screen tutorial with first-run gate and skip button
- `src/scenes/MainMenu.ts` - Routes new runs through TutorialScene, uses StyleConstants
- `src/scenes/SettingsScene.ts` - Full settings: volume, speed, save management with persistence
- `src/scenes/GameScene.ts` - Game speed multiplier on LoopRunner tick
- `src/scenes/CombatScene.ts` - Game speed multiplier on CombatEngine tick
- `src/ui/LoopHUD.ts` - Tweened counters for gold, HP, tile points; uses StyleConstants
- `src/ui/CombatHUD.ts` - Tweened counters for hero HP/stamina/mana and enemy HP; uses StyleConstants
- `tests/systems/GameSpeed.test.ts` - Unit tests for game speed delta multiplication
- `.planning/REQUIREMENTS.md` - CMBT-05 and PLSH-01 marked complete

## Decisions Made
- Tutorial uses in-place text updates (setText) instead of scene.restart() per step, for smoother transitions
- Game speed is loaded from MetaState in async create() rather than passed as scene data, keeping scenes self-contained
- Tweened counters use addCounter with stop-before-start guard to prevent concurrent tween stacking on the same field

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

2 pre-existing test failures (MetaPersistence.test.ts and content.test.ts) expect version 2 but MetaState v3 migration from Plan 01 returns version 3. These are out of scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All feature polish items complete, ready for Plan 03 (final build/deployment)
- Tutorial, settings, game speed, and HUD animations all functional
- All v1 requirements now marked complete

---
*Phase: 07-polish-release*
*Completed: 2026-03-28*
