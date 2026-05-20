// Shared type definitions for all static game data schemas.
// All types must be JSON-serializable (no Map, no class instances, no functions).

// -- Status / Stack Identifiers --
// Phase 9 (Design v2) status system. Five primary stats (str + 4 new axes)
// plus seven elemental/condition stack identifiers. These extend the
// engine per-card / per-combat / per-run state vocabulary; mechanics
// (cooldown reduction from DEX, max-HP from VIT, etc.) land in Plan 3.

export type StatId = "str" | "vit" | "dex" | "int" | "spi";

export type StackId = "poison" | "bleed" | "burn" | "stun" | "slow" | "arcane" | "rage";

// -- Card Types --

export type CardCategory = "attack" | "defense" | "magic";

export interface CardCost {
  stamina?: number;
  mana?: number;
  defense?: number;
}

export type AuraModifierKind =
  | "str" | "vit" | "dex" | "int" | "spi" | "def" | "cd_reduction"
  // v3 extensions for archetype redesigns (Wave 1-3):
  | "burn_taken"          // adds +N to every burn application landed on bearer
  | "armor_bonus_pct"     // % multiplier on every armor effect resolved by bearer
  | "armor_bonus_flat"    // flat addend on every armor effect resolved by bearer
  | "damage_taken_pct"    // negative fraction reduces incoming damage to bearer
  | "damage_dealt_pct"    // positive fraction boosts outgoing damage by bearer
  | "hero_hit_bonus"      // flat add to every damage hit by bearer (Iron Reckoning)
  | "ignore_immunity";    // bearer ignores stack immunity of named stack

export type AuraTriggerKind =
  // v1 (already runtime-supported)
  | "on_armor_break" | "on_hp_pct_below"
  // v3 extensions (Wave 2/3 runtime):
  | "on_hit_dealt"            // hero lands a damaging hit
  | "on_hit_taken"            // hero takes a hit (regardless of armor)
  | "on_armor_gained"         // hero gains armor (optional min_amount)
  | "on_self_dot_tick"        // a DoT tick resolves on hero
  | "on_self_damage"          // hero takes any HP loss (incl. self-damage from cards)
  | "on_stack_threshold"      // bearer stack of a given type crosses threshold
  | "on_enemy_stack_threshold"// enemy stack of given type crosses threshold
  | "on_kill_with_stack"      // enemy killed while carrying named stack
  | "on_slow_applied"         // bearer applied a slow stack to an enemy
  | "on_cooldown_resolve"     // any card slot resolves cooldown (Frenzy hook)
  | "passive_armor_scaler";   // declarative: present-armor multiplier aura

export interface CardEffectCondition {
  /** Effect only fires (or value multiplied) when enemy has the given stack. */
  enemy_has_stack?: StackId;
  /** Effect only fires when hero has the given stack. */
  self_has_stack?: StackId;
  /** Effect only fires when hero current HP % is strictly below this number. */
  hero_hp_pct_below?: number;
  /** Effect only fires when hero current HP % is >= this number. */
  hero_hp_pct_atleast?: number;
  /** Effect only fires when hero armor is >= this number. */
  self_armor_atleast?: number;
  /** Multiplies the effect value by the number of stacks named in enemy_has_stack. */
  per_stack?: boolean;
  /** v3: effect only fires if enemy stun stack > 0. */
  enemy_stunned?: boolean;
  /** v3: effect only fires if enemy has at least N of the named stack. */
  enemy_stack_atleast?: { stack: StackId; value: number };
  /** v3: effect only fires if hero has at least N of the named stack. */
  self_stack_atleast?: { stack: StackId; value: number };
  /** v3: effect only fires if a same-cast `devour` resolved successfully. */
  devour_succeeded?: boolean;
}

/** Source key extended by v3 redesigns. Runtime parses these to read live
 *  values from CombatState rather than scaling off a stat axis. */
export type ScaleSourceKind =
  | "stat"
  | "armor"
  | "consumed_stack"          // value of stacks consumed by an in-this-cast `consume_stack` step
  | "enemy_pre_consume_stack" // snapshot of enemy stack count before this cast began
  | "self_stack"              // current hero pool of a named stack (consume_stack_value)
  | "missing_hp_pct"          // 0..100, used by Frenzy / scaling auras
  | "rage";                   // hero rageStacks (legacy alias)

