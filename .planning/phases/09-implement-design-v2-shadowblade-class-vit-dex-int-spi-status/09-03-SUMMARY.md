---
phase: 09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status
plan: 03
subsystem: mechanics
tags: [typescript, combat-engine, shadowblade, dot, stealth, combo-points, stat-scaling, synergy, relic-trigger, tiles, design-v2]

requires:
  - phase: 09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status
    plan: 01
    provides: StatId/StackId type unions, CombatState transient fields, HeroStatsResolver, mechanic test scaffolds
provides:
  - Shadowblade class (CLASS_REGISTRY entry + base stats + 10-card starter deck)
  - 3 new tiles (library / arena / shrine_of_pact) with LOCKED hex palette
  - 6 new tile-adjacency rules in src/data/synergies.json (per design/04 §7)
  - cardUpgradeDiscount buff flowing Library+Shop -> ShopSystem.upgradeCard
  - All 8 new CardEffect type cases in CardResolver (buff, debuff_stat, dot, stack, gain_combo, consume_combo, stealth, taunt)
  - Scale resolution (resolvedValue = value + floor(stat / per) * value) for any effect
  - DoT cadence in CombatEngine.tickActiveDoTs (every card play, post-resolve / pre-pointer-advance)
  - Poison per-tick damage formula: stacks * (1 + floor(DEX/4))
  - Stealth evade hook in EnemyAI.applyDamage (consumes 1 charge, clears flag at 0)
  - VIT +5 maxHP per point at combat start, INT +1 dmg per point on magic, SPI +10% heal + stamina regen on shuffle
  - DEX cooldown reduction -2% per point capped at -60% (both schedule + HUD)
  - 5 new SynergyDefinition.bonus types routed: combo_point, stealth, dot, stat_buff, cooldown_reduction
  - 7 new RelicTrigger dispatch sites: enemy_killed, card_drawn, rest_used, shop_visited, stat_changed, combo_played, dot_tick
  - applyStatDelta(run, stat, delta) helper that emits stat_changed
affects: [phase-09, combat, mechanics, content-runtime, ui-readouts]

tech-stack:
  added: []
  patterns:
    - "Per-stat resolver applied via scale clause + readStat (Plan 1 hook)"
    - "tickActiveDoTs hook: post-card-resolve, pre-deck-advance (Pitfall 4 attribution)"
    - "TileSlot.kind discriminator separates registry key from umbrella type (forward-compatible adjacency keys)"
    - "Module-level setActiveBuffs() consumer pattern extended to ShopSystem"
    - "Dispatch-table relic triggers with safe no-op default (JSON validator catches typos at build time)"

key-files:
  created:
    - src/systems/hero/ShadowbladeClass.ts
  modified:
    - src/systems/hero/ClassRegistry.ts
    - src/data/tiles.json
    - src/data/synergies.json
    - src/systems/TileRegistry.ts
    - src/systems/SynergyResolver.ts
    - src/systems/ShopSystem.ts
    - src/systems/RestSiteSystem.ts
    - src/systems/combat/CombatEngine.ts
    - src/systems/combat/CombatState.ts
    - src/systems/combat/CardResolver.ts
    - src/systems/combat/SynergySystem.ts
    - src/systems/combat/RelicSystem.ts
    - src/systems/combat/EnemyAI.ts
    - src/state/RunState.ts
    - src/core/EventBus.ts
    - tests/state/runstate.test.ts
    - tests/systems/SynergyResolver.test.ts
    - tests/systems/ShopSystem.test.ts
    - tests/systems/TileRegistry.test.ts
    - tests/systems/combat/shadowblade-mechanics.test.ts
    - tests/systems/combat/synergy.test.ts
    - tests/systems/combat/card-resolver.test.ts
    - tests/systems/combat/enemy-ai.test.ts

key-decisions:
  - "TileSlot.kind discriminator: separates the registry key (library/arena/shrine_of_pact) from the umbrella type (event) so adjacency rules resolve to the specific row even when multiple tiles share a type"
  - "cardUpgradeDiscount consumed via setActiveBuffs() module pattern (mirrors CardResolver and RestSiteSystem) — no DI rewrite to ShopSystem"
  - "stat_buff synergy bonus carries the stat axis via a scale shim ({ stat, per:1, value:0 }) so the existing applyEffect signature is reused"
  - "cooldown_reduction synergy bonus stays out of CardResolver and writes state.nextCardCooldownReduction directly via SynergySystem.applyDirectSynergyBonus (cooldown is engine-owned, not card-resolution-owned)"
  - "VIT bonus tops up currentHP by the bonus amount on combat start so VIT surfaces on first combat after gain (not silently after a heal)"
  - "INT damage bonus applied POST-defense subtraction so high-defense enemies can't eat the entire INT contribution"
  - "TileSlot.kind is OPTIONAL — existing buffer/basic tiles use the terrain/type fallback path; no migration needed for in-flight runs"
  - "stealth charges decrement happens in EnemyAI.applyDamage (not CombatEngine) — keeps the consumer next to the damage path it gates"

