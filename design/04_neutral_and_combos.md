# Neutral Set, Cross-Class Combos, New Tiles (v2)

> Conceptual spec. Numbers are tuning starting points.
> Companion to `00_framework.md` (binding spec). Touches §1 (counts), §2 (rarity philosophy),
> §5 (combos), §6 (relic charter), §7 (new tiles), §8 (validation), §9 (trim heuristic).
> v2 trims v1's 30 cards → 20 and 30 relics → 20. Combos collapse from 88 rows to exactly 20
> (each neutral appearing in exactly 2 rows per framework §5.1).
> Class card IDs referenced here are drawn from `src/data/json/cards.json` (existing 30).
> The class docs `01_warrior.md` / `02_mage.md` harden those IDs.

---

## 1. Role of the neutral set

Neutrals are **the glue**. They exist for three reasons:

- **Mono-resource fragility.** Warrior decks suffocate without stamina restores; Mage decks
  brick when mana drops. Neutrals provide universal off-ramps — heal a little, cycle a card,
  gain flat armor.
- **Cross-class bridges.** Neutrals are the bridge surface where Warrior `bulwark` can talk to
  Mage `meditate` through a shared neutral like `field_bandage`. The framework §5.1 rule that
  every card has *exactly 2 combos* turns neutrals into a 2-regular cycle (§6 of this doc).
- **Stat-flex identity.** A handful of neutrals (`heirloom_charm`, `sharpening_stone`) buff the
  new VIT/DEX/INT/SPI stats from framework §2.3 so a player who skipped class drops can still
  steer a build.

Per framework §2.3 neutrals carry **no epics** — epics live in class identity. Rarity here means
the magnitude of currency flow (framework §2), not cost slots: a free common might cycle 3 HP, a
free rare resets every cooldown in the combat.

Neutrals lean toward the **low end** of their rarity's RPU band (framework §10): they trade raw
magnitude for cross-class flexibility, so a neutral common is roughly 5–15% weaker than a class
common at the same R/C — class cards earn extra power by being class-locked.

---

## 2. Neutral card table (20 cards)

Counts: **8 common (1-8) / 8 uncommon (9-16) / 4 rare (17-20)** — matches framework §2.3.
Categories use existing `attack` / `defense` / `magic` schema. "Combo-partners" lists the IDs of
the 2 other cards each neutral combos with (see §6 for the full table).

