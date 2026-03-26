import synergiesData from '../data/synergies.json';
import type { TileSlot } from './TileRegistry';

export interface SynergyBuff {
  tileIndex: number;
  type: string;
  value: number;
}

interface SynergyDef {
  pair: [string, string];
  buff: { type: string; value: number };
}

const synergies = synergiesData as SynergyDef[];

function getTileKey(tile: TileSlot): string {
  return tile.terrain ?? tile.type;
}

function findSynergy(a: string, b: string): SynergyDef | undefined {
  return synergies.find(
    s =>
      (s.pair[0] === a && s.pair[1] === b) ||
      (s.pair[0] === b && s.pair[1] === a)
  );
}

export function resolveAdjacencySynergies(tiles: TileSlot[]): SynergyBuff[] {
  if (tiles.length < 2) return [];

  const buffs: SynergyBuff[] = [];

  for (let i = 0; i < tiles.length; i++) {
    const nextIndex = (i + 1) % tiles.length;
    const keyA = getTileKey(tiles[i]);
    const keyB = getTileKey(tiles[nextIndex]);
    const synergy = findSynergy(keyA, keyB);
    if (synergy) {
      buffs.push({
        tileIndex: i,
        type: synergy.buff.type,
        value: synergy.buff.value,
      });
    }
  }

  return buffs;
}