patterns-established:
  - "Pattern A: New combat events emit BEFORE the trigger dispatch so HUD listeners see fresh state. Trigger dispatch then mutates CombatState (relic effects)."
  - "Pattern B: dispatchTriggerRelics signature is uniform (trigger, relicIds, state) — works for in-combat AND out-of-combat triggers (rest_used / shop_visited just emit the event; in-combat dispatchers also mutate state)."
  - "Pattern C: applyStatDelta() centralizes statDeltas mutation AND emits stat_changed — single seam for the trigger, no scattered call-sites."

requirements-completed:
  - D-01
  - D-10
  - D-13

duration: ~85min
completed: 2026-05-11
---

# Phase 09 — Plan 03 Summary

**Shadowblade is registered, mechanically playable, and every Phase 9 mechanic — Combo Points, Poison/DoT, Stealth, stat scaling, new bonus types, new relic triggers — resolves end-to-end.**

A Shadowblade run created via `createNewRun(undefined, 1, 'shadowblade')` can build CP with Backstab, spend with Eviscerate, ramp Poison with Toxic Coat, vanish with Shadowstep, and survive a hit with Veil Guard — all in the existing CombatEngine tick loop with no further wiring needed. UI surfaces (HUD widgets, CharacterSelect entry) are Plan 4's job; the engine has live state for them to read.

## Performance

- **Duration:** ~85 min
- **Completed:** 2026-05-11
- **Tasks:** 5/5
- **Files created:** 1
- **Files modified:** 22 (15 source, 7 tests)
- **New tests added:** ~50 (across 6 test files; all green)

## Accomplishments

### Task 1 — Shadowblade class registration
- New `src/systems/hero/ShadowbladeClass.ts` with base stats per design/03 §2 (maxHP 60, DEX 8, INT 1, defense 0.8) and the 10-card starter deck composition (4× backstab, 2× eviscerate, 2× shadowstep, 1× toxic-coat, 1× veil-guard).
- `CLASS_REGISTRY.shadowblade` + `CLASS_SPRITE_PREFIX.shadowblade = 'mage'` (D-08 placeholder).
- `createNewRun()` already class-agnostic via `getClassDef(className)` → no RunState changes required.
- **Commit:** `edbb495`

### Task 2 — 3 new tiles + 6 adjacency rules + cardUpgradeDiscount
- `src/data/tiles.json` adds library / arena / shrine_of_pact with the LOCKED hex palette (`#7E5BEF`, `#C12B2B`, `#5A2A6B`) carried via a new `hexColor` field alongside the existing integer `color`.
- `src/data/synergies.json` (the TILE-adjacency file, NOT `src/data/json/synergies.json`) appends the 6 design/04 §7 rules verbatim.
- `TileSlot.kind?: string` carries the registry key so library/arena/shrine_of_pact (which all share `type: 'event'`) resolve to their distinct adjacency rows.
- `SynergyResolver.getTileKey` prefers `kind > terrain > type` (forward-compatible with legacy slots).
- `ShopSystem.setActiveBuffs()` + `getCardUpgradeDiscount()` consumer pattern (same shape as `CardResolver` / `RestSiteSystem`).
- `ShopSystem.upgradeCard` applies the discount: `Math.max(0, Math.floor(basePrice * (1 - discount)))`. 0.20 discount on common 50g → 40g.
- **Commit:** `27fbf72`

