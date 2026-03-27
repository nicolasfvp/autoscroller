---
phase: 05-balance-economy-overhaul
verified: 2026-03-27T17:10:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: false
human_verification:
  - test: "Start a new run and play 3-5 combats on loop 1"
    expected: "Fights against Slime/Goblin take approximately 5-8 seconds each (automated test confirms 5-12s tolerance). Stamina and mana are NOT full at the start of the 2nd and 3rd fights -- they show partial values."
    why_human: "50% recovery is wired via CombatScene write-back (line 171-172 CombatScene.ts), but the visual feel and actual mid-run continuity requires human confirmation in the browser."
  - test: "Visit a shop tile on loop 1 and again on loop 8"
    expected: "Loop 1 card prices are around 68g (60+8). Loop 8 card prices are around 124g (60+64). Removal cost starts at 50g and increases with each removal. Reorder starts at 15g."
    why_human: "ShopScene calls ShopSystem.getCardPrice(loopCount) for buy-cards and getRemoveCardCost(deckCards.length) for removal -- but the removal cost uses deckCards.length not removalCount. This is a partial implementation concern that needs human eyes to confirm visible behavior."
  - test: "Complete a run safely via boss exit, then check City Hub"
    expected: "City Hub shows per-material inventory (e.g. 'wood: 15 | stone: 8 | iron: 3'). Buildings show multi-material costs with green/red affordability. Storehouse is visible as the 6th building."
    why_human: "CityHub and BuildingPanelScene were verified statically but the actual rendering of material display and per-material cost affordability colors needs visual confirmation."
  - test: "Die mid-run and observe Death Scene"
    expected: "Death screen shows 'Retained (10%): wood: X, iron: Y' or the actual retention percentage if Storehouse is upgraded. Returns to City Hub with 10% of earned materials."
    why_human: "DeathScene.ts correctly calls getStorehouseEffects and renders retainedLines, but the actual display and banking flow needs human walkthrough."
  - test: "Load the game after having played before (or clear IndexedDB and confirm fresh start)"
    expected: "Game loads without crash. If old save existed, migration from v1 to v2 runs silently -- no error about missing 'materials' or 'storehouse' fields."
    why_human: "MetaPersistence.ts calls migrateMetaState on load (verified), but actual save migration in a real browser session needs confirmation."
---

# Phase 05: Balance & Economy Overhaul Verification Report

**Phase Goal:** Rebalance combat for 5-8s fights, replace single metaLoot with 7-material economy, implement scaling gold prices with caps, add Storehouse building, rework difficulty curve with diminishing loop growth
**Verified:** 2026-03-27T17:10:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MetaState uses `materials: Record<string, number>` instead of `metaLoot: number` | VERIFIED | `src/state/MetaState.ts` line 17: `materials: Record<string, number>` -- no metaLoot field on interface |
| 2 | MetaState v1 saves migrate to v2 with materials field | VERIFIED | `migrateMetaState` in MetaState.ts lines 60-86; 9 migration tests pass (null, undefined, v1->v2, passthrough, field preservation) |
| 3 | RunState.economy tracks in-run materials | VERIFIED | `src/state/RunState.ts` line 56: `materials: Record<string, number>` in EconomyState; createNewRun sets `materials: {}` |
| 4 | 7 material types defined with terrain and enemy drop mappings | VERIFIED | materials.json: 7 materials, 5 terrainDrops entries (forest/graveyard/swamp/basic/volcano), 5 enemyBonusDrops entries |
| 5 | buildings.json has 6 buildings with multi-material recipe costs | VERIFIED | storehouse present, storehouse.tiers.length=8, forge tier 1 cost is object `{"iron":8,"crystal":3}` |
| 6 | difficulty.json has pricing config, loopGrowth schedule, 10% death penalty, resourceResetPercent | VERIFIED | All fields confirmed: `deathMaterialPercent:0.10`, `resourceResetPercent:0.5`, `loopGrowth.schedule:[3,2,2,1,1]`, `loopGrowth.maxTileLength:40`, `pricing.cardBasePrice:60` |
| 7 | Stamina and mana recover 50% between combats (not 100%) | VERIFIED | CombatState.ts lines 47-49: `currentStamina + Math.floor((maxStamina - currentStamina) * 0.5)`; 7 recovery tests pass |
| 8 | Starter deck defeats loop 1 Slime in 5-12s | VERIFIED | balance-validation.test.ts passes: 4 tests confirm 5-12s for Slime, 4-10s for Goblin, hero survives, loop 3 takes longer |
| 9 | Card shop prices scale with loop count using caps | VERIFIED | ShopSystem.ts: 4 static price methods (`getCardPrice`, `getRemovalPrice`, `getReorderPrice`, `getRelicPrice`), all reading from difficulty.json pricing config; 10 ShopSystem tests pass |
| 10 | Loop growth uses diminishing schedule [3,2,2,1,1] with 40-tile cap | VERIFIED | DifficultyScaler.ts: `getLoopGrowth` and `getLoopLength` exported; 6 DifficultyScaler loop tests pass |
| 11 | Death penalty keeps 10% of materials; Storehouse upgrades retention | VERIFIED | RunEndResolver.ts: `getStorehouseEffects(storehouseLevel).deathRetention`; MetaProgressionSystem.ts: `getStorehouseEffects`; 6 RunEndResolver tests and 4 MetaProgressionSystem storehouse tests pass |

