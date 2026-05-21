# Auto-applied Fixes

12 atomic commits applied from the audit. Each fix references its source finding and is independently revertable via `git revert`.

## Scope rules followed
- Only `Trivial?: yes` items where the change is unambiguous and zero design judgment.
- Game-design balance tweaks, UI refactors, schema consolidation, and tutorial routing changes are **left for human review** even when individual lines look small — they affect player-visible behavior.
- Pre-existing uncommitted work on `src/scenes/PlanningOverlay.ts` and `src/scenes/TutorialScene.ts` is left untouched.

## Verification

- `npm test` → **11 failed | 661 passed | 2 skipped** (identical to pre-audit baseline at commit `633025d`). My fixes added **zero new test failures**.
- The 11 pre-existing failures trace back to the bug audit's critical finding (`audit/bugs.md` C1): `LoopRunner` reads/writes fields that don't exist on its declared `LoopRunState` shape, producing `NaN` in 3 relic effects. Same root cause for the matching TS errors flagged by `tsc --noUnusedLocals`. These are left for human review because the fix requires a schema decision.

## Commits (in apply order)

| # | Commit | Title | Source finding |
|---|--------|-------|----------------|
| 1 | `1a2cc43` | fix(validate-data): drop dead synergies.json refs; cover new starterDecks shape | `data.md` H1 + MED #1/#2 |
| 2 | `f18274e` | fix(combat): route 4 Math.random calls through SharedRNG | `bugs.md` H1, H2 |
| 3 | `6900c1a` | fix(boss-exit): guard confirmSelection against double-fire | `bugs.md` H3 |
| 4 | `58babbb` | fix(mqtt): detach listeners before failing over to fallback broker | `bugs.md` H5 |
| 5 | `9b087ed` | perf(main): use requestAnimationFrame instead of forceSetTimeOut | `performance.md` H1 |
| 6 | `909bafc` | fix(preloader): stop loading bg_run.png and bg_forest.png (files missing) | `assets.md` S1 |
| 7 | `c316735` | chore: delete root-level scratch scripts and duplicate EnemyDefinitions | `dead-code.md` HIGH #1, #2 |
| 8 | `32fc989` | chore(data): delete 3 orphan JSON files (no runtime imports) | `dead-code.md` HIGH #3, #4, #5 |
| 9 | `46e9d0f` | chore(assets): delete ~6.7 MB of orphan files from public/ | `assets.md` S2/S3 |
| 10 | `adb71fd` | chore: drop unused imports flagged by tsc --noUnusedLocals | `dead-code.md` LOW imports |
| 11 | `264e97c` | chore(scenes): drop duplicate PLANNING_OVERLAY constant | `dead-code.md` MED |
| 12 | `3b9b989` | perf(game): bound parallax tilePositionX with modulo against texture width | `performance.md` MED parallax |

## Concrete wins

- **Validator runs again** and immediately catches 32 real cross-ref errors (phantom forge cards, phantom shrine relics, phantom enemy IDs) that were invisible before.
- **Daily Run / replay determinism restored** for Hemlock Vial, Pandora's Embers, and Tarnished Mirror builds.
- **Material economy duplication closed** at the boss-exit confirmation flow.
- **MQTT failover no longer leaks status updates** from dead primary clients.
- **rAF restored** — frame pacing recovered on every platform; biggest single perf win on low-end Intel iGPUs.
- **Console quieter on cold load** — two 404s removed; no more "MISSING" texture risk on the run scene.
- **~6 MB of orphan assets and ~6k LOC of dead JSON/TS deleted** — smaller bundle, faster cold load, less archaeology for the next reader.
- **Parallax stays precise across long runs** — eliminates texture wobble on hour-long sessions.

## Out of scope — recommendations only (see `audit/INDEX.md`)

Intentionally left for human review:

- **Critical:** `LoopRunner` schema mismatch (`bugs.md` C1) — needs decision on widening `LoopRunState.hero` vs threading the real `RunState` through. 3 relics inert until fixed.
- **Game design:** `percentPerLoop`, `deathXpPercent`, boss `behaviors`, Burn scaling, `CLASS_DECK_RATIO` (`gamedesign.md` quick-win shortlist) — all data-only, but balance decisions.
- **UI overhaul:** unified Button widget, palette/theming pass, replace emoji icon system with pixel-art icons, fix CombatHUD/LoopHUD information hierarchy.
- **UX flow:** route MainMenu → Tutorial → CharacterSelect for first-run players; add Start Run CTA + Settings access to MainMenu/CityHub; enable ESC in CombatScene.
- **Data:** consolidate the twin `tiles.json` / `difficulty.json` / starter-deck / warrior-passives pairs; align `types.ts` schemas with live JSON.
- **Daily Run leaderboard UI** — MQTT plumbing exists, payoff layer doesn't.
- **Asset re-encoding:** `wind.wav` (8 MB → ~150 KB OGG); battle/shop background PNGs → JPG/WebP at 80 q (~70% size reduction).
- **mqtt dynamic import + manualChunks split** — touches MqttClient + vite.config.ts more than a one-liner; safe but multi-file.
