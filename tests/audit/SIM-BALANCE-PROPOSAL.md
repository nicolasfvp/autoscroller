# SIM-BALANCE-PROPOSAL — synthesized, C1–C5-compliant change set

Synthesis of 12 lanes (designer + adversary each). **Only adversary-CONFIRMED or
-REVISED findings are actioned; DECLINED findings are excluded** (and listed at the
end so they are not silently re-introduced). Every change cites its supporting
lane(s) and the simulated evidence. All card moves obey C1 (cost is the power
lever, CD floor ~1.2s), C2 (never remove STR mult, buff INT/DEX/SPI to compete),
C3 (no armor/heal→damage outside the one finisher line), C4 (wiring → curve →
dead-card reworks), C5 (status verbs are LOCKED — no DoT-formula edits), and the
T3>T2 charter (fix violations by BUFFING the T3, never nerfing the T2).

Grounded facts re-verified in source this pass:
- `doom_knight` (enemies.json): 380 HP / def 3 / 9 dmg / cd 2500ms, enrage 1.4× atk
  speed at 50% HP. The enrage block is real; **softening it is proven INERT** in two
  independent lanes (enemy-ramp adv, boss-progression `probe-war-enrage125`).
- `iron_golem` (enemies.json): baseHP **400** (≈409 after the late ×1.05 mult),
  def 4, shield behavior +8 armor / 8000ms, **`affinity: "defense"`**. Per
  `EnemyAffinity.ts` the defense affinity grants `3*m` armor per attack (m=2 for
  bosses → **+6 armor every swing**, cap 60) — a runaway ratchet on top of the
  shield. This is the verified driver of the iron_golem spike, NOT baseDefense.

---

## 0. Executive summary

The single biggest realism failure is the **first boss, doom_knight, which is NOT
"easy."** Eight lanes independently put realistic loop-10 decks at razor-thin wins
or outright losses against it. Two distinct root causes are now separated by the
adversaries:

1. **A boss-curve problem** for clean attackers and DoT-race decks (warrior physical
   wins at ~3–4% HP; clean decks lose outright in OCS-8). Fixable on the *enemy*
   side: **cut doom_knight damage 9→7** (lifts warrior 4%→~15%, sim-verified in two
   lanes) — and optionally a small HP trim (380→350) if a comfier band is wanted.
   Do **not** touch the enrage (inert) and do **not** touch HP/damage hoping to
   rescue mage/burn (proven not to help).

2. **A card-economy problem** for the magic damage path: direct-damage mages and
   pure-burn **cannot output 380 before dying regardless of boss stats** (mage-elem
   still 0/6 at doom_knight dmg7 AND at 320 HP). This is a scaling + dead-card issue:
   raise the magic per-point multiplier (C2), buff the burn detonator T3s (C1), and
   rescue dead T3s.

The second structural problem is **`iron_golem` being harder than the two bosses
after it** (non-monotonic curve), driven by its defense-affinity armor ratchet, not
its printed defense. Fix the affinity/shield, not baseDefense.

