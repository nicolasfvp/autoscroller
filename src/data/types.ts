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

export interface CardDefinition {
  id: string;
  name: string;
  description: string;
  category: CardCategory;
  effects: CardEffect[];
  cost?: CardCost;
  upgraded?: boolean;
  upgradeBonus?: {
    damageBonus?: number;
    healBonus?: number;
    armorBonus?: number;
    costReduction?: Partial<CardCost>;
  };
  /** Cooldown in seconds before card can be played again */
  cooldown: number;
  /** Targeting mode for this card */
  targeting: 'single' | 'aoe' | 'lowest-hp' | 'random' | 'self';
}

// ── Enemy Types ─────────────────────────────────────────────

export type AttackPattern = 'fixed' | 'random' | 'scaling' | 'conditional';

export interface EnemyAttack {
  damage: number;
  defense?: number;
  pattern: AttackPattern;
  specialEffect?: 'double' | 'stun' | 'debuff' | 'lifesteal';
}

export interface EnemyDefinition {
  id: string;
  name: string;
  type: 'normal' | 'elite' | 'boss';
  baseHP: number;
  baseDefense: number;
  attack: EnemyAttack;
  goldReward: { min: number; max: number };
  color: number;
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

export interface RelicEffectDefinition {
  trigger: RelicTrigger;
  description: string;
  /** Effect parameters as JSON-serializable data (logic lives in systems, not in data) */
  params?: Record<string, number | string | boolean>;
}

export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  rarity: RelicRarity;
  effects: RelicEffectDefinition[];
  icon: string;
  color: number;
}

// ── Event Types ─────────────────────────────────────────────

export type EventChoiceEffect = 'gain_hp' | 'lose_hp' | 'gain_gold' | 'lose_gold' | 'add_card' | 'remove_card' | 'gain_relic' | 'add_curse';

export interface EventChoiceEffectEntry {
  type: EventChoiceEffect;
  value?: number | string;
}

export interface EventChoice {
  text: string;
  effects: EventChoiceEffectEntry[];
  requirement?: {
    minGold?: number;
    minHP?: number;
  };
}

export interface EventDefinition {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
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
