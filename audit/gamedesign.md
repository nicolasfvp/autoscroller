# Game Design Audit

## Summary

### The 3 design risks most likely to hurt retention
1. **Player is a spectator in combat.** Cards auto-resolve in deck order on independent cooldowns; the only "input" during a fight is watching numbers tick. The only player decisions live in *planning* (deck order, tile placement, shop buys). After loop 3, when the deck is set and tiles are placed, the moment-to-moment loop is "stare at HP bars for 60–90 seconds per fight". Autoscroller + auto-combat = autoplay.
2. **Difficulty is flat to the point of meaninglessness.** `percentPerLoop: 0`, `speedScalePerLoop: 1.02` (effectively dead — `getLoopSpeed` ignores it anyway), and bosses only scale via `percentPerBossKill: 0.10` at half-rate. A loop-15 fight is mechanically identical to a loop-2 fight unless you've killed a boss in between. There is no rising tension inside a run.
3. **Meta-progression XP is permanently lost on death and the only "skill unlocks" gate behind it.** `deathXpPercent: 0` (lose 100% of XP on death) plus passives gated at 100/250/450/700/1000 XP per class means a death after a 30-minute run zeros progression. Combined with the shop RNG being a primary power source, a single bad shop can scuttle a long run that returns nothing.

### The 3 strongest design ideas worth doubling down on
1. **Element/forge recipe system.** 8 elements × multiset combinations yields ~164 cards with deterministic recipe lookup (`canonicalCardId`). The Forge gives players agency over their build between runs and converts shards (a fail-state resource) into cards — this is a strong roguelite hook.
2. **Tile planning between loops.** Reservation rules, subtile AOE effects (War Horn boosting spawn rates, Bleed Totem boosting DoT), and tile inventory are a meaningful pre-combat decision layer. This is the *actual* gameplay loop in this title — combat is just the payoff.
3. **Daily run with MQTT broadcast.** The infra is in place (`DailyRunBroadcaster` + `DailyRunTicker` + deterministic class/deck via `deriveDailyRunConfig`). The hook just needs a payoff layer (see findings).

---

## Core loop assessment

The advertised loop is **autoscroll → tile triggers combat → cards auto-play → loot → loop completes → plan tiles → repeat → boss every 25 loops**. The verbs the *player* contributes are: choose which tile to place where, choose what to buy/upgrade/reorder in shops, choose to exit or continue at a boss, and choose a deck before the run. During the 80%+ of wall-clock time spent in combat or traversal, the player **does nothing**. `CombatEngine.tick()` plays the next affordable card from `deckOrder` on its cooldown timer, the enemy attacks on its own cooldown, the player observes. There is no input to interrupt, retarget, or activate.

This is structurally similar to Loop Hero, which is a defensible reference — but Loop Hero compensates with extremely meaningful tile placement decisions that constantly shift enemy composition and player power. Here, tile placement happens only at loop boundaries, and most of the 35-tile mid-game loop is filled with terrain tiles that just produce more identical fights. The decision density per minute drops sharply after the first 3 loops once the deck is locked.

The deepest pull in this design is actually the **meta** (Forge + Buildings + Class XP), not the moment-to-moment. That means retention hinges on whether 30-minute runs are *fun to spectate* and whether the per-run unlock drip is satisfying. Right now both are weak: combat is repetitive (same 1–3 enemy types per terrain, identical attack patterns) and meta unlocks are heavily front-loaded into expensive building costs (Forge L6 needs 180 iron + 120 crystal + 50 essence + 30 bone — multiple full runs per tier).

---

## Findings

### [HIGH] Player has zero input during combat — combat is autoplay
**System:** `src/systems/combat/CombatEngine.ts`, `CardResolver.ts`
**Issue:** `tick()` advances cooldowns, plays the next affordable card from `deckOrder`, and resolves it with no input affordance. There is no card-targeting, no on-the-fly reordering, no "save card for boss", no manual play button, no pause-tactical. The deck order chosen in planning is the entire combat strategy. After a deck is finalized, combat outcomes are 100% deterministic given enemy stats. This is the single biggest design risk in the project.
**Player impact:** Watching is not playing. After three combats with the same deck, the brain disengages. Streamers/social shareability suffers — there's no "highlight play."
**Suggested fix:** Add at least one in-combat decision per fight. Options, cheapest first: (a) Let the player **manually trigger** the next card by clicking, with auto-play as an optional setting — gives kinetic input without changing math. (b) **One active ability per class** that the player times — e.g. Warrior "Power Surge: next card +50% dmg" with a 20s cooldown. (c) **Card peek + reorder** in combat (1 swap per combat, free, or costs stamina). (d) **Drag-to-target** for AOE cards once multi-enemy lands.
**Trivial?:** no

