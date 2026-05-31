# Deep audit follow-up — remaining items

The 9 priority fixes from `tests/audit/sim-report-v2.json` synthesis are applied
in code (see commits / diff). This doc captures everything **not** in that pass:
balance adjustments, nice-to-haves, and known limitations to address later.

Snapshot date: deep audit pass, after `apply-deep-audit-fixes.mjs` + engine fixes
to `consume_stack_value × scale` ordering and `convert_stack` honoring `scale`.

---

## A. Balance adjustments not applied

These were flagged by the audit agents but require design decisions, not bug
fixes. Numbers are peak observed in the 24-scenario simulation.

### A.1 Overpowered candidates

| Card | Tier / cost | Peak observed | Archetype peak | Recommendation |
|------|-------------|---------------|----------------|----------------|
| **Tempest Pike** (`t3-air-air-attack`) | T3 / 2[stam] / CD 1.8s | 105 AoE dmg (str_10) | air avg 26 / peak 178 | Raise CD to 2.2s or drop one hit (3 → 2 hits). Cheapest CD in tier × triple-hit AoE × STR scaling is too compounding. |
| **Concussive Smash** (`t3-attack-attack-earth`) | T3 / 2[stam] / CD 2.4s | 113 dmg + 2 stun + 3 slow (str_10) | stun avg 53 / peak 178 | Drop the "always-firing" +6 conditional bonus. Current priority pass updated wording but engine still fires it baseline. Either remove the conditional or reduce its base to +3. |
| **Cinder Thrust** (`t3-attack-attack-fire`) | T3 / 2[stam] / CD 1.8s | 96 + 2 burn (str_10) | burn avg 24 / peak 96 | At burn-archetype ceiling with cheap CD. Trim base 20 → 16 OR raise CD to 2.4s. |
| **Mountain's Answer** (`t3-earth-earth-earth`) | T3 / 2[stam] / CD 4.5s | 26 armor + 22 Pierce AoE every cast | armor avg 19 / peak 46 | Dual peak armor + peak damage in one card. Either: (a) raise the `self_armor_atleast` gate above what the card grants on its own, OR (b) reduce base damage 22 → 14. |
| **Stormhilt** (`t3-air-attack-defense`) | T3 / 2[stam] / CD 2.2s | 84 + 6 armor + 2 slow (str_10) | T3 dmg avg 28 | Triple-effect bundle. Reduce base 8 → 6 or drop the slow. |
| **Wickfencer** (`t3-agility-attack-fire`) | T3 / 1[stam] / CD 1.7s | 70 + 2 burn (str_10) | T3 dmg avg 28 | Above 2× T3 avg on shortest CD in tier. Bump CD to 2.0s. |
| **Earthcleaver / Granitewrath / Mirebreaker** | T3 / 2[stam] | 78 each (str_10) | T3 dmg avg 28 | Cluster at 2.8× T3 avg with easily-met conditionals. No single fix; trim base damage 14 → 10–12 on each, OR tighten the trigger conditions. |
| **Tectonic Reckoning** (`t3-air-counter-earth`) | T3 / 3[stam]+2[mana] / CD 5s, Exhaust | 178 AoE Pierce (T3 ceiling) | — | Sits at the absolute ceiling. Cost partially mitigates. Acceptable as a "finisher" identity; flag only because it co-defines the peak. |

### A.2 Underpowered candidates

