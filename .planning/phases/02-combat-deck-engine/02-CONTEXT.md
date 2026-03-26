# Phase 2: Combat + Deck Engine - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement fully automatic real-time combat with per-card cooldowns, a visible card queue, sequential card synergies, complete deck management (add/remove/reorder via shop), card reward choices after combat, warrior class with persistent XP and linear passive skill tree, and a death screen with run statistics. This phase builds on the pure TS architecture from Phase 1 (RunState, EventBus, thin scenes). Combat is 100% automatic -- all strategy is in pre-combat deckbuilding and ordering.

</domain>

<decisions>
## Implementation Decisions

### Combat Pacing & Cooldowns
- **Per-card cooldown as a card stat**: Each card definition includes a `cooldown` value in seconds. Hero plays next card when current card's cooldown expires
- **Cooldown range: 1.0s--3.0s** (medium pace). Light cards ~1.0s, heavy cards ~3.0s. A 10-card deck cycles in ~15-25s
- **Unaffordable cards: skip and move to next**. If hero can't afford a card's stamina/mana cost, skip it and try the next card in queue. Skipped card stays in its position for the next cycle
- **Enemy has independent cooldown timer**. Enemy attacks on its own timer, decoupled from hero card plays. Both sides act independently in real-time
- **Deck reshuffle**: When deck is exhausted, reshuffle and restart from the top

### Synergy Design & Triggers
- **Exact consecutive pair trigger**: Card B must play immediately after Card A to trigger the synergy. Deck order directly maps to synergy strategy
- **Synergy effect on last card only**: The bonus effect applies only to the second card in the pair (the trigger card), not both cards
- **Bonus can be any effect type**: Each synergy pair defines its own bonus (extra damage, extra armor, heal, resource gen, etc.) -- not limited to damage multipliers
- **4-6 synergy pairs for v1**: Enough to reward intentional deck ordering without overwhelming. Exact pairs defined during content planning
- **Visual: highlight + text flash**: When synergy triggers, flash "COMBO!" text, glow effect on both cards in the queue, bonus effect shown with distinct color
- **Class-exclusive synergies use same system**: Warrior-only synergy pairs use the same consecutive-pair mechanic, but certain pairs only activate for the warrior class

### Deck Management UX
- **Drag-and-drop reordering** in the shop. Player drags cards to reorder. Visual, intuitive, directly shows deck sequence
- **Flat gold cost per reorder session**: Player pays once (e.g., 30 gold) to enter reorder mode, then can rearrange freely within that session
- **Card removal cost scales by deck size**: Cost = base / deckSize. Smaller decks = higher removal cost per card. Directly ties cost to deck-thinning benefit
- **Adding cards is free**: Accept or discard when earned (DECK-01)
- **Card reward choices: 3 cards weighted by rarity, pick 1 or skip**. Card rewards have a CHANCE to appear after each combat (not guaranteed). Cards shown are rarity-weighted (common cards appear more often, rare cards less)

### Warrior Class & XP
- **Linear passive progression: 5-6 passives** unlocked in fixed order as XP accumulates. Clear power growth per level
- **Passives: stat modifiers + conditional triggers**. Mix of flat bonuses (+5 max HP, +10% defense) and conditional effects (+damage after 2 consecutive attacks, +armor when stamina is full). Conditions make deck order matter more
- **XP per combat won**: Each enemy type gives a specific XP amount. Bosses grant more XP
- **Death = lose all accumulated XP for the run**. Player only banks XP if they exit safely after boss. Adds real stakes to the boss exit decision
- **Warrior base stats**: Existing HeroStats (100 HP, 50 stamina, 30 mana, 1 strength, 1 defenseMultiplier) serve as warrior base. XP passives modify these

### Post-Combat & Death
- **Post-combat summary screen**: Shows damage dealt/received, cards played, combos triggered (CMBT-05)
- **Death screen with run statistics**: Loops completed, damage dealt, cards played, cause of death (PLSH-01)

### Claude's Discretion
- Exact cooldown values per card (within 1.0s--3.0s range)
- Exact synergy pair definitions (within 4-6 pairs)
- Enemy cooldown timer values and attack pattern details
- Exact gold costs for reorder session and removal formula constants
- Card reward drop chance percentage
- XP amounts per enemy type and XP thresholds for passive unlocks
- Specific passive skill effects and conditions
- Natural stamina/mana regeneration rates during combat
- UI layout and visual design of combat screen, card queue, shop interface
- Card rarity tiers and weights for reward selection

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Game Design
- `.planning/PROJECT.md` -- Core value, key decisions, constraints, game references (Loop Hero, StS, auto-battlers)

### Requirements
- `.planning/REQUIREMENTS.md` -- CMBT-01..12, DECK-01..08, HERO-01..04, PLSH-01 mapped to this phase

### Phase 1 Context (architecture decisions)
- `.planning/phases/01-architecture-foundation/01-CONTEXT.md` -- RunState shape, EventBus granularity, static data as JSON, clean rewrite approach

### Phase 1 Architecture Research
- `.planning/research/ARCHITECTURE.md` -- Component boundaries, thin-scene pattern, EventBus + RunState code examples
- `.planning/research/PITFALLS.md` -- Memory leak prevention, singleton state patterns to avoid

### Existing Code (reference for card/enemy data shapes)
- `src/data/CardDefinitions.ts` -- 14 existing cards with cost/effect system (will be migrated to JSON per Phase 1)
- `src/data/EnemyDefinitions.ts` -- Enemy types and scaling (will be migrated to JSON per Phase 1)
- `src/data/HeroStats.ts` -- Current HeroStats interface (base for warrior class stats)
- `src/effects/CombatEffects.ts` -- Existing visual effects (particles, screen shake, floating numbers)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CombatEffects.ts`: Particle effects, screen shake, floating damage numbers -- reusable for synergy and combo visual feedback
- `CardDefinitions.ts`: 14 cards with cost/effect system -- card shape needs `cooldown` field added, migrated to JSON per Phase 1
- `HeroStats` interface: Base stat structure -- needs XP, class, and passive fields added
- `DeckManager`: Deck order + inventory tracking logic -- needs reorder, removal cost, and synergy awareness

### Established Patterns
- Cards have `effects: CardEffect[]` with `{type, value, target}` -- extend for synergy bonus effects
- Enemy definitions have `attack.damage`, `attack.specialEffect`, scaling by generation -- extend for independent cooldown timer
- Combat uses Phaser `time.addEvent` for turn loop -- replace with per-card cooldown timers

### Integration Points
- `RunState` (from Phase 1) will own deck, hero stats, gold, XP
- `EventBus` (from Phase 1) will dispatch: `card-played`, `synergy-triggered`, `combat-ended`, `xp-gained`, `card-reward-offered`
- CombatScene becomes thin wrapper over pure `CombatEngine` system
- Shop scene (Phase 3 tile) will use deck management systems built here

</code_context>

<specifics>
## Specific Ideas

- Death losing ALL accumulated XP for the run -- makes boss exit decision a real risk/reward calculation (you only bank XP by exiting safely)
- Synergy bonus is flexible per-pair (not just damage multiplier) -- allows creative combo design like "Shield+Heal = extra armor" or "Fireball+Mana Drain = extra mana regen"
- Card reward chance after combat (not guaranteed) -- maintains rarity feel, prevents deck bloat from too many forced choices
- Drag-and-drop reorder with flat session cost -- encourages players to do all reordering at once rather than incremental adjustments

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 02-combat-deck-engine*
*Context gathered: 2026-03-25*
