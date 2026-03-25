# Project Research Summary

**Project:** Autoscroller — Roguelike Loop Auto-Battler
**Domain:** Web-based roguelike deckbuilder with loop tile-placement mechanics and future co-op multiplayer
**Researched:** 2026-03-25
**Confidence:** HIGH

## Executive Summary

Autoscroller is a web game that fuses three distinct genres: Loop Hero's tile-placement loop traversal, Slay the Spire's roguelike deckbuilding, and auto-battler real-time combat. The project already has a substantial working codebase (15+ scenes, combat system, heir system, shop, tile system) built on Phaser 3 and TypeScript. Research confirms that the technology choices are sound, but the architecture has a critical structural problem: game logic is embedded inside Phaser scenes rather than separated into pure systems. This needs to be resolved before the codebase becomes unmanageable and before multiplayer is ever attempted.

The recommended approach is to build the solo game to a fun, polished state in two distinct phases: first, extract pure game-logic systems from scenes and establish a centralized run state (the architectural foundation); second, implement the two core differentiators that no competitor offers — per-card cooldown-based auto-combat with visible card queues, and deck ordering with sequential synergy chains. These mechanics are what make Autoscroller unique and must be the product's answer to "why play this over Slay the Spire?". Co-op multiplayer is correctly deferred to v3+, but the solo architecture must be built to support it from the start.

The primary risks are: (1) auto-combat feeling passive and disconnected from player decisions — solvable with card queue visualization, synergy highlighting, and post-combat summaries; (2) the current God Scene architecture blocking multiplayer and making testing impossible — solvable by extracting CombatEngine, LoopRunner, and TileManager as pure TypeScript classes; (3) deck thinning becoming the dominant "solved" strategy — solvable with a minimum deck size, fatigue mechanics, and exponential removal costs. Addressing these three risks in Phase 1-2 prevents expensive rewrites later.

## Key Findings

### Recommended Stack

The existing stack (Phaser 3.90.0, TypeScript 5.7, Vite) is the correct foundation. Phaser 4 is not production-ready on npm (stuck at 0.2.2) and the existing codebase has 15+ scenes on Phaser 3 — no reason to migrate. For persistence, `idb-keyval` should replace raw localStorage for meta-progression data (larger limits, async, structured). When multiplayer arrives, Colyseus 0.17 is the clear choice over Socket.IO: it provides room management, schema-based state sync with binary delta compression, built-in matchmaking, and has an official Phaser integration guide. Vite 8 upgrade is optional — its Rolldown bundler is 10-30x faster, but Vite 6 is a safe fallback if CJS interop issues arise with Phaser.

**Core technologies:**
- Phaser 3.90.0: game engine — mature, stable, last v3 release, existing codebase already built on it
- TypeScript 5.7: type safety — already enabled in strict mode; critical for schema decorators when multiplayer arrives
- Vite 8 (or Vite 6 fallback): bundler — Vite 8 uses Rolldown for 10-30x faster builds; low migration risk given minimal vite config
- idb-keyval: meta-progression persistence — 295 bytes brotli'd, async, no 5MB limit, replaces localStorage for structured data
- Colyseus 0.17 (future): multiplayer server — purpose-built for games, schema state sync, room architecture maps to co-op sessions
- nanoid (already installed): entity IDs — already in project dependencies, use for cards, relics, tiles

### Expected Features

Research across competitor analysis (Loop Hero, Slay the Spire, TFT) and genre conventions identifies a clear three-tier feature set.

**Must have (table stakes):**
- Per-card cooldown auto-combat (replaces the current fixed 2-second turn timer — this is a rewrite, not a tweak)
- Card reward choices — pick 1 of 3 per StS standard; the current system appears to auto-add
- Card removal in shop with escalating costs — deck thinning is genre-defining strategy
- Deck ordering UI with clear visual feedback — the ordering mechanic must be surfaced prominently
- Death screen with comprehensive run statistics — players must understand why they died
- Tutorial covering tile placement, deck ordering, and auto-combat — the game combines 3 genres
- Escalating difficulty per loop (tuned, not just partially implemented)
- Persistent run seed for reproducibility
- Visual combat feedback: card queue display, synergy highlights, floating numbers

**Should have (competitive differentiators):**
- Card sequential synergies / combos — the most important differentiator; "Shield then Counter-Attack = 2x damage" only works in an ordered deck
- Tile adjacency synergies (linear, path-only, explicit matrix) — deepens tile placement decisions
- Meta-progression hub (camp/village) — unlock cards/tiles into loot pool across runs
- Heir system expansion to 10+ traits with meaningful death choices
- Card pool expansion to 30+ cards with rare/epic tiers
- Relic pool expansion to 25+ relics
- 3+ boss types with unique mechanics (phases, immunities)
- 15+ narrative events with real tradeoffs
- Card upgrading system (interface already exists in CardDefinition but unexposed)

