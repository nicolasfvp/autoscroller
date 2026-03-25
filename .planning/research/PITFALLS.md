# Domain Pitfalls

**Domain:** Web-based roguelike auto-battler with deckbuilding + tile loop mechanics (Phaser)
**Researched:** 2026-03-25

## Critical Pitfalls

Mistakes that cause rewrites, player churn, or fundamental design failure.

### Pitfall 1: Auto-Combat Feels Like Watching, Not Playing

**What goes wrong:** The auto-combat system provides zero meaningful feedback loop. Players watch their hero play cards but feel no connection between their deckbuilding decisions and the combat outcome. The game becomes a passive screensaver.
**Why it happens:** Auto-battlers strip direct agency from the player. If the gap between "build deck" and "see results" is too opaque, the player cannot learn from failures or appreciate successes. The combat becomes noise.
**Consequences:** Players disengage entirely. Win/loss feels random even when it is not. The core value proposition ("watch your well-built deck execute perfectly") never lands.
**Prevention:**
- Combat visualization must show WHICH card is being played, its effect, and WHY it matters (e.g., highlight synergy triggers, show "COMBO!" when sequential cards fire).
- Add a combat log that maps outcomes back to deck decisions: "Shield into Counter-Attack dealt 2x damage" so the player can trace cause and effect.
- Show the upcoming card queue during combat so players can anticipate and feel tension about what comes next.
- Post-combat summary screen: "Your deck dealt X damage, took Y damage, triggered Z synergies. Cards that did nothing: [list]." This is the learning feedback loop.
**Detection:** Playtest sign: players skip or speed-up combat without caring about the outcome. If nobody watches the fights, the core loop is broken.
**Phase relevance:** Must be addressed in Phase 1 (core combat). Retrofitting combat readability is much harder than building it in.

### Pitfall 2: Deck Thinning Dominance ("Remove Everything" Meta)

**What goes wrong:** The optimal strategy becomes removing all cards except 2-3 powerful ones, creating a tiny deck that cycles the same devastating combo infinitely. Every run converges to the same strategy.
**Why it happens:** The PROJECT.md specifies escalating removal costs (Slay the Spire model), but if the power curve of a thin deck exceeds the gold cost of removal, rational players will always thin. The cooldown-per-card system actually makes this WORSE than Slay the Spire because a small deck means your best cards come back faster.
**Consequences:** Every run feels identical. Build diversity collapses. New cards feel like deck pollution rather than upgrades. The deckbuilding -- the core differentiator -- becomes a solved puzzle.
**Prevention:**
- Implement minimum deck size (e.g., 8 cards). Below that, the hero "fumbles" or has dead turns.
- Add "fatigue" mechanic: when deck reshuffles, apply a small penalty (e.g., lose 1 HP per reshuffle) that punishes ultra-thin decks.
- Design cards with synergy chains that REQUIRE deck diversity (e.g., "if you played 3 different card categories this cycle, gain +50% damage on next attack").
- Ensure removal cost scaling is aggressive enough: exponential, not linear.
**Detection:** During balancing: if your best playtest runs consistently have fewer than 10 cards, thinning is dominant.
**Phase relevance:** Must be addressed during deck/card system design (Phase 1-2). Retrospective fixes to card economy break existing balance.

### Pitfall 3: Phaser Scene Memory Leaks on Long Runs

**What goes wrong:** The game becomes progressively slower over a 1h+ run. Frame rate drops, browser tab memory balloons to 500MB+, eventual crash.
**Why it happens:** Phaser scenes that are launched/stopped (CombatScene, ShopScene, EventScene, etc.) accumulate orphaned event listeners, textures, and game objects. The current codebase already shows the pattern: `CombatScene` creates new `Rectangle`, `Text`, and `TimerEvent` objects on every `create()` call. Over dozens of combats in a single run, these stack up if not properly destroyed. Anonymous event listeners (like the `combat-ended` handler in Game.ts line 69) cannot be removed because there is no stored reference.
**Consequences:** Unplayable on low-end devices. Runs that are designed to last 1h+ become impossible. Players lose progress to crashes.
**Prevention:**
- Use object pooling for ALL frequently-created objects (combat sprites, text elements, effects).
- Store references to ALL event listeners and remove them in `shutdown()` / `destroy()` lifecycle methods. Never use anonymous functions for event handlers.
- Call `this.children.removeAll(true)` or manually destroy all created objects in scene shutdown.
- Implement a memory budget monitor in dev mode that warns when scene object count exceeds thresholds.
- Profile with Chrome DevTools Memory tab after 20+ combat cycles during development.
**Detection:** Run a 30-minute automated playtest loop. If memory grows monotonically (never stabilizes), there are leaks.
**Phase relevance:** Must be established as a pattern in Phase 1. Every scene created afterward must follow the cleanup pattern. Retrofitting cleanup into 15+ scenes is painful.