### Task 3 — CardResolver new effect cases + scale + synergy routing
- 8 new CardEffect.type cases: `gain_combo`, `consume_combo`, `stealth`, `dot`, `stack`, `buff`, `debuff_stat`, `taunt`.
- Scale clause applied uniformly: `resolvedValue = value + floor(stat / per) * value` (via `readStat` from HeroStatsResolver).
- SPI scales heal effects (+10% per point).
- Arcane stacks clamp at `state.arcaneStacksCap` (Pitfall 8 cap-and-drop).
- Per-combat buff effect mutates `state.heroXxx` ONLY, NEVER `run.hero` (T-09-03-01 trust boundary; asserted in test).
- `mapBonusToEffectType()` routes synergy bonus types to existing effect cases: `combo_point→gain_combo`, `stealth→stealth`, `dot→dot`, `stat_buff→buff`, `cooldown_reduction` reserved for Task 5's direct mutator.
- **Commit:** `4775988`

### Task 4 — CombatEngine DoT cadence, stat scaling, Stealth evade
- `tickActiveDoTs(triggeringCardId)` runs AFTER each card resolves and BEFORE deck-pointer advance (Pitfall 4 attribution preserved).
- Poison: `stacks * (1 + floor(DEX/4))` damage per tick; -1 stack/tick unless `state.poisonDecayDisabled` (widows-kiss / empress-fang flip this).
- Bleed / burn / freeze / shock all have skeletons; burn scales with INT.
- DEX cooldown reduction: `Math.min(0.60, heroDexterity * 0.02)` applied in BOTH `playNextCard` (engine schedule) AND `getHeroMaxCooldown` (HUD bar sync).
- INT adds +1 flat damage per point on magic-category cards (applied POST-defense).
- VIT adds +5 maxHP per point at `createCombatState` (combat-start hook); currentHP topped up by the bonus.
- SPI grants `+floor(SPI/2)` stamina on shuffle; INT grants `+floor(INT/2)` mana on shuffle (design/00 §3).
- `EnemyAI.applyDamage` consumes `evadeNextHit` + 1 stealth charge (emits `combat:evade`); flag clears when charges hit 0.
- `CombatState.nextCardCooldownReduction: number` one-shot field (Task 5 producer).
- EventBus extended with 7 new combat events: `dot-tick`, `evade`, `combo-played`, `enemy-killed`, `card-drawn`, `rest-used`, `shop-visited`, `stat-changed`.
- **Commit:** `b48b74b`

