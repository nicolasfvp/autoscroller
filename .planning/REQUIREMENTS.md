# Requirements: Autoscroller

**Defined:** 2026-03-25
**Core Value:** A experiência central é o deckbuilding estratégico: o jogador nunca toca no combate diretamente, mas cada decisão sobre quais cartas manter, remover, e em qual ordem colocar define se o herói sobrevive ou morre.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Architecture

- [ ] **ARCH-01**: Game logic (combat, loop, tiles) runs as pure TypeScript systems, decoupled from Phaser scenes
- [ ] **ARCH-02**: Single centralized RunState object owns all mutable run data (HP, gold, deck, relics, tile inventory)
- [ ] **ARCH-03**: Typed EventBus decouples cross-system communication (no direct scene-to-scene coupling)
- [ ] **ARCH-04**: Object pooling and cleanup conventions prevent memory leaks over 1h+ runs

### Combat

- [ ] **CMBT-01**: Combat is fully automatic — hero plays cards from the top of the deck without player intervention
- [ ] **CMBT-02**: Each card has its own cooldown (light cards are fast, heavy cards are slow)
- [ ] **CMBT-03**: Card queue is visible during combat — player sees entire deck order and upcoming cards
- [ ] **CMBT-04**: Synergy triggers are visually highlighted during combat (combo indicator)
- [ ] **CMBT-05**: Post-combat summary screen shows damage dealt/received, cards played, combos triggered
- [ ] **CMBT-06**: When deck is exhausted, it reshuffles and restarts
- [ ] **CMBT-07**: Cards are typed: attacks, defenses, and spells
- [ ] **CMBT-08**: Attacks and defenses cost stamina; spells cost mana
- [ ] **CMBT-09**: Cards and natural regeneration generate stamina/mana during combat
- [ ] **CMBT-10**: Stamina and mana reset between combats; HP persists across combats
- [ ] **CMBT-11**: Card targeting is defined per card (single target, AoE, lowest HP, random, etc)
- [ ] **CMBT-12**: Enemies use simple AI with fixed stats and attack patterns (no card system)

### Deck Management

- [ ] **DECK-01**: Player can add cards to deck for free (accept or discard when earned)
- [ ] **DECK-02**: Player can remove cards at the shop with escalating gold cost (smaller deck = more expensive)
- [ ] **DECK-03**: Player can reorder deck at the shop for a gold cost
- [ ] **DECK-04**: Sequential card synergies exist (e.g., Shield followed by Counter-Attack = double damage)
- [ ] **DECK-05**: Not all cards have synergies — synergy presence is a balancing factor
- [ ] **DECK-06**: Class-exclusive combos exist (warrior-specific synergy chains)
- [ ] **DECK-07**: Player can view entire deck order at any time
- [ ] **DECK-08**: Card reward choices: pick 1 of 3 cards after eligible combats (chance, not guaranteed)

### Loop System

- [ ] **LOOP-01**: Hero traverses tiles in an infinite loop (side-view, autoscroll)
- [ ] **LOOP-02**: Player places terrain tiles on the path during the run
- [ ] **LOOP-03**: Adjacent tiles interact with each other (synergy/combo effects)
- [ ] **LOOP-04**: Terrains spawn specific enemies and provide resources/buffs
- [ ] **LOOP-05**: Difficulty scales each loop (enemy stats increase)
- [ ] **LOOP-06**: Boss appears every X loops completed
- [ ] **LOOP-07**: Defeating a boss gives the option to exit with 100% of rewards
- [ ] **LOOP-08**: Dying mid-run returns 25% of rewards

### Tile System

- [ ] **TILE-01**: Player earns tile points each loop completed (accumulable for better tiles)
- [ ] **TILE-02**: Rare tile drops from enemies (free, inserted at end of loop)
- [ ] **TILE-03**: Tile drops can be sold for tile points (at reduced rate)
- [ ] **TILE-04**: 6+ functional tile types: combat terrain, shop, rest, treasure, event, boss
- [ ] **TILE-05**: Tile placement UI allows positioning tiles during the run

### Hero and Class

- [ ] **HERO-01**: Warrior is the playable class with defined base stats (HP, stamina, mana)
- [ ] **HERO-02**: Class XP earned per run persists between runs
- [ ] **HERO-03**: Passive skills unlocked via class XP (e.g., +damage after 2 consecutive attacks)
- [ ] **HERO-04**: Class-exclusive card synergies (warrior-specific sequential combos)

### Relics

- [ ] **RELC-01**: Passive relic items with unique effects (no fixed slots, Slay the Spire style)
- [ ] **RELC-02**: Relics can modify cooldowns, stats, and combat mechanics
- [ ] **RELC-03**: Relics obtained from drops, shop, and events
- [ ] **RELC-04**: ~8 relics available in v1