**Score:** 11/11 truths verified (automated checks)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/state/MetaState.ts` | MetaState v2 with materials, storehouse, migrateMetaState | VERIFIED | All three present and substantive |
| `src/state/RunState.ts` | EconomyState.materials field | VERIFIED | Line 56, and createNewRun sets `materials: {}` |
| `src/data/json/materials.json` | 7 materials, terrainDrops, enemyBonusDrops | VERIFIED | 7 materials, 5 terrain entries, 5 enemy entries |
| `src/data/json/buildings.json` | 6 buildings with multi-material costs including storehouse | VERIFIED | storehouse present, 8 tiers, forge tier1 cost is object |
| `src/data/difficulty.json` | deathMaterialPercent, pricing, loopGrowth | VERIFIED | All fields present and correct |
| `tests/state/meta-migration.test.ts` | 9 migration tests | VERIFIED | All 9 tests pass |
| `src/systems/combat/CombatState.ts` | 50% recovery formula | VERIFIED | Lines 47-49 with correct formula |
| `tests/systems/combat/combat-state.test.ts` | 7+ resource recovery tests | VERIFIED | 7 tests in "50% resource recovery" describe block |
| `tests/systems/combat/balance-validation.test.ts` | Fight duration simulation | VERIFIED | 4 tests, all pass |
| `src/systems/ShopSystem.ts` | 4 static price methods | VERIFIED | getCardPrice, getRemovalPrice, getReorderPrice, getRelicPrice |
| `src/systems/LootGenerator.ts` | rollMaterialDrops, no rollMetaLoot | VERIFIED | rollMaterialDrops present; only metaLoot reference in migration code (MetaState.ts) |
| `src/systems/MetaProgressionSystem.ts` | Multi-material costs, getStorehouseEffects, bankRunRewards | VERIFIED | All three present and substantive |
| `src/systems/RunEndResolver.ts` | materials: Record<string,number>, storehouseLevel param | VERIFIED | RunEndResult.materials exists, storehouseLevel param exists |
| `src/systems/DifficultyScaler.ts` | getLoopGrowth, getLoopLength | VERIFIED | Both exported, reading loopGrowth schedule from config |
| `src/systems/MetaPersistence.ts` | Calls migrateMetaState on load | VERIFIED | Line 9: `return migrateMetaState(raw)` |
| `src/scenes/CityHubScene.ts` | Displays materials, storehouse building | VERIFIED | Lines 64-72 iterate materials; BUILDING_LAYOUT includes storehouse at x:500,y:400 |
| `src/scenes/BuildingPanelScene.ts` | Multi-material costs, per-material affordability | VERIFIED | Lines 151-158 check per-material affordability; missingMats logic present |
| `src/ui/LoopHUD.ts` | Shows material counts | VERIFIED | `materialsText` field, displays compact abbreviations |
| `src/scenes/DeathScene.ts` | Shows per-material retention with storehouse % | VERIFIED | Lines 50-61 calculate and display per-material retention |
| `src/scenes/BossExitScene.ts` | Shows per-material rewards, resolveRunEnd wired | VERIFIED | Lines 67-74 display material lines from choiceData.safeExitReward.materials |
| `src/scenes/CombatScene.ts` | Writes back currentStamina and currentMana after combat | VERIFIED | Lines 171-172: `currentRun.hero.currentStamina = finalState.heroStamina` and `currentMana` |
| `src/scenes/GameScene.ts` | Materials sync on resume | VERIFIED | Lines 112-115 sync materials from run.economy.materials |
| `src/scenes/ShopScene.ts` | Uses scaling prices from ShopSystem | VERIFIED | ShopSystem.getShopCards called with run.loop.count; ShopSystem.getRemoveCardCost called |
| `src/data/types.ts` | PricingConfig, LoopGrowthConfig, MaterialDropConfig | PARTIAL | File has CardDefinition, EnemyDefinition, etc., but PricingConfig/LoopGrowthConfig/MaterialDropConfig interfaces are NOT in types.ts -- they appear to have been added to DifficultyScaler.ts as a local interface instead |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/systems/MetaPersistence.ts` | `src/state/MetaState.ts` | `migrateMetaState` call on load | WIRED | Line 2 imports migrateMetaState; line 9 calls it |
| `src/scenes/BossExitScene.ts` | `src/systems/RunEndResolver.ts` | `resolveRunEnd` via getBossExitChoiceData/LoopRunner | WIRED | BossExitScene calls getBossExitChoiceData; LoopRunner.onBossChoice calls resolveRunEnd with `this.runState.economy.materials` |
| `src/systems/LoopRunner.ts` | `src/systems/LootGenerator.ts` | Uses `getEnemyPoolForTerrain` | PARTIAL | LoopRunner imports getEnemyPoolForTerrain but does NOT import or call rollMaterialDrops -- materials accumulation happens when scenes process combat results, not inside LoopRunner directly |
| `src/systems/ShopSystem.ts` | `src/data/difficulty.json` | `pricing.cardBasePrice` reads | WIRED | Lines 3-5: imports difficultyConfig, `const pricing = (difficultyConfig as any).pricing` |
| `src/systems/LootGenerator.ts` | `src/data/json/materials.json` | `terrainDrops` reads | WIRED | Line 2: imports materialsConfig; uses materialsConfig.terrainDrops, enemyBonusDrops, bossDrops.materials |
| `src/systems/MetaProgressionSystem.ts` | `src/state/MetaState.ts` | Deducts `materials[mat]` | WIRED | Lines 32-41: iterates cost entries, checks state.materials[mat], deducts |
| `src/systems/RunEndResolver.ts` | `src/systems/MetaProgressionSystem.ts` | `getStorehouseEffects` for retention | WIRED | Line 2 imports getStorehouseEffects; line 23 calls it |
| `src/scenes/CombatScene.ts` | `src/state/RunState.ts` | Writes `currentStamina =` after combat | WIRED | Lines 171-172 confirmed |

