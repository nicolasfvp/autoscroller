# Phase 4: Content, Meta-Progression + Persistence - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Populate the game with ~15 unique cards, ~8 relics, 2-3 boss types, and ~5 narrative events. Build a city-builder-lite meta-progression hub where players spend meta-loot to construct/upgrade buildings that unlock content permanently. Persist meta-progression data across browser sessions via IndexedDB. Implement seeded RNG for reproducible runs. This phase builds on Phase 1's architecture (RunState, EventBus, idb-keyval), Phase 2's combat/deck systems, and Phase 3's loop/tile world with meta-loot tracking.

</domain>

<decisions>
## Implementation Decisions

### Meta-Progression Hub: City Builder Lite
- **City hub between runs**: Player visits a top-down map view of their city between runs. Buildings are placed around a town square
- **4-5 buildings for v1**: Forge (unlock cards), Library (unlock passive skill tiers), Tavern (starting run bonuses + start new run), Workshop (unlock tile types), Shrine (unlock relics)
- **Multiple upgrade tiers per building**: Each building has 3-5 upgrade levels. Each tier costs more meta-loot and unlocks more content. Creates a long-term progression curve
- **Visual tier changes planned but deferred**: The system supports visual upgrades per tier (small tent -> full building), but v1 uses placeholder graphics. Art upgrades are future work
- **Full transparency on upgrades**: Player sees exactly what each upgrade tier unlocks before spending meta-loot. Informed decisions, no surprise purchases
- **Tavern starts new runs**: Click the Tavern building to start a new run. The Tavern also shows run history and best stats
- **Top-down map view**: Bird's-eye view of the city. Buildings arranged around a central town square. Player clicks buildings to interact
- **No reset option**: Once earned, always earned. No way to reset meta-progression

### Content Design
- **Cards: rebalance existing + add a few new**: The 14 existing cards get cooldown values (1.0-3.0s per Phase 2), rarity tiers, and balance adjustments. Add 1-3 new cards to hit ~15 unique cards with varied builds
- **Boss types: stat-based tiers for v1**: 2-3 boss types that are scaled enemies with different stat profiles. Tank (300% HP, 80% damage), Berserker (150% HP, 200% damage), Mage (200% HP, 120% damage + debuff). Unique mechanics are v2 (BOSS-01)
- **Relics: some gated, some available from start**: 3-4 common relics available in the loot pool from the beginning. Rare/epic/legendary relics unlock via Shrine building upgrades
- **Events: use existing 5 events**: The 5 events already defined in EventDefinitions.ts are sufficient for CONT-04. Migrate to JSON format per Phase 1 decision

### Permanent Unlock System
- **Two unlock sources**: (1) City building upgrades (meta-loot investment) for content unlocks. (2) Class XP milestones for class-specific cards and passives. Two parallel progression paths
- **Unlocked content joins ALL loot sources**: Unlocked cards appear everywhere -- combat rewards, shop inventory, treasure chests, event rewards. Same for relics and tile types
- **Collection screen**: Full collection view showing all possible cards/relics. Unlocked ones show details, locked ones show silhouettes with hints on how to unlock ("Unlock via Forge Lv.2"). Completionist motivation

### Seeded RNG
- **Optional seed input**: Player can enter a seed string before starting a run (in the Tavern), or leave blank for random. Same seed = same enemy spawns, same loot drops, same events
- **Shareable seeds**: Seeds are copyable text strings. Share with friends for "try my run" challenge moments

### Persistence (PERS-02)
- **Full meta-progression save**: City building levels (5 buildings x tier), meta-loot balance, class XP (warrior + future classes), passive skills unlocked, cards/relics/tiles unlock state, run history (best stats, total runs)
- **IndexedDB via idb-keyval** (per Phase 1 decision): Separate store from run state. Meta-progression is independent from in-run saves
- **No reset option**: Meta-progression cannot be reset

