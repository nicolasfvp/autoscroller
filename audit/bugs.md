# Bug & Correctness Audit

## Summary
- 1 critical / 5 high / 6 medium / 4 low
- Top systemic risks:
  - LoopRunner mutates fields that aren't part of its declared `LoopRunState` shape (e.g. `runState.hero.currentHP`, `runState.relics`). Several relic effects fire against undefined fields and silently no-op or write NaN.
  - Several combat probability rolls (Hemlock Vial, Tarnished Mirror, Pandora's Embers) use `Math.random()` directly, bypassing the seeded RNG that the rest of combat goes through — breaks replay determinism and daily-run parity.
  - SaveManager.setupAutoSave handler is async-only; if the player closes the tab between `combat:end` and `await isAutoSaveAllowedByMeta()`, the save quietly never lands. Not a leak but a silent data-loss edge.

## Findings

### [CRITICAL] LoopRunner relic-healing branches mutate fields not present on LoopRunState
**Where:** `src/systems/LoopRunner.ts:137-157, 230-234`
**Issue:** `LoopRunState.hero` is typed as `{ xp: number }` (LoopRunner.ts:33). GameScene constructs the LoopRunState literally as `hero: { xp: run.hero.runXP || 0 }` (GameScene.ts:158). Three relic effects in LoopRunner — Travel Boots (line 137), Trailblazer's Brand (lines 150-156), Lodestone Pendant (line 230) — read `this.runState.hero.currentHP / maxHP / currentStamina / maxStamina / currentMana / maxMana` and `this.runState.relics`. None of those fields exist on the LoopRunState that's actually passed in.
Result: `Math.min(undefined, undefined + 1)` → `NaN`, then assigned back to a property name that doesn't exist on the object. The three relics never heal the hero at all, and `runState.relics ?? []` is always `[]` so the relic-presence check itself is always false (i.e., the effect would never even fire). Players who pick Travel Boots / Lodestone Pendant / Trailblazer's Brand get a dead relic.
**Reproduction:** Pick up Travel Boots on a run. Walk the hero across several tiles. Hero HP should rise +1 per tile; it doesn't move at all (the relic-presence check fails first because `runState.relics` is undefined on the LoopRunState).
**Impact:** Three relic effects in the wild are completely inert. Affects balance and player perception ("this relic does nothing").
**Fix sketch:** Either (a) widen `LoopRunState.hero` to include the fields LoopRunner needs and have GameScene pass the same object reference (or wire reads/writes through getRun()), or (b) pull these "on tile entered" relic checks into a small helper that takes the live RunState. The latter is cleaner because the actual relic list lives on RunState.relics.
**Trivial?:** no

### [HIGH] CombatEngine.tickActiveDoTs Hemlock Vial uses Math.random instead of SharedRNG
**Where:** `src/systems/combat/CombatEngine.ts:406`
**Issue:** `if (hemlockVial && Math.random() < 0.25)` adds a poison stack 25% of the time on each poison tick. Every other combat probability roll routes through SharedRNG (see ShopSystem.fisherYates, LootGenerator, LoopRunner.assignEnemies). Using `Math.random()` here means replays / daily runs are non-deterministic for any build that includes Hemlock Vial.
**Reproduction:** Two players seed the same daily run with poison + Hemlock Vial. Their combats diverge in poison-stack growth.
**Impact:** Breaks deterministic seeded play — important for the Daily Run mode that publishes results over MQTT.
**Fix sketch:** Replace `Math.random()` with `rand()` from `../SharedRNG`. One-line change.
**Trivial?:** yes

### [HIGH] RelicSystem Tarnished Mirror + Pandora's Embers use Math.random
**Where:** `src/systems/combat/RelicSystem.ts:214, 531, 532`
**Issue:** Three more `Math.random()` calls inside relic effect resolution: Pandora's Embers (line 214, pick a random DoT stack), Tarnished Mirror chance roll (line 531, 25% chance), Tarnished Mirror resource pick (line 532, stamina vs mana). Same determinism break as Hemlock Vial.
**Reproduction:** As above; any run with these relics will diverge between sessions even with identical seed.
**Impact:** Deterministic-replay and daily-parity break. Cross-client ticker would diverge if it ever attempted predictive simulation.
**Fix sketch:** Import `rand` from `../SharedRNG` and replace the three calls.
**Trivial?:** yes

### [HIGH] BossExitScene.confirmSelection ignores cancellation race; double-fire can double-bank
**Where:** `src/scenes/BossExitScene.ts:166-205`
**Issue:** `confirmSelection` is wired to pointerdown on the confirm button AND to keydown-ENTER / keydown-SPACE (lines 137, 140-141). There's no `if (this.transitioning) return` guard, no in-flight flag. If the player mashes Enter+click within one frame (or Enter twice while the async loadMetaState resolves), the function enters twice. The second entry re-runs `bankRunRewards` against the same `materialsEarned` and saves meta again — doubling banked materials.
**Reproduction:** On the Exit choice, hold Enter and click Confirm simultaneously. Meta storehouse will receive materials twice.
**Impact:** Economy duplication on safe-exit boss flow.
**Fix sketch:** Set `this.transitioning = true` (the field already exists) at the top of `confirmSelection`, and early-return if it's already true.
**Trivial?:** yes

### [HIGH] ShopScene buildMenu stacks `events.once('resume', ...)` handlers per pointerdown
**Where:** `src/scenes/ShopScene.ts:190-203`
**Issue:** Every pointerdown on the deck/relic buttons attaches a fresh `this.events.once('resume', () => this.buildMenu())`. The handler is `once`, so it does fire-and-forget — but: while a sub-scene is up, if the player somehow re-enters the click path (impossible normally, but the deck/relic buttons are still rendered behind the sub-scene if the sub-scene is transparent in certain states), multiple `once` handlers stack and all fire on the next resume. Each `buildMenu` call rebuilds the entire menu container, including new pointer listeners on freshly-created text objects. The stacking isn't fatal but it allocates throwaway GameObjects every time.
More importantly, the listener is registered inside the click closure rather than once at scene creation, so the pattern is fragile against future UI changes.
**Reproduction:** Open and close the deck editor 5 times via the shop. Each open registers a wake-handler that survives until next 'resume', so there's a short window where 5 handlers stack.
**Impact:** Allocation churn; potential for double-build if UI ever exposes the buttons during the sub-scene transition.
**Fix sketch:** Hoist the resume listener to `create()` and have it call `buildMenu` only when needed (gate on a "menuStale" flag set by the click handler).
**Trivial?:** no

### [HIGH] MqttClient timeout-fallback path leaves the old client subscribed to message events
**Where:** `src/systems/MqttClient.ts:140-153, 100-117`
**Issue:** When the primary broker stalls past `FALLBACK_TIMEOUT_MS`, the timeout handler does `client.end(true)` and creates a second client via recursive `connectWithFallback()`. The first client had `.on('connect')`, `.on('reconnect')`, `.on('offline')`, `.on('close')`, `.on('error')`, `.on('message')` listeners attached (lines 83-136). `end(true)` forces immediate close but the listener handles remain registered against the dead client object. If the underlying ws layer fires a delayed 'message' / 'close' / 'error' against the dead client after end(true), those handlers run — touching `this.handlers`, calling `this.setStatus`, etc. The same applies in the error branch (lines 103-111). Worst case: a delayed 'connect' event on the dead primary client transitions status to 'connected' even though we've already failed over.
**Reproduction:** Hard to reproduce in normal conditions; observable if primary broker handshakes after the fallback timeout has fired.
**Impact:** Status thrash; potential for setStatus('connected') on a closed connection; minor handler leak.
**Fix sketch:** Before `client.end(true)` in the timeout/error fallback paths, call `client.removeAllListeners()` (or null out each listener) so the dead client can't reach back into the singleton.
**Trivial?:** yes

### [MEDIUM] SaveManager.setupAutoSave can drop a save if the meta-state read rejects mid-flight
**Where:** `src/core/SaveManager.ts:147-156`
**Issue:** `doSave` awaits `isAutoSaveAllowedByMeta()` which awaits `loadMetaState()`. If the meta load throws (idb error), the inner catch silently sets `cachedAutoSaveEnabled = true` (defensive default), but during the few-ms gap the player could close the tab and the save never lands. The doSave promise is also never awaited by the eventBus (eventBus.emit is fire-and-forget), so combat:end -> close-tab is a known data-loss window. Not critical but worth noting because the rest of the codebase carefully guards against partial-save states.
**Reproduction:** Trigger combat:end, immediately call window.close().
**Impact:** Last-combat progress lost in a tab-close race.
**Fix sketch:** Snapshot the state synchronously at event time and write through a navigator.sendBeacon-style flush in beforeunload. Or accept the race (currently does).
**Trivial?:** no

### [MEDIUM] CombatScene update() reads getRun() inside a try/catch that swallows "run was cleared"
**Where:** `src/scenes/CombatScene.ts:351`
**Issue:** `try { this.gameSpeed = getRun().combatSpeed ?? this.gameSpeed; } catch { /* run cleared */ }` masks a real condition: if the run was cleared while CombatScene is still active, the engine continues to tick (line 356: `this.engine.tick(delta * speed)`). The engine internally calls `getRun().stats.damageDealt += dmg` (CombatEngine.ts:397, 425, 440, etc.) — which will throw against the same "no active run" error every tick. Each tick will throw an uncaught error into Phaser's update loop.
**Reproduction:** Race: clearRun() called from another scene while CombatScene is still rendering before its shutdown event fires.
**Impact:** Spammed console errors; potential frame drops.
**Fix sketch:** Early-return from `update()` if `hasActiveRun()` is false. Don't catch and continue.
**Trivial?:** yes

### [MEDIUM] PlanningOverlay wake handler is never unregistered
**Where:** `src/scenes/PlanningOverlay.ts:180, 929-976`
**Issue:** `this.events.on('wake', () => this.syncFromRunStateOnWake())` registered in create() but `cleanup()` never calls `this.events.off('wake', ...)`. Phaser's scene event emitter is reset on shutdown so it doesn't leak across runs, but the anonymous closure references `this` (PlanningOverlay instance). When the scene is restarted the new instance gets a new closure, while the old closure (now closed-over a destroyed `this`) sits in the wake list until shutdown fires. Side-effect-free in practice but the symmetry would be cleaner.
Same pattern at GameScene.ts:235-236 (resume/wake handlers, also never off'd).
**Reproduction:** N/A — closure references are GC'd at scene shutdown.
**Impact:** None observed, defensive only.
**Fix sketch:** Store the handler as a class method and explicitly `.off('wake', this.handleWake, this)` in cleanup. Or trust Phaser's scene-event reset (current behavior).
**Trivial?:** yes

### [MEDIUM] CombatEngine.executeCard double-mutates heroStrength inside a single card resolution
**Where:** `src/systems/combat/CombatEngine.ts:177-186, 209-220`
**Issue:** Three temp-bonus fields (`_bloodPactBonus`, `_sanguinePactStrBonus`, `_sanguinePactIntBonus`) are added to `heroStrength/heroIntellect` before `cardResolver.resolve()` and subtracted after. This is correct under single-threaded JS, BUT if `cardResolver.resolve()` ever fires a relic that ALSO temporarily mutates heroStrength (or causes a re-entrant card resolution — e.g. echoCharges flow at line 331 calls resolve again with the same state), the strength value is double-counted on the inner call and the post-resolve subtraction underflows. Today the echo path is taken AFTER the cleanup subtraction (line 331 is after lines 209-220), so it's safe. But it's a fragile invariant.
**Reproduction:** Requires future code that triggers a re-entrant resolve before the post-resolve cleanup.
**Impact:** Latent footgun; not a live bug.
**Fix sketch:** Either (a) pass the temp bonuses as resolver arguments rather than mutating state, or (b) capture the pre-mutation value and restore via direct assignment instead of "subtract back" arithmetic.
**Trivial?:** no

### [MEDIUM] DailyRunTicker ts-based ordering drops valid updates from clients with skewed clocks
**Where:** `src/systems/DailyRunTicker.ts:49, 94`
**Issue:** `if (prev && prev.ts > payload.ts) return` rejects any update whose `ts` is older than the previously-seen value for that runId. `ts` is set client-side via `Date.now()` (DailyRunBroadcaster.ts:128) — so a player whose clock is 30s ahead of yours will publish "future" timestamps. When their clock corrects (NTP sync) or you reconnect after their first update arrived from a cached MQTT retained message, your "stale" filter throws away their newer state because your local clock disagrees.
**Reproduction:** Two clients with clocks skewed >5s. The trailing client's updates may be rejected after the leading client first appears.
**Impact:** Sticky stale entries in the ticker; a player who joins late sees the leader frozen.
**Fix sketch:** Use a per-runId monotonic sequence number (broadcaster-side counter) instead of wall-clock ts. Or compare against received-time on the local clock.
**Trivial?:** no

### [MEDIUM] BossExitScene exit-flow emits 'run-exited' to a GameScene handler that's a no-op while GameScene is paused
**Where:** `src/scenes/BossExitScene.ts:170, src/scenes/GameScene.ts:521-525`
**Issue:** `this.loopRunner.onBossChoice('exit')` emits a 'run-exited' event handled in GameScene's `handleLoopEvent` (a no-op comment block). The actual banking is done inline in BossExitScene afterward. The duplication isn't wrong but it makes the "two ways to exit a run" branching invisible — the LoopRunner's `resolveRunEnd` result is computed and discarded. If anyone later relies on the loopRunner-emitted result, they'll get inconsistent values vs the BossExitScene path.
**Reproduction:** N/A — current behavior is correct.
**Impact:** Maintenance footgun.
**Fix sketch:** Drop the `resolveRunEnd` call inside LoopRunner.onBossChoice('exit') OR move the banking back to GameScene's handler. Pick one source of truth.
**Trivial?:** no

### [LOW] CombatScene update gameSpeed read inside try/catch with empty-catch
**Where:** `src/scenes/CombatScene.ts:351, 370`
**Issue:** Two catch-{} blocks that swallow exceptions without logging. The second one (line 370) is on shutdown so it's defensible. The first one (line 351, gameSpeed read) silently absorbs run-cleared errors at update cadence — see medium finding above.
**Impact:** Hides bugs.
**Fix sketch:** Guard with `hasActiveRun()` instead of try/catch.
**Trivial?:** yes

### [LOW] MqttClient.subscribe never times out an attempted subscribe
**Where:** `src/systems/MqttClient.ts:175-189`
**Issue:** `subscribe(topic, handler)` registers the handler synchronously then calls `ensureConnected().then(...)`. If `ensureConnected` resolves with `client === null` (failed status), the subscribe callback runs and silently no-ops. The handler stays in `this.handlers` forever. If a later reconnect succeeds, the re-subscribe loop at line 87 picks it up — good. But if reconnect never happens, the handler is dead weight in the map.
**Impact:** Tiny memory footprint; no functional issue.
**Fix sketch:** Add a TTL or expose a "drop subscriptions on permanent failure" method.
**Trivial?:** no

### [LOW] CombatEngine.tickActiveDoTs `as any` casts hide off-by-one risks
**Where:** `src/systems/combat/CombatEngine.ts:249, 526`
**Issue:** `const activePassives = this.state.activePassives as any[]` discards type info. activePassives is expected to be PassiveSkill[] (per checkConditionalTrigger), but the cast means any future schema change to that field won't surface in this file.
**Impact:** Type-safety hole.
**Fix sketch:** Type-narrow with `as PassiveSkill[]` or fix the underlying CombatState typing.
**Trivial?:** yes

### [LOW] CombatEngine non-null path on `card.elements!.includes('fire' as any)` casts string literal
**Where:** `src/systems/combat/CombatEngine.ts:283`
**Issue:** `card.elements.includes('fire' as any)` defeats the discriminated-union check on elements. If `'fire'` is ever renamed (it's a real element id in the codebase), this cast silently keeps compiling against the new symbol.
**Impact:** Refactor brittleness.
**Fix sketch:** Use the typed Element literal directly without the `as any`.
**Trivial?:** yes
