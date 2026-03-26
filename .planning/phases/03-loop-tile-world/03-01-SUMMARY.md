---
phase: 03-loop-tile-world
plan: 01
subsystem: game-systems
tags: [loop-runner, tile-registry, synergy, difficulty-scaling, loot, vitest, tdd]

requires:
  - phase: 01-architecture-foundation
    provides: "EventBus, RunState shape, DataLoader patterns"
  - phase: 02-combat-deck-engine
    provides: "CombatEngine tick pattern, DeckSystem pure functions"
provides:
  - "LoopRunner state machine (idle, traversing, tile-interaction, planning, boss-choice, run-ended)"
  - "TileRegistry with 9 tile types from JSON config"
  - "SynergyResolver for 6 adjacency synergy pairs with wrap-around"
  - "DifficultyScaler with per-loop % scaling and boss multiplier"
  - "RunEndResolver for safe exit (100%) vs death (25%/0%) rewards"
  - "LootGenerator for treasure rolls, tile drops, meta-loot, enemy pools"
  - "4 JSON data configs (tiles, synergies, difficulty, terrain-enemies)"
affects: [03-02, 03-03, 04-01]

tech-stack:
  added: []
  patterns: ["Pure TS systems with no Phaser dependency", "Injectable RNG for deterministic testing", "JSON data-driven game balance configs", "Tick-driven state machine (same pattern as CombatEngine)"]

key-files:
  created:
    - src/systems/LoopRunner.ts
    - src/systems/TileRegistry.ts
    - src/systems/SynergyResolver.ts
    - src/systems/DifficultyScaler.ts
    - src/systems/RunEndResolver.ts
    - src/systems/LootGenerator.ts
    - src/data/tiles.json
    - src/data/synergies.json
    - src/data/difficulty.json
    - src/data/terrain-enemies.json
    - tests/systems/LoopRunner.test.ts
    - tests/systems/TileRegistry.test.ts
    - tests/systems/SynergyResolver.test.ts
    - tests/systems/DifficultyScaler.test.ts
    - tests/systems/RunEndResolver.test.ts
    - tests/systems/LootGenerator.test.ts
  modified: []

key-decisions:
  - "New tiles.json at src/data/ (not src/data/json/) to separate Phase 3 tile world configs from legacy Phase 1/2 data"
  - "LoopRunner uses injectable RNG + emit callback for pure testing (same DI pattern as CombatEngine)"
  - "Tile keys use string identifiers (forest, graveyard, etc.) rather than numeric enums for JSON serialization"
  - "TILE_SIZE=80 constant exported from LoopRunner to match existing MapManager"

patterns-established:
  - "LoopRunner emit callback pattern: constructor(emit: LoopEventCallback) for EventBus decoupling"
  - "TileSlot type system: TileSlotType + optional TerrainType for terrain subtypes"
  - "Adjacency synergy resolution: wrap-around + order-independent pair matching"

requirements-completed: [LOOP-01, LOOP-03, LOOP-04, LOOP-05, LOOP-06, LOOP-07, LOOP-08, TILE-01, TILE-02, TILE-04]

duration: 5min
completed: 2026-03-26
---

# Phase 03 Plan 01: Loop + Tile World Systems Summary

**Pure TS loop state machine, tile registry (9 types), synergy resolver (6 pairs), difficulty scaler, loot generator, and run-end resolver with 64 unit tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T20:20:42Z
- **Completed:** 2026-03-26T20:25:28Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- 6 pure TypeScript systems created with zero Phaser dependencies
- LoopRunner implements full state machine with all 6 states and transitions
- 4 JSON data configs externalize all game balance values
- 64 unit tests all passing across 6 test files
- Injectable RNG pattern enables deterministic testing for all randomized systems

## Task Commits

Each task was committed atomically:

1. **Task 1: JSON data configs + TileRegistry + SynergyResolver + DifficultyScaler + RunEndResolver + LootGenerator** - `9d22140` (feat)
2. **Task 2: LoopRunner state machine with full test coverage** - `1443e20` (feat)

## Files Created/Modified
- `src/data/tiles.json` - 9 tile type configs (basic, forest, graveyard, swamp, shop, rest, event, treasure, boss)
- `src/data/synergies.json` - 6 adjacency synergy pair definitions
- `src/data/difficulty.json` - Loop difficulty scaling, boss injection, meta-loot configs
- `src/data/terrain-enemies.json` - Terrain-to-enemy pool mapping with loop-threshold additions
- `src/systems/TileRegistry.ts` - Tile type definitions, getTileConfig, getAllPlaceableTiles, createBasicLoop
- `src/systems/SynergyResolver.ts` - Adjacency synergy resolution with wrap-around support
- `src/systems/DifficultyScaler.ts` - Per-loop enemy stat scaling with boss multiplier
- `src/systems/RunEndResolver.ts` - Safe exit (100%) vs death (25% meta-loot, 0% XP) reward calculation
- `src/systems/LootGenerator.ts` - Treasure loot rolls, tile drops, meta-loot sources, enemy pool queries
- `src/systems/LoopRunner.ts` - Full loop state machine: idle->traversing->tile-interaction->planning->boss-choice->run-ended

## Decisions Made
- New tiles.json at `src/data/` path (not `src/data/json/`) to separate Phase 3 tile world configs from legacy Phase 1/2 data format
- LoopRunner uses injectable RNG + emit callback for pure testing (same DI pattern as CombatEngine)
- Tile keys use string identifiers for JSON serialization compatibility
- TILE_SIZE=80 constant exported from LoopRunner to match existing MapManager

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in `tests/systems/hero/warrior.test.ts` (starter deck order mismatch) - out of scope, not caused by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All loop + tile pure systems ready for Phaser scene integration in Plan 03-02
- LoopRunner can be wired to EventBus via emit callback in GameScene
- TileRegistry and SynergyResolver ready for planning UI in Plan 03-03

## Self-Check: PASSED

- All 16 created files verified present on disk
- Commit 9d22140 (Task 1) verified in git log
- Commit 1443e20 (Task 2) verified in git log
- 64 tests passing across 6 test files
- 0 Phaser imports in src/systems/

---
*Phase: 03-loop-tile-world*
*Completed: 2026-03-26*
