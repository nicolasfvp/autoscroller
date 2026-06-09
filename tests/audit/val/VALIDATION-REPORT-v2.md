# Balance Validation v2 — bulletproofed assessment + fix plan

Graded against the **"Moderate 10/10"** standard: early loops doable by anyone (incl. random/bad builds); random builds wall out by mid-game; **average** builds finish but are **heavily pressured late**; **optimized/synergized** builds are comfortable. Output scope: **assess + fix-on-approval** (no game-data edits made yet).

Method: 443 quality-tagged decks (120 **random** seeded/realistic-collection, 71 **naive**, 71 **optimized**, 181 **mixed**) × full enemy roster → **2045 full-combat sims** on the real engine; a **22-agent test-integrity audit** (12 parameters, consensus); **isolation swap-tests** for every per-card claim; **35 code-verified bugs** from a separate static audit.

---

## VERDICT: the game FAILS the Moderate 10/10 bar — the difficulty curve is flat/inverted

The build-quality × loop-depth matrix (boss winRate / HP-cushion-on-win), after fixing a test-design flaw the audit caught:

| Loop band | random (bad) | naive (avg) | optimized | Moderate target | Pass? |
|---|---|---|---|---|---|
| 1–10 (doom_knight) | 0.93 / 0.65 | 1.00 / 0.60 | 1.00 / 0.55 | all win | ✅ (but too soft) |
| 11–20 (iron_golem) | 0.80 / 0.86 | 0.92 / 0.82 | 1.00 / 0.70 | random 60–85% | ⚠️ |
| 21–40 (lizard_king/bog_witch) | 0.95 / 0.89 | 1.00 / 0.80 | 1.00 / 0.72 | random fails | ❌ |
| 41–60 (desert/infernal) | 0.85 / 0.72 | 0.92 / 0.88 | 1.00 / 0.78 | random fails | ❌ |
| 61–70 (boss_iron_golem) | 1.00 / 0.74 | 0.92 / 0.79 | 1.00 / 0.69 | random fails | ❌ |

**Even realistic bad/random builds clear the whole game at 80–100% win and high HP cushion.** Mastery buys *reliability* (optimized = 100% win) but barely any survival margin — random/naive also clear. The curve is, if anything, **inverted on cushion** (bands 21–40 are the *easiest*). Only doom_knight and infernal_dragon impose any HP cost, and only thin.

**Root cause (confirmed):** hero power from in-run leveling (2–3× STR/INT multipliers + large maxHP + VIT mitigation by deep loops) **massively outpaces enemy scaling** (~+5%/boss, half-rate), so decks barely matter at depth. Compounded by **2 of 3 boss behaviors being inert**: `shield` (small) and `drain` do nothing against a DPS race; only `multi_hit` creates real threat.

---

## How this was bulletproofed (your "check every parameter" ask)

The 22-agent integrity audit ran **before** trusting any conclusion and **caught a real test flaw**:
- **The random tier was mislabeled** (build-quality-integrity A+B FAILED): `gen-random-decks.mjs` drew *uniformly* from a catalog that is 73% T3, so "bad" decks were ~70% T3 — random piles of the *strongest* cards. **Fixed**: tier-weighted draws modelling a realistic per-loop collection (loop2 = 0% T3 → boss7 = 63% T3). Re-ran the full sweep — **the headline survived** (random win-rate dropped only modestly; still 80–100%).
- **Fast-kills under-measure decks** (deck-cycling FAILED): 41–73% of deep fights end before one deck pass, so deck back-halves are untested. This is both a caveat *and* corroboration that enemies are under-tuned.
- **Per-card boss verdicts from whole-deck attribution are noise** — so every card claim below was re-derived by **isolation swap-test**, which **refuted ~half the OPS-based claims**.

Confirmed solid: harness (full-HP seeding, correct stat/boss scaling, 0 errored matchups), progression realism (random decks legitimately reach deep loops because they beat the prior bosses), card-coverage breadth (164/164).

---

## Findings (every card claim swap-test-verified)

### Bosses (the core problem — enemy tuning, C1-compliant, no card nerfs)
- **Curve flatness — CONFIRMED (high).** Re-grade the rotation so scaled stats rise monotonically and **per-attack damage** (the real lever) scales with depth.
- **doom_knight — too soft (nuanced).** Winnable but 6 base damage never converts a marginal deck into a loss (fat 0.66 cushion). **Fix: HP 380→460, dmg 6→10** (keep cd 2.5, enrage@0.5) → random fails at loop 10, naive ~0.3 cushion, optimized comfortable.
- **iron_golem shield (4/8s) — inert (confirmed).** Below per-hit damage, always absorbed. **Fix: shield 4→~16, interval 8000→5000ms** (or replace with multi_hit). (Larger golem shields 10–12 are NOT inert — leave.)
- **bog_witch drain (15%) — inert (confirmed).** Out-raced in ~17s; even tripled it does nothing. **Fix: replace with multi_hit / gate-relevant burst.**
- **multi_hit is THE threat lever (confirmed).** infernal_dragon (multi_hit×3) is the hardest boss. **Fix: standardize multi_hit (hitCount 2–3, dmgMult 0.7–0.9) on every boss from bog_witch (loop 40) onward.**
- **Scaling depth:** raise `percentPerBossKill` (0.10→~0.15) and/or boss base stats so threat keeps pace with hero leveling.

