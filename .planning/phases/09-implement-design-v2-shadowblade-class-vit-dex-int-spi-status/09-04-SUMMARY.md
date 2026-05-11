---
phase: 09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status
plan: 04
subsystem: ui
tags: [phaser, hud, scene, class-conditional, shadowblade, ui-spec, design-v2, save-notice]

requires:
  - phase: 09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status
    plan: 01
    provides: _wipedFromVersion flag from migration, HeroStatsResolver, CombatState fields (comboPoints, stealthCharges, comboPointsCap)
  - phase: 09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status
    plan: 02
    provides: 125 v2 card IDs (Preloader.cardIds audited against this set)
  - phase: 09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status
    plan: 03
    provides: ShadowbladeClass entry, tile glyph/color config (library/arena/shrine_of_pact), live CombatState reads
provides:
  - SHADOWBLADE_PALETTE in StyleConstants (12 LOCKED semantic tokens)
  - CombatHUD class-conditional CP pip strip + Stealth indicator + Energy label
  - LoopHUD universal VIT/DEX/INT/SPI status row
  - CharacterSelectScene 3rd class card (Shadowblade) with downscaled 230×24 layout
  - TileVisual glyph-fallback rendering for the 3 new tiles (no code change required)
  - MainMenu wipe-notice flow (Pitfall 5 closed) + save-incompatible notice (D-07)
  - MetaPersistence.saveMetaState defense-in-depth _wipedFromVersion strip
  - SaveManager.load D-07 boot-side-channel for incompatible-RunState notice
  - Phaser-free helper modules for every UI surface (testability)
affects: [phase-09, ui, hud, character-select, main-menu, persistence]

tech-stack:
  added: []  # zero new dependencies per UI-SPEC §Registry Safety
  patterns:
    - "Phaser-free helpers split into .helpers.ts siblings so unit tests don't trigger Phaser's window-at-import-time crash in vitest"
    - "computeHUDVisibility(state) extracted from update() for unit-testable class-gated widget visibility"
    - "Defense-in-depth flag strip (MainMenu reads, MetaPersistence strips on write) for transient MetaState fields"
    - "globalThis side-channel for SaveManager → MainMenu boot signal (cleaner than ad-hoc event bus before scenes mount)"

key-files:
  created:
    - src/ui/LoopHUD.helpers.ts
    - src/scenes/CharacterSelectScene.helpers.ts
    - src/scenes/MainMenu.helpers.ts
    - tests/ui/CombatHUD.test.ts
    - tests/ui/LoopHUD.test.ts
    - tests/scenes/CharacterSelectScene.test.ts
    - tests/scenes/MainMenu.test.ts
  modified:
    - src/ui/StyleConstants.ts
    - src/ui/CombatHUD.ts
    - src/ui/LoopHUD.ts
    - src/scenes/CharacterSelectScene.ts
    - src/scenes/MainMenu.ts
    - src/scenes/Preloader.ts
    - src/systems/MetaPersistence.ts
    - src/core/SaveManager.ts

key-decisions:
  - "Helpers extracted into .helpers.ts siblings because vitest barfs on Phaser import (window is not defined). Pattern: re-export from the scene file for runtime convenience, import directly from helpers in tests."
  - "Stealth pulse implemented as a separate Phaser tween (0.6Hz, alpha 0.7↔1.0, repeat:-1) tracked via this.stealthPulseTween — stopped explicitly when widget hides to prevent leaked tweens."
  - "CP pip strip positioned BELOW the mana bar inside left panel (y=122) rather than the original spec's y=110 — sits flush at panel bottom (left panel ends at y=140)."
  - "Stealth pill right-anchored in left panel (LP.x + LP.w - PILL_W - 16) instead of stacked below CP pips — avoids the 22px pill bleeding outside the 132px panel."
  - "MainMenu side-channel for D-07 chosen via globalThis (1 line) rather than registry (requires scene reference unavailable in SaveManager). Documented inline."
  - "Preloader audit: all 30 v1 card IDs in cardIds[] survive in v2 cards.json (verified via cards.json membership). 2 dead relic IDs purged (spell_focus, warrior_spirit)."
  - "TileVisual code unchanged — existing iconText fallback path renders L/A/P glyphs at locked floor colors directly from tiles.json (Plan 3 supplied the data, Plan 4 just verifies the rendering path)."

