// Pending loot queue -- items are enqueued after combat/treasure/events
// and drained by GameScene to show floating notifications.
// Zero Phaser dependency.

export interface LootEntry {
  label: string;
  color: string;
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
