# Warrior — "Iron Tide" (v2)

> Conceptual design doc. Numbers are tuning starting points; engine wiring is later.
> Constrained by `00_framework.md` v2 — §1 (counts), §2 (rarity philosophy), §4 (mechanic charter), §5 (combos), §6 (relics), §8 (validation), §9 (trim heuristic).

---

## 1. Identity & Fantasy

The Warrior plays like a slow tide rolling in and a hammer dropping out. You commit to the fight: you spend Stamina on telegraphed heavies, you stack Armor not to survive but to *spend* it on Fury, Doom Blade, and worse. Missing HP is fuel, kills are fuel, a string of consecutive attacks is fuel — all of it pours into Rage stacks that make the next swing terrifying. The micro-Bleed layer is the warrior's quiet violence — a 2H hit that keeps cutting after the swing.

The class punishes hesitation (Stamina drains, Rage decays out of combat) and rewards commitment (defense-as-fuel converts dead armor into burst). It should feel **deliberate, escalating, and unstoppable** when piloted well, and **brittle and gas-starved** when piloted greedily.

---

## 2. Stat Baseline

| Stat | Value | Notes |
|---|---|---|
| Max HP | 90 | Highest of the three classes |
| Max Stamina | 25 | The class economy |
| Max Mana | 5 | Almost vestigial; only Iron Skin / Last Stand touch it |
| STR | 4 | Strongest physical scaler |
| VIT | 3 | Above baseline; HP class |
| DEX | 1 | Slow, deliberate; relics can lift it |
| INT | 0 | Effectively none |
| SPI | 1 | Modest stamina/heal trickle |
| Move Speed | 1.0 | Baseline |
| Defense Multiplier | 1.0 | Baseline |

---

## 3. Starter Deck (10 cards)

| Slot | Card | Why it's there |
|---|---|---|
| 1 | Strike | Stamina-positive light attack (+1 stam on play) |
| 2 | Strike | Same |
| 3 | Strike | Same |
| 4 | Strike | Same |
| 5 | Defend | Armor floor |
| 6 | Defend | Armor floor |
| 7 | Defend | Armor floor |
| 8 | Heavy Hit | First taste of Stamina cycle drain |
| 9 | Cleave | First taste of AoE; teaches multi-target and the bleed micro |
| 10 | Bloodied Grip | Free Rage generator — teaches the Rage mechanic from card 1 |

Playable solo: 4× Strike refunds the Stamina spent on 1× Heavy Hit and 1× Cleave per cycle; 3× Defend covers incoming damage; Bloodied Grip drip-feeds Rage stacks.

---

## 4. Card Table (35 cards)

Mechanic tag legend: **S** = Stamina cycle, **A** = Armor/Defense pivot, **R** = Rage / Strength stacking, **B** = Bleed (micro), **u** = utility / scaling rider.

Cost shape legend: *free* = no resource cost, *S/n* = n Stamina, *D/n* = n Defense, *M/n* = n Mana, *HP/n* = n self-damage, *Stat-drain* = lose a stat point for the combat.

| ID | Name | Rarity | Category | Cost | Effect summary | Tags |
|---|---|---|---|---|---|---|
| strike | Strike | common | attack | free | 7 dmg; +1 Stamina on play | S, R |
| heavy-hit | Heavy Hit | common | attack | S/4 | 16 dmg | S |
| defend | Defend | common | defense | free | +10 Armor | A |
| cleave | Cleave | common | attack | S/3 | 10 dmg AoE | S, B |
| brace | Brace | common | defense | free | +9 Armor; +1 Stamina | S, A |
| bloodied-grip | Bloodied Grip | common | attack | free | 3 dmg; +1 Rage stack | R |
| iron-resolve | Iron Resolve | common | defense | free | +8 Armor; +4 more if HP<50% | A, R |
| shoulder-check | Shoulder Check | common | attack | S/2 | 6 dmg; enemy −1 Defense | S, B |
| whetstone | Whetstone | common | utility | D/1 | +2 STR this combat | R, u |
| jab | Jab | common | attack | free | 6 dmg; +2 Stamina | S |
| bandage | Bandage | common | utility | HP/1 | Heal 12 HP (net +10); +1 SPI this combat | u |
| war-cry | War Cry | common | utility | S/2 | +3 STR for next 2 attacks | R |
| counter-strike | Counter Strike | uncommon | attack | free | 8 dmg; +4 dmg if hero took damage in last 2s | A, S |
| shield-wall | Shield Wall | uncommon | defense | S/3 | +20 Armor | A, S |
| fortify | Fortify | uncommon | defense | S/4 | +25 Armor | A, S |
| parry | Parry | uncommon | defense | S/2 | +8 Armor; 5 dmg | A, S |
| reckless-charge | Reckless Charge | uncommon | attack | HP/2 | 35 dmg | R |
| rage-cycle | Rage Cycle | uncommon | attack | S/3 | 8 dmg; +2 Rage stacks | R, S |
| bone-splinter | Bone Splinter | uncommon | attack | S/3 | 5 dmg; apply 4 Bleed | B, S |
| battle-stance | Battle Stance | uncommon | utility | free | +1 STR per 5 HP missing (cap +5) | R, A |
| shieldbash | Shield Bash | uncommon | attack | D/2 | Deal damage = current Armor (max 18) | A |
| wound-reopener | Wound Reopener | uncommon | attack | S/2 | 4 dmg; if target bleeding, double Bleed remaining | B, S |
| plate-up | Plate Up | uncommon | defense | S/3 | +15 Armor; +2 VIT this combat | A, u |
| rallying-roar | Rallying Roar | uncommon | utility | Stat-drain (−1 SPI this combat) | +3 STR temp for the combat; +10 Stamina | R |
| fury | Fury | rare | attack | D/5 | 45 dmg | A, R |
| iron-skin | Iron Skin | rare | defense | M/3 | +30 Armor | A |
| bulwark | Bulwark | rare | defense | S/4 | +35 Armor | A, S |
| berserker | Berserker | rare | attack | S/8 + D/3 | 70 dmg | S, A, R |
| execute | Execute | rare | attack | S/8 | 55 dmg to lowest-HP enemy | S |
| crimson-tide | Crimson Tide | rare | attack | S/4 | 15 dmg; +3 per Bleed on target | B, R, u |
| unyielding | Unyielding | rare | defense | S/4 | +20 Armor; +3 Armor per STR | A, R, u |
| bloodsworn | Bloodsworn | rare | attack | Stat-drain (−1 STR this combat) | 15 dmg; +7 Rage stacks | R, u |
| doom-blade | Doom Blade | epic | attack | D/6 | 75 dmg | A, R |
| last-stand | Last Stand | epic | defense | S/3 + M/3 | +70 Armor | A, S |
| worldbreaker | Worldbreaker | epic | attack | free — **once per combat**; on play lose 3 HP | 120 dmg single target; if it kills, +2 STR permanently for this run | R, A, S, u |

