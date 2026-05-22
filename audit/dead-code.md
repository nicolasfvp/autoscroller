# Dead Code Audit

## Summary
- 5 unused files (incl. 2 root-level scratch scripts and a 5944-line tier-3-mocks JSON), ~25 unused exports, 6 unused locals/imports flagged by tsc, and a duplicate `EnemyDefinition` type module.
- Top themes:
  1. A second source of truth — `src/data/EnemyDefinitions.ts` duplicates `src/data/types.ts`, and `src/data/json/{tiles,difficulty,enemy-drops}.json` are loaded by DataLoader but read only from tests.
  2. Two parallel `AudioManager` implementations (`src/audio/` Web-Audio vs. `src/systems/` Phaser-sound); the audio one carries a number of no-op stubs (`playMusic`, `stopMusic`, `setMusicVolume`).
  3. Several "stdlib"-style helper exports were front-loaded but never adopted by callers (`SharedRNG.pick/shuffle/randInt/getActiveRNG`, half of `ElementSystem`, half of `ShardSystem`, half of types in `src/data/types.ts`).

## Findings

### [HIGH] Root-level abandoned scratch scripts
**Where:** `scratch.cjs`, `scratch-terrain.cjs`, `update_enemies.cjs`
**Evidence:** Not referenced in `package.json`, `scripts/`, source, or tests. Headers describe one-shot maintenance runs already executed (e.g. `update_enemies.cjs` "stamps a spriteKey field onto each enemy" past tense per its own comment about FIXES A.5).
**Impact:** Repository clutter, encourages re-running stale data mutations.
**Fix:** delete
**Trivial?:** yes

### [HIGH] Duplicate enemy type module
**Where:** `src/data/EnemyDefinitions.ts` (whole file, 25 lines)
**Evidence:** `Grep "from.*EnemyDefinitions"` returns zero hits in `src/` or `tests/`. The canonical `EnemyDefinition`/`EnemyAttack`/`AttackPattern` types live in `src/data/types.ts`; the file's own header points the reader at the canonical location.
**Impact:** Two competing type modules invite drift (the duplicate is already missing fields like `attackCooldown`, `behaviors`, `affinity` present in `types.ts`).
**Fix:** delete the file
**Trivial?:** yes

### [HIGH] Tier-3 mocks JSON never imported
**Where:** `src/data/json/cards-tier3-mocks.json` (5944 lines)
**Evidence:** `Grep "cards-tier3-mocks"` finds only docs and the generator script; no `import` anywhere in `src/` or `tests/`. Docs (`docs/TOOLTIPS.md:678`) acknowledge "Tier 3 cards locked" / "pool real não existe ainda".
**Impact:** ~5.9k lines of bundle-bound static data that the loader never reads — but Vite static imports tree-shake this, so the cost is mostly repo bloat + confusion.
**Fix:** delete (or move to `design/` as a design artifact)
**Trivial?:** yes (no runtime import to break)

### [HIGH] Element definitions JSON never imported
**Where:** `src/data/json/elements.json` (120 lines)
**Evidence:** No `import.*elements.json` in any TS file. Only mentioned by docs and as a comment string in `src/systems/combat/RelicSystem.ts:145`. The canonical element table lives inline in `src/systems/ElementSystem.ts` (`ELEMENTS`, `ALL_ELEMENT_IDS`, etc.).
**Impact:** Same as above — duplicate source of truth for element identity/colors that no code reads.
**Fix:** delete, or repurpose it as the canonical source and have `ElementSystem.ts` consume it.
**Trivial?:** yes (no importer)

### [HIGH] Treasure tables JSON never imported
**Where:** `src/data/treasure-tables.json`
**Evidence:** `Grep "treasure-tables"` matches only `docs/TOOLTIPS.md`. `src/systems/TreasureLoot.ts` hard-codes weights in code.
**Impact:** Misleading — implies a data-driven treasure system that doesn't exist.
**Fix:** delete (or wire it into TreasureLoot)
**Trivial?:** yes

