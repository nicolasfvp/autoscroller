# Performance Audit

## Summary
- Likely top 3 wins for low-end PCs:
  1. **Stop allocating arrays/objects every HUD update** (CombatHUD + LoopHUD redraw 60×/s, allocate dozens of small objects/strings each call → constant GC churn on weak hardware). BIG.
  2. **Re-encode huge static assets** (`wind.wav` 8.1MB, `bg_battle_graveyard.png` 5MB, `deck-frame.png` 2.3MB, `background-tile-selection.png` 1.3MB). Preloader pulls all of this upfront for every session, blowing GPU texture memory and load time on low-RAM machines. BIG.
  3. **Remove `forceSetTimeOut: true`** in `src/main.ts:48` — bypasses rAF in favor of setTimeout, hurting frame pacing on every machine and starving the GPU on low-end Intel iGPUs. MED → BIG (depends on browser).

Other meaningful wins below.

## Findings

### [HIGH] Phaser game runs on setTimeout instead of requestAnimationFrame
**Where:** `src/main.ts:47-50`
**Cost:** Frame pacing irregular; competes with other timers; modern browsers throttle/coalesce setTimeout heavily, especially on battery; cannot align with the GPU vsync, so the canvas redraws either too often (wasted GPU) or too rarely (jank). Low-end Intel iGPUs are most affected.
**Repro:** Every frame, all scenes. Worst when other tabs run timers.
**Fix sketch:** Drop the `fps: { forceSetTimeOut: true }` block. The comment says it's to keep ticking when backgrounded, but you already force 1x speed when `document.hidden` in `CombatScene.update` and `GameScene.update`, so the rAF throttling there is harmless. If you absolutely need the wall-clock catch-up, do it on `visibilitychange` instead.
**Trivial?:** yes

### [HIGH] CombatHUD.update allocates ~3 arrays + dozens of strings per frame
**Where:** `src/ui/CombatHUD.ts:365-465`, called by `CombatScene.update` at 60Hz
**Cost:** Every frame:
- `computeHeroChips(state)` → new `EffectChip[]`, `aggregateAuras` builds a new `Map`, then `[...map.values()]` → new array; each chip is a new object with 5 string fields. (`src/ui/EffectIcons.ts:56-74,88-144`)
- `computeEnemyChips(state)` → same again, plus `stackPairs` array literal each call (`EffectIcons.ts:149-176`).
- `attrValues` record literal allocated every tick (`CombatHUD.ts:402-408`).
- `setText` unconditionally on `enemyNameText` even when name didn't change (`:418`).
- `cooldownGraphics.clear()` + redraw 5–6 primitives every frame (`:432-460`) — Graphics.clear is cheap but redrawing the slice + 3 circles forces full Graphics geometry rebuild + texture re-upload every tick.
- Two `layoutChips` calls iterating `CHIP_POOL_SIZE * 2 = 20` chip containers, calling `setText`/`setColor` even when nothing changed.

In a 5-minute fight at 60fps that's roughly 100k object allocations and ~300k strings.
**Repro:** Every CombatScene frame.
**Fix sketch:**
- Compute chip arrays into pre-allocated `EffectChip[]` pools owned by CombatHUD (reset length to 0, fill in place, no `.push` on new arrays). Pass the existing array in as an out-param.
- Replace `aggregateAuras`' `new Map()` with a per-instance reusable Map (`.clear()` then refill).
- Diff `state.enemyName`, `state.heroDefense`, each stat, etc. against last-applied; skip `setText` when unchanged. The cooldown arc is the only thing that truly changes every frame.
- Throttle cooldownGraphics rebuild — only redraw when `Math.round(progress * 100)` or text changes.
- The `displayedStats` diff at line 411 is good — apply the same pattern to enemyHP/maxHP/heroHP/maxHP labels and the chip layouts (chips change ~once/sec, not 60×/s).
**Trivial?:** no, but each piece is small (~30min total)

