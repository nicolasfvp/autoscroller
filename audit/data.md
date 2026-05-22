# Data Integrity Audit

## Summary
- Broken refs: **51+** (24 missing cards in `buildings.json`, 3 missing relics, 5 unknown enemy ids in `materials.json`, 1 missing terrain key, plus stale schema-type mismatches across tiles/difficulty/hero-stats)
- Orphan defs: **3** enemies never spawned (`doom_knight`, `iron_golem`, `lizard_king`), **103/164** cards unreachable via drops, **1** entirely orphan file (`cards-tier3-mocks.json`), **2** orphan files in `src/data/json/` (`tiles.json`, `difficulty.json`) duplicated with divergent shape
- Duplicates: 0 hard duplicate ids/names within cards/enemies/relics/passives. Two parallel sets of warrior passives in different files.
- Validator status: `scripts/validate-data.mjs` **CURRENTLY THROWS** on first run — it tries to read `src/data/json/synergies.json` which does not exist anywhere in the repo. After that line is fixed, its `validTriggers` set still rejects 9 real relics. CI cross-ref coverage is therefore effectively zero today.

### Validator coverage gaps
What validate-data.mjs **catches** (once the missing-file crash is patched out):
- enemy-drops keys vs enemy names
- enemy-drops cardPool ids vs cards.json
- starterDeckIds (legacy single-class shape) vs cards.json
- buildings unlocks (cards/relics/passives/tiles)
- relics trigger surface-check (incomplete — see below)
- terrain-enemies keys vs tiles.json keys
- materials terrainDrops/enemyBonusDrops/bossDrops material ids
- enemies materialReward.bonusMaterial ids
- terrain-pair synergies tile keys

What it **misses**:
- `cards.json starterDecks.{warrior,mage}` ids (it only checks legacy flat `starterDeckIds`, which no longer exists — `cards.json` now uses `starterDecks: {warrior:[...], mage:[...]}`). All starter-deck refs are unvalidated.
- `materials.json enemyBonusDrops` ids vs `enemies.json` ids — it checks the right set but the JSON has 5 ids none of which exist (slime/goblin/orc/mage/elite_knight).
- `materials.json terrainDrops` keys vs `tiles.json` terrain keys (the `volcano` entry is silently dead; `lava`/`desert` have no entry).
- Enemy id → terrain-enemies reachability (3 enemies are defined but never spawned).
- `enemy-drops.json` coverage (some enemy names lack drop tables; not flagged).
- Cross-class duplicate passive definitions (`passives.json` vs `warrior-passives.json` / `mage-passives.json` disagree on warrior content).
- Effect `type`, `target`, `stack` enum vs `types.ts` schema (no card uses an unknown value today, but nothing prevents drift).
- ClassRegistry starter-decks vs `cards.json starterDecks` (currently drifted; see HIGH below).
- Validator's hard-coded `validTriggers` is stuck on v1 (six values) while `types.ts RelicTrigger` allows `enemy_killed`, `card_drawn`, `shop_visited`, `stat_changed`, `dot_tick`. 9 valid relics get false-positives.
- `terrain-enemies.json` `addAtLoop` keys are stringified loop numbers; no validation they're well-formed integers/ordered.
- `treasure-tables.json` schema (weights, ranges, pools) — entirely unchecked.
- `difficulty.json` schema — entirely unchecked; current shape does not match `types.ts DifficultyConfig`.
- `tiles.json` schema (the live one) — entirely unchecked; live `type` values (`terrain`, `subtile`, `buffer`) are not in `types.ts TileType`.
- `hero-stats.json` schema — unchecked; missing 4 required fields per `types.ts HeroStatsConfig`.
- Sprite asset existence vs enemy ids — unchecked (no enemy currently broken, but no guard).

---

## Findings

### [HIGH] validate-data.mjs crashes on missing `synergies.json`
**Where:** `scripts/validate-data.mjs:38`
**Issue:** `loadJSON('src/data/json/synergies.json')` throws — file does not exist anywhere in the repo. `synergies.json` is also referenced at `:46` (`src/data/synergies.json`) — also missing. The synergy system was migrated to keyword detection (`src/systems/cards/SynergyDetection.ts`) but the validator was not updated. Net effect: the only data CI check the project has does not run.
**Evidence:** `node scripts/validate-data.mjs` → `Error: Failed to load src/data/json/synergies.json: ENOENT`
**Fix:** Remove the two `synergies.json` loads (lines 38, 46) and the corresponding checks (`Check 3` and `Check 8`), or stub the variables to `[]` if the file is intended to come back.
**Trivial?:** yes

