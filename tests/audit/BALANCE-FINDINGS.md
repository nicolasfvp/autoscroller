# Balance Detection Report — Card Set Audit

**Scope:** problem DETECTION only. No specific number fixes are prescribed; each finding states the
objective metric, severity, and ROOT CAUSE to ground the upcoming rebalance discussion.

**Metric model (from `tests/audit/balance-metrics.json` → `meta.model`):**
`peakOPS = peakValue / cooldown`, where `peakValue` is the max composite across 24 single-cast
scenarios. DoT equivalence: `poison = n(n+1)`, `bleed = 0.75n(n+1)`, `slow = n(n+1)/2`,
`burn = min(n,8)·4` (fight-length dependent), `stun = 6/stack mitigation` (not damage).
Regen: +1 stamina & +1 mana / 4500ms; `sustainable` flag = drain ≤ 0.72/s.

**Known blind spots applied throughout:** the 8x harness does NOT tick DoTs (pure DoT cards read
`totalDamage=0` while stacking large pools); detonators read 0 without their enabler; defensive
value (armor/heal/stun) is undervalued vs raw damage; stat-gain / scaling pays off only cumulatively.
Every low number below was cross-checked against the card TEXT, the relevant enabler scenario, and
the 8x sequence before being called a problem.

---

## 1. TIER INVERSION — T3 is systemically weaker than (shorter-CD) T2

**The inversion is real and systemic, not a handful of outliers.**

| Rollup | T1 | T2 | T3 |
|---|---|---|---|
| count | 8 | 36 | 120 |
| **peakOPS median** | 6.0 | **14.86** | **12.31** |
| peakOPS q25 | 0 | 4.75 | 6.15 |
| baseOPS median | 6.0 | 3.75 | 4.62 |
| avg cooldown | — | ~1.4 (top cards 0.8–1.6) | **~2.7 (commonly 2.4–3.5)** |

- **T3's own median peakOPS (12.31) sits BELOW the T2 median (14.86).** A whole tier whose middle
  is under-tuned. The `tierInversions[]` array holds **115 entries**: T3 cards beaten by ≥1 T2 card.
  62 of 120 T3 cards (52%) are at/under the T2 median; 15 sit below the T2 q25 (4.75).

**Root structural cause (the dominant lever):** T3 carries a near-universal **cooldown + dual-resource
tax with no commensurate per-cast payoff.** T3 averages cd 2.7 and frequently costs BOTH stamina AND
mana (24 T3 cards cost both with peakOPS ≤ 12), while the strongest T2 cards are single-resource at
cd 0.8–1.6. Because `OPS ≈ per-cast value / cooldown` and regen is slow, short-CD single-cost T2
cards structurally out-output most of T3. *Tier is decorative for cost* — T1/T2/T3 attack cards all
sit at stamina1, sub-2s CD; "tier 3" buys more raw value at the same or lower cost/CD.

### Worst confirmed inversions (with the T2 cards that beat them)

