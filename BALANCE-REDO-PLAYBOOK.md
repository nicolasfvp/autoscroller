# Balance Validation — REDO PLAYBOOK (execute in a fresh context)

> **Why this doc exists.** A prior pass built an elaborate full-combat simulator, ran ~3000 sims, did multi-agent adversarial audits, and applied balance changes. Then a **manual play-test contradicted it**: the warrior base build couldn't beat a simple desert terrain enemy, and the first boss was still too hard. The sim **systematically overstated hero power**. This doc captures the full mission, the exact mistakes, and a corrected methodology so the job can be redone *accurately to the real game*. **Read all of it before acting.**

---

## 0. THE ONE MISTAKE THAT BREAKS EVERYTHING (read first)

**The simulator evaluated every fight as a rested hero at FULL HP in an isolated 1v1 duel. The real game is a war of ATTRITION across a whole loop with almost no healing.**

Hard evidence in the code (verify these first):
- `src/systems/combat/CombatScene.ts:172` → `currentRun.hero.currentHP = Math.max(0, finalState.heroHP)` — **HP persists between combats**; damage carries forward through the loop.
- `src/systems/combat/CombatState.ts:228` → `heroHP: Math.min(run.hero.currentHP, resolved.maxHP)` — real combat starts at the **persistent** currentHP, not max.
- `src/scenes/GameScene.ts:558` → comment: the **rest-tile auto-heal was REMOVED**. Between-combat healing is now ONLY: heal cards, rare inline events (`InlineEvents.ts`), shop heal (costs gold, `ShopScene.ts:762`), tiny per-loop relics (`LoopRelics.ts` +1/+5/+8), Lodestone Pendant on loop completion. A warrior with no heal cards just bleeds down across the loop.
- The sim harness (`tests/audit/deck-battle-sim.test.ts`, `makeRun`) **forced `currentHP = 1_000_000`** so every fight started full. That is the bug. It turns a war of attrition into a series of best-case rested duels.

**Consequence:** "win at 0.6 cushion" in the sim ≠ a real win, because the next fight starts at that 0.6, the one after lower, etc. Easy fights compound into a loss. This explains BOTH symptoms (lose a "simple" desert normal once worn; reach doom_knight already hurt → "too hard"). **Any balance number from the old sim is invalid until this is fixed.**

**The fix for the redo:** simulate the **FULL LOOP as a sequence of fights with persistent HP / stamina / mana / armor decay**, applying healing ONLY where the real game does. The unit of evaluation is "can this build survive loop N end-to-end," not "can it win one duel from full."

---

## 1. THE MISSION (what the user actually asked for)

Validate **ALL cards and ALL enemies** by simulating realistic play and producing a genuinely balanced game ("10/10"):

1. Build **realistic decks for different points in a run** (a likely loop-0 deck, loop-10 deck, … deeper), across **build archetypes** — **pure** builds AND **mixed** builds (mixed is the most likely real deck).
2. **Fight enemies** with those decks (normals AND bosses) across the run's progression.
3. From the data, determine:
   - which **cards** are stronger/weaker than their **tier average**;
   - which **archetypes** are strong/weak;
   - which **enemies/bosses** need **nerfs or buffs**;
   - **cards with unclear descriptions** or that don't clearly reflect their effect;
   - **bugged cards or enemies**.
