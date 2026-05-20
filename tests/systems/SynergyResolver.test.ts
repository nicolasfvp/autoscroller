import { describe, it, expect } from 'vitest';
import { resolveAdjacencySynergies } from '../../src/systems/SynergyResolver';
import type { TileSlot } from '../../src/systems/TileRegistry';

function slot(type: string, terrain?: string): TileSlot {
  return { type: type as any, terrain: terrain as any, defeatedThisLoop: false };
}

/** Phase 9 helper: tile with explicit registry `kind` (library/arena/shrine_of_pact). */
function kindSlot(kind: string): TileSlot {
  return { type: 'event' as any, kind, defeatedThisLoop: false };
}

describe('SynergyResolver', () => {
  it('two adjacent forest tiles produce goldDropBonus', () => {
    const tiles = [slot('terrain', 'forest'), slot('terrain', 'forest'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toContainEqual(expect.objectContaining({ type: 'goldDropBonus', value: 0.15 }));
  });

  it('graveyard adjacent to swamp produces damageBonus', () => {
    const tiles = [slot('terrain', 'graveyard'), slot('terrain', 'swamp'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toContainEqual(expect.objectContaining({ type: 'damageBonus', value: 0.20 }));
  });

  it('forest adjacent to swamp produces tileDropBonus', () => {
    const tiles = [slot('terrain', 'forest'), slot('terrain', 'swamp'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toContainEqual(expect.objectContaining({ type: 'tileDropBonus', value: 0.15 }));
  });

  it('two adjacent graveyard tiles produce xpBonus', () => {
    const tiles = [slot('terrain', 'graveyard'), slot('terrain', 'graveyard'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toContainEqual(expect.objectContaining({ type: 'xpBonus', value: 0.20 }));
  });

  it('rest adjacent to event produces eventBonus', () => {
    const tiles = [slot('rest'), slot('event'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toContainEqual(expect.objectContaining({ type: 'eventBonus', value: 0.15 }));
  });

  it('non-synergy pairs produce no buffs', () => {
    const tiles = [slot('basic'), slot('rest'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toHaveLength(0);
  });

  it('adjacency does NOT wrap around: last tile is not adjacent to first tile', () => {
    // Phase 9 / WR-05 fix: loop is linear (boss is a terminator), so the last
    // playable tile must not pair with the first one. The middle tile here
    // breaks any direct adjacency, so no buff should be emitted.
    const tiles = [slot('terrain', 'forest'), slot('basic'), slot('terrain', 'forest')];
    const buffs = resolveAdjacencySynergies(tiles);
    const wrapBuff = buffs.find(b => b.tileIndex === 2);
    expect(wrapBuff).toBeUndefined();
  });

  it('order does not matter: swamp+forest same as forest+swamp', () => {
    const tilesA = [slot('terrain', 'forest'), slot('terrain', 'swamp'), slot('basic')];
    const tilesB = [slot('terrain', 'swamp'), slot('terrain', 'forest'), slot('basic')];
    const buffsA = resolveAdjacencySynergies(tilesA);
    const buffsB = resolveAdjacencySynergies(tilesB);
    expect(buffsA[0].type).toBe('tileDropBonus');
    expect(buffsB[0].type).toBe('tileDropBonus');
  });
});

describe('Phase 9 — v2 tile adjacency (design/04 §7)', () => {
  it('library + graveyard yields xpBonus 0.25 (Cursed Knowledge)', () => {
    const tiles = [kindSlot('library'), slot('terrain', 'graveyard'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toContainEqual(
      expect.objectContaining({ type: 'xpBonus', value: 0.25 }),
    );
  });

  it('arena + rest yields hpRecoveryBonus 0.20 (Medic Tent)', () => {
    const tiles = [kindSlot('arena'), slot('rest'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toContainEqual(
      expect.objectContaining({ type: 'hpRecoveryBonus', value: 0.20 }),
    );
  });

  it('arena + forest yields damageBonus 0.15 (Ambush Crowd)', () => {
    const tiles = [kindSlot('arena'), slot('terrain', 'forest'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toContainEqual(
      expect.objectContaining({ type: 'damageBonus', value: 0.15 }),
    );
  });

  it('shrine_of_pact + treasure yields goldDropBonus 0.30 (Richer Pact)', () => {
    const tiles = [kindSlot('shrine_of_pact'), slot('treasure'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toContainEqual(
      expect.objectContaining({ type: 'goldDropBonus', value: 0.30 }),
    );
  });

  it('shrine_of_pact + graveyard yields tileDropBonus 0.20 (Necropact)', () => {
    const tiles = [kindSlot('shrine_of_pact'), slot('terrain', 'graveyard'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toContainEqual(
      expect.objectContaining({ type: 'tileDropBonus', value: 0.20 }),
    );
  });
});
