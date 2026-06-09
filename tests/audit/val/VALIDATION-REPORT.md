# Full Card + Enemy Validation Report

Generated 2026-06-08 from a multi-agent, full-combat simulation pass.

## TL;DR verdict

- **First boss (doom_knight) is correctly EASY** — 97.4% full-win across 38 realistic loop-10 decks (0.59 HP cushion). The only loser is a pure-burn mage (a known weak archetype). **Do not touch it.**
- **The biggest balance problem is the BOSS DIFFICULTY CURVE, which is inverted/flat.** Later bosses are *less* threatening per equivalent deck than the first one. Average and even weak decks beat bosses 2–7 at 0.6–0.9 HP cushion. Root cause: hero power (in-run leveling + better decks) ramps faster than boss threat, and two of the three boss behaviors (`shield`, `drain`) are mechanically near-inert. Only `multi_hit` creates real pressure.
- **The Tier charter is violated at the median: T3 median OPS (15.33) < T2 median OPS (15.57).** Several pure-element T3 cards are strictly worse than their T2 sibling (Tempest Cadence, Quench Lance, Supernova, Tidesong Aura).
- **All 19 normal enemies are beatable (win rate 1.0)**; the only anomaly is `mush` (and earth-affinity enemies generally) soft-locking minimum-damage starter decks.
- **35 code-verified card/enemy bugs & unclear descriptions** found (2 high, 13 medium), plus a data inconsistency (`green_field` references 3 non-existent enemies).

## 1. Scope & method

| Dimension | Coverage |
|---|---|
| Cards simulated | **164 / 164** (every card in ≥1 realistic deck) |
| Enemies simulated | **26 / 26** (19 normals + 7 bosses) |
| Decks | **181** realistic decks (pure + mixed archetypes, warrior + mage) across 12 loop-band stages (loop2 → boss7/loop70) |
| Matchups | **857** full-combat simulations on the real `CombatEngine` |
| Builds | pure-physical, bleed-rage, armor-finisher, armor-control, mixed-bruiser, pure-poison, pure-burn, poison-burn, slow-stun-control, heal-sustain, poison-block, detonator-control, deliberately-weak starters |

Decks were authored fixed-order-aware (engine plays the deck in array order, no shuffle, skips unaffordable cards). Hero power per stage comes purely from the real in-run XP leveling curve (no stat shop, no relics) — verified clean attribution. Enemy scaling mirrors the engine (`1 + bossKills*0.10` for normals; the boss half-rate for bosses).

### Harness validated (adversarial condition audit — PASSED "solid")
- Hero seeds at **full resolved maxHP** (the prior ~66%-HP bug is fixed) — runtime-confirmed.
- Per-combat STR/INT/VIT/DEX/maxHP correctly derived from runXP — hand- and runtime-confirmed.
- **A boss-scaling bug was found and fixed mid-pass**: the expander was double-applying the boss half-rate (deep bosses under-scaled, e.g. boss7 540 HP instead of 611). After the fix all 7 bosses match the engine exactly.
- 857/857 matchups resolved cleanly — **0 errors, 0 timeouts**.
- Aggregator math spot-checked accurate vs raw results.

### Known limitations (be honest)
- **The sim is effectively deterministic** for this roster (all 857 win rates are exactly 0 or 1; no card RNG flips an outcome). Repeats add no statistical robustness — they should be reallocated to more decks. **In-deck win rate saturates at 1.0 and is therefore a weak discriminator**; OPS, boss HP-cushion, and TTK are the real signals.
- **Late decks barely cycle**: ~67% of fights end before one full deck pass, so back-of-deck cards in 13–15-card decks are weakly tested. (This *also* corroborates that late content is under-tuned — fights are too short.)
- **Under-sampling**: early base normals get ~6 matchups each (the `mush` rate is qualitatively sound but quantitatively fragile); 19 cards appear in only 1 deck; the `loop25` band has 0 decks.
- **Session-limit caveat**: the per-finding adversarial verification pass and a supplementary-sampling round were cut off by an API session limit. The **headline findings below were re-verified by me directly** (independent re-sims + data/code re-checks); lower-severity card findings that did not get a second agent pass are marked *(unverified)*.

