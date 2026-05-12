---
phase: 09-implement-design-v2-shadowblade-class-vit-dex-int-spi-status
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - src/core/EventBus.ts
  - src/core/SaveManager.ts
  - src/data/types.ts
  - src/scenes/CharacterSelectScene.helpers.ts
  - src/scenes/CharacterSelectScene.ts
  - src/scenes/MainMenu.helpers.ts
  - src/scenes/MainMenu.ts
  - src/scenes/Preloader.ts
  - src/state/MetaState.ts
  - src/state/RunState.ts
  - src/systems/MetaPersistence.ts
  - src/systems/RestSiteSystem.ts
  - src/systems/ShopSystem.ts
  - src/systems/SynergyResolver.ts
  - src/systems/TileRegistry.ts
  - src/systems/combat/CardResolver.ts
  - src/systems/combat/CombatEngine.ts
  - src/systems/combat/CombatState.ts
  - src/systems/combat/EnemyAI.ts
  - src/systems/combat/RelicSystem.ts
  - src/systems/combat/SynergySystem.ts
  - src/systems/hero/ClassRegistry.ts
  - src/systems/hero/HeroStatsResolver.ts
  - src/systems/hero/MageClass.ts
  - src/systems/hero/ShadowbladeClass.ts
  - src/systems/hero/WarriorClass.ts
  - src/ui/CombatHUD.ts
  - src/ui/LoopHUD.helpers.ts
  - src/ui/LoopHUD.ts
  - src/ui/StyleConstants.ts
findings:
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Phase 9 introduces the Shadowblade class, the VIT/DEX/INT/SPI status system, and a hard v3/v4/v5 → v6 save wipe. The implementation is broadly faithful to the design docs and the class-conditional HUD gating correctly hides Shadowblade-only widgets for Warrior/Mage runs.

Two critical issues surface around the third-class integration: the Preloader monster sprite list silently overwrites the freshly-loaded `mage_idle/walk/attack/death` hero spritesheets (every hero Mage AND Shadowblade now renders as the monster Mage), and `MetaState.classXP` was not widened to include `shadowblade`, so any XP-banking code touching `meta.classXP[heroClass]` for a Shadowblade run will write to an undeclared field or crash under strict access.

Several combat-math correctness issues are worth fixing before balance work begins: the `dot_tick` relic trigger only fires inside the poison branch (bleed/burn/shock DoT ticks skip the dispatch), `card_drawn` is dispatched after the killing-blow card so relics fire on a dead enemy, and the Rest Site `train` choice describes a damage boost it never actually applies.

## Critical Issues

### CR-01: Hero Mage spritesheets are overwritten by monster Mage spritesheets

**File:** `src/scenes/Preloader.ts:61-72`
**Issue:** Lines 61-64 load the hero Mage spritesheets (`mage_idle`, `mage_walk`, `mage_attack`, `mage_death`). Lines 67-72 then iterate over `monsterIds` which contains `'mage'`, causing Phaser to re-register the same texture keys (`mage_idle`, `mage_attack`, `mage_death`) from `assets/characters/monsters/mage/spritesheets/...`. Phaser's loader silently replaces the earlier registration. Net effect: the hero Mage class renders as the monster Mage sprite. Per D-08, the Shadowblade reuses `mage_idle` as a tinted placeholder — so Shadowblade ALSO renders as the monster Mage. `CharacterSelectScene.ts:148` then tints the monster sprite with `SHADOWBLADE_PALETTE.shadowblade`, hiding the regression visually on the select screen.
**Fix:** Rename the monster texture keys to avoid colliding with hero keys, or skip `'mage'` from `monsterIds` if no enemy uses it:
```ts
// Option A: namespace monster keys
const monsterIds = ['slime', 'goblin', 'orc', 'mage', 'elite_knight', 'boss_demon'];
for (const id of monsterIds) {
  this.load.spritesheet(`monster_${id}_idle`,
    `assets/characters/monsters/${id}/spritesheets/${id}_idle.png`,
    { frameWidth: 64, frameHeight: 64 });
  // ... same for _attack, _death
}
// Option B: drop 'mage' if no enemy spawns it
const monsterIds = ['slime', 'goblin', 'orc', 'elite_knight', 'boss_demon'];
```
Whichever path is taken, audit `ClassRegistry.CLASS_SPRITE_PREFIX` consumers and any enemy-render code that resolves `${enemyId}_idle` so the rename propagates.

