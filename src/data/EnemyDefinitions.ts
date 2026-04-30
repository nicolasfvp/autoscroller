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
        baseHP: 13000,
        baseDefense: 0,
        attack: {
            damage: 300,
            pattern: 'fixed'
        },
        goldReward: { min: 10, max: 20 },
        color: 0x00ff00
    },
    goblin: {
        id: 'goblin',
        name: 'Goblin',
        type: 'normal',
        baseHP: 100,
        baseDefense: 0,
        attack: {
            damage: 2,
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
        baseHP: 184,
        baseDefense: 3,
        attack: {
            damage: 3,
            defense: 2,
            pattern: 'fixed'
        },
        goldReward: { min: 20, max: 30 },
        color: 0x556b2f
    },
    mage: {
        id: 'mage',
        name: 'Dark Mage',
        type: 'normal',
        baseHP: 90,
        baseDefense: 0,
        attack: {
            damage: 5,
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
        baseHP: 240000,
        baseDefense: 5,
        attack: {
            damage: 2,
            defense: 2,
            pattern: 'scaling'
        },
        goldReward: { min: 50, max: 80 },
        color: 0xc0c0c0
    },
    boss_demon: {
        id: 'boss_demon',
        name: 'Demon Lord',
        type: 'boss',
        baseHP: 250,
        baseDefense: 1,
        attack: {
            damage: 5,
            pattern: 'scaling'
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