### Pitfall 4: Tile Synergy Combinatorial Explosion

**What goes wrong:** Tile interactions become impossible to balance. Adding the Nth tile type creates N-1 new interaction pairs, each of which can produce unexpected power spikes or useless combinations.
**Why it happens:** The project specifies "tiles adjacent interact between each other (synergies/combos)." With 10 tile types, that is 45 unique pairs. With 20 types, it is 190 pairs. Each pair needs testing. Loop Hero managed this by having a small, curated tile set -- but even they had notorious broken combos.
**Consequences:** Certain tile combinations trivialize the game. Others are useless traps that waste the player's run. Balance becomes an endless whack-a-mole.
**Prevention:**
- Cap tile types to 12-15 maximum (including special tiles like Shop, Rest, Boss).
- Use a synergy MATRIX (explicit pairwise table) rather than emergent rules. Only pairs in the matrix interact; all others are neutral.
- Introduce tile synergies gradually across phases. Ship with 6-8 tile types in MVP, add 2-3 per content update.
- Build an automated balance simulator that runs thousands of loop configurations and flags statistical outliers.
**Detection:** If you cannot describe all tile synergies on a single page, you have too many.
**Phase relevance:** Tile system design (Phase 1-2). The synergy matrix architecture must be defined before adding content.

### Pitfall 5: Multiplayer State Desynchronization

**What goes wrong:** In co-op mode, players see different game states. One player sees an enemy alive while another sees it dead. Tile placements do not propagate correctly. Deck shuffles produce different card orders on different clients.
**Why it happens:** The current architecture uses client-side singletons (DeckManager, RelicManager, TileInventory) with no server authority. Adding multiplayer later means retrofitting server-authoritative state onto a system designed for client-only play.
**Consequences:** Co-op is unshippable. Requires a near-complete rewrite of state management. The "multiplayer is future" decision becomes "multiplayer is impossible."
**Prevention:**
- Even in solo MVP, separate game state from rendering. Create a pure-data GameState object that contains ALL mutable state (hero stats, deck, tiles, enemies, loop count). Scenes READ from this state; they never own it.
- Use deterministic RNG (seeded PRNG) for ALL randomness (shuffles, drops, enemy spawns). Same seed = same outcome.
- Design the state layer so it can later be driven by server messages instead of local mutations, without changing any scene code.
- When multiplayer arrives, the server runs the GameState; clients receive state snapshots and render them.
**Detection:** Can you serialize your entire game state to JSON and restore it perfectly? If not, state is scattered.
**Phase relevance:** Must be architected in Phase 1. This is the single most expensive thing to retrofit. The current singleton pattern (getDeckManager(), getRelicManager()) is the wrong foundation for multiplayer.

## Moderate Pitfalls

### Pitfall 6: Difficulty Scaling That Punishes Good Play

**What goes wrong:** The "difficulty scales each loop" mechanic causes a death spiral or a snowball. If scaling is linear, experienced players steamroll forever. If scaling is exponential, it creates a hard wall where no build survives.
**Prevention:**
- Use S-curve scaling: gentle early, steep mid-game, flattening late-game. This creates a natural run length without hard walls.
- Scale enemy VARIETY (new enemy types, new mechanics) not just raw stats. Stat inflation is lazy and uninteresting.
- Provide the player visible information about upcoming difficulty ("Next loop: enemies gain Poison"). Surprise difficulty spikes feel unfair.
- The boss-every-X-loops exit mechanic is good -- it provides natural checkpoints where the player can choose to cash out.
**Detection:** If most runs end at the exact same loop number regardless of build quality, scaling is too deterministic.
**Phase relevance:** Phase 2 (balancing pass). Initial implementation can use simple linear scaling, but the curve must be tuned before any public release.

### Pitfall 7: Card Order Mattering Too Much (or Too Little)

