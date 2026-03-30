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

const ENEMIES: Record<string, EnemyDefinition> = {
    slime: {
        id: 'slime',
        name: 'Slime',
        type: 'normal',
        baseHP: 100,
        baseDefense: 0,
        attack: {
            damage: 8,
            pattern: 'fixed'
        },
        goldReward: { min: 10, max: 20 },
        color: 0x00ff00
    },
    goblin: {
        id: 'goblin',
        name: 'Goblin',
        type: 'normal',
        baseHP: 75,
        baseDefense: 0,
        attack: {
            damage: 6,
            pattern: 'random',
            specialEffect: 'double'
        },
        goldReward: { min: 15, max: 25 },
        color: 0x8b4513
    },
    orc: {
        id: 'orc',
        name: 'Orc',
        type: 'normal',
        baseHP: 175,
        baseDefense: 10,
        attack: {
            damage: 12,
            defense: 5,
            pattern: 'fixed'
        },
        goldReward: { min: 20, max: 30 },
        color: 0x556b2f
    },
    mage: {
        id: 'mage',
        name: 'Dark Mage',
        type: 'normal',
        baseHP: 85,
        baseDefense: 0,
        attack: {
            damage: 7,
            pattern: 'conditional',
            specialEffect: 'debuff'
        },
        goldReward: { min: 25, max: 35 },
        color: 0x9370db
    },
    elite_knight: {
        id: 'elite_knight',
        name: 'Elite Knight',
        type: 'elite',
        baseHP: 200,
        baseDefense: 15,
        attack: {
            damage: 15,
            defense: 8,
            pattern: 'scaling'
        },
        goldReward: { min: 50, max: 80 },
        color: 0xc0c0c0
    },
    boss_demon: {
        id: 'boss_demon',
        name: 'Demon Lord',
        type: 'boss',
        baseHP: 20,
        baseDefense: 0,
        attack: {
            damage: 20,
            defense: 10,
            pattern: 'scaling',
            specialEffect: 'lifesteal'
        },
        goldReward: { min: 100, max: 150 },
        color: 0x8b0000
    }
};

export function getEnemyDefinition(id: string): EnemyDefinition | undefined {
    return ENEMIES[id];
}

export function getRandomEnemy(type: 'normal' | 'elite' | 'boss' = 'normal'): EnemyDefinition {
    const filtered = Object.values(ENEMIES).filter(e => e.type === type);
    return filtered[Math.floor(Math.random() * filtered.length)];
}

export function scaleEnemy(enemy: EnemyDefinition, generation: number): {
    hp: number;
    defense: number;
    damage: number;
    gold: number;
} {
    const multiplier = generation === 1 ? 0.5 : 1 + Math.log2(generation); // Weaken enemies in the first loop
    return {
        hp: Math.floor(enemy.baseHP * multiplier),
        defense: Math.floor(enemy.baseDefense * multiplier),
        damage: Math.floor(enemy.attack.damage * multiplier),
        gold: Math.floor((enemy.goldReward.min + enemy.goldReward.max) * 0.5 * Math.sqrt(multiplier))
    };
}

export function calculateEnemyAttack(
    enemy: EnemyDefinition,
    scaled: { damage: number },
    turnNumber: number,
    heroHP: number,
    heroMaxHP: number
): { damage: number; defense?: number } {
    let damage = scaled.damage;
    let defense = enemy.attack.defense;

    switch (enemy.attack.pattern) {
        case 'fixed':
            break;
        case 'random':
            damage = Math.floor(scaled.damage * (0.8 + Math.random() * 0.4));
            break;
        case 'scaling':
            damage = scaled.damage + Math.floor(turnNumber * 0.5);
            break;
        case 'conditional':
            if (heroHP < heroMaxHP * 0.5) {
                damage = Math.floor(scaled.damage * 1.5);
            }
            break;
    }

    if (enemy.attack.specialEffect === 'double' && Math.random() < 0.3) {
        damage *= 2;
    }

    return { damage, defense };
}

export const ALL_ENEMY_IDS = Object.keys(ENEMIES);
