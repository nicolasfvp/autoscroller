# Phase 3: Loop + Tile World - Research

**Researched:** 2026-03-26
**Domain:** Infinite loop traversal, tile placement economy, special tile scenes, difficulty scaling, boss exit system
**Confidence:** HIGH

## Summary

Phase 3 transforms the game from isolated combat encounters into a connected world loop. The hero autoscrolls through an infinite loop of tiles, the player places terrain tiles during a planning phase between loops, and special tiles (shop, rest, event, treasure, boss) provide strategic depth. This phase is the "Loop Hero" layer -- the outer gameplay loop that wraps Phase 2's combat engine.

The core technical challenge is building the **LoopRunner** pure-TS system that manages loop state, tile layout, difficulty scaling, and seamless visual looping -- all decoupled from Phaser scenes per Phase 1's architecture. The planning phase overlay, tile adjacency synergy system, and 5 special tile scene overlays are the primary UI deliverables. All existing code in `Game.ts`, `MapManager.ts`, `TileTypes.ts`, `TileInventory.ts`, and `DifficultyConfig.ts` is reference material only -- Phase 1's clean rewrite decision means these are rebuilt as pure TS systems with thin Phaser scene wrappers.

**Primary recommendation:** Build the LoopRunner as a pure TypeScript state machine (idle -> traversing -> tile-interaction -> planning -> boss-choice), driven by EventBus events and operating on RunState. All 5 special tile scenes are thin overlay scenes reading from RunState. Tile adjacency synergies use a declarative JSON config (pairs + buff definitions) evaluated by a pure `SynergyResolver` function.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Continuous autoscroll**: Hero walks right automatically at constant speed. Player never controls movement. Camera follows smoothly
- **Speed scaling**: Base speed ~60px/s, increases per loop for tension
- **Seamless loop wrap**: After the last tile, the first tile appears again with no visual break. Loop counter increments in the HUD
- **Dynamic loop length**: Starts at 15 tiles, grows by +3 tiles each time a boss is defeated
- **Planning phase between loops**: Hero pauses between loops for a tile placement phase. No real-time placement during autoscroll
- **Empty slots only**: Tiles can only be placed on "basic" (empty) slots. No overwriting occupied tiles
- **Tiles persist for the entire run**: Once placed, tiles stay until the run ends
- **Dual tile economy**: (1) Tile points awarded each loop completion. (2) Rare tile drops from enemies go straight to inventory for free
- **Tile selling**: Sell tile drops at the shop for tile points at 50% of purchase cost
- **Stat buffs from adjacency**: Adjacent tiles of certain types boost each other with stat modifiers. No spawn-changing synergies
- **Basic tiles have a small combat chance**: Empty/basic tiles have a small probability of spawning a weak enemy each loop
- **Combat tiles are terrain-themed**: Forest, graveyard, swamp, etc. Each terrain type spawns its own enemy pool
- **Enemy pool scales with loop number**: Higher loops add tougher enemies to each terrain's pool
- **Percentage per loop**: Enemy HP and damage increase by a fixed % each loop (e.g., +10% per loop)
- **Boss every 5 loops**: Boss encounter at loops 5, 10, 15, 20, etc.
- **Combat + exit choice**: After defeating a boss, player chooses: exit run safely (100% meta-loot + all XP) or continue (+3 tiles, risk death)
- **Death = 25% meta-loot, zero XP**: XP is ONLY banked on safe exit
- **Meta-loot tracked in RunState**: Phase 3 tracks it, Phase 4 uses it
- **Shop: full deck management hub**: Buy cards, remove cards, reorder deck, buy relics, sell tile drops for tile points
- **Rest: choice-based**: Recover HP (~30%), Train (+stat to card), Meditate (+max stamina or mana)
- **Event: text + 2-3 choices**: Short narrative encounters with risk/reward. ~5 events for v1 (Phase 3 builds the system + placeholders)
- **Treasure: guaranteed loot**: Open chest, see all loot, "Take All"
- **Boss tile: last tile of loop every 5 loops**: Walking over it triggers boss combat

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

