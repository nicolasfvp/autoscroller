# Shadowblade — "Veil & Edge" (v2)

> Conceptual design only. Numbers are starting tuning points, expressible in the existing JSON schema with the additions called out in `00_framework.md` §2.
> JSON shape additions assumed: `gain_combo`, `consume_combo`, `dot`, `stealth`, `buff`, `debuff_stat`, `stack`, `scale: { stat, per, value }`.
> All cards below are **new** — no IDs collide with `cards.json`.
> **v2 trim**: 50 cards → **35 cards**, 110 combo intents → **35 combo rows** (every card appears EXACTLY 2×).

---

## 1. Identity & fantasy

The Shadowblade is the knife behind the smile. She is fragile silk wrapped around a venomed blade — built not to soak hits but to never *be* hit. Every card is a step in a dance she has rehearsed a hundred times: paint the target with venom, vanish behind a veil, then surface in a five-point flurry that cashes in the entire choreography on a single throat.

She is the class for players who love the *crescendo* — the slow accrual of Combo Points and Poison stacks that suddenly detonates into a single named finisher. Where the Warrior endures and the Mage rituals, the Shadowblade *snowballs*: nothing, nothing, nothing, then "Crimson Edge!" and the boss is gone.

Her failure mode is also distinct: a Shadowblade that never sets up — a hand of finishers with no ramp, a Veil hand with nothing to surface into — dies in two trades. The class demands sequencing.

---

## 2. Stat baseline

| Stat | Value | Rationale |
|---|---|---|
| maxHP | 60 | Lowest of the three classes — fragility is the cost of speed |
| maxStamina (Energy) | 50 | Renamed "Energy" in flavor; tempo resource |
| maxMana | 20 | Vestigial — supports a few alchemical / curse cards |
| strength (STR) | 1 | Damage rides on combo points & poison, not raw STR |
| vitality (VIT) | 0 | She does not bulk up |
| **dexterity (DEX)** | **8** | Class-defining: −16% cooldowns base, +8% dodge base |
| intellect (INT) | 1 | Flavor only — venom alchemy |
| spirit (SPI) | 0 | She does not heal herself except through lifesteal |
| defenseMultiplier | 0.8 | Light armor, like the Mage |

Derived at start of run: roughly −16% card cooldown floor, +8% dodge before relics.

---

## 3. Class definition (TypeScript)

```ts
// src/systems/hero/ShadowbladeClass.ts
// Shadowblade class definition with base stats and starter deck.
// No Phaser dependency. Pure data definitions.

// ── Base Stats ──────────────────────────────────────────────

export const SHADOWBLADE_BASE_STATS = {
  maxHP: 60,
  maxStamina: 50,       // displayed as "Energy" in UI
  maxMana: 20,
  strength: 1,
  vitality: 0,
  dexterity: 8,
  intellect: 1,
  spirit: 0,
  defenseMultiplier: 0.8,
  className: 'shadowblade' as const,
};

// ── Starter Deck (10 cards) ─────────────────────────────────
// 4× Backstab strikes, 2× Eviscerate finishers, 2× Shadowstep,
// 1× Toxic Coat, 1× Veil Guard.

export const SHADOWBLADE_STARTER_DECK: string[] = [
  'backstab', 'backstab', 'backstab', 'backstab',
  'eviscerate', 'eviscerate',
  'shadowstep', 'shadowstep',
  'toxic-coat',
  'veil-guard',
];

// ── Class Definition ────────────────────────────────────────

export interface ShadowbladeClassDef {
  className: string;
  baseStats: typeof SHADOWBLADE_BASE_STATS;
  starterDeck: string[];
}

export const SHADOWBLADE: ShadowbladeClassDef = {
  className: 'shadowblade',
  baseStats: SHADOWBLADE_BASE_STATS,
  starterDeck: SHADOWBLADE_STARTER_DECK,
};
```

---

## 4. Starter deck (10 cards)

The starter deck is playable on its own: Backstab builds CP, Eviscerate spends it, Shadowstep is panic + damage rider, Toxic Coat starts the poison drumbeat, Veil Guard handles the unavoidable hit.

