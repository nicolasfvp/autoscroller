import { rollMaterialDrops } from './LootGenerator';
import { resolveRunEnd, type RunEndResult } from './RunEndResolver';
import type { RunState } from '../state/RunState';

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