### Tiles — Special

- [ ] **SPEC-01**: Shop tile: buy cards, remove cards, reorder deck, buy relics
- [ ] **SPEC-02**: Event tile: narrative encounters with meaningful choices
- [ ] **SPEC-03**: Rest tile: recover HP
- [ ] **SPEC-04**: Treasure tile: guaranteed loot (cards, gold, relics)
- [ ] **SPEC-05**: Boss tile: special combat encounter with better rewards

### Meta-Progression

- [ ] **META-01**: Visual hub (camp/village) between runs displaying unlocks and progression
- [ ] **META-02**: Permanent unlock of new cards into the loot pool
- [ ] **META-03**: Permanent unlock of new tile types
- [ ] **META-04**: Class XP and passive skill tree persist across runs

### Content

- [ ] **CONT-01**: ~15 unique cards with distinct stats, cooldowns, and targeting
- [ ] **CONT-02**: ~8 relics with unique passive effects
- [ ] **CONT-03**: 2-3 boss types (stats-based, unique mechanics deferred)
- [ ] **CONT-04**: ~5 narrative events with choices and consequences

### Persistence

- [ ] **PERS-01**: Run progress saved to IndexedDB (idb-keyval) — survives browser refresh
- [ ] **PERS-02**: Meta-progression data persists across sessions (unlocks, XP, hub state)
- [ ] **PERS-03**: Seeded RNG for reproducible runs (shareable seeds)

### Polish

- [ ] **PLSH-01**: Death screen with comprehensive run statistics (loops completed, damage dealt, cards played, cause of death)

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
| ARCH-01 | Phase 1 | Pending |
| ARCH-02 | Phase 1 | Pending |
| ARCH-03 | Phase 1 | Pending |
| ARCH-04 | Phase 1 | Pending |
| PERS-01 | Phase 1 | Pending |
| CMBT-01 | Phase 2 | Pending |
| CMBT-02 | Phase 2 | Pending |
| CMBT-03 | Phase 2 | Pending |
| CMBT-04 | Phase 2 | Pending |
| CMBT-05 | Phase 2 | Pending |
| CMBT-06 | Phase 2 | Pending |
| CMBT-07 | Phase 2 | Pending |
| CMBT-08 | Phase 2 | Pending |
| CMBT-09 | Phase 2 | Pending |
| CMBT-10 | Phase 2 | Pending |
| CMBT-11 | Phase 2 | Pending |
| CMBT-12 | Phase 2 | Pending |
| DECK-01 | Phase 2 | Pending |
| DECK-02 | Phase 2 | Pending |
| DECK-03 | Phase 2 | Pending |
| DECK-04 | Phase 2 | Pending |
| DECK-05 | Phase 2 | Pending |
| DECK-06 | Phase 2 | Pending |
| DECK-07 | Phase 2 | Pending |
| DECK-08 | Phase 2 | Pending |
| HERO-01 | Phase 2 | Pending |
| HERO-02 | Phase 2 | Pending |
| HERO-03 | Phase 2 | Pending |
| HERO-04 | Phase 2 | Pending |
| PLSH-01 | Phase 2 | Pending |
| LOOP-01 | Phase 3 | Pending |
| LOOP-02 | Phase 3 | Pending |
| LOOP-03 | Phase 3 | Pending |
| LOOP-04 | Phase 3 | Pending |
| LOOP-05 | Phase 3 | Pending |
| LOOP-06 | Phase 3 | Pending |
| LOOP-07 | Phase 3 | Pending |
| LOOP-08 | Phase 3 | Pending |
| TILE-01 | Phase 3 | Pending |
| TILE-02 | Phase 3 | Pending |
| TILE-03 | Phase 3 | Pending |
| TILE-04 | Phase 3 | Pending |
| TILE-05 | Phase 3 | Pending |
| SPEC-01 | Phase 3 | Pending |
| SPEC-02 | Phase 3 | Pending |
| SPEC-03 | Phase 3 | Pending |
| SPEC-04 | Phase 3 | Pending |
| SPEC-05 | Phase 3 | Pending |
| RELC-01 | Phase 4 | Pending |
| RELC-02 | Phase 4 | Pending |
| RELC-03 | Phase 4 | Pending |
| RELC-04 | Phase 4 | Pending |
| META-01 | Phase 4 | Pending |
| META-02 | Phase 4 | Pending |
| META-03 | Phase 4 | Pending |
| META-04 | Phase 4 | Pending |
| CONT-01 | Phase 4 | Pending |
| CONT-02 | Phase 4 | Pending |
| CONT-03 | Phase 4 | Pending |
| CONT-04 | Phase 4 | Pending |
| PERS-02 | Phase 4 | Pending |
| PERS-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 62 total
- Mapped to phases: 62
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*
