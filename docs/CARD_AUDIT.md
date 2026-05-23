# Card Description Audit — Icon & Prose Rewrite

**Goal:** simplify all 164 card descriptions by moving resource-consumption to a cost-section, replacing stack/stat references with icons, removing single-use keywords, and rewriting kept text in clear prose.

**Status:** proposal. Each card has an OLD and NEW text. Nothing is applied to `cards.json` yet.

---

## 1. Conventions

### 1.1 Card-face layout

Follows standard TCG conventions. Two layouts: the **standard face** that shows in deck / hand / queue, and the **extended view** that opens on click for full details.

**Standard face** (single card visual):

```
+---------------------------------+
| [⏱Ns]   [elem icons]   [cost]   |  ← header row
|---------------------------------|
|                                 |
|              ART                |
|                                 |
|---------------------------------|
| NAME                            |
| VISUAL SUMMARY (big numbers     |
|   + icons, color-coded)         |
+---------------------------------+
```

- **Top-left**: cooldown badge (`⏱ Ns`).
- **Top-middle**: element icons — one per element in the card's multiset. Replaces today's color-ball row.
- **Top-right**: cost block — every resource the card spends, each entry is `quantity[icon]`. `X[icon]` means "all of it". Stacks vertically or wraps if the block has several entries.
- **Center**: card art (full width).
- **Bottom**: name + **visual summary** — a heavily condensed, color-coded snapshot of the card's payoff. Big numbers in colors that match the effect (damage red, burn orange, heal green, armor blue, etc.) and inline icons. **Not full prose.** See §1.5 for the visual-summary grammar.

**Extended view** (detail popup, opened by clicking the card):

```
+--------------------------------------------------------+
| [⏱Ns]   [elem icons]   [cost]                          |
|--------------------------------|-----------------------|
|                                |  NAME                 |
|                                |  Rarity · Category    |
|                                |  -------------------- |
|             ART                |  FULL DESCRIPTION     |
|                                |  (icons + full prose) |
|                                |  -------------------- |
|                                |  Cooldown / Targeting |
+--------------------------------+-----------------------+
```

- **Left column**: standard card face minus the bottom body row (just header + art + name).
- **Right column**: the **full prose description** plus the existing stat rows (Cooldown / Targeting / etc.). This is where every conditional, duration, scaling, and gating clause is spelled out in sentences. Matches today's popup layout.

**Notation rules** (apply to the prose in the extended view):

- No `<`, `>`, `≥`. Use prose: "if you have more then 50%[HP]", "if [armor] is at least 10".
- No "Aura Ns:". Use "for N seconds: ...".
- No "(scales STR)". Use trailing `([str])`, `([vit])`, etc. Drop the word "scales".

### 1.2 Icon vocabulary

| Token | Meaning |
|---|---|
| `[stam]` | Stamina (cost) |
| `[mana]` | Mana (cost) |
| `[burn]` | Burn stack |
| `[bleed]` | Bleed stack |
| `[poison]` | Poison stack |
| `[slow]` | Slow stack |
| `[stun]` | Stun stack |
| `[rage]` | Rage stack |
| `[armor]` | Armor |
| `[HP]` | Hit points |
| `[str]` | Strength (stat scaling) |
| `[vit]` | Vitality |
| `[dex]` | Dexterity |
| `[int]` | Intellect |
| `[spi]` | Spirit |
| `[attack]` `[defense]` `[agility]` `[counter]` `[fire]` `[water]` `[air]` `[earth]` | Element icons (top-right badge) |

### 1.3 Notation

- **Quantity always before icon**: `3[burn]`, `2[stun]`, `X[poison]` (X = consume all).
- **Per-stack scaling**: `5([burn])` reads as "5 per Burn stack on enemy".
- **Stat scaling**: trailing `([str])`, `([vit])`, etc. Drop the word "scales".
- **No comparison operators**: write "if you have more then 50%[HP]", "if you have less then 50%[HP]", "if [armor] is at least 10".
- **Aura wrappers**: replace `Aura Ns:` with `for N seconds: ...`.
- **Aura triggers**: replace named triggers with prose:
  - `On Hit:` → `every time you hit an enemy:`
  - `Reflex:` / `on_hit_taken` → `every time you take damage:`
  - `Brace:` / `on_armor_break` → **KEPT** as keyword
  - `Vengeance:` / `took_damage_within_ms` → **KEPT** as keyword
  - `Juggernaut:` / `on_armor_gained` → `every time you gain at least N [armor]:`
  - `Rupture:` / `on_self_damage` → `every time you lose [HP]:`
  - `Bloodforge:` / `on_self_dot_tick` → `every time a self DoT ticks:`
  - `Cascade (Stack):` / `on_kill_with_stack` → `every time you kill an enemy with [icon]:`
  - `Frost Echo:` / `on_slow_applied` → `every time you apply [slow]:`
  - `On Stack ≥ N:` / `on_stack_threshold` → `when you reach N[icon]:`
  - `Threshold Stack ≥ N:` / `on_enemy_stack_threshold` → `when enemy has at least N[icon]:`
- **Conditional gates** (inline prose, not keywords):
  - `Fortified 10: 6 Pierce` → `if [armor] is at least 10: 6 Pierce`
  - `Guard 50%: Heal 8` → `if you have less then 50%[HP]: Heal 8`
  - `Empowered (if Burn): +4` → `if enemy has [burn]: +4 damage`
  - `Berserk (<50% HP): X` → `if you have less then 50%[HP]: X`
  - `Shatter: 6 Pierce` → `if enemy is [stun]: 6 Pierce` (checked BEFORE this card applies its own stun)
  - `If enemy Slow ≥ 4: Stun 1` → `if enemy has at least 4[slow]: 1[stun]`

### 1.4 Multi-enemy stack pool (design note, not card-text)

Stacks accumulate **globally across all enemies**: 3 enemies × 2 [burn] each = 6 [burn] in the pool. Consume effects spend from the global pool, not per-target. Card text says "consume X[burn]" without per-target qualifiers — the engine reads from the pool.

### 1.5 Visual summary grammar (standard-face body)

The standard face shows a **compressed, glanceable** snapshot of the card. It is NOT a sentence. It is a sequence of tokens separated by `·` (middle dot). Each token is either a value with color or an inline icon. The visual summary is for fast scanning during combat; the extended view holds the prose.

**Token forms** (high → low priority — show the top 2-4 effects only):

| Token | Color (hex) | Reads as |
|---|---|---|
| `N` | red `#FF4444`, big | Deal N damage |
| `N!` | dark red `#AA0000`, big | Deal N Pierce damage |
| `N×M` | red `#FF4444`, big | Deal N damage M times |
| `N([stack])` | matches stack color, big | N per stack of that icon |
| `N([stat])` trailing | dim white `#AAAAAA`, small | The previous number scales with that stat |
| `+N[burn]` | orange `#FF8C00`, medium | Apply N Burn |
| `+N[bleed]` | blood red `#DD2222`, medium | Apply N Bleed |
| `+N[poison]` | green `#66CC22`, medium | Apply N Poison |
| `+N[slow]` | light blue `#66CCFF`, medium | Apply N Slow |
| `+N[stun]` | white `#CCCCCC`, medium | Apply N Stun |
| `+N[rage]` | bright orange `#FF6622`, medium | Gain N Rage |
| `+N[HP]` | bright green `#44DD44`, big | Heal N |
| `+N[armor]` | steel blue `#4488DD`, big | Gain N Armor |
| `+N[stam]` | yellow `#FFCC44`, small | Gain N Stamina |
| `+N[mana]` | purple `#BB55EE`, small | Gain N Mana |
| `Haste N%` | yellow `#FFCC44`, small | Cooldown reduction (duration in extended view) |
| `(Ns)` | dim white, small | Duration of the previous token |
| `Brace: …` | gray `#888888`, small | Brace payoff |
| `Vengeance: …` | dark red `#AA0000`, small | Vengeance payoff |
| `if [stun]: …` | white `#CCCCCC`, small | Stun-condition payoff |
| `if <50%[HP]: …` | bright green `#44DD44`, small | Low-HP gate |
| `if [armor]≥N: …` | steel blue `#4488DD`, small | Armor gate |
| `Self -N[HP]` | dark red `#AA0000`, small | Self-damage cost |
| `[exhaust]` icon | gold `#FFAA00`, badge | Once per combat marker |

**Color logic:** the number takes the color of the *effect type*, not the stack icon next to it. E.g. `3([fire])` in the Pyre case is the *damage value* per burn — that number is **orange** because the damage scales off Burn and reads as fire-themed; for plain damage like `9` the number is red.

**What to include / exclude:**

- **Include** the headline numbers a player cares about during play: primary damage, applied DoTs, conditional payoffs that double-or-better the card's power, heals, armor.
- **Exclude** flavor-trickles (e.g. `+1[stam]` ride-along on a damage card, `Self Bleed 1` self-cost — unless self-cost is the whole point of the card). Aim for **2-4 tokens** total.
- **Conditional gates** appear as `if X: payoff` only when the payoff is the card's main draw (e.g. Shatter, Berserk, Fortified). For "trickle" conditional like Vengeance + small heal, just put `Vengeance: +3[HP]`.

**Examples** (paired with their cards):

| Card | Cost | Visual summary |
|---|---|---|
| Jab | `1[stam]` | `9` |
| Spark | `1[mana]` | `+3[burn]` |
| Pyre (`t2-fire-fire`) | `X[burn]` | `4 · 3([fire])` |
| Reckless Strike | `1[stam]` | `9 · +2[rage]` |
| Bramble Bulwark | `1[stam]` | `+8[armor] · if [armor]≥10: 6!` |
| Last Stand Bulwark | `2[stam]` | `+10[armor] · if <50%[HP]: +10[armor] · 12!` |
| Alchemic Drain | `1[stam] 1[mana] 4[poison]` | `+4[HP]([poison])` |
| Crimson Spiral | `2[stam] X[rage]` | `2!([rage]) · +1[bleed]([rage])` |
| Concussive Smash | `2[stam]` | `14 · +2[stun] · if [stun]: +6` |
| Tidesong Aura | `2[mana]` | `+12[HP] · +3[mana]` |
| Wrathshell Vow | `2[stam] [exhaust]` | `(4s) → +1[rage]/3s · on hit: +1[rage]` |

The visual summary uses `·` as separator and may wrap to 2 lines if needed. The card's full reading is always available in the extended view; the visual summary is the at-a-glance briefing.

---

## 2. Keyword decisions

### 2.1 KEEP (text keywords, glossary-linked)

| Keyword | # cards | Reason |
|---|---|---|
| Brace | 25 | On-armor-break trigger; pervasive defensive theme |
| Vengeance | 15 | Took-damage-in-last-2s trigger; pervasive theme |
| Haste | 29 | CD-reduction aura; universal |
| Exhaust | 7 | Once-per-combat marker; mechanically meta-level |

### 2.2 MOVE TO COST SECTION (icon-only, no body text)

| Old keyword | New rendering |
|---|---|
| `Consume(N) Stack` | `N[stack]` in cost block |
| `Consume all Stack` | `X[stack]` in cost block |
| `Pyre: N` | `X[burn]` in cost block + body says "N damage per [burn] consumed" |
| `Spend ALL Armor` | `X[armor]` in cost block |
| `Convert N from → to` | `N[from]` in cost block + body says "apply N[to]" (or scaled equiv) |
| `Devour 1 common` | `1[card]` in cost block (new icon) |

### 2.3 INLINE (drop the word, prose-only)

| Old keyword | Reason |
|---|---|
| Empowered | "if X" gate, redundant |
| Guard N% | "if you have less then N%[HP]" prose |
| Fortified N | "if [armor] is at least N" prose |
| Shatter | "if enemy is [stun]" prose |
| Berserk (low-HP) | "if you have less then N%[HP]" prose |
| Per Stack | `N([icon])` icon notation |
| Echo | Prose: "trigger again after Ns" or "apply again Ns later" |
| Stance | Prose: "for N seconds: every attack does X" |
| Catalyze | Prose: "double current [icon] on enemy" |
| Cascade | Prose: "every time you kill an enemy with [icon]:" |
| DR | Prose: "take N% less damage" |
| Channel (charge) | Prose: "hold to charge, +N% per second held (max +X%)" |
| Devour (effect side) | Prose: "lose 1 card from deck: ..." (combined with `1[card]` cost) |
| Force-trigger | Prose: "trigger every card you own once" |
| Spread | Prose: "for each N[icon] consumed, apply M[icon] to next enemy" |
| Overload | Prose: "X bonus damage, next card delays N more seconds" |
| Vulnerable | Prose: "for N seconds: enemy takes +X% damage from [element]" |
| Aura Ns: | "for N seconds:" |
| On Hit Ns: | "for N seconds: every time you hit an enemy:" |
| Reforce | "for N seconds: every [armor] gained is +X%" |
| Juggernaut | "every time you gain at least N[armor]:" |
| Rupture | "every time you lose [HP]:" |
| Bloodforge | "every time a self DoT ticks:" |
| Frost Echo | "every time you apply [slow]:" |
| Strip | "for N seconds: ignore enemy [icon] immunity" |
| Expose | "for N seconds: enemy −N Defense" |
| Mitigate | "take N% less damage" |
| Empower (aura) | "for N seconds: +N% damage dealt" |
| Weakened | "for N seconds: −N% damage dealt" |
| Steady | "if you have more then N%[HP]:" |
| Threshold | "when enemy has at least N[icon]:" |

### 2.4 DEPRECATED / DEAD CODE

- `Drain` (rendering exists in `CardText.ts` for enemy-targeting stamina/mana effects, but **no card currently uses it**). No rewrite needed. Code can be removed when `cards.json` is regenerated.

---

## 3. Cards needing human review (flagged)

These cards have a mechanic that doesn't translate cleanly:

| Card | Issue | Suggested resolution |
|---|---|---|
| **Stormstrike** (t2-air-attack) | "Drain 2 Mana" — actually this card grants self mana, no drain. Just self mana gain. Fine, no change. | — |
| **Magma Welling** (t3-earth-fire-fire) | Old text says "Slow cooldown" but no `cooldown_scale` field in JSON. This is just flavour. | Drop "Slow cooldown" from text. |
| **Wrathshell Vow** (t3-counter-counter-defense) | Has a 4s Channel warm-up before aura starts. Engine supports it; text must explain. | "Exhaust. After charging 4 seconds: for the rest of combat, every 3 seconds gain 1[rage]; every time you take damage gain 1[rage]." |
| **Tectonic Reckoning** (t3-air-counter-earth) | "Force-trigger every card you own once" — one-of-a-kind. | "Exhaust. 3[stun] AoE ([int]). Then trigger every card you own once." |
| **Wrath Squall** (t3-air-counter-counter) | Triggers when [rage]≥30, then resets. | "When you reach 30[rage]: deal 40 ([str]) and apply 8[slow] ([int]). Consume all [rage]." |
| **Tidefoot Bloom** (t3-counter-water-water) | Has "Echo 1 (6s, scales INT)" — 1 card with Echo. Single-use. Inline. | "Cost X[poison]. Apply 1[bleed] per [poison] consumed ([dex]). For 6 seconds: next card triggers a second time ([int])." |
| **Twinflame Flicker** (t3-agility-agility-fire) | Has "Echo: re-apply Burn 2 after 1.5s". Different mechanic from Echo above — this re-applies its own effect. | "3[burn] ([int]). 1.5 seconds later: apply 2[burn] again ([int])." |
| **Slipvenom Tempo** (t3-agility-water-water) | "Echo if Poison ≥ 10" — repeats poison if condition met. | "3[poison] ([int]). Haste 15% (6s). If enemy has at least 10[poison]: apply 3[poison] again ([int])." |

---

## 4. Tier 1 — single-element starters (8 cards)

Compact reference: **Cost** | **Body**

### t1-attack — Jab
- Old: `Deal 9.`
- Cost: `1[stam]`  Elements: `[attack]`
- New: `Deal 9 ([str]).`

### t1-defense — Guard
- Old: `Armor 12.`
- Cost: `1[stam]`  Elements: `[defense]`
- New: `Gain 12[armor] ([vit]).`

### t1-agility — Quickstep
- Old: `Deal 4. Deal 4.`
- Cost: `1[stam]`  Elements: `[agility]`
- New: `Deal 4 twice ([dex]).`

### t1-counter — Riposte
- Old: `On Hit 6s: Deal 3.`
- Cost: `1[stam]`  Elements: `[counter]`
- New: `For 6 seconds: every time you hit an enemy, deal 3.`

### t1-fire — Spark
- Old: `Burn 3.`
- Cost: `1[mana]`  Elements: `[fire]`
- New: `Apply 3[burn] ([int]).`