| # | Card | Role |
|---|---|---|
| 1 | Backstab | Strike — 5 dmg, +1 CP, 0.9s cd, 1 Energy |
| 2 | Backstab | (duplicate) |
| 3 | Backstab | (duplicate) |
| 4 | Backstab | (duplicate) |
| 5 | Eviscerate | Finisher — Deal 4×CP damage, consume all CP, 1.4s cd, 2 Energy |
| 6 | Eviscerate | (duplicate) |
| 7 | Shadowstep | Utility — Gain Stealth (1 card), 0.8s cd, 1 Energy |
| 8 | Shadowstep | (duplicate) |
| 9 | Toxic Coat | Poison — Apply 3 poison stacks, 1.2s cd, 1 Energy |
| 10 | Veil Guard | Defense — Gain 3 Armor + dodge next 1 attack, 1.2s cd, 1 Energy |

The starter loop: Backstab → Backstab → Eviscerate (8 dmg) is a complete combat. Shadowstep dodges. Toxic Coat ramps. Veil Guard panics.

---

## 5. Card table (35 cards)

Legend for **Mechanic tags**: `CP+` gain combo, `CP-` consume combo, `PSN` apply poison, `STL` stealth, `EVD` evade, `DOT` interact with DoT, `SCL` scales off a stat (DEX/INT/HP etc.), `BUFF` buff self, `DEBUFF` debuff enemy, `HP$` HP-cost card, `E$` Energy-cost, `M$` Mana-cost.

### 5.1 Commons (12)

| ID | Name | Category | Cost | Effect (short) | Tags |
|---|---|---|---|---|---|
| backstab | Backstab | attack | 1E | 5 dmg, +1 CP, cd 0.9 | CP+, E$ |
| eviscerate | Eviscerate | attack | 2E | Deal 4×CP dmg, consume CP, cd 1.4 | CP-, E$ |
| shadowstep | Shadowstep | defense | 1E | Stealth (1 card), cd 0.8 | STL, E$ |
| toxic-coat | Toxic Coat | magic | 1E | Apply 3 PSN, cd 1.2 | PSN, E$ |
| veil-guard | Veil Guard | defense | 1E | 3 Armor, dodge next 1 hit, cd 1.2 | EVD, BUFF, E$ |
| flick-blade | Flick Blade | attack | 0E | 3 dmg, +1 CP, cd 0.8 | CP+ |
| silken-step | Silken Step | defense | 1E | 2 Armor, +1 DEX (combat), cd 1.0 | BUFF, SCL, E$ |
| venom-flask | Venom Flask | magic | 1M | Apply 2 PSN (aoe), cd 1.5 | PSN, M$ |
| paring-cut | Paring Cut | attack | 1E+1CP | 4 dmg ×2 vs poisoned target (else 4 dmg ×1), spend 1 CP, cd 1.0 | CP-, DOT, E$ |
| smoke-pellet | Smoke Pellet | defense | 0E | Stealth (1 card), cd 1.4 | STL |
| nicks-and-cuts | Nicks & Cuts | attack | 1E | 2 dmg ×2, +1 CP, cd 1.1 | CP+, E$ |
| blood-tithe | Blood Tithe | attack | 3 HP | Lose 3 HP; gain +2 CP, cd 1.2 | CP+, HP$ |

**Cost shape variety in commons**: free (flick-blade, smoke-pellet) · single Energy (most) · single Mana (venom-flask) · dual 1E+1CP (paring-cut) · HP-cost (blood-tithe). ✓

### 5.2 Uncommons (12)

