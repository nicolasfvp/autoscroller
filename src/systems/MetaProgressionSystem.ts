import { MetaState, RunHistoryEntry } from '../state/MetaState';
import buildingsData from '../data/json/buildings.json';
import passivesData from '../data/json/passives.json';

export interface UpgradeResult {
  success: boolean;
  reason?: 'insufficient_meta_loot' | 'max_level';
  updatedState?: MetaState;
  newUnlocks?: { cards?: string[]; relics?: string[]; tiles?: string[]; passives?: string[] };
}

export interface BuildingTierInfo {
  level: number;
  cost: number;
  unlocks: Record<string, string[]>;
  description?: string;
}

export function getBuildingTierData(buildingKey: string): { name: string; maxLevel: number; tiers: BuildingTierInfo[] } {
  const building = (buildingsData as any)[buildingKey];
  return building;
}

export function upgradeBuilding(buildingKey: string, state: MetaState): UpgradeResult {
  const building = (buildingsData as any)[buildingKey];
  const currentLevel = (state.buildings as any)[buildingKey].level;
  if (currentLevel >= building.maxLevel) return { success: false, reason: 'max_level' };

  const nextTier = building.tiers.find((t: any) => t.level === currentLevel + 1);
  if (state.metaLoot < nextTier.cost) return { success: false, reason: 'insufficient_meta_loot' };

  const updated = structuredClone(state);
  updated.metaLoot -= nextTier.cost;
  (updated.buildings as any)[buildingKey].level = currentLevel + 1;

  const newUnlocks: Record<string, string[]> = {};
  if (nextTier.unlocks) {
    if (nextTier.unlocks.cards) {
      updated.unlockedCards.push(...nextTier.unlocks.cards);
      newUnlocks.cards = nextTier.unlocks.cards;
    }
    if (nextTier.unlocks.relics) {
      updated.unlockedRelics.push(...nextTier.unlocks.relics);
      newUnlocks.relics = nextTier.unlocks.relics;
    }
    if (nextTier.unlocks.tiles) {
      updated.unlockedTiles.push(...nextTier.unlocks.tiles);
      newUnlocks.tiles = nextTier.unlocks.tiles;
    }
  }

  return { success: true, updatedState: updated, newUnlocks };
}

export function bankRunRewards(
  metaLootEarned: number,
  xpEarned: number,
  exitType: 'safe' | 'death',
  runSummary: { seed: string; loopsCompleted: number; bossesDefeated: number },
  state: MetaState
): MetaState {
  const lootMultiplier = exitType === 'safe' ? 1.0 : 0.25;
  const xpMultiplier = exitType === 'safe' ? 1.0 : 0.0;
  const updated = structuredClone(state);
  updated.metaLoot += Math.floor(metaLootEarned * lootMultiplier);
  updated.classXP.warrior += Math.floor(xpEarned * xpMultiplier);
  updated.totalRuns += 1;
  updated.runHistory.push({
    seed: runSummary.seed,
    loopsCompleted: runSummary.loopsCompleted,
    bossesDefeated: runSummary.bossesDefeated,
    exitType,
    metaLootEarned: Math.floor(metaLootEarned * lootMultiplier),
    xpEarned: Math.floor(xpEarned * xpMultiplier),
    timestamp: Date.now(),
  });
  return updated;
}

export function checkPassiveUnlocks(state: MetaState): { updatedState: MetaState; newPassives: string[] } {
  const warriorPassives = (passivesData as any).warrior as Array<{ id: string; xpCost: number }>;
  const updated = structuredClone(state);
  const newPassives: string[] = [];
  for (const passive of warriorPassives) {
    if (!updated.passivesUnlocked.includes(passive.id) && updated.classXP.warrior >= passive.xpCost) {
      updated.passivesUnlocked.push(passive.id);
      newPassives.push(passive.id);
    }
  }
  return { updatedState: updated, newPassives };
}
