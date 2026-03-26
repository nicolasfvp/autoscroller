# Phase 2: Combat + Deck Engine - Research

**Researched:** 2026-03-25
**Domain:** Real-time auto-combat engine with per-card cooldowns, deck management, synergy system, warrior class with persistent XP, and combat UI
**Confidence:** HIGH

## Summary

Phase 2 implements the core differentiator of the game: fully automatic real-time combat driven by a player-constructed deck. The existing `CombatScene.ts` (~312 lines) is a God Scene that mixes combat logic, enemy AI, card resolution, visual effects, and UI all in one class using a simple 2-second turn loop. This must be replaced with a pure TypeScript `CombatEngine` that operates on RunState (from Phase 1), a `SynergySystem` for consecutive card pair detection, a `DeckManager` system for add/remove/reorder operations, a `WarriorClass` definition with persistent XP and passive skills, and thin Phaser scenes that only handle rendering.

The critical architectural principle: CombatEngine must be a pure TypeScript class with zero Phaser imports. It accepts a `tick(deltaMs)` call from the scene, manages per-card cooldown timers internally, reads/writes hero and enemy state, and emits events via the Phase 1 EventBus. The scene subscribes to events and renders animations. This separation is mandatory for future multiplayer (server runs the same engine) and for testability.

The combat model shifts from turn-based (current 2-second intervals) to cooldown-based real-time: each card has its own `cooldown` value (1.0s--3.0s), the hero plays the top card when the timer expires, both hero and enemy act on independent timers, and the deck maintains its order (no shuffle on reshuffle -- same order cycles).

**Primary recommendation:** Build CombatEngine as a pure state machine driven by `tick()` calls, with all combat state owned by a `CombatState` object that is separate from RunState (combat is transient). Synergy detection happens at card-play time by checking the previous card played. Deck management operations (add/remove/reorder) are pure functions on RunState's deck arrays.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Per-card cooldown as a card stat**: Each card definition includes a `cooldown` value in seconds. Hero plays next card when current card's cooldown expires
- **Cooldown range: 1.0s--3.0s** (medium pace). Light cards ~1.0s, heavy cards ~3.0s. A 10-card deck cycles in ~15-25s
- **Unaffordable cards: skip and move to next**. If hero can't afford a card's stamina/mana cost, skip it and try the next card in queue. Skipped card stays in its position for the next cycle
- **Enemy has independent cooldown timer**. Enemy attacks on its own timer, decoupled from hero card plays. Both sides act independently in real-time
- **Deck reshuffle**: When deck is exhausted, reshuffle and restart from the top (GDD 4.3 specifies same order preserved on reshuffle)
- **Exact consecutive pair trigger**: Card B must play immediately after Card A to trigger the synergy. Deck order directly maps to synergy strategy
- **Synergy effect on last card only**: The bonus effect applies only to the second card in the pair (the trigger card), not both cards
- **Bonus can be any effect type**: Each synergy pair defines its own bonus (extra damage, extra armor, heal, resource gen, etc.)
- **4-6 synergy pairs for v1**: Enough to reward intentional deck ordering without overwhelming
- **Visual: highlight + text flash**: When synergy triggers, flash "COMBO!" text, glow effect on both cards in the queue, bonus effect shown with distinct color
- **Class-exclusive synergies use same system**: Warrior-only synergy pairs use the same consecutive-pair mechanic, but certain pairs only activate for the warrior class
- **Drag-and-drop reordering** in the shop. Flat gold cost per reorder session
- **Card removal cost scales by deck size**: Cost = base / deckSize. Smaller decks = higher removal cost per card
- **Adding cards is free**: Accept or discard when earned (DECK-01)
- **Card reward choices: 3 cards weighted by rarity, pick 1 or skip**. Card rewards have a CHANCE to appear after each combat (not guaranteed)
- **Linear passive progression: 5-6 passives** unlocked in fixed order as XP accumulates
- **Passives: stat modifiers + conditional triggers**. Mix of flat bonuses and conditional effects
- **XP per combat won**: Each enemy type gives a specific XP amount. Bosses grant more XP
- **Death = lose all accumulated XP for the run**. Player only banks XP if they exit safely after boss
- **Warrior base stats**: Existing HeroStats (100 HP, 50 stamina, 30 mana, 1 strength, 1 defenseMultiplier) serve as warrior base
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMBT-01 | Combat is fully automatic -- hero plays cards from the top of the deck without player intervention | CombatEngine with tick()-driven loop, auto-plays top card when cooldown expires |
| CMBT-02 | Each card has its own cooldown (light cards are fast, heavy cards are slow) | `cooldown` field added to card JSON definition, CombatEngine tracks per-card timer |
| CMBT-03 | Card queue is visible during combat -- player sees entire deck order and upcoming cards | CombatScene UI renders the full deck array with current position indicator |
| CMBT-04 | Synergy triggers are visually highlighted during combat (combo indicator) | SynergySystem emits `synergy:triggered` events, scene renders flash + glow |
| CMBT-05 | Post-combat summary screen shows damage dealt/received, cards played, combos triggered | CombatEngine tracks `CombatStats` aggregate, passed to summary scene |
| CMBT-06 | When deck is exhausted, it reshuffles and restarts | CombatEngine resets deck pointer to 0 when reaching end (same order per GDD 4.3) |
| CMBT-07 | Cards are typed: attacks, defenses, and spells | Existing `CardCategory` type: 'attack' \| 'defense' \| 'magic' -- extend JSON schema with `cooldown` + `rarity` |
| CMBT-08 | Attacks and defenses cost stamina; spells cost mana | Existing `CardCost` interface with `stamina`/`mana`/`defense` fields -- no change needed |
| CMBT-09 | Cards and natural regeneration generate stamina/mana during combat | CombatEngine applies passive regen per tick interval (e.g., +1 stamina/2s, +1 mana/3s) |
| CMBT-10 | Stamina and mana reset between combats; HP persists across combats | CombatEngine resets resources at start; writes only HP back to RunState at end |
| CMBT-11 | Card targeting is defined per card (single target, AoE, lowest HP, random, etc) | Add `targeting` field to card definition: 'single' \| 'aoe' \| 'lowest_hp' \| 'random' |
| CMBT-12 | Enemies use simple AI with fixed stats and attack patterns (no card system) | EnemyAI with independent cooldown timer, attack patterns from EnemyDefinition |
| DECK-01 | Player can add cards to deck for free (accept or discard when earned) | DeckSystem.addCard() -- free, updates RunState.deck.active |
| DECK-02 | Player can remove cards at the shop with escalating gold cost | DeckSystem.removeCard() + cost formula: `baseCost * (1 + 0.25 * max(0, 15 - deckSize))` from GDD |
| DECK-03 | Player can reorder deck at the shop for a gold cost | DeckSystem.reorderDeck() with flat session cost (~30 gold) |
| DECK-04 | Sequential card synergies exist | SynergySystem with consecutive-pair lookup table |
| DECK-05 | Not all cards have synergies -- synergy presence is a balancing factor | Synergy table has 4-6 defined pairs; all other pairs are inert |
| DECK-06 | Class-exclusive combos exist (warrior-specific synergy chains) | Synergy definition includes optional `classRestriction: 'warrior'` field |
| DECK-07 | Player can view entire deck order at any time | DeckViewScene reads RunState.deck.active and renders card list |
| DECK-08 | Card reward choices: pick 1 of 3 cards after eligible combats | LootSystem.generateCardReward() with rarity weights, presented in RewardScene |
| HERO-01 | Warrior is the playable class with defined base stats | WarriorClass definition: 100 HP, 50 stamina, 30 mana, 1 strength, 1 defenseMultiplier |
| HERO-02 | Class XP earned per run persists between runs | XP stored in meta-progression (not RunState). Banked on safe exit, lost on death |
| HERO-03 | Passive skills unlocked via class XP | PassiveSkillSystem: linear 5-6 skill tree, each skill modifies hero stats or adds conditional triggers |
| HERO-04 | Class-exclusive card synergies (warrior-specific sequential combos) | Same as DECK-06, synergy pairs with `classRestriction` |
| PLSH-01 | Death screen with comprehensive run statistics | DeathScene reads CombatStats + RunState for aggregate stats |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phaser | 3.90.0 | Rendering, scene management, tweens, input (drag-and-drop) | Already installed. Scenes are thin wrappers over pure TS systems. |
| TypeScript | ^5.2.2 | Type safety for CombatEngine, EventBus generics, card/synergy types | Already installed. |
| Vite | ^5.0.0 | Dev server and bundler | Already installed. No upgrade needed. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | -- | Phase 2 requires no new dependencies | All systems are pure TypeScript |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom drag-and-drop | Phaser 3 built-in `setInteractive({draggable: true})` + drag events | Phaser's built-in drag system is sufficient for deck reordering. No external library needed. |
| Manual tween chains for combat VFX | Phaser tweens + timeline | Phaser tweens are well-suited. Timeline API chains multiple tweens for synergy animations. |

