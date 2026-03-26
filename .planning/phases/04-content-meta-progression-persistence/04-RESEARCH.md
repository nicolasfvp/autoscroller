# Phase 4: Content, Meta-Progression + Persistence - Research

**Researched:** 2026-03-26
**Domain:** Content population, meta-progression hub (city builder lite), permanent unlocks, IndexedDB persistence, seeded RNG
**Confidence:** HIGH

## Summary

Phase 4 populates the game with final content (~15 cards, ~8 relics, 2-3 boss types, ~5 events), builds a city-builder-lite meta-progression hub between runs, implements permanent unlock systems (buildings + class XP), persists meta-progression data in IndexedDB, and adds seeded RNG for reproducible runs. This phase builds on Phase 1's architecture (RunState, EventBus, idb-keyval), Phase 2's combat/deck systems, and Phase 3's loop/tile world with meta-loot tracking.

The technical risk is LOW -- all major patterns (JSON data loading, EventBus dispatch, IndexedDB persistence, Phaser scene management) are already established by prior phases. The primary challenge is content design (balanced card stats, meaningful relic effects, fair meta-loot economy) and wiring up the city hub scene with proper state management. Seeded RNG is a straightforward implementation using a well-known algorithm (mulberry32 or sfc32) with a string-to-seed hash.

**Primary recommendation:** Structure work in three waves: (1) content data population + JSON migration of existing definitions with new fields, (2) meta-progression hub scene + unlock/persistence systems, (3) seeded RNG + collection screen + integration testing.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **City hub between runs**: Top-down map view with buildings around a town square, clicked to interact
- **4-5 buildings for v1**: Forge (cards), Library (passives), Tavern (run bonuses + start run), Workshop (tiles), Shrine (relics)
- **Multiple upgrade tiers per building**: 3-5 levels each, escalating meta-loot cost
- **Full transparency on upgrades**: Player sees what each tier unlocks before spending
- **Tavern starts new runs**: Click Tavern to start run; shows run history
- **No reset option**: Meta-progression is permanent
- **Cards: rebalance existing 14 + add 1-3 new** to hit ~15 with cooldowns (1.0-3.0s), rarity tiers
- **Boss types: stat-based tiers**: Tank (300% HP, 80% dmg), Berserker (150% HP, 200% dmg), Mage (200% HP, 120% dmg + debuff)
- **Relics: 3-4 common available from start**, rest gated by Shrine upgrades
- **Events: use existing 5 events**, migrate to JSON format
- **Two unlock sources**: City building upgrades (meta-loot) and Class XP milestones
- **Unlocked content joins ALL loot sources**: Cards/relics/tiles appear everywhere once unlocked
- **Collection screen**: Full view with silhouettes for locked items + unlock hints
- **Seeded RNG**: Optional seed input in Tavern, shareable text strings
- **Persistence via IndexedDB (idb-keyval)**: Separate store from run state
- **Full meta-progression save**: Building levels, meta-loot balance, class XP, passive skills, unlock states, run history

### Claude's Discretion
- Exact meta-loot costs per building tier
- Meta-loot earn rates from runs
- Exact cards to add (1-3 new cards)
- Card cooldown values and rarity tier assignments for existing cards
- Boss stat multiplier exact values
- Relic distribution between starter pool and Shrine unlock tiers
- Class XP milestone thresholds and what they unlock
- Building effect values (Tavern starting bonuses, etc.)
- Tile types to add via Workshop unlocks
- Collection screen layout and navigation
- Seeded RNG algorithm choice (mulberry32, xorshift, etc.)
- Run history stats tracked and display format

