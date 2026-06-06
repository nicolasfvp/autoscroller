# REBALANCE PLAN — 164-card autoscroller (8 elements × T1–T3)

> **Status: DISCUSSION DRAFT.** This is a plan to argue about, not an implementation order to execute. Numbers are
> starting points to sim against, not final values. Every section ends by pointing to the open forks in §8 — that
> section is the point of this document. Nothing here is committed until the forks are resolved.

> **Verification note.** Several proposal "affects:" counts were wrong; the adversarial judges re-derived them from
> `cards.json`. This plan uses the **verified** numbers: `on_armor_break` = **26 entries / ~19 distinct cards** (not
> ~8–15); **107 distinct cards touch ≥1 stack** (not 81); only **1 burn detonator is T2** (Pyre `t2-fire-fire`), not 3;
> all **4 rage spenders are T3**; `consume_stack_value` detonators use `-99` / `-999` consume values that are pure data.
> The audit metric model lives in **`tests/audit/balance-metrics.mjs`** (`meta.model`) — there is no metric file to
> "rewrite" elsewhere; the generator + `balance-metrics.json` must be regenerated after any DoT-realization change or
> the next audit is meaningless.

---

## 0. DESIGN PRINCIPLES (the C1–C5 north star)

These are hard constraints. Every proposal below complies or flags its tension explicitly.

- **C1 — PRICING.** Resource cost (stamina/mana) is the PRIMARY lever. Cooldown stays SNAPPY/LOW for almost everything.
  Only genuinely **elite** cards may be expensive in BOTH CD and resources. **Tier does NOT mean bigger cost/CD** —
  tiers differ by effect complexity / conditionality / build-around depth. Fix overtuned spam by RAISING COST; rescue
  weak long-CD cards by CUTTING CD and balancing on cost.
- **C2 — SCALING.** KEEP STR as the universal global damage multiplier (`1 + (STR−1)·0.25`, CardResolver ~L397). BUFF
  INT/DEX/SPI/VIT so they are competitive — stronger additives and/or **smaller-than-STR** per-element multipliers.
  Never remove STR's multiplier.
- **C3 — DEFENSE.** Armor/heal/stun are INTENTIONALLY race-losing. Make them ELITE at survival & control (mitigation,
  sustain, lockdown/stall) to BUY TIME for a second win condition. **No broad armor/heal→damage conversion.**
- **C4 — SCOPE.** (a) wiring bugs first; (b) cost/CD curve + rein in outliers; (c) rework dead/critical cards + the
  Brace/self-cost traps; (d) fix broken economies (rage loop, burn cap + consume-ALL cannibalization, detonator
  coefficients vs non-linear DoTs).
- **C5 — MECHANIC REWORK (invited).** Too many DoTs; decaying DoTs (bleed/slow/poison decay, tick-per-card-play) are
  hard to use; bleed and rage are under-curve. Consolidate/redesign — but **account for every orphaned card and propose
  the migration.**

**What "tier" means after this plan (the missing tier charter — proposed, see §8 D-12):** T1 = clean single-effect; T2 =
one conditional or one synergy hook; T3 = build-around depth (multi-stack payoffs, detonators, conditional ceilings).
**All three tiers target the SAME OPS band.** T3's promise is *ceiling-when-assembled*, paid for by a lower
unconditional floor — never by higher cost or longer CD.

---

## D0. LOCKED DECISIONS (discussion round 1 — these SUPERSEDE the matching §2/§8 forks)

Resolved with the user. The rest of the document's recommendations stand except where these override.

