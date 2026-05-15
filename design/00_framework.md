# Design Framework — Cards, Relics, Status, Combos (v2)

> Conceptual spec only. Numbers are tuning starting points, not final balance.
> All content must be expressible in the existing JSON schema (see `src/data/types.ts`)
> or with the few additions called out below.

> **v2 changes** from v1: card counts trimmed; rarity philosophy rewritten (rarity ≠ cost
> complexity); combos tightened to exactly 2 per card; neutral relics trimmed.

---

## 1. Scope summary

| Bucket | Target | Notes |
|---|---|---|
| Cards / class | **35** | Warrior + Mage |
| Neutral cards | **20** | Playable by any class |
| Total cards | **125** | from current 30 |
| Relics / class | **10** exclusive | Synergize with that class's core mechanics |
| Neutral relics | **20** | Universal effects |
| Total relics | **50** | from current 16 |
| Combos / card | **exactly 2** | "Combo" = a synergy pair (cardA, cardB) in `synergies.json` |

A card with 2 combos appears in 2 rows of the synergy table (as `cardA` or `cardB`). No card appears 0, 1, 3, or 4 times. Synergy budget is exact: **(125 cards × 2) / 2 = 125 synergy rows**.

---

## 2. Rarity philosophy

> **Rarity = overall power, not cost complexity.**

The v1 doc tied rarity to cost shape (commons free, uncommons single-cost, rares/epics dual cost). That was wrong. v2 rule:

- **Cost shape is independent of rarity.** A common card may be free, single-cost, dual-cost, or HP-cost. An epic may cost nothing or cost everything.
- **Rarity means the magnitude of the currency flow** the card creates or consumes. A common moves a little currency (small damage, small armor, small stack); an epic moves a lot (big damage, large stack dump, build-defining swing).
- **Tradeoffs scale with rarity** but not via cost slots — via *consequences*: permanent stat loss, single-use-per-combat, run-scoped drawbacks, conditional payoff.

### 2.1 Rarity power band (relative to Strike = 7 damage)

| Rarity | Magnitude band | What "magnitude" means | Cost shape examples |
|---|---|---|---|
| **Common** | 0.7 – 1.1× | Small flat numbers; one effect; predictable | free, 1–2 stam, 1 mana, 1 def, occasional dual |
| **Uncommon** | 1.0 – 1.3× | Mid numbers; sometimes two effects; mild riders | free, single-cost, occasional dual, occasional HP |
| **Rare** | 1.3 – 1.7× | Large numbers OR strong rider; build-shaper | any cost shape |
| **Epic** | 1.6 – 2.2× | Run-defining; usually conditional or carries a consequence | any; epics often have no resource cost but a hard tradeoff (lose maxHP, drain a stat, once-per-combat) |

A free **common** that draws a card is still common (moves a tiny amount of currency). A free **epic** that resets all cooldowns is still epic (moves a huge amount).

### 2.2 Class set rarity counts (35 cards)

| Rarity | Count |
|---|---|
| Common | **12** |
| Uncommon | **12** |
| Rare | **8** |
| Epic | **3** |
| **Total** | **35** |

### 2.3 Neutral set rarity counts (20 cards)

| Rarity | Count |
|---|---|
| Common | **8** |
| Uncommon | **8** |
| Rare | **4** |
| **Total** | **20** |

No epics in neutral. Epics live in class identity.

---

## 3. Status system

Today the hero has: `maxHP`, `maxStamina`, `maxMana`, `strength`, `defenseMultiplier`, `moveSpeed`.

We extend with four secondary stats:

| Stat | Symbol | Effect | Default | Notes |
|---|---|---|---|---|
| Strength | STR | +1 flat damage per point on physical effects (already wired) | 1 | Existing |
| Vitality | VIT | +5 max HP per point; +5% out-of-combat HP regen per point | 0 | New |
| Dexterity | DEX | −2% card cooldown per point (cap −60%); +1% dodge chance per point (cap 40%) | 0 | New |
| Intellect | INT | +1 flat damage per point on `magic` effects; +1 mana regen per shuffle per 2 INT | 0 | New |
| Spirit | SPI | +10% healing received; +1 stamina regen per shuffle per 2 SPI | 0 | New |