**Installation:**
```bash
# No new packages required for Phase 2
```

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)
```
src/
  systems/
    combat/
      CombatEngine.ts        # Core combat loop (pure TS, zero Phaser)
      CardResolver.ts         # Card effect application logic
      EnemyAI.ts              # Enemy attack patterns + independent timer
      SynergySystem.ts        # Consecutive pair detection + bonus application
      CombatState.ts          # Transient combat state (not persisted)
      CombatStats.ts          # Aggregate stats tracker (damage, cards, combos)
    deck/
      DeckSystem.ts           # Add, remove, reorder operations on RunState
      LootSystem.ts           # Card reward generation with rarity weights
    hero/
      WarriorClass.ts         # Warrior base stats, starter deck, passive tree
      PassiveSkillSystem.ts   # Passive skill resolution (stat mods + conditionals)
      XPSystem.ts             # XP earn, bank, lose logic
  data/
    json/
      cards.json              # Extended with cooldown, targeting, rarity fields
      synergies.json          # Synergy pair definitions
      warrior-passives.json   # Passive skill tree data
      enemies.json            # Extended with attackCooldown field
  scenes/
    CombatScene.ts            # Thin wrapper: renders combat, delegates to CombatEngine
    RewardScene.ts            # Card reward choice UI (pick 1 of 3 or skip)
    PostCombatScene.ts        # Summary screen (damage, cards played, combos)
    DeathScene.ts             # Run statistics on death
    DeckViewScene.ts          # Full deck viewer (read-only)
    ShopScene.ts              # Deck management UI (add/remove/reorder)
  ui/
    CardQueueDisplay.ts       # Scrolling card queue UI component
    CombatHUD.ts              # HP/stamina/mana bars, cooldown indicator
    DragDropDeckEditor.ts     # Drag-and-drop deck reordering component
    SynergyFlash.ts           # "COMBO!" text + glow effect component
```

### Pattern 1: CombatEngine as Tick-Driven State Machine

**What:** A pure TypeScript class that receives `tick(deltaMs)` calls from the Phaser scene's update loop. Manages hero cooldown timer, enemy cooldown timer, card resolution, and win/loss conditions. Emits events via EventBus. Zero Phaser imports.

**When to use:** All combat logic. The scene only calls `engine.tick(delta)` in its `update()` method and subscribes to events for rendering.

**Implementation guidance:**

