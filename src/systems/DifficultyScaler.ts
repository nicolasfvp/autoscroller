import difficultyConfig from '../data/difficulty.json';

export interface ScaledEnemyStats {
  hp: number;
  damage: number;
  defense: number;
  goldReward: number;
}

interface DifficultyConfig {
  percentPerLoop: number;
  percentPerBossKill: number;
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
  _loopCount: number,
  isBoss?: boolean,
  /**
   * Source of truth: LoopRunner persists `loop.difficultyMultiplier` and
   * advances it by `percentPerBossKill` each time a boss is defeated. Per-loop
   * scaling was removed — passing this is now effectively required for
   * post-boss content. Falls back to 1.0 (no scaling) when omitted.
   */
  precomputedMultiplier?: number,
): ScaledEnemyStats {
  let loopMult = precomputedMultiplier ?? 1.0;
  if (isBoss) {
    // Bosses scale at half the post-boss growth rate of normal enemies.
    loopMult = 1 + (loopMult - 1) * 0.5;
    loopMult *= config.bossMultiplier;
  }
  const avgGold = (baseEnemy.goldReward.min + baseEnemy.goldReward.max) / 2;
  return {
    hp: Math.floor(baseEnemy.baseHP * loopMult),
    damage: Math.floor(baseEnemy.attack.damage * loopMult),
    defense: Math.floor(baseEnemy.baseDefense * loopMult),
    // Use log2 scaling to prevent gold hyperinflation (feedback #23)
    goldReward: Math.floor(avgGold * Math.log2(loopMult + 1)),
  };
}

// Map speed is now player-controlled via RunState.mapSpeed (feedback #28)
export function getLoopSpeed(_loopCount: number): number {
  return config.baseSpeed;
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