### Deferred Ideas (OUT OF SCOPE)
- **Autoplay mode**: Toggle where hero never stops at events; all encounters queue as inventory items. Phase 3.1 potential
- **Hub/city building with meta-loot**: Outside-the-loop activities. Phase 4 (META-01)
- **Terrain-specific adjacency spawn changes**: Adjacent terrain combos changing WHAT spawns. Future enhancement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LOOP-01 | Hero traverses tiles in infinite loop (side-view, autoscroll) | LoopRunner state machine + camera follow pattern from existing MapManager |
| LOOP-02 | Player places terrain tiles on the path during a run | Planning phase overlay with tile inventory panel, placement on empty slots only |
| LOOP-03 | Adjacent tiles interact with each other (synergy/combo effects) | SynergyResolver with declarative JSON config, stat-buff-only adjacency |
| LOOP-04 | Terrains spawn specific enemies and provide resources/buffs | Terrain type configs in JSON with enemy pool references and buff definitions |
| LOOP-05 | Difficulty scales each loop (enemy stats increase) | Flat percentage per loop applied via DifficultyScaler function |
| LOOP-06 | Boss appears every X loops completed | Boss tile injected at last position every 5 loops by LoopRunner |
| LOOP-07 | Defeating boss gives option to exit with 100% rewards | BossExitChoice overlay scene with safe-exit vs continue |
| LOOP-08 | Dying mid-run returns 25% of rewards | RunEndResolver calculates meta-loot at 25%, XP at 0 on death |
| TILE-01 | Player earns tile points each loop completed | LoopRunner awards tile points on `loop-completed` event |
| TILE-02 | Rare tile drops from enemies (free, into inventory) | Extend existing EnemyDrops tile drop system, add to RunState.tileInventory |
| TILE-03 | Tile drops can be sold for tile points at reduced rate | Shop scene extension: sell tiles at 50% of purchase cost |
| TILE-04 | 6+ functional tile types | 8 types: basic, forest, graveyard, swamp, shop, rest, event, treasure, boss |
| TILE-05 | Tile placement UI for positioning tiles during the run | Planning phase overlay with miniature loop grid and tile inventory panel |
| SPEC-01 | Shop tile: buy cards, remove cards, reorder deck, buy relics | Extend Phase 2 ShopScene with relic purchases and tile selling section |
| SPEC-02 | Event tile: narrative encounters with meaningful choices | EventScene overlay reading from event definitions JSON |
| SPEC-03 | Rest tile: recover HP | RestSiteScene overlay with 3 choices (rest/train/meditate) |
| SPEC-04 | Treasure tile: guaranteed loot | TreasureScene overlay with loot table roll and "Take All" |
| SPEC-05 | Boss tile: special combat encounter with better rewards | Boss tile triggers CombatEngine with boss-scaled enemy, then BossExitChoice |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phaser | ^3.80.0 (installed) | Game engine, rendering, camera, input | Already in project; all game rendering is Phaser |
| TypeScript | ^5.2.2 (installed) | Type safety for all pure TS systems | Already in project |
| Vite | ^5.0.0 (installed) | Dev server and build tool | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| idb-keyval | (Phase 1 dependency) | IndexedDB persistence for RunState | Auto-save on loop completion, boss defeat, shop exit |

No new dependencies needed for Phase 3. All systems are pure TypeScript operating on RunState with Phaser for rendering.

## Architecture Patterns