**Rarity tally**: 12 common · 12 uncommon · 8 rare · 3 epic = **35** ✓

**Cost-shape spread per rarity** (proves v2 §2 / §8 "varied within every rarity tier"):

| Rarity | Free | Single-cost | Dual / HP / Stat-drain |
|---|---|---|---|
| Common | strike, defend, brace, bloodied-grip, iron-resolve, jab (6) | heavy-hit S/5, cleave S/4, shoulder-check S/2, war-cry S/3 (4) | whetstone D/1 (dual via defense), bandage HP/2 (HP cost) (2) |
| Uncommon | counter-strike, battle-stance (2) | shield-wall S/5, fortify S/10, parry S/3, rage-cycle S/4, bone-splinter S/3, wound-reopener S/2, plate-up S/5 (7) | reckless-charge HP/3, shieldbash D/5, rallying-roar SPI-drain (3) |
| Rare | bloodsworn (STR-drain — paid via consequence, not currency) (1) | fury D/10, iron-skin M/5, bulwark S/8, execute S/12, crimson-tide S/6, unyielding S/8 (6) | berserker S/15 + D/5 (dual) (1) |
| Epic | worldbreaker (free with once-per-combat **and** HP/5 consequence) (1) | doom-blade D/10 (1) | last-stand S/5 + M/5 (dual) (1) |

Every rarity tier hits all three shape buckets. Rarity does **not** predict cost shape.

---

## 5. Card Detail Blocks

### 5.1 Commons — cluster flavor

- **Stamina-cycle commons (strike, heavy-hit, cleave, brace, shoulder-check, jab, war-cry):** *"You learn the rhythm before the war."* Light attacks that pay you back; the cycle teaches Stamina is a tide, not a budget.
- **Armor commons (defend, brace, iron-resolve):** *"Iron is patient."* Cheap shields that establish the armor floor. Iron Resolve teaches that being low is good.
- **Rage commons (bloodied-grip, whetstone, war-cry):** *"The bear wakes slowly."* Bloodied Grip is in the starter deck so players see Rage from card one; Whetstone is the dual-cost common — pays 1 Defense for +1 STR.
- **Bleed commons (cleave, shoulder-check):** *"Wounds don't close on their own."* The trickle-layer entry points; Cleave bleeds at AoE, Shoulder Check pairs bleed with defense-down.
- **Outlier common (bandage):** the HP-cost common — heal 6 for 2 HP self-damage, net +4 HP and +1 SPI for the combat. Proves "common with non-stamina cost shape."

### 5.2 Uncommons — cluster flavor

- **Stamina/Armor uncommons (counter-strike, shield-wall, fortify, parry, plate-up):** the workhorses; Fortify is the Bulwark launchpad.
- **Rage uncommons (reckless-charge, rage-cycle, battle-stance, rallying-roar):** Reckless Charge teaches HP-as-resource; Battle Stance is the free uncommon that scales with missing HP; Rallying Roar is the stat-drain uncommon — sacrifices SPI this combat to give +1 STR + 5 Stamina.
- **Bleed uncommons (bone-splinter, wound-reopener):** Bone Splinter applies; Wound Reopener doubles it.
- **Pure-defense outlier (shieldbash):** the Defense-cost uncommon — pay 5 Armor, deal damage equal to your *remaining* Armor (max 14). Punishes hoarding.