| ID | Name | Category | Cost | Effect (short) | Tags |
|---|---|---|---|---|---|
| crimson-tally | Crimson Tally | attack | 1E | 4 dmg, +1 CP, +1 dmg per PSN on target, cd 1.0 | CP+, DOT, SCL, E$ |
| serpent-flick | Serpent Flick | magic | 1E | 3 dmg, apply 2 PSN, cd 1.0 | PSN, E$ |
| dance-of-veils | Dance of Veils | defense | 2E | Stealth (2 cards), +1 CP, cd 1.5 | STL, CP+, E$ |
| blade-flurry | Blade Flurry | attack | 2E | 3 dmg ×3 (aoe), +1 CP, cd 1.5 | CP+, E$ |
| envenom | Envenom | magic | 0 | All PSN stacks tick twice this round, cd 2.0 | DOT |
| shadow-recursion | Shadow Recursion | attack | 1E | 6 dmg; if from Stealth: also +2 CP, cd 1.0 | CP+, STL, E$ |
| garrote | Garrote | attack | 2E | 6 dmg + apply 3 PSN, cd 1.3 | PSN, E$ |
| veiled-strike | Veiled Strike | attack | 2E+1CP | 9 dmg; +5 more if from Stealth; spend 1 CP, cd 1.3 | STL, CP-, E$ |
| dex-tonic | DEX Tonic | magic | 1E+1M | +2 DEX (combat), cd 2.0 | BUFF, SCL, E$, M$ |
| umbral-marking | Umbral Marking | magic | 1E | Mark enemy: next finisher +50%, cd 1.5 | DEBUFF, E$ |
| serrated-edge | Serrated Edge | attack | 1E | 4 dmg; +1 PSN per stack already on target (cap +5), cd 1.2 | DOT, PSN, E$ |
| poison-pact | Poison Pact | magic | 2 HP | Apply 4 PSN; lose 2 HP, cd 1.2 | PSN, HP$ |

**Cost shape variety in uncommons**: free (envenom) · single Energy (most) · dual 1E+1M (dex-tonic), dual 2E+1CP (veiled-strike) · HP-cost (poison-pact). ✓

### 5.3 Rares (8)

| ID | Name | Category | Cost | Effect (short) | Tags |
|---|---|---|---|---|---|
| crimson-edge | Crimson Edge | attack | 2E | Finisher — 6×CP dmg, refund 1 CP if it kills, cd 1.5 | CP-, SCL, E$ |
| death-blossom | Death Blossom | attack | 3E | Finisher (aoe) — 3×CP dmg to all, cd 1.8 | CP-, E$ |
| shadowmeld | Shadowmeld | defense | 2E | Stealth (3 cards); next attack from it +8 dmg, cd 2.0 | STL, E$ |
| coup-de-grace | Coup de Grâce | attack | 2E | Finisher — 8×CP dmg vs poisoned; vs clean 4×CP, cd 1.6 | CP-, DOT, E$ |
| widows-kiss | Widow's Kiss | magic | 0 (spends 2 CP) | Apply 6 PSN; PSN stacks no longer decay this combat, cd 2.0 | PSN, DOT, CP- |
| nightshade-coil | Nightshade Coil | attack | 2E | 5 dmg + 4 PSN; +1 CP per existing PSN stack (cap +3), cd 1.5 | CP+, PSN, E$ |
| swift-veil | Swift Veil | defense | 0 (spends 1 CP) | Gain Stealth (1 card); next card cd halved, cd 1.5 | STL, BUFF, SCL, CP- |
| blood-ledger | Blood Ledger | magic | 4 HP | +3 DEX per 10 HP missing this combat (cap +9), cd 2.5 | BUFF, SCL, HP$ |

**Cost shape variety in rares**: free Energy + spends CP (widows-kiss, swift-veil) · single Energy (crimson-edge, shadowmeld, coup-de-grace, nightshade-coil) · 3-Energy (death-blossom) · HP-cost (blood-ledger). ✓

### 5.4 Epics (3)

| ID | Name | Category | Cost | Effect (short) | Tags |
|---|---|---|---|---|---|
| crimson-recital | Crimson Recital | attack | 5 HP | Finisher — 5×CP×(1 + 0.2×PSN). Lose 5 HP. cd 2.0 | CP-, DOT, SCL, HP$ |
| shadow-recursion-prime | Shadow Recursion Prime | attack | 0 (requires 3+ CP) | Finisher — repeat the previous attack card you played; if it was a Strike, refund 2 CP. cd 2.2 | CP-, CP+ |
| eternal-veil | Eternal Veil | defense | −1 maxHP (permanent, run-scoped) | Stealth (4 cards). All cards cd −40% during Stealth. cd 3.0 | STL, BUFF, SCL, HP$ |

