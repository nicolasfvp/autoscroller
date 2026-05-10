import terrainEnemiesData from '../data/terrain-enemies.json';
import materialsConfig from '../data/json/materials.json';
import enemiesData from '../data/json/enemies.json';
import { getAllPlaceableTiles, type TileInventoryEntry } from './TileRegistry';
import { getAvailableCards, getAvailableRelics } from './UnlockManager';
import { rand } from './SharedRNG';

export interface UnlockState {
  unlockedCards: string[];
  unlockedRelics: string[];
}

export interface LootItem {
  type: 'gold' | 'card' | 'relic' | 'tile' | 'material';
  id?: string;
  amount?: number;
  materials?: Record<string, number>;
}

export interface LootResult {
  items: LootItem[];
}

interface TerrainPool {
  base: string[];
  addAtLoop: Record<string, string[]>;
}

const terrainEnemies = terrainEnemiesData as Record<string, TerrainPool>;

// Injectable RNG for testing
export interface RNG {
  next(): number;
}

// Default routes through SharedRNG so loot rolls inherit the run's seed
// (callers passing rng=undefined still get deterministic behavior).
const defaultRNG: RNG = { next: () => rand() };

let activeRNG: RNG = defaultRNG;

export function setRNG(rng: RNG): void {
  activeRNG = rng;
}

export function resetRNG(): void {
  activeRNG = defaultRNG;
}

// ── Material drop system ─────────────────────────────────────

export function rollMaterialDrops(
  source: 'terrain' | 'enemy' | 'boss',
  sourceKey: string,
  _loopCount: number,
  rng: RNG = activeRNG,
  gatheringBoost: number = 0
): Record<string, number> {
  const drops: Record<string, number> = {};
  const boostMult = 1 + gatheringBoost;

  switch (source) {
    case 'terrain': {
      const terrain = materialsConfig.terrainDrops[sourceKey as keyof typeof materialsConfig.terrainDrops];
      if (!terrain) return drops;
      const range = terrain.baseAmount.max - terrain.baseAmount.min + 1;
      const amount = Math.floor((terrain.baseAmount.min + Math.floor(rng.next() * range)) * boostMult);
      drops[terrain.primary] = amount;
      if ((terrain as any).secondary && terrain.secondaryChance > 0 && rng.next() < terrain.secondaryChance) {
        drops[(terrain as any).secondary] = Math.max(1, Math.floor(1 * boostMult));
      }
      break;
    }
    case 'enemy': {
      const enemy = materialsConfig.enemyBonusDrops[sourceKey as keyof typeof materialsConfig.enemyBonusDrops];
      if (!enemy) return drops;
      if (rng.next() < enemy.chance) {
        const range = enemy.amount.max - enemy.amount.min + 1;
        const amount = Math.floor((enemy.amount.min + Math.floor(rng.next() * range)) * boostMult);
        drops[enemy.material] = amount;
      }
      break;
    }
    case 'boss': {
      // Generic boss drops (essence + crystal) apply to every boss kill.
      const bossDrops = materialsConfig.bossDrops.materials;
      for (const [mat, range] of Object.entries(bossDrops)) {
        const r = (range as any).max - (range as any).min + 1;
        const amount = Math.floor(((range as any).min + Math.floor(rng.next() * r)) * boostMult);
        drops[mat] = (drops[mat] ?? 0) + amount;
      }
      // Per-boss bonus material from enemies.json materialReward (e.g. dragon
      // drops more essence than demon). Stack on top of the generic table.
      const bossDef = (enemiesData as any[]).find(e => e.id === sourceKey);
      const reward = bossDef?.materialReward;
      if (reward && reward.bonusMaterial && reward.bonusAmount) {
        if (rng.next() < (reward.chance ?? 1)) {
          const r = reward.bonusAmount.max - reward.bonusAmount.min + 1;
          const amount = Math.floor((reward.bonusAmount.min + Math.floor(rng.next() * r)) * boostMult);
          drops[reward.bonusMaterial] = (drops[reward.bonusMaterial] ?? 0) + amount;
        }
      }
      break;
    }
  }
  return drops;
}

// ── Legacy loot functions (unchanged) ────────────────────────

export function rollTreasureLoot(loopCount: number, rng: RNG = activeRNG, unlockState?: UnlockState): LootResult {
  const itemCount = 1 + Math.floor(rng.next() * 3); // 1-3 items
  const items: LootItem[] = [];

  // Weighted table: gold 40%, card 30%, tile 20%, relic 10%
  const weights = [
    { type: 'gold' as const, weight: 0.40, cumulative: 0.40 },
    { type: 'card' as const, weight: 0.30, cumulative: 0.70 },
    { type: 'tile' as const, weight: 0.20, cumulative: 0.90 },
    { type: 'relic' as const, weight: 0.10, cumulative: 1.00 },
  ];

  // Filter card/relic pools by MetaState unlock lists
  const availableCards = getAvailableCards(unlockState?.unlockedCards ?? []);
  const availableRelics = getAvailableRelics(unlockState?.unlockedRelics ?? []);

  for (let i = 0; i < itemCount; i++) {
    const roll = rng.next();
    const entry = weights.find(w => roll < w.cumulative)!;

    switch (entry.type) {
      case 'gold': {
        const amount = Math.floor((20 + rng.next() * 30) * Math.sqrt(loopCount));
        items.push({ type: 'gold', amount });
        break;
      }
      case 'card': {
        if (availableCards.length > 0) {
          const idx = Math.floor(rng.next() * availableCards.length);
          items.push({ type: 'card', id: availableCards[idx].id });
        } else {
          items.push({ type: 'card', id: 'random' });
        }
        break;
      }
      case 'relic': {
        if (availableRelics.length > 0) {
          const idx = Math.floor(rng.next() * availableRelics.length);
          items.push({ type: 'relic', id: availableRelics[idx].id });
        } else {
          items.push({ type: 'relic', id: 'random' });
        }
        break;
      }
      case 'tile': {
        const placeable = getAllPlaceableTiles();
        const idx = Math.floor(rng.next() * placeable.length);
        items.push({ type: 'tile', id: placeable[idx].name });
        break;
      }
    }
  }

  return { items };
}

export function rollTileDrops(
  terrainKey: string,
  _loopCount: number,
  rng: RNG = activeRNG
): TileInventoryEntry[] {
  // Each combat has a 15% chance to drop 1 tile of the terrain type
  if (rng.next() < 0.15) {
    return [{ tileType: terrainKey, count: 1 }];
  }
  return [];
}

export function getEnemyPoolForTerrain(terrainKey: string, loopCount: number): string[] {
  const pool = terrainEnemies[terrainKey];
  if (!pool) return [];

  const enemies = [...pool.base];

  // Sort thresholds ascending so reordered JSON entries don't change semantics.
  const entries = Object.entries(pool.addAtLoop).sort(
    ([a], [b]) => Number(a) - Number(b),
  );
  for (const [threshold, ids] of entries) {
    if (loopCount >= Number(threshold)) {
      enemies.push(...ids);
    }
  }

  return enemies;
}
