# Rebalance phase — engine spec & card data

Spec for implementing the 15 card reworks from the audit. Read this before coding.

## 1. New engine primitives

### 1.1 Per-combat permanent stat gain (with per-card cap)

A card grants a permanent stat boost that lasts the whole combat, capped per card.

**State (CombatState):**

```ts
/** Aggregate per-combat stat boost. Read by readStat(). Reset at combat start. */
statBoostsThisCombat: Partial<Record<StatId, number>>;
/** Per-card accumulated grant — enforces each card's own cap independently. */
cardStatGainCounters: Record<string, Partial<Record<StatId, number>>>;
```

**New effect type (`CardEffect`):**

```ts
type: "stat_gain";
stat: StatId;          // which stat to boost
value: number;         // amount granted per fire
max_per_combat: number; // cap *for this card* across the whole combat
target: "self";
```

**Apply logic (`CardResolver.applyEffect`, new case):**

```ts
case 'stat_gain': {
  const cid = card?.id ?? '__anon';
  const cur = state.cardStatGainCounters[cid]?.[stat] ?? 0;
  const granted = Math.max(0, Math.min(value, max_per_combat - cur));
  if (granted > 0) {
    state.statBoostsThisCombat[stat] = (state.statBoostsThisCombat[stat] ?? 0) + granted;
    state.cardStatGainCounters[cid] = state.cardStatGainCounters[cid] ?? {};
    state.cardStatGainCounters[cid][stat] = cur + granted;
  }
  break;
}
```

**Reader integration (`HeroStatsResolver.readStat`):** add `state.statBoostsThisCombat?.[stat] ?? 0` to the base after aura modifier sum.

---

### 1.2 Windowed event-counter aura trigger

A self-aura that counts events inside a TTL window and fires a payload when a threshold is reached. Optionally repeats.

**New `CardEffect` field (when `type:"aura"`):**

```ts
event_counter?: {
  event: "stack_applied" | "stack_consumed" | "hp_lost" | "card_played" | "armor_gained" | "heal_received" | "stack_threshold";
  filter?: { stack?: StackId; min_amount?: number };
  threshold: number;
  repeat?: boolean;  // if true, fire payload every Nth event and reset counter
};
```

The aura's `then` payload fires when the counter hits the threshold.

**`ActiveAura` extension:**

```ts
interface ActiveAura {
  // existing fields...
  eventCount?: number;       // bumps on matching events
  eventThreshold?: number;   // copied from card data
  eventRepeat?: boolean;
  eventFilter?: { stack?: StackId; min_amount?: number };
  eventKind?: string;
}
```

**New API in `StatusEffects.ts`:**

```ts
export function bumpEventCounters(
  state: CombatState,
  event: string,
  filter?: { stack?: StackId; amount?: number }
): TriggerPayload[];
```

Iterates `state.heroAuras`, matches by `eventKind` and `eventFilter`, increments `eventCount`. When `eventCount >= eventThreshold`, returns the aura's `then` payload (and resets counter if `repeat=true`, else marks one-shot consumed).

**Hookpoints (where the engine calls `bumpEventCounters`):**

| Event | Where to call |
|-------|---------------|
| `stack_applied` (filter by stack) | `CardResolver.applyEffect` — `dot` / `stack` case, after the stacks land on the target |
| `stack_consumed` | `CardResolver.applyEffect` — after `consume_stack` and after `consume_stack_value` resolve |
| `heal_received` | `CardResolver.applyEffect` — `heal` case, after `state.heroHP` updates |
| `armor_gained` | `CardResolver.applyEffect` — `armor` case, on positive gain (also re-uses `fireRecurringTrigger` for `on_armor_gained`) |
| `hp_lost` (filter by amount) | `EnemyAI.applyHeroDamage`, after HP delta |
| `card_played` | `CombatEngine.playCard` (after `resolve` returns) |

Caller routes returned payloads through `applyTriggeredPayload` (existing helper).

---

### 1.3 Combat-long stack-gain multiplier

For Vengeful Pyre: "Double all rage gained this combat".

**New `AuraModifierKind` value:** `stack_gain_mult`. The aura's `modifier` carries `{ kind: "stack_gain_mult", stack: StackId, value: number }`.

**Apply at the stack/dot effect site:** before adding stacks, multiply `effectiveValue` by `1 + Σ stack_gain_mult auras matching this stack`. (Value=1 → ×2, value=2 → ×3.)

TTL for combat-long auras: just set `ttl_ms` to a very large number (e.g. `9999999`).

---

### 1.4 "Apply again if condition"