export type StackScaleSource = {
  source: "stack";
  stack: StackId;
  side: "enemy" | "self";
  /** When set, reads pre-consume snapshot in this effect chain. */
  pre_consume?: boolean;
};

export interface CardEffect {
  type:
    // Existing (v1)
    | "damage" | "heal" | "armor" | "stamina" | "mana" | "debuff"
    // NEW (v2 / Phase 9) -- Plan 3 implements runtime resolution
    | "buff" | "debuff_stat" | "dot" | "stack" | "taunt"
    // NEW (Tier-1 redesign): time-decaying status effect on hero or enemy.
    | "aura"
    // v3 archetype redesigns:
    | "echo"                  // queue N re-triggers of next cards
    | "cd_debt"               // add N seconds to this card's next cooldown (Overload)
    | "convert_stack"         // gasta from-stacks, gera to-stacks (cross-stack converter)
    | "multiply_stack"        // multiplica stacks atuais do alvo (Catalyst)
    | "stack_boost"           // soma valor a cada stack já presente (Pyre Surge)
    | "devour"                // consome uma carta do deck pra ganhar buff
    | "force_trigger_all_cards"; // dispara todas as cartas do herói imediatamente
  value: number;
  target: "enemy" | "self" | "self_dot" | "aoe" | "enemy_nearest" | "self_deck";
  /**
   * Optional stat scaling: adds floor(stat / per) * value to the resolved value.
   * v1: `source: "armor"` reads target's current armor (enables Body Slam).
   * v3: extended source kinds — see ScaleSourceKind.
   */
  scale?: {
    stat: StatId;
    per: number;
    value: number;
    source?: ScaleSourceKind;
    /** When source="stack" via the special-cased path, names which stack to read. */
    stack?: StackId;
    /** When source reads stacks, which side carries them. */
    side?: "enemy" | "self";
    /** When source="enemy_pre_consume_stack", read snapshot taken before consume_stack fires. */
    pre_consume?: boolean;
  };
  /** Disambiguates which stack to apply for type="dot" or type="stack". */
  stack?: StackId;
  /** Damage variant: skip enemy defense subtraction. */
  pierce_armor?: boolean;
  /**
   * Tier-2: multi-hit damage. multi_hit:N means N additional hits beyond the
   * first, so multi_hit:2 = 3 total damage applications. Each hit re-applies
   * STR scaling, condition gates, and pierce_armor.
   */
  multi_hit?: number;
  /** v3: when this non-damage effect follows a multi_hit damage, replay it N+1 times. */
  per_hit?: boolean;
  /**
   * Tier-2: on a stack effect with negative value, consume up to |value| stacks
   * from the target. The pre-consume stack count is what subsequent `per_stack`
   * reads use, so an effects[] array can read-then-consume atomically.
   */
  consume_stack?: boolean;
  /** v3: name a stack whose pre-consume count this effect's `value` should be
   *  scaled by (multiplicative detonator like Hemotoxin Burst, Crimson Spiral). */
  consume_stack_value?: StackId;
  /** v3: lifesteal — heal % of damage dealt by this damage effect. */
  siphon?: number;
  /** v3: Channel — payload scales with seconds the slot waited past readiness. */
  channel?: { max_bonus: number; ramp_per_sec: number };
  /** v3: Overload — after this effect resolves, the card slot adds N ms to its
   *  next cooldown (independent of normal cooldown). */
  overload_lockout_ms?: number;
  /** v3: convert_stack source/target/cap. */
  from?: StackId;
  to?: StackId;
  cap?: number;
  /** v3: multiply_stack factor (×N current stacks). */
  factor?: number;
  /** v3: spread an applied stack to AoE / nearest targets. */
  spread?: { ratio: number; target: "aoe" | "enemy_nearest"; max_targets?: number };
  /** v3: devour params (consume one deck card permanently for combat). */
  devour?: { from_deck?: boolean; rarity?: "common" | "uncommon" | "rare" | "epic"; count?: number };
  /** Gate / multiplier: see CardEffectCondition. */
  condition?: CardEffectCondition;
  /** Aura: lifetime in ms before this effect decays off the target. null = no decay (manual). */
  ttl_ms?: number | null;
  /** v3 aura: periodic tick interval — fires `then` every N ms while alive. */
  tick_ms?: number;
  /** v3 aura: internal cooldown between trigger fires (anti-farm in multi-hit). */
  cooldown_ms?: number;
  /** v3 aura: minimum amount required for trigger (e.g. on_armor_gained ≥ 4). */
  min_amount?: number;
  /** v3 aura: channel-delay before aura becomes active (Demon Form 4s warm-up). */
  channel_ms?: number;
  /** Aura modifier (stat or cd_reduction) carried while the aura is alive. */
  modifier?: { kind: AuraModifierKind; value: number; stack?: StackId };
  /** v3 aura trigger threshold + stack (on_stack_threshold). */
  threshold_stack?: StackId;
  /** v3: stack name carried by the aura (used by on_kill_with_stack to gate). */
  payload_stack?: StackId;
  /** Aura: trigger name that fires the `then` effect once, then removes the aura.
   *  v3: many new trigger kinds — see AuraTriggerKind. */
  trigger?: AuraTriggerKind;
  /** Aura: threshold for on_hp_pct_below / on_stack_threshold triggers. */
  threshold?: number;
  /** Aura: effect to apply once when `trigger` fires. v3: may be array. */
  then?: CardEffect | CardEffect[];
}

