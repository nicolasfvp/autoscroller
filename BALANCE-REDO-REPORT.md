# Balance Redo — Final Report (2026-06-09)

Executed from `BALANCE-REDO-PLAYBOOK.md`. This pass **ground-truthed the game, built an attrition-correct sim calibrated to real play, fixed the systemic problems, and audited every card** — while refusing to ship any change a flawed metric merely suggested (the failure that broke the prior pass).

---

## 1. Why the prior sim was wrong (your tip: "check if the sim reflects the game")

The shipped sim overstated hero power on **four** independent axes, all verified in live code:

1. **No attrition** — it reset the hero to full HP every fight (`deck-battle-sim.test.ts` seeded `currentHP=1_000_000`). The real game persists HP across the whole loop (`CombatScene.ts:172` write-back; `CombatState.ts:228` starts at persistent HP).
2. **Out-of-combat HP capped at *base*, not leveled** — `run.hero.maxHP` is never updated by leveling, and all out-of-combat heals clamp to it, so the leveled HP pool was unreachable headroom. The sim started leveled fights at the higher *resolved* max.
3. **Elite premium omitted** — real combat applies HP×1.6 / dmg×1.3 to ~15% of spawns (`CombatScene.ts:358`); the sim never did.
4. **A phantom boss** — the prior stage-model ran a 7-boss order with `lizard_king` at #3. **`lizard_king` does not exist in `enemies.json`** (the real rotation is 6 bosses), so every deep-boss conclusion from #3 on was the wrong enemy. (`validate-data` independently flags a dead "Lizard King" reference.)

The playbook itself was also wrong on healing: rest-heal wasn't removed, it was **relocated to a free +30%-of-base-maxHP shop heal**; there is no gold heal item; stamina/mana refund 50% of their deficit each fight.

---

## 2. The corrected sim + calibration

Built `tests/audit/loop-attrition-sim.test.ts` — a **full-loop attrition harness** on the real `CombatEngine`: chains combats on one persistent `RunState` (HP/stamina/mana carry over, real healing, elite premium, per-kill XP, the real 6-boss rotation, planning-driven encounter density). **Calibrated to your real-play report:**

- Warrior starter deck wins **100% of every fight at full HP** (doom_knight at 37% cushion — matching the old sim) yet **loses 73–95% of *runs* under attrition** — *the deck wins every fight but loses the run.* That is the entire external-validity gap, reproduced.
- Difficulty swings on **planning intensity** (terrain-tile placement). You confirmed normal play ≈ light (~1 terrain/loop).

---

## 3. Shipped changes (all sim-verified, surgical, tests green)

### Systemic
| Change | Files | Evidence |
|---|---|---|
| **Heal-cap fix** — out-of-combat heals clamp to *leveled* maxHP via new `resolvedMaxHP()` | `HeroStatsResolver.ts`, `ShopScene.ts`, `InlineEvents.ts`, `LoopRelics.ts` | First-boss win @ light planning **38% → 87%** (all build qualities 71–100%); root cause of "first boss too hard" |

### Boss curve (jagged by *mechanic*, not depth; the §5 `+multi_hit` buffs were the common wall)
| Boss | Change | Evidence |
|---|---|---|
| infernal_dragon (b5) | `multi_hit` ×0.5 → **0.4** | #1 killer; optimized warrior **42% → 74%**, average stays pressured |
| iron_golem (b2) | shield 8 → **6** | warrior lift, mage unchanged |
| boss_iron_golem (b6) | affinity `defense → attack`, shield 12 → **6** | was an anti-physical wall (stacked armor 3 ways; only DoT won) → competent warrior **7% → 50%**, mages unchanged |
| desert_golem (b4) | **none** (assessed) | borderline-OK: competent warrior 85% / average 61%; the low "13%" was weak decks = intended gradient |

### Card text (honest-text batch — descriptions that *misrepresented* the mechanic)
Via formatter (`CardText.ts`) + `regenerate-card-descriptions.mjs` + integrity test:
- `cd_debt`: "Next card delays X" → **"This card delays X more seconds next time"** (it's *this* card's next cooldown; CardResolver:850). Affects Brine Crucible.
- `on_hp_pct_below` aura: "if you have less than X%[HP]" → **"the first time you drop below X%[HP]"** (the aura is single-shot, not sustained). Affects Stonewrath, Tombrage, Tombplate, Quickstone, Phoenix Aura.

All untouched bosses/cards are byte-identical across re-runs; full suite green (1 pre-existing unrelated font test fails).