### Deferred Ideas (OUT OF SCOPE)
- Visual tier changes for buildings (art upgrades per building level)
- Unique boss mechanics (phases, immunities, special attacks) -- v2 (BOSS-01)
- Additional classes beyond Warrior -- v2 (CLAS-01, CLAS-02)
- Card upgrade system -- v2 (CONT-09)
- Save export/import -- v2 (PLSH-05)

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RELC-01 | Passive relic items with unique effects (no fixed slots, StS style) | 8 relics already defined in RelicDefinitions.ts; need unlockSource + unlockTier metadata added, migrate to JSON |
| RELC-02 | Relics can modify cooldowns, stats, and combat mechanics | Existing trigger-based apply() pattern supports this; JSON-declarative effects per Phase 1 |
| RELC-03 | Relics obtained from drops, shop, and events | LootGenerator (Phase 3) must filter by unlock state; shop/event/treasure all check MetaState |
| RELC-04 | ~8 relics available in v1 | 8 already exist -- add unlockSource metadata, split into starter pool (3-4 common) + gated (rare/epic/legendary) |
| META-01 | Visual hub between runs showing unlocks and progression | CityHubScene -- top-down Phaser scene with clickable building sprites; reads MetaState |
| META-02 | Permanent unlock of new cards into the loot pool | UnlockManager checks MetaState.unlockedCards before populating loot tables |
| META-03 | Permanent unlock of new tile types | UnlockManager checks MetaState.unlockedTiles; Workshop building unlocks |
| META-04 | Class XP and passive skill tree persist across runs | MetaState.classXP persisted in IndexedDB; passive tree read on run start |
| CONT-01 | ~15 unique cards with distinct stats, cooldowns, targeting | 14 exist; add cooldown + rarity fields; add 1-3 new cards; balance pass |
| CONT-02 | ~8 relics with unique passive effects | Already exist; add unlock-gate metadata |
| CONT-03 | 2-3 boss types (stats-based, unique mechanics deferred) | Extend boss_demon with type variants (tank/berserker/mage) via stat multipliers |
| CONT-04 | ~5 narrative events with choices and consequences | 5 events exist in EventDefinitions.ts; migrate to JSON |
| PERS-02 | Meta-progression data persists across sessions | idb-keyval with separate store ('meta-db', 'meta-store') for MetaState |
| PERS-03 | Seeded RNG for reproducible runs (shareable seeds) | mulberry32 PRNG + cyrb53 string hash; replace Math.random() calls in game systems |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb-keyval | 6.2.2 | IndexedDB key-value persistence | Already decided in Phase 1; simple API for meta-progression storage |
| Phaser | 3.80+ | City hub scene rendering, UI | Already in project |
| TypeScript | 5.2+ | Type-safe data schemas | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none -- hand-roll) | -- | Seeded PRNG (mulberry32) | ~15 lines of code; no dependency needed |
| (none -- hand-roll) | -- | String hash (cyrb53) | ~10 lines of code; converts seed strings to integers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled mulberry32 | prando npm package | prando adds ~3KB for what is 15 lines; unnecessary dependency |
| idb-keyval separate stores | idb (full IndexedDB wrapper) | idb is heavier; idb-keyval's createStore is sufficient for key-value meta storage |
| JSON data files | Keep TypeScript const | Phase 1 decided JSON for hot-reloading; follow that decision |

**Installation:**
```bash
# idb-keyval should already be installed from Phase 1
npm install idb-keyval
```

**Version verification:** idb-keyval 6.2.2 confirmed via npm registry (2026-03-26).

## Architecture Patterns

### Recommended Project Structure
```
src/
  data/
    json/
      cards.json          # All ~15 cards with cooldown, rarity, unlockSource
      relics.json         # All 8 relics with unlockSource, unlockTier
      enemies.json        # 6 enemies + 3 boss type variants
      events.json         # 5 events migrated from TS
      buildings.json      # 5 city buildings with tier data
      passives.json       # Warrior passive skill tree (5-6 nodes)
      tiles.json          # Tile types including Workshop-unlocked ones
  systems/
    MetaProgressionSystem.ts  # Manages MetaState, building upgrades, unlocks
    UnlockManager.ts          # Filters loot pools by unlock state
    SeededRNG.ts              # mulberry32 + cyrb53 hash + API
    MetaPersistence.ts        # idb-keyval read/write for MetaState
    CollectionRegistry.ts     # Tracks all possible items + unlock status
  scenes/
    CityHubScene.ts           # Top-down city hub between runs
    CollectionScene.ts        # Full collection viewer
  state/
    MetaState.ts              # MetaState interface + defaults
```