| Card | Tier / cost | Peak observed | Recommendation |
|------|-------------|---------------|----------------|
| **Drowning Lance** (`t3-attack-water-water`) | T3 / 2[stam]+1[mana] / CD 3.2s | 15 dmg (only with enemy poison) | After Phase A removed the scale block, this card is purely conditional. Add a small unconditional Pierce floor (e.g. "Deal 4 Pierce + 3 per [poison] consumed") OR drop the cost. |
| **Marsh Squall** (`t3-air-earth-water`) | T3 / 2[stam]+2[mana] / CD 5s, Exhaust | 20 dmg (only with enemy poison) | Same shape. Add a self-poison prong so it's self-enabling: "Apply 2[poison]([int]). Spread… Then deal 4 Pierce per [poison] consumed." |
| **Galeward** (`t3-air-air-defense`) | T3 / 1[stam]+1[mana] / CD 3.0s | 12 armor + haste | Thin payload. Bump armor 12 → 16 OR add a small slow/dex secondary. |
| **Body Slam Vow** (`t3-attack-defense-defense`) | T3 / 2[stam] / CD 3.0s | 2 base dmg (32 with prior armor) | Trim cost 2 → 1[stam] OR raise base 2 → 4. |
| **Crimson Cascade** (`t3-counter-counter-water`) | T3 / 1[stam]+1[mana] / CD 3.5s | 1 self-bleed + on-kill aura | Cannot do anything alone. Add a small immediate damage prong so it has some output without a kill chain. |
| **Vengeful Pyre** (`t3-counter-counter-fire`) | T3 / 2[stam] / CD 3s, Exhaust | rage-mult aura only | Buff-only card. Add a small rage gain so it has *some* output on its own (or rename — see B.2). |

### A.3 Archetype-level imbalances

From `tests/audit/archetype-summary.md`:

- **🟥 Stun is over-performing**: cost-efficiency (peak-dmg ÷ avg_cost+1) = 59.3, highest of any status. All 6 stun cards carry significant damage payloads; none are pure-utility stun. Recommendation: lower the damage component on Tectonic Reckoning + Concussive Smash, OR add a true utility-stun card without damage to drag the archetype average down.
- **🟥 Air element cost-efficiency 65.7** vs fire/water ~32 — air has the most multi-hit AoE damage cards. Recommendation: nerf Tempest Pike / Stormhilt / Skywire as listed above.
- **🟥 `cat:magic` cost-efficiency 72.7** vs cat:attack 48.1 — magic average cost is 1.45 but includes Tectonic Reckoning. Likely fine once individual outliers are nerfed.
- **🟦 Heal archetype peak 29, cost-efficiency 13.5** (lowest by far). Even after the SPI-gain reworks (Tidesong / Bloodtide / Tidefoot Bloom), the heal archetype underperforms. Recommendation: either lift the heal cap or add a damage-secondary to one of the dedicated heal cards.
- **🟦 Rage supply is thin**: only 3 cards directly grant rage (Reckless Strike, Vengeful Pyre, Wrathshell Vow). Rage-payoff cards (Wrath Brand, Stormrage, Wrath Squall, Cleaver's Tax, Crimson Spiral) outnumber rage sources. Recommendation: add 1–2 mid-tier rage-generators or boost the gain on Reckless Strike.
- **🟦 Poison archetype practical output**: raw numbers look OK but most payoff cards (Drowning Lance, Marsh Squall, Alchemic Drain, Tidefoot Bloom) require pre-existing poison. Recommendation: ensure at least one poison-generator per tier doesn't itself depend on poison.

### A.4 Tier cost-curve quirk

| Tier | avg cost | avg CD | avg dmg | peak dmg |
|------|---------:|-------:|--------:|---------:|
| T1 | 0.88 | 1.54 | 6.9 | 29 |
| T2 | 0.61 | 1.51 | 17.6 | 71 |
| T3 | 1.92 | 2.70 | 28.2 | 178 |

T2 avg cost is lower than T1's (0.61 vs 0.88). After Shield Bash → free in Phase A, the cost curve at T2 dipped further. Confirm this matches design intent — a T2 card should arguably not be cheaper than T1 on average.

---

## B. Description-only issues (cosmetic / clarity)

### B.1 Hidden global STR multiplier
Multiple agents flagged that cards scaling on DEX/INT also "scale with STR" in the simulator. This is the **global STR damage multiplier** (`1 + (STR-1) × 0.25`), not a per-card scale. The descriptions don't surface it because it applies universally. Decision: leave alone (it's documented in CardResolver), or add a tooltip explaining "all damage is multiplied by STR".

