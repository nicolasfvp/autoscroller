# Architecture Research

**Domain:** Web-based roguelike auto-battler with loop mechanics, card deck system, tile placement, and future online co-op
**Researched:** 2026-03-25
**Confidence:** HIGH (based on existing codebase analysis, Phaser ecosystem patterns, and established game architecture patterns)

## Standard Architecture

### System Overview

```
+------------------------------------------------------------------+
|                     PRESENTATION LAYER                            |
|  +----------+  +---------+  +----------+  +---------+            |
|  | Scenes   |  | HUD     |  | UI       |  | Effects |            |
|  | (Phaser) |  | Manager |  | Overlays |  | System  |            |
|  +----+-----+  +----+----+  +----+-----+  +----+----+            |
|       |             |            |              |                 |
+-------+-------------+------------+--------------+-----------------+
|                     GAME SYSTEMS LAYER                            |
|  +----------+  +---------+  +----------+  +---------+            |
|  | Loop     |  | Combat  |  | Deck     |  | Tile    |            |
|  | Runner   |  | Engine  |  | System   |  | System  |            |
|  +----+-----+  +----+----+  +----+-----+  +----+----+            |
|       |             |            |              |                 |
|  +----------+  +---------+  +----------+  +---------+            |
|  | Relic    |  | Enemy   |  | Loot     |  | Event   |            |
|  | System   |  | AI      |  | System   |  | System  |            |
|  +----+-----+  +----+----+  +----+-----+  +----+----+            |
|       |             |            |              |                 |
+-------+-------------+------------+--------------+-----------------+
|                     RUN STATE LAYER                               |
|  +--------------------------------------------------------+      |
|  |                   RunStateManager                       |      |
|  |  (hero stats, deck, relics, gold, tiles, loop count)   |      |
|  +------------------------+-------------------------------+      |
+---------------------------+-----------------------------------+
|                     DATA / PERSISTENCE LAYER                      |
|  +--------------+  +----------------+  +------------------+      |
|  | Definitions  |  | Meta-          |  | Save/Load        |      |
|  | (cards,      |  | Progression    |  | (localStorage    |      |
|  |  enemies,    |  | Store          |  |  or IndexedDB)   |      |
|  |  tiles,      |  |                |  |                  |      |
|  |  relics)     |  |                |  |                  |      |
|  +--------------+  +----------------+  +------------------+      |
+------------------------------------------------------------------+
|                     FUTURE: NETWORK LAYER                         |
|  +--------------+  +----------------+  +------------------+      |
|  | WebSocket    |  | State Sync     |  | Lobby/           |      |
|  | Client       |  | (Authoritative |  | Matchmaking      |      |
|  |              |  |  Server)       |  |                  |      |
|  +--------------+  +----------------+  +------------------+      |
+------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Current Implementation |
|-----------|----------------|------------------------|
| **Scenes (Phaser)** | Scene lifecycle, input handling, visual rendering, scene transitions | `Game.ts`, `CombatScene.ts`, `ShopScene.ts`, etc. -- too many concerns per scene |
| **HUD Manager** | Persistent UI overlay during gameplay (HP, gold, loop counter) | `HUDManager.ts` -- clean, but coupled to scene |
| **Combat Engine** | Turn resolution, card execution, damage calc, enemy AI | Embedded inside `CombatScene.ts` -- needs extraction |
| **Deck System** | Card inventory, deck composition, draw/shuffle/reshuffle | `DeckManager.ts` -- good singleton pattern, but deck-in-combat logic lives in CombatScene |
| **Tile System** | Loop layout, tile placement, tile interaction resolution | `MapManager.ts` + `TileTypes.ts` + `TileInventory.ts` -- spread across files |
| **Loop Runner** | Hero auto-movement, loop progression, difficulty scaling | Embedded in `Game.ts` update loop and `Player.ts` |
| **Relic System** | Passive effect management, trigger-based effects | `RelicManager.ts` -- clean trigger pattern |
| **Run State** | Central state for a single run (hero, deck, relics, gold, tiles, loop) | **MISSING** -- currently scattered across module-level singletons |
| **Data Definitions** | Static game data (card stats, enemy configs, tile configs) | `data/*.ts` -- reasonable, but mixed with runtime state |
| **Meta-Progression** | Permanent unlocks between runs | **MISSING** -- not yet implemented |
| **Persistence** | Save/load game state | `TileLoopPersistence.ts` for tiles only -- incomplete |

## Recommended Project Structure

```
src/
+-- main.ts                    # Phaser game config, scene registration
+-- core/                      # Game-agnostic infrastructure
|   +-- EventBus.ts            # Typed event emitter (decouples systems)
|   +-- Registry.ts            # Service locator for run state
|   +-- SaveManager.ts         # localStorage/IndexedDB abstraction
|   +-- Constants.ts           # Game-wide constants
+-- state/                     # Run state management
|   +-- RunState.ts            # Central run state (replaces scattered singletons)
|   +-- MetaProgression.ts     # Permanent unlocks store
+-- data/                      # Static definitions (READ-ONLY at runtime)
|   +-- cards/                 # Card definitions by category
|   |   +-- AttackCards.ts
|   |   +-- DefenseCards.ts
|   |   +-- MagicCards.ts
|   |   +-- CardRegistry.ts   # Lookup functions
|   +-- enemies/               # Enemy definitions
|   |   +-- EnemyDefinitions.ts
|   |   +-- EnemyDrops.ts
|   +-- tiles/                 # Tile type configs
|   |   +-- TileTypes.ts
|   +-- relics/                # Relic definitions
|   |   +-- RelicDefinitions.ts
|   +-- events/                # Narrative event definitions
|   |   +-- EventDefinitions.ts
|   +-- difficulty/            # Scaling curves
|       +-- DifficultyConfig.ts
+-- systems/                   # Game logic (no rendering)
|   +-- combat/
|   |   +-- CombatEngine.ts    # Turn resolution, damage calc
|   |   +-- CardResolver.ts    # Card effect application
|   |   +-- EnemyAI.ts         # Enemy behavior patterns
|   |   +-- SynergyChecker.ts  # Sequential card synergies
|   +-- deck/
|   |   +-- DeckManager.ts     # Deck composition and inventory
|   |   +-- DeckShuffler.ts    # Shuffle and draw logic
|   +-- loop/
|   |   +-- LoopRunner.ts      # Loop progression, encounter triggering
|   |   +-- TileManager.ts     # Tile placement, tile interactions
|   +-- loot/
|   |   +-- LootGenerator.ts   # Drop tables, reward calculation
|   |   +-- ShopPricing.ts     # Card removal costs, shop inventory
|   +-- relic/
|       +-- RelicManager.ts    # Relic collection and trigger dispatch
+-- scenes/                    # Phaser scenes (THIN -- delegate to systems)
|   +-- BootScene.ts
|   +-- PreloaderScene.ts
|   +-- MainMenuScene.ts
|   +-- GameScene.ts           # Loop view, tile interaction, camera
|   +-- CombatScene.ts         # Combat visualization only
|   +-- ShopScene.ts
|   +-- RestScene.ts
|   +-- EventScene.ts
|   +-- RewardScene.ts
|   +-- DeathScene.ts
|   +-- GameOverScene.ts
|   +-- DeckViewScene.ts
|   +-- PauseScene.ts
|   +-- SettingsScene.ts
+-- ui/                        # Reusable UI components
|   +-- HUDManager.ts
|   +-- CardDisplay.ts         # Card visual component
|   +-- HealthBar.ts           # Reusable HP bar
|   +-- TooltipManager.ts      # Hover tooltips
|   +-- ModalOverlay.ts        # Shared overlay base
+-- effects/                   # Visual/audio effects
|   +-- CombatEffects.ts
|   +-- ParticlePresets.ts
+-- audio/
    +-- AudioManager.ts
```

### Structure Rationale

- **`core/`:** Infrastructure that has zero game knowledge. EventBus and Registry are the backbone for decoupling. These get built first and never change.
- **`state/`:** Single source of truth for run state. Currently the biggest gap -- gold, deck, relics, hero stats are all separate module-level variables. A `RunState` object that owns all of these prevents desync bugs.
- **`data/`:** Purely static definitions. No runtime mutation. If you can define it in JSON, it belongs here. Splitting cards into subdirectories is optional at current scale but prevents a single 500-line file.
- **`systems/`:** Pure game logic with zero Phaser dependency. This is the critical architectural boundary. `CombatEngine` should be testable with plain TypeScript -- no scene, no sprites, no timers. This is what makes the future multiplayer possible (server runs same systems).
- **`scenes/`:** Thin wrappers that wire systems to Phaser rendering. A scene creates visuals, passes user input to systems, and subscribes to system events for visual updates. Should contain zero game logic.
- **`ui/`:** Reusable visual components shared across scenes. Prevents the current pattern of each scene rebuilding text/rectangles from scratch.

## Architectural Patterns

### Pattern 1: EventBus for Cross-System Communication

**What:** A typed event emitter that all systems publish to and subscribe from, replacing direct coupling between scenes and systems.
**When to use:** Any time System A needs to notify System B without importing it directly. Combat ending needs to notify the loop runner, loot system, and HUD simultaneously.
**Trade-offs:** Adds indirection (harder to trace calls), but eliminates the current spaghetti of `this.scene.get('Game').events.emit(...)` calls. Essential for multiplayer later.

**Example:**
```typescript
// core/EventBus.ts
type EventMap = {
  'combat:start': { enemyId: string; isElite: boolean; isBoss: boolean };
  'combat:end': { victory: boolean; goldEarned: number; cardDrops: string[] };
  'combat:card-played': { cardId: string; effects: CardEffect[] };
  'loop:completed': { loopNumber: number };
  'loop:tile-entered': { tileType: TileType; loopIndex: number };
  'deck:card-added': { cardId: string };
  'deck:card-removed': { cardId: string };
  'hero:damaged': { amount: number; currentHP: number };
  'hero:healed': { amount: number; currentHP: number };
  'hero:died': { defeatedBy: string };
  'gold:changed': { amount: number; total: number };
  'relic:acquired': { relicId: string };
};

class EventBus {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof EventMap>(event: K, fn: (data: EventMap[K]) => void): void { ... }
  off<K extends keyof EventMap>(event: K, fn: (data: EventMap[K]) => void): void { ... }
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void { ... }
}

export const eventBus = new EventBus();
```

### Pattern 2: RunState as Single Source of Truth

**What:** A centralized state object that owns all mutable run data, replacing scattered singletons (`currentGold`, `deckManagerInstance`, `relicManagerInstance`).
**When to use:** Always. This is the fix for the current architecture's biggest problem.
**Trade-offs:** Requires discipline to go through RunState instead of direct mutation. Slightly more boilerplate. Massive win for save/load, multiplayer sync, and debugging.

**Example:**
```typescript
// state/RunState.ts
export interface RunState {
  hero: HeroStats;
  deck: DeckState;         // card IDs in deck, card IDs in inventory
  relics: string[];        // relic IDs owned
  gold: number;
  tileLoop: TileData[];    // the 20-tile loop layout
  tileInventory: Map<TileType, number>;
  loopCount: number;
  generation: number;
  isInCombat: boolean;
}

let currentRun: RunState | null = null;

export function startNewRun(generation: number = 1): RunState {
  currentRun = {
    hero: createHeroStats(),
    deck: { active: [...STARTER_DECK_IDS], inventory: new Map() },
    relics: [],
    gold: 0,
    tileLoop: generateInitialLoop(),
    tileInventory: new Map(),
    loopCount: 0,
    generation,
    isInCombat: false,
  };
  return currentRun;
}

export function getRun(): RunState {
  if (!currentRun) throw new Error('No active run');
  return currentRun;
}
```

### Pattern 3: Thin Scenes (Presentation-Only)

**What:** Phaser scenes delegate all logic to systems and only handle rendering, input binding, and visual feedback. No game rules inside scenes.
**When to use:** Every scene. The current `CombatScene` has ~300 lines mixing combat resolution with rendering. Extract the engine.
**Trade-offs:** More files, more indirection. But combat becomes testable without Phaser, and the same engine runs on a future server.

**Example:**
```typescript
// scenes/CombatScene.ts (THIN)
export class CombatScene extends Scene {
  private engine!: CombatEngine;
  private renderer!: CombatRenderer;

  create(data: CombatStartData) {
    this.engine = new CombatEngine(getRun(), data.enemy);
    this.renderer = new CombatRenderer(this);
    this.renderer.setup(getRun().hero, data.enemy);

    // Engine emits events, renderer listens
    this.engine.on('card-played', (e) => this.renderer.showCardPlayed(e));
    this.engine.on('damage-dealt', (e) => this.renderer.showDamage(e));
    this.engine.on('combat-end', (e) => this.handleCombatEnd(e));

    this.engine.start(); // begins the auto-combat loop
  }
}
```

### Pattern 4: Data-Driven Definitions with Registries

**What:** All game content (cards, enemies, tiles, relics, events) defined as plain data objects, accessed through typed registry/lookup functions. Never instantiate "Card" objects -- use IDs and look up definitions.
**When to use:** Already partially in use (`CardDefinitions.ts`, `EnemyDefinitions.ts`). Extend to all content.
**Trade-offs:** Slightly less OOP, but trivially serializable (just store IDs), easy to balance (change one number), and content can eventually be loaded from JSON files or a server.

## Data Flow

### Core Game Loop Flow

```
[Player auto-moves right]
    |
[MapManager.update(playerX)]
    |
    +-- Expand track ahead / clean up behind
    |
[Game.update checks tile at playerX]
    |
    +-- tileType === 'basic' --> skip
    +-- tileType === 'combat' --> pause Game, launch CombatScene
    +-- tileType === 'shop' --> pause Game, launch ShopScene
    +-- tileType === 'rest' --> pause Game, launch RestScene
    +-- tileType === 'event' --> pause Game, launch EventScene
    |
[Overlay scene completes]
    |
    +-- CombatScene.endCombat(victory)
    |     +-- victory: emit rewards, resume Game
    |     +-- defeat: start DeathScene
    |
[Game.update resumes, player keeps moving]
    |
[Loop counter increments when playerX crosses loop boundary]
    |
    +-- Every loop: reset tile defeated flags, scale difficulty
    +-- Loop 100: Boss encounter, then selection/game over
```

### Combat Data Flow

```
[CombatScene.create]
    |
    v
[Shuffle deck copy] --> [Combat Timer (2s intervals)]
    |                           |
    v                           v
[Draw top card] ----------> [canAffordCost?]
    |                           |
    +-- NO: skip, push to bottom, enemy attacks
    +-- YES: payCost -> applyEffects -> push to bottom
                            |
                            v
                    [Update hero/enemy stats]
                            |
                            v
                    [Enemy attacks hero]
                            |
                            v
                    [Check end conditions]
                        |           |
                  [enemyHP<=0]  [heroHP<=0]
                        |           |
                   [Victory]    [Defeat]
```

### State Flow Between Scenes

```
[MainMenu] --start--> [Game]
                         |
                    +---------+---------+---------+---------+
                    |         |         |         |         |
              [CombatScene] [ShopScene] [RestScene] [EventScene] [RewardScene]
                    |         |         |         |         |
                    +---------+---------+---------+---------+
                         |
                    [resume Game]
                         |
                  [Loop 100 reached]
                         |
                  [SelectionScene] --heir--> [Game (new run)]
                         |
                  [hero dies]
                         |
                  [DeathScene] --> [MainMenu or SelectionScene]
```

**Critical observation:** All overlay scenes (Combat, Shop, Rest, Event, Reward) currently receive data via `scene.launch(name, data)` and mutate shared singletons. This works for solo but breaks for multiplayer. The RunState pattern fixes this.

### Key Data Flows

1. **Tile placement:** Player selects tile type from inventory -> clicks map position -> `TileInventory` decrements count -> `MapManager` updates baseTile array -> visual tiles re-colored -> persistence saves to localStorage
2. **Card acquisition:** Enemy defeated -> `LootGenerator` rolls drop table -> card ID offered -> player accepts -> `DeckManager.addToInventory(id)` -> available in deck customization
3. **Deck modification:** Shop or DeckCustomization scene -> player adds/removes cards -> `DeckManager` moves IDs between inventory and active deck -> next combat uses updated deck
4. **Relic triggers:** `RelicManager.trigger(event, context)` called at specific moments (combat start, card played, loop complete) -> each relic checks its trigger type -> applies effect to context (hero stats, combat state)

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Solo (current) | Single-player client-only. All state in memory + localStorage. Current approach works fine. Focus on extracting systems from scenes. |
| Co-op (2-4 players) | Add authoritative server (Node.js). Server runs `CombatEngine` and `LoopRunner`. Client sends inputs, receives state updates. WebSocket for real-time. Requires the systems/scenes separation to exist FIRST. |
| Persistence (cloud saves) | Replace localStorage with REST API + database. RunState serialization makes this trivial if RunState pattern is adopted. |

### Scaling Priorities

1. **First bottleneck (before multiplayer):** Systems coupled to Phaser scenes. CombatEngine cannot run on a server if it imports `Scene`. Extract pure-logic systems first.
2. **Second bottleneck (multiplayer):** State synchronization. If RunState is centralized, syncing is "send RunState diff over WebSocket." If state is scattered across singletons, syncing is a nightmare.
3. **Third bottleneck (multiplayer):** Combat timing. Currently uses `Phaser.Time.TimerEvent` at 2-second intervals. Server needs its own tick loop. The CombatEngine must accept a `tick()` call rather than owning its own timer.

## Anti-Patterns

### Anti-Pattern 1: God Scene

**What people do:** Put game logic, UI rendering, input handling, state management, and persistence all inside a single Phaser Scene class.
**Why it's wrong:** The current `Game.ts` (440 lines) handles hero movement, tile interaction, tile inventory UI, tile placement, keyboard input, loop progression, and enemy selection. Adding features makes it grow unboundedly. Impossible to test without running Phaser.
**Do this instead:** Scene creates a `LoopRunner` system and a `TileInventoryUI` component. Scene's `update()` calls `loopRunner.tick(delta)` and responds to its events. Scene's `create()` wires input to systems.

### Anti-Pattern 2: Module-Level Singleton State

**What people do:** `let currentGold: number = 0;` at module top level with exported getter/setter functions (exactly what `Currency.ts` does now).
**Why it's wrong:** State is invisible, impossible to serialize/deserialize as a unit, hard to reset correctly, and creates implicit coupling. Each module manages its own reset logic -- easy to forget one.
**Do this instead:** All mutable run state lives in `RunState`. Gold is `runState.gold`. Reset is `startNewRun()`. Save is `JSON.stringify(runState)`.

### Anti-Pattern 3: Scene-to-Scene Data Passing via Launch Params

**What people do:** `this.scene.launch('CombatScene', { heroStats: this.player.stats, generation: this.generation })` -- passing mutable object references between scenes.
**Why it's wrong:** Both scenes hold references to the same `heroStats` object. CombatScene mutates HP directly. If a third scene reads the same stats, you get race conditions. Also, the data shape is untyped (plain object in `create(data: any)`).
**Do this instead:** Scenes read from `RunState`. CombatScene reads `getRun().hero`. Mutations go through RunState methods that emit events. No data passed through `scene.launch()` except a trigger signal (e.g., which enemy to fight).

### Anti-Pattern 4: Mixing Static Definitions with Runtime Logic

**What people do:** Put card effect resolution logic next to card data definitions in the same file.
**Why it's wrong:** Card definitions are content, card resolution is logic. When you add a new effect type, you change both data and logic in the same file. Hard to add content without risking logic bugs.
**Do this instead:** `data/cards/` has pure data. `systems/combat/CardResolver.ts` has the switch statement that interprets effects. Add a new card? Edit data. Add a new effect type? Edit resolver.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **localStorage** | Direct via `SaveManager` wrapper | Used for tile persistence, settings, meta-progression. Limit: ~5MB. Sufficient for this game's data. |
| **Future: WebSocket server** | Socket.io or native WebSocket | Server runs combat engine and loop state. Client sends deck/tile decisions, receives state updates. |
| **Future: Auth** | OAuth2 or anonymous session | Only needed when cloud saves or multiplayer are added. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Scene <-> System | EventBus + direct method calls | Scene calls `system.tick()`, listens to `eventBus.on('combat:card-played')` for visuals |
| System <-> RunState | Direct read/write via `getRun()` | Systems are the only things that mutate RunState. Scenes read only. |
| System <-> Data | Import + lookup by ID | `getCardById(id)` returns immutable definition. Systems never mutate definitions. |
| Scene <-> Scene | Phaser scene manager (`scene.launch`, `scene.resume`) | Minimal data in launch params. Shared state via RunState. |
| Game <-> Server (future) | WebSocket messages with typed payloads | Server sends authoritative RunState updates. Client sends player actions (tile placed, card order changed). |

## Build Order (Dependencies)

The architecture has clear dependency layers. Build bottom-up:

```
Phase 1: Foundation
  [EventBus] + [RunState] + [Data Definitions refactor]
      |
Phase 2: Core Systems (no Phaser dependency)
  [CombatEngine] + [DeckManager refactor] + [LoopRunner] + [TileManager]
      |
Phase 3: Scene Refactor (thin scenes)
  [GameScene uses LoopRunner] + [CombatScene uses CombatEngine]
      |
Phase 4: Feature Systems
  [SynergyChecker] + [LootGenerator] + [ShopPricing] + [EventSystem]
      |
Phase 5: Meta-Progression
  [MetaProgression store] + [Unlock system] + [Hub scene]
      |
Phase 6: Multiplayer Prep
  [Server-side CombatEngine] + [State sync] + [WebSocket layer]
```

**Key dependency:** Phases 2-3 (extracting systems from scenes) MUST happen before Phase 6 (multiplayer). If combat logic stays inside CombatScene, it cannot run on a server.

**Pragmatic note:** The current architecture works for solo MVP. The refactoring to EventBus + RunState + thin scenes can happen incrementally -- one system at a time. Do not attempt a big-bang rewrite. Extract CombatEngine first (highest value), then LoopRunner, then TileManager.

## Sources

- Existing codebase analysis (primary source -- all 40+ TypeScript files reviewed)
- Phaser 3 scene management documentation (scene.launch, scene.pause, scene.resume patterns)
- Established game architecture patterns: Entity-Component-System, Event-driven architecture, Model-View separation in game engines
- Slay the Spire / Loop Hero architectural post-mortems (general patterns for roguelike deckbuilders and loop-based games)

---
*Architecture research for: Autoscroller -- Roguelike Loop Auto-battler*
*Researched: 2026-03-25*