### CR-02: MetaState.classXP is missing the shadowblade field

**File:** `src/state/MetaState.ts:18` (also `createDefaultMetaState` at line 61 and migration at lines 122-130)
**Issue:** `MetaState.classXP` is typed as `{ warrior: number; mage: number }` — no `shadowblade`. `createDefaultMetaState()` likewise initializes only `{ warrior: 0, mage: 0 }`. With `strict` TypeScript any read like `meta.classXP[run.hero.className]` for a Shadowblade run is `undefined`, and any write (`meta.classXP.shadowblade += xp`) is either a type error or silently lands on a typo'd field. The Phase-9 v6 wipe path resets the rest of MetaState but does not update the `classXP` shape itself, so all three classes co-exist functionally only if every consumer narrows class names defensively.
**Fix:** Widen the type and default shape:
```ts
classXP: { warrior: number; mage: number; shadowblade: number };
// in createDefaultMetaState:
classXP: { warrior: 0, mage: 0, shadowblade: 0 },
// in migrateMetaState v3→v4 (and rename the milestone to v6 for clarity):
classXP: {
  warrior: raw.classXP?.warrior ?? 0,
  mage: raw.classXP?.mage ?? 0,
  shadowblade: raw.classXP?.shadowblade ?? 0,
},
```
The v6 wipe migration already returns a fresh default (via `createDefaultMetaState()`), so once the default includes `shadowblade: 0`, post-wipe saves will be correct; the field add still needs to land in the type and the default factory.

## Warnings

### WR-01: dot_tick relic trigger only dispatches on poison ticks

**File:** `src/systems/combat/CombatEngine.ts:305-357`
**Issue:** `tickActiveDoTs` dispatches `dispatchTriggerRelics('dot_tick', ...)` at line 320, inside the poison branch only. Bleed (line 325), burn (line 335), and shock (line 350) all emit `combat:dot-tick` events but skip the relic dispatch. Any relic with `trigger: 'dot_tick'` only fires on poison stacks — bleed/burn/shock heroes (Warrior bleed, Mage burn) get nothing.
**Fix:** Move the dispatch so it fires once per DoT type that actually ticked this cycle, OR after the entire DoT pass:
```ts
let anyDotTicked = false;
if (state.poisonStacks > 0) { /* ... */ anyDotTicked = true; }
if (state.bleedStacks > 0)  { /* ... */ anyDotTicked = true; }
if (state.burnStacks > 0)   { /* ... */ anyDotTicked = true; }
if (state.shockStacks > 0)  { /* ... */ anyDotTicked = true; }
if (anyDotTicked) dispatchTriggerRelics('dot_tick', state.activeRelicIds ?? [], state);
```
Or dispatch once per DoT type if multiple-fire-per-tick is the intended semantics — but be explicit about which.

### WR-02: card_drawn dispatches on a dead enemy after the killing blow

**File:** `src/systems/combat/CombatEngine.ts:369-378` (also `executeCard` flow at line 294)
**Issue:** `executeCard` calls `advanceDeckPointer()` at line 294 BEFORE the outer `tick()` re-runs `checkEndConditions()`. So after a card kills the enemy: (1) damage applied, (2) `advanceDeckPointer()` fires `dispatchTriggerRelics('card_drawn', ...)` mutating CombatState on a corpse (could deal more enemy damage, gain CP, etc.), and (3) only THEN does `tick()` see `enemyHP <= 0` and emit `combat:end`. Any `card_drawn`-triggered relic effect that reads `state.enemyHP` or writes to it produces nonsense (NaN HP if the relic divides by HP, negative HP, etc.) and the `combat:card-drawn` event fires for a card that will never actually be played.
**Fix:** Gate the dispatch on `enemyHP > 0` and `heroHP > 0`, or short-circuit `executeCard` to call `checkEndConditions` itself and bail before `advanceDeckPointer`:
```ts
private advanceDeckPointer(): void {
  this.deckPointer++;
  // Skip 'card_drawn' dispatch if combat already ended this card.
  if (this.state.enemyHP > 0 && this.state.heroHP > 0) {
    const nextCardId = this.state.deckOrder[this.deckPointer >= this.state.deckOrder.length ? 0 : this.deckPointer];
    if (nextCardId) {
      dispatchTriggerRelics('card_drawn', this.state.activeRelicIds ?? [], this.state);
      eventBus.emit('combat:card-drawn', { cardId: nextCardId });
    }
  }
  // ...rest unchanged
}
```