### B.2 Vengeful Pyre name
Card is themed fire but its only effect is `stack_gain_mult` on rage + devour. No burn interaction. Recommendation: rename to something like **Wrath Forge** or **Sacrificial Brand**. Touches one description string + the asset filename.

### B.3 Stam/mana gain not in delta tracker
Several cards (Tailwind, Sidestep & Slash, Vow of the Tide, Steam Surge, Misting Veil, Mire Bloom, Crimson Tithe) gain stamina/mana but the sim's `staminaSpent`/`manaSpent` columns only track net spend. Sim tooling limitation — not a card bug. If you want to verify gains, extend the snapshot to record `heroStamina`/`heroMana` directly.

### B.4 Mist Step targeting wording
Card targets `self` (effect is hero-side haste) but applies 1 slow to enemy. Description says "Apply 1[slow]" without naming the target — ambiguous given the card is otherwise self-focused. Reword to "Apply 1[slow] to enemy."

### B.5 Crimson Tithe `cost: {}` vs `null`
Inconsistent encoding with other free-cast cards. Fix `cost: {}` → `cost: null`.

### B.6 Flurry Step "Deal 4 twice"
Engine-correct, but novice players may not realize both hits trigger on-hit effects. Reword to "Deal 4 damage twice (2 hits)."

### B.7 Gust "Haste 20%"
Doesn't specify what's hastened. Reword to "Reduce cooldowns 20% for 5s" or add a `[haste]` keyword tooltip.

### B.8 SPI heal scaling not surfaced
Tidefoot Guard, Bloodtide Mend, Vow of the Tide, Phoenix Aura all say "Heal X([spi])" but the heal only fires when the hero is missing HP — `spi_10` scenarios don't observe a delta because the hero starts at full HP. Add a "(only when missing HP)" clarifier OR move heal to a triggered context.

---

## C. Sim infrastructure limitations

These aren't fixable in the cards themselves — they're things the sim can't
exercise:

1. **`card_played` event isn't emitted by the resolver path** the sim uses; only `CombatEngine.playCard` emits it. So the `sequence_8x` for Firestorm doesn't trigger its threshold. Workaround: emit `card_played` from the sim wrapper after each `resolver.resolve()`, OR run sequences through a mock `CombatEngine`.

2. **Brace (`on_armor_break`) doesn't fire** because the sim never breaks hero armor. Affects: Aegis of Returning Wrath, Bulwark Vow, Parrying Stance, Bramble Step, Tombplate, Phalanx Drift, Stoneward Reprisal, Standing Stone, Ember Vault, Slag Maul, Magmaplate, Dustward, Magmavow, Tempestbleed, Bogwrath, Steam Bulwark, Ashen Bulwark, Bedrock Bulwark. Recommendation: add a `brace_active` test scenario that pre-breaks armor.

3. **`on_kill_with_stack` doesn't fire** — Crimson Cascade unverifiable.

4. **`took_damage_within_ms` Vengeance window** is exercised by the `vengeance_active` scenario, but not in `sequence_8x` between casts. Most Vengeance payoffs only checked through the single-cast scenario.

5. **Real combat ticks** don't run — DoT damage, aura tick payloads, periodic rage gain (Wrathshell Vow), heal-aura ticks (Tidesong, Crimson Regen Mantle) all show 0 in deltas because the sim never advances the DoT cadence.

6. **Bloodlash Salvo self-stun** uses the boolean `heroStunned` flag, not a stack pool. The `scale: str/per:3/value:1` on the self-stun effect is purely decorative. Functional but the "stun length scales with STR" design intent isn't realized. Engine work to convert `heroStunned` → `heroStunStacks` is needed.

---

## D. Verified-as-fine despite agent flags

Items that audit agents flagged but turned out to be correct on closer reading:

