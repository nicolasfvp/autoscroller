import tilesData from '../data/tiles.json';

export type TileSlotType = 'basic' | 'buffer' | 'terrain' | 'rest' | 'event' | 'treasure' | 'boss';
export type TerrainType = 'forest' | 'graveyard' | 'swamp';

export interface TileConfig {
  type: TileSlotType;
  terrain?: TerrainType;
  name: string;
  color: number;
  /** Optional hex string equivalent of color (Phase 9 design v2 LOCKED palette). */
  hexColor?: string;
  canPlaceManually: boolean;
  tilePointCost: number;
  icon: string;
  combatChance?: number;
}

export interface TileSlot {
  type: TileSlotType;
  terrain?: TerrainType;
  /**
   * Phase 9: tile registry key (e.g. 'library', 'arena', 'shrine_of_pact').
   * Carried separately from `type` so adjacency resolution can match the
   * specific registry key for tiles that share an existing `type` umbrella
   * (e.g. library/arena/shrine_of_pact all use type='event' but need
   * distinct adjacency keys per design/04 §7).
   */
  kind?: string;
  defeatedThisLoop: boolean;
  /** Pre-assigned enemy ID for combat tiles (visible on the world map) */
  enemyId?: string;
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

export interface TileConfigWithKey extends TileConfig {
  key: string;
}

export function getAllPlaceableTiles(): TileConfigWithKey[] {
  return Object.entries(tileMap)
    .filter(([, t]) => t.canPlaceManually)
    .map(([key, t]) => ({ ...t, key }));
}

export function createTileSlot(key: string): TileSlot {
  const config = getTileConfig(key);
  return {
    type: config.type,
    terrain: config.terrain,
    kind: key,
    defeatedThisLoop: false,
  };
}

export function createBasicLoop(length: number): TileSlot[] {
  return Array.from({ length }, () => createTileSlot('basic'));
}

/** Creates N non-interactive buffer tiles to prepend to a loop */
export function createBufferTiles(count: number): TileSlot[] {
  return Array.from({ length: count }, () => ({
    type: 'buffer' as TileSlotType,
    defeatedThisLoop: true, // Always 'defeated' so runner skips interaction
  }));
}