Already supported. Card data duplicates the `dot` effect with a `condition`. Example:

```json
[
  { "type":"dot", "stack":"burn", "value":3, "scale":{...}, "target":"enemy" },
  { "type":"dot", "stack":"burn", "value":3, "scale":{...}, "target":"enemy",
    "condition": { "enemy_has_stack": "bleed" } }
]
```

No engine change needed.

---

## 2. CombatState initialization

In `createCombatState`:

```ts
statBoostsThisCombat: {},
cardStatGainCounters: {},
```

## 3. Schema additions to `src/data/types.ts`

- `CardEffect.type` union: add `"stat_gain"`
- `CardEffect.max_per_combat?: number`
- `CardEffect.event_counter?: { event: ...; filter?: ...; threshold: number; repeat?: boolean }`
- `AuraModifierKind` union: add `"stack_gain_mult"`

---

## 4. Card data — 15 reworks

All card descriptions and `effects` arrays below. Costs / cooldowns / categories preserved unless noted.

### Pattern-A cards (windowed counter → stat gain on threshold)

These all use the same shape: an immediate small effect, then a 6–8s self-aura that counts an event type and fires a `stat_gain` payload when the threshold hits.

```text
| Card                  | id                              | counted event             | threshold | window | stat / per-fire / cap |
|-----------------------|---------------------------------|---------------------------|-----------|--------|-----------------------|
| Searing Razor         | t3-agility-counter-fire         | hp_lost                   | 4         | 8s     | dex / 2 / 4           |
| Twinflame Flicker     | t3-agility-agility-fire         | stack_applied (burn)      | 4         | 8s     | int / 2 / 4           |
| Quench Lance          | t3-fire-fire-water              | stack_consumed (burn≥10)  | 10        | 6s     | int / 2 / 4           |
| Forge Spike Ward      | t2-defense-fire                 | armor_gained (≥12)        | 12        | 6s     | vit / 1 / 3           |
| Quicksilver Bleed     | t3-agility-agility-counter      | stack_applied (bleed)     | 3         | 6s     | dex / 2 / 4           |
| Quickearth Rite       | t3-agility-counter-earth        | hp_lost                   | 2         | 6s     | vit / 2 / 4           |
| Kindle Strike         | t2-attack-fire                  | (no counter — see below)  | —         | —      | —                     |
| Firestorm             | t2-air-fire                     | card_played               | 3         | 4s     | (fires burn payload, not stat) |
| Stonepacer            | t3-agility-earth-earth          | (no counter — one-shot)   | —         | —      | vit / 3 / 3 (immediate, Exhaust) |
| Tidesong Aura         | t3-water-water-water            | (no counter — one-shot)   | —         | —      | spi / 2 / 4 (immediate) |
```

### Card JSON, one by one

**Searing Razor** (`t3-agility-counter-fire`)
- Description: `"Apply 3[burn]([dex]). For 8 seconds: if you lose HP 4+ times, gain 2[dex] this combat (max 4 per combat)."`
- Effects:
```json
[
  { "type":"dot","stack":"burn","value":3,"target":"enemy","scale":{"stat":"dex","per":3,"value":1} },
  { "type":"aura","value":0,"target":"self","ttl_ms":8000,
    "event_counter":{"event":"hp_lost","threshold":4},
    "then":{"type":"stat_gain","stat":"dex","value":2,"max_per_combat":4,"target":"self"} }
]
```

**Twinflame Flicker** (`t3-agility-agility-fire`)
- Description: `"Apply 4[burn]. For 8 seconds: if you apply [burn] 4 times, gain 2[int] this combat (max 4 per combat)."`
- Effects:
```json
[
  { "type":"dot","stack":"burn","value":4,"target":"enemy" },
  { "type":"aura","value":0,"target":"self","ttl_ms":8000,
    "event_counter":{"event":"stack_applied","filter":{"stack":"burn"},"threshold":4},
    "then":{"type":"stat_gain","stat":"int","value":2,"max_per_combat":4,"target":"self"} }
]
```

**Bloodtide Mend** (`t2-counter-water`)
- Description: `"Heal 5([spi]). Apply 2[bleed] to yourself (ticks 2 dmg over 2s). Vengeance: gain 1[spi] this combat (max 4 per combat)."`
- Effects:
```json
[
  { "type":"heal","value":5,"target":"self","scale":{"stat":"spi","per":3,"value":1} },
  { "type":"dot","value":2,"target":"self_dot","stack":"bleed" },
  { "type":"stat_gain","stat":"spi","value":1,"max_per_combat":4,"target":"self",
    "condition":{"took_damage_within_ms":2000} }
]
```