### Recommended Project Structure
```
src/
  systems/
    LoopRunner.ts          # Pure TS state machine: loop traversal, tile entry, planning phase transitions
    TileRegistry.ts        # Tile type definitions, terrain configs, tile factory
    SynergyResolver.ts     # Evaluates adjacency synergies for a tile layout
    DifficultyScaler.ts    # Calculates enemy stat multipliers per loop
    LootGenerator.ts       # Rolls treasure loot, tile drops, meta-loot rewards
    RunEndResolver.ts      # Calculates final rewards on death (25%) or safe exit (100%)
  data/
    tiles.json             # Tile type definitions: costs, terrain enemy pools, colors, buffs
    synergies.json         # Adjacency synergy pairs: [{left, right, buff}]
    events.json            # Event definitions: narrative text, choices, effects
    difficulty.json        # Difficulty scaling config: base multiplier, per-loop increment
  scenes/
    GameScene.ts           # Thin wrapper: renders tiles, hero, HUD, delegates to LoopRunner
    PlanningOverlay.ts     # Overlay scene: miniature loop grid + tile inventory
    ShopScene.ts           # Overlay: extends Phase 2 with relic purchases + tile selling
    RestSiteScene.ts       # Overlay: 3-choice rest site
    EventScene.ts          # Overlay: narrative event with choices
    TreasureScene.ts       # Overlay: loot display with "Take All"
    BossExitScene.ts       # Overlay: exit run vs continue choice
```

### Pattern 1: LoopRunner State Machine
**What:** Pure TS system that manages the loop lifecycle as a finite state machine. States: `idle`, `traversing`, `tile-interaction`, `planning`, `boss-choice`, `run-ended`. All transitions fire EventBus events.
**When to use:** Always -- this is the core system driving Phase 3 gameplay.
**Example:**
```typescript
// LoopRunner.ts -- pure TS, no Phaser imports
type LoopState = 'idle' | 'traversing' | 'tile-interaction' | 'planning' | 'boss-choice' | 'run-ended';

interface LoopRunnerConfig {
  baseSpeed: number;        // 60 px/s
  speedScalePerLoop: number; // e.g., 1.02 per loop
  baseTilePointsPerLoop: number; // e.g., 3
  bossEveryNLoops: number;  // 5
  baseLoopLength: number;   // 15
  loopGrowthOnBossKill: number; // 3
}

export class LoopRunner {
  private state: LoopState = 'idle';

  // Called every frame by GameScene.update(delta)
  tick(delta: number): void {
    if (this.state !== 'traversing') return;
    const run = getRun();
    const speed = this.config.baseSpeed * Math.pow(this.config.speedScalePerLoop, run.loop.count);
    run.loop.positionInLoop += speed * (delta / 1000);

    // Check tile boundary crossing
    const tileIndex = Math.floor(run.loop.positionInLoop / TILE_SIZE);
    if (tileIndex !== this.lastTileIndex) {
      this.onTileEntered(tileIndex);
    }

    // Check loop wrap
    if (run.loop.positionInLoop >= run.loop.length * TILE_SIZE) {
      this.onLoopCompleted();
    }
  }
}
```

### Pattern 2: Overlay Scene Pattern (Special Tiles)
**What:** All special tile interactions (shop, rest, event, treasure, boss exit) are Phaser overlay scenes launched on top of the paused GameScene. They read from RunState, mutate it, and close -- no data passed via scene.launch().
**When to use:** Every special tile interaction.
**Example:**
```typescript
// RestSiteScene.ts -- thin overlay scene
export class RestSiteScene extends Phaser.Scene {
  create() {
    const run = getRun();
    // Build UI from RunState
    // On choice: mutate RunState directly
    // On close: this.scene.stop(); this.scene.resume('GameScene');
  }
}
```

### Pattern 3: Declarative Synergy Config
**What:** Adjacency synergies defined as JSON data, evaluated by a pure function. No hardcoded synergy logic.
**When to use:** Tile adjacency evaluation during planning phase and when entering tiles.
**Example:**
```typescript
// synergies.json
[
  { "left": "forest", "right": "forest", "buff": { "type": "goldDropBonus", "value": 0.15 } },
  { "left": "rest", "right": "shop", "buff": { "type": "hpRecoveryBonus", "value": 0.10 } },
  { "left": "graveyard", "right": "swamp", "buff": { "type": "xpBonus", "value": 0.20 } }
]

// SynergyResolver.ts -- pure function
export function resolveAdjacencySynergies(tiles: TileData[]): SynergyBuff[] {
  const buffs: SynergyBuff[] = [];
  for (let i = 0; i < tiles.length - 1; i++) {
    const pair = synergies.find(s =>
      (s.left === tiles[i].terrain && s.right === tiles[i+1].terrain) ||
      (s.right === tiles[i].terrain && s.left === tiles[i+1].terrain)
    );
    if (pair) buffs.push({ tileIndex: i, ...pair.buff });
  }
  // Also check wrap-around: last tile adjacent to first tile
  // ...
  return buffs;
}
```

