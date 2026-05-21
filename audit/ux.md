# UX Flow Audit

## Summary

### Top 3 highest-friction moments
1. **First-run players who pick "New Run" land in CharacterSelect → DeckBuilder → Tutorial → CityHub before ever seeing combat.** The Tutorial only fires AFTER class+deck are chosen (`CharacterSelectScene.ts:307`), so a brand-new player must pick a class and build a 5-card starter deck with zero context for what cards mean. The tutorial then explains the things they already had to guess at, and only then lands them at the village (not in a run).
2. **Settings are unreachable from the Main Menu.** A new player who wants to mute audio, change game speed, or even just see what options exist has to start a run, press ESC for Pause, then click Settings (`PauseScene.ts:63-66`). There is no settings entry in MainMenu or CityHub. Audio kicks in at full configured volume on theme-song boot before the player ever sees a volume slider.
3. **CityHub vs run-start ambiguity.** After the tutorial completes (or on subsequent boots) the player lands in CityHub/THE VILLAGE, which has six buildings, materials top-bar, Collection, Change Hero — but no "Embark" / "Start Expedition" button. To begin a run the player must click "Change Hero" (which sounds like an edit action, not a start), and then they're back in CharacterSelect. Returning players have a "Continue Run" path from MainMenu only — once they're in CityHub, the only way out into a run is via Change Hero. This is a hidden primary CTA on the main hub.

### Top 3 missed-opportunity feedback moments
1. **Building upgrade success has a celebration but the unlocked items aren't surfaced anywhere visible later.** `BuildingPanelScene.ts:276` plays `playUnlockCelebration` for the first new item, but if multiple items unlock, the rest are silent. No badge, no "NEW" indicator on the Collection icon back in CityHub. Players don't realize they have new cards/relics until they happen to scroll the Collection.
2. **Boss-defeated → BossExitScene gives a binary choice ("Exit Run safely" vs "Continue") but the player never sees what tiles, relics, or shop options await them if they Continue.** They're choosing between known reward and a black box. The "loop grows by 3 tiles" tooltip is the only hint about scaling.
3. **Tile placement during planning has no "what does this tile do" mid-action feedback.** Tooltips were added (recent commit `633025d feat(planning): 800ms-hover tooltips`), but the click-to-select then click-to-place flow gives no preview of where reserved/adjacent slots would land before placement, and no warning if placement consumes the last copy. Successful placement only updates inventory count silently.

## Player flow map

```
Boot
 └→ Preloader (loads assets, checks saveManager → registry hint)
     └→ GlobalSound + SpeedPanelScene launched persistently
         └→ MainMenu
             ├ [saved run exists]  → Continue Run → GameScene (resumes)
             │                    or New Game → confirm-delete → CharacterSelect
             ├ [no saved run]      → New Game → CharacterSelect
             └ Daily Run (UTC)     → NicknameModal → GameScene (skips CharSelect)

CharacterSelect
 └→ confirmSelection() launches DeckBuilder as OVERLAY
     ├ Cancel → back to CharacterSelect
     └ Confirm → setRun() + saveManager.save() → TutorialScene
                  ├ [meta.tutorialSeen]    → CityHub (short-circuit, slideshow skipped)
                  └ [first run]            → topic-tab tutorial → Start Game → CityHub

CityHub (THE VILLAGE)
 ├ 6 buildings → BuildingPanelScene (upgrade) or TavernPanelScene (seed input → starts run!)
 ├ Collection → CollectionScene (Cards/Relics/Tiles/Bosses tabs)
 ├ Change Hero → CharacterSelect (this is the de-facto "Start Run" button)
 └ [no obvious Embark button]

GameScene (autoscroll loop)
 ├ HUD: gold, loop #, HP, TP, materials, deck/relic icons, loop progress bar
 ├ keydown D / R / ESC → DeckCustomization / RelicViewer / PauseScene
 ├ tile hit → CombatScene (paused, overlay)
 │  ├ Victory → resume GameScene
 │  └ Defeat → DeathScene
 ├ tile hit (Treasure/Event/Shop) → inline resolution or ShopScene/InlineEvent
 ├ loop complete → PlanningOverlay (or auto-skip if skipLoops>0)
 │  └→ Start Loop / Open Shop / Open Forge / Remove Mode / [D] deck / [R] relics
 └ boss defeated → BossExitScene (Exit safely vs Continue)

DeathScene → CityHub (or MainMenu for daily)
BossExit Exit → CityHub (or MainMenu for daily)

Persistent: SpeedPanelScene (bottom-left), GlobalSound
```