export interface CardUpgrade {
  effects?: CardEffect[];
  cost?: CardCost;
  cooldown?: number;
  description?: string;
}

/** Element-based card system identifiers. See docs/CARDS_SYSTEM.md. */
export type ElementId =
  | "attack" | "defense" | "agility" | "counter"
  | "fire" | "water" | "air" | "earth";

export type CardTier = 1 | 2 | 3;

export interface CardDefinition {
  id: string;
  name: string;
  description: string;
  category: CardCategory;
  effects: CardEffect[];
  cost?: CardCost;
  /** Optional upgrade data overlay -- only changed fields */
  upgraded?: CardUpgrade;
  /** Unlock gating for meta-progression */
  unlockSource?: string;
  unlockTier?: number;
  /** Cooldown in seconds before card can be played again */
  cooldown: number;
  /** Targeting mode for this card */
  targeting: "single" | "aoe" | "lowest-hp" | "random" | "self";
  /** Card rarity tier */
  rarity: "common" | "uncommon" | "rare" | "epic";
  /** Class restriction (Phase 9 / Design v2). Omit for neutral. */
  classRestriction?: "warrior" | "mage" | "neutral";
  /** Element multiset that crafted this card (2-4 elements). Optional for legacy cards. */
  elements?: ElementId[];
  /** Tier 1 (2 elements), 2 (3 elements), or 3 (4 elements). Optional for legacy cards. */
  tier?: CardTier;
  /** True for Tier-3 mock placeholders not yet implemented. */
  locked?: boolean;
  /** v3: Exhaust — card fires once per combat and is then disabled until next combat. */
  exhaust?: boolean;
  /** v3: Frenzy — cooldown multiplier applied while hero HP fraction is below threshold. */
  frenzy?: { hero_hp_pct_below: number; cd_mult: number };
  /** v3: cooldown scaled by a runtime variable (e.g. hero rage stacks). */
  cooldown_scale?: {
    stat: "rage" | "missing_hp_pct";
    per: number;
    reduce_pct: number;   // 0.10 = 10% per `per` units
    min_pct: number;      // 0.40 = cap floor at 40% of base
  };
  /** v3: when set true, this card consumes all hero armor as part of resolution
   *  (used by Citadel Inferno detonator). The armor read happens before reset. */
  spend_armor?: "all" | number;
}

// -- Enemy Types --

export type AttackPattern = "fixed" | "random" | "scaling" | "conditional";

export interface EnemyAttack {
  damage: number;
  defense?: number;
  pattern: AttackPattern;
  specialEffect?: "double" | "stun" | "debuff" | "lifesteal";
}

export type BossBehaviorType = "enrage" | "shield" | "multi_hit" | "drain" | "summon";

export interface BossBehavior {
  type: BossBehaviorType;
  hpThreshold?: number;
  attackSpeedMultiplier?: number;
  interval?: number;
  shieldAmount?: number;
  hitCount?: number;
  damageMultiplier?: number;
  healPercent?: number;
  summonId?: string;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  type: "normal" | "elite" | "boss";
  baseHP: number;
  baseDefense: number;
  attack: EnemyAttack;
  /** Independent attack cooldown in milliseconds */
  attackCooldown: number;
  goldReward: { min: number; max: number };
  color: number;
  bossType?: string;
  behaviors?: BossBehavior[];
  /** Elemental affinity (Phase 10). Applies a secondary effect on each attack
   *  keyed to the element identity. Bosses use a 2x effect multiplier. */
  affinity?: ElementId;
  materialReward?: {
    chance: number;
    bonusMaterial: string;
    bonusAmount: { min: number; max: number };
  };
}

