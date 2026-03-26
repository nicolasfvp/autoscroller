import difficultyConfig from '../data/difficulty.json';

export interface RunEndResult {
  exitType: 'safe' | 'death';
  metaLoot: number;
  xp: number;
}

const config = difficultyConfig as {
  deathMetaLootPercent: number;
  deathXpPercent: number;
};

export function resolveRunEnd(
  exitType: 'safe' | 'death',
  currentMetaLoot: number,
  currentXp: number
): RunEndResult {
  if (exitType === 'safe') {
    return { exitType: 'safe', metaLoot: currentMetaLoot, xp: currentXp };
  }
  return {
    exitType: 'death',
    metaLoot: Math.floor(currentMetaLoot * config.deathMetaLootPercent),
    xp: Math.floor(currentXp * config.deathXpPercent),
  };
}
