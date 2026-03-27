export type RelicRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type RelicTrigger = 'combat_start' | 'turn_start' | 'card_played' | 'damage_taken' | 'heal' | 'passive';

export interface LegacyRelicEffect {
    trigger: RelicTrigger;
    description: string;
    apply: (context: RelicContext) => void;
}

export interface RelicContext {
    heroStats?: any;
    card?: any;
    damage?: number;
    heal?: number;
    turnNumber?: number;
}

export interface LegacyRelicDefinition {
    id: string;
    name: string;
    description: string;
    rarity: RelicRarity;
    effects: LegacyRelicEffect[];
    icon: string;
    color: number;
}

const RELICS: Record<string, LegacyRelicDefinition> = {
    bronze_scale: {
        id: 'bronze_scale',
        name: 'Bronze Scale',
        description: '+15 Max HP',
        rarity: 'common',
        icon: '◊',
        color: 0xcd7f32,
        effects: [{
            trigger: 'passive',
            description: '+15 Max HP',
            apply: (ctx) => {
                if (ctx.heroStats) {
                    ctx.heroStats.maxHP += 15;
                    ctx.heroStats.currentHP += 15;
                }
            }
        }]
    },
    energy_potion: {
        id: 'energy_potion',
        name: 'Energy Potion',
        description: '+10 Max Stamina',
        rarity: 'common',
        icon: '⚡',
        color: 0xffff00,
        effects: [{
            trigger: 'passive',
            description: '+10 Max Stamina',
            apply: (ctx) => {
                if (ctx.heroStats) {
                    ctx.heroStats.maxStamina += 10;
                    ctx.heroStats.currentStamina += 10;
                }
            }
        }]
    },
    warrior_spirit: {
        id: 'warrior_spirit',
        name: 'Warrior Spirit',
        description: 'Attack cards cost 1 less Stamina',
        rarity: 'rare',
        icon: '⚔',
        color: 0xff6347,
        effects: [{
            trigger: 'card_played',
            description: 'Reduce stamina cost by 1',
            apply: (ctx) => {
                if (ctx.card?.category === 'attack' && ctx.card.cost?.stamina && ctx.heroStats) {
                    ctx.heroStats.currentStamina = Math.min(
                        ctx.heroStats.maxStamina,
                        ctx.heroStats.currentStamina + 1
                    );
                }
            }
        }]
    },
    iron_will: {
        id: 'iron_will',
        name: 'Iron Will',
        description: 'When you take damage, gain 2 Defense',
        rarity: 'rare',
        icon: '🛡',
        color: 0xc0c0c0,
        effects: [{
            trigger: 'damage_taken',
            description: 'Gain 2 Defense',
            apply: (ctx) => {
                if (ctx.heroStats && ctx.damage && ctx.damage > 0) {
                    ctx.heroStats.currentDefense += 2;
                }
            }
        }]
    },
    arcane_crystal: {
        id: 'arcane_crystal',
        name: 'Arcane Crystal',
        description: '+15 Max Mana',
        rarity: 'rare',
        icon: '♦',
        color: 0x9370db,
        effects: [{
            trigger: 'passive',
            description: '+15 Max Mana',
            apply: (ctx) => {
                if (ctx.heroStats) {
                    ctx.heroStats.maxMana += 15;
                    ctx.heroStats.currentMana += 15;
                }
            }
        }]
    },
    berserker_ring: {
        id: 'berserker_ring',
        name: 'Berserker Ring',
        description: '+50% Strength, -20% Max HP',
        rarity: 'epic',
        icon: '💍',
        color: 0xdc143c,
        effects: [{
            trigger: 'passive',
            description: '+50% Strength, -20% Max HP',
            apply: (ctx) => {
                if (ctx.heroStats) {
                    ctx.heroStats.strength *= 1.5;
                    ctx.heroStats.maxHP = Math.floor(ctx.heroStats.maxHP * 0.8);
                    ctx.heroStats.currentHP = Math.min(ctx.heroStats.currentHP, ctx.heroStats.maxHP);
                }
            }
        }]
    },
    demon_heart: {
        id: 'demon_heart',
        name: 'Demon Heart',
        description: 'First turn: Double all card damage',
        rarity: 'legendary',
        icon: '♥',
        color: 0x8b0000,
        effects: [{
            trigger: 'turn_start',
            description: 'First turn double damage',
            apply: (ctx) => {
                if (ctx.turnNumber === 1 && ctx.heroStats) {
                    ctx.heroStats._demonHeartActive = true;
                }
            }
        }]
    },
    phoenix_feather: {
        id: 'phoenix_feather',
        name: 'Phoenix Feather',
        description: 'When HP drops to 0, heal to 50% once per combat',
        rarity: 'legendary',
        icon: '🪶',
        color: 0xff4500,
        effects: [{
            trigger: 'damage_taken',
            description: 'Revive at 50% HP',
            apply: (ctx) => {
                if (ctx.heroStats && ctx.heroStats.currentHP <= 0 && !ctx.heroStats._phoenixUsed) {
                    ctx.heroStats.currentHP = Math.floor(ctx.heroStats.maxHP * 0.5);
                    ctx.heroStats._phoenixUsed = true;
                }
            }
        }]
    }
};

export function getRelicDefinition(id: string): LegacyRelicDefinition | undefined {
    return RELICS[id];
}

export function getRandomRelic(rarity?: RelicRarity): LegacyRelicDefinition {
    let pool = Object.values(RELICS);
    if (rarity) {
        pool = pool.filter(r => r.rarity === rarity);
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

export const ALL_RELICS = Object.values(RELICS);