### t1-water — Mend
- Old: `Heal 6.`
- Cost: `1[mana]`  Elements: `[water]`
- New: `Heal 6 ([spi]).`

### t1-air — Gust
- Old: `Haste 20% (5s).`
- Cost: *(none)*  Elements: `[air]`
- New: `Haste 20% for 5 seconds.`

### t1-earth — Quake
- Old: `Slow 4.`
- Cost: `1[mana]`  Elements: `[earth]`
- New: `Apply 4[slow] ([int]).`

---

## 5. Tier 2 — mirror pairs (8 cards)

### t2-attack-attack — Reckless Strike
- Old: `Deal 9 (scales STR). +2 Rage. Self Bleed 1.`
- Cost: `1[stam]`  Elements: `[attack][attack]`
- New: `Deal 9 ([str]). Gain 2[rage]. Apply 1[bleed] to yourself.`

### t2-defense-defense — Bulwark Vow
- Old: `Armor 7 (Scales VIT). Brace: +3 Rage.`
- Cost: `1[stam]`  Elements: `[defense][defense]`
- New: `Gain 7[armor] ([vit]). Brace: gain 3[rage].`

### t2-agility-agility — Flurry Step
- Old: `Deal 4. Deal 4 (scales DEX).`
- Cost: `1[stam]`  Elements: `[agility][agility]`
- New: `Deal 4 twice. Second hit scales ([dex]).`

### t2-counter-counter — Razor Stance
- Old: `On Hit 10s: apply Bleed 1 (Scales DEX). Vengeance — On Hit 4s: apply +1 Bleed.`
- Cost: `1[stam]`  Elements: `[counter][counter]`
- New: `For 10 seconds: every time you hit an enemy, apply 1[bleed] ([dex]). Vengeance — for 4 more seconds, that bleed becomes 2.`

### t2-fire-fire — Pyre
- Old: `Deal 4. Pyre: 3. Burn 3.`
- Cost: `X[burn]` *(implicit)* + Elements: `[fire][fire]`
- New: `Deal 4 ([str]). Deal 3 per [burn] consumed. Apply 3[burn] ([int]).`
- **Note:** rename card? "Pyre" name still works as flavour even without the keyword.

### t2-water-water — Frostbind
- Old: `Stun 1 (scales INT). Armor 4 (scales VIT). Vengeance: Stun 1.`
- Cost: `1[mana]`  Elements: `[water][water]`
- New: `Apply 1[stun] ([int]). Gain 4[armor] ([vit]). Vengeance: 1 more [stun] ([int]).`

### t2-air-air — Tailwind
- Old: `Deal 4 (Scales STR). Haste 20% (5s). +1 Mana.`
- Cost: *(none)*  Elements: `[air][air]`
- New: `Deal 4 ([str]). Haste 20% for 5 seconds. Gain 1[mana].`

### t2-earth-earth — Tremor Lock
- Old: `Stun 1 (Scales INT). Slow 4 (Scales INT). Shatter: Deal 5.`
- Cost: `1[mana]`  Elements: `[earth][earth]`
- New: `If enemy is [stun]: deal 5 ([int]). Then apply 1[stun] ([int]) and 4[slow] ([int]).`
- **Note:** Shatter checks BEFORE this card applies its own [stun] (per your rule).

---

## 6. Tier 2 — cross-element (28 cards)

### t2-agility-attack — Quickstrike
- Old: `Deal 8 (Scales DEX).`
- Cost: `1[stam]`  Elements: `[agility][attack]`
- New: `Deal 8 ([dex]).`

### t2-agility-counter — Sidestep & Slash
- Old: `Deal 5. Vengeance: Deal 3. Bleed 2. +1 Stamina.`
- Cost: *(none)*  Elements: `[agility][counter]`
- New: `Deal 5 ([dex]). Apply 2[bleed]. Gain 1[stam]. Vengeance: deal 3 more.`

### t2-agility-defense — Parrying Stance
- Old: `Armor 5 (scales DEX). +1 Stamina. Brace: Deal 4.`
- Cost: *(none)*  Elements: `[agility][defense]`
- New: `Gain 5[armor] ([dex]). Gain 1[stam]. Brace: deal 4.`

### t2-agility-fire — Flame Dart
- Old: `Deal 5 (scales DEX). Burn 2.`
- Cost: *(none)*  Elements: `[agility][fire]`
- New: `Deal 5 ([dex]). Apply 2[burn].`

### t2-agility-water — Mist Step
- Old: `Heal 3 (scales SPI). +1 Stamina. +1 DEX (6s). Slow 1.`
- Cost: *(none)*  Elements: `[agility][water]`
- New: `Heal 3 ([spi]). Gain 1[stam]. For 6 seconds: +1 [dex]. Apply 1[slow].`

### t2-agility-air — Gale Cut
- Old: `Deal 3 (Scales DEX). Haste 15% (4s). +1 Stamina.`
- Cost: *(none)*  Elements: `[agility][air]`
- New: `Deal 3 ([dex]). Haste 15% for 4 seconds. Gain 1[stam].`

### t2-agility-earth — Tremor Dash
- Old: `Deal 7 (Scales DEX). Armor 6 (Scales VIT).`
- Cost: `1[stam]`  Elements: `[agility][earth]`
- New: `Deal 7 ([dex]). Gain 6[armor] ([vit]).`

### t2-attack-counter — Bloodprice Strike
- Old: `Lose 4 HP (Pierce). Deal 12 (scales STR). +2 Rage. +1 Stamina.`
- Cost: `1[stam]`  Elements: `[attack][counter]`
- New: `Lose 4[HP] (Pierce). Deal 12 ([str]). Gain 2[rage] ([str]). Gain 1[stam].`

### t2-attack-defense — Shield Bash
- Old: `Deal 10 (scales STR). Aura 6s: enemy Defense −3.`
- Cost: `4[defense]`  Elements: `[attack][defense]`
- New: `Deal 10 ([str]). For 6 seconds: enemy has −3 Defense.`
- **Note:** uses unusual `defense: 4` cost — first card to spend "Defense" as a currency. Verify this is still intended.

### t2-attack-fire — Kindle Strike
- Old: `Deal 7 (Scales STR). Burn 3 (Scales INT). Vulnerable Fire 1 (5s).`
- Cost: `1[stam]`  Elements: `[attack][fire]`
- New: `Deal 7 ([str]). Apply 3[burn] ([int]). For 5 seconds: enemy takes +1 from [burn].`

### t2-attack-water — Crimson Tithe
- Old: `Lose 5 HP. +1 Stamina, +1 Mana (scales SPI). Aura 6s: HP loss → +1 Rage.`
- Cost: *(none)*  Elements: `[attack][water]`
- New: `Lose 5[HP]. Gain 1[stam] and 1[mana] ([spi]). For 6 seconds: every time you lose [HP], gain 1[rage].`

### t2-air-attack — Stormstrike
- Old: `Deal 6 (scales STR). Haste 20% (5s).`
- Cost: *(none)*  Elements: `[air][attack]`
- New: `Deal 6 to all enemies ([str]). Haste 20% for 5 seconds.`

### t2-attack-earth — Granite Lunge
- Old: `Armor 6 (Scales VIT). Deal 4 + 1 per 4 Armor (Scales STR).`
- Cost: `1[stam]`  Elements: `[attack][earth]`
- New: `Gain 6[armor] ([vit]). Deal 4, +1 damage per 4[armor] you have ([str]).`

### t2-counter-defense — Iron Reckoning
- Old: `Armor 4 (scales VIT). Stance 8s: hits +1 per Rage (scales STR).`
- Cost: `1[stam]`  Elements: `[counter][defense]`
- New: `Gain 4[armor] ([vit]). For 8 seconds: every attack deals 1 more damage per [rage] ([str]).`

### t2-counter-fire — Cinderscar
- Old: `Burn 2 (scales INT). Vengeance: convert 2 Burn into Bleed.`
- Cost: `1[stam]`  Elements: `[counter][fire]`
- New: `Apply 2[burn] ([int]). Vengeance — cost 2[burn]: apply 2[bleed].`

### t2-counter-water — Bloodtide Mend
- Old: `Heal 5 (scales SPI). Vengeance: Heal 3. Self Bleed 2.`
- Cost: *(none)*  Elements: `[counter][water]`
- New: `Heal 5 ([spi]). Apply 2[bleed] to yourself. Vengeance: heal 3 more.`

### t2-air-counter — Hollow Echo
- Old: `Deal 5 (scales STR). Vengeance: Deal 3. Haste 15% (4s).`
- Cost: *(none)*  Elements: `[air][counter]`
- New: `Deal 5 ([str]). Haste 15% for 4 seconds. Vengeance: deal 3 more.`

### t2-counter-earth — Thornwall
- Old: `Armor 8 (scales VIT). Deal 5. Brace: Deal 6.`
- Cost: `1[stam]`  Elements: `[counter][earth]`
- New: `Gain 8[armor] ([vit]). Deal 5. Brace: deal 6.`

### t2-defense-fire — Forge Spike Ward
- Old: `Armor 5 (scales VIT). Aura 8s: on hit taken, deal 2 + 1 per 6 Armor (scales STR).`
- Cost: `1[stam]`  Elements: `[defense][fire]`
- New: `Gain 5[armor] ([vit]). For 8 seconds: every time you take damage, deal 2 (+1 per 6[armor]) ([str]).`

### t2-defense-water — Vow of the Tide
- Old: `Armor 5 (scales VIT). Heal 3. +1 Stamina. +1 SPI (6s).`
- Cost: `1[mana]`  Elements: `[defense][water]`
- New: `Gain 5[armor] ([vit]). Heal 3. Gain 1[stam]. For 6 seconds: +1 [spi].`

### t2-air-defense — Cyclone Ward
- Old: `Armor 5 (scales VIT). Haste 15% (4s).`
- Cost: *(none)*  Elements: `[air][defense]`
- New: `Gain 5[armor] ([vit]). Haste 15% for 4 seconds.`

### t2-defense-earth — Bramble Bulwark
- Old: `Armor 8 (scales VIT). Fortified 10: 6 Pierce.`
- Cost: `1[stam]`  Elements: `[defense][earth]`
- New: `Gain 8[armor] ([vit]). If [armor] is at least 10: deal 6 Pierce.`

### t2-fire-water — Steam Surge
- Old: `Deal 4. Empowered (if Burn): +4. Heal 4. +1 Stamina.`
- Cost: `1[mana]`  Elements: `[fire][water]`
- New: `Deal 4 ([str]). If enemy has [burn]: +4 damage. Heal 4. Gain 1[stam].`

### t2-air-fire — Firestorm
- Old: `Deal 4 AoE (scales STR). Burn 2. Stun 1.`
- Cost: `1[mana]`  Elements: `[air][fire]`
- New: `Deal 4 to all enemies ([str]). Apply 2[burn] and 1[stun] ([int]).`

### t2-earth-fire — Magma Vein
- Old: `Armor 7. Deal 8. Burn 2.`
- Cost: `2[mana]`  Elements: `[earth][fire]`
- New: `Gain 7[armor]. Deal 8 ([str]). Apply 2[burn].`

### t2-air-water — Misting Veil
- Old: `Heal 3 (Scales SPI). Haste 15% (5s). +1 INT (6s). +1 Mana.`
- Cost: *(none)*  Elements: `[air][water]`
- New: `Heal 3 ([spi]). Haste 15% for 5 seconds. For 6 seconds: +1 [int]. Gain 1[mana].`

### t2-earth-water — Mire Bloom
- Old: `Armor 4 (Scales VIT). Heal 3 (Scales SPI). Deal 3 (Scales STR). +1 Mana.`
- Cost: *(none)*  Elements: `[earth][water]`
- New: `Gain 4[armor] ([vit]). Heal 3 ([spi]). Deal 3 ([str]). Gain 1[mana].`

### t2-air-earth — Bedrock Snare
- Old: `Slow 2 (Scales INT). If enemy Slow ≥ 4: Stun 1. Shatter: Deal 4 (Scales STR).`
- Cost: `1[mana]`  Elements: `[air][earth]`
- New: `If enemy is [stun]: deal 4 ([str]). If enemy has at least 4[slow]: apply 1[stun] ([int]). Apply 2[slow] ([int]).`

---

## 7. Tier 3 — three-element cards (120 cards)

### 7.1 Same-element trios (8 cards)

#### t3-attack-attack-attack — Berserker's Ledger
- Old: `Deal 8 ×3 (scales STR). Self Bleed 2.`
- Cost: `2[stam]`  Elements: `[attack][attack][attack]`
- New: `Deal 8 three times ([str]). Apply 2[bleed] to yourself.`

#### t3-defense-defense-defense — Aegis of Returning Wrath
- Old: `Armor 22 (scales VIT). Brace: 18 Pierce.`
- Cost: `2[stam]`  Elements: `[defense][defense][defense]`
- New: `Gain 22[armor] ([vit]). Brace: deal 18 Pierce.`

#### t3-agility-agility-agility — Quickstep Sigil
- Old: `Deal 5 ×3 (Scales DEX). Haste 30% (6s).`
- Cost: `1[stam]`  Elements: `[agility][agility][agility]`
- New: `Deal 5 three times ([dex]). Haste 30% for 6 seconds.`

#### t3-counter-counter-counter — Crimson Spiral
- Old: `Damage = Rage × 2 (Pierce, scales STR). +1 Bleed per Rage. Consume all Rage.`
- Cost: `2[stam]  X[rage]`  Elements: `[counter][counter][counter]`
- New: `Deal 2 Pierce per [rage] consumed ([str]). Apply 1[bleed] per [rage] consumed ([dex]).`

#### t3-fire-fire-fire — Supernova
- Old: `Exhaust. Consume all Burn: 5 Pierce per stack consumed (AoE, scales INT).`
- Cost: `2[stam] 1[mana]  X[burn]`  Elements: `[fire][fire][fire]`  · Exhaust
- New: `Exhaust. Deal 5 Pierce per [burn] consumed to all enemies ([int]).`

#### t3-water-water-water — Tidesong Aura
- Old: `Heal 12 (scales SPI). +3 SPI (10s). +3 Mana.`
- Cost: `2[mana]`  Elements: `[water][water][water]`
- New: `Heal 12 ([spi]). For 10 seconds: +3 [spi]. Gain 3[mana].`

#### t3-air-air-air — Tempest Cadence
- Old: `Deal 8 (scales DEX). Haste 30% (10s).`
- Cost: `2[mana]`  Elements: `[air][air][air]`
- New: `Deal 8 to all enemies ([dex]). Haste 30% for 10 seconds.`

#### t3-earth-earth-earth — Mountain's Answer
- Old: `Armor 26 (scales VIT). Fortified 20: 22 Pierce.`
- Cost: `2[stam]`  Elements: `[earth][earth][earth]`
- New: `Gain 26[armor] ([vit]). If [armor] is at least 20: deal 22 Pierce to all enemies.`

### 7.2 Two-of-A + one-of-B trios

#### t3-attack-attack-defense — Bulwark Salvo
- Old: `Deal 6 + 1 per 2 Armor ×2 (scales STR, no consume).`
- Cost: `2[stam]`  Elements: `[attack][attack][defense]`
- New: `Deal 6 twice, +1 damage per 2[armor] you have ([str]). Armor is not consumed.`

#### t3-agility-attack-attack — Triple Slash
- Old: `Deal 6 ×3 (scales DEX).`
- Cost: `2[stam]`  Elements: `[agility][attack][attack]`
- New: `Deal 6 three times to all enemies ([dex]).`

#### t3-attack-attack-counter — Bloodlash Salvo
- Old: `Per Bleed: 3 Pierce (scales STR). Vengeance: +2 Pierce per Bleed. No consume.`
- Cost: `2[stam]`  Elements: `[attack][attack][counter]`
- New: `Deal 3 Pierce per [bleed] on enemy ([str]). Vengeance: +2 Pierce per [bleed]. Bleed is not consumed.`

#### t3-attack-defense-defense — Body Slam Vow
- Old: `2 Pierce (scales Armor). Armor 6.`
- Cost: `2[stam]`  Elements: `[attack][defense][defense]`
- New: `Deal 2 Pierce per 1[armor] you have. Gain 6[armor].`

#### t3-agility-defense-defense — Phalanx Drift
- Old: `Armor 22 (scales VIT). Haste 10% (8s). Brace: Deal 10.`
- Cost: `1[stam]`  Elements: `[agility][defense][defense]`
- New: `Gain 22[armor] ([vit]). Haste 10% for 8 seconds. Brace: deal 10.`

#### t3-counter-defense-defense — Reforge Vow
- Old: `Aura 12s: Armor gained +50%. Armor 8 (scales VIT).`
- Cost: `1[stam] 1[mana]`  Elements: `[counter][defense][defense]`
- New: `For 12 seconds: every [armor] you gain is +50%. Gain 8[armor] ([vit]).`

