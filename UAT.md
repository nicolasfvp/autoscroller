# UAT — Autoscroller Bug-Fix Sweep

**Scope:** Manual acceptance test for every fix shipped between commits `3ce0767` (data drops/validator, the start of the recent sweep) and `97f30a3` (test-fixture alignment, today). Covers ~40 BUGS-* findings closed across 16 commits.

**Build:** `npm run build` (or `npm run dev` for live testing)
**Automated baseline:** `npm test` should show **422 passing** and `npx tsc --noEmit` should be **clean**. If either is red, stop and triage before manual UAT.

**How to read this doc:**
Each section is one fix. The format is:
- **What was broken** (one-line plain-English)
- **What you should now see** (the new behavior)
- **Repro path** (click steps to reach the surface)
- **Pass criteria** (checkbox conditions a tester ticks)

Fixes are grouped so a tester can run linearly through related areas in one session. Plan ~90 minutes for the full sweep.

---

## Section 1 — Run lifecycle & save persistence

### 1.1 Autosave actually runs during a run (C.1)
- **Was broken:** GameScene never wired `setupAutoSave`. Players closing the tab mid-run lost everything since the initial post-character-select save.
- **Now expected:** After every combat end and every loop completion, the IDB record updates. Closing/reloading mid-run restores progress.
- **Repro:**
  1. New Run → play through one combat (any tile).
  2. Without manually saving, hard-refresh the browser tab (Ctrl+R).
  3. From Main Menu, click **Continue Run**.
- **Pass:**
  - [ ] Continue Run is offered after refresh.
  - [ ] HP/stamina/mana, deck, gold, and tile-points match the state when you closed the tab.

### 1.2 Loop progress survives save→load (C.8 / BUGS-STATE C-1)
- **Was broken:** `LoopRunner.startRun` reset `loop.count` to 1 on every GameScene create. Save on loop 7 → reload at loop 1 with regenerated tiles.
- **Now expected:** GameScene calls `loopRunner.resumeRun(...)` when a saved run has tiles; loop count, length, and tile layout persist.
- **Repro:**
  1. New Run → finish enough combats/events to reach **loop 3** or higher (HUD shows the loop counter).
  2. Refresh the tab.
  3. Continue Run.
- **Pass:**
  - [ ] HUD shows the same loop number you were on (NOT loop 1).
  - [ ] The tile layout (terrain/enemies on each slot) is identical to before refresh.
  - [ ] Hero is at the same position in the loop.

### 1.3 Settings → Auto-save toggle takes effect (HI-03)
- **Was broken:** `MetaState.autoSave === false` was stored but never read. Disabling autosave did nothing.
- **Now expected:** Disabling autosave silences `combat:end` and `loop:completed` save triggers; manual save (and clearing on abandon) still work.
- **Repro:**
  1. Settings → toggle **Auto-save** OFF → Save & Close.
  2. Start or continue a run; complete a combat.
  3. Refresh the tab.
- **Pass:**
  - [ ] Continue Run shows the state from BEFORE the combat (autosave was suppressed).
  - [ ] Re-enabling auto-save and finishing another combat persists normally.

### 1.4 Abandon Run actually abandons (C.2 / ME-04)
- **Was broken:** Pause → Abandon Run only stopped the GameScene; IDB save and in-memory `currentRun` persisted. Continue Run from Main Menu restored the abandoned run.
- **Now expected:** Abandon Run calls `clearRun()` + `saveManager.clear()` + clears the registry hint before transitioning.
- **Repro:**
  1. New Run → play through 1 combat.
  2. ESC → **Abandon Run**.
  3. From Main Menu, look for **Continue Run**.
- **Pass:**
  - [ ] No Continue Run button is shown (only New Run).
  - [ ] Refreshing the tab does not bring the abandoned run back.

