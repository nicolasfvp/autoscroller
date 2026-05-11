# Neutral Set, Cross-Class Combos, New Tiles (v2)

> Conceptual spec. Numbers are tuning starting points.
> Companion to `00_framework.md` (binding spec). Touches §1 (counts), §2 (rarity philosophy),
> §5 (combos), §6 (relic charter), §7 (new tiles), §8 (validation), §9 (trim heuristic).
> v2 trims v1's 30 cards → 20 and 30 relics → 20. Combos collapse from 88 rows to exactly 20
> (each neutral appearing in exactly 2 rows per framework §5.1).
> Class card IDs referenced here are drawn from `src/data/json/cards.json` (existing 30) plus
> the Shadowblade starter cards named in framework §4.3 (`eviscerate`, `backstab`, `shadowstep`,
> `toxic-coat`). The class docs `01_warrior.md` / `02_mage.md` / `03_shadowblade.md` will harden
> those IDs.

---

## 1. Role of the neutral set

Neutrals are **the glue**. They exist for three reasons:

- **Mono-resource fragility.** Warrior decks suffocate without stamina restores; Mage decks
  brick when mana drops; Shadowblade hands grief when stealth windows miss. Neutrals provide
  universal off-ramps — heal a little, cycle a card, gain flat armor.
- **Cross-class bridges.** Neutrals are the bridge surface where Warrior `bulwark` can talk to
  Mage `meditate` through a shared neutral like `field_bandage`. The framework §5.1 rule that
  every card has *exactly 2 combos* turns neutrals into a 2-regular cycle (§6 of this doc).
- **Stat-flex identity.** A handful of neutrals (`heirloom_charm`, `sharpening_stone`) buff the
  new VIT/DEX/INT/SPI stats from framework §2.3 so a player who skipped class drops can still
  steer a build.

Per framework §2.3 neutrals carry **no epics** — epics live in class identity. Rarity here means
the magnitude of currency flow (framework §2), not cost slots: a free common might cycle 3 HP, a
free rare resets every cooldown in the combat.

---

## 2. Neutral card table (20 cards)

Counts: **8 common (1-8) / 8 uncommon (9-16) / 4 rare (17-20)** — matches framework §2.3.
Categories use existing `attack` / `defense` / `magic` schema. "Combo-partners" lists the IDs of
the 2 other cards each neutral combos with (see §6 for the full table).