#### t3-agility-agility-attack — Pinprick Volley
- Old: `5 Pierce ×3 (scales DEX).`
- Cost: `1[stam]`  Elements: `[agility][agility][attack]`
- New: `Deal 5 Pierce three times to all enemies ([dex]).`

#### t3-agility-agility-defense — Veil of Steps
- Old: `Armor 14 (scales DEX). Haste 20% (6s).`
- Cost: `1[stam]`  Elements: `[agility][agility][defense]`
- New: `Gain 14[armor] ([dex]). Haste 20% for 6 seconds.`

#### t3-agility-agility-counter — Quicksilver Bleed
- Old: `Bleed 3. Burn 2.`
- Cost: `1[stam]`  Elements: `[agility][agility][counter]`
- New: `Apply 3[bleed] ([dex]). Apply 2[burn].`

#### t3-attack-counter-counter — Cleaver's Tax
- Old: `Deal 12 Pierce (scales STR). Overload: -5 Rage, +20 dmg, lockout 4s.`
- Cost: `2[stam]`  Elements: `[attack][counter][counter]`
- New: `Deal 12 Pierce ([str]). If you have at least 5[rage]: consume 5[rage], deal 20 more Pierce, and this card delays 4 more seconds next time.`

#### t3-counter-counter-defense — Wrathshell Vow
- Old: `Exhaust. Channel 4s, then aura: +1 Rage every 3s. On hit taken: +1 Rage.`
- Cost: `2[stam]`  Elements: `[counter][counter][defense]`  · Exhaust
- New: `Exhaust. After charging 4 seconds, for the rest of combat: gain 1[rage] every 3 seconds, and gain 1[rage] every time you take damage.`

#### t3-agility-counter-counter — Razor Cadence
- Old: `Deal 5 ×3 (scales DEX). Each hit: Bleed 1. Vengeance: ×4 hits.`
- Cost: `2[stam]`  Elements: `[agility][counter][counter]`
- New: `Deal 5 three times ([dex]); each hit applies 1[bleed]. Vengeance: deal 5 a fourth time and apply 1 more [bleed].`

#### t3-agility-attack-defense — Flowstrike
- Old: `Deal 10 (scales STR). Armor 10. Haste 15% (6s).`
- Cost: `2[stam]`  Elements: `[agility][attack][defense]`
- New: `Deal 10 ([str]). Gain 10[armor]. Haste 15% for 6 seconds.`

#### t3-attack-counter-defense — Last Stand Bulwark
- Old: `Armor 10 (scales VIT). Berserk (<50% HP): +10 Armor and 12 Pierce (scales STR).`
- Cost: `2[stam]`  Elements: `[attack][counter][defense]`
- New: `Gain 10[armor] ([vit]). If you have less then 50%[HP]: gain 10 more [armor] ([vit]) and deal 12 Pierce ([str]).`

#### t3-agility-attack-counter — Vein Splitter
- Old: `Deal 4 ×3 (scales DEX). Each hit: Bleed +1 per existing Bleed.`
- Cost: `2[stam]`  Elements: `[agility][attack][counter]`
- New: `Deal 4 three times ([dex]); each hit applies 1[bleed] ([dex]), plus 1 more [bleed] per existing [bleed] on enemy.`

#### t3-agility-counter-defense — Bramble Step
- Old: `Armor 10 (scales DEX). Brace: Bleed 3.`
- Cost: `1[stam]`  Elements: `[agility][counter][defense]`
- New: `Gain 10[armor] ([dex]). Brace: apply 3[bleed].`

### 7.3 Fire + cross trios

#### t3-fire-fire-water — Quench Lance
- Old: `Convert 3 Burn into Bleed. Deal 4 per Bleed (scales STR). Burn 2 (scales INT).`
- Cost: `1[stam] 1[mana]  3[burn]`  Elements: `[fire][fire][water]`
- New: `Apply 3[bleed] (from consumed [burn]). Deal 4 damage per [bleed] on enemy ([str]). Apply 2[burn] ([int]).`

#### t3-air-fire-fire — Pyre Surge
- Old: `+2 to every Burn on enemy (scales INT). Vulnerable Fire 3 (8s).`
- Cost: `1[stam] 1[mana]`  Elements: `[air][fire][fire]`
- New: `Add 2 to every [burn] on enemy ([int]). For 8 seconds: enemy takes +3 from [burn].`

#### t3-earth-fire-fire — Magma Welling
- Old: `Armor 14 (scales VIT). Burn 8 (scales INT). Slow cooldown.`
- Cost: `2[stam]`  Elements: `[earth][fire][fire]`
- New: `Gain 14[armor] ([vit]). Apply 8[burn] ([int]).`
- **Note:** "Slow cooldown" was flavour-only — no engine field. Dropped from text.

#### t3-fire-water-water — Phoenix Aura
- Old: `Heal 10 (scales SPI). Guard 50%: Armor 18 (12s).`
- Cost: `2[mana]`  Elements: `[fire][water][water]`
- New: `Heal 10 ([spi]). For 12 seconds: if you have less then 50%[HP], gain 18[armor].`

#### t3-air-water-water — Misted Cadence
- Old: `Heal 9 (scales SPI). Haste 25% (8s). +3 Mana.`
- Cost: `2[mana]`  Elements: `[air][water][water]`
- New: `Heal 9 ([spi]). Haste 25% for 8 seconds. Gain 3[mana].`

#### t3-earth-water-water — Brine Bedrock
- Old: `Heal 10 (scales SPI). Vengeance: Poison 3.`
- Cost: `2[mana]`  Elements: `[earth][water][water]`
- New: `Heal 10 to all allies ([spi]). Vengeance: apply 3[poison].`

#### t3-air-air-fire — Cinder Squall
- Old: `Slow 3 AoE (scales INT). If Slow ≥ 5: Stun 1. 2 damage per Slow stack.`
- Cost: `1[stam] 1[mana]`  Elements: `[air][air][fire]`
- New: `Apply 3[slow] to all enemies ([int]). If enemy has at least 5[slow]: apply 1[stun] ([int]). Deal 2 damage per [slow] on enemy ([int]).`

#### t3-air-air-water — Squall Aura
- Old: `Heal 6. Haste 25% (8s). +4 Mana.`
- Cost: `2[mana]`  Elements: `[air][air][water]`
- New: `Heal 6 ([spi]). Haste 25% for 8 seconds. Gain 4[mana].`

#### t3-air-air-earth — Dust Plague
- Old: `Armor 8 (scales VIT). Aura 12s: every 2.5s apply Slow 1 AoE (scales INT). ≥5 Slow → Stun.`
- Cost: `1[stam] 2[mana]`  Elements: `[air][air][earth]`
- New: `Gain 8[armor] ([vit]). For 12 seconds: every 2.5 seconds apply 1[slow] to all enemies ([int]); when an enemy has at least 5[slow], apply 1[stun] ([int]).`

#### t3-earth-earth-fire — Magma Vow
- Old: `Armor 14 (scales VIT). Vengeance: 14 Pierce.`
- Cost: `2[mana]`  Elements: `[earth][earth][fire]`
- New: `Gain 14[armor] ([vit]). Vengeance: deal 14 Pierce.`

#### t3-earth-earth-water — Bog Catalyst
- Old: `Poison 2 (scales INT). Catalyze x2: doubles Poison on enemy.`
- Cost: `1[stam] 1[mana]`  Elements: `[earth][earth][water]`
- New: `Apply 2[poison] ([int]), then double the [poison] on enemy.`

#### t3-air-earth-earth — Standing Stone
- Old: `Armor 16 (scales VIT). Brace: Heal 8. Haste 10% (8s).`
- Cost: `2[mana]`  Elements: `[air][earth][earth]`
- New: `Gain 16[armor] ([vit]). Brace: heal 8. Haste 10% for 8 seconds.`

#### t3-air-fire-water — Steaming Plague
- Old: `Poison 3 AoE (scales INT). +2 extra Poison on already-poisoned enemies.`
- Cost: `1[stam] 1[mana]`  Elements: `[air][fire][water]`
- New: `Apply 3[poison] to all enemies ([int]); if an enemy already has [poison], apply 2 more ([int]).`

#### t3-earth-fire-water — Alchemic Drain
- Old: `Consume up to 4 Poison: Heal 4 per stack consumed (scales SPI).`
- Cost: `1[stam] 1[mana]  4[poison]`  Elements: `[earth][fire][water]`
- New: `Heal 4 per [poison] consumed ([spi]).`

#### t3-air-earth-fire — Sandfury
- Old: `Deal 8 ×2. Per Slow: 2 Pierce.`
- Cost: `2[mana]`  Elements: `[air][earth][fire]`
- New: `Deal 8 twice to all enemies ([str]). Deal 2 Pierce per [slow] on enemy.`

#### t3-air-earth-water — Marsh Squall
- Old: `Exhaust. Spread 50% Poison AoE. 4 Pierce per Poison consumed (scales INT).`
- Cost: `2[stam] 2[mana]  X[poison]`  Elements: `[air][earth][water]`  · Exhaust
- New: `Exhaust. For each 2[poison] consumed, apply 1[poison] to up to 4 nearby enemies. Deal 4 Pierce per [poison] consumed to all enemies ([int]).`

### 7.4 Attack + cross trios

#### t3-attack-attack-fire — Cinder Thrust
- Old: `Deal 10 ×2 (scales STR). Burn 2.`
- Cost: `2[stam]`  Elements: `[attack][attack][fire]`
- New: `Deal 10 twice ([str]). Apply 2[burn].`

#### t3-attack-attack-water — Soaking Blade
- Old: `Deal 12 (scales STR). Poison 2. Empowered (if Poison): +7.`
- Cost: `2[stam]`  Elements: `[attack][attack][water]`
- New: `Deal 12 ([str]). Apply 2[poison]. If enemy has [poison]: +7 damage.`

#### t3-air-attack-attack — Galekick
- Old: `Deal 7 ×2 (scales STR). Slow 2.`
- Cost: `2[stam]`  Elements: `[air][attack][attack]`
- New: `Deal 7 twice to all enemies ([str]). Apply 2[slow].`

#### t3-attack-attack-earth — Concussive Smash
- Old: `Deal 14 (Scales STR). Stun 2 (Scales INT). Slow 3. Shatter: Deal 6.`
- Cost: `2[stam]`  Elements: `[attack][attack][earth]`
- New: `If enemy is [stun]: deal 6 more ([str]). Deal 14 ([str]). Apply 2[stun] ([int]) and 3[slow].`
- **Note:** Shatter checks BEFORE this card applies its own [stun].

#### t3-defense-defense-fire — Pyric Bulwark
- Old: `Armor 12 (scales VIT). Aura 14s: on Armor gained ≥ 4 → Burn 1 (scales INT).`
- Cost: `1[stam] 1[mana]`  Elements: `[defense][defense][fire]`
- New: `Gain 12[armor] ([vit]). For 14 seconds: every time you gain at least 4[armor], apply 1[burn] ([int]).`

#### t3-defense-defense-water — Stagnant Bulwark
- Old: `Armor 10 (scales VIT). Aura 12s: every 2s apply Poison 1 (scales INT).`
- Cost: `1[stam] 1[mana]`  Elements: `[defense][defense][water]`
- New: `Gain 10[armor] ([vit]). For 12 seconds: every 2 seconds apply 1[poison] ([int]).`

#### t3-air-defense-defense — Stormgate
- Old: `Armor 14 (scales VIT). Haste 15% (10s).`
- Cost: `2[stam]`  Elements: `[air][defense][defense]`
- New: `Gain 14[armor] ([vit]). Haste 15% for 10 seconds.`

#### t3-defense-defense-earth — Stoneward Reprisal
- Old: `Armor 8 (scales VIT). Brace: Stun 2.`
- Cost: `1[stam]`  Elements: `[defense][defense][earth]`
- New: `Gain 8[armor] ([vit]). Brace: apply 2[stun].`

### 7.5 Agility + cross trios

#### t3-agility-agility-fire — Twinflame Flicker
- Old: `Burn 3 (scales INT). Echo: re-apply Burn 2 after 1.5s.`
- Cost: `1[stam]`  Elements: `[agility][agility][fire]`
- New: `Apply 3[burn] ([int]). 1.5 seconds later: apply 2 more [burn] ([int]).`

#### t3-agility-agility-water — Slipstream
- Old: `6 Pierce (scales DEX). Poison 2. Haste 15% (6s).`
- Cost: `1[mana]`  Elements: `[agility][agility][water]`
- New: `Deal 6 Pierce ([dex]). Apply 2[poison]. Haste 15% for 6 seconds.`

#### t3-agility-agility-air — Zephyr Cascade
- Old: `Slow 3. Burn 2.`
- Cost: `1[mana]`  Elements: `[agility][agility][air]`
- New: `Apply 3[slow] to all enemies ([int]) and 2[burn].`

#### t3-agility-agility-earth — Footwork Stone
- Old: `Armor 12 (Scales DEX). Haste 25% (6s).`
- Cost: `1[stam]`  Elements: `[agility][agility][earth]`
- New: `Gain 12[armor] ([dex]). Haste 25% for 6 seconds.`

### 7.6 Counter + cross trios

#### t3-counter-counter-fire — Vengeful Pyre
- Old: `Exhaust. Devour 1 common: +12 Rage (scales STR). Burn 6 (scales INT).`
- Cost: `2[stam]  1[card-common]`  Elements: `[counter][counter][fire]`  · Exhaust
- New: `Exhaust. Permanently remove 1 common card from your deck this combat: gain 12[rage] ([str]) and apply 6[burn] ([int]).`

#### t3-counter-counter-water — Crimson Cascade
- Old: `Self Bleed 1. Cascade (Bleed) 15s: on Bleed-kill, apply Bleed 4 to nearest (Scales SPI).`
- Cost: `1[stam] 1[mana]`  Elements: `[counter][counter][water]`
- New: `Apply 1[bleed] to yourself. For 15 seconds: every time you kill an enemy that has [bleed], apply 4[bleed] to the nearest enemy ([spi]).`

#### t3-air-counter-counter — Wrath Squall
- Old: `On 30 Rage: deal 40 (scales STR) + Slow 8 (scales INT). Reset Rage.`
- Cost: `2[stam]  X[rage]` *(triggers and resets when [rage] reaches 30)*  Elements: `[air][counter][counter]`
- New: `When you reach 30[rage]: deal 40 ([str]) and apply 8[slow] ([int]). Consume all [rage].`

#### t3-counter-counter-earth — Stonewrath
- Old: `Armor 12 (scales VIT). Guard 50%: +6 Rage (15s).`
- Cost: `2[stam]`  Elements: `[counter][counter][earth]`
- New: `Gain 12[armor] ([vit]). For 15 seconds: if you have less then 50%[HP], gain 6[rage].`

### 7.7 Attack + defense + cross trios

#### t3-attack-defense-fire — Forge Strike
- Old: `Deal 12 (scales STR). Armor 8. Burn 2.`
- Cost: `2[stam]`  Elements: `[attack][defense][fire]`
- New: `Deal 12 ([str]). Gain 8[armor]. Apply 2[burn].`

#### t3-attack-defense-water — Mire Cleave
- Old: `Deal 10 (scales STR). Armor 8. Poison 2.`
- Cost: `1[stam] 1[mana]`  Elements: `[attack][defense][water]`
- New: `Deal 10 ([str]). Gain 8[armor]. Apply 2[poison].`

#### t3-air-attack-defense — Stormhilt
- Old: `Deal 8 ×2. Armor 6. Slow 2.`
- Cost: `2[stam]`  Elements: `[air][attack][defense]`
- New: `Deal 8 twice ([str]). Gain 6[armor]. Apply 2[slow].`

#### t3-attack-defense-earth — Earthcleaver
- Old: `Deal 14 (scales STR). Fortified 15: 8 Pierce.`
- Cost: `2[stam]`  Elements: `[attack][defense][earth]`
- New: `Deal 14 ([str]). If [armor] is at least 15: deal 8 more Pierce.`

#### t3-agility-attack-fire — Wickfencer
- Old: `Deal 6 ×2. Burn 2.`
- Cost: `2[stam]`  Elements: `[agility][attack][fire]`
- New: `Deal 6 twice ([str]). Apply 2[burn].`

#### t3-agility-attack-water — Drowner's Dart
- Old: `8 Pierce (scales DEX). Poison 2.`
- Cost: `1[stam] 1[mana]`  Elements: `[agility][attack][water]`
- New: `Deal 8 Pierce ([dex]). Apply 2[poison].`

#### t3-agility-air-attack — Skywire
- Old: `Deal 5 ×3 (scales DEX). Slow 2.`
- Cost: `2[stam]`  Elements: `[agility][air][attack]`
- New: `Deal 5 three times ([dex]). Apply 2[slow].`