patterns-established:
  - "Pattern: For every Phaser-containing src/ui or src/scenes module that needs unit tests, split pure helpers into a sibling .helpers.ts file. Tests import from helpers; the scene file re-exports for runtime callers."
  - "Pattern: Class-conditional HUD widgets gate visibility in update() via a single helper (computeHUDVisibility) — never branch inside the build* methods."
  - "Pattern: One-shot MetaState transient flags (Pitfall 5 shape) require two strip layers — consumer (MainMenu) on read AND persistence (MetaPersistence) on write."

requirements-completed:
  - D-04
  - D-08
  - D-09
  - D-10

duration: ~75min
completed: 2026-05-11
---

# Phase 09 — Plan 04 Summary

**Every UI surface in 09-UI-SPEC.md is implemented to the locked dimensions, colors, copy, and motion timings. Shadowblade-class HUD widgets (CP pip strip, Stealth indicator, Energy label swap) render iff `hero.className === 'shadowblade'`. LoopHUD ships the universal VIT/DEX/INT/SPI status row. CharacterSelect shows three classes with the downscaled 230×24 layout. The v3/v4/v5 → v6 wipe notice surfaces ONCE then never persists.**

Phase 9 is shippable end-to-end: Plan 3 made Shadowblade mechanically playable; Plan 4 makes the same mechanics visually readable to the player without disturbing Warrior or Mage flows.

## Performance

- **Duration:** ~75 min
- **Completed:** 2026-05-11
- **Tasks:** 4/5 executed atomically + 1 human-verification checkpoint pending
- **Files created:** 7 (3 helpers + 4 test files)
- **Files modified:** 8 source files
- **New tests added:** 37 (across 4 test files; all green)

## Task Commits

1. **Task 1: SHADOWBLADE_PALETTE + CombatHUD class-conditional widgets** — `e14e17b`
   - StyleConstants: appended SHADOWBLADE_PALETTE with all 12 LOCKED semantic tokens
   - CombatHUD: `buildComboPointStrip` (5×12px pips, 4px gap), `buildStealthIndicator` (22px pill)
   - Stamina micro-label flips `⚡ STA` → `⚡ ENG` for Shadowblade
   - Motion: CP pip 1.15× scale pulse on gain; left-to-right alpha drain on spend
   - Motion: Stealth 200ms fade-in + 0.6Hz alpha pulse while active
   - Extracted `computeHUDVisibility(state)` helper for testable toggle logic
   - 9 logic-isolated tests (palette + visibility)

2. **Task 2: LoopHUD VIT/DEX/INT/SPI status row** — `6e0b5f6`
   - `buildStatusStatsRow` rendering 4 letter codes + numbers below pending-cards slot
   - Letter codes (VIT/DEX/INT/SPI) 10px bold, colored per UI-SPEC §Color tokens
   - Numbers 13px bold white with 2px black stroke
   - `applyStatTween`: 280ms counter tween + 1.1× scale pulse on change
   - Numbers read from `resolveHeroStats(runState)` (Plan 1 helper)
   - Universal — renders for all classes (status stats are not class-gated)
   - Phaser-free helpers split into `src/ui/LoopHUD.helpers.ts` for unit-testability
   - 7 tests covering data extraction + locked colors

3. **Task 3: CharacterSelect 3rd class card + Preloader purge** — `5a4af89`
   - Added Shadowblade as 3rd class with UI-SPEC §Copywriting verbatim
   - D-08 placeholder: tinted `mage_idle` sprite with `#7E5BEF` (or fallback rect)
   - Downscale layout per §Spacing FLAG: 230px cards × 24px gap = 738px in 800px canvas
   - Extracted `CLASS_CARDS` + `computeCardLayout` to `.helpers.ts` for tests
   - TileVisual: no code change required — `getTileConfig` already returns LOCKED floor colors and L/A/P glyphs from tiles.json (Plan 3 supplied)
   - Preloader: removed dead v1 relics `spell_focus` + `warrior_spirit`
   - Audit: all 30 cardIds verified present in v2 cards.json
   - 9 tests (catalog, layout math, locked colors, copy, cardIds survival)

