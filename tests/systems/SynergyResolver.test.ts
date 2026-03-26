import { describe, it, expect } from 'vitest';
import { resolveAdjacencySynergies, type SynergyBuff } from '../../src/systems/SynergyResolver';
import type { TileSlot } from '../../src/systems/TileRegistry';

function slot(type: string, terrain?: string): TileSlot {
  return { type: type as any, terrain: terrain as any, defeatedThisLoop: false };
}

describe('SynergyResolver', () => {
  it('two adjacent forest tiles produce goldDropBonus', () => {
    const tiles = [slot('terrain', 'forest'), slot('terrain', 'forest'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toContainEqual(expect.objectContaining({ type: 'goldDropBonus', value: 0.15 }));
  });

  it('rest adjacent to shop produces hpRecoveryBonus', () => {
    const tiles = [slot('rest'), slot('shop'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toContainEqual(expect.objectContaining({ type: 'hpRecoveryBonus', value: 0.10 }));
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
    const tiles = [slot('basic'), slot('shop'), slot('basic')];
    const buffs = resolveAdjacencySynergies(tiles);
    expect(buffs).toHaveLength(0);
  });

  it('wrap-around is checked: last tile adjacent to first tile', () => {
    const tiles = [slot('terrain', 'forest'), slot('basic'), slot('terrain', 'forest')];
    const buffs = resolveAdjacencySynergies(tiles);
    // last (forest) -> first (forest) should produce goldDropBonus
    const wrapBuff = buffs.find(b => b.tileIndex === 2);
    expect(wrapBuff).toBeDefined();
    expect(wrapBuff!.type).toBe('goldDropBonus');
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