| cardId | name | peakOPS | cd | beatenBy | Root cause | Sev |
|---|---|---|---|---|---|---|
| `t3-attack-attack-counter` | Bloodlash Salvo | **0** | 2.6 | 13 | Self-stun (engine skips hero's own next cards) + one-shot +4 STR; downside scales UP with STR | critical |
| `t3-earth-fire-water` | Alchemic Drain | **0** | 3.0 | 19 | Doubly-gated heal-detonator (needs enemy poison + wounded hero); overheals to 0 | medium |
| `t3-air-counter-counter` | Wrath Squall | **0** | 2.0 | 13 | Doubly-conditional exhaust; both effects are `hp_lost` auras that never fire single-cast | high |
| `t3-counter-counter-defense` | Wrathshell Vow | 1.8 | **10** (game max) | — | cd=10 exhaust whose only output is inert rage it cannot spend itself | high |
| `t3-air-counter-fire` | Static Bleed | **0** | 2.4 | 19 | Only guaranteed effect is self-bleed (HP cost); payoff behind on_armor_break it can't trigger | critical |
| `t3-air-counter-water` | Tempestbleed | **0** | 2.6 | 18 | Same defect, worse: two Brace-gated riders, body is pure self-bleed | critical |
| `t3-counter-earth-fire` | Magmavow | 5.33 | 3.0 | 17 | 16 Pierce + 2 burn locked behind on_armor_break; bare 10-armor card otherwise | high |
| `t3-agility-defense-earth` | Quickstone | 5.85 | — | 17 | 6.15 armor/sec vs T2 Bulwark Vow 9.38; longer CD + 2nd resource | high |
| `t3-agility-air-defense` | Galeguard | 5.0 | 2.4 | — | Floor-tier armor (base 10, weakest VIT scaling); intra-archetype dominated | high |
| `t3-attack-counter-fire` | Wrath Brand | 12.31 | 2.6 | — | T3 rage PAYOFF under-outputs its own T2 GENERATOR (Reckless Strike 55.83); flat binary gate, no per-stack scaling | high |

**The T2 cards doing the beating (the reference ceiling):** Quickstrike `t2-agility-attack`
(peakOPS **72.5**, cd 0.8), Reckless Strike `t2-attack-attack` (55.83, cd 1.2), Bloodprice Strike
`t2-attack-counter` (48.13, cd 1.6), Sidestep & Slash `t2-agility-counter` (27.73, cd 1.1), Hollow
Echo `t2-air-counter` (24.62, cd 1.3). Quickstrike alone beats ~80 of the 115 flagged T3 cards.

**Three archetype-level concentrators of the inversion:**
1. **Armor inverts internally** — T3 armor produces 4.67–6.7 armor/sec vs T2 Bulwark Vow's 9.38;
   T3 "pays" higher per-cast armor with longer CD + a second resource, so armor/sec goes DOWN as
   tier goes UP (Quickstone, Bogwrath, Dustward, Magmaplate, Galeguard).
2. **The "Brace" (on_armor_break) trap** — ~8 T3 cards put their damage/poison/slow/bleed behind an
   armor-break trigger they cannot satisfy. On attack-frame cards (Static Bleed, Tempestbleed) there
   is no armor to break at all → fully dead. On armor cards (Magmavow, Magmaplate, Bramble Step,
   Dustward, Bogwrath) the trigger is *anti-correlated with the card's own purpose* (it fires only
   when the armor they grant gets destroyed), collapsing them to armor-only.
3. **Rage supply/demand inversion** — 13 generators vs ~3 consumers; the lone competitive payoff
   (Wrath Brand) under-outputs its own T2 enabler (Reckless Strike).

**Cleared false positives (NOT inversions):** Quickearth Rite (peakOPS 4.33 but 91 armor + 4 VIT
over seq8x — armor undervaluation, roughly on-curve). The high-OPS "inversions" at the bottom of
`tierInversions[]` (Brine Crucible 158, Vein Splitter 134, Razor Cadence 72, Slipvenom Tempo 68) are
flagged only because Quickstrike's cd0.8 outlier beats nearly everything — they are not weak. The
real outlier to address is **Quickstrike/agility-attack, not these.**

---

## 2. WEAK ARCHETYPES — power ordering and WHY the laggards lag

**Archetype peakOPS medians (from `balance-metrics.json.archetypes`):**