4. **First boss must be EASY** — almost all builds, even weak ones, should pass it without trouble. (NOTE: the manual test says it currently ISN'T — treat this as a primary acceptance gate.)
5. Cover **build QUALITY** explicitly: **bad/random** builds (a clueless player) AND **good/synergized** builds (a master). Target shape ("Moderate"): early loops doable by ANYONE incl. random/bad builds; random builds wall out mid-game; **average** builds finish but **pressured late**; **optimized/synergized** builds comfortable. Late loops require mastery.
6. After producing findings, **revalidate with a batch of adversarial agents** that check EVERY test-integrity parameter (card coverage, build quantity, build diversity, bad-vs-good coverage, sampling, metrics, harness correctness, **and — critically — that outputs match GAME REALITY**).
7. Use as much capacity / as many agents as needed. Plan thoroughly, confirm decisions, produce a real, accurate output.

### Design constraints (C1–C5) — every proposal must comply
- **C1 Pricing:** resource cost (stamina/mana) is the PRIMARY power lever; cooldown stays snappy. Tier ≠ bigger cost/CD. Fix spam by raising COST; rescue weak cards by cutting CD. Only elite cards cost big in both.
- **C2 Scaling:** STR is the universal damage multiplier `1+(STR-1)*0.25`; magic gets `elemMult=1+(stat-1)*0.15` (magic-category, direct dmg only). Buff INT/DEX/SPI/VIT to compete; never remove STR's multiplier.
- **C3 Defense:** armor/heal/stun are INTENTIONALLY race-losing — elite at survival/control, NO broad armor→damage conversion (exactly ONE narrow armor→damage finisher line allowed).
- **C5 Status (locked, engine-implemented):** 6 stacks, no merge. poison/bleed quadratic DoT; burn bank-and-cash soft-cap; slow = pure soft control (NO damage); stun = pure hard control (NO damage); rage = Fury (never spent, flat dmg/stack cap 12, payoffs gate on threshold).
- **Tier charter:** T3 must out-CEILING T2 when assembled (~+15–25%), via build-around, NOT bigger cost/CD. Fix T3<T2 by BUFFING the T3, never nerfing the T2.
- "Too strong is usually fine unless oppressive (one card/deck trivializes everything). Too weak is bad (unused card) — flag those."

Source of these: `tests/audit/WORKFLOW-BRIEF.md` (still valid), memories `project-balance-rework`, `project-deck-sim-audit`, `project_full_validation_pass`.

---

## 2. ALL THE MISTAKES / LESSONS (so the redo doesn't repeat them)

1. **No external validity (THE big one).** The sim was audited for *internal* consistency (22-agent integrity audit, swap-tests, consensus) but **never ground-truthed against the actual running game**. The user's manual test was the first reality check and it failed. → **Validate the sim against the real game BEFORE trusting any number** (see §4 Phase 0).
2. **Full-HP-per-fight (see §0).** Persistent HP / attrition / minimal healing was ignored. This is the dominant error.
3. **Resource attrition ignored too.** Stamina/mana likely also persist or only partly regen between fights; the sim reset/over-supplied them. Verify carryover for ALL resources (HP, stamina, mana, armor, cooldown debt, per-combat buffs reset?).
4. **Combat mechanics never confirmed against reality.** The sim modeled isolated 1v1. Verify in code/real play: Is combat 1v1 or **multi-enemy / waves**? Does the hero **move/position** (it's an autoscroller — can it always attack, or only in range)? Are there **terrain/tile effects, traps, continuous/scroll damage, elite modifiers**? Does the player **manually play cards** or is it fully auto? (The headless sim assumed auto, fixed deck order — confirm.)
5. **Starting conditions assumed, not measured.** Base class stats, the real **starter decks** (`cards.json.starterDecks`), starting HP/resources, and especially **runXP per loop** were ESTIMATED. The manual test implies the real hero is weaker / enemies hit harder than assumed at a given loop. Measure these from real play, don't estimate.
6. **Balance changes were applied from an unvalidated sim.** Hero scaling, boss stats, and ~10 cards were edited (see §5). Because they were tuned to a full-HP sim, they likely **over-hardened the real (attrition) game** — consistent with "first boss still too hard." **Revert or re-evaluate all of §5 against the validated sim.**
7. **Internal rigor masqueraded as correctness.** Adversarial verification only asked "is the data self-consistent / does the finding follow from the sim?" — never "does this match the real game?" Adversarial passes MUST include real-game spot-checks.
8. **Deterministic sim looked clean but was clean on the wrong premise** (winrates 0/1, tidy matrix) — false confidence.
9. **One methodology bug WAS caught and is worth keeping:** the random/"bad-build" tier first drew uniformly from a catalog that is 73% T3, so "bad" decks were ~70% T3 (secretly strong). Fixed by tier-weighting draws to a realistic per-loop collection (loop2≈0% T3 → boss7≈63% T3). Keep this fix; it's correct.
10. **HP isn't the difficulty lever — DAMAGE is.** Mid-iteration finding: raising a boss's HP just makes a longer fight a durable deck survives; raising per-attack DAMAGE is what actually gates. (Now doubly relevant: under attrition, sustained enemy damage is the real threat.)

---

## 3. REUSABLE ASSETS (keep, but fix the inputs)

These work and drive the REAL `CombatEngine` — don't rebuild, but fix the HP/loop modeling:
- `tests/audit/deck-battle-sim.test.ts` — headless harness driving `CombatEngine`. **MUST be changed** to (a) NOT force full HP, (b) run a *sequence* of fights with persistent state.
- `scripts/expand-validation-matchups.mjs` — deck→matchup expander (per-stage enemy battery + boss). Extend to express a **loop sequence**, not isolated matchups.
- `scripts/analyze-validation-results.mjs` — aggregator + the **build-quality × loop-band matrix** (good concept, keep).
- `scripts/gen-random-decks.mjs` — random "bad-build" tier WITH the tier-weighting fix (keep).
- `scripts/swap-test.mjs` — per-card isolation marginal-value test (keep; gold standard for card verdicts).
- `scripts/build-validation-index.mjs` → `tests/audit/val/{cards-index,enemies-index,stage-model}.json` (canonical refs; re-verify stage runXP/mults against real play).
- The 443-deck library `tests/audit/val/decks-v2-full.json` (random/naive/optimized/mixed, quality-tagged) — reusable, but re-grade under attrition.
- Findings already produced (treat as HYPOTHESES to re-confirm under the fixed sim): `tests/audit/val/analysis/*.json`, `VALIDATION-REPORT-v2.md`, `CHANGES-APPLIED.md`.

---

## 4. THE CORRECTED METHODOLOGY (step by step)

### Phase 0 — GROUND-TRUTH FIRST (do NOT skip; this is what was missing)
- Read the real combat/loop/scene flow end to end: `CombatScene.ts`, `GameScene.ts`, `LoopRunner.ts`, `CombatState.ts` (init), `CombatEngine.ts`, `EnemyAI.ts`, `EnemyAffinity.ts`, plus healing sources (`InlineEvents.ts`, `ShopScene.ts`, `LoopRelics.ts`, level-up). Answer concretely: **start HP per combat; what persists (HP/stamina/mana/armor); every healing source & amount; is combat 1v1 or multi; movement/range; terrain/elite/scroll effects; auto vs manual card play; what XP a player really has at loop 1/3/5/10.**
- **RUN THE ACTUAL GAME** (use the `run` / `verify` skills). Manually play (or script) ≥3–5 specific scenarios and record real outcomes: e.g. warrior **starter deck** vs a desert tile at ~loop 3 (the failing case the user reported); starter vs the loop-10 first boss; a mid build through a full loop. 
- **Calibrate the harness until it REPRODUCES those real outcomes** within tolerance (win/loss + rough HP left). If the sim says "win 90% HP" where real play is a loss, the sim is still wrong — keep fixing inputs. **No balance conclusions until the sim matches reality on the calibration set.**

### Phase 1 — Model the FULL LOOP (attrition)
- Simulate a realistic loop as an ordered sequence of encounters (the real tile/enemy spawn model: `getEnemyPoolForTerrain`, `LoopRunner.assignEnemies`, ~loop length, elite chance) with **persistent HP/resources** and **only real healing** applied between fights. Per-combat-only state (armor, per-combat buffs, cooldowns) resets as the engine actually does; run-level state carries.
- Metric becomes **loop survival** (did the build clear loop N end-to-end, and with what HP entering the boss), plus per-fight detail.

### Phase 2 — Realistic decks across the run
- Include the **actual starter deck** + plausible drafted progressions. Keep the build-QUALITY axis: **random/bad** (tier-weighted), **naive/average** (coherent, unsynergized), **optimized/synergized** (mastery). Cover all 164 cards ≥3 decks across ≥2 tiers; every enemy/boss faced by all tiers.

### Phase 3 — The build-quality × loop-depth matrix (keep this)
- Grade each (loop band × quality) cell on **loop-clear rate + HP entering boss + boss win**, vs the Moderate target. Acceptance:
  - **First boss (doom_knight, ~loop 10): random/bad builds CLEAR it** (the user's hard gate — currently failing).
  - early loops: all qualities clear; mid: random starts failing; deep: random fails, average pressured, optimized comfortable.

### Phase 4 — Per-card / archetype / enemy findings
- Card strength vs tier via **swap-tests in matched-archetype baselines** (NOT whole-deck win-rate, which saturates). Tier violations → buff the T3 (C1). Off-curve-weak → rescue (cut CD). Enemy nerf/buff via the attrition matrix (remember: DAMAGE gates, not HP). Static audit for unclear/bugged cards (the prior static audit found 35 real ones — re-use, see `tests/audit/val/analysis/static-confirmed.json`).

### Phase 5 — Adversarial revalidation (now includes EXTERNAL validity)
- Batch of agents, ≥2 per parameter, checking: coverage, build quantity/diversity, bad-vs-good integrity, sampling, metric validity, harness correctness, **AND a mandatory lane that re-runs real-game spot-checks and confirms the sim still matches reality after any tuning.** Any "threatens-headline" finding → fix and re-sim before trusting.

### Phase 6 — Propose changes, then RE-VERIFY in the real game
- Only after the sim matches reality. Honor C1–C5. After applying, **re-run the real-game calibration scenarios** to confirm the change does what the sim predicts. Iterate.

---

## 5. CHANGES ALREADY APPLIED (SUSPECT — re-evaluate or revert first)

These were applied in the flawed pass and the user's manual test suggests they over-hardened the real game. Before redoing, run `git status` / `git diff` and decide whether to **revert to baseline** for a clean redo. Files touched:
- `src/systems/hero/HeroStatsResolver.ts` — **hero in-run scaling FLATTENED past level 7** (deep heroes ~halved). Under attrition this may now make the hero too weak. Strongly reconsider.
- `src/data/difficulty.json` — `percentPerBossKill` 0.10→0.15 (harder deep scaling).
- `src/data/json/enemies.json` — boss buffs: iron_golem (shield 4→8 +multi_hit), bog_witch (drain 15→25, HP 410→470, dmg 7→10), lizard_king (HP 370→440, dmg 10→13), desert_golem & boss_iron_golem (+multi_hit). **These make bosses harder — likely wrong given "first boss too hard."**
- `src/systems/combat/EnemyAI.ts` — boss shield cap 40.
- `src/systems/combat/EnemyAffinity.ts` — earth affinity stamina-drain 2→1, normal armor cap 15→10 (mush fix — this one is plausibly fine).
- `src/data/json/cards.json` — 10 card buffs (Supernova, Quench Lance, Tidesong, Gale Echo, Riposte, Cinderlance, Pyre, Thunderstrike Catalyst, Concussive Smash, Cleaver's Tax) via `scripts/apply-balance-batch-v2.mjs`.
- Batch-C engine-correctness fixes (per `CHANGES-APPLIED.md`): `CardResolver.ts`, `CombatEngine.ts`, `StatusEffects.ts`, `types.ts` (+`literal_damage`,`extend_aura`,`pre_consume`), `tests/systems/combat/batch-c-fixes.test.ts`. The **correctness** fixes (bug fixes, honest text) are probably worth keeping; the **balance** edits above are the suspect ones.

Recommendation: the engine **bug/correctness** fixes (Batch C) and the **mush earth-affinity** fix are likely keepers; the **hero-scaling flatten + boss buffs + scaling bump** were tuned to the broken sim and should be reverted and re-derived under the attrition-correct sim.

---

## 6. DONE-RIGHT ACCEPTANCE CRITERIA
- The sim reproduces ≥5 real-game scenarios (incl. the warrior-starter-vs-desert-normal and starter-vs-first-boss cases) within tolerance — demonstrated, not assumed.
- Evaluated over full loops with attrition, the matrix shows: **first boss clearable by bad/random builds**; a Moderate mastery gradient deep.
- Every card/enemy verdict is swap-test- or matched-baseline-backed; every applied change re-verified in the real game.
- A concise final report + a clean changelog the user signs off on before anything ships.

---

### TL;DR for the executor
Run the game first. Make the sim model a whole loop with persistent HP and the real (minimal) healing. Calibrate against real play until it matches. Only then validate cards/enemies and propose changes — and re-check each change in the actual game. The old numbers and the applied balance edits are suspect; the tooling, deck library, static bug list, and the build-quality matrix concept are reusable.