### [HIGH] Difficulty curve is essentially flat inside a run
**System:** `src/data/difficulty.json`, `DifficultyScaler.ts`
**Issue:** `percentPerLoop: 0`, `tilePointScalePerLoop: 0`, `getLoopSpeed` returns the base speed regardless of loop count (`speedScalePerLoop` is dead code). The only stat-scaling driver is `percentPerBossKill: 0.10`, applied to a `bossKillCount` that ticks once every 25 loops. Bosses scale at *half* that rate. So enemy HP only rises 10% per *boss cycle* (~25 loops, ~25–40 min of play), and bosses themselves rise 5%. Meanwhile player power compounds rapidly from new cards, upgrades, relics, passives, and stat scaling. By loop 15 the run is trivial; the run ends not from death but from boredom.
**Player impact:** Early runs (pre first-boss) feel like the *real* difficulty. Late runs feel like rolling credits. There is no "I might die this loop" tension after the first boss, which kills the roguelike's core gambling-with-progress dynamic.
**Suggested fix:** Bring back per-loop scaling: `percentPerLoop: 0.04` (4% HP+damage per loop, compounding). Cap at, say, +200%. Make bosses scale at full rate, not half. Alternatively, escalate *enemy count* per tile or unlock harder enemy archetypes in `terrainEnemies.addAtLoop`.
**Trivial?:** yes — 2 numbers in `difficulty.json`

### [HIGH] All XP is lost on death — meta progression has no safety net
**System:** `src/data/difficulty.json` (`deathXpPercent: 0`), `RunEndResolver.ts`, `MetaProgressionSystem.bankRunRewards`
**Issue:** On death, materials retain 25–50% (storehouse-dependent) but XP retention is hardcoded to 0. Class XP unlocks the passive tree (`mage-passives.json` / `warrior-passives.json`) at 100/250/450/700/1000 thresholds. A 40-minute Daily Run that dies on the last loop awards exactly 0 XP toward passives. This punishes risk-taking *after* a player is already heavily invested in a session.
**Player impact:** Slot-machine feedback loop — invest 30 min, win nothing measurable on death. Encourages safe-exiting at boss 1 instead of pushing, which means players never see their own ceiling.
**Suggested fix:** `deathXpPercent: 0.30` (parity with material retention). Optionally, tier the XP retention via Library upgrades so it becomes a meta investment. Also consider awarding partial XP at each boss kill so progress banks mid-run.
**Trivial?:** yes — 1 number

### [HIGH] No leaderboard / score on Daily Run — social hook is half-built
**System:** `DailyRunBroadcaster.ts`, `DailyRunTicker.ts`, `DailySeed.ts`
**Issue:** The daily-run MQTT infra publishes `{wave, hpPct, bossesDefeated, alive, className}` and the ticker subscribes to today's wildcard topic to build a live in-memory map of all visible runs. But there is no leaderboard UI, no run-ranking comparison, no "you beat 73% of players today", no end-of-day score persistence. A grep for `leaderboard|ranking` returns 0 hits in `src/`. The plumbing exists for a social hook but no payoff is implemented.
**Player impact:** Daily Run is mechanically identical to a regular run from the player's view — no reason to play it over a custom seed. The competitive itch (FOMO of the day, peers' scores) goes unmet.
**Suggested fix:** Add (1) end-of-run "your score = bossesDefeated × 100 + wave + hpPct × 10", (2) persisted top-50 daily list (retain MQTT publish on death already exists), (3) "you placed #42 of 187" screen on death. This is the highest-leverage retention feature given the infra is already there.
**Trivial?:** no (UI work) but the data plumbing is free

