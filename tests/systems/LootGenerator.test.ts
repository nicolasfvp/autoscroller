import { describe, it, expect, afterEach } from 'vitest';
import {
  rollMaterialDrops,
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

  describe('rollMaterialDrops', () => {
    it('terrain forest returns wood between 2-5', () => {
      // rng.next()=0 -> min + floor(0 * range) = 2; boostMult=1
      const rng = createDeterministicRNG([0, 0.99]); // first for amount, second for secondary chance
      const drops = rollMaterialDrops('terrain', 'forest', 1, rng);
      expect(drops.wood).toBeGreaterThanOrEqual(2);
      expect(drops.wood).toBeLessThanOrEqual(5);
    });

    it('terrain forest can drop secondary herbs on low roll', () => {
      // amount roll=0.5 -> 2+floor(0.5*4)=4; secondary roll=0.1 < 0.25 -> herbs
      const rng = createDeterministicRNG([0.5, 0.1]);
      const drops = rollMaterialDrops('terrain', 'forest', 1, rng);
      expect(drops.wood).toBe(4);
      expect(drops.herbs).toBe(1);
    });

    it('terrain forest no secondary herbs on high roll', () => {
      const rng = createDeterministicRNG([0.5, 0.5]); // 0.5 >= 0.25
      const drops = rollMaterialDrops('terrain', 'forest', 1, rng);
      expect(drops.wood).toBe(4);
      expect(drops.herbs).toBeUndefined();
    });

    it('enemy slime returns herbs based on chance', () => {
      // roll=0.1 < 0.3 (chance) -> drops; amount roll=0 -> min=1
      const rng = createDeterministicRNG([0.1, 0]);
      const drops = rollMaterialDrops('enemy', 'slime', 1, rng);
      expect(drops.herbs).toBeGreaterThanOrEqual(1);
    });

    it('enemy slime returns empty when roll fails', () => {
      // roll=0.5 >= 0.3 -> no drop
      const rng = createDeterministicRNG([0.5]);
      const drops = rollMaterialDrops('enemy', 'slime', 1, rng);
      expect(Object.keys(drops)).toHaveLength(0);
    });

    it('boss returns essence and crystal', () => {
      // essence: 3+floor(0*4)=3; crystal: 2+floor(0*3)=2
      const rng = createDeterministicRNG([0, 0]);
      const drops = rollMaterialDrops('boss', '', 1, rng);
      expect(drops.essence).toBeGreaterThanOrEqual(3);
      expect(drops.crystal).toBeGreaterThanOrEqual(2);
    });

    it('gatheringBoost increases material amounts', () => {
      // With 20% boost and roll=0.99: wood = 2+floor(0.99*4)=5, then floor(5*1.2)=6
      const rng = createDeterministicRNG([0.99, 0.99]); // high roll, no secondary
      const drops = rollMaterialDrops('terrain', 'forest', 1, rng, 0.20);
      expect(drops.wood).toBe(6);
    });

    it('unknown terrain returns empty', () => {
      const rng = createDeterministicRNG([0.5]);
      const drops = rollMaterialDrops('terrain', 'nonexistent', 1, rng);
      expect(Object.keys(drops)).toHaveLength(0);
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
      const rng = createDeterministicRNG([0, 0.1, 0.1]);
      const result = rollTreasureLoot(3, rng);
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items.length).toBeLessThanOrEqual(3);
    });
  });

  describe('rollTileDrops', () => {
    it('returns tile drop with 15% chance', () => {
      const rng = createDeterministicRNG([0.1]);
      const drops = rollTileDrops('forest', 1, rng);
      expect(drops).toEqual([{ tileType: 'forest', count: 1 }]);
    });

    it('returns empty when roll fails', () => {
      const rng = createDeterministicRNG([0.5]);
      const drops = rollTileDrops('forest', 1, rng);
      expect(drops).toEqual([]);
    });
  });
});
