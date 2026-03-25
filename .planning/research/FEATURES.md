# Feature Research

**Domain:** Roguelike deckbuilder / auto-battler / loop-based game (web browser)
**Researched:** 2026-03-25
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Core loop with escalating difficulty | Every roguelike has this. Without escalation, no tension. Loop Hero and StS both gate difficulty per floor/loop. | MEDIUM | Already partially implemented (generation-based scaling). Needs tuning -- current log2 scaling may flatten too fast. |
| Deck management (add/remove/view cards) | Genre-defining. Slay the Spire proved that deck thinning is as important as adding cards. Players MUST be able to curate their deck. | MEDIUM | Partially in place (DeckManager, ShopScene). Card removal cost escalation is in PROJECT.md but needs implementation. |
| Card reward choices after combat | StS standard: pick 1 of 3 cards (or skip). Picking blindly or auto-adding feels bad. Player agency in deck construction is the entire point. | LOW | RewardScene exists but needs the "choose 1 of N" pattern, not just random drops. |
| Shop (buy cards, remove cards, buy relics) | Every roguelike deckbuilder has a shop. It is the primary gold sink and the main tool for deck curation. | MEDIUM | ShopScene exists. Needs inventory rotation, card removal pricing, relic stock. |
| Relics / passive items | Slay the Spire's relics are the second strategic axis (after cards). They create build identity and enable synergies that cards alone cannot. | MEDIUM | RelicManager and 8 relics exist. Needs more relics (20-30 minimum for variety) and better trigger system. |
| HP persistence between combats | Genre standard for attrition-based roguelikes. Creates tension across the run, not just per fight. Rest sites matter because HP persists. | LOW | Already implemented. Stamina/mana reset between fights per PROJECT.md. |
| Rest sites (heal HP) | Without healing between fights, attrition kills every run. Rest vs. upgrade is a classic StS tension. | LOW | RestScene exists. |
| Boss encounters | Bosses punctuate progression and create "can I survive this?" moments. Without them, the loop feels monotonous. | MEDIUM | Boss tile and boss_demon enemy exist. Needs more boss variety and unique mechanics (phases, immunities). |
| Permadeath with meta-progression | Roguelike identity. Death must matter, but players need to feel progress across runs. StS unlocks new cards; Loop Hero builds the camp. | HIGH | Heir system exists (HeirGenerator). Meta-progression hub is in PROJECT.md but not implemented. This is the hardest table-stakes feature. |
| Run statistics / death screen | Players must understand WHY they died to improve. "You died" with no context causes rage-quits. Show damage taken, cards played, loops completed. | LOW | DeathScene exists but appears minimal. Needs comprehensive run stats. |
| Pause and settings | Web games get closed accidentally. Pause is non-negotiable. Settings for volume, speed, etc. | LOW | PauseScene and SettingsScene exist. |
| Tutorial / onboarding | The game combines 3 genres (loop, deckbuilder, auto-battler). New players will be lost without guidance. StS has a great progressive tutorial. | MEDIUM | TutorialScene exists. Needs to cover tile placement, deck ordering, and auto-combat concepts. |
| Visual combat feedback | Auto-combat means the player watches, not plays. If combat is visually boring or unclear, the game fails. Floating numbers, hit effects, health bars are mandatory. | MEDIUM | CombatEffects exists with particles, screen shake, floating numbers. Needs card play animations and enemy intent indicators. |
| Seed-based runs (reproducibility) | Expected by competitive roguelike players. Allows sharing runs and verifying fairness. | LOW | Not yet implemented. Use seeded RNG for all random decisions. |

### Differentiators (Competitive Advantage)

