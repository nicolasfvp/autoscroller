# Cards System — Canonical Design Document

**Status:** Active spec for the element-driven card system (replaces v2 design from Phase 9).
**Last update:** 2026-05-15
**Source of truth for:** card generation, forge system, shard drops, deck rules, balance philosophy.

---

## 0. Delivery Status (2026-05-15)

This rewrite landed in 5 atomic commits on branch `design/cards-relics-tiles`:

1. `feat(cards): introduce element-driven card system (Tier 1+2 content)` — canonical doc, elements.json, 156 cards (36 Tier 1 + 120 Tier 2), 330 Tier 3 mocks, synergies zeroed, relics 50 → 39
2. `feat(forge): add Forge/Shard/DeckBuilder systems + UI scenes` — pure logic + Phaser overlays
3. `refactor: remove Shadowblade class + add state migrations for new system` — reverts to 2 classes, RunState v5 + MetaState v8, type schema extensions, starter decks
4. `test: align fixtures + design docs with Shadowblade removal` — drops the Shadowblade test file + scrubs class refs from fixtures and design docs
5. `docs(tech-debt): refresh TECH-DEBT with Phase 10 test fixture status` — catalogs the remaining ~170 stale test fixtures with a work order

**What works:**
- All 156 implemented cards load cleanly into `cards.json`; IDs are alphabetically canonical (`t1-attack-fire`, `t2-fire-fire-water`, etc.).
- ShardSystem rolls drops per kill (1-3 / 6-13 / 20-30 by enemy type), auto-converts at 10 shards per element. Class bias (75/25 split) applied.
- ForgeSystem looks up cards by element multiset, computes gold cost with discount tier, validates inventory + tier-unlock + deck capacity, executes crafting, persists recipes to MetaState.
- DeckBuilder validates the 5-card / 10-element / class-ratio starter rule.
- ForgeScene + DeckBuilderScene compile and are registered in `SCENE_KEYS` (`Forge`, `DeckBuilder`).
- MetaState migrates from v6 → v7 → v8 with backfills for `forgeRecipes` and `deckPresets`.
- RunState migrates from v3 → v4 → v5 with backfills for `economy.shards` / `economy.elements` and shadowblade → warrior fallback.
- TypeScript compiles cleanly on the new code (the 30-odd remaining tsc warnings are pre-existing unused-var noise).

**What's left for a follow-up session** (full triage in `TECH-DEBT.md`):
- ~170 test fixture updates (content totals, EconomyState mocks, removed mechanics).
- Wire the Forge overlay into LoopHUD / CityHub (currently the scene is registered but has no entry button — open via `this.scene.launch('ForgeScene', { metaState })`).
- Wire the DeckBuilder into CharacterSelect → run start.
- `enemy-drops.json` still references v2 card IDs in `cardPool`; the fallback path (random common card) still works.
- Pixel art for the 156 cards (currently placeholder rendering).

**How to verify:**
- `npm run build` should compile.
- `npm test` shows 17 failing files / 171 failing cases — all are fixture debt documented in TECH-DEBT.md §0.
- `node scripts/merge-cards.mjs` regenerates `cards.json` from `data/generated/` (intermediate files are gitignored).

---

## 1. Overview

The card system is built from **8 Elements** that combine in multisets to form cards across **3 tiers**.
Players collect element-typed **shards** from enemies, accumulate them into whole **elements** (10 shards → 1 element, auto-conversion), and spend elements + gold at the **Forge** to craft cards into their run deck.

Cards are **universal** (any class can use any card). The player's class affects only **shard drop bias** (Warrior → physical; Mage → elemental). Recipes (discovered combinations) persist across runs as meta-progression; physical card instances are per-run.

---

## 2. The 8 Elements

### Physical Elements
| ID | Display Name | Primary Stat | Identity | Color | Theme |
|---|---|---|---|---|---|
| `attack` | Attack | STR | Direct damage, rage stacks | `#DC2626` | Red — aggressive, raw |
| `defense` | Defense | VIT | Armor, mitigation, taunt | `#6B7280` | Gray — fortress, stoic |
| `agility` | Agility | DEX | Cooldown reduction, dodge | `#FACC15` | Yellow — quick, evasive |
| `counter` | Counter | STR | Reflect damage, retaliate, gain on hit | `#B91C1C` | Dark red — reactive |

