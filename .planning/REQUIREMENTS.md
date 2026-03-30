# Requirements: Autoscroller

**Defined:** 2026-03-25
**Core Value:** A experiência central é o deckbuilding estratégico: o jogador nunca toca no combate diretamente, mas cada decisão sobre quais cartas manter, remover, e em qual ordem colocar define se o herói sobrevive ou morre.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Architecture

- [x] **ARCH-01**: Game logic (combat, loop, tiles) runs as pure TypeScript systems, decoupled from Phaser scenes
- [x] **ARCH-02**: Single centralized RunState object owns all mutable run data (HP, gold, deck, relics, tile inventory)
- [x] **ARCH-03**: Typed EventBus decouples cross-system communication (no direct scene-to-scene coupling)
- [x] **ARCH-04**: Object pooling and cleanup conventions prevent memory leaks over 1h+ runs

### Combat

- [x] **CMBT-01**: Combat is fully automatic — hero plays cards from the top of the deck without player intervention
- [x] **CMBT-02**: Each card has its own cooldown (light cards are fast, heavy cards are slow)
- [x] **CMBT-03**: Card queue is visible during combat — player sees entire deck order and upcoming cards
- [x] **CMBT-04**: Synergy triggers are visually highlighted during combat (combo indicator)
- [x] **CMBT-05**: Post-combat summary screen shows damage dealt/received, cards played, combos triggered
- [x] **CMBT-06**: When deck is exhausted, it reshuffles and restarts
- [x] **CMBT-07**: Cards are typed: attacks, defenses, and spells
- [x] **CMBT-08**: Attacks and defenses cost stamina; spells cost mana
- [x] **CMBT-09**: Cards and natural regeneration generate stamina/mana during combat
- [x] **CMBT-10**: Stamina and mana reset between combats; HP persists across combats
- [x] **CMBT-11**: Card targeting is defined per card (single target, AoE, lowest HP, random, etc)
- [x] **CMBT-12**: Enemies use simple AI with fixed stats and attack patterns (no card system)

### Deck Management

- [x] **DECK-01**: Player can add cards to deck for free (accept or discard when earned)
- [x] **DECK-02**: Player can remove cards at the shop with escalating gold cost (smaller deck = more expensive)
- [x] **DECK-03**: Player can reorder deck at the shop for a gold cost
- [x] **DECK-04**: Sequential card synergies exist (e.g., Shield followed by Counter-Attack = double damage)
- [x] **DECK-05**: Not all cards have synergies — synergy presence is a balancing factor
- [x] **DECK-06**: Class-exclusive combos exist (warrior-specific synergy chains)
- [x] **DECK-07**: Player can view entire deck order at any time
- [x] **DECK-08**: Card reward choices: pick 1 of 3 cards after eligible combats (chance, not guaranteed)

### Loop System

- [x] **LOOP-01**: Hero traverses tiles in an infinite loop (side-view, autoscroll)
- [x] **LOOP-02**: Player places terrain tiles on the path during the run
- [x] **LOOP-03**: Adjacent tiles interact with each other (synergy/combo effects)
- [x] **LOOP-04**: Terrains spawn specific enemies and provide resources/buffs
- [x] **LOOP-05**: Difficulty scales each loop (enemy stats increase)
- [x] **LOOP-06**: Boss appears every X loops completed
- [x] **LOOP-07**: Defeating a boss gives the option to exit with 100% of rewards
- [x] **LOOP-08**: Dying mid-run returns 25% of rewards

### Tile System

- [x] **TILE-01**: Player earns tile points each loop completed (accumulable for better tiles)
- [x] **TILE-02**: Rare tile drops from enemies (free, inserted at end of loop)
- [x] **TILE-03**: Tile drops can be sold for tile points (at reduced rate)
- [x] **TILE-04**: 6+ functional tile types: combat terrain, shop, rest, treasure, event, boss
- [x] **TILE-05**: Tile placement UI allows positioning tiles during the run

### Hero and Class

- [x] **HERO-01**: Warrior is the playable class with defined base stats (HP, stamina, mana)
- [x] **HERO-02**: Class XP earned per run persists between runs
- [x] **HERO-03**: Passive skills unlocked via class XP (e.g., +damage after 2 consecutive attacks)
- [x] **HERO-04**: Class-exclusive card synergies (warrior-specific sequential combos)