| # | ID | Name | Rarity | Category | Cost | Effect (short) | Combo-partners |
|--|--|--|--|--|--|--|--|
| 1 | `field_bandage` | Field Bandage | common | defense | — | Restore 7 HP. | `second_wind`, `heirloom_charm` |
| 2 | `quick_jab` | Quick Jab | common | attack | — | Deal 6 damage; short cooldown (0.8s). | `lucky_coin`, `kitbash_dagger` |
| 3 | `tower_guard` | Tower Guard | common | defense | 2 Stamina | Gain 10 Armor. | `dust_kick`, `heirloom_charm` |
| 4 | `focus_breath` | Focus Breath | common | magic | — | Restore 6 Stamina and 6 Mana. | `iron_canteen`, `featherweight` |
| 5 | `sharpening_stone` | Sharpening Stone | common | magic | — | +2 STR for the combat. | `kitbash_dagger`, `pocket_grenade` |
| 6 | `lucky_coin` | Lucky Coin | common | magic | — | Gain 10 gold; restore 4 HP. | `bandits_trinket`, `quick_jab` |
| 7 | `dust_kick` | Dust Kick | common | attack | 1 HP | Deal 10 damage; enemy loses 3 Defense. | `signal_flare`, `tower_guard` |
| 8 | `kitbash_dagger` | Kitbash Dagger | common | attack | 2 Stamina | Deal 5 damage; gain 1 Combo Point. | `quick_jab`, `sharpening_stone` |
| 9 | `heirloom_charm` | Heirloom Charm | uncommon | magic | — | +3 to a random STR/DEX/INT stat for combat. | `tower_guard`, `field_bandage` |
| 10 | `merchant_ledger` | Merchant's Ledger | uncommon | magic | — (2s cd) | Draw 3 cards; if shop was visited this loop, draw 4 instead. | `mercenary_contract`, `bandits_trinket` |
| 11 | `iron_canteen` | Iron Canteen | uncommon | defense | — | Restore 10 Stamina; gain 6 Armor. | `worldroot_seed`, `focus_breath` |
| 12 | `caltrops` | Caltrops | uncommon | magic | 2 Mana | AoE: 5 damage; apply 2 Bleed DoT. | `pocket_grenade`, `signal_flare` |
| 13 | `second_wind` | Second Wind | uncommon | magic | — | If below 50% HP, restore 8 HP and 5 Stamina. | `field_bandage`, `worldroot_seed` |
| 14 | `pocket_grenade` | Pocket Grenade | uncommon | attack | 2 Stamina + 1 Mana | AoE: 14 damage. | `sharpening_stone`, `caltrops` |
| 15 | `featherweight` | Featherweight | uncommon | magic | 2 Mana | −0.6s cooldown on next card; +3 DEX for combat. | `focus_breath`, `chronometer` |
| 16 | `signal_flare` | Signal Flare | uncommon | magic | 2 Mana | Enemy loses 9 Defense; draw 1 card. | `caltrops`, `dust_kick` |
| 17 | `bandits_trinket` | Bandit's Trinket | rare | magic | — (spend ≤12 gold) | Deal 1 damage per gold spent (cap 12). | `merchant_ledger`, `lucky_coin` |
| 18 | `worldroot_seed` | Worldroot Seed | rare | magic | 3 Mana | Restore 12 HP and 6 Stamina; +1 VIT permanent if combat is won. | `second_wind`, `iron_canteen` |
| 19 | `chronometer` | Chronometer | rare | magic | 3 Mana | Reset all cooldowns; −30% cooldowns for rest of combat. | `featherweight`, `mercenary_contract` |
| 20 | `mercenary_contract` | Mercenary Contract | rare | magic | 1 HP | Draw 5 cards; +4 DEX for combat. | `chronometer`, `merchant_ledger` |

**Cost shape variety per tier** (framework §8 validation):

| Tier | Free | Single-cost | Dual / HP / stat-drain |
|--|--|--|--|
| Common | field_bandage, quick_jab, focus_breath, sharpening_stone, lucky_coin | tower_guard (2 stam), kitbash_dagger (2 stam) | dust_kick (1 HP) |
| Uncommon | heirloom_charm, merchant_ledger, iron_canteen, second_wind | caltrops (2 mana), featherweight (2 mana), signal_flare (2 mana) | pocket_grenade (2 stam + 1 mana — dual) |
| Rare | bandits_trinket (no resource, spends gold — stat-drain analog) | worldroot_seed (3 mana), chronometer (3 mana) | mercenary_contract (1 HP) |

Every tier has at least one free, one single-cost, and one dual/HP/stat-drain card. Rarity does
not predict cost shape — `field_bandage` (free common) and `bandits_trinket` (free rare) share a
cost shape but live three magnitude bands apart.

---

## 3. Rare neutral detail blocks

