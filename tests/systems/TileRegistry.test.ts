import { describe, it, expect } from 'vitest';
import { getTileConfig, getAllPlaceableTiles, createTileSlot, createBasicLoop } from '../../src/systems/TileRegistry';

describe('TileRegistry', () => {
  it('has the expected core + subtile entries (rest/shop removed)', () => {
    const coreKeys = ['basic', 'forest', 'graveyard', 'swamp', 'desert', 'lava', 'event', 'treasure', 'boss'];
    const subtileKeys = [
      'subtile_ambush', 'subtile_magma', 'subtile_manawell', 'subtile_camp',
      'subtile_burnaltar', 'subtile_bleedtotem', 'subtile_resonance', 'subtile_warhorn',
    ];
    for (const key of [...coreKeys, ...subtileKeys]) {
      expect(() => getTileConfig(key)).not.toThrow();
    }
  });

  it('getTileConfig forest returns terrain type with correct properties', () => {
    const config = getTileConfig('forest');
    expect(config.type).toBe('terrain');
    expect(config.terrain).toBe('forest');
    expect(config.name).toBe('Forest');
    expect(config.color).toBe(0x228B22);
    expect(config.canPlaceManually).toBe(true);
    expect(config.tilePointCost).toBe(3);
    expect(config.icon).toBe('T');
  });

  it('getTileConfig boss is not manually placeable', () => {
    const config = getTileConfig('boss');
    expect(config.canPlaceManually).toBe(false);
  });

  it('getTileConfig basic has tilePointCost 0', () => {
    const config = getTileConfig('basic');
    expect(config.tilePointCost).toBe(0);
  });

  it('getAllPlaceableTiles returns 15 tile types (7 main + 8 subtiles)', () => {
    const placeable = getAllPlaceableTiles();
    expect(placeable).toHaveLength(15);
    // Should not include basic or boss (both unplaceable)
    expect(placeable.every(t => t.canPlaceManually)).toBe(true);
    const keys = placeable.map(t => t.key);
    expect(keys).not.toContain('basic');
    expect(keys).not.toContain('boss');
  });

  it('createTileSlot creates a TileSlot from key', () => {
    const slot = createTileSlot('forest');
    expect(slot.type).toBe('terrain');
    expect(slot.terrain).toBe('forest');
    expect(slot.defeatedThisLoop).toBe(false);
  });

  it('createBasicLoop creates correct length of basic tiles', () => {
    const loop = createBasicLoop(15);
    expect(loop).toHaveLength(15);
    expect(loop.every(t => t.type === 'basic')).toBe(true);
    expect(loop.every(t => t.defeatedThisLoop === false)).toBe(true);
  });

  it('throws for unknown tile key', () => {
    expect(() => getTileConfig('nonexistent')).toThrow('Unknown tile key');
  });
});