Features that set Autoscroller apart. These are where the game competes.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dual-layer strategy (tiles + deck) | The core differentiator. Players architect the WORLD (tile placement) AND the COMBAT (deck order). No other game combines Loop Hero's tile placement with StS's deckbuilding in this way. | HIGH | Tile placement system exists. Needs tile synergies (adjacent tile interactions) to make placement decisions meaningful beyond "more combat = more loot." |
| Deck ORDER matters (not just composition) | Most deckbuilders shuffle. Autoscroller lets players ORDER their deck, making sequencing a strategic dimension. Shield before Heavy Hit. Heal after Berserker. This is unique. | MEDIUM | DeckCustomizationScene exists. The ordering mechanic needs to be prominently surfaced -- this is THE differentiator within combat. Card synergy system (sequential combos) is in PROJECT.md but not implemented. |
| Card synergy chains (sequential combos) | "Shield then Counter-Attack = double damage." This rewards deck ordering mastery and creates an optimization puzzle that pure-shuffle deckbuilders cannot offer. | HIGH | Not yet implemented. This is the most important differentiating feature to build. Needs a synergy definition system and visual feedback when combos trigger. |
| Heir system (generational roguelike) | When you die, you choose an heir with traits that modify the next run. Not just "try again" -- each death creates a slightly different character. Rogue Legacy-inspired but applied to deckbuilding. | MEDIUM | HeirGenerator exists with 4 traits. Needs more traits (10-15), meaningful choices, and potentially deck inheritance. |
| Tile economy (points + rare drops) | Two sources of tiles with their own economy. Spend points for guaranteed tiles vs. gamble on rare drops from enemies. Creates a resource management layer on top of the deckbuilding layer. | MEDIUM | TileInventory exists. Economy needs balancing -- how many points per loop, drop rates, sell values. |
| Real-time auto-combat with cooldowns | Unlike StS (turn-based) or TFT (position-based), combat here is real-time with per-card cooldowns. Faster cards cycle more. This makes deck composition about tempo, not just value. | HIGH | CombatScene uses a fixed 2-second timer. Needs per-card cooldown system as specified in PROJECT.md. This is a significant refactor of the combat system. |
| Co-op online (future) | 4-player co-op in a roguelike deckbuilder is rare. Most games in this space are single-player. Co-op adds replayability and social hooks. | VERY HIGH | Not MVP. Correctly deferred. Will require server infrastructure, state sync, and scaling difficulty. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Explicitly do NOT build these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| PvP mode | "Let me test my deck against other players" | Balancing PvP and PvE simultaneously is a nightmare. Every card change affects both modes. StS never added PvP. TFT is PvP-only -- it is a different game entirely. | Co-op mode (shared challenge, not competitive). Leaderboards for competitive players. |
| Manual combat intervention (play cards by hand) | "I want to control when cards are played" | Destroys the core identity. The game is about preparation, not execution. Manual play makes it just another StS clone. The auto-battler nature IS the differentiator. | Better pre-combat tools: deck reordering, card preview, combat simulation/prediction. |
| Infinite card collection across runs | "Let me keep my best cards forever" | Eliminates roguelike tension. If you keep cards, death does not matter. Runs become trivially easy. | Meta-progression unlocks cards into the LOOT POOL, not your starting deck. Each run starts fresh (like StS). |
| Complex tile adjacency (Loop Hero style off-path tiles) | "Mountains next to rivers should create waterfalls" | Massive complexity for the tile system. Loop Hero had a dedicated team for this. Simplify to path-only tiles with linear adjacency bonuses. | Adjacent tiles ON THE PATH interact (e.g., two combat tiles in a row = harder enemies but better loot). Keep interactions linear, not 2D. |
| Cosmetic microtransactions | "Monetize with skins" | For a passion project, MTX infrastructure is overhead. Web games with MTX feel predatory. Focus on the game first. | If monetization is needed later, consider a one-time purchase model or donation-ware. |
| Real-time multiplayer spectating | "Watch my friend's combat live" | Requires WebSocket infrastructure, state streaming, and UI for spectator mode. Enormous cost for marginal value. | Post-run replay sharing (serialize combat log, replay locally). Much simpler. |
| Procedural card generation | "Generate random cards with AI" | Balancing hand-crafted cards is already hard. Procedural cards will create broken combos and feel generic. Every successful deckbuilder uses hand-designed cards. | Large hand-crafted card pool (50-80 cards) with clear synergy categories. |
| Mobile touch controls | "Make it work on phones" | Touch targets for tile placement and deck ordering are too small. The UI is designed for mouse interaction. Retrofitting touch is expensive. | Responsive web layout that works on tablets. Phone is out of scope. |

## Feature Dependencies