## Findings

### [HIGH] Tutorial fires after deck-building, not before
**Where:** `CharacterSelectScene.ts:307` (`this.fadeToScene(SCENE_KEYS.TUTORIAL)` AFTER `startRun()`)
**Friction or gap:** A brand-new player must pick a class (HP/STA/MP bars, no idea what "stamina" vs "mana" means here) and assemble a 5-card starter deck (cards with keywords like Burn/Slow/Vengeance) before the tutorial explains any of these systems. The DeckBuilder has a `Cancel` button that takes them back to CharacterSelect — but if they cancel out of confusion, they're stuck in a class-pick loop with no escape route to "wait, explain this first".
**Why it matters:** Highest-impact retention moment. New players bounce when their first interaction is a 5-slot puzzle with no rules explained. The Tier-0/Tier-1 distinction and gold-glow synergy hint exist (per MainMenu TIPS array) but the player meets them blind.
**Suggested fix:** Add a `tutorialSeen` check at MainMenu (after "New Game" click) — if false, route MainMenu → Tutorial → CharacterSelect → DeckBuilder → CityHub instead of CharacterSelect → … → Tutorial. Alternatively, gate just the Deck topic of the tutorial into a popover that fires when DeckBuilder opens for the first time.
**Trivial?:** no (route change touches 2 scenes)

---

### [HIGH] No Settings access from MainMenu or CityHub
**Where:** `MainMenu.ts:56-200` (no settings button); `CityHubScene.ts:160-180` (only Collection + Change Hero buttons); `PauseScene.ts:63-66` (only entry to Settings)
**Friction or gap:** Audio plays at boot at MetaState's saved volume — but a first-time player can't change it without (a) starting a run, (b) ESC, (c) Settings. If they don't know about Pause, they can't mute. Same for game speed and the "Reset All Progress" escape hatch.
**Why it matters:** Accessibility + first-impression. The theme song is the first thing a player hears; if they can't quickly mute it, they close the tab.
**Suggested fix:** Add a small gear icon in MainMenu (corner) and CityHub (top-right next to class XP) that launches `SettingsScene` with `parentScene` data so it routes back correctly. Trivial — same pattern as PauseScene's launch.
**Trivial?:** yes

---

### [HIGH] CityHub has no "Start Run" CTA
**Where:** `CityHubScene.ts:160-178` — bottom row is `Collection` and `Change Hero`; the de facto Start button is buried in TavernPanelScene (the `Prepare for your next expedition` panel with seed input).
**Friction or gap:** After death or safe exit, the player lands in CityHub. To start another run they must either (a) click Tavern → enter seed → submit (`TavernPanelScene.ts:42`), or (b) click "Change Hero" (which sounds like a settings action, not a start), or (c) navigate back to MainMenu somehow. "Change Hero" is being abused as the primary run-start path.
**Why it matters:** Retention loop. Death → CityHub → ??? is the entire moment-to-moment loop of the meta game, and the next-run action is hidden behind a misleading label.
**Suggested fix:** Replace "Change Hero" with a primary "Embark" / "Start Run" gold button (uses the existing `btn_start_loop` asset?) that routes to CharacterSelect. Move "Change Hero" into a small secondary control or merge with the class selection screen.
**Trivial?:** yes

---

### [HIGH] DeathScene shows what was lost more prominently than what's next
**Where:** `DeathScene.ts:158` (`'💀 All unbanked XP has been lost.'`) and `:162` (`'New unlocks available! Return to the city.'`).
**Friction or gap:** The death screen lists 4 stats + retained materials + an XP loss notice + a generic "new unlocks available" message that pulses but doesn't show *which* unlocks. The player gets one button: "Return to City". No "Try Again" / "Same Class Again" / "View What's New" shortcut.
**Why it matters:** Death is the highest-emotional-investment moment of the entire game. It's currently a forced funnel through CityHub with no immediate retry path; the player has to navigate back manually. Also no death-cause analysis ("you died because your deck had no defense cards" / "you lost 47 HP in the boss room").
**Suggested fix:** Add a "Start New Run" button alongside "Return to City". If `MetaProgressionSystem.bankRunRewards` returned any unlock IDs, surface them inline ("Unlocked: Heavy Hit (Forge T3), Bronze Scale (Shrine T1)") instead of the pulsing generic notice.
**Trivial?:** no (needs unlock-delta returned from bankRunRewards)