### Claude's Discretion
- Exact meta-loot costs per building tier
- Meta-loot earn rates from runs (Phase 3 tracks it, Phase 4 defines rates)
- Exact cards to add (1-3 new cards to reach ~15)
- Card cooldown values and rarity tier assignments for existing cards
- Boss stat multiplier exact values
- Relic distribution between starter pool and Shrine unlock tiers
- Class XP milestone thresholds and what they unlock
- Building effect values (Tavern starting bonuses, etc.)
- Tile types to add via Workshop unlocks
- Collection screen layout and navigation
- Seeded RNG algorithm choice (mulberry32, xorshift, etc.)
- Run history stats tracked and display format

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Game Design
- `.planning/PROJECT.md` -- Core value, key decisions, constraints, game references (Loop Hero, StS, auto-battlers)

### Requirements
- `.planning/REQUIREMENTS.md` -- RELC-01..04, META-01..04, CONT-01..04, PERS-02, PERS-03 mapped to this phase

### Phase 1 Context (architecture)
- `.planning/phases/01-architecture-foundation/01-CONTEXT.md` -- RunState shape, IndexedDB persistence via idb-keyval, auto-save strategy, JSON data files

### Phase 2 Context (combat + deck)
- `.planning/phases/02-combat-deck-engine/02-CONTEXT.md` -- Card cooldowns (1.0-3.0s), synergy pairs (4-6), relic triggers, warrior class XP (death = lose all XP), card reward system

### Phase 3 Context (loop + tiles)
- `.planning/phases/03-loop-tile-world/03-CONTEXT.md` -- Meta-loot in RunState, boss every 5 loops, safe exit = 100% loot + XP, death = 25% loot + 0 XP, tile economy, special tiles

### Existing Content (reference for migration to JSON)
- `src/data/CardDefinitions.ts` -- 14 cards with cost/effect system (need cooldown + rarity added)
- `src/data/RelicDefinitions.ts` -- 8 relics with trigger/effect system (need unlock-gate metadata added)
- `src/data/EnemyDefinitions.ts` -- 6 enemy types including boss (need boss type variants)
- `src/data/EventDefinitions.ts` -- 5 events with choices (migrate to JSON as-is)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CardDefinitions.ts`: 14 cards with effects array -- add `cooldown`, `rarity`, `unlockSource` fields, migrate to JSON
- `RelicDefinitions.ts`: 8 relics with trigger-based effects -- add `unlockSource`, `unlockTier` fields, migrate to JSON
- `EnemyDefinitions.ts`: 6 enemies with type field (normal/elite/boss) -- add boss type variants (tank/berserker/mage)
- `EventDefinitions.ts`: 5 events with choice system -- migrate to JSON, add `unlockSource` if needed
- `DifficultyConfig.ts`: Difficulty scaling formulas -- extend for boss type multipliers

### Established Patterns
- Card effects use `{ type, value, target }` pattern -- extend for new cards
- Relic effects use trigger-based `apply(context)` pattern -- triggers will be JSON-declarative per Phase 1
- Events use choice array with requirements -- same pattern for v1 events

### Integration Points
- `RunState` (Phase 1) will need: `meta` domain for city state, unlocks, class XP
- MetaState stored separately from RunState in IndexedDB (meta persists across runs, RunState is per-run)
- Phase 3's `meta-loot` field in RunState feeds into city building purchases on run end
- LootGenerator (Phase 3) needs to read unlock state to filter the loot pool

</code_context>

<specifics>
## Specific Ideas

- City builder lite creates a "second game" between runs -- spending meta-loot on buildings is strategic, not just a menu
- Two parallel progression paths (buildings + class XP) give players both a spend-resource path and a play-more path
- Full transparency on building upgrades respects the player's time -- no gambling on what they'll get
- Collection screen with silhouettes creates completionist pull ("I need Forge Lv.3 to see those last 3 cards")
- No reset option is intentional -- permanent progress should feel permanent

</specifics>

<deferred>
## Deferred Ideas

- Visual tier changes for buildings (art upgrades per building level) -- planned but v1 uses placeholder graphics
- Unique boss mechanics (phases, immunities, special attacks) -- v2 (BOSS-01)
- Additional classes beyond Warrior -- v2 (CLAS-01, CLAS-02)
- Card upgrade system -- v2 (CONT-09)
- Save export/import -- v2 (PLSH-05)

</deferred>

---

*Phase: 04-content-meta-progression-persistence*
*Context gathered: 2026-03-26*