#### t3-agility-attack-earth — Quarry Dance
- Old: `Deal 10 (scales DEX). Fortified 10: Deal 8.`
- Cost: `2[stam]`  Elements: `[agility][attack][earth]`
- New: `Deal 10 ([dex]). If [armor] is at least 10: deal 8 more.`

#### t3-attack-counter-fire — Wrath Brand
- Old: `Empowered (if Rage): +12 + 2 Burn. Consume(3) Rage.`
- Cost: `2[stam]  3[rage]`  Elements: `[attack][counter][fire]`
- New: `If you have [rage]: deal 12 twice ([str]) and apply 2[burn].`

#### t3-attack-counter-water — Necrotic Festering
- Old: `Self Bleed 3 (Scales DEX). Apply Poison equal to your Bleed (Scales INT). Consume all Bleed: 4 Pierce per stack (Scales STR).`
- Cost: `2[stam]  X[bleed]` *(your own [bleed])*  Elements: `[attack][counter][water]`
- New: `Apply 3[bleed] to yourself ([dex]). Apply 1[poison] per [bleed] on yourself ([int]). Then deal 4 Pierce per [bleed] consumed ([str]).`

#### t3-air-attack-counter — Thunderstrike Catalyst
- Old: `Deal 6 (scales STR). Consume 4 Slow: +6 Pierce per stack consumed (scales INT).`
- Cost: `2[stam]  4[slow]`  Elements: `[air][attack][counter]`
- New: `Deal 6 ([str]). Deal 6 Pierce per [slow] consumed ([int]).`

#### t3-attack-counter-earth — Granitewrath
- Old: `Deal 14 (scales STR). Vengeance: 10 Pierce.`
- Cost: `2[stam]`  Elements: `[attack][counter][earth]`
- New: `Deal 14 ([str]). Vengeance: deal 10 Pierce.`

#### t3-agility-defense-fire — Ember Vault
- Old: `Armor 10. Brace: Burn 2.`
- Cost: `1[stam] 1[mana]`  Elements: `[agility][defense][fire]`
- New: `Gain 10[armor]. Brace: apply 2[burn].`

#### t3-agility-defense-water — Tidefoot Guard
- Old: `Armor 12 (scales VIT). Poison 2 (scales INT). Haste 15% (6s).`
- Cost: `1[mana]`  Elements: `[agility][defense][water]`
- New: `Gain 12[armor] ([vit]). Apply 2[poison] ([int]). Haste 15% for 6 seconds.`

#### t3-agility-air-defense — Galeguard
- Old: `Armor 10. Haste 25% (8s).`
- Cost: `1[stam]`  Elements: `[agility][air][defense]`
- New: `Gain 10[armor]. Haste 25% for 8 seconds.`

#### t3-agility-defense-earth — Quickstone
- Old: `Armor 14. Guard 60%: Haste 30% (6s) (15s).`
- Cost: `1[stam] 1[mana]`  Elements: `[agility][defense][earth]`
- New: `Gain 14[armor]. For 15 seconds: if you have less then 60%[HP], gain Haste 30% for 6 seconds.`

#### t3-counter-defense-fire — Ashen Bulwark
- Old: `Armor 12 (scales VIT). Brace: Deal 12. Brace: Burn 2.`
- Cost: `2[stam]`  Elements: `[counter][defense][fire]`
- New: `Gain 12[armor] ([vit]). Brace: deal 12 and apply 2[burn].`

#### t3-counter-defense-water — Crimson Regen Mantle
- Old: `Armor 8 (scales VIT). Aura 12s: while HP<50%, heal 3/s (scales SPI). DR 20%.`
- Cost: `1[stam] 1[mana]`  Elements: `[counter][defense][water]`
- New: `Gain 8[armor] ([vit]). For 12 seconds: while you have less then 50%[HP], heal 3 every second ([spi]). Take 20% less damage.`

#### t3-air-counter-defense — Glacial Pact
- Old: `Slow 4 (scales INT). Armor 8 (scales VIT). Vengeance: Slow 3 + Haste 20% (5s).`
- Cost: `1[stam] 1[mana]`  Elements: `[air][counter][defense]`
- New: `Apply 4[slow] ([int]). Gain 8[armor] ([vit]). Vengeance: apply 3 more [slow] and Haste 20% for 5 seconds.`

#### t3-counter-defense-earth — Tombplate
- Old: `Armor 18 (scales VIT). Guard 40%: Armor 10 (15s). Guard 40%: +4 Rage (15s).`
- Cost: `2[stam]`  Elements: `[counter][defense][earth]`
- New: `Gain 18[armor] ([vit]). For 15 seconds: if you have less then 40%[HP], gain 10[armor] and 4[rage].`

#### t3-agility-counter-fire — Searing Razor
- Old: `Bleed 2 (scales DEX). Burn 2 (scales INT). Aura 10s: CD -10% per 25% missing HP.`
- Cost: `1[stam] 1[mana]`  Elements: `[agility][counter][fire]`
- New: `Apply 2[bleed] ([dex]) and 2[burn] ([int]). For 10 seconds: Haste 10% per 25% missing [HP].`

#### t3-agility-counter-water — Venom Dance
- Old: `Poison 3 (scales INT). Spread to 2 targets (50%). Vengeance: convert 5 Bleed→Poison.`
- Cost: `1[stam]`  Elements: `[agility][counter][water]`
- New: `Apply 3[poison] ([int]); for each 2[poison] applied, apply 1[poison] to up to 2 other enemies. Vengeance — cost 5[bleed]: apply 5[poison].`

#### t3-agility-air-counter — Static Skirmish
- Old: `Slow 3. Per Slow: 3 Pierce.`
- Cost: `1[stam] 1[mana]`  Elements: `[agility][air][counter]`
- New: `Apply 3[slow]. Deal 3 Pierce per [slow] on enemy ([dex]).`

#### t3-agility-counter-earth — Quickearth Rite
- Old: `Armor 8. Vengeance: 10 Pierce.`
- Cost: `1[stam] 1[mana]`  Elements: `[agility][counter][earth]`
- New: `Gain 8[armor]. Vengeance: deal 10 Pierce ([dex]).`

### 7.8 Detonators & big-payoff Tier-3 cards

#### t3-attack-fire-fire — Cinderlance
- Old: `Deal 8 ×2 (scales STR). Pyre: 3 Pierce.`
- Cost: `1[stam] 1[mana]  X[burn]`  Elements: `[attack][fire][fire]`
- New: `Deal 8 twice to all enemies ([str]). Deal 3 Pierce per [burn] consumed.`

#### t3-attack-water-water — Drowning Lance
- Old: `Consume all Poison: 3 Pierce per stack consumed (scales INT).`
- Cost: `2[stam] 1[mana]  X[poison]`  Elements: `[attack][water][water]`
- New: `Deal 3 Pierce per [poison] consumed ([int]).`

#### t3-air-air-attack — Tempest Pike
- Old: `Deal 6 ×3. Slow 2.`
- Cost: `2[stam]`  Elements: `[air][air][attack]`
- New: `Deal 6 three times to all enemies ([str]). Apply 2[slow].`

#### t3-attack-earth-earth — Mountain's Will
- Old: `Deal 20 (scales STR). Fortified 20: 8 Pierce.`
- Cost: `2[stam]`  Elements: `[attack][earth][earth]`
- New: `Deal 20 ([str]). If [armor] is at least 20: deal 8 more Pierce.`

#### t3-attack-fire-water — Tremor Detonate
- Old: `Exhaust. Deal 6 + 3× (Poison + Bleed + Burn) (scales STR). Consume all.`
- Cost: `3[stam]  X[poison] X[bleed] X[burn]`  Elements: `[attack][fire][water]`  · Exhaust
- New: `Exhaust. Deal 6 Pierce ([str]). Then deal 3 Pierce per [poison], [bleed], and [burn] consumed ([str]).`

#### t3-air-attack-fire — Galebrand
- Old: `Deal 8 (scales STR). Slow 3. Burn 2.`
- Cost: `1[stam] 1[mana]`  Elements: `[air][attack][fire]`
- New: `Deal 8 to all enemies ([str]). Apply 3[slow] and 2[burn].`

#### t3-attack-earth-fire — Slag Maul
- Old: `Deal 14 (scales STR). Brace: Deal 12. Brace: Burn 2.`
- Cost: `2[stam]`  Elements: `[attack][earth][fire]`
- New: `Deal 14 ([str]). Brace: deal 12 more and apply 2[burn].`

#### t3-air-attack-water — Galetide
- Old: `10 Pierce (scales STR). Poison 2. Slow 2.`
- Cost: `1[stam] 1[mana]`  Elements: `[air][attack][water]`
- New: `Deal 10 Pierce ([str]). Apply 2[poison] and 2[slow].`

#### t3-attack-earth-water — Mirebreaker
- Old: `Deal 14 (scales STR). Empowered (if Poison): +6 Pierce.`
- Cost: `1[stam] 1[mana]`  Elements: `[attack][earth][water]`
- New: `Deal 14 ([str]). If enemy has [poison]: deal 6 more Pierce.`

#### t3-air-attack-earth — Cliffwind Maul
- Old: `Deal 12 (scales STR). Fortified 12: 10 Pierce.`
- Cost: `2[stam]`  Elements: `[air][attack][earth]`
- New: `Deal 12 to all enemies ([str]). If [armor] is at least 12: deal 10 more Pierce.`

#### t3-defense-fire-fire — Citadel Inferno
- Old: `Exhaust. Spend ALL Armor: AoE Pierce = Armor × 2 (scales STR). Requires Armor ≥ 10.`
- Cost: `2[stam] 1[mana]  X[armor]`  Elements: `[defense][fire][fire]`  · Exhaust
- New: `Exhaust. Requires at least 10[armor]. Deal 2 Pierce per [armor] consumed to all enemies ([str]).`

#### t3-defense-water-water — Brineward
- Old: `Armor 14 (scales VIT). Heal 8 (scales SPI). Poison 2 (scales INT).`
- Cost: `2[mana]`  Elements: `[defense][water][water]`
- New: `Gain 14[armor] ([vit]). Heal 8 ([spi]). Apply 2[poison] ([int]).`

#### t3-air-air-defense — Galeward
- Old: `Armor 12 (scales VIT). Haste 20% (10s).`
- Cost: `1[stam] 1[mana]`  Elements: `[air][air][defense]`
- New: `Gain 12[armor] ([vit]). Haste 20% for 10 seconds.`

#### t3-defense-earth-earth — Bedrock Bulwark
- Old: `Armor 16 (scales VIT). Aura 15s: on Armor break → re-arm Armor 6 (scales VIT).`
- Cost: `2[stam]`  Elements: `[defense][earth][earth]`
- New: `Gain 16[armor] ([vit]). For 15 seconds: Brace — gain 6[armor] ([vit]).`

#### t3-defense-fire-water — Steam Bulwark
- Old: `Armor 14 (scales VIT). Brace: Poison 3. Brace: Burn 2.`
- Cost: `2[mana]`  Elements: `[defense][fire][water]`
- New: `Gain 14[armor] ([vit]). Brace: apply 3[poison] and 2[burn].`

#### t3-air-defense-fire — Ember Aegis Gust
- Old: `Convert all Burn → Armor (cap 20, scales VIT). Haste 15% (6s, scales INT).`
- Cost: `1[stam] 1[mana]  X[burn]`  Elements: `[air][defense][fire]`
- New: `Gain 1[armor] per [burn] consumed (max 20) ([vit]). Haste 15% for 6 seconds ([int]).`

#### t3-defense-earth-fire — Magmaplate
- Old: `Armor 16 (scales VIT). Brace: Deal 14. Brace: Burn 2.`
- Cost: `2[stam]`  Elements: `[defense][earth][fire]`
- New: `Gain 16[armor] ([vit]). Brace: deal 14 and apply 2[burn].`

#### t3-air-defense-water — Mistplate
- Old: `Armor 12. Poison 2. Slow 2.`
- Cost: `2[mana]`  Elements: `[air][defense][water]`
- New: `Gain 12[armor] ([vit]). Apply 2[poison] and 2[slow].`

#### t3-defense-earth-water — Bogplate
- Old: `Armor 14 (scales VIT). Vengeance: Poison 3.`
- Cost: `1[stam] 1[mana]`  Elements: `[defense][earth][water]`
- New: `Gain 14[armor] ([vit]). Vengeance: apply 3[poison].`

#### t3-air-defense-earth — Dustward
- Old: `Armor 16 (scales VIT). Haste 10% (12s). Brace: Slow 4.`
- Cost: `1[stam] 1[mana]`  Elements: `[air][defense][earth]`
- New: `Gain 16[armor] ([vit]). Haste 10% for 12 seconds. Brace: apply 4[slow].`

### 7.9 Misc agility-double trios

#### t3-agility-fire-fire — Cinder Sprint
- Old: `Burn 3. Pyre: 4.`
- Cost: `1[mana]  X[burn]`  Elements: `[agility][fire][fire]`
- New: `Apply 3[burn] to all enemies. Deal 4 per [burn] consumed ([dex]).`

#### t3-agility-water-water — Slipvenom Tempo
- Old: `Poison 3 (scales INT). Haste 15% (6s). Echo if Poison ≥ 10.`
- Cost: `1[stam] 1[mana]`  Elements: `[agility][water][water]`
- New: `Apply 3[poison] ([int]). Haste 15% for 6 seconds. If enemy has at least 10[poison]: apply 3 more [poison] ([int]).`

#### t3-agility-air-air — Gale Echo
- Old: `Aura 12s: Slow effects apply +1 extra (scales INT). Haste 15% (6s).`
- Cost: `1[stam] 1[mana]`  Elements: `[agility][air][air]`
- New: `For 12 seconds: every time you apply [slow], apply 1 more ([int]). Haste 15% for 6 seconds.`

#### t3-agility-earth-earth — Stonepacer
- Old: `Armor 10. Haste 20% (8s).`
- Cost: `1[stam]`  Elements: `[agility][earth][earth]`
- New: `Gain 10[armor] ([vit]). Haste 20% for 8 seconds.`

#### t3-agility-fire-water — Boilstep
- Old: `6 Pierce (scales DEX). Burn 2. Poison 2.`
- Cost: `1[mana]`  Elements: `[agility][fire][water]`
- New: `Deal 6 Pierce ([dex]). Apply 2[burn] and 2[poison].`

#### t3-agility-air-fire — Galecinder
- Old: `Deal 5 ×2. Burn 2. Slow 2.`
- Cost: `1[stam] 1[mana]`  Elements: `[agility][air][fire]`
- New: `Deal 5 twice to all enemies ([dex]). Apply 2[burn] and 2[slow].`

#### t3-agility-earth-fire — Cinderquake
- Old: `Deal 10 (scales DEX). Fortified 10: 4 Pierce + Burn 2.`
- Cost: `1[mana]`  Elements: `[agility][earth][fire]`
- New: `Deal 10 ([dex]). If [armor] is at least 10: deal 4 more Pierce and apply 2[burn].`

#### t3-agility-air-water — Stormsplash
- Old: `Poison 2. Slow 3. Burn 2.`
- Cost: `1[mana]`  Elements: `[agility][air][water]`
- New: `Apply 2[poison] ([int]), 3[slow], and 2[burn].`

#### t3-agility-earth-water — Mireglide
- Old: `Armor 8. Poison 3. Haste 15% (6s).`
- Cost: `1[mana]`  Elements: `[agility][earth][water]`
- New: `Gain 8[armor]. Apply 3[poison]. Haste 15% for 6 seconds.`

#### t3-agility-air-earth — Stormstone Tempo
- Old: `Channel: Deal 6 (scales DEX, +25%/s held, max +100%). Shatter: 6 Pierce (scales STR).`
- Cost: `2[stam]`  Elements: `[agility][air][earth]`
- New: `If enemy is [stun]: deal 6 Pierce ([str]). Hold to charge: deal 6, +25% per second held (max +100%) ([dex]).`

### 7.10 Counter-double + final trios

#### t3-counter-fire-fire — Brine Crucible
- Old: `Bleed 2 (Scales DEX). Convert all Burn → Bleed (1:2, Scales DEX). Overload: +3s next CD.`
- Cost: `1[stam] 1[mana]  X[burn]`  Elements: `[counter][fire][fire]`
- New: `Apply 2[bleed] per [burn] consumed ([dex]), plus 2 more [bleed] ([dex]). Next card delays 3 more seconds.`

#### t3-counter-water-water — Tidefoot Bloom
- Old: `Convert all Poison → Bleed 1:1 (scales DEX). Echo 1 (6s, scales INT).`
- Cost: `1[stam] 1[mana]  X[poison]`  Elements: `[counter][water][water]`
- New: `Apply 1[bleed] per [poison] consumed ([dex]). For 6 seconds: the next card triggers twice ([int]).`

