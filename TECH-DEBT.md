# Tech Debt — Tracking Doc

Items below are real issues that are *not* blocking but deserve a focused follow-up.
Each entry has a category, the source that flagged it, the affected files/lines, and the
specific work needed to close it. Sorted within each section so a future cleanup phase
can grab them in batches.

Last refreshed: 2026-05-12, after Phase 9 (Design v2) merge.

---

## 1. Test fixture debt from D-05 wholesale content replacement (Phase 9)

Phase 9's D-05 replaced 100% of v1 content (cards, relics, synergies, IDs) with the v2
design. Several test files were not rewritten and continue to assert v1 invariants that
no longer hold. These are **fixture debt, not behavior regressions** — the code is
correct; the assertions are stale.

**Failure count:** 16 tests across 4 files.

| File | Failing tests | What it asserts (now stale) |
|---|---|---|
| `tests/data/cards.test.ts` | 1 | "original cards retain expected cooldown values" — references v1 card IDs and cooldown numbers (e.g. `strike.cooldown === 2.0`) that don't exist in `src/data/json/cards.json` anymore. |
| `tests/systems/CollectionRegistry.test.ts` | 5 | `getCollectionStatus().cards.total === 30` and `relics.total === 15`. Phase 9 ships 125 cards / 50 relics. Tests need totals lifted plus updated unlock-source assertions. |
| `tests/systems/UnlockManager.test.ts` | 6 | `getAvailableCards()` and `getAvailableRelics()` return shapes containing v1 IDs like `fury` and `warrior_spirit`. None of those IDs are in the v2 content; tests need new representative IDs from the v2 lists. |
| `tests/systems/combat/balance-validation.test.ts` | 4 | Specific fight-duration ranges (e.g. "starter deck vs loop 1 Slime finishes in 15-36s"). Targets were calibrated against the v1 starter deck; the v2 starter decks have different cards, cooldowns, and damage profiles. Either re-derive the ranges from a v2 sim or skip these until the post-09 balance pass closes WR-03/WR-04. |

**Suggested work order**

1. `cards.test.ts` — fastest: pick three representative v2 card IDs and copy their cooldown values out of `cards.json`. ~15 min.
2. `UnlockManager.test.ts` — replace `'fury'` / `'warrior_spirit'` with two v2 IDs that have `unlockSource` set, and one each that doesn't. ~30 min.
3. `CollectionRegistry.test.ts` — same pattern as UnlockManager + bump the `30`/`15` literal totals to `125`/`50`. ~30 min.
4. `balance-validation.test.ts` — needs design judgment. Best paired with the WR-04 burn-DoT balance pass (see §3). Likely 1-2 hr including a fresh sim run.

---

## 2. Pre-existing test debt (predates Phase 9)

These failures were already in the suite before Phase 9 was authored. Plan 09-03's
SUMMARY explicitly flagged them and chose not to absorb the cleanup. They are *not*
caused by anything Phase 9 did.

**Failure count:** 12 tests in 1 file.

| File | Failing tests | Root cause |
|---|---|---|
| `tests/systems/combat/combat-engine.test.ts` | 12 (all "CombatEngine > …" cases) | Test mocks construct a `CombatEngine` without calling `setRun()` first. After a Phase-4-era refactor, `CombatEngine` requires a `RunState` reference to resolve hero stats; uninstantiated mocks dereference `null` inside `executeCard`. Pitfall 2 in 09-03-PLAN.md called this out. |

**Fix**

Add a shared mock helper that returns a configured `CombatEngine` with `setRun(makeMinimalRunState())` pre-invoked. Update each of the 12 tests to start from that helper. Mostly mechanical. ~1-2 hr.

---

## 3. Code review deferred items (Phase 9)

The Phase 9 code review (`.planning/phases/09-.../09-REVIEW.md`) found 15 issues. All
**Critical (2) and Warning (7)** were auto-fixed in atomic commits `c511392..525dd65`.
The 6 **Info-level** findings were deferred and remain open.

### IN-01 — Cache last-applied stat values in LoopHUD