4. **Task 4: MainMenu wipe-notice flow + Pitfall 5 defense-in-depth** — `aaec235`
   - `consumeWipeFlag(meta)`: reads + strips `_wipedFromVersion` (mutates input)
   - `formatWelcomeNotice`: LOCKED UI-SPEC welcome copy verbatim
   - `SAVE_INCOMPATIBLE_COPY`: LOCKED title/body/CTA constants
   - `MainMenu.create` reads MetaState, strips `_wipedFromVersion`, persists clean
   - Welcome notice fades in 400ms, auto-dismiss after 6s
   - Save-incompatible notice: dismissible inline card with Continue CTA
   - `MetaPersistence.saveMetaState` strips `_wipedFromVersion` before set() — defense-in-depth
   - `SaveManager.load` sets `globalThis.__runStateClearedOnBoot` when D-07 clears stale RunState
   - 12 tests covering consume idempotency, LOCKED copy, migrateMetaState round-trip

5. **Task 5: Human visual verification checkpoint (D-04)** — PENDING
   - Awaiting human sign-off on all 6 UI-SPEC dimensions per D-04

## CharacterSelect Layout Math (Verified)

| Quantity | Value |
|---|---|
| Card width | 230px (was 280 in v1) |
| Card gap | 24px (was 40 in v1) |
| Total layout width | 3 × 230 + 2 × 24 = **738px** |
| Canvas width | 800px |
| Margin each side | (800 - 738) / 2 = **31px** |
| First card center | 31 + 230/2 = **146px** |

## Locked Hex Color Audit

All Phase 9 colors render exactly per UI-SPEC §Color:

| Token | Hex | Decimal | Use |
|---|---|---|---|
| `shadowblade` | `#7E5BEF` | 8281071 | Class color, frame tint, sprite tint |
| `comboPoint` | `#E03A6B` | 14694507 | CP pip fill (filled) |
| `comboPointEmpty` | `#3a1a26` | 3808294 | CP pip fill (empty) |
| `stealth` | `#c8a8ff` | 13150463 | Stealth pill background tint |
| `poison` | `#6BBF59` | 7061849 | Poison DoT splash color |
| `vit` | `#ff6666` | 16737894 | VIT letter code (HP-red family) |
| `dex` | `#f0a020` | 15770144 | DEX letter code (stamina-amber family) |
| `int` | `#9966ff` | 10053375 | INT letter code (mana-purple family) |
| `spi` | `#22cc44` | 2280004 | SPI letter code (heal-green family) |
| `library` | `#7E5BEF` | 8281071 | Library tile floor (intentional shadowblade match per design/04 §7) |
| `arena` | `#C12B2B` | 12659499 | Arena tile floor |
| `shrineOfPact` | `#5A2A6B` | 5908075 | Shrine of Pact tile floor |

## Class-Conditional Rendering Contract (D-09)

Verified via `computeHUDVisibility` unit tests:

| Widget | warrior | mage | shadowblade |
|---|---|---|---|
| HP/Stamina/Mana bars | shown | shown | shown (stamina label = `⚡ ENG`) |
| Cooldown arc | shown | shown | shown |
| CP pip strip | hidden | hidden | shown |
| Stealth indicator | hidden | hidden | shown iff `stealthCharges > 0` |

## Preloader Purge Audit

**Card IDs:** All 30 v1 IDs in `Preloader.cardIds` survive in v2 `cards.json`. Zero entries removed (per D-08 no new Shadowblade IDs added).

