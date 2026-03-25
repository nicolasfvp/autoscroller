# Phase 1: Architecture Foundation - Research

**Researched:** 2026-03-25
**Domain:** Game architecture extraction -- EventBus, RunState, thin scenes, IndexedDB persistence, memory management
**Confidence:** HIGH

## Summary

Phase 1 is a clean rewrite of the game's state management and system architecture. The existing codebase uses module-level singletons (`Currency.ts` with `let currentGold`, `DeckManager.ts` with `let deckManagerInstance`, `TileInventory.ts` with `let tileInventory`) and God Scene patterns (`Game.ts` at 440+ lines mixing loop logic, tile placement, HUD, and player movement). All of this must be replaced with a centralized `RunState` object, a typed `EventBus` for cross-system communication, and thin Phaser scenes that delegate all logic to pure TypeScript systems.

The core deliverables are: (1) a typed EventBus class with listener tracking for cleanup, (2) a single `RunState` interface that replaces all scattered singletons and is JSON-serializable, (3) a `SaveManager` that persists RunState to IndexedDB via idb-keyval on key game events, (4) scene refactoring conventions that prevent memory leaks over 1h+ runs, and (5) static data migration from TypeScript const arrays to runtime-loadable JSON files.

**Primary recommendation:** Build EventBus + RunState + SaveManager first as pure TypeScript (zero Phaser dependency), then refactor scenes to use them. The existing 14 data definition files and 16 scenes are well-understood from prior research. The architecture patterns from `.planning/research/ARCHITECTURE.md` should be followed directly.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **RunState shape**: Nested by domain: `{ hero: {hp, stamina, mana}, deck: {cards, order}, loop: {count, tiles, difficulty}, economy: {gold, tilePoints}, relics: [...] }`. Must be JSON-serializable.
- **Existing code fate**: Clean rewrite -- do not incrementally refactor. Rewrite from scratch with correct architecture. All singletons migrated at once. All 16 scenes recreated as thin wrappers.
- **Static data**: JSON external files -- card definitions, enemy definitions, tile definitions, relic definitions migrated from TypeScript const to runtime-loadable JSON files.
- **Persistence strategy**: Auto-save on key events (after combat, shop, boss, loop completion). Mid-combat browser close returns to pre-combat state. Single save slot. IndexedDB via idb-keyval.
- **Event granularity**: Fine-grained events (`card-played`, `damage-dealt`, `gold-gained`, `tile-placed`, `enemy-spawned`, `synergy-triggered`). No event logging -- pure dispatch only. Typed with TypeScript generics.

