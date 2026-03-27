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
  baseTilePointsPerLoop: number;
  tilePointScalePerLoop: number;
  deathMaterialPercent: number;
  deathXpPercent: number;
  resourceResetPercent: number;
  loopGrowth: {
    schedule: number[];
    maxTileLength: number;
  };
  pricing: {
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
  };
}

const config = difficultyConfig as unknown as DifficultyConfig;

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

// ── Loop growth (diminishing schedule with cap) ────────────

export function getLoopGrowth(bossKillCount: number): number {
  const schedule = config.loopGrowth.schedule;
  const idx = Math.min(bossKillCount, schedule.length - 1);
  return schedule[idx];
}

export function getLoopLength(baseTileLength: number, bossKillCount: number): number {
  let length = baseTileLength;
  for (let i = 0; i < bossKillCount; i++) {
    length += getLoopGrowth(i);
  }
  return Math.min(length, config.loopGrowth.maxTileLength);
}