```typescript
// systems/combat/CombatEngine.ts

import { eventBus } from '../../core/EventBus';
import type { CombatState } from './CombatState';
import type { CombatStats } from './CombatStats';
import { SynergySystem } from './SynergySystem';
import { CardResolver } from './CardResolver';
import { EnemyAI } from './EnemyAI';

export class CombatEngine {
  private state: CombatState;
  private stats: CombatStats;
  private synergies: SynergySystem;
  private cardResolver: CardResolver;
  private enemyAI: EnemyAI;

  private heroCooldownTimer: number = 0;
  private enemyCooldownTimer: number = 0;
  private lastPlayedCardId: string | null = null;
  private deckPointer: number = 0;
  private isFinished: boolean = false;

  constructor(state: CombatState) {
    this.state = state;
    this.stats = createEmptyStats();
    this.synergies = new SynergySystem(state.heroClass);
    this.cardResolver = new CardResolver();
    this.enemyAI = new EnemyAI();
  }

  /** Called every frame by the scene's update() */
  tick(deltaMs: number): void {
    if (this.isFinished) return;

    // Advance hero cooldown
    this.heroCooldownTimer -= deltaMs;
    if (this.heroCooldownTimer <= 0) {
      this.playNextCard();
    }

    // Advance enemy cooldown (independent timer)
    this.enemyCooldownTimer -= deltaMs;
    if (this.enemyCooldownTimer <= 0) {
      this.enemyAttack();
    }

    // Natural resource regen
    this.applyPassiveRegen(deltaMs);

    // Check end conditions
    this.checkEndConditions();
  }

  private playNextCard(): void {
    const deck = this.state.deckOrder;
    if (deck.length === 0) return;

    // Find next affordable card (skip unaffordable)
    let attempts = 0;
    while (attempts < deck.length) {
      const cardId = deck[this.deckPointer];
      const card = getCardById(cardId);

      if (this.canAfford(card)) {
        // Check synergy BEFORE resolving
        const synergyBonus = this.synergies.check(
          this.lastPlayedCardId, cardId
        );

        // Pay cost and apply effects
        this.cardResolver.resolve(card, this.state, synergyBonus);
        this.lastPlayedCardId = cardId;
        this.stats.cardsPlayed++;

        // Set cooldown to THIS card's cooldown value
        this.heroCooldownTimer = card.cooldown * 1000; // seconds to ms

        // Emit events for scene to render
        eventBus.emit('combat:card-played', {
          cardId, damage: /* computed */,
          deckPosition: this.deckPointer
        });

        if (synergyBonus) {
          this.stats.synergiesTriggered++;
          eventBus.emit('combat:synergy-triggered', {
            cardA: this.lastPlayedCardId,
            cardB: cardId,
            bonusType: synergyBonus.type,
            bonusValue: synergyBonus.value
          });
        }

        this.advanceDeckPointer();
        return;
      }

      // Card unaffordable -- skip to next
      eventBus.emit('combat:card-skipped', { cardId });
      this.advanceDeckPointer();
      attempts++;
    }

    // All cards unaffordable -- wait for regen
    this.heroCooldownTimer = 500; // check again in 0.5s
  }

  private advanceDeckPointer(): void {
    this.deckPointer++;
    if (this.deckPointer >= this.state.deckOrder.length) {
      // Deck exhausted -- restart from top (same order per GDD 4.3)
      this.deckPointer = 0;
      this.stats.reshuffles++;
      eventBus.emit('combat:deck-reshuffled', {});
    }
  }

  getStats(): CombatStats { return { ...this.stats }; }
}
```

**Confidence:** HIGH -- tick-driven game loop is the standard pattern for real-time game systems decoupled from rendering.

### Pattern 2: CombatState as Transient Object

**What:** A transient state object created at combat start, destroyed at combat end. Separate from RunState because combat has fields that don't persist (enemy HP, deck pointer, cooldown timers).

```typescript
// systems/combat/CombatState.ts

export interface CombatState {
  // Hero (copied from RunState at combat start)
  heroHP: number;
  heroMaxHP: number;
  heroStamina: number;
  heroMaxStamina: number;
  heroMana: number;
  heroMaxMana: number;
  heroDefense: number;
  heroStrength: number;
  heroDefenseMultiplier: number;
  heroClass: string;

  // Deck (order from RunState, used as-is)
  deckOrder: string[];  // card IDs in play order

  // Enemy
  enemyId: string;
  enemyHP: number;
  enemyMaxHP: number;
  enemyDefense: number;
  enemyDamage: number;
  enemyAttackCooldown: number;  // ms between attacks
  enemyPattern: string;
  enemySpecialEffect: string | null;

  // Active passives (resolved from warrior class + XP)
  activePassives: ResolvedPassive[];
}

export function createCombatState(
  run: RunState,
  enemy: ScaledEnemy
): CombatState {
  return {
    heroHP: run.hero.currentHP,
    heroMaxHP: run.hero.maxHP,
    heroStamina: run.hero.maxStamina,  // Reset to max per CMBT-10
    heroMaxStamina: run.hero.maxStamina,
    heroMana: run.hero.maxMana,        // Reset to max per CMBT-10
    heroMaxMana: run.hero.maxMana,
    heroDefense: 0,                     // Reset each combat
    heroStrength: run.hero.strength,
    heroDefenseMultiplier: run.hero.defenseMultiplier,
    heroClass: 'warrior',
    deckOrder: [...run.deck.active],
    enemyId: enemy.id,
    enemyHP: enemy.hp,
    enemyMaxHP: enemy.hp,
    enemyDefense: enemy.defense,
    enemyDamage: enemy.damage,
    enemyAttackCooldown: enemy.attackCooldown,
    enemyPattern: enemy.pattern,
    enemySpecialEffect: enemy.specialEffect,
    activePassives: resolvePassives(run),
  };
}
```

**Confidence:** HIGH -- separating transient combat state from persistent run state prevents save/load bugs and makes combat restartable.

### Pattern 3: Synergy System as Data-Driven Lookup

