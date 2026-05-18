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

export type AuraModifierKind = "str" | "vit" | "dex" | "int" | "spi" | "def" | "cd_reduction";

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
}

export interface CardEffect {
  type:
    // Existing (v1)
    | "damage" | "heal" | "armor" | "stamina" | "mana" | "debuff"
    // NEW (v2 / Phase 9) -- Plan 3 implements runtime resolution
    | "buff" | "debuff_stat" | "dot" | "stack" | "taunt"
    // NEW (Tier-1 redesign): time-decaying status effect on hero or enemy.
    | "aura";
  value: number;
  target: "enemy" | "self" | "self_dot";
  /**
   * Optional stat scaling: adds floor(stat / per) * value to the resolved value.
   * Tier-2: `source: "armor"` reads target's current armor instead of a stat axis
   * (enables Body Slam — damage equal to current armor).
   */
  scale?: { stat: StatId; per: number; value: number; source?: "stat" | "armor" };
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
  /**
   * Tier-2: on a stack effect with negative value, consume up to |value| stacks
   * from the target. The pre-consume stack count is what subsequent `per_stack`
   * reads use, so an effects[] array can read-then-consume atomically.
   */
  consume_stack?: boolean;
  /** Gate / multiplier: see CardEffectCondition. */
  condition?: CardEffectCondition;
  /** Aura: lifetime in ms before this effect decays off the target. */
  ttl_ms?: number;
  /** Aura modifier (stat or cd_reduction) carried while the aura is alive. */
  modifier?: { kind: AuraModifierKind; value: number };
  /** Aura: trigger name that fires the `then` effect once, then removes the aura. */
  trigger?: "on_armor_break" | "on_hp_pct_below";
  /** Aura: threshold for on_hp_pct_below trigger (0-100, hero HP %). */
  threshold?: number;
  /** Aura: effect to apply once when `trigger` fires. */
  then?: CardEffect;
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
