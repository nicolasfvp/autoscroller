# SIM-BALANCE-PROPOSAL — FINAL (gap-closed + first-hand-verified)

This supersedes `SIM-BALANCE-PROPOSAL.md` (the synthesis draft). It folds in the
completeness critic's gap list AND a first-hand verification pass run by the lead.
Evidence base: 12 adversarial lanes (designer+adversary each), **1,140 simulated
matchups** (~4,500 combats) under `tests/audit/wf/*/`, plus the lead's own
`tests/audit/verify-boss-levers-results.json`. Methodology: the real `CombatEngine`
driven headless (faithful STR/elemMult scaling, rage Fury, wall-clock DoTs, burn
soft-cap, relics). Every change obeys **C1–C5** and the **T3>T2 charter (buff the T3,
never nerf the T2)**.

> **Engine caveat baked into all conclusions:** the deck plays in **fixed array order
> with no shuffle** (`CombatState.deckOrder`). A swap-tested card in a late slot may
> never be drawn → false "zero value" ties. All findings below rest on BANK-shell,
> front-loaded, or clean tier-A/B evidence; last-slot-swap-only claims were dropped.

---

## 0. The headline question, answered: "Can the average loop-10 deck beat the first
boss (doom_knight), which should be easy?"

doom_knight = 380 HP / def 3 / **9 dmg** / cd 2.5s / enrage ×1.4 at 50% HP (loop 10,
difficulty ×1.0). **Answer: NO, not at a comfortable margin — and the reason splits
cleanly in two.** Lead's verified numbers (8 reps, realistic boss1 profile runXP 520):