### 1.5 Main Menu reads fresh save state (C.4 / ME-05)
- **Was broken:** Main Menu read `savedRun` from a Phaser registry written once at boot. Stale after delete/abandon/new.
- **Now expected:** Main Menu re-loads from IDB on every `create()`; registry is invalidated after consumption.
- **Repro:**
  1. From Main Menu after a fresh boot with a saved run, observe Continue Run.
  2. Settings → **Reset All Progress** (confirm).
  3. Stay in the menu OR open settings & close — return to Main Menu (without refreshing).
- **Pass:**
  - [ ] After reset, Main Menu no longer offers Continue Run without a tab refresh.

---

## Section 2 — Class & meta-progression correctness

### 2.1 Mage runs bank XP to mage (B.3 / BUGS-STATE C-6)
- **Was broken:** `bankRunRewards` defaulted `className = 'warrior'`. Both call sites omitted the arg, so mage runs always credited `classXP.warrior`.
- **Now expected:** Banking routes to `classXP[run.hero.className]`. Run history records `className`.
- **Repro:**
  1. From CityHub → Tavern → select **Mage** → Start Run.
  2. Complete the first boss → Safe Exit → return to City.
  3. Open the Library / Tavern → check class XP.
- **Pass:**
  - [ ] **Mage XP** has incremented; warrior XP is unchanged.
  - [ ] Repeat for warrior; warrior XP increments and mage stays put.
  - [ ] Tavern's "Best run" / run history rows show the correct class.

### 2.2 Mage class auto-unlocks via Library (B.4 / BUGS-STATE H-6)
- **Was broken:** `checkPassiveUnlocks` only iterated warrior passives. Mage passives could never auto-unlock from XP.
- **Now expected:** Both classes are walked; XP threshold matches per-class.
- **Repro:**
  1. Run several mage runs (or use cheats / debug if available) until mage XP crosses a passive threshold.
  2. Start a new mage run; in CombatScene, observe applied passives in the HUD or via `console.log` of `resolvePassives`.
- **Pass:**
  - [ ] At least one mage passive is listed/applied at the threshold; warrior passives don't leak in.

### 2.3 Class passives actually modify combat stats (B.2 / BUGS-COMBAT C-2)
- **Was broken:** `applyPassiveModifiers` wrote to keys (`maxHP`, `maxStamina`, `defenseMultiplier`) that don't exist on `CombatState` (it uses `heroMaxHP` etc.). `state.maxHP = NaN`; passives silently dead.
- **Now expected:** New `applyPassiveModifiersToCombatState` maps the passive stat names to the prefixed CombatState fields.
- **Repro (warrior, Vigor passive +10 maxHP):**
  1. Earn enough warrior XP for Vigor.
  2. Start a warrior run; enter combat.
  3. Inspect HP cap on the bar (via tooltip if available or `getRun().hero.maxHP` in console).
- **Pass:**
  - [ ] Combat HP cap is **base + 10** (not base) when Vigor is active.
  - [ ] Endurance / Iron Body show their effects (max-stamina or damage-taken).

---

## Section 3 — Combat damage math

### 3.1 Damage floor of 1 (B.5)
- **Was broken:** Cards dealing ≤ enemy defense rounded to 0. Soft-lock vs Iron Golem (defense 8) when starter cards deal ≤8.
- **Now expected:** Any card with positive base damage deals ≥1 to the enemy after defense.
- **Repro:**
  1. Engage an Iron Golem (or any enemy with high defense; difficulty boss tile).
  2. Watch the damage numbers from a starter Strike.
- **Pass:**
  - [ ] No card with positive damage shows "0" damage in the floating text.
  - [ ] HP bar moves on every attack card.

### 3.2 `heroDefenseMultiplier` is applied (B.6 / BUGS-COMBAT C-3)
- **Was broken:** Mage's 0.8 (-20%) and Iron Body passive (+10%) were dead config — the multiplier was stored on CombatState but never used.
- **Now expected:** Effective defense = `heroDefense * heroDefenseMultiplier`. Higher multiplier = less damage taken.
- **Repro (mage):**
  1. Mage run → enter combat → cast Arcane Shield (gain armor).
  2. Take a hit; compare the visible damage taken to a similar warrior run.
