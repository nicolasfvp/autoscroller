import terrainEnemiesData from '../data/terrain-enemies.json';
import difficultyConfig from '../data/difficulty.json';
import { getAllPlaceableTiles, type TileInventoryEntry } from './TileRegistry';

export interface LootItem {
  type: 'gold' | 'card' | 'relic' | 'tile';
  id?: string;
  amount?: number;
}

export interface LootResult {
  items: LootItem[];
}

interface TerrainPool {
  base: string[];
  addAtLoop: Record<string, string[]>;
}

const terrainEnemies = terrainEnemiesData as Record<string, TerrainPool>;

const config = difficultyConfig as {
  metaLootPerCombat: { min: number; max: number };
  metaLootPerLoop: number;
  metaLootPerBoss: number;
};

// Injectable RNG for testing
export interface RNG {
  next(): number;
}

const defaultRNG: RNG = { next: () => Math.random() };

let activeRNG: RNG = defaultRNG;

export function setRNG(rng: RNG): void {
  activeRNG = rng;
}

export function resetRNG(): void {
  activeRNG = defaultRNG;
}

export function rollTreasureLoot(loopCount: number, rng: RNG = activeRNG): LootResult {
  const itemCount = 1 + Math.floor(rng.next() * 3); // 1-3 items
  const items: LootItem[] = [];

  // Weighted table: gold 40%, card 30%, tile 20%, relic 10%
  const weights = [
    { type: 'gold' as const, weight: 0.40, cumulative: 0.40 },
    { type: 'card' as const, weight: 0.30, cumulative: 0.70 },
    { type: 'tile' as const, weight: 0.20, cumulative: 0.90 },
    { type: 'relic' as const, weight: 0.10, cumulative: 1.00 },
  ];

  for (let i = 0; i < itemCount; i++) {
    const roll = rng.next();
    const entry = weights.find(w => roll < w.cumulative)!;

    switch (entry.type) {
      case 'gold': {
        const amount = Math.floor((20 + rng.next() * 30) * Math.sqrt(loopCount));
        items.push({ type: 'gold', amount });
        break;
      }
      case 'card':
        items.push({ type: 'card', id: 'random' });
        break;
      case 'relic':
        items.push({ type: 'relic', id: 'random' });
        break;
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

export function rollMetaLoot(
  source: 'combat' | 'loop' | 'boss',
  loopCount: number,
  rng: RNG = activeRNG
): number {
  switch (source) {
    case 'combat': {
      const range = config.metaLootPerCombat.max - config.metaLootPerCombat.min + 1;
      return config.metaLootPerCombat.min + Math.floor(rng.next() * range);
    }
    case 'loop':
      return config.metaLootPerLoop + Math.floor(loopCount * 0.5);
    case 'boss':
      return config.metaLootPerBoss;
  }
}

export function getEnemyPoolForTerrain(terrainKey: string, loopCount: number): string[] {
  const pool = terrainEnemies[terrainKey];
  if (!pool) return [];

  const enemies = [...pool.base];

  for (const [threshold, ids] of Object.entries(pool.addAtLoop)) {
    if (loopCount >= Number(threshold)) {
      enemies.push(...ids);
    }
  }

  return enemies;
}