Each stat can be **buffed** (cards / relics / events) or **drained** (curses, relic tradeoffs, debuff enemies).
Cards may scale off a stat (`scale: { stat: "dex", per: 1, value: 2 }`) or pay a stat as **temporary cost**.

JSON additions required:
- `CardEffect.type` gains `'buff' | 'debuff_stat' | 'dot' | 'stack' | 'consume_combo' | 'gain_combo' | 'stealth' | 'taunt'`
- `CardEffect.scale?: { stat: 'str'|'vit'|'dex'|'int'|'spi'; per: number; value: number }`
- `HeroStats` gains `vitality`, `dexterity`, `intellect`, `spirit`

---

## 4. Class mechanic charters

Every class must have **≥3 primary mechanics** plus optional micros. A primary mechanic is a resource/stack the class generates AND spends; **≥5 cards must touch it** (lowered from 6 because the set is now 35).

### 4.1 Warrior — "Iron Tide"
1. **Stamina cycle** — light attacks restore, heavy hits cost.
2. **Armor / Defense pivot** — armor is mitigation AND a resource consumed by finishers.
3. **Strength stacking** — Rage stacks (temp STR) on kills, on consecutive attacks, on missing HP.
4. *(micro)* **Bleed** — minor DoT applied by some cards.

### 4.2 Mage — "Arcane Loop"
1. **Mana cycle** — drain/burn/refund.
2. **Arcane Stacks** — each magic card builds a counter (1–10), consumed by finishers.
3. **Elemental statuses** — Burn (DoT), Freeze (cooldown↑ on enemy), Shock (cost-bender).
4. *(micro)* **Heal/Lifesteal** — INT-scaling, niche.

---

## 5. Combo (synergy pair) system

A *combo* is a row in `synergies.json` of shape:

```
{ cardA, cardB, bonus: { type, value, target }, classRestriction?, displayName }
```

It triggers when **B is played within ~1 card after A**.

### 5.1 Rules
- **Coverage rule**: every card appears in **exactly 2** combo rows. No more, no less.
- **Class-locked combos** mostly stay within the class set; cross-class combos use neutral cards as a bridge.
- **Bonus types**: existing `damage | armor | heal | stamina | mana | cost_waive` plus new `dot | stat_buff | cooldown_reduction`.
- **Display names** read like move-list calls: "Crimson Edge!", "Stormcradle!".
- **Cross-class neutrals**: each neutral's 2 combos pair it with class cards (typically one neutral combos with a class card, the other neutral combos either with another class card or a neutral).

### 5.2 Combo budget per set
Each card → 2 appearances. Each row contributes 2 appearances. So:
- **Total synergy rows across the game: 125** (= 125 cards × 2 / 2).

Recommended distribution: each class produces ~30–35 internal rows (35 cards × 2 ÷ 2 minus cross-class ties); the remaining rows are cross-class via neutrals.

---

## 6. Relic charter

50 relics total:
- **30 exclusive** (10 per class). Each must reference the class's *primary mechanic* set — at least one relic per primary mechanic.
- **20 neutral**. Rough split: 6 stat/economy commons, 9 conditional rares, 5 build-defining (epic/legendary).

### 6.1 Triggers (extend existing list)
Existing: `combat_start`, `turn_start`, `card_played`, `damage_taken`, `heal`, `passive`.
Add: `enemy_killed`, `card_drawn`, `rest_used`, `shop_visited`, `stat_changed`, `combo_played`, `dot_tick`.

### 6.2 Neutral rarity guideline
| Rarity | Count | Effect size | Example |
|---|---|---|---|
| Common | 6 | +Y stat / small bonus | "+10 Max HP" |
| Rare | 9 | conditional payoff | "First card each combat: x2" |
| Epic/Legendary | 5 | build pivot with downside | "Spells free, −20% spell dmg" |

---

