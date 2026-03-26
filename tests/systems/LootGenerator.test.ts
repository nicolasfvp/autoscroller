import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  rollMetaLoot,
  getEnemyPoolForTerrain,
  rollTreasureLoot,
  rollTileDrops,
  setRNG,
  resetRNG,
  type RNG,
} from '../../src/systems/LootGenerator';

function createDeterministicRNG(values: number[]): RNG {
  let i = 0;
  return {
    next: () => {
      const val = values[i % values.length];
      i++;
      return val;
    },
  };
}

describe('LootGenerator', () => {
  afterEach(() => {
    resetRNG();
  });

  describe('rollMetaLoot', () => {
    it('combat returns 1-2 meta-loot', () => {
      // rng.next() = 0 -> min + floor(0 * 2) = 1
      const rng = createDeterministicRNG([0]);
      const result = rollMetaLoot('combat', 1, rng);
      expect(result).toBe(1);
    });

    it('combat returns max 2 meta-loot', () => {
      // rng.next() = 0.99 -> 1 + floor(0.99 * 2) = 1 + 1 = 2
      const rng = createDeterministicRNG([0.99]);
      const result = rollMetaLoot('combat', 1, rng);
      expect(result).toBe(2);
    });

    it('loop returns 5 + floor(loopCount * 0.5)', () => {
      expect(rollMetaLoot('loop', 1)).toBe(5); // 5 + floor(0.5) = 5
      expect(rollMetaLoot('loop', 4)).toBe(7); // 5 + floor(2) = 7
      expect(rollMetaLoot('loop', 10)).toBe(10); // 5 + floor(5) = 10
    });

    it('boss returns 10 meta-loot', () => {
      expect(rollMetaLoot('boss', 1)).toBe(10);
      expect(rollMetaLoot('boss', 10)).toBe(10);
    });
  });

  describe('getEnemyPoolForTerrain', () => {
    it('forest base pool has slime and goblin', () => {
      const pool = getEnemyPoolForTerrain('forest', 1);
      expect(pool).toEqual(['slime', 'goblin']);
    });

    it('forest pool expands at loop 5 with orc', () => {
      const pool = getEnemyPoolForTerrain('forest', 5);
      expect(pool).toContain('orc');
      expect(pool).toHaveLength(3);
    });

    it('forest pool expands at loop 10 with elite_knight', () => {
      const pool = getEnemyPoolForTerrain('forest', 10);
      expect(pool).toContain('elite_knight');
      expect(pool).toHaveLength(4);
    });

    it('basic terrain has only slime', () => {
      const pool = getEnemyPoolForTerrain('basic', 1);
      expect(pool).toEqual(['slime']);
    });

    it('unknown terrain returns empty array', () => {
      const pool = getEnemyPoolForTerrain('volcano', 1);
      expect(pool).toEqual([]);
    });

    it('graveyard base pool has mage and elite_knight', () => {
      const pool = getEnemyPoolForTerrain('graveyard', 1);
      expect(pool).toEqual(['mage', 'elite_knight']);
    });
  });

  describe('rollTreasureLoot', () => {
    it('returns 1-3 items', () => {
      // itemCount = 1 + floor(0 * 3) = 1; roll = 0.1 < 0.40 -> gold; gold amount = floor((20 + 0.1*30) * sqrt(3))
      const rng = createDeterministicRNG([0, 0.1, 0.1]);
      const result = rollTreasureLoot(3, rng);
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items.length).toBeLessThanOrEqual(3);
    });
  });

  describe('rollTileDrops', () => {
    it('returns tile drop with 15% chance', () => {
      const rng = createDeterministicRNG([0.1]); // < 0.15 -> drop
      const drops = rollTileDrops('forest', 1, rng);
      expect(drops).toEqual([{ tileType: 'forest', count: 1 }]);
    });

    it('returns empty when roll fails', () => {
      const rng = createDeterministicRNG([0.5]); // >= 0.15 -> no drop
      const drops = rollTileDrops('forest', 1, rng);
      expect(drops).toEqual([]);
    });
  });
});
