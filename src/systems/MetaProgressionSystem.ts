import { MetaState } from '../state/MetaState';
import buildingsData from '../data/json/buildings.json';
import passivesData from '../data/json/passives.json';
import type { SynergyBuff } from './SynergyResolver';

// B.1: tile-adjacency xpBonus uplifts XP banked at run end.
let activeBuffs: SynergyBuff[] = [];

export function setActiveBuffs(buffs: SynergyBuff[]): void {
  activeBuffs = buffs ?? [];
}

function getXpBonus(): number {
  let bonus = 0;
  for (const buff of activeBuffs) {
    if (buff.type === 'xpBonus') bonus += buff.value;
  }
  return bonus;
}

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
  // E.8.h: Drop the level-0 short-circuit and let the JSON-tier walk decide.
  // Pre-fix this branch hardcoded {0, 0.10} which diverged from any future
  // change to buildings.json — the loop below produces the same defaults
  // (gatheringBoost=0, deathRetention=0.10) when no tiers apply.
  const building = (buildingsData as any).storehouse;
  let gatheringBoost = 0;
  let deathRetention = 0.10; // baseline retention until level 2 unlocks one
  if (building && Array.isArray(building.tiers)) {
    for (const tier of building.tiers) {
      if (tier.level <= storehouseLevel) {
        if (tier.effect?.gatheringBoost !== undefined) gatheringBoost = tier.effect.gatheringBoost;
        if (tier.effect?.deathRetention !== undefined) deathRetention = tier.effect.deathRetention;
      }
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
  className: string,
  gatheringBoost: number = 0,
): MetaState {
  const storehouseEffects = getStorehouseEffects(state.buildings.storehouse.level);
  const materialMultiplier = exitType === 'safe' ? 1.0 : storehouseEffects.deathRetention;
  const xpMultiplier = exitType === 'safe' ? 1.0 : 0.0;

  const updated = structuredClone(state);
  // C.9.a: gatheringBoost is now layered ONCE at banking time (drops in-run
  // remain raw). Caller passes run.economy.gatheringBoost (cached at run
  // start from getStorehouseEffects). Apply alongside the exit retention
  // multiplier and floor the final per-material total.
  const boostMult = 1 + (gatheringBoost ?? 0);
  const bankedMaterials: Record<string, number> = {};
  for (const [mat, amount] of Object.entries(materialsEarned)) {
    const banked = Math.floor(amount * materialMultiplier * boostMult);
    if (banked > 0) {
      updated.materials[mat] = (updated.materials[mat] ?? 0) + banked;
    }
    bankedMaterials[mat] = banked;
  }

  // B.1: xpBonus from tile adjacency uplifts banked XP on safe exits.
  const xpBuffMultiplier = 1 + getXpBonus();
  const xpGained = Math.floor(xpEarned * xpMultiplier * xpBuffMultiplier);
  // B.3: route XP to the correct class bucket. Guard against unknown classes
  // — fall back to warrior with a warning rather than silently dropping XP.
  let resolvedClass = className;
  if (resolvedClass !== 'warrior' && resolvedClass !== 'mage') {
    console.warn(`[bankRunRewards] unknown className "${className}", falling back to "warrior"`);
    resolvedClass = 'warrior';
  }
  const classXP = updated.classXP as unknown as Record<string, number>;
  classXP[resolvedClass] = (classXP[resolvedClass] ?? 0) + xpGained;

  updated.totalRuns += 1;
  updated.runHistory.push({
    seed: runSummary.seed,
    loopsCompleted: runSummary.loopsCompleted,
    bossesDefeated: runSummary.bossesDefeated,
    exitType,
    materialsEarned: bankedMaterials,
    xpEarned: xpGained,
    timestamp: Date.now(),
    className: resolvedClass,
  });
  return updated;
}

// ── Passive unlocks ──────────────────────────────────────────

export function checkPassiveUnlocks(state: MetaState): { updatedState: MetaState; newPassives: string[] } {
  const updated = structuredClone(state);
  const newPassives: string[] = [];
  const data = passivesData as Record<string, Array<{ id: string; xpCost: number }>>;
  const classXP = updated.classXP as unknown as Record<string, number>;
  for (const className of Object.keys(data)) {
    const list = data[className];
    const xp = classXP[className] ?? 0;
    for (const passive of list) {
      if (!updated.passivesUnlocked.includes(passive.id) && xp >= passive.xpCost) {
        updated.passivesUnlocked.push(passive.id);
        newPassives.push(passive.id);
      }
    }
  }
  return { updatedState: updated, newPassives };
}