### Pattern 1: MetaState Shape (Separate from RunState)
**What:** A dedicated state object for cross-run persistence, stored in its own IndexedDB store
**When to use:** All meta-progression data that survives across runs
**Example:**
```typescript
// MetaState.ts
export interface MetaState {
  buildings: {
    forge: { level: number };      // 0-5
    library: { level: number };
    tavern: { level: number };
    workshop: { level: number };
    shrine: { level: number };
  };
  metaLoot: number;                // Accumulated currency
  classXP: {
    warrior: number;
  };
  passivesUnlocked: string[];      // IDs of unlocked passives
  unlockedCards: string[];         // Card IDs in loot pool
  unlockedRelics: string[];        // Relic IDs in loot pool
  unlockedTiles: string[];         // Tile type IDs in loot pool
  runHistory: RunHistoryEntry[];   // Past run summaries
  totalRuns: number;
  version: number;                 // Schema version for migrations
}

export interface RunHistoryEntry {
  seed: string;
  loopsCompleted: number;
  bossesDefeated: number;
  exitType: 'safe' | 'death';
  metaLootEarned: number;
  xpEarned: number;
  timestamp: number;
}
```

### Pattern 2: Separate IndexedDB Stores
**What:** MetaState uses its own idb-keyval store, completely independent from RunState persistence
**When to use:** Meta-progression must survive run resets
**Example:**
```typescript
// MetaPersistence.ts
import { createStore, get, set } from 'idb-keyval';

const metaStore = createStore('autoscroller-meta', 'meta-state');

export async function loadMetaState(): Promise<MetaState> {
  const saved = await get<MetaState>('meta', metaStore);
  return saved ?? createDefaultMetaState();
}

export async function saveMetaState(state: MetaState): Promise<void> {
  await set('meta', state, metaStore);
}
```

### Pattern 3: Seeded RNG with String Seeds
**What:** Deterministic random number generation from a user-provided string seed
**When to use:** All in-run random decisions (enemy spawns, loot drops, event selection)
**Example:**
```typescript
// SeededRNG.ts

// cyrb53 hash: converts string to numeric seed
function cyrb53(str: string, seed: number = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// mulberry32: fast 32-bit PRNG
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRNG {
  private next: () => number;
  readonly seed: string;

  constructor(seed?: string) {
    this.seed = seed ?? Date.now().toString(36);
    const numericSeed = cyrb53(this.seed);
    this.next = mulberry32(numericSeed);
  }

  /** Returns float in [0, 1) */
  random(): number {
    return this.next();
  }

  /** Returns integer in [min, max] inclusive */
  intRange(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /** Pick random element from array */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.random() * arr.length)];
  }

  /** Shuffle array in place (Fisher-Yates) */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
```

### Pattern 4: Unlock-Gated Loot Pool Filtering
**What:** LootGenerator reads MetaState to filter available items before rolling
**When to use:** Every loot generation call (combat rewards, shop inventory, treasure, events)
**Example:**
```typescript
// UnlockManager.ts
export function getAvailableCards(
  allCards: CardDefinition[],
  metaState: MetaState
): CardDefinition[] {
  return allCards.filter(card =>
    !card.unlockSource || metaState.unlockedCards.includes(card.id)
  );
}

// Cards with no unlockSource are always available (starter cards)
// Cards with unlockSource are only available if unlocked
```