### [MEDIUM] `src/data/json/tiles.json` + `src/data/json/difficulty.json` + `src/data/json/enemy-drops.json` loaded but only consumed by tests
**Where:** `src/data/DataLoader.ts:7-11` (imports), `:81-122` (accessors)
**Evidence:** `getAllTiles`, `getTileByType`, `getDifficultyConfig(level)`, `getDefaultHeroStats`, `getEnemyDropTable` are only called from `tests/data/dataloader.test.ts`. Runtime game uses the parallel `src/data/tiles.json` (object-keyed, via `TileRegistry.ts`) and `src/data/difficulty.json` (via `DifficultyScaler.ts` / `RunEndResolver.ts` / `ShopSystem.ts`). Two different schemas live side by side under the same basename.
**Impact:** Two parallel data layers; readers can't tell which "tiles.json" is canonical. Tests pin the dead path in place.
**Fix:** consolidate on the runtime path; delete the unused `src/data/json/{tiles,difficulty,enemy-drops}.json` (and the matching DataLoader accessors `getAllTiles`, `getTileByType`, the level-parameterized `getDifficultyConfig`, `getDefaultHeroStats`, `getEnemyDropTable`) once the now-dead tests are dropped.
**Trivial?:** no (touches tests)

### [MEDIUM] `src/audio/AudioManager.ts` no-op music methods
**Where:** `src/audio/AudioManager.ts:55-61, 67-69`
**Evidence:** `playMusic`, `stopMusic`, `setMusicVolume` all bodies are `// No-op for v1`. `Grep ".playMusic|.stopMusic"` returns no callers. (Music is actually handled by the parallel `src/systems/AudioManager.ts` via Phaser sounds.)
**Impact:** Suggests a music API that doesn't exist; risks future callers wiring up the wrong manager.
**Fix:** delete the three no-op methods.
**Trivial?:** yes

### [MEDIUM] `src/audio/AudioManager.ts`: `getVolume`, `isEnabled` used only by tests
**Where:** `src/audio/AudioManager.ts:75-81`
**Evidence:** `Grep "getVolume(|isEnabled("` outside tests: only `SaveManager.ts:149` reads a parameter named `isEnabled` (unrelated). No production caller.
**Impact:** Dead accessors that exist only to be tested.
**Fix:** either delete (and prune the tests), or wire them into SettingsScene's UI state.
**Trivial?:** no (touches tests)

### [MEDIUM] `src/effects/CombatEffects.ts` — unused factory
**Where:** `src/effects/CombatEffects.ts:159-161` (`createCombatEffects`)
**Evidence:** `Grep "createCombatEffects"` returns the file itself only. The class is instantiated directly in `CombatScene.ts:16` (`new CombatEffects(...)`).
**Impact:** LOC clutter; suggests a DI pattern that isn't used.
**Fix:** delete the factory export.
**Trivial?:** yes

### [MEDIUM] `SharedRNG.ts` — half the exports are unused
**Where:** `src/systems/SharedRNG.ts:14-39`
**Evidence:** `Grep` shows `rand` / `setActiveRNG` are imported widely; `getActiveRNG`, `randInt`, `pick`, `shuffle` have no callers in `src/` or `tests/`. (`SeededRNG` has its own `pick`/`shuffle` instance methods that ARE used.)
**Impact:** Stdlib-style helper bloat that misleads readers into thinking shared/seeded variants exist.
**Fix:** delete `getActiveRNG`, `randInt`, `pick`, `shuffle`.
**Trivial?:** yes