### 5.3 Rares (8 detail blocks)

**fury — *Crimson Wedge.*** You trade a wall of armor for a single, ruinous swing. 45 damage, costs 5 Defense. Upgrade: +15 dmg. The card that defines the "armor-as-fuel" identity — armor stops being a resource you spend on survival and starts being a resource you spend on kills.

**iron-skin — *Arcane Plating.*** The one Mana-touching defense rare in the warrior set; a remnant of the Mage-warrior overlap. +30 Armor for 3 Mana. Upgrade: +8 Armor. Niche but combos with neutral mana-batteries.

**bulwark — *The Wall.*** +35 Armor for 4 Stamina. Upgrade: +10 Armor. The pure-tank scaling tool, and the launchpad most decks build for Fury / Doom Blade.

**berserker — *The Pact.*** 70 dmg, costs 8 Stamina AND 3 Defense. Upgrade: +20 dmg. The double-resource finisher; usually the better Fury when you have stamina to burn.

**execute — *Headsman.*** 55 dmg, costs 8 Stamina, hits lowest-HP target. Upgrade: +20 dmg. Boss-phase mop-up and elite-add deletion.

**crimson-tide — *Wound Logic.*** A scaling Bleed payoff: 15 dmg base, +3 per Bleed stack on target. Costs 4 Stamina. Upgrade: +5 base, +1 per Bleed stack. The card that makes the bleed micro-mechanic *matter* in a deck.

**unyielding — *Steel Will.*** +20 Armor, then +3 Armor per current STR. Costs 4 Stamina. Upgrade: scales off (STR + VIT) instead of STR. The card that makes Rage stacking pivot into defense.

**bloodsworn — *Wolf's Bargain.*** No resource cost — instead, drain 1 STR for the combat. Gain 7 Rage stacks; deal 15 damage. Upgrade: drain becomes 0 (becomes strictly better; this is the "you found the upgrade payoff" moment). The **free rare with a stat-drain consequence** — proves rarity doesn't equal cost complexity (v2 §2).

### 5.4 Epics (3 detail blocks)

**doom-blade — *Crown of Endings.*** 75 dmg, costs 6 Defense. Upgrade: +20 dmg. The classic glass-cannon epic; the cost shape means a single Doom Blade can burn ~18 armor across a combat (Fortify + Doom Blade is the canonical Iron Tide combo). Tradeoff: you cannot use it without having paid the armor up front. *(Note: cards.json currently also imposes 3 HP self-damage; v2 design drops the HP rider to keep Doom Blade as a clean single-cost epic — engine to be updated.)*

**last-stand — *No Step Back.*** +70 Armor for 3 Stamina + 3 Mana. Upgrade: +12 Armor. The cross-resource defense epic; the mana cost is the real barrier — warriors who don't have neutral mana relics can't loop it.

**worldbreaker — *Build-defining, deliberately OP.*** **No resource cost. Once per combat. On play, lose 3 HP.** 120 damage single target. **If it kills, +2 STR permanently for this run.** Upgrade: kill bonus becomes +3 STR. This is the OP build-definer per framework §8 — the epic that costs *nothing* in currency but carries hard consequences: (1) the once-per-combat lock, (2) the flat 3 HP self-damage, (3) the conditional permanent-stat payoff that only triggers on the kill. Proves v2 §2: an epic that "costs nothing but has a permanent downside" earns its rarity through consequence-weight, not resource-flow.

---

## 6. Relic Table (10 exclusive Warrior relics)

| ID | Name | Rarity | Trigger | Effect | Primary mechanic |
|---|---|---|---|---|---|
| WR-01 | Bronze Pauldron | common | combat_start | +6 Armor at combat start | Armor/Defense |
| WR-02 | Tireless Belt | common | card_played (attack) | First attack each combat refunds 2 Stamina | Stamina cycle |
| WR-03 | Whetstone Charm | common | enemy_killed | +1 Rage stack on every kill | Rage / Strength |
| WR-04 | Iron Cestus | rare | card_played (attack) | Every 3rd attack: +5 dmg and apply 2 Bleed | Bleed (micro) |
| WR-05 | Banded Greaves | rare | damage_taken | When you take damage: +1 Armor and +1 Rage stack | Armor + Rage |
| WR-06 | Champion's Sash | rare | combo_played | When a synergy fires: +3 Armor | Armor/Defense |
| WR-07 | Stamina Reservoir | rare | turn_start | At loop start: convert excess Stamina over max into +1 STR (cap +3) | Stamina cycle |
| WR-08 | Wargod's Mantle | epic | passive | Cards with Defense cost: −3 Defense cost (min 1) | Armor pivot — build-definer for Fury / Doom Blade |
| WR-09 | Bloodgorged Heart | epic | dot_tick | When an enemy takes Bleed damage: heal 1 HP and gain +1 Rage stack (cap 10) | Bleed + Rage |
| WR-10 | The Last Banner | legendary | combat_start | Start each combat with +8 Armor, +3 Rage, +4 Stamina. 1/combat: when you would die, instead survive at 1 HP and gain +20 Armor and +5 Rage | Rage + Armor + Stamina |