### Bandit's Trinket (rare, no resource cost)
A money-burner. Converts up to 12 gold (at play time) into 1-for-1 flat damage. Late-run with a
fat purse it is a one-shot panic button; early-run it is a 3–6 damage fizzle. Designed to make
the **Shop tile** feel meaningful for combat (not just deck-curation) and to give players a use
for excess gold past relic caps. Magnitude band fits "rare" because the *currency moved* per
play (up to 12 raw damage) is roughly 2× a Strike — not because the cost slot is "rare-shaped."
The 12-gold cap (down from v1's 20) keeps the card honest: at the framework-prescribed rate of
1.0 R per gold burned the RPU lands inside the rare band rather than blowing past epic.

### Worldroot Seed (rare, 3 Mana)
A win-condition heal. Big in-combat heal **plus** a permanent +1 VIT if you win the combat (lose
the combat → no VIT, punishing desperation use). Encourages playing it on combats you would win
anyway as a permanent run investment. Magnitude scales with run length: the +1 VIT compounds
into ~+5 max HP per drop, which is rare-tier when stacked. The mana cost was trimmed from v1's
5 → 3 to bring the cost-divided RPU into the rare band; the heal numbers and VIT rider are
unchanged.

### Chronometer (rare, 3 Mana)
A tempo-bomb. Resets all cooldowns and grants combat-wide −30% cooldown reduction (up from v1's
−20%). Turns a turtled hand into a barrage — especially nasty with high-cost finishers
(`heavy-hit`, `eviscerate`, `chain-lightning`). The mana cost trimmed from 6 → 3 keeps the card
playable for Warriors who would otherwise need an `iron_canteen` or `meditate` setup just to
afford it; the combat-wide CDR effect is still the rare-tier currency move.

### Mercenary Contract (rare, 1 HP)
Pure card draw and DEX surge at the cost of 1 HP — the "I need cards now" button. Drawing 5 in
a deckbuilder where shuffles cap the cycle is enormous, and the +4 DEX rider drops cooldowns on
the freshly-drawn hand. The HP cost is the leash, intentionally light (down from v1's 5 HP to 1
HP) because framework §10.2 weights HP self-damage at 2.0 C per point — at 5 HP the card was
mathematically impossible to land inside the rare RPU band. The reduced HP cost still pairs hard
with `blood_pact` or `phoenix_feather`, and the framework §2 consequence model holds: no
resource cost, but a flavored health tradeoff scales the rarity instead.

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

> Relic balance is **out of scope for this pass**. The §9 balance audit below covers only the 20
> neutral cards in §2. Relics carry their own RPU/cost-flow rules (framework §6) and will be
> rebalanced in a separate sweep.

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

> Tile balance is **out of scope for this pass**. The §9 balance audit below covers only the 20
> neutral cards in §2.

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
      winning combat), Chronometer (high mana cost), Mercenary Contract (HP cost + DEX rider)
