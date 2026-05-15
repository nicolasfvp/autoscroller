// Combat loot generation -- produces gold + card + material drops after victory.
// Uses enemy drop tables, EnemyDefinition goldReward, and material config.
// Zero Phaser dependency.

import type { RunState } from '../state/RunState';
import { addPendingLoot } from './PendingLoot';
import { rollMaterialDrops, rollTileDrops } from './LootGenerator';
import type { SynergyBuff } from './SynergyResolver';
import { rollShardDrops, addShardsAndConvert, type ShardInventory, type ElementInventory } from './ShardSystem';
import { ELEMENTS, type ElementId } from './ElementSystem';

// B.1: tile-adjacency loot buffs. goldDropBonus / tileDropBonus uplift the
// rolled gold and tile drop counts at combat resolution time.
let activeBuffs: SynergyBuff[] = [];

export function setActiveBuffs(buffs: SynergyBuff[]): void {
  activeBuffs = buffs ?? [];
}

function sumBuff(type: string): number {
  let total = 0;
  for (const buff of activeBuffs) {
    if (buff.type === type) total += buff.value;
  }
  return total;
}

// Card drops removed in Phase 10 — enemies award shards only.

/**
 * Generate and apply combat loot after a victory.
 * - Awards gold directly to RunState
 * - Drops materials from terrain and enemy pools
 * - Drops a random card into droppedCards (not active deck)
 * - Queues floating notifications via PendingLoot
 */
export function generateAndApplyCombatLoot(
  run: RunState,
  _enemyName: string,
  enemyId: string,
  enemyType: string,
  terrain: string,
  goldAmount: number,
  xpAmount: number,
): void {
  const entries: Array<{ label: string; color: string }> = [];

  // Gold (apply tile-adjacency goldDropBonus on top of base reward)
  const goldMult = 1 + sumBuff('goldDropBonus');
  const finalGold = Math.floor(goldAmount * goldMult);
  if (finalGold > 0) {
    run.economy.gold += finalGold;
    run.stats.goldEarned += finalGold;
    entries.push({ label: `+${finalGold} Gold`, color: '#ffd700' });
  }

  // XP
  if (xpAmount > 0) {
    entries.push({ label: `+${xpAmount} XP`, color: '#00ccff' });
  }

  // Storehouse gathering boost is applied once at banking time in
  // MetaProgressionSystem.bankRunRewards — drops here remain raw.

  // Material drops from terrain
  const terrainMats = rollMaterialDrops('terrain', terrain, run.loop.count);
  for (const [mat, amount] of Object.entries(terrainMats)) {
    if (amount > 0) {
      run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
      entries.push({ label: `+${amount} ${mat}`, color: '#e040fb' });
    }
  }

  // Material drops from enemy
  const enemyMats = rollMaterialDrops('enemy', enemyId, run.loop.count);
  for (const [mat, amount] of Object.entries(enemyMats)) {
    if (amount > 0) {
      run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
      entries.push({ label: `+${amount} ${mat}`, color: '#e040fb' });
    }
  }

  // Boss material drops
  if (enemyType === 'boss') {
    const bossMats = rollMaterialDrops('boss', enemyId, run.loop.count);
    for (const [mat, amount] of Object.entries(bossMats)) {
      if (amount > 0) {
        run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
        entries.push({ label: `+${amount} ${mat}`, color: '#e040fb' });
      }
    }
  }

  // Shard drops — element-typed loot per kill. Class bias decides physical vs
  // elemental category; auto-conversion (10 shards -> 1 element) runs in place.
  const shardEnemyType = (enemyType === 'elite' || enemyType === 'boss') ? enemyType : 'normal';
  const heroClass = run.hero.className ?? 'warrior';
  const shardDelta: ShardInventory = rollShardDrops(shardEnemyType, heroClass);
  if (!run.economy.shards) run.economy.shards = {};
  if (!run.economy.elements) run.economy.elements = {};
  const elementsAdded: ElementInventory = addShardsAndConvert(
    run.economy.shards as ShardInventory,
    run.economy.elements as ElementInventory,
    shardDelta,
  );
  for (const id of Object.keys(shardDelta) as ElementId[]) {
    const n = shardDelta[id] ?? 0;
    if (n > 0) entries.push({ label: `+${n} ${ELEMENTS[id].name} shard`, color: ELEMENTS[id].color });
  }
  for (const id of Object.keys(elementsAdded) as ElementId[]) {
    const n = elementsAdded[id] ?? 0;
    if (n > 0) entries.push({ label: `+${n} ${ELEMENTS[id].name}!`, color: ELEMENTS[id].color });
  }

  // Tile drops (rare; 15% chance per terrain combat). Writes to the
  // canonical RunState tile inventory; LoopRunState rehydrates from there
  // on next GameScene.create / planning entry. tileDropBonus uplifts count.
  const tileDrops = rollTileDrops(terrain, run.loop.count);
  const tileMult = 1 + sumBuff('tileDropBonus');
  for (const drop of tileDrops) {
    const finalCount = Math.max(drop.count, Math.floor(drop.count * tileMult));
    const current = run.economy.tileInventory[drop.tileType] ?? 0;
    run.economy.tileInventory[drop.tileType] = current + finalCount;
    entries.push({ label: `+${finalCount} ${drop.tileType} tile`, color: '#80ffd0' });
  }

  // Card drops removed in Phase 10 — enemies award gold + materials + shards only.
  // Players build new cards by forging element units at the in-loop Forge.
  // (enemy-drops.json cardPool data preserved for future reference but unused.)

  addPendingLoot(entries);
}