// -- Synergy Types --

export interface SynergyDefinition {
  cardA: string;
  cardB: string;
  bonus: {
    type:
      // Existing (v1)
      | "damage" | "armor" | "heal" | "stamina" | "mana" | "cost_waive"
      // NEW (v2 / Phase 9) -- Plan 3 implements runtime resolution
      | "dot" | "stat_buff" | "cooldown_reduction";
    value: number;
    target: "enemy" | "self";
    /** Used by stat_buff: which stat axis to buff. */
    stat?: StatId;
    /** Used by dot: which stack to apply. */
    stack?: StackId;
  };
  classRestriction?: string;
  displayName: string;
}

// -- Tile Types --

export type TileType = "basic" | "combat" | "elite" | "boss" | "rest" | "event" | "treasure";

export interface TileTypeConfig {
  type: TileType;
  name: string;
  color: number;
  canPlaceManually: boolean;
}

// -- Relic Types --

export type RelicRarity = "common" | "rare" | "epic" | "legendary";
export type RelicTrigger =
  // Existing (v1)
  | "combat_start" | "turn_start" | "card_played" | "damage_taken" | "heal" | "passive"
  // NEW (v2 / Phase 9) -- Plan 3 implements dispatch
  | "enemy_killed" | "card_drawn" | "rest_used" | "shop_visited" | "stat_changed"
  | "dot_tick";

export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  rarity: RelicRarity;
  trigger: RelicTrigger;
  effectType: string;
  stat?: string;
  stats?: Record<string, number>;
  value?: number;
  condition?: string;
  duration?: string;
  once_per?: string;
  icon: string;
  color: number;
  unlockSource?: string;
  unlockTier?: number;
  /** Class restriction (Phase 9 / Design v2). Omit for neutral. */
  classRestriction?: "warrior" | "mage" | "neutral";
}

// -- Pricing & Economy Types --

export interface PricingConfig {
  cardBasePrice: number;
  cardPricePerLoop: number;
  cardPriceCap: number;
  removeBasePrice: number;
  removeEscalation: number;
  removeCap: number;
  reorderBasePrice: number;
  reorderEscalation: number;
  reorderCap: number;
  relicPriceByRarity: Record<string, number>;
  relicPricePerLoop: number;
  relicPriceCap: Record<string, number>;
}

export interface LoopGrowthConfig {
  schedule: number[];
  maxTileLength: number;
}

import type { MaterialDefinition } from "../state/MetaState";

export interface MaterialDropConfig {
  materials: MaterialDefinition[];
  terrainDrops: Record<string, {
    primary: string;
    secondary?: string;
    baseAmount: { min: number; max: number };
    secondaryChance: number;
  }>;
  enemyBonusDrops: Record<string, {
    material: string;
    amount: { min: number; max: number };
    chance: number;
  }>;
  bossDrops: {
    materials: Record<string, { min: number; max: number }>;
  };
}

// -- Difficulty Types --

export interface DifficultyConfig {
  baseEnemyHPMultiplier: number;
  baseDamageMultiplier: number;
  generationScaling: number;
  goldDropMultiplier: number;
  cardDropRate: number;
  relicDropRate: number;
  eliteChance: number;
  eventChance: number;
  shopCost: {
    cardBase: number;
    removeCard: number;
    upgrade: number;
  };
}

// -- Hero Stats Types --

export interface HeroStatsConfig {
  maxHP: number;
  currentHP: number;
  maxDefense: number;
  currentDefense: number;
  maxStamina: number;
  currentStamina: number;
  maxMana: number;
  currentMana: number;
  strength: number;
  defenseMultiplier: number;
  moveSpeed: number;
  // -- Phase 9: stat axes (status system) --
  vitality: number;
  dexterity: number;
  intellect: number;
  spirit: number;
}

// -- Enemy Drop Types --

export interface EnemyDropConfig {
  enemyType: string;
  cardPool: string[];
  minDrops: number;
  maxDrops: number;
  choicesShown: number;
}

export interface TileDropConfig {
  tileType: string;
  dropChance: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface EnemyDropTable {
  cardDrops: EnemyDropConfig;
  tileDrops: TileDropConfig[];
}