#### t3-air-air-counter — Stormrage
- Old: `Empowered (if Rage): +8 Slow. Consume(4) Rage.`
- Cost: `1[stam] 1[mana]  4[rage]`  Elements: `[air][air][counter]`
- New: `If you have [rage]: apply 8[slow] ([int]).`

#### t3-counter-earth-earth — Tombrage
- Old: `Armor 12 (scales VIT). Guard 40%: +8 Rage (15s).`
- Cost: `2[stam]`  Elements: `[counter][earth][earth]`
- New: `Gain 12[armor] ([vit]). For 15 seconds: if you have less then 40%[HP], gain 8[rage].`

#### t3-counter-fire-water — Venom Detonation
- Old: `Burn 2. Poison 3. Pyre: 2.`
- Cost: `1[stam] 1[mana]  X[burn]`  Elements: `[counter][fire][water]`
- New: `Apply 2[burn] and 3[poison]. Deal 2 per [burn] consumed ([str]).`

#### t3-air-counter-fire — Static Bleed
- Old: `Self Bleed 2. Brace: Slow 4.`
- Cost: `1[stam] 1[mana]`  Elements: `[air][counter][fire]`
- New: `Apply 2[bleed] to yourself ([dex]). Brace: apply 4[slow].`

#### t3-counter-earth-fire — Magmavow
- Old: `Armor 10 (scales VIT). Brace: 16 Pierce. Brace: Burn 2.`
- Cost: `2[stam]`  Elements: `[counter][earth][fire]`
- New: `Gain 10[armor] ([vit]). Brace: deal 16 Pierce and apply 2[burn].`

#### t3-air-counter-water — Tempestbleed
- Old: `Self Bleed 2. Brace: Deal 6. Brace: Slow 2.`
- Cost: `1[stam] 1[mana]`  Elements: `[air][counter][water]`
- New: `Apply 2[bleed] to yourself ([dex]). Brace: deal 6 and apply 2[slow].`

#### t3-counter-earth-water — Bogwrath
- Old: `Armor 10 (scales VIT). Brace: Poison 4. Brace: +3 Rage.`
- Cost: `1[stam] 1[mana]`  Elements: `[counter][earth][water]`
- New: `Gain 10[armor] ([vit]). Brace: apply 4[poison] and gain 3[rage].`

#### t3-air-counter-earth — Tectonic Reckoning
- Old: `Exhaust. Stun 3 AoE (scales INT). Force-trigger every card you own once.`
- Cost: `3[stam] 2[mana]`  Elements: `[air][counter][earth]`  · Exhaust
- New: `Exhaust. Apply 3[stun] to all enemies ([int]). Trigger every card you own once.`

---

## 8. Summary of changes

- **164 cards** rewritten under the new convention.
- **Keywords kept**: Brace, Vengeance, Haste, Exhaust (4 total, was ~35).
- **Cost section icons**: stamina, mana, every stack (consumable), armor, deck-card (for Devour).
- **Dropped from glossary**: Empowered, Guard, Fortified, Shatter, Berserk, Stance, Catalyze, Cascade, DR, Channel (charge), Devour (keyword), Force-trigger, Spread, Overload, Vulnerable, Aura, On Hit, Reflex, Juggernaut, Rupture, Bloodforge, Frost Echo, Strip, Expose, Mitigate, Empower, Weakened, Steady, Threshold, Echo, Convert, Pyre, Per Stack, Reforce, Drain, Pierce-as-keyword (still used as plain word).
- **Dead code to remove**: Drain rendering branch in `CardText.ts`.
- **Cards flagged** for separate review: Wrathshell Vow (channel-delay aura), Tectonic Reckoning (force-trigger), Wrath Squall (rage-threshold detonator), Twinflame/Slipvenom/Tidefoot (three different Echo mechanics), Magma Welling (drop "Slow cooldown" flavour), Shield Bash (uses Defense as a cost — verify intent).
- **Per-card refactor map** above gives the exact NEW body and cost for every card.

---

## 9. Implementation steps (not done yet — proposal only)

1. **Define icons** in `src/ui/icons.ts` (or wherever sprites live). Sprite per token in §1.2.
2. **Update CardVisual.ts**: replace color-dot row with element-icon row; render cost block from `card.cost` + a new "consume" field; drop rarity label or move it.
3. **Update CardText.ts** to produce the new body strings. Most existing fragment logic survives; the prefix renderer becomes prose ("for N seconds:", "if [armor] is at least N", etc.) and consume-prefixes vanish (they live in cost block now).
4. **Add `consume` field to CardDefinition** (or derive it from existing `consume_stack` effects + `spend_armor`) so the cost block can render without re-walking effects.
5. **Strip dead Drain branch** in `CardText.ts`.
6. **Regenerate `cards.json` descriptions** from the formatter (the JSON `description` field can stay as a back-up but UI reads the formatter).
7. **Update KeywordDefinitions.ts** to only ship Brace / Vengeance / Haste / Exhaust glossary entries.
8. **Test pass** on every tier — visual spot-check that cost block fits, body wraps cleanly at 12-13px font.

---

## 11. Final decision map (locked, single source of truth)

This section supersedes §8 and §9 wherever they conflict. Use this as the canonical reference.

### 11.A Layout

**Standard face**: cooldown top-left · element icons top-middle · cost block top-right · art center · name + **visual summary** at bottom.

**Extended view** (detail popup): standard face on the left · **full prose description** on the right · cooldown / targeting / stat rows below the prose.

### 11.B Cost block syntax

- One entry per resource: `quantity[icon]`. Examples: `2[stam]`, `1[mana]`, `3[burn]`, `4[poison]`.
- `X[icon]` = "all of that resource".
- Exhaust shown as a separate `[exhaust]` badge in the cost block.
- Entries stack vertically; multiple stack-consumptions allowed.

### 11.C Prose conventions (extended view body)

- **No comparison operators**: write "more then 50%[HP]", "less then 50%[HP]", "at least 10[armor]".
- **No "Aura Ns:"** → "for N seconds:".
- **No "(scales STR)"** → trailing `([str])`. Drop the word "scales".
- **Aura trigger names → prose** (every time you hit / every time you take damage / every time you kill an enemy with [icon] / every time you gain at least N[armor] / every time you lose [HP] / every time you apply [slow] / when you reach N[icon] / when enemy has at least N[icon]).
- **Conditional gates inline** — no Empowered / Guard / Fortified / Shatter / Berserk keywords; write the condition as prose.
- **Stack & stat refs always icons** in body text.

### 11.D Visual summary grammar

- 2–4 tokens separated by ` · ` (middle dot + spaces).
- Color-coded numbers (damage red, burn orange, heal green, armor blue, etc. — full palette in §1.5).
- Tokens: `N` (damage) · `N!` (Pierce) · `N×M` (multi-hit) · `N([stack])` (damage per stack) · `+N[stack]` (apply stack) · `+N[HP]` (heal) · `+N[armor]` (gain armor) · `Haste N%` · `if X: …` · `Brace: …` · `Vengeance: …` · `Self -N[HP]` · `+N[stack] per ([source])` (per-stack stack-application) · `next card +Ns` (cd_debt tax).
- **SCALER PLACEMENT RULE**: a stat scaler `([str])`/`([vit])`/`([dex])`/`([int])`/`([spi])` ALWAYS sits immediately next to the number it scales. Examples: `5[armor]([vit])`, `1([str]) damage per 6[armor]`, `6 3([dex]) times`, `5[stun]([int])`.
- Self-cost appears as a token only when it's the card's whole point (Static Bleed, Necrotic Festering).

### 11.E Kept keywords (glossary-linked)

**Brace · Vengeance · Haste · Exhaust** (4 total). Brace's `ttl_ms` window is omitted in prose (assumed combat-long).

### 11.F Dropped keywords (now prose only)

Empowered, Guard, Fortified, Shatter, Echo, Stance, Cascade, Catalyze, DR, **Channel (both charge AND delay)**, **Reflex**, Berserk, Devour, Force-trigger, Spread, Overload, Vulnerable, Aura, On Hit, Juggernaut, Rupture, Bloodforge, Frost Echo, Strip, Expose, Mitigate, Empower (aura), Weakened, Steady, Threshold, Per Stack, Reforce, Drain, Convert, Pyre, Spend Armor.

### 11.G Cost-section consumption mapping

| Old keyword | New rendering |
|---|---|
| `Consume(N) Stack` | `N[stack]` in cost block |
| `Consume all Stack` | `X[stack]` in cost block |
| `Pyre` | `X[burn]` in cost block (engine bug: ADD `consume_stack: true` to Cinderlance, Cinder Sprint, Venom Detonation in JSON) |
| `Spend Armor` | `X[armor]` in cost block |
| `Convert from → to` | `N[from]` in cost block; body shows the `to` output |
| `Devour` | mechanic abandoned; only Vengeful Pyre used it, now reworked |

### 11.H Seven card rewrites (locked from clarification rounds)

| Card | Cost block | Body | Visual |
|---|---|---|---|
| **Wrathshell Vow** (t3-counter-counter-defense) | `2[stam] [exhaust]` | `Exhaust. Gain 6([str])[rage]. For 15 seconds: every 2 seconds, gain 1[rage].` | `+6[rage] · (15s) +1[rage]/2s` |
| **Stormstone Tempo** (t3-agility-air-earth) | `2[stam]` | `Deal 6 3([dex]) times. Apply 1[slow] per hit. If enemy is [stun]: each hit deals 4([str]) more Pierce.` | `6 3([dex])× · +1[slow]/hit · if [stun]: 4!/hit` |
| **Forge Spike Ward** (t2-defense-fire) | `1[stam]` | `Gain 5[armor]([vit]). Deal 1([str]) damage per 6[armor] you have.` | `+5[armor] · 1([str])/6[armor]` |
| **Tectonic Reckoning** (t3-air-counter-earth) | `3[stam] 2[mana] [exhaust]` | `Exhaust. Apply 5[stun]([int]) AoE. Deal 50([str]) Pierce AoE.` | `+5[stun] AoE · 50! AoE` |
| **Twinflame Flicker** (t3-agility-agility-fire) | `1[stam]` | `Apply 4[burn] 3([int]) times.` | `+4[burn] 3([int])×` |
| **Vengeful Pyre** (t3-counter-counter-fire) | `2[stam] [exhaust]` | `Exhaust. Exhaust the next card in order. +12[rage]([str]). +6[burn]([int]).` | `+12[rage]([str]) · +6[burn]([int]) · exhaust next card` |
| **Shield Bash** (t2-attack-defense) | `1[stam]`, cooldown 2s | `Deal damage equal to your [armor].` | `dmg = [armor]` |

### 11.I JSON bugs / design drifts (catalog for engine work — not blocking the audit rewrite)

1. **t2-attack-water Crimson Tithe** — self-damage 5 is not `pierce_armor: true`; armor may absorb it and break the on-self-damage rage trigger.
2. **t2-earth-earth Tremor Lock**, **t2-air-earth Bedrock Snare** — JSON applies own stun BEFORE the Shatter-gated effect; the card always shatters itself. Either reorder JSON or accept that "shatter checks AFTER own stun".
3. **t3-agility-attack-counter Vein Splitter** — JSON has `enemy_has_stack: bleed` *without* `per_stack: true`; the bonus is flat +1 if any bleed, not "+1 per bleed". Old design intent drifted.
4. **t3-agility-counter-fire Searing Razor** — JSON has flat 10% Haste for 10s; old prose claimed "Haste 10% per 25% missing HP". Engine lost the dynamic scaling.
5. **t3-air-defense-fire Ember Aegis Gust** — JSON Haste aura has no scale; old prose claimed "scales INT".
6. **t3-air-counter-counter Wrath Squall** — 8s internal `cooldown_ms` on the threshold trigger not surfaced in prose.
7. **t3-attack-counter-fire Wrath Brand** — rage consume isn't gated on having rage; pays even at 0.
8. **t3-agility-earth-earth Stonepacer** — card `targeting: "aoe"` but all effects are self; likely JSON typo.
9. **t2-agility-water Mist Step**, **t3-air-defense-water Mistplate**, **t3-agility-air-water Stormsplash** — card `targeting: "self"` but two/three effects target enemy.
10. **t2-counter-defense Iron Reckoning** — stance hit_bonus aura has no STR scaling in JSON; old prose adds `([str])`. Treat as flat.
11. **t3-counter-counter-defense Wrathshell Vow** — JSON has `channel_ms: 4000` on both auras. Channel mechanic is dropped entirely (§11.F); merge the 4-second warm-up into the card's cooldown (6s → 10s) and remove `channel_ms` from both auras. No card uses Channel after the rewrites.
12. **t2-air-attack Stormstrike** — JSON has `targeting: "aoe"`; card should be single-target damage + haste only. Change to `targeting: "single"`.
13. **t3-air-fire-fire Pyre Surge** — JSON modifier is `burn_taken: 3` (per-stack-application boost). Body now reads "double [fire] damage on enemy"; engine must implement an aura that doubles all fire damage dealt to the enemy for 8 seconds (or re-tune `burn_taken` semantics to mean damage multiplier).

### 11.J Prose corrections from first pre-review (queued for application)

- **T1 starters** (Jab/Quickstep/Spark/Mend/Quake): drop stat tags I over-eagerly added — JSON has no scaling.
- **Bulwark Salvo, Body Slam Vow**: scale source is `armor`; re-tag as "per X[armor]" with no stat suffix. Body Slam Vow formula is "2 base + 1 per [armor]", not "2 per armor".
- **Brine Bedrock**: heal target is self — drop "to all allies".
- **Marsh Squall**: rephrase spread as "50% of poison spreads to up to 4 enemies" (snapshot ratio).
- **Cinder Squall**: stun target is `aoe`; clarify "every enemy with at least 5[slow] is stunned".
- **Stoneward Reprisal, Ember Vault, Galeguard, Quickstone, Mireglide**: add missing `([vit])` to armor.
- **Ember Aegis Gust**: drop bogus `([int])` from Haste line (no scale in JSON).
- **Wrath Squall**: add "no more than once every 8 seconds" to prose.
- **Sandfury**: keep `([str])` only on the first hit (second is unscaled).
- **Vein Splitter**: rewrite "per existing bleed" → "if enemy has [bleed]" (matches JSON, even if design drifted).
- **Searing Razor**: rewrite Haste as flat "Haste 10% for 10 seconds" (matches JSON).
- **Iron Reckoning**: drop `([str])` from stance bonus.

---

## 12. Final card entries (canonical — supersedes §4–§7)

This is the canonical card list after both pre-review rounds, all rewrites (§11.H), all JSON-drift acknowledgements (§11.I), and all prose corrections (§11.J). Each card entry follows the same format:

```
#### tX-id — Name
- Cost: `Q[icon] …`  ·  Elements: `[e][e]…`
- Visual: `<standard-face visual summary>`
- Body: <extended-view prose>
```

Scalers are glued directly to the number they scale. Cost block lists every consumed resource. Visual uses ` · ` (middle-dot) separators. Body uses no comparison operators (`<`/`>`/`≥`) and no banned keywords.

### 12.1 Tier 1 — starter cards (8)

#### t1-attack — Jab
- Cost: `1[stam]`  ·  Elements: `[attack]`
- Visual: `9`
- Body: Deal 9.

#### t1-defense — Guard
- Cost: `1[stam]`  ·  Elements: `[defense]`
- Visual: `+12[armor]`
- Body: Gain 12[armor].

#### t1-agility — Quickstep
- Cost: `1[stam]`  ·  Elements: `[agility]`
- Visual: `4 · 4`
- Body: Deal 4 twice.

#### t1-counter — Riposte
- Cost: `1[stam]`  ·  Elements: `[counter]`
- Visual: `(6s) on hit: 3`
- Body: For 6 seconds: every time you hit an enemy, deal 3.

#### t1-fire — Spark
- Cost: `1[mana]`  ·  Elements: `[fire]`
- Visual: `+3[burn]`
- Body: Apply 3[burn].

#### t1-water — Mend
- Cost: `1[mana]`  ·  Elements: `[water]`
- Visual: `+6[HP]`
- Body: Heal 6.

#### t1-air — Gust
- Cost: *(none)*  ·  Elements: `[air]`
- Visual: `Haste 20% (5s)`
- Body: Haste 20% for 5 seconds.

#### t1-earth — Quake
- Cost: `1[mana]`  ·  Elements: `[earth]`
- Visual: `+4[slow]`
- Body: Apply 4[slow].

### 12.2 Tier 2 — mirror pairs (8)

#### t2-attack-attack — Reckless Strike
- Cost: `1[stam]`  ·  Elements: `[attack][attack]`
- Visual: `9([str]) · +2[rage]`
- Body: Deal 9([str]). Gain 2[rage]. Apply 1[bleed] to yourself.

