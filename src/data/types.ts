// Shared type definitions for all static game data schemas.
// All types must be JSON-serializable (no Map, no class instances, no functions).

// ── Card Types ──────────────────────────────────────────────

export type CardCategory = 'attack' | 'defense' | 'magic';

export interface CardCost {
  stamina?: number;
  mana?: number;
  defense?: number;
}

export interface CardEffect {
  type: 'damage' | 'heal' | 'armor' | 'stamina' | 'mana' | 'debuff';
  value: number;
  target: 'enemy' | 'self';
}

export interface CardUpgrade {
  effects?: CardEffect[];
  cost?: CardCost;
  cooldown?: number;
  description?: string;
}

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
  targeting: 'single' | 'aoe' | 'lowest-hp' | 'random' | 'self';
  /** Card rarity tier */
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
}

// ── Enemy Types ─────────────────────────────────────────────

export type AttackPattern = 'fixed' | 'random' | 'scaling' | 'conditional';

export interface EnemyAttack {
  damage: number;
  defense?: number;
  pattern: AttackPattern;
  specialEffect?: 'double' | 'stun' | 'debuff' | 'lifesteal';
}

export type BossBehaviorType = 'enrage' | 'shield' | 'multi_hit' | 'drain' | 'summon';

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
  type: 'normal' | 'elite' | 'boss';
  baseHP: number;
  baseDefense: number;
  attack: EnemyAttack;
  /** Independent attack cooldown in milliseconds */
  attackCooldown: number;
  goldReward: { min: number; max: number };
  color: number;
  bossType?: string;
  behaviors?: BossBehavior[];
  materialReward?: {
    chance: number;
    bonusMaterial: string;
    bonusAmount: { min: number; max: number };
  };
}

// ── Synergy Types ──────────────────────────────────────────

export interface SynergyDefinition {
  cardA: string;
  cardB: string;
  bonus: {
    type: 'damage' | 'armor' | 'heal' | 'stamina' | 'mana' | 'cost_waive';
    value: number;
    target: 'enemy' | 'self';
  };
  classRestriction?: string;
  displayName: string;
}

// ── Tile Types ──────────────────────────────────────────────

export type TileType = 'basic' | 'combat' | 'elite' | 'boss' | 'shop' | 'rest' | 'event' | 'treasure';

export interface TileTypeConfig {
  type: TileType;
  name: string;
  color: number;
  canPlaceManually: boolean;
}

// ── Relic Types ─────────────────────────────────────────────

export type RelicRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type RelicTrigger = 'combat_start' | 'turn_start' | 'card_played' | 'damage_taken' | 'heal' | 'passive';

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
}

// ── Event Types ─────────────────────────────────────────────

export type EventChoiceEffect = 'gain_hp' | 'lose_hp' | 'gain_gold' | 'lose_gold' | 'add_card' | 'remove_card' | 'gain_relic' | 'add_curse' | 'gain_material' | 'lose_material' | 'upgrade_card';

export interface EventChoiceEffectEntry {
  type: EventChoiceEffect;
  value?: number | string;
  material?: string;
}

export interface EventChoice {
  text: string;
  effects: EventChoiceEffectEntry[];
  requirement?: {
    minGold?: number;
    minHP?: number;
    minMaterial?: Record<string, number>;
  };
}

export interface EventDefinition {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
  weight?: number;
}

// ── Curse Types ─────────────────────────────────────────────

export interface CurseEffect {
  type: 'nothing' | 'damage_self' | 'reduce_damage' | 'increase_damage_taken';
  value?: number;
}

export interface CurseDefinition {
  id: string;
  name: string;
  description: string;
  effects: CurseEffect[];
  color: number;
}

// ── Pricing & Economy Types ─────────────────────────────────

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

import type { MaterialDefinition } from '../state/MetaState';

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

// ── Difficulty Types ────────────────────────────────────────

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

// ── Hero Stats Types ────────────────────────────────────────

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
}

// ── Enemy Drop Types ────────────────────────────────────────

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