### Task 5 — SynergySystem + RelicSystem extensions
- `applyDirectSynergyBonus(synergy, state)` handles bonus types that mutate `CombatState` directly (currently `cooldown_reduction` only). Accumulates into `state.nextCardCooldownReduction`.
- CombatEngine dispatches 5 in-combat triggers: `combo_played` (after synergy resolves), `dot_tick` (inside `tickActiveDoTs` per stack), `enemy_killed` (in `checkEndConditions`), `card_drawn` (in `advanceDeckPointer`), `stat_changed` (via new `applyStatDelta` helper in `RunState.ts`).
- `RestSiteSystem.applyRestChoice` emits `combat:rest-used`.
- `ShopSystem.notifyShopVisited()` static helper emits `combat:shop-visited` (ShopScene call-site is Plan 4's wiring).
- `RelicSystem.dispatchTriggerRelics(trigger, relicIds, state)` routes through 7 effectType cases: `stat_bonus`, `heal_flat`, `damage_flat`, `gain_combo`, `gain_stealth`, `add_poison`, `disable_poison_decay`, with a safe no-op default for unknown effectTypes.
- **Commit:** `cffe878`

## Tiles + adjacency — locked spec

| Tile | Hex (locked) | Decimal | Icon | Type umbrella | Tile point cost |
|---|---|---|---|---|---|
| `library` | `#7E5BEF` | 8281071 | L | event | 4 |
| `arena` | `#C12B2B` | 12659499 | A | event | 5 |
| `shrine_of_pact` | `#5A2A6B` | 5908075 | P | event | 4 |

| TileA | TileB | Bonus type | Value | Display |
|---|---|---|---|---|
| `library` | `shop` | `cardUpgradeDiscount` | 0.20 | Scholarly Bargain |
| `library` | `graveyard` | `xpBonus` | 0.25 | Cursed Knowledge |
| `arena` | `rest` | `hpRecoveryBonus` | 0.20 | Medic Tent |
| `arena` | `forest` | `damageBonus` | 0.15 | Ambush Crowd |
| `shrine_of_pact` | `treasure` | `goldDropBonus` | 0.30 | Richer Pact |
| `shrine_of_pact` | `graveyard` | `tileDropBonus` | 0.20 | Necropact |

## Formulas confirmed

- **Poison per-tick:** `stacks * (1 + floor(DEX/4))` (A2)
- **Poison decay:** -1 stack/tick unless `state.poisonDecayDisabled` (A1)
- **Stealth cap:** `state.stealthCap` (default 4) (A4)
- **Combo Points cap:** `state.comboPointsCap` (default 5; chalice raises to 8)
- **Arcane cap:** `state.arcaneStacksCap` (default 10, silent truncation — Pitfall 8)
- **DEX cooldown:** `Math.min(0.60, dex * 0.02)` reduction
- **INT damage:** `+1 flat per point on category='magic'` (applied POST-defense)
- **VIT maxHP:** `+5 per point at combat start`
- **SPI heal:** `+10% per point` (`floor(resolvedValue * 0.10 * SPI)`)
- **SPI stamina on shuffle:** `+floor(SPI/2)`
- **INT mana on shuffle:** `+floor(INT/2)`

## Decisions Made

- **`TileSlot.kind` discriminator over re-typing 'event' umbrella:** keeps the v1 type union stable and lets library/arena/shrine_of_pact share `type='event'` for runtime treatment while still resolving distinct adjacency rules.
- **`hexColor` field added alongside `color`:** the engine still reads integer `color` (no consumer changed). `hexColor` exists for grep / future text display / verifier auditing — non-breaking.
- **Synergy `cooldown_reduction` mutates state directly:** routing it through `CardResolver.applyEffect` would have required a brand-new effect case AND a brand-new field signal. Direct write into `state.nextCardCooldownReduction` is one line and keeps cooldown ownership in CombatEngine.
- **Per-card-resolve `combo_played` trigger:** fires once per synergy, NOT once per CP gain. Matches the "combo" semantics in design/00 §5 (a synergy is "the combo").
- **`card_drawn` fires once per `advanceDeckPointer`:** the "drawn" card is the new top card. After reshuffle, the post-reset card is still drawn. Triggering relics that scale damage off draws can stack across reshuffles naturally.
- **`shop_visited` is a passive emit, scene-driven:** ShopScene must call `ShopSystem.notifyShopVisited()` in its `create()` hook (Plan 4 task — surfaced in hand-off notes below). Calling it from `ShopSystem.getShopCards` would fire it twice if the scene re-fetches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — missing critical functionality] EventBus didn't declare new combat events**
- **Found during:** Task 4 typecheck (after adding `eventBus.emit('combat:dot-tick', ...)` etc.)
- **Issue:** `GameEvents` interface in `src/core/EventBus.ts` only declared v1 events. New `combat:dot-tick`, `combat:evade`, etc. were `TS2345` errors.
- **Fix:** Extended `GameEvents` with 7 new combat event types (dot-tick, evade, combo-played, enemy-killed, card-drawn, rest-used, shop-visited, stat-changed).
- **Files modified:** `src/core/EventBus.ts`
- **Verification:** typecheck dropped from 29 → 24 (back to Plan 1 baseline).
- **Committed in:** `b48b74b`

**2. [Rule 3 — blocking test mocks] 3 test mocks needed `nextCardCooldownReduction` backfill**
- **Found during:** Task 4 typecheck after adding the field to `CombatState`.
- **Issue:** `card-resolver.test.ts`, `enemy-ai.test.ts`, `shadowblade-mechanics.test.ts` build CombatState literals manually and would fail `TS2741` without the new field.
- **Fix:** Added `nextCardCooldownReduction: 0` to each test's `makeState` factory.
- **Files modified:** 3 test files.
- **Verification:** typecheck stayed at 24 baseline.
- **Committed in:** `b48b74b`

**3. [Rule 1 — pre-existing test out of date] `TileRegistry.test.ts` placeable count assertion**
- **Found during:** Final full-suite run.
- **Issue:** Test asserted `getAllPlaceableTiles()` returns 7 entries, but Task 2 added 3 placeable tiles (library / arena / shrine_of_pact), bumping to 10.
- **Fix:** Updated the assertion to 10 with a comment citing Phase 9.
- **Files modified:** `tests/systems/TileRegistry.test.ts`
- **Verification:** test green; updated expectation reflects intended Plan 3 reality.
- **Committed in:** `cffe878`

### Plan-vs-reality observations (not deviations)

- Plan said `src/data/json/synergies.json` shouldn't be touched. Confirmed via `git diff 99110f4 src/data/json/synergies.json` (empty). Pitfall 1 avoided.
- Plan said `cardUpgradeDiscount` may require new SynergyResolver handler. In practice, the resolver emits any `bonus.type` as the `SynergyBuff.type` string verbatim; no resolver change needed. ShopSystem reads it via `getCardUpgradeDiscount()`.
- Plan said `src/data/types.ts` `CardEffect.type` includes the 8 new tags. Confirmed (Plan 1 landed this already).