| Archetype | count | peakOPS median | avg cd | Note |
|---|---|---|---|---|
| slow | 26 | **25.0** | 2.18 | best-rounded: n(n+1)/2 dmg + cd-control (8%/stk, cap 50%); control half undervalued |
| damage | 86 | 24.62 | 2.28 | reference power level |
| bleed | 19 | 17.5 | 2.37 | swing-amplified but amplifier of fast decks, not independent |
| poison | 29 | 16.5 | 2.61 | quadratic, slow decay; solid mid |
| stun | 9 | 14.06 | 2.67 | pure mitigation (6/stk); strictly dominated by slow |
| burn | 38 | 14.64 | 2.33 | **capped min(8)/tick**; detonator-scarce build-around |
| armor | 58 | **7.2** | 2.55 | worst-tuned; over-supplied; no offensive conversion |
| heal | 16 | **5.14** | 2.45 | sustain with no offense |
| scaling | 11 | **4.44** (q25 = 0) | 2.28 | capped +3–5 stat/combat; does nothing on cast |
| rage | 15 | 8.69 (q25 = 2) | 3.01 | broken loop, 3:1 generators-to-payoffs |
| exhaust | 11 | 2.0 (q25 = 0) | 4.19 | one-shot tax; bimodal (a few bombs, mostly dead weight) |

**Element view confirms the split is structural, not card-by-card:**
attack (median 26.75) and agility (24.0) dominate; **defense (7.2 — 84% below the T2 OPS median)**
and **water (8.57 — lowest of 8 elements, 69% below)** are the systematically weakest families;
counter (10.77) and earth (11.2) host most confirmed inversions.

**WHY the laggards lag (root causes):**

- **Defensive/control archetypes pay the highest CD AND produce a resource the game gives almost no
  offensive conversion for.** Armor/heal/stun never feed the win condition. `CardResolver` armor
  only adds to `heroDefense` (pure mitigation); the composite weights armor at just 0.8x with no
  offensive term. There is **no broad armor→damage detonator** analogous to Pyre. The narrow
  armor→damage path that exists (Shield Bash, Granite Lunge, Bulwark Salvo, Body Slam Vow, Citadel
  Inferno via `scale.source: "armor"`) peaks at only 12–19 OPS — at/below the T2 median.
- **Burn has a hard `min(8)/tick` engine cap** — deep-fire investment past 8 stacks is wasted unless
  a Pyre detonator cashes the whole pool. Pyre detonators are scarce, high-cost, high-CD, and every
  burn detonator is T3-only — so T2 burn appliers (Firestorm) have no payoff partner in their tier.
- **Rage is an inert counter with a 3:1 generator/payoff ratio.** Generators are high-CD / exhaust /
  HP-gated; the 3 payoffs each consume the ENTIRE pool, so the loop rarely closes.
- **The DoT "tick once per card play" cadence couples DoT value to deck TEMPO, not to investment in
  the stack.** Bleed (decays 1/tick) and slow (decays 1/tick) reward the high-tempo decks that need
  DoTs least and punish the slow control decks built around them. Stacks applied but not followed by
  more plays (short fights, slow detonator cycles) are pure unrealized value.
- **Scaling/heal pay off only cumulatively or invisibly** — capped at +3–5 stat/combat (scaling) or
  feed back into sustain (heal), and depend on a long fight the fast decks won't allow.

**Matchup logic:** every defense/water/heal/armor deck loses the race to attack/agility because it
cannot convert its resource into enemy HP fast enough; the fast deck ends the fight before sustain/
control matters. Burn loses to slow/poison (they realize their full DoT curve; burn hits the cap).
Stun loses to slow (slow is a strict superset: damage + control). Counter/rage decks lose to
everything unless perfectly assembled (feast-or-famine, no incremental floor).

### Archetype-floor cards (genuine intra-group outliers, defense undervaluation already granted)