**Defer (v2+):**
- Co-op online (2-4 players) — requires complete server infrastructure; only after solo is polished
- Additional classes (Mage, Rogue) — after Warrior is fully balanced with passive tree
- Class passive skill trees — complex UI and balancing
- Seasonal/daily challenge runs — requires backend for leaderboards
- Visual/art overhaul — currently rectangles and text; mechanics must be fun first
- Full sound design and music — AudioManager exists but is empty

**Explicit anti-features (do not build):**
- PvP mode — balancing PvP and PvE simultaneously destroys both; StS never added PvP
- Manual combat intervention — destroys the core auto-battler identity
- Infinite card collection across runs — eliminates roguelike tension
- Procedural card generation — all successful deckbuilders use hand-designed cards

### Architecture Approach

The codebase needs a clear separation into four layers: Presentation (thin Phaser scenes, UI components, effects), Game Systems (pure TypeScript — CombatEngine, DeckManager, LoopRunner, TileManager, RelicManager, LootGenerator), Run State (a single `RunState` object owning all mutable run data), and Data/Persistence (static definitions in `data/`, meta-progression in IndexedDB). The single biggest architectural gap is the absence of a centralized RunState — gold, deck, relics, and hero stats currently live as scattered module-level singletons that are impossible to serialize, difficult to reset correctly, and incompatible with any future multiplayer. The second-biggest gap is combat logic embedded in CombatScene (~300 lines) that cannot be tested or run server-side.

**Major components:**
1. EventBus (`core/EventBus.ts`) — typed event emitter that decouples systems; every cross-system notification goes through it
2. RunState (`state/RunState.ts`) — single source of truth for all mutable run data; replaces `currentGold`, `getDeckManager()`, `getRelicManager()` singletons
3. CombatEngine (`systems/combat/CombatEngine.ts`) — pure TypeScript, no Phaser dependency; receives a `tick()` call rather than owning its timer; handles card resolution, damage calc, enemy AI
4. SynergyChecker (`systems/combat/SynergyChecker.ts`) — checks sequential card pairs against synergy definition table
5. LoopRunner (`systems/loop/LoopRunner.ts`) — hero movement, tile interaction resolution, loop progression, difficulty scaling
6. TileManager (`systems/loop/TileManager.ts`) — tile placement, tile synergy matrix resolution
7. MetaProgression (`state/MetaProgression.ts`) — permanent unlocks stored in IndexedDB via idb-keyval
8. Thin Scenes — create visuals, bind input, subscribe to EventBus; zero game logic

### Critical Pitfalls

1. **Auto-combat feels passive** — Build combat readability from day one: show the card queue during combat, highlight synergy triggers visually ("COMBO!"), provide a post-combat summary screen. If players skip combat, the core loop is broken. This cannot be retrofitted easily.

2. **God Scene architecture blocks everything** — The current `Game.ts` (440 lines) and `CombatScene.ts` (~300 lines) mix logic with rendering. This must be extracted into pure systems before adding any significant feature, and definitely before multiplayer. The extraction path is: CombatEngine first (highest value), then LoopRunner, then TileManager.

3. **Deck thinning dominance** — With per-card cooldowns, a small deck means best cards recycle faster, making thinning even more powerful than in Slay the Spire. Enforce a minimum deck size of 8 cards, add a reshuffle fatigue penalty, and use exponential removal cost scaling.

4. **Phaser scene memory leaks on long runs** — Every scene launched/stopped accumulates orphaned listeners and objects over dozens of combats. Establish object pooling, named event handler references, and mandatory `shutdown()` cleanup as conventions from Phase 1. Profile after 20+ combat cycles.

5. **State architecture blocks multiplayer** — The current singleton pattern (`getDeckManager()`, `getRelicManager()`) cannot be synchronized to a server. A centralized, JSON-serializable RunState is the prerequisite for everything: save/load, multiplayer, debugging. This must be the first architectural change.

## Implications for Roadmap

Based on combined research, the architecture build order (bottom-up from ARCHITECTURE.md) maps directly to a feature delivery order. Do not attempt any feature phase before its architectural foundation exists.

### Phase 1: Architecture Foundation + Combat Rewrite

