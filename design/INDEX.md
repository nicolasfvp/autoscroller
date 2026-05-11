# Design Package — Cards, Relics, Tiles, Status

Conceptual design only. No JSON, no engine wiring. Five documents in this folder spec the missing content the user asked for; this index ties them together and tracks totals/follow-ups.

---

## 1. Documents

| # | File | Owns |
|---|---|---|
| 00 | [`00_framework.md`](00_framework.md) | The contract — status system, mechanics charter per class, combo rules, rarity counts, validation checklist, schema additions |
| 01 | [`01_warrior.md`](01_warrior.md) | Warrior — 50 cards + 10 relics + within-class combos |
| 02 | [`02_mage.md`](02_mage.md) | Mage — 50 cards + 10 relics + within-class combos |
| 03 | [`03_shadowblade.md`](03_shadowblade.md) | **NEW CLASS** Shadowblade — 50 cards + 10 relics + class def + within-class combos |
| 04 | [`04_neutral_and_combos.md`](04_neutral_and_combos.md) | 30 neutral cards + 30 neutral relics + cross-class combos + 3 new tiles + 6 new tile adjacencies |

---

## 2. Totals (against the original ask)

| Bucket | Asked | Delivered | Source |
|---|---|---|---|
| Classes | +1 new | **+1 (Shadowblade)** | 03 §1, §3 |
| Cards per class | 50 each | 50 / 50 / 50 | 01, 02, 03 |
| Neutral cards | ~30 | **30** | 04 §2 |
| **Total cards** | — | **180** (was 30) | — |
| Relics, class-exclusive | 10 × 3 = 30 | 10 / 10 / 10 | 01, 02, 03 |
| Relics, neutral | rest of 60 | **30** | 04 §4 |
| **Total relics** | 60 | **60** (was 16) | — |
| Combos per card | 2–4 | enforced in all 5 docs' validation passes | 01 §8, 02 §9.4, 03 §9.2, 04 §7 |
| Core mechanics / class | ≥3 + micros | 3 + 1 micro for each | 00 §3 |
| Status system | STR + new dims | STR + VIT + DEX + INT + SPI | 00 §2 |
| Bonus: new tiles | not asked, included | **3** (Library / Arena / Shrine of Pact) + 6 adjacencies | 04 §6 |

Approximate combo row totals (each row = one entry in `synergies.json`):
- Warrior internal: **95**
- Mage internal: **~104** canonical (+ 15 design alternates held back)
- Shadowblade internal: **~70** canonical (100 drafted, curated down to honor the 2–4 cap)
- Cross-class via neutrals: **88**
- **Grand total: ~357 combo rows** (vs 14 today)

---

## 3. Class mechanic summary (one-screen reference)

| Class | Primary 1 | Primary 2 | Primary 3 | Micro |
|---|---|---|---|---|
| **Warrior** | Stamina cycle | Armor/Defense pivot (spent as cost) | Rage / Strength stacks | Bleed DoT |
| **Mage** | Mana cycle | Arcane Stacks (1–10, dumped by finishers) | Elemental statuses (Burn / Freeze / Shock) | Lifesteal / Heal |
| **Shadowblade** | Combo Points (0–5) | Poison stacks | Stealth / Evade window | Energy (cheap tempo) |

Each class doc verifies ≥6 cards touch each primary; most coverage runs well above that floor (Warrior Stamina 33 cards; Mage Mana 40; Shadowblade CP 22).

---

## 4. Status system (extension)

Existing: `strength`, `defenseMultiplier`, `moveSpeed`, max HP/Stam/Mana.

New stat dimensions (defined in `00_framework.md` §2):

| Stat | Effect |
|---|---|
| **VIT** | +5 max HP / pt, +5% out-of-combat HP regen / pt |
| **DEX** | −2% card cooldown / pt (cap −60%), +1% dodge / pt (cap 40%) |
| **INT** | +1 flat damage on `magic` effects / pt, +mana regen on shuffle |
| **SPI** | +10% healing received / pt, +stam regen on shuffle |

Used by cards in three ways: scale damage (`scale: { stat, per, value }`), temporary buff/drain ("+2 DEX this combat"), and one-time permanent shifts (event rewards, relic pacts).

---

## 5. Schema additions needed (for the engine phase)

The framework and class docs assume these JSON-schema extensions. None are wired today — flagged here so a future engineering phase has the full list:

