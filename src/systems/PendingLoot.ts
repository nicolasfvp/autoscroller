// Pending loot queue -- items are enqueued after combat/treasure/events
// and drained by GameScene to show floating notifications.
// Zero Phaser dependency.

export interface LootEntry {
  label: string;
  color: string;
}

let pending: LootEntry[] = [];

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