### [HIGH] Bosses are stat-sticks — no unique mechanics
**System:** `src/systems/BossSystem.ts`, `src/data/json/enemies.json`
**Issue:** All three "boss" enemies (`doom_knight`, `iron_golem`, `lizard_king`) have `behaviors: []` and identical structure to normals — just higher HP (450–700), damage (10–14), defense (5). `EnemyAI.applyPeriodicBehaviors` checks for `shield` and `enrage` behaviors but no boss declares any. `BossSystem.triggerBossCombat` even hardcodes a different `BOSS_BASE_STATS` (HP 150) that doesn't match `enemies.json` — the actual enemy entries are bypassed for stats but the names/colors are used. Boss fight = normal fight with a fat HP bar.
**Player impact:** No reason to fear/prepare for a boss differently. The "stay or run" decision after boss kill loses weight because the next boss feels identical. Players don't develop boss-specific strategies.
**Suggested fix:** Populate `behaviors` arrays: Iron Golem gets `{type: 'shield', interval: 8000, shieldAmount: 30}`. Doom Knight gets `{type: 'enrage', hpThreshold: 0.5, attackSpeedMultiplier: 1.6}`. Lizard King gets a periodic AOE that ticks burn. Code already supports both `shield` and `enrage` triggers — they're just never used.
**Trivial?:** yes (data only — `shield`/`enrage` exist in `EnemyAI.applyPeriodicBehaviors`)

### [HIGH] Shop card RNG can softlock a run economically
**System:** `ShopSystem.getShopCards`
**Issue:** Shop offers exactly 3 random cards from the full `availableCardIds` pool with no rarity weighting and no class filter (warrior gets mage cards offered). With ~164 cards in the pool, the chance of any given shop offering a card synergistic with your build (e.g. all 3 Fire-element cards for a Burn build) is near-zero. Combined with the `cardBasePrice: 60, cardPricePerLoop: 8, cap: 150` pricing, a poor player at loop 5 facing 3 useless 100g cards just walks away.
**Player impact:** Shops feel like noise. The reroll mechanic doesn't exist; the player either buys junk to "do something" (deck-bloating their good build) or banks gold that has no other use. Build diversity suffers because the path of least resistance is always grabbing the first shop card matching your class.
**Suggested fix:** (a) Bias the shop toward the player's class (`CLASS_DECK_RATIO` already exists for warrior=physical, mage=elemental; reuse it for shop offers). (b) Add 1 reroll per visit at escalating cost. (c) Bias toward elements the player already has in their deck (Slay-the-Spire-style smart drops).
**Trivial?:** yes (data + ~30 LoC in `ShopSystem.getShopCards`)

### [MED] Burn DoT is a trap — stacks do nothing alone
**System:** `CombatEngine.tickActiveDoTs`, glossary vs. impl
**Issue:** `burnStacks > 0 ? deal 2 damage : 0`. Stacks don't increase tick damage; they're "ammunition" for Pyre cards only. So a player who builds an all-Burn deck without a single Pyre detonator deals a flat 2 dmg/tick regardless of having 1 or 20 burn stacks. The card descriptions say "Burn 3" suggesting magnitude matters.
**Player impact:** Players who naturally pick fire-themed cards (especially mage starter deck has 2 fire cards) feel like the deck is underperforming for unobvious reasons. A noob-trap that contradicts genre conventions (Slay-the-Spire Burn does damage on stack count).
**Suggested fix:** `dmg = Math.min(burnStacks, 8)` so stacks scale linearly with a soft cap. Pyre still detonates the pool for burst.
**Trivial?:** yes (5 LoC in `CombatEngine.tickActiveDoTs`)

### [MED] Build diversity is undercut by stat-locking from class identity
**System:** `ElementSystem.CLASS_DECK_RATIO`
**Issue:** Warrior is locked to physical 7–10, elemental 0–3 (effectively, max 3 fire/water/air/earth cards in a 5–15 deck). Mage is inverse. This is enforced at deck-customization and starter-deck generation. Combined with `class_bias` for shard drops (warrior gets 75% physical shards), a warrior cannot meaningfully play an elemental-focus build even if they want to. Build diversity becomes "warrior melee" vs "mage caster" with limited intra-class variation.
**Player impact:** After 2–3 runs per class, the build space feels exhausted. The 164 cards are real but the *accessible* card pool per class is more like 80–90.
**Suggested fix:** Loosen the ratios to `physicalMin: 4, elementalMax: 8`. Let players brew hybrids. The class identity can be preserved via passives + starting stats instead of hard deck restrictions.
**Trivial?:** yes (data in `elements.json`/`ElementSystem.ts`)