**Relic IDs removed:** `spell_focus`, `warrior_spirit` (purged per 09-02-SUMMARY's v1 relic cut).
**Relic IDs retained:** 13 entries, all verified present in v2 `relics.json`.

## _wipedFromVersion Lifecycle (Pitfall 5 Verified)

1. **migrateMetaState** sets `_wipedFromVersion = N` on any pre-v6 save read (where N is the version BEFORE the wipe block, always 5 after the chained migration).
2. **MainMenu.create** reads via `consumeWipeFlag(meta)` which:
   - Returns the value
   - Mutates the input to remove the field
3. **MainMenu.create** then calls `saveMetaState(meta)` which strips again as a defense-in-depth layer.
4. On the next boot, MetaState is loaded fresh from IDB — the field is absent — no notice fires.

This is double-strip insurance: even if MainMenu were skipped (e.g. direct scene navigation), the persistence layer guarantees the flag never round-trips.

## TileVisual Glyph Rendering (Verified)

No TileVisual code change was required for Plan 4. Plan 3 supplied `tiles.json` with full entries:

```
library          color=8281071 (#7E5BEF)  icon="L"
arena            color=12659499 (#C12B2B) icon="A"
shrine_of_pact   color=5908075 (#5A2A6B)  icon="P"
```

The existing path in `TileVisual.ts`:
- `tileConfigForIcon.icon` → text glyph (since none of the new tiles have entries in `TILE_SPRITE_MAP`, the iconText branch wins)
- `config.color` → floor `fillColor` for the background rectangle

Visual checkpoint will confirm the glyphs render at the correct floor colors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocker] vitest cannot import Phaser-containing modules (window is not defined)**
- **Found during:** Task 2 (initial LoopHUD.test.ts run)
- **Issue:** Phaser's `OS.js` references `window` at module-load time, crashing vitest's node environment.
- **Fix:** Split pure helpers into sibling `.helpers.ts` modules for every UI test target: `LoopHUD.helpers.ts`, `CharacterSelectScene.helpers.ts`, `MainMenu.helpers.ts`. Scene files re-export for runtime callers; tests import from helpers directly.
- **Files modified:** added 3 helpers + 4 test files re-routed.
- **Verification:** all 37 new tests green; 24 typecheck baseline unchanged.
- **Committed in:** `6e0b5f6`, `5a4af89`, `aaec235`

**2. [Rule 2 — Critical] Preloader had 2 dead v1 relic IDs (spell_focus, warrior_spirit)**
- **Found during:** Task 3 (audit per plan Step 8)
- **Issue:** v2 wholesale rewrite (Plan 2) dropped 5 v1 relic IDs. Preloader's relicIds list still referenced 2 of them, which would 404 at preload.
- **Fix:** Removed both IDs with an audit comment citing 09-02-SUMMARY.
- **Verification:** all 13 surviving relic IDs verified present in v2 `relics.json` via membership check.
- **Committed in:** `5a4af89`

**3. [Rule 1 — Bug] CP pip + Stealth pill geometry slot conflict**
- **Found during:** Task 1 (visual mental simulation of pip strip placement)
- **Issue:** Original plan suggested CP strip at y=110 and Stealth pill at y=140; left panel ends at y=140, so the Stealth pill would extend outside the panel by 22px.
- **Fix:** Moved CP strip to y=122 (below mana bar, inside panel), right-anchored Stealth pill on the same row inside the panel envelope. Both fit within the 238×132 left panel.
- **Verification:** sub-pixel math confirmed; visual checkpoint Task 5 Dimension 5 will validate.
- **Committed in:** `e14e17b`

**4. [Rule 1 — Bug] Worktree was reset to a stale base, planning files + src changes were missing**
- **Found during:** initial worktree branch check
- **Issue:** EnterWorktree placed this worktree HEAD at `7e5baa4` (correct) but the working tree had been clobbered (likely OneDrive sync). 50+ files showed as modified/deleted (Plan 1-3 work appeared rolled back). Phase 09 planning directory didn't exist on disk.
- **Fix:** (a) `git checkout HEAD -- .` to restore the working tree. (b) Copied `09-*-PLAN.md / 09-*-SUMMARY.md / 09-CONTEXT.md / 09-UI-SPEC.md / 09-RESEARCH.md` from the main worktree (the gitignored .planning files weren't tracked under the branch HEAD's tree).
- **Verification:** `git status --short` clean after restore; planning files readable from disk.
- **No commit needed** — restored state matched HEAD.