| cardId | name | peakOPS | Group median | Root cause | Sev |
|---|---|---|---|---|---|
| `t3-air-air-earth` | Dust Plague | 3.71 | armor 7.2 | Most expensive cost in dead list (s1+m2); slow/stun rider mechanically unreachable | high |
| `t3-agility-counter-earth` | Quickearth Rite | 4.33 | armor 7.2 | VIT rider self-anti-synergistic (own armor suppresses the hp_lost it counts); +4 VIT = +2 armor | low |
| `t3-water-water-water` | Tidesong Aura | 5.4 | heal 5.14 | Pure self-sustain looping into sustain; zero offensive/tempo conversion | high |
| `t2-air-water` | Misting Veil | 2.57 | heal 5.14 | Only pure self-buff heal in tier; no damage/poison/armor rider for composite to score | medium |
| `t3-air-air-water` | Squall Aura | 4.15 | heal 5.14 | Strictly dominated by same-element twin `t3-air-water-water` (heals 14 vs 9) | medium |
| `t2-counter-water` | Bloodtide Mend | 4.0 | heal 5.14 | Tiny heal nearly cancelled by 2 self-bleed; SPI ramp is the only (slow) payoff | low |

---

## 3. BROKEN SYNERGIES — stranded payoffs and net-negative combos

Three structural breakages along distinct axes.

### 3a. Dead / mistargeted wiring (these are BUGS, not tuning)

| cardId | name | Defect | Sev |
|---|---|---|---|
| `t3-air-fire-fire` | Pyre Surge | The marquee aura `{kind: fire_damage_taken_pct, value: 1}` ("+100% fire damage taken") is **never read by any damage path** — `CardResolver` damage formula and the burn DoT tick never consult it. Card is really a vanilla double-burn; the T3 amplifier half does literally nothing. | high |
| `t3-attack-counter-water` | Necrotic Festering | Side-mismatch: builds bleed on the **HERO** pool (`heroBleedStacks`) but the detonator (`consume_stack_value: bleed`) reads the **ENEMY** pool (`bleedStacks`). The card cannot combo with its own bleed; headline payoff deals 0 in every scenario. Its measured 32.73 OPS is a poison-conversion artifact. | high |
| `t3-agility-counter-water` | Venom Dance | Vengeance clause `convert_stack` targets `self`, but `addStack` has no self-side poison case → produced poison is **silently dropped**. The clause's only runtime effect is consuming the hero's own bleed for nothing. A second clause (50% poison spread to 2 enemies) is also inert (`spread` is unimplemented). 2 of 3 effects do nothing. | medium |

**Action for rebalance:** grep for other authored-but-unread `AuraModifierKind` values and unimplemented
`spread`/`max_targets`/AoE metadata before tuning — single-enemy `CombatState` makes all "spread to N
enemies" text decorative (also kills Marsh Squall's only redeeming feature).

### 3b. Shared-pool over-saturation (cannibalization)

- **Every burn payoff is a "consume ALL burn" detonator with no per-detonator budgeting.** ~10 cards
  (Pyre, Supernova, Cinderlance, Cinder Sprint, Venom Detonation, Tremor Detonate, Brine Crucible,
  Ember Aegis Gust, +2) drain the SINGLE `enemyBurnStacks` pool. In `enemy_burn_5`, every detonator
  posts `burnDelta = -5`. Running two+ is **anti-synergy** — the first empties the pool, later ones
  detonate on 0 — yet `SynergyDetection` (pure ≥2-keyword overlap) green-lights them all as "synergy."
