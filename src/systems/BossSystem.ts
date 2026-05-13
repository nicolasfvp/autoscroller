import { scaleEnemyForLoop, type ScaledEnemyStats } from './DifficultyScaler';
import { rollMaterialDrops } from './LootGenerator';
import { resolveRunEnd, type RunEndResult } from './RunEndResolver';
import type { RunState } from '../state/RunState';

export interface BossEncounterData {
  enemyId: string;
  scaledStats: ScaledEnemyStats;
  isBoss: true;
}

// Base stats for the boss enemy
const BOSS_BASE_STATS = {
  baseHP: 150,
  attack: { damage: 25 },
  baseDefense: 10,
  goldReward: { min: 50, max: 80 },
};

export function triggerBossCombat(runState: RunState): BossEncounterData {
  const scaledStats = scaleEnemyForLoop(BOSS_BASE_STATS, runState.loop.count, true);
  return {
    enemyId: 'doom_knight',
    scaledStats,
    isBoss: true,
  };
}

export function onBossVictory(runState: RunState): { materialsAwarded: Record<string, number> } {
  // gatheringBoost is layered at banking time (MetaProgressionSystem.bankRunRewards),
  // not at drop time — keep raw boss drops here.
  const materials = rollMaterialDrops('boss', '', runState.loop.count);
  for (const [mat, amount] of Object.entries(materials)) {
    runState.economy.materials[mat] = (runState.economy.materials[mat] ?? 0) + amount;
  }
  return { materialsAwarded: materials };
}

export function getBossExitChoiceData(runState: RunState): {
  safeExitReward: RunEndResult;
  continueRisk: string;
} {
  const safeExitReward = resolveRunEnd('safe', runState.economy.materials, runState.hero.runXP ?? 0);
  const continueRisk = 'Loop grows by diminishing tiles. Death means 10% materials, zero XP.';
  return { safeExitReward, continueRisk };
}
