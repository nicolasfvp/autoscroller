# SIM-PROPOSAL-QUESTIONED — Moderator cross-examination of SIM-BALANCE-PROPOSAL-FINAL

Moderator pass over the 8 questioner clusters under `tests/audit/wf-q/*/`. Each
verdict below was re-checked against the raw `*-results.json` (not just the
questioner's prose). The job: confirm a real sim backs every verdict, flag any
verdict resting on no sim / a last-slot swap, resolve cross-cluster
disagreements, and produce a decision per proposal item.

---

## 0. The finding that reframes everything: the HARNESS BUG (confirmed in source)

The `q-magic-path` questioner found — and I independently confirmed in source —
that the simulator **starts every combat at BASE maxHP, not the runXP-leveled
maxHP.**

- `tests/audit/deck-battle-sim.test.ts:145-146` seeds `hero.currentHP = base.maxHP`
  (70 mage / 100 warrior). The comment "refreshed below after resolve" is **false** —
  there is no refresh between `makeRun` (line 239) and `createCombatState` (line 242).
- `src/systems/combat/CombatState.ts:228` clamps `heroHP = Math.min(currentHP, resolved.maxHP)`
  → `min(70, 121) = 70` for a runXP-520 mage.
- The **real game** does the opposite: `src/state/RunState.ts:338-339` creates the hero
  at `currentHP = stats.maxHP` (full *resolved* HP) and every gain (relics line 485,
  shop heals, level-ups) tops `currentHP` toward the resolved max.

**Therefore the in-game-faithful start condition is FULL leveled HP (mage 121 /
warrior 151), and every cushion/winRate number produced on the as-shipped harness
understates survival by ~40% of maxHP.** The proposal's headline §0 table — "mage
burn LOSS 0/8", "mage direct LOSS 0/5", warrior "razor 3.3%" — is an artifact of
this bug.

Corrected-HP evidence (`q-magic-path/elem-sweep-full-*.json`, `burn-survival-out.json`,
`hp-trim-full-out.json`, all with `startHP` 121/151 in the raw JSON):

| deck | proposal said (70-HP harness) | corrected (full HP) |
|---|---|---|
| warrior physical vs dk dmg9 | win 3.3% (razor) | **win 50.3%** |
| mage direct fire/air vs dk dmg9 | **LOSS 0/5** | **win 6/6, 34.7%** |
| mage burn+sustain hybrid vs dk dmg9 | LOSS | **win 6/6, 25.6%** |
| pure zero-sustain burn vs dk dmg9 | LOSS | **still LOSS** (deck-construction trap, not balance) |

**Consequence for moderation:** the *relative* verdicts inside each cluster still
hold (every cluster compared A vs B on the same harness, so the bug cancels), but
the *absolute severity* that motivated the boss-side nerfs (P0-1, the conditional
HP trim) is inflated. P0-1 changes from "mandatory rescue" to "optional cushion
polish." This is the central delta of the questioning.

---

## 1. SHIP NOW — verified HOLDS (real sim, in-game-faithful or bug-canceling A/B)

| Item | Decision | Cushion / evidence (file) |
|---|---|---|
| **P0-2 iron_golem** ratchet defang | **REVISE (route)** — see §2; the *need* holds, the *route* changes | iron-defang-results: baseline 0/6 (233/400) → affinity:null 6/6 (409, 11.3%) |
| **P1-2** Steam Surge Deal4→6, Spark +Deal2/cd1.2 (NOT Flame Dart) | **HOLDS** | p1-combined-fullhp: burn 246→283; burn-survival-out: hybrid 25.6%→36.4%. No oppression. |
| **P1-3** burn detonator cd-cuts/pierce (Cinderlance/Cinder Sprint/Venom/Tremor/Supernova) | **HOLDS as cushion buff** (NOT as pure-burn rescue) | burn-fix-probe-out + burn-survival-out: lifts hybrid 25.6%→36.4%; tick untouched (C5). |
| **P1-4** Quench Lance cd2.4→1.3, burn 2→4, gate 10→6 | **HOLDS (low confidence)** — not re-simmed this pass; rests on prior TO-3/PB-7 OPS 8.33<19.23 + C1/T3>T2. Plausible, ship-able. | not independently re-run; flagged honestly by questioner |
| **Stagnant Bulwark** cd2.4→1.6, aura poison 1→2 | **HOLDS** | defensive-bulwark: 4.0%→20.5%, parity with Bulwark Vow 21.9%. Clean flip. |
| **Stoneward Reprisal** cd2.4→1.6 | **HOLDS** | defensive-bulwark: 15.9%→24.5% (now >T2 21.9%). cd-cut alone sufficient. |
| **Tidesong Aura** cd2.4→1.8, heal 18→22 | **HOLDS (deprioritize)** — buff is harmless polish; the T3<T2 premise did NOT reproduce (Tidesong already ≥ Frostbind). | tidesong-aura: cur ties Frostbind 32.2%; prop 35.5%. No violation to fix. |
| **Aegis of Returning Wrath** rewrite (uncond Deal6 Pierce +1/4armor, cd2.0) | **HOLDS** | aegis: Brace clause dead (cur 329<filler 387); prop 399 dmg, keeps 47% HP. |
| **Stormrage** add 5-slow floor, cd2.0 | **HOLDS** (restores to filler parity; ceiling for a pure-control card per C3) | stormrage: werewolf 0.341→0.399 (=filler). Does not + cannot clear doom (P1 mage issue). |
| **Crimson Spiral** gate 8→5, cd2.4→1.8 | **HOLDS** (floor-12-Pierce is OPTIONAL, not load-bearing) | crimson-spiral: cur LOSS 0/6; gate5+cd1.8 (no floor) WINS 6/6 405/7.3%. |
| **Bloodlash Salvo** STR 4→6, hit→Pierce | **HOLDS (low severity)** — not a dead card (cur out-damages filler); buff is a survival/Pierce-vs-armor lift | bloodlash: cur 3.3% → prop 11.9%; faster ttk = Pierce working. |
| **Drowning Lance / Marsh Squall** poison-detonator rework | **HOLDS (mechanism = USER_DECISION, see §4)** — the trap is real, every "leave a ticking tail" variant flips 0/8→8/8; no over-correction | detonators2/3/4: lance cur 0/8 → rework 8/8 0.248; marsh cur 0.033 (thin WIN, not loss) → 0.174 |
| **Control CD cuts** Frostbind 2→1.4, Quake 2→1.4, Thunderstrike 2.4→2.0, Static Skirmish 1.8→1.6 | **HOLDS** | control-cd-decompose: pure-control alone (31600ms) beats converters alone (33000) vs doom; bundle stacks. C1/C3/C5 OK. |

---

## 2. SHIP WITH REVISED MAGNITUDE — verdict holds, value changes

| Item | Proposal value | REVISED value | Why (evidence) |
|---|---|---|---|
| **P0-2 iron_golem** | "affinity-off OR global EnemyAffinity gain6→3/cap60→24; shield +8→+4; HP 400→360" | **Route A only: iron_golem `affinity` "defense"→"attack"/null + shield `+8/8s`→`+4/8s`. KEEP baseHP 400 (HP is inert).** Reject Route B (global). | iron-defang: affinity:null 6/6 (11.3%), +shield4 17.3% (sits between lizard_king 14.3% & bog_witch 20.8% = monotone). route-b: global gain3/cap24 UNDER-corrects, still 0/6 (381-394/400). HP 360/380/400 all give identical 11.3% (bottleneck is armor, not HP wall). |
| **P0-3 Earthcleaver** | base14→Pierce, gate15→10, cd2.4→**2.0** | **base14→18 Pierce, gate15→10, cd2.4→1.8** | t3-beats-t2: as-proposed = **0/8 deaths (328 dmg)** while T2 Granite = 8/8 (6%) — *fails its own T3>T2 test*. earthcleaver-revise: only base18/cd1.8 = 8/8 (2.6%). At dmg7 as-proposed wins on 1.3% fumes vs Granite 17.9% (soft T3<T2-by-cushion). |
| **P1-1 elemMult** | 0.15→0.22, sold as "magic damage path / boss-clear lever" | **OPTIONAL: 0.22 holds as a C2-safe thematic INT buff; CUT the "boss-clear lever" rationale.** Production 0.15 is also fine. Never 0.26+ (breaks C2). | elem-sweep-full: fire/air mage WINS 6/6 at 34.7% at r0.15, 0.22, AND 0.26 — identical. The dial barely moves outcomes (magic dmg is flat + DEX-Flame-Dart dominated). The "INT3 must hit 1.55-1.60" premise was a 70-HP-harness artifact. C2 table: 0.22 safe at N3/4/5; 0.26 violates at all. |
| **Bogwrath** | ungate → uncond **4** poison, cd2.4→1.6 | **uncond 3 poison, cd2.4→1.6** | bogwrath-magnitude: poison4 = +33% over T2 (above +15-25% charter band); poison3 = +21% (in band), still beats + out-damages T2. |
| **Tidefoot Bloom** | remove exhaust, up-front **4** poison, cd2.2→1.6 | **remove exhaust, up-front 6 poison + per-heal tick 1→2, cd2.2→1.6** (the "D" variant) | tidefoot-magehome: proposed floor4 only reaches T1-Jab parity (185 dmg, 41% HP); floor6/perheal2 reaches Mend cushion (48%) at fastest ttk (12s) = a real T3. (Judge in mage+heal deck — it is mis-slotted as a warrior counter card.) |
| **Crimson Cascade** | cd2.4→2.0 + bleed3→4 + **remove self-bleed (credited as the fix)** | **Same bundle, but the load-bearing fix is the cd-cut, NOT self-bleed removal** | isolation-results: removing self-bleed alone (keep cd2.4) STILL loses 0/6; cd2.0+bleed4 (keep self-bleed) WINS 6/6. Ship the bundle; do not bank the rescue on self-bleed. |
| **Alchemic Drain** | cd2.4→1.6, poison3→4, Heal6 — framed as urgent T3<T2 flip | **Ship cd+poison as polish; DOWNGRADE urgency.** The "0/6 vs 6/6" was a survival-shell artifact. | alchemic-drain + drain-tidefoot-followup: in a bare shell both as-proposed AND current LOSE 0/6 (buff did not flip the boss); with shared armor ALL THREE win and current Drain already out-damages Mire (399>387). |
| **depths_horror HP** | 95→**150** | **95→130** (scaled 149, just under werewolf 155). Optional small dmg 5→6/7 if "non-trivial" must include threat. | enemy-hp: base150 scales (×1.15) to 172 > werewolf 155 = over-correct (proposal conflated base vs scaled). base130 lands burn-mage ttk in the werewolf band. |
| **fire_elemental HP** | 102→**150** | **102→130** (scaled 149). dmg9 already a fair threat — no dmg change. | enemy-hp: same base-vs-scaled over-correction; base130 reaches werewolf-burn band. |

---

## 3. DROPPED / UNJUSTIFIED — no sim backs it, or the premise didn't reproduce

| Item | Disposition | Why |
|---|---|---|
| **P0-1 doom_knight dmg 9→7** | **DOWNGRADE to OPTIONAL cushion polish (was "ship-first, high impact").** Not CUT, but no longer load-bearing. | The "razor 3.3% / mage loses" severity that justified it is the harness bug. At full HP warrior-phys = 50.3% and mages WIN at dmg9. The dmg7 *relative* effect is real (floor 3.3→13.9% on the buggy harness, monotone, no over-correction, no trivial-boss stacking — q-boss-doom verified) but it is solving a problem the bug invented. **→ USER_DECISION** whether the first boss should be ~14% (buggy-harness floor at dmg7) / 50%+ (real-HP) easy. Keep HP 380, def 3, enrage 1.4 regardless. |
| **Conditional doom_knight HP trim 380→350** | **CUT** | hp-trim-full-out: it is simultaneously UNNECESSARY (viable mages win at 380/dmg9) and INSUFFICIENT (pure-burn still 0/6 at HP320/dmg7, 303 dmg). Pure verified dead end. |
| **P0-4 "Mountain's Will alone flips warrior 0/8→8/8"** | **CUT the single-swap claim** (the card buff itself HOLDS — see below) | mw-slot-sensitivity: buffed MW in slots 3/5/7 = 0/8 deaths (365 dmg); wins ONLY in slot1. The "single weakest-link fix" framing is a fixed-order artifact. The 4×MW A/B (8/8 2.6%) IS a valid card-level buff and ships. |
| **P1-3 chasing a pure zero-sustain burn boss win** | **CUT (accept as non-viable build)** | burn-fix-probe-out: kitchen-sink (heavy detonators + dmg7 + HP350) caps at 342 < 350, still 0/6. Endless detonator coefficient inflation cannot fix a no-sustain deck. |
| **Razor Stance "loses 0/6 where Jab wins"** | **Premise DROPPED; buff downgraded to LOW-severity polish** (still ship-able) | razor-stance: current OUT-damages filler (405>387) and wins 6/6. Only thin at HP440 stress (2.0%). Not the "T1 beats T2" emergency claimed. |
| **Wrath Squall "NEGATIVE marginal value, worse than a Jab"** | **Premise DROPPED; buff downgraded to LOW-severity polish** (ship-able, C5-safe) | wrath-squall: current out-damages filler (425>387), wins 6/6. Rage cap 12 honored (CardResolver.ts:419). |
| **MS-6 earth-control mage closer** | **Stays DEFERRED** (correct in proposal) | downstream of P1 mage scaling; no new evidence. |

---

## 4. GENUINE USER DECISIONS (crisp either/or)

1. **doom_knight damage — keep 9 or cut to 7?** *(reframed by the harness bug)*
   Now that real-HP sims show the first boss is already beatable (warrior 50%, mages
   win at dmg9), this is a pure difficulty-feel call, not a viability fix.
   - **KEEP 9:** first boss stays a genuine check (warrior real-HP ~50% cushion;
     bug-harness floor 3.3%). Race/burn-light decks finish on fumes.
   - **CUT to 7:** more forgiving "easy first boss" (bug-harness floor → 13.9%;
     verified no over-correction, no trivial-boss stacking with the card buffs).
   Recommendation: lean KEEP 9 (or revisit only after the harness is fixed and the
   full curve re-baselined); HP 380 / def 3 / enrage 1.4 unchanged either way.

2. **Poison-detonator mechanism (Drowning Lance / Marsh Squall):**
   - **(A) consume-HALF + higher coeff** — on-theme "burst AND keep ramping"
     (~0.25 doom / ~0.33 iron). **Requires a NEW CardResolver feature**
     (`consume Math.ceil(pool/2)` + scale per-stack by the consumed half). The
     proposal's "C4 wiring fix, JSON-only" label understates the engine work.
   - **(B) keep consume-ALL, raise burst** (Lance per-stack 3→5, base 4→6, cd1.8) —
     pure JSON, snappier one-shot then re-ramp (~0.28 doom / ~0.33 iron, fastest ttk).
   Both clear the trap, neither over-corrects (detonators3/4). Pick identity vs cost.

3. **iron_golem theme:** drop the defense-affinity ratchet entirely
   (`affinity:"attack"` + shield trim — clean, reliable, recommended) **vs** keep a
   bespoke tamer per-enemy ratchet (sim shows it still under-corrects unless
   gain≤2/cap≤24 *and* HP/shield also trimmed). Data favors dropping it.

4. **Pure zero-sustain burn at boss1:** accept as a non-viable degenerate build that
   needs a sustain splash (recommended — realistic burn decks already win) **vs**
   author a dedicated burn survival/ramp tool. The HP trim is NOT a valid option here.

5. **lost_lizard:** keep dmg 2 (zero-threat tutorial) **vs** bump dmg 2→5 (gentle
   real check). New-player-experience call, no balance evidence either way.

6. **Crimson Spiral floor-12-Pierce:** ship it (never dead-draws below a Jab in
   rage-starved decks) **vs** omit (gate5+cd1.8 alone already wins 6/6). Mild
   double-buff, neither oppressive.

---

## 5. Items whose verdict HOLDS but I am flagging for honesty

- **P1-4 Quench Lance** — verdict "holds" but the magic-path questioner did NOT
  re-sim it this pass (out of the boss-survival critical path); it rests on prior
  TO-3/PB-7 OPS numbers + the C1/T3>T2 charter. Ship-able but unverified-this-round.
- **Marsh Squall AoE** — every detonator sim is single-target. The per-stack buff
  cannot be valued until a multi-enemy probe runs (gate #5 still open).
- **Bloodlash / Razor / Wrath Squall** dead-card claims were shell-artifacts; the
  buffs are fine but LOW priority — sequence Cascade & Crimson Spiral (true
  LOSS-where-filler-wins) ahead of them.

---

## 6. Cross-cluster interaction check (the question the moderator was asked)

**Does P0-1 (dmg7) stack with the P1/P2 card buffs into a trivial boss?** — **NO,
verified.** (q-boss-doom stacking2/stacking3, raw JSON re-read):
- Buffed-burn deck + P1-3 detonators + dmg7 = **still dies 8/8** (232 dmg < 380).
- Warrior with buffed-Pierce Mountain's Will swapped in at dmg7 = **0.079 HP**, *lower*
  than the unmodified deck's 0.139 (the 2-mana armor-gated T3 lowers throughput).
- EC+MW both buffed early = 0.7% HP = identical to MW-alone (no cushion inflation;
  enrage burst caps survivability, not damage output).
The two fixes target disjoint problems (boss-curve vs card-economy) and do not
compound. The over-correction worry (critic B3) is unfounded for this pair.
**Caveat:** all of the above is on the buggy harness; at real HP the headroom is even
larger, which only *strengthens* "no trivialization" while *weakening* the case that
any boss nerf was needed at all.

---

## 7. What the questioning changed vs the FINAL proposal (delta)

1. **A harness bug invalidates the proposal's headline.** Combat starts at base HP,
   not leveled HP (confirmed in source). At correct HP, mages WIN the first boss and
   warriors win at ~50% cushion. The "first boss is unbeatable for half the field"
   framing is an artifact.
2. **P0-1 (dmg 9→7) demoted** from ship-first/high-impact to optional/USER_DECISION;
   the **conditional HP trim 380→350 is CUT** (unnecessary AND insufficient).
3. **P1 reframed** from "make mages able to clear the boss" (false premise) to
   "modest QoL buffs to under-used fire cards." **P1-1 elemMult is a near-no-op** on
   outcomes — keep it only as a C2-safe thematic buff (0.22 max), not a boss lever.
4. **P0-3 Earthcleaver as-written FAILS its own T3>T2 test** (0/8 vs Granite 8/8) —
   revised to base18/cd1.8.
5. **P0-4's "single-swap flips the boss" is a fixed-order artifact** (MW only wins in
   slot1); the card-level buff itself is valid.
6. **Several "dead card" / "T3<T2" emergencies were shell artifacts** (Razor Stance,
   Wrath Squall, Alchemic Drain, Tidesong, Bloodlash) — buffs mostly still ship but
   as low-priority polish, not viability fixes.
7. **Two fix mis-attributions corrected:** Crimson Cascade (cd, not self-bleed) and
   the poison detonators (the lever is "leave a ticking tail," which needs new engine
   code for option A).
8. **iron_golem route settled by data:** Route A (per-enemy affinity flip + shield
   trim), NOT Route B (global ratchet nerf, which under-corrects).
9. **Enemy-HP bumps over-corrected** (base-vs-scaled conflation): 150→130 for both
   depths_horror and fire_elemental.
10. **No trivial-boss stacking** between P0-1 and the card buffs (verified) — and this
    holds a fortiori at correct HP.

**Top recommendation to the user: fix the harness HP-seeding bug
(`deck-battle-sim.test.ts` — set `currentHP = resolveHeroStats(run).maxHP` before
`createCombatState`) and re-run the acceptance gates before locking ANY boss-side
change. Card-side buffs in §1/§2 are safe to ship now; boss-side changes (P0-1, HP
trim) should wait for the re-baseline.**

---

## 8. LEAD VERIFICATION (harness FIXED, fresh canonical re-baseline)

The HP-seeding bug is now **fixed** in `deck-battle-sim.test.ts` (heroes enter at full
*resolved* maxHP via a high `current*` sentinel that clamps to the resolved maxes).
Fresh canonical numbers on the fixed harness (8 reps; `boss-prog-fixed.json`,
`verify-boss-levers-fixed.json`, `verify-earthcleaver-results.json`) — these CONFIRM
the moderator's reframe:

**doom_knight (first boss), all archetypes, full HP, damage 9 (unchanged):**
| archetype | result | cushion |
|---|---|---|
| warrior physical | WIN | 37.1% |
| warrior bleed/rage | WIN | 38.4% |
| warrior armor-bruiser | WIN | 60.9% |
| mage poison | WIN | 47.1% |
| mage poison-block | WIN | 71.1% |
| **mage burn** | **LOSS 5/5** | 329 dmg < 380 |
| **mage control** | **LOSS 5/5** | 379 dmg — agonizingly short |

→ **6/8 archetypes beat the first boss at 37–71% cushion. doom_knight is correctly
tuned — do NOT nerf it (P0-1 CONFIRMED unnecessary; HP trim CONFIRMED CUT).** The two
failures are genuine card-economy gaps, not boss tuning: **pure-burn** (DoT tops ~329–350
< 380 even at full HP / HP320) and **pure-control** (379, a hair short → the slow→damage
converters in §1 control row are the lever, not boss/HP).

**Earthcleaver tier A/B re-checked at full HP (4× in an identical deck vs doom_knight):**
Granite Lunge T2 = 58.9% cushion / ttk 22.5s; current Earthcleaver T3 = **9.9%** / 23.3s;
as-proposed (pierce+cd2.0+gate10) = 18.5% / 21.0s; revised (base18+pierce+cd1.8+gate10)
= **27.2% / 18.5s**. → The tier violation is **real and more stubborn than the buggy
harness implied**: even revised, Earthcleaver trails Granite on *cushion* (though it
kills *faster*, 18.5s < 22.5s). NUANCE: cushion conflates damage with Granite's armor-
gain (survival); by kill-speed the revised T3 wins. Recommendation: judge T3>T2 on a
blended kill-speed+cushion basis, and if strict cushion-parity is required, Earthcleaver
needs a larger buff than base18 (or accept faster-kill as the T3's edge). Re-validate any
further bump on the fixed harness.

---

## 9. IMPLEMENTED (user decisions 1–4, on the fixed harness)

User resolved the four genuine decisions; these are now shipped + verified. All
207 cards/combat tests pass; card-integrity (stored desc == formatter) green.

1. **doom_knight damage 9 → 6** (`enemies.json`). User chose 6 (forgiving "easy
   first boss"). Verified all 8 archetypes now win: warrior physical 53%, armor 91%,
   mage poison 70–82%, control 24%, burn 1.7% (squeaks). HP 380 / def 3 / enrage 1.4
   unchanged.
2. **Poison detonators → consume-HALF + ramp tail** (decision: option A). New engine
   feature `consume_fraction` on `CardEffect` (CardResolver: damage scales by
   `ceil(snapshot*frac)`, removal takes `ceil(current*frac)`); CardText renders it as
   "Consume half [X]"; descriptions regenerated. Cards:
   - **Drowning Lance** `t3-attack-water-water`: base 4→6 Pierce, per-stack 3→5 Pierce,
     consume_fraction 0.5, cd 2.4→1.8. Verified: was 0/5 deaths → now wins, deals 468 vs
     the plain deck's 380 (contributes, no over-correction).
   - **Marsh Squall** `t3-air-earth-water`: per-stack 4→6, consume_fraction 0.5, cost
     2s+2m→2s, cd 2.4→2.0 (exhaust kept).
3. **Pure zero-sustain burn → accepted as non-viable** (no code; realistic burn+sustain
   is fine, and the dmg6 boss now lets even pure-burn squeak a first-boss win).
4. **iron_golem → drop the defense ratchet** (`enemies.json`): `affinity` "defense"→
   "attack", shield 8→4, HP 400 kept. Verified: strong physical 0/5 LOSS → 57.7% win;
   curve now monotone (iron 57.7% ≈ lizard_king 54.8% < bog_witch 61.3%).

Files: `src/data/json/enemies.json`, `src/data/json/cards.json`,
`src/systems/combat/CardResolver.ts`, `src/systems/cards/CardText.ts`,
`src/data/types.ts`. (Pre-existing unrelated `validate-data` warning: green_field
terrain not in tiles.json — not touched here.)

## 10. IMPLEMENTED — card-side batch (verified, 746 tests pass)

Applied via `scripts/apply-sim-balance-batch.mjs` (+ description regen). All buff the
card; no T2 nerfs. Verified: Earthcleaver T3 cushion 9.9%→43% and now kills FASTER than
Granite T2 (18.5s<22.5s; cushion trails only because Granite gains armor — different
roles); control deck now closes doom_knight (21.5%); no over-correction (Earthcleaver
clears a normal in 9.7s, not trivial).

- **Aegis of Returning Wrath** `t3-defense-defense-defense`: dead on_armor_break payoff →
  unconditional "Deal 6 Pierce, +1 per 4[armor]"; cd 2.4→2.0.
- **Stagnant Bulwark** `t3-defense-defense-water`: aura poison 1→2 per 2s; cd 2.4→1.6.
- **Stoneward Reprisal** `t3-defense-defense-earth`: cd 2.4→1.6.
- **Earthcleaver** `t3-attack-defense-earth`: base 14→18 + Pierce; armor gate 15→10; cd 2.4→1.8.
- **Crimson Spiral** `t3-counter-counter-counter`: rage gate 8→5; cd 2.4→1.8 (no floor).
- **Control CD-cuts** (pure control, no damage added): Frostbind 2→1.4, Quake 2→1.4,
  Thunderstrike Catalyst 2.4→2.0, Static Skirmish 1.8→1.6.
- **Steam Surge** `t2-fire-water`: base Deal 4→6. **Spark** `t1-fire`: +Deal 2, cd 1.4→1.2.

Deliberately NOT applied (per decisions / questioning): elemMult rate (near-no-op, left
0.15); burn detonator coefficient buffs (burn accepted as-is); the low-sev "polish"
whose weak-premise didn't reproduce (Razor Stance, Wrath Squall, Bloodlash); Tidesong/
Bogwrath/Tidefoot Bloom/Alchemic Drain/Quench Lance (queued, low priority); enemy-HP
bumps depths_horror/fire_elemental→130; lost_lizard. Available on request.

Pre-existing unrelated test issues (NOT from this work): `validate-data` green_field
terrain; `StyleConstants.test.ts` expects font "Inter" (repo migrated to VT323).