### Claude's Discretion
- Exact RunState interface structure (nested domain grouping is decided, internal field names are flexible)
- Co-op state split strategy (individual vs shared) for future multiplayer readiness
- EventBus implementation pattern (singleton class, module-level emitter, or DI)
- Object pooling strategy for memory management
- Scene lifecycle cleanup patterns
- Whether to use idb-keyval directly or wrap it

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARCH-01 | Game logic (combat, loop, tiles) runs as pure TypeScript systems, decoupled from Phaser scenes | Architecture pattern: `systems/` directory with zero Phaser imports. Thin scene pattern delegates all logic. Code examples below. |
| ARCH-02 | Single centralized RunState object owns all mutable run data (HP, gold, deck, relics, tile inventory) | RunState interface design with nested domains. Replaces 4 singletons: Currency, DeckManager, RelicManager, TileInventory. Must be JSON-serializable (no Map, no class instances). |
| ARCH-03 | Typed EventBus decouples cross-system communication (no direct scene-to-scene coupling) | EventBus class with generic EventMap type. Listener tracking via stored references for cleanup. `on`/`off`/`emit` API. |
| ARCH-04 | Object pooling and cleanup conventions prevent memory leaks over 1h+ runs | Phaser scene SHUTDOWN event cleanup, named event handler references, `removeAllListeners()` patterns, object pool for combat sprites/text. |
| PERS-01 | Run progress saved to IndexedDB (idb-keyval) -- survives browser refresh | idb-keyval 6.2.2 with custom store, auto-save on key events, load-on-boot with fallback to new run. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phaser | 3.90.0 | Game engine (rendering, scenes, input) | Already installed. Last stable v3 release. Scenes become thin wrappers only. |
| TypeScript | ^5.2.2 | Type safety for EventBus generics and RunState interfaces | Already installed. Strict mode enabled. |
| Vite | ^5.0.0 | Dev server and bundler | Already installed. No reason to upgrade during architecture phase -- adds unnecessary risk. |
| idb-keyval | 6.2.2 | IndexedDB persistence for RunState | 295 bytes (brotli'd). Promise-based. Tree-shakeable. Only need `get`, `set`, `del`, `createStore`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | (already installed) | Unique ID generation for entities | Already in node_modules. Use for run IDs, save slot keys. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| idb-keyval | Raw IndexedDB API | More control but 50x more code. idb-keyval's simplicity is correct for key-value save data. |
| idb-keyval | idb (full wrapper) | Richer API (indexes, cursors, transactions) but overkill for single-key save/load. |
| Custom EventBus | mitt / eventemitter3 | External deps for something that is 30 lines of typed TypeScript. Not worth the dependency. |

**Installation:**
```bash
npm install idb-keyval
```

**Version verification:** idb-keyval 6.2.2 confirmed current on npm (2026-03-25). Phaser 3.90.0 confirmed current on npm.

## Architecture Patterns

### Recommended Project Structure
```
src/
  core/                      # Game-agnostic infrastructure (zero Phaser imports)
    EventBus.ts              # Typed event emitter
    SaveManager.ts           # IndexedDB persistence via idb-keyval
  state/                     # Run state management (zero Phaser imports)
    RunState.ts              # Central run state interface + factory + accessor
    RunStateManager.ts       # Mutations, event emission on state changes
  systems/                   # Game logic (zero Phaser imports)
    combat/                  # CombatEngine, CardResolver, EnemyAI (Phase 2)
    deck/                    # DeckSystem (Phase 2)
    loop/                    # LoopRunner, TileManager (Phase 3)
  data/                      # Static definitions as JSON (READ-ONLY at runtime)
    json/                    # Runtime-loadable JSON files
      cards.json
      enemies.json
      tiles.json
      relics.json
      events.json
      curses.json
      difficulty.json
      hero-stats.json
      enemy-drops.json
    DataLoader.ts            # Typed JSON loader with validation
    types.ts                 # Shared type definitions for data schemas
  scenes/                    # Thin Phaser scenes (rendering + input only)
    (existing 16 scenes, rewritten as thin wrappers)
  ui/                        # Reusable UI components
  effects/                   # Visual/audio effects
  audio/                     # Audio management
  main.ts                    # Phaser config, scene registration
```

### Pattern 1: Typed EventBus with Listener Tracking

**What:** A generic event emitter where event names are keys of a TypeScript interface and payloads are the corresponding value types. Tracks all listeners with stored references for deterministic cleanup.

**When to use:** All cross-system communication. Systems emit events, scenes subscribe for visual updates, SaveManager subscribes for auto-save triggers.

**Implementation guidance:**

```typescript
// core/EventBus.ts

// Define ALL event types in a single interface
export interface GameEvents {
  // Combat events
  'combat:start': { enemyId: string; isElite: boolean; isBoss: boolean };
  'combat:end': { victory: boolean; goldEarned: number; cardDrops: string[] };
  'combat:card-played': { cardId: string; damage: number };
  'combat:damage-dealt': { source: string; target: string; amount: number };

  // Hero events
  'hero:damaged': { amount: number; currentHP: number; maxHP: number };
  'hero:healed': { amount: number; currentHP: number };
  'hero:died': { cause: string };

  // Economy events
  'gold:changed': { delta: number; total: number };
  'tile-points:changed': { delta: number; total: number };

  // Deck events
  'deck:card-added': { cardId: string };
  'deck:card-removed': { cardId: string };
  'deck:reordered': {};

  // Loop events
  'loop:completed': { loopNumber: number; difficulty: number };
  'loop:tile-entered': { tileType: string; index: number };
  'loop:tile-placed': { tileType: string; index: number };

  // Relic events
  'relic:acquired': { relicId: string };
  'relic:triggered': { relicId: string; effect: string };

  // Persistence events
  'save:requested': {};
  'save:completed': { timestamp: number };
  'save:loaded': { runState: unknown };

  // Run lifecycle
  'run:started': { runId: string };
  'run:ended': { victory: boolean; loopsCompleted: number };
}

type Listener<T> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof GameEvents>(event: K, fn: Listener<GameEvents[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  off<K extends keyof GameEvents>(event: K, fn: Listener<GameEvents[K]>): void {
    this.listeners.get(event)?.delete(fn);
  }

  emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }

  /** Remove ALL listeners for a specific event */
  removeAllListeners(event?: keyof GameEvents): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /** Get listener count -- useful for leak detection in dev mode */
  listenerCount(event: keyof GameEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// Module-level singleton -- simplest correct approach for this game
export const eventBus = new EventBus();
```

**Confidence:** HIGH -- this is a standard, well-understood pattern. The `Map<string, Set<Function>>` approach provides O(1) add/remove and prevents duplicate listeners.

### Pattern 2: RunState as JSON-Serializable Plain Object

**What:** A single interface that replaces all 4 existing singletons. Uses plain arrays and objects (no Map, no class instances, no functions) so `JSON.stringify(runState)` works directly.

**When to use:** Always. This is the single source of truth for all mutable run data.

**Critical design decision:** The user decided on nested-by-domain structure. `Map<TileType, number>` from the existing TileInventory must become `Record<string, number>` for JSON serialization.

```typescript
// state/RunState.ts

export interface HeroState {
  maxHP: number;
  currentHP: number;
  maxStamina: number;
  currentStamina: number;
  maxMana: number;
  currentMana: number;
  currentDefense: number;
  strength: number;
  defenseMultiplier: number;
  moveSpeed: number;
}

export interface DeckState {
  /** Card IDs in play order (the active deck) */
  active: string[];
  /** Card IDs in inventory (not currently in deck) mapped to quantity */
  inventory: Record<string, number>;
}

export interface LoopState {
  count: number;
  /** The tile layout for the current loop */
  tiles: TileData[];
  difficulty: number;
  tileLength: number;
}

export interface TileData {
  type: string;        // TileType as string for JSON compat
  index: number;
  defeated: boolean;
}

export interface EconomyState {
  gold: number;
  tilePoints: number;
  /** Tile type -> quantity owned */
  tileInventory: Record<string, number>;
}

export interface RunState {
  /** Unique run identifier */
  runId: string;
  /** Run generation (heir system) */
  generation: number;
  /** Timestamp of run start */
  startedAt: number;

  hero: HeroState;
  deck: DeckState;
  loop: LoopState;
  economy: EconomyState;
  relics: string[];      // relic IDs owned

  /** Whether hero is currently in combat (for mid-combat save handling) */
  isInCombat: boolean;
  /** Current scene key (for restoring position on load) */
  currentScene: string;
}

export function createNewRun(generation: number = 1): RunState {
  return {
    runId: generateId(),  // nanoid
    generation,
    startedAt: Date.now(),
    hero: { /* defaults from hero-stats.json */ },
    deck: { active: [ /* starter deck IDs */ ], inventory: {} },
    loop: { count: 0, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {} },
    relics: [],
    isInCombat: false,
    currentScene: 'Game',
  };
}

// Module-level accessor
let currentRun: RunState | null = null;

export function getRun(): RunState {
  if (!currentRun) throw new Error('No active run -- call startRun() first');
  return currentRun;
}

export function setRun(state: RunState): void {
  currentRun = state;
}

export function hasActiveRun(): boolean {
  return currentRun !== null;
}

export function clearRun(): void {
  currentRun = null;
}
```

**Confidence:** HIGH -- plain objects with string keys and primitive values are trivially serializable. The `Record<string, number>` pattern replaces `Map<TileType, number>` without losing functionality.

### Pattern 3: SaveManager with idb-keyval

**What:** Wraps idb-keyval with a game-specific API. Handles auto-save triggers, load-on-boot, and the "mid-combat returns to pre-combat" requirement.

```typescript
// core/SaveManager.ts
import { get, set, del, createStore } from 'idb-keyval';
import type { RunState } from '../state/RunState';
import { eventBus } from './EventBus';

const gameStore = createStore('rogue-scroll-db', 'save-store');

const SAVE_KEY = 'active-run';

export class SaveManager {
  /** Save current run state. Strips combat state if in combat. */
  async save(state: RunState): Promise<void> {
    const toSave = { ...state };
    if (toSave.isInCombat) {
      // Mid-combat save: revert to pre-combat state
      toSave.isInCombat = false;
      toSave.currentScene = 'Game';
      // Hero HP/stamina/mana are already at pre-combat values
      // because combat operates on a copy
    }
    await set(SAVE_KEY, toSave, gameStore);
    eventBus.emit('save:completed', { timestamp: Date.now() });
  }

  /** Load saved run, or null if no save exists. */
  async load(): Promise<RunState | null> {
    const saved = await get<RunState>(SAVE_KEY, gameStore);
    return saved ?? null;
  }

  /** Delete save (on run completion or new game). */
  async clear(): Promise<void> {
    await del(SAVE_KEY, gameStore);
  }

  /** Subscribe to auto-save trigger events. */
  setupAutoSave(getState: () => RunState): void {
    const doSave = () => this.save(getState());
    eventBus.on('combat:end', doSave);
    eventBus.on('loop:completed', doSave);
    // shop/rest/event exits also trigger save via scene transitions
  }
}

export const saveManager = new SaveManager();
```

**Confidence:** HIGH -- idb-keyval 6.2.2 API verified against official docs. `createStore` creates an isolated IndexedDB database.

### Pattern 4: Thin Scene Convention

**What:** Every Phaser scene follows this structure: create references to systems, subscribe to events with stored handler references, clean up in shutdown.

```typescript
// Template for all thin scenes
export class ExampleScene extends Phaser.Scene {
  // Store handler references for cleanup
  private onGoldChanged!: (data: GameEvents['gold:changed']) => void;
  private onHeroDamaged!: (data: GameEvents['hero:damaged']) => void;

  create(): void {
    // 1. Read state
    const run = getRun();

    // 2. Create visuals based on state
    this.setupVisuals(run);

    // 3. Bind event handlers (NAMED, not anonymous)
    this.onGoldChanged = (data) => this.updateGoldDisplay(data.total);
    this.onHeroDamaged = (data) => this.showDamageEffect(data.amount);

    eventBus.on('gold:changed', this.onGoldChanged);
    eventBus.on('hero:damaged', this.onHeroDamaged);

    // 4. Listen for scene shutdown to clean up
    this.events.on('shutdown', this.cleanup, this);
  }

  private cleanup(): void {
    // Remove ALL eventBus listeners this scene added
    eventBus.off('gold:changed', this.onGoldChanged);
    eventBus.off('hero:damaged', this.onHeroDamaged);

    // Phaser scene listeners on this.events are auto-cleaned on shutdown
    // But external listeners (eventBus, game.events) are NOT -- must remove manually
  }
}
```

**Confidence:** HIGH -- verified via Phaser discourse and GitHub issues. Scene `this.events` listeners ARE cleaned on shutdown/destroy, but external EventBus listeners are NOT.

### Anti-Patterns to Avoid
- **Module-level `let` state:** The existing `Currency.ts` (`let currentGold`), `TileInventory.ts` (`let tileInventory`), `DeckManager.ts` (`let deckManagerInstance`) pattern. All mutable state goes into RunState.
- **God Scene:** The existing `Game.ts` pattern of mixing loop logic, tile placement UI, HUD management, and player movement in one scene class.
- **Anonymous event listeners:** `eventBus.on('event', (data) => { ... })` makes cleanup impossible. Always store the reference.
- **`Map` in serializable state:** `Map<TileType, number>` does not survive `JSON.stringify`. Use `Record<string, number>`.
- **Scene-to-scene data passing:** Do not pass mutable objects via `scene.launch('CombatScene', { heroStats })`. Scenes read from RunState.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB access | Raw IndexedDB with transactions, cursors, error handling | idb-keyval 6.2.2 (`get`/`set`/`del`/`createStore`) | Raw IndexedDB is 50+ lines of boilerplate with event-based API. idb-keyval is 295 bytes and promise-based. |
| Unique IDs | Custom `Math.random().toString(36)` | nanoid (already installed) | Collision-safe, URL-friendly, 130 bytes. |
| Deep clone for state snapshots | Recursive clone function | `structuredClone()` (built-in) or `JSON.parse(JSON.stringify(state))` | RunState is plain objects/arrays -- structured clone handles it natively. No library needed. |

**Key insight:** The EventBus is the ONE piece of infrastructure worth hand-rolling (30 lines, fully typed, zero dependencies). Everything else should use existing tools.

## Common Pitfalls

### Pitfall 1: Map Serialization Failure
**What goes wrong:** Using `Map<string, number>` in RunState and then calling `JSON.stringify()` produces `{}` for all Map fields. Save/load silently loses tile inventory, card inventory, etc.
**Why it happens:** `JSON.stringify` does not serialize Maps. The existing `TileInventory.ts` uses `Map<TileType, number>`.
**How to avoid:** Use `Record<string, number>` everywhere in RunState. Convert existing Map-based APIs during migration.
**Warning signs:** Save file loads but all inventory data is empty.

### Pitfall 2: Event Listener Accumulation Across Scene Restarts
**What goes wrong:** Each time CombatScene is launched (dozens of times per run), new eventBus listeners are added in `create()`. After 20+ combats, there are 20+ duplicate listeners for each event.
**Why it happens:** Phaser's scene SHUTDOWN event cleans `this.events` listeners but NOT external EventBus listeners. Scenes that are `stop()`ed and `launch()`ed again run `create()` again.
**How to avoid:** Always remove eventBus listeners in the `shutdown` handler. Use the thin scene template above as mandatory convention.
**Warning signs:** Events fire multiple times, console shows duplicate log entries, memory grows monotonically.

### Pitfall 3: Circular References in RunState
**What goes wrong:** `JSON.stringify(runState)` throws "Converting circular structure to JSON" because a system stored a back-reference (e.g., a card object that references the deck that contains it).
**Why it happens:** Using object references instead of string IDs. For example, storing the full `CardDefinition` object in the deck instead of just the card ID string.
**How to avoid:** RunState stores ONLY primitive values, arrays of primitives, and plain objects with string keys. Never store class instances or object references. Cards are referenced by ID string, relics by ID string.
**Warning signs:** Save fails with JSON error. Loading produces unexpected `undefined` values.

### Pitfall 4: idb-keyval Silent Failures in Private Browsing
**What goes wrong:** IndexedDB throws in some browsers' private/incognito mode. Save silently fails. Player plays for 30 minutes, refreshes, loses everything.
**Why it happens:** Safari and older Firefox restrict IndexedDB in private browsing. Chrome allows it but with reduced quota.
**How to avoid:** Wrap all `save()` calls in try-catch. On failure, show a visible warning to the player. Consider a fallback to localStorage (which also has limitations but different failure modes).
**Warning signs:** No errors in console but save never appears in IndexedDB storage inspector.

### Pitfall 5: Phaser Scene State Leak Between Runs
**What goes wrong:** Starting a "new game" after a death does not properly reset all state. Relics from the previous run persist, or gold carries over.
**Why it happens:** If RunState is set but old scene instances still hold cached references to previous state values.
**How to avoid:** `clearRun()` + `setRun(createNewRun())` as the single path for starting any new run. Scenes always read fresh from `getRun()` in their `create()` method, never caching RunState fields in instance variables.
**Warning signs:** Second run starts with non-zero gold or relics from previous run.

## Code Examples

### idb-keyval Custom Store Setup
```typescript
// Source: https://github.com/jakearchibald/idb-keyval
import { createStore, get, set, del } from 'idb-keyval';

// Create isolated store for game saves
const gameStore = createStore('rogue-scroll-db', 'save-store');

// Save run state
await set('active-run', runState, gameStore);

// Load run state
const saved = await get<RunState>('active-run', gameStore);

// Delete save
await del('active-run', gameStore);
```

### JSON Data Loading Pattern
```typescript
// data/DataLoader.ts
// Static data migrated from TypeScript const to JSON files

import type { CardDefinition } from './types';

let cardData: CardDefinition[] | null = null;

export async function loadCards(): Promise<CardDefinition[]> {
  if (cardData) return cardData;
  const response = await fetch('./data/json/cards.json');
  cardData = await response.json();
  return cardData!;
}

export function getCardById(id: string): CardDefinition | undefined {
  if (!cardData) throw new Error('Card data not loaded -- call loadCards() in Boot scene');
  return cardData.find(c => c.id === id);
}

// Load ALL data in Boot/Preloader scene before any game logic runs
export async function loadAllData(): Promise<void> {
  await Promise.all([
    loadCards(),
    loadEnemies(),
    loadTiles(),
    loadRelics(),
    loadEvents(),
    loadCurses(),
    loadDifficulty(),
    loadHeroStats(),
    loadEnemyDrops(),
  ]);
}
```

### Phaser Scene Cleanup Convention
```typescript
// Source: https://phaser.discourse.group/t/do-i-need-to-manually-dispose-of-event-listeners/13429

// CORRECT: Named handler + cleanup in shutdown
class CombatScene extends Phaser.Scene {
  private onCardPlayed!: (data: GameEvents['combat:card-played']) => void;

  create(): void {
    this.onCardPlayed = (data) => this.renderCardAnimation(data.cardId);
    eventBus.on('combat:card-played', this.onCardPlayed);
    this.events.on('shutdown', this.cleanup, this);
  }

  private cleanup(): void {
    eventBus.off('combat:card-played', this.onCardPlayed);
    // Destroy all game objects created in create()
    this.children.removeAll(true);
  }
}

// WRONG: Anonymous handler -- cannot be removed
eventBus.on('combat:card-played', (data) => this.renderCardAnimation(data.cardId));
// This listener persists forever, accumulating on each scene restart
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `localStorage` for game saves | IndexedDB via idb-keyval | Standard since ~2020 | Higher storage limits (browser-dependent, typically 50MB+), async API, structured data support |
| Module-level singletons | Centralized state object | Established pattern | Enables save/load, debugging, multiplayer state sync |
| `Map` for typed key-value | `Record<string, T>` for serializable state | Always for JSON persistence | `Map` does not serialize with `JSON.stringify` |
| Phaser 3 event system for cross-scene | Custom typed EventBus | Best practice for decoupled systems | Phaser events are scene-scoped; custom bus is app-scoped and typed |

**Deprecated/outdated:**
- `localStorage` for structured game data: Use IndexedDB. localStorage is synchronous, 5MB limit, string-only values.
- `Phaser.Events.EventEmitter` for cross-system communication: Fine for within-scene, but untyped and scene-lifecycle-bound. Use custom EventBus for app-level events.

## Open Questions

1. **Vite + Phaser CJS interop on current Vite 5**
   - What we know: The project uses Vite 5.0.0 with Phaser 3.80.0 (semver range `^3.80.0`). This works currently.
   - What's unclear: STATE.md flags "Vite 8 + Phaser 3 CJS interop untested." Since we are NOT upgrading Vite in this phase, this is not a blocker.
   - Recommendation: Stay on Vite 5 for Phase 1. Defer Vite upgrade to a future phase.

2. **JSON data loading timing**
   - What we know: Static data must be loaded before any game logic runs. Boot/Preloader scenes are the natural place.
   - What's unclear: Whether Vite's `import` of JSON files (with `resolveJsonModule: true` already in tsconfig) is preferable to runtime `fetch()`.
   - Recommendation: Use Vite's static JSON import (`import cards from './data/json/cards.json'`) for simplicity in Phase 1. This bundles the JSON into the build. Runtime `fetch()` is only needed if hot-swapping data without rebuilds becomes a requirement (Phase 4+).

3. **Object pooling scope in Phase 1**
   - What we know: Memory leaks from scene restarts are the primary concern. Object pooling helps for frequently-created sprites/text.
   - What's unclear: Whether to implement pooling infrastructure now or defer until Phase 2 (combat) when the pooled objects actually exist.
   - Recommendation: Establish the cleanup CONVENTION now (shutdown handlers, named listeners). Defer actual object pool implementation to Phase 2 when combat sprites exist. The convention is more important than the pool.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently installed -- needs setup in Wave 0 |
| Config file | None -- see Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-01 | Systems instantiate without Phaser | unit | `npx vitest run tests/core/eventbus.test.ts -t "no phaser"` | No -- Wave 0 |
| ARCH-02 | RunState serializes to/from JSON correctly | unit | `npx vitest run tests/state/runstate.test.ts` | No -- Wave 0 |
| ARCH-03 | EventBus delivers typed events, cleanup removes listeners | unit | `npx vitest run tests/core/eventbus.test.ts` | No -- Wave 0 |
| ARCH-04 | No listener accumulation after 20+ scene-like subscribe/unsubscribe cycles | unit | `npx vitest run tests/core/eventbus.test.ts -t "no leaks"` | No -- Wave 0 |
| PERS-01 | SaveManager round-trips RunState through IndexedDB | integration | `npx vitest run tests/core/savemanager.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Install vitest: `npm install -D vitest`
- [ ] `vitest.config.ts` -- configure with jsdom environment for IndexedDB tests
- [ ] `tests/core/eventbus.test.ts` -- EventBus unit tests (typed emit/on/off, cleanup, listener count)
- [ ] `tests/state/runstate.test.ts` -- RunState creation, JSON serialization round-trip, all fields preserved
- [ ] `tests/core/savemanager.test.ts` -- SaveManager save/load/clear with fake-indexeddb
- [ ] `npm install -D fake-indexeddb` -- for IndexedDB tests in Node environment
- [ ] `tests/memory/listener-leak.test.ts` -- simulate 20+ subscribe/unsubscribe cycles, assert listener count stays at 0

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis -- all 14 data files, 16 scenes, 4 singletons reviewed
- `.planning/research/ARCHITECTURE.md` -- component boundaries, data flow, thin-scene pattern
- `.planning/research/PITFALLS.md` -- memory leak prevention, singleton anti-pattern
- `.planning/research/STACK.md` -- Phaser 3.90.0, idb-keyval recommendations
- [idb-keyval GitHub](https://github.com/jakearchibald/idb-keyval) -- API reference, custom stores
- [Phaser 3 Scene Events](https://phaser.discourse.group/t/do-i-need-to-manually-dispose-of-event-listeners/13429) -- SHUTDOWN vs DESTROY cleanup behavior

### Secondary (MEDIUM confidence)
- [TypeScript typed EventBus patterns](https://medium.com/@nijatismayilbeyli/implementing-type-safe-and-generic-event-bus-in-typescript-752ba94984ec) -- generic EventMap approach
- [Phaser memory management](https://www.mindfulchase.com/explore/troubleshooting-tips/game-development-tools/troubleshooting-phaser-performance-and-memory-issues-in-large-scale-games.html) -- scene lifecycle, object pooling

### Tertiary (LOW confidence)
- None -- all findings verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified on npm, existing project uses Phaser + Vite + TypeScript
- Architecture: HIGH -- patterns from ARCHITECTURE.md verified against existing codebase analysis and Phaser documentation
- Pitfalls: HIGH -- memory leak patterns confirmed by Phaser GitHub issues and discourse; serialization pitfalls verified with MDN JSON.stringify docs
- Persistence: HIGH -- idb-keyval API verified against official GitHub README

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable ecosystem, no expected breaking changes)
