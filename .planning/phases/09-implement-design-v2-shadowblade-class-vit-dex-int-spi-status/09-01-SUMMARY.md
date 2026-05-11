---
phase: 09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status
plan: 01
subsystem: testing
tags: [typescript, types, state-shape, save-migration, vitest, design-v2]

requires:
  - phase: 02-combat-deck-engine
    provides: CardEffect, SynergyDefinition, RelicTrigger base unions extended here
  - phase: 04-content-meta-progression-persistence
    provides: MetaState v5 baseline + SaveManager skeleton extended here
provides:
  - StatId / StackId vocabulary (VIT/DEX/INT/SPI + 7 stack identifiers)
  - HeroState.vitality/dexterity/intelligence/spirit + statDeltas
  - ClassDefinition.stats (Warrior/Mage retrofit; Shadowblade slot opened in Plan 3)
  - HeroStatsResolver (per-stat derived getter; consumed by Plan 3 mechanics)
  - CombatState transient fields (comboPoints, isStealthed, stackBuckets, arcaneStacks)
  - MetaState v6 + SaveManager incompatible-save guard (D-06 full wipe)
  - Wave 0 test scaffolds: content totals, RPU validator, mechanic placeholders, save-migration
affects: [phase-09, content, mechanics, ui, future-classes, save-format]

tech-stack:
  added: []  # nanoid already pinned; no new deps
  patterns:
    - "Discriminated union extensions on CardEffect / SynergyDefinition.bonus / RelicTrigger gated by Plan 3"
    - "Per-stat resolver pattern (base + class deltas + run deltas + combat buffs) via HeroStatsResolver"
    - "Save-version forward wipe (D-06): incompatible saves cleared on load with explicit user notice copy"

key-files:
  created:
    - src/systems/hero/HeroStatsResolver.ts
    - tests/state/run-state-deltas.test.ts
    - tests/state/save-migration.test.ts
    - tests/content/rpu.test.ts
    - tests/systems/combat/shadowblade-mechanics.test.ts
  modified:
    - src/data/types.ts
    - src/state/RunState.ts
    - src/state/MetaState.ts
    - src/core/SaveManager.ts
    - src/systems/combat/CombatState.ts
    - src/systems/hero/ClassRegistry.ts
    - src/systems/hero/WarriorClass.ts
    - src/systems/hero/MageClass.ts
    - tests/content/content.test.ts
    - tests/state/MetaMigration.test.ts
    - tests/core/savemanager.test.ts
    - tests/state/meta-migration.test.ts
    - tests/state/runstate.test.ts
    - tests/systems/combat/balance-validation.test.ts
    - tests/systems/combat/card-resolver.test.ts
    - tests/systems/combat/combat-engine.test.ts
    - tests/systems/combat/combat-state.test.ts
    - tests/systems/combat/enemy-ai.test.ts
    - tests/systems/deck/deck-system.test.ts
    - tests/systems/hero/passive-skills.test.ts
    - tests/systems/hero/xp-system.test.ts

key-decisions:
  - "MetaState wipe is v3/v4/v5 -> v6 (codebase already at v5), applying D-06 intent to current reality rather than the plan's literal v3->v4"
  - "RUN_STATE_VERSION bumped 3 -> 4 (was already at 3 from Phase 4), not 2 -> 3 as plan said"
  - "Backfilled 8 pre-existing test mocks (Pitfall 2 prevention) to keep typecheck at the pre-existing 24-error baseline"
  - "Updated existing meta-migration assertions that asserted preservation semantics now invalid per D-06 (full wipe)"

patterns-established:
  - "Pattern 1: Per-stat resolver — base class stat + run-scoped statDeltas + transient combat buffs computed per-read, never mutated in place"
  - "Pattern 2: Save-version mismatch is a hard wipe + user-facing notice (D-06), not a transparent migration — keeps phase-9 schema risk contained"

requirements-completed:
  - D-02
  - D-06
  - D-07
  - D-12

duration: ~80min
completed: 2026-05-11
---

# Phase 09 — Plan 01 Summary

**Type system + state shape + save migration + Wave 0 test harness — the load-bearing foundation that gates Plans 2 (content), 3 (mechanics), and 4 (UI).**

## Performance

- **Duration:** ~80 min
- **Completed:** 2026-05-11
- **Tasks:** 5/5
- **Files created:** 5
- **Files modified:** 21 (8 source, 13 tests)

## Accomplishments
- Extended type system with StatId / StackId vocabulary and schema unions for the 5 new SynergyDefinition.bonus types and 7 new RelicTrigger handlers landing in Plan 3.
- Reshaped HeroState (VIT/DEX/INT/SPI + statDeltas) and ClassDefinition (typed stats). Warrior + Mage retrofitted; Shadowblade class slot opened for Plan 3.
- Added CombatState transient fields for Phase 9 mechanics: comboPoints, isStealthed, stackBuckets per StackId, arcaneStacks.
- MetaState v3/v4/v5 → v6 full save wipe (D-06) wired through SaveManager with incompatible-save notice copy hook.
- Installed Wave 0 test harness: content totals + RPU validator are RED until Plan 2; mechanic scaffolds are todo until Plan 3; save-migration tests pass green now.

