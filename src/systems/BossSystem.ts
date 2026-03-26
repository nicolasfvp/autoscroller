import { scaleEnemyForLoop, type ScaledEnemyStats } from './DifficultyScaler';
import { rollMetaLoot } from './LootGenerator';
import { resolveRunEnd, type RunEndResult } from './RunEndResolver';

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

interface RunState {
  hero: { hp: number; maxHp: number; xp: number };
  loop: { count: number };
  economy: { gold: number; tilePoints: number; metaLoot: number };
}

export function triggerBossCombat(runState: RunState): BossEncounterData {
  const scaledStats = scaleEnemyForLoop(BOSS_BASE_STATS, runState.loop.count, true);
  return {
    enemyId: 'boss_demon',
    scaledStats,
    isBoss: true,
  };
}

export function onBossVictory(runState: RunState): { metaLootAwarded: number } {
  const metaLoot = rollMetaLoot('boss', runState.loop.count);
  runState.economy.metaLoot += metaLoot;
  return { metaLootAwarded: metaLoot };
}

export function getBossExitChoiceData(runState: RunState): {
  safeExitReward: RunEndResult;
  continueRisk: string;
} {
  const safeExitReward = resolveRunEnd('safe', runState.economy.metaLoot, runState.hero.xp);
  const continueRisk = 'Loop grows by 3 tiles. Death means 25% meta-loot, zero XP.';
  return { safeExitReward, continueRisk };
}