**What:** A lookup table of `{cardA, cardB, bonus, classRestriction?}` loaded from JSON. At card-play time, check if `(lastPlayedCardId, currentCardId)` exists in the table.

```typescript
// systems/combat/SynergySystem.ts

export interface SynergyDefinition {
  cardA: string;       // First card in the pair
  cardB: string;       // Second card (trigger card)
  bonus: {
    type: 'damage' | 'armor' | 'heal' | 'stamina' | 'mana';
    value: number;
    target: 'enemy' | 'self';
  };
  classRestriction?: string;  // e.g., 'warrior'
  displayName: string;        // e.g., "Counter Attack!"
}

export class SynergySystem {
  private pairs: Map<string, SynergyDefinition>; // key: "cardA|cardB"
  private heroClass: string;

  constructor(heroClass: string) {
    this.heroClass = heroClass;
    this.pairs = new Map();
    // Load from synergies.json
    for (const syn of synergyData) {
      this.pairs.set(`${syn.cardA}|${syn.cardB}`, syn);
    }
  }

  check(
    lastCardId: string | null,
    currentCardId: string
  ): SynergyDefinition | null {
    if (!lastCardId) return null;
    const key = `${lastCardId}|${currentCardId}`;
    const syn = this.pairs.get(key);
    if (!syn) return null;
    // Check class restriction
    if (syn.classRestriction && syn.classRestriction !== this.heroClass) {
      return null;
    }
    return syn;
  }
}
```

**Recommended v1 synergy pairs (4-6):**

| # | Card A | Card B | Bonus | Class | Display |
|---|--------|--------|-------|-------|---------|
| 1 | defend | strike | +8 damage to enemy | warrior | "Counter Attack!" |
| 2 | shield-wall | fury | Fury costs 0 defense | warrior | "Fortified Fury!" |
| 3 | heavy-hit | heavy-hit | +50% damage on second | warrior | "Berserker Rage!" |
| 4 | heal | fireball | +10 damage to enemy | -- | "Channeled Fire!" |
| 5 | mana-drain | arcane-shield | +5 armor to self | -- | "Arcane Conversion!" |
| 6 | fortify | strike | +12 damage to enemy | -- | "Iron Fist!" |

**Confidence:** HIGH -- consecutive pair lookup with O(1) Map access is simple, correct, and extensible.

### Pattern 4: Card JSON Schema Extension

**What:** Extend the existing 14-card definitions with `cooldown`, `targeting`, and `rarity` fields needed for Phase 2.

```json
{
  "id": "strike",
  "name": "Strike",
  "description": "Deal 10 damage.",
  "category": "attack",
  "rarity": "common",
  "cooldown": 1.2,
  "targeting": "single",
  "effects": [{ "type": "damage", "value": 10, "target": "enemy" }],
  "cost": null
}
```

**Recommended cooldown values:**

| Card | Cooldown (s) | Rationale |
|------|-------------|-----------|
| Strike | 1.2 | Basic attack, fast |
| Heavy Hit | 1.8 | Moderate cost, moderate speed |
| Fury | 2.2 | High damage, slow |
| Berserker | 3.0 | Maximum damage, slowest |
| Defend | 1.0 | Defensive, fastest |
| Shield Wall | 1.5 | Good defense, moderate |
| Fortify | 2.0 | Heavy defense, slow |
| Iron Skin | 1.8 | Magic defense, moderate |
| Fireball | 1.5 | Magic damage, moderate |
| Heal | 2.0 | Powerful effect, slow |
| Arcane Shield | 1.5 | Light magic defense |
| Rejuvenate | 1.2 | Utility, fast |
| Mana Drain | 1.0 | Utility + light damage, fast |
| Weaken | 1.8 | Debuff, moderate |

**Card rarity tiers for reward selection:**

| Rarity | Weight | Cards |
|--------|--------|-------|
| common | 60% | Strike, Defend, Heavy Hit, Shield Wall, Fireball |
| uncommon | 30% | Fury, Iron Skin, Arcane Shield, Rejuvenate, Mana Drain, Heal |
| rare | 10% | Berserker, Fortify, Weaken |

**Confidence:** HIGH -- cooldown values follow the design directive (1.0s--3.0s range, proportional to card power).

### Pattern 5: Warrior Class and XP System

**What:** Warrior definition with base stats, starter deck, and a linear passive skill tree. XP is earned per combat, banked only on safe boss exit, lost entirely on death.

```typescript
// systems/hero/WarriorClass.ts

export interface PassiveSkill {
  id: string;
  name: string;
  description: string;
  xpThreshold: number;  // Cumulative XP needed to unlock
  effect: PassiveEffect;
}

export interface PassiveEffect {
  type: 'stat_modifier' | 'conditional_trigger';
  // stat_modifier: permanently modifies a hero stat
  stat?: keyof HeroState;
  value?: number;
  isPercent?: boolean;
  // conditional_trigger: fires when condition met
  condition?: string;  // e.g., 'consecutive_attacks_2'
  triggerEffect?: { type: string; value: number; target: string };
}

export const WARRIOR_PASSIVES: PassiveSkill[] = [
  {
    id: 'vigor',
    name: 'Vigor',
    description: '+10 Max HP',
    xpThreshold: 100,
    effect: { type: 'stat_modifier', stat: 'maxHP', value: 10 }
  },
  {
    id: 'endurance',
    name: 'Endurance',
    description: '+5 Max Stamina',
    xpThreshold: 250,
    effect: { type: 'stat_modifier', stat: 'maxStamina', value: 5 }
  },
  {
    id: 'iron_body',
    name: 'Iron Body',
    description: '+10% defense efficiency',
    xpThreshold: 450,
    effect: { type: 'stat_modifier', stat: 'defenseMultiplier', value: 0.1 }
  },
  {
    id: 'battle_rage',
    name: 'Battle Rage',
    description: '+15% damage after 2 consecutive attacks',
    xpThreshold: 700,
    effect: {
      type: 'conditional_trigger',
      condition: 'consecutive_attacks_2',
      triggerEffect: { type: 'damage_bonus_percent', value: 15, target: 'self' }
    }
  },
  {
    id: 'second_wind',
    name: 'Second Wind',
    description: 'Recover 5 Stamina on deck reshuffle',
    xpThreshold: 1000,
    effect: {
      type: 'conditional_trigger',
      condition: 'deck_reshuffled',
      triggerEffect: { type: 'stamina', value: 5, target: 'self' }
    }
  }
];
```