**Rarity tally**: 3 common · 4 rare · 2 epic · 1 legendary = 10 ✓
**Primary mechanic coverage**: Stamina (WR-02, WR-07, WR-10) · Armor (WR-01, WR-05, WR-06, WR-08, WR-10) · Rage (WR-03, WR-05, WR-09, WR-10) · Bleed (WR-04, WR-09) — all four primaries have ≥1 relic ✓

---

## 7. Combo Table (35 rows — every card appears exactly 2 times)

All combos class-locked unless flagged. Cross-class bridge combos via neutrals are drafted in `04_neutral_and_combos.md`.

| # | cardA | cardB | bonus | Display name | Notes |
|---|---|---|---|---|---|
| 1 | strike | heavy-hit | +8 dmg to enemy | Hammer Down! | |
| 2 | strike | bloodied-grip | +1 Rage stack to self | First Blood! | |
| 3 | defend | iron-resolve | +4 Armor to self | Wall Up! | |
| 4 | defend | counter-strike | +12 dmg to enemy | Riposte! | |
| 5 | cleave | shoulder-check | +3 dmg AoE; enemy −1 Def | Sweep & Shove! | |
| 6 | cleave | crimson-tide | +2 dmg per Bleed on enemies | Crimson Sweep! | cross-rarity bleed scaling |
| 7 | brace | shield-wall | +3 Armor to self | Set the Line! | |
| 8 | brace | parry | +2 Armor; cooldown −0.2s | Stonewall! | |
| 9 | heavy-hit | execute | +12 dmg to enemy | Beheading! | |
| 10 | bloodied-grip | rage-cycle | +2 Rage stacks | Rage Primer! | |
| 11 | iron-resolve | battle-stance | +1 STR; +2 Armor | Defiance! | |
| 12 | shoulder-check | bone-splinter | +4 Bleed applied | Cripple! | |
| 13 | whetstone | execute | +10 dmg | Honed Edge! | |
| 14 | whetstone | bloodsworn | +1 STR retained (refunds drain) | Sharper Bargain! | |
| 15 | jab | war-cry | +4 dmg; +2 Stamina | Brawler's Tempo! | |
| 16 | jab | counter-strike | +6 dmg | Lead Jab! | |
| 17 | bandage | plate-up | +3 HP heal | Field Medic! | |
| 18 | bandage | unyielding | +4 Armor to self | Stitched Steel! | |
| 19 | war-cry | berserker | +8 dmg | Battle Howl! | |
| 20 | shield-wall | fury | cost_waive on Fury | Fortified Fury! | |
| 21 | fortify | doom-blade | cost_waive on Doom Blade | Crown Drop! | the canonical Iron Tide combo |
| 22 | fortify | shieldbash | +8 dmg | Mountain Shove! | |
| 23 | parry | bulwark | cost_waive on Bulwark | Aegis! | |
| 24 | reckless-charge | rage-cycle | +2 Rage stacks | Headlong! | |
| 25 | reckless-charge | worldbreaker | +1 Rage stack | Suicide Run! | |
| 26 | bone-splinter | crimson-tide | +6 Bleed applied | Splintered Edge! | |
| 27 | battle-stance | unyielding | +1 STR; +3 Armor | Steel Resolve! | |
| 28 | shieldbash | bulwark | +6 dmg | Bulwark Bash! | |
| 29 | wound-reopener | bloodsworn | +4 dmg | Reopen the Hunt! | |
| 30 | wound-reopener | rallying-roar | +1 STR temp | Roar of Wounds! | |
| 31 | plate-up | last-stand | +4 Armor to self | Layered Plate! | |
| 32 | rallying-roar | worldbreaker | +4 Stamina refund | Final Roar! | |
| 33 | fury | doom-blade | +10 dmg | Crown of Endings! | the signature epic-finisher pair |
| 34 | iron-skin | last-stand | +3 Armor to self | Stacked Plate! | |
| 35 | iron-skin | berserker | +6 Armor refund after play | Plated Pact! | |

**Total rows: 35** = (35 cards × 2 appearances) ÷ 2 = 35 ✓

### 7.1 Combo appearance count per card

(Each card must appear in **exactly 2** rows per framework §5.1 / §8.)

