---
phase: 08-plan-for-the-creation-of-all-sprites-monsters-with-animations-and-all-terrains
verified: 2026-03-29T14:30:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Run npm run dev, start a new game, walk into a combat tile. Verify enemy renders as pixel art sprite (NOT a colored square)."
    expected: "Enemy appears as a 64x64 pixel art sprite on the right side. Idle animation loops continuously."
    why_human: "Visual pixel art quality and animation playback require a running browser."
  - test: "In combat, play attack cards to hit the enemy. Verify it flashes white briefly then returns to idle."
    expected: "White tint flash lasts ~200ms then clears. Idle animation resumes."
    why_human: "Tint flash is a runtime Phaser behavior; cannot verify from static code."
  - test: "Wait for the enemy to attack the hero. Verify enemy plays its attack animation then returns to idle."
    expected: "Attack animation plays once, then idle animation resumes automatically."
    why_human: "Animation completion callback requires runtime verification."
  - test: "Look at the game world tiles. Verify special tiles (shop, rest, event, treasure, boss) show pixel art icons instead of text characters ($, R, ?, !, B)."
    expected: "Each special tile renders its 64x64 pixel art icon overlaid on the tile background."
    why_human: "TileVisual rendering depends on Phaser texture loading at runtime."
  - test: "Fight at least two different enemy types (e.g., slime vs goblin). Verify they have visually distinct sprites."
    expected: "Different enemy types use different pixel art characters, not the same sprite."
    why_human: "Art quality and visual distinction require human judgment."
---

# Phase 8: Pixel Art Sprites — Monsters & Special Tiles Verification Report

**Phase Goal:** Create all pixel art assets using PixelLab MCP tools: 6 monster characters with idle+attack animations, 5 special tile icon sprites. Build spritesheet pipeline for monsters. Replace colored rectangles in CombatScene with animated monster sprites and text icons in TileVisual with real tile art.
**Verified:** 2026-03-29T14:30:00Z
**Status:** human_needed — all automated checks pass; visual quality requires runtime verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each of the 6 enemy types has a PixelLab character with idle and attack animations | VERIFIED | All 6 monster dirs have metadata.json with "id" field; breathing-idle/south-east has 4 frames each; attack/south-east has 6-9 frames each |
| 2 | Each of the 5 special tile types has a distinct pixel art icon sprite | VERIFIED | tile_shop.png (2403B), tile_rest.png (4277B), tile_event.png (5225B), tile_treasure.png (3360B), tile_boss.png (2891B) — all present and > 100 bytes |
| 3 | All generated assets are in public/assets/ with organized directory structure | VERIFIED | public/assets/monsters/{id}/animations/{anim}/south-east/frame_NNN.png structure confirmed for all 6 monsters |
| 4 | Monster spritesheets are built as horizontal strips matching hero spritesheet format | VERIFIED | 12 spritesheets exist (6 idle + 6 attack), all > 500 bytes; scripts/build-spritesheets.mjs uses shared buildSpritesheet with baseDir/outDir params |
| 5 | Preloader loads all monster spritesheets and special tile sprites | VERIFIED | Preloader.ts lines 30-41: loop over monsterIds loads 12 spritesheets + 5 special tile images |
| 6 | TileVisual renders special tile sprites instead of text icons | VERIFIED | TILE_SPRITE_MAP in TileVisual.ts lines 10-14: shop, rest, event, treasure, boss all mapped; sprite shown, iconText hidden when texture exists |
| 7 | Enemies appear as animated sprites in combat instead of colored rectangles | VERIFIED | CombatScene.ts lines 110-123: textures.exists(idleKey) branch creates Sprite + plays idle; Rectangle fallback only when assets missing |
| 8 | Enemy idle animation plays continuously during combat | VERIFIED | CombatScene.ts line 118: `.play(idleKey)` with frameRate 4, repeat -1 |
| 9 | Enemy flashes white on hit then returns to idle animation | VERIFIED | CombatScene.ts lines 151-162: instanceof Phaser.GameObjects.Sprite guard; setTint(0xffffff) + delayedCall clearTint() |