### [MEDIUM] `ElementSystem.ts` — predicate/accessor exports never called externally
**Where:** `src/systems/ElementSystem.ts:84-130`
**Evidence:** `isPhysical`, `isElemental`, `elementCategory`, `elementCounts`, `ElementCategory` type — only consumers are inside ElementSystem itself (and `category: ElementCategory` is an interface field).
**Impact:** Public API surface larger than needed.
**Fix:** drop `export` on the predicates / `elementCategory` / `elementCounts` (or delete `elementCategory` outright — it's a 3-line forward to a record lookup).
**Trivial?:** yes (after confirming no doc-driven external use; none found)

### [MEDIUM] `ShardSystem.ts` — half the helpers are exported but unused
**Where:** `src/systems/ShardSystem.ts:21, 28, 86, 93`
**Evidence:** `emptyShardInventory`, `readShards`, `shardTotal`, `elementTotal` — `Grep` shows these are referenced only inside ShardSystem.ts itself. Tests don't import them either.
**Impact:** Misleading API; suggests an inventory utility module the rest of the code never adopts.
**Fix:** delete (or unexport).
**Trivial?:** yes

### [MEDIUM] Unused interface/type exports in `src/data/types.ts`
**Where:** `src/data/types.ts:78-93, 260, 363-401, 444-457`
**Evidence:** No `Grep` matches in `src/` or `tests/` for any of:
- `StackScaleSource` (line 87)
- `BossBehaviorType` (line 260) — only `BossBehavior` is consumed
- `PricingConfig` (line 363)
- `LoopGrowthConfig` (line 378)
- `MaterialDropConfig` (line 385)
- `EnemyDropConfig` / `TileDropConfig` (lines 444, 452) — only used internally by `EnemyDropTable`
**Impact:** Bigger surface area, dead schema docs.
**Fix:** delete or convert `EnemyDropConfig`/`TileDropConfig` to non-exported helper types.
**Trivial?:** yes for `StackScaleSource`, `PricingConfig`, `LoopGrowthConfig`, `MaterialDropConfig`; semi-trivial for the rest (still need a one-line interface-merge).

### [MEDIUM] `SceneKeys.ts` — duplicate `PLANNING_OVERLAY` constant
**Where:** `src/state/SceneKeys.ts:16-17`
**Evidence:** Both `PLANNING` and `PLANNING_OVERLAY` resolve to the string `'PlanningOverlay'`. `Grep "SCENE_KEYS.PLANNING_OVERLAY"` returns zero matches.
**Impact:** Two names for one value invites confusion.
**Fix:** delete `PLANNING_OVERLAY`.
**Trivial?:** yes

### [MEDIUM] `SceneKey` type exported but unused
**Where:** `src/state/SceneKeys.ts:39`
**Evidence:** No external usage of `SceneKey` (the union of all keys). The constant `SCENE_KEYS` IS used; the derived type isn't.
**Impact:** Dead type.
**Fix:** unexport (or delete).
**Trivial?:** yes

### [MEDIUM] `DataLoader` accessors used only by tests
**Where:** `src/data/DataLoader.ts`
**Evidence:**
- `getStarterDeckForClass` (`:64-66`) — no callers anywhere; `getStarterDeckIds` is the real accessor.
- `getTileByType` (`:86-88`) — no callers; runtime uses `TileRegistry.getTileConfig`.
- `getAllTiles`, `getDifficultyConfig`, `getDefaultHeroStats`, `getEnemyDropTable` — only `tests/data/dataloader.test.ts` calls them.
**Impact:** Public API drift from real usage; harder to know which loader is "the" loader.
**Fix:** delete `getStarterDeckForClass` and `getTileByType` (trivial); the test-only accessors should follow when the duplicate JSON files in `#tiles/difficulty/enemy-drops`-finding above are removed.
**Trivial?:** yes for the first two, no for the test-only set.

### [MEDIUM] `KeywordDefinitions.ts` — unused exported type
**Where:** `src/ui/KeywordDefinitions.ts:8`
**Evidence:** `KeywordCategory` is exported but only used inside the same file (as the `category` field type). All external code reads `KeywordDef['category']` instead.
**Impact:** Tiny — visible API surface inflation.
**Fix:** unexport.
**Trivial?:** yes

### [MEDIUM] `MetaState.ts` — exported-but-internal types
**Where:** `src/state/MetaState.ts:9, 17, 78`
**Evidence:** `ForgeRecipeEntry`, `DeckPresetEntry`, `RunHistoryEntry` are exported but referenced only within MetaState.ts itself. (`MetaState` is the only consumed interface.)
**Impact:** Surface area only; no runtime cost.
**Fix:** drop `export` keyword (or accept and ignore — these are commonly needed for migrations).
**Trivial?:** yes (low-stakes)

### [MEDIUM] `TileRegistry.ts` — exported helpers/types used only inside the file
**Where:** `src/systems/TileRegistry.ts:3, 4, 67-95`
**Evidence:** `TileSlotType`, `TerrainType`, `TileConfigWithKey`, `createReservedSlot` — no `Grep` matches outside `TileRegistry.ts`.
**Impact:** API surface.
**Fix:** unexport or delete `createReservedSlot` (the others are field types used inside `TileSlot` / `TileConfig`, harmless to unexport).
**Trivial?:** yes for `createReservedSlot` and `TileConfigWithKey`.

### [MEDIUM] `CombatHUD.computeHUDVisibility` is a stub kept alive only by its own tests
**Where:** `src/ui/CombatHUD.ts:13-23`
**Evidence:** The function ignores its input (`_state: HUDVisibilityInput`) and returns a constant `{ staminaLabel: '⚡ STA' }`. Only caller is `tests/ui/CombatHUD.test.ts`.
**Impact:** Misleading "pure visibility logic" comment + 3 tests that exercise nothing.
**Fix:** delete the function + `HUDVisibilityInput`/`HUDVisibility` types and the matching tests, OR finish implementing the heroClassName-dependent stamina label (`'⚡ STA' | '✨ MANA'`?).
**Trivial?:** no (judgment call: tests pin behavior)

### [LOW] `ForgeSystem.ts` — unused imports
**Where:** `src/systems/ForgeSystem.ts:10-11`
**Evidence:** `tsc --noUnusedLocals` flags `FORGE_DISCOUNT_BY_LEVEL` and `FORGE_TIER_UNLOCK` as never read. (A comment at line 28 mentions them but the imports aren't referenced.)
**Impact:** Lint clutter.
**Fix:** remove from the import list.
**Trivial?:** yes

### [LOW] `DeathScene.ts` / `RunTransitionScene.ts` — unused imports
**Where:** `src/scenes/DeathScene.ts:10` (`COLORS`), `src/scenes/RunTransitionScene.ts:2` (`LAYOUT`)
**Evidence:** Both flagged by `tsc --noUnusedLocals`.
**Impact:** Lint clutter.
**Fix:** drop from the import list.
**Trivial?:** yes

### [LOW] `CombatScene.transitioning` field — set but never read
**Where:** `src/scenes/CombatScene.ts:40` (declared), `:160, :227` (assigned)
**Evidence:** `tsc --noUnusedLocals` flags the field as "declared but its value is never read." Two assignment sites, zero reads. (Contrast with `GameScene.ts:305` which reads its own `this.transitioning`.)
**Impact:** Misleading state; suggests a transition gate that doesn't actually gate anything.
**Fix:** delete the field and its assignments, or wire it into an `update()` guard like GameScene does.
**Trivial?:** no (needs a quick read to confirm there's no behavior gap)

### [LOW] `GameScene.update(time, ...)` — `time` param unused
**Where:** `src/scenes/GameScene.ts:304`
**Evidence:** `tsc` warning; signature is dictated by Phaser, so it's a false positive in spirit.
**Impact:** None functionally; only matters if `--noUnusedParameters` is ever turned on.
**Fix:** rename to `_time` (or leave; it's the Phaser API).
**Trivial?:** yes

### [LOW] Comment-only references to deleted/never-existing files
**Where:**
- `src/systems/combat/RelicSystem.ts:145` mentions `elements.json` only as a comment.
- `src/systems/CombatLoot.ts:110` "enemy-drops.json cardPool data preserved for future reference but unused."
**Evidence:** Inline comments that point at JSON files the runtime never reads (see HIGH/MEDIUM findings above).
**Impact:** Misleading code archeology.
**Fix:** drop the stale comments when the dead files are removed.
**Trivial?:** yes

## Notes on items checked and cleared
- All scene classes in `src/scenes/` are registered in `src/main.ts` (verified).
- All `*.helpers.ts` and `*.pure.ts` files (`CharacterSelectScene.helpers`, `MainMenu.helpers`, `LoopHUD.helpers`, `CardFilterBar.pure`) are imported by their owners or tests.
- Both `AudioManager`s (`src/audio/` and `src/systems/`) are legitimately used (Web-Audio SFX vs. Phaser music) — keep both, but trim no-op methods (see MEDIUM finding above).
- `RunEndResolver` looked unused (no scene imports it) but is consumed by `LoopRunner.ts:5`.
- `src/effects/CombatEffects.CombatEffects` class IS used by `CombatScene.ts:16`; only the factory `createCombatEffects` is dead.
- No `if (false)` / `if (true) {` branches; no `TODO`/`FIXME`/`XXX`/`HACK` comments found in `src/`.