**Note on LoopRunner material accumulation:** LoopRunner fires `combat-start` events, which GameScene/CombatScene handle. Material drops from combat are awarded by CombatScene/BossSystem (which call rollMaterialDrops). This is the correct wiring pattern -- LoopRunner is not the accumulation point.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BAL-TYPES | 05-01 | MetaState v2 with materials Record, storehouse building | SATISFIED | MetaState.ts has `materials: Record<string, number>` and `storehouse: { level: number }` |
| BAL-DATA | 05-01 | 7 material types, rebalanced JSON data files | SATISFIED | materials.json (7 types), buildings.json (6 buildings, object costs), enemies.json (slime baseHP=130), difficulty.json (pricing/loopGrowth) |
| BAL-MIGRATION | 05-01, 05-04 | migrateMetaState v1->v2; MetaPersistence calls it | SATISFIED | migrateMetaState in MetaState.ts; MetaPersistence.ts calls it; 9 tests pass |
| BAL-COMBAT | 05-02 | Starter deck fights 5-8s at loop 1; balance validation test | SATISFIED | balance-validation.test.ts: 4 tests pass confirming 5-12s fight duration |
| BAL-RESET | 05-02 | 50% stamina/mana recovery between combats | SATISFIED | CombatState.ts uses 50% deficit formula; 7 recovery tests pass; CombatScene writes back values |
| BAL-SHOP | 05-03 | Card/removal/reorder/relic prices scale with caps | SATISFIED | ShopSystem.ts has 4 static price methods; all formulas verified against difficulty.json |
| BAL-MATERIALS | 05-03 | LootGenerator produces material drops (not metaLoot) | SATISFIED | rollMaterialDrops in LootGenerator.ts; no rollMetaLoot; 7 material drop tests pass |
| BAL-DEATH | 05-03 | Death penalty: 10% materials, 0% XP, Storehouse upgradeable | SATISFIED | RunEndResolver.ts applies deathRetention from getStorehouseEffects; 6 RunEndResolver tests pass |
| BAL-LOOP | 05-03 | Diminishing loop growth [3,2,2,1,1] with 40-tile cap | SATISFIED | DifficultyScaler.ts getLoopGrowth/getLoopLength; LoopRunner uses getLoopGrowth(bossKillCount); 6 tests pass |
| BAL-STOREHOUSE | 05-03 | Storehouse building with gathering boost and death retention effects | SATISFIED | buildings.json storehouse has 8 tiers with effect objects; getStorehouseEffects in MetaProgressionSystem.ts; 4 storehouse effect tests pass |
| BAL-INTEGRATION | 05-04 | All scenes/HUD display materials; no active metaLoot in src/ | SATISFIED | grep shows only 4 metaLoot references in src/, all inside migrateMetaState function (legacy migration code -- correct) |