- **Alchemic Drain** (`t3-earth-fire-water`) — flagged "heal never fires; consume_stack_value resolves to 0". Actually: the heal fires correctly when consumed poison exists AND the hero has missing HP. The `enemy_poison_5` scenario has hero at full HP, so the heal clamps to 0 and shows `resultHealed: 0`. **Card works as designed.**

- **Concussive Smash** — flagged "conditional never fires" in the previous (v1) audit; the v2 audit caught the truth: the conditional **always** fires because the card's own stun apply lands before the conditional check. The fix is in description wording (now applied), not in the engine.

- **Slag Maul** — v1 agent claimed `heroBurn:2` baseline; v2 sim shows `heroBurn:0`. Original was a misread.

---

## E. Items already shipped in this pass

For clarity, the 9 priority fixes that **are** already done:

| # | Card / system | Fix |
|---|---------------|-----|
| 1 | (engine) `consume_stack_value × scale` ordering | Scale now applied before stack multiplier; suppresses post-multiply scale in `applyEffect`. Fixes Supernova int_10 leak; same fix automatically helps Necrotic Festering, Thunderstrike Catalyst, Tremor Detonate. |
| 2 | Supernova | Validated by engine fix #1; description retained `([int])` accurately. |
| 3 | Brine Crucible (engine) | `convert_stack` now honors `scale` on factor — DEX correctly scales the bleed-per-burn yield. |
| 4 | Stormsplash | `targeting: "self"` → `"single"`. |
| 5a | Soaking Blade | Description reworded ("If enemy has [poison]" → "Then deal 7 more"); conditional removed from effect. |
| 5b | Concussive Smash | Description reworded to drop the always-firing conditional framing. |
| 5c | Vein Splitter | Description "If enemy has [bleed]" → "Once enemy has [bleed]" (matches all-hits behavior). |
| 6 | Triple Slash / Pinprick Volley / Tempest Cadence / Mountain's Answer | Damage effects re-targeted from `enemy` → `aoe` to match the "to all enemies" text. (Cards already had card-level `targeting: aoe`.) |
| 7 | (Vengeful Pyre) | Deferred — rename touches assets too. See B.2. |
| 8 | Wrath Brand / Stormrage | Descriptions now mention rage consumption. |
| 9 | Tombrage | "less than 40%[HP]" → "when your [HP] drops below 40%" (clarifies event-based trigger). |
| bonus | Drowning Lance / Marsh Squall | Descriptions dropped `([int])` — matches Phase A's scale-block removal. |
| bonus | Last Stand Bulwark | "less then" typo fixed (missed by earlier sweep). |
| bonus | `applyTriggeredPayload(stat_gain)` | Was a silent no-op; now dispatches with per-card cap tracking via `sourceCardId`. Validated by sim showing Searing Razor +4 DEX, Twinflame Flicker +4 INT, Wrath Squall +5 STR (cap), etc. |

---

## F. Suggested priority for follow-up

If working in tiers:

1. **High** — engine: `heroStunned` → `heroStunStacks` so Bloodlash Salvo's STR-scaled self-stun actually does what it advertises.
2. **High** — balance: nerf Tempest Pike, Concussive Smash, Cinder Thrust, Stormhilt, Wickfencer. These five are the clearest outliers driving the air/stun/T3-ceiling imbalances.
3. **Medium** — design: buff Drowning Lance / Marsh Squall / Galeward / Body Slam Vow / Crimson Cascade / Vengeful Pyre with small unconditional payoffs so they're not pure combo-pieces.
4. **Medium** — design: add 1–2 mid-tier rage generators OR boost Reckless Strike's rage gain to balance the rage-payoff oversupply.
5. **Low** — cosmetics from §B (Vengeful Pyre rename, Crimson Tithe `cost: {}` cleanup, ambiguous Mist Step targeting wording).
6. **Low** — sim: extend the harness to drive Brace, on_kill, card_played, and DoT ticks if you want full automated coverage. Otherwise rely on playtests for those.
