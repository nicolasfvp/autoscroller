---
phase: 06-content-expansion
plan: 02
subsystem: combat, economy, events
tags: [card-upgrade, boss-ai, material-effects, tdd, enemy-behaviors]

# Dependency graph
requires:
  - phase: 06-content-expansion plan 01
    provides: CardUpgrade type, BossBehavior type, EventChoiceEffect types, boss enemy data, card upgrade JSON data
provides:
  - Card upgrade system (ShopSystem.upgradeCard, CardResolver upgrade-aware resolution)
  - Boss behavioral patterns (enrage, shield, multi_hit, drain) in EnemyAI
  - Event material effects (gain_material, lose_material, upgrade_card) in EventResolver
  - minMaterial requirement checking on event choices
  - Functional add_curse effect (pushes curse to deck)
  - Weighted event selection
affects: [06-content-expansion plan 03, combat-scenes, shop-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [upgrade-aware card resolution via state.upgradedCards, boss behavior processing via behaviors array on CombatState]

key-files:
  created: [src/data/events.json (crystal_cave event)]
  modified: [src/state/RunState.ts, src/systems/ShopSystem.ts, src/systems/combat/CardResolver.ts, src/systems/combat/CombatState.ts, src/systems/combat/EnemyAI.ts, src/systems/EventResolver.ts]

key-decisions:
  - "upgradedCards tracked as string[] on DeckState, passed through CombatState for combat resolution"
  - "Boss behaviors accessed via (state as any).behaviors cast in EnemyAI to avoid CombatState interface import cycle"
  - "add_curse changed from no-op to functional (pushes curse card ID to deck.order)"
  - "crystal_cave event added to events.json for testing material effects end-to-end"

patterns-established:
  - "Upgrade resolution: check state.upgradedCards.includes(card.id) before selecting effects/cost"
  - "Boss behavior loop: getEffectiveCooldown for enrage, applyPeriodicBehaviors for shield, inline multi_hit/drain in attack()"

requirements-completed: [CONT-09, CONT-07, CONT-08]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 06 Plan 02: Card Upgrades, Boss Behaviors, and Event Material Effects Summary

**Card upgrade system wired from ShopSystem through CardResolver, boss AI behaviors (enrage/shield/multi_hit/drain) in EnemyAI, and material event effects with minMaterial requirements in EventResolver**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T04:05:37Z
- **Completed:** 2026-03-28T04:10:48Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Card upgrade system: ShopSystem.upgradeCard deducts gold, tracks in DeckState.upgradedCards, CardResolver uses upgraded effects/costs in combat
- Boss behavioral patterns: enrage (speed doubling below HP threshold), shield (periodic defense), multi_hit (split damage), drain (heal from damage)
- Event material effects: gain_material, lose_material, upgrade_card handlers with minMaterial requirement checking
- Functional add_curse effect and weighted event selection
- 24 new tests across 4 test files, 411 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Card upgrade system (RunState + ShopSystem + CardResolver)** - `56410a1` (feat)
2. **Task 2: Boss behavioral patterns in EnemyAI + event material effects in EventResolver** - `a12479c` (feat)

_Both tasks followed TDD (RED -> GREEN) workflow._

## Files Created/Modified
- `src/state/RunState.ts` - Added upgradedCards: string[] to DeckState, initialized in createNewRun
- `src/systems/ShopSystem.ts` - Added getUpgradePrice and upgradeCard static methods
- `src/systems/combat/CardResolver.ts` - Upgrade-aware resolve() and canAfford() using state.upgradedCards
- `src/systems/combat/CombatState.ts` - Added upgradedCards and behaviors fields, populated from RunState/enemy
- `src/systems/combat/EnemyAI.ts` - Boss behavior processing: enrage, shield, multi_hit, drain
- `src/systems/EventResolver.ts` - gain_material, lose_material, upgrade_card effects; minMaterial check; weighted selection; functional add_curse
- `src/data/events.json` - Added crystal_cave event with material effects
- `tests/systems/ShopSystem.test.ts` - 6 new upgrade tests
- `tests/systems/combat/card-resolver.test.ts` - 5 new upgrade resolution tests
- `tests/systems/combat/enemy-ai.test.ts` - 6 new boss behavior tests
- `tests/systems/EventResolver.test.ts` - 8 new material effect and weighted event tests

## Decisions Made
- upgradedCards tracked as string[] on DeckState, passed through CombatState for combat resolution
- Boss behaviors accessed via (state as any).behaviors cast in EnemyAI to avoid expanding CombatState import requirements
- add_curse changed from no-op (applied:false) to functional (pushes curse card ID to deck.order, applied:true)
- crystal_cave event added to events.json with weight 0.8 for testing material effects end-to-end

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed existing test asserting 5 events after adding crystal_cave**
- **Found during:** Task 2 (EventResolver tests)
- **Issue:** getAllEvents test hardcoded `toHaveLength(5)`, now 6 with crystal_cave
- **Fix:** Updated assertion to `toHaveLength(6)`
- **Files modified:** tests/systems/EventResolver.test.ts
- **Verification:** All EventResolver tests pass
- **Committed in:** a12479c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial test count update. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Card upgrade, boss behaviors, and material effects are fully wired in the systems layer
- Plan 03 (UI/scene integration) can now render upgrade UI, boss behavior visuals, and material-gated event choices
- All 411 tests pass with no regressions

---
*Phase: 06-content-expansion*
*Completed: 2026-03-28*