## Task Commits

1. **Task 1: Extend type system for Design v2** — `f917555` (feat)
2. **Task 2: Extend HeroState + ClassDef with VIT/DEX/INT/SPI axes + statDeltas** — `d0f47d6` (feat)
3. **Task 3: Extend CombatState with Phase 9 transient fields** — `c8f74f8` (feat)
4. **Task 4: MetaState v3/v4/v5 -> v6 full save wipe + SaveManager guard** — `993f851` (feat)
5. **Task 5: Wave 0 test harness — content totals, RPU validator, mechanic scaffolds** — `503fbe2` (test)

## Files Created/Modified

**Created:**
- `src/systems/hero/HeroStatsResolver.ts` — per-stat derived getter
- `tests/content/rpu.test.ts` — Risk-Per-Unit validator harness (RED until Plan 2 content lands)
- `tests/state/run-state-deltas.test.ts` — statDeltas mutation semantics
- `tests/state/save-migration.test.ts` — v3/v4/v5 → v6 wipe path
- `tests/systems/combat/shadowblade-mechanics.test.ts` — combo / stealth / poison placeholders (todo until Plan 3)

**Modified (source):** see frontmatter `key-files.modified`.

## Decisions Made
- **MetaState target version v6, not v4:** codebase was already at v5 from Phase 7; applied D-06 wipe semantics to current reality.
- **RUN_STATE_VERSION 3 → 4:** plan said 2 → 3; codebase was already at 3.
- **Pre-existing test mocks backfilled (Pitfall 2):** kept typecheck at pre-existing 24-error baseline rather than introducing new errors.
- **Meta-migration preservation tests inverted:** D-06 wipe makes previous preservation semantics invalid; assertions updated to expect wipe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan-vs-reality version drift] Save versions higher than plan assumed**
- **Found during:** Task 4 (MetaState wipe migration)
- **Issue:** Plan said v3 → v4. Repo already at MetaState v5 / RUN_STATE_VERSION 3 from Phases 4 and 7.
- **Fix:** Targeted v3/v4/v5 → v6 (MetaState) and 3 → 4 (RunState) so all stale saves wipe correctly.
- **Files modified:** `src/state/MetaState.ts`, `src/state/RunState.ts`, `src/core/SaveManager.ts`, related migration tests.
- **Verification:** save-migration.test.ts green; existing MetaMigration.test.ts updated to assert wipe instead of preserve.
- **Committed in:** `993f851`

**2. [Plan-vs-reality dependency state] nanoid already pinned**
- **Found during:** Task 1 (type system extensions)
- **Issue:** Plan's "install nanoid" step was a no-op.
- **Fix:** Skipped install; verified package.json already has the pin.
- **Files modified:** none.
- **Verification:** typecheck passes for new ID generation paths.

**3. [Pre-existing test debt] 8 mocks needed backfill to compile under new HeroState/ClassDefinition shapes**
- **Found during:** Task 2 + Task 5
- **Issue:** Tests written before Phase 9 used the old HeroState shape; adding the 4 stat axes broke their mocks.
- **Fix:** Backfilled mocks with default stat values (`vitality: 10, dexterity: 10, intelligence: 10, spirit: 10`) and empty `statDeltas: {}` to match retrofit defaults.
- **Files modified:** 8 test files under `tests/` (see `key-files.modified`).
- **Verification:** typecheck stayed at the pre-existing 24-error baseline (no new errors introduced).

---

**Total deviations:** 3 auto-fixed (2 plan-vs-reality drift, 1 pre-existing test debt)
**Impact on plan:** All auto-fixes necessary to land the plan's intent on the current repo state. No scope creep.

## Issues Encountered

- **SUMMARY.md was created in the worktree but never committed before the worktree was reaped.** Orchestrator reconstructed this file from the executor's final-message report. No code lost; the 5 task commits all merged back cleanly. (Process gap, not a code issue.)

## Next Phase Readiness

- **Plan 2 (content) unblocked:** content totals + RPU validator harness in place. Tests are RED — they will go green as the 5 content subagents populate `cards.json` / `relics.json` / `synergies.json`.
- **Plan 3 (mechanics) unblocked:** schema unions for new bonus / trigger types in place. CombatState has the transient fields. HeroStatsResolver ready to plug into combat math.
- **Plan 4 (UI) unblocked:** statDeltas + comboPoints + isStealthed fields exist on state, so HUD components can subscribe.
- **Save format gate:** any existing v3/v4/v5 save will wipe on next load with the user-facing notice. Plan 4 needs to wire the actual MainMenu copy.

## Verification at Plan Close

- **Typecheck:** 24 errors (pre-existing baseline; no new errors introduced by this plan).
- **Tests:** 67/67 Phase-9-relevant pass. Wave 0 RPU + content-totals tests are RED (expected — gate for Plan 2). Shadowblade mechanics tests are `todo` placeholders (gate for Plan 3).

---
*Phase: 09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status*
*Plan: 01*
*Completed: 2026-05-11*