### WR-03: Rest Site 'train' choice is cosmetic-only — no damage boost is applied

**File:** `src/systems/RestSiteSystem.ts:47-54`
**Issue:** The `'train'` branch selects a random card via the RNG, reads `cardId`, and returns `description: 'Boosted ${cardId} damage by +${restConfig.trainDamageBonus}.'` but never mutates RunState. There is no per-card damage modifier field on `RunState.deck` and no equivalent of `deck.upgraded` for a partial buff. Players see the message but the damage boost is fictional. Either this is intentional placeholder copy (in which case the description lies to the player) or the mutation step was lost. Compounding the issue: `idx` is computed but never used after the cardId read.
**Fix:** Either implement the mutation (e.g., extend `DeckState` with `trainBonuses: Record<number, number>` keyed by deck position, read by `CardResolver.resolve`), or change the copy to reflect what actually happens (e.g., flip the upgrade flag on that position):
```ts
case 'train': {
  if (runState.deck.active.length === 0) return { choice, description: 'No cards to train.' };
  const idx = Math.floor(rng() * runState.deck.active.length);
  const cardId = runState.deck.active[idx];
  if (runState.deck.upgraded[idx]) {
    return { choice, description: `${cardId} is already upgraded.` };
  }
  runState.deck.upgraded[idx] = true;
  return { choice, description: `Upgraded ${cardId} (+).` };
}
```
The dead `idx` warning auto-resolves with this change.

### WR-04: Burn DoT formula adds a flat INT bonus regardless of stack count

**File:** `src/systems/combat/CombatEngine.ts:335-342`
**Issue:** `dmg = state.burnStacks + Math.floor(state.heroIntellect / 2)`. With 1 burn stack and INT=8: dmg = 1 + 4 = 5. With 5 burn stacks and INT=8: dmg = 5 + 4 = 9. The INT contribution is constant rather than per-stack, so high-stack burn at high INT looks underwhelming versus high-stack poison (which IS per-stack: `poisonStacks * dexBonus`). Design/00 §3 describes INT scaling on burn — verify whether the intent is `burnStacks * (1 + floor(INT/2))` (multiplicative, parallels poison) or the current flat-add form.
**Fix:** If multiplicative is intended (matches design/00):
```ts
const intMult = 1 + Math.floor(state.heroIntellect / 2);
const dmg = state.burnStacks * intMult;
```
Document the choice with an inline comment so the next balance pass doesn't accidentally regress it.

### WR-05: Loop synergy wraparound creates a phantom boss↔first-tile adjacency

