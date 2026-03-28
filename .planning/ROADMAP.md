# Roadmap: Autoscroller

## Overview

Autoscroller is a roguelike loop auto-battler built on Phaser 3 with an existing brownfield codebase. The roadmap delivers v1 in four phases: first extracting pure game systems from the current God Scene architecture, then building the combat and deck engine (the core differentiator), then implementing the loop and tile systems that create the world, and finally populating content, relics, meta-progression, and persistence. Each phase delivers a coherent, testable capability. Multiplayer and additional classes are deferred to v2.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Architecture Foundation** - Extract pure systems, centralize state, establish conventions for a 1h+ run
- [ ] **Phase 2: Combat + Deck Engine** - Per-card cooldown auto-combat with synergies, full deck management, warrior class
- [ ] **Phase 3: Loop + Tile World** - Infinite loop traversal, tile placement, special tiles (shop, rest, event, treasure, boss)
- [ ] **Phase 4: Content, Meta-Progression + Persistence** - Relic system, meta hub, content population, save/load, seeded RNG

## Phase Details

### Phase 1: Architecture Foundation
**Goal**: Game logic runs as pure TypeScript systems decoupled from Phaser scenes, with a single centralized state object and conventions that prevent memory leaks over long runs
**Depends on**: Nothing (first phase)
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04, PERS-01
**Success Criteria** (what must be TRUE):
  1. Game systems (combat, loop, tiles) can be instantiated and called without any Phaser dependency
  2. All mutable run data (HP, gold, deck, relics, tile inventory) lives in a single RunState object that can be serialized to JSON
  3. Cross-system communication uses a typed EventBus with no direct scene-to-scene coupling
  4. A run in progress survives a browser refresh (IndexedDB persistence of RunState)
  5. After 20+ combat cycles in a test run, no orphaned event listeners or objects accumulate (memory stable)
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — EventBus + RunState + data types + JSON migration + test infrastructure (Wave 0)
- [ ] 01-02-PLAN.md — SaveManager with idb-keyval + all scenes rewritten as thin wrappers + boot flow
- [ ] 01-03-PLAN.md — Integration tests + memory leak verification + manual browser refresh checkpoint

### Phase 2: Combat + Deck Engine
**Goal**: Players experience the core differentiator -- fully automatic combat with per-card cooldowns, visible card queues, sequential synergies, and complete deck management
**Depends on**: Phase 1
**Requirements**: CMBT-01, CMBT-02, CMBT-03, CMBT-04, CMBT-05, CMBT-06, CMBT-07, CMBT-08, CMBT-09, CMBT-10, CMBT-11, CMBT-12, DECK-01, DECK-02, DECK-03, DECK-04, DECK-05, DECK-06, DECK-07, DECK-08, HERO-01, HERO-02, HERO-03, HERO-04, PLSH-01
**Success Criteria** (what must be TRUE):
  1. Hero automatically plays cards from deck top with per-card cooldowns -- light cards resolve fast, heavy cards slow -- without any player input during combat
  2. Player can see the entire card queue during combat and watch synergy combos trigger with visual highlights (e.g., Shield then Counter-Attack shows "COMBO!")
  3. After combat ends, a summary screen shows damage dealt/received, cards played, and combos triggered
  4. Player can add cards (free), remove cards (escalating gold cost), and reorder cards in the deck via the shop interface
  5. Warrior class has defined base stats, earns persistent XP per run, and unlocks passive skills that modify combat (e.g., +damage after consecutive attacks)
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — CombatEngine (pure TS) + card cooldowns + synergy system + enemy AI + combat stats
- [ ] 02-02-PLAN.md — Deck management (add/remove/reorder) + loot system + warrior class + XP + passive skills
- [ ] 02-03-PLAN.md — Combat UI scenes (CombatScene, PostCombat, Rewards, DeckView, ShopEditor, Death) + visual checkpoint

### Phase 3: Loop + Tile World
**Goal**: Players traverse an infinite loop of tiles, place terrain during the run, and encounter all special tile types (shop, rest, event, treasure, boss)
**Depends on**: Phase 2
**Requirements**: LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05, LOOP-06, LOOP-07, LOOP-08, TILE-01, TILE-02, TILE-03, TILE-04, TILE-05, SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05
**Success Criteria** (what must be TRUE):
  1. Hero visibly traverses tiles in a side-view autoscroll loop, looping infinitely with difficulty increasing each loop (enemy stats scale)
  2. Player can place terrain tiles on the path during a run using a tile placement UI, spending tile points earned each loop or using rare drops from enemies
  3. Adjacent tiles interact with each other (synergy/combo effects are visible), and terrains spawn specific enemies and provide resources/buffs
  4. Boss appears every X loops -- defeating it gives the option to exit with 100% rewards; dying mid-run returns 25% of rewards
  5. All special tile types function: shop (buy/remove/reorder cards, buy relics), event (narrative choices), rest (recover HP), treasure (loot), boss (special combat)
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — LoopRunner state machine + TileRegistry + SynergyResolver + DifficultyScaler + LootGenerator + RunEndResolver + JSON data configs + vitest + unit tests (Wave 1)
- [ ] 03-02-PLAN.md — ShopSystem + RestSiteSystem + EventResolver + TreasureSystem + BossSystem + JSON data (events, treasure, rest) + unit tests (Wave 2)
- [ ] 03-03-PLAN.md — GameScene + PlanningOverlay + 5 special tile overlay scenes + BossExitScene + HUD + UI components + visual checkpoint (Wave 3)