1. **Status taxonomy → KEEP 6 stacks, sharpen + fix ticking (do NOT merge).** Confirms §2's chosen graft.
2. **Slow → STRIP tick damage; slow = pure SOFT control (cadence throttle 8%/stk, cap 50%). Stun = pure HARD control (full freeze).** Resolves **D-6 = strip**. Consequence: ~26 slow cards lose chip damage and must have their other effects bumped/repriced; the `dotEquiv` model in `balance-metrics.mjs` must drop slow's damage term. Slow's whole budget moves into control value.
3. **Burn → BANK-AND-CASH.** Soft cap replacing `min(8)` (deep fire not wasted); detonators consume the **WHOLE** burn pool (the payoff); **ADD MORE burn-detonator cards** for variety — NOT multiple detonators per fight (two would cannibalize one pool; not intended). Resolves **D-7 = (b) bank-and-cash**.
4. **Detonator/payoff model is PER-STACK, not universal.** Resolves **D-8** as a hybrid:
   - **poison** → PARTIAL-CONSUME (skim K, the rest keeps ticking).
   - **bleed** → GATE-ONLY, never consumed (payoffs read "if enemy ≥ N bleed"; bleed keeps ticking). → bleed wants to PERSIST so gates stay lit: realize slower / decay less than poison (tuning sub-decision).
   - **burn** → CONSUME-ALL detonation (per #3).
   - **rage** → GATE-ONLY + passive (per #5).
5. **Rage → FURY model: passive, NEVER spent.** Each rage stack passively buffs hero damage (soft-capped, new engine: `rageStacks → damage contribution`); payoff cards GATE on a rage threshold (mirrors bleed). **Supersedes §2.7** (no demote-to-T2, no partial-spend): instead, convert the 4 T3 consume-all-rage spenders into gate-on-rage payoffs, and Crimson Tithe simply grants rage on cast (D-11 → Fork B, trivial since there's no spend timing).

6. **Defense win condition → ONE elite armor→payoff FINISHER (D-19).** Defense stalls, then cashes accumulated armor in a single big hit — **armor becomes a bank-and-cash resource (the defensive parallel to burn).** Keep & tune the narrow `scale.source:"armor"` + `spend_armor` cards (Citadel Inferno, Body Slam Vow, Shield Bash, Granite Lunge, Bulwark Salvo) as the capstone payoff; do NOT broaden — it stays a single narrow finisher, so C3 holds. Everything else defensive is pure survival/control. These cards peak 12–19 OPS today (at/below T2 median) → tune up so the cash-out is a satisfying win condition.
7. **Mage scaling → `elemMult` is DIRECT-DAMAGE ONLY (D-14).** Magic DoT magnitude (poison/burn) stays flat / stack-driven; INT scales only direct magic spells (+ mana). Implication: also keep INT-additive `scale` clauses OFF DoT magnitude — mage DoT decks win by stacking VOLUME & tempo, not stat investment. (Revisit the §4 re-point of DoT cards' `scale.stat` accordingly — direct-damage magic cards still get it; pure-DoT cards don't.)
8. **Tier charter → T3 gets a modestly HIGHER CEILING (D-12).** Not just depth: a fully-assembled T3 should out-output T2 by ~15–25% at the ceiling — but achieved through ASSEMBLY / build-around with a LOWER unconditional floor, **never** through higher cost or longer CD (C1 holds). Pricing §3 target bands become T1 ≤ T2 ≤ T3 *ceilings* via gating, on flat cost/CD.

**Still open (now mostly tuning):** pricing band numbers (D-10), `elemMult` rate (D-13), VIT mitigation curve (D-15), stun real-time-decay DR cap / net-new engine (D-9), heal survival floor (D-16), Brace re-anchor trigger (D-17), `survivalValue` audit scoring (D-18), self-cost invariant test (D-21).

---

## 1. WIRING BUG FIXES (do these FIRST — C4a)

A card's metric is only honest if its effects are wired. The audit OPS table currently lies on these cards; fix them,
then **regenerate `balance-metrics.json` before any tuning.** All three named bugs were independently confirmed in
source by the judges.

| Card | Bug (confirmed) | Fix | Verdict |
|---|---|---|---|
| `t3-air-fire-fire` **Pyre Surge** | `{kind: fire_damage_taken_pct, value: 1}` aura is read by NO damage path (only CardText/EffectIcons render it). The "+100% fire damage" half does nothing. | **Recommend FORK B** (1-line, zero engine risk): swap the aura kind to the already-wired `burn_taken` (read CardResolver ~L505) so Pyre Surge becomes a real burn-thickener/enabler. FORK A (implement `fire_damage_taken_pct` as a live fire-vulnerability multiplier on the burn tick + Pyre detonation) is stronger but silently buffs every burn card while it's in deck — defer to the burn-economy decision (§8 D-7). If FORK A: apply the vuln **AFTER** the burn min(8) cap so it doesn't double-buff. | bug → see D-1 |
| `t3-attack-counter-water` **Necrotic Festering** | Builds bleed on the **HERO** pool (`self_dot`/`heroBleedStacks`) but its detonator `consume_stack_value:'bleed'` reads the **ENEMY** snapshot (`bleedStacks` = 0). Headline always deals 0; its measured 32.73 OPS is a poison-conversion artifact. | `snapshotStacks` already exposes a `hero_bleed` key (CardResolver ~L34) → point the detonator at it (essentially one token), **and** decide it reads **LIVE** `heroBleedStacks` at detonation so the bleed it just applied counts (else cold-cast = 0). **NOTE the hidden trap (judge):** effect[1] (poison generator) is gated on `self_has_stack:'bleed'`; if you instead flip the body to enemy-bleed, that gate silently dies — this is a **3-effect rewrite**, not a 1-line flip. | bug → see D-2 |
| `t3-agility-counter-water` **Venom Dance** | `convert_stack to:'poison' side:'self'` hits `addStack`'s `default: return` (self has no poison case) → produced poison silently dropped. `spread{ratio,max_targets}` is inert on single-enemy state. 2 of 3 effects do nothing. | **2-effect rewrite** (preferred over an `addStack` self-poison hack, which is a latent trap for future cards): make the Vengeance clause convert hero bleed → **ENEMY** poison (or, post status-rework, fold both into Wound), and **delete the `spread` block**. | bug → see D-3 |

**Cross-cutting AoE/spread sweep.** `spread{}` exists on exactly **2 cards** (Venom Dance, Marsh Squall `t3-air-earth-water`)
and is read by NOTHING in combat. `target:'aoe'/'enemy_nearest'` appears on **14 effects / 9 cards** and already resolves
single-target — only the "to all enemies" prose is decorative. **Recommend:** delete the 2 `spread` blocks (pure no-ops;
CardText renders an AoE lie for them) and relabel the 14 aoe prose strings to single-target. This is **description
hygiene**, not a mechanic change. (Re-add when multi-enemy ships.) → see D-3.

**Dead TYPE unions (zero cards use them):** `ignore_immunity`, `on_self_dot_tick`, `on_cooldown_resolve`,
`missing_hp_pct`, `consumed_stack`, `enemy_pre_consume_stack`, `self_stack`. Optional code hygiene; orphan nothing.
(Correction: `passive_armor_scaler` is NOT dead — it's on Reforge Vow `t3-counter-defense-defense`; leave it.)

**Cleared as already-wired (no fix):** `burn_taken`, `hero_hit_bonus`, `stack_gain_mult`, `damage_taken_pct`,
`armor_bonus_pct/_flat`, `cd_reduction`, `passive_armor_scaler`, `scale.source:'armor'`. The 26 `on_armor_break` entries
ARE wired — they're a **design trap** (§5), not a wiring bug.

---

## 2. STATUS / DoT SYSTEM REWORK (C5) — the contested piece

### The decision

Three competing proposals: **consolidate** (6 stacks → 4: Wound/Burn/Frost/Rage), **remodel-tick** (keep 6, move ticking
to wall-clock + investment-guarantee), and **identity-loops** (keep 6, sharpen each, strip slow's damage). The judges
were sharply split:

- The **Wound capitalize-half realization rule** (consolidate) is "the single best idea" — it kills root-cause #7
  (tempo-gated DoT) and brings bleed onto curve with one engine branch — **but** the *consolidate* package's Frost
  merge is "the weakest leg" (keeps decay AND adds a guessed binary freeze cliff), and its migration math is wrong (107
  cards, not 81).
- The **wall-clock tick accumulator** (remodel-tick) is "the keystone fix" and verified as a single clean insertion
  point (L309 is the only call site; `combatElapsedMs` already live) — **but** its headline "investment guarantee"
  oscillates between a heavy refactor and a light parity-flush, and it never analyzes the second-order effect on
  slow/stun cd-control and the bleed swing window.

### Chosen design — a graft: **"Capitalize Wound + Wall-Clock ticks, keep 6 stacks, sharpen not merge"**

We adopt the **strongest verified ideas from all three** and **reject the risky merges**:

1. **KEEP all 6 stack IDs** (poison, bleed, burn, slow, stun, rage). The Frost (slow+stun) merge re-introduces a binary
   cliff C5 is trying to remove, keeps decay (so only half-solves the usability problem), and orphans the relic plumbing
   (`stormglass_lens`, `frostbite_charm` are hard-wired in engine code, not just data). **Do NOT merge** — sharpen
   identities instead. **Orphan count avoided:** the 23-card Frost relabel + StackId-union rewrite + 4 hard-wired relics.
2. **Wall-clock DoT ticking (the keystone).** Move `tickActiveDoTs` off the per-card-play call (CombatEngine **L309**)
   onto a wall-clock accumulator in `tick(deltaMs)`: accumulate into `dotTickAccumulator`, fire every `DOT_TICK_MS`
   (~750–1000ms, fork D-4). This decouples DoT value from deck TEMPO and is the root fix for root-cause #7. **Orphans: 0**
   (realization changes, effects don't). **Affects: all ~50 DoT appliers re-tune simultaneously** (poison ~20–23, slow
   ~18–19, burn ~23–24, bleed ~8–9 enemy-appliers).
3. **Capitalize-realization for the decaying DoTs (poison + bleed), the headline.** Replace whole-stack-per-play decay
   with: each tick, deal a fixed fraction of the pool and remove that many stacks (`ceil(n/2)` proposed), **no flat −1
   decay**. Banked stacks are never wasted by slow tempo. **Add a per-tick chunk CAP (~60)** to protect the OPS ceiling
   against geometric pools (Bog Catalyst `t3-earth-earth-water` → 1530 stacks). This is the *consolidate* proposal's
   best idea, applied **without** the merge.
4. **Bleed comes onto curve** as the "aggro amplifier": KEEP the swing ×2 (`enemyAttackedSinceLastBleedTick`) as the
   *upside* on top of capitalize-realization. Non-decaying + capitalize roughly doubles realized bleed for slow decks;
   today it's 0.75·n(n+1) (median 17.5 OPS), below poison's n(n+1). Re-cost up per C1, keep CD snappy.
5. **Burn — lift the cap + budget the detonators.** Replace the hard `min(stacks,8)/tick` (CombatEngine **L454**) with a
   soft diminishing curve (`8 + floor((stacks−8)/2)` proposed — flattens, never flatlines), so deep fire isn't thrown
   away. Convert every "consume ALL" detonator (`-99`/`-999`) to **budgeted partial consumption** that pays
   **super-linear on the consumed amount**. **This is essentially free** — `CardResolver` `consumeFrom` (~L556) already
   does `min(cur, wantConsume)` and `consume_stack_value` (~L263–274) already snapshots pre-consume and multiplies, so
   changing the consume values from `-99`/`-999` to finite `-K` is **pure data, zero engine work**. Affected detonators:
   Supernova `t3-fire-fire-fire` (`-999`), `t3-attack-fire-fire`, `t3-attack-fire-water` (Tremor Detonate),
   `t3-agility-fire-fire`, `t3-counter-fire-water` (each `-99`); convert_stack `99` on Ember Aegis Gust
   `t3-air-defense-fire` + Brine Crucible `t3-counter-fire-fire`.
6. **Detonator pricing vs non-linear DoTs (C4d).** Poison/bleed are super-linear (`n(n+1)`); flat-coeff detonators lose.
   **Verified trap:** Drowning Lance `t3-attack-water-water` deals 16 vs 20 destroyed at N=4 → net-NEGATIVE at N≥4.
   **Recommend the universal PARTIAL-CONSUME primitive** ("skim K, leave the rest ticking") — one change fixes
   Drowning Lance, burn cannibalization, AND rage all-or-nothing spend. The alternative (super-linear coefficient on a
   full consume) is also viable but the two levers shouldn't both be maxed (D-8). Affected: Drowning Lance, Marsh Squall,
   Tremor Detonate, Necrotic Festering (post bug-fix), `t3-air-attack-counter` (slow detonator), Supernova, Crimson
   Spiral (rage).
7. **Rage comes onto curve — close the loop (C4d/C5).** Confirmed: rage does NOT decay; all **4 spenders are T3**, the
   template (Cleaver's Tax `t3-attack-counter-counter`, `value:-5` with `self_stack_atleast`) already works.
   - (a) **Demote one spender to T2** so generators have an in-tier sink (Cleaver's Tax is the natural template — one
     field edit; or author a new small T2 counter vent — D-5).
   - (b) **Switch consumers from full-vent to partial-spend with a per-stack floor** (reuse the partial-consume primitive)
     so a half-built loop still pays. Crimson Spiral `t3-counter-counter-counter` (`-99`) can stay as the elite full-vent
     bomb (D-8).
   - (c) **Per-stack scaling on Wrath Brand** `t3-attack-counter-fire` — today its flat binary gate makes it
     under-output its own T2 generator Reckless Strike (55.83 OPS). Give it consume-up-to-K + per-stack.
   - (d) **Fix Crimson Tithe** `t2-attack-water` — grants 0 rage on its own cast (aura placed AFTER self-damage; baseOPS
     −1.56). **Recommend Fork B:** drop the self-damage gimmick, grant rage directly on cast (the reorder Fork A does
     NOT hold — `on_self_damage` is a `fireRecurringTrigger` read inside `applyHeroDamage`, so the aura isn't live for
     the same effect; D-11).
8. **Slow & stun stay distinct** (no merge), but **credit the control half** in the metric (slow medians 25.0 OPS partly
   on chip; its cd-slow is undervalued) and make stun the **elite lockdown** flavor (see §5). **Open fork (D-6):** the
   *identity-loops* proposal wants to **strip slow's tick damage** entirely (slow = pure control, stun = pure freeze) to
   de-duplicate the DoT taxonomy — strong C5 idea, but it re-costs 26 cards and **invalidates the dotEquiv model** in
   `balance-metrics.mjs`, so it must be gated behind regenerating the audit harness first.

### BEFORE → AFTER per stack

| Stack | BEFORE | AFTER (chosen design) |
|---|---|---|
| **poison** | `n` dmg/tick, decays 1 every 2nd tick → ~`n(n+1)`. Tempo-gated. | Wall-clock tick; **capitalize `ceil(n/2)` per tick, no flat decay**, per-tick cap ~60. Investment-guaranteed. Re-tune ALL ~23 appliers (NOT "pure relabel"). |
| **bleed** | `n·(2 if swung else 1)`, decays 1/tick → ~`0.75 n(n+1)`. Under-curve. | Wall-clock + capitalize realization; **swing ×2 kept as upside**. Onto curve. Re-cost up, CD snappy. |
| **burn** | `min(n,8)`/tick, no decay, consumed only by "consume ALL". Cap wastes deep fire; detonators cannibalize one pool. | Soft cap `8 + floor((n−8)/2)`; **budgeted super-linear detonators** (data-only). Multiple detonators coexist; detonating beats ticking. |
| **slow** | `n` dmg + cd-slow 8%/stk (cap 50%), decays 1/tick. | Wall-clock tick. KEEP as damage+control hybrid; **credit control half**. (FORK D-6: strip damage → pure control.) |
| **stun** | No damage; full cd-freeze; decays 1/tick (per play) → evaporates in slow decks. | **Decay on a real-time timer** so control decks keep the lock; promote to elite lockdown (§5). FORK: needs a stun-uptime DR cap or it trivializes fights (D-9). |
| **rage** | Inert counter; 4 all-consuming T3 payoffs vs ~13 generators; loop never closes. | Non-decaying resource; **1 spender demoted to T2**, **partial-spend + per-stack floor**, Wrath Brand per-stack, Crimson Tithe fixed. Loop closes. |

### Migration accounting (use the VERIFIED surface)

- **107 distinct cards touch ≥1 stack** (poison 29, bleed 19, burn 38, slow 26, stun 9, rage 15; overlaps net to 107).
- **Keeping 6 stacks means ZERO relabels** and ZERO StackId-union/relic rewrites — the merge's ~107-card text migration
  and 4 hard-wired relic rewrites (`hemlock_vial`, `crimson_stiletto`, `stormglass_lens`, `frostbite_charm`) are
  **avoided**. This is the main reason the graft picks "sharpen, not merge."
- **Re-tune (not relabel):** ~23 poison + ~9 bleed appliers under capitalize-realization (their totals change — "pure
  relabel, no number change" was a fiction). ~5 detonators repriced (data). ~10 rage cards. The 5 burn detonators +
  2 convert_stack cards (data).
- **convert_stack bridge cards** (Brine Crucible burn→bleed, Venom Dance bleed→poison): without the merge these are NOT
  no-ops — they still bridge two live pools. Re-tune in place or give a fresh identity (D-3 / economy pass).

---

## 3. COST / CD PRICING MODEL (C1, C4b)

**The single biggest lever** (root-cause #1): tier is decorative for cost. T3 median OPS 12.31 < T2 14.86 only because
T3 silently pays longer CD (avg ~2.7 vs T2 top 0.8–1.6) and a second resource (43/120 T3 cost stam+mana; 24 of those at
peakOPS ≤ 12), while the ceiling is set by sub-1s spam and 7 free cards outside the economy.

### The pricing rule (drain = cost / effectiveCD)

Anchored to the **verified** regen: +1 stamina & +1 mana / 4500ms = **0.222/resource/s**, sustainable line **≤ 0.72/s**.

- **CD default band 1.2–2.0s** (treat 1.6s as "normal"); **floor 1.2s — no more sub-1s cards.** CD is NOT a power or
  tier dial.
- **Cost is the lever.** COST-0 (free) → utility/no-output only. COST-1 (1 stam OR 1 mana, ~0.625/s at cd1.6) → standard
  spammable. COST-2 (2 of one, or 1+1) → high-output you ration (~1.25/s, a burst you can't spam). COST-3 (2+1 / 3) →
  bomb only.
- **Elite-only dual-expensive:** a card may cost big in BOTH CD (≥2.4s) AND resources (≥2 total) **only** if genuinely
  elite (pool-cashing detonator, fight-swinging bomb, exhaust one-shot). Needs a **whitelist** so the exception doesn't
  creep (D-10). Everything else picks ONE axis.

> **Acknowledged tension (judge):** a set-wide ~22–28 sustainable peakOPS band is partly *unreachable* once we raise the
> CD floor to 1.2 and cost the free cards (today's anchor cards hit it via sub-1s CD or free cost). **Adopt the
> principle** ("one band, tier buys gating not size") but **re-tune the band number downward** to reconcile with the
> 1.2 floor, or label 22–28 a burst-only ceiling (D-10).

### Reprice the overtuned outliers — by COST, CD stays snappy

| Card | Now | Fix (C1) |
|---|---|---|
| `t2-agility-attack` **Quickstrike** | 72.5 OPS, **cd 0.8**, s1 | s1 → **s2**; cd 0.8 → **1.2** (floor only, not the nerf). Becomes a burst you can't spam. Body unchanged. |
| `t2-air-counter` **Hollow Echo** | ~28.96 true, **null cost**, +15% haste loop | null → **s1** (re-enters regen economy; `canAfford` returns true for null today). Trim the self-haste if it stacks to permanent uptime. |
| `t3-agility-agility-agility` **Quickstep Sigil** | ~76 true, s1 (cheapest T3), **deck-wide 30% cd aura** | s1 → **s2**; aura **30% → ~15%** + shorter ttl, OR self-only (D-10). Keep cd 1.8. Confirm vs the 40%-floor cap (StatusEffects ~L259). |
| `t3-agility-air-attack` **Skywire** | 56 burst @ s2/cd1.5 | EITHER +1 mana (honest COST-3 burst) OR drop `multi_hit:2→1` (keep snappy-cheap). CD stays 1.5. (D-10) |
| **The 7 free cards** | drain 0, outside economy | Cost each 1 of its element's resource: `t1-air`, `t2-air-air`, `t2-agility-defense`, `t2-agility-water`, `t2-counter-water`, `t2-air-counter`, `t2-air-defense`. Several refund a resource → net-zero but economy-bound (gentlest migration). `t1-air` Gust (peakOPS 0) is the one defensible free pure-utility card (D-10). |
| `t1-agility` **Quickstep** | 28.89 @ cd0.9, s1 | The "Deal 4. Deal 4." template the set is implicitly balanced against. Out-sustains both tier medians. **OPEN whether to touch the baseline (D-10).** |

### Rescue the weak long-CD cards — by CUTTING CD, balance on cost

Halving a cd2.7–10 card doubles its OPS at zero number inflation — the precise correction the inverted T3 median needs.
Apply in **metered passes with a stop condition** (it's a large simultaneous power injection into T3).

- Wrathshell Vow `t3-counter-counter-defense` **cd10 → 2.0** (game-max CD on an inert-rage exhaust card is absurd under C1).
- Tidesong Aura `t3-water-water-water` cd4 → 2.4; Tremor Detonate `t3-attack-fire-water` cd5.5 → 2.4 (drop s3 → s2);
  Marsh Squall `t3-air-earth-water` cd5 → 2.4; Drowning Lance `t3-attack-water-water` cd3.2 → 2.0.
- The ~25 non-exhaust cd≥3 cards (Body Slam Vow, Reforge Vow, Tempest Cadence, Magma Welling, …) pulled toward 2.0–2.4.
- Detonators in this list (Tremor Detonate, Marsh Squall, Drowning Lance) **also** need the coefficient fix (§2.6) —
  the CD cut is necessary but not sufficient.

---

## 4. SCALING (C2) — keep STR universal, buff the rest

**Root cause (critical, set-wide):** `strMult = 1 + max(0,STR−1)·0.25` (CardResolver ~L397) is an unconditional global
MULTIPLIER on all enemy damage; INT/DEX/SPI/VIT are only ~+1/2–3pt additives. A multiplier dominates an additive: STR is
best-scaling for 65/67 damage cards, even beating a DEX card's own DEX primary.

### Core fix — a smaller per-element multiplier beside STR

Add a second term `elemMult = 1 + max(0, primaryStatValue−1)·RATE` (**RATE = 0.15** proposed; fork 0.12–0.18, D-13) in
the `damage` case, multiplied alongside `strMult`. At 0.15/pt, INT10 = 2.35× = **72% of STR's 3.25×** — competitive but
not king. `ELEMENT_PRIMARY_STAT_KEY` already exists in HeroStatsResolver; `card` is already passed to `applyEffect`, so
this is a few lines.

> **CRITICAL GATE FIX (judge caught a self-defeating contradiction).** The proposal's gate
> (`category==='magic' OR element-primary ∈ {int,dex,spi}`) does the OPPOSITE of what it claims: element-primary is
> resolved from the element, so the OR-branch sweeps in **32 physical attack/defense cards** — including every flagged
> spam outlier (Quickstrike, Quickstep Sigil, Skywire) — *buffing* them and creating a multiplier×multiplier double-dip
> (STR3.25 × elem2.35 = 7.64×, plus DEX cd-cut = three compounding OPS axes).
> **Use this gate instead:** apply `elemMult` ONLY on **`card.category==='magic'`** (fire/water/air/earth mage families),
> AND read the **effect's own `scale.stat`** (or true element-primary) so VIT/STR-dominant magic cards don't get an INT
> mult they shouldn't. This **excludes all 32 physical collisions** and honors C1 without leaning on the pricing pass.

### Data fixes (verified, pure cards.json + description regen)

- **Re-point the 9 hard-coded off-element `scale.stat:"str"` clauses** to the card's true element-primary: `t2-fire-fire`
  (Pyre), `t2-fire-water` (Steam Surge), `t2-earth-fire` (Magma Vein) → int; `t2-air-air` (Tailwind), `t2-air-earth`
  (Bedrock Snare), `t3-agility-air-earth` (Stormstone Tempo eff2) → dex; `t2-earth-water` (Mire Bloom eff2) → spi/int;
  `t3-air-earth-fire` (Sandfury) → int. (Exclude `t3-defense-fire-fire`: its `source:"armor"` makes the stat field
  vestigial.)
- **4 armor cards scale off DEX, should be VIT:** `t2-agility-defense` (Parrying Stance), `t3-agility-agility-defense`
  (Veil of Steps), `t3-agility-counter-defense` (Bramble Step), `t3-agility-agility-earth` (Footwork Stone). C3-clean.
- **`t2-water-water` (Frostbind):** a water/SPI card with zero SPI scaling — re-point its primary payoff to SPI.

### VIT stays in the defense lane (C3) — NO VIT→damage multiplier

VIT's "buff" is mitigation, not offense (see §5: VIT → `heroDefenseMultiplier`). Keep the narrow existing armor→damage
cards (Shield Bash, Granite Lunge, Bulwark Salvo, Body Slam Vow, Citadel Inferno via `scale.source:'armor'`) as the
ONLY armor→damage path; do not broaden.

**Open fork (D-14):** should `elemMult` also apply to **DoT** effects on magic cards (so a mage's INT scales their
signature poison/slow), or stay **damage-only**? As written it's damage-only, leaving pure-DoT mage cards flat.

---

## 5. DEFENSE AS CONTROL (C3) — elite at survival & lockdown, never at DPS

Defense is the worst-tuned family (armor median 7.2, heal 5.14) and internally **inverted** (T3 armor 4.67–6.7 armor/s
vs T2 Bulwark Vow 9.38). The engine confirms why it can't race: armor is pure face-value mitigation, no offensive term.
That's correct per C3 — **lean in**.

- **VIT → mitigation efficiency (the standout idea, ~1-line, C2+C3 safe).** Add a global
  `heroDefenseMultiplier += min(0.5, max(0, VIT−1)·0.03)` (+3%/pt mitigation, cap +50%). The multiplier is already read
  (EnemyAI ~L276) and armor is consumed at face value (~L287), so this raises blocked-per-point WITHOUT inflating
  armor/s or enabling any armor→damage path. Gives VIT a real non-offensive identity. (Cap-vs-curve fork D-15;
  validate vs boss damage so a wall deck isn't unkillable early.)
- **Reprice the 5 inverted T3 armor cards (C1):** cut CD to snappy and gate on resource — Quickstone
  `t3-agility-defense-earth`, Galeguard `t3-agility-air-defense`, Magmaplate `t3-defense-earth-fire`, Bogwrath
  `t3-counter-earth-water`, Dustward `t3-air-defense-earth` → cd ~1.4–1.8. Clears ~5 tierInversions.
- **Elite mitigation auras (data-only):** give 5 elite T3 defense cards a `damage_taken_pct` rider (already summed
  pre-armor, EnemyAI ~L256) — e.g. "take −20% for 6–8s." Aegis of Returning Wrath, Body Slam Vow, Last Stand Bulwark,
  Phoenix Aura, Stormgate.
- **Heal → elite attrition (via EXISTING `tick_ms` aura path, cheaper than proposed):** heal-over-time scaling with
  fight length, cleanse of hero self-DoT, and optionally one survival floor ("can't drop below 1 HP for Xs", D-16).
  Tidesong Aura, Misting Veil, Bloodtide Mend (remove its self-bleed first), Squall Aura, Mend.
- **Stun → elite lockdown:** **decay on a real-time timer** (so a control deck keeps the enemy locked between slow
  casts) and let stun scale off INT for a mage-control identity. **HARD GATE (judge):** ship the real-time decay ONLY
  with a stun-uptime DR / immunity-window cap — that machinery does NOT exist today and is **net-new engine**; without
  it, re-applying 3 stun every ~2s = near-permanent freeze (D-9).
- **The Brace trap (26 `on_armor_break` entries / ~19 cards).** The trigger fires only when armor goes >0 → exactly 0 in
  one hit — **anti-correlated** with stacking armor, and **unreachable** on the 3 no-armor cards (Static Bleed,
  Tempestbleed, Slag Maul `t3-attack-earth-fire`).
  - **No-armor cards (3):** delete the unreachable gate + self-bleed; promote riders to unconditional enemy-side effects
    (pure data — see §6).
  - **Armor cards (~16, not ~8 — double the estimated scope):** re-anchor `on_armor_break` → `on_armor_gained` (rewards
    the wall doing its job; the trigger exists, CardResolver ~L318–326) OR a new `on_first_hit_absorbed`. **Target the
    live `AuraTriggerKind` union in `src/data/types.ts`, NOT the legacy `StatusEffects.ts` L16 alias** (judge: editing
    the alias won't typecheck). `on_armor_gained` is used by only 1 card today → **gate behind regression tests first**;
    ship the pure-data flatten (Fork C) before the new trigger. Keep payoffs SMALL (2–4 stacks / 4–6 chip) so defense
    never out-DPSes. One-shot reprisal bombs (Aegis 18 pierce) MAY keep true `on_armor_break` as a rare last-stand (D-17).
- **The DPS-cap guardrail:** no defense/armor/heal/stun card's enemy-facing output may exceed the T2 OPS median (~14–15).
  Defense's budget goes into survival value (armor×VIT-effectiveness, DR auras, HoT, lockdown-seconds). **Dependency
  (judge):** this needs a `survivalValue` scoring layer in the audit metric, else the family keeps reading "dead" and a
  future pass re-breaks C3. **Build the scoring FIRST** (D-18).
- **Cross-combat armor carry-over:** recommended **OFF** (run-economy leak); rely on `damage_taken_pct` auras for
  persistent value instead.

**Intended second win condition a defense deck buys time FOR** — must be decided; it sets every HoT/floor number (D-19).

---

## 6. DEAD / CRITICAL CARD REWORKS (C4c) — fix the SHAPES, not just the cards

Two systemic trap shapes generate every genuinely-dead card. Fix the shapes.

- **SHAPE A — self-cost:** an unconditional `self_dot` HP/tempo cost paid up front for a conditional payoff → negative
  floor. **Worst case: Bloodlash Salvo** `t3-attack-attack-counter` — its self-stun makes the engine SKIP the hero's own
  next plays (CombatEngine L130–134), and because it scales with STR, the buff it grants deepens its own downside.
- **SHAPE B — Brace trap:** real output hung on `on_armor_break`, unreachable or anti-correlated (see §5).

| Card | Direction |
|---|---|
| `t3-attack-attack-counter` **Bloodlash Salvo** | **Delete the self-stun entirely** (used by exactly 1 card → 0 orphans; then `heroStunStacks` self-plumbing can be removed, but KEEP enemy-inflicted hero-stun). Keep +4 STR, add a guaranteed on-cast damage body, drop exhaust, cd 2.6 → ~1.6–2.0. **Delete the 2 stale `heroStunStacks` tests** (card-resolver.test.ts L322/341 — judge flagged these as the only code orphans). |
| `t3-air-counter-fire` **Static Bleed** | Drop self-bleed + unreachable Brace gate; re-pitch as a snappy air/fire control applier (slow + small damage, dex-scaled), cd ~1.6, single resource. |
| `t3-air-counter-water` **Tempestbleed** | Same fix one element over: promote the 2 Brace riders (Deal 6, 2 slow) to unconditional enemy-side, spi/dex-scaled, cd ~1.6. |
| `t3-attack-earth-fire` **Slag Maul** | No-armor Brace card: promote its Brace riders (Deal 12 / 2 burn) into the guaranteed body. Pure data. |
| `t2-attack-water` **Crimson Tithe** | **Fork B:** drop self-damage, grant rage directly on cast (Fork A's reorder doesn't hold — D-11). Worth fixing only once T2 spenders exist (§2.7a). |
| `t3-earth-fire-water` **Alchemic Drain** | Un-gate. **Fork A:** self-applies poison, then consumes for a spi-scaled heal + damage = poison tempo card. **Fork B:** elite sustain per C3 (D-20). Fork B is blocked on an unbuilt overheal-banking affordance → Fork A is the in-scope choice. |

**Systemic rule (adopt set-wide):** a `self_dot`/self-cost is allowed ONLY on a body that already pays for the card —
the self-cost is a flavor tax on an already-good card, never the price of admission to a gate. **Recommend enforcing
this as a regen/audit integrity test** (like the existing cost-in-text test) so the negative-floor shape can't return
(D-21). Keep self-cost on the cards whose body is strong (Reckless Strike, Berserker's Ledger); remove/neutralize it
elsewhere (Bloodtide Mend, and the reworked trio above).

---

## 7. SEQUENCING (recommended order of operations)

0. **Lock the forks in §8 first** (esp. D-4 tick interval, D-6 slow-damage, D-7 burn identity, D-8 detonator model,
   D-13 elemMult rate/gate) — several downstream numbers depend on them.
1. **Wiring bugs (§1)** — Pyre Surge, Necrotic Festering (3-effect rewrite), Venom Dance (2-effect rewrite + spread
   delete), aoe prose relabel. **Then regenerate `balance-metrics.json`** so the OPS table stops lying.
2. **Update the audit harness (`balance-metrics.mjs`)** for the new realization model — capitalize-Wound dotEquiv,
   wall-clock cadence, and (if D-6) slow-as-control. Build the `survivalValue` scoring (D-18) here too. *Without this,
   every post-change OPS reading is untrustworthy.*
3. **Status/DoT system rework (§2)** — wall-clock accumulator, capitalize realization for poison/bleed, burn cap +
   budgeted detonators (data), detonator coefficients, rage loop. Re-run the audit.
4. **Scaling (§4)** — elemMult (with the corrected magic-only gate), the 9 str re-points, 4 DEX→VIT armor, Frostbind.
   Sequence the DEX work BEFORE the agility cost nerfs so outliers aren't double-nerfed.
5. **Cost/CD pricing (§3)** — free-card costing, outlier cost raises, weak-long-CD rescue (metered passes + stop
   condition).
6. **Defense as control (§5)** — VIT→mitigation, reprice inverted T3 armor, mitigation/HoT auras, Brace re-anchor
   (gated behind tests), stun lockdown (only with the DR cap).
7. **Dead/critical card reworks (§6)** — last, because their final numbers depend on the new economies (rage spenders,
   detonator pricing, defense control value) being in place.
8. **Re-run the full audit; iterate the band/number forks (D-10, D-13) against fresh data.**

---

## 8. OPEN DECISIONS FOR DISCUSSION (the point of this document)

> Resolve these before implementing. They are genuine forks, phrased as either/or. Several gate the numbers downstream.

**System / DoT rework**

- **D-1 — Pyre Surge fork.** (A) implement `fire_damage_taken_pct` as a real fire-vulnerability multiplier (strongest,
  silently buffs all burn cards in deck — must apply AFTER the burn cap and coordinate with D-7), or **(B, recommended)**
  rewire to the already-wired `burn_taken` enabler (1-line, zero engine risk)?
- **D-2 — Necrotic Festering semantics.** Does "per bleed on yourself" read **LIVE** `heroBleedStacks` at detonation
  (counts the bleed this card just applied; avoids a cold-cast 0) or the pre-cast snapshot? Recommend live.
- **D-3 — AoE/spread policy.** Delete the 2 `spread` blocks + relabel the 14 aoe prose now (honest today, re-add at
  multi-enemy) — recommended — or keep the metadata as forward-compat and only relabel? And for Venom Dance: 2-effect
  rewrite (hero bleed → enemy poison) vs delete the inert convert and make it a clean applier?
- **D-4 — Wall-clock tick interval.** 750ms vs 1000ms — and should DoTs ALSO tick on card play for feel, or wall-clock
  only? (Needs a sim pass; affects every DoT number.)
- **D-5 — Which rage spender goes to T2?** Retier Cleaver's Tax `t3-attack-counter-counter` (one field, but changes its
  element identity) vs author a NEW small T2 counter vent?
- **D-6 — Slow rework (biggest re-tune).** STRIP slow's tick damage (slow = pure control, stun = pure freeze;
  de-duplicates the DoT taxonomy, the cleanest C5 answer) and re-cost 26 cards + rewrite the dotEquiv model — vs KEEP
  slow as damage+control and merely credit the control half (lower scope, leaves the overlap with poison)?
- **D-7 — Burn identity (pick ONE; mutually exclusive).** (a) RAISE/REMOVE the min(8) cap → burn is a pure sustained
  engine NOT meant to detonate (thin detonators); or (b) KEEP a soft cap → burn is "bank-and-cash," detonators are the
  realization and pay per-stack above the cap. Everything else about burn depends on this.
- **D-8 — Detonator model (pick ONE; don't max both).** Universal PARTIAL-CONSUME ("skim K, leave the rest ticking" —
  one primitive fixes poison/bleed/burn/rage, recommended) vs super-linear coefficient on a full consume — and should
  ONE uncapped "consume all" capstone survive (Supernova / Crimson Spiral) as the elite finisher?
- **D-9 — Stun lockdown ceiling.** Allow near-100% enemy uptime denial (true elite control, can trivialize fights) or
  cap via a diminishing-returns "stun-immunity window" after a long freeze? The real-time-decay buff MUST NOT ship
  without this — it's net-new engine.

**Pricing / scaling / defense**

- **D-10 — The cost/CD framework forks.** (i) Reconcile the band: lower the ~22–28 sustainable target to fit the 1.2 CD
  floor, or call it burst-only? (ii) Cost the baseline Quickstep `t1-agility` (cd0.9 "Deal 4. Deal 4.") or leave it as
  the intentional snappy template? (iii) Skywire — add mana (COST-3 burst) vs drop multi_hit (stay snappy)? (iv)
  Quickstep Sigil aura — 30%→15%+ttl vs self-only? (v) Define the explicit **elite "expensive-in-both" whitelist** so
  the exception doesn't creep. (vi) Should the 7th free card (`t1-air` Gust, peakOPS 0) stay free as pure utility?
- **D-11 — Crimson Tithe.** Fork A (reorder so the aura is armed before its own self-damage — judge says this does NOT
  hold given `fireRecurringTrigger` timing) vs **Fork B** (drop self-damage, grant rage directly on cast — safe)?
- **D-12 — Tier charter.** Confirm the proposed meaning: T1 = clean single effect, T2 = one conditional/synergy hook,
  T3 = build-around depth — all targeting the SAME OPS band, tier buys gating not size. What exactly does T3 promise?
- **D-13 — elemMult rate & gate.** RATE 0.12 / 0.15 / 0.18 (higher = more parity, closer to violating "smaller than
  STR")? And confirm the **magic-category-only gate** (the proposal's "category OR element-primary" gate is broken — it
  buffs 32 physical cards including the spam outliers).
- **D-14 — elemMult on DoTs?** Apply `elemMult` to poison/slow/burn on magic cards (so INT scales a mage's signature
  DoTs) or keep it damage-only (leaves pure-DoT mages flat)?
- **D-15 — VIT mitigation shape.** Flat +3%/pt cap +50% (recommended) vs a steeper curve vs making VIT *slow armor
  depletion* (stronger "wall" fantasy, bigger engine change)?
- **D-16 — Heal survival floor.** Include "cannot drop below 1 HP for Xs" on one elite heal (signature stall tool) or is
  a hard floor too swingy vs a strong HoT + DR alone?
- **D-17 — Brace re-anchor (~16 armor cards).** `on_armor_gained` vs a new `on_first_hit_absorbed` vs flatten riders to
  guaranteed on-cast (Fork C, pure data) — and which one-shot reprisal bombs KEEP true `on_armor_break` as a last-stand?
  (Ship Fork C first; gate the new trigger behind tests — `on_armor_gained` is nearly untested today.)
- **D-18 — `survivalValue` scoring.** Build the audit scoring layer that credits mitigation/lockdown/sustain BEFORE the
  defense pass, so the family stops reading "dead." (Load-bearing for the §5 DPS-cap guardrail.)
- **D-19 — Defense's intended second win condition.** Chip DoT (poison/slow) / a single elite payoff / outlasting the
  enemy's own clock? Sets every HoT, floor, and lockdown-seconds number.
- **D-20 — Alchemic Drain.** Fork A (poison tempo card — in scope) vs Fork B (elite sustain — blocked on overheal-banking)?
- **D-21 — Self-cost invariant.** Enforce "self-cost only on an already-paying body" as a hard audit/regen integrity
  test so the negative-floor shape can't be reintroduced?

---

### Appendix — corrections folded in from the adversarial review

- `on_armor_break` is **26 entries / ~19 cards** (proposals said ~8–15). The armor-Brace re-anchor is **~16 cards**,
  double several estimates.
- **107 distinct cards touch a stack** (not 81); keeping 6 stacks avoids the entire relabel + StackId-union + 4
  hard-wired relic migration.
- Only **1 burn detonator is T2** (Pyre); all **4 rage spenders are T3** — the T2-payoff depth gap is real.
- `consume_stack_value` / `convert_stack` use `-99`/`-999`/`99` — converting to budgeted `-K` is **pure data** (the
  `consumeFrom` clamp + super-linear multiplier path already exist in CardResolver).
- The metric model lives in **`balance-metrics.mjs`** (must be regenerated); there is no separate file to rewrite.
- Scaling gate must be **magic-category-only** (the proposed "category OR element-primary" gate buffs 32 physical cards
  including the spam outliers — the opposite of the intent).
- Brace trigger union edit must target **`src/data/types.ts` `AuraTriggerKind`**, not the legacy `StatusEffects.ts` alias.
- `passive_armor_scaler` is **NOT** a dead type (it's on Reforge Vow); the "VIT-armor never read" claim is a
  data-not-engine fix (the `scale.stat` armor path works — the 4 DEX-armor cards prove it).
- Deleting `heroStunStacks` self-plumbing orphans **2 unit tests** (card-resolver.test.ts L322/341) — delete them too.
