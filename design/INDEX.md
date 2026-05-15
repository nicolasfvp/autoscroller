# Design Package — Cards, Relics, Tiles, Status (v2)

Conceptual design only. No JSON, no engine wiring. Five documents in this folder spec the missing content the user asked for; this index ties them together and tracks totals/follow-ups.

> **v2 revision** trimmed the package: counts down, rarity philosophy rewritten (rarity ≠ cost shape), combos tightened to exactly 2 per card. See `00_framework.md` for the binding rules.

---

## 1. Documents

| # | File | Owns |
|---|---|---|
| 00 | [`00_framework.md`](00_framework.md) | The contract — status system, mechanics charter, **rarity philosophy (v2)**, combo rules, schema additions |
| 01 | [`01_warrior.md`](01_warrior.md) | Warrior — 35 cards + 10 relics + 35 combos |
| 02 | [`02_mage.md`](02_mage.md) | Mage — 35 cards + 10 relics + 35 combos |
| 04 | [`04_neutral_and_combos.md`](04_neutral_and_combos.md) | 20 neutral cards + 20 neutral relics + 20 combos + 3 new tiles + 6 adjacencies |

---

## 2. Totals

| Bucket | v1 | **v2** | Source |
|---|---|---|---|
| Classes | 2 (Warrior, Mage) | 2 | — |
| Cards per class | 50 | **35** | 01, 02 |
| Neutral cards | 30 | **20** | 04 |
| **Total cards** | 180 | **125** (was 30) | — |
| Class-exclusive relics | 30 | **30** (10 × 3) | 01, 02, 03 |
| Neutral relics | 30 | **20** | 04 |
| **Total relics** | 60 | **50** (was 16) | — |
| Combos per card | 2–4 | **exactly 2** | every doc §validation |
| Total synergy rows | ~357 | **125** (= 125 × 2 / 2) | — |
| Core mechanics / class | 3 + 1 micro | unchanged | 00 §4 |
| Status system dimensions | STR/VIT/DEX/INT/SPI | unchanged | 00 §3 |
| New tiles | 3 | 3 (Library / Arena / Shrine of Pact) | 04 |
| Tile adjacency synergies | +6 | +6 | 04 |

Per-doc combo row totals (each row = one entry in `synergies.json`):
- Warrior internal: **35**
- Mage internal: **35**
- Neutral internal: **20**
- **Grand total: 90 synergy rows**

---

## 3. Class mechanic summary

| Class | Primary 1 | Primary 2 | Primary 3 | Micro |
|---|---|---|---|---|
| **Warrior** | Stamina cycle | Armor / Defense pivot | Rage / Strength stacks | Bleed DoT |
| **Mage** | Mana cycle | Arcane Stacks (1–10) | Elemental statuses (Burn / Freeze / Shock) | Lifesteal / Heal |

Each class doc verifies ≥5 cards touch each primary (lowered floor from v1's 6, since set is now 35).

---

## 4. Rarity philosophy (v2 change)

> **Rarity = overall power, not cost complexity.**

v1 conflated rarity with cost shape (commons free, rares dual-cost). v2 decouples them:

- Cost shape (free / single / dual / HP / stat-drain) is independent of rarity.
- Every rarity tier ships at least one free card, one single-cost card, and one dual/HP/stat-drain card.
- Rarity describes the *magnitude of the currency flow* a card creates or consumes.
- Epics frequently have **no resource cost** but a hard consequence: permanent stat loss, single-use-per-combat, run-scoped drawback.

Examples shipped:
- Mage common with HP cost: `candleflame`
- Mage uncommon free: `spell-thrift`
- Mage rare free with SPI drain: `mana-drain`
- Mage epic with permanent maxHP loss, no resource cost: `eternal-flame`

See `00_framework.md` §2 for the full table; each detail doc proves this with a "cost shape varied per rarity tier" check in its validation pass.

---

## 5. Status system

Existing: `strength`, `defenseMultiplier`, `moveSpeed`, max HP/Stam/Mana.

New stat dimensions:

| Stat | Effect |
|---|---|
| **VIT** | +5 max HP / pt, +5% out-of-combat HP regen / pt |
| **DEX** | −2% card cooldown / pt (cap −60%), +1% dodge / pt (cap 40%) |
| **INT** | +1 flat damage on `magic` effects / pt, +mana regen on shuffle |
| **SPI** | +10% healing received / pt, +stam regen on shuffle |

Used by cards in three ways: scale damage, temporary buff/drain ("+2 DEX this combat"), and one-time permanent shifts.

---

## 6. Schema additions needed (for the engine phase)

The framework and class docs assume these JSON-schema extensions. None are wired today:

1. `CardEffect.type` adds: `'buff' | 'debuff_stat' | 'dot' | 'stack' | 'taunt'`
2. `CardEffect.scale?: { stat: 'str'|'vit'|'dex'|'int'|'spi'; per: number; value: number }`
3. `HeroStats` gains `vitality`, `dexterity`, `intellect`, `spirit` (numbers, default 0)
4. `CombatState` gains `poisonStacks`, `arcaneStacks`, `rageStacks`, `bleedStacks`, `burnStacks`, `freezeStacks`, `shockStacks` (transient, reset on combat end)
5. `SynergyDefinition.bonus.type` adds: `'dot' | 'stat_buff' | 'cooldown_reduction'`
6. `RelicDefinition.trigger` adds: `'enemy_killed' | 'card_drawn' | 'rest_used' | 'shop_visited' | 'stat_changed' | 'dot_tick'`
7. `RunState.hero.statDeltas?` — per-run additive stat layer separate from per-combat buffs (needed by cards that grant permanent in-run stat shifts)
8. Tile registry gains `library`, `arena`, `shrine_of_pact` tile types + 6 adjacency rules
9. Tile adjacency buff type `cardUpgradeDiscount` (used by Library+Shop)

---

## 7. Open follow-ups (not blocking)

1. **Per-combat vs per-run stat layers** — temp buffs need a separate layer from permanent shifts. `RunState.hero.statDeltas` is the proposed home.
2. **Stack tick cadence** — DoTs (Bleed, Poison, Burn) tick every card play (recommend).
3. **Mage stack cap** — Arcane Stacks cap at 10; overflow rules deferred.
4. **Cross-class combo flatness (v2 emergent)** — Each class's 35 combo rows are entirely internal to that class, and the 20 neutral combo rows are neutral-to-neutral. Per framework §5.1's spirit, neutrals were supposed to act as cross-class bridges. To restore that, the engine implementation should *occasionally* substitute a class-locked combo row with a neutral-bridge row (e.g. swap a warrior-warrior combo for a warrior-neutral combo, keeping each card's "exactly 2 appearances" invariant). Flagged for a balance pass.
5. **Iron Skin classification** — still lives in the magic category but is paid in mana; appears in both Warrior and Mage v2 sets. Recommend: keep as Mage card; if Warrior wants it, let the Forge offer it cross-class.

---

## 8. What's *not* in this package (intentional)

- **JSON output** — explicitly conceptual. JSON authoring is a follow-up phase.
- **Card art / audio direction** — out of scope.
- **Event content** — only tiles/cards/relics were scoped.
- **Boss design** — covered today by `EnemyDefinitions` + `BossSystem`.
- **Final balance numbers** — every number is a starting point against the existing power band. Real balance comes from playtesting.

---

*v2 answers the revised brief: 40 relics, 2 classes, 70 class cards (35 each), 20 neutrals, exactly 2 combos per card, ≥3 core mechanics per class, rarity decoupled from cost shape, status-system integration. All three detail docs validate themselves against the framework's v2 checklist.*
