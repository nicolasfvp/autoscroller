// Pending loot queue -- items are enqueued after combat/treasure/events
// and drained by GameScene to show floating notifications.
// Zero Phaser dependency.

/** Where a loot entry originated. Drives the separate "EVENTS / TREASURE"
 *  block on the loop summary. Absent/`combat` = ordinary battle loot. */
export type LootSource = 'combat' | 'event' | 'treasure';

export interface LootEntry {
  label: string;
  color: string;
  /** Origin of the gain. Omitted means combat (the common case). */
  source?: LootSource;
}

let pending: LootEntry[] = [];
let pendingKills: Record<string, number> = {};

export function addPendingLoot(items: LootEntry[]): void {
  pending.push(...items);
}

export function drainPendingLoot(): LootEntry[] {
  const items = [...pending];
  pending = [];
  return items;
}

export function hasPendingLoot(): boolean {
  return pending.length > 0;
}

/**
 * Peek at the pending loot WITHOUT draining it. Used by the scroll-screen HUD
 * to render persistent reward chips for the current loop (the queue is drained
 * only at loop end, so its contents represent this loop's accumulated gains).
 */
export function peekPendingLoot(): readonly LootEntry[] {
  return pending;
}

/** Peek at this loop's kill tally without draining it. */
export function peekPendingKills(): Readonly<Record<string, number>> {
  return pendingKills;
}

export function addPendingKill(enemyName: string): void {
  pendingKills[enemyName] = (pendingKills[enemyName] ?? 0) + 1;
}

export function drainPendingKills(): Record<string, number> {
  const kills = { ...pendingKills };
  pendingKills = {};
  return kills;
}

/**
 * Drop everything queued. Called from clearRun() so a fresh run doesn't
 * inherit floating loot notifications from the previous one.
 */
export function clearPendingLoot(): void {
  pending = [];
  pendingKills = {};
}
