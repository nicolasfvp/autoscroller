// Combat loot generation -- produces gold + card + material drops after victory.
// Uses enemy drop tables, EnemyDefinition goldReward, and material config.
// Zero Phaser dependency.

import type { RunState } from '../state/RunState';
import { t } from '../i18n/i18n';
import { addPendingLoot } from './PendingLoot';
import { rollMaterialDrops, rollTileDrops } from './LootGenerator';
import { rollShardDrops, addShardsAndConvert, type ShardInventory, type ElementInventory } from './ShardSystem';
import { ELEMENTS, type ElementId } from './ElementSystem';

// Card drops removed in Phase 10 — enemies award shards only.

/**
 * Generate and apply combat loot after a victory.
 * - Awards gold directly to RunState
 * - Drops materials from terrain and enemy pools
 * - Drops element shards (auto-converted to elements); card drops were
 *   removed in Phase 10 — new cards come from the Forge instead
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

  // Gold (raw — synergy-buff uplift removed in Wave 2; subtile loot-shaper
  // category was cut from the new design).
  const finalGold = goldAmount;
  if (finalGold > 0) {
    run.economy.gold += finalGold;
    run.stats.goldEarned += finalGold;
    entries.push({ label: t('combatLoot.gold', { finalGold }), color: '#ffd700' });
  }

  // XP
  if (xpAmount > 0) {
    entries.push({ label: t('combatLoot.xp', { xpAmount }), color: '#00ccff' });
  }

  // Storehouse gathering boost is applied once at banking time in
  // MetaProgressionSystem.bankRunRewards — drops here remain raw.

  // Material drops from terrain
  const terrainMats = rollMaterialDrops('terrain', terrain, run.loop.count);
  for (const [mat, amount] of Object.entries(terrainMats)) {
    if (amount > 0) {
      run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
      entries.push({ label: t('combatLoot.material', { amount, mat }), color: '#e040fb' });
    }
  }

  // Material drops from enemy
  const enemyMats = rollMaterialDrops('enemy', enemyId, run.loop.count);
  for (const [mat, amount] of Object.entries(enemyMats)) {
    if (amount > 0) {
      run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
      entries.push({ label: t('combatLoot.material', { amount, mat }), color: '#e040fb' });
    }
  }

  // Boss material drops
  if (enemyType === 'boss') {
    const bossMats = rollMaterialDrops('boss', enemyId, run.loop.count);
    for (const [mat, amount] of Object.entries(bossMats)) {
      if (amount > 0) {
        run.economy.materials[mat] = (run.economy.materials[mat] ?? 0) + amount;
        entries.push({ label: t('combatLoot.material', { amount, mat }), color: '#e040fb' });
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
    if (n > 0) entries.push({ label: t('combatLoot.shard', { n, name: ELEMENTS[id].name }), color: ELEMENTS[id].color });
  }
  for (const id of Object.keys(elementsAdded) as ElementId[]) {
    const n = elementsAdded[id] ?? 0;
    if (n > 0) entries.push({ label: t('combatLoot.element', { n, name: ELEMENTS[id].name }), color: ELEMENTS[id].color });
  }

  // Tile drops (rare; 15% chance per terrain combat). Writes to the
  // canonical RunState tile inventory; LoopRunState rehydrates from there
  // on next GameScene.create / planning entry. tileDropBonus uplifts count.
  const tileDrops = rollTileDrops(terrain, run.loop.count);
  for (const drop of tileDrops) {
    const current = run.economy.tileInventory[drop.tileType] ?? 0;
    run.economy.tileInventory[drop.tileType] = current + drop.count;
    entries.push({ label: t('combatLoot.tile', { count: drop.count, tileType: drop.tileType }), color: '#80ffd0' });
  }

  // Card drops removed in Phase 10 — enemies award gold + materials + shards only.
  // Players build new cards by forging element units at the in-loop Forge.
  // (enemy-drops.json cardPool data preserved for future reference but unused.)

  addPendingLoot(entries);
}