**What goes wrong:** The PROJECT.md emphasizes deck ordering as a core mechanic (reorder costs gold). If order matters too much, a single misplaced card ruins the entire deck. If it matters too little, the mechanic is dead weight.
**Prevention:**
- Sequential synergies should provide BONUSES, not be REQUIRED. A Shield followed by Counter-Attack should deal bonus damage, but Counter-Attack alone should still do something.
- Keep the synergy window generous: "if Shield was played in the last 3 cards" rather than "if the previous card was Shield."
- Show synergy connections in the deck editor UI so players can understand which orderings matter.
- Auto-combat with cooldowns means the deck cycles multiple times per fight. The reshuffling behavior needs to preserve or re-randomize order -- this is a critical design decision that affects how much ordering matters.
**Detection:** Playtesting: if players spend more time in the deck editor than playing the actual game, ordering is too fiddly.
**Phase relevance:** Phase 1-2 (deck system + combat system). The reshuffling behavior must be decided early.

### Pitfall 8: Meta-Progression Invalidating Run Decisions

**What goes wrong:** Permanent unlocks (new cards, tiles, passives) become so powerful that individual run decisions stop mattering. A fully-unlocked account trivializes the early game.
**Prevention:**
- Meta-progression should unlock OPTIONS (new cards appear in the loot pool) not POWER (permanent stat boosts).
- Keep the core difficulty curve independent of meta-progress. New unlocks provide variety, not advantage.
- The 25%-on-death reward retention is fine as an anti-frustration mechanic, but watch that it does not create a "farm deaths" strategy.
**Detection:** If a new account run feels dramatically harder than a 50-hour account run with the same player skill, meta-progression is too strong.
**Phase relevance:** Phase 3+ (meta-progression system). But the architecture for loot pools must support this from Phase 1.

### Pitfall 9: Browser Storage Loss Destroying Progress

**What goes wrong:** Players lose hours of meta-progression because localStorage was cleared (browser update, clearing cookies, private browsing, storage quota exceeded).
**Prevention:**
- Use IndexedDB (via a wrapper like idb) instead of localStorage for structured game data. Higher storage limits, better performance.
- Implement export/import save functionality from day one. Players can back up their progress as a JSON file.
- Show a clear warning if the game detects it is running in private/incognito mode.
- When multiplayer arrives, server-side persistence replaces local storage. But solo MVP needs local persistence that does not silently fail.
**Detection:** Wrap all storage operations in try-catch. Log storage errors. If saves fail silently, players will not know until it is too late.
**Phase relevance:** Phase 1 (save system). Must be solid before meta-progression is built on top of it.

### Pitfall 10: Run Length Pacing -- Too Long, No Exit

**What goes wrong:** The PROJECT.md targets 1h+ runs. If the mid-game has no variation, players get bored at minute 30 and quit rather than die naturally. The run becomes a slog.
**Prevention:**
- Structure each run with distinct acts: early game (building), mid game (optimizing), late game (surviving). Each act should feel different.
- The boss-exit mechanic is the right tool -- but bosses must arrive frequently enough (every 3-5 loops, not every 10+).
- Introduce escalating event variety as the run progresses. Loop 1-3: basic enemies. Loop 4-6: elite encounters. Loop 7+: narrative events, curses, transformative choices.
- Give players a "retreat" option at camp/rest tiles with partial rewards, not just at bosses.
**Detection:** Track where players quit (close browser) vs. where they die or exit safely. If quit-rate spikes at a specific loop range, that is where pacing fails.
**Phase relevance:** Phase 2 (content pacing). The loop structure and boss frequency should be tuned early.

## Minor Pitfalls

### Pitfall 11: Canvas vs. WebGL Renderer Choice