---

### [HIGH] No mid-run "where am I" / depth indicator
**Where:** `LoopHUD.ts` — shows Loop count, gold, HP, TP, materials, loop progress bar within the *current* loop, but no boss-distance / total-depth indicator.
**Friction or gap:** Loops cycle 1, 2, 3… with bossEveryNLoops gating boss spawns. The HUD shows the current loop number but not "X loops until next boss" or "Boss in: 2 loops". The difficulty multiplier badge (`x1.0`) hints at scaling but doesn't tell the player where they are in the meta-arc.
**Why it matters:** Players need a sense of pacing — am I 30 seconds from a boss or 5 minutes? Without that, every encounter feels random.
**Suggested fix:** Add "Boss in N loops" text near the loop counter, or paint the boss-loop's tile differently in the upcoming planning preview. Math is already in `diffConfig.bossEveryNLoops` and `loop.count` (`GameScene.ts:478`).
**Trivial?:** yes

---

### [MED] DeckBuilder Cancel from CharacterSelect leaves you stranded
**Where:** `CharacterSelectScene.ts:283-286` — Cancel callback only sets `deckBuilderOpen = false` and does nothing else.
**Friction or gap:** If the player cancels DeckBuilder (because they realized they want to read the tutorial first or change class), the deck overlay disappears but `selectedIndex` and class state remain. They have to re-click their class to reopen it. There's also no breadcrumb that they're mid-flow.
**Why it matters:** Minor confusion loop. The player thinks the Cancel just closed an inspection popup, not an aborted commit.
**Suggested fix:** Add a small "Back to class select" toast or visibly de-highlight the previously selected class on cancel. Even simpler: make the class card the trigger for *both* selecting and confirming, and label it "Pick Deck →" so the action is unambiguous.
**Trivial?:** yes

---

### [MED] Modal-opens-modal in PlanningOverlay
**Where:** `PlanningOverlay.ts:96-124` — deck/relic icons sleep the overlay and launch DeckCustomization / RelicViewer; shop/forge buttons do the same.
**Friction or gap:** Stacking overlays: PlanningOverlay sleeps → ShopScene → user clicks "Open Deck Editor" → ShopScene pauses → DeckCustomizationScene launches. To get back to placing tiles the player has to back out two levels. There's no breadcrumb showing "Planning > Shop > Deck".
**Why it matters:** Players forget where they are and accidentally Start Loop without finishing their plan, or get stuck in shop because they don't know which "back" closes which layer.
**Suggested fix:** Add a small "← Planning" / "← Shop" breadcrumb header on each overlay that tracks `parentScene`. Already passed via `init({parentScene})` so the data is there.
**Trivial?:** yes

---

### [MED] Pause is invisible from CombatScene
**Where:** `GameScene.ts:227-232` binds ESC to launch PauseScene. `CombatScene.ts` (`280-330`) does NOT bind ESC. Combat is `scene.pause(GameScene)` + `scene.launch(CombatScene)`, so the GameScene ESC handler is asleep.
**Friction or gap:** Player wants to pause during a boss fight to read a card or step away. ESC does nothing. They have to wait for combat to end or alt-tab.
**Why it matters:** Combat is the longest single-screen moment in a run. No pause = forced engagement = stress, especially with auto-resolving cards on cooldowns.
**Suggested fix:** Add `this.input.keyboard?.on('keydown-ESC', () => { this.scene.pause(); this.scene.launch(SCENE_KEYS.PAUSE); })` in `CombatScene.create()`. The existing PauseScene resume logic only knows about GameScene (`PauseScene.ts:92`); add a `parentScene` data param for re-routing.
**Trivial?:** no (needs PauseScene parent-aware resume)

---