| Card | Appearances | Rows |
|---|---|---|
| strike | 2 | 1, 2 |
| heavy-hit | 2 | 1, 9 |
| defend | 2 | 3, 4 |
| cleave | 2 | 5, 6 |
| brace | 2 | 7, 8 |
| bloodied-grip | 2 | 2, 10 |
| iron-resolve | 2 | 3, 11 |
| shoulder-check | 2 | 5, 12 |
| whetstone | 2 | 13, 14 |
| jab | 2 | 15, 16 |
| bandage | 2 | 17, 18 |
| war-cry | 2 | 15, 19 |
| counter-strike | 2 | 4, 16 |
| shield-wall | 2 | 7, 20 |
| fortify | 2 | 21, 22 |
| parry | 2 | 8, 23 |
| reckless-charge | 2 | 24, 25 |
| rage-cycle | 2 | 10, 24 |
| bone-splinter | 2 | 12, 26 |
| battle-stance | 2 | 11, 27 |
| shieldbash | 2 | 22, 28 |
| wound-reopener | 2 | 29, 30 |
| plate-up | 2 | 17, 31 |
| rallying-roar | 2 | 30, 32 |
| fury | 2 | 20, 33 |
| iron-skin | 2 | 34, 35 |
| bulwark | 2 | 23, 28 |
| berserker | 2 | 19, 35 |
| execute | 2 | 9, 13 |
| crimson-tide | 2 | 6, 26 |
| unyielding | 2 | 18, 27 |
| bloodsworn | 2 | 14, 29 |
| doom-blade | 2 | 21, 33 |
| last-stand | 2 | 31, 34 |
| worldbreaker | 2 | 25, 32 |

**Min: 2. Max: 2. All 35 cards appear EXACTLY 2 times.** ✓
Sum of appearances = 70 = 35 rows × 2 (each row contributes to two cards). ✓

---

## 8. Validation Pass

Each framework §8 rule, explicitly checked:

- [x] **35 cards total, 12/12/8/3 by rarity** — §4 tally confirmed: 12 common + 12 uncommon + 8 rare + 3 epic = 35. ✓
- [x] **≥5 cards touching each primary mechanic**:
  - **Stamina (S)**: strike, heavy-hit, cleave, brace, shoulder-check, jab, war-cry, counter-strike, shield-wall, fortify, parry, rage-cycle, bone-splinter, wound-reopener, plate-up, bulwark, berserker, execute, crimson-tide, unyielding, last-stand = **21 cards** ✓
  - **Armor / Defense (A)**: defend, brace, iron-resolve, whetstone (D/1 cost), counter-strike, shield-wall, fortify, parry, battle-stance, shieldbash, plate-up, fury, iron-skin, bulwark, berserker, unyielding, doom-blade, last-stand, worldbreaker = **19 cards** ✓
  - **Rage / Strength (R)**: strike, bloodied-grip, iron-resolve, whetstone, war-cry, reckless-charge, rage-cycle, battle-stance, rallying-roar, fury, berserker, crimson-tide, unyielding, bloodsworn, doom-blade, worldbreaker = **16 cards** ✓
  - **Bleed (B)**: cleave, shoulder-check, bone-splinter, wound-reopener, crimson-tide = **5 cards** ✓ (exactly meets ≥5)
- [x] **Every card appears in exactly 2 combo rows** — see §7.1 appearance table; min 2, max 2 across all 35 cards. ✓
- [x] **At least one card scales off each of the class's primary stats** —
  - **STR**: unyielding (+1 Armor per STR), crimson-tide (scales via Rage-driven STR), whetstone / war-cry / rallying-roar / bloodsworn / worldbreaker all generate or drain STR. ✓
  - **VIT**: plate-up (+1 VIT this combat), unyielding upgrade (scales off STR + VIT). ✓
  - **DEX**: parry (cooldown reduction reads DEX), brace+parry combo grants cooldown rider. ✓
  - **SPI / INT**: bandage (+1 SPI), rallying-roar (−1 SPI drain). INT untouched by design (warrior identity). ✓
