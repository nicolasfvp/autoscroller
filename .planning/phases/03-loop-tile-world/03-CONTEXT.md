# Phase 3: Loop + Tile World - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Players traverse an infinite loop of tiles in a side-view autoscroll, place terrain tiles during a planning phase between loops, and encounter all special tile types (shop, rest, event, treasure, boss). The loop grows dynamically after boss defeats. Difficulty scales per loop. Boss every 5 loops with safe exit option. Combat encounters are handled by Phase 2's CombatEngine. Meta-progression hub is Phase 4 -- this phase tracks meta-loot in RunState but doesn't build the hub.

</domain>

<decisions>
## Implementation Decisions

### Loop Traversal
- **Continuous autoscroll**: Hero walks right automatically at constant speed. Player never controls movement. Camera follows smoothly
- **Speed scaling**: Base speed ~60px/s, increases per loop for tension (Claude's discretion on exact curve)
- **Seamless loop wrap**: After the last tile, the first tile appears again with no visual break. Loop counter increments in the HUD
- **Dynamic loop length**: Starts at 15 tiles, grows by +3 tiles each time a boss is defeated. Early loops are compact and fast, late loops become epic journeys

### Tile Placement & Economy
- **Planning phase between loops**: Hero pauses between loops for a tile placement phase. Player sees the full loop layout and places tiles from inventory onto empty slots. No real-time placement during autoscroll
- **Empty slots only**: Tiles can only be placed on "basic" (empty) slots. No overwriting occupied tiles
- **Tiles persist for the entire run**: Once placed, tiles stay until the run ends. The loop becomes richer over time (core Loop Hero feel)
- **Dual tile economy**: (1) Tile points awarded each loop completion -- spend to buy specific tile types. (2) Rare tile drops from enemies go straight to inventory for free
- **Tile selling**: Sell tile drops at the shop for tile points at 50% of purchase cost

### Tile Adjacency Synergies
- **Stat buffs from adjacency**: Adjacent tiles of certain types boost each other with stat modifiers. E.g., two combat tiles = +gold drops, rest + shop = +HP recovery. Readable, predictable bonuses
- **No spawn-changing synergies**: Adjacency affects stats/buffs only, not what spawns. Keeps system simple

### Combat Tiles & Basic Tiles
- **Basic tiles have a small combat chance**: Empty/basic tiles have a small probability of spawning a weak enemy each loop. Not always safe
- **Combat tiles are terrain-themed**: Instead of one generic "combat" type, there are multiple terrain tiles (forest, graveyard, swamp, etc.). Each terrain type spawns its own enemy pool
- **Enemy pool scales with loop number**: Higher loops add tougher enemies to each terrain's pool

### Difficulty Scaling
- **Percentage per loop**: Enemy HP and damage increase by a fixed % each loop. Simple, predictable curve (e.g., +10% per loop)
- **Boss every 5 loops**: Boss encounter at loops 5, 10, 15, 20, etc. Each boss is a harder combat encounter using Phase 2's CombatEngine

### Boss Encounters
- **Combat + exit choice**: After defeating a boss, player chooses: exit run safely (bank all meta-loot + XP) or continue (loop grows +3 tiles, risk death)
- **Safe exit = 100% meta-loot + all class XP**: Full rewards banked for meta-progression
- **Death = 25% meta-loot, zero XP**: XP is ONLY banked on safe exit. This makes the boss exit decision high-stakes

### Reward System
- **Meta-loot tracked in RunState**: A currency/material meant for outside-the-loop activities (hub building, etc. -- Phase 4). Phase 3 tracks it, Phase 4 uses it
- **XP only on safe exit**: Class XP earned during combat is NOT banked on death. Reinforces Phase 2's decision that death loses all accumulated XP

### Special Tiles: Shop
- **Full deck management hub**: Buy new cards (3 random, gold cost), remove cards (escalating cost per Phase 2), reorder deck (flat session cost per Phase 2), buy relics (1-2 random, expensive)
- **Tile selling at shop**: Sell tile drops for tile points at reduced rate (50% of purchase cost)
- **Prices may scale with loop/difficulty** (Claude's discretion on exact scaling)

### Special Tiles: Rest
- **Choice-based rest site**: Player chooses one: Recover HP (~30% max), Train (+stat to a card), or Meditate (+max stamina or mana). Strategic decision like Slay the Spire campfires

### Special Tiles: Event
- **Text + 2-3 choices with tradeoffs**: Short narrative encounter with clear risk/reward options. E.g., drink mysterious potion (random buff/debuff), buy it (gold for guaranteed buff), or ignore
- **~5 events for v1** (CONT-04 in Phase 4 handles content population). Phase 3 builds the event system and a few placeholder events

### Special Tiles: Treasure
- **Guaranteed loot screen**: Open chest, see all loot at once (1-3 items: cards, gold, relics, tile drops). "Take All" -- always rewarding, no forced choice

### Special Tiles: Boss
- **Last tile of the loop**: Boss tile appears at the final position every 5 loops. Walking over it triggers boss combat
- **Post-boss choice screen**: Exit run safely or continue (see Boss Encounters above)

### Claude's Discretion
- Autoscroll speed curve and exact values
- Tile point costs per tile type and points earned per loop
- Exact enemy pool composition per terrain type
- Adjacency synergy pair definitions and buff values
- Difficulty scaling percentage per loop
- Planning phase UI layout and flow
- Meta-loot currency name and earn rates
- Boss stat multipliers vs normal enemies
- Treasure loot table composition
- Rest site heal/train/meditate exact values

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Game Design
- `.planning/PROJECT.md` -- Core value, key decisions, constraints, game references (Loop Hero, StS, auto-battlers)

### Requirements
- `.planning/REQUIREMENTS.md` -- LOOP-01..08, TILE-01..05, SPEC-01..05 mapped to this phase

### Phase 1 Context (architecture)
- `.planning/phases/01-architecture-foundation/01-CONTEXT.md` -- RunState shape (loop/tiles/economy domains), EventBus granularity, static data as JSON, persistence strategy

### Phase 2 Context (combat + deck)
- `.planning/phases/02-combat-deck-engine/02-CONTEXT.md` -- CombatEngine, deck management (add/remove/reorder costs), synergy system, warrior class XP (death = lose all XP), card reward choices

### Existing Code (reference for current loop/tile implementation)
- `src/scenes/Game.ts` -- Current God Scene with loop traversal, tile interaction, tile placement UI (to be rewritten)
- `src/objects/MapManager.ts` -- Current tile map rendering, loop tracking, tile expansion/cleanup (to be rewritten as pure TS system)
- `src/data/TileTypes.ts` -- 8 tile types defined with configs (to be migrated to JSON and expanded with terrain subtypes)
- `src/data/TileInventory.ts` -- Tile inventory module-level state (to be migrated into RunState)
- `src/data/DifficultyConfig.ts` -- Current difficulty scaling config (to be migrated to JSON)
- `src/data/TileData.ts` -- TileData interface (type, color, isDefeated)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TileTypes.ts`: 8 tile type configs with color, name, canPlaceManually flags -- extend with terrain subtypes (forest, graveyard, etc.)
- `DifficultyConfig.ts`: Difficulty scaling structure with HP/damage multipliers, drop rates -- adapt for per-loop scaling
- `MapManager.ts`: Tile expansion/cleanup pattern (generate ahead, destroy behind) -- logic moves to pure TS LoopRunner system
- `TileData` interface: Basic tile data shape -- extend with terrain type, synergy state, enemy pool reference

### Established Patterns
- Camera follows player with deadzone (`cameras.main.startFollow`) -- reuse for autoscroll
- Tile click events emitted via scene events (`tile-clicked`) -- migrate to EventBus
- Loop counting via `Math.floor(playerX / (loopLength * tileSize))` -- adapt for dynamic loop length
- Tile persistence via `TileLoopPersistence.ts` -- migrate to RunState/IndexedDB

### Integration Points
- `RunState` (Phase 1) will own: loop count, tile layout, tile inventory, tile points, meta-loot, difficulty level
- `EventBus` (Phase 1) will dispatch: `loop-completed`, `tile-placed`, `tile-entered`, `boss-defeated`, `run-exited`, `planning-phase-started`
- `CombatEngine` (Phase 2) handles all combat encounters triggered by combat/elite/boss tiles
- Shop scene (Phase 2 deck management) extended with relic purchases and tile selling

</code_context>

<specifics>
## Specific Ideas

- Dynamic loop growth tied to boss kills creates a natural "your world expands as you get stronger" feeling
- Basic tiles having a small combat chance means no tile is truly safe -- adds tension even to empty paths
- Terrain-themed combat tiles (forest, graveyard, swamp) instead of generic "combat" -- each terrain has its own enemy pool, creating identity
- Planning phase between loops (not real-time placement) gives the tile placement strategic weight -- player thinks about layout, not reflexes
- XP only on safe exit + meta-loot at 25% on death creates a compelling risk/reward boss exit decision
- Tile adjacency synergies are stat buffs only (not spawn changes) -- keeps the system readable and predictable

</specifics>

<deferred>
## Deferred Ideas

- **Autoplay mode**: Toggle where hero never stops at events; all encounters queue as inventory items (card packs, event scrolls) to resolve later. Requires deferred-rewards inventory system. Could be Phase 3.1 insertion
- **Hub/city building with meta-loot**: Outside-the-loop activities using meta-loot currency. Phase 4 (META-01)
- **Terrain-specific adjacency spawn changes**: Adjacent terrain combos changing WHAT spawns (not just stat buffs). Future enhancement if adjacency system needs more depth

</deferred>

---

*Phase: 03-loop-tile-world*
*Context gathered: 2026-03-26*