### [MED] Meta-pacing — Forge L6 and Shrine L4 require multiple successful runs
**System:** `src/data/json/buildings.json`
**Issue:** Forge level 6 costs 180 iron + 120 crystal + 50 essence + 30 bone. A normal enemy drops 1–2 of a single material on 30% chance; bosses drop 3–6 essence + 2–4 crystal generically + bonus. A "good" run nets maybe 20–40 of each common material and 5–10 essence. So Forge L6 is ~6–10 banked runs. Shrine L4 (80 crystal + 50 essence + 20 iron) is similar.
**Player impact:** The unlock cadence stretches each new toy across many runs. At first this feels great (new card every run), but the late-meta drips slow to a crawl right when the player's existing card pool feels exhausted (per the diversity finding above).
**Suggested fix:** Either (a) double material drop rates after loop 10, or (b) flatten the building cost curve (current curve is 8→20→45→80→120→180 for forge iron — change to 8→20→40→70→110→150). Combined with the gathering Storehouse perk, this brings L6 in ~4 runs instead of ~10.
**Trivial?:** yes (data only)

### [MED] Shop / Forge / Tavern collapse into "spend resource for stat" rather than meaningful choice
**System:** `ShopSystem`, `ForgeSystem`, `TavernPanelScene`
**Issue:** Shop = spend gold for card/relic/remove. Forge = spend shards+gold for card. Tavern = spend materials for permanent +20/+50/+100 gold start. There is no "tavern vs. shop" trade-off because they operate on different currencies. The Tavern at L3 just gives +100 starting gold + seed input — both are pure power. There's no opportunity cost across the three.
**Player impact:** Buildings feel like "just upgrade them all in order". No interesting strategic choice between Library (passives) vs. Forge (cards) vs. Shrine (relics) — you'll want them all eventually and the order is dictated only by material availability.
**Suggested fix:** Introduce mutually-exclusive perks: e.g. Tavern L3 *replaces* L2's history-view with seed-input — make levels branching paths (A or B at each tier). Or: cap total building levels (e.g. "8 building points to spend across 6 buildings") so the player commits.
**Trivial?:** no (design rework)