### Pattern 4: Tile Layout in RunState
**What:** The loop's tile layout is stored as an array in RunState. Each tile entry contains its type, terrain subtype, and defeated-this-loop flag.
**When to use:** All tile operations read/write this array.
**Example:**
```typescript
// In RunState.loop
interface LoopState {
  count: number;               // Current loop number (1-indexed)
  length: number;              // Current number of tiles (starts 15)
  tiles: TileSlot[];           // The tile layout array
  positionInLoop: number;      // Hero's current position in pixels within the loop
  tilePoints: number;          // Accumulated tile points
  metaLoot: number;            // Accumulated meta-loot for this run
}

interface TileSlot {
  type: 'basic' | 'terrain' | 'shop' | 'rest' | 'event' | 'treasure' | 'boss';
  terrain?: 'forest' | 'graveyard' | 'swamp'; // Only for terrain combat tiles
  defeatedThisLoop: boolean;   // Reset each loop
}
```

### Anti-Patterns to Avoid
- **God Scene pattern:** Do NOT put loop logic, tile interaction handling, and UI updates all in GameScene. GameScene delegates to LoopRunner and only renders.
- **Data passing via scene.launch():** Per Phase 1 architecture, scenes read from RunState. Never pass heroStats, gold, etc. as scene launch data.
- **Module-level state:** TileInventory.ts currently uses module-level Map. Must migrate to RunState.tileInventory array.
- **Hardcoded synergy logic:** Do not use switch/case or if/else chains for synergy pairs. Use declarative JSON config.
- **Real-time tile placement:** CONTEXT.md explicitly locks tile placement to the planning phase only. Never allow placement during autoscroll.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Difficulty curve | Custom math per enemy type | Single `DifficultyScaler(loopCount, config)` function with JSON config | One formula, tunable via config, applied uniformly |
| Tile type registry | Switch/case for each tile type | Data-driven `TileRegistry` loading from `tiles.json` | Adding new tile types = adding JSON, not code |
| Event system | Hardcoded event logic per event ID | Data-driven `EventResolver` reading from `events.json` | Existing EventDefinitions.ts already has this shape |
| Loot tables | Inline random rolls scattered across scenes | Centralized `LootGenerator` with weighted tables | Testable, tunable, single source of truth |
| Camera follow + autoscroll | Custom camera positioning logic | Phaser's built-in `cameras.main.startFollow()` with deadzone | Already proven in existing codebase, handles edge cases |

**Key insight:** Phase 3 has a LOT of data (tile types, terrain enemy pools, synergy pairs, events, difficulty curves, loot tables, shop prices). The biggest risk is scattering this data across code files. All game data must live in JSON configs loaded at startup. Code provides the engine; JSON provides the content.

## Common Pitfalls

### Pitfall 1: Seamless Loop Wrap Visual Glitch
**What goes wrong:** When the hero reaches the last tile and wraps to the first, there's a visible jump, teleport, or gap in the tile strip.
**Why it happens:** The tile rendering uses absolute world positions, and wrapping requires either teleporting the hero or maintaining an infinite tile stream that pre-generates tiles ahead.
**How to avoid:** Continue the existing MapManager pattern: generate tiles ahead of the camera, clean up behind. The loop "wraps" logically (positionInLoop resets to 0) but visually the hero walks continuously forward. Tiles repeat because `baseTiles[globalIndex % loopLength]` naturally cycles.
**Warning signs:** Hero visually jumps backward, brief empty space between loops, tile colors mismatch at the seam.

### Pitfall 2: Planning Phase State Corruption
**What goes wrong:** Tiles placed during planning are not reflected when the loop actually runs, or tile points are deducted but tiles don't appear.
**Why it happens:** Planning phase mutates a local copy of tile layout instead of RunState directly, or mutations happen before auto-save.
**How to avoid:** Planning phase mutates RunState.loop.tiles directly. Auto-save triggers after planning phase confirmation ("Start Loop" button). SynergyResolver runs on the same RunState.loop.tiles array.
**Warning signs:** Tiles disappear after starting the loop, adjacency synergies don't match what was shown in planning.