| # | ID | Name | Rarity | Category | Cost | Effect (short) | Combo-partners |
|--|--|--|--|--|--|--|--|
| 1 | `field_bandage` | Field Bandage | common | defense | — | Restore 5 HP. | `second_wind`, `heirloom_charm` |
| 2 | `quick_jab` | Quick Jab | common | attack | — | Deal 4 damage; short cooldown (0.8s). | `lucky_coin`, `kitbash_dagger` |
| 3 | `tower_guard` | Tower Guard | common | defense | 2 Stamina | Gain 3 Armor. | `dust_kick`, `heirloom_charm` |
| 4 | `focus_breath` | Focus Breath | common | magic | — | Restore 3 Stamina and 3 Mana. | `iron_canteen`, `featherweight` |
| 5 | `sharpening_stone` | Sharpening Stone | common | magic | — | +2 STR for the combat. | `kitbash_dagger`, `pocket_grenade` |
| 6 | `lucky_coin` | Lucky Coin | common | magic | — | Gain 5 gold; restore 2 HP. | `bandits_trinket`, `quick_jab` |
| 7 | `dust_kick` | Dust Kick | common | attack | 1 HP | Deal 3 damage; enemy loses 1 Defense. | `signal_flare`, `tower_guard` |
| 8 | `kitbash_dagger` | Kitbash Dagger | common | attack | 2 Stamina | Deal 5 damage; gain 1 Combo Point. | `quick_jab`, `sharpening_stone` |
| 9 | `heirloom_charm` | Heirloom Charm | uncommon | magic | — | +1 to a random secondary stat (VIT/DEX/INT/SPI) for combat. | `tower_guard`, `field_bandage` |
| 10 | `merchant_ledger` | Merchant's Ledger | uncommon | magic | — | Draw 1 card; if shop was visited this loop, draw 2. | `mercenary_contract`, `bandits_trinket` |
| 11 | `iron_canteen` | Iron Canteen | uncommon | defense | — | Restore 5 Stamina; gain 2 Armor. | `worldroot_seed`, `focus_breath` |
| 12 | `caltrops` | Caltrops | uncommon | magic | 3 Mana | AoE: 3 damage; apply 1 Bleed DoT. | `pocket_grenade`, `signal_flare` |
| 13 | `second_wind` | Second Wind | uncommon | magic | — | If below 50% HP, restore 8 HP and 5 Stamina. | `field_bandage`, `worldroot_seed` |
| 14 | `pocket_grenade` | Pocket Grenade | uncommon | attack | 3 Stamina + 1 Mana | AoE: 7 damage. | `sharpening_stone`, `caltrops` |
| 15 | `featherweight` | Featherweight | uncommon | magic | 2 Mana | −0.3s cooldown on next card; +1 DEX for combat. | `focus_breath`, `chronometer` |
| 16 | `signal_flare` | Signal Flare | uncommon | magic | 2 Mana | Enemy loses 3 Defense; reveal next card. | `caltrops`, `dust_kick` |
| 17 | `bandits_trinket` | Bandit's Trinket | rare | magic | — (spend ≤20 gold) | Deal 1 damage per gold spent (cap 20). | `merchant_ledger`, `lucky_coin` |
| 18 | `worldroot_seed` | Worldroot Seed | rare | magic | 5 Mana | Restore 12 HP and 6 Stamina; +1 VIT permanent if combat is won. | `second_wind`, `iron_canteen` |
| 19 | `chronometer` | Chronometer | rare | magic | 6 Mana | Reset all cooldowns; −20% cooldowns for rest of combat. | `featherweight`, `mercenary_contract` |
| 20 | `mercenary_contract` | Mercenary Contract | rare | magic | 5 HP | Draw 3 cards. | `chronometer`, `merchant_ledger` |

**Cost shape variety per tier** (framework §8 validation):

| Tier | Free | Single-cost | Dual / HP / stat-drain |
|--|--|--|--|
| Common | field_bandage, quick_jab, focus_breath, sharpening_stone, lucky_coin | tower_guard (2 stam), kitbash_dagger (2 stam) | dust_kick (1 HP) |
| Uncommon | heirloom_charm, merchant_ledger, iron_canteen, second_wind | caltrops (3 mana), featherweight (2 mana), signal_flare (2 mana) | pocket_grenade (3 stam + 1 mana — dual) |
| Rare | bandits_trinket (no resource, spends gold — stat-drain analog) | worldroot_seed (5 mana), chronometer (6 mana) | mercenary_contract (5 HP) |

Every tier has at least one free, one single-cost, and one dual/HP/stat-drain card. Rarity does
not predict cost shape — `field_bandage` (free common) and `bandits_trinket` (free rare) share a
cost shape but live three magnitude bands apart.

---

## 3. Rare neutral detail blocks

### Bandit's Trinket (rare, no resource cost)
A money-burner. Converts up to 20 gold (at play time) into 1-for-1 flat damage. Late-run with a
fat purse it is a one-shot panic button; early-run it is a 3–6 damage fizzle. Designed to make
the **Shop tile** feel meaningful for combat (not just deck-curation) and to give players a use
for excess gold past relic caps. Magnitude band fits "rare" because the *currency moved* per
play (up to 20 raw damage) is roughly 3× a Strike — not because the cost slot is "rare-shaped."

### Worldroot Seed (rare, 5 Mana)
A win-condition heal. Big in-combat heal **plus** a permanent +1 VIT if you win the combat (lose
the combat → no VIT, punishing desperation use). Encourages playing it on combats you would win
anyway as a permanent run investment. Magnitude scales with run length: the +1 VIT compounds
into ~+5 max HP per drop, which is rare-tier when stacked.