#### t2-defense-defense — Bulwark Vow
- Cost: `1[stam]`  ·  Elements: `[defense][defense]`
- Visual: `+7[armor]([vit]) · Brace: +3[rage]`
- Body: Gain 7[armor]([vit]). Brace: gain 3[rage].

#### t2-agility-agility — Flurry Step
- Cost: `1[stam]`  ·  Elements: `[agility][agility]`
- Visual: `4 · 4([dex])`
- Body: Deal 4. Deal 4([dex]).

#### t2-counter-counter — Razor Stance
- Cost: `1[stam]`  ·  Elements: `[counter][counter]`
- Visual: `(10s) on hit: +1[bleed]([dex]) · Vengeance: +1[bleed]`
- Body: For 10 seconds: every time you hit an enemy, apply 1[bleed]([dex]). Vengeance — for 4 more seconds, that bleed becomes 2.

#### t2-fire-fire — Pyre
- Cost: `X[burn]`  ·  Elements: `[fire][fire]`
- Visual: `4([str]) · 3([burn]) · +3[burn]`
- Body: Deal 4([str]). Deal 3 per [burn] consumed. Apply 3[burn].

#### t2-water-water — Frostbind
- Cost: `1[mana]`  ·  Elements: `[water][water]`
- Visual: `+1[stun]([int]) · +4[armor]([vit]) · Vengeance: +1[stun]`
- Body: Apply 1[stun]([int]). Gain 4[armor]([vit]). Vengeance: apply 1 more [stun]([int]).

#### t2-air-air — Tailwind
- Cost: *(none)*  ·  Elements: `[air][air]`
- Visual: `4([str]) · Haste 20% · +1[mana]`
- Body: Deal 4([str]). Haste 20% for 5 seconds. Gain 1[mana].

#### t2-earth-earth — Tremor Lock
- Cost: `1[mana]`  ·  Elements: `[earth][earth]`
- Visual: `+1[stun]([int]) · +4[slow]([int]) · if [stun]: 5([int])`
- Body: If enemy is [stun]: deal 5([int]). Then apply 1[stun]([int]) and 4[slow]([int]).

### 12.3 Tier 2 — cross-element pairs (28)

#### t2-agility-attack — Quickstrike
- Cost: `1[stam]`  ·  Elements: `[agility][attack]`
- Visual: `8([dex])`
- Body: Deal 8([dex]).

#### t2-agility-counter — Sidestep & Slash
- Cost: *(none)*  ·  Elements: `[agility][counter]`
- Visual: `5([dex]) · +2[bleed] · Vengeance: +3`
- Body: Deal 5([dex]). Apply 2[bleed]. Gain 1[stam]. Vengeance: deal 3 more.

#### t2-agility-defense — Parrying Stance
- Cost: *(none)*  ·  Elements: `[agility][defense]`
- Visual: `+5[armor]([dex]) · Brace: 4`
- Body: Gain 5[armor]([dex]). Gain 1[stam]. Brace: deal 4.

#### t2-agility-fire — Flame Dart
- Cost: *(none)*  ·  Elements: `[agility][fire]`
- Visual: `5([dex]) · +2[burn]`
- Body: Deal 5([dex]) to a random enemy. Apply 2[burn].

#### t2-agility-water — Mist Step
- Cost: *(none)*  ·  Elements: `[agility][water]`
- Visual: `+3[HP]([spi]) · +1[slow] · (6s) +1[dex]`
- Body: Heal 3([spi]). Gain 1[stam]. For 6 seconds: +1[dex]. Apply 1[slow].

#### t2-agility-air — Gale Cut
- Cost: *(none)*  ·  Elements: `[agility][air]`
- Visual: `3([dex]) · Haste 15%`
- Body: Deal 3([dex]). Haste 15% for 4 seconds. Gain 1[stam].

#### t2-agility-earth — Tremor Dash
- Cost: `1[stam]`  ·  Elements: `[agility][earth]`
- Visual: `7([dex]) · +6[armor]([vit])`
- Body: Deal 7([dex]). Gain 6[armor]([vit]).

#### t2-attack-counter — Bloodprice Strike
- Cost: `1[stam]`  ·  Elements: `[attack][counter]`
- Visual: `Self -4[HP]! · 12([str]) · +2[rage]([str])`
- Body: Lose 4[HP] (Pierce). Deal 12([str]). Gain 2[rage]([str]). Gain 1[stam].

#### t2-attack-defense — Shield Bash
- Cost: `1[stam]`  ·  Elements: `[attack][defense]`  ·  Cooldown 2s
- Visual: `dmg = [armor]`
- Body: Deal damage equal to your [armor].

#### t2-attack-fire — Kindle Strike
- Cost: `1[stam]`  ·  Elements: `[attack][fire]`
- Visual: `7([str]) · +3[burn]([int]) · (5s) +1 per [burn]`
- Body: Deal 7([str]). Apply 3[burn]([int]). For 5 seconds: every [burn] applied to enemy gains +1.

#### t2-attack-water — Crimson Tithe
- Cost: *(none)*  ·  Elements: `[attack][water]`
- Visual: `Self -5[HP] · +1[stam] · +1[mana] · (6s) lose [HP]: +1[rage]`
- Body: Lose 5[HP]. Gain 1[stam] and 1[mana]([spi]). For 6 seconds: every time you lose [HP], gain 1[rage].

#### t2-air-attack — Stormstrike
- Cost: *(none)*  ·  Elements: `[air][attack]`
- Visual: `6([str]) · Haste 20%`
- Body: Deal 6([str]). Haste 20% for 5 seconds.

#### t2-attack-earth — Granite Lunge
- Cost: `1[stam]`  ·  Elements: `[attack][earth]`
- Visual: `+6[armor]([vit]) · 4 +1([str])/4[armor]`
- Body: Gain 6[armor]([vit]). Deal 4, +1([str]) damage per 4[armor] you have.

#### t2-counter-defense — Iron Reckoning
- Cost: `1[stam]`  ·  Elements: `[counter][defense]`
- Visual: `+4[armor]([vit]) · (8s) +1/[rage] per hit`
- Body: Gain 4[armor]([vit]). For 8 seconds: every attack deals 1 more damage per [rage].

#### t2-counter-fire — Cinderscar
- Cost: `1[stam]`  ·  Elements: `[counter][fire]`
- Visual: `+2[burn]([int]) · Vengeance: +1[bleed] per [burn]`
- Body: Apply 2[burn]([int]). Vengeance: apply 1[bleed] for each [burn] on enemy.

#### t2-counter-water — Bloodtide Mend
- Cost: *(none)*  ·  Elements: `[counter][water]`
- Visual: `+5[HP]([spi]) · Self +2[bleed] · Vengeance: +3[HP]`
- Body: Heal 5([spi]). Apply 2[bleed] to yourself. Vengeance: heal 3 more.

#### t2-air-counter — Hollow Echo
- Cost: *(none)*  ·  Elements: `[air][counter]`
- Visual: `5([str]) · Haste 15% · Vengeance: +3`
- Body: Deal 5([str]). Haste 15% for 4 seconds. Vengeance: deal 3 more.

#### t2-counter-earth — Thornwall
- Cost: `1[stam]`  ·  Elements: `[counter][earth]`
- Visual: `+8[armor]([vit]) · 5 · Brace: 6`
- Body: Gain 8[armor]([vit]). Deal 5. Brace: deal 6.

#### t2-defense-fire — Forge Spike Ward (rewrite, §11.H)
- Cost: `1[stam]`  ·  Elements: `[defense][fire]`
- Visual: `+5[armor]([vit]) · 1([str])/6[armor]`
- Body: Gain 5[armor]([vit]). Deal 1([str]) damage per 6[armor] you have.

#### t2-defense-water — Vow of the Tide
- Cost: `1[mana]`  ·  Elements: `[defense][water]`
- Visual: `+5[armor]([vit]) · +3[HP] · (6s) +1[spi]`
- Body: Gain 5[armor]([vit]). Heal 3. Gain 1[stam]. For 6 seconds: +1[spi].

#### t2-air-defense — Cyclone Ward
- Cost: *(none)*  ·  Elements: `[air][defense]`
- Visual: `+5[armor]([vit]) · Haste 15%`
- Body: Gain 5[armor]([vit]). Haste 15% for 4 seconds.

#### t2-defense-earth — Bramble Bulwark
- Cost: `1[stam]`  ·  Elements: `[defense][earth]`
- Visual: `+8[armor]([vit]) · if [armor]≥10: 6!`
- Body: Gain 8[armor]([vit]). If [armor] is at least 10: deal 6 Pierce.

#### t2-fire-water — Steam Surge
- Cost: `1[mana]`  ·  Elements: `[fire][water]`
- Visual: `4([str]) · if [burn]: +4 · +4[HP]`
- Body: Deal 4([str]). If enemy has [burn]: +4 damage. Heal 4. Gain 1[stam].

#### t2-air-fire — Firestorm
- Cost: `1[mana]`  ·  Elements: `[air][fire]`
- Visual: `4([str]) AoE · +2[burn] · +1[stun]([int])`
- Body: Deal 4([str]) to all enemies. Apply 2[burn] and 1[stun]([int]).

#### t2-earth-fire — Magma Vein
- Cost: `2[mana]`  ·  Elements: `[earth][fire]`
- Visual: `+7[armor] · 8([str]) · +2[burn]`
- Body: Gain 7[armor]. Deal 8([str]). Apply 2[burn].

#### t2-air-water — Misting Veil
- Cost: *(none)*  ·  Elements: `[air][water]`
- Visual: `+3[HP]([spi]) · Haste 15% · (6s) +1[int]`
- Body: Heal 3([spi]). Haste 15% for 5 seconds. For 6 seconds: +1[int]. Gain 1[mana].

#### t2-earth-water — Mire Bloom
- Cost: *(none)*  ·  Elements: `[earth][water]`
- Visual: `+4[armor]([vit]) · +3[HP]([spi]) · 3([str])`
- Body: Gain 4[armor]([vit]). Heal 3([spi]). Deal 3([str]). Gain 1[mana].

#### t2-air-earth — Bedrock Snare
- Cost: `1[mana]`  ·  Elements: `[air][earth]`
- Visual: `+2[slow]([int]) · if 4[slow]: +1[stun]([int]) · if [stun]: 4([str])`
- Body: If enemy is [stun]: deal 4([str]). If enemy has at least 4[slow]: apply 1[stun]([int]). Apply 2[slow]([int]).

### 12.4 Tier 3 — same-element trios (8)

#### t3-attack-attack-attack — Berserker's Ledger
- Cost: `2[stam]`  ·  Elements: `[attack][attack][attack]`
- Visual: `8([str])×3 · Self -2[bleed]`
- Body: Deal 8([str]) three times. Apply 2[bleed] to yourself.

#### t3-defense-defense-defense — Aegis of Returning Wrath
- Cost: `2[stam]`  ·  Elements: `[defense][defense][defense]`
- Visual: `+22[armor]([vit]) · Brace: 18!`
- Body: Gain 22[armor]([vit]). Brace: deal 18 Pierce.

#### t3-agility-agility-agility — Quickstep Sigil
- Cost: `1[stam]`  ·  Elements: `[agility][agility][agility]`
- Visual: `5([dex])×3 · Haste 30%`
- Body: Deal 5([dex]) three times. Haste 30% for 6 seconds.

#### t3-counter-counter-counter — Crimson Spiral
- Cost: `2[stam]  X[rage]`  ·  Elements: `[counter][counter][counter]`
- Visual: `2!([str]) per [rage] · +1[bleed]([dex]) per [rage]`
- Body: Deal 2([str]) Pierce per [rage] consumed. Apply 1[bleed]([dex]) per [rage] consumed.

#### t3-fire-fire-fire — Supernova
- Cost: `2[stam] 1[mana]  X[burn]  [exhaust]`  ·  Elements: `[fire][fire][fire]`
- Visual: `5!([int]) per [burn] AoE`
- Body: Exhaust. Deal 5([int]) Pierce per [burn] consumed to all enemies.

#### t3-water-water-water — Tidesong Aura
- Cost: `2[mana]`  ·  Elements: `[water][water][water]`
- Visual: `+12[HP]([spi]) · +3[mana] · (10s) +3[spi]`
- Body: Heal 12([spi]). For 10 seconds: +3[spi]. Gain 3[mana].

#### t3-air-air-air — Tempest Cadence
- Cost: `2[mana]`  ·  Elements: `[air][air][air]`
- Visual: `8([dex]) AoE · Haste 30%`
- Body: Deal 8([dex]) to all enemies. Haste 30% for 10 seconds.

#### t3-earth-earth-earth — Mountain's Answer
- Cost: `2[stam]`  ·  Elements: `[earth][earth][earth]`
- Visual: `+26[armor]([vit]) · if [armor]≥20: 22! AoE`
- Body: Gain 26[armor]([vit]). If [armor] is at least 20: deal 22 Pierce to all enemies.

### 12.5 Tier 3 — two-of-A + one-of-B (16)

#### t3-attack-attack-defense — Bulwark Salvo
- Cost: `2[stam]`  ·  Elements: `[attack][attack][defense]`
- Visual: `6×2 · +1/2[armor]`
- Body: Deal 6 twice, +1 damage per 2[armor] you have. Armor is not consumed.

#### t3-agility-attack-attack — Triple Slash
- Cost: `2[stam]`  ·  Elements: `[agility][attack][attack]`
- Visual: `6([dex])×3 AoE`
- Body: Deal 6([dex]) three times to all enemies.

#### t3-attack-attack-counter — Bloodlash Salvo
- Cost: `2[stam]`  ·  Elements: `[attack][attack][counter]`
- Visual: `3!([str]) per [bleed] · Vengeance: +2!([str]) per [bleed]`
- Body: Deal 3([str]) Pierce per [bleed] on enemy. Vengeance: +2([str]) Pierce per [bleed]. Bleed is not consumed.

#### t3-attack-defense-defense — Body Slam Vow
- Cost: `2[stam]`  ·  Elements: `[attack][defense][defense]`
- Visual: `2! +1!/[armor] · +6[armor]`
- Body: Deal 2 Pierce + 1 Pierce per [armor] you have. Gain 6[armor].

#### t3-agility-defense-defense — Phalanx Drift
- Cost: `1[stam]`  ·  Elements: `[agility][defense][defense]`
- Visual: `+22[armor]([vit]) · Haste 10% · Brace: 10`
- Body: Gain 22[armor]([vit]). Haste 10% for 8 seconds. Brace: deal 10.

#### t3-counter-defense-defense — Reforge Vow
- Cost: `1[stam] 1[mana]`  ·  Elements: `[counter][defense][defense]`
- Visual: `+8[armor]([vit]) · (12s) [armor] gained +50%`
- Body: For 12 seconds: every [armor] you gain is +50%. Gain 8[armor]([vit]).

#### t3-agility-agility-attack — Pinprick Volley
- Cost: `1[stam]`  ·  Elements: `[agility][agility][attack]`
- Visual: `5!([dex])×3 AoE`
- Body: Deal 5([dex]) Pierce three times to all enemies.

#### t3-agility-agility-defense — Veil of Steps
- Cost: `1[stam]`  ·  Elements: `[agility][agility][defense]`
- Visual: `+14[armor]([dex]) · Haste 20%`
- Body: Gain 14[armor]([dex]). Haste 20% for 6 seconds.

#### t3-agility-agility-counter — Quicksilver Bleed
- Cost: `1[stam]`  ·  Elements: `[agility][agility][counter]`
- Visual: `+3[bleed]([dex]) · +2[burn]`
- Body: Apply 3[bleed]([dex]). Apply 2[burn].

#### t3-attack-counter-counter — Cleaver's Tax
- Cost: `2[stam]`  ·  Elements: `[attack][counter][counter]`
- Visual: `12!([str]) · if 5[rage]: +20!([str]) · next card +4s`
- Body: Deal 12([str]) Pierce. If you have at least 5[rage]: consume 5[rage], deal 20([str]) more Pierce, and this card delays 4 more seconds next time.

#### t3-counter-counter-defense — Wrathshell Vow (rewrite, §11.H)
- Cost: `2[stam]  [exhaust]`  ·  Elements: `[counter][counter][defense]`
- Visual: `+6[rage]([str]) · (15s) +1[rage]/2s`
- Body: Exhaust. Gain 6([str])[rage]. For 15 seconds: every 2 seconds, gain 1[rage].

#### t3-agility-counter-counter — Razor Cadence
- Cost: `2[stam]`  ·  Elements: `[agility][counter][counter]`
- Visual: `5([dex])×3 · +1[bleed]([dex])/hit · Vengeance: +1 hit`
- Body: Deal 5([dex]) three times; each hit applies 1[bleed]([dex]). Vengeance: deal 5([dex]) a fourth time and apply 1[bleed]([dex]).