### Elemental Elements
| ID | Display Name | Primary Stat | Identity | Color | Theme |
|---|---|---|---|---|---|
| `fire` | Fire | INT | Burn DoT, sustained damage | `#F97316` | Orange — flame, persistence |
| `water` | Water | SPI | Heal, shield, freeze | `#0EA5E9` | Blue — life, restoration |
| `air` | Air | DEX | Speed, multi-strike, weakness | `#C4B5FD` | Light purple — wind, mobility |
| `earth` | Earth | VIT | Stun, slow, elemental armor | `#92400E` | Brown — control, weight |

**Categories:**
- `physical`: `attack`, `defense`, `agility`, `counter`
- `elemental`: `fire`, `water`, `air`, `earth`

### Stat-to-Element Default Scaling
When a card has an effect that *naturally* scales with a stat, use this default:
- `damage` → STR (or INT if the card is fire-dominant or pure-elemental)
- `armor` → VIT
- `cooldown_reduction` / `dodge` → DEX
- `heal` → SPI
- `dot:burn` → INT (per-stack, see existing burn DoT scaling)
- `dot:poison` → DEX
- `slow` / `stun` → VIT or SPI
- `reflect` → STR

Each card MAY scale with multiple stats if it has multiple effects.

---

## 3. Tiers — Power Levels (not Cost)

| Tier | Elements per card | Count | Status this version | Power band |
|---|---|---|---|---|
| 1 | 2 (multisets of size 2 from 8 elements) | **36** | Implemented | Baseline — "common" |
| 2 | 3 (multisets of size 3 from 8 elements) | **120** | Implemented | Strong — "uncommon to rare" |
| 3 | 4 (multisets of size 4 from 8 elements) | **330** | **Mocked only** (locked) | Legendary — "epic to legendary" |

**Total card pool: 486 (156 implemented + 330 mocked).**

### Key rule: tier does NOT dictate cost or cooldown.
A strong Tier 2 card may be one that "recovers a lot of mana with a low cooldown" — the tier just means it's overall more impactful than a Tier 1 equivalent. Cost and CD are tuned per-card based on the card's identity.

### Balance budget
Within each tier, aim for:
- ~30% of cards are **resource generators** (recoup stamina/mana/HP/shards)
- ~70% are **resource consumers** (spend resources for damage/utility)

### Power band guidance (rough)
- Tier 1 damage card: ~5-12 dmg, costs 0-2 stamina, CD ~1.0-1.5s
- Tier 2 damage card: ~12-25 dmg or 20-40 burst with stat scaling, CD ~1.0-2.0s
- Tier 3 damage card: 35+ dmg or significant utility combo, CD ~1.5-3.0s

### Power band targets (enforced by `scripts/audit-card-balance.mjs`)

Each card carries an implied "power score" computed from its effects, costs,
and cooldown. The score is a rough proxy for how impactful the card is in
combat. Within each tier, all cards should land inside a tight numeric band
so that no card in a tier is a strict outlier.

**Score formula** (also embedded in `scripts/audit-card-balance.mjs`):

| Component | Contribution |
|---|---|
| `damage` | +1 per point (×1.4 if `targeting === "aoe"`) |
| `armor` | +0.8 per point |
| `heal` | +1.2 per point |
| `dot` (any stack) | +2 per stack (×1.4 if AoE) |
| `buff` (stat) | +1.5 per +stat |
| `stack` (rage/arcane) | +2 per stack |
| `debuff` (enemy -def) | +1.2 per point (×1.4 if AoE) |
| `stamina`/`mana` gain (self) | +1 per point |
| Stat scaling | +1.5 per `scale.value` unit |
| `stamina` cost | −0.6 per point |
| `mana` cost | −0.6 per point |
| `defense` cost | −0.8 per point |
| Cooldown > 1.0s | −0.3 per 0.1s above baseline |
| Cooldown < 1.0s | +1 per 0.1s below baseline |

**Tier bands:**

| Tier | Power band (`[low, high]`) |
|---|---|
| 1 | `[4, 12]` |
| 2 | `[10, 22]` |
| 3 | (not yet defined — mocks are still locked) |

**Hard caps inside a tier (regardless of band):**

| | Tier 1 | Tier 2 |
|---|---|---|
| Max total DoT stacks per card | 3 | 6 |
| Max heal value per card | 12 HP | 22 HP |

### Cross-tier ordering rule (no inversions)

> **A Tier-2 card must score strictly higher than every Tier-1 card it could replace.**
> In particular, every Tier-2 card with 3 elements must outscore the
> Tier-1 card whose 2-element multiset is the "dominant pair" of those
> three elements. **No Tier-1 card may strictly dominate any Tier-2 card**
> across cost, cooldown, and impact axes simultaneously.