### Phase 4: Content, Meta-Progression + Persistence
**Goal**: The game has enough content for varied runs, permanent progression between runs, and reliable save/load across sessions
**Depends on**: Phase 3
**Requirements**: RELC-01, RELC-02, RELC-03, RELC-04, META-01, META-02, META-03, META-04, CONT-01, CONT-02, CONT-03, CONT-04, PERS-02, PERS-03
**Success Criteria** (what must be TRUE):
  1. ~15 unique cards with distinct stats/cooldowns/targeting and ~8 relics with unique passive effects are available in runs, creating varied builds
  2. Relics modify gameplay meaningfully (cooldowns, stats, combat mechanics) and are obtainable from drops, shop, and events
  3. Player visits a visual hub (camp/village) between runs that shows unlocks and progression; new cards and tile types unlock permanently into the loot pool
  4. 2-3 boss types and ~5 narrative events with choices provide encounter variety across runs
  5. Meta-progression data (unlocks, class XP, passive tree) persists across browser sessions, and runs use seeded RNG for reproducibility
**Plans**: 4 plans

Plans:
- [ ] 04-01-PLAN.md — JSON content data (cards, relics, enemies, events, buildings, passives) + MetaState type + SeededRNG + MetaPersistence + content tests (Wave 1)
- [ ] 04-02-PLAN.md — UnlockManager + MetaProgressionSystem + CollectionRegistry + unit tests (Wave 1)
- [ ] 04-03-PLAN.md — CityHubScene + BuildingPanel + TavernPanel + CollectionScene + RelicHUD + SeedDisplay + run-end extensions + visual checkpoint (Wave 2)
- [ ] 04-04-PLAN.md — Gap closure: BossExitScene safe exit banking + MainMenu/GameOver CityHub routing + RelicDefinition type fix (Wave 3)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Architecture Foundation | 0/3 | Not started | - |
| 2. Combat + Deck Engine | 1/3 | In Progress|  |
| 3. Loop + Tile World | 3/3 | Complete | 2026-03-26 |
| 4. Content, Meta-Progression + Persistence | 3/4 | In Progress|  |

### Phase 5: Balance & Economy Overhaul

**Goal:** Rebalance combat for 5-8s fights, replace single metaLoot with 7-material economy, implement scaling gold prices with caps, add Storehouse building, rework difficulty curve with diminishing loop growth
**Requirements**: BAL-TYPES, BAL-DATA, BAL-COMBAT, BAL-RESET, BAL-SHOP, BAL-MATERIALS, BAL-DEATH, BAL-LOOP, BAL-STOREHOUSE, BAL-INTEGRATION, BAL-MIGRATION
**Depends on:** Phase 4
**Plans:** 2/4 plans executed

Plans:
- [ ] 05-01-PLAN.md — MetaState v2 types + materials.json + rebalanced JSON + migration tests (Wave 1)
- [ ] 05-02-PLAN.md — 50% resource recovery in CombatState + combat balance validation tests (Wave 2)
- [ ] 05-03-PLAN.md — ShopSystem scaling prices + LootGenerator materials + MetaProgressionSystem multi-material + RunEndResolver death penalty + DifficultyScaler loop growth (Wave 2)
- [ ] 05-04-PLAN.md — Wire materials into all scenes/HUD/LoopRunner/persistence + MetaState migration + visual checkpoint (Wave 3)

### Phase 6: Content Expansion

**Goal:** Expand game content to v2 targets: 30+ cards with epic tier and upgrade system, 15+ relics with build-around types, 5+ boss types with behavioral patterns, 15+ events with material integration, 10+ synergy pairs
**Requirements**: CONT-05, CONT-06, CONT-07, CONT-08, CONT-09
**Depends on:** Phase 5
**Plans:** 3 plans

Plans:
- [ ] 06-01-PLAN.md — Type extensions (epic rarity, CardUpgrade, BossBehavior) + all JSON content expansion (30 cards, 15 relics, 5 bosses, 15 events, 10 synergies) + building tier extensions + content tests (Wave 1)
- [ ] 06-02-PLAN.md — Card upgrade system (ShopSystem + CardResolver + RunState) + boss behavioral patterns (EnemyAI) + event material effects (EventResolver) + unit tests (Wave 2)
- [ ] 06-03-PLAN.md — ShopScene upgrade UI + CombatScene upgrade visuals + EventScene upgrade handling + visual checkpoint (Wave 3)

### Phase 7: Polish & Release

**Goal:** Final v1 polish pass: rewrite tutorial with accurate gameplay content, add Web Audio API sound effects, standardize UI styling and scene transitions across all scenes, expand settings with volume/speed/save controls, close remaining requirement gaps (CMBT-05, PLSH-01)
**Requirements**: POLISH-AUDIO, POLISH-STYLE, POLISH-TUTORIAL, POLISH-SPEED, POLISH-SETTINGS, POLISH-TRANSITIONS, POLISH-META, CMBT-05, PLSH-01
**Depends on:** Phase 6
**Plans:** 2/3 plans executed

Plans:
- [ ] 07-01-PLAN.md — StyleConstants + SoundDefinitions + AudioManager Web Audio rewrite + MetaState v3 migration (Wave 1)
- [ ] 07-02-PLAN.md — Tutorial rewrite + SettingsScene expansion + game speed wiring + CMBT-05/PLSH-01 status updates (Wave 2)
- [ ] 07-03-PLAN.md — Camera fade transitions + visual consistency pass across all ~25 scenes + human verification checkpoint (Wave 3)
