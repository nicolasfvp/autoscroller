import difficultyConfig from '../data/difficulty.json';

export interface ScaledEnemyStats {
  hp: number;
  damage: number;
  defense: number;
  goldReward: number;
}

interface DifficultyConfig {
  percentPerLoop: number;
  bossMultiplier: number;
  basicTileCombatChance: number;
  baseSpeed: number;
  speedScalePerLoop: number;
  bossEveryNLoops: number;
  baseLoopLength: number;
  loopGrowthOnBossKill: number;
  baseTilePointsPerLoop: number;
  tilePointScalePerLoop: number;
  metaLootPerCombat: { min: number; max: number };
  metaLootPerLoop: number;
  metaLootPerBoss: number;
  deathMetaLootPercent: number;
  deathXpPercent: number;
}

const config = difficultyConfig as DifficultyConfig;

export function scaleEnemyForLoop(
  baseEnemy: {
    baseHP: number;
    attack: { damage: number };
    baseDefense: number;
    goldReward: { min: number; max: number };
  },
  loopCount: number,
  isBoss?: boolean
): ScaledEnemyStats {
  let loopMult = 1 + (loopCount - 1) * config.percentPerLoop;
  if (isBoss) {
    loopMult *= config.bossMultiplier;
  }
  const avgGold = (baseEnemy.goldReward.min + baseEnemy.goldReward.max) / 2;
  return {
    hp: Math.floor(baseEnemy.baseHP * loopMult),
    damage: Math.floor(baseEnemy.attack.damage * loopMult),
    defense: Math.floor(baseEnemy.baseDefense * loopMult),
    goldReward: Math.floor(avgGold * Math.sqrt(loopMult)),
  };
}

export function getLoopSpeed(loopCount: number): number {
  return config.baseSpeed * Math.pow(config.speedScalePerLoop, loopCount - 1);
}

export function getDifficultyConfig(): DifficultyConfig {
  return config;
}