### [MED] Settings has no keybind rebinding, no colorblind / motion options
**Where:** `SettingsScene.ts:32-65` — exposes SFX volume slider, SFX on/off, game speed (1x/2x), auto-save toggle, delete run, reset all.
**Friction or gap:** No: music volume separate from SFX (currently only "SFX Volume"; the theme song uses `AudioManager.transitionTo` at 0.4 hardcoded — see `MainMenu.ts:105`, `CityHubScene.ts:63`), colorblind palette toggle, reduced-motion (tweens fire regardless), text scale, keybind rebinding (D/R/ESC hardcoded), subtitles. The "?" GlossaryButton is keyboard-accessible only via mouse.
**Why it matters:** Accessibility — particularly for screen-tired players, low-vision, photosensitive (the fog/celebration tweens are heavy), and motion-sensitive players. Music volume is the most-asked setting.
**Suggested fix:** Add a Music Volume slider next to SFX (pipe to `AudioManager.setMusicVolume`). Add reduced-motion toggle that skips loop celebrations and parallax. Defer rebinding to a later milestone but expose at least these four: music volume, reduced motion, large text, colorblind palette (Shadowblade palette already exists per `StyleConstants.ts`).
**Trivial?:** no (touches AudioManager + tween gating across many scenes)

---

### [MED] Auto-save toggle is hidden but auto-save is the default behavior
**Where:** `SettingsScene.ts:139-143` — Auto-Save ON/OFF toggle. `GameScene.ts:242` — `saveManager.setupAutoSave(() => getRun())`.
**Friction or gap:** There's no confirmation that a save happened. No "Saved" toast after combat ends or a loop completes. If the player turns off auto-save, there's no "Save Now" button anywhere. The player has to trust that closing the tab will preserve state.
**Why it matters:** Save anxiety is real for roguelikes. A small "Saved ✓" badge after each loop completion would calm that.
**Suggested fix:** Add a tiny "Saved 12:34" timestamp in the HUD corner, updated on each successful `saveManager.save`. Add a "Save Now" button in Settings when auto-save is OFF.
**Trivial?:** yes

---

### [MED] Daily Run nickname modal pops on every Daily click, even after entry
**Where:** `MainMenu.ts:290-303` — `onDailyButtonClicked` always opens NicknameModal, even if there's a saved daily run.
**Friction or gap:** A player who already played their daily today and clicks "Continue Daily" gets a nickname prompt again, with their saved nickname pre-filled. Two clicks (Confirm) for what should be one (Continue).
**Why it matters:** Minor friction but happens every daily-run resume.
**Suggested fix:** Skip the modal when `savedDailyRun` exists and `ensureNickname()` returns a non-default value — go straight to `startDailyRun`. Add a small "Change nickname" link on the Daily entry.
**Trivial?:** yes

---

### [MED] Empty-state Collection has hints but no path to action
**Where:** `CollectionScene.ts:403-410` — locked Cards show `🔒` + `unlockHint` like "Forge T3" in tiny grey text.
**Friction or gap:** The hint says "Forge T3" but doesn't say *where the Forge is* or that it's a building in the village. A new player reading the Cards collection has no idea Forge ≠ shop. There's no "Visit Forge to unlock" CTA, just a label.
**Why it matters:** The Collection IS the meta-progression visualization. If players don't realize they can drive unlocks, they don't feel the meta loop pulling them back after death.
**Suggested fix:** Expand `unlockHint` to full sentences like "Upgrade Forge to Tier 3 (currently T1) to unlock this card. Forge is the red building in the village." Make `🔒` clickable → routes to that building's panel.
**Trivial?:** no (needs unlock-hint copy rewrite + building routing)

---

### [MED] BossExitScene "Continue" risk-reward is opaque
**Where:** `BossExitScene.ts:99-130` — Continue panel says "The loop grows by 3 tiles. Risk everything." + "Death means 10% materials, zero XP."
**Friction or gap:** The player doesn't know: how much harder is the next loop? What new tile types will appear? Will the boss change? Are there better shops/relics ahead? They're choosing between known (Exit reward shown) and unknown.
**Why it matters:** Boss-exit is the highest-stakes choice in a run. Players default to Exit because risk is unquantified — which kills the "one more loop" hook.
**Suggested fix:** Show a "Next-loop preview" panel: difficulty multiplier change ("x1.0 → x1.15"), tile-pool changes ("Lava tiles unlock"), and any pity-shop guarantees. Even a hint like "Next boss: ??? (unknown)" with a silhouette is better than nothing.
**Trivial?:** no

---

### [MED] No mid-run access to Settings or Tutorial replay outside Pause
**Where:** PlanningOverlay and ShopScene don't have a settings/help button visible. Combat doesn't either (just the `?` glossary).
**Friction or gap:** A player who needs to mute SFX mid-combat must lose by ESCing… except ESC doesn't work in combat (see [MED] Pause is invisible). They have to wait for combat end, then ESC.
**Why it matters:** Compounds the no-pause-in-combat finding.
**Suggested fix:** Add a small persistent gear icon next to the SpeedPanelScene (bottom-left, persistent across Game/Combat) that launches SettingsScene as an overlay. The SpeedPanelScene already proves this pattern works across scene swaps.
**Trivial?:** yes (similar to SpeedPanelScene architecture)

