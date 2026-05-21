# Audit Index — rogue-scroll

Eight parallel agents audited the codebase fresh (without reading TECH-DEBT.md / UAT.md). This index ranks findings cross-area by player impact and gives a fix triage. Open the per-area reports in `audit/` for full evidence.

- `audit/bugs.md` · 1 critical, 5 high, 6 medium, 4 low
- `audit/performance.md` · 6 high, 7 med, 7 low
- `audit/assets.md` · 2 broken refs, ~6.7MB orphan, oversized art
- `audit/ui.md` · 5 systemic + 20 specific
- `audit/ux.md` · 22 findings (5 high, 11 med, 6 low)
- `audit/gamedesign.md` · 6 high, 8 med, 3 low
- `audit/data.md` · 51+ broken refs, validator broken
- `audit/dead-code.md` · 5 unused files, ~25 unused exports

---

## 🔴 Critical — fix first

| # | Title | Where | Source |
|---|-------|-------|--------|
| C1 | **3 relics are silent no-ops.** `LoopRunner` reads/writes fields that aren't on its declared `LoopRunState` shape (`hero.currentHP`, `relics`). Travel Boots, Trailblazer's Brand, Lodestone Pendant produce `NaN` or never fire. | `src/systems/LoopRunner.ts:137-157, 230-234` ↔ `src/scenes/GameScene.ts:158` | bugs |

---

## 🟠 High — highest leverage

Ranked by player impact (not strictly by severity tag from each report).

### Player-visible breakage
| # | Title | Where | Trivial? |
|---|-------|-------|----------|
| H1 | **`bg_run.png` missing → Phaser draws its green/black "MISSING" checker on the main run map.** This is almost certainly the "missing texture" the user reported. | `src/scenes/Preloader.ts:99` + `src/scenes/GameScene.ts:82` | yes |
| H2 | `bg_forest.png` missing — silently degrades to "no decoration" via `textures.exists()`. | `src/scenes/Preloader.ts:24` + `TileVisual.ts:22` | yes |
| H3 | **Validator (`validate-data.mjs`) crashes on first run** — references `synergies.json` which doesn't exist. Project has no data CI. | `scripts/validate-data.mjs:38, 46` | yes |
| H4 | **24 phantom card IDs in `buildings.json`** Forge unlocks — meta-progression silently unlocks nothing. | `src/data/json/buildings.json` `forge.tiers[*].unlocks.cards` | no (design) |
| H5 | 3 phantom relic IDs in Shrine unlocks. | `src/data/json/buildings.json` `shrine.tiers` | no (design) |
| H6 | 5 phantom enemy IDs in `materials.json` enemyBonusDrops — no bonus drops ever fire. | `src/data/json/materials.json` | no (design) |

### Determinism / save integrity
| # | Title | Where | Trivial? |
|---|-------|-------|----------|
| H7 | **4 combat probability rolls bypass seeded RNG** (`Math.random()` instead of `SharedRNG.rand`). Breaks daily-run determinism and replay parity. | `src/systems/combat/CombatEngine.ts:406`; `src/systems/combat/RelicSystem.ts:214, 531, 532` | yes |
| H8 | `BossExitScene.confirmSelection` has no in-flight guard — Enter+click can double-bank materials. `this.transitioning` field already exists, just unused. | `src/scenes/BossExitScene.ts:166-205` | yes |
| H9 | `MqttClient` timeout-fallback leaves dead client subscribed to events — delayed `connect` event on dead primary can set status='connected' after failover. | `src/systems/MqttClient.ts:100-117, 140-153` | yes |