1. `CardEffect.type` adds: `'buff' | 'debuff_stat' | 'dot' | 'stack' | 'consume_combo' | 'gain_combo' | 'stealth' | 'taunt'`
2. `CardEffect.scale?: { stat: 'str'|'vit'|'dex'|'int'|'spi'; per: number; value: number }`
3. `HeroStats` gains `vitality`, `dexterity`, `intellect`, `spirit` (numbers, default 0)
4. `CombatState` gains `comboPoints`, `poisonStacks`, `arcaneStacks`, `rageStacks`, `bleedStacks`, `burnStacks`, `freezeStacks`, `shockStacks`, `stealthCharges`, `evadeNextHit` (transient, reset on combat end)
5. `SynergyDefinition.bonus.type` adds: `'dot' | 'combo_point' | 'stealth' | 'stat_buff' | 'cooldown_reduction'`
6. `RelicDefinition.trigger` adds: `'enemy_killed' | 'card_drawn' | 'rest_used' | 'shop_visited' | 'stat_changed' | 'combo_played' | 'dot_tick'`
7. `RunState.hero.statDeltas?` — per-run additive stat layer, separate from per-combat buffs (needed for cards like Worldbreaker that grant +2 STR permanently for the rest of the run)
8. Tile registry gains `library`, `arena`, `shrine_of_pact` tile types + 6 adjacency rules
9. Tile adjacency buff type `cardUpgradeDiscount` (used by Library+Shop)

---

## 6. Power-band intent (so balance passes have a north star)

| Rarity | Per-class count | Damage band (vs Strike=7) | Cost expectation |
|---|---|---|---|
| Common | 16 | 0.9 – 1.1× | Free or 1–3 resource |
| Uncommon | 18 | 1.1 – 1.3× | 3–6 resource |
| Rare | 12 | 1.3 – 1.6× | 5–10 resource, often dual-cost |
| Epic | 4 | 1.6 – 2.0× | Dual-cost AND HP-cost / stat-drain / once-per-combat |

Neutrals lean lower (0.85–1.0×): they earn their slot via combo coverage, not raw stats.

Each class doc ships **1–2 deliberately weak cards** (noob traps) and **1–2 deliberately overpowered build-definers** with severe tradeoffs:

- Warrior: weak — Wild Swing, Catch Breath. OP — Worldbreaker (20/20/-5 HP for a 60-damage hit + permanent +2 STR on kill).
- Mage: weak — Dim Mind, Inner Focus. OP — Eternal Flame (−1 maxHP forever), Sacrifice, Aether Well alt.
- Shadowblade: weak — Mugger's Grin. OP — Crimson Recital (−5 HP / cast), Serpent Empress, Eternal Veil.
- Neutral: weak — Oathbreaker Blade (random stat drain). OP — Chronometer (full cooldown reset for the combat).

---

## 7. Open follow-ups (not blocking — for the implementation phase)

These came out of each doc's validation pass. None block the design being "done"; all are engineering decisions for the next phase.

1. **Per-combat vs per-run stat layers** — temp buffs ("+1 STR this combat") need a separate layer from permanent shifts (Worldbreaker, Shrine of Pact, event rewards). `RunState.hero.statDeltas` is the proposed home.
2. **Stack tick cadence** — DoTs (Bleed, Poison, Burn) tick every card play vs every second vs end-of-tile-step. Recommend: **every card play** (already engine-friendly).
3. **Combo Point persistence** — Shadowblade CP resets on combat end. Confirmed by class charter.
4. **Mage stack cap** — Arcane Stacks cap at 10. Overflow rules: discard? convert to free damage? — design decision deferred.
5. **Mage card overflow** — 4 cards (spell-weave, arcane-cascade, pact-of-flame, aether-well) are documented as "design alternates" held off the canonical 50 so the rarity split stays exactly 16/18/12/4. Swap-in instructions in 02 §9.1.
6. **Cross-class combo IDs** — verified: 04's references to Shadowblade IDs (`backstab`, `eviscerate`, `shadowstep`, `toxic-coat`) match 03's definitions. No rename needed.
7. **Stealth + AoE interaction** — does stealth-empowered next-attack damage apply once or to every target of an AoE finisher? Design decision: **once, to the primary target**, to keep stealth a single-target tool.
8. **Iron Skin classification** — currently lives in the magic category but is paid in mana; counted in both Warrior (via `iron-skin` reuse in 01) and Mage docs. Recommend keeping as Mage card and removing from Warrior set OR letting both classes draw it from the Forge.

---

## 8. What's *not* in this package (intentional)

- **JSON output** — explicitly conceptual per the user's ask. JSON authoring is a follow-up phase using these docs as input.
- **Card art / audio direction** — out of scope.
- **Event content** — only tiles/cards/relics were scoped.
- **Boss design** — covered today by `EnemyDefinitions` + `BossSystem`; the new relics and statuses (DoTs, freeze) imply future boss behaviors but the boss roster isn't expanded here.
- **Class-3 sprite assets** — Shadowblade has a class def block in 03 §3 but the asset folder + sprite-prefix entry in `CLASS_SPRITE_PREFIX` is left to engineering.
- **Final balance numbers** — every number is a starting point chosen against the existing power band (Strike=7, Heavy Hit=13, Fury=20). Real balance comes from playtesting.

---

*This package answers the brief: 60 relics, 1 new class, 150 class cards (50 each), 30 neutrals, 2–4 combos per card, ≥3 core mechanics per class, status-system integration, creativity over rigor. All five docs validate themselves against the framework's checklist.*
