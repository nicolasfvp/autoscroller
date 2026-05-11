# Design Framework — Cards, Relics, Status, Combos

> Conceptual spec only. Numbers are tuning starting points, not final balance.
> All content must be expressible in the existing JSON schema (see `src/data/types.ts`)
> or with the few additions called out below.

---

## 1. Scope summary

| Bucket | Target | Notes |
|---|---|---|
| Cards / class | 50 | Warrior + Mage + **Shadowblade** (new) |
| Neutral cards | 30 | Playable by any class |
| Total cards | **180** | from current 30 |
| Relics / class | 10 exclusive | Synergize with that class's core mechanics |
| Neutral relics | 30 | Universal effects |
| Total relics | **60** | from current 16 |
| Combos / card | 2 – 4 | "Combo" = a synergy pair (cardA, cardB) in `synergies.json` |

A card with N combos appears in N rows of the synergy table (either as `cardA` or `cardB`). Most cards land at 2; star cards land at 4.

---

## 2. Status system

Today the hero has: `maxHP`, `maxStamina`, `maxMana`, `strength`, `defenseMultiplier`, `moveSpeed`.

We extend with four secondary stats, each cheap to compute and reused by cards/relics:

| Stat | Symbol | Effect | Default | Notes |
|---|---|---|---|---|
| Strength | STR | +1 flat damage per point on physical effects (already wired) | 1 | Existing |
| Vitality | VIT | +5 max HP per point; +5% out-of-combat HP regen per point | 0 | New |
| Dexterity | DEX | −2% card cooldown per point (cap −60%); +1% dodge chance per point (cap 40%) | 0 | New |
| Intellect | INT | +1 flat damage per point on `magic` effects; +1 mana regen per shuffle per 2 INT | 0 | New |
| Spirit | SPI | +10% healing received; +1 stamina regen per shuffle per 2 SPI | 0 | New |

Each stat can be **buffed** (cards / relics / events) or **drained** (curse cards, hard relic tradeoffs, debuff enemies).
Cards may scale off a stat (`scale: { stat: "dex", per: 1, value: 2 }` — "+2 damage per DEX") or pay a stat as **temporary cost** (drain 1 STR for the combat for a finisher).

JSON additions required:
- `CardEffect.type` gains `'buff' | 'debuff_stat' | 'dot' | 'stack' | 'consume_combo' | 'gain_combo' | 'stealth' | 'taunt'`
- `CardEffect.scale?: { stat: 'str'|'vit'|'dex'|'int'|'spi'; per: number; value: number }`
- `HeroStats` gains `vitality`, `dexterity`, `intellect`, `spirit` (numbers, default 0)

These are conceptual hooks; engine wiring is a later phase.

---

## 3. Class mechanic charters

Every class must have **≥3 primary mechanics** plus optional micros. A primary mechanic is a resource or stack the class generates AND spends across its own card set (at least 6 cards must touch it).

### 3.1 Warrior — "Iron Tide"
Heavy, deliberate, defense-pivot. Trades stamina for guaranteed payoff; spends armor for explosive finishers.
1. **Stamina cycle** — light attacks restore stamina (+1/+2), heavy hits cost it. ~14 cards touch it.
2. **Armor / Defense pivot** — armor isn't only mitigation; it's a resource. Cards like Fury & Doom Blade consume it; relics convert it to damage.
3. **Strength stacking** — Rage stacks (temp STR) on kills, on consecutive attacks, on missing HP. Rewards staying in the fight.
4. *(micro)* **Bleed** — minor DoT applied by 2H weapons; secondary, not pivotal.

### 3.2 Mage — "Arcane Loop"
Fragile, high ceiling, resource alchemy. Burns mana fast; recovers it through cycles and rituals.
1. **Mana cycle** — drain/burn/refund. ~14 cards touch it.
2. **Spell chains / Echo** — Each magic card played increases an `arcaneStacks` counter (1–10) consumed by finishers (e.g. "Deal damage equal to 3× stacks").
3. **Elemental statuses** — Burn (DoT), Freeze (cooldown↑ on enemy), Shock (next card cost +0 or doubled effect). Mostly DoT/CC for soft control.
4. *(micro)* **Heal/Lifesteal** — INT-scaling healing, niche.

### 3.3 Shadowblade — "Veil & Edge" *(NEW)*
Fast, fragile, snowball. Builds tempo through combo points then dumps them in a finisher.
1. **Combo Points (0–5)** — built by *Strike-tier* cards (gain_combo), spent by *Finishers* (consume_combo). Caps at 5. Reset on combat end.
2. **Poison stacks** — DoT applied via cards/relics. Stacks tick at end of every card play; scales with DEX.
3. **Stealth / Evade window** — short window (next 1–2 cards) where: hero auto-dodges 1 enemy hit, **and** the next attack card deals +X damage from stealth.
4. *(micro)* **Energy** — uses the existing **Stamina** field but renamed in flavor; cheap costs (1–3) keep card play fluid.

This class has lower max HP (60), higher base DEX (8), low STR (1), modest INT (1). Its starter deck includes 2 "Eviscerate" finishers, 4 "Backstab" strikes, 2 "Shadowstep" evades, 1 "Toxic Coat" poison applier, 1 "Defend".

---

## 4. Card economy & rarity

Each class set of 50:

| Rarity | Count | Power band (relative to today) | Source |
|---|---|---|---|
| Common | 16 | 0.9 – 1.1× | starter / drop / forge tier 1 |
| Uncommon | 18 | 1.1 – 1.3× | drop / forge tier 1–3 |
| Rare | 12 | 1.3 – 1.6× | drop / forge tier 3–5 |
| Epic | 4 | 1.6 – 2.0× (with downside) | forge tier 5–6 / boss reward |

Neutral set of 30: 12 common, 12 uncommon, 6 rare. No epics in neutral (epics live in class identity).

We allow **deliberately overpowered** cards (legendary tradeoffs: huge HP cost, drain stats permanently, single-use) and **deliberately weak** cards (cheap utility, ramp tools). The variance is the design — players curate via shop removal.

### 4.1 Power knobs (so designers don't sprawl)
- **Cost types**: Stamina, Mana, Defense, HP (existing pattern via self-damage effect), Combo Points (new), Stat drain (e.g. −1 STR for the combat).
- **Damage shapes**: flat, scaled by stat, scaled by missing/current HP, scaled by stack count, scaled by deck size.
- **Targeting**: single, aoe, lowest-hp, random, self — already supported.
- **Cooldowns**: 0.8s (light) → 3s (epics). DEX scales these down.

---

## 5. Combo (synergy pair) system

A *combo* is a row in `synergies.json` of shape:

```
{ cardA, cardB, bonus: { type, value, target }, classRestriction?, displayName }
```

It triggers when **B is played within ~1 card after A** (or both played in same loop pass — engine detail).

### 5.1 Rules
- **Coverage rule**: every card in the game appears in **2–4** combo rows. We enforce this by ID inventory pass at the end of each class doc.
- **Class-locked combos** mostly stay within the class set; cross-class combos use neutral cards as a bridge.
- **Bonus types** can be: `damage`, `armor`, `heal`, `stamina`, `mana`, `cost_waive` (existing) plus new: `dot`, `combo_point`, `stealth`, `stat_buff`, `cooldown_reduction`.
- **Display names** read like move-list calls: "Crimson Edge!", "Stormcradle!", "Bulwark Pivot!".
- **Cross-class neutrals**: 30 neutrals × ~2.5 combos each = ~75 combos, spread so each neutral has ≥1 combo with each class.

### 5.2 Combo budget per set
- Warrior set 50 → ~110 internal combo rows
- Mage set 50 → ~110 internal combo rows
- Shadowblade set 50 → ~110 internal combo rows
- Neutrals (30) → ~75 combo rows across all three classes
- **~405 total synergy rows** (vs 14 today). Manageable in JSON; auditable in a single review pass.

---

## 6. Relic charter

60 relics total:
- **30 exclusive** (10 per class). Each must reference the class's *primary mechanic* set — at least one relic per primary mechanic.
- **30 neutral**. Rough split: 10 stat/economy bonuses (common), 12 conditional rule-benders (rare), 8 build-defining (epic/legendary).

### 6.1 Triggers (extend existing list)
Existing: `combat_start`, `turn_start`, `card_played`, `damage_taken`, `heal`, `passive`.
Add: `enemy_killed`, `card_drawn`, `rest_used`, `shop_visited`, `stat_changed`, `combo_played` (synergy fired), `dot_tick`.

### 6.2 Rarity guideline
| Rarity | Count | Effect size | Example |
|---|---|---|---|
| Common | 18 | +Y stat / +small bonus | "+10 Max HP" |
| Rare | 24 | conditional payoffs | "First card each combat: x2" |
| Epic | 12 | build pivots with downside | "Spells free, −20% spell dmg" |
| Legendary | 6 | run-shaping, often 1/combat | "When HP→0, revive at 50%" |

---

## 7. Tile design (lighter touch — game has tiles already)

Tiles are mostly fine as-is. Add **3 new optional tiles** to deepen adjacency synergies:

| Tile | Cost | Effect | Adjacency synergies |
|---|---|---|---|
| **Library** | 4 | +1 card draw on shuffle; +XP from kills nearby | Library+Shop (cheap upgrade), Library+Graveyard (cursed knowledge) |
| **Arena** | 5 | Forced elite, +50% loot | Arena+Rest (medic recovery), Arena+Forest (ambush) |
| **Shrine of Pact** | 4 | Lose 5% maxHP permanently, gain a free relic | Shrine+Treasure (richer pact), Shrine+Graveyard (necropact) |

Three new adjacency rules also added: see `04_neutral_and_combos.md`.

---

## 8. Validation checklist (each class doc must pass)

- [ ] 50 cards total (16/18/12/4 by rarity)
- [ ] ≥6 cards touching each primary mechanic
- [ ] No card has 0 or >4 combo rows
- [ ] At least one card scales off each of the class's secondary stats
- [ ] 10 relics, ≥3 covering the class's primary mechanic set (one per primary)
- [ ] Starter deck (8–10 cards) is playable without any other card
- [ ] At least one "noob trap" weak card and one "build-defining" overpowered card
- [ ] Each rare/epic card has a tradeoff (cost, downside, conditional)

---

## 9. Process

The detailed cards/relics live in:
- `01_warrior.md`
- `02_mage.md`
- `03_shadowblade.md`
- `04_neutral_and_combos.md`

Each follows the same section layout: Identity → Stat baseline → Card list (table) → Relic list (table) → Combo list (table) → Validation pass.