### Relics

- [x] **RELC-01**: Passive relic items with unique effects (no fixed slots, Slay the Spire style)
- [x] **RELC-02**: Relics can modify cooldowns, stats, and combat mechanics
- [x] **RELC-03**: Relics obtained from drops, shop, and events
- [x] **RELC-04**: ~8 relics available in v1

### Tiles — Special

- [x] **SPEC-01**: Shop tile: buy cards, remove cards, reorder deck, buy relics
- [x] **SPEC-02**: Event tile: narrative encounters with meaningful choices
- [x] **SPEC-03**: Rest tile: recover HP
- [x] **SPEC-04**: Treasure tile: guaranteed loot (cards, gold, relics)
- [x] **SPEC-05**: Boss tile: special combat encounter with better rewards

### Meta-Progression

- [x] **META-01**: Visual hub (camp/village) between runs displaying unlocks and progression
- [x] **META-02**: Permanent unlock of new cards into the loot pool
- [x] **META-03**: Permanent unlock of new tile types
- [x] **META-04**: Class XP and passive skill tree persist across runs

### Content

- [x] **CONT-01**: ~15 unique cards with distinct stats, cooldowns, and targeting
- [x] **CONT-02**: ~8 relics with unique passive effects
- [x] **CONT-03**: 2-3 boss types (stats-based, unique mechanics deferred)
- [x] **CONT-04**: ~5 narrative events with choices and consequences

### Persistence

- [x] **PERS-01**: Run progress saved to IndexedDB (idb-keyval) — survives browser refresh
- [x] **PERS-02**: Meta-progression data persists across sessions (unlocks, XP, hub state)
- [x] **PERS-03**: Seeded RNG for reproducible runs (shareable seeds)

### Polish

- [x] **PLSH-01**: Death screen with comprehensive run statistics (loops completed, damage dealt, cards played, cause of death)

### Art / Visual Assets

- [x] **ART-01**: 6 enemy types have PixelLab-generated 64x64 pixel art characters (slime, goblin, orc, mage, elite_knight, boss_demon)
- [x] **ART-02**: Each enemy has idle (breathing-idle) and attack animation frames (minimum 3 frames per animation)
- [x] **ART-03**: 5 special tile types have distinct 64x64 pixel art icon sprites (shop, rest, event, treasure, boss)
- [x] **ART-04**: Monster animation frames are composited into horizontal-strip spritesheets compatible with Phaser's spritesheet loader
- [x] **ART-05**: Preloader loads all monster spritesheets and special tile sprites; TileVisual renders special tiles as sprites instead of text icons
- [x] **ART-06**: CombatScene renders enemies as animated Phaser Sprites (idle loop + attack animation) instead of colored rectangles

## v2 Requirements

### Multiplayer

- **MULT-01**: Co-op online up to 4 players on the same screen
- **MULT-02**: Simultaneous combat (all heroes play cards at the same time)
- **MULT-03**: Difficulty scales with number of players
- **MULT-04**: Dead player revives when allies defeat next boss (difficulty does not decrease)
- **MULT-05**: Matchmaking system

### Additional Classes

- **CLAS-01**: Mage class with unique cards and passive tree
- **CLAS-02**: Archer/Rogue class with unique cards and passive tree

### Advanced Bosses

- **BOSS-01**: Bosses with unique mechanics (phases, immunities, special attacks)

### Polish v2

- **PLSH-02**: Tutorial covering tile placement, deck ordering, and auto-combat
- **PLSH-03**: Sound design (music + sound effects)
- **PLSH-04**: Visual art overhaul (replace placeholder graphics)
- **PLSH-05**: Save export/import functionality

### Content Expansion

- **CONT-05**: 30+ cards with rare/epic tiers
- **CONT-06**: 15+ relics
- **CONT-07**: 5+ boss types with unique mechanics
- **CONT-08**: 15+ narrative events
- **CONT-09**: Card upgrade system

### Heir System

- **HEIR-01**: Choose heir with traits that modify next run
- **HEIR-02**: 10+ heir traits with meaningful gameplay impact

## Out of Scope