**Firestorm** (`t2-air-fire`)
- Description: `"For 4 seconds: if you play 3 or more cards, apply 10([int])[burn]."`
- Effects:
```json
[
  { "type":"aura","value":0,"target":"self","ttl_ms":4000,
    "event_counter":{"event":"card_played","threshold":3},
    "then":{"type":"dot","stack":"burn","value":10,"target":"enemy","scale":{"stat":"int","per":3,"value":1}} }
]
```
- Cost: 1[mana]. Category: magic. Targeting: aoe.

**Bloodlash Salvo** (`t3-attack-attack-counter`)
- Description: `"Exhaust. Apply 2([str])[stun] to yourself. Gain 4[str] this combat."`
- Effects:
```json
[
  { "type":"dot","stack":"stun","value":2,"target":"self_dot","scale":{"stat":"str","per":3,"value":1} },
  { "type":"stat_gain","stat":"str","value":4,"max_per_combat":4,"target":"self" }
]
```
- `exhaust: true`. Cost: 2[stam].

**Vengeful Pyre** (`t3-counter-counter-fire`)
- Description: `"Exhaust. Exhaust the next card in order. Double all [rage] gained this combat."`
- Effects:
```json
[
  { "type":"devour","value":1,"target":"self_deck" },
  { "type":"aura","value":0,"target":"self","ttl_ms":9999999,
    "modifier":{"kind":"stack_gain_mult","stack":"rage","value":1} }
]
```
- `exhaust: true`.

**Tidefoot Bloom** (`t3-counter-water-water`)
- Description: `"Exhaust. For this combat: each time you heal, also apply 1([int])[poison]."`
- Effects:
```json
[
  { "type":"aura","value":0,"target":"self","ttl_ms":9999999,
    "event_counter":{"event":"heal_received","threshold":1,"repeat":true},
    "then":{"type":"dot","stack":"poison","value":1,"target":"enemy","scale":{"stat":"int","per":3,"value":1}} }
]
```
- `exhaust: true`.

**Quench Lance** (`t3-fire-fire-water`)
- Description: `"Apply 2([int])[burn]. For 6 seconds: if you consume 10+ [burn], gain 2[int] this combat (max 4 per combat)."`
- Effects:
```json
[
  { "type":"dot","stack":"burn","value":2,"target":"enemy","scale":{"stat":"int","per":3,"value":1} },
  { "type":"aura","value":0,"target":"self","ttl_ms":6000,
    "event_counter":{"event":"stack_consumed","filter":{"stack":"burn","min_amount":10},"threshold":1},
    "then":{"type":"stat_gain","stat":"int","value":2,"max_per_combat":4,"target":"self"} }
]
```

**Forge Spike Ward** (`t2-defense-fire`)
- Description: `"Gain 5[armor]([vit]). For 6 seconds: if you gain 12+ [armor], gain 1[vit] this combat (max 3 per combat)."`
- Effects:
```json
[
  { "type":"armor","value":5,"target":"self","scale":{"stat":"vit","per":2,"value":1} },
  { "type":"aura","value":0,"target":"self","ttl_ms":6000,
    "event_counter":{"event":"armor_gained","filter":{"min_amount":12},"threshold":1},
    "then":{"type":"stat_gain","stat":"vit","value":1,"max_per_combat":3,"target":"self"} }
]
```

**Quicksilver Bleed** (`t3-agility-agility-counter`)
- Description: `"Apply 3[bleed]([dex]). For 6 seconds: if you apply [bleed] 3+ times, gain 2[dex] this combat (max 4 per combat)."`
- Effects:
```json
[
  { "type":"dot","stack":"bleed","value":3,"target":"enemy","scale":{"stat":"dex","per":3,"value":1} },
  { "type":"aura","value":0,"target":"self","ttl_ms":6000,
    "event_counter":{"event":"stack_applied","filter":{"stack":"bleed"},"threshold":3},
    "then":{"type":"stat_gain","stat":"dex","value":2,"max_per_combat":4,"target":"self"} }
]
```

**Quickearth Rite** (`t3-agility-counter-earth`)
- Description: `"Gain 8[armor]([vit]). For 6 seconds: if you take HP damage 2+ times, gain 2[vit] this combat (max 4 per combat)."`
- Effects:
```json
[
  { "type":"armor","value":8,"target":"self","scale":{"stat":"vit","per":2,"value":1} },
  { "type":"aura","value":0,"target":"self","ttl_ms":6000,
    "event_counter":{"event":"hp_lost","threshold":2},
    "then":{"type":"stat_gain","stat":"vit","value":2,"max_per_combat":4,"target":"self"} }
]
```

