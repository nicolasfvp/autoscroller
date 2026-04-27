import { MetaState } from '../state/MetaState';
import buildingsData from '../data/json/buildings.json';
import passivesData from '../data/json/passives.json';

export interface UpgradeResult {
  success: boolean;
  reason?: 'insufficient_materials' | 'max_level';
  updatedState?: MetaState;
  newUnlocks?: { cards?: string[]; relics?: string[]; tiles?: string[]; passives?: string[] };
}

export interface BuildingTierInfo {
  level: number;
  cost: Record<string, number>;
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
  // Check multi-material cost affordability
  const cost = nextTier.cost as Record<string, number>;
  for (const [mat, required] of Object.entries(cost)) {
    if ((state.materials[mat] ?? 0) < required) {
      return { success: false, reason: 'insufficient_materials' };
    }
  }

  const updated = structuredClone(state);
  // Deduct material costs
  for (const [mat, required] of Object.entries(cost)) {
    updated.materials[mat] = (updated.materials[mat] ?? 0) - required;
  }
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

// ── Storehouse effects ───────────────────────────────────────

export function getStorehouseEffects(storehouseLevel: number): { gatheringBoost: number; deathRetention: number } {
  if (storehouseLevel === 0) return { gatheringBoost: 0, deathRetention: 0.10 };
  const building = (buildingsData as any).storehouse;
  let gatheringBoost = 0;
  let deathRetention = 0.10; // base death retention
  for (const tier of building.tiers) {
    if (tier.level <= storehouseLevel) {
      if (tier.effect?.gatheringBoost !== undefined) gatheringBoost = tier.effect.gatheringBoost;
      if (tier.effect?.deathRetention !== undefined) deathRetention = tier.effect.deathRetention;
    }
  }
  return { gatheringBoost, deathRetention };
}

// ── Run reward banking ───────────────────────────────────────

export function bankRunRewards(
  materialsEarned: Record<string, number>,
  xpEarned: number,
  exitType: 'safe' | 'death',
  runSummary: { seed: string; loopsCompleted: number; bossesDefeated: number },
  state: MetaState,
  className: string = 'warrior',
): MetaState {
  const storehouseEffects = getStorehouseEffects(state.buildings.storehouse.level);
  const materialMultiplier = exitType === 'safe' ? 1.0 : storehouseEffects.deathRetention;
  const xpMultiplier = exitType === 'safe' ? 1.0 : 0.0;

  const updated = structuredClone(state);
  const bankedMaterials: Record<string, number> = {};
  for (const [mat, amount] of Object.entries(materialsEarned)) {
    const banked = Math.floor(amount * materialMultiplier);
    if (banked > 0) {
      updated.materials[mat] = (updated.materials[mat] ?? 0) + banked;
    }
    bankedMaterials[mat] = banked;
  }

  const xpGained = Math.floor(xpEarned * xpMultiplier);
  if (className === 'mage') {
    updated.classXP.mage = (updated.classXP.mage ?? 0) + xpGained;
  } else {
    updated.classXP.warrior += xpGained;
  }

  updated.totalRuns += 1;
  updated.runHistory.push({
    seed: runSummary.seed,
    loopsCompleted: runSummary.loopsCompleted,
    bossesDefeated: runSummary.bossesDefeated,
    exitType,
    materialsEarned: bankedMaterials,
    xpEarned: xpGained,
    timestamp: Date.now(),
  });
  return updated;
}

// ── Passive unlocks ──────────────────────────────────────────

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