**Cost shape variety in epics**: HP-cost (crimson-recital), free-with-CP-gate (shadow-recursion-prime), permanent-stat-shift (eternal-veil). No Energy cost on any of the three epics. ✓

### 5.5 Mechanic touch counts (target ≥5 each)

- **Combo Points (CP+ / CP-)**: backstab, eviscerate, flick-blade, paring-cut, nicks-and-cuts, blood-tithe, crimson-tally, dance-of-veils, blade-flurry, shadow-recursion, veiled-strike, nightshade-coil, crimson-edge, death-blossom, coup-de-grace, widows-kiss, swift-veil, crimson-recital, shadow-recursion-prime = **19 cards** ✓
- **Poison (PSN / DOT)**: toxic-coat, venom-flask, paring-cut, crimson-tally, serpent-flick, envenom, garrote, serrated-edge, poison-pact, widows-kiss, nightshade-coil, coup-de-grace, crimson-recital = **13 cards** ✓
- **Stealth / Evade**: shadowstep, veil-guard, smoke-pellet, dance-of-veils, shadow-recursion, veiled-strike, shadowmeld, swift-veil, eternal-veil = **9 cards** ✓
- **Energy (cards that spend Energy)**: backstab, eviscerate, shadowstep, toxic-coat, veil-guard, silken-step, paring-cut, nicks-and-cuts, crimson-tally, serpent-flick, dance-of-veils, blade-flurry, shadow-recursion, garrote, veiled-strike, dex-tonic, umbral-marking, serrated-edge, crimson-edge, death-blossom, shadowmeld, coup-de-grace, nightshade-coil = **23 cards** ✓

### 5.6 Stat scaling coverage

- **DEX scaling**: silken-step, dex-tonic, blood-ledger, eternal-veil (cd reduction floor)
- **INT scaling**: (implicit via venom-flask + magic tag; explicit class-mechanic tie is intentionally light — Shadowblade is not an INT class)
- **HP-state scaling**: blood-ledger (more DEX when missing HP)
- **CP scaling**: eviscerate, crimson-edge, death-blossom, coup-de-grace, crimson-recital, shadow-recursion-prime
- **PSN scaling**: crimson-tally, serrated-edge, crimson-recital, coup-de-grace, nightshade-coil

VIT and SPI intentionally untouched — Shadowblade does not invest there.

### 5.7 Noob trap & build-defining

- **Noob trap**: `blade-flurry` — looks great on paper (3 dmg ×3 aoe, +1 CP for 2E) but in single-target boss fights it's strictly worse than Backstab + Backstab for tempo, and the 1.5s cd is a trap.
- **Build-defining (with tradeoffs)**:
  - `crimson-recital` — 5 HP per cast in a 60-HP class. Defines the venom-recital archetype.
  - `eternal-veil` — **permanent −1 maxHP per cast (run-scoped)**. Every Veil burns your ceiling.
  - `shadow-recursion-prime` — 3 CP gate plus a 2.2s cd; ceremonial but the highest loop ceiling.

---

## 6. Card detail blocks

### 6.1 Mechanic clusters — Commons (12)

**Strike / CP cluster.** `backstab` (1E), `flick-blade` (0E — *the free common*), `nicks-and-cuts` (1E ×2 hits), `paring-cut` (1E + 1 CP — *the dual-cost common*), `blood-tithe` (3 HP — *the HP-cost common*). Variety in cost shape inside the common tier itself.

**Finisher (common tier).** `eviscerate` (2E). The flat 4×CP baseline finisher.

**Poison.** `toxic-coat` (1E), `venom-flask` (1M — Mana-cost flavor card), `paring-cut` (DOT interact).

**Stealth.** `shadowstep` (1E), `smoke-pellet` (free).

**Defense.** `veil-guard` (1E), `silken-step` (1E with DEX rider).