**XP per enemy type (recommended):**

| Enemy | XP |
|-------|-----|
| Normal (Slime, Goblin, etc.) | 10-15 |
| Elite (Elite Knight) | 30-40 |
| Boss (Demon Lord) | 80-100 |

**Confidence:** HIGH -- linear progression with cumulative thresholds is well-understood and easy to balance.

### Pattern 6: Enemy Independent Cooldown

**What:** Each enemy type has an `attackCooldown` value in its definition. The enemy attacks on its own timer, independent of the hero.

**Recommended enemy cooldowns:**

| Enemy | Attack Cooldown (s) | Rationale |
|-------|-------|-----------|
| Slime | 2.5 | Slow, predictable |
| Goblin | 1.5 | Fast, matches "double attack" theme |
| Orc | 3.0 | Slow but hits hard |
| Dark Mage | 2.0 | Moderate, conditional bonus |
| Elite Knight | 2.0 | Moderate, scaling damage |
| Demon Lord | 2.5 | Moderate, lifesteal sustains |

**Confidence:** MEDIUM -- values are reasonable starting points but will need playtesting.

### Anti-Patterns to Avoid
- **Combat logic in Phaser scenes:** The existing `CombatScene.ts` pattern. All combat resolution must be in `CombatEngine`. The scene only renders.
- **Phaser timers for combat loop:** The existing `this.time.addEvent({ delay: 2000, loop: true })` pattern. Use `tick(delta)` with manual cooldown countdown instead -- this is deterministic, testable, and works on a server.
- **Storing CardDefinition objects in RunState:** Store card IDs (strings) only. Look up definitions via `getCardById()` when needed.
- **Mixing transient combat state with persistent RunState:** CombatState is created on combat start and destroyed on combat end. Only `hero.currentHP` is written back.
- **Anonymous callbacks for drag-and-drop:** Store references for cleanup. Phaser drag events must be unbound on scene shutdown.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reordering | Custom mouse tracking + position swapping | Phaser `setInteractive({draggable: true})` + `drag`, `dragstart`, `dragend`, `drop` events | Phaser handles hit testing, drag offsets, and pointer events across input types |
| Tween chains for combat animations | Manual setTimeout chains | Phaser `tweens.chain()` or `tweens.add()` with `onComplete` callbacks | Phaser tweens handle easing, cleanup, and scene lifecycle automatically |
| Weighted random selection | Custom weighted random | Simple alias method or cumulative weight lookup (10 lines) | Too small for a library, but don't use naive O(n) random per call |
| Cooldown timers | `setInterval`/`setTimeout` | Manual countdown in `tick()`: `timer -= delta; if (timer <= 0) { fire(); }` | Deterministic, testable, pauseable, no browser timer issues |

**Key insight:** Phase 2 requires zero new dependencies. Everything is pure TypeScript game logic operating on data structures, with Phaser only for rendering.

## Common Pitfalls