### [HIGH] Two divergent `tiles.json` files; DataLoader loads the wrong one
**Where:** `src/data/tiles.json` (live, object-keyed) vs `src/data/json/tiles.json` (legacy, 7-entry array)
**Issue:** `src/data/DataLoader.ts:7` imports `./json/tiles.json`, a 7-row array with stale tile types (`combat`, `elite`, `rest`) that don't exist in the live registry. All real consumers (`src/systems/TileRegistry.ts:1`, `LootGenerator`) import `src/data/tiles.json` (the keyed shape used by `terrain-enemies.json`). `DataLoader.getAllTiles()` / `getTileByType()` returns garbage but happens to be uncalled, so the bug is dormant. Any future caller will hit a silent failure.
**Evidence:** `diff -q src/data/tiles.json src/data/json/tiles.json` → files differ; live file has `forest/graveyard/swamp/desert/lava/event/treasure/boss/subtile_*` while legacy file has `combat/elite/rest`.
**Fix:** Delete `src/data/json/tiles.json`, drop tiles plumbing from `DataLoader.ts` (the `getAllTiles`/`getTileByType` exports are dead code — only `TileRegistry` is used).
**Trivial?:** no (verify no consumers first, then prune both the JSON and the loader functions)

### [HIGH] Two divergent `difficulty.json` files with incompatible shapes
**Where:** `src/data/difficulty.json` (live) vs `src/data/json/difficulty.json` (legacy)
**Issue:** Same pattern as tiles. Live file has `baseSpeed/bossEveryNLoops/loopGrowth/pricing/...`. Legacy file has `normal/hard` profiles with `baseEnemyHPMultiplier/cardDropRate/...`. `DataLoader.ts:9` and `getDifficultyConfig(level)` load the legacy shape, while `src/systems/DifficultyScaler.ts:1` loads the live one and re-declares the type locally. The schema in `src/data/types.ts DifficultyConfig` matches **neither** live consumer (it has `cardBase/removeCard/upgrade` shopCost; legacy JSON adds `reorder`; live JSON uses an entirely different `pricing.*` shape).
**Evidence:** `getDifficultyConfig` is defined in two places (`DataLoader.ts:103`, `DifficultyScaler.ts:84`) with different return shapes; consumers (`LoopRunner`, `GameScene`, `ShopSystem`, `RunEndResolver`) all import the DifficultyScaler one.
**Fix:** Delete `src/data/json/difficulty.json` and `DataLoader.getDifficultyConfig`. Rewrite `types.ts DifficultyConfig` to match the live JSON (or remove the unused interface entirely and let `DifficultyScaler`'s local interface be canonical).
**Trivial?:** no

### [HIGH] `buildings.json` Forge unlocks reference 24 cards that don't exist
**Where:** `src/data/json/buildings.json` `forge.tiers[*].unlocks.cards`
**Issue:** Card ids like `counter-strike`, `shield-wall`, `heal`, `parry`, `fury`, `iron-skin`, … (24 total) predate the t0/t1/t2 element-based card schema. Real card ids are `t1-counter-defense`, `t1-defense-defense`, etc. Every Forge level unlocks zero real cards, meaning meta-progression silently does nothing.
**Evidence:**
```
forge.1 cards: ["counter-strike","shield-wall","heal","parry"]   // none in cards.json
forge.2 cards: ["fury","iron-skin","reckless-charge","vampiric-touch","haste"]
... through forge.6
```
**Fix:** Re-author each tier's `unlocks.cards` array using current ids from `cards.json`. Probably needs a designer/product decision on which T1/T2 cards each Forge level gates.
**Trivial?:** no (24 ids × design decisions)

### [HIGH] `buildings.json` Shrine references 3 relics not in `relics.json`
**Where:** `src/data/json/buildings.json` `shrine.tiers`
**Issue:** Refs to `warrior_spirit` (shrine.1), `spell_focus` (shrine.3), and `blood_pact` (shrine.4) don't exist. Shrine.1 therefore unlocks only `iron_will`; shrine.3 only 3/4; shrine.4 unlocks **nothing**.
**Evidence:** Validator (once patched) flags all three.
**Fix:** Either replace with extant relic ids or add the missing relics to `relics.json`.
**Trivial?:** no

### [HIGH] `materials.json` enemyBonusDrops uses 5 ids that don't exist
**Where:** `src/data/json/materials.json` `enemyBonusDrops`
**Issue:** Keys `slime`, `goblin`, `orc`, `mage`, `elite_knight` refer to enemies that don't exist in `enemies.json`. Real ids are `forge_slime`, `lava_golen`, `mecha_warrior`, `lost_lizard`, etc. No bonus material drops ever fire.
**Evidence:** `enemies.json` ids: `lost_lizard, corpse_eater, headless_fire_horse, pocket_cat, baby_dragon, giant_beetle, mutated_salamander, ancient_tree, giant_spider_2, giant_spider, mush, forge_slime, lava_golen, mecha_warrior, depths_horror, toxic_gooze, venomous_kobra, doom_knight, iron_golem, lizard_king` — zero overlap with `materials.json` keys.
**Fix:** Re-key `enemyBonusDrops` against real enemy ids.
**Trivial?:** no

### [HIGH] `materials.json` terrainDrops misses `desert` + `lava`, has unused `volcano`
**Where:** `src/data/json/materials.json` `terrainDrops`
**Issue:** Live terrains in `tiles.json`: `forest/graveyard/swamp/desert/lava/basic`. `terrainDrops` has only `forest/graveyard/swamp/basic/volcano`. `desert` and `lava` tiles drop nothing; `volcano` entry is dead.
**Evidence:** `tiles.json` keys vs `materials.json terrainDrops` keys — `desert` and `lava` are unbacked; `volcano` is orphan.
**Fix:** Rename `volcano` → `lava` (likely intended) and add a `desert` entry.
**Trivial?:** yes (single-key rename + one entry add)

### [HIGH] Warrior starter deck disagrees between `cards.json` and `WarriorClass.ts`
**Where:** `src/systems/hero/WarriorClass.ts:27` vs `src/data/json/cards.json` `starterDecks.warrior`
**Issue:** Two sources of truth. Code wins at runtime (`RunState.createNewRun → getClassDef → classDef.starterDeck`); `cards.json starterDecks` is dead. They disagree on 2/5 cards.
| slot | `WarriorClass.ts` | `cards.json` |
|---|---|---|
| 1 | `t1-attack-attack` | `t0-attack` |
| 2 | `t1-defense-defense` | `t0-defense` |
| 3 | `t1-attack-defense` | `t1-attack-defense` |
| 4 | `t1-agility-agility` | `t1-agility-agility` |
| 5 | `t1-attack-fire` | `t1-attack-fire` |
**Fix:** Pick one source. Either delete `starterDecks` from `cards.json` (and from `DataLoader.getStarterDeckIds`) or replace `WARRIOR_STARTER_DECK` with a lookup into `cards.json`.
**Trivial?:** yes (delete one source)

### [HIGH] Mage starter deck also drifts between code and `cards.json`
**Where:** `src/systems/hero/MageClass.ts:25` vs `src/data/json/cards.json` `starterDecks.mage`
**Issue:** Code has `[t1-fire-fire, t1-water-water, t1-fire-water, t1-air-earth, t1-attack-fire]`; JSON has `[t0-fire, t0-water, t1-fire-water, t1-air-earth, t1-attack-fire]`. 2/5 disagree.
**Fix:** Same as Warrior.
**Trivial?:** yes

### [HIGH] Warrior passives doubly-defined with non-overlapping content
**Where:** `src/data/json/passives.json` (warrior section) vs `src/data/json/warrior-passives.json`
**Issue:** `passives.json` (used by `MetaProgressionSystem`, the Library unlock pipeline) lists `passive_attack_up, passive_defense_up, passive_regen, passive_combo_master, passive_endurance`. `warrior-passives.json` (used by `src/systems/hero/PassiveSkillSystem.ts:4`) lists `vigor, endurance, iron_body, battle_rage, second_wind`. Zero id overlap. The two systems can never agree on what a warrior has unlocked.
**Evidence:** Diff of the two id lists; both files are actively imported.
**Fix:** Pick one canonical file. If both are needed (one for meta-unlock, one for runtime stats), then `passives.json` warrior ids must match `warrior-passives.json` ids 1:1, with a shared schema.
**Trivial?:** no

### [HIGH] `types.ts HeroStatsConfig` requires 4 fields that aren't in `hero-stats.json`
**Where:** `src/data/types.ts:423` HeroStatsConfig vs `src/data/json/hero-stats.json`
**Issue:** Schema requires `vitality, dexterity, intellect, spirit` — JSON omits all four. `DataLoader.getDefaultHeroStats()` returns it cast-as-`HeroStatsConfig` and is itself unused (real stats come from `ClassRegistry`). Compile-time type safety is bypassed by `as HeroStatsConfig` cast.
**Evidence:** `hero-stats.json` has 12 keys; type demands 16.
**Fix:** Delete `hero-stats.json` and `DataLoader.getDefaultHeroStats` + the type (entirely dead path). Or add the 4 stat axes (default 0) and remove from `ClassRegistry`.
**Trivial?:** yes (delete) / no (consolidate)

### [HIGH] `types.ts TileType` enum doesn't include live tile types
**Where:** `src/data/types.ts:321` (`TileType = "basic" | "combat" | "elite" | "boss" | "event" | "treasure"`) vs `TileRegistry.ts:3` (`'basic' | 'buffer' | 'terrain' | 'subtile' | 'event' | 'treasure' | 'boss'`)
**Issue:** Live types include `terrain`, `subtile`, `buffer`; schema lists `combat`, `elite` which never appear in actual `tiles.json`. Validator and any future schema-driven code (e.g. JSON-schema gen) will reject live data.
**Fix:** Update `TileType` (or delete; `TileRegistry.TileSlotType` is the actual source of truth).
**Trivial?:** yes

### [MED] Validator's `validTriggers` set rejects 9 valid relics
**Where:** `scripts/validate-data.mjs:105`
**Issue:** Hard-coded set `{combat_start, turn_start, card_played, damage_taken, heal, passive}` is the v1 list. `types.ts:333 RelicTrigger` adds `enemy_killed`, `card_drawn`, `shop_visited`, `stat_changed`, `dot_tick`. Relics actually using new triggers: `bloodgorged_heart, burnt_tome, cinder_circlet, archon_codex, lucky_coin, linen_wrap, veterans_stripe, gravediggers_tag, huntmasters_eye`.
**Fix:** Replace literal Set with import from `types.ts` (or extend the literal).
**Trivial?:** yes

### [MED] Validator checks `starterDeckIds` but `cards.json` uses `starterDecks.{warrior,mage}`
**Where:** `scripts/validate-data.mjs:80`
**Issue:** Iterates `cards.starterDeckIds ?? []`; key doesn't exist in `cards.json`. All starter-deck ids in the active file are silently unvalidated.
**Fix:** Iterate both `starterDecks.warrior` and `starterDecks.mage`, falling back to legacy `starterDeckIds` if the new shape is absent.
**Trivial?:** yes

### [MED] 3 enemies defined but never spawned by any terrain
**Where:** `src/data/json/enemies.json` vs `src/data/terrain-enemies.json`
**Issue:** `doom_knight`, `iron_golem`, `lizard_king` are defined (with HP/damage/drops and bespoke drop tables in `enemy-drops.json`) but no terrain block references them. They presumably exist for boss/elite slots but no such wiring is visible in `terrain-enemies.json`.
**Evidence:** terrain-enemies refs: every other enemy id is reachable.
**Fix:** Either (a) add them to a boss-encounter table (likely a separate JSON), (b) delete them from `enemies.json` + `enemy-drops.json` if obsolete.
**Trivial?:** no

### [MED] 103 of 164 cards are unreachable through any drop or starter
**Where:** `src/data/json/cards.json` vs `enemy-drops.json` + `starterDecks`
**Issue:** Only 57 cards appear in any enemy drop pool; starter decks add ~7. Remaining 103 cards (mostly Tier-2 multielement combos) have **no way for the player to obtain them**. Shop/treasure tables (`treasure-tables.json`) draw from `"all_available"` which presumably means "all in the pool", but the enemy-drop coverage is heavily skewed: Tier-2 has only 1-2 archetypes per terrain. The game generates them but never offers most of them.
**Evidence:** 0 instances of e.g. `t2-agility-attack-attack`, `t2-air-fire-fire`, `t2-attack-counter-defense` in any drop table.
**Fix:** Audit Tier-2 drop coverage per class/element identity, or expand each enemy's cardPool, or rely on treasure/shop for breadth (and confirm those actually have access).
**Trivial?:** no

### [MED] `elements.json` is documented as canonical but is not imported by any source
**Where:** `src/data/json/elements.json`
**Issue:** Docs (`docs/CARDS_SYSTEM.md`, `docs/TOOLTIPS.md`) treat it as the source of truth for element ids/colors/identities. No runtime code imports it (zero `import.*elements.json` matches). Element colors used by `CardVisual` are likely hard-coded; drop rates / class bias / forge cost in this file are silently dead.
**Fix:** Either wire it (loader + consumers) or move the values into the code that already encodes them and delete the JSON.
**Trivial?:** no

### [MED] `cards-tier3-mocks.json` orphan (330 entries)
**Where:** `src/data/json/cards-tier3-mocks.json`
**Issue:** Generated by `scripts/generate-tier3-mocks.mjs`, mentioned only in docs. Not imported anywhere in `src/`.
**Fix:** Either import + display behind T3 locked state, or delete and regenerate when the feature ships.
**Trivial?:** yes (delete) — pending design

### [MED] `DataLoader.ts` is mostly dead code
**Where:** `src/data/DataLoader.ts`
**Issue:** Exports `loadAllData`, `getAllTiles`, `getTileByType`, `getDifficultyConfig`, `getDefaultHeroStats`, `getAllRelics`, `getAllEnemies`, `getStarterDeckIds`. Grep shows `loadAllData` is called by `Boot.ts` but the listed accessors for tiles, difficulty, hero stats are not consumed (live consumers each import their own JSON directly). The file simultaneously creates the "two divergent JSONs" mess.
**Fix:** Delete unused accessors + their imports; keep only what's actually called.
**Trivial?:** no

### [MED] `types.ts CardEffect.type` includes `debuff_stat`; never used in cards
**Where:** `types.ts:99` vs `cards.json`
**Issue:** Schema lists `debuff_stat` but zero cards use it, and `CardResolver.ts` has no case for it. Either dead schema or unimplemented feature.
**Fix:** Drop from schema or implement and exercise.
**Trivial?:** yes (drop)

### [MED] Enemy id `lava_golen` (typo "Golen" instead of "Golem")
**Where:** `src/data/json/enemies.json:316`, `src/scenes/Preloader.ts:85`, `src/data/terrain-enemies.json:48`, sprite filename `public/assets/characters/monsters/lava/lava golen.png`
**Issue:** The id and the asset path use "golen"; the `name` field correctly says "Lava Golem". Renaming risks breaking sprite-key wiring (id is used as `monster_${id}` key), so this is a coordinated rename if fixed.
**Fix:** Rename id + sprite filename + all 3 JSON refs in lockstep.
**Trivial?:** no

### [LOW] User-facing typos in enemy names: "Toxic Gooze", "Venomous Kobra"
**Where:** `src/data/json/enemies.json:394, :420`
**Issue:** "Gooze" → "Goo" (or "Ooze"); "Kobra" → "Cobra". Both appear in drop-table keys and combat HUD.
**Fix:** Pick spelling, update `enemies.json` + `enemy-drops.json` keys + sprite filenames consistently.
**Trivial?:** no (cross-file rename, paths included)

### [LOW] All user-facing strings are inline (no i18n extraction)
**Where:** card descriptions in `cards.json`, tile names in `tiles.json`, relic names/descriptions in `relics.json`, keyword definitions in `src/ui/KeywordDefinitions.ts`, building names/descriptions in `buildings.json`, plus scene literals across `src/scenes/*.ts`.
**Issue:** No i18n key system. Translating the game would require schema changes across ~10 JSON files plus every Phaser scene.
**Fix:** Out of scope for this pass; noting locations: ~750 user-facing strings across `cards.json` (164×2 fields), `relics.json` (80×2), `tiles.json` (10×2), `buildings.json` (~30 fields), plus ~50 inline strings in scenes.
**Trivial?:** no

### [LOW] `treasure-tables.json` schema is unvalidated and minimal
**Where:** `src/data/treasure-tables.json`
**Issue:** Weights sum cleanly to 100 (gold 40 / card 30 / relic 10 / tile 20). `cardPool="all_available"`, `relicPool="all_available"`, `tilePool="all_placeable"` — sentinel strings with no schema or validator coverage. Nothing currently breaks, but the magic strings are brittle.
**Fix:** Type the pool fields in `types.ts` and add a check to validator.
**Trivial?:** yes

### [LOW] `difficulty.json` `deathXpPercent`, `tilePointScalePerLoop`, `percentPerLoop` all 0
**Where:** `src/data/difficulty.json`
**Issue:** Three knobs are 0, suggesting either "intentionally disabled" or "never finished". Worth a designer review.
**Fix:** Document as intentional or wire up.
**Trivial?:** yes (document)

### [LOW] `terrain-enemies.json` has no `graveyard.addAtLoop.15+`, `swamp.addAtLoop.15+`, etc.
**Where:** `src/data/terrain-enemies.json`
**Issue:** Each terrain caps at loop 10, so enemy variety plateaus after loop 10. `difficulty.json.bossEveryNLoops=25` means a full 15 loops between content additions and the boss roof. Likely intentional but worth flagging for difficulty curve audit.
**Fix:** Design call.
**Trivial?:** yes (data add)

### [LOW] `basic` terrain has only one enemy at any loop
**Where:** `src/data/terrain-enemies.json` `basic`
**Issue:** Only `lost_lizard` ever spawns on basic path tiles (across all loops). `basicTileCombatChance=0.18` so it appears often. Combat variety on the default path is zero.
**Fix:** Add at least one `addAtLoop` tier.
**Trivial?:** yes