### 6.2 Mechanic clusters — Uncommons (12)

**Bridge cards** combining mechanics. `crimson-tally` (CP + PSN scale), `shadow-recursion` (CP + Stealth), `serrated-edge` (PSN + DOT loop), `veiled-strike` (Stealth + CP-spend), `nightshade-coil` rare-tier (CP + PSN + Strike). Free uncommon: `envenom` (no cost). Dual-cost uncommons: `dex-tonic` (1E + 1M), `veiled-strike` (2E + 1 CP). HP-cost uncommon: `poison-pact` (2 HP).

### 6.3 Rares (8) — detail

- **Crimson Edge** — *6×CP, refund 1 CP if it kills.* 2E, cd 1.5. Pure burst finisher. Tradeoff: only worth taking if you regularly hit 4–5 CP.
- **Death Blossom** — *Aoe finisher, 3×CP to all.* 3E, cd 1.8. Trades per-target ceiling for room clear. Single-target trap.
- **Shadowmeld** — *Stealth (3); next attack +8.* 2E, cd 2.0. The setup card.
- **Coup de Grâce** — *8×CP vs poisoned, 4×CP otherwise.* 2E, cd 1.6. Poison+combo bridge.
- **Widow's Kiss** — *Free Energy, spends 2 CP; apply 6 PSN; PSN no longer decays this combat.* cd 2.0. **Demonstrates v2: a free rare that pays via CP.** Build-enabler for poison ramp.
- **Nightshade Coil** — *5 dmg + 4 PSN; +1 CP per existing PSN (cap +3).* 2E, cd 1.5. Triple-mechanic bridge.
- **Swift Veil** — *Free Energy, spends 1 CP; Stealth (1); next card cd halved.* cd 1.5. Tempo engine.
- **Blood Ledger** — *4 HP cost; +3 DEX per 10 HP missing (cap +9).* cd 2.5. Comeback card.

### 6.4 Epics (3) — detail

- **Crimson Recital** — *No Energy cost; 5 HP per cast; 5×CP×(1+0.2×PSN). cd 2.0.* The damage ceiling. With 5 CP + 10 PSN: 75 base, scaled further by DEX. The −5 HP keeps spam in check. **v2 epic-with-HP-tradeoff archetype.**
- **Shadow Recursion Prime** — *No Energy cost; requires 3+ CP; repeat previous attack card; refund 2 CP if it was a Strike. cd 2.2.* The loop card. **v2 epic-with-resource-gate archetype.**
- **Eternal Veil** — *No Energy cost; permanently lose 1 maxHP (run-scoped); Stealth (4); all cd −40% during Stealth. cd 3.0.* Haste turn. **v2 epic-with-permanent-stat-shift archetype** — every cast in the run chips away at your ceiling.

---

## 7. Relic table (10 exclusive)

| ID | Name | Rarity | Trigger | Effect | Primary tag |
|---|---|---|---|---|---|
| veiled-locket | Veiled Locket | common | passive | +6 Max HP, +2 DEX | stat (finesse) |
| pouch-of-nightsalt | Pouch of Nightsalt | common | combat_start | Apply 2 PSN to all enemies | PSN |
| dancing-mantle | Dancing Mantle | common | rest_used | Enter next combat with Stealth (1 card) | STL |
| energy-flask | Energy Flask | common | turn_start | Restore 1 Energy on shuffle | Energy |
| keenedge-whetstone | Keen-Edge Whetstone | rare | card_played | Every 3rd Strike, gain +1 CP | CP |
| serpent-fang-vial | Serpent-Fang Vial | rare | card_played | After any attack card, also apply 1 PSN | PSN |
| veilshard-hourglass | Veilshard Hourglass | rare | combo_played | On combo trigger, gain Stealth (1 card) | STL |
| silken-garrote | Silken Garrote | rare | dot_tick | Poison ticks also deal +1 dmg per CP currently held | CP + PSN |
| chalice-of-five-blades | Chalice of Five Blades | epic | passive | Combo Points cap raised to 8. Finishers scale up to 8 CP. | CP |
| empress-fang | Empress Fang | legendary | passive | Poison stacks no longer decay. Once per combat, when you would die, vanish into Stealth (3) and heal 30 HP | PSN + STL |