---

### [LOW] MainMenu rotating tip resets randomly each visit
**Where:** `MainMenu.ts:42` — `pickRandomTip()` chooses 1 of 12 tips per MainMenu mount.
**Friction or gap:** Helpful, but the tip changes every time the menu mounts (e.g., bouncing back from a quick run). A player might see the same tip 3 times in a row or never see half of them.
**Why it matters:** Minor — tips are a passive learning channel, not a blocker. But rotation feels random rather than progressive.
**Suggested fix:** Round-robin via a `MetaState.lastTipIndex` so each visit advances through the list. Each tip seen exactly once per cycle.
**Trivial?:** yes

---

### [LOW] Hover-only affordances on touch / mobile
**Where:** Throughout — `CharacterSelectScene.ts:127` (pointerover for class card selection), `PlanningOverlay.ts` recent tooltip hovers (`tooltipTimer`), `ShopScene.ts:173` (button hover lift), `MainMenu.ts:210` (button hover scale).
**Friction or gap:** None of these hover behaviors translate to touch. Touch users get no preview tooltips and no hover highlighting. They also see no class info before clicking — first tap selects, second tap confirms (per `CharacterSelectScene.ts:120`).
**Why it matters:** Game is browser-deployed (Phaser 3 + Vite), so mobile/tablet players will land here. Without touch affordances, every tap commits the action.
**Suggested fix:** Detect touch (`'ontouchstart' in window`) and convert single-tap-select into a long-press-to-preview / tap-to-confirm pattern for class cards and tile-placement. Tooltips can fire on tap-and-hold via `pointerdown` timer.
**Trivial?:** no

---

### [LOW] PlanningOverlay deck/relic icons sleep the overlay — can mid-planning state be lost?
**Where:** `PlanningOverlay.ts:97`, `:113` — `this.scene.sleep()` before launching DeckCustomization/RelicViewer.
**Friction or gap:** Sleeping a scene keeps its state intact, but a player might worry it doesn't. There's no visible "← back to planning" hint inside DeckCustomization either; the only exit is the D / ESC keys or the close button.
**Why it matters:** Player confidence — when modals stack, players don't always trust their work persists.
**Suggested fix:** Title the DeckCustomization/RelicViewer overlay with "Deck (planning paused)" when launched from PlanningOverlay so the context is explicit.
**Trivial?:** yes

---

### [LOW] Daily Run mode lacks a "what's the daily?" preview
**Where:** `MainMenu.ts:183-200` — Daily Run button shows just the UTC date and a "CONTINUE DAILY" label if there's a save.
**Friction or gap:** Player doesn't know what they're getting into. Class? Deck? Seed? Modifiers? They have to commit before seeing.
**Why it matters:** Daily is the social/competitive mode (ticker broadcaster suggests leaderboards). Players who don't know what today's daily looks like won't try.
**Suggested fix:** Below the Daily button, show "Today: Mage · Burn-focused deck · Seed 2026-05-21" as a one-liner. The class+deck are deterministic per `createNewDailyRun(meta)` so this is just a render of a pre-computed value.
**Trivial?:** no (needs daily preview metadata pulled from `createNewDailyRun`)

---

### [LOW] No "what's new" surfaced after a building upgrade ends
**Where:** `BuildingPanelScene.ts:267-279` — celebration fires only for `allNewItems[0]`; rest are silent.
**Friction or gap:** A T1→T2 upgrade can unlock 2+ items (cards + relics). Only one gets the celebration; the others are silently added to the unlock pool. No badge on the Collection icon back at CityHub.
**Why it matters:** Players miss meta-progress feedback and underestimate how much they're earning.
**Suggested fix:** Queue all celebrations in sequence, OR show a single summary card "3 new items unlocked: Heavy Hit, Bronze Scale, Berserker — view in Collection".
**Trivial?:** yes

---

