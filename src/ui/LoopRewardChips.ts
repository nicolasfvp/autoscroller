// Loop reward chips -- aggregates the current loop's accumulated gains
// (gold, shards/elements, materials, CP/XP, kills) into a compact list the
// scroll-screen HUD renders as persistent icon|value chips under the hero
// panel. Mirrors the combat status-chip strip, but the entries don't expire
// until the loop ends (the PendingLoot queue is drained at loop completion).
//
// Zero Phaser dependency so it can be unit-tested without booting the engine.

import { peekPendingLoot, peekPendingKills } from '../systems/PendingLoot';

/** One aggregated reward chip: a resource and its loop-total amount. */
export interface RewardChip {
  /** Stable key used to resolve the icon (e.g. 'gold', 'fire', 'wood'). */
  key: string;
  /** Display label for the amount (e.g. '320'). */
  value: string;
  /** Hex colour for the value text. */
  color: string;
  /** Hover tooltip text. */
  tooltip: string;
  /** Sort weight — lower groups render first. */
  order: number;
}

// "+50 Gold", "+2 Fire shard", "+1 wood", "+3 Fire!", "+1 forest tile"
const LOOT_RE = /^\+(\d+)\s+(.+)$/;

// Element display names → element id (for shard / converted-element entries).
const ELEMENT_NAME_TO_ID: Record<string, string> = {
  attack: 'attack', defense: 'defense', agility: 'agility', counter: 'counter',
  fire: 'fire', water: 'water', air: 'air', earth: 'earth',
};

const MATERIAL_KEYS = new Set([
  'wood', 'stone', 'iron', 'crystal', 'bone', 'herbs', 'essence',
]);

// Render order buckets: gold first, then CP/XP, shards, elements, materials,
// tiles, then kills last.
const ORDER = {
  gold: 0, cp: 1, xp: 1, element: 2, shard: 3, material: 4, tile: 5, kill: 6,
} as const;

interface Bucket { key: string; value: number; color: string; order: number; label: string; }

/**
 * Parse one loot label into a normalized bucket, or null if unrecognized.
 * The label/color come straight from CombatLoot/TreasureLoot/InlineEvents.
 */
function classify(label: string, color: string): Bucket | null {
  const m = LOOT_RE.exec(label);
  if (!m) return null;
  const amount = Number.parseInt(m[1], 10);
  if (!(amount > 0)) return null;
  let rest = m[2].trim();

  // Converted element ("Fire!") — a full element unit, distinct from shards.
  if (rest.endsWith('!')) {
    const name = rest.slice(0, -1).trim().toLowerCase();
    const id = ELEMENT_NAME_TO_ID[name];
    if (id) return { key: id, value: amount, color, order: ORDER.element, label: `${name} element` };
  }

  const lower = rest.toLowerCase();

  if (lower === 'gold') return { key: 'gold', value: amount, color, order: ORDER.gold, label: 'Gold' };
  if (lower === 'xp')   return { key: 'xp',   value: amount, color, order: ORDER.xp,  label: 'XP' };
  if (lower === 'cp')   return { key: 'cp',   value: amount, color, order: ORDER.cp,  label: 'CP' };

  // "Fire shard" → element shard
  if (lower.endsWith(' shard')) {
    const name = lower.replace(' shard', '').trim();
    const id = ELEMENT_NAME_TO_ID[name];
    if (id) return { key: `${id}_shard`, value: amount, color, order: ORDER.shard, label: `${name} shard` };
  }

  // "forest tile" → tile drop
  if (lower.endsWith(' tile')) {
    const t = lower.replace(' tile', '').trim();
    return { key: `tile_${t}`, value: amount, color, order: ORDER.tile, label: `${t} tile` };
  }

  if (MATERIAL_KEYS.has(lower)) {
    return { key: lower, value: amount, color, order: ORDER.material, label: lower };
  }

  // Unknown — bucket by its label so it still shows.
  return { key: lower, value: amount, color, order: ORDER.material, label: rest };
}

/**
 * Build the aggregated reward-chip list for the current loop. Reads (without
 * draining) the pending loot + kill queues, so the result reflects everything
 * gained since the last loop boundary.
 */
export function buildLoopRewardChips(): RewardChip[] {
  const buckets = new Map<string, Bucket>();
  const order: string[] = [];

  const add = (b: Bucket | null) => {
    if (!b) return;
    const existing = buckets.get(b.key);
    if (existing) { existing.value += b.value; }
    else { buckets.set(b.key, b); order.push(b.key); }
  };

  for (const entry of peekPendingLoot()) {
    add(classify(entry.label, entry.color));
  }

  // Kills — sum every enemy tally into one "kills" chip.
  const kills = peekPendingKills();
  let killTotal = 0;
  for (const k of Object.keys(kills)) killTotal += kills[k] ?? 0;
  if (killTotal > 0) {
    add({ key: 'kills', value: killTotal, color: '#ff6655', order: ORDER.kill, label: 'enemies defeated' });
  }

  return order
    .map((k) => buckets.get(k)!)
    .sort((a, b) => a.order - b.order)
    .map((b) => ({
      key: b.key,
      value: String(b.value),
      color: b.color,
      tooltip: `+${b.value} ${b.label} this loop`,
      order: b.order,
    }));
}