### Coverage check (≥1 relic per primary mechanic)

- **Combo Points**: keenedge-whetstone, silken-garrote, chalice-of-five-blades → ✓
- **Poison**: pouch-of-nightsalt, serpent-fang-vial, silken-garrote, empress-fang → ✓
- **Stealth/Evade**: dancing-mantle, veilshard-hourglass, empress-fang → ✓
- **Energy**: energy-flask → ✓

Rarity split: 4 common / 4 rare / 1 epic / 1 legendary. **Total = 10.** ✓

---

## 8. Combo table (35 rows — every card appears exactly 2×)

Designed as a Hamiltonian cycle: each card pairs with its previous and next neighbour in a thematic order, giving each card degree 2 in the synergy graph. Class-locked. Bonus shorthand: `dmg X` = bonus damage; `cp +X` = bonus CP; `stl 1` = grant Stealth 1 card; `dot X` = apply X extra PSN; `cd -X%` = cd reduction on next card; `arm X` = bonus armor; `stat_buff` = temporary stat buff.

| # | cardA | cardB | bonus | display name |
|---|---|---|---|---|
| 1 | backstab | eviscerate | dmg 10 | Crimson Edge! |
| 2 | eviscerate | crimson-edge | dmg 10 | Recursive Finale! |
| 3 | crimson-edge | crimson-recital | dmg 18 | Crimson Crescendo! |
| 4 | crimson-recital | poison-pact | dmg 15 | Pact Crescendo! |
| 5 | poison-pact | widows-kiss | dot 4 | Pact of Widows! |
| 6 | widows-kiss | serrated-edge | dot 4 | Edge of Widows! |
| 7 | serrated-edge | blood-tithe | dot 2 | Bleeding Edge! |
| 8 | blood-tithe | blood-ledger | stat_buff +1 dex | Sanguine Pact! |
| 9 | blood-ledger | veil-guard | arm 4 | Iron Ledger! |
| 10 | veil-guard | swift-veil | stl 1 | Drifting Guard! |
| 11 | swift-veil | dex-tonic | cd -20% | Quickened Veil! |
| 12 | dex-tonic | silken-step | stat_buff +1 dex | Limber Up! |
| 13 | silken-step | dance-of-veils | stl 1 | Silk Drift! |
| 14 | dance-of-veils | death-blossom | dmg 14 | Whirling Veil! |
| 15 | death-blossom | blade-flurry | dmg 10 | Garden of Knives! |
| 16 | blade-flurry | crimson-tally | dmg 6 | Flurry Tally! |
| 17 | crimson-tally | nicks-and-cuts | dmg 6 | Tally Up! |
| 18 | nicks-and-cuts | flick-blade | dmg 5 | Patter & Slash! |
| 19 | flick-blade | paring-cut | cp +1 | Patter Cut! |
| 20 | paring-cut | toxic-coat | dot 2 | Bitter Cut! |
| 21 | toxic-coat | coup-de-grace | dmg 20 | Killing Brew! |
| 22 | coup-de-grace | nightshade-coil | dmg 14 | Coil of Mercy! |
| 23 | nightshade-coil | veiled-strike | dmg 12 | Coiled Strike! |
| 24 | veiled-strike | shadow-recursion | dmg 8 | Twin Veil! |
| 25 | shadow-recursion | shadowstep | cp +1 | Drifting Edge! |
| 26 | shadowstep | smoke-pellet | stl 1 | Vanishing Cloud! |
| 27 | smoke-pellet | shadowmeld | stl 1 | Choking Cloud! |
| 28 | shadowmeld | eternal-veil | cd -30% | Eternal Mantle! |
| 29 | eternal-veil | shadow-recursion-prime | cd -30% | Eternal Recursion! |
| 30 | shadow-recursion-prime | umbral-marking | dmg 18 | Marked Recursion! |
| 31 | umbral-marking | garrote | dmg 8 | Marked Strangle! |
| 32 | garrote | venom-flask | dot 3 | Toxic Noose! |
| 33 | venom-flask | envenom | dot 4 | Cloud of Death! |
| 34 | envenom | serpent-flick | dot 3 | Hissing Cycle! |
| 35 | serpent-flick | backstab | cp +1 | Venomed Opener! |