### Pitfall 1: Non-Deterministic Combat
**What goes wrong:** Using `Math.random()` directly makes combat unreproducible. Two runs with the same deck and enemy produce different outcomes. Cannot debug, cannot replay, cannot sync multiplayer.
**Why it happens:** Random is used for: enemy attack variation (Goblin's 80%-120%), double attack chance (30%), enemy selection, and card reward generation.
**How to avoid:** Use a seeded PRNG (e.g., mulberry32 or xoshiro128). The seed is stored in RunState. All random calls go through `runRng.next()`. CombatEngine accepts the RNG as a dependency.
**Warning signs:** Bug reports you cannot reproduce. "It worked last time" syndrome.

### Pitfall 2: Resource Deadlock (All Cards Unaffordable)
**What goes wrong:** Hero has no stamina and no mana. All cards in the deck cost resources. The hero stands still doing nothing while the enemy kills them. Combat becomes un-interactable and feels broken.
**Why it happens:** Aggressive card costs + no free cards in later deck builds + insufficient natural regen.
**How to avoid:** (1) Ensure at least one zero-cost card exists in the starter deck (Strike and Defend have no cost). (2) Natural regen rates must be tuned so the hero eventually recovers enough to play something. (3) The "skip unaffordable" logic must cycle through ALL cards before waiting, not just check the top card. (4) Consider a "desperation attack" -- if all cards are unaffordable for N seconds, do a weak auto-attack.
**Warning signs:** Hero stands still for more than 3-4 seconds during playtesting.

### Pitfall 3: Synergy Disruption by Skipped Cards
**What goes wrong:** Player carefully orders deck for synergies: [Defend, Strike, Shield Wall, Fury]. But Defend is skipped (can't afford stamina cost). Now Strike plays first, followed by Shield Wall. The Defend+Strike synergy and the ShieldWall+Fury synergy are both broken.
**Why it happens:** The "skip unaffordable" mechanic changes the effective play sequence without changing deck order.
**How to avoid:** Track `lastPlayedCardId` (not `lastCardInDeck`). Synergy checks against the actually-played sequence, not the deck sequence. Document this clearly: "Synergies fire on actually played sequence, so resource management affects synergy activation."
**Warning signs:** Players report synergies "randomly not working" -- they don't realize skipped cards break the chain.

### Pitfall 4: Cooldown-Based Combat Too Fast or Too Slow
**What goes wrong:** With 1.0s cooldowns, combat resolves in seconds -- player can't follow what happened. With 3.0s cooldowns, combat is a boring slog.
**Why it happens:** The 1.0s-3.0s range seems reasonable on paper but needs visual pacing tuning.
**How to avoid:** Add a `combatSpeedMultiplier` setting (1x, 1.5x, 2x) that scales all cooldowns. Default to 1x. This lets players find their preferred pace and makes playtesting faster.
**Warning signs:** Players immediately look for a "speed up" button. Or players skip watching combat entirely.

### Pitfall 5: Drag-and-Drop Z-Order and Hit Area Issues
**What goes wrong:** Dragging a card in the deck editor causes it to appear behind other cards, or drop zones don't register correctly.
**Why it happens:** Phaser's depth/z-index defaults can cause dragged objects to render behind siblings. Drop zone hit areas may not align with visual positions.
**How to avoid:** Set `setDepth(999)` on drag start, restore original depth on drag end. Use `Phaser.Geom.Rectangle` for drop zones with generous padding. Test with 15+ cards in the editor.
**Warning signs:** Cards "disappear" during drag, or reorder operations drop cards in wrong positions.

### Pitfall 6: Post-Combat Stats Not Tracked
**What goes wrong:** Post-combat summary shows wrong or missing data because stats were tracked in scene-local variables that were lost on scene transitions.
**Why it happens:** Stats tracking happens inside the Phaser scene instead of the pure CombatEngine.
**How to avoid:** CombatStats is an object owned by CombatEngine, populated during `tick()` calls, and returned via `engine.getStats()` when combat ends. The scene passes this to the summary screen.
**Warning signs:** Summary shows 0 damage dealt, or "combos triggered: NaN".

## Code Examples

### Combat Scene Thin Wrapper

```typescript
// scenes/CombatScene.ts (THIN)
import { Scene } from 'phaser';
import { CombatEngine } from '../systems/combat/CombatEngine';
import { createCombatState } from '../systems/combat/CombatState';
import { getRun } from '../state/RunState';
import { eventBus } from '../core/EventBus';

export class CombatScene extends Scene {
  private engine!: CombatEngine;

  // Named handlers for cleanup
  private onCardPlayed!: (data: any) => void;
  private onSynergyTriggered!: (data: any) => void;
  private onDamageDealt!: (data: any) => void;
  private onCombatEnd!: (data: any) => void;
  private onCardSkipped!: (data: any) => void;

  constructor() { super('CombatScene'); }

  create(data: { enemyId: string }) {
    const run = getRun();
    const enemy = scaleEnemy(getEnemyDef(data.enemyId), run.loop.count);
    const combatState = createCombatState(run, enemy);

    this.engine = new CombatEngine(combatState);

    // Setup visuals (HUD, card queue, enemy sprite, etc.)
    this.setupUI(combatState);

    // Bind named event handlers
    this.onCardPlayed = (d) => this.renderCardPlay(d);
    this.onSynergyTriggered = (d) => this.renderSynergyFlash(d);
    this.onDamageDealt = (d) => this.renderDamage(d);
    this.onCombatEnd = (d) => this.handleCombatEnd(d);
    this.onCardSkipped = (d) => this.renderCardSkip(d);

    eventBus.on('combat:card-played', this.onCardPlayed);
    eventBus.on('combat:synergy-triggered', this.onSynergyTriggered);
    eventBus.on('combat:damage-dealt', this.onDamageDealt);
    eventBus.on('combat:end', this.onCombatEnd);
    eventBus.on('combat:card-skipped', this.onCardSkipped);

    // Cleanup on shutdown
    this.events.on('shutdown', this.cleanup, this);
  }

  update(_time: number, delta: number): void {
    // Single line -- all logic is in the engine
    this.engine.tick(delta);
  }

  private cleanup(): void {
    eventBus.off('combat:card-played', this.onCardPlayed);
    eventBus.off('combat:synergy-triggered', this.onSynergyTriggered);
    eventBus.off('combat:damage-dealt', this.onDamageDealt);
    eventBus.off('combat:end', this.onCombatEnd);
    eventBus.off('combat:card-skipped', this.onCardSkipped);
    this.children.removeAll(true);
  }
}
```

### Deck Reordering with Phaser Drag-and-Drop

```typescript
// ui/DragDropDeckEditor.ts
// Phaser built-in drag for card reordering

export function createDraggableCard(
  scene: Scene,
  x: number, y: number,
  cardId: string,
  index: number
): Phaser.GameObjects.Container {
  const card = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, 80, 110, 0x3d3d5c);
  bg.setStrokeStyle(2, 0xffffff);
  const label = scene.add.text(0, 0, getCardById(cardId)!.name, {
    fontSize: '11px', color: '#ffffff'
  }).setOrigin(0.5);
  card.add([bg, label]);
  card.setSize(80, 110);
  card.setInteractive({ draggable: true });
  card.setData('cardIndex', index);

  scene.input.on('dragstart', (_pointer: any, obj: any) => {
    if (obj === card) obj.setDepth(999);
  });
  scene.input.on('drag', (_pointer: any, obj: any, dragX: number, dragY: number) => {
    if (obj === card) { obj.x = dragX; obj.y = dragY; }
  });
  scene.input.on('dragend', (_pointer: any, obj: any) => {
    if (obj === card) {
      obj.setDepth(index);
      // Calculate new index based on drop position
      // Update RunState.deck.active order
    }
  });

  return card;
}
```

### Card Reward Generation

```typescript
// systems/deck/LootSystem.ts

interface RarityWeight { rarity: string; weight: number; }
const RARITY_WEIGHTS: RarityWeight[] = [
  { rarity: 'common', weight: 60 },
  { rarity: 'uncommon', weight: 30 },
  { rarity: 'rare', weight: 10 },
];

export function generateCardReward(
  rng: SeededRNG,
  count: number = 3,
  excludeIds: string[] = []
): string[] {
  const pool = getAllCards()
    .filter(c => !excludeIds.includes(c.id));

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    // Pick rarity
    const rarityRoll = rng.next() * 100;
    let cumulative = 0;
    let targetRarity = 'common';
    for (const rw of RARITY_WEIGHTS) {
      cumulative += rw.weight;
      if (rarityRoll < cumulative) { targetRarity = rw.rarity; break; }
    }

    // Pick card from that rarity
    const rarityPool = pool.filter(c => c.rarity === targetRarity);
    if (rarityPool.length > 0) {
      const idx = Math.floor(rng.next() * rarityPool.length);
      result.push(rarityPool[idx].id);
    }
  }
  return result;
}

/** Card reward drop chance after combat (recommended: 70%) */
export const CARD_REWARD_CHANCE = 0.7;
```

## State of the Art

| Old Approach (Existing Code) | Current Approach (Phase 2) | Impact |
|------------------------------|---------------------------|--------|
| 2-second fixed turn interval (`time.addEvent({ delay: 2000 })`) | Per-card cooldown via `tick(delta)` countdown | Combat pacing varies by card weight; feels dynamic rather than metronome |
| Turn-based (hero plays, then enemy attacks) | Independent cooldown timers for hero and enemy | Both sides act asynchronously; creates tension and unpredictability |
| No synergy system | Data-driven consecutive pair lookup | Deck ordering becomes strategic |
| Combat logic inside CombatScene (~300 lines) | Pure TS CombatEngine + thin scene wrapper | Testable, future-multiplayer-ready |
| No post-combat feedback | CombatStats tracker + summary screen | Player learns from combat outcomes |
| Singleton DeckManager | DeckSystem as pure functions on RunState | Serializable, resettable, no side effects |
| No XP or class system | WarriorClass + PassiveSkillSystem + XPSystem | Persistent meta-progression motivation |

**Deprecated/outdated (in context of this project):**
- `Phaser.Time.TimerEvent` for combat loop: Replace with `tick(delta)` pattern
- Module-level `getDeckManager()` singleton: Replaced by RunState + DeckSystem
- `addGold()` module function: Replaced by RunState mutation

## Open Questions

1. **Reshuffle preserves order or re-randomizes?**
   - What we know: GDD 4.3 says "todas as cartas voltam para o topo na mesma ordem original" -- same original order
   - What we decided in CONTEXT.md: "When deck is exhausted, reshuffle and restart from the top"
   - Recommendation: Preserve order. The deck pointer resets to 0, cards stay in their RunState order. This is consistent with the "deck ordering is strategy" philosophy. The word "reshuffle" in the requirement text is misleading -- it means "restart."

2. **Defense between combats**
   - What we know: GDD 4.6 says "Comportamento entre combates: a definir (reseta ou persiste parcialmente)"
   - Recommendation: Reset defense to 0 at combat start. Defense is a combat-only buffer generated by cards. This is simpler and matches Slay the Spire convention.

3. **Natural regen rates during combat**
   - What we know: CONTEXT.md defers exact rates to Claude's discretion
   - Recommendation: +2 stamina per 3 seconds, +1 mana per 3 seconds. This ensures a 10-card deck with moderate costs doesn't deadlock but doesn't trivialize resource management.

4. **Card reward drop chance**
   - What we know: "CHANCE to appear after each combat (not guaranteed)"
   - Recommendation: 70% for normal enemies, 100% for elites and bosses. This matches "not guaranteed" while ensuring adequate card acquisition.

5. **Combat speed multiplier**
   - What we know: Not explicitly discussed in CONTEXT.md
   - Recommendation: Implement a 1x/1.5x/2x speed multiplier from the start. It costs almost nothing (multiply all cooldowns by the factor) and massively improves playtesting and player experience.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (installed in Phase 1 Wave 0) |
| Config file | vitest.config.ts (from Phase 1) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMBT-01 | CombatEngine auto-plays cards from deck top on tick | unit | `npx vitest run tests/systems/combat/combat-engine.test.ts -t "auto-play"` | No -- Wave 0 |
| CMBT-02 | Each card's cooldown is respected (light fast, heavy slow) | unit | `npx vitest run tests/systems/combat/combat-engine.test.ts -t "cooldown"` | No -- Wave 0 |
| CMBT-03 | Deck order accessible during combat | unit | `npx vitest run tests/systems/combat/combat-state.test.ts -t "deck visible"` | No -- Wave 0 |
| CMBT-04 | Synergy triggers when consecutive pair matches | unit | `npx vitest run tests/systems/combat/synergy.test.ts -t "trigger"` | No -- Wave 0 |
| CMBT-05 | CombatStats tracks damage/cards/combos accurately | unit | `npx vitest run tests/systems/combat/combat-stats.test.ts` | No -- Wave 0 |
| CMBT-06 | Deck pointer resets to 0 when deck exhausted | unit | `npx vitest run tests/systems/combat/combat-engine.test.ts -t "reshuffle"` | No -- Wave 0 |
| CMBT-07 | Cards have category field (attack/defense/magic) | unit | `npx vitest run tests/data/cards.test.ts -t "category"` | No -- Wave 0 |
| CMBT-08 | Attack/defense costs stamina, spells cost mana | unit | `npx vitest run tests/systems/combat/card-resolver.test.ts -t "cost"` | No -- Wave 0 |
| CMBT-09 | Passive regen generates stamina/mana over time | unit | `npx vitest run tests/systems/combat/combat-engine.test.ts -t "regen"` | No -- Wave 0 |
| CMBT-10 | Stamina/mana reset at combat start; HP persists | unit | `npx vitest run tests/systems/combat/combat-state.test.ts -t "reset"` | No -- Wave 0 |
| CMBT-11 | Card targeting affects correct targets | unit | `npx vitest run tests/systems/combat/card-resolver.test.ts -t "targeting"` | No -- Wave 0 |
| CMBT-12 | Enemy attacks on independent timer | unit | `npx vitest run tests/systems/combat/enemy-ai.test.ts` | No -- Wave 0 |
| DECK-01 | Add card to deck is free | unit | `npx vitest run tests/systems/deck/deck-system.test.ts -t "add free"` | No -- Wave 0 |
| DECK-02 | Removal cost escalates with smaller deck | unit | `npx vitest run tests/systems/deck/deck-system.test.ts -t "removal cost"` | No -- Wave 0 |
| DECK-03 | Reorder changes deck.active array | unit | `npx vitest run tests/systems/deck/deck-system.test.ts -t "reorder"` | No -- Wave 0 |
| DECK-04 | Synergy fires on exact consecutive pair | unit | `npx vitest run tests/systems/combat/synergy.test.ts` | No -- Wave 0 |
| DECK-05 | Non-synergy pairs produce no bonus | unit | `npx vitest run tests/systems/combat/synergy.test.ts -t "no match"` | No -- Wave 0 |
| DECK-06 | Class-restricted synergy only fires for correct class | unit | `npx vitest run tests/systems/combat/synergy.test.ts -t "class restriction"` | No -- Wave 0 |
| DECK-07 | Deck order readable from RunState | unit | `npx vitest run tests/state/runstate.test.ts -t "deck order"` | No -- Wave 0 |
| DECK-08 | Card reward generates 3 weighted-rarity choices | unit | `npx vitest run tests/systems/deck/loot-system.test.ts` | No -- Wave 0 |
| HERO-01 | Warrior base stats match definition | unit | `npx vitest run tests/systems/hero/warrior.test.ts -t "base stats"` | No -- Wave 0 |
| HERO-02 | XP persists between runs (bank on exit, lose on death) | unit | `npx vitest run tests/systems/hero/xp-system.test.ts` | No -- Wave 0 |
| HERO-03 | Passives unlock at correct XP thresholds | unit | `npx vitest run tests/systems/hero/passive-skills.test.ts` | No -- Wave 0 |
| HERO-04 | Warrior-exclusive synergies work | unit | `npx vitest run tests/systems/combat/synergy.test.ts -t "warrior exclusive"` | No -- Wave 0 |
| PLSH-01 | Death screen displays run statistics | manual-only | Visual verification -- death screen shows loops, damage, cards, cause of death | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/systems/combat/combat-engine.test.ts` -- CombatEngine tick, card play, cooldown, reshuffle, regen
- [ ] `tests/systems/combat/combat-state.test.ts` -- CombatState creation, resource reset, deck visibility
- [ ] `tests/systems/combat/card-resolver.test.ts` -- Effect application, cost payment, targeting
- [ ] `tests/systems/combat/enemy-ai.test.ts` -- Independent timer, attack patterns
- [ ] `tests/systems/combat/synergy.test.ts` -- Pair detection, class restriction, no false positives
- [ ] `tests/systems/combat/combat-stats.test.ts` -- Stats accumulation accuracy
- [ ] `tests/systems/deck/deck-system.test.ts` -- Add, remove (cost), reorder operations
- [ ] `tests/systems/deck/loot-system.test.ts` -- Weighted rarity generation
- [ ] `tests/systems/hero/warrior.test.ts` -- Base stats, starter deck
- [ ] `tests/systems/hero/xp-system.test.ts` -- Earn, bank, lose XP logic
- [ ] `tests/systems/hero/passive-skills.test.ts` -- Threshold unlocking, stat modification, conditional triggers
- [ ] `tests/data/cards.test.ts` -- Card JSON schema validation (cooldown, targeting, rarity fields present)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `CombatScene.ts` (312 lines), `CardDefinitions.ts` (175 lines), `EnemyDefinitions.ts` (166 lines), `HeroStats.ts` (36 lines), `DeckManager.ts` (73 lines), `DeathScene.ts` (52 lines), `CombatEffects.ts` (161 lines) -- all reviewed
- `.planning/GDD.md` -- Combat system (sections 4.1-4.9), deck management (5.1-5.6), hero/class (7.1-7.5), enemy (6.1-6.6)
- `.planning/research/ARCHITECTURE.md` -- CombatEngine extraction pattern, thin scene convention, EventBus integration
- `.planning/research/PITFALLS.md` -- Auto-combat readability (Pitfall 1), deck thinning (Pitfall 2), memory leaks (Pitfall 3), card ordering balance (Pitfall 7)
- `.planning/phases/01-architecture-foundation/01-CONTEXT.md` -- RunState shape, EventBus patterns, JSON data files
- `.planning/phases/02-combat-deck-engine/02-CONTEXT.md` -- All locked decisions for Phase 2

### Secondary (MEDIUM confidence)
- Phaser 3 drag-and-drop: `setInteractive({draggable: true})` pattern verified against Phaser docs
- Slay the Spire removal cost formula: referenced in GDD section 5.3

### Tertiary (LOW confidence)
- Cooldown values (1.0-3.0s): Estimated based on design constraints, needs playtesting validation
- XP thresholds (100-1000): Estimated based on GDD section 7.4, needs balancing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, pure TypeScript + existing Phaser
- Architecture: HIGH -- tick-driven engine, transient combat state, data-driven synergies are well-established patterns
- Combat mechanics: HIGH -- locked decisions from CONTEXT.md + GDD formulas provide complete specification
- Balance values (cooldowns, XP, regen): MEDIUM -- reasonable estimates but require playtesting
- Pitfalls: HIGH -- identified from existing codebase analysis and prior research

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable ecosystem, no expected breaking changes)