## 2. First boss — doom_knight (loop 10) — VERDICT: appropriately easy ✅

- 38 loop-10 decks, **37 win (97.4%)**, mean HP cushion **0.592**.
- Beaten by armor, physical, bleed, poison, control, mixed builds.
- The single loss is `mage-pure-burn` (8/8 deaths): pure-burn DoT soft-caps below 380 HP before the boss grinds the 70-HP mage down — a known pure-burn weakness, not a boss problem.
- doom_knight has the **lowest raw DPS of any boss (2.40)**; its modest threat comes from 380 HP being slow to chew at L7 decks + counter-affinity retaliation. This is the calibrated baseline; **leave it unchanged.**

## 3. Boss progression — the headline finding 🔴 (high)

The curve does not ramp. Mean HP-cushion-on-win by boss (full deck pool), then confirmed against average/weak decks I re-simmed:

| Boss | Loop | Raw DPS | Behaviors | Cushion (all decks) | Avg/weak re-sim |
|---|---|---|---|---|---|
| doom_knight | 10 | 2.40 | enrage | **0.592** | (baseline, easy ✅) |
| iron_golem | 20 | 4.00 | shield +4/8s | 0.818 | avg 0.64 / weak 0.81 |
| lizard_king | 30 | 4.00 | enrage + multi_hit×2 | 0.822 | (1 loss in pool) |
| bog_witch | 40 | 3.04 | drain 15% + multi_hit×2 | **0.888** (softest) | 0.78–0.91 |
| desert_golem | 50 | 3.70 | shield +10/7s | 0.895 | — |
| infernal_dragon | 60 | 4.09 | **multi_hit×3** + enrage | 0.601 | avg-burn **dies 10/10** |
| boss_iron_golem | 70 | 4.80 | shield +12/7s + enrage | 0.805 | weak-warrior **0.03** |

**Diagnosis (verified):**
1. **`shield` and `drain` behaviors are near-inert.** iron_golem's +4 armor every 8s and bog_witch's drain (~1 HP per attack at 15% of ~7 damage) are trivial against deck damage. They contribute almost nothing to threat.
2. **`multi_hit` is the only behavior that bites.** infernal_dragon (multi_hit×3) is the one deep boss with a real cushion (0.60) and it cleanly kills the avg-burn mage. lizard_king (multi_hit×2) is the only one with a loss in the main pool.
3. **Hero power outruns the boss curve.** Boss scaling adds only ~+5% effective per boss (`percentPerBossKill 0.10`, halved for bosses) while hero levels add STR/INT/VIT/maxHP and decks improve T2→T3 — so cushions *rise* with loop depth instead of falling.

**Recommendations (bosses are freely tuneable under the charter; do NOT touch doom_knight):**
- **bog_witch (boss4) is the worst offender** — buff first. Its drain is pointless; replace/augment with a real threat (raise `healPercent` substantially or convert to a `multi_hit`/damage-burst pattern) and/or raise HP+damage.
- **Replace or buff `shield`** on iron_golem / desert_golem / boss_iron_golem — make the shield amount scale with the fight (or pulse much larger), or swap for `multi_hit`, which is the proven-threatening behavior.
- **Steepen late scaling**: either raise `percentPerBossKill` or give bosses a per-rotation HP/damage bump so threat keeps pace with hero leveling. Target: average deck lands ~0.45–0.55 cushion, weakest realistic decks stay ≥0.6 win rate.
- **Re-validate against a broad deep-deck pool** (≥15 decks/boss spanning weak→strong) before committing exact numbers — deep bosses currently have thin samples.

## 4. Normal enemies — all beatable; one real anomaly

All 19 normals are won at win-rate 1.0. Difficulty (by HP cushion) is well-spread; hardest normal is **corpse_eater** (cushion 0.75, counter affinity adds retaliation), softest is **lost_lizard** (0.99). No normal is too hard.