### Pattern 5: JSON Data with Unlock Metadata
**What:** Extend existing card/relic definitions with unlock-gate fields
**When to use:** All content definitions that can be locked behind progression
**Example:**
```json
// cards.json (single card entry)
{
  "id": "fury",
  "name": "Fury",
  "description": "Deal 30 damage. Lose 10 Defense.",
  "category": "attack",
  "rarity": "uncommon",
  "cooldown": 2.0,
  "effects": [{ "type": "damage", "value": 30, "target": "enemy" }],
  "cost": { "defense": 10 },
  "unlockSource": "forge",
  "unlockTier": 2
}
```

### Pattern 6: City Hub Scene (Phaser Top-Down)
**What:** A Phaser scene with positioned building sprites, click handlers, and modal upgrade UI
**When to use:** Between-run hub screen
**Example:**
```typescript
// CityHubScene.ts (simplified structure)
export class CityHubScene extends Phaser.Scene {
  private metaState!: MetaState;

  create() {
    this.metaState = getMetaState(); // from MetaProgressionSystem

    // Position buildings around town square
    const buildings = [
      { key: 'forge', x: 200, y: 150, label: 'Forge' },
      { key: 'library', x: 600, y: 150, label: 'Library' },
      { key: 'tavern', x: 400, y: 300, label: 'Tavern' },
      { key: 'workshop', x: 200, y: 450, label: 'Workshop' },
      { key: 'shrine', x: 600, y: 450, label: 'Shrine' },
    ];

    for (const b of buildings) {
      const sprite = this.add.rectangle(b.x, b.y, 120, 120, 0x8b7355)
        .setInteractive({ useHandCursor: true });
      this.add.text(b.x, b.y + 70, b.label, { fontSize: '16px' })
        .setOrigin(0.5);
      sprite.on('pointerdown', () => this.openBuildingModal(b.key));
    }
  }

  private openBuildingModal(buildingKey: string) {
    // Show upgrade tiers, costs, what each tier unlocks
    // Player can spend meta-loot to upgrade
  }
}
```

### Anti-Patterns to Avoid
- **Mixing MetaState and RunState**: MetaState is cross-run, RunState is per-run. Never merge them. MetaState reads happen at run-start to populate loot pools; RunState never writes to MetaState directly
- **Using Math.random() in game systems**: All randomness in a seeded run MUST use the SeededRNG instance. Math.random() is only acceptable for cosmetic/visual effects not tied to game outcomes
- **Hardcoding unlock checks**: Use UnlockManager to filter; never scatter `if (metaState.unlockedCards.includes('fury'))` throughout game code
- **Saving too frequently**: MetaState only changes between runs (building upgrades, XP banking). Save on run-end and building-upgrade, not every frame

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB persistence | Raw IndexedDB API | idb-keyval with createStore | Connection management, error handling, promise wrapping all handled |
| Complex data queries on meta-state | Custom IndexedDB indexes | Simple key-value with idb-keyval | MetaState is a single object, not a queryable collection |
| JSON schema validation | Custom validator | TypeScript interfaces + runtime checks | Type-safe at compile time; add simple runtime shape check for loaded JSON |
| Card balance spreadsheet | In-code balance constants | JSON data files | Editable without recompile; separates data from logic |

**Key insight:** Phase 4 is primarily a content + data-driven phase. The systems (persistence, events, loot generation) are built in prior phases. Phase 4 populates data, adds the hub scene, and wires unlock filtering into existing systems.

## Common Pitfalls

### Pitfall 1: MetaState Schema Migration
**What goes wrong:** Player upgrades game, MetaState shape changed, old IndexedDB data breaks
**Why it happens:** No version field or migration logic in MetaState
**How to avoid:** Include a `version` field in MetaState. On load, check version and migrate old schemas forward. For v1, default migration = merge loaded state with defaults (new fields get default values)
**Warning signs:** TypeError when accessing new MetaState fields after a code update