### Pitfall 3: Boss Tile Injection Timing
**What goes wrong:** Boss tile appears at wrong loop, appears mid-loop, or doesn't appear at all.
**Why it happens:** Boss tile is injected dynamically but the injection logic doesn't account for dynamic loop length or off-by-one in loop counting.
**How to avoid:** Boss tile injection is deterministic: `if (run.loop.count % 5 === 0)` then `tiles[tiles.length - 1]` becomes boss type. This is checked when the loop starts (after planning phase), not during traversal.
**Warning signs:** Boss at loop 4 instead of 5, boss tile at random position instead of last.

### Pitfall 4: Dynamic Loop Length After Boss Kill
**What goes wrong:** Loop grows by +3 tiles but existing tile positions shift, breaking placed tiles' positions.
**Why it happens:** Tiles are appended but the existing array is re-indexed or shifted.
**How to avoid:** When loop grows by +3 on boss defeat, append 3 new `basic` tiles before the boss position (the last slot). Existing tiles keep their indices. The boss position is always `tiles.length - 1`.
**Warning signs:** Placed tiles appear at wrong positions after boss kill, synergies break after loop growth.

### Pitfall 5: Overlay Scene Z-ordering and Pause State
**What goes wrong:** Multiple overlay scenes stack, or the Game scene continues running behind an overlay, or input bleeds through to the Game scene.
**Why it happens:** Phaser scene management requires explicit pause/resume of the underlying scene.
**How to avoid:** Pattern: `scene.pause('GameScene'); scene.launch('OverlayScene');` on open. `scene.stop('OverlayScene'); scene.resume('GameScene');` on close. Only one overlay at a time. Use `setDepth()` consistently.
**Warning signs:** Hero moves while in shop, clicks register on tiles behind overlay, two overlays open simultaneously.

### Pitfall 6: Memory Growth Over Long Runs
**What goes wrong:** After 50+ loops, performance degrades because tile GameObjects accumulate.
**Why it happens:** Tile rectangles are created but never destroyed, or destroyed tiles leave orphaned references.
**How to avoid:** Continue MapManager's expand-ahead/cleanup-behind pattern. Only ~30 tile GameObjects exist at any time (visible tiles + 10 buffer each direction). Use object pooling if needed.
**Warning signs:** Increasing frame times after many loops, growing memory in DevTools.

## Code Examples

### Loop Completion Flow
```typescript
// LoopRunner.ts
private onLoopCompleted(): void {
  const run = getRun();
  run.loop.count += 1;
  run.loop.positionInLoop = 0;

  // Award tile points
  const tpEarned = this.config.baseTilePointsPerLoop + Math.floor(run.loop.count * 0.5);
  run.economy.tilePoints += tpEarned;

  // Reset defeated flags for all tiles
  run.loop.tiles.forEach(t => t.defeatedThisLoop = false);

  // Apply difficulty scaling
  run.loop.difficultyMultiplier = 1 + (run.loop.count - 1) * 0.10; // +10% per loop

  // Check if boss loop
  const isBossLoop = run.loop.count % 5 === 0;
  if (isBossLoop) {
    run.loop.tiles[run.loop.tiles.length - 1] = { type: 'boss', defeatedThisLoop: false };
  }

  eventBus.emit('loop-completed', { loop: run.loop.count, tpEarned, isBossLoop });

  this.state = 'planning'; // Transition to planning phase
  eventBus.emit('planning-phase-started', { loop: run.loop.count });
}
```