**Kindle Strike** (`t2-attack-fire`)
- Description: `"Apply 3[burn]([int]). If enemy is [bleed], apply again."`
- Effects:
```json
[
  { "type":"dot","stack":"burn","value":3,"target":"enemy","scale":{"stat":"int","per":3,"value":1} },
  { "type":"dot","stack":"burn","value":3,"target":"enemy","scale":{"stat":"int","per":3,"value":1},
    "condition":{"enemy_has_stack":"bleed"} }
]
```
- Cost: 1[stam]. CD: 1.5. (Aura removed; deeper-fire identity reduced.)

**Wrath Squall** (`t3-air-counter-counter`)
- Description: `"Exhaust. For 8 seconds: each time you lose HP, gain 1[str] (max 5 per combat) and 3([vit])[rage]."`
- Cost: 2[stam], CD: 2.0, `exhaust: true`.
- Effects (two parallel auras, both counting the same hp_lost event):
```json
[
  { "type":"aura","value":0,"target":"self","ttl_ms":8000,
    "event_counter":{"event":"hp_lost","threshold":1,"repeat":true},
    "then":{"type":"stat_gain","stat":"str","value":1,"max_per_combat":5,"target":"self"} },
  { "type":"aura","value":0,"target":"self","ttl_ms":8000,
    "event_counter":{"event":"hp_lost","threshold":1,"repeat":true},
    "then":{"type":"stack","stack":"rage","value":3,"target":"self","scale":{"stat":"vit","per":3,"value":1}} }
]
```

**Stonepacer** (`t3-agility-earth-earth`)
- Description: `"Exhaust. Gain 3[vit] this combat. Haste 30% for 12 seconds."`
- Cost: 1[stam], CD: 2.8, `exhaust: true`, category: defense.
- Effects:
```json
[
  { "type":"stat_gain","stat":"vit","value":3,"max_per_combat":3,"target":"self" },
  { "type":"aura","value":0,"target":"self","ttl_ms":12000,"modifier":{"kind":"cd_reduction","value":0.3} }
]
```

**Tidesong Aura** (`t3-water-water-water`)
- Description: `"Heal 12([spi]). Gain 2[spi] this combat (max 4 per combat). Gain 3[mana]."`
- Cost: 2[mana], CD: 4.0.
- Effects:
```json
[
  { "type":"heal","value":12,"target":"self","scale":{"stat":"spi","per":2,"value":2} },
  { "type":"stat_gain","stat":"spi","value":2,"max_per_combat":4,"target":"self" },
  { "type":"mana","value":3,"target":"self" }
]
```

---

## 5. Implementation order

1. **Types** (`types.ts`) — add new fields. Compile errors will then guide the rest.
2. **State init** (`CombatState.ts`) — initialize new fields in `createCombatState`.
3. **Readers** (`HeroStatsResolver.ts`) — `readStat` reads `statBoostsThisCombat`.
4. **Effect dispatcher** (`CardResolver.applyEffect`):
   - New `stat_gain` case.
   - `then_multi` handling in aura payload fire path.
   - Emit `stack_applied` / `stack_consumed` / `heal_received` / `armor_gained` events.
5. **Aura engine** (`StatusEffects.ts`):
   - `ActiveAura` event-counter fields.
   - `bumpEventCounters` function.
   - `stack_gain_mult` modifier support — `sumModifierStackScaled`-style helper that takes a stack name.
6. **Combat engine hooks** (`CombatEngine.ts`):
   - Emit `card_played` after each resolve.
7. **Hero-damage hook** (`EnemyAI.applyHeroDamage`):
   - Emit `hp_lost` event after HP decrement.
8. **Card data** — rewrite all 15 cards' `description` + `effects` per §4.
9. **Tests** — extend `tests/audit/card-audit-sim.test.ts`:
   - Add scenarios: `hero_taking_damage` (simulates hp_lost), `multi_card_play` (simulates card_played counter).
   - Re-run; verify deltas for each reworked card.

## 6. Decisions (resolved)

- **Q1 → 2 parallel auras** for Wrath Squall (no `then_multi`).
- **Q2 → `repeat:false` auras self-prune after firing once.** Each card play creates a fresh aura instance (independent). The per-card stat cap (`cardStatGainCounters[cardId][stat]`) tracks globally across all instances of that card (repeated plays / copies).
- **Q3 → HUD must show `statBoostsThisCombat` reflected in in-combat stat displays.** Implementation: HUD reads via `readStat` (which already returns the boosted value).

---

End of spec.