### Pitfall 2: Non-Deterministic Seeded Runs
**What goes wrong:** Same seed produces different results on different runs
**Why it happens:** Some code path uses Math.random() instead of SeededRNG, or RNG calls happen in non-deterministic order (e.g., async operations, animation callbacks)
**How to avoid:** All game-outcome randomness goes through SeededRNG. Visual-only randomness (particle effects, screen shake variance) can use Math.random(). Ensure RNG call order is deterministic (no race conditions)
**Warning signs:** Two runs with the same seed diverge after a few encounters

### Pitfall 3: Loot Pool Empty After Fresh Install
**What goes wrong:** No cards/relics appear in loot because all are gated behind unlocks
**Why it happens:** Forgot to mark starter content as always-available (no unlockSource)
**How to avoid:** Cards/relics with NO `unlockSource` field are always in the pool. Only content with explicit unlockSource requires unlocking. Starter deck cards + 3-4 common relics must have no gate
**Warning signs:** Empty reward screens, shop with no items

### Pitfall 4: Meta-Loot Economy Imbalance
**What goes wrong:** Player either maxes all buildings in 3 runs or can never afford anything
**Why it happens:** No playtesting of earn rates vs costs
**How to avoid:** Design costs so first building tier is affordable after 1-2 runs. Max tier takes ~15-20 runs of good play. Document the expected progression curve in the data file
**Warning signs:** Players stuck with no upgrades after many runs, or everything unlocked too fast

### Pitfall 5: idb-keyval Store Collision
**What goes wrong:** MetaState and RunState overwrite each other
**Why it happens:** Using the default store for both
**How to avoid:** Create explicit separate stores: `createStore('autoscroller-meta', 'meta-state')` for meta, `createStore('autoscroller-run', 'run-state')` for run. Different database names
**Warning signs:** Data disappears on run reset, or run data persists when it should not

### Pitfall 6: Building Upgrade Effects Not Applied
**What goes wrong:** Player upgrades Forge but new cards do not appear in loot
**Why it happens:** Upgrade mutates MetaState but LootGenerator does not re-read unlocks
**How to avoid:** On building upgrade, immediately update MetaState.unlockedCards/Relics/Tiles. LootGenerator reads MetaState on every loot roll (not cached at run start). Or: re-compute available pool at run start from current MetaState
**Warning signs:** Need to refresh browser to see new unlocks

## Code Examples

### Boss Type Variants (Content Extension)
```typescript
// In enemies.json -- boss type entries
{
  "id": "boss_tank",
  "name": "Iron Golem",
  "type": "boss",
  "bossType": "tank",
  "baseHP": 1200,        // 300% of base 400
  "baseDefense": 30,
  "attack": {
    "damage": 16,         // 80% of base 20
    "defense": 15,
    "pattern": "scaling"
  },
  "goldReward": { "min": 120, "max": 180 },
  "metaLootReward": { "min": 15, "max": 25 }
}
```

### Building Upgrade Data Structure
```typescript
// buildings.json
{
  "forge": {
    "name": "Forge",
    "description": "Unlock new cards into the loot pool",
    "maxLevel": 4,
    "tiers": [
      {
        "level": 1,
        "cost": 50,
        "unlocks": { "cards": ["heavy-hit", "shield-wall"] },
        "description": "Unlock Heavy Hit and Shield Wall"
      },
      {
        "level": 2,
        "cost": 120,
        "unlocks": { "cards": ["fury", "iron-skin"] },
        "description": "Unlock Fury and Iron Skin"
      },
      {
        "level": 3,
        "cost": 250,
        "unlocks": { "cards": ["berserker", "arcane-shield"] },
        "description": "Unlock Berserker and Arcane Shield"
      },
      {
        "level": 4,
        "cost": 500,
        "unlocks": { "cards": ["rejuvenate", "mana-drain", "weaken"] },
        "description": "Unlock Rejuvenate, Mana Drain, and Weaken"
      }
    ]
  }
}
```