**`mush` soft-lock (med):** 2 of 6 loop-2 decks *die* to mush — but it is **not** an HP outlier (122 HP is mid-pack; giant_spider has 144). The mechanism is **mush's earth affinity**: it sprouts armor (to a cap of 15) and drains 2 stamina/hit. A minimum-damage all-T1 starter deck's hits floor to 1 once mush hits 15 armor, so it can never out-race the chip damage + stamina starvation — one deck ground **215 cards to death**. This is a **floored-damage-vs-armor-sprout interaction** affecting brand-new starter decks against early earth-affinity enemies (mush, ancient_tree). Options: don't give armor-sprouting earth affinity to the *earliest* base normals, lower the normal armor-sprout cap, or ensure a player's literal starting deck has at least one pierce/armor-ignoring option.

**Affinity balance note:** counter (corpse_eater) is a clean damage increment and is the hardest-normal driver — fine. earth (mush) is the only affinity with a degenerate edge case (above). water (heal) / agility (speed) / fire (chip) / air (stun chance) are all well-behaved.

## 5. Archetype viability

**Weak / needs help:**
- **pure-burn mage (med→high):** loses doom_knight (the one first-boss loss) and is annihilated by multi_hit bosses (avg-burn dies 10/10 to infernal_dragon). Burn soft-caps at 8/tick and can't race high-HP bosses. Needs stronger detonators or a sustain splash. (Reproduces the prior known gap.)
- **detonator-control mage (med):** the burn-Supernova sub-line is fragile — loses lizard_king, thin vs infernal_dragon.
- **defensive/armor MAGE hybrids (med):** can clear normals but struggle to *close* tanky bosses (an armor-vengeance mage went 0/8 vs iron_golem) — low damage + no finisher.

**Strong / safe (mostly by design, flag only if oppressive):**
- **armor_finisher warrior:** wins bosses at **cushion 1.0** (takes zero damage) — intended C3 safety, but it trivializes incoming damage. Not oppressive (slow TTK, single finisher win-con), but worth watching.
- **defensive poison / heal-sustain mage:** clear bosses at 0.95–1.0 cushion — safe-but-slow, the intended race-losing identity.
- **bleed-rage & physical warrior:** healthy across the board (boss cushions 0.45–0.81).

## 6. Cards — tier charter & off-curve

### 6a. Tier charter violation 🔴 (high)
**T3 median OPS 15.33 < T2 median OPS 15.57.** T3's mean (23.3) and max (158) exceed T2, but the *typical* T3 is no better than the typical T2 — the charter ("T3 must out-ceiling T2") fails at the median. Concrete pure-element violations (fix by **buffing the T3**, never nerfing the T2, per C1):

| T3 card | OPS | T2 sibling | OPS | Fix direction |
|---|---|---|---|---|
| Tempest Cadence (air³) | 24.2 | Tailwind (air²) | 56.7 | <½ the T2 — major buff (cut CD / raise value) |
| Quench Lance (fire²·water) | 8.3 | Steam Surge (fire·water) | 19.2 | buff the burn-gain ceiling / cut CD |
| Supernova (fire³) | 28.6 | Pyre (fire²) | 36.4 | raise per-burn detonation or cut cost/CD |
| Tidesong Aura (water³) | 9.0 | Frostbind (water²) | 10.6 | minor — raise heal/utility ceiling |

### 6b. Genuinely off-curve-weak cards (rescue by cutting CD / cost — C1)
- **Razor Stance (t2-counter-counter, med):** weakest T2 attack — slower and lower-cushion than the Reckless Strike it competes with; also has a description bug (see §7).
- **Riposte (t1-counter, low):** a negative-value attack slot — slower and lower-cushion than basic Jab.
- **Quench Lance, Cinderlance, Thunderstrike Catalyst (med, unverified):** marquee detonators that lose to cheaper 1-mana detonators — dead STR front-halves / slow payoff.
- **Mend (t1-water, low):** 2.0s cooldown is the slowest of any T1 and out of step with the snappy-CD floor — cut to ~1.4s.

### 6c. NOT off-curve — do not "fix" (important to avoid mis-nerfs)
- **Firestorm, Gale Echo, Tidefoot Bloom** read peakOPS 0 but are **engine-effect cards** (burn-after-N-cards, slow amplifier, heal→poison engine) — OPS mis-measures them; they perform fine in real decks.
- **Heal/sustain & control & defense cards** (Misting Veil, Bloodtide Mend, Bedrock Snare, Dust Plague, all armor cards) are **intentionally low-OPS C3 race-losers** — not weak.
- **Cleaver's Tax** reads "stronger than its text" but that's the dead-CD-penalty *bug* (§7), not an off-curve-strong card.