**Rationale:** The existing architecture has two blockers that will make every future feature harder: scattered singleton state (impossible to save/load or sync) and combat logic inside a Phaser scene (untestable, server-incompatible). These must be resolved first. This phase also delivers the most important gameplay differentiator — per-card cooldown combat with visible card queues.
**Delivers:** EventBus, RunState (central state), CombatEngine (pure TypeScript, per-card cooldowns), card queue visualization, synergy highlights, post-combat summary, memory leak cleanup conventions, idb-keyval persistence foundation.
**Addresses:** Card reward choices (pick 1 of 3), deck ordering UI improvements, death screen with run stats.
**Avoids:** God Scene pitfall, multiplayer-blocking singleton pitfall, memory leak pitfall, passive auto-combat pitfall.
**Research flag:** Standard patterns — EventBus, RunState, and thin scene patterns are well-documented and the ARCHITECTURE.md provides concrete code examples. No additional research needed.

### Phase 2: Core Differentiators + Deck System

**Rationale:** Once CombatEngine is a pure system and RunState exists, the two most important differentiating features can be implemented cleanly: sequential card synergies (requires ordering) and tile adjacency synergies (requires explicit synergy matrix). This phase also completes the table-stakes shop and deck systems.
**Delivers:** Card sequential synergy system (SynergyChecker), tile adjacency synergy matrix (capped at 12-15 tile types), complete shop with card removal pricing, deck ordering with synergy connection visualization, escalating removal costs (exponential), minimum deck size enforcement, seeded RNG for all random decisions.
**Implements:** SynergyChecker, LootGenerator, ShopPricing, TileManager synergy matrix.
**Avoids:** Deck thinning dominance pitfall, tile combinatorial explosion pitfall, card ordering too much/too little pitfall.
**Research flag:** Synergy system design needs research during planning — specifically how to structure the synergy definition format and how the reshuffle behavior interacts with ordering (critical design decision with no obvious "right answer").

### Phase 3: Content + Balance + Meta-Progression

**Rationale:** Once the core loop is validated as fun (Phase 1-2), content expansion and permanent progression give players a reason to keep playing after death. This phase also builds the balancing infrastructure (analytics, difficulty curve tuning) needed to ship a polished game.
**Delivers:** Meta-progression hub (camp/village), expanded heir system (10+ traits), card pool expansion (30+ cards with rare/epic tiers), relic pool expansion (25+ relics), 3+ boss types with unique mechanics, 15+ narrative events, card upgrading system exposed to player, S-curve difficulty scaling, run analytics instrumentation, data moved to runtime-loadable JSON.
**Avoids:** Meta-progression power creep pitfall (unlock options, not power), difficulty death spiral/steamroll pitfall (S-curve scaling, variety over stat inflation), mid-run pacing boredom pitfall, balancing blind pitfall.
**Research flag:** Boss mechanic design (phases, immunities) and S-curve difficulty tuning are domain-specific and worth a research-phase pass before implementation. Analytics instrumentation is standard (no research needed).

### Phase 4: Polish + Tutorial + Sound

**Rationale:** Mechanics first, feel second. Sound design, visual feedback polish, and a comprehensive tutorial are high-impact for retention but depend on stable mechanics underneath. This phase prepares the game for public release.
**Delivers:** Tutorial covering all 3 systems (tile placement, deck ordering, auto-combat), comprehensive sound design using Phaser's built-in audio system, visual polish (combat effects, UI refinement), in-game encyclopedia/glossary, renderer performance optimization (Canvas vs WebGL benchmark, settings toggle), export/import save file functionality, incognito mode detection.
**Avoids:** Tutorial over/under-explaining pitfall, browser storage loss pitfall, Canvas/WebGL performance pitfall.
**Research flag:** Standard patterns — Phaser audio docs are comprehensive, tutorial design patterns are well-understood. No research needed.

### Phase 5: Co-op Multiplayer

**Rationale:** Correctly deferred until solo is polished and the architecture supports it. Phase 1's RunState centralization and CombatEngine purity are the prerequisites that make this possible. Colyseus 0.17 provides the server infrastructure.
**Delivers:** Colyseus server (monorepo addition), shared state schema (GameState, PlayerState, CombatState, DeckState), client WebSocket integration (GameRoom.ts, StateSync.ts), lobby/matchmaking, difficulty scaling for 2-4 players, reconnection handling.
**Uses:** Colyseus 0.17 (server), colyseus.js 0.16 (client), @colyseus/schema 0.17, Node.js 22 LTS.
**Avoids:** Multiplayer state desynchronization pitfall (centralized RunState from Phase 1 makes this tractable).
**Research flag:** Needs research-phase during planning — Colyseus schema design, state sync patterns for turn-based/tick-based combat, client prediction and interpolation for the auto-combat ticker. Phaser + Colyseus integration tutorial exists but specific patterns for this game's combat model need validation.

### Phase Ordering Rationale

