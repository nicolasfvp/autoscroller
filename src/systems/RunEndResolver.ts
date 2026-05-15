import difficultyConfig from '../data/difficulty.json';
import { getStorehouseEffects } from './MetaProgressionSystem';

export interface RunEndResult {
  exitType: 'safe' | 'death';
  materials: Record<string, number>;
  xp: number;
}

const config = difficultyConfig as {
  deathXpPercent: number;
};

export function resolveRunEnd(
  exitType: 'safe' | 'death',
  currentMaterials: Record<string, number>,
  currentXp: number,
  storehouseLevel: number = 0
): RunEndResult {
  if (exitType === 'safe') {
    return { exitType: 'safe', materials: { ...currentMaterials }, xp: currentXp };
  }
  const { deathRetention } = getStorehouseEffects(storehouseLevel);
  const retainedMaterials: Record<string, number> = {};
  for (const [mat, amount] of Object.entries(currentMaterials)) {
    let retained = Math.floor(amount * deathRetention);
    if (retained === 0 && amount > 0 && deathRetention > 0) retained = 1;
    retainedMaterials[mat] = retained;
  }
  return {
    exitType: 'death',
    materials: retainedMaterials,
    xp: Math.floor(currentXp * config.deathXpPercent),
  };
}