The cycle closes (row 35 wraps `serpent-flick` back to `backstab`), guaranteeing every node has degree 2.

---

## 9. Validation pass

### 9.1 Framework §8 checklist

- [x] **35 cards total** (12 common / 12 uncommon / 8 rare / 3 epic) — see §5.
- [x] **≥5 cards per primary mechanic**: CP 19 ✓, Poison 13 ✓, Stealth 9 ✓, Energy 23 ✓.
- [x] **Every card appears in EXACTLY 2 combo rows** — see §9.3 appearance-count table.
- [x] **At least one card scales off each of the class's primary stats**: DEX (silken-step, dex-tonic, blood-ledger, eternal-veil), CP (eviscerate, crimson-edge, death-blossom, coup-de-grace, crimson-recital, shadow-recursion-prime), PSN (crimson-tally, serrated-edge, crimson-recital, coup-de-grace, nightshade-coil), HP-state (blood-ledger).
- [x] **10 relics, ≥1 covering each primary mechanic** — see §7 coverage check (CP, PSN, STL, Energy all covered).
- [x] **No near-duplicates** — v1 had three single-stam strikes; v2 keeps `backstab` and the differentiated `flick-blade` (0E), `nicks-and-cuts` (×2 hits), and conditional `paring-cut` (dual cost). Cut from v1: `quickdraw`, `veiled-dagger` (numeric clones of backstab); `muggers-grin`, `coin-trick`, `sapper`, `pocket-sand`, `crippling-jab` (filler with no relic anchor); `veil-thrash`, `silk-cut`, `razor-recital`, `silk-noose`, `veil-of-thorns`, `veiled-anointing`, `razored-fan`, `shroud-armor` (combo-bloat / mechanic-redundant); `serpent-empress` (epic over-count — folded into Widow's Kiss + Empress Fang relic).
- [x] **Starter deck playable on its own** — Backstab→Backstab→Eviscerate is a complete 3-card combat loop; Shadowstep dodges; Toxic Coat ramps; Veil Guard panics.
- [x] **One noob trap and one+ build-defining card**: noob trap = `blade-flurry`; build-defining = `crimson-recital` (−5 HP per cast), `eternal-veil` (−1 maxHP permanent per cast), `shadow-recursion-prime` (3 CP gate + 2.2s cd).
- [x] **Cost shape is varied within every rarity tier** — see §9.2.

### 9.2 Cost shape variety per rarity tier

| Rarity | Free | Single-cost | Dual-cost | HP / permanent / CP-spend |
|---|---|---|---|---|
| **Common** | flick-blade (0E), smoke-pellet (0E) | backstab, eviscerate, shadowstep, toxic-coat, veil-guard, silken-step, venom-flask (1M), nicks-and-cuts | **paring-cut (1E + 1 CP)** | **blood-tithe (3 HP)** |
| **Uncommon** | **envenom (0)** | crimson-tally, serpent-flick, dance-of-veils, blade-flurry, shadow-recursion, garrote, umbral-marking, serrated-edge | **dex-tonic (1E + 1M)**, **veiled-strike (2E + 1 CP)** | **poison-pact (2 HP)** |
| **Rare** | **widows-kiss (0E, spends 2 CP)**, **swift-veil (0E, spends 1 CP)** | crimson-edge (2E), shadowmeld (2E), coup-de-grace (2E), nightshade-coil (2E), death-blossom (3E) | — | **blood-ledger (4 HP)** |
| **Epic** | **shadow-recursion-prime (0E, requires 3 CP)** | — | — | **crimson-recital (5 HP)**, **eternal-veil (−1 maxHP permanent)** |

Every rarity has at least one free card, at least one single-cost card (or, for epics, one with-resource-gate card), and at least one HP/permanent/CP-spend card. Rarity does NOT predict cost shape. ✓

### 9.3 Combo-appearance count — every card EXACTLY 2

The §8 table is a Hamiltonian cycle on the 35-card vertex set. By construction, every card occupies exactly two adjacent edge slots (one as the right endpoint of its predecessor edge, one as the left endpoint of its successor edge). Explicit audit:

| Card | Rows | Count |
|---|---|---|
| backstab | 1:A, 35:B | **2** ✓ |
| eviscerate | 1:B, 2:A | **2** ✓ |
| crimson-edge | 2:B, 3:A | **2** ✓ |
| crimson-recital | 3:B, 4:A | **2** ✓ |
| poison-pact | 4:B, 5:A | **2** ✓ |
| widows-kiss | 5:B, 6:A | **2** ✓ |
| serrated-edge | 6:B, 7:A | **2** ✓ |
| blood-tithe | 7:B, 8:A | **2** ✓ |
| blood-ledger | 8:B, 9:A | **2** ✓ |
| veil-guard | 9:B, 10:A | **2** ✓ |
| swift-veil | 10:B, 11:A | **2** ✓ |
| dex-tonic | 11:B, 12:A | **2** ✓ |
| silken-step | 12:B, 13:A | **2** ✓ |
| dance-of-veils | 13:B, 14:A | **2** ✓ |
| death-blossom | 14:B, 15:A | **2** ✓ |
| blade-flurry | 15:B, 16:A | **2** ✓ |
| crimson-tally | 16:B, 17:A | **2** ✓ |
| nicks-and-cuts | 17:B, 18:A | **2** ✓ |
| flick-blade | 18:B, 19:A | **2** ✓ |
| paring-cut | 19:B, 20:A | **2** ✓ |
| toxic-coat | 20:B, 21:A | **2** ✓ |
| coup-de-grace | 21:B, 22:A | **2** ✓ |
| nightshade-coil | 22:B, 23:A | **2** ✓ |
| veiled-strike | 23:B, 24:A | **2** ✓ |
| shadow-recursion | 24:B, 25:A | **2** ✓ |
| shadowstep | 25:B, 26:A | **2** ✓ |
| smoke-pellet | 26:B, 27:A | **2** ✓ |
| shadowmeld | 27:B, 28:A | **2** ✓ |
| eternal-veil | 28:B, 29:A | **2** ✓ |
| shadow-recursion-prime | 29:B, 30:A | **2** ✓ |
| umbral-marking | 30:B, 31:A | **2** ✓ |
| garrote | 31:B, 32:A | **2** ✓ |
| venom-flask | 32:B, 33:A | **2** ✓ |
| envenom | 33:B, 34:A | **2** ✓ |
| serpent-flick | 34:B, 35:A | **2** ✓ |

**All 35 cards appear exactly 2×. Total slots = 70 = 35 rows × 2.** ✓

### 9.4 Power-band sanity

- Common attacks deal 3–5 base dmg ✓ (0.7–1.1× of Strike's 7)
- Uncommons land 4–9 with riders ✓ (1.0–1.3×)
- Rare finishers at 5 CP: Crimson Edge 6×5=30, Coup de Grâce vs poisoned 8×5=40 ✓ (1.3–1.7× of Execute's 30)
- Epic Crimson Recital at 5 CP, 10 PSN: 5×5×(1+2.0) = 75 ✓ (1.6–2.2× of band; with −5 HP tradeoff per cast)

### 9.5 Cooldown sanity (DEX 8 = ~−16% baseline)

- Commons 0.8–1.4s effective → 0.67–1.18s ✓ (fast feel)
- Uncommons 1.0–2.0s → 0.84–1.68s ✓
- Rares 1.5–2.5s → 1.26–2.10s ✓
- Epics 2.0–4.0s → 1.68–3.36s ✓

The Shadowblade remains the fastest-firing class.

---

Wrote design/03_shadowblade.md v2 (35 cards, 10 relics, 35 combos)
