// Lightweight enemy types only. The canonical roster lives in
// src/data/json/enemies.json and is loaded via DataLoader. Enemy scaling
// is centralized in src/systems/DifficultyScaler.ts (`scaleEnemyForLoop`).

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
    materialReward?: { chance: number; bonusMaterial: string; bonusAmount: { min: number; max: number } };
    color: number;
    spriteKey?: string;
}