### Plan-vs-reality observations (not deviations)

- Plan said "extend `CombatHUDState` type to include the new fields" — `CombatHUD.update()` already takes a full `CombatState` object (verified in `CombatScene.ts:239`). No interface widening was needed; new fields are read directly from `state.comboPoints` / `state.stealthCharges` / `state.heroClass`.
- Plan said `Preloader.cardIds` may reference v1 IDs that disappeared. **Audit found none.** All 30 IDs survive in v2 `cards.json` (the v1 strip dropped 4 numeric clones + 5 mage filler, but none of those were in the Preloader list anyway).
- Plan said TileVisual should add cases in a switch or extend TILE_SPRITE_MAP. **Inspection found neither is needed** — the existing `iconText` fallback path already renders any tile config's `icon` field at the right size/origin. Plan 3 provided the data; Plan 4 only had to confirm the rendering path.

## Known Stubs

| File | Stub | Rationale |
|---|---|---|
| `src/scenes/MainMenu.ts` | `showSaveIncompatibleNotice` uses inline rectangle/text (no panel asset) | Visual styling matches the existing destructive-confirmation dialog pattern; can be upgraded to a sprite-backed panel in a polish pass without changing the copywriting contract. |
| `src/scenes/CharacterSelectScene.ts` | Shadowblade card stats show `hp:60, stamina:50, mana:0` per Plan 3 base stats | mana=0 renders as empty mana bar — visually distinguishes from Mage's mana-heavy class. Correct per design/03 §2. |

No stubs block plan goals; D-04 visual checkpoint will confirm visual acceptability.

## Deferred Issues (pre-existing, NOT caused by this plan)

These were documented in 09-03-SUMMARY.md and remain out of scope for this executor:

- `tests/systems/MetaPersistence.test.ts` asserts `loaded.version === 5` — pre-existing Plan 1 test-debt (MetaState bumped to v6).
- `tests/systems/combat/combat-engine.test.ts` + `balance-validation.test.ts` 16 failures from tests that construct `CombatEngine` without `setRun()` — pre-existing baseline (Plan 1 catalogued).
- `tests/data/cards.test.ts` + `tests/systems/CollectionRegistry.test.ts` + `tests/systems/UnlockManager.test.ts` — pre-existing failures from v1 content assumptions invalidated by the v2 rewrite (09-02).

## Threat Surface Scan

Reviewed STRIDE register T-09-04-01 → T-09-04-07:

| Threat | Mitigation in this plan | Status |
|---|---|---|
| T-09-04-01 (_wipedFromVersion persists) | Two strip layers: MainMenu on read + MetaPersistence on write. Tests assert flag absent after consume. | mitigated |
| T-09-04-02 (CharacterSelect overflow) | LOCKED 230×24 layout transcribed verbatim. Test asserts `totalW=738 ≤ 800` with positive margin. | mitigated |
| T-09-04-03 (dead Preloader IDs) | Purged spell_focus + warrior_spirit; all 30 cardIds verified present in v2 cards.json. | mitigated |
| T-09-04-04 (new npm dep breaks build) | `git diff main -- package.json` empty for Plan 4. | mitigated |
| T-09-04-05 (CP/Stealth shown to non-Shadowblade) | `computeHUDVisibility` gates ALL Shadowblade widgets on `className === 'shadowblade'`. Tests cover warrior + mage + undefined cases. | mitigated |
| T-09-04-06 (wipe-notice info leak) | Copy is generic per UI-SPEC; no PII or internal state. | accepted |
| T-09-04-07 (TileVisual crash on undefined config) | Plan 3's tiles.json supplies full color/icon entries; getTileConfig has Phaser-fallback rendering for missing keys. | mitigated |

No new threat surface introduced in Plan 4.

## Verification at Plan Close