#### t3-agility-attack-defense — Flowstrike
- Cost: `2[stam]`  ·  Elements: `[agility][attack][defense]`
- Visual: `10([str]) · +10[armor] · Haste 15%`
- Body: Deal 10([str]). Gain 10[armor]. Haste 15% for 6 seconds.

#### t3-attack-counter-defense — Last Stand Bulwark
- Cost: `2[stam]`  ·  Elements: `[attack][counter][defense]`
- Visual: `+10[armor]([vit]) · if <50%[HP]: +10[armor]([vit]) · 12!([str])`
- Body: Gain 10[armor]([vit]). If you have less then 50%[HP]: gain 10 more [armor]([vit]) and deal 12([str]) Pierce.

#### t3-agility-attack-counter — Vein Splitter
- Cost: `2[stam]`  ·  Elements: `[agility][attack][counter]`
- Visual: `4([dex])×3 · +1[bleed]([dex])/hit · if [bleed]: +1[bleed]/hit`
- Body: Deal 4([dex]) three times; each hit applies 1[bleed]([dex]). If enemy has [bleed]: each hit applies 1 more [bleed]([dex]).

#### t3-agility-counter-defense — Bramble Step
- Cost: `1[stam]`  ·  Elements: `[agility][counter][defense]`
- Visual: `+10[armor]([dex]) · Brace: +3[bleed]`
- Body: Gain 10[armor]([dex]). Brace: apply 3[bleed].

### 12.6 Tier 3 — fire + cross trios (16)

#### t3-fire-fire-water — Quench Lance
- Cost: `1[stam] 1[mana]  3[burn]`  ·  Elements: `[fire][fire][water]`
- Visual: `3[burn] → 3[bleed] · 4([str]) per [bleed] · +2[burn]([int])`
- Body: Convert 3[burn] on enemy into 3[bleed]. Deal 4([str]) damage per [bleed] on enemy. Apply 2[burn]([int]).

#### t3-air-fire-fire — Pyre Surge
- Cost: `1[stam] 1[mana]`  ·  Elements: `[air][fire][fire]`
- Visual: `+2 to each [burn]([int]) · (8s) double [fire] dmg`
- Body: Add 2 to every [burn] on enemy ([int]). For 8 seconds: double [fire] damage on enemy.

#### t3-earth-fire-fire — Magma Welling
- Cost: `2[stam]`  ·  Elements: `[earth][fire][fire]`
- Visual: `+14[armor]([vit]) · +8[burn]([int])`
- Body: Gain 14[armor]([vit]). Apply 8[burn]([int]).

#### t3-fire-water-water — Phoenix Aura
- Cost: `2[mana]`  ·  Elements: `[fire][water][water]`
- Visual: `+10[HP]([spi]) · (12s) if <50%[HP]: +18[armor]`
- Body: Heal 10([spi]). For 12 seconds: if you have less then 50%[HP], gain 18[armor].

#### t3-air-water-water — Misted Cadence
- Cost: `2[mana]`  ·  Elements: `[air][water][water]`
- Visual: `+9[HP]([spi]) · Haste 25% · +3[mana]`
- Body: Heal 9([spi]). Haste 25% for 8 seconds. Gain 3[mana].

#### t3-earth-water-water — Brine Bedrock
- Cost: `2[mana]`  ·  Elements: `[earth][water][water]`
- Visual: `+10[HP]([spi]) · Vengeance: +3[poison]`
- Body: Heal 10([spi]). Vengeance: apply 3[poison].

#### t3-air-air-fire — Cinder Squall
- Cost: `1[stam] 1[mana]`  ·  Elements: `[air][air][fire]`
- Visual: `+3[slow]([int]) AoE · if 5[slow]: +1[stun]([int]) AoE · 2([int]) per [slow]`
- Body: Apply 3[slow]([int]) to all enemies. Every enemy with at least 5[slow] is stunned for 1[stun]([int]). Deal 2([int]) damage per [slow] on enemy.

#### t3-air-air-water — Squall Aura
- Cost: `2[mana]`  ·  Elements: `[air][air][water]`
- Visual: `+6[HP]([spi]) · Haste 25% · +4[mana]`
- Body: Heal 6([spi]). Haste 25% for 8 seconds. Gain 4[mana].

#### t3-air-air-earth — Dust Plague
- Cost: `1[stam] 2[mana]`  ·  Elements: `[air][air][earth]`
- Visual: `+8[armor]([vit]) · (12s) +1[slow]([int])/2.5s AoE · if 5[slow]: +1[stun]`
- Body: Gain 8[armor]([vit]). For 12 seconds: every 2.5 seconds apply 1[slow]([int]) to all enemies; when an enemy has at least 5[slow], apply 1[stun]([int]).

#### t3-earth-earth-fire — Magma Vow
- Cost: `2[mana]`  ·  Elements: `[earth][earth][fire]`
- Visual: `+14[armor]([vit]) · Vengeance: 14!`
- Body: Gain 14[armor]([vit]). Vengeance: deal 14 Pierce.

#### t3-earth-earth-water — Bog Catalyst
- Cost: `1[stam] 1[mana]`  ·  Elements: `[earth][earth][water]`
- Visual: `+2[poison]([int]) · double [poison]`
- Body: Apply 2[poison]([int]). Then double the [poison] on enemy.

#### t3-air-earth-earth — Standing Stone
- Cost: `2[mana]`  ·  Elements: `[air][earth][earth]`
- Visual: `+16[armor]([vit]) · Brace: +8[HP] · Haste 10%`
- Body: Gain 16[armor]([vit]). Brace: heal 8. Haste 10% for 8 seconds.

#### t3-air-fire-water — Steaming Plague
- Cost: `1[stam] 1[mana]`  ·  Elements: `[air][fire][water]`
- Visual: `+3[poison]([int]) AoE · if [poison]: +2[poison]([int])`
- Body: Apply 3[poison]([int]) to all enemies. If an enemy already has [poison]: apply 2 more ([int]).

#### t3-earth-fire-water — Alchemic Drain
- Cost: `1[stam] 1[mana]  4[poison]`  ·  Elements: `[earth][fire][water]`
- Visual: `+4([spi])[HP] per [poison]`
- Body: Heal 4([spi]) per [poison] consumed.

#### t3-air-earth-fire — Sandfury
- Cost: `2[mana]`  ·  Elements: `[air][earth][fire]`
- Visual: `8([str])×2 AoE · 2! per [slow]`
- Body: Deal 8([str]) twice to all enemies. Deal 2 Pierce per [slow] on enemy.

#### t3-air-earth-water — Marsh Squall
- Cost: `2[stam] 2[mana]  X[poison]  [exhaust]`  ·  Elements: `[air][earth][water]`
- Visual: `spread 50% [poison] · 4!([int]) per [poison] AoE`
- Body: Exhaust. 50% of enemy's [poison] spreads to up to 4 enemies. Then deal 4([int]) Pierce per [poison] consumed to all enemies.

### 12.7 Tier 3 — attack-double + defense-double crosses (8)

#### t3-attack-attack-fire — Cinder Thrust
- Cost: `2[stam]`  ·  Elements: `[attack][attack][fire]`
- Visual: `10([str])×2 · +2[burn]`
- Body: Deal 10([str]) twice. Apply 2[burn].

#### t3-attack-attack-water — Soaking Blade
- Cost: `2[stam]`  ·  Elements: `[attack][attack][water]`
- Visual: `12([str]) · +2[poison] · if [poison]: +7`
- Body: Deal 12([str]). Apply 2[poison]. If enemy has [poison]: +7 damage.

#### t3-air-attack-attack — Galekick
- Cost: `2[stam]`  ·  Elements: `[air][attack][attack]`
- Visual: `7([str])×2 AoE · +2[slow]`
- Body: Deal 7([str]) twice to all enemies. Apply 2[slow].

#### t3-attack-attack-earth — Concussive Smash
- Cost: `2[stam]`  ·  Elements: `[attack][attack][earth]`
- Visual: `14([str]) · +2[stun]([int]) · +3[slow] · if [stun]: +6([str])`
- Body: If enemy is [stun]: deal 6([str]) more. Deal 14([str]). Apply 2[stun]([int]) and 3[slow].

#### t3-defense-defense-fire — Pyric Bulwark
- Cost: `1[stam] 1[mana]`  ·  Elements: `[defense][defense][fire]`
- Visual: `+12[armor]([vit]) · (14s) every +4[armor]: +1[burn]([int])`
- Body: Gain 12[armor]([vit]). For 14 seconds: every time you gain at least 4[armor], apply 1[burn]([int]).

#### t3-defense-defense-water — Stagnant Bulwark
- Cost: `1[stam] 1[mana]`  ·  Elements: `[defense][defense][water]`
- Visual: `+10[armor]([vit]) · (12s) +1[poison]([int])/2s`
- Body: Gain 10[armor]([vit]). For 12 seconds: every 2 seconds apply 1[poison]([int]).

#### t3-air-defense-defense — Stormgate
- Cost: `2[stam]`  ·  Elements: `[air][defense][defense]`
- Visual: `+14[armor]([vit]) · Haste 15%`
- Body: Gain 14[armor]([vit]). Haste 15% for 10 seconds.

#### t3-defense-defense-earth — Stoneward Reprisal
- Cost: `1[stam]`  ·  Elements: `[defense][defense][earth]`
- Visual: `+8[armor]([vit]) · Brace: +2[stun]`
- Body: Gain 8[armor]([vit]). Brace: apply 2[stun].

### 12.8 Tier 3 — agility-double crosses (4)

#### t3-agility-agility-fire — Twinflame Flicker (rewrite, §11.H)
- Cost: `1[stam]`  ·  Elements: `[agility][agility][fire]`
- Visual: `+4[burn] 3([int])×`
- Body: Apply 4[burn] 3([int]) times.

#### t3-agility-agility-water — Slipstream
- Cost: `1[mana]`  ·  Elements: `[agility][agility][water]`
- Visual: `6!([dex]) · +2[poison] · Haste 15%`
- Body: Deal 6([dex]) Pierce. Apply 2[poison]. Haste 15% for 6 seconds.

#### t3-agility-agility-air — Zephyr Cascade
- Cost: `1[mana]`  ·  Elements: `[agility][agility][air]`
- Visual: `+3[slow]([int]) AoE · +2[burn]`
- Body: Apply 3[slow]([int]) to all enemies and 2[burn].

#### t3-agility-agility-earth — Footwork Stone
- Cost: `1[stam]`  ·  Elements: `[agility][agility][earth]`
- Visual: `+12[armor]([dex]) · Haste 25%`
- Body: Gain 12[armor]([dex]). Haste 25% for 6 seconds.

### 12.9 Tier 3 — counter-double crosses (4)

#### t3-counter-counter-fire — Vengeful Pyre (rewrite, §11.H)
- Cost: `2[stam]  [exhaust]`  ·  Elements: `[counter][counter][fire]`
- Visual: `+12[rage]([str]) · +6[burn]([int]) · exhaust next card`
- Body: Exhaust. Exhaust the next card in order. Gain 12[rage]([str]). Apply 6[burn]([int]).

#### t3-counter-counter-water — Crimson Cascade
- Cost: `1[stam] 1[mana]`  ·  Elements: `[counter][counter][water]`
- Visual: `Self +1[bleed] · (15s) on [bleed]-kill: +4[bleed]([spi]) nearest`
- Body: Apply 1[bleed] to yourself. For 15 seconds: every time you kill an enemy with [bleed], apply 4[bleed]([spi]) to the nearest enemy.

#### t3-air-counter-counter — Wrath Squall
- Cost: `2[stam]`  ·  Elements: `[air][counter][counter]`
- Visual: `when 30[rage]: 40([str]) · +8[slow]([int]) · consume [rage]`
- Body: When you reach 30[rage]: deal 40([str]) and apply 8[slow]([int]). Consume all [rage]. No more than once every 8 seconds.

#### t3-counter-counter-earth — Stonewrath
- Cost: `2[stam]`  ·  Elements: `[counter][counter][earth]`
- Visual: `+12[armor]([vit]) · (15s) if <50%[HP]: +6[rage]`
- Body: Gain 12[armor]([vit]). For 15 seconds: if you have less then 50%[HP], gain 6[rage].

### 12.10 Tier 3 — attack-defense / agility-counter crosses (24)

#### t3-attack-defense-fire — Forge Strike
- Cost: `2[stam]`  ·  Elements: `[attack][defense][fire]`
- Visual: `12([str]) · +8[armor] · +2[burn]`
- Body: Deal 12([str]). Gain 8[armor]. Apply 2[burn].

#### t3-attack-defense-water — Mire Cleave
- Cost: `1[stam] 1[mana]`  ·  Elements: `[attack][defense][water]`
- Visual: `10([str]) · +8[armor] · +2[poison]`
- Body: Deal 10([str]). Gain 8[armor]. Apply 2[poison].

#### t3-air-attack-defense — Stormhilt
- Cost: `2[stam]`  ·  Elements: `[air][attack][defense]`
- Visual: `8([str])×2 · +6[armor] · +2[slow]`
- Body: Deal 8([str]) twice. Gain 6[armor]. Apply 2[slow].

#### t3-attack-defense-earth — Earthcleaver
- Cost: `2[stam]`  ·  Elements: `[attack][defense][earth]`
- Visual: `14([str]) · if [armor]≥15: +8!`
- Body: Deal 14([str]). If [armor] is at least 15: deal 8 more Pierce.

#### t3-agility-attack-fire — Wickfencer
- Cost: `2[stam]`  ·  Elements: `[agility][attack][fire]`
- Visual: `6([str])×2 · +2[burn]`
- Body: Deal 6([str]) twice. Apply 2[burn].

#### t3-agility-attack-water — Drowner's Dart
- Cost: `1[stam] 1[mana]`  ·  Elements: `[agility][attack][water]`
- Visual: `8!([dex]) · +2[poison]`
- Body: Deal 8([dex]) Pierce. Apply 2[poison].

#### t3-agility-air-attack — Skywire
- Cost: `2[stam]`  ·  Elements: `[agility][air][attack]`
- Visual: `5([dex])×3 · +2[slow]`
- Body: Deal 5([dex]) three times. Apply 2[slow].

#### t3-agility-attack-earth — Quarry Dance
- Cost: `2[stam]`  ·  Elements: `[agility][attack][earth]`
- Visual: `10([dex]) · if [armor]≥10: +8`
- Body: Deal 10([dex]). If [armor] is at least 10: deal 8 more.

#### t3-attack-counter-fire — Wrath Brand
- Cost: `2[stam]  3[rage]`  ·  Elements: `[attack][counter][fire]`
- Visual: `if [rage]: 12([str])×2 · +2[burn]`
- Body: If you have [rage]: deal 12([str]) twice and apply 2[burn].

#### t3-attack-counter-water — Necrotic Festering
- Cost: `2[stam]  X[bleed]` *(your own)*  ·  Elements: `[attack][counter][water]`
- Visual: `Self +3[bleed]([dex]) · +1[poison]([int]) per [bleed] · 4!([str]) per [bleed]`
- Body: Apply 3[bleed]([dex]) to yourself. Apply 1[poison]([int]) per [bleed] on yourself. Then deal 4([str]) Pierce per [bleed] consumed.

#### t3-air-attack-counter — Thunderstrike Catalyst
- Cost: `2[stam]  4[slow]`  ·  Elements: `[air][attack][counter]`
- Visual: `6([str]) · 6!([int]) per [slow]`
- Body: Deal 6([str]). Deal 6([int]) Pierce per [slow] consumed.

#### t3-attack-counter-earth — Granitewrath
- Cost: `2[stam]`  ·  Elements: `[attack][counter][earth]`
- Visual: `14([str]) · Vengeance: 10!`
- Body: Deal 14([str]). Vengeance: deal 10 Pierce.

#### t3-agility-defense-fire — Ember Vault
- Cost: `1[stam] 1[mana]`  ·  Elements: `[agility][defense][fire]`
- Visual: `+10[armor]([vit]) · Brace: +2[burn]`
- Body: Gain 10[armor]([vit]). Brace: apply 2[burn].

#### t3-agility-defense-water — Tidefoot Guard
- Cost: `1[mana]`  ·  Elements: `[agility][defense][water]`
- Visual: `+12[armor]([vit]) · +2[poison]([int]) · Haste 15%`
- Body: Gain 12[armor]([vit]). Apply 2[poison]([int]). Haste 15% for 6 seconds.

#### t3-agility-air-defense — Galeguard
- Cost: `1[stam]`  ·  Elements: `[agility][air][defense]`
- Visual: `+10[armor]([vit]) · Haste 25%`
- Body: Gain 10[armor]([vit]). Haste 25% for 8 seconds.