**Score:** 9/9 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `public/assets/monsters/slime/` | Slime character frames and animations | VERIFIED | 4 idle + 9 attack frames, metadata.json, rotations, spritesheets |
| `public/assets/monsters/goblin/` | Goblin character frames and animations | VERIFIED | 4 idle + 6 attack frames, full directory structure |
| `public/assets/monsters/orc/` | Orc character frames and animations | VERIFIED | 4 idle + 6 attack frames, full directory structure |
| `public/assets/monsters/mage/` | Dark Mage character frames and animations | VERIFIED | 4 idle + 6 attack frames, full directory structure |
| `public/assets/monsters/elite_knight/` | Elite Knight character frames and animations | VERIFIED | 4 idle + 6 attack frames, full directory structure |
| `public/assets/monsters/boss_demon/` | Boss Demon character frames and animations | VERIFIED | 4 idle + 7 attack frames + extra walking animation, full structure |
| `public/assets/tiles/tile_shop.png` | Shop tile icon sprite | VERIFIED | 2403 bytes, valid PNG |
| `public/assets/tiles/tile_rest.png` | Rest site tile icon sprite | VERIFIED | 4277 bytes, valid PNG |
| `public/assets/tiles/tile_event.png` | Event tile icon sprite | VERIFIED | 5225 bytes, valid PNG |
| `public/assets/tiles/tile_treasure.png` | Treasure tile icon sprite | VERIFIED | 3360 bytes, valid PNG |
| `public/assets/tiles/tile_boss.png` | Boss tile icon sprite | VERIFIED | 2891 bytes, valid PNG |
| `scripts/build-spritesheets.mjs` | Spritesheet builder for hero + monsters | VERIFIED | Contains MONSTER_IDS array and monsterAnimations config; shared buildSpritesheet(anim) function |
| `src/scenes/Preloader.ts` | Asset loading for all monsters and special tiles | VERIFIED | Lines 30-41 load all 12 monster spritesheets + 5 special tile images |
| `src/ui/TileVisual.ts` | Special tile sprite rendering | VERIFIED | TILE_SPRITE_MAP has all 9 entries (4 terrain + 5 special); iconText hidden when sprite exists |
| `src/scenes/CombatScene.ts` | Monster sprite rendering in combat | VERIFIED | Sprite/Rectangle union type; enemyIdleKey/enemyAttackKey properties; instanceof guards throughout |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/build-spritesheets.mjs` | `public/assets/monsters/*/spritesheets/` | sharp composite | WIRED | MONSTER_IDS flatMap generates 12 anim configs; sharp builds horizontal strips to outDir |
| `src/scenes/Preloader.ts` | `public/assets/monsters/*/spritesheets/` | this.load.spritesheet | WIRED | Loop on line 31: `${id}_idle` and `${id}_attack` keys with frameWidth/Height 64 |
| `src/ui/TileVisual.ts` | `public/assets/tiles/tile_shop.png` | TILE_SPRITE_MAP | WIRED | shop: 'tile_shop' at line 10; scene.textures.exists(spriteKey) guard ensures proper fallback |
| `src/scenes/CombatScene.ts` | `src/scenes/Preloader.ts` | spritesheet key | WIRED | enemyIdleKey = `${enemyDef.id}_idle` at line 105; textures.exists(idleKey) check at line 110 |
| `src/scenes/CombatScene.ts` | `src/data/EnemyDefinitions.ts` | enemy.id for sprite key | WIRED | enemyDef.id used to construct both idle and attack keys at lines 105-106 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ART-01 | 08-01-PLAN | 6 enemy types have PixelLab-generated 64x64 pixel art characters | SATISFIED | All 6 monster directories with metadata.json exist; metadata contains "id" field; frame dimensions 64x64 |
| ART-02 | 08-01-PLAN | Each enemy has idle and attack animation frames (min 3 per animation) | SATISFIED | slime: idle=4 attack=9; goblin/orc/mage/elite_knight: idle=4 attack=6; boss_demon: idle=4 attack=7 — all >= 3 |
| ART-03 | 08-01-PLAN | 5 special tile types have distinct 64x64 pixel art icon sprites | SATISFIED | tile_shop, tile_rest, tile_event, tile_treasure, tile_boss all present and substantive |
| ART-04 | 08-02-PLAN | Monster animation frames composited into horizontal-strip spritesheets | SATISFIED | 12 spritesheets in /spritesheets/ subdirs (6 idle + 6 attack), built by extended build-spritesheets.mjs |
| ART-05 | 08-02-PLAN | Preloader loads all monster spritesheets + special tile sprites; TileVisual renders special tiles as sprites | SATISFIED | Preloader lines 30-41; TileVisual TILE_SPRITE_MAP lines 10-14; iconText.setVisible(false) when sprite loaded |
| ART-06 | 08-03-PLAN | CombatScene renders enemies as animated Phaser Sprites (idle loop + attack animation) instead of colored rectangles | SATISFIED | Union type Sprite|Rectangle; Sprite branch at lines 110-123; attack anim + animationcomplete callback at lines 207-214 |

No orphaned requirements — all 6 ART requirements in REQUIREMENTS.md are claimed by exactly one plan each and have verified implementation evidence.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/scenes/CombatScene.ts` | 30-31 | `heroLabel` and `enemyLabel` declared but never read (TS6133 warnings) | Info | Labels are created (lines 100-101, 124-126) and rendered, but the instance fields are not read back after assignment. Text objects display correctly in game; this is a TypeScript unused-variable warning only, not a runtime defect. |

