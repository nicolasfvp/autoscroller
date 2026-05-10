// Lightweight enemy types + scaleEnemy. The legacy ENEMIES map and its
// helpers (getEnemyDefinition / getRandomEnemy / calculateEnemyAttack /
// ALL_ENEMY_IDS) used to live here but were unreachable from any active
// code path; the canonical roster lives in src/data/json/enemies.json
// and is loaded via DataLoader.

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

export function scaleEnemy(enemy: EnemyDefinition, loopCount: number): {
    hp: number;
    defense: number;
    damage: number;
    gold: number;
} {
    // Start at 50%, +10% per loop until 100% (loop 6), then +1.5% per loop
    const loop = Math.max(1, loopCount);
    const multiplier = loop <= 6
        ? 0.5 + (loop - 1) * 0.1
        : 1.0 + (loop - 6) * 0.015;
    return {
        hp: Math.floor(enemy.baseHP * multiplier),
        defense: Math.floor(enemy.baseDefense * multiplier),
        damage: Math.floor(enemy.attack.damage * multiplier),
        gold: Math.floor((enemy.goldReward.min + enemy.goldReward.max) * 0.5 * Math.sqrt(multiplier))
    };
}