### Cards — tier violations (buff the T3, never nerf the T2 — all A/B-verified)
- **Supernova (t3-fire³) < Pyre — CONFIRMED.** Fix (verified): remove `exhaust`, cd 2.8→2.2, per-burn 5→7. (ttk 22000→19000ms, no trivialization.)
- **Quench Lance (t3-fire²·water) < Steam Surge — CONFIRMED.** Fix (verified): cd 2.4→1.6, burn 2→4, int-gain threshold 10→6, add ~6 hit.
- **Tidesong Aura (t3-water³) < Frostbind — CONFIRMED.** Fix: cd 2.4→1.6, lean its scaling identity (no armor→damage).
- **Gale Echo (t3-air³) — CONFIRMED off-curve weak** (negative marginal value off-theme). Fix: cd 2.4→1.6 + a flat body (Deal 4 + apply slow).
- **Riposte (t1-counter) — CONFIRMED off-curve weak.** Fix: cd 2.0→1.2, on-hit 3→5.
- **REFUTED (NOT violations — OPS was wrong):** Cinderlance, Cinder Sprint, **Pyre Surge** (actually the *best* burn card — its whole-deck burn-doubling is an OPS blind spot), **Tempest Cadence** (Haste accelerates the deck), **Razor Stance** (healthy bleed enabler). **Do not change these.**
- **Slipvenom Tempo** = correctly-tuned strong-T3 anchor; use as the calibration target for the buffed weak T3s.

### Cards — bugs (35 code-verified; selected)
- **Vengeful Pyre** (high): "Exhaust next card" does nothing (`exhaust_next` unimplemented); "double all rage" only doubles direct gains.
- **Cleaver's Tax** (confirmed wiring bug): its 4s self-cooldown penalty (`overload_lockout_ms`) is **never applied** → the card is silently stronger than its text. Implement the lockout or remove the text. (As a *tier* card it's fine — not a violation.)
- **Steaming Plague / Vein Splitter**: "If enemy has [poison]/[bleed]" gates are self-satisfied (always fire) → misleading text.
- **Shield Bash**, **Razor Stance**: description mismatches (documented). Plus ~20 lower-severity dead-effect/wording items in `static-confirmed.json`.

### Enemies (normals)
- **mush soft-lock — CONFIRMED but narrow.** Only thin loop-2 **warrior** decks (mages 100%); earth-affinity stamina-drain + armor-sprout vs floored low damage over a long fight. **Fix: HP 122→~95** (shorten the fight — the root lever).
- **mutated_salamander REFUTED** (1/187 = noise), **giant_spider nuanced** (a single no-damage random deck heal-race timeout; not a real problem).
- **16/19 normals trivially won = BY DESIGN** (difficulty lives in bosses). No normal buffs except mush.

### Archetypes
- **pure-burn — CONFIRMED thin vs the FIRST boss at BOTH quality levels** (optimized barely survives doom_knight at 0.13 cushion / 24s grind). Fix (verified, C5 ceiling not cost): raise burn-detonator per-burn payoff 3→5. **Note the interaction:** buffing doom_knight makes this worse, so the detonator buff is needed in tandem.
- **warrior & mage pure slow/stun-control — CONFIRMED viability problem** (naive dies iron_golem; optimized knife-edges doom_knight via ~58s grind). Fix (C3): control is intentionally race-losing and needs an *accessible secondary damage outlet* with a snappy CD — a **design change, flag for discussion** (do NOT add damage to slow/stun per C5).
- **Most archetypes are viable at both quality levels** (warrior physical/bleed/armor/bruiser; mage poison/poison-block/heal/detonator-control/mixed/poison-burn). No change. C3 defensive archetypes' high cushion is intended (durable-but-race-losing, not oppressive).

---

## Fix plan to reach Moderate 10/10 (Phase 6 — on approval)

1. **Boss rebalance (biggest impact):** doom_knight HP 380→460 / dmg 6→10; monotonic per-attack damage up the rotation; fix iron_golem's inert shield; replace bog_witch drain; standardize multi_hit on bosses ≥ loop 40; steepen `percentPerBossKill`.
2. **Buff the 5 confirmed-weak cards** (Supernova, Quench Lance, Tidesong, Gale Echo, Riposte) + the burn-detonator per-burn payoff — all with the verified numbers above.
3. **Fix the high/med bugs** (Vengeful Pyre, Cleaver's Tax lockout, self-satisfied gates, descriptions) + regenerate card descriptions + run integrity tests.
4. **mush HP cut.**
5. **Flag (design discussion, not auto-applied):** pure-control secondary win-condition.
6. **Iterate:** re-sim the matrix after edits; tune until random fails mid-game, naive is pressured late (~0.3–0.5 cushion deep), optimized stays comfortable. **Leave the refuted cards and viable archetypes untouched.**

## Confidence & caveats
- Headline (flat curve / fails Moderate): **high** — survived the integrity audit + the corrected random tier + boss-threat math.
- Card verdicts: **high** where swap-tested; the ~37 thin-boss-sample cards not individually swap-tested are flagged "insufficient data," not graded.
- Deep-boss exact magnitudes: **medium** (thin deck samples per deep boss; fast-kills under-measure 13–15-card decks). The fix plan's numbers are starting points to be re-sim-verified in Phase 6.

## Artifacts
`tests/audit/val/`: decks-v2-full.json (443) · results-v2.json (2045) · analysis/{quality-matrix, integrity-audit, rederived-findings, static-confirmed, enemy-summary, boss-report}.json · scripts/{gen-random-decks, swap-test, expand-validation-matchups, analyze-validation-results}.mjs
