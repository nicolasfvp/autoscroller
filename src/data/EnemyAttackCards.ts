// Enemy attack cards - generic attacks usable by multiple enemies
// Mirrors the structure of hero cards but with enemy-specific properties

import type { CardDefinition } from './types';

export interface EnemyAttackCard {
  id: string;
  name: string;
  description: string;
  baseDamage: number;
  cost?: number; // Not used for enemies, but kept for consistency
  affinity: 'attack' | 'defense' | 'counter' | 'agility' | 'fire' | 'water' | 'earth' | 'air';
  hitCount: number; // 1 = single attack, 3 = triple attack (claw), etc
  attackType: 'physical' | 'fire' | 'poison' | 'magic';
  specialEffect?: 'heal' | 'debuff' | 'stun' | 'poison';
  cardKey: string; // Asset key for card image
}

export const ENEMY_ATTACK_CARDS: Record<string, EnemyAttackCard> = {
  // Physical attacks
  claw: {
    id: 'claw',
    name: 'Claw',
    description: 'Triple slash attack with claws',
    baseDamage: 2, // x3 hits = 6 total
    affinity: 'attack',
    hitCount: 3,
    attackType: 'physical',
    cardKey: 'enemy/enemy_claw',
  },
  bite: {
    id: 'bite',
    name: 'Bite',
    description: 'Deep bite attack',
    baseDamage: 8,
    affinity: 'attack',
    hitCount: 1,
    attackType: 'physical',
    cardKey: 'enemy/enemy_bite',
  },
  slash: {
    id: 'slash',
    name: 'Slash',
    description: 'Sword slash attack',
    baseDamage: 8,
    affinity: 'attack',
    hitCount: 1,
    attackType: 'physical',
    cardKey: 'enemy/enemy_slash',
  },
  smash: {
    id: 'smash',
    name: 'Smash',
    description: 'Heavy crushing blow',
    baseDamage: 10,
    affinity: 'attack',
    hitCount: 1,
    attackType: 'physical',
    cardKey: 'enemy/enemy_smash',
  },
  slam: {
    id: 'slam',
    name: 'Slam',
    description: 'Tentacle slam impact',
    baseDamage: 9,
    affinity: 'attack',
    hitCount: 1,
    attackType: 'physical',
    cardKey: 'enemy/enemy_slam',
  },
  pierce: {
    id: 'pierce',
    name: 'Pierce',
    description: 'Stinger puncture attack',
    baseDamage: 5,
    affinity: 'attack',
    hitCount: 1,
    attackType: 'physical',
    specialEffect: 'poison',
    cardKey: 'enemy/enemy_pierce',
  },
  bone_throw: {
    id: 'bone_throw',
    name: 'Bone Throw',
    description: 'Hurl bones at target',
    baseDamage: 7,
    affinity: 'attack',
    hitCount: 1,
    attackType: 'physical',
    cardKey: 'enemy/enemy_bone_throw',
  },
  spit: {
    id: 'spit',
    name: 'Spit',
    description: 'Spit acidic goo',
    baseDamage: 4,
    affinity: 'attack',
    hitCount: 1,
    attackType: 'physical',
    cardKey: 'enemy/enemy_spit',
  },
  thorn_spike: {
    id: 'thorn_spike',
    name: 'Thorn Spike',
    description: 'Pierce with thorns and roots',
    baseDamage: 6,
    affinity: 'earth',
    hitCount: 1,
    attackType: 'physical',
    cardKey: 'enemy/enemy_thorn_spike',
  },

  // Fire attacks
  fire_breath: {
    id: 'fire_breath',
    name: 'Fire Breath',
    description: 'Breathe flames at enemy',
    baseDamage: 8,
    affinity: 'fire',
    hitCount: 1,
    attackType: 'fire',
    cardKey: 'enemy/enemy_fire_breath',
  },

  // Water attacks
  water_surge: {
    id: 'water_surge',
    name: 'Water Surge',
    description: 'Wave of rushing water',
    baseDamage: 7,
    affinity: 'water',
    hitCount: 1,
    attackType: 'physical',
    cardKey: 'enemy/enemy_water_surge',
  },

  // Poison attacks
  poison: {
    id: 'poison',
    name: 'Poison',
    description: 'Toxic spray or cloud',
    baseDamage: 5,
    affinity: 'water',
    hitCount: 1,
    attackType: 'poison',
    specialEffect: 'debuff',
    cardKey: 'enemy/enemy_poison',
  },

  // Magic attacks
  drain: {
    id: 'drain',
    name: 'Drain',
    description: 'Siphon life force',
    baseDamage: 6,
    affinity: 'counter',
    hitCount: 1,
    attackType: 'magic',
    specialEffect: 'heal',
    cardKey: 'enemy/enemy_drain',
  },
  curse: {
    id: 'curse',
    name: 'Curse',
    description: 'Cast magical curse',
    baseDamage: 5,
    affinity: 'counter',
    hitCount: 1,
    attackType: 'magic',
    specialEffect: 'debuff',
    cardKey: 'enemy/enemy_curse',
  },
};

// Helper to get attack card by id
export function getEnemyAttackCard(id: string): EnemyAttackCard | null {
  return ENEMY_ATTACK_CARDS[id] || null;
}

// Adapt an enemy attack card into the hero CardDefinition shape so it can be
// rendered through the shared CardFace mold (createCardFaceFromDef). The art
// lives under `enemy/enemy_*`, passed via CardFaceOptions.artKey, not here.
export function enemyAttackToCardDef(attack: EnemyAttackCard): CardDefinition {
  const totalDamage = attack.baseDamage * attack.hitCount;
  return {
    id: `enemy_${attack.id}`,
    name: attack.name,
    description: attack.description,
    category: 'attack',
    effects: [{ type: 'damage', value: totalDamage }],
    cooldown: 0,
    targeting: 'single',
    rarity: 'common',
    elements: [attack.affinity],
  } as CardDefinition;
}

// Get all attack cards used by a specific enemy
export function getEnemyAttackCards(enemyId: string): EnemyAttackCard[] {
  const mapping = ENEMY_ATTACK_CARD_MAPPING[enemyId];
  if (!mapping) return [];
  return mapping.map(id => ENEMY_ATTACK_CARDS[id]).filter(card => card !== undefined);
}

// Mapping of enemyId -> attack card ids
export const ENEMY_ATTACK_CARD_MAPPING: Record<string, string[]> = {
  // Normal enemies
  lost_lizard: ['claw'],
  corpse_eater: ['bite'],
  pocket_cat: ['claw'],
  baby_dragon: ['fire_breath'],
  mutated_salamander: ['fire_breath'],
  ancient_tree: ['thorn_spike'],
  mush: ['poison'],
  forge_slime: ['spit'],
  lava_golem: ['smash'],
  depths_horror: ['slam'],
  toxic_gooze: ['poison'],
  venomous_kobra: ['poison'],
  skeleton: ['bone_throw'],
  vampire: ['drain'],
  werewolf: ['claw'],
  scorpion: ['pierce'],
  fire_elemental: ['fire_breath'],

  // Bosses
  doom_knight: ['slash'],
  iron_golem: ['smash'],
  bog_witch: ['curse', 'drain'],
  desert_golem: ['smash'],
  infernal_dragon: ['fire_breath', 'claw'],
  boss_iron_golem: ['smash'],
};