### Performance (low-end PCs)
| # | Title | Where | Trivial? |
|---|-------|-------|----------|
| H10 | **`forceSetTimeOut: true`** — game runs on setTimeout instead of rAF. Hurts frame pacing on every machine, kills weak iGPUs. | `src/main.ts:47-50` | yes |
| H11 | `CombatHUD.update` allocates ~3 arrays + dozens of strings every frame at 60Hz → ~100k objects per 5-min fight → constant GC pauses. | `src/ui/CombatHUD.ts:365-465` | medium |
| H12 | `LoopHUD.update` rebuilds material string + runs full stats resolver every frame. Cacheable. | `src/ui/LoopHUD.ts:402-436` | yes |
| H13 | **`wind.wav` is 8.1 MB uncompressed PCM** — preloaded for every session. Re-encode → ~150 KB. | `public/assets/audio/wind.wav` | yes (ffmpeg) |
| H14 | Battle backgrounds: `bg_battle_graveyard.png` 5.0 MB, `bg_battle_forest.png` 2.5 MB, `shop.png` 2.8 MB. ~50 MB VRAM just for backgrounds. | `public/assets/backgrounds/*.png`, `public/assets/buildings/backgrounds/*.png` | yes |
| H15 | mqtt bundled into main entry (~50-80 KB gz) — only used in Daily Run mode. Dynamic import. | `src/systems/MqttClient.ts` + `vite.config.ts` | yes |

### UI / UX (player-side)
| # | Title | Where | Trivial? |
|---|-------|-------|----------|
| H16 | **CombatHUD is a fact sheet** — HP, Stamina, Mana, 5 stats, armor row, 10-chip status pool crammed into 238×188px. Eye has no anchor. | `src/ui/CombatHUD.ts:29-39` | no |
| H17 | **Every scene reinvents the button.** 5 button idioms. Design system (`StyleConstants.createButton`) abandoned. | many scenes | no |
| H18 | **Card descriptions are 9px monospace** — unreadable at the 0.4-0.6 scales used in Shop/Library/DeckBuilder grids. | `src/ui/CardVisual.ts:212-218` | medium |
| H19 | **Emoji as icon system** (⚔ 🛡 ✨ 🪵 🪨 🦴 ⚒) — OS-dependent, clashes with pixel art. | throughout | no |
| H20 | **No color palette.** 4 text colors in StyleConstants + 7 in SHADOWBLADE_PALETTE + scenes invent literal hexes. CityHub brown, Shop dark-orange, Combat glass-blue, DeckBuilder navy — 4 visual languages. | scenes | no |
| H21 | LoopHUD top 190px crammed with 5 stacked horizontal bands. Element-shard row at 0.1 alpha 90% of run = invisible feature. | `src/ui/LoopHUD.ts:60-69, 226-270` | no |
| H22 | **Tutorial fires AFTER deck-building.** New player picks class + builds 5-card deck blind, then tutorial explains it. | `src/scenes/CharacterSelectScene.ts:307` | no (route change) |
| H23 | **No Settings access from MainMenu or CityHub.** Audio plays at boot; no mute path until ESC in a run. | `MainMenu.ts`, `CityHubScene.ts:160-180` | yes |
| H24 | **CityHub has no Start Run CTA.** "Change Hero" is being abused as the start button. | `CityHubScene.ts:160-178` | yes |
| H25 | DeathScene has no Try Again button — funnels through "Return to City" with no immediate retry. Unlocks listed generically. | `src/scenes/DeathScene.ts:158-162` | no |
| H26 | **Combat can't be paused.** ESC is bound in GameScene but GameScene is asleep during combat. | `src/scenes/CombatScene.ts` (no ESC binding) | no |
| H27 | No depth / boss-distance indicator. Math is already on `LoopRunner`; just render it. | `src/ui/LoopHUD.ts` | yes |

### Game design
| # | Title | Where | Trivial? |
|---|-------|-------|----------|
| H28 | **Combat is autoplay.** No player input during fights — deck order chosen in planning is the entire strategy. Streamer/social shareability dies. | `src/systems/combat/CombatEngine.ts` | no |
| H29 | **Difficulty curve is flat inside a run.** `percentPerLoop: 0` is the kill switch. Loop 15 plays like loop 2 unless a boss died between. | `src/data/difficulty.json` | yes (data) |
| H30 | **100% XP loss on death.** `deathXpPercent: 0`. 30-min run that dies returns no passive-tree progress. | `src/data/difficulty.json` | yes (data) |
| H31 | **Bosses have `behaviors: []`** — they're stat-sticks despite `EnemyAI` supporting `shield`/`enrage`. | `src/data/json/enemies.json` | yes (data) |
| H32 | **Daily Run has no leaderboard UI.** MQTT plumbing exists; payoff layer doesn't. `grep leaderboard` = 0 hits. | `src/systems/DailyRun*` + missing UI | no |
| H33 | Shop card RNG can softlock — 3 random from 164-card pool, no class bias, no reroll. | `src/systems/ShopSystem.ts` | medium |

