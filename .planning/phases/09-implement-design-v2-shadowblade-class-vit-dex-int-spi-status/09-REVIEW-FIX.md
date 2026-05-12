---
phase: 09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status
fixed_at: 2026-05-12T00:00:00Z
review_path: .planning/phases/09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status/09-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-05-12
**Source review:** `.planning/phases/09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status/09-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (2 critical + 7 warning; Info findings deferred per fix_scope=critical_warning)
- Fixed: 9
- Skipped: 0

## Per-Finding Breakdown

| ID    | Severity | Status                            | Commit  | Primary File                            |
|-------|----------|-----------------------------------|---------|------------------------------------------|
| CR-01 | Critical | fixed                             | c511392 | `src/scenes/Preloader.ts`                |
| CR-02 | Critical | fixed                             | eacde3d | `src/state/MetaState.ts`                 |
| WR-01 | Warning  | fixed                             | 167aafa | `src/systems/combat/CombatEngine.ts`     |
| WR-02 | Warning  | fixed                             | 24645cd | `src/systems/combat/CombatEngine.ts`     |
| WR-03 | Warning  | fixed: requires human verification | f38a073 | `src/systems/RestSiteSystem.ts`          |
| WR-04 | Warning  | fixed: requires human verification | c3d8029 | `src/systems/combat/CombatEngine.ts`     |
| WR-05 | Warning  | fixed                             | cfce2b1 | `src/systems/SynergyResolver.ts`         |
| WR-06 | Warning  | fixed                             | 5fd24b2 | `src/scenes/MainMenu.ts`                 |
| WR-07 | Warning  | fixed                             | 525dd65 | `src/ui/LoopHUD.ts`                      |

## Fixed Issues

### CR-01: Hero Mage spritesheets are overwritten by monster Mage spritesheets

**Files modified:** `src/scenes/Preloader.ts`, `src/ui/TileVisual.ts`, `src/scenes/CombatScene.ts`
**Commit:** c511392
**Applied fix:** Renamed monster texture keys from bare ``${id}_idle/_attack/_death`` to `monster_${id}_idle/_attack/_death` in Preloader.ts so the enemy "mage" no longer overwrites the hero Mage spritesheets (which the Shadowblade also reuses per D-08). Updated the two consumer sites (`TileVisual.addEnemySprite` enemy idle key, `CombatScene` enemyIdleKey / enemyAttackKey / enemyDeathKey fields) to resolve enemy textures via the new namespace. Hero `mage_*` and enemy `monster_mage_*` are now disjoint.

### CR-02: MetaState.classXP is missing the shadowblade field

**Files modified:** `src/state/MetaState.ts`, `src/systems/MetaProgressionSystem.ts`
**Commit:** eacde3d
**Applied fix:** Widened the `MetaState.classXP` type from `{ warrior: number; mage: number }` to `{ warrior: number; mage: number; shadowblade: number }`. Added `shadowblade: 0` to `createDefaultMetaState()` (so post-v6-wipe saves have the field) and to the v3→v4 migration backfill (so unwiped legacy paths also pick it up). Widened `MetaProgressionSystem.bankRunRewards` className guard so Shadowblade XP banks to its own bucket instead of falling back to warrior with a warning.

### WR-01: dot_tick relic trigger only dispatches on poison ticks

**Files modified:** `src/systems/combat/CombatEngine.ts`
**Commit:** 167aafa
**Applied fix:** Hoisted the `dispatchTriggerRelics('dot_tick', ...)` call out of the poison branch. Introduced an `anyDotTicked` flag set inside each DoT branch (poison/bleed/burn/shock); after the DoT pass, dispatch once if any DoT ticked. Bleed/burn/shock relics now fire `dot_tick` triggers; the dispatch fires once per `tickActiveDoTs` pass (not once per DoT type), matching the per-card-play cadence.

### WR-02: card_drawn dispatches on a dead enemy after the killing blow

**Files modified:** `src/systems/combat/CombatEngine.ts`
**Commit:** 24645cd
**Applied fix:** Guarded the `card_drawn` relic dispatch and the `combat:card-drawn` emit in `advanceDeckPointer` on `state.enemyHP > 0 && state.heroHP > 0`. Eliminates corpse-mutation by post-killing-blow relics and prevents the misleading `combat:card-drawn` for a card that will never play. The outer `tick()` still calls `checkEndConditions` on the next iteration, so the win/loss event fires correctly.

### WR-03: Rest Site 'train' choice is cosmetic-only — no damage boost is applied

**Files modified:** `src/systems/RestSiteSystem.ts`
**Commit:** f38a073
**Applied fix:** Per user guidance ("prefer implementing the buff to honor the player-facing copy"), implemented the train mutation by flipping `runState.deck.upgraded[idx] = true` for the randomly-selected card position. Reuses the existing per-position upgrade mechanism (CardName+ in deck UI) so the boost is real, visible, and resolves through `CardResolver.resolve(..., isUpgraded=true)`. Already-upgraded picks return a no-op notice. **Requires human verification:** the player-facing copy slightly shifts ("Trained X (upgraded)" instead of "Boosted X damage by +N") to truthfully describe the new mechanic — verify this aligns with rest-site design intent and that the upgrade mechanic feels like a comparable trade-off versus rest/meditate.

### WR-04: Burn DoT formula adds a flat INT bonus regardless of stack count

**Files modified:** `src/systems/combat/CombatEngine.ts`
**Commit:** c3d8029
**Applied fix:** Changed burn formula from `state.burnStacks + Math.floor(state.heroIntellect / 2)` (flat additive INT bonus) to `state.burnStacks * (1 + Math.floor(state.heroIntellect / 2))` (per-stack INT multiplier), mirroring poison's `stacks * (1 + floor(DEX/4))` shape so DoT classes scale symmetrically with their primary stat. **Requires human verification:** this is a logic / balance change. At INT=8, 5 burn stacks previously dealt 9 damage; under the new formula they deal 25 damage. Balance pass should re-tune burn-generating cards or burn baseline if numbers run too hot.

### WR-05: Loop synergy wraparound creates a phantom boss↔first-tile adjacency

**Files modified:** `src/systems/SynergyResolver.ts`
**Commit:** cfce2b1
**Applied fix:** Replaced `playable[(i + 1) % playable.length]` modulo wraparound with a linear scan that stops at `playable.length - 1`. Loop traversal is linear (autoscroller geometry), so the boss→first-tile adjacency was a phantom free buff. The buffer-tile exclusion intent is now matched by a parallel last-tile-boundary stop.

### WR-06: MainMenu schedules showWelcomeNotice via a callback that can never fire

**Files modified:** `src/scenes/MainMenu.ts`
**Commit:** 5fd24b2
**Applied fix:** Removed the dead `this.events.once('create', () => this.showWelcomeNotice(wipedFrom))` registration. Phaser's `'create'` event fires before `create()` runs, so the callback never fired. The adjacent `this.time.delayedCall(50, ...)` does the actual work and is preserved. Prevents a future refactor from accidentally surfacing a duplicate notice.

### WR-07: LoopHUD.update divides by maxHP without a zero-guard

**Files modified:** `src/ui/LoopHUD.ts`
**Commit:** 525dd65
**Applied fix:** Clamped the denominator with `const maxHPForBar = Math.max(1, runState.hero.maxHP)` before the `hpBar.width` division. Corrupted saves or transient mid-migration states with `maxHP === 0` no longer produce NaN width on the bar rectangle. The text label still shows the raw `currentHP/maxHP` so the underlying corruption surfaces visibly to the user without breaking the bar geometry.

## Skipped Issues

None — all 9 in-scope findings were fixed.

## Notes

- **Verification:** TypeScript `tsc --noEmit` was run after all fixes. The only errors touching the files I modified are pre-existing TS6133 "declared but never read" warnings unrelated to these fixes (no new errors were introduced).
- **WR-03 / WR-04 flagged for human verification:** these involve player-facing copy / balance shifts that benefit from a manual playtest pass before the phase verifier signs off. The structural fix is correct; the balance numbers may need tuning.
- **Tree state:** clean after all commits; working tree matches the last fix commit (525dd65).
- **Iteration:** 1.

---

_Fixed: 2026-05-12_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
