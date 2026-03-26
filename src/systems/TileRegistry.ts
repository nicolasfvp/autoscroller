import tilesData from '../data/tiles.json';

export type TileSlotType = 'basic' | 'terrain' | 'shop' | 'rest' | 'event' | 'treasure' | 'boss';
export type TerrainType = 'forest' | 'graveyard' | 'swamp';

export interface TileConfig {
  type: TileSlotType;
  terrain?: TerrainType;
  name: string;
  color: number;
  canPlaceManually: boolean;
  tilePointCost: number;
  icon: string;
  combatChance?: number;
}

export interface TileSlot {
  type: TileSlotType;
  terrain?: TerrainType;
  defeatedThisLoop: boolean;
}

export interface TileInventoryEntry {
  tileType: string;
  count: number;
}

const tileMap = tilesData as Record<string, TileConfig>;

export function getTileConfig(key: string): TileConfig {
  const config = tileMap[key];
  if (!config) {
    throw new Error(`Unknown tile key: ${key}`);
  }
  return config;
}

export function getAllPlaceableTiles(): TileConfig[] {
  return Object.values(tileMap).filter(t => t.canPlaceManually);
}

export function createTileSlot(key: string): TileSlot {
  const config = getTileConfig(key);
  return {
    type: config.type,
    terrain: config.terrain,
    defeatedThisLoop: false,
  };
}

export function createBasicLoop(length: number): TileSlot[] {
  return Array.from({ length }, () => createTileSlot('basic'));
}