### Run-End Meta-Loot Banking
```typescript
// Called when run ends (safe exit or death)
export function bankRunRewards(
  runState: RunState,
  metaState: MetaState,
  exitType: 'safe' | 'death'
): MetaState {
  const lootMultiplier = exitType === 'safe' ? 1.0 : 0.25;
  const xpMultiplier = exitType === 'safe' ? 1.0 : 0.0;

  const updated = { ...metaState };
  updated.metaLoot += Math.floor(runState.meta.metaLootEarned * lootMultiplier);
  updated.classXP.warrior += Math.floor(runState.hero.xpEarned * xpMultiplier);
  updated.totalRuns += 1;
  updated.runHistory.push({
    seed: runState.seed,
    loopsCompleted: runState.loop.count,
    bossesDefeated: runState.loop.bossesDefeated,
    exitType,
    metaLootEarned: Math.floor(runState.meta.metaLootEarned * lootMultiplier),
    xpEarned: Math.floor(runState.hero.xpEarned * xpMultiplier),
    timestamp: Date.now(),
  });

  return updated;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TS const data files | JSON external data files | Phase 1 decision | Cards, relics, enemies, events all in JSON; editable without recompile |
| Module-level singletons | Centralized RunState + MetaState | Phase 1 decision | Clean state boundaries, serializable, testable |
| Math.random() everywhere | SeededRNG instance per run | Phase 4 | Reproducible runs, shareable seeds |
| No meta-progression | City hub + building upgrades | Phase 4 | Between-run engagement loop |
| Relic apply() functions in TS | JSON-declarative relic effects | Phase 1 decision | Must convert existing apply() lambdas to declarative format |

**Deprecated/outdated:**
- `getRelicManager()` singleton -- replaced by RunState relic list + MetaState unlock tracking
- `getRandomRelic()` using Math.random() -- replaced by SeededRNG + unlock filtering
- `getRandomEvent()` using Math.random() -- replaced by SeededRNG
- TypeScript const arrays for card/relic/enemy data -- replaced by JSON files

## Open Questions

1. **Relic Effect Declarative Format**
   - What we know: Phase 1 decided relic effects should be JSON-declarative, not TS lambdas
   - What's unclear: The exact declarative schema for effects like "When HP drops to 0, heal to 50% once per combat" (phoenix_feather)
   - Recommendation: Define an effect-type enum that covers all 8 existing relics. Complex conditionals use a simple DSL: `{ "trigger": "damage_taken", "condition": "hp_zero", "effect": "heal_percent", "value": 50, "once_per": "combat" }`

2. **Terrain Tile Types for Workshop Unlocks**
   - What we know: Workshop building unlocks new tile types. Phase 3 has terrain-themed combat tiles (forest, graveyard, swamp)
   - What's unclear: Exactly which tile types are base vs Workshop-unlocked
   - Recommendation: Base tiles = basic, combat (forest), shop, rest, event, treasure. Workshop unlocks = graveyard, swamp, and possibly 1-2 more terrain types with unique enemy pools

3. **Passive Skill Tree Persistence Format**
   - What we know: 5-6 linear passives for warrior, unlocked via Class XP milestones
   - What's unclear: Whether passive effects are stat-based (easy to serialize) or have runtime behavior (harder)
   - Recommendation: All passives are stat modifiers or conditional flag triggers, stored as JSON. Runtime behavior derived from stat modifications on run start

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (recommended -- pairs with Vite, zero config) |
| Config file | none -- see Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RELC-01 | Relics have passive effects applied correctly | unit | `npx vitest run tests/relics.test.ts -t "relic effects"` | No -- Wave 0 |
| RELC-02 | Relics modify cooldowns/stats/mechanics | unit | `npx vitest run tests/relics.test.ts -t "relic modifiers"` | No -- Wave 0 |
| RELC-03 | Relics obtainable from drops/shop/events | unit | `npx vitest run tests/loot.test.ts -t "relic sources"` | No -- Wave 0 |
| RELC-04 | 8 relics defined with unique effects | unit | `npx vitest run tests/content.test.ts -t "relic count"` | No -- Wave 0 |
| META-01 | City hub displays buildings and progression | manual-only | Manual: verify CityHubScene renders correctly | N/A |
| META-02 | Cards unlock permanently into loot pool | unit | `npx vitest run tests/unlocks.test.ts -t "card unlock"` | No -- Wave 0 |
| META-03 | Tile types unlock permanently | unit | `npx vitest run tests/unlocks.test.ts -t "tile unlock"` | No -- Wave 0 |
| META-04 | Class XP and passives persist across runs | unit | `npx vitest run tests/persistence.test.ts -t "class xp"` | No -- Wave 0 |
| CONT-01 | ~15 cards with distinct stats/cooldowns/targeting | unit | `npx vitest run tests/content.test.ts -t "card count"` | No -- Wave 0 |
| CONT-02 | ~8 relics with unique passive effects | unit | `npx vitest run tests/content.test.ts -t "relic uniqueness"` | No -- Wave 0 |
| CONT-03 | 2-3 boss types with different stat profiles | unit | `npx vitest run tests/content.test.ts -t "boss types"` | No -- Wave 0 |
| CONT-04 | ~5 events with choices and consequences | unit | `npx vitest run tests/content.test.ts -t "event count"` | No -- Wave 0 |
| PERS-02 | Meta-progression persists across sessions | integration | `npx vitest run tests/persistence.test.ts -t "meta save load"` | No -- Wave 0 |
| PERS-03 | Seeded RNG produces reproducible results | unit | `npx vitest run tests/rng.test.ts -t "deterministic"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest` dev dependency -- `npm install -D vitest`
- [ ] `vitest.config.ts` -- basic config pointing at tests/
- [ ] `tests/content.test.ts` -- validates card/relic/boss/event counts and uniqueness
- [ ] `tests/unlocks.test.ts` -- validates unlock filtering logic
- [ ] `tests/persistence.test.ts` -- validates MetaState save/load cycle (needs fake-indexeddb for Node)
- [ ] `tests/rng.test.ts` -- validates SeededRNG determinism
- [ ] `tests/relics.test.ts` -- validates relic effect application
- [ ] `tests/loot.test.ts` -- validates loot pool filtering by unlock state
- [ ] `fake-indexeddb` dev dependency -- `npm install -D fake-indexeddb` for testing idb-keyval in Node

## Sources

### Primary (HIGH confidence)
- [idb-keyval GitHub](https://github.com/jakearchibald/idb-keyval) -- createStore API, custom stores, version 6.2.2
- [idb-keyval custom-stores.md](https://github.com/jakearchibald/idb-keyval/blob/main/custom-stores.md) -- Separate store per database name pattern
- Existing project code -- CardDefinitions.ts (14 cards), RelicDefinitions.ts (8 relics), EnemyDefinitions.ts (6 enemies), EventDefinitions.ts (5 events)
- Phase 1/2/3 CONTEXT.md files -- Architecture decisions, RunState shape, persistence strategy, combat/deck systems, loop/tile world

### Secondary (MEDIUM confidence)
- [mulberry32 GitHub](https://github.com/cprosche/mulberry32) -- Verified PRNG algorithm, passes gjrand tests
- [cyrb53 hash gist](https://gist.github.com/jlevy/c246006675becc446360a798e2b2d781) -- 53-bit hash function with seed parameter
- [bryc/code PRNGs reference](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) -- Comprehensive PRNG comparison confirming mulberry32 quality

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- idb-keyval confirmed from Phase 1 decision; no new dependencies needed
- Architecture: HIGH -- MetaState/RunState separation follows established Phase 1 patterns; JSON data migration is decided
- Content design: MEDIUM -- card balance, meta-loot economy are discretionary and need playtesting
- Seeded RNG: HIGH -- mulberry32 is well-documented, widely used, trivial to implement
- Pitfalls: HIGH -- based on direct analysis of existing code patterns and common IndexedDB usage

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain, no fast-moving dependencies)