The third theme is a **dense cluster of T3>T2 violations and dead T3s** — confirmed
across armor (Aegis), poison (Alchemic Drain, Stagnant Bulwark, Stoneward Reprisal,
the poison detonators), burn (Quench Lance, Cinderlance, Venom Detonation), physical
(Earthcleaver vs Granite Lunge, Mountain's Will), bleed/rage (Crimson Cascade), and
control (Stormrage). Every fix below buffs the T3.

A recurring **methodology hazard** (raised by 3 adversaries — hybrid-combos ADV-1,
bleed-rage, off-curve note): the engine plays the deck in **fixed array order, no
shuffle** (`CombatState` deckOrder). Swap-test cards placed in late slots are never
drawn, producing false "zero marginal value" ties. Findings whose ONLY evidence was
a last-slot swap were down-weighted or dropped here; BANK-shell, front-loaded, and
clean tier-A/B evidence was preferred.

---

## 1. Enemy / boss progression

### 1.1 doom_knight — cut attack damage 9 → 7 (HIGH)
Lanes: enemy-ramp **ER-1 (revised)**, boss-progression **BP-1 (confirmed)**,
off-curve-sweep **OCS-8 (revised)**, mage-scaling **MS-1 (confirmed)**,
physical-attack **PA-1 (revised)**, pure-burn **PB-1**, pure-poison **PP-2 (revised)**,
hybrid-combos **HC-7 (confirmed)**.

Evidence: warrior physical 5/5 @ **3.3% HP**; with dmg7 → **13.9–15.2% HP**
(BP-1 13.9%, ER-1 adv re-test 15.2%, both independent). dmg8 → ~7–9% (gentler).
Enrage 1.4→1.25 is **inert** (4.0%→4.0%, two lanes). HP380→340 reached ~21.5%
(boss-progression `probe-poison-hp340`).

**Contradiction flagged & resolved:** lanes split on the lever. ER-1/BP-1 →
damage 9→7 (verified). OCS-8 → HP 380→350. PA-1/MS-1/HC-7 → "do not touch the
boss, fix cards." Resolution: the **damage cut is the cleanest verified lever** and
is the only one with a measured cushion improvement that doesn't shorten the fight;
adopt **dmg 9→7** (keep 380 HP / def 3 / enrage 1.4 as-is). It does NOT trivialize
(race decks still finish ~14–22%) and does NOT rescue burn/mage (those are §2/§3).
A small HP trim (380→350) is held as a **conditional** second step only if, after
the §2/§3 card buffs land, clean/DoT decks are still below ~0.8 winRate at a real
cushion — re-sim before applying.

### 1.2 iron_golem — defang the defense-affinity armor ratchet (HIGH)
Lane: boss-progression **BP-4 (REVISED — observation confirmed, designer's fix
refuted)**.

Evidence: the late strong-physical deck **LOSES iron_golem (0/5, ~233 dmg)** but
**WINS lizard_king (5/5, 14.3% HP) and bog_witch (5/5, 20.8%)** — both later, both
nominally "harder." The adversary actually *ran* the designer's proposed override
and it **failed**: baseDefense 4→3 still 0/5 (@243); def3+dmg9 0/5; shield removed
0/5; HP360 0/5 (@233); dmg8 0/5; even HP360+dmg8 (lighter than lizard_king, which the
deck beats) **still 0/5**. The deck deals ~394 to lizard_king but only ~250–285 to a
same-or-weaker iron_golem. Code confirms the cause: `affinity:"defense"` →
`EnemyAffinity.ts` +6 armor/attack (cap 60) + shield +8/8s starves per-hit output
past the kill window.

**Change:** (a) change iron_golem `affinity` from `"defense"` to a non-armor-stacking
identity (`"attack"` or `"earth"`), **OR** in `EnemyAffinity.ts` cut the boss
defense-affinity ratchet (gain `3*m=6` → `3`, and/or cap 60 → ~24); AND (b) soften
the shield behavior (`shieldAmount` 8 → 4) and/or trim baseHP 400 → ~360. baseDefense
4→3 alone is empirically useless — do not rely on it. Re-sim late-physical vs
iron_golem / lizard_king / bog_witch to confirm a **monotone** curve. With §1.1's
doom_knight at dmg7, keep iron_golem damage at 8–9 so the ramp is monotone
(doom_knight 7 < iron_golem 8–9 < later).
**Follow-up lane suggested:** desert_golem and boss_iron_golem also armor-stack —
likely the same spike (boss_iron_golem is `affinity` tank with def 4).

### 1.3 Normal-enemy ramp extremes (MED / LOW)
Lane: enemy-ramp **ER-4 (confirmed)**, **ER-3 (revised)**, **ER-7 (confirmed)**.
- **ER-4 (MED):** late battery is trivially soft (full-T3 decks kill depths_horror /
  fire_elemental in 4–6s; swap identity doesn't matter). Raise **depths_horror
  baseHP 95→150** and **fire_elemental baseHP 102→150** (~172 post-1.15×, comparable
  to werewolf 155 / salamander 184). Leave their damage (5/8). Adv re-test: 54% /
  44.6% HP, ttk ~7.2–7.45s — soft but no longer trivial.
- **ER-3 (revised, LOW):** lost_lizard is a pushover but the proposed buff
  under-corrects (adv: 83.8%→82.1% HP). EITHER accept it as an intentional gentle
  intro and **drop the buff**, or buff *harder* to register (damage 2→5, cd
  3500→2800; HP is irrelevant to the cushion). Low priority either way.
- **ER-7:** keep mutated_salamander (160→184 HP) as the difficulty anchor; the middle
  of the curve is healthy — no change.

---

## 2. Magic damage path (mage scaling + burn economy)

These are the **card-economy** half of the doom_knight failure: boss tuning does not
fix them (mage-elem 0/6 even at dmg7 / 320 HP).

### 2.1 Raise the magic per-point multiplier (HIGH, C2)
Lane: mage-scaling **MS-2 (REVISED)**, supported by **MS-1 (confirmed)**, enemy-ramp
ER-2 (revised).

Evidence: at realistic boss1 INT 3, elemMult = 1.30 → fire/air/earth mages 0/5–0/6 vs
doom_knight. +INT to elemMult **1.60 → wr 1.0** (dmg 382); 1.45 still **loses**.
+STR3 also flips it (dmg 401) — confirming the axis, not deck quality, is the cause.

**Change:** raise the magic multiplier from **0.15/pt to ~0.26/pt**
(`elemMult = 1 + (elemStat-1)*0.26`). Boss1 INT3 → 1.52, late INT4 → 1.78 — still
**strictly below** the same-level strMult (1.75 / 2.0), so STR stays king (C2). The
adversary's caution: 0.22/pt only reaches 1.44 (below the 1.45 that still LOST), so
0.22 under-corrects — use ~0.26 and **combine with §2.2** to clear the line. Re-sim
fire/air mage to confirm wr ≥ 0.8 before locking the constant. Never touch STR.

### 2.2 Flat-value lift on cheap INT staples (MED, C2/C5)
Lane: mage-scaling **MS-3 (REVISED)**, **MS-5 (confirmed)**.

doom_knight def 3 eats ~half of every small mage hit (Deal-4 × 1.30 = 5.2 − 3 ≈ 2
landed). **Change:** `t2-fire-water` **Steam Surge** base Deal 4 → 6; `t1-fire`
**Spark** add a token **Deal 2** alongside its 3 burn and cut cd 1.4→1.2 (snappy).
**DROPPED** (per adv): the designer's Flame Dart Deal5→6 buff — Flame Dart is already
top-OPS (57.5), DEX-scaled (off the low-INT thesis), and would out-DPS its own T3
Boilstep (a new T3>T2 violation). Do not touch Flame Dart.

### 2.3 Burn detonator T3s — the burn boss win-condition (HIGH/MED, C1/C5)
Lanes: pure-burn **PB-2/PB-3/PB-4 (confirmed)**, **PB-5 (anchor)**, **PB-6 (revised)**,
boss-progression **BP-2/BP-5 (confirmed)**, hybrid-combos **HC-1 (revised)**,
enemy-ramp **ER-5 (confirmed)**.

Confirmed inversion: pure-tick burn **WINS** doom_knight (6/6, 384 dmg) while
bank-and-detonate **DIES** (6/6, 222) — detonating dumps one armor-taxed chunk and
resets the pool right as the boss enrages. In an identical 9-banker shell only
**Cinder Sprint (380, win)** and **Supernova (439, win)** clear; **Cinderlance (359,
LOSS)**, **Venom Detonation (327, LOSS)**, T2 Pyre (374, LOSS) all fail.
**Supernova is the calibration anchor — do NOT nerf** (PB-5: exhaust one-shot, not
oppressive).

**Changes (all BUFF the T3, costs held unless noted):**
- `t3-attack-fire-fire` **Cinderlance** — cd 2.2 → 1.8 (C1 snappy) AND detonation
  **3 → 4 Pierce per [burn]** consumed. (PB-4 confirmed; ER-5 confirmed; cost 1s+1m.)
- `t3-counter-fire-water` **Venom Detonation** — coefficient **2 → 4 per [burn]** and
  make it **Pierce**; additionally make it consume **BOTH** pools (it already applies
  2 burn + 3 poison) so it rewards the dual-DoT identity it's named for: "Consume all
  [burn] AND all [poison]; deal per stack consumed." (PB-3 confirmed + HC-4 revised
  wiring; cost/cd 1s+1m / 2.4s held.)
- `t3-agility-fire-fire` **Cinder Sprint** — det payoff **4 → 5 per [burn]** (ER-5)
  and add **Pierce** to the per-stack (PB-6 keyword-consistency). NOTE PB-6's "Pierce
  is decisive" rationale was **revised down**: Cinder Sprint *already wins while
  non-Pierce*, so Pierce is a secondary armor-tax saver layered on the primary
  coefficient/CD buffs — not the load-bearing fix.
- `t3-attack-fire-fire`/`Supernova` (`t3-fire-fire-fire`): **no nerf**, anchor only.

**Caveat (adv, pure-burn):** the detonator "wins" hold only in the artificial
9-banker shell; a realistic 12-card deck with the same wincons still topped out at
**353 dmg < 380 HP**. So §2.3 may slightly under-correct at the realistic profile —
**re-sim a realistic 12-card detonate deck after applying these together** and only
then judge whether a further C1 cost cut on the burn appliers is needed.

**HARD CONSTRAINT — DECLINED:** hybrid-combos **HC-6** proposed editing the burn
soft-cap knee 8→12 / slope /2→/1.5. The adversary DECLINED it: that is the
**C5-LOCKED** formula. **Do not change the burn DoT curve.** Burn boss throughput is
addressed via the detonators above, never the tick.

### 2.4 Quench Lance — dead burn banker / T3<T2 (HIGH, two lanes agree)
Lanes: tier-ordering **TO-3 (CONFIRMED — outright T3 loss)**, pure-burn **PB-7
(confirmed)**.

`t3-fire-fire-water` Quench Lance vs `t2-fire-water` Steam Surge in identical
harnesses: the **T3 LOSES fights the T2 WINS** — fire_elemental T3 0/4 vs T2 1/4;
mutated_salamander T3 0/6 deaths vs T2 1/6 (ttk 21900). Late swap: QL avgTTK 13975 /
HP 0.323 vs Flame-Dart baseline 11869 / 0.348 — slower AND squishier than a T2.
Cause: "Apply 2[burn]; conditional +2 INT if consume 10+ burn" rarely fires.

**Change:** cut cd **2.4 → 1.3** (adv correction: Steam Surge's real cd is **1.3**,
not 1.4) and raise base **2[burn] → 4[burn]**; optionally lower the INT-gain
threshold 10 → 6 consumed. Cost 1s+1m held. Never nerf Steam Surge.

---

## 3. Physical attack — boss-pierce finisher line

Pure-physical clears every normal battery (40–83% HP) but hits a boss wall: def 3
(doom_knight) and the def4+armor-ratchet (iron_golem) tax every non-Pierce hit.

### 3.1 Earthcleaver vs Granite Lunge — T3<T2 (HIGH, the strongest tier violation)
Lane: physical-attack **PA-7 (CONFIRMED, 8 reps)**.

Identical 12-card deck, 4× T2 Granite Lunge vs 4× T3 Earthcleaver vs doom_knight:
**T2 WINS 8/8** (ttk 19100, 6% HP, 380 dmg); **T3 LOSES 0/8** (316 dmg). Cause:
Granite Lunge cost 1s / cd 1.4s plays far more often; Earthcleaver cost 2s / cd 2.4s
with +8 Pierce gated behind armor ≥15 a pure-attack deck never reaches, so only its
non-pierce 14 lands into def 3.

**Change (BUFF T3):** `t3-attack-defense-earth` **Earthcleaver** — cd 2.4 → 2.0,
lower armor gate **15 → 10**, and make the base **14 a Pierce hit**. Granite Lunge
(T2) untouched.

### 3.2 Mountain's Will — weak T3, sufficient single fix for the boss (MED→HIGH)
Lanes: physical-attack **PA-4 (confirmed)**, **PA-1 (revised — this is the weakest
link)**.

swap vs doom_knight: Mountain's Will 0/4 (366 dmg, dies) while cheaper T3s win
(Cleaver's Tax, Quickstep Sigil 1.0 @ 25.8% HP). Its base 20 is **non-Pierce**
(taxed by def 3) and armor-gated +8 rarely fires for a pure-attack deck. The
adversary showed that swapping **just this card** for a pierce T3 turns the realistic
balanced deck from 0/8 to **8/8** — so this single fix is largely sufficient.

**Change:** `t3-attack-earth-earth` **Mountain's Will** — cd 2.4 → 2.0 and make the
base **20 a Pierce hit**. Cost 2s held. **Scope guard (PA-1 revised):** apply this
first and re-sim; do NOT also Pierce-ify Concussive Smash + Earthcleaver bases in the
same pass beyond §3.1 — one pierce T3 already lifts the deck. Avoid over-correction.

### 3.3 Bloodlash Salvo — slow-ramp T3 (MED, C2)
Lane: physical-attack **PA-5 (confirmed)**.

swap vs doom_knight 0/4 (348, loss) while Berserker's Ledger 1.0 @ 13.2%. "Deal 9 +
gain 4 STR this combat" ramps too slowly in the ~14s enrage window and the 9 base is
def-taxed. **Change:** `t3-attack-attack-counter` Bloodlash Salvo — in-combat STR
gain **4 → 6** and make the hit **Pierce**. Cost 2s / cd 1.8s held.

### 3.4 iron_golem pierce path for pure-attack (HIGH, pairs with §1.2)
Lane: physical-attack **PA-2 (confirmed)**.

Every physical build loses iron_golem 0/4–0/6 (the T2 Granite A/B stalls at 43 cards
played). The shield-regen +8/8s on def 4 makes a non-pierce race unwinnable.
**Change:** ensure an armor-gate-free pierce finisher is reachable —
`t3-air-attack-earth` **Cliffwind Maul** lower armor gate **12 → 8**;
`t3-attack-counter-earth` **Granitewrath** cd 2.4 → 2.0 (its Vengeance pierce fires
more often). Re-sim with §1.2 applied (the affinity fix is the dominant lever; these
give the deck a pierce answer once the ratchet is tamed).

### 3.5 Quickstrike — optional economy re-price (LOW, downgraded by adv)
Lane: physical-attack **PA-3 (REVISED to low/low)**.

The deck-level off-curve claim **did NOT reproduce** — Quickstrike and a Jab filler
were byte-identical in normal-fight swaps; the "324<332" was RNG noise inside two
0-winrate losses. Keep ONLY as an optional isolated-stat cleanup: `t2-agility-attack`
Quickstrike cost **2 → 1** (hold cd 1.2, Deal 8[dex]) — justified solely by the
stat-line vs Jab (cost 1 / Deal 9 / same cd), labeled non-blocking. Not a sim-proven
finding.

### 3.6 Agility-spam — NOT oppressive, no change
Lane: physical-attack **PA-6 (confirmed)**. Skywire / Quickstep Sigil / Quickstrike
are *slower* than balanced physical on every normal; they only shine at bosses (a
fair answer, not a trivializer). Leave as the ceiling reference §3.2/§3.3 buff toward.

---

## 4. Armor-finisher line (C3 holds; one real dead T3)

### 4.1 Aegis of Returning Wrath — dead T3 (HIGH)
Lane: armor-finisher **ARMFIN-2 (CONFIRMED & reinforced)**.

Clean-shell isolation (adv corrected the designer's contaminated 2×Aegis shell):
+Aegis = wr 0, 5/5 deaths, **lower damage than the filler base (300 vs 378)** — it
actively crowds out a working slot. Root cause verified in code: the "Brace: Deal 18
Pierce" payload fires on `on_armor_break` (armor pool transitions >0 → 0), which an
armor-stacking deck almost never triggers.

**Change (BUFF T3, the trigger is load-bearing):** make the payoff **unconditional
and armor-scaling** rather than a rarely-firing flat Brace hit, e.g. "Gain 22
[armor]([vit]). Deal 6 Pierce, +1 per 4[armor] you have." (uncapped, no Brace gate).
Cost 2s held; cut cd 2.4 → 2.0 only if still below the ~90k clean-shell band after
re-sim. Target: +Aegis flips 0→1 and lands ttk within ~10–15% of Body Slam /
Mountain's Answer. Do NOT touch Shield Bash / Granite Lunge.

### 4.2 Things NOT to change in this line (adversary corrections)
- **Mountain's Answer (ARMFIN-3): DECLINED** — the "T3<T2" was a shell-contamination
  artifact (baked-in dead Aegis + draw-order starving its armor≥32 gate). Clean
  isolation: Mountain's 92100 ≈ Shield Bash 91300, BEATS Granite 103100. In-band.
  **No change.**
- **Shield Bash (ARMFIN-4): REVISED to LOW/informational** — in clean isolation it
  merely *ties* the T3s (does not beat them) and is self-balancing (non-pierce vs the
  armored boss). Healthy T2 baseline. **No change** (and the T3>T2 rule forbids
  nerfing it).
- **Body Slam Vow (ARMFIN-5)** and **doom_knight-vs-armor (ARMFIN-6):** confirmed
  in-band; Body Slam is the ceiling reference. No change.

---

## 5. Poison line

Poison is the premier boss-killer (quadratic DoT bypasses defense) and clears all
batteries + both bosses — strong but **NOT oppressive** (Bog Catalyst / Slipvenom
self-limit; thinnest cushions are the doubling decks). Keep chunk-cap 60. Real
problems are a dead detonator line and several dead/violating T3s.

### 5.1 Poison detonators are a strict trap (HIGH)
Lanes: pure-poison **PP-1 (CONFIRMED, 6 reps)**, hybrid-combos **HC-2/HC-3 (revised)**.

Identical 9-card poison shell vs doom_knight: plain applier **wins 5/5 @ 20.7% HP**;
swap in **Drowning Lance → 0/5 DEATHS**; **Marsh Squall → 0.033 HP**. vs iron_golem:
applier ttk 15000 / 0.319 HP vs Lance 20000 / 0.109 vs Marsh 18000 / 0.181 — both
detonators slower AND lower cushion, and they cost MORE (Lance 2s+1m, Marsh 2s+2m).
Consuming the full quadratic pool destroys the n(n+1) ramp. (HC swap evidence was the
never-drawn last-slot artifact — discard; rely on the BANK-shell/clean data.)

**Change (C4 wiring, not a cost hike):** poison detonators should **NOT zero the
pool**.
- `t3-attack-water-water` **Drowning Lance** — consume only **half** the poison
  (round up) for the burst, leaving the rest ticking; base **4 → 6 Pierce**, per-stack
  **3 → 5 Pierce**; cut cd 2.4 → 1.8 (not exhaust, must re-arm). Cost 2s+1m held.
- `t3-air-earth-water` **Marsh Squall** — per-stack **4 → 6** to all enemies, consume
  half; **drop the mana half** of cost (2s+2m → 2s, exhaust already pays the premium);
  cd 2.4 → 2.0. (AoE upside is untestable in the 1-enemy sim — validate in a
  multi-enemy probe if available.)

### 5.2 Alchemic Drain — T3<T2 (HIGH)
Lanes: pure-poison **PP-5 (CONFIRMED & strengthened on a true single-slot A/B)**.

Clean single-slot A/B vs doom_knight: **Alchemic Drain (T3) 0/6 DEATHS** while
**Mire Bloom (T2) wins 6/6** and the T3 control Mireglide wins 6/6. "Apply 3 poison.
Heal 6" on cd 2.4 is below curve. **Change (BUFF T3):** `t3-earth-fire-water`
Alchemic Drain — cd 2.4 → 1.6, poison **3 → 4**, heal scales `Heal 6([spi])`. Cost
1m held. Never nerf Mire Bloom.

### 5.3 Dead/weak poison defensive T3s (MED)
Lanes: pure-poison **PP-3, PP-4 (confirmed)**; tier-ordering **TO-1 (confirmed)**.

- `t3-defense-defense-water` **Stagnant Bulwark** — flagged by BOTH poison and
  tier-ordering. vs T2 Bulwark Vow it is slower on all 5 late enemies and boss1 ttk
  61100 @ 0.04 HP vs T2 47900 @ 0.219 (TO-1); swap value ≈ T1 filler (PP-3). The ~6
  poison/12s aura is too slow for the quadratic curve. **Change:** cd 2.4 → 1.6, raise
  aura **1 → 2 [poison] every 2s**, keep 10 armor / cost 1s+1m. (Both lanes converge
  on the same fix.)
- `t3-counter-earth-water` **Bogwrath** — the 4-poison payoff is `on_armor_break`
  (Brace) gated, dead for a low-armor mage. **Change:** drop the Brace/rage gate →
  "Gain 10[armor]([vit]). Apply 4[poison]([int])." unconditional; cd 2.4 → 1.6.
- `t3-counter-water-water` **Tidefoot Bloom** — peakOPS 0, [exhaust], heal-gated
  trickle, structurally dead in a low-heal poison deck. **Change:** remove [exhaust],
  give a guaranteed up-front floor "Apply 4[poison]([int]), then for rest of combat
  each heal applies 1[poison]([int])"; cd 2.2 → 1.6. (Also flagged off-curve-sweep
  OCS-6 confirmed at low/med — thin/mixed evidence, low priority but harmless.)

### 5.4 Strong-but-fair, no change
Lanes: pure-poison **PP-6 (confirmed)**, hybrid-combos **HC-5 (Brine Crucible
confirmed not oppressive)**, **HC-8 (Bog Catalyst is the intended powerhouse
reference)**, off-curve-sweep **OCS-4 (Brine Crucible confirmed OPS artifact)**.
Brine Crucible's 158 isolated OPS is a triage artifact (it LOSES doom_knight and
iron_golem in real combat); Bog Catalyst is the legit reference the detonator buffs
aim toward. No nerfs. (Tooling note: don't credit "consume all X" detonators a full
pre-banked pool in OPS triage.)

---

## 6. Bleed / rage line

Bleed+rage clears all normals and now WINS doom_knight (wr 1.0) — but thin on the
gate-heavy builds. T3>T2 holds (no violations). The actionable item is one genuinely
dead T3; several other "weak" flags were artifacts of last-slot swaps.

### 6.1 Crimson Cascade — dead single-target T3 (HIGH)
Lane: bleed-rage **BR-4 (CONFIRMED & independently reproduced)**.

Early-slot swap (adv's own): Crimson Cascade 0.093 HP vs Jab 0.192 (−0.099, +2300ms
slower) vs doom_knight, and slightly worse than Jab even on the late normal battery
where its kill-chain could fire. The "kill an enemy with bleed → apply 4 bleed"
clause is 100% dead single-target; the self-bleed is pure downside.
**Change:** `t3-counter-counter-water` — base bleed **3 → 4**, **remove the 1
self-bleed** (pure downside; adv preferred this lever), cd 2.4 → 2.0; keep the
kill-chain as upside. Never nerf any T2.

### 6.2 Crimson Spiral — weak gate T3 (MED, validate post-change)
Lane: bleed-rage **BR-2 (CONFIRMED)**.

Loses to a T1 Jab in BOTH rage regimes (thin 0.040 vs 0.126; fed 0.099 vs 0.192,
+2400ms slower) — the 8-rage gate + 2.4s cd makes it a brick that also slows the
deck. **Change:** gate **8 → 5 rage**, cd 2.4 → 1.8 (cost 2s held). Adv caveat: even
fed it slowed the fight, so a gate cut alone may under-correct — if still ≤ Jab after,
give the non-gated case a **baseline 12 Pierce** so it is never dead. Re-run an
EARLY-slot swap to confirm.

### 6.3 Berserker's Ledger — borderline (LOW)
Lane: bleed-rage **BR-7 (confirmed)**. ~−0.020 vs Jab; the 2 self-bleed eats its edge.
**Change:** self-bleed **2 → 1** (cleaner than the cd cut per adv); low priority.

### 6.4 DROPPED / no-change (adversary corrections)
- **Cleaver's Tax (BR-3): DROPPED from the weak list** — adv early-slot re-test shows
  it ADDS value (+0.086 over Jab thin-rage). The designer's "ties Jab" was a
  last-slot artifact. Healthy T3, leave as-is.
- **Wrath Brand (BR-3 revised):** at most a LOW optional cd 2.4 → 1.8; not a confirmed
  brick. Not in the actioned set.
- **Bloodprice Strike (BR-6):** confirmed healthy (self-cost paid back) — no change.
- **Bleed swing vs slow bosses (BR-5):** working-as-designed (C5) — no change.
- **BR-8 tier check:** rage T3>T2 demonstrated; bleed T3-vs-T2 *inconclusive* (both
  die to iron_golem) — no violation, no fix.
- **doom_knight cushion (BR-1):** the CORE build's 0.199 cushion is already a healthy
  first-boss bar; do NOT count §1.1 as a fix for bleed-rage and do NOT assume the
  gate-card buffs lift the boss cushion (re-measure).

---

## 7. Slow / stun control

Control is intentionally race-losing (C3) — it can buy time but struggles to close.
Boss is NOT over-tuned for control (poison/armor decks beat iron_golem; control
loses). Fix the dead control cards + sharpen the legal slow→damage converters; never
add damage to slow/stun (C3/C5).

### 7.1 Stormrage — rage-gated T3 with no floor (HIGH)
Lane: slow-stun-control **SSC-3 (CONFIRMED, 8 reps)**.

`t3-air-air-counter` is fully rage-gated ("If you have [rage]: Apply 8[slow]") — a
mage deck holds no rage, so it frequently does **nothing**; loses mutated_salamander
8/8 where the Tempest-Pike filler wins. **Change (BUFF T3, keep pure soft-control):**
add a real floor — "Apply 5[slow]([int]). If you have [rage]: apply 8 more
[slow]([int])." cd 2.4 → 2.0, cost 1s+1m held. No damage.

### 7.2 Frostbind — dead T2 control (MED)
Lanes: slow-stun-control **SSC-2 (confirmed)**, enemy-ramp ER-6 (confirmed,
cross-corroborated).

`t2-water-water`: 1–2 stun + 4 armor, no damage; drops a win (mutated_salamander 0/8)
vs a filler. **Change (C1 rescue, keep pure control):** cd 2 → 1.4, cost 1m held —
snappier stun chain keeps the enemy frozen. Do NOT add damage; keep the Vengeance
hook. (ER-6 also pairs Tremor Lock cd 2.0 → 1.6.)

### 7.3 Quake — weakest filler (LOW–MED, CD-only)
Lane: slow-stun-control **SSC-1 (REVISED to CD-only)**, mage-scaling MS-6.
**Change:** `t1-earth` Quake cd 2 → 1.4, **keep 4[slow]** (adv: drop the simultaneous
+slow — re-measure first; the double buff over-corrects a T1 clean card). Cost 1m.
(MS-6's optional "add Deal 2([int])" for the earth-mage closer is a low-confidence
archetype note, not actioned here.)

### 7.4 Slow→damage converters (MED, the legit control win-con)
Lanes: slow-stun-control **SSC-6 / SSC-8 (confirmed)**, boss-progression BP-3
(confirmed). Control buys time but can't close; sharpen the **converters**, not the
control verbs. **Change:** `t3-air-attack-counter` **Thunderstrike Catalyst** cd
2.4 → 2.0 (BP-3 alternatively raised its consume payoff 6 → 8 — pick the CD cut as
the lighter lever); `t3-agility-air-counter` **Static Skirmish** cd 1.8 → 1.6. Both
already Pierce (helps vs def 4). Values unchanged (C3/C5).

### 7.5 No change (confirmed)
- **Dust Plague (SSC-4):** the only late deck to beat iron_golem (62.9s grind, 10.9%
  HP, no direct damage) — exactly the C3 fantasy, NOT oppressive. Benchmark, no nerf.
- **Tectonic Reckoning (SSC-5):** self-limits via 3s+2m + exhaust (loses every boss
  in the sims) — NOT oppressive. Optional mana trim 3s+2m → 3s+1m is flagged but
  **left OUT of the mandatory set** (adv: making a 50-Pierce+3stun nuke castable risks
  edging control toward a race-winner, C3).
- **Concussive Smash (SSC-7):** correctly dominates the T2 stuns (deck-level, not a
  clean isolated swap) — no violation, no change.

---

## 8. Tier-ordering sweep (armor / mage T3>T2)

Confirmed violations (all BUFF the T3 via CD cut, never nerf the T2):
- **TO-1 Stagnant Bulwark** `t3-defense-defense-water` — see §5.3 (same card, two
  lanes converge: cd 2.4 → 1.6, aura 1 → 2 poison/2s).
- **TO-2 Stoneward Reprisal** `t3-defense-defense-earth` — slower AND lower-HP than
  T2 Bulwark Vow on all 5 late + boss1 (adv re-test: ttk 60100 @ 0.106 HP vs T2 39700
  @ 0.351 — the largest boss1 regression of the set). **Change:** cd 2.4 → 1.6, cost
  1s held; keep Brace:Apply 2[stun].
- **TO-3 Quench Lance** — see §2.4 (cd 2.4 → 1.3, base 2 → 4 burn). Outright T3 loss.
- **TO-7 Tidesong Aura** `t3-water-water-water` (LOW) — slower pure-heal than T2
  Frostbind on ~4/5, and loses Frostbind's stun. **Change:** cd 2.4 → 1.8, heal
  **18 → 22([spi])**, cost 2m held (C3-safe heal-only).

**DECLINED (adversary, harness-noise / non-reproducing — do NOT action):**
- **TO-4 Bogplate** and **TO-5 Magmaplate** — the cited golem "failure" (51100 vs
  49900) is a ~2.4% harness-specific delta that REVERSES in the adv harness (net
  faster on 3/5); the "Bedrock clears at 34100" anchor was a deck-composition
  artifact (Bedrock = 42900 in the adv harness). No tier violation.
- **TO-6 Tombrage** — flips direction with filler composition (adv: faster on the boss
  golem and werewolf); the proposed new Pierce payoff risks over-correcting a
  near-parity card. No change.

Healthy T3s confirmed (no violation): Aegis (vs §4.1 note this is the *armor-finisher*
shell issue, not the tier-ordering harness), Veil of Steps, Phalanx Drift, Reforge
Vow, Galeward, Stormgate, Brineward, Misted Cadence, Squall Aura, Pyric Bulwark,
Bedrock Bulwark.

---

## 9. Cross-lane contradictions (flagged)

1. **doom_knight fix lever** (§1.1): split between damage-cut (ER-1/BP-1, verified),
   HP-cut (OCS-8), and don't-touch-the-boss (PA-1/MS-1/HC-7). Resolved: adopt the
   **verified damage cut 9→7**; HP trim conditional; card fixes handle mage/burn.
2. **doom_knight cushion severity** (bleed-rage BR-1 vs the rest): bleed-rage's CORE
   build already finishes at 0.199 — for that archetype the boss is fine. The HIGH
   severity is driven by clean-attacker and mage/burn archetypes, not bleed-rage.
3. **iron_golem fix** (§1.2): designer (baseDefense 4→3) vs adversary (affinity
   ratchet + shield + HP). Adversary empirically refuted baseDefense; code confirms
   the affinity ratchet. Adopt the adversary's fix.
4. **Pierce "decisiveness" for burn detonators** (PB-6): designer overstated; adv
   showed a non-Pierce card (Cinder Sprint) already wins. Pierce is a secondary
   layer, not the fix — reflected in §2.3.
5. **Mountain's Answer** (armor-finisher ARMFIN-3): designer flagged a tier violation;
   adversary DECLINED it as shell contamination. Excluded from the action set.

---

## 10. Open questions / required re-sims before shipping

- After §2.1 + §2.2 land, re-sim fire/air mage vs doom_knight to confirm wr ≥ 0.8 and
  pin the elemMult constant (~0.26/pt) so it stays below same-level strMult at every
  stage.
- After §2.3, re-sim a **realistic 12-card** burn detonate deck vs doom_knight (the
  9-banker shell over-states; realistic decks topped at 353 < 380).
- After §3.2 (Mountain's Will alone), re-sim phys-boss1-balanced before adding §3.1/§3.4
  pierce — one pierce T3 may already suffice (avoid over-correction).
- After §1.2, re-sim late-physical vs iron_golem / lizard_king / bog_witch for a
  monotone curve; spin a **follow-up lane** for desert_golem / boss_iron_golem
  (also armor-stackers).
- §4.1 Aegis: confirm the trigger rewrite (unconditional armor-scaling) lands in the
  ~90k clean-shell band, not over it.
- Re-validate all swap-derived buffs with the candidate in an EARLY deck slot
  (fixed-order engine) — never trust a last-slot swap.