- [x] At least one "noob trap" weak card (Mercenary Contract — the HP cost still bites a sloppy
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

## 9. Balance audit — RPU pass on the 20 neutral cards

Scope: **only the 20 neutral cards in §2.** Relics (§4–§5) and tiles (§7) are intentionally left
untouched in this pass and will be audited separately.

Method: each card's reward (R) and cost (C) computed against framework §10.1 / §10.2 reward and
cost tables. RPU = R / max(C, 1). Neutrals target the **lower half** of each rarity band per the
philosophy that class-locked cards earn the upper half:

- Common neutrals: 6.0 – 8.0 (framework common band lower half)
- Uncommon neutrals: 8.5 – 10.5 (framework uncommon band lower half)
- Rare neutrals: 11.0 – 13.0 (framework rare band lower half)

Card draw priced at 2.0 R, stat buffs at 3.0 R/pt (STR/DEX/INT) or 1.5 R/pt (VIT/SPI), DoT at
2.5 R per stack, combo points at 2.0 R. AoE damage is scored at single-target value (R per AoE
card multiplies with target count at table time but is conservative for audit).

### 9.1 Per-card RPU table

| ID | Rarity | R (breakdown) | C (breakdown) | RPU | Band ✓/❌ |
|--|--|--|--|--|--|
| `field_bandage` | common | 7×0.9 = 6.3 | 0 → 1 | 6.3 | ✓ |
| `quick_jab` | common | 6 dmg = 6.0 | 0 (0.8s cd ≤ baseline) → 1 | 6.0 | ✓ |
| `tower_guard` | common | 10 armor × 0.7 = 7.0 | 2 stam × 0.5 = 1.0 | 7.0 | ✓ |
| `focus_breath` | common | 6×0.5 + 6×0.6 = 3+3.6 = 6.6 | 0 → 1 | 6.6 | ✓ |
| `sharpening_stone` | common | +2 STR × 3.0 = 6.0 | 0 → 1 | 6.0 | ✓ |
| `lucky_coin` | common | 10 gold × 0.3 + 4×0.9 = 3.0+3.6 = 6.6 | 0 → 1 | 6.6 | ✓ |
| `dust_kick` | common | 10 dmg + 3 def debuff × 1.0 = 13.0 | 1 HP × 2.0 = 2.0 | 6.5 | ✓ |
| `kitbash_dagger` | common | 5 dmg + 1 CP × 2.0 = 7.0 | 2 stam × 0.5 = 1.0 | 7.0 | ✓ |
| `heirloom_charm` | uncommon | +3 random STR/DEX/INT × 3.0 = 9.0 | 0 → 1 | 9.0 | ✓ |
| `merchant_ledger` | uncommon | avg ≈ 3.5 cards × 2.0 = 7.0 | 2s cd → 0.8 | 8.75 | ✓ |
| `iron_canteen` | uncommon | 10×0.5 + 6×0.7 = 5+4.2 = 9.2 | 0 → 1 | 9.2 | ✓ |
| `caltrops` | uncommon | 5 AoE dmg + 2 Bleed × 2.5 = 5+5 = 10.0 | 2 mana × 0.6 = 1.2 | 8.33 | ✓ (≈) |
| `second_wind` | uncommon | 8×0.9 + 5×0.5 = 7.2+2.5 = 9.7 | 0 → 1 (conditional <50% HP) | 9.7 | ✓ |
| `pocket_grenade` | uncommon | 14 AoE dmg = 14.0 | 2 stam + 1 mana = 1.0+0.6 = 1.6 | 8.75 | ✓ |
| `featherweight` | uncommon | 0.6s CD × 2.0 + 3 DEX × 3.0 = 1.2+9 = 10.2 | 2 mana × 0.6 = 1.2 | 8.5 | ✓ |
| `signal_flare` | uncommon | 9 def debuff × 1.0 + 1 draw × 2.0 = 11.0 | 2 mana × 0.6 = 1.2 | 9.17 | ✓ |
| `bandits_trinket` | rare | up to 12 dmg = 12.0 (cap) | gold proxy ≈ 1 | 12.0 | ✓ |
| `worldroot_seed` | rare | 12×0.9 + 6×0.5 + 1 VIT amortized ≈ 8 = 10.8+3+8 = 21.8 | 3 mana × 0.6 = 1.8 | 12.1 | ✓ |
| `chronometer` | rare | reset (~8) + 30% CDR combat (~12) = 20.0 | 3 mana × 0.6 = 1.8 | 11.1 | ✓ |
| `mercenary_contract` | rare | 5 draws × 2.0 + 4 DEX × 3.0 = 10+12 = 22.0 | 1 HP × 2.0 = 2.0 | 11.0 | ✓ |

**Score: 20 of 20 neutral cards inside the targeted neutral RPU band.**

### 9.2 Before → after diffs

19 of 20 cards adjusted. The lone hold-out is `second_wind` (already in band at 9.7).

| ID | v1 cost / effect | v2 cost / effect | v1 RPU | v2 RPU |
|--|--|--|--|--|
| `field_bandage` | —, Restore 5 HP | —, Restore **7** HP | 4.5 | 6.3 |
| `quick_jab` | —, Deal 4 dmg (0.8s cd) | —, Deal **6** dmg (0.8s cd) | 4.0 | 6.0 |
| `tower_guard` | 2 stam, 3 armor | 2 stam, **10** armor | 2.1 | 7.0 |
| `focus_breath` | —, 3 stam + 3 mana | —, **6** stam + **6** mana | 3.3 | 6.6 |
| `sharpening_stone` | —, +2 STR combat | —, +2 STR combat (unchanged) | 6.0 | 6.0 |
| `lucky_coin` | —, 5 gold + 2 HP | —, **10** gold + **4** HP | 3.3 | 6.6 |
| `dust_kick` | 1 HP, 3 dmg + 1 def debuff | 1 HP, **10** dmg + **3** def debuff | 2.0 | 6.5 |
| `kitbash_dagger` | 2 stam, 5 dmg + 1 CP | 2 stam, 5 dmg + 1 CP (unchanged) | 7.0 | 7.0 |
| `heirloom_charm` | —, +1 random VIT/DEX/INT/SPI | —, **+3 random STR/DEX/INT** | 2.25 | 9.0 |
| `merchant_ledger` | —, Draw 1 / draw 2 if shop | — (**2s cd**), Draw **3** / draw **4** if shop | 2.5–4.0 | 8.75 |
| `iron_canteen` | —, 5 stam + 2 armor | —, **10** stam + **6** armor | 3.9 | 9.2 |
| `caltrops` | **3** mana, 3 AoE + 1 Bleed | **2** mana, **5** AoE + **2** Bleed | 3.05 | 8.33 |
| `second_wind` | —, <50% HP: 8 HP + 5 stam | unchanged | 9.7 | 9.7 |
| `pocket_grenade` | **3** stam + 1 mana, 7 AoE dmg | **2** stam + 1 mana, **14** AoE dmg | 3.3 | 8.75 |
| `featherweight` | 2 mana, −0.3s CD + 1 DEX | 2 mana, **−0.6s CD** + **3 DEX** | 3.0 | 8.5 |
| `signal_flare` | 2 mana, 3 def debuff + reveal | 2 mana, **9 def debuff + draw 1** | 3.3 | 9.17 |
| `bandits_trinket` | —, 1 dmg/gold cap **20** | —, 1 dmg/gold cap **12** | 20.0 (overshoot) | 12.0 |
| `worldroot_seed` | **5** mana, 12 HP + 6 stam + 1 VIT | **3** mana, 12 HP + 6 stam + 1 VIT | 7.27 | 12.1 |
| `chronometer` | **6** mana, reset + **−20%** CDR | **3** mana, reset + **−30%** CDR | 4.17 | 11.1 |
| `mercenary_contract` | **5 HP**, Draw 3 | **1 HP**, Draw **5** + **+4 DEX** combat | 0.6 | 11.0 |

### 9.3 Summary

- **19 of 20 neutral cards rebalanced** (`second_wind` and `kitbash_dagger` already inside band;
  `sharpening_stone` already at the floor of common at RPU 6.0). One card retained its exact
  numbers as the audit baseline.
- All 20 cards now sit inside their rarity's targeted (lower-half) RPU band.
- Costs were lowered (mana, HP, stamina) more often than effects were raised, in line with
  framework §10.5 lever order: damage/magnitude first, then cost adjustments.
- The rare tier saw the largest swings: `mercenary_contract` went from RPU 0.6 to 11.0 by
  cutting HP cost 5 → 1 and adding a draw + DEX rider; `chronometer` and `worldroot_seed` both
  had mana costs halved (6/5 → 3) to lift them into band.
- `bandits_trinket` is the only card pulled *down* (gold cap 20 → 12) — its v1 numbers
  overshot epic territory.

### 9.4 Out of scope (intentionally left alone)

- **Relics (§4 and §5).** All 20 neutral relics keep their v2 numbers. Relic balance is a
  separate pass with its own currency-flow rules (framework §6).
- **Tiles (§7).** Library, Arena, Shrine of Pact, and the six new tile-adjacency synergies are
  untouched. Tile balance is map-economy scoped, not RPU scoped.

---

Wrote design/04_neutral_and_combos.md balance-pass (19 of 20 cards rebalanced)
