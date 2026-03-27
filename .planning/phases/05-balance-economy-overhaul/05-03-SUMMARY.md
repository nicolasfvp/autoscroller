---
phase: 05-balance-economy-overhaul
plan: 03
subsystem: systems
tags: [economy, materials, shop-pricing, loop-growth, death-penalty, storehouse]

requires:
  - phase: 05-balance-economy-overhaul
    provides: "Plan 01 types, data schemas, difficulty.json pricing/loopGrowth, materials.json, buildings.json with multi-material costs"
provides:
  - "ShopSystem with scaling gold prices (cards, removal, reorder, relics) with caps"
  - "LootGenerator.rollMaterialDrops for terrain/enemy/boss material drops"
  - "MetaProgressionSystem with multi-material upgrade costs and getStorehouseEffects"
  - "RunEndResolver with per-material death penalty and Storehouse retention bonus"
  - "DifficultyScaler with diminishing loop growth schedule and 40-tile cap"
affects: [05-balance-economy-overhaul, 06-content-expansion]

tech-stack:
  added: []
  patterns:
    - "Static price methods reading from difficulty.json pricing config"
    - "getStorehouseEffects scans building tiers up to current level for cumulative effects"
    - "rollMaterialDrops uses injectable RNG same as existing loot systems"

key-files:
  created: []
  modified:
    - src/systems/ShopSystem.ts
    - src/systems/DifficultyScaler.ts
    - src/systems/LootGenerator.ts
    - src/systems/MetaProgressionSystem.ts
    - src/systems/RunEndResolver.ts
    - src/systems/BossSystem.ts
    - src/systems/LoopRunner.ts
    - tests/systems/ShopSystem.test.ts
    - tests/systems/DifficultyScaler.test.ts
    - tests/systems/LootGenerator.test.ts
    - tests/systems/MetaProgressionSystem.test.ts
    - tests/systems/RunEndResolver.test.ts
    - tests/systems/BossSystem.test.ts
    - tests/systems/LoopRunner.test.ts

key-decisions:
  - "ShopSystem keeps local RunState interface for backward compat with scene callers"
  - "getStorehouseEffects accumulates highest effect per tier (not additive), matching buildings.json structure"
  - "LoopRunner tracks bossKillCount internally for diminishing growth schedule"

patterns-established:
  - "Scaling price pattern: Math.min(base + count * escalation, cap)"
  - "Storehouse effects lookup: scan tiers up to level, take latest value per effect type"

requirements-completed: [BAL-SHOP, BAL-MATERIALS, BAL-DEATH, BAL-LOOP, BAL-STOREHOUSE]

duration: 7min
completed: 2026-03-27
---

# Phase 05 Plan 03: System Rework Summary

**Scaling gold prices, material drop system, multi-material upgrades, Storehouse effects, and diminishing loop growth across all 5 core game systems**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T19:34:12Z
- **Completed:** 2026-03-27T19:41:54Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- ShopSystem calculates scaling prices with caps for cards (60+8/loop, cap 150), removal (50+25/use, cap 200), reorder (15+20/use, cap 150), and relics (rarity-based + 10/loop)
- LootGenerator produces Record<string,number> material drops from terrain, enemy, and boss sources with gathering boost support
- MetaProgressionSystem deducts multi-material building costs, exposes Storehouse effects (gathering boost + death retention), and banks materials with Storehouse-aware death penalty
- RunEndResolver applies per-material death penalty (10% base) upgradeable by Storehouse level (up to 50% at tier 8)
- DifficultyScaler provides diminishing loop growth via [3,2,2,1,1] schedule with 40-tile cap

## Task Commits

Each task was committed atomically:

1. **Task 1: Rework ShopSystem with scaling prices and DifficultyScaler with loop growth** - `2dfbd8b` (feat)
2. **Task 2: Rework LootGenerator, MetaProgressionSystem, RunEndResolver for material economy** - `cd86895` (feat)

_Note: TDD tasks had combined red+green commits for efficiency_

## Files Created/Modified
- `src/systems/ShopSystem.ts` - Scaling price formulas with caps for 4 purchase types
- `src/systems/DifficultyScaler.ts` - getLoopGrowth/getLoopLength with diminishing schedule
- `src/systems/LootGenerator.ts` - rollMaterialDrops replacing rollMetaLoot
- `src/systems/MetaProgressionSystem.ts` - Multi-material costs, getStorehouseEffects, Storehouse-aware banking
- `src/systems/RunEndResolver.ts` - Per-material death penalty with Storehouse retention
- `src/systems/BossSystem.ts` - Updated to material drops and material-based resolveRunEnd
- `src/systems/LoopRunner.ts` - Diminishing loop growth via getLoopGrowth, materials economy
- `tests/systems/*.test.ts` - All 7 test files updated (78 system tests passing)

## Decisions Made
- ShopSystem keeps a local RunState interface to maintain backward compatibility with scene callers that still use the old shape -- scene updates deferred to Plan 04
- getStorehouseEffects takes the latest value per effect type from building tiers (not additive), matching how buildings.json defines effects per tier
- LoopRunner tracks bossKillCount internally (reset on startRun) to index into the diminishing growth schedule
- DifficultyConfig updated: removed loopGrowthOnBossKill, metaLootPerCombat/Loop/Boss, deathMetaLootPercent; added loopGrowth, pricing, deathMaterialPercent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated BossSystem for material economy**
- **Found during:** Task 2 (system rework)
- **Issue:** BossSystem.ts imported rollMetaLoot (removed) and used economy.metaLoot (replaced by materials)
- **Fix:** Rewrote onBossVictory to use rollMaterialDrops, getBossExitChoiceData to use material-based resolveRunEnd
- **Files modified:** src/systems/BossSystem.ts, tests/systems/BossSystem.test.ts
- **Verification:** All 5 BossSystem tests pass
- **Committed in:** cd86895

**2. [Rule 3 - Blocking] Updated LoopRunner for material economy and loop growth**
- **Found during:** Task 2 (system rework)
- **Issue:** LoopRunner.ts used economy.metaLoot and diffConfig.loopGrowthOnBossKill (both removed)
- **Fix:** Changed EconomyData to use materials, onBossChoice to use getLoopGrowth with bossKillCount tracking
- **Files modified:** src/systems/LoopRunner.ts, tests/systems/LoopRunner.test.ts
- **Verification:** All 24 LoopRunner tests pass
- **Committed in:** cd86895

**3. [Rule 1 - Bug] Fixed DifficultyScaler test expectations for percentPerLoop**
- **Found during:** Task 1 (DifficultyScaler rework)
- **Issue:** Tests expected percentPerLoop=0.10 but difficulty.json has 0.12 (changed in Plan 01)
- **Fix:** Updated test expectations to match actual config values
- **Files modified:** tests/systems/DifficultyScaler.test.ts
- **Committed in:** 2dfbd8b

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for system coherence after metaLoot removal. No scope creep.

## Issues Encountered
- Pre-existing test failures in cards.test.ts, loot-system.test.ts, combat-engine.test.ts (5 tests) from Plan 01 card data changes -- documented in deferred-items.md, not caused by this plan
- Scene/UI files (9 files) still reference metaLoot -- out of scope for system-layer plan, documented in deferred-items.md

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 core systems now use material economy with scaling prices and Storehouse effects
- Scene layer (Plan 04) can wire these systems into UI with material displays replacing metaLoot
- 78 system tests passing across all modified test files

---
*Phase: 05-balance-economy-overhaul*
*Completed: 2026-03-27*
