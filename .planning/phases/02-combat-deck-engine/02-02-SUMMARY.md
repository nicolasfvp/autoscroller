---
phase: 02-combat-deck-engine
plan: 02
subsystem: gameplay
tags: [deck-management, xp, passives, warrior, loot, tdd]

requires:
  - phase: 01-architecture-foundation
    provides: RunState interfaces, DataLoader, cards.json
provides:
  - DeckSystem with add/remove/reorder pure functions
  - LootSystem with weighted-rarity card reward generation
  - WarriorClass definition with base stats and starter deck
  - XPSystem with earn/bank/lose operations
  - PassiveSkillSystem with stat modifiers and conditional triggers
  - warrior-passives.json data file (5 passives)
affects: [02-combat-deck-engine, 03-ui-shop-progression, 04-meta-persistence]

tech-stack:
  added: []
  patterns: [pure-function systems on RunState, injectable RNG interface, JSON-driven passive data]

key-files:
  created:
    - src/systems/deck/DeckSystem.ts
    - src/systems/deck/LootSystem.ts
    - src/systems/hero/WarriorClass.ts
    - src/systems/hero/XPSystem.ts
    - src/systems/hero/PassiveSkillSystem.ts
    - src/data/json/warrior-passives.json
    - tests/systems/deck/deck-system.test.ts
    - tests/systems/deck/loot-system.test.ts
    - tests/systems/hero/warrior.test.ts
    - tests/systems/hero/xp-system.test.ts
    - tests/systems/hero/passive-skills.test.ts
  modified:
    - src/state/RunState.ts

key-decisions:
  - "DeckSystem operates on RunState.deck.active directly (not DeckManager class)"
  - "LootSystem uses injectable RNG interface for deterministic testing"
  - "HeroState extended with optional runXP/totalXP/className for backward compat"
  - "Passive skills loaded from JSON, resolved purely against totalXP threshold"

patterns-established:
  - "Pure function systems: no class instances, mutate RunState in-place"
  - "Injectable RNG: { next(): number } interface for testable randomness"
  - "JSON data files: passive definitions as data, logic in TypeScript"

requirements-completed: [DECK-01, DECK-02, DECK-03, DECK-07, DECK-08, HERO-01, HERO-02, HERO-03, HERO-04]

duration: 4min
completed: 2026-03-26
---

# Phase 02 Plan 02: Deck & Hero Systems Summary

**Deck management (add/remove/reorder with gold costs), weighted-rarity loot generation, warrior class with XP earn/bank/lose, and 5-passive skill tree with stat modifiers and conditional triggers**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T19:14:13Z
- **Completed:** 2026-03-26T19:18:15Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- DeckSystem: free card add, gold-scaling removal (inversely proportional to deck size), flat 30g reorder
- LootSystem: 3-card reward generation with 60/30/10 common/uncommon/rare weighting, configurable drop chance per enemy type
- Warrior class definition with base stats (100HP/50stam/30mana) and 10-card starter deck
- XP system: earn per combat type (10/30/80), bank on safe boss exit, lose all on death
- 5 passive skills at XP thresholds (100/250/450/700/1000) with stat_modifier and conditional_trigger types
- 49 tests across 5 test files, all passing (TDD workflow: RED then GREEN)

## Task Commits

Each task was committed atomically:

1. **Task 1: DeckSystem + LootSystem** - `2d978fa` (feat)
2. **Task 2: WarriorClass + XPSystem + PassiveSkillSystem** - `1a17320` (feat)

_Note: TDD tasks -- tests written first (RED), then implementation (GREEN), committed together per task._

## Files Created/Modified
- `src/systems/deck/DeckSystem.ts` - Pure functions: addCard, removeCard, reorderDeck, getRemovalCost
- `src/systems/deck/LootSystem.ts` - generateCardReward (weighted rarity), shouldOfferReward (enemy type chance)
- `src/systems/hero/WarriorClass.ts` - WARRIOR_BASE_STATS, WARRIOR_STARTER_DECK, WarriorClassDef
- `src/systems/hero/XPSystem.ts` - getXPForEnemy, earnXP, bankXP, loseAllRunXP
- `src/systems/hero/PassiveSkillSystem.ts` - resolvePassives, applyPassiveModifiers, checkConditionalTrigger
- `src/data/json/warrior-passives.json` - 5 warrior passive skill definitions
- `src/state/RunState.ts` - Added optional runXP, totalXP, className to HeroState
- `tests/systems/deck/deck-system.test.ts` - 13 tests for DeckSystem
- `tests/systems/deck/loot-system.test.ts` - 10 tests for LootSystem
- `tests/systems/hero/warrior.test.ts` - 9 tests for WarriorClass
- `tests/systems/hero/xp-system.test.ts` - 7 tests for XPSystem
- `tests/systems/hero/passive-skills.test.ts` - 10 tests for PassiveSkillSystem

## Decisions Made
- DeckSystem operates on RunState.deck.active directly (pure functions, not the legacy DeckManager class) -- cleaner, no class singleton
- LootSystem uses injectable RNG interface `{ next(): number }` for deterministic testing
- HeroState extended with optional fields (runXP?, totalXP?, className?) for backward compatibility with existing code
- Passive skills loaded from JSON data, resolved purely against totalXP threshold -- data-driven design

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added runXP/totalXP/className to HeroState interface**
- **Found during:** Task 2 (XPSystem implementation)
- **Issue:** HeroState lacked runXP, totalXP, className fields required by XPSystem and PassiveSkillSystem
- **Fix:** Added optional fields to HeroState in RunState.ts
- **Files modified:** src/state/RunState.ts
- **Verification:** All tests pass, backward compatible (optional fields)
- **Committed in:** 1a17320 (Task 2 commit)

**2. [Rule 3 - Blocking] Plan references deck.collection but actual interface has deck.inventory**
- **Found during:** Task 1 (DeckSystem implementation)
- **Issue:** Plan specified deck.collection but RunState has deck.inventory (Record<string, number>)
- **Fix:** DeckSystem operates on deck.active only (matching actual interface); addCard does not touch inventory/collection
- **Files modified:** src/systems/deck/DeckSystem.ts
- **Verification:** All deck tests pass
- **Committed in:** 2d978fa (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for type compatibility with existing codebase. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Deck management and hero progression systems ready for shop UI integration (Phase 3)
- Combat engine (Plan 01) can consume XP/passive systems for post-combat rewards
- Card rarity field needed on cards.json for production LootSystem use (currently mocked in tests)

## Self-Check: PASSED

- All 11 created files verified present on disk
- Commit 2d978fa (Task 1) verified in git log
- Commit 1a17320 (Task 2) verified in git log
- 49/49 tests passing across 5 test files

---
*Phase: 02-combat-deck-engine*
*Completed: 2026-03-26*