- [x] **10 relics, ≥1 per primary mechanic** — Stamina (WR-02, WR-07, WR-10), Armor (WR-01, WR-05, WR-06, WR-08, WR-10), Rage (WR-03, WR-05, WR-09, WR-10), Bleed (WR-04, WR-09). All 4 primaries covered. ✓
- [x] **No two cards in the same set are near-duplicates** — v1 had Jab + Pommel Strike + Skull Cracker + Bone Splinter as overlapping 1–3-stam strikes; v2 keeps **jab** (free, stam-positive) and **bone-splinter** (3 stam, bleed payload) — distinct roles. Pommel-strike, skull-cracker, bandage's old v1 stamina version, catch-breath, wild-swing, quick-step, plate-up's twin, reaver's-path, hamstring, stagger-blow, pommel-strike, indomitable, carnage, earthshaker, resolve all cut per §9 (numeric clones, filler utility, mechanic-bloat). ✓
- [x] **Starter deck (10 cards) playable solo** — 4× Strike refunds the Stamina that funds 1× Heavy Hit and 1× Cleave per pass; 3× Defend provides armor floor; Bloodied Grip stacks Rage from card one. No other card required. ✓
- [x] **At least one noob-trap weak card AND one OP build-definer**:
  - **Noob trap**: **bandage** (HP/2 to heal 6 — net only +4 HP; +1 SPI is meager) and **rallying-roar** (drains SPI for a *temporary* STR — players who don't know SPI resets each combat will misvalue it). The deliberately weak commons.
  - **OP build-definer**: **worldbreaker** (free epic with once-per-combat + 5 HP loss + conditional permanent +2 STR). A single Worldbreaker kill snowballs the run. ✓
- [x] **Cost shape is varied within every rarity tier** — see §4 cost-shape spread table:
  - **Common**: free (6 cards), single-cost (4), dual/HP (whetstone D/1, bandage HP/2). ✓
  - **Uncommon**: free (counter-strike, battle-stance), single-cost (7), HP/Defense/Stat-drain (reckless-charge HP/3, shieldbash D/5, rallying-roar SPI-drain). ✓
  - **Rare**: free-with-stat-drain (bloodsworn), single-cost (6), dual (berserker S/15 + D/5). ✓
  - **Epic**: free-with-consequence (worldbreaker), single-cost (doom-blade D/10), dual (last-stand S/5 + M/5). ✓
  Rarity does **not** predict cost shape — proven for all four tiers. ✓
- [x] **Each rare/epic carries a tradeoff** — fury (10 Def), iron-skin (5 Mana), bulwark (8 Stam), berserker (15 Stam + 5 Def), execute (12 Stam, niche target), crimson-tide (needs bleed setup), unyielding (8 Stam), bloodsworn (STR drain), doom-blade (10 Def), last-stand (Stam + Mana), worldbreaker (once-per-combat + 5 HP + conditional payoff). ✓

### 8.1 Trim audit — what was cut from v1's 50 → v2's 35

Per framework §9 heuristic:
- **Numeric strike clones cut**: pommel-strike, skull-cracker (kept jab as the distinct stam-positive light hit; bone-splinter as the bleed-payload variant).
- **Filler utility cut**: catch-breath (pure stamina cantrip), wild-swing (50%-miss noob trap — bandage takes the "deliberately weak" slot), second-wind, quick-step (cooldown-rider duplication; parry now carries that rider via combo).
- **Mechanic-bloat trim**: v1 had 33 stamina cards — cut hamstring, stagger-blow, reaver's-path (bleed-bloat triplicates), indomitable (stat-stack duplicate of plate-up), resolve (HP-scale duplicate of battle-stance), earthshaker (AoE-bleed duplicate of cleave + crimson-tide combo), carnage (AoE-rage duplicate of avalanche niche).
- **Kept iconic / build-anchor cards**: worldbreaker, crimson-tide, last-stand, doom-blade, berserker, fury, execute. **Avalanche cut** (its Rage-dump role overlapped worldbreaker's conditional-payoff role; with only 3 epic slots, worldbreaker won the "Rage-build epic" seat).
- **Cards.json IDs preserved**: strike, heavy-hit, defend, cleave, counter-strike, shield-wall, fortify, iron-skin, fury, berserker, parry, bulwark, last-stand, reckless-charge, execute, doom-blade — all present. ✓

---

## 9. Balance audit (RPU pass per framework §10)

This section audits every card against framework §10 (`Reward-per-Usage`). RPU = total reward units (R) divided by total cost units (C, floored at 1 for free cards). Bands by rarity: Common 6.0–9.0 · Uncommon 8.5–11.5 · Rare 11.0–14.5 · Epic 13.5–19.0.

### 9.1 Scoring conventions used

- Default card cooldown is 1.0s baseline (C = 0). No cards in this set have above-baseline cooldowns, so cooldown contributes 0 to C throughout.
- AoE damage is scored at single-target value (conservative; AoE multi-hit upside is "free").
- "Rage stack" = +1 temp STR for the combat → 3.0 R per stack (§10.1 stat buff temp STR).
- "STR for next N attacks" (war-cry-style — bounded, not whole-combat) is scored at **2.0 R per +1 STR**, between the §10.1 full-combat 3.0 R/pt and a half-credit conditional rider 1.5 R/pt.
- "+X Armor per STR" uses Warrior baseline STR = 4 (§10.7).
- Conditional riders (e.g. iron-resolve "+4 more if HP<50%") count at half their face value (avg activation ~50%).
- Wound-reopener's "double Bleed remaining" assumes avg 4 Bleed on target when fired (~8 R added) and ~60% activation → +4.8 R.
- Crimson-tide assumes avg 4 Bleed stacks on a target when fired.
- Worldbreaker's "+2 STR permanently this run" rider is amortized at **+10 R** per framework §10.6 example.

### 9.2 Per-card RPU table (post-adjustment)

| ID | Rarity | R (effects) | C (cost) | RPU | Band |
|---|---|---|---|---|---|
| strike | common | 7 + 0.5 = 7.5 | 0 → 1 | 7.5 | ✓ |
| heavy-hit | common | 16 | 2.0 | 8.0 | ✓ |
| defend | common | 7.0 | 0 → 1 | 7.0 | ✓ |
| cleave | common | 10 | 1.5 | 6.67 | ✓ |
| brace | common | 6.3 + 0.5 = 6.8 | 0 → 1 | 6.8 | ✓ |
| bloodied-grip | common | 3 + 3 = 6.0 | 0 → 1 | 6.0 | ✓ |
| iron-resolve | common | 5.6 + 1.4 = 7.0 | 0 → 1 | 7.0 | ✓ |
| shoulder-check | common | 6 + 1 = 7.0 | 1.0 | 7.0 | ✓ |
| whetstone | common | 6.0 | 0.7 | 8.57 | ✓ |
| jab | common | 6 + 1 = 7.0 | 0 → 1 | 7.0 | ✓ |
| bandage | common | 10.8 + 1.5 = 12.3 | 2.0 | 6.15 | ✓ |
| war-cry | common | 6.0 | 1.0 | 6.0 | ✓ |
| counter-strike | uncommon | 8 + 2 = 10.0 | 0 → 1 | 10.0 | ✓ |
| shield-wall | uncommon | 14.0 | 1.5 | 9.33 | ✓ |
| fortify | uncommon | 17.5 | 2.0 | 8.75 | ✓ |
| parry | uncommon | 5.6 + 5 = 10.6 | 1.0 | 10.6 | ✓ |
| reckless-charge | uncommon | 35 | 4.0 | 8.75 | ✓ |
| rage-cycle | uncommon | 8 + 6 = 14.0 | 1.5 | 9.33 | ✓ |
| bone-splinter | uncommon | 5 + 10 = 15.0 | 1.5 | 10.0 | ✓ |
| battle-stance | uncommon | 9.0 (3 STR avg × 3.0) | 0 → 1 | 9.0 | ✓ |
| shieldbash | uncommon | 14.0 (avg armor) | 1.4 | 10.0 | ✓ |
| wound-reopener | uncommon | 4 + 4.8 = 8.8 | 1.0 | 8.8 | ✓ |
| plate-up | uncommon | 10.5 + 3 = 13.5 | 1.5 | 9.0 | ✓ |
| rallying-roar | uncommon | 9 + 5 = 14.0 | 1.5 | 9.33 | ✓ |
| fury | rare | 45 | 3.5 | 12.86 | ✓ |
| iron-skin | rare | 21.0 | 1.8 | 11.67 | ✓ |
| bulwark | rare | 24.5 | 2.0 | 12.25 | ✓ |
| berserker | rare | 70 | 4.0 + 2.1 = 6.1 | 11.48 | ✓ |
| execute | rare | 55 | 4.0 | 13.75 | ✓ |
| crimson-tide | rare | 15 + 12 = 27.0 | 2.0 | 13.5 | ✓ |
| unyielding | rare | (20+12) × 0.7 = 22.4 | 2.0 | 11.2 | ✓ |
| bloodsworn | rare | 15 + 21 = 36.0 | 3.0 | 12.0 | ✓ |
| doom-blade | epic | 75 | 4.2 | 17.86 | ✓ |
| last-stand | epic | 49.0 | 1.5 + 1.8 = 3.3 | 14.85 | ✓ |
| worldbreaker | epic | 120 + 10 = 130 | 6.0 + 3.0 = 9.0 | 14.44 | ✓ |

All 35 cards land inside their rarity band.

### 9.3 Per-card change log (before → after)

Cards not listed below were already in band at authored numbers.

**Commons:**

- **heavy-hit**: 13 dmg / S/5 → **16 dmg / S/4** to lift RPU from 4.52 → 8.0 ✓. (Per §10.6, the framework's worked example for this exact card.)
- **defend**: +2 Armor → **+10 Armor** to lift RPU from 1.4 → 7.0 ✓. Reference: 10 Armor × 0.7 R = 7.0 R, matching Strike's reference R.
- **cleave**: 5 dmg AoE / S/4 → **10 dmg AoE / S/3** to lift RPU from 2.5 → 6.67 ✓. (Scored single-target conservatively; AoE upside is bonus.)
- **brace**: +1 Armor / +1 Stam → **+9 Armor / +1 Stam** to lift RPU from 1.2 → 6.8 ✓.
- **iron-resolve**: +2 Armor + 2 conditional → **+8 Armor + 4 conditional** to lift RPU from 2.1 → 7.0 ✓.
- **shoulder-check**: 4 dmg / S/2 → **6 dmg / S/2** to lift RPU from 5.0 → 7.0 ✓.
- **whetstone**: +1 STR temp / D/1 → **+2 STR temp / D/1** to lift RPU from 4.29 → 8.57 ✓.
- **jab**: 2 dmg + 2 Stam → **6 dmg + 2 Stam** to lift RPU from 3.0 → 7.0 ✓.
- **bandage**: Heal 6 / HP/2 → **Heal 12 / HP/1** to lift RPU from 1.73 → 6.15 ✓ (kept as noob-trap floor of band).
- **war-cry**: +2 STR/2-attacks / S/3 → **+3 STR/2-attacks / S/2** to lift RPU from 2.67 → 6.0 ✓.

**Uncommons:**

- **counter-strike**: unchanged. RPU = 10.0 ✓.
- **shield-wall**: +5 Armor / S/5 → **+20 Armor / S/3** to lift RPU from 1.4 → 9.33 ✓.
- **fortify**: +8 Armor / S/10 → **+25 Armor / S/4** to lift RPU from 1.12 → 8.75 ✓. (Differentiated from shield-wall: more Armor for slightly more Stamina.)
- **parry**: +3 Armor + 2 dmg / S/3 → **+8 Armor + 5 dmg / S/2** to lift RPU from 2.73 → 10.6 ✓.
- **reckless-charge**: 18 dmg / HP/3 → **35 dmg / HP/2** to lift RPU from 3.0 → 8.75 ✓.
- **rage-cycle**: 6 dmg / S/4 → **8 dmg / S/3** to lift RPU from 6.0 → 9.33 ✓.
- **bone-splinter**: 6 dmg + 6 Bleed / S/3 → **5 dmg + 4 Bleed / S/3** to drop RPU from 14.0 → 10.0 ✓. (Was over-band — Bleed at 2.5 R/stack made the authored 6 Bleed too hot for uncommon.)
- **battle-stance**: unchanged. RPU = 9.0 ✓.
- **shieldbash**: max 14 / D/5 → **max 18 / D/2** to lift RPU from 2.86 → 10.0 ✓.
- **wound-reopener**: 3 dmg / S/2 → **4 dmg / S/2** to lift RPU from 7.8 → 8.8 ✓.
- **plate-up**: +4 Armor + 1 VIT / S/5 → **+15 Armor + 2 VIT / S/3** to lift RPU from 1.72 → 9.0 ✓.
- **rallying-roar**: +1 STR + 5 Stam / SPI-drain → **+3 STR + 10 Stam / SPI-drain** to lift RPU from 3.67 → 9.33 ✓.

**Rares:**

- **fury** (iconic): 20 dmg / D/10 → **45 dmg / D/5** to lift RPU from 2.86 → 12.86 ✓.
- **iron-skin**: +7 Armor / M/5 → **+30 Armor / M/3** to lift RPU from 1.63 → 11.67 ✓.
- **bulwark**: +12 Armor / S/8 → **+35 Armor / S/4** to lift RPU from 2.1 → 12.25 ✓.
- **berserker** (iconic): 27 dmg / S/15+D/5 → **70 dmg / S/8+D/3** to lift RPU from 2.45 → 11.48 ✓. (Dual cost shape preserved.)
- **execute** (iconic): 30 dmg / S/12 → **55 dmg / S/8** to lift RPU from 5.0 → 13.75 ✓.
- **crimson-tide** (iconic): 9 + 2/Bleed / S/6 → **15 + 3/Bleed / S/4** to lift RPU from 5.67 → 13.5 ✓ (ceiling-adjacent — appropriate for a Bleed-build payoff rare).
- **unyielding**: +10 Armor + 1/STR / S/8 → **+20 Armor + 3/STR / S/4** to lift RPU from 2.45 → 11.2 ✓.
- **bloodsworn**: 5 dmg + 3 Rage / STR-drain → **15 dmg + 7 Rage / STR-drain** to lift RPU from 4.67 → 12.0 ✓.

**Epics:**

- **doom-blade** (iconic): 40 dmg / D/10 → **75 dmg / D/6** to lift RPU from 5.71 → 17.86 ✓. (HP self-damage rider explicitly dropped per existing §5.4 note.)
- **last-stand** (iconic): +17 Armor / S/5+M/5 → **+70 Armor / S/3+M/3** to lift RPU from 2.16 → 14.85 ✓. (Dual cost shape preserved; mana barrier intact.)
- **worldbreaker** (iconic, build-definer): 60 dmg + permanent +2 STR / HP-5 once-per-combat → **120 dmg + permanent +2 STR / HP-3 once-per-combat** to lift RPU from 5.38 → 14.44 ✓. Followed framework §10.6 worked example's "boost damage" lever; trimmed HP cost 5 → 3 to keep the card playable in early combats.

### 9.4 Summary

- **32 of 35 cards adjusted** — 31 lifted into band from below; 1 (bone-splinter) trimmed from above band.
- **3 cards unchanged** (already in band at authored values): strike, counter-strike, battle-stance.
- **All 35 cards now sit inside their rarity band.**
- **0 balance exceptions** — every card fit its band without distorting identity. Iconic cards (Worldbreaker, Crimson Tide, Doom Blade, Last Stand, Berserker, Fury, Execute) all sit clearly stronger than their corresponding commons: Strike (common) RPU 7.5 → Fury (rare) 12.86 → Doom Blade (epic) 17.86, a clean ascending curve.

---

## 10. Open Questions for Engine Wiring (not blocking design)

- Rage stack decay: persist across combats or reset? Recommend **reset on combat end** per framework §4.3.
- Bleed tick rate: 1/sec while in combat; off out of combat.
- "Temp STR / VIT / DEX / SPI this combat" buffs need an engine concept of combat-scoped stat deltas — flag for engine phase.
- Worldbreaker permanent +2 STR is a *meta* effect — survives the combat but stays for the run. Engine needs a per-run stat delta layer separate from per-combat.
- Worldbreaker's "once per combat" lock needs a per-card per-combat usage counter — flag for engine phase.
- Cards.json reconciliation: doom-blade's current 3 HP self-damage is dropped in v2 design; last-stand and others match v1 numbers. Update cards.json on next data pass.

---

*End of Warrior class design doc v2. Next: `02_mage.md` (also being rewritten to v2).*
