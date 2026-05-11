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
  // Phase 9: prefer the explicit registry key (`kind`) when present so tiles
  // like library/arena/shrine_of_pact (which all share type='event') resolve
  // to their distinct adjacency rows. Fall back to terrain (forest/graveyard/
  // swamp) and then to the umbrella type for legacy slots.
  return tile.kind ?? tile.terrain ?? tile.type;
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

  // Buffer tiles are non-interactive runway at loop start; exclude them so
  // adjacency math doesn't wrap a "boss → buffer" or "buffer → forest"
  // pair into a surprise buff. We keep the original indices so the returned
  // tileIndex still refers to the live loop array.
  const playable: { tile: TileSlot; index: number }[] = [];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].type !== 'buffer') playable.push({ tile: tiles[i], index: i });
  }
  if (playable.length < 2) return [];

  const buffs: SynergyBuff[] = [];

  for (let i = 0; i < playable.length; i++) {
    const next = playable[(i + 1) % playable.length];
    const keyA = getTileKey(playable[i].tile);
    const keyB = getTileKey(next.tile);
    const synergy = findSynergy(keyA, keyB);
    if (synergy) {
      buffs.push({
        tileIndex: playable[i].index,
        type: synergy.buff.type,
        value: synergy.buff.value,
      });
    }
  }

  return buffs;
}