---

## 4. Card audit — the roster is mostly well-tuned

- **Static audit (35 prior findings) re-verified vs live code: 17 already fixed, 18 actionable** → `tests/audit/STATIC-AUDIT-VERIFIED.md`. The actionable set is balance-smells (flagged), the text-clarity fixes above (applied), and deferred-content/dead-code (no action).
- **Rigorous power pass** (synergy-matched baselines + tier-peer controls + role-aware metrics + adversarial verification) **collapsed the naive "87 dead cards" to a narrow real signal.** No broad tier violations; the "dead" cards were Jab-control + wrong-context + DoT-metric artifacts.
- **Bleed "under-tuned" → REFUTED (no buffs).** Verified 3 ways: bleed ticks `stacks×perStack` (cap 60/tick) with −1 decay, so the swap metric forfeits the standing pool at kill; a longer-fight probe flips the "weak" cards positive (Vein Splitter −314→+384); the two persistently-weak cards (Crimson Spiral rage-gated, Berserker's Ledger honest self-bleed) work as designed.
- **Survival cards (heal/armor) → healthy, properly tier-ordered.** Redesigned the test to a calibrated ~40%-death operating point (`boss4-heavy`) so a single defensive card's survival delta is measurable. T3 survival median > T2 for both roles. Vindicated the methodology: the cards the damage-swap called "dead" (Tidesong Aura, Mend, Misting Veil, Aegis, Mountain's Answer) are the **top survival cards**. The "weak survival" entries are offense-hybrids mis-tagged armor/heal — correctly low. (`scripts/gen-survival-*` + `analyze-survival.mjs` → `survival-findings.md`.)

### Applied (the one card-power change to survive the whole rigorous pass)
- **Alchemic Drain** (T3) was strictly worse than its T2 sibling Mire Bloom (fewer effects at a worse cd) — an inspection-verified T3<T2. Buffed the T3 (poison 3→4, cd 2.4→1.6; Mire Bloom untouched). Verified: survival delta −0.699 → **+0.788** (off the T3<T2 list), poison-damage gap to T2 median −279 → −114, no over-correction. Description regenerated, card-integrity green.

---

## 5. Flagged / not done (your call)

- **Balance smells** (low-priority tuning, not bugs): Quickstrike (cost 2 vs peers' 1), Galekick vs Tempest Pike (cd), Body Slam Vow (armor→damage self-fuel), doom_knight counter affinity, desert_golem earth-drain warrior asymmetry. Documented in `STATIC-AUDIT-VERIFIED.md`.
- **Survival-card verdicts (heal/armor)**: deferred — the swap-test can't differentiate them without a redesigned high-pressure test (control was either comfortable=no-diff or dying=all-oppressive).
- **Possible C5 spec-vs-code gap**: bleed application is *uncapped* (`+=`) in code while C5 says "6 stacks, no merge." May be intended (6-cap applies to other statuses) or a divergence — flagged; not touched (C5 is locked).
- **Tooling note**: the sim's `avgDamageDealt`-at-kill metric under-credits DoT (standing pool forfeit) — any future poison/burn/bleed power call needs a standing-pool-aware metric.
- **Deck-library coverage gap**: no naive/optimized warrior decks at the deepest bands (boss4/boss6) in `decks-v2-full.json`.
- **Pre-existing, unrelated** (not introduced here): `StyleConstants` Inter/VT323 test; `validate-data` dead-refs (Lizard King, Giant Spider×2, green_field).

---

## 6. Reusable tooling (kept)
- `tests/audit/loop-attrition-sim.test.ts` — the attrition harness (lever knobs: heal %, heal-to-resolved, enemy/card overrides, planning model).
- `scripts/gen-attrition-matrix.mjs` + `analyze-attrition-matrix.mjs` — build-quality × depth gradient.
- `scripts/gen-boss-probe.mjs` / `gen-boss-refine.mjs` + `analyze-boss-probe.mjs` — boss A/B tuning.
- `scripts/gen-swap-attrition.mjs` + `gen-powerpass-swap.mjs` + `analyze-powerpass.mjs` — per-card swap-tests (synergy-matched).

## 7. Acceptance vs the playbook
- ✅ Sim reproduces the real-play failures (calibrated, demonstrated).
- ✅ First boss easy under normal (light) planning for all build qualities.
- ✅ Moderate gradient: early all-clear, mid pressured, deep mastery; boss curve smoothed.
- ✅ Every shipped change sim-verified + tests green; nothing shipped on an unvalidated metric.