### [MED] Cards 0-cost vs 1-cost are unbalanced — free attacks dominate
**System:** `cards.json`, design/BALANCE-REPORT.md
**Issue:** Several T1 cards have `cost: {}` (free) but identical or superior effects to 1-stamina equivalents (the design team's own BALANCE-REPORT.md flags this as 9 issues in "MED (curva de custo)"). E.g. compare `t1-air-air` Tailwind (free, deals 4, +20% haste, +1 mana) to `t1-fire-fire` Pyre (free, deal 4 + 3 per burn stack, burn 3). Free cards with riders strictly dominate single-cost cards with equivalent damage.
**Player impact:** Cost as a deck-building constraint becomes irrelevant. Players gravitate to free cards; stamina/mana pools become trivial to maintain. The whole resource-cycle pillar of the design ("Stamina cycle" for warrior) collapses.
**Suggested fix:** Audit T1 free cards and either add stamina/mana costs proportional to their effect budget, or reduce their values. The design doc has an RPU formula (`R / max(C,1)`) — apply it.
**Trivial?:** no (rebalance pass across 36 T1 cards)

### [MED] Relics are stat-sticks, not synergy gates
**System:** `RelicSystem.ts`, `src/data/json/relics.json`
**Issue:** 80 relics, of which 32 are `trigger: passive` and most of those are flat stat bonuses (`stat_bonus`, `stat_multiplier`). Only 18 are `combat_start` and 13 are `card_played` — the latter being the most interesting. Reading the meta-progression unlock pool, the first 3 relics unlocked (warrior_spirit, iron_will) are pure stat bonuses. Players don't get to play with mechanic-bending relics until Shrine L3.
**Player impact:** Early-game relic acquisition feels like "+stat numbers go up" rather than "this changes how I play". The build-defining moment is gated 2–3 runs deep.
**Suggested fix:** Front-load the more interesting `card_played` and `dot_tick` relics into Shrine L1–L2. Move the stat-stick relics to higher tiers (or use them as guaranteed starter relics).
**Trivial?:** yes (data — reshuffle `buildings.json` shrine.tiers)

### [MED] Card count inflation — many cards are near-duplicates
**System:** `cards.json`
**Issue:** 164 cards across 8 elements with 36 T1 (all 2-element pairs) + 120 T2 (all 3-element multisets). Mathematically the combinatorics force near-duplicates: e.g. `t1-attack-defense` Shield Bash vs `t2-attack-attack-defense` Bulwark Salvo are functionally similar "attack + defense" plays. The BALANCE-REPORT lists 12 cards as "strictly dominated / power out of curve".
**Player impact:** Card identification fatigue. Players can't remember which "Steam Surge" vs "Misting Veil" vs "Mire Bloom" does what. Deck-building paralysis.
**Suggested fix:** Cut T2 cards that don't expose a unique mechanic. The design doc targets 125 cards total; current 164 is 30% over. Cut 30–40 T2 cards whose RPU is dominated by another T2.
**Trivial?:** no (design rework)

### [LOW] Run length asymmetry — death is faster than victory but XP cost is 100%
**System:** `LoopRunner`, `difficulty.json`
**Issue:** A successful run to first boss (`bossEveryNLoops: 25`) at `baseSpeed: 240` px/sec with `baseLoopLength: 15` tiles × 64px = 960 px per loop = 4 sec per loop traversal + combat time. Realistic 20–40 min per boss cycle. Death typically happens earlier (loop 8–12) so failed runs are ~10–15 min — not terrible, but the XP-loss-on-death problem (HIGH finding above) amplifies this.
**Player impact:** Failed run sting is duration × emotional investment. 12 min for nothing feels okay; 30 min for nothing is brutal.
**Suggested fix:** Couple this with the deathXpPercent fix. Also consider giving partial XP on each loop completion, not just on safe exit.
**Trivial?:** yes (paired with the XP fix)

### [LOW] Treasure RNG can repeatedly award useless tiles
**System:** `LootGenerator.rollTreasureLoot`, `treasure-tables.json`
**Issue:** Loot weights are gold 40 / card 30 / tile 20 / relic 10. Tile drops pull from `getAllPlaceableTiles()` uniformly — a player who already has 5 graveyard tiles can roll 3 more graveyards from a treasure tile. No deduplication, no scarcity bias.
**Player impact:** Mild — tiles aren't worthless, but late-run tile drops are inventory clutter.
**Suggested fix:** Bias toward tiles the player has fewer of. 5 LoC change in `LootGenerator`.
**Trivial?:** yes

### [LOW] No copper / no-gold softlock at shop
**System:** `ShopSystem`, no minimum-gold guarantee
**Issue:** A player at 0 gold who enters a shop after a streak of bad rolls cannot afford any card (60–150g) or removal (50–200g) or reorder (15–150g). They can only walk away. No fallback "trade card for card" or "1g vendor".
**Player impact:** Rare but feel-bad. More common in early runs when gold income is sparse.
**Suggested fix:** Add a "Bargain" option: 1 random common card for 0g, once per shop, if player has <30g. Or give 10g minimum on entering a shop tile.
**Trivial?:** yes

### [LOW] Shard system has no mid-run sink
**System:** `ShardSystem`, `ForgeSystem`
**Issue:** Shards drop from kills and convert to elements at 10:1 (`SHARDS_PER_ELEMENT: 10`). The Forge sink (mid-run forging) exists, but on a typical loop-12 run a player has 30–50 of each shard type and no Forge tile (Forge is a meta building, not an in-run sink unless the player places a Forge tile, if one exists). Shards bank into meta on safe-exit.
**Player impact:** Shards accumulate without giving the player anything to do *now*. Anti-engagement.
**Suggested fix:** Add a Forge tile (in-run) with reduced cost or an Inline Event that lets you spend shards for a temp buff. Some of this may exist in `InlineEvents.ts` — verify.
**Trivial?:** depends on whether forge-as-tile already exists

---

## Quick-win shortlist (data-only fixes, no code)

1. `difficulty.json`: `percentPerLoop: 0.04`, `deathXpPercent: 0.30` — fixes 2 HIGH findings.
2. `enemies.json`: Add `behaviors: [{type:'shield',...}]` to iron_golem and `{type:'enrage'}` to doom_knight — fixes boss-mechanics HIGH.
3. `buildings.json` (shrine): Move `berserker_ring`, `swift_boots` (card_played triggers) into L1 — front-loads interesting relics.
4. `elements.json`: Loosen `CLASS_DECK_RATIO` warrior elemental cap from 3 to 7 — opens build diversity.
5. `CombatEngine.tickActiveDoTs` (5-LoC): change burn `dmg = 2` to `dmg = Math.min(burnStacks, 8)` — fixes Burn trap.

These five changes alone would meaningfully improve perceived game quality without any new content.