- **Pass:**
  - [ ] Mage takes more damage per hit than warrior with identical armor (because mage's mult is 0.8).
  - [ ] (Warrior) Iron Body passive reduces damage taken slightly (+10% defense efficiency).

---

## Section 4 — Tile adjacency synergy buffs (B.1)

### 4.1 Adjacent terrain buffs apply in combat
- **Was broken:** Planning-overlay tooltips advertised damage/loot/event/HP/XP bonuses from adjacent tile pairs, but the buffs were computed and never consumed by the systems.
- **Now expected:** `loop-started` propagates `activeBuffs` to CardResolver, CombatLoot, InlineEvents, RestSiteSystem, MetaProgressionSystem, EventResolver.
- **Repro:**
  1. Planning phase → place an adjacency the tooltip claims gives "+10% damage".
  2. Note enemy HP before combat.
  3. Confirm and play through a combat on a buffed tile.
- **Pass:**
  - [ ] Damage numbers are visibly higher than the same combat in an unbuffed loop (use the same first card for comparison).
  - [ ] Loot/HP/XP bonuses tied to adjacencies show up in their respective payouts.

---

## Section 5 — Deck & card upgrades

### 5.1 Per-instance card upgrade tracking (84e0545)
- **Was broken:** Upgrading one copy of a card upgraded **all copies** of that ID (e.g., upgrading one Strike upgraded all Strikes). Shop upgrade modal also kept showing already-upgraded cards.
- **Now expected:** `deck.upgraded: boolean[]` aligned with `deck.active`, so each slot tracks its own flag.
- **Repro:**
  1. Start a run with multiple Strikes in the deck.
  2. Visit a shop → Upgrade Card → upgrade ONE Strike.
  3. Open the deck editor.
- **Pass:**
  - [ ] Only the upgraded slot shows the "+" / golden frame; other Strike slots are unchanged.
  - [ ] Re-entering the shop's upgrade modal hides the already-upgraded slot.
  - [ ] In combat, the upgraded copy fires its upgraded effects/cooldown; other copies fire base.

### 5.2 Combat HUD bars update during battle (d57fe49)
- **Was broken:** HP/stamina/mana bars stayed visually full and the value text was empty for the entire fight, snapping to real values only on combat end.
- **Now expected:** Bars and numbers tween smoothly each tick.
- **Repro:** Any combat. Watch the three resource bars.
- **Pass:**
  - [ ] HP, stamina, and mana bars deplete/refill in real time.
  - [ ] Numeric text under each bar updates every frame.
  - [ ] No initial "full bar" flash before the first hit.

---

## Section 6 — Scene navigation hardening

### 6.1 Deck Editor and Relic Viewer return cleanly (CR-01 / f95f803)
- **Was broken:** `scene.wake()` against a paused parent left the parent permanently frozen → black screen.
- **Now expected:** Scenes detect parent state (sleeping vs paused) and call the correct API. Tested across all four open paths.
- **Repro for each path:**
  - From Game (press **D**)
  - From Pause Menu (ESC, then Deck Editor)
  - From Shop (Open Deck Editor button)
  - From Planning Overlay (sleep/launch path)
- **Pass for each:**
  - [ ] Open the Deck Editor; press **D** or the Done button.
  - [ ] Parent scene resumes — input works, audio resumes, no black-screen freeze.
  - [ ] Same test for Relic Viewer (**R** to open).

### 6.2 BuildingPanel return doesn't lock CityHub (HI-14 / f95f803)
- **Was broken:** CityHub disabled its input on building click; closePanel ran `scene.start('CityHub')` (full restart) which restored input but caused audio glitches and re-renders. After a partial fix it could leave CityHub permanently un-clickable.
- **Now expected:** closePanel uses resume + stop; CityHub re-enables its input on resume.
- **Repro:**
  1. CityHub → click any building (Library, Forge, Storehouse, Workshop).
  2. Close the panel (X or back).
- **Pass:**
  - [ ] CityHub responds to clicks immediately after close.
  - [ ] No audio gap or restart flash when returning.

### 6.3 100ms backdrop click-through guard (D.2 / 1f0901c)
- **Was broken:** Card detail popup created an interactive backdrop in the same frame as the click that opened it → backdrop swallowed the click and dismissed the popup instantly on touch.
- **Now expected:** New `createDelayedBackdrop` helper enforces 100ms before backdrop becomes interactive.
- **Repro (preferably touch device or fast click):**
  1. Hover over any card in deck/shop/loot → tap or click rapidly.
- **Pass:**
  - [ ] Card detail popup stays open until you tap the backdrop a second time.

### 6.4 RelicViewer has its own backdrop (LO-09 / 1f0901c)
- **Repro:** Press **R** during a run.
- **Pass:**
  - [ ] An opaque backdrop covers the game view; clicks on the underlying HUD don't fire while the viewer is open.

### 6.5 Hover doesn't override keyboard nav in Character Select (LO-07)
- **Repro:** Character Select → press LEFT/RIGHT to switch class → move the mouse over the un-selected card without clicking.
- **Pass:**
  - [ ] The selection follows the keyboard, not the hover.

### 6.6 MainMenu fog tween loops seamlessly (LO-08)
- **Repro:** Sit on Main Menu for ~30 seconds and watch the background fog.
- **Pass:**
  - [ ] No visible "snap" when the tween repeats; fog drifts continuously.

---

## Section 7 — Planning overlay polish

### 7.1 Infinite horizontal scroll on the loop strip (805914b)
- **Repro:**
  1. Enter planning phase (between loops).
  2. Drag the strip far to the left or right.
- **Pass:**
  - [ ] Strip wraps end-to-start cleanly with no edge clamp.
  - [ ] Mouse-wheel over the strip scrolls horizontally.
  - [ ] A short nudge (<4 px) does NOT place a tile; a tap on a tile does.

### 7.2 Buffer tiles render in the strip (61eb2a3)
- **Repro:** Same view; the 5-slot buffer should be visible at the loop boundary.
- **Pass:**
  - [ ] Buffer tiles are dimmed (alpha ≈ 0.35) and not interactive.
  - [ ] The number of visible tiles equals the actual loop length; no jump at the wrap point.

### 7.3 TileVisual synergy edges don't thrash (D.12.n / ME-16)
- **Repro:** Plan a tile next to others that activate adjacency synergies.
- **Pass:**
  - [ ] Synergy edges (the colored sides) appear/disappear cleanly when you add or remove the neighbor; no flicker.

### 7.4 Tile-points refund bug stays fixed (3a83c84)
- **Was broken:** "Start Loop" didn't sync tilePoints back to RunState; the next planning phase showed stale values.
- **Repro:** Spend tile-points placing tiles → confirm planning → enter the next planning phase.
- **Pass:**
  - [ ] Tile-points balance is correct (matches what you actually had after the previous spend).

---

## Section 8 — Data integrity & content

### 8.1 Real card IDs in enemy drops (E.1)
- **Was broken:** `enemy-drops.json` referenced phantom card IDs like `berserk` and `quick-strike` that didn't exist in `cards.json`.
- **Now expected:** Drops resolve to real cards: `berserker`, `counter-strike`, etc., and Iron Golem / Blood Reaver / Lich King / Ancient Dragon / Swamp Hydra have real drop tables.
- **Repro:** Defeat any of the bosses listed; check the loot screen.
- **Pass:**
  - [ ] Card drops show valid art and tooltips (no missing assets, no "[unknown card]").

### 8.2 Volcano tile no longer offered (E.12.b)
- **Was broken:** Workshop tier 3 unlocked `volcano` which had no tile definition.
- **Repro:** Upgrade Workshop to tier 3 → check the unlocks list.
- **Pass:**
  - [ ] No volcano tile is unlocked; only valid tiles appear.

### 8.3 Dark Mage drops essence, not crystal (E.12.d)
- **Repro:** Defeat a Dark Mage.
- **Pass:**
  - [ ] Material drop is essence (matches graveyard tile theme), not crystal.

### 8.4 Mage class has its own synergies (E.12.m)
- **Repro:** Mage run → in combat, play `fireball` then `chain-lightning` (and similar pairings).
- **Pass:**
  - [ ] Synergy banner fires for at least these pairs:
    - fireball + chain-lightning
    - arcane-shield + fireball
    - mana-drain + soul-rend

### 8.5 Bone material icon shows actual bone art (HI-08 / E.5)
- **Repro:** Earn bone material from a graveyard or skeleton encounter. View it in CityHub HUD or BuildingPanel cost widgets.
- **Pass:**
  - [ ] Icon is a bone, not a stone.

---

## Section 9 — Quality-of-life HUD/UI

### 9.1 LoopHUD doesn't have ghost icons (HI-07 / D.5)
- **Repro:** Scroll the camera (during planning movement). Watch the gold and heart icons in the HUD.
- **Pass:**
  - [ ] Exactly one gold icon and one heart icon visible; nothing scrolls with the world.

### 9.2 Loop celebration handles rapid completions (HI-13 / ME-09)
- **Repro:** Set game speed to 3x and complete loops quickly.
- **Pass:**
  - [ ] "LOOP N COMPLETE" texts don't stack/overlap.
  - [ ] No console errors when transitioning scenes during a celebration.

### 9.3 Card-queue rebuild waits for play animation (D.12.h / ME-08)
- **Repro:** 3x speed combat with a small deck so cards play rapidly.
- **Pass:**
  - [ ] Cards don't appear in two places at once.
  - [ ] Queue rebuild visibly happens between animations, not on top of them.

### 9.4 Collection scene scroll resets per tab (D.12.j / ME-11)
- **Repro:** Open Collection (from CityHub) → scroll to bottom of Cards tab → switch to Bosses.
- **Pass:**
  - [ ] Bosses tab opens scrolled to the top.
  - [ ] Wheel scrolling works on each tab; no acceleration after re-opens.

### 9.5 Shop modal cleans up on close (D.12.k / ME-13)
- **Repro:** Open shop → enter and close the upgrade/remove/reorder modals several times.
- **Pass:**
  - [ ] No visual cruft accumulates in the shop background.

---

## Section 10 — Build & dependency

### 10.1 Vendor chunk split (F.1 / 1f0901c)
- **Repro:** `npm run build` → check `dist/` size breakdown.
- **Pass:**
  - [ ] Phaser is in its own `phaser-vendor.*.js` chunk (~1.48 MB).
  - [ ] Game code chunk is around 225 KB.

### 10.2 nanoid is a direct dependency (A.6)
- **Repro:** Inspect `package.json` dependencies block.
- **Pass:**
  - [ ] `nanoid` listed under `dependencies` (currently `^5.0.0`).
  - [ ] `npm ci && npm test` from a clean install succeeds.

### 10.3 Test suite + typecheck baseline
- **Repro:**
  ```sh
  npm test
  npx tsc --noEmit
  ```
- **Pass:**
  - [ ] `Tests  422 passed (422)`.
  - [ ] `tsc --noEmit` exits 0.

---

## Section 11 — Migration & save compatibility

### 11.1 RunState v1/v2 → v3 migration loads cleanly (84e0545 + 3ce45fe)
- **Was broken history:**
  - 84e0545 added v1 → v2 (per-instance upgraded flags).
  - This sweep added v2 → v3 (`loop.tiles` shape coerced, `seed` backfilled).
- **Repro (manual):**
  1. Use browser DevTools → Application → IndexedDB → `keyval-store` → `active-run`.
  2. If you have a v1 save lying around (from before 84e0545), reload the game → Main Menu → Continue Run.
  3. Verify the run plays without errors and the deck still works.
- **Pass:**
  - [ ] Older saves migrate silently (no console error).
  - [ ] After migration, IDB shows `version: 3` on the saved blob.
  - [ ] If a save predates `seed`, it gets backfilled from `runId` (deterministic for that runId).

### 11.2 MetaState v4 → v5 migration backfills `className` (B.3+B.4)
- **Was broken:** `RunHistoryEntry` had no `className`. Tavern best-run merged classes.
- **Repro:**
  1. With a MetaState that has run history from before this change, load the game.
  2. Open Tavern → run history panel.
- **Pass:**
  - [ ] Old entries display `warrior` (default backfill); new entries show their actual class.
  - [ ] No console errors.

---

## Section 12 — Soak test (do this last, ~30 min run)

A single long mage run that exercises most of the systems above:

1. New Run → **Mage** → start.
2. Plan loop 1 with a synergy pair → confirm.
3. Play through to the first boss; safe-exit (you should see Mage XP increment in CityHub).
4. New mage run; this time **die** to the boss → return to City.
5. Verify:
   - [ ] Mage XP increments on safe exit (Section 2.1)
   - [ ] Materials are partially retained on death (existing behavior; sanity check)
   - [ ] Run history shows TWO mage entries (Section 11.2)
6. Mid-run, mid-combat, refresh tab → Continue Run (Section 1.1, 1.2).
7. While in CityHub, ESC → settings → flip auto-save → run again to confirm Section 1.3.
8. Plan a buffed adjacency, fight on it, confirm damage is higher (Section 4.1).

---

## Out of scope / deferred

The following items from FIXES.md were intentionally not addressed in this sweep. Listed here so a tester knows NOT to reject the build for them:

- **A.1 / HI-01** — Legacy `Game.ts`, `MapManager`, `Player`, `RewardScene`, `PostCombatScene`, etc. are still registered. They are unreachable but present.
- **A.3** — Six conflicting `RunState` interfaces in EventResolver/BossSystem/RestSiteSystem/ShopSystem/TreasureSystem still exist. Adapter pattern still in use.
- **A.7** — Many `(state as any)` casts remain.
- **B.7 + B.8 (RNG seed wiring)** — Some `Math.random()` calls still exist (CombatLoot, EnemyAI random damage variation, Tavern seed display). Determinism for replays is still incomplete.
- **C.3 / H-12** — `(currentRun as any)._lastBossDefeated` was replaced with a typed `loop.lastBossDefeated` in an earlier commit (verify), but the wider transient-field cleanup hasn't been done.
- **CR-02 / two AudioManagers** — Settings volume slider behavior may still mismatch the live audio path; verify before shipping.
- **CR-05** — Click-through guards added to Card Detail Popup and RelicViewer; the rest of the overlay set (PauseScene, ShopScene, etc.) still uses immediate-interactive backdrops. Touch users may see fast-click pass-through on some overlays.

If any of these items affect your release gate, schedule a follow-up sweep.

---

## Sign-off

| Section | Tester | Date | Pass / Fail | Notes |
|---|---|---|---|---|
| 1 — Run lifecycle | | | | |
| 2 — Class & meta | | | | |
| 3 — Combat math | | | | |
| 4 — Adjacency buffs | | | | |
| 5 — Deck & cards | | | | |
| 6 — Scene navigation | | | | |
| 7 — Planning polish | | | | |
| 8 — Data integrity | | | | |
| 9 — HUD/UI QoL | | | | |
| 10 — Build & deps | | | | |
| 11 — Migrations | | | | |
| 12 — Soak test | | | | |

**Build:** _commit hash_ ____________
**Tester:** ________________________
**Date:** __________________________
**Verdict:** ☐ PASS ☐ PASS WITH MINOR ☐ FAIL