### Tile Entry Handling
```typescript
// LoopRunner.ts
private onTileEntered(tileIndex: number): void {
  const run = getRun();
  const tile = run.loop.tiles[tileIndex];

  if (tile.defeatedThisLoop) return; // Already interacted this loop

  switch (tile.type) {
    case 'basic':
      // Small chance of weak enemy on basic tiles
      if (Math.random() < 0.10) {
        this.state = 'tile-interaction';
        eventBus.emit('combat-start', { enemyType: 'slime', isBoss: false });
      }
      break;
    case 'terrain':
      this.state = 'tile-interaction';
      const enemy = this.rollEnemyForTerrain(tile.terrain!, run.loop.count);
      eventBus.emit('combat-start', { enemyType: enemy, isBoss: false });
      break;
    case 'shop':
      this.state = 'tile-interaction';
      eventBus.emit('open-scene', { scene: 'ShopScene' });
      break;
    case 'rest':
      this.state = 'tile-interaction';
      eventBus.emit('open-scene', { scene: 'RestSiteScene' });
      break;
    case 'event':
      this.state = 'tile-interaction';
      eventBus.emit('open-scene', { scene: 'EventScene' });
      break;
    case 'treasure':
      this.state = 'tile-interaction';
      eventBus.emit('open-scene', { scene: 'TreasureScene' });
      break;
    case 'boss':
      this.state = 'tile-interaction';
      eventBus.emit('combat-start', { enemyType: 'boss', isBoss: true });
      break;
  }

  tile.defeatedThisLoop = true;
}
```

### Difficulty Scaling Function
```typescript
// DifficultyScaler.ts -- pure function
export interface ScaledEnemyStats {
  hp: number;
  damage: number;
  defense: number;
  goldReward: number;
}

export function scaleEnemyForLoop(
  baseEnemy: EnemyDefinition,
  loopCount: number,
  config: { percentPerLoop: number; bossMultiplier: number }
): ScaledEnemyStats {
  const loopMult = 1 + (loopCount - 1) * config.percentPerLoop; // e.g., 1 + 4*0.10 = 1.4 at loop 5
  return {
    hp: Math.floor(baseEnemy.baseHP * loopMult),
    damage: Math.floor(baseEnemy.attack.damage * loopMult),
    defense: Math.floor(baseEnemy.baseDefense * loopMult),
    goldReward: Math.floor(((baseEnemy.goldReward.min + baseEnemy.goldReward.max) / 2) * Math.sqrt(loopMult))
  };
}
```

### RunState Loop Domain Shape
```typescript
// RunState extensions for Phase 3
interface RunState {
  // ...existing from Phase 1/2...
  loop: {
    count: number;                    // Current loop (1-indexed)
    length: number;                   // Current tile count (starts 15)
    tiles: TileSlot[];                // The loop layout
    positionInLoop: number;           // Hero pixel position within the loop
    difficultyMultiplier: number;     // Current loop's difficulty
  };
  economy: {
    gold: number;                     // From Phase 2
    tilePoints: number;               // Tile placement currency
    metaLoot: number;                 // Run meta-loot (Phase 4 currency)
  };
  tileInventory: TileInventoryEntry[]; // Dropped tiles available for free placement
}

interface TileSlot {
  type: 'basic' | 'terrain' | 'shop' | 'rest' | 'event' | 'treasure' | 'boss';
  terrain?: 'forest' | 'graveyard' | 'swamp';
  defeatedThisLoop: boolean;
}

interface TileInventoryEntry {
  tileType: string;  // e.g., 'forest', 'shop', 'rest'
  count: number;
}
```

## State of the Art

| Old Approach (Existing Code) | Current Approach (Phase 3 Target) | Impact |
|------------------------------|-----------------------------------|--------|
| MapManager with Phaser-coupled tile rendering + logic | Pure TS LoopRunner for logic, thin GameScene for rendering | Testable, Phaser-independent loop system |
| Module-level `tileInventory` Map | RunState.tileInventory array | Serializable, single source of truth |
| `TileTypes.ts` TypeScript const | `tiles.json` runtime-loaded data | Editable without recompile |
| `DifficultyConfig.ts` with module-level state | Pure `DifficultyScaler` function + `difficulty.json` | No mutable state, testable |
| `EventDefinitions.ts` hardcoded array | `events.json` loaded at startup | Content-editable |
| Fixed 20-tile loop length, boss at loop 100 | Dynamic loop length (15 + 3 per boss kill), boss every 5 loops | Matches CONTEXT.md decisions |
| Tile placement during autoscroll (click on map) | Planning phase between loops (overlay UI) | Strategic, not reflex-based |
| No adjacency synergies | Declarative JSON synergy config + SynergyResolver | New feature per LOOP-03 |
| No meta-loot tracking | RunState.economy.metaLoot + RunEndResolver | Phase 4 preparation |