## 7. Tile design (lighter touch — game has tiles already)

Add **3 new optional tiles**:

| Tile | Cost | Effect | Adjacency synergies |
|---|---|---|---|
| **Library** | 4 | +1 card draw on shuffle; +XP from kills nearby | Library+Shop (cheap upgrade), Library+Graveyard (cursed knowledge) |
| **Arena** | 5 | Forced elite, +50% loot | Arena+Rest (medic recovery), Arena+Forest (ambush) |
| **Shrine of Pact** | 4 | Lose 5% maxHP permanently, gain a free relic | Shrine+Treasure (richer pact), Shrine+Graveyard (necropact) |

Three new adjacency rules: see `04_neutral_and_combos.md`.

---

## 8. Validation checklist (each class doc must pass)

- [ ] **35 cards total** (12 / 12 / 8 / 3 by rarity)
- [ ] **≥5 cards touching each primary mechanic**
- [ ] **Every card appears in exactly 2 combo rows** — no exceptions
- [ ] **At least one card scales off each of the class's primary stats**
- [ ] **10 relics**, ≥1 covering each primary mechanic
- [ ] **No two cards in the same set are "near-duplicates"** — i.e. same category + similar cost + similar effect + similar damage band. Where v1 had pairs (Jab + Pommel Strike + Skull Cracker as nearly identical 1-stam strikes), keep one and cut the rest.
- [ ] **Starter deck (8–10 cards) is playable without any other card**
- [ ] **At least one "noob trap" weak card and one "build-defining" overpowered card** (tradeoff via consequence, not necessarily resource cost)
- [ ] **Cost shape is varied within every rarity tier** — each rarity has at least one free card, one single-cost card, and one dual/HP/stat-drain card. Rarity does NOT predict cost shape.

---

## 9. v2 trim heuristic — what to cut

When trimming v1 → v2, cards matching any of these get cut first:
1. **Numeric clones** — same effect type, same cost, same target, only different damage value within the same rarity (e.g. two single-stam 1-cost strikes both dealing 5–6 dmg).
2. **Filler utility** — pure cantrips with no synergy hook (the "Inner Focus / Catch Breath" tier).
3. **Cards whose only role was bloating mechanic coverage** — if a primary mechanic has 12+ cards, the weakest 3 get cut.
4. **Design alternates** held back in v1 — cut entirely instead of swapping in.
5. **Combo orphans** — if a card's only combos were with cut cards, cut it too.

Keep:
1. The class's **rarest, most-iconic cards** (Worldbreaker, Eternal Flame, Crimson Recital).
2. The **starter deck** (4 Strike / 3 Defend equivalents) — defines identity.
3. **Build-anchors** referenced by multiple relics.

---

## 10. Balance principle — reward per usage

> **A rarer card should pay you more, per time you play it, than a less-rare card.**

The v2 rarity philosophy says "rarity = magnitude of currency flow". This section makes that operational by defining a single metric the designer can check per card.

### 10.1 Effect → reward units (R)

All effects normalize into one currency so cards with mixed effects can be compared:

| Effect | Reward per point |
|---|---|
| Damage to enemy | **1.0** R |
| Armor gained | **0.7** R (can be wasted if not hit) |
| HP healed | **0.9** R |
| Stamina restored | **0.5** R |
| Mana restored | **0.6** R |
| Stack applied (DoT — Bleed/Poison/Burn) | **2.5** R per stack (ticks ~3 times average) |
| Arcane Stack built | **1.2** R (enables finisher) |
| Combo Point gained | **2.0** R (enables finisher) |
| Enemy Defense debuff | **1.0** R per point |
| Stat buff (temp, 1 combat) | **3.0** R per point (STR / DEX / INT) — **1.5** R for VIT / SPI |
| Card draw | **2.0** R per card |
| Stealth charge | **3.0** R per charge |
| Dodge guarantee | **2.5** R |

### 10.2 Cost → cost units (C)