### [LOW] CombatScene combatSpeed slider in persistent SpeedPanel — but speed setting from SettingsScene is also a "Game Speed" toggle
**Where:** `SettingsScene.ts:116-128` (Game Speed 1x/2x), `SpeedPanelScene.ts:50-58` (Map Speed + Combat Speed sliders).
**Friction or gap:** Two systems for speed: a binary 1x/2x in Settings (stored as `metaState.gameSpeed`), and per-run continuous Map/Combat sliders (stored as `run.mapSpeed` / `run.combatSpeed`). They don't reference each other. A player who set Settings to 2x and then drags the SpeedPanel slider to 1.5x sees no indication of which value wins.
**Why it matters:** Cognitive overhead — two sources of truth for the same concept.
**Suggested fix:** Drop the Settings game-speed toggle entirely (SpeedPanel covers it), OR make Settings the default and SpeedPanel an override with a "(default: 2x from Settings)" label.
**Trivial?:** yes (remove the toggle)

---

### [LOW] Tutorial replay from Pause doesn't highlight which topic the player just struggled with
**Where:** `PauseScene.ts:58-61` launches Tutorial with `replay: true`. `TutorialScene.ts:178` always starts on tab index 0 (Combat).
**Friction or gap:** Generic re-open. A player who died because they didn't understand keywords gets dropped on Combat tab (which they already know) instead of the Deck/Relic tab.
**Why it matters:** Minor — but tutorials replay is most useful right after confusion. Random landing wastes the moment.
**Suggested fix:** Track last-viewed tab in MetaState so replay opens where the player left it. Or, on replay-from-pause, default to the Loop/Tiles tab since planning is the most common confusion point.
**Trivial?:** yes

---

### [LOW] LoopHUD's deck/relic mini-buttons always launch even when run is mid-combat or planning
**Where:** `LoopHUD.ts:187-192` — `if (!scene.scene.isPaused()) { scene.scene.pause(); scene.scene.launch('DeckCustomizationScene'); }`.
**Friction or gap:** The HUD is shared between scenes via the same Container, so the deck button might fire during planning or combat depending on context. The `isPaused()` check is there but the launch hardcodes the scene key without `parentScene` — so closing returns to whichever scene the HUD currently belongs to, which may not match.
**Why it matters:** Minor — but the bug surface is real.
**Suggested fix:** Pass `parentScene: scene.scene.key` in the launch data so DeckCustomization can route back correctly.
**Trivial?:** yes

---

### [LOW] Inline event resolution flashes with no animation
**Where:** `GameScene.ts:415-431` — `case 'open-scene' / 'EventScene'`: calls `resolveInlineEvent`, syncs economy, drains pending loot, resumes traversal.
**Friction or gap:** The event resolves and the loot notification floats above the hero, but there's no "Event!" banner first, no description of what just happened ("You found a wandering merchant — +20 gold"). Just numbers.
**Why it matters:** Events are flavor moments. Burning them as silent stat changes wastes their narrative impact.
**Suggested fix:** Pop a 2-second event-result card with title + body + outcome. `resolveInlineEvent` already returns structured data; just render it.
**Trivial?:** no

---

### [LOW] Save & resume: closing tab mid-combat resumes to GameScene, not CombatScene
**Where:** `Preloader.ts:226` loads `savedRun`. `MainMenu.ts:235-240` calls `setRun(this.savedRun)` then `fadeToScene(GAME)`. Combat state isn't persisted (`CombatScene` mutates `run.hero.currentHP` but doesn't store the active engine).
**Friction or gap:** Player closes tab during a boss fight at 5% HP. Next launch: Continue Run → lands in GameScene mid-loop with 5% HP but no boss in front of them (boss tile was consumed before combat started). They walk into the next tile with chip damage.
**Why it matters:** Save-resume should be exact, not approximate. Losing the boss but keeping the HP loss is "lose-lose" from the player's perspective.
**Suggested fix:** Either (a) persist the active `CombatState` so re-launch resumes in CombatScene, or (b) restore HP to pre-combat snapshot when no combat resumes. Option (b) is simpler.
**Trivial?:** no

---

### [LOW] DeckBuilder synergy glow has no legend
**Where:** `DeckBuilderScene.ts` (gold glow described in tutorial body `TutorialScene.ts:46`).
**Friction or gap:** A first-time player sees gold-glowing cards in the deck builder with no in-context legend. The Tutorial mentions it, but only if they've completed it; replay-mode players who skipped that tab won't know.
**Why it matters:** Synergy is the core deckbuilding hook; if players don't notice the glow they pick random cards.
**Suggested fix:** Add a small legend chip near the DeckBuilder filter bar: "🌟 Gold-glow = synergy with current deck".
**Trivial?:** yes