The motivating real bug this rule catches: an old `t1-earth-water` "Mud Throw"
that dealt 5 damage + 2 freeze for 1 mana at CD 1.2s used to outclass the
Tier-2 `t2-air-air-earth` "Sandstorm" (5 damage AoE + 1 freeze AoE for 2
mana at CD 1.4s). After this audit, Sandstorm clearly outclasses Mud
Throw on every meaningful axis.

Likewise **no Tier-1 card may strictly dominate another Tier-1 card** —
i.e. there must be no Tier-1 pair `(a, b)` where `a` is cheaper-or-same on
both cost and CD AND equal-or-better on every impact axis AND strictly
better on at least one.

### How to run the audit

```
node scripts/audit-card-balance.mjs
```

Expected output: `outOfBand: 0`, `violations: 0`. The script exits non-zero
if any card violates the bands, the caps, or the cross-tier ordering rule.

If you change a card's numbers, re-run the auditor. If it complains, run
`node scripts/rebalance-cards.mjs` to auto-tune. The rebalancer preserves
each card's identity (it will never reduce an effect below 25% of its
original value) and prefers small CD/cost tweaks over deleting effects.

---

## 4. Shard & Element Inventory

### Shards (8 typed counters)
Each enemy kill rolls shards. Each shard is one of 8 types (matching the 8 elements).

**Roll formula per kill:**
1. Determine total shard count for this enemy:
   - `normal` enemies: random integer in [1, 3]
   - `elite` enemies: random integer in [6, 13]
   - `boss` enemies: random integer in [20, 30]
2. For each shard, roll independently:
   - **Category bias by player class:**
     - Warrior: 75% physical / 25% elemental
     - Mage: 25% physical / 75% elemental
   - **Subtype within category:** uniform among the 4 elements in that category

### Element units (auto-conversion)
When any shard counter reaches **10**, the system automatically:
1. Subtracts 10 from the shard counter
2. Adds 1 to the corresponding element-unit counter

This happens at the moment shards are received (apply, then check, then convert; loop until below 10 for each type).

