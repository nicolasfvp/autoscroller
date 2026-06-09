# Balance Workflow Brief — deck-vs-enemy simulation & off-curve detection

You are part of a multi-agent balance pass on a 164-card autoscroller (8 elements × T1–T3,
warrior + mage). Your conclusions must be grounded in **real full-combat simulations**, not
intuition. A working headless simulator is already built. Read this whole brief before acting.

## The mission (from the user)
1. Build deck templates across a run's progression (early / mid / late) combining archetypes
   (pure poison, poison+burn, poison+block, bleed+rage, slow/stun control, armor finisher, …).
2. Test them against different normal enemies AND bosses.
3. Detect **off-curve cards**: clearly weaker or stronger than they should be.
   - Too STRONG is usually fine — UNLESS it's *oppressive* (one card/deck trivializes everything).
   - Too WEAK is bad: a barely-weak card becomes **unused**. Flag those.
4. Balance monster/boss progression realistically — e.g. *"Can the average deck a player has at
   loop 10 beat the first boss, which should be easy?"*
5. **T3 cards MUST be better than ANY T2 card.** Fix violations by **BUFFING the T3**, never by
   nerfing the T2.

## HARD design constraints (C1–C5) — every proposal must comply
- **C1 PRICING:** resource cost (stamina/mana) is the PRIMARY power lever; cooldown stays snappy
  (floor ~1.2s). Tier ≠ bigger cost/CD. Fix over-strong spam by **raising COST**; rescue weak
  long-CD cards by **cutting CD**. Only genuinely elite cards cost big in BOTH.
- **C2 SCALING:** STR is the universal global damage multiplier `1+(STR-1)*0.25`. Magic cards get
  `elemMult = 1+(elemStat-1)*0.15` (INT/SPI/DEX, magic-category only). Buff INT/DEX/SPI/VIT to
  compete, never remove STR's multiplier.
- **C3 DEFENSE:** armor/heal/stun are INTENTIONALLY race-losing — elite at survival/control to buy
  time for a second win condition. NO broad armor/heal→damage conversion. Exactly ONE narrow
  armor→damage finisher line is allowed (scale.source:"armor" / spend_armor cards).
- **C4 SCOPE:** wiring first, then cost/CD curve, then dead-card reworks.
- **C5 STATUS (locked, already implemented in-engine):** 6 stacks, no merge. poison = quadratic DoT
  `~n(n+1)`, capitalize realization, chunk-cap 60. bleed = `~0.75 n(n+1)`, swing ×2 when enemy
  just attacked, gate-only payoffs. burn = soft-cap `8+floor((n-8)/2)`/tick, bank-and-cash,
  detonators consume the pool. slow = PURE soft control (NO damage, 8%/stk cd-throttle, cap 50%).
  stun = PURE hard control (freezes enemy cd; DR window after a long freeze). rage = **Fury**:
  never spent, each stack adds flat hero damage (pre-STR, cap 12); payoffs gate on a rage threshold.
- **Tier charter:** T1 clean single effect; T2 one conditional/synergy hook; T3 build-around depth.
  All target the same OPS band on FLAT cost/CD — T3's edge is a higher **ceiling when assembled**
  (~+15–25%), never higher cost or longer CD.

Prior detection lives in `tests/audit/REBALANCE-PLAN.md` and `BALANCE-FINDINGS.md` (per-card OPS
audit). Your job is the **full-combat / deck-level** layer that audit could not measure.

## Progression model (grounded facts — use these, don't guess)
- Boss every 10 loops. Difficulty multiplier = `1 + bossKills*0.10` (normals full rate; bosses
  half rate then ×1.0). **Loops 1–10 all run at multiplier 1.0.**
- Boss rotation: doom_knight (loop 10) → iron_golem (20) → lizard_king (30) → bog_witch (40) →
  desert_golem (50) → infernal_dragon (60) → boss_iron_golem (70).
- **The "first boss that should be easy" = doom_knight at loop 10, multiplier 1.0** (380 HP / def 3
  / 9 dmg / cd 2.5s). This is the headline realism check.
- Hero power comes from in-run XP leveling (NOT a stat shop): per level +6 maxHP; every 2 levels
  +1 VIT & +1 offense axis (STR warrior / **INT mage**); every 4 levels +1 DEX. Plus VIT×5→maxHP,
  relics, deck-size relics. **Mage INT stays LOW (~3 at loop 10)** — magic scaling is weak; mages
  lean on flat values + volume early/mid.
- runXP→level: ~120≈L2, ~350≈L5, ~520≈L6, ~720≈L7-8. Deck grows 5→15 cards (forge cap 15).

## Canonical stage profiles (baked into the expander — used by everyone for consistency)
| stage | runXP | enemies (battery) | boss | enemy mult |
|---|---|---|---|---|
| `early` | 120 | lost_lizard, giant_spider, corpse_eater, pocket_cat | — | 1.0 |
| `mid`   | 350 | mutated_salamander, venomous_kobra, lava_golen, skeleton, werewolf | — | 1.0 |
| `boss1` | 520 | (none) | **doom_knight** (1.0) | 1.0 |
| `late`  | 720 | depths_horror, fire_elemental, werewolf, mutated_salamander | iron_golem (1.05) | 1.15 |

Override per-deck with `relics`, `stats` (statDeltas), `runXP`, `vsEnemies`, `vsBoss:false`.

## Tools (all real, all tested)
- **Card catalog:** `tests/audit/card-catalog.md` (skimmable, grouped by archetype × tier with
  isolated peakOPS) and `tests/audit/card-catalog.json` (programmatic; has `groups` by archetype).
  ONLY use card ids that exist here — the expander warns on typos.