## Open Questions

1. **Terrain enemy pool composition**
   - What we know: Forest, graveyard, swamp are the 3 terrain types. Each spawns from its own enemy pool. Pool expands with loop number.
   - What's unclear: Exact enemy-to-terrain mapping. Current code has 4 normal enemies (slime, goblin, orc, mage) and 1 elite.
   - Recommendation: Claude's discretion per CONTEXT.md. Suggested mapping: Forest = {slime, goblin}, Graveyard = {mage, elite_knight}, Swamp = {orc, goblin}. Higher loops add cross-pool enemies.

2. **Synergy pair definitions**
   - What we know: Adjacency affects stats/buffs only, not spawns. Pairs must be readable and predictable.
   - What's unclear: How many synergy pairs? Which combinations?
   - Recommendation: Claude's discretion. Start with 4-6 pairs: forest+forest (gold bonus), rest+shop (HP bonus), graveyard+graveyard (XP bonus), forest+swamp (tile drop bonus), swamp+graveyard (damage bonus), rest+event (better event outcomes).

3. **Tile point economy balance**
   - What we know: Dual economy -- points per loop + rare drops from enemies. Tile selling at 50%.
   - What's unclear: Exact costs per tile type, points earned per loop.
   - Recommendation: Claude's discretion. Suggested: 3 TP base per loop + 0.5 per loop number. Tile costs: terrain (3 TP), shop (5 TP), rest (4 TP), event (2 TP), treasure (6 TP).