## 7. Bugged & unclear cards (35 code-verified findings)

**High severity:**
- **Vengeful Pyre** — "Exhaust the next card in order" does **nothing** (`exhaust_next` never implemented), and "Double all [rage] gained" only doubles *direct* rage, not rage from triggers/ticks/Brace/low-HP. Two dead clauses on one card.

**Medium severity (selected):**
- **Cleaver's Tax** — its self-cooldown penalty ("delays 4 more seconds next time") is **never applied** (`overload_lockout_ms` is unread) → the card is silently stronger than its text (no downside).
- **Shield Bash** — "Deal damage equal to your [armor]" actually = armor × STR-mult + Rage − enemy defense; only literally true at STR 1 / 0 rage / 0 enemy def. Reword or add `pierce_armor` + bypass scaling.
- **Razor Stance** — "Vengeance: +4 seconds" actually arms a *second* concurrent bleed-on-hit aura (double bleed for 4s), not a duration extension.
- **Steaming Plague / Vein Splitter** — "If enemy has [poison]/[bleed]" bonus is a **self-satisfied gate** (the card applies the stack before the check, so the bonus always fires) → the conditional text is misleading.
- **Marsh Squall** — self-applied poison inflates removal but not detonation damage (snapshot-vs-current mismatch).
- **Crimson Regen Mantle / Standing Stone** — aura/triggered heals skip the universal +15%/pt SPI heal multiplier that direct heals get.
- **Dust Plague** — its stun-at-5-slow threshold never fires from its own slow ticks.
- **Phoenix Aura** — "if <50% HP gain 18 armor" is an edge-trigger that can misfire on an HP-crossing.

(20 more low-severity dead-effect / unclear-wording items are in `static-confirmed.json`.)

## 8. Data inconsistencies
- **`green_field` terrain references `slime`, `red_slime`, `earth_dragon`** which **do not exist in `enemies.json`** — if a green_field tile spawns, the enemy lookup fails. Either add these enemies or remove the green_field pool.
- **`t1-air` (Gust)** is **missing from the card catalog** (`build-card-catalog.mjs` groups) though it exists and is playable — catalog coverage gap.
- `stage-model.json` approxLevel labels were off by ~1 (cosmetic; fixed — runXP drives the sim, not the label).

## 9. Prioritized recommendations

1. **Fix the boss curve** (high): buff bog_witch first; replace/augment inert `shield`/`drain` with `multi_hit`-style threats; steepen late scaling so cushions fall with depth. Keep doom_knight as-is.
2. **Restore T3 > T2** (high): buff the violating T3s (Tempest Cadence, Quench Lance, Supernova, Tidesong) by cutting CD / raising ceiling — never nerf the T2.
3. **Fix the high/medium card bugs** (high/med): Vengeful Pyre dead clauses, Cleaver's Tax missing downside, the self-satisfied gates, Shield Bash & Razor Stance descriptions.
4. **Help pure-burn & defensive-mage close bosses** (med): stronger burn detonators; a damage finisher option for defensive mages.
5. **mush / early earth-affinity soft-lock** (med): adjust earliest-normal armor-sprout or guarantee starter pierce.
6. **Fix data inconsistencies** (low/med): green_field phantom enemies; add Gust to the catalog.

## 10. Artifacts
- Decks: `tests/audit/val/decks-full.json` (181) · Matchups: `matchups-full.json` (857) · Raw results: `results-full.json`
- Analysis: `tests/audit/val/analysis/{enemy-summary,archetype-summary,boss-report,card-appearance,tier-ops-perf,overview}.json`
- Findings: `analysis/{sim-findings-confirmed,sim-findings-all,static-confirmed,condition-audits}.json`
- Confound re-sim: `decks-deepboss-confound.json` → `res-confound.json`
- Tooling (reusable): `scripts/{build-validation-index,expand-validation-matchups,analyze-validation-results}.mjs`