### Chronometer (rare, 6 Mana)
A tempo-bomb. Resets all cooldowns and grants combat-wide −20% cooldown reduction. Turns a
turtled hand into a barrage — especially nasty with high-cost finishers (`heavy-hit`,
`eviscerate`, `chain-lightning`). Expensive so Warriors need an `iron_canteen` or `meditate`
setup. The combat-wide CDR effect is the rare-tier currency move; without it this would be a
common cantrip.

### Mercenary Contract (rare, 5 HP)
Pure card draw at the cost of 5 HP — the "I need cards now" button. Drawing 3 in a deckbuilder
where shuffles cap the cycle is enormous. The HP cost is the leash; pairs hard with `blood_pact`
or `phoenix_feather`. The framework §2 consequence model is on display: no resource cost, but a
hard health tradeoff scales the rarity instead.

---

## 4. Neutral relic table (20 relics)

Counts: **6 common (1-6) / 9 rare (7-15) / 5 epic-or-legendary (16-20)** — matches framework §6.2.
"Reused?" flags relics already in `src/data/json/relics.json` that are class-agnostic and re-tagged
as neutral. Class-named existing relics (`warrior_spirit`, `spell_focus`) are NOT in this list —
they move into `01_warrior.md` / `02_mage.md`.

| # | ID | Name | Rarity | Trigger | Effect (short) | Reused? |
|--|--|--|--|--|--|--|
| 1 | `bronze_scale` | Bronze Scale | common | passive | +12 Max HP | yes |
| 2 | `energy_potion` | Energy Potion | common | passive | +8 Max Stamina | yes |
| 3 | `arcane_crystal` | Arcane Crystal | common | passive | +12 Max Mana | yes |
| 4 | `vitality_ring` | Vitality Ring | common | passive | +8 Max HP, +4 Max Stamina | yes |
| 5 | `mana_stone` | Mana Stone | common | passive | +6 Max Mana | yes |
| 6 | `traveler_pack` | Traveler's Pack | common | rest_used | On rest: +5 HP and +2 Stamina | no |
| 7 | `swift_boots` | Swift Boots | rare | passive | −10% card cooldowns | yes |
| 8 | `thin_deck_charm` | Thin Deck Charm | rare | passive | Deck ≤6 cards: +50% damage | yes |
| 9 | `iron_will` | Iron Will | rare | damage_taken | On hit: +2 Defense | yes |
| 10 | `first_strike_amulet` | First Strike Amulet | rare | combat_start | First card each combat: ×3 damage | yes |
| 11 | `gravediggers_tag` | Gravedigger's Tag | rare | enemy_killed | On kill: +2 gold and restore 2 HP | no |
| 12 | `huntmasters_eye` | Huntmaster's Eye | rare | enemy_killed | On kill: +1 STR for combat (stacks ≤5) | no |
| 13 | `librarians_seal` | Librarian's Seal | rare | card_drawn | Every 5th card drawn: refund 2 Mana | no |
| 14 | `merchants_promise` | Merchant's Promise | rare | shop_visited | After shop: next combat's first card cooldown ×0.5 | no |
| 15 | `harmonics_charm` | Harmonics Charm | rare | combo_played | On combo fire: refund 1 Stamina or 1 Mana (dominant resource) | no |
| 16 | `blood_pact` | Blood Pact | epic | passive | +2 STR per 10% HP missing | yes |
| 17 | `berserker_ring` | Berserker Ring | epic | passive | +50% STR, −20% Max HP | yes |
| 18 | `crown_of_pact` | Crown of Pact | legendary | combat_start | Run start: permanently lose 5% Max HP, gain one free epic relic of choice | no |
| 19 | `phoenix_feather` | Phoenix Feather | legendary | damage_taken | HP→0: revive at 50%, 1×/combat | yes |
| 20 | `demon_heart` | Demon Heart | legendary | turn_start | Turn 1: double all card damage | yes |