## Known Stubs

The following stubs are **intentional** and **documented in code comments**. None block the plan's success criteria (Shadowblade run mechanically playable):

| File | Line | Stub | Rationale |
|---|---|---|---|
| `src/systems/combat/CardResolver.ts` | `case 'debuff_stat'` | no-op | Enemies have no stat axes in v2. Forward-compatible stub. |
| `src/systems/combat/CardResolver.ts` | `case 'taunt'` | no-op | No v2 engine behavior specified. Forward-compatible stub. |
| `src/systems/combat/CombatEngine.ts` | `tickActiveDoTs` shock branch | placeholder formula | design/02 mage burn line — final formula is a future tuning pass. |
| `src/systems/hero/ClassRegistry.ts` | Shadowblade sprite prefix | reuses 'mage' | D-08: placeholder visuals; Plan 4 tints. |
| `src/systems/ShopSystem.ts` | `notifyShopVisited` | unused | ShopScene call-site is Plan 4 wiring (no UI surface in this plan). |

## Deferred Issues

- **`MetaPersistence.test.ts` version mismatch (PRE-EXISTING, Plan 1 test debt):** asserts `loaded.version === 5` but Plan 1 bumped MetaState to v6. This was a Plan 1 test-debt oversight (NOT caused by this plan). Out of scope here per the executor's scope-boundary rule. Logged for a future cleanup pass.
- **`combat-engine.test.ts` + `balance-validation.test.ts` missing setRun (PRE-EXISTING, baseline):** 16 tests fail because their test mocks construct CombatEngine without calling `setRun(run)` first. `executeCard` reads `getRun().stats` — fails. This pre-dates Phase 9 and is part of the 24-error typecheck baseline. Out of scope.
- **`tests/content/rpu.test.ts` + `tests/content/content.test.ts` RED:** Plan 1 documented these are RED until Plan 2 lands content. Not regressions.

## Threat surface scan

Reviewed STRIDE register T-09-03-01 → T-09-03-09:

| Threat | Mitigation in this plan | Status |
|---|---|---|
| T-09-03-01 (buff leak into run.hero) | `case 'buff'` writes ONLY to `state.heroXxx`; test asserts `run.hero.dexterity` unchanged. | mitigated |
| T-09-03-02 (DoT infinite loop) | `tickActiveDoTs` invoked once per `executeCard`. Relic dispatch inside doesn't re-invoke `tickActiveDoTs`. | mitigated |
| T-09-03-03 (Stealth + AoE) | Forward-compatible primary-target test in shadowblade-mechanics. 1v1 today; structurally correct. | mitigated |
| T-09-03-04 (arcane overflow) | `case 'stack'` for arcane clamps via `Math.min`. Test 7 asserts cap. | mitigated |
| T-09-03-05 (wrong synergies file) | `git diff 99110f4 src/data/json/synergies.json` empty. | mitigated |
| T-09-03-06 (DoT attribution) | `tickActiveDoTs(card.id)` runs AFTER resolve, BEFORE pointer-advance. `sourceCard` carried on emit. | mitigated |
| T-09-03-07 (save corruption) | Plan 1's v3/v4/v5 → v6 wipe handles this; Plan 3 doesn't bump versions. | accepted |
| T-09-03-08 (iron-skin cross-class) | classRestriction enforced by SynergySystem.check; no Plan 3 change. | mitigated |
| T-09-03-09 (missing trigger handler) | TypeScript exhaustive switch; `dispatchTriggerRelics` has safe no-op default. | mitigated |

No new threat surface introduced.

## Plan 4 Hand-off Notes

**HUD widgets now have live CombatState fields to render:**
- `state.comboPoints` / `state.comboPointsCap` (Shadowblade-only HUD)
- `state.stealthCharges` / `state.stealthCap` (Shadowblade-only HUD)
- `state.evadeNextHit` (Stealth indicator visibility)
- `state.poisonStacks` (enemy-side debuff icon)
- `state.arcaneStacks` / `state.arcaneStacksCap` (Mage HUD)
- `state.heroVitality` / `heroDexterity` / `heroIntellect` / `heroSpirit` (stats panel)