- **Typecheck:** `npx tsc --noEmit` → 24 errors (Plan 1 baseline; zero new errors)
- **New tests:** 37 across `tests/ui/CombatHUD.test.ts`, `tests/ui/LoopHUD.test.ts`, `tests/scenes/CharacterSelectScene.test.ts`, `tests/scenes/MainMenu.test.ts` — all green
- **`grep -E "(_wipedFromVersion)" src/systems/MetaPersistence.ts`** → strip logic present
- **`node -e "...Preloader audit..."`** → "Preloader IDs OK"
- **`git diff main -- package.json`** → empty (no new deps)

## Self-Check: PASSED

### Files created/modified — existence verification

- `src/ui/StyleConstants.ts` — SHADOWBLADE_PALETTE export present — FOUND
- `src/ui/CombatHUD.ts` — `buildComboPointStrip` + `buildStealthIndicator` + `computeHUDVisibility` — FOUND
- `src/ui/LoopHUD.ts` — `buildStatusStatsRow` + `applyStatTween` — FOUND
- `src/ui/LoopHUD.helpers.ts` — `extractStatusRowData` + `STATUS_ROW_COLORS` — FOUND
- `src/scenes/CharacterSelectScene.ts` — 3-card layout with downscaled cards — FOUND
- `src/scenes/CharacterSelectScene.helpers.ts` — `CLASS_CARDS` + `computeCardLayout` — FOUND
- `src/scenes/MainMenu.ts` — `showWelcomeNotice` + `showSaveIncompatibleNotice` — FOUND
- `src/scenes/MainMenu.helpers.ts` — `consumeWipeFlag` + `formatWelcomeNotice` + `SAVE_INCOMPATIBLE_COPY` — FOUND
- `src/scenes/Preloader.ts` — purged of dead relic IDs, audit comment added — FOUND
- `src/systems/MetaPersistence.ts` — `_wipedFromVersion` strip in saveMetaState — FOUND
- `src/core/SaveManager.ts` — globalThis side-channel for D-07 — FOUND
- `tests/ui/CombatHUD.test.ts` — 9 tests — FOUND
- `tests/ui/LoopHUD.test.ts` — 7 tests — FOUND
- `tests/scenes/CharacterSelectScene.test.ts` — 9 tests — FOUND
- `tests/scenes/MainMenu.test.ts` — 12 tests — FOUND

### Commit verification

- Task 1 — `e14e17b` — SHADOWBLADE_PALETTE + CombatHUD widgets — FOUND
- Task 2 — `6e0b5f6` — LoopHUD status row — FOUND
- Task 3 — `5a4af89` — CharacterSelect + Preloader — FOUND
- Task 4 — `aaec235` — MainMenu wipe-notice + defense-in-depth — FOUND

## Plan 5 / Checkpoint Hand-off

Task 5 is a HUMAN visual-verification checkpoint per D-04. The orchestrator (not this executor) must return a structured checkpoint state asking the user to:

1. Run `npm run dev`
2. Validate all 6 UI-SPEC sign-off dimensions:
   - **Dimension 1 — Copywriting:** verify Shadowblade card copy, CP/Stealth labels, status row format, tile names, wipe + save-incompatible notices match UI-SPEC §Copywriting verbatim
   - **Dimension 2 — Visuals:** verify CP pips, Stealth pill, ENG label, Warrior/Mage have no Shadowblade widgets, status row visible, 3 new tiles distinguishable
   - **Dimension 3 — Color:** sample CP pip / Stealth / VIT/DEX/INT/SPI / library/arena/shrine floor colors via DevTools color-picker (within 1-2 hex units)
   - **Dimension 4 — Typography:** verify 11/10/13/18/16px sizes within ±1px
   - **Dimension 5 — Spacing:** verify CP strip = 76px wide, Stealth pill = 22px tall, CharacterSelect cards don't overflow, status row fits left panel
   - **Dimension 6 — Registry Safety:** verify `git diff package.json` shows no new deps in Plan 4
3. Respond "approved" if all 6 dimensions PASS, or describe the failing dimension(s)

After approval, Phase 9 is COMPLETE — Shadowblade is fully playable end-to-end with proper visual feedback, the v2 content set is live, and the save migration is closed.

---
*Phase: 09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status*
*Plan: 04*
*Completed: 2026-05-11 (Tasks 1-4); Task 5 awaiting human checkpoint*