- Architecture before features: CombatEngine extraction (Phase 1) must precede synergy system (Phase 2) because SynergyChecker is a subsystem of CombatEngine. RunState (Phase 1) must precede MetaProgression (Phase 3) because meta-progression is persisted RunState.
- Differentiators before content: Sequential synergies (Phase 2) before card pool expansion (Phase 3) because new cards must be designed around the synergy system to create synergistic builds.
- Solo before multiplayer: Every single-player system (Phases 1-4) must be stable before Phase 5. Multiplayer inherits all solo systems — adding them later is impossible without the architectural foundation.
- Pitfall avoidance drives order: Memory leak conventions (Phase 1), deck thinning prevention (Phase 2), and analytics infrastructure (Phase 3) are all established before the systems they protect become complex.

### Research Flags

Needs research-phase during planning:
- **Phase 2:** Synergy system design — reshuffle behavior interaction with ordering, synergy definition data format, "generous window" vs "strict sequential" balance.
- **Phase 5:** Colyseus integration — schema design for this game's state shape, tick-based combat on server vs client, client prediction patterns.

Standard patterns (skip research-phase):
- **Phase 1:** EventBus, RunState, thin scene refactor — all well-documented; ARCHITECTURE.md provides working code examples.
- **Phase 3:** Analytics instrumentation — standard browser event logging; boss design is creative work, not a research problem.
- **Phase 4:** Audio (Phaser built-in), tutorial design — official Phaser docs are comprehensive.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technology choices verified against npm and official docs. Phaser 3.90.0 stability confirmed. Colyseus architecture confirmed. Only Vite 8 is MEDIUM (new release, CJS interop with Phaser untested). |
| Features | HIGH | Grounded in competitor analysis (Loop Hero, Slay the Spire, TFT) and genre conventions. Feature prioritization is opinionated but well-supported. Anti-features list based on documented failures in comparable games. |
| Architecture | HIGH | Based on direct analysis of the existing 40+ TypeScript files in the codebase. Patterns (EventBus, RunState, thin scenes) are industry-standard and well-documented. |
| Pitfalls | HIGH | Pitfalls sourced from post-mortems, GitHub issues, and documented game design failures in the same genre. The memory leak and singleton pitfalls are directly observable in the current codebase. |

**Overall confidence:** HIGH

### Gaps to Address

- **Synergy definition format:** The research recommends a "synergy matrix" for tiles and a "synergy definition system" for cards, but the exact data format (how to express "if card A was played within N cards before card B, apply bonus X") needs design work during Phase 2 planning.
- **Reshuffle policy:** When the deck reshuffles in auto-combat (per-card cooldowns), does card order reset? Preserve? Partially randomize? This is a core design decision that affects how much ordering matters — it is not resolved in research and must be decided before Phase 2.
- **Vite 8 + Phaser 3 CJS interop:** Untested. If `legacy.inconsistentCjsInterop: true` does not resolve import issues, fall back to Vite 6. Low risk but verify early in Phase 1.
- **Difficulty curve values:** Research recommends S-curve scaling with "steep mid-game, flattening late-game" but provides no specific numbers. Boss frequency, stat multipliers, and loop thresholds need data from playtesting in Phase 3.
- **Minimum deck size value:** Research recommends 8 cards as a minimum. This is a starting point, not a validated number. Adjust based on playtesting.

## Sources

### Primary (HIGH confidence)
- Phaser 3.90.0 official release — confirmed latest stable v3 version and last v3 release
- @phaserjs/phaser on npm — confirmed Phaser 4 at 0.2.2, not production-ready
- Colyseus 0.17 official docs and blog — schema-based state sync, room architecture, TypeScript safety
- Colyseus Phaser Tutorial (official) — integration patterns for player movement, interpolation, fixed tickrate
- Vite 8 migration guide (vite.dev) — confirmed breaking changes and Rolldown bundler
- idb-keyval on npm — confirmed 295 bytes, promise-based IndexedDB wrapper
- Existing codebase analysis (40+ TypeScript files reviewed) — all architecture findings grounded in actual code

### Secondary (MEDIUM confidence)
- Loop Hero Wikipedia + Game Developer postmortem — tile mechanics, difficulty scaling, meta-progression patterns
- Slay the Spire balance devs interview (GamesRadar) — deckbuilder balance philosophy, card design intent
- Roguebook postmortem (Game Developer) — deckbuilder + roguelite design decisions
- Phaser memory optimization guide (Medium, 2025) — object pooling, listener cleanup patterns
- Auto-battler genre evolution (Magic Special Events) — genre conventions and player expectations
- Phaser GitHub issue #5456 — memory leak patterns in scene lifecycle

### Tertiary (LOW confidence)
- Difficulty curve S-shape recommendation — inferred from genre best practices, not a citable specific
- "8 card minimum deck size" — community consensus from roguelike design forums, needs playtesting validation
- Boss checkpoint frequency ("every 3-5 loops") — inferred from Loop Hero pacing, not empirically validated for this game

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