**File:** `src/systems/SynergyResolver.ts:48-60`
**Issue:** `playable[(i + 1) % playable.length]` treats the loop as a true ring, so the LAST playable tile (typically the boss) is checked against the FIRST playable tile for adjacency synergy. Linear loop traversal never visits boss-then-first in sequence, so any synergy buff that resolves from this pair is a free buff the player wins by accident of tile ordering. The buffer-tile exclusion comment in the function already shows awareness that buffer/boss boundaries need care; the wraparound contradicts that intent.
**Fix:** Decide whether the loop is a ring or a line and document it. If linear (recommended for v2's autoscroller geometry):
```ts
for (let i = 0; i < playable.length - 1; i++) {
  const next = playable[i + 1];
  // ...
}
```
If ring (current behavior), document that boss-end synergy is intentional and add a unit test that asserts the wraparound buff is real.

### WR-06: MainMenu schedules showWelcomeNotice via a callback that can never fire

**File:** `src/scenes/MainMenu.ts:51-54`
**Issue:** The code registers `this.events.once('create', () => this.showWelcomeNotice(wipedFrom))` while already executing inside `create()`. The `'create'` event fires before `create()` is called, so the callback never runs. The subsequent `this.time.delayedCall(50, ...)` is what actually surfaces the notice. The dead `events.once` line is misleading: a future refactor that hoists the wipe-flag consumption out of `create()` could leave both callbacks armed, producing a duplicate notice.
**Fix:** Remove the dead `events.once('create', ...)` registration. The `delayedCall(50)` alone is sufficient, and the comment block already explains why it exists:
```ts
if (wipedFrom !== undefined) {
  await saveMetaState(meta);
  // Defer until next tick so the menu's UI is built first.
  this.time.delayedCall(50, () => this.showWelcomeNotice(wipedFrom));
}
```

### WR-07: LoopHUD.update divides by maxHP without a zero-guard

**File:** `src/ui/LoopHUD.ts:312`
**Issue:** `this.hpBar.width = this.HP_BAR_W * (runState.hero.currentHP / runState.hero.maxHP)`. A corrupted save or a transient mid-migration state with `maxHP === 0` yields `NaN`, which Phaser silently propagates into the rectangle's width and breaks the bar. `setText` on line 313 also displays `currentHP/0`, which surfaces the corruption to the user but doesn't crash.
**Fix:** Clamp the denominator:
```ts
const maxHP = Math.max(1, runState.hero.maxHP);
this.hpBar.width = this.HP_BAR_W * (runState.hero.currentHP / maxHP);
```

## Info

### IN-01: applyStatTween spawns 4 tweens on every HUD update

**File:** `src/ui/LoopHUD.ts:245-263`, called from `update` at lines 324-327
**Issue:** Every `LoopHUD.update(runState, ...)` call runs `applyStatTween` four times (vit/dex/int/spi). The early-exit on `currentValue === newValue` short-circuits when stat is unchanged, but the scale-pulse tween on line 262 is added BEFORE the early-exit check returns — wait, the early-exit is at line 253, so this is fine. However, the parseInt parse-on-every-tick is wasteful; cache the last-applied value alongside `this.statTexts[key]`.
**Fix:** Track `this.lastStats: StatusRowData = { vit: 0, dex: 0, int: 0, spi: 0 }` and compare against that instead of `parseInt(txt.text, 10)`. Marginal perf, but it removes a string-to-int round-trip from a hot path.

### IN-02: applyStatDelta does an in-place assignment inside ?? defaulting

**File:** `src/state/RunState.ts:366-368`
**Issue:** `const d = run.hero.statDeltas ?? (run.hero.statDeltas = {});` — assignment as a fallback inside the `??` operator. The pattern works but is hard to read and surprises linters. The v3→v4 migration already backfills `statDeltas` to `{}` when missing (line 235), so the runtime guard is redundant for migrated saves.
**Fix:**
```ts
if (!run.hero.statDeltas) run.hero.statDeltas = {};
const d = run.hero.statDeltas;
d[stat] = (d[stat] ?? 0) + delta;
```

### IN-03: CharacterSelectScene recomputes startX after computeCardLayout already returns it

**File:** `src/scenes/CharacterSelectScene.ts:54-58`
**Issue:** `computeCardLayout()` returns `startX = margin + cardW / 2`. The caller then ignores `layout.startX` and re-derives it from `layout.margin + cardWidth / 2`. Either redundancy is fine but inconsistent — fix one or the other.
**Fix:** Use `layout.startX` directly:
```ts
const { cardW: cardWidth, cardH: cardHeight, gap, startX } = layout;
```

### IN-04: SaveManager.load dead branch — !migrated.version after migrateRunState

**File:** `src/core/SaveManager.ts:59`
**Issue:** `migrateRunState` always sets `raw.version` to the current `RUN_STATE_VERSION` before returning (or returns `null`). The `!migrated.version` clause in the wipe condition can therefore never be true after the migrate call succeeds. Harmless but misleading.
**Fix:** Drop the `!migrated.version` half of the condition:
```ts
if (migrated.version < RUN_STATE_VERSION) {
  await this.clear();
  // ...
}
```

### IN-05: Empty Shadowblade-class branch in tickActiveDoTs

**File:** `src/systems/combat/CombatEngine.ts:361-366`
**Issue:** The `if (state.heroClass === 'shadowblade')` block contains only a comment explaining there's no class-specific logic yet. The conditional itself can be removed until a hook is added.
**Fix:** Delete the empty conditional or add a `// TODO(phase 10): Shadowblade poison cadence override` marker so it's clear this is deferred work, not a forgotten branch.

### IN-06: Preloader hardcodes case-insensitive duplicate for mat_bone

**File:** `src/scenes/Preloader.ts:137`
**Issue:** `this.load.image('mat_bone', 'assets/icons/stone.png');` — bone shares the stone PNG, presumably as a placeholder. Worth flagging so it's not lost as authentic art is generated.
**Fix:** Add a `// TODO(art): bone icon placeholder (uses stone art)` comment, or move into a placeholder map so the swap is one-line later.

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