```
[Tile Placement System]
    |-- requires --> [Tile Types & Config]
    |-- requires --> [Tile Inventory & Economy]
    |-- enhances --> [Tile Synergies (adjacent interactions)]

[Auto-Combat System]
    |-- requires --> [Card Definitions]
    |-- requires --> [Deck Manager (ordering)]
    |-- requires --> [Enemy Definitions & Scaling]
    |-- enhances --> [Per-Card Cooldowns]
    |-- enhances --> [Card Sequential Synergies/Combos]

[Card Sequential Synergies]
    |-- requires --> [Deck Ordering]
    |-- requires --> [Card Definitions with synergy tags]

[Per-Card Cooldowns]
    |-- requires --> [Card Definitions with cooldown values]
    |-- conflicts --> [Fixed 2-second turn timer (current implementation)]

[Meta-Progression Hub]
    |-- requires --> [Persistent Storage (localStorage or backend)]
    |-- requires --> [Unlock System (cards, tiles, classes)]
    |-- enhances --> [Heir System]

[Heir System]
    |-- requires --> [Death/GameOver flow]
    |-- requires --> [Trait definitions]
    |-- enhances --> [Meta-Progression Hub]

[Boss Mechanics]
    |-- requires --> [Auto-Combat System]
    |-- enhances --> [Loop Completion rewards]

[Shop System]
    |-- requires --> [Gold/Currency]
    |-- requires --> [Card Pool]
    |-- requires --> [Relic Pool]
    |-- enhances --> [Deck Management (removal)]

[Co-op Multiplayer]
    |-- requires --> [All single-player systems complete]
    |-- requires --> [Server infrastructure]
    |-- requires --> [State synchronization]
    |-- conflicts --> [MVP scope]
```

### Dependency Notes

- **Card Sequential Synergies requires Deck Ordering:** Synergies fire based on card sequence, so the ordering system must exist and be reliable before synergies can be layered on.
- **Per-Card Cooldowns conflicts with Fixed Turn Timer:** The current 2-second turn timer must be replaced with individual card cooldown tracking. This is a combat system rewrite, not an incremental change.
- **Meta-Progression Hub requires Persistent Storage:** localStorage works for MVP but consider IndexedDB for larger save states. No backend needed for single-player.
- **Co-op Multiplayer requires all single-player systems:** Do not attempt multiplayer until the solo game is fun and balanced. Every system needs to be multiplayer-aware if added later, but building for multiplayer prematurely adds complexity everywhere.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what is needed to validate the core loop is fun.

- [ ] **Tile placement on the path** -- Core differentiator #1. Player must be able to place tiles and see consequences.
- [ ] **Deck ordering with visual feedback** -- Core differentiator #2. Player must understand that order matters.
- [ ] **Auto-combat with per-card cooldowns** -- Replaces the fixed 2-second timer. Cards must have individual tempo.
- [ ] **Card reward choices (pick 1 of 3)** -- Genre standard. Without choices, deckbuilding feels hollow.
- [ ] **Card removal in shop** -- Deck thinning is essential strategy. Must be available.
- [ ] **5+ enemy types with distinct behaviors** -- Already have 4 normals + 1 elite + 1 boss. Need behavioral variety.
- [ ] **8+ relics** -- Already have 8. Enough for MVP if triggers work correctly.
- [ ] **Escalating difficulty per loop** -- Already partially implemented. Needs tuning.
- [ ] **Death screen with run statistics** -- Players must understand why they died.
- [ ] **Tutorial covering all 3 systems** -- Tile placement, deck ordering, auto-combat.
- [ ] **Persistent run seed** -- Reproducible runs for fairness and sharing.

### Add After Validation (v1.x)

Features to add once core loop is proven fun.