### [HIGH] LoopHUD.update rebuilds material string and runs full stats resolver every frame
**Where:** `src/ui/LoopHUD.ts:402-436`, called from `GameScene.update`
**Cost:** Every frame on the world map:
- `const MAT: Record<string,string> = {…}` literal alloc.
- `Object.entries(runState.economy.materials ?? {})` → new array + `.filter()` → new array + `.slice(0,5)` → new array + `.map()` → new array + `.join('  ')` → new string.
- `extractStatusRowData(runState)` calls `resolveHeroStats` which allocates a `ResolvedHeroStats` object (`src/systems/hero/HeroStatsResolver.ts:30-43`) and reads `h.statDeltas ?? {}` (default object literal alloc when missing).
- `applyStatTween` is called 4× per frame; while it bails on `currentValue === newValue`, it `parseInt(txt.text, 10)` every call which allocates internally.
- Unconditional `setText` on 6+ text objects (gold, loop, diff, hp text, tp text, materials).
**Repro:** Every world-map frame.
**Fix sketch:**
- Hoist `MAT` to module scope (it's already const — just move it out of the function).
- Cache last-rendered gold/tp/loopCount/etc. and skip `setText` when unchanged.
- Cache material row by a join-key (e.g. encode counts into a single integer) and only rebuild the string when it changes.
- For stats, cache the last `RunState.hero` reference + `statDeltas` reference and skip resolution when neither identity changed (mutations replace the deltas object in this codebase, so identity-compare is safe).
**Trivial?:** yes for cache-on-change; pool array for materials is medium

### [HIGH] Audio asset sizes — wind.wav is 8.1MB uncompressed
**Where:** `public/assets/audio/wind.wav` (8.1MB), `theme-song.mp3` (2.1MB), `walk-slowly.mp3` (2.2MB), `walk-forward.mp3` (1.3MB), `town-song.mp3` (1.4MB). Preloaded in `src/scenes/Preloader.ts:205-213`.
**Cost:** ~15MB of audio downloaded + decoded into memory before MainMenu appears. PCM decode of 8MB WAV is ~80MB in RAM on iOS/Android (Phaser uses WebAudio decodeAudioData). On a 4GB-RAM machine this often triggers Chrome's "Out of memory" tab kill.
**Repro:** Every cold load.
**Fix sketch:**
- Re-encode `wind.wav` as a 64–96kbps mono OGG/MP3 loop — should drop to ~150KB.
- Move all non-menu audio (`walk-forward`, `walk-slowly`, `theme-song`, ambience, sfx) out of Preloader and load them inside `GameScene`/`CombatScene` preload hooks. Players who never start a run never pay for combat audio.
**Trivial?:** medium (re-encoding via ffmpeg is one-line; refactor of preload paths is ~1h)

### [HIGH] Battle background PNGs are uncompressed; one is 5MB
**Where:** `public/assets/backgrounds/bg_battle_graveyard.png` (5.0MB), `bg_battle_forest.png` (2.5MB), `public/assets/ui/panels/deck-frame.png` (2.3MB), `background-tile-selection.png` (1.3MB), `public/assets/buildings/backgrounds/shop.png` (2.8MB), `forge-table.png` (1.3MB).
**Cost:** Each 5MB PNG decompresses to ~4MP × 4 bytes = ~16MB on GPU. Six of these means ~50MB VRAM just for backgrounds. Low-end Intel iGPUs share 128MB-512MB system RAM as VRAM — this can OOM the GPU driver and force a fallback path.
**Repro:** Asset load (any session that opens battle/shop scenes).
**Fix sketch:** Re-export at 800x600 (game canvas resolution) as JPEG quality 80 or WebP. `bg_battle_graveyard.png` should be ~80KB at that target. Phaser supports WebP natively. Same for the UI panel PNGs — they're full-screen art that doesn't need a transparent alpha channel.
**Trivial?:** yes (sharp/imagemagick batch script)

### [HIGH] Bundle: mqtt.js bundled into main entry; ~50KB+ wasted for non-daily players
**Where:** `vite.config.ts` only chunks Phaser. `dist/assets/index-*.js` is 213KB and includes the mqtt client even though it's only used in Daily Run mode.
**Cost:** Every player downloads and parses mqtt.js + its dependencies (Buffer polyfills, stream polyfills) on first load. Daily Run is opt-in.
**Repro:** First load, every player.
**Fix sketch:** Make `MqttClient.ts` import `mqtt` dynamically: `const mqtt = (await import('mqtt')).default;` inside `connectWithFallback`. Or add to manualChunks so it splits into its own chunk and is preloaded only by daily-mode scenes. Either approach cuts initial bundle ~50-80KB compressed.
**Trivial?:** yes (1 line change to dynamic import)

### [MED] GameScene.update spreads/filters tiles array every frame
**Where:** `src/scenes/GameScene.ts:304-377` (`update` + `syncRunState`)
**Cost:** Every frame:
- `loop.tiles.filter((t) => t.type !== 'buffer').length` (line 346) — new array allocation just to get a count.
- `syncRunState` (line 354) does `[...this.loopRunState.loop.tiles]` (line 359, full-array spread copy back into `run.loop.tiles`), `Object.entries(materials)` + iteration (line 374), builds new `inv` Record from `tileInventory` (lines 366-370). Loop tile arrays are 12-30 entries, materials ~7 entries — small but constant per-frame churn.
- `updateTilePool` (line 531) iterates the pool Map (~30 tiles) once for delete checks then again for adds; that's fine, but `for (const [gi, tv] of this.tilePool)` allocates pair-arrays — use `forEach`/`Map.keys`+`get`.
**Repro:** Every world-map frame.
**Fix sketch:**
- Cache `nonBufferCount` on `LoopRunner` and only invalidate when tiles array mutates (planning phase). Expose via `getNonBufferCount()`.
- Move `syncRunState` to fire only on real events (tile entered, loop completed, combat ended) instead of every frame. Hero position can be set on the sprite directly without round-tripping RunState.
**Trivial?:** no (touches sync semantics) but high value

### [MED] CombatEngine.tick allocates two `CardEffect[]` arrays every tick
**Where:** `src/systems/combat/StatusEffects.ts:232-244` (`collectAuraTicks`) and called twice per tick in `CombatEngine.tick` (`src/systems/combat/CombatEngine.ts:104-107`).
**Cost:** Even when both arrays are empty, a `[]` literal is allocated. Multiplied by hero+enemy auras for a 5min fight @ 60fps = 36000 array allocations per side.
**Repro:** Every combat tick.
**Fix sketch:** Accept a reusable out-array as a parameter: `collectAuraTicks(auras, outArr)` and clear with `outArr.length = 0` before use; CombatEngine owns two pre-allocated arrays.
**Trivial?:** yes

### [MED] CardQueueDisplay.rebuild creates and destroys 3 full Card containers each card play
**Where:** `src/ui/CardQueueDisplay.ts:66-128` + `createCardVisual` (`src/ui/CardVisual.ts:46-292`)
**Cost:** Each `createCardVisual` builds ~8-12 Phaser GameObjects (Container, Rectangle, Text×4-6, Image, Graphics). On every card play the queue rebuilds 3 cards (`VISIBLE_COUNT=3`), so per card play ~30 GameObjects are allocated + 30 destroyed. Combat with 60 card plays creates/destroys ~1800 GameObjects. Each one has its own input listener, tooltip via `attachKeywordHover` (which sets a 2-second timer), and event handlers.
**Repro:** Every card play in combat.
**Fix sketch:** Pool 4 card visuals (3 visible + 1 incoming buffer); reuse by calling a new `updateCardVisual(container, cardId, scale)` instead of full destroy + create. Skip the keyword-hover attachment in CombatScene (already guarded at line 281, good) — but the `setInteractive` and pointer listeners can be skipped in combat too.
**Trivial?:** no (~2h refactor)

### [MED] CardVisual creates new tooltip listeners on every card render
**Where:** `src/ui/CardVisual.ts:281-286` (`attachKeywordHover`)
**Cost:** Every card creation in non-combat scenes attaches a hover-tooltip that registers timers + listeners + computes `formatCardDescription` again (the very same string already rendered above via `getEffectiveDesc`). In DeckBuilder/CardLibrary which render 30-60 cards, this is hundreds of listeners.
**Repro:** Opening Deck/Collection/CardLibrary scenes.
**Fix sketch:** Reuse the already-formatted description string already in scope (`getEffectiveDesc(card, false)` was just called for the on-card description — pass it instead of recomputing). Also lazy-attach: only register the pointerover handler that creates the tooltip timer on demand instead of unconditionally.
**Trivial?:** yes (reuse the local string)

### [MED] Hero animations rebuilt per scene mount (not pooled across CombatScene re-entries)
**Where:** `src/scenes/CombatScene.ts:285-293` and `src/scenes/GameScene.ts:181-186`
**Cost:** `this.anims.exists(...)` guards work but each CombatScene.create re-runs `anims.generateFrameNumbers` only on first miss — fine. However, hero spritesheets (`hero_walk`, `hero_idle`, etc.) are 64×64 frames preloaded as separate textures (`Preloader.ts:57-67`). That's 4 textures per class × 2 classes = 8 spritesheets at runtime. If you add more classes the count balloons. Atlas all hero spritesheets into one Phaser Atlas to halve texture switches.
**Repro:** Combat entry; texture rebinds per draw call.
**Fix sketch:** Pack hero sprites into a single atlas (TexturePacker / `phaser3-atlasify`). Reduces draw calls in CombatScene from ~6+ texture switches per render to 1.
**Trivial?:** no (asset pipeline change)

### [MED] getCardById uses linear .find over ~80 cards on every call
**Where:** `src/data/DataLoader.ts:55-57`
**Cost:** Called from CombatEngine 4 places, on every card play and reshuffle. Each call is O(N) with N=~80; not catastrophic but adds up in long fights and shows up on profiles.
**Repro:** Every card play in combat.
**Fix sketch:** Build a `Map<string, CardDefinition>` once in `loadAllData()`. Same for `getEnemyById`, `getRelicById`, `getTileConfig`.
**Trivial?:** yes

### [MED] Parallax tilePositionX grows unboundedly with worldOffset
**Where:** `src/scenes/GameScene.ts:333-338`
**Cost:** `this.bgSky.tilePositionX = heroWorldX * 0.1` — `heroWorldX` includes `worldOffset` which accumulates across every loop (line 472). After dozens of loops this becomes a large float; precision loss is the immediate concern (texture wobble), and Phaser uses this in `Math.cos`/`Math.fract` paths internally. Won't crash but degrades visual smoothness over hour-long runs.
**Repro:** Long sessions, many loops.
**Fix sketch:** Modulo the parallax position against the texture width: `this.bgSky.tilePositionX = (heroWorldX * 0.1) % this.bgSky.width`.
**Trivial?:** yes

### [MED] LoopHUD applyStatTween spawns scale-pulse tweens on every stat change
**Where:** `src/ui/LoopHUD.ts:332-361` (`applyStatTween`), called 4× per frame from `update()`
**Cost:** Stats are stable most of the time, so this is usually a no-op. But each tween creation allocates a Tween + Counter + listeners. The pulse tween is added as a second tween to `pendingTweens`. When a stat jitters by 1 (e.g., from a +1 STR aura ticking up & down), two tweens spawn per change.
**Repro:** When buffs/debuffs add/remove fast (e.g., short-duration auras).
**Fix sketch:** Debounce — only re-tween if change exceeds the previous target by more than 1 *or* if the prior tween has finished. Also early-bail when the prior tween's target equals `newValue`.
**Trivial?:** yes

### [LOW] DOM input element via `document.createElement` for card filter search
**Where:** `src/ui/CardFilterBar.ts:197-235`
**Cost:** A native `<input>` overlaid on canvas. On weak GPUs (especially older Intel/AMD integrated) every layer composite costs; a single DOM element over canvas isn't bad, but the resize listener (`window.addEventListener('resize', ...)`) and `delayedCall(0)` extra sync hops are workable. The bigger smell is that `scene.add.dom` is also used in `TavernPanelScene.ts:64` which Phaser handles via a DOMContainer (heavier).
**Repro:** CardLibrary/CardFilterBar visible.
**Fix sketch:** Acceptable as-is for desktop. Make sure `cleanup()` removes the resize listener (verify in shutdown path).
**Trivial?:** no fix needed, just awareness

### [LOW] AudioManager destroys+creates BaseSound on every transition (no pooling)
**Where:** `src/systems/AudioManager.ts:34-44, 47-50`
**Cost:** `oldSound.destroy()` + `audioScene.sound.add(key, ...)` does an extra WebAudio graph rewire. WebAudio is fast but on Firefox + Linux the underlying GStreamer reconnect has been observed to stall ~50ms.
**Repro:** Every scene transition that calls `transitionTo`.
**Fix sketch:** Cache `Phaser.Sound.BaseSound` instances by key (`Map<key, sound>`); fade volume down on the old one, fade up the new one, don't destroy. Resets volume on next use.
**Trivial?:** medium

### [LOW] CombatEffects.damageParticles/healParticles spawn N circles + N tweens, no pooling
**Where:** `src/effects/CombatEffects.ts:86-131`
**Cost:** Each call allocates `count=10` Circle GameObjects + 10 Tween objects. Called per damage event (not per frame), so impact is bursty rather than constant. On low-end GPUs a flurry of damage events (multi-hit boss) creates 30-60 circles at once.
**Repro:** Multi-hit damage / quick combos.
**Fix sketch:** If hot, pool circles in a ring buffer of ~64; reuse instead of destroying. Not critical.
**Trivial?:** medium

### [LOW] EventBus.emit uses Set.forEach with closure per emit
**Where:** `src/core/EventBus.ts:89-91`
**Cost:** `Set.forEach((fn) => fn(data))` allocates the arrow function closure each emit. Hot events: `combat:card-played` (1×/card), `combat:enemy-attack` (1×/attack). Not a per-frame allocation, but worth noting.
**Repro:** Combat events.
**Fix sketch:** Convert to `for…of` loop on the Set (no closure):
```ts
const ls = this.listeners.get(event);
if (ls) for (const fn of ls) (fn as Listener<GameEvents[K]>)(data);
```
**Trivial?:** yes

### [LOW] Vite manualChunks: phaser-only — mqtt + idb-keyval + nanoid stay in main
**Where:** `vite.config.ts:11-13`
**Cost:** Per-route splitting would help: mqtt only loaded for daily runs, idb-keyval only when saving. Combined ~20-30KB gz.
**Repro:** First load.
**Fix sketch:** Add `mqtt: ['mqtt']`, `idb: ['idb-keyval']` to manualChunks; consider dynamic imports for mqtt as in HIGH finding above.
**Trivial?:** yes

### [LOW] PlanningOverlay rebuilds tooltip on every hover and uses delayedCall(800ms) timer
**Where:** `src/scenes/PlanningOverlay.ts:831-877`
**Cost:** Acceptable; tooltips are user-driven. Mentioned only because each `showTooltip` allocates a new Text, Rectangle, Container — destroyed on `hideTooltip`. If user rapidly hovers across the inventory, that's noticeable but bounded.
**Repro:** Hovering tile cards.
**Fix sketch:** Reuse a single tooltip container; just retarget and update text. Not urgent.
**Trivial?:** medium

### [LOW] PauseScene / SettingsScene / many overlays use `add.text` heavily on entry
**Where:** Search results in introduction; `PlanningOverlay.ts` alone has ~20 `add.text` calls, `LoopHUD` ~30, `CombatHUD` ~21.
**Cost:** Each Text bakes a canvas-backed texture at creation. First entry to a scene incurs the canvas rasterization cost; with 30 texts that's ~30 canvases blocking on font measurement. Subsequent updates (`setText`) re-rasterize. Slow on low-end Chrome.
**Repro:** Scene open transitions, especially PlanningOverlay → noticeable hitch on weak machines.
**Fix sketch:** Where text is short, repeated, and uses a known font set (stat numbers, HP labels), consider Phaser Bitmap Text. Up-front cost is a single bitmap font asset, but per-Text rendering becomes ~free. Highest-impact targets: CombatHUD stat values, LoopHUD numbers, CardQueueDisplay card names.
**Trivial?:** no (asset pipeline + style refactor)

### [LOW] CombatScene.onCardPlayed creates a fresh closure for delayedCall every play
**Where:** `src/scenes/CombatScene.ts:74, 77, 90`
**Cost:** Each card play schedules 2-3 `delayedCall` events; each takes a fresh arrow function. Bounded by card play rate (~1 per second worst case).
**Repro:** Every card play.
**Fix sketch:** Negligible; not worth fixing unless hot in profile.
**Trivial?:** yes but skip

## Notes on items checked but not flagged
- **Texture caching**: `this.textures.exists(key)` checks are present everywhere images are added; reload guards look solid.
- **Tween cleanup**: LoopHUD, CombatHUD, CardQueueDisplay all track and stop in-flight tweens on destroy. Good hygiene.
- **Scene shutdown listeners**: most scenes register `shutdown` handlers that clean up event bus subscriptions. CardFilterBar listeners need verification (LOW item above).
- **Background-tab safety**: both CombatScene and GameScene force speed=1 when `document.hidden`. Good.
- **No `setInterval` in scenes**: only used in DailyRunBroadcaster/Ticker which are opt-in.