- **File:** `src/ui/LoopHUD.ts:245-263` (`applyStatTween`)
- **Issue:** Every `LoopHUD.update()` parses `parseInt(txt.text, 10)` four times to compare against the new value. String round-trip is unnecessary in a hot path.
- **Fix:** Add `private lastStats: StatusRowData` member, compare against it, skip parse.
- **Effort:** ~15 min

### IN-02 — Clean up `applyStatDelta` assignment-inside-`??` idiom

- **File:** `src/state/RunState.ts:366-368`
- **Issue:** `const d = run.hero.statDeltas ?? (run.hero.statDeltas = {});` — works but reads awkwardly and trips linters. Migration already backfills `statDeltas`, so the runtime fallback is redundant.
- **Fix:** Replace with explicit `if (!run.hero.statDeltas) run.hero.statDeltas = {};` line.
- **Effort:** ~5 min

### IN-03 — Use returned `startX` directly in CharacterSelectScene

- **File:** `src/scenes/CharacterSelectScene.ts:54-58`
- **Issue:** `computeCardLayout()` returns `startX`; caller ignores it and re-derives the same value.
- **Fix:** Destructure `startX` from `layout` and drop the local recomputation.
- **Effort:** ~5 min

### IN-04 — Drop dead `!migrated.version` branch in SaveManager.load

- **File:** `src/core/SaveManager.ts:59`
- **Issue:** `migrateRunState` always sets `raw.version`, so the `!migrated.version` half of the wipe condition is unreachable.
- **Fix:** Remove that half of the condition.
- **Effort:** ~5 min

### IN-05 — Remove empty Shadowblade branch in `tickActiveDoTs`

- **File:** `src/systems/combat/CombatEngine.ts:361-366`
- **Issue:** Conditional body is a comment only. Either delete the branch or mark it `// TODO(phase 10)`.
- **Fix:** Decision: delete now, re-add when a real hook lands.
- **Effort:** ~5 min

### IN-06 — Bone material icon shares stone PNG

- **File:** `src/scenes/Preloader.ts:137`
- **Issue:** `this.load.image('mat_bone', 'assets/icons/stone.png');` — placeholder reuses the stone icon.
- **Fix:** Add `// TODO(art): bone icon placeholder (uses stone art)` so it isn't lost when authentic art is generated.
- **Effort:** ~2 min

---

## 4. Mechanics flagged for balance pass

Two warning-level fixes from the Phase 9 code review are structurally correct but
shifted player-facing numbers. They should be re-validated by a designer before any
human-facing copy or tuning work locks them in.

### WR-03 — Rest Site "train" choice (now upgrades a card)

- **Commit:** `f38a073` `fix(09): WR-03 — Rest Site "train" flips upgrade flag`
- **What changed:** Previously the "train" rest option returned descriptive text but never mutated state. The fix makes it actually flip the upgrade flag on a random card in the active deck.
- **Open question:** Is "free upgrade at rest site" balanced vs. the other rest choices (`rest` = full heal, `heal` = partial heal + buff)? Probably needs a tuning knob — maybe gold cost or limited charges. The player-facing copy may also want a rewrite ("Upgraded {card}.").
- **Owner:** Design.

### WR-04 — Burn DoT now scales per-stack with INT

- **Commit:** `c3d8029` `fix(09): WR-04 — burn DoT per-stack INT scaling`
- **What changed:** Formula moved from `burnStacks + floor(INT/2)` (flat additive INT bonus) to `burnStacks * (1 + floor(INT/2))` (multiplicative, parallels poison's DEX scaling).
- **Open question:** At high INT, burn output now scales much more aggressively. Compare to poison output at equivalent DEX in the v2 starter sims; tune the divisor (e.g. `floor(INT/4)` if too hot) if needed.
- **Owner:** Design + balance-validation suite (see §1 row 4).

---

## Status snapshot at the time of writing

- Total open items: **30** (16 stale fixtures, 12 pre-existing, 6 code-review info, 2 design-flagged)
- None are behavior regressions
- Typecheck baseline: 24 errors (pre-Phase-9 baseline, zero introduced by Phase 9)
- All Critical + Warning code review findings: closed in `feat/phase-09-design-v2`