#### t3-agility-defense-earth — Quickstone
- Cost: `1[stam] 1[mana]`  ·  Elements: `[agility][defense][earth]`
- Visual: `+14[armor]([vit]) · (15s) if <60%[HP]: Haste 30%`
- Body: Gain 14[armor]([vit]). For 15 seconds: if you have less then 60%[HP], gain Haste 30% for 6 seconds.

#### t3-counter-defense-fire — Ashen Bulwark
- Cost: `2[stam]`  ·  Elements: `[counter][defense][fire]`
- Visual: `+12[armor]([vit]) · Brace: 12 · Brace: +2[burn]`
- Body: Gain 12[armor]([vit]). Brace: deal 12 and apply 2[burn].

#### t3-counter-defense-water — Crimson Regen Mantle
- Cost: `1[stam] 1[mana]`  ·  Elements: `[counter][defense][water]`
- Visual: `+8[armor]([vit]) · (12s) if <50%[HP]: +3([spi])[HP]/s · -20% dmg taken`
- Body: Gain 8[armor]([vit]). For 12 seconds: while you have less then 50%[HP], heal 3([spi]) every second. Take 20% less damage.

#### t3-air-counter-defense — Glacial Pact
- Cost: `1[stam] 1[mana]`  ·  Elements: `[air][counter][defense]`
- Visual: `+4[slow]([int]) · +8[armor]([vit]) · Vengeance: +3[slow] · Haste 20%`
- Body: Apply 4[slow]([int]). Gain 8[armor]([vit]). Vengeance: apply 3 more [slow] and Haste 20% for 5 seconds.

#### t3-counter-defense-earth — Tombplate
- Cost: `2[stam]`  ·  Elements: `[counter][defense][earth]`
- Visual: `+18[armor]([vit]) · (15s) if <40%[HP]: +10[armor] · +4[rage]`
- Body: Gain 18[armor]([vit]). For 15 seconds: if you have less then 40%[HP], gain 10[armor] and 4[rage].

#### t3-agility-counter-fire — Searing Razor
- Cost: `1[stam] 1[mana]`  ·  Elements: `[agility][counter][fire]`
- Visual: `+2[bleed]([dex]) · +2[burn]([int]) · Haste 10%`
- Body: Apply 2[bleed]([dex]) and 2[burn]([int]). Haste 10% for 10 seconds.

#### t3-agility-counter-water — Venom Dance
- Cost: `1[stam]`  ·  Elements: `[agility][counter][water]`
- Visual: `+3[poison]([int]) · spread 50% → 2 enemies · Vengeance: 5[bleed]→5[poison]`
- Body: Apply 3[poison]([int]); for each 2[poison] applied, apply 1[poison] to up to 2 other enemies. Vengeance — consume 5[bleed] on yourself and apply 5[poison].

#### t3-agility-air-counter — Static Skirmish
- Cost: `1[stam] 1[mana]`  ·  Elements: `[agility][air][counter]`
- Visual: `+3[slow] · 3!([dex]) per [slow]`
- Body: Apply 3[slow]. Deal 3([dex]) Pierce per [slow] on enemy.

#### t3-agility-counter-earth — Quickearth Rite
- Cost: `1[stam] 1[mana]`  ·  Elements: `[agility][counter][earth]`
- Visual: `+8[armor] · Vengeance: 10!([dex])`
- Body: Gain 8[armor]. Vengeance: deal 10([dex]) Pierce.

### 12.11 Tier 3 — detonators + big-payoff cards (20)

#### t3-attack-fire-fire — Cinderlance
- Cost: `1[stam] 1[mana]  X[burn]`  ·  Elements: `[attack][fire][fire]`
- Visual: `8([str])×2 AoE · 3! per [burn]`
- Body: Deal 8([str]) twice to all enemies. Deal 3 Pierce per [burn] consumed.

#### t3-attack-water-water — Drowning Lance
- Cost: `2[stam] 1[mana]  X[poison]`  ·  Elements: `[attack][water][water]`
- Visual: `3!([int]) per [poison]`
- Body: Deal 3([int]) Pierce per [poison] consumed.

#### t3-air-air-attack — Tempest Pike
- Cost: `2[stam]`  ·  Elements: `[air][air][attack]`
- Visual: `6([str])×3 AoE · +2[slow]`
- Body: Deal 6([str]) three times to all enemies. Apply 2[slow].

#### t3-attack-earth-earth — Mountain's Will
- Cost: `2[stam]`  ·  Elements: `[attack][earth][earth]`
- Visual: `20([str]) · if [armor]≥20: 8!`
- Body: Deal 20([str]). If [armor] is at least 20: deal 8 more Pierce.

#### t3-attack-fire-water — Tremor Detonate
- Cost: `3[stam]  X[poison] X[bleed] X[burn]  [exhaust]`  ·  Elements: `[attack][fire][water]`
- Visual: `6!([str]) · 3!([str]) per [poison] · 3!([str]) per [bleed] · 3!([str]) per [burn]`
- Body: Exhaust. Deal 6([str]) Pierce. Then deal 3([str]) Pierce per [poison], [bleed], and [burn] consumed.

#### t3-air-attack-fire — Galebrand
- Cost: `1[stam] 1[mana]`  ·  Elements: `[air][attack][fire]`
- Visual: `8([str]) AoE · +3[slow] · +2[burn]`
- Body: Deal 8([str]) to all enemies. Apply 3[slow] and 2[burn].

#### t3-attack-earth-fire — Slag Maul
- Cost: `2[stam]`  ·  Elements: `[attack][earth][fire]`
- Visual: `14([str]) · Brace: 12 +2[burn]`
- Body: Deal 14([str]). Brace: deal 12 more and apply 2[burn].

#### t3-air-attack-water — Galetide
- Cost: `1[stam] 1[mana]`  ·  Elements: `[air][attack][water]`
- Visual: `10!([str]) · +2[poison] · +2[slow]`
- Body: Deal 10([str]) Pierce. Apply 2[poison] and 2[slow].

#### t3-attack-earth-water — Mirebreaker
- Cost: `1[stam] 1[mana]`  ·  Elements: `[attack][earth][water]`
- Visual: `14([str]) · if [poison]: +6!`
- Body: Deal 14([str]). If enemy has [poison]: deal 6 more Pierce.

#### t3-air-attack-earth — Cliffwind Maul
- Cost: `2[stam]`  ·  Elements: `[air][attack][earth]`
- Visual: `12([str]) AoE · if [armor]≥12: 10!`
- Body: Deal 12([str]) to all enemies. If [armor] is at least 12: deal 10 more Pierce.

#### t3-defense-fire-fire — Citadel Inferno
- Cost: `2[stam] 1[mana]  X[armor]  [exhaust]`  ·  Elements: `[defense][fire][fire]`
- Visual: `2!([str]) per [armor] AoE · if [armor]≥10`
- Body: Exhaust. Requires at least 10[armor]. Deal 2([str]) Pierce per [armor] consumed to all enemies.

#### t3-defense-water-water — Brineward
- Cost: `2[mana]`  ·  Elements: `[defense][water][water]`
- Visual: `+14[armor]([vit]) · +8[HP]([spi]) · +2[poison]([int])`
- Body: Gain 14[armor]([vit]). Heal 8([spi]). Apply 2[poison]([int]).

#### t3-air-air-defense — Galeward
- Cost: `1[stam] 1[mana]`  ·  Elements: `[air][air][defense]`
- Visual: `+12[armor]([vit]) · Haste 20%`
- Body: Gain 12[armor]([vit]). Haste 20% for 10 seconds.

#### t3-defense-earth-earth — Bedrock Bulwark
- Cost: `2[stam]`  ·  Elements: `[defense][earth][earth]`
- Visual: `+16[armor]([vit]) · Brace: +6[armor]([vit])`
- Body: Gain 16[armor]([vit]). Brace: gain 6[armor]([vit]).

#### t3-defense-fire-water — Steam Bulwark
- Cost: `2[mana]`  ·  Elements: `[defense][fire][water]`
- Visual: `+14[armor]([vit]) · Brace: +3[poison] +2[burn]`
- Body: Gain 14[armor]([vit]). Brace: apply 3[poison] and 2[burn].

#### t3-air-defense-fire — Ember Aegis Gust
- Cost: `1[stam] 1[mana]  X[burn]`  ·  Elements: `[air][defense][fire]`
- Visual: `+1([vit])[armor] per [burn] (max 20) · Haste 15%`
- Body: Gain 1([vit])[armor] per [burn] consumed (max 20). Haste 15% for 6 seconds.

#### t3-defense-earth-fire — Magmaplate
- Cost: `2[stam]`  ·  Elements: `[defense][earth][fire]`
- Visual: `+16[armor]([vit]) · Brace: 14 +2[burn]`
- Body: Gain 16[armor]([vit]). Brace: deal 14 and apply 2[burn].

#### t3-air-defense-water — Mistplate
- Cost: `2[mana]`  ·  Elements: `[air][defense][water]`
- Visual: `+12[armor]([vit]) · +2[poison] · +2[slow]`
- Body: Gain 12[armor]([vit]). Apply 2[poison] and 2[slow].

#### t3-defense-earth-water — Bogplate
- Cost: `1[stam] 1[mana]`  ·  Elements: `[defense][earth][water]`
- Visual: `+14[armor]([vit]) · Vengeance: +3[poison]`
- Body: Gain 14[armor]([vit]). Vengeance: apply 3[poison].

#### t3-air-defense-earth — Dustward
- Cost: `1[stam] 1[mana]`  ·  Elements: `[air][defense][earth]`
- Visual: `+16[armor]([vit]) · Haste 10% · Brace: +4[slow]`
- Body: Gain 16[armor]([vit]). Haste 10% for 12 seconds. Brace: apply 4[slow].

### 12.12 Tier 3 — agility-double misc (10)

#### t3-agility-fire-fire — Cinder Sprint
- Cost: `1[mana]  X[burn]`  ·  Elements: `[agility][fire][fire]`
- Visual: `+3[burn] AoE · 4([dex]) per [burn]`
- Body: Apply 3[burn] to all enemies. Deal 4([dex]) damage per [burn] consumed.

#### t3-agility-water-water — Slipvenom Tempo
- Cost: `1[stam] 1[mana]`  ·  Elements: `[agility][water][water]`
- Visual: `+5[poison]([int]) · Haste 15% · if 10[poison]: +5[poison]`
- Body: Apply 5[poison]([int]). Haste 15% for 6 seconds. If enemy has at least 10[poison]: apply 5 more [poison]([int]).

#### t3-agility-air-air — Gale Echo
- Cost: `1[stam] 1[mana]`  ·  Elements: `[agility][air][air]`
- Visual: `(12s) +1[slow]([int]) per [slow] applied · Haste 15%`
- Body: For 12 seconds: every time you apply [slow], apply 1 more [slow]([int]). Haste 15% for 6 seconds.

#### t3-agility-earth-earth — Stonepacer
- Cost: `1[stam]`  ·  Elements: `[agility][earth][earth]`
- Visual: `+10[armor]([vit]) · Haste 20%`
- Body: Gain 10[armor]([vit]). Haste 20% for 8 seconds.

#### t3-agility-fire-water — Boilstep
- Cost: `1[mana]`  ·  Elements: `[agility][fire][water]`
- Visual: `6!([dex]) · +2[burn] · +2[poison]`
- Body: Deal 6([dex]) Pierce. Apply 2[burn] and 2[poison].

#### t3-agility-air-fire — Galecinder
- Cost: `1[stam] 1[mana]`  ·  Elements: `[agility][air][fire]`
- Visual: `5([dex])×2 AoE · +2[burn] · +2[slow]`
- Body: Deal 5([dex]) twice to all enemies. Apply 2[burn] and 2[slow].

#### t3-agility-earth-fire — Cinderquake
- Cost: `1[mana]`  ·  Elements: `[agility][earth][fire]`
- Visual: `10([dex]) · if [armor]≥10: 4! +2[burn]`
- Body: Deal 10([dex]). If [armor] is at least 10: deal 4 more Pierce and apply 2[burn].

#### t3-agility-air-water — Stormsplash
- Cost: `1[mana]`  ·  Elements: `[agility][air][water]`
- Visual: `+2[poison]([int]) · +3[slow] · +2[burn]`
- Body: Apply 2[poison]([int]), 3[slow], and 2[burn].

#### t3-agility-earth-water — Mireglide
- Cost: `1[mana]`  ·  Elements: `[agility][earth][water]`
- Visual: `+8[armor]([vit]) · +3[poison] · Haste 15%`
- Body: Gain 8[armor]([vit]). Apply 3[poison]. Haste 15% for 6 seconds.

#### t3-agility-air-earth — Stormstone Tempo (rewrite, §11.H)
- Cost: `2[stam]`  ·  Elements: `[agility][air][earth]`
- Visual: `6 3([dex])× · +1[slow]/hit · if [stun]: 4!/hit`
- Body: Deal 6 3([dex]) times. Apply 1[slow] per hit. If enemy is [stun]: each hit deals 4([str]) more Pierce.

### 12.13 Tier 3 — counter-double + final (10)

#### t3-counter-fire-fire — Brine Crucible
- Cost: `1[stam] 1[mana]  X[burn]`  ·  Elements: `[counter][fire][fire]`
- Visual: `+2[bleed]([dex]) per [burn] · +2[bleed]([dex]) · next card +3s`
- Body: Apply 2[bleed]([dex]) per [burn] consumed. Apply 2 more [bleed]([dex]). Next card delays 3 more seconds.

#### t3-counter-water-water — Tidefoot Bloom
- Cost: `1[stam] 1[mana]  X[poison]`  ·  Elements: `[counter][water][water]`
- Visual: `+1[bleed]([dex]) per [poison] · (6s) next card 2×([int])`
- Body: Apply 1[bleed]([dex]) per [poison] consumed. For 6 seconds: the next card triggers twice ([int]).

#### t3-air-air-counter — Stormrage
- Cost: `1[stam] 1[mana]  4[rage]`  ·  Elements: `[air][air][counter]`
- Visual: `if [rage]: +8[slow]([int])`
- Body: If you have [rage]: apply 8[slow]([int]).

#### t3-counter-earth-earth — Tombrage
- Cost: `2[stam]`  ·  Elements: `[counter][earth][earth]`
- Visual: `+12[armor]([vit]) · (15s) if <40%[HP]: +8[rage]`
- Body: Gain 12[armor]([vit]). For 15 seconds: if you have less then 40%[HP], gain 8[rage].

#### t3-counter-fire-water — Venom Detonation
- Cost: `1[stam] 1[mana]  X[burn]`  ·  Elements: `[counter][fire][water]`
- Visual: `+2[burn] · +3[poison] · 2([str]) per [burn]`
- Body: Apply 2[burn] and 3[poison]. Deal 2([str]) damage per [burn] consumed.

#### t3-air-counter-fire — Static Bleed
- Cost: `1[stam] 1[mana]`  ·  Elements: `[air][counter][fire]`
- Visual: `Self +2[bleed]([dex]) · Brace: +4[slow]`
- Body: Apply 2[bleed]([dex]) to yourself. Brace: apply 4[slow].

#### t3-counter-earth-fire — Magmavow
- Cost: `2[stam]`  ·  Elements: `[counter][earth][fire]`
- Visual: `+10[armor]([vit]) · Brace: 16! +2[burn]`
- Body: Gain 10[armor]([vit]). Brace: deal 16 Pierce and apply 2[burn].

#### t3-air-counter-water — Tempestbleed
- Cost: `1[stam] 1[mana]`  ·  Elements: `[air][counter][water]`
- Visual: `Self +2[bleed]([dex]) · Brace: 6 +2[slow]`
- Body: Apply 2[bleed]([dex]) to yourself. Brace: deal 6 and apply 2[slow].

#### t3-counter-earth-water — Bogwrath
- Cost: `1[stam] 1[mana]`  ·  Elements: `[counter][earth][water]`
- Visual: `+10[armor]([vit]) · Brace: +4[poison] +3[rage]`
- Body: Gain 10[armor]([vit]). Brace: apply 4[poison] and gain 3[rage].

#### t3-air-counter-earth — Tectonic Reckoning (rewrite, §11.H)
- Cost: `3[stam] 2[mana]  [exhaust]`  ·  Elements: `[air][counter][earth]`
- Visual: `+5[stun]([int]) AoE · 50!([str]) AoE`
- Body: Exhaust. Apply 5[stun]([int]) to all enemies. Deal 50([str]) Pierce to all enemies.

---

## 13. Closure

All 164 cards now have a locked canonical entry in §12. Implementation work (icon sprites, `CardVisual.ts` / `CardText.ts` refactor, KeywordDefinitions glossary trim, JSON drift fixes from §11.I) follows the steps in §9. The audit document is feature-complete as a proposal — engineering can read §1, §11, and §12 as the single contract.