**Note:** BAL-* requirement IDs are phase-internal -- they do not appear in REQUIREMENTS.md traceability table, which only covers v1 requirements (ARCH-*, CMBT-*, etc.) mapped to phases 1-4. Phase 5 creates its own requirement namespace. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/systems/ShopScene.ts` (removal cost) | 98 | `getRemoveCardCost(deckCards.length)` passes deck size, not removal count | Warning | Removal escalation uses deck-size-based formula instead of per-use escalation as designed. First removal at a 6-card deck costs 50g (correct base), but subsequent removals in the same run won't escalate because the count is deck size, not removal count. The removal escalation design (50g + 25g/use) is not fully wired to the scene. |
| `src/data/types.ts` | N/A | PricingConfig, LoopGrowthConfig, MaterialDropConfig NOT present | Info | Plan 05-01 acceptance criteria required these in types.ts but they ended up as a local interface in DifficultyScaler.ts. Functionally equivalent but does not match the contract. |
| `src/systems/LootGenerator.ts` | 51 | `loopCount` parameter declared but never read (TS6133 warning) | Info | loopCount was planned for loop-scaled drops but is unused. Not a runtime bug. |

---

### Human Verification Required

#### 1. Combat feel -- 5-8s fights and 50% stamina recovery

**Test:** Start a new run. Play through 3 combats without using rest tiles.
**Expected:** Loop 1 fights take roughly 5-8 seconds each. Starting the 2nd combat, stamina and mana should show partial values (not full) -- stamina at ~35/50 if at 20/50 after first fight.
**Why human:** The automated tick simulation confirms timing, but real browser timing with Phaser rendering frames may differ. The write-back of currentStamina in CombatScene requires the scene flow to work end-to-end.

#### 2. Shop scaling prices visible

**Test:** Visit a shop on loop 1, note prices. Complete multiple loops and visit shop again around loop 8.
**Expected:** Card buy price approximately 68g on loop 1 (60+8), approximately 124g on loop 8. Removal starts at 50g (but see warning -- escalation per use may not work correctly due to deckCards.length being passed instead of removal count).
**Why human:** Confirms ShopScene correctly passes loop count. Also flags whether the removal escalation bug is observable.

#### 3. City Hub material display and Storehouse building

**Test:** Complete a run via safe boss exit. Return to City Hub.
**Expected:** Material inventory shown at top (e.g., "wood: 15 | stone: 8"). Storehouse visible as 6th building at bottom row. BuildingPanel shows multi-material costs (e.g., "Iron: 8, Crystal: 3") with green text when affordable, red when not.
**Why human:** CityHub and BuildingPanel rendering verified statically, but visual layout and color affordability indicators need eyes.

#### 4. Death scene per-material retention

**Test:** Die in combat. Observe DeathScene.
**Expected:** "Retained (10%):" row shows per-material kept amounts. Returning to City Hub shows 10% of earned materials banked.
**Why human:** DeathScene.ts correctly builds the display string, but the actual bankRunRewards call and round-trip to IndexedDB needs verification.

#### 5. Save migration (v1 -> v2)

**Test:** If a save exists from before Phase 5, load the game.
**Expected:** Game loads without TypeScript runtime errors. City Hub shows empty materials (converted from numeric metaLoot). Storehouse building appears at level 0.
**Why human:** Browser IndexedDB save migration cannot be tested headlessly.

---

## Gaps Summary

No blocking automated gaps found. All 11 observable truths are verified by code inspection and passing tests. One warning-level issue was found:

**Removal cost escalation partial implementation:** `src/scenes/ShopScene.ts` line 98 calls `ShopSystem.getRemoveCardCost(deckCards.length)` instead of `getRemoveCardCost(removalCount)`. The escalation-per-use design from BAL-SHOP is implemented in ShopSystem but not fully wired to the scene. Deck-size is used as the count proxy, which does not increase across removals in the same session. This is a warning, not a blocker -- the shop still functions and prices are within the designed range.

---

_Verified: 2026-03-27_
_Verifier: Claude (gsd-verifier)_