### Data integrity
| # | Title | Where | Trivial? |
|---|-------|-------|----------|
| H34 | Two divergent `tiles.json` files; `DataLoader` loads the wrong one (uncalled, dormant). | `src/data/tiles.json` vs `src/data/json/tiles.json` | no (touches tests) |
| H35 | Two divergent `difficulty.json` files. Schema in `types.ts DifficultyConfig` matches neither. | same pattern | no |
| H36 | Warrior + Mage starter decks disagree between `cards.json` and `WarriorClass.ts` / `MageClass.ts`. Code wins; JSON is dead. | `src/data/json/cards.json` vs `src/systems/hero/*Class.ts` | yes (delete one) |
| H37 | Warrior passives doubly-defined with zero ID overlap (`passives.json` vs `warrior-passives.json`). | `src/data/json/` | no |
| H38 | `types.ts TileType`, `HeroStatsConfig`, `DifficultyConfig` schemas out of sync with live data. | `src/data/types.ts:321, 423` | yes (delete or align) |

---

## 🟡 Medium / Low — see per-area reports

70+ additional findings. The most actionable batches:

- **Asset orphans (~6.7 MB recoverable):** FreeKnight pack (242 files, 1 used), walk-slowly.mp3, paladin-walk.mp4, goblin walk.mp4, heroAtack.png, hero.zip, snow_bg.png, paladin_generated - Copia.png, deprecated v1 relics (spell_focus, warrior_spirit). See `audit/assets.md`.
- **Dead code (~6k LOC + 25 unused exports):** 3 root-level scratch scripts, `EnemyDefinitions.ts` duplicate, `cards-tier3-mocks.json` 5944 lines, `elements.json` orphan, `treasure-tables.json` orphan, SharedRNG/ElementSystem/ShardSystem unused helpers. See `audit/dead-code.md`.
- **Quick-win game-design tuning (5 data edits):** percentPerLoop 0→0.04, deathXpPercent 0→0.30, boss `behaviors`, burn `dmg = min(stacks, 8)`, loosen CLASS_DECK_RATIO. See `audit/gamedesign.md` § Quick-win shortlist.
- **UI quick wins:** 9 listed in `audit/ui.md` § Quick Wins. Mostly cosmetic but high polish/effort ratio.

---

## Themes across audits

1. **Two-source-of-truth disease.** Twin `tiles.json` / `difficulty.json` / starter-deck / warrior-passives / EnemyDefinitions / AudioManager pairs. The codebase has been migrated multiple times and the old paths weren't pruned. Wherever there are two files with the same name, one is dead.
2. **Validator + schema rot.** `validate-data.mjs` crashes, and even patched it covers <50% of cross-refs. `types.ts` schemas drifted from live JSON. The only safety net the project has does not run.
3. **Frame-time waste in HUDs.** The two longest-running scenes (Combat, Game) rebuild HUD state every frame instead of on change. Single biggest perf win for low-end PCs after re-encoding assets.
4. **Design system written and abandoned.** `StyleConstants.createButton` has 3 callers out of ~15 buttons; `FONTS` constants are mostly ignored; scenes invent palettes per file.
5. **Meta-progression plumbing > player-facing payoff.** Daily Run broadcasts but no leaderboard. Building unlocks fire but Collection has no "NEW" badge. Forge unlocks reference phantom card IDs. The hooks are scaffolded but the user-facing surface is sparse.
6. **Combat is autoplay + flat difficulty = autoscroller in the worst sense.** Two HIGH game-design findings compound. The fix path is a small in-combat input (manual play, active ability) + restoring `percentPerLoop`.

---

## Auto-fix scope (next step)

The agent will apply unambiguously-trivial fixes as atomic commits and log them in `audit/FIXES.md`. Items marked `Trivial?: yes` AND that don't require design judgment are in scope. Game-design balance tweaks (H29-H31), button widget refactors (H17), tutorial routing (H22), and JSON consolidation (H34-H37) are left for human review.