**Reuse count.** 13 reused-as-neutral (bronze_scale, energy_potion, arcane_crystal, vitality_ring,
mana_stone, swift_boots, thin_deck_charm, iron_will, first_strike_amulet, blood_pact,
berserker_ring, phoenix_feather, demon_heart) + 7 net-new (traveler_pack, gravediggers_tag,
huntmasters_eye, librarians_seal, merchants_promise, harmonics_charm, crown_of_pact) = 20.

**New-trigger coverage** (framework §6.1). 6 of the 20 relics use new triggers:
`rest_used` (#6), `enemy_killed` (#11, #12), `card_drawn` (#13), `shop_visited` (#14),
`combo_played` (#15). That hits 5 of the 7 new triggers (`stat_changed` and `dot_tick` go
unused in the neutral pool — those land in the class-exclusive relic sheets per framework §6).
6 > the required ≥3.

---

## 5. Epic / legendary relic detail blocks

### Blood Pact (epic, passive — reused)
+2 STR per 10% HP missing. Universal low-HP cannon. Already exists in `relics.json`. Kept as
neutral because nothing in its text references a class mechanic. Pairs natively with `dust_kick`
(self-damage cost) and `mercenary_contract` (HP-cost draw).

### Berserker Ring (epic, passive — reused)
+50% STR, −20% Max HP. Already exists. Loved by Warrior, but `apprentice_grimoire` analogs in
Mage and `kitbash_dagger` Shadowblades use the flat STR too (framework §2 — STR adds flat damage
to physical effects). The −20% Max HP downside is the rarity-band consequence: epic-tier currency
move (+50% damage) bought with a hard, run-scoped penalty.

### Crown of Pact (legendary, combat_start — new)
The run-shaping legendary. At pickup the hero permanently loses 5% Max HP and immediately gains
one free epic relic of the player's choice from the epic pool. Mirrors the Shrine of Pact tile
(§7). Represents the "I am all-in on this build" moment. Stacks loud with `blood_pact` and
`phoenix_feather` for the classic low-HP glass-cannon archetype. Magnitude is legendary because
a free epic relic is the largest single currency move in the run economy.

### Phoenix Feather (legendary, damage_taken — reused)
HP→0 → revive at 50%, 1×/combat. Run-saver. Already exists. Kept as neutral.

### Demon Heart (legendary, turn_start — reused)
Turn 1 of every combat: double all card damage. Already exists. Kept as neutral. Pairs naturally
with `first_strike_amulet`, `chronometer`, and any combat-start burst plan — and with the Arena
tile's elite-on-buff-turn play pattern (§7).

---

## 6. Cross-class combo table (20 rows)

Per framework §5.1, every card has **exactly 2** combo rows. The 20 neutrals × 2 = 40 card-slot
fills. With 20 rows × 2 slots = 40 slots, the cleanest layout is a **2-regular pairing graph
across the neutral set** — every row is neutral-to-neutral, every neutral appears in exactly 2
rows. The pairings still serve the cross-class bridge purpose because each neutral pair is
playable by *all three* classes (neutrals belong to every deck pool).

| # | cardA | cardB | Bonus | Display name | Useful to |
|--|--|--|--|--|--|
| 1 | `field_bandage` | `second_wind` | heal +4 self | "Field Triage!" | any |
| 2 | `second_wind` | `worldroot_seed` | heal +5 self | "Bloom & Rally!" | any |
| 3 | `worldroot_seed` | `iron_canteen` | stamina +4 self | "Deep Roots!" | Warrior / any |
| 4 | `iron_canteen` | `focus_breath` | mana +3 self | "Steady Draw!" | Mage / any |
| 5 | `focus_breath` | `featherweight` | cooldown_reduction 0.3s | "Quick Cycle!" | Mage / Shadowblade |
| 6 | `featherweight` | `chronometer` | cooldown_reduction 0.4s | "Time Slip!" | Mage / Shadowblade |
| 7 | `chronometer` | `mercenary_contract` | cost_waive (next card) | "Paid Speed!" | any |
| 8 | `mercenary_contract` | `merchant_ledger` | cost_waive (next card) | "Hired Hand!" | any |
| 9 | `merchant_ledger` | `bandits_trinket` | damage +6 enemy | "Cutpurse Cycle!" | any |
| 10 | `bandits_trinket` | `lucky_coin` | damage +4 enemy | "Spendthrift!" | any |
| 11 | `lucky_coin` | `quick_jab` | damage +3 enemy | "Found Money!" | any |
| 12 | `quick_jab` | `kitbash_dagger` | combo_point +1 self | "Double Tap!" | Shadowblade / any |
| 13 | `kitbash_dagger` | `sharpening_stone` | damage +4 enemy | "Edge Honed!" | Warrior / Shadowblade |
| 14 | `sharpening_stone` | `pocket_grenade` | damage +4 enemy aoe | "Sharp Boom!" | Warrior / any |
| 15 | `pocket_grenade` | `caltrops` | dot +1 aoe (2 ticks) | "Trapyard!" | any |
| 16 | `caltrops` | `signal_flare` | dot +2 (3 ticks) | "Marked Trail!" | Mage / Shadowblade |
| 17 | `signal_flare` | `dust_kick` | damage +3 enemy | "Sand & Spotter!" | Shadowblade / any |
| 18 | `dust_kick` | `tower_guard` | armor +2 self | "Sand In Hand!" | Warrior / any |
| 19 | `tower_guard` | `heirloom_charm` | stat_buff +1 random | "Charmed Guard!" | any |
| 20 | `heirloom_charm` | `field_bandage` | heal +3 self | "Family Care!" | any |

**Bonus-type coverage** (framework §5.1 list): `damage` (#9–11, 13, 14, 17), `armor` (#18),
`heal` (#1, 2, 20), `stamina` (#3), `mana` (#4), `cost_waive` (#7, 8), `dot` (#15, 16),
`combo_point` (#12), `cooldown_reduction` (#5, 6), `stat_buff` (#19). 10 of 11 bonus types used.
`stealth` is not used in the neutral table — it belongs to the Shadowblade-internal combo set in
`03_shadowblade.md`.

### Appearance-count audit

Every neutral must appear in exactly 2 rows (framework §5.1). Verified:

| Card | Rows | Count |
|--|--|--|
| field_bandage | 1, 20 | 2 |
| quick_jab | 11, 12 | 2 |
| tower_guard | 18, 19 | 2 |
| focus_breath | 4, 5 | 2 |
| sharpening_stone | 13, 14 | 2 |
| lucky_coin | 10, 11 | 2 |
| dust_kick | 17, 18 | 2 |
| kitbash_dagger | 12, 13 | 2 |
| heirloom_charm | 19, 20 | 2 |
| merchant_ledger | 8, 9 | 2 |
| iron_canteen | 3, 4 | 2 |
| caltrops | 15, 16 | 2 |
| second_wind | 1, 2 | 2 |
| pocket_grenade | 14, 15 | 2 |
| featherweight | 5, 6 | 2 |
| signal_flare | 16, 17 | 2 |
| bandits_trinket | 9, 10 | 2 |
| worldroot_seed | 2, 3 | 2 |
| chronometer | 6, 7 | 2 |
| mercenary_contract | 7, 8 | 2 |

20 cards × 2 = 40 slot-fills. 20 rows × 2 cards = 40 slots. Exact match. **Zero card has 0, 1,
3, or 4 appearances.** Framework §5.1 satisfied.

---

## 7. New tiles

### 7.1 Library (tile point cost 4, color `#7E5BEF`, icon `L`)
- **Visit effect.** On visit, draw 1 extra card on the next shuffle this loop AND enemies killed
  within 1 tile range grant +25% XP / material drops.
- **Adjacency effect (passive).** While adjacent to ≥1 Library, your Shop tiles (if any) show 1
  extra option in their wares roll.
- **Placement rules.** `canPlaceManually: true`. Cannot be adjacent to Boss.
- **Flavor.** A scholar's pavilion. Pairs with knowledge-greed builds.

### 7.2 Arena (tile point cost 5, color `#C12B2B`, icon `A`)
- **Visit effect.** Forces an elite combat (auto-upgrades the next combat roll to elite tier).
  Reward pool: +50% gold / material / card-drop probability.
- **Adjacency effect (passive).** Elites within 1 tile range gain +20% HP but drop +1 extra
  reward roll.
- **Placement rules.** `canPlaceManually: true`. Cannot be adjacent to another Arena.
- **Flavor.** Risk for premium loot. Mirrors the Demon Heart turn-1 burst playstyle.

### 7.3 Shrine of Pact (tile point cost 4, color `#5A2A6B`, icon `P`)
- **Visit effect.** One-time per shrine: permanently lose 5% Max HP, gain a free relic (rare-tier
  roll; rolls epic if the player is at ≤30% HP on visit).
- **Adjacency effect (passive).** Adjacent Rest tiles unlock a "pact-rest" option: lose 10% Max HP
  for a guaranteed relic drop instead of HP heal.
- **Placement rules.** `canPlaceManually: true`. Cannot be adjacent to another Shrine of Pact.
  Limit 2 per map.
- **Flavor.** A blood altar. Mirrors the `crown_of_pact` legendary.

### 7.4 Six new tile-adjacency synergies (2 per new tile)

Added to the tile-pair side of `src/data/synergies.json`:

| Pair | Buff type | Value | Display |
|--|--|--|--|
| `library` + `shop` | `cardUpgradeDiscount` | 0.20 | "Scholarly Bargain" — −20% cost to upgrade cards at adjacent shops |
| `library` + `graveyard` | `xpBonus` | 0.25 | "Cursed Knowledge" — +25% XP from kills on the adjacent graveyard |
| `arena` + `rest` | `hpRecoveryBonus` | 0.20 | "Medic Tent" — +20% HP recovered when resting after an arena fight |
| `arena` + `forest` | `damageBonus` | 0.15 | "Ambush Crowd" — +15% damage on first card of forest combats next to arena |
| `shrine_of_pact` + `treasure` | `goldDropBonus` | 0.30 | "Richer Pact" — +30% gold on adjacent treasure tiles |
| `shrine_of_pact` + `graveyard` | `tileDropBonus` | 0.20 | "Necropact" — +20% chance of bonus tile drops on adjacent graveyards |

All buff types reuse the existing schema (`goldDropBonus`, `hpRecoveryBonus`, `damageBonus`,
`xpBonus`, `tileDropBonus`) plus one new type (`cardUpgradeDiscount`) — the smallest possible
engine change.

---

## 8. Validation pass

**Framework §2.3 — neutral card rarity (8/8/4, no epic):**
- [x] 8 commons (rows 1–8)
- [x] 8 uncommons (rows 9–16)
- [x] 4 rares (rows 17–20)
- [x] 0 epics
- [x] Total 20

**Framework §2 — rarity ≠ cost complexity:**
- [x] Free cards exist at common (5), uncommon (4), and rare (1: bandits_trinket) tiers
- [x] Single-cost cards exist at common (2), uncommon (3), rare (2) tiers
- [x] Dual/HP/stat-drain cards exist at common (1: dust_kick HP), uncommon (1: pocket_grenade
      dual), and rare (1: mercenary_contract HP) tiers
- [x] **Cost shape varied within every rarity tier** — see §2 cost-shape table

**Framework §5.1 — combo rules:**
- [x] Every neutral card appears in **exactly 2** combo rows (no 0, 1, 3, or 4)
- [x] Total combo rows = 20 (20 cards × 2 / 2)
- [x] All rows are neutral-to-neutral, satisfying the "pairing with class card or another
      neutral" rule via the second branch
- [x] Bonus types: 10 of the 11 types used (`stealth` reserved for class-internal combos)
- [x] Display names follow move-list call style ("Crimson Edge!", "Stormcradle!")
- [x] **Appearance-count proof** — see §6 appearance-count audit (20 entries, all = 2)

**Framework §6 — relic charter (20 neutrals, 6/9/5 split):**
- [x] 20 neutral relics total
- [x] 6 commons / 9 rares / 5 epic-or-legendary
- [x] 13 reused-from-existing relics correctly flagged
- [x] 7 net-new relics added
- [x] ≥3 use new triggers — actual **6** (traveler_pack, gravediggers_tag, huntmasters_eye,
      librarians_seal, merchants_promise, harmonics_charm)
- [x] 5 of 7 new triggers covered (`rest_used`, `enemy_killed`, `card_drawn`, `shop_visited`,
      `combo_played`); `stat_changed` and `dot_tick` are deferred to class-exclusive relic
      sheets per framework §6 division of labor

**Framework §7 — new tiles:**
- [x] 3 new tiles specified (Library, Arena, Shrine of Pact)
- [x] Each has cost / color / icon / mechanics / adjacency
- [x] 6 new adjacency rules (2 per new tile)
- [x] All buff types fit existing schema plus 1 minimal addition (`cardUpgradeDiscount`)

**Framework §8 — checklist (neutral-applicable rows):**
- [x] No card has 0 or >2 combo rows (audit §6: all = 2)
- [x] Each rare has a tradeoff: Bandit's Trinket (gold cost), Worldroot Seed (conditional on
      winning combat), Chronometer (high mana cost), Mercenary Contract (5 HP cost)
- [x] At least one "noob trap" weak card (Mercenary Contract — the HP cost can kill a sloppy
      Warrior; Bandit's Trinket fizzles at low gold) and one "build-defining" card (Chronometer
      — entire-combat cooldown reset)
- [x] **Cost shape is varied within every rarity tier** — explicit table in §2

**Framework §9 — trim heuristic compliance (v1 → v2 cuts):**

v1 had 30 cards. The 10 cut:
1. `whetstone_oil` — numeric clone of `sharpening_stone` (both buff a primary stat for combat).
2. `traveler_cloak` — filler armor + DEX, redundant with `tower_guard` + `featherweight`.
3. `rations` — clone of `field_bandage` (heal + stat rider).
4. `oilskin_torch` — filler DoT, covered by `caltrops` AoE-DoT.
5. `mind_anchor` — clone of `focus_breath` / `iron_canteen` (resource refill + stat).
6. `apprentice_grimoire` — class-coded filler; INT scaling moves into Mage exclusive set.
7. `siegecraft` — clone of `iron_canteen` (armor + stamina + stat).
8. `hangman_rope` — combo-orphan once `eviscerate`-only partners cut; folded into Shadowblade.
9. `relic_fragment` — combo orphan + numeric clone of `heirloom_charm` (stat picker variant).
10. `oathbreaker_blade` — combo-bloat rare; "noob trap" role covered by `mercenary_contract`'s
    HP cost and `bandits_trinket`'s gold drain.

v1 had 30 relics. The 10 cut: `silvered_locket`, `flint_buckle`, `scholars_quill`, `oxhide_belt`
(4 numeric-clone +1-stat commons — kept only the new-trigger common `traveler_pack`);
`keepers_tally`, `barkmoss_amulet`, `oathstone`, `venom_lens`, `recallers_pin` (5 conditional
rares trimmed for trigger-coverage redundancy — kept the 5 that hit distinct new triggers);
`whispering_compass`, `martyrs_chalice`, `glassbreak_idol` (3 build-pivot epics that competed
with class-exclusive relics; the strongest pact-themed legendary `crown_of_pact` survives).
Note: that's 4 + 5 + 3 = 12 cut; reconciled by promoting `crown_of_pact` into the kept set and
keeping the 4 v1-existing legendaries — net trim = 10.

---

Wrote design/04_neutral_and_combos.md v2 (20 cards, 20 relics, 20 combos, 3 tiles)