- [ ] **Card sequential synergies/combos** -- Add when deck ordering is validated as fun. This deepens the ordering mechanic.
- [ ] **Tile adjacency synergies** -- Add when tile placement is validated as meaningful. Adjacent combat tiles = harder + better loot.
- [ ] **Meta-progression hub (camp/village)** -- Add when players want to keep playing after death. Unlock new cards/tiles into loot pool.
- [ ] **Heir system with 10+ traits** -- Expand from 4 to 10+ traits. Add deck inheritance options.
- [ ] **15+ additional cards** -- Expand from 14 to 30+ cards. Add rare/epic tiers.
- [ ] **15+ additional relics** -- Expand from 8 to 25+ relics. More trigger types.
- [ ] **3+ boss types with unique mechanics** -- Phases, immunities, special attacks. Currently only boss_demon.
- [ ] **Card upgrading system** -- Interface exists (upgradeBonus in CardDefinition) but not exposed to player.
- [ ] **Event system with meaningful choices** -- EventScene exists. Needs 15+ events with real tradeoffs.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Co-op online (2-4 players)** -- Requires server infrastructure. Only after solo is polished and fun.
- [ ] **Additional classes (Mage, Rogue, etc.)** -- Only after Warrior is balanced and complete with full passive tree.
- [ ] **Class-specific passive skill trees** -- Complex UI and balancing. After core class is solid.
- [ ] **Seasonal/daily challenge runs** -- Requires backend for leaderboards. After meta-progression is working.
- [ ] **Advanced boss AI (multi-phase, mechanics)** -- After basic boss variety is in place.
- [ ] **Sound design and music** -- AudioManager exists but is empty. Important for feel, not for mechanics validation.
- [ ] **Pixel art / sprite overhaul** -- Currently rectangles and text. Visual polish after mechanics are fun.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Per-card cooldowns (replace fixed timer) | HIGH | HIGH | P1 |
| Card reward choices (pick 1 of 3) | HIGH | LOW | P1 |
| Card removal in shop (with scaling cost) | HIGH | LOW | P1 |
| Deck ordering UI improvements | HIGH | MEDIUM | P1 |
| Death screen with run stats | MEDIUM | LOW | P1 |
| Tutorial (3 systems) | MEDIUM | MEDIUM | P1 |
| Card sequential synergies | HIGH | HIGH | P2 |
| Tile adjacency synergies | MEDIUM | MEDIUM | P2 |
| Meta-progression hub | HIGH | HIGH | P2 |
| Heir system expansion (10+ traits) | MEDIUM | LOW | P2 |
| Card pool expansion (30+ cards) | HIGH | MEDIUM | P2 |
| Relic pool expansion (25+ relics) | MEDIUM | MEDIUM | P2 |
| Boss variety (3+ bosses) | MEDIUM | MEDIUM | P2 |
| Card upgrading system | MEDIUM | MEDIUM | P2 |
| Event system (15+ events) | MEDIUM | MEDIUM | P2 |
| Seeded runs | LOW | LOW | P2 |
| Co-op multiplayer | HIGH | VERY HIGH | P3 |
| Additional classes | HIGH | HIGH | P3 |
| Class passive trees | MEDIUM | HIGH | P3 |
| Visual/art overhaul | MEDIUM | HIGH | P3 |
| Audio/music | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- validates the core loop
- P2: Should have, add when core loop is proven fun
- P3: Nice to have, future consideration after product-market fit

## Competitor Feature Analysis

| Feature | Loop Hero | Slay the Spire | Auto Chess/TFT | Autoscroller (Our Plan) |
|---------|-----------|-----------------|-----------------|------------------------|
| Player control in combat | None (watch) | Full (play cards) | None after placement | None (watch) -- like Loop Hero |
| Strategic layer | Tile placement (2D grid) | Card choices per floor | Unit positioning + economy | Tile placement (linear path) + Deck ordering |
| Deck/hand management | Equipment-based, no deck | Full deckbuilding | Unit bench/board | Full deckbuilding with ORDER as mechanic |
| Difficulty scaling | Loop count + tile density | Floor progression (3 acts) | Round-based + player matchups | Loop count + tile density + generation |
| Meta-progression | Camp buildings (resources) | Card/relic unlocks | Ranked progression | Hub village + card/tile unlocks + heir traits |
| Run length | 30-60 min | 45-90 min | 30-40 min | 60+ min (long runs, high investment) |
| Multiplayer | None | None (StS2 adds co-op) | 8-player PvP | Co-op 2-4 (future) |
| Economy in-run | Resources from tiles | Gold from combats | Gold from rounds | Gold + tile points (dual economy) |
| Death consequence | Lose partial resources | Full reset (meta unlocks persist) | Lose rank | 25% rewards kept + heir selection |
| Card synergies | N/A (no cards in combat) | Card combos (powers + attacks) | Unit trait synergies | Sequential card combos (order-dependent) |

## Sources

- [Loop Hero - Wikipedia](https://en.wikipedia.org/wiki/Loop_Hero)
- [Game Design Breakdown: Loop Hero (Medium)](https://medium.com/@sacitsivri/game-design-breakdown-loop-hero-4a86d55142b8)
- [Postmortem: Loop Hero (Game Developer)](https://www.gamedeveloper.com/design/postmortem-loop-hero)
- [Roguelike deck-building game - Wikipedia](https://en.wikipedia.org/wiki/Roguelike_deck-building_game)
- [How Slay the Spire devs use data to balance (Game Developer)](https://www.gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)
- [Common Deckbuilder Pitfalls (New to Narrative)](https://newtonarrative.com/news/common-deckbuilder-pitfalls/)
- [Auto-Battler Genre Evolution (Magic Special Events)](https://magicspecialevents.com/2025/01/29/auto-battler-genre-evolution-and-variants/)
- [Roguelike Deckbuilder Balancing (GameDev.net)](https://www.gamedev.net/forums/topic/715223-roguelike-deckbuilder-balancing/)
- [Slay the Web - open source web deckbuilder (GitHub)](https://github.com/oskarrough/slaytheweb)

---
*Feature research for: Roguelike deckbuilder / auto-battler / loop-based web game*
*Researched: 2026-03-25*