4. **Meta-loot earn rate**
   - What we know: Tracked in RunState, Phase 4 uses it. 100% on safe exit, 25% on death.
   - What's unclear: How much is earned per loop/combat/event.
   - Recommendation: Claude's discretion. Suggested: 1-2 per combat win, 5 per loop completion, 10 per boss kill. Name suggestion: "Essence" or "Embers".

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently installed |
| Config file | none -- see Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOOP-01 | LoopRunner advances position per tick, wraps at loop end | unit | `npx vitest run tests/systems/LoopRunner.test.ts -t "traversal"` | No -- Wave 0 |
| LOOP-02 | Planning phase allows placing tiles on empty slots only | unit | `npx vitest run tests/systems/LoopRunner.test.ts -t "planning"` | No -- Wave 0 |
| LOOP-03 | SynergyResolver returns correct buffs for adjacent pairs | unit | `npx vitest run tests/systems/SynergyResolver.test.ts` | No -- Wave 0 |
| LOOP-04 | Terrain tiles spawn correct enemy pool for terrain type | unit | `npx vitest run tests/systems/LoopRunner.test.ts -t "terrain spawn"` | No -- Wave 0 |
| LOOP-05 | DifficultyScaler returns correct multiplied stats | unit | `npx vitest run tests/systems/DifficultyScaler.test.ts` | No -- Wave 0 |
| LOOP-06 | Boss tile injected at correct loop intervals | unit | `npx vitest run tests/systems/LoopRunner.test.ts -t "boss"` | No -- Wave 0 |
| LOOP-07 | RunEndResolver returns 100% meta-loot on safe exit | unit | `npx vitest run tests/systems/RunEndResolver.test.ts -t "safe exit"` | No -- Wave 0 |
| LOOP-08 | RunEndResolver returns 25% meta-loot, 0 XP on death | unit | `npx vitest run tests/systems/RunEndResolver.test.ts -t "death"` | No -- Wave 0 |
| TILE-01 | Tile points awarded on loop completion, scales with loop count | unit | `npx vitest run tests/systems/LoopRunner.test.ts -t "tile points"` | No -- Wave 0 |
| TILE-02 | Tile drops added to RunState tileInventory | unit | `npx vitest run tests/systems/LootGenerator.test.ts -t "tile drop"` | No -- Wave 0 |
| TILE-03 | Tile selling returns 50% tile points | unit | `npx vitest run tests/systems/ShopSystem.test.ts -t "tile sell"` | No -- Wave 0 |
| TILE-04 | TileRegistry has 6+ functional tile types | unit | `npx vitest run tests/systems/TileRegistry.test.ts` | No -- Wave 0 |
| TILE-05 | Tile placement only on basic slots, persists in RunState | unit | `npx vitest run tests/systems/LoopRunner.test.ts -t "placement"` | No -- Wave 0 |
| SPEC-01 | Shop scene reads/writes RunState for deck mgmt + relic buy + tile sell | integration | manual-only (Phaser scene rendering) | No |
| SPEC-02 | EventResolver applies choice effects to RunState | unit | `npx vitest run tests/systems/EventResolver.test.ts` | No -- Wave 0 |
| SPEC-03 | Rest site applies HP recovery / train / meditate to RunState | unit | `npx vitest run tests/systems/RestSiteSystem.test.ts` | No -- Wave 0 |
| SPEC-04 | LootGenerator rolls treasure loot, adds to RunState | unit | `npx vitest run tests/systems/LootGenerator.test.ts -t "treasure"` | No -- Wave 0 |
| SPEC-05 | Boss combat uses scaled boss stats, triggers exit choice on win | integration | manual-only (CombatEngine + scene flow) | No |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest` + `@vitest/runner` -- install as devDependency: `npm install -D vitest`
- [ ] `vitest.config.ts` -- basic config pointing to `tests/` directory
- [ ] `tests/systems/LoopRunner.test.ts` -- covers LOOP-01, LOOP-02, LOOP-04, LOOP-06, TILE-01, TILE-05
- [ ] `tests/systems/SynergyResolver.test.ts` -- covers LOOP-03
- [ ] `tests/systems/DifficultyScaler.test.ts` -- covers LOOP-05
- [ ] `tests/systems/RunEndResolver.test.ts` -- covers LOOP-07, LOOP-08
- [ ] `tests/systems/LootGenerator.test.ts` -- covers TILE-02, SPEC-04
- [ ] `tests/systems/TileRegistry.test.ts` -- covers TILE-04
- [ ] `tests/systems/ShopSystem.test.ts` -- covers TILE-03
- [ ] `tests/systems/EventResolver.test.ts` -- covers SPEC-02
- [ ] `tests/systems/RestSiteSystem.test.ts` -- covers SPEC-03

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/scenes/Game.ts`, `src/objects/MapManager.ts`, `src/data/TileTypes.ts`, `src/data/TileInventory.ts`, `src/data/DifficultyConfig.ts`, `src/data/EnemyDefinitions.ts`, `src/data/EventDefinitions.ts`, `src/data/EnemyDrops.ts` -- read directly, provides current implementation reference
- Phase 1 CONTEXT.md: RunState shape, EventBus design, clean rewrite approach, JSON data migration
- Phase 2 CONTEXT.md: CombatEngine integration, deck management systems, warrior XP, death penalty
- Phase 3 CONTEXT.md: All locked decisions, discretion areas, deferred items
- Phase 3 UI-SPEC.md: Complete visual and interaction contract for all Phase 3 scenes

### Secondary (MEDIUM confidence)
- Phaser 3 camera follow pattern (`startFollow` with deadzone) -- verified in existing codebase
- Phaser overlay scene pattern (launch + pause/resume) -- verified in existing Game.ts scene management

### Tertiary (LOW confidence)
- None -- all findings based on existing codebase analysis and CONTEXT.md decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing stack
- Architecture: HIGH -- follows Phase 1 architecture patterns (pure TS systems, thin scenes, EventBus, RunState)
- Pitfalls: HIGH -- based on direct analysis of existing code patterns and Phase 1/2 decisions
- Game balance numbers: LOW -- all economy/difficulty values are Claude's discretion, will need playtesting

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- no external dependency changes expected)