| realistic deck | vs doom_knight (dmg9) | with **dmg7** | with HP350/dmg9 |
|---|---|---|---|
| warrior physical | win, **3.3% HP** (razor) | win, **13.9% HP** | win, 3.3% (HP lever ~inert) |
| warrior bleed/rage | win, **4.6% HP** | win, **14.6% HP** | — |
| **mage burn** | **LOSS 0/8** (210 dmg) | **LOSS 0/8** (212) | **LOSS 0/8 even at HP320** |
| mage direct (fire/air/earth) | **LOSS 0/5–0/6** | **LOSS** (boss tuning doesn't help) | — |
| mage poison / armor-bruiser | win, ~20% HP | (already fine) | — |

Two independent root causes, two independent fixes:

1. **Boss-curve problem (enemy side).** Warrior/clean decks win only on fumes. The
   verified lever is **doom_knight attack damage 9 → 7** (cushion 3.3%→13.9%, lead-
   reproduced; matches lanes BP-1/ER-1 within 0.0%). HP trims and enrage softening are
   ~inert on the cushion (enrage 1.4→1.25 = no change in two lanes; HP380→350 left
   warrior at 3.3%). **→ cut doom_knight damage 9→7. Keep HP 380, def 3, enrage 1.4.**

2. **Card-economy problem (cards side).** Burn and direct-damage mages **physically
   cannot output 380 before dying** — lead-verified: burn deals ~210 even when the
   boss is nerfed to HP320. **Boss tuning cannot rescue them**; they need the §3/§4
   card buffs. This is the gap the draft punted on (critic B1) — resolved in §3/§4.

---

## P0 — Ship first (verified, high impact, low risk)

| # | Change | Why (evidence) | Constraint |
|---|---|---|---|
| P0-1 | **doom_knight `attack.damage` 9 → 7** | Lead-verified cushion 3.3%→13.9% (warrior phys), 4.6%→14.6% (bleed). Makes the "easy" first boss actually have a margin without trivializing (race decks still finish ~14–22%). | enemy tuning; does NOT rescue burn/mage (those = P1). |
| P0-2 | **iron_golem: defang the defense-affinity ratchet** — set `affinity` off `"defense"` (→`"attack"`/`"earth"`) **or** in `EnemyAffinity.ts` cut boss defense-affinity gain `3*m=6 → 3` and cap `60 → 24`; also shield `+8/8s → +4/8s`; trim baseHP `400 → 360`. | iron_golem is a **non-monotonic spike**: same late deck LOSES it 0/5 but WINS lizard_king (5/5) and bog_witch (5/5) which come AFTER it. Adversary *ran* the designer's `baseDefense 4→3` fix → still 0/5; the affinity armor-ratchet is the real driver (code-confirmed). | enemy tuning. **Side-effect to decide (critic D1):** the `EnemyAffinity.ts` edit is global — it also touches `desert_golem`/`boss_iron_golem` (also armor-stackers). Treat that as intended; spin a follow-up lane to confirm their curves. |
| P0-3 | **Earthcleaver `t3-attack-defense-earth`**: cd 2.4→2.0, armor gate 15→10, base 14 → **Pierce**. | Strongest tier violation: identical 12-card deck, 4×T2 Granite Lunge **WINS 8/8** (380 dmg, 6% HP) vs 4×T3 Earthcleaver **LOSES 0/8** (316 dmg). Granite is cheaper/snappier; Earthcleaver's pierce is gated behind unreachable armor. (PA-7, 8 reps.) | C1 + T3>T2; **buff the T3 only**, Granite untouched. |
| P0-4 | **Mountain's Will `t3-attack-earth-earth`**: cd 2.4→2.0, base 20 → **Pierce**. | swap vs doom_knight 0/4 (dies) while cheaper T3s win; adversary: swapping *just this card* for a pierce T3 turns the realistic balanced deck 0/8 → **8/8**. **Single weakest-link fix that makes warrior physical beat the boss comfortably.** | C1; buff T3 only. **Apply P0-4 alone, re-sim, THEN decide P0-3/P1-phys pierce** (critic B3: shipping 3 pierce T3s at once over-corrects). |

---

## P1 — The magic damage path (the burn/mage boss failure; cards, not boss)

**C2 elemMult resolution (critic B1/E).** To clear the boss a low-INT mage needs
elemMult ≈1.55–1.60 at INT3 (lane: 1.45 still lost, 1.60 won). But C2 requires
elemMult < same-level strMult: at late INT4 vs STR4 (strMult 1.75), elemMult must stay
≤1.75 → rate ≤0.25. The two constraints **conflict** — elemMult alone cannot both clear
the boss at INT3 and respect C2 at INT4. **Resolution: a combined fix, not one dial.**

| # | Change | Why | Constraint |
|---|---|---|---|
| P1-1 | **elemMult 0.15/pt → 0.22/pt** (`1+(elemStat-1)*0.22`). | INT3→1.44, INT4→1.66 — competitive, strictly below same-level strMult at every stage (INT4 1.66 < STR4 1.75). A real buff without breaking C2. | C2; never touch STR. **Magnitude UNVERIFIED — re-sim required** (lane found 0.22 alone under-corrects; it must combine with P1-2/P1-3). |
| P1-2 | **Flat lift on cheap INT staples:** Steam Surge `t2-fire-water` Deal 4→6; Spark `t1-fire` add Deal 2 + cd 1.4→1.2. **Do NOT touch Flame Dart** (already top-OPS, DEX-scaled; buffing it makes a NEW T3>T2 violation vs Boilstep). | def 3 eats ~half of every small mage hit (Deal4×1.30−3 ≈ 2 landed). | C2/C5; adversary dropped the Flame Dart buff. |
| P1-3 | **Burn detonator T3s** (the burn win-condition; NEVER the C5-locked tick): Cinderlance `t3-attack-fire-fire` cd 2.2→1.8, det 3→4 Pierce/burn; Cinder Sprint `t3-agility-fire-fire` det 4→5 + Pierce; Venom Detonation `t3-counter-fire-water` coeff 2→4 Pierce + consume BOTH burn AND poison; **Tremor Detonate `t3-attack-fire-water` per-stack 3→5 Pierce, remove [exhaust]** *(critic A3 — was cited but never actioned in the draft)*; **Supernova `t3-fire-fire-fire` cd 2.8→2.2** *(critic B2 — adopt the BP-5/ER-2 C1 cd-cut; it's exhaust/one-shot, not oppressive)*. | Confirmed **inversion**: pure-tick burn WINS doom_knight (6/6, 384) while bank-and-detonate DIES (6/6, 222) — detonating dumps one armor-taxed chunk then resets at enrage. Only Cinder Sprint/Supernova currently clear; Cinderlance/Venom/Pyre LOSE. | C1/C5; buff T3s, never the tick (HC-6 soft-cap edit **DECLINED** — C5 locked). |
| P1-4 | **Quench Lance `t3-fire-fire-water`**: cd 2.4→**1.3** (match Steam Surge), base 2→4 burn, INT-gate 10→6. | Outright T3<T2: Quench Lance LOSES fights Steam Surge WINS (fire_elemental 0/4 vs 1/4; salamander 0/6 vs 1/6). Two lanes agree (TO-3, PB-7). | C1 + T3>T2; never nerf Steam Surge. |

> **Re-sim gate (critic B1/C):** after P1-1..P1-4, re-sim a **realistic 12-card** burn
> deck AND fire/air mage vs doom_knight. The pure-burn adversary found a realistic burn
> deck still topped at **353 < 380** even with detonator buffs. If still <0.8 winRate at
> a real cushion, the **conditional doom_knight HP trim 380→350 becomes MANDATORY for
> these archetypes** (not optional) — burn deals only ~210 today (lead-verified), so it
> needs a large lift and may require both the card buffs AND the HP trim.

---

## P2 — Dead / off-curve cards (rescue weak; rein in nothing — none were oppressive)

### Tier violations (all BUFF the T3 via cd-cut/ceiling, never nerf the T2)
| T3 card | loses to (T2) | fix | lane |
|---|---|---|---|
| `t3-earth-fire-water` Alchemic Drain | Mire Bloom (T3 0/6 deaths, T2 6/6) | cd 2.4→1.6, poison 3→4, Heal 6([spi]) | PP-5 |
| `t3-defense-defense-water` Stagnant Bulwark | Bulwark Vow | cd 2.4→1.6, aura 1→2 poison/2s | PP-3, TO-1 |
| `t3-defense-defense-earth` Stoneward Reprisal | Bulwark Vow (ttk 60.1s@0.106 vs 39.7s@0.351) | cd 2.4→1.6 | TO-2 |
| `t3-water-water-water` Tidesong Aura | Frostbind | cd 2.4→1.8, heal 18→22([spi]) | TO-7 |
| `t3-counter-earth-water` Bogwrath | (Brace-gated dead) | drop Brace gate → unconditional 4 poison; cd 2.4→1.6 | PP-4 |
| `t3-counter-water-water` Tidefoot Bloom | (OPS 0, exhaust) | remove exhaust, up-front 4 poison floor; cd 2.2→1.6 | PP/OCS-6 |
| `t3-fire-fire-water` Quench Lance | Steam Surge | see P1-4 | TO-3, PB-7 |

### Dead T3s / off-curve weak (rescue so they're not auto-skipped)
| card | problem | fix | lane |
|---|---|---|---|
| `t3-defense-defense-defense` Aegis of Returning Wrath | +Aegis = 0/5 deaths, LOWER dmg than filler (300 vs 378); "Brace: Deal 18 Pierce" fires on `on_armor_break` which an armor deck never triggers | rewrite payoff unconditional+armor-scaling: "Gain 22[armor]([vit]). Deal 6 Pierce, +1 per 4[armor]." (no Brace gate); cd 2.4→2.0 if needed | ARMFIN-2 |
| `t3-counter-counter-water` Crimson Cascade | dead single-target (kill-chain clause 100% dead 1v1); self-bleed pure downside | base bleed 3→4, **remove self-bleed**, cd 2.4→2.0 | BR-4 |
| `t3-air-air-counter` Stormrage | fully rage-gated → mage holds no rage → does nothing (loses 8/8 where filler wins) | add floor: "Apply 5[slow]([int]). If [rage]: 8 more." cd 2.4→2.0 | SSC-3 |
| **`t2-counter-counter` Razor Stance** *(critic A1)* | loses doom_knight 0/6 (@368) where a T1 Jab WINS 6/6 (@388) | cd 2.0→1.4, add "Deal 3([dex])" on play | OCS-1 *(guardrail: keep bleed-per-hit at 1 so Razor Cadence T3 stays ahead — OCS-9)* |
| **`t3-air-counter-counter` Wrath Squall** *(critic A2)* | NEGATIVE marginal value: 0/6 (@348) < a Jab's 375 — a T3 worse than a T1 filler | cd 2.0→1.5, add "Gain 4([vit])[rage]" on play (within C5 Fury cap 12) | OCS-2 |
| `t3-attack-attack-counter` Bloodlash Salvo | slow STR-ramp, def-taxed; loses 0/4 | in-combat STR gain 4→6, hit → Pierce | PA-5 |
| `t3-counter-counter-counter` Crimson Spiral | 8-rage gate brick, loses to Jab both regimes | gate 8→5 rage, cd 2.4→1.8; floor 12 Pierce if still ≤Jab | BR-2 |

### Poison detonators — a strict trap (C4 wiring fix, NOT a cost hike)
Consuming the full quadratic poison pool destroys the n(n+1) ramp: plain applier WINS
doom_knight 5/5@20.7% HP; swap in **Drowning Lance → 0/5 deaths**, **Marsh Squall →
0.033 HP**. Fix so they **consume only HALF** the pool (leave the rest ticking):
- `t3-attack-water-water` Drowning Lance — consume ½, base 4→6 Pierce, per-stack 3→5, cd 2.4→1.8.
- `t3-air-earth-water` Marsh Squall — per-stack 4→6, consume ½, cost 2s+2m→2s, cd 2.4→2.0. *(AoE upside untestable in 1-enemy sim — multi-enemy probe needed.)*

### Control rescues (keep pure control; never add slow/stun damage — C3/C5)
- `t2-water-water` Frostbind cd 2→1.4; `t1-earth` Quake cd 2→1.4 (keep 4 slow, re-measure before any value add);
  converters `t3-air-attack-counter` Thunderstrike Catalyst cd 2.4→2.0 and `t3-agility-air-counter` Static Skirmish cd 1.8→1.6 (both already Pierce).

### Normal-enemy ramp
- `depths_horror` baseHP 95→150 and `fire_elemental` 102→150 (late battery is trivially soft, killed in 4–6s). lost_lizard: accept as gentle intro or buff damage 2→5 (low priority).

### MS-6 decision *(critic A4)*: earth-control mage is the worst boss1 archetype (0/5, stays 0 even with +INT3). **Deferred, not dropped** — it is downstream of P1-1..P1-3 (mage scaling). Re-evaluate earth-mage viability after P1 lands before authoring a bespoke earth closer.

---

## Confirmed NOT to change (adversary-validated — do not re-introduce)
- **Burn DoT soft-cap formula** (HC-6) — C5 LOCKED. Fix burn via detonators only.
- **Supernova / Bog Catalyst / Brine Crucible / Dust Plague / Tectonic Reckoning** — NOT oppressive (self-limit via cost/exhaust; Brine Crucible's 158 isolated-OPS is a triage artifact — it LOSES real boss fights). No nerfs.
- **Mountain's Answer, Shield Bash, Cleaver's Tax, Bloodprice Strike, Bogplate/Magmaplate, Tombrage** — flagged then DECLINED (shell-contamination / harness-noise / non-reproducing). No change.
- **Agility spam (Quickstrike/Skywire/Quickstep Sigil)** — slower than balanced physical on normals; only shine vs bosses (a fair answer, not a trivializer). Quickstrike cost 2→1 is an optional isolated-stat cleanup only (not sim-proven).

## Required re-sims before shipping (acceptance gates)
1. After P1-1..P1-4: realistic 12-card burn + fire/air mage vs doom_knight ≥ 0.8 winRate; if not, HP trim 380→350 is mandatory for those archetypes.
2. Tabulate elemMult vs strMult per stage to prove C2 (elemMult < strMult at every bracket) before locking the 0.22/pt constant.
3. After P0-4 (Mountain's Will alone): re-sim warrior physical vs doom_knight before adding P0-3 / other pierce T3s (avoid over-correction).
4. After P0-2: re-sim late-physical vs iron_golem / lizard_king / bog_witch for a **monotone** curve; follow-up lane for desert_golem / boss_iron_golem (global affinity side-effect).
5. Multi-enemy probe for Marsh Squall's AoE per-stack buff.
6. Re-validate every swap-derived buff with the candidate in an EARLY deck slot (fixed-order engine).