**What goes wrong:** Defaulting to WebGL (Phaser's default) causes worse performance on older/integrated GPUs than Canvas mode would.
**Prevention:** Benchmark both renderers. For a 2D game with minimal particle effects, Canvas can outperform WebGL by 30% on low-end hardware. Consider auto-detecting and falling back. At minimum, expose a renderer toggle in settings.
**Phase relevance:** Phase 1 (initial setup). Easy to configure early, painful to switch later.

### Pitfall 12: Hardcoded Card/Enemy Data in Source

**What goes wrong:** The current CardDefinitions.ts and EnemyDefinitions.ts hardcode all game data in TypeScript. Adding or tweaking content requires code changes, rebuilds, and redeployments.
**Prevention:** Move game data to JSON/YAML files loaded at runtime. This enables:
- Non-developer designers to tweak balance.
- Hot-reloading data during development.
- Future modding support.
- A/B testing different balance configurations.
**Phase relevance:** Phase 1-2. Migrate early before the data files grow large.

### Pitfall 13: No Analytics for Balance Tuning

**What goes wrong:** Card balance, tile balance, and difficulty curves are tuned by developer intuition rather than data. Broken strategies go undetected until players complain.
**Prevention:** Instrument the game to log anonymized run data: cards picked, cards removed, tiles placed, loop reached, cause of death, gold earned/spent. Even a simple JSON export during playtesting is valuable. This feeds directly into the balance simulator mentioned in Pitfall 4.
**Phase relevance:** Phase 2 (balancing infrastructure). Should exist before any serious balance tuning.

### Pitfall 14: Tutorial That Explains Too Much or Too Little

**What goes wrong:** The game has two layers of complexity (tiles + deck). Over-explaining kills discovery. Under-explaining leaves players confused about core mechanics.
**Prevention:** Follow Loop Hero's approach: teach the absolute minimum (how to place a tile, how cards work) and let players discover synergies. But unlike Loop Hero, provide an accessible in-game encyclopedia that players can consult voluntarily. The TutorialScene.ts already exists -- ensure it covers ONLY: movement, tile placement, deck viewing, and "your hero fights automatically."
**Phase relevance:** Phase 3 (polish). But plan the information architecture early.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Core combat system | Combat feels passive/random (Pitfall 1) | Build combat readability from day one: card queue, synergy highlights, post-combat summary |
| Deck system | Thinning dominance (Pitfall 2), ordering balance (Pitfall 7) | Minimum deck size, generous synergy windows, reshuffling policy decided early |
| Tile system | Combinatorial explosion (Pitfall 4) | Explicit synergy matrix, cap tile count, gradual introduction |
| Scene architecture | Memory leaks (Pitfall 3) | Object pooling pattern, named event handlers, shutdown cleanup as mandatory convention |
| State management | Multiplayer-blocking architecture (Pitfall 5) | Centralized GameState object, deterministic RNG, state serialization from MVP |
| Save system | Progress loss (Pitfall 9) | IndexedDB, export/import, incognito detection |
| Difficulty scaling | Death spiral or steamroll (Pitfall 6) | S-curve scaling, variety over stat inflation, visible difficulty preview |
| Meta-progression | Power creep (Pitfall 8) | Unlock options not power, keep core difficulty independent |
| Content pacing | Mid-run boredom (Pitfall 10) | Act structure, frequent boss checkpoints, retreat options |
| Balancing | Flying blind (Pitfall 13) | Instrumentation and run data logging before tuning |
| Performance | Wrong renderer (Pitfall 11) | Benchmark Canvas vs WebGL early, expose setting |
| Data architecture | Hardcoded content (Pitfall 12) | External data files, runtime loading |

## Sources

- [Common Deckbuilder Pitfalls -- New to Narrative](https://newtonarrative.com/news/common-deckbuilder-pitfalls/)
- [Roguelike Deckbuilder Balancing -- GameDev.net](https://www.gamedev.net/forums/topic/715223-roguelike-deckbuilder-balancing/)
- [How I optimized my Phaser 3 action game in 2025 -- Medium](https://franzeus.medium.com/how-i-optimized-my-phaser-3-action-game-in-2025-5a648753f62b)
- [Troubleshooting Phaser Performance and Memory Issues -- Mindful Chase](https://www.mindfulchase.com/explore/troubleshooting-tips/game-development-tools/troubleshooting-phaser-performance-and-memory-issues-in-large-scale-games.html)
- [Auto-Battling your Way to Victory is not a Good Design -- ggDigest/Medium](https://medium.com/ggdigest/auto-battling-your-way-to-victory-is-not-a-good-design-109937a1f236)
- [Tackling deckbuilding and roguelite design in Roguebook -- Game Developer](https://www.gamedeveloper.com/design/tackling-deckbuilding-design-in-abrakam-s-roguebook)
- [Phaser Memory Leak Issues -- GitHub #5456](https://github.com/photonstorm/phaser/issues/5456)
- [Multiplayer Sync in 2025: Using WebTransport -- Markaicode](https://markaicode.com/webtransport-multiplayer-games-2025/)
- [Slay the Spire 2 devs on deckbuilder balance -- GamesRadar](https://www.gamesradar.com/games/roguelike/slay-the-spire-2-devs-want-you-to-break-the-game-as-thats-part-of-the-fun-of-deckbuilders-and-if-somethings-busted-they-can-do-one-of-their-favorite-things-nerf-cards/)
- [Loop Hero Tile Combos Guide -- GameRant](https://gamerant.com/loop-hero-tile-combos-guide/)
- [Games on the Web Roadmap: Data Storage -- W3C](https://w3c.github.io/web-roadmaps/games/storage.html)