Note: The `npx tsc --noEmit` run produced 29 TypeScript errors, but only 2 are in phase 08 modified files (CombatScene.ts lines 30-31 — unused variable declarations). The remaining 27 errors are pre-existing issues in other files not touched by this phase. The 2 phase-specific errors are cosmetic unused-variable warnings; they do not affect runtime behavior since the labels are actually created and added to the scene.

---

### Human Verification Required

#### 1. Enemy sprite renders in combat (not colored rectangle)

**Test:** Run `npm run dev`, start a new run, enter any combat tile.
**Expected:** Enemy on the right side is a pixel art sprite, not a colored square. Enemy species name matches the pixel art character shown.
**Why human:** Runtime Phaser texture loading and rendering cannot be verified from static code; asset existence is confirmed but visual output requires a browser.

#### 2. Enemy idle animation loops continuously

**Test:** In combat, watch the enemy for 5+ seconds without interacting.
**Expected:** Enemy sprite animates in a looping idle cycle (breathing, subtle movement).
**Why human:** Animation playback (frameRate 4, repeat -1) is a runtime Phaser behavior.

#### 3. Enemy white flash on player hit

**Test:** Play any attack card against the enemy.
**Expected:** Enemy flashes white briefly (~200ms) then returns to its normal colors and idle animation.
**Why human:** setTint/clearTint visual effect requires the running game.

#### 4. Enemy plays attack animation on its turn

**Test:** Wait for the enemy to attack (watch the combat timer / enemy turn).
**Expected:** Enemy plays its attack animation (frameRate 10), then automatically returns to idle.
**Why human:** animationcomplete event callback requires live event dispatch.

#### 5. Special tile sprites display correctly in game world

**Test:** In the game world, look for shop, rest, event, treasure, and boss tiles.
**Expected:** These tiles show pixel art icons (coin/shop, campfire, scroll/question mark, treasure chest, skull) instead of text characters like "$", "R", "?", "!", "B".
**Why human:** TileVisual sprite rendering depends on Phaser texture presence at scene creation time.

#### 6. Visual art quality and distinctiveness

**Test:** Fight at least two different enemy types by starting multiple runs.
**Expected:** Each enemy type has a visually distinct pixel art character matching its fantasy archetype (slime = blob, goblin = small humanoid, orc = large brute, etc.).
**Why human:** Art quality, style consistency with hero, and character distinctiveness require human aesthetic judgment.

---

### Gaps Summary

No automated gaps found. All 9 observable truths verified, all 15 artifacts present and substantive, all 5 key links confirmed wired, all 6 ART requirements satisfied.

The only open items are the 5 human verification tests above, which require the running game for visual confirmation. These were explicitly planned in the phase (08-03-PLAN Task 2: "checkpoint:human-verify gate: blocking") and noted as auto-approved in the SUMMARY. The phase plan intended human sign-off here.

Two cosmetic TypeScript unused-variable warnings exist in CombatScene.ts (heroLabel, enemyLabel declared but TypeScript sees them as "never read" — they are assigned to scene objects but the field references are not read post-assignment). This does not block gameplay.

---

_Verified: 2026-03-29T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