| Feature | Reason |
|---------|--------|
| PvP mode | Balancing PvP + PvE simultaneously destroys both; StS never added PvP |
| Manual combat intervention | Destroys core auto-battler identity — preparation is the game |
| Infinite card collection across runs | Eliminates roguelike tension; cards unlock into loot pool, not starting deck |
| Off-path tiles (Loop Hero style) | Only path tiles — simplifies system, linear adjacency is sufficient |
| Procedural card generation | All successful deckbuilders use hand-designed cards |
| Mobile touch controls | UI designed for mouse; touch targets too small for tile/deck management |
| Cosmetic microtransactions | Overhead for passion project; focus on game first |
| Real-time multiplayer spectating | Enormous cost for marginal value; prefer post-run replay sharing |

## Traceability

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | Phase 1 | Complete |
| ARCH-02 | Phase 1 | Complete |
| ARCH-03 | Phase 1 | Complete |
| ARCH-04 | Phase 1 | Complete |
| PERS-01 | Phase 1 | Complete |
| CMBT-01 | Phase 2 | Complete |
| CMBT-02 | Phase 2 | Complete |
| CMBT-03 | Phase 2 | Complete |
| CMBT-04 | Phase 2 | Complete |
| CMBT-05 | Phase 2 | Complete |
| CMBT-06 | Phase 2 | Complete |
| CMBT-07 | Phase 2 | Complete |
| CMBT-08 | Phase 2 | Complete |
| CMBT-09 | Phase 2 | Complete |
| CMBT-10 | Phase 2 | Complete |
| CMBT-11 | Phase 2 | Complete |
| CMBT-12 | Phase 2 | Complete |
| DECK-01 | Phase 2 | Complete |
| DECK-02 | Phase 2 | Complete |
| DECK-03 | Phase 2 | Complete |
| DECK-04 | Phase 2 | Complete |
| DECK-05 | Phase 2 | Complete |
| DECK-06 | Phase 2 | Complete |
| DECK-07 | Phase 2 | Complete |
| DECK-08 | Phase 2 | Complete |
| HERO-01 | Phase 2 | Complete |
| HERO-02 | Phase 2 | Complete |
| HERO-03 | Phase 2 | Complete |
| HERO-04 | Phase 2 | Complete |
| PLSH-01 | Phase 2 | Complete |
| LOOP-01 | Phase 3 | Complete |
| LOOP-02 | Phase 3 | Complete |
| LOOP-03 | Phase 3 | Complete |
| LOOP-04 | Phase 3 | Complete |
| LOOP-05 | Phase 3 | Complete |
| LOOP-06 | Phase 3 | Complete |
| LOOP-07 | Phase 3 | Complete |
| LOOP-08 | Phase 3 | Complete |
| TILE-01 | Phase 3 | Complete |
| TILE-02 | Phase 3 | Complete |
| TILE-03 | Phase 3 | Complete |
| TILE-04 | Phase 3 | Complete |
| TILE-05 | Phase 3 | Complete |
| SPEC-01 | Phase 3 | Complete |
| SPEC-02 | Phase 3 | Complete |
| SPEC-03 | Phase 3 | Complete |
| SPEC-04 | Phase 3 | Complete |
| SPEC-05 | Phase 3 | Complete |
| RELC-01 | Phase 4 | Complete |
| RELC-02 | Phase 4 | Complete |
| RELC-03 | Phase 4 | Complete |
| RELC-04 | Phase 4 | Complete |
| META-01 | Phase 4 | Complete |
| META-02 | Phase 4 | Complete |
| META-03 | Phase 4 | Complete |
| META-04 | Phase 4 | Complete |
| CONT-01 | Phase 4 | Complete |
| CONT-02 | Phase 4 | Complete |
| CONT-03 | Phase 4 | Complete |
| CONT-04 | Phase 4 | Complete |
| PERS-02 | Phase 4 | Complete |
| PERS-03 | Phase 4 | Complete |
| ART-01 | Phase 8 | Planned |
| ART-02 | Phase 8 | Planned |
| ART-03 | Phase 8 | Planned |
| ART-04 | Phase 8 | Planned |
| ART-05 | Phase 8 | Planned |
| ART-06 | Phase 8 | Planned |

**Coverage:**
- v1 requirements: 68 total
- Mapped to phases: 68
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-29 after Phase 8 ART requirements added*