### Forge uses
- **Forge consumes element units** (not raw shards).
- Crafting a Tier-1 card uses 2 element units. Tier-2 uses 3. Tier-3 uses 4.
- Player must have all required element units (one per slot in the combination's multiset).

---

## 5. Forge System

### In-run access
A button in `LoopHUD` opens the **ForgeScene** overlay any time during a loop.

### Crafting flow
1. Player picks 2-4 element units from their inventory and places them in slots.
2. The system identifies the resulting card (deterministic by element multiset).
3. UI shows preview: card name, effects, cost, cooldown.
4. Player clicks "Forge" → spends elements + gold → card is added to current deck (if deck < 15).

### Gold cost
| Tier | Base gold cost |
|---|---|
| 1 | 75 |
| 2 | 200 |
| 3 | 500 (when unlocked) |

**No "mixed" multiplier** — gold cost is flat per tier. (Simplification from the earlier proposal; mixed combinations are normal, not premium.)

### Forge meta-building level → bonuses
| Forge Level | Tier unlocked | Gold discount |
|---|---|---|
| 0 | Tier 1 only | 0% |
| 1 | Tier 1 only | 0% |
| 2 | Tier 1-2 | -10% |
| 3 | Tier 1-2 | -15% |
| 4 | Tier 1-3 | -20% |
| 5 | Tier 1-3 | -25% |
| 6 | Tier 1-3 | -30% |

### Recipes (meta-persistence)
The first time a player forges a specific combination, the recipe is saved to `MetaState.forgeRecipes` (a list of element multisets, serialized as canonical strings like `"attack+fire"`).

In future runs, the recipe appears in the Forge UI's "Known Recipes" list for one-click rebuild (still costs elements + gold).

**Physical cards do NOT persist** — they exist only in the current run's deck.

---

## 6. Deck System

### Size limits
- **Minimum: 5 cards**
- **Maximum: 15 cards**

Adding via loot or forge is **refused** if at max. Player must trash a card first (Shop or in-deck UI).

### Starter deck — element budget rule
At the start of a new run, the player selects a starter deck of exactly **5 cards**, summing to **10 elements total** (so all 5 are Tier 1 cards).

**Class element ratio:**
- **Warrior**: 7-10 physical elements / 0-3 elemental
- **Mage**: 0-3 physical elements / 7-10 elemental

### Deck presets
Each class has **5 saveable preset slots** in `MetaState.deckPresets`. Players can save/load presets between runs. Presets respect the element-ratio rule.

A default preset is auto-generated per class at first launch:
- **Warrior default**: 5 cards totaling 8 physical + 2 elemental (mix of pure attack/defense + light fire/water flavor)
- **Mage default**: 5 cards totaling 2 physical + 8 elemental (mix of fire/water/air/earth + some agility)

---

## 7. Class System

**Two classes only**: `warrior` and `mage`. The Shadowblade class has been removed.

### Class differences
- **Base stats** (HP, Stamina, Mana, STR/VIT/DEX/INT/SPI)
- **Shard drop bias** (Warrior favors physical, Mage favors elemental)
- **Starter deck presets** (default differs by class)

Cards themselves are **universal** — `classRestriction` defaults to `"neutral"` for almost all cards.

---

## 8. Card Schema (TypeScript)

```typescript
export type ElementId =
  | 'attack' | 'defense' | 'agility' | 'counter'
  | 'fire' | 'water' | 'air' | 'earth';

export type ElementCategory = 'physical' | 'elemental';

export type CardTier = 1 | 2 | 3;

export interface CardDefinition {
  id: string;                       // canonical ID derived from elements (see §9)
  name: string;
  description: string;
  category: CardCategory;
  tier?: CardTier;                  // NEW: 1, 2, or 3
  elements?: ElementId[];           // NEW: 2-4 elements that compose this card
  effects: CardEffect[];
  cost?: CardCost;
  cooldown: number;
  targeting: 'single' | 'aoe' | 'lowest-hp' | 'random' | 'self';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';   // legacy; mostly tracks tier
  classRestriction?: 'warrior' | 'mage' | 'neutral'; // omitted = neutral
  locked?: boolean;                 // NEW: true for Tier 3 mocks
  unlockSource?: string;            // legacy; can still be 'forge'
  unlockTier?: number;              // legacy; can be omitted
}
```

---

## 9. Canonical Card ID Format

To make IDs deterministic and machine-readable, generated cards use this format:

`t{tier}-{element_ids_sorted_alphabetically}`

**Examples:**
- 2× attack = `t1-attack-attack`
- 1× attack + 1× fire = `t1-attack-fire`
- 2× fire + 1× water = `t2-fire-fire-water`
- 1× attack + 1× defense + 1× fire + 1× water = `t3-attack-defense-fire-water`

For Tier-1 and Tier-2 hand-tuned cards, the `name` field is a creative name (e.g., "Phoenix Bloom"), but the `id` always follows the canonical pattern.

For Tier-3 mocks, both `id` and `name` are formulaic.

---

## 10. Build Archetypes (Design Targets)

These should be viable and fun to play. Generation agents should ensure cards exist that support each archetype:

1. **Mage Burn**: Fire-dominant + Air (faster ticks) + Earth (slow → more ticks). DoT-focused.
2. **Warrior Bruiser**: Attack + Defense + Counter. Sustain through long combat.
3. **Tempo Hunter**: Agility + Air. Maximize card plays per second, evasion.
4. **Healer Tank**: Water + Defense + Earth. Sustain + armor + crowd control.
5. **Burst Glass Cannon**: Attack + Fire. Huge damage windows, fragile.
6. **Counter Mage**: Counter + Fire + Water. Reflect + DoT + self-sustain.
7. **Control Stunlock**: Earth + Air. Lock enemies with slow/stun chains.
8. **Resource Engine**: Attack + Water + Agility. Cards that generate stamina/mana while still doing work.

---

## 11. Tier 3 Mocks (Locked)

All 330 size-4 multisets generated to file `src/data/json/cards-tier3-mocks.json` with shape:

```json
{
  "id": "t3-air-earth-fire-water",
  "name": "???",
  "description": "Tier 3 — Locked. Forge level 4 to unlock.",
  "category": "magic",
  "tier": 3,
  "elements": ["air", "earth", "fire", "water"],
  "effects": [],
  "cooldown": 0,
  "targeting": "single",
  "rarity": "epic",
  "locked": true
}
```

These show up in the Collection/Gallery as locked placeholders, giving the player a sense of the future card pool without committing to specific effects.

When Tier 3 ships (future phase), these mocks are replaced with real entries that keep the same `id` (so collection unlocks transfer).

---

## 12. Migration & Backward Compatibility

### Save migration
- Existing v6 saves with `className: "shadowblade"` are migrated to `"warrior"` on load.
- `MetaState.classXP.shadowblade` is dropped silently.
- `MetaState.deckPresets` is added with default presets per class.
- `MetaState.forgeRecipes` is added as empty array `[]`.

### Existing content deletion
- All 125 v2 cards removed from `cards.json`.
- All 125 v2 synergies removed (`synergies.json` deleted; `SynergySystem` becomes no-op).
- 10 Shadowblade-restricted relics removed from `relics.json`.
- Remaining ~40 relics kept; any with shadowblade-specific effects (CP, stealth) are removed or re-pointed.

---

## 13. Implementation Roadmap

### Phase A — Foundation (this session)
- ✅ Canonical doc
- 🔄 Delete Shadowblade (31 files)
- 🔄 Update types.ts schema
- 🔄 Generate 36 Tier 1 cards
- 🔄 Generate 120 Tier 2 cards
- 🔄 Generate 330 Tier 3 mocks
- 🔄 Adapt 50 relics → ~40
- 🔄 Replace cards.json + delete synergies.json
- 🔄 Implement ForgeSystem + ForgeScene
- 🔄 Implement ShardSystem with auto-conversion
- 🔄 Implement DeckBuilder with presets + ratio enforcement
- 🔄 Update tests
- 🔄 Atomic commits

### Phase B — Future
- Tier 3 cards (replace 330 mocks with real entries)
- Tier 3 forge unlock & balance pass
- Card art (Pixellab or hand-pixel art)
- New tile types (e.g., Forge tile that gives bonus shards)
- Element-driven enemy affinity (e.g., fire enemies drop more fire shards)
- PvP / leaderboards keyed off element synergy

---

## 14. Files Touched

### New files
- `docs/CARDS_SYSTEM.md` (this file)
- `src/data/json/elements.json` (canonical element definitions)
- `src/data/json/cards-tier3-mocks.json` (330 mocks)
- `src/systems/ForgeSystem.ts`
- `src/systems/ShardSystem.ts`
- `src/scenes/ForgeScene.ts`
- `src/scenes/DeckBuilderScene.ts`

### Modified files (high-level)
- `src/data/json/cards.json` — full replacement (156 cards)
- `src/data/json/relics.json` — adapted (~40 from 50)
- `src/data/types.ts` — new ElementId, CardTier, expanded CardDefinition
- `src/state/MetaState.ts` — new fields: `forgeRecipes`, `deckPresets`, drop `shadowblade`
- `src/state/RunState.ts` — new fields: `shards`, `elements`, deck cap enforcement
- `src/systems/hero/ClassRegistry.ts` — remove shadowblade entry
- `src/scenes/CharacterSelectScene.ts` — remove shadowblade option
- `src/scenes/Preloader.ts` — remove shadowblade preload
- `src/ui/CombatHUD.ts`, `LoopHUD.ts`, `StyleConstants.ts` — remove shadowblade UI
- `src/systems/combat/CombatEngine.ts`, `CombatState.ts` — remove shadowblade-specific mechanics
- `src/systems/combat/SynergySystem.ts` — no-op (synergies replaced by element combinations)

### Deleted files
- `src/systems/hero/ShadowbladeClass.ts`
- `src/data/json/synergies.json`
- `design/03_shadowblade.md`
- `tests/systems/combat/shadowblade-mechanics.test.ts`

---

## 15. Generation Notes for Agents

When generating cards, follow these rules:

### Naming
- Tier 1: Mostly formulaic but evocative. Use a short, punchy word (e.g., "Strike", "Bulwark", "Flameburst", "Gust") for pure pairs, and a 2-word combo for mixed pairs ("Flame Slash", "Stone Guard").
- Tier 2: Hand-tuned. Each card should feel distinct. Use evocative phrases ("Phoenix Bloom", "Tempest Veil", "Mire Shackles") that hint at the combination's flavor.
- Tier 3: All `name: "???"` — generation is formulaic per §11.

### Effect design
- Avoid pure flat-damage filler. Add ONE flavor effect (DoT, scaling, condition, generator hook) per card whenever possible.
- For elemental combos, lean into the thematic synergy:
  - Fire + Water = steam (damage + heal), or phoenix (heal + burn)
  - Earth + Water = mud (slow + heal), or roots (control)
  - Air + Fire = wildfire (AoE burn), or pyromancy (multi-strike fire)
  - Earth + Air = sandstorm (AoE slow + dmg)
  - Attack + Counter = riposte (dmg + reflect)
  - Defense + Agility = dancer's guard (armor + CD reduction)

### Cost/CD principles
- Pure-element cards (2x or 3x same): often cheap and fast, but limited utility.
- Mixed combos: more expensive, more impactful.
- Generators (give resources back) should have effects strong enough to justify their lower direct power.
- Avoid cards that cost MORE than their effect is worth — every card should be playable in some build.

### Scaling
- Most cards should have at least one effect with `scale`. Use the element's primary stat (§2).
- For combo cards, scale the dominant effect with the dominant element's stat.

### Class restriction
- All generated cards use `classRestriction: "neutral"` (omit field). Cards are universal.

---

## 16. Enemy Element Affinity

Every enemy in `enemies.json` carries an optional `affinity: ElementId` field. The affinity does **not** alter the enemy's base damage formula — it fires a secondary effect each time the enemy lands an attack, giving each enemy a distinct identity beyond raw stats.

### Affinity effects

Boss variants double every magnitude (`m = 2` instead of `m = 1`). Caps prevent runaway over a long fight.

| Affinity | On-hit effect | Boss flavor |
|---|---|---|
| `attack`  | No secondary (raw damage budget is the identity). | Same — boss base damage carries it. |
| `defense` | Enemy gains +3 armor per hit, cap 25 (boss: +6 / cap 60). | Forces hero to bring armor-shred or burst. |
| `agility` | Enemy attack cooldown shrinks 100 ms per hit (boss: 200 ms), floor 500 ms. | Fight gets faster as enemy ramps. |
| `counter` | Hero takes 2 extra HP loss after the hit (boss: 4). | Punishes greedy attackers. |
| `fire`    | Hero loses 1 HP + 1 stamina (boss: 2 / 2). | Burn fades out resources. |
| `water`   | Enemy heals 4 HP (boss: 8) clamped to maxHP. | Fight stretches; pressure tank builds. |
| `air`     | Hero loses 1 mana; 15% stun chance (boss: 2 mana / 30% stun). | Disrupts mage cycle. |
| `earth`   | Hero loses 2 stamina + enemy gains 1 armor, cap 15 (boss: 4 / +2 / cap 40). | Slows and turtles. |

### Roster assignments (current 20 enemies)

| Enemy | Affinity | Rationale |
|---|---|---|
| Lost Lizard | defense | Slow HP tank |
| Corpse Eater | counter | Undead retaliation |
| Headless Fire Horse | fire | Fire flavor |
| Pocket Cat | agility | Fast scrappy |
| Baby Dragon | fire | Fire breath |
| Giant Beetle | defense | Chitin armor |
| Mutated Salamander | water | Regenerative amphibian |
| Ancient Tree | earth | Earth elemental |
| Giant Spider (×2) | water | Venom flavor |
| Mush | earth | Spore slow |
| Forge Slime | fire | Forge heat |
| Lava Golem | fire | Lava |
| Mecha Warrior | defense | Armored construct |
| Depths Horror | air | Disorienting psychic |
| Toxic Gooze | water | Toxin |
| Venomous Kobra | air | Quick venom strike |
| Doom Knight (boss) | counter | Reflective dark knight |
| Iron Golem (boss) | defense | Tank armor stacker |
| Lizard King (boss) | attack | Raw damage boss |

Distribution: 4 defense / 4 fire / 4 water / 2 earth / 2 air / 2 counter / 1 agility / 1 attack.

### Implementation files
- `src/data/types.ts` — `EnemyDefinition.affinity?: ElementId`
- `src/systems/combat/EnemyAffinity.ts` — `applyEnemyAffinityEffect()`
- `src/systems/combat/CombatState.ts` — `enemyAffinity: ElementId | null`, `enemyType` fields
- `src/systems/combat/EnemyAI.ts` — calls affinity post-damage on both single-hit and multi-hit paths
- `src/core/EventBus.ts` — new `'combat:enemy-affinity'` event for HUD feedback
- `scripts/assign-enemy-affinities.mjs` — bulk-applies the roster table above

### Future: type advantage
Not yet implemented — but the door is open for a "cards of element X deal +30% damage to enemies with affinity Y" rule. Add a `weakTo: ElementId[]` field to enemy defs and read it in `CardResolver.applyEffect`.

---

**End of canonical spec.** Generation agents work from this file. Updates to this file ARE updates to the design.