| Cost | Cost per point |
|---|---|
| Stamina | **0.5** C |
| Mana | **0.6** C |
| Defense paid | **0.7** C |
| HP self-damage | **2.0** C (limited resource) |
| Combo Point spent | **1.5** C (built over multiple cards) |
| Stat drain (temp, 1 combat) | **3.0** C per point (STR / DEX / INT) — **1.5** C for VIT / SPI |
| Permanent maxHP loss | **8.0** C per point (run-scoped) |
| Cooldown over 1.0s baseline | **0.4** C per +0.5s |
| Once-per-combat lock | **3.0** C flat |

A free, instant-cooldown card has C = 0. A 1.0s-cooldown card has C = 0 (baseline). A 2.0s-cooldown card has C = 0.8.

### 10.3 Reward-per-Usage (RPU)

`RPU = (total R from all effects, including riders and synergy-independent bonuses) / max(C, 1)`

For free cards (C = 0), use `C = 1` as the divisor — a free card with R = 7 has RPU = 7.

### 10.4 Target RPU bands by rarity

| Rarity | RPU band | Strike (7 dmg, 0 cost, 1s cd) = 7.0 reference |
|---|---|---|
| **Common** | 6.0 – 9.0 | Strike sits here at 7.0 |
| **Uncommon** | 8.5 – 11.5 | ~+25% over common ceiling |
| **Rare** | 11.0 – 14.5 | ~+30% over uncommon |
| **Epic** | 13.5 – 19.0 | ~+30% over rare; consequence costs (permanent maxHP loss, stat drain) keep this honest |

**Bands overlap** intentionally at the edges: a high-end common can RPU at 9.0, the same value an entry-level uncommon hits at 8.5 — that's fine. What's NOT fine: a common at RPU 11 (rare's territory) or a rare at RPU 7 (common's territory).

### 10.5 Adjustment levers

When a card's RPU is outside its band, adjust in this order of preference:

1. **Damage / magnitude** — easiest knob, least design impact.
2. **Cost down or up** — preserves the card's "feel" but shifts who can play it.
3. **Cooldown** — affects pacing; useful for nudging RPU by ~0.5–1.0.
4. **Add or remove a rider** — last resort; changes the card's identity.

Never adjust by changing rarity (that's a re-design, not a balance pass).

### 10.6 Practical examples

- **Strike (common)**: 7 dmg, 0 cost, 1.0s cd → R = 7, C = 0 → **RPU = 7.0** ✓ (centre of common band)
- **Heavy Hit (common in v2 reclass)**: 13 dmg, 5 stam, 1.5s cd → R = 13, C = 2.5 + 0.4 = 2.9 → **RPU = 4.5** ❌ (too low for any tier — bump damage to ~17 or drop cost to 3 stam)
- **Fireball (common, magic)**: 10 dmg, 5 mana, 1.5s cd → R = 10, C = 3.0 + 0.4 = 3.4 → **RPU = 2.9** ❌ (way too low — bump damage to 12 *and* drop cooldown to 1.2s for RPU ≈ 3.9, still low; consider promoting to uncommon or letting INT scaling push it up)
- **Worldbreaker (epic)**: 60 dmg, 20 stam + 20 def + 5 HP self → R = 60, C = 10 + 14 + 10 = 34 → **RPU = 1.8** ❌ (the +2 STR-on-kill permanent rider is what makes this an epic — that rider is worth ~10 R amortized, so adjusted R ≈ 70, RPU ≈ 2.1 — STILL too low. Either trim costs (drop to 15/15/3 HP) or boost the damage to 90)

These three sample audits show the v2 numbers were authored more by "feel" than by RPU. The balance pass tightens them.

### 10.7 Stat scaling

Cards that scale off a stat (e.g. `+2 dmg per DEX`) compute RPU at **the class's baseline stat value** for that stat. Late-game stacking lets it overperform — that's intentional and is the *reward for investing in the build*.

---

## 11. Process

The detailed cards/relics live in:
- `01_warrior.md` — 35 cards + 10 relics
- `02_mage.md` — 35 cards + 10 relics
- `04_neutral_and_combos.md` — 20 cards + 20 relics + new tiles