**Trigger events Plan 4 should subscribe to for HUD pulses:**
- `combat:dot-tick` → poison damage popup
- `combat:evade` → "Evaded!" splash on hero portrait
- `combat:combo-played` → combo callout above hero
- `combat:enemy-killed` → kill-popup hook (already partially wired via `combat:end`)
- `combat:card-drawn` → next-card preview animation

**Call-sites Plan 4 must wire:**
- `ShopSystem.notifyShopVisited()` in ShopScene's `create()` hook (currently never called — the emit is in place but no UI invokes it).
- CharacterSelect screen: add Shadowblade as a third selectable class (unlocked by default per D-10). Sprite key `mage` (per `CLASS_SPRITE_PREFIX.shadowblade='mage'`) with `#7E5BEF` tint per D-08.

**Class-conditional HUD gating:**
- CP pips: render iff `hero.className === 'shadowblade'`.
- Stealth indicator: render iff `hero.className === 'shadowblade' && state.stealthCharges > 0`.
- Arcane stacks: render iff `hero.className === 'mage' && state.arcaneStacks > 0`.

## Self-Check: PASSED

### Files created/modified — existence verification

- `src/systems/hero/ShadowbladeClass.ts` — FOUND
- `src/systems/hero/ClassRegistry.ts` — FOUND (shadowblade entry confirmed)
- `src/data/tiles.json` — FOUND (3 new tiles confirmed via `node -e` check: `true`)
- `src/data/synergies.json` — FOUND (12 entries: 6 existing + 6 new)
- `src/systems/TileRegistry.ts` — FOUND (`kind` field added)
- `src/systems/SynergyResolver.ts` — FOUND (`getTileKey` uses kind)
- `src/systems/ShopSystem.ts` — FOUND (`setActiveBuffs`, `getCardUpgradeDiscount`, `notifyShopVisited`)
- `src/systems/RestSiteSystem.ts` — FOUND (emit `combat:rest-used`)
- `src/systems/combat/CombatEngine.ts` — FOUND (`tickActiveDoTs`, trigger dispatches)
- `src/systems/combat/CombatState.ts` — FOUND (`nextCardCooldownReduction`, VIT maxHP bump)
- `src/systems/combat/CardResolver.ts` — FOUND (8 new effect cases, scale clause)
- `src/systems/combat/SynergySystem.ts` — FOUND (`applyDirectSynergyBonus`)
- `src/systems/combat/RelicSystem.ts` — FOUND (`dispatchTriggerRelics`)
- `src/systems/combat/EnemyAI.ts` — FOUND (evadeNextHit consumption)
- `src/state/RunState.ts` — FOUND (`applyStatDelta`)
- `src/core/EventBus.ts` — FOUND (7 new event types)

### Commit verification

- Task 1 — `edbb495` — Shadowblade class — FOUND
- Task 2 — `27fbf72` — 3 tiles + 6 rules + cardUpgradeDiscount — FOUND
- Task 3 — `4775988` — CardResolver new effect cases — FOUND
- Task 4 — `b48b74b` — CombatEngine DoT + stat scaling — FOUND
- Task 5 — `cffe878` — SynergySystem + RelicSystem extensions — FOUND

### Test verification

- `npx tsc --noEmit`: 24 errors (Plan 1 baseline; zero new errors introduced)
- `npx vitest run tests/systems/combat/shadowblade-mechanics.test.ts`: 37 PASSED
- `npx vitest run tests/systems/combat/synergy.test.ts`: 11 PASSED
- `npx vitest run tests/systems/SynergyResolver.test.ts`: 15 PASSED
- `npx vitest run tests/systems/ShopSystem.test.ts`: 30+ PASSED (includes 3 new discount tests)
- `npx vitest run tests/state/runstate.test.ts`: 13 PASSED (includes 3 new Shadowblade tests)
- `git diff 99110f4 src/data/json/synergies.json`: empty (Pitfall 1 confirmed — Plan 2's card-synergies file untouched)

## Next Phase Readiness

- **Plan 4 (UI) unblocked:** all the CombatState fields Plan 4 needs to render Shadowblade/Mage class-conditional widgets are live. Event subscriptions ready. CharacterSelect entry data ready.
- **Plan 2 (content) unblocked further:** card/relic/synergy authors can now use any of the 8 new CardEffect types, 5 new SynergyDefinition.bonus types, and 7 new RelicTrigger handlers without engine-side stubs.

---
*Phase: 09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status*
*Plan: 03*
*Completed: 2026-05-11*