- Worse, burn is the strongest sustained engine in the game (no decay, min(8)/tick), so **detonating
  is often a DPS LOSS vs letting burn tick.** `t3-fire-fire-fire` Supernova (high, cap-breaker) and
  `t3-air-defense-fire` Ember Aegis Gust (high, burn→armor for a stat its deck can't reach) are
  stranded payoffs on this over-saturated pool.
- **Rage** has 3 all-consuming payoffs but only ~2 spammable generators — the inverse imbalance.

### 3c. Detonators fight DoT non-linearity (the multiplier is priced too low)

Poison `n(n+1)` and bleed `0.75n(n+1)` are SUPERLINEAR; the marginal value of the n-th stack is the
derivative `2n`. Several detonators pay a FLAT LINEAR coefficient, so detonating destroys more pending
tick value than it deals.

| cardId | name | peakOPS | The trap | Sev |
|---|---|---|---|---|
| `t3-attack-water-water` | Drowning Lance | 5.94 | 3/poison flat vs DoT worth `n(n+1)`. Break-even N=3; **strictly net-negative for N≥4** (-11 at N=5, -76 at N=10). The payoff button is a trap. | high |
| `t3-air-earth-water` | Marsh Squall | 4.0 | s2+m2, cd5, exhaust poison detonator: 20 burst destroys ~30 dmg-equiv of poison. Worst-redeemed value in T3. "AoE spread" redemption is unimplemented dead metadata. | medium |
| `t3-attack-fire-water` | Tremor Detonate | 6.55 | Functional tri-DoT Pierce detonator, but extreme price (s3, cd5.5 — highest single-cost + longest non-buff CD in the detonator set, + exhaust) caps OPS at the T3 floor. | medium |

### 3d. Build-around enablers stranded by harness/economy (NOT dead — measurement artifacts)

These have working triggers wired in the live engine that the single-cast + same-card-8x harness can
never fire. Their peakOPS=0 is a blind spot. Surfaced here so they are NOT mistaken for dead cards:
`t2-counter-counter` Razor Stance (on_hit bleed rider), `t1-counter` Riposte (on_hit +3 dmg),
`t2-air-fire` Firestorm (card_played burn — note: Pyre IS a same-tier T2 payoff, refuting the "no T2
payoff" worry), `t3-counter-water-water` Tidefoot Bloom (heal_received → poison), `t3-counter-counter-fire`
Vengeful Pyre (x2-rage aura, functional), `t3-counter-counter-counter` Crimson Spiral (rage detonator;
its headline 46.67 OPS is a dotEquiv model artifact, not realizable), `t3-air-air-air` Gale Echo
(on_slow_applied echo), `t3-earth-earth-water` Bog Catalyst (multiply_stack — geometric poison growth,
reaches 1530 stacks over 8 casts; 8x harness reads 0 because it doesn't tick DoTs — trust dotEquiv).

---

## 4. DEAD CARDS — genuinely useless in any realistic line

The `deadCards[]` flag holds 21 cards, but only a minority are GENUINELY dead. ~13 are
trigger/enabler/Brace cards whose triggers ARE wired in the live engine (on_hit_dealt, on_armor_break,
on_slow_applied, on_self_damage, event_counter bumps) — under-credited, not broken (see §3d).

**The genuinely / structurally dead set:**

| cardId | name | tier | peakOPS | Root cause | Sev |
|---|---|---|---|---|---|
| `t3-attack-attack-counter` | Bloodlash Salvo | 3 | 0 | **Negative-value.** Self-stun makes the engine SKIP the hero's own next cards (named in CombatEngine comment); +4 STR one-shot is outweighed and the self-stun scales UP with STR (anti-synergy with its own buff). No redemption in any of 24 scenarios + seq8x. | critical |
| `t3-air-counter-fire` | Static Bleed | 3 | 0 | **Self-harm only.** Only guaranteed effect is self-bleed (real HP loss); the 4-slow payoff is behind on_armor_break on a card that grants no armor → unreachable. Net floor strictly negative. | critical |
| `t3-air-counter-water` | Tempestbleed | 3 | 0 | Same defect, worse — two Brace-gated riders (Deal 6, 2 slow), entire non-Brace body is self-bleed. | critical |
| `t2-attack-water` | Crimson Tithe | 2 | 0 (baseOPS **-1.56**, uniquely negative) | Pays up-front 5 self-HP + 1 stam + cd for deferred rage; grants 0 rage on its OWN cast (aura placed after self-damage resolves). Poor generator + (mostly) T3-only spenders. *(Iron Reckoning at T2 is a non-consuming payoff, so "no T2 payoff" is too absolute — but the card's own value is still negative.)* | medium |
| `t3-earth-fire-water` | Alchemic Drain | 3 | 0 | Doubly-gated heal-detonator: needs enemy poison present AND wounded hero; applies no poison itself; overheals to 0 at full HP. The intersection (poison enabler + wounded hero) is never present in any scenario. Heal is real but stranded — a poison deck wants damage, not healing. | medium |

**Self-cost cluster (negative floor, thin gated ceiling — the worst risk/reward shape in the pool):**
Razor Stance, Static Bleed, Tempestbleed, Bloodlash Salvo, Bloodtide Mend all pay an UNCONDITIONAL
self-cost (self_dot bleed/stun on the hero, which ticks as real HP loss) while the offsetting payoff
is conditional (on-hit / Brace / Vengeance).

**Structural archetype-availability gap (drives much of the "dead" list):** every rage spender
(Crimson Spiral, Cleaver's Tax, Wrath Brand, Stormrage) and every burn detonator is T3-only. So all
the rage GENERATORS (Crimson Tithe T2, Wrath Squall, Wrathshell Vow, Vengeful Pyre) and the T2 burn
applier Firestorm have no payoff partner at/below their own tier — a synergy-pool DEPTH problem, not
per-card numbers.

---

## 5. OVERTUNED OUTLIERS — high-OPS low-CD cards that crowd out the rest

The ceiling is set by a cluster of low-CD STR/DEX attack cards, and `sustainable:false` makes the
metric's peakOPS over-state most of them (engine skips unaffordable casts + 500ms retry throttle).
**The sustainable ones are the true power level; treat the unsustainable ones as over-stated.**

| cardId | name | tier | peakOPS | cd | cost | sustainable | Root cause | Sev |
|---|---|---|---|---|---|---|---|---|
| `t2-agility-attack` | Quickstrike | 2 | **72.5** | **0.8** (lowest in game) | s1 | false (drain 1.25/s) | DEX double-dips: cuts cd denominator (-2%/pt, cap -60%) AND raises damage numerator, with STR's +25%/pt soft-mult on top. Sets the game's OPS ceiling. Unsustainable headline, but ~30 OPS at mid stats still tops nearly all T2. | high |
| `t3-agility-agility-agility` | Quickstep Sigil | 3 | 53.33 (true **~76** w/ own aura) | 1.8 | s1 (cheapest) | true (borderline) | Cheap multi-hit DEX attack + self-grants a **deck-wide 30% cd_reduction aura** with permanent uptime → top sustainable T3 AND undercuts the CD-pricing of the whole deck. Metric understates it (computed off base cd). | high |
| `t3-agility-air-attack` | Skywire | 3 | 56 | 1.5 | s2 | false (drain 1.33/s) | 56 OPS is a per-CAST burst the metric reports as per-second; stamina gate (1.33/s vs ~0.22–0.44/s regen) silently throttles it. Both single-cast and seq8x ignore the gate → over-rated. | high |
| `t1-agility` | Quickstep | 1 | 28.89 | **0.9** | s1 | false | A 1-cost, cd0.9 vanilla "Deal 4. Deal 4." T1 starter sustains above both the T2 (14.86) AND T3 (12.31) medians. **The sub-1s-CD 1-cost template the rest of the set is balanced against — tier is irrelevant.** | high |
| `t2-air-counter` | Hollow Echo | 2 | 24.62 (true ~28.96) | 1.3 | **null (free)** | true (drain 0) | Free cost bypasses the regen economy entirely (`canAfford` returns true for null cost). Castable forever, out-paces 1-stam T1 attacks, AND self-grants a permanent 15% Haste loop the metric doesn't model. A free card out-valuing a costed one is a direct cost inversion. | high |

**The cost/CD axis is the single biggest source of imbalance.** Supporting structural facts:
- **No tier→cost gradient.** T1/T2/T3 attack cards all sit at s1, sub-2s CD. "Tier 3" buys raw value
  at the SAME or lower cost/CD (Quickstep Sigil s1/cd1.8 vs T1 Quickstep s1/cd0.9).
- **Sustainability is binary and peakOPS ignores it.** ~30 cards are `sustainable:false` (drain
  0.83–1.33/s vs ~0.22/s regen). Their advertised OPS is a fiction the engine throttles.
- **FREE-cost cards** (`t2-air-counter`, `t2-air-air`, `t2-air-counter` air/counter, +others) sit
  OUTSIDE the regen economy (drain 0) and several reach 24+ OPS — infinitely repeatable.
- **The exhaust/long-CD cluster is bimodal** — a few correctly-priced bombs (Crimson Spiral 210
  value, Tectonic Reckoning 196) and a lot of over-priced dead weight (Wrathshell Vow cd10/1.8 OPS,
  Tremor Detonate s3/cd5.5/6.55, Bloodlash Salvo 0, Marsh Squall, Vengeful Pyre) paying the full
  exhaust+CD+cost tax for board states the synergy economy doesn't guarantee.

---

## 6. STAT-SCALING COVERAGE — the global STR multiplier eclipses every other axis

**Severity: critical, set-wide (`GLOBAL:str-soft-multiplier`).**

`CardResolver.applyEffect` (~L397): `strMult = 1 + max(0, heroStrength-1)·0.25` is an **unconditional
global +25%/point MULTIPLIER on ALL enemy-targeted damage**, with NO element/category gate. Every
other stat (INT/DEX/SPI/VIT) contributes only through explicit per-card ADDITIVE `scale` clauses of
~+1 per 2–3 points. A multiplier structurally dominates an additive.

- Across 67 damage cards, `str_10` is the best-scaling stat for **65**; vit_10 wins 2; INT/DEX/SPI
  win 0. 20 of those STR wins are cards where STR is NOT an element-primary stat.
- Decisive: `t3-agility-agility-agility` explicitly scales off its own DEX primary (base 15 → dex_10
  30) yet **str_10 = 48** — STR beats the card's own on-element stat.
- Class bias (`CLASS_BIAS`: warrior physical 0.75 / mage elemental 0.75) plus the element→stat map
  mean fire/INT, air/DEX, water/SPI decks **never build STR** — so their intended scaling stats are
  structurally outclassed by a stat they can't reach. 9 damage cards even hard-code `scale.stat:"str"`
  into off-element cards' own clauses.

**Secondary scaling defects:**
- `t3-agility-agility-air`, `t3-attack-counter-water`, others — DoT/control `[int]` scale clauses on
  physical/warrior-biased elements: alive in the metric, dead in the actual deck (medium).
- `t3-attack-defense-fire` (and water/air/agility/earth siblings) — hybrid pairs a STR-compounding
  damage half with a **FLAT, never-scaling armor half** (`CardResolver` never reads VIT for armor);
  defensive half collapses to a vanishing fraction as stats grow (medium).
- `t2-agility-defense` (+3 others) — armor scales off **DEX instead of VIT**, splitting the defensive
  scaling axis (4 of ~55 armor cards, driven by agility being the dominant element) (medium).
- `t2-water-water` — a water (SPI) card with **zero SPI scaling** (stun on INT, armor on VIT);
  element-identity decoupling (medium).
- Fully-flat / weak-clause cards: `t1-defense` Bulwark (12 armor, no scale — never grows with VIT),
  `t1-water` Mend (relies on implicit +15%/SPI only), `t1-fire`, `t3-agility-agility-fire` (low).

---

## Root-cause themes (systemic levers for the rebalance plan)

1. **Tier is decorative for cost/CD.** There is no tier→cost or tier→cooldown gradient; the strongest
   cards are 1-resource or FREE, low-CD spammers, and T3 power often comes from STILL-cheaper costs
   and shorter CDs. This is the single biggest driver of the T3<T2 inversion and the overtuned
   outliers. Lever: re-establish a real cost/CD curve per tier.

2. **The agility/attack cooldown+scaling double-dip.** DEX cuts the cd denominator AND scales the
   damage numerator AND STR multiplies on top — one stat compounds both OPS axes on one element pair.
   Lever: decide whether cd-reduction and damage scaling should ever live on the same axis.

3. **STR is a global damage multiplier; everything else is additive.** STR eclipses every on-element
   scaling stat for damage, defeating the class-bias element identities. Lever: gate the multiplier
   or convert other stats to multipliers within their element.

4. **No armor/heal → offense conversion.** Defensive archetypes produce a resource the game never
   feeds into the win condition (no broad armor→damage detonator), so defense/water/heal/armor can
   never win a damage race regardless of how much they produce. Armor is also over-supplied (58 cards).

5. **Burn's `min(8)/tick` cap vs detonator scarcity + the "consume ALL" shared pool.** Deep-fire
   investment is wasted; the few detonators cannibalize one pool; and because burn never decays,
   detonating is frequently a DPS loss vs letting it tick — inverting the whole Pyre archetype's intent.

6. **The "Brace"/on_armor_break trap and self-cost cluster.** ~8 cards gate their payoff behind a
   trigger that is unreachable (no armor) or anti-correlated with the card's own purpose (the armor
   they grant must be destroyed); a self-cost cluster pays an unconditional HP/tempo cost up front for
   a conditional, gated upside — giving the worst risk/reward shapes in the set.

7. **DoT realization is play-cadence-gated, not investment-gated.** "DoTs tick once per card play"
   couples DoT value to deck TEMPO — rewarding the fast decks that need DoTs least and punishing the
   slow control decks built around them; banked stacks at fight-end/slow windows are pure waste.

8. **The rage loop doesn't close.** 3:1 generators-to-payoffs, all payoffs consume the entire pool,
   generators are high-CD/exhaust/HP-gated, and every spender is T3-only — a synergy-pool depth +
   throughput-ratio problem, not a per-card number problem.

---

## Open questions for the rebalance plan

1. Should cost and cooldown carry a deliberate **per-tier gradient**, or should tier signal something
   else entirely (rarity-free, so what does T3 promise the player)?
2. Is the **STR global multiplier** intended design (a deliberate "STR is king" axis) or an accident?
   If intended, how do mage/agility/defense element identities stay relevant for damage?
3. Should **cooldown-reduction and damage-scaling** ever share the same stat (DEX), or be split?
4. Does the game want a **broad armor/heal→offense conversion** mechanic so defensive archetypes can
   feed the win condition, or are defense/heal meant to be intentionally race-losing?
5. For **burn**: lift/remove the `min(8)` tick cap, add more detonators, or re-pitch burn as a pure
   sustained engine that is NOT meant to be detonated? (Pick one — the current state contradicts itself.)
6. Should **detonator coefficients** be repriced to beat the non-linear DoT they destroy (i.e. scale
   super-linearly with consumed stacks), and should "consume ALL" be replaced with budgeted consumption
   so multiple detonators can coexist?
7. Should **`SynergyDetection`** model shared-resource contention so it stops glowing redundant
   detonators that race for one pool as "synergy"?
8. **FREE-cost cards** — are they intended to sit outside the regen economy, or should they carry a
   non-resource cost (cd, exhaust, conditional)?
9. Decide the fate of the **wiring bugs** before tuning: implement `fire_damage_taken_pct` (Pyre
   Surge), fix the hero/enemy pool side-mismatch (Necrotic Festering), the self-side poison drop
   (Venom Dance), and either implement or remove **multi-enemy "spread"/AoE** metadata (Marsh Squall,
   Venom Dance) — single-enemy `CombatState` makes it all decorative today.
10. **Rage**: rebalance the generator/payoff ratio and move at least one spender to T2, or redesign
    rage as a non-pool resource?