- **Author decks:** write a JSON `{ "decks": [ { id, label, archetype, class:"warrior"|"mage",
  stage, deck:[ids], upgraded?:[ids], relics?:[ids], stats?:{str,vit,dex,int,spi,maxHP,...},
  runXP?, vsEnemies?:[ids], vsBoss? } ] }`. Decks are 5–15 ids; the sim does NOT enforce element
  budget, but keep decks realistic (warrior mostly physical; mage mostly elemental).
- **Expand to matchups:** `node scripts/expand-matchups.mjs <decks.json> <out-matchups.json> [repeats]`
- **Run the simulator (the core tool):**
  `SIM_SPEC=<matchups.json> SIM_OUT=<results.json> npx vitest run tests/audit/deck-battle-sim.test.ts`
  Runs every matchup `repeats` times (default 3) and writes results. ~1.5s for ~60 matchups.
- **Baseline dataset (already produced):** `tests/audit/sim-battle-results.json` (from
  `tests/audit/decks/seed-decks.json`). Read it for shared context.

### Result fields per matchup (what to read)
`winRate` (0–1), `avgTtkMs` (time-to-kill on wins), `avgHeroHpPctOnWin` (HP cushion), `deaths`,
`timeouts`, `avgDamageDealt`, `avgCardsPlayed`, `score` (= winRate + 0.25×HP cushion). A healthy
normal-enemy fight: winRate 1.0, comfortable HP cushion. A healthy *first-boss* fight: winRate ≥
~0.8 with some HP cost (it should be beatable but not trivial). winRate 0 with `deaths>0` = a real
loss; `timeouts>0` = the deck can't close the fight (also a fail).

## Testing PROPOSED CHANGES (questioning phase — no code edits needed)
The simulator can apply a proposed change in-memory, per matchup, then revert — so you
can A/B "current card" vs "buffed card" in ONE spec:
- **Enemy tuning** — add `"enemyOverride": { "baseHP": 350, "attack": {"damage":7,"pattern":"fixed"}, "affinity": null }`
  to a matchup. `affinity:null` (or `"attack"`) tests removing the iron_golem defense-affinity
  armor ratchet. (loopMultiplier 1.0 keeps boss scaling at base.)
- **Card tuning** — add `"cardOverrides": { "<cardId>": { "cooldown": 1.8, "cost": {"stamina":2},
  "exhaust": false, "effectsPatch": [ {"value": 6, "pierce_armor": true} ] } }`. `effectsPatch[i]`
  shallow-merges into `effects[i]` (set `value`, `pierce_armor`, `multi_hit`, `stack`,
  `consume_stack_value`, condition thresholds, …); or pass a full `"effects": [...]` to replace.
  Read the card's effects in card-catalog.json / cards.json to know which index to patch.
- **Magic elemMult rate (C2)** — set the env var on the run:
  `SIM_ELEM_RATE=0.22 SIM_SPEC=... SIM_OUT=... npx vitest run tests/audit/deck-battle-sim.test.ts`
  (production = 0.15). Sweep it to find the rate that clears the boss at INT3 while staying
  BELOW same-level strMult (`1+(STR-1)*0.25`) at INT4 — that ceiling is the C2 constraint.
- **A/B discipline:** put the candidate card in an EARLY deck slot (the engine plays the deck in
  FIXED ORDER, no shuffle — a late-slot card may never be drawn). Always test baseline AND
  changed in the same spec, ≥4 repeats (≥6 for boss claims). A proposed buff must (a) achieve its
  goal (flip a loss to a win / restore T3>T2) AND (b) not over-correct (make the card oppressive or
  the boss trivial). Report the actual numbers.

## Detection methodology (be rigorous — this is what the adversary will check)
1. **Archetype viability:** does the archetype clear its stage's enemy battery and the boss at a
   realistic profile? Under-performing archetype → likely weak key cards or a broken economy.
2. **Off-curve card detection via SWAP TESTS (the gold standard):** hold a fixed deck + profile +
   enemy, replace ONE slot with the candidate card; the win-rate / TTK / HP delta vs a baseline
   filler = that card's marginal value. Cards far BELOW the pack = too weak (unused-tier). Cards
   far ABOVE = too strong (flag only if oppressive). Run several enemies to avoid a single-matchup
   fluke.
3. **Tier A/B (T3>T2 enforcement):** build two decks identical except one swaps a T2 card for the
   analogous T3 card (same element/role). The T3 version MUST win/TTK at least as well. If not,
   the T3 is the bug → propose a BUFF to the T3 (cite C1: cut its CD or raise its ceiling; never
   nerf the T2).
4. **Boss/enemy progression realism:** test realistic stage decks vs the stage boss. Headline:
   `boss1` decks (loop-10 average) vs doom_knight — should be winnable (~0.8+). If most realistic
   decks lose, the boss is over-tuned OR the late-game cards are under-tuned — diagnose which.
5. **Always run ≥3 repeats** (RNG via rand()); prefer 5 for boss claims. Quote the actual numbers
   from your results JSON in every finding. NEVER invent a number you didn't simulate.

## Output (return as structured data; also write your artifacts to your assigned folder)
For each finding: `{ kind: viability|off_curve_weak|off_curve_strong|tier_violation|progression,
card_or_archetype, stage, evidence (the sim numbers + matchup ids), severity (low|med|high),
proposed_change (concrete, C1–C5-compliant), confidence }`. Write your decks/specs/results to the
folder named in your task prompt so the adversary and synthesizer can re-read them.
