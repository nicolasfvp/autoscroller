import { createBasicLoop, createBufferTiles, createTileSlot, getTileConfig, type TileSlot, type TileInventoryEntry } from './TileRegistry';
import { resolveSubtileEffects, effectsForTile, type SubtileEffect } from './SubtileResolver';
import { getLoopSpeed, getDifficultyConfig, getLoopGrowth } from './DifficultyScaler';
import { getEnemyPoolForTerrain } from './LootGenerator';
import { resolveRunEnd, type RunEndResult } from './RunEndResolver';
import { rand } from './SharedRNG';
import { applyTravelBoots, applyTrailblazersBrand, applyLodestonePendant } from './LoopRelics';
import { getRun, hasActiveRun } from '../state/RunState';

const TILE_SIZE = 64;
export const BUFFER_TILE_COUNT = 5; // Safe tiles at the start of every loop

export type LoopState = 'idle' | 'traversing' | 'tile-interaction' | 'planning' | 'boss-choice' | 'run-ended';

export type LoopEventCallback = (event: string, data: any) => void;

export interface LoopStateData {
  count: number;
  length: number;
  tiles: TileSlot[];
  positionInLoop: number;
  difficultyMultiplier: number;
  trailblazerFiredThisLoop?: boolean;
}

export interface EconomyData {
  gold: number;
  tilePoints: number;
  materials: Record<string, number>;
}

export interface LoopRunState {
  loop: LoopStateData;
  economy: EconomyData;
  tileInventory: TileInventoryEntry[];
}

export { TILE_SIZE };

export class LoopRunner {
  private state: LoopState = 'idle';
  private lastTileIndex: number = -1;
  private runState!: LoopRunState;
  private emit: LoopEventCallback;
  private rng: () => number;
  /**
   * Cached subtile effect bag for the current loop layout. Refreshed in
   * confirmPlanning / resumeRun / startRun whenever the tile array can
   * change. Drives:
   *   - War Horn spawn boost in assignEnemies
   *   - per-combat subtileEffects payload on combat-start emits
   */
  private subtileEffectBag: SubtileEffect[] = [];

  /** Base 50% combat-spawn chance for terrain / subtile tiles. */
  private static readonly COMBAT_TILE_SPAWN_CHANCE = 0.5;
  /** Additive spawn-chance boost per War Horn stack within ±2 AOE. */
  private static readonly WAR_HORN_BOOST_PER_STACK = 0.5;

  constructor(emit: LoopEventCallback, rng?: () => number) {
    this.emit = emit;
    // Default to the module-level SharedRNG so a single seeded source flows
    // through enemy assignment without each caller threading rng explicitly.
    this.rng = rng ?? (() => rand());
  }

  getState(): LoopState {
    return this.state;
  }

  startRun(runState: LoopRunState): void {
    this.runState = runState;
    const config = getDifficultyConfig();
    this.runState.loop.count = 1;
    // Prepend buffer tiles — these are non-interactive and give the player
    // a few safe tiles before hitting any user-placed content.
    const baseTiles = createBasicLoop(config.baseLoopLength);
    const bufferTiles = createBufferTiles(BUFFER_TILE_COUNT);
    this.runState.loop.tiles = [...bufferTiles, ...baseTiles];
    this.runState.loop.length = this.runState.loop.tiles.length;
    this.runState.loop.positionInLoop = 0;
    this.runState.loop.difficultyMultiplier = 1.0;
    this.lastTileIndex = -1;
    this.bossKillCount = 0;
    this.assignEnemies();
    this.state = 'traversing';
  }

  /**
   * Resume an in-progress run from a previously persisted LoopRunState.
   * Caller is responsible for hydrating tiles/positionInLoop/etc into
   * runState before calling. This avoids the unconditional reset that
   * `startRun` performs.
   */
  resumeRun(runState: LoopRunState, bossKillCount: number = 0): void {
    this.runState = runState;
    if (!runState.loop.tiles || runState.loop.tiles.length === 0) {
      // Nothing usable to resume from — fall back to a fresh run.
      this.startRun(runState);
      return;
    }
    runState.loop.length = runState.loop.tiles.length;
    this.lastTileIndex = -1;
    this.bossKillCount = bossKillCount;
    // Re-roll enemy assignments for any tile that hasn't been pre-assigned
    // (saves don't necessarily round-trip enemyId in older data).
    this.assignEnemies();
    this.state = 'traversing';
  }

  tick(delta: number): void {
    if (this.state !== 'traversing') return;

    const speed = getLoopSpeed(this.runState.loop.count);
    this.runState.loop.positionInLoop += speed * delta / 1000;

    const totalLoopPixels = this.runState.loop.length * TILE_SIZE;

    // Check loop wrap
    if (this.runState.loop.positionInLoop >= totalLoopPixels) {
      this.runState.loop.positionInLoop = 0;
      this.onLoopCompleted();
      return;
    }

    // Check tile boundary crossing
    const currentTileIndex = Math.floor(this.runState.loop.positionInLoop / TILE_SIZE);
    if (currentTileIndex !== this.lastTileIndex && currentTileIndex < this.runState.loop.tiles.length) {
      this.lastTileIndex = currentTileIndex;
      this.onTileEntered(currentTileIndex);
    }
  }

  private onTileEntered(tileIndex: number): void {
    const tile = this.runState.loop.tiles[tileIndex];
    if (!tile || tile.defeatedThisLoop) return;

    // C6 / C7: map-side relic triggers. These helpers reach into the live
    // RunState (where hero HP/stamina/mana and the relic list actually
    // live) rather than the LoopRunState slice that this runner owns. See
    // LoopRelics.ts for the trigger conditions.
    applyTravelBoots();
    applyTrailblazersBrand(tile);

    // Subtile effects targeting this tile (Wave 6 consumers use this bag).
    const subtileEffects = effectsForTile(this.subtileEffectBag, tileIndex);

    switch (tile.type) {
      case 'basic': {
        // Combat only if enemy was pre-assigned
        if (tile.enemyId) {
          tile.defeatedThisLoop = true;
          this.state = 'tile-interaction';
          this.emit('combat-start', { enemyId: tile.enemyId, isBoss: false, tileIndex, subtileEffects });
        }
        break;
      }
      case 'terrain': {
        if (!tile.enemyId) {
          // Spawn roll lost (chance-based since Wave 4). Mark traversed and
          // walk on without emitting combat-start.
          tile.defeatedThisLoop = true;
          break;
        }
        tile.defeatedThisLoop = true;
        this.state = 'tile-interaction';
        const terrainKey = tile.terrain!;
        this.emit('combat-start', { enemyId: tile.enemyId, isBoss: false, tileIndex, terrain: terrainKey, subtileEffects });
        break;
      }
      case 'subtile': {
        // Subtiles can also produce an extra combat encounter when the spawn
        // roll succeeded in assignEnemies. Effect itself is consumed by the
        // host combat (or boss) in AOE — not by the subtile's own fight.
        if (!tile.enemyId) {
          tile.defeatedThisLoop = true;
          break;
        }
        tile.defeatedThisLoop = true;
        this.state = 'tile-interaction';
        const terrain = this.getAdjacentTerrain(tileIndex);
        this.emit('combat-start', { enemyId: tile.enemyId, isBoss: false, tileIndex, terrain, subtileEffects });
        break;
      }
      case 'boss': {
        tile.defeatedThisLoop = true;
        this.state = 'tile-interaction';
        this.emit('combat-start', { enemyId: tile.enemyId ?? 'doom_knight', isBoss: true, tileIndex, subtileEffects });
        break;
      }
      case 'event':
      case 'treasure': {
        tile.defeatedThisLoop = true;
        this.state = 'tile-interaction';
        const sceneMap: Record<string, string> = {
          event: 'EventScene',
          treasure: 'TreasureScene',
        };
        this.emit('open-scene', { scene: sceneMap[tile.type], tileIndex });
        break;
      }
    }
  }

  private onLoopCompleted(): void {
    const loop = this.runState.loop;
    // Snapshot the length the hero just traversed BEFORE any tile mutations
    // below (boss push/splice, buffer renorm). GameScene uses this to advance
    // worldOffset by the exact distance covered so the tile pool stays aligned
    // when a boss tile is added (loop length grows mid-callback) or when a
    // leftover boss is dropped (loop length shrinks).
    const traversedLength = loop.length;
    loop.count++;

    // C6 / C7: Lodestone Pendant heals on loop completion and also resets
    // Trailblazer's Brand per-loop flag (the reset runs unconditionally
    // so the next loop's first combat tile can re-arm the brand even if
    // Lodestone isn't equipped). See LoopRelics.ts.
    applyLodestonePendant();

    // Award tile points
    const diffConfig = getDifficultyConfig();
    this.runState.economy.tilePoints += diffConfig.baseTilePointsPerLoop + Math.floor(loop.count * diffConfig.tilePointScalePerLoop);

    // Reset defeated flags (buffer tiles stay permanently defeated)
    for (const tile of loop.tiles) {
      if (tile.type !== 'buffer') tile.defeatedThisLoop = false;
    }

    // Difficulty multiplier scales with boss kills, not loops.
    loop.difficultyMultiplier = 1 + this.bossKillCount * diffConfig.percentPerBossKill;

    // Boss tile management:
    //  - On a boss loop, ensure exactly ONE boss tile exists (don't append a
    //    second one that would have to be re-fought every loop).
    //  - On a non-boss loop, drop any leftover boss tile from the previous
    //    boss cycle so the player doesn't keep refighting it.
    const isBossLoop = loop.count % diffConfig.bossEveryNLoops === 0;
    const existingBossIndex = loop.tiles.findIndex(t => t.type === 'boss');
    if (isBossLoop) {
      if (existingBossIndex === -1) {
        loop.tiles.push(createTileSlot('boss'));
      } else {
        // Reuse the existing boss tile (already at end). Just clear flag.
        loop.tiles[existingBossIndex].defeatedThisLoop = false;
        loop.tiles[existingBossIndex].enemyId = undefined;
      }
    } else if (existingBossIndex !== -1) {
      loop.tiles.splice(existingBossIndex, 1);
    }

    // Reuse the existing buffer prefix instead of allocating new TileSlot
    // objects every loop. Tile *identity* matters for any caller using a
    // WeakMap keyed on TileSlot (none today, but cheap insurance + GC win).
    const existingBuffer = loop.tiles.filter(t => t.type === 'buffer');
    const nonBuffer = loop.tiles.filter(t => t.type !== 'buffer');
    while (existingBuffer.length < BUFFER_TILE_COUNT) {
      existingBuffer.push(...createBufferTiles(BUFFER_TILE_COUNT - existingBuffer.length));
    }
    if (existingBuffer.length > BUFFER_TILE_COUNT) {
      existingBuffer.length = BUFFER_TILE_COUNT;
    }
    for (const t of existingBuffer) t.defeatedThisLoop = true;
    loop.tiles = [...existingBuffer, ...nonBuffer];
    loop.length = loop.tiles.length;

    // Reset position to beginning of loop
    this.runState.loop.positionInLoop = 0;
    this.lastTileIndex = -1;

    // F.5.l: defer enemy assignment to confirmPlanning() — running here AND
    // in confirmPlanning rerolled enemies twice and burned RNG state for
    // tiles the player would never see (planning could swap them out).
    this.emit('loop-completed', { loopCount: loop.count, traversedLength });
    this.state = 'planning';
    this.assignEnemies(); // Pre-assign enemies for the next loop layout
    this.emit('planning-phase-started', { loopCount: loop.count });
  }

  resumeTraversal(): void {
    this.state = 'traversing';
  }

  confirmPlanning(): void {
    if (this.state !== 'planning') return;
    this.assignEnemies();
    this.state = 'traversing';
    this.emit('loop-started', { loopCount: this.runState.loop.count });
  }

  /**
   * Pre-assign enemies to combat/terrain/subtile/boss tiles for world-map display.
   *
   * Spawn rules (Wave 4):
   *   - basic: uses diffConfig.basicTileCombatChance (unchanged)
   *   - terrain (combat): base 50%, +0.5 per War Horn stack in ±2 AOE, clamped to 1.0
   *   - subtile: flat 50% from the adjacent host's terrain pool (no War Horn boost on subtiles themselves)
   *   - boss: 100% (always spawns); receives subtile AOE via effect bag, not via spawn roll
   *
   * The cached subtile effect bag is refreshed before rolling so War Horn /
   * other effects reflect the current layout.
   */
  private assignEnemies(): void {
    const loop = this.runState.loop;
    const diffConfig = getDifficultyConfig();
    this.subtileEffectBag = resolveSubtileEffects(loop.tiles);

    for (let i = 0; i < loop.tiles.length; i++) {
      const tile = loop.tiles[i];
      // Non-combat tiles never need enemy assignment — skip them up front
      // so we don't burn rng() calls (would also drift the seeded RNG state
      // once B.7/B.8 lands).
      if (tile.type === 'buffer' || tile.type === 'event' || tile.type === 'treasure') {
        continue;
      }
      tile.enemyId = undefined;
      if (tile.defeatedThisLoop) continue;

      switch (tile.type) {
        case 'basic': {
          if (this.rng() < diffConfig.basicTileCombatChance) {
            const pool = getEnemyPoolForTerrain('basic', loop.count);
            tile.enemyId = pool[Math.floor(this.rng() * pool.length)];
          }
          break;
        }
        case 'terrain': {
          const spawnChance = this.getCombatSpawnChance(i);
          if (this.rng() < spawnChance) {
            const pool = getEnemyPoolForTerrain(tile.terrain!, loop.count);
            tile.enemyId = pool[Math.floor(this.rng() * pool.length)];
          }
          break;
        }
        case 'subtile': {
          // Subtiles are 50% to spawn one extra enemy drawn from the adjacent
          // host combat's terrain pool. War Horn does NOT boost subtiles
          // themselves — only the combat tiles in its AOE.
          if (this.rng() < LoopRunner.COMBAT_TILE_SPAWN_CHANCE) {
            const terrain = this.getAdjacentTerrain(i);
            const pool = getEnemyPoolForTerrain(terrain, loop.count);
            tile.enemyId = pool[Math.floor(this.rng() * pool.length)];
          }
          break;
        }
        case 'boss': {
          const BOSS_ROTATION = ['doom_knight', 'boss_demon', 'iron_golem', 'boss_berserker', 'boss_mage', 'lizard_king', 'boss_hydra'];
          tile.enemyId = BOSS_ROTATION[this.bossKillCount % BOSS_ROTATION.length];
          break;
        }
      }
    }

    // Ensure at least 2 enemies per loop
    let enemyCount = loop.tiles.filter(t => t.enemyId !== undefined).length;
    if (enemyCount < 2) {
      const basicTilesWithoutEnemy = loop.tiles.filter(t => t.type === 'basic' && !t.enemyId && !t.defeatedThisLoop);
      // Shuffle candidates and pick enough to reach 2
      for (let i = basicTilesWithoutEnemy.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [basicTilesWithoutEnemy[i], basicTilesWithoutEnemy[j]] = [basicTilesWithoutEnemy[j], basicTilesWithoutEnemy[i]];
      }
      
      while (enemyCount < 2 && basicTilesWithoutEnemy.length > 0) {
        const tile = basicTilesWithoutEnemy.pop()!;
        const pool = getEnemyPoolForTerrain('basic', loop.count);
        tile.enemyId = pool[Math.floor(this.rng() * pool.length)];
        enemyCount++;
      }
    }
  }

  /**
   * Final spawn chance for a combat tile at index i: 0.5 base, +0.5 per
   * War Horn stack in its AOE, clamped to [0, 1].
   */
  private getCombatSpawnChance(tileIndex: number): number {
    let chance = LoopRunner.COMBAT_TILE_SPAWN_CHANCE;
    const here = effectsForTile(this.subtileEffectBag, tileIndex);
    for (const e of here) {
      if (e.effect === 'war_horn') {
        chance += LoopRunner.WAR_HORN_BOOST_PER_STACK * e.stacks;
      }
    }
    return Math.min(1, Math.max(0, chance));
  }

  /**
   * Look at S±1 for a terrain tile (subtile's host) and return its terrain.
   * If no adjacent terrain tile exists (orphaned subtile awaiting Wave-5
   * auto-removal, or boss adjacency), fall back to 'basic'.
   */
  private getAdjacentTerrain(subtileIndex: number): string {
    const tiles = this.runState.loop.tiles;
    for (const offset of [-1, 1]) {
      const j = subtileIndex + offset;
      if (j < 0 || j >= tiles.length) continue;
      const neighbor = tiles[j];
      if (neighbor.type === 'terrain' && neighbor.terrain) return neighbor.terrain;
    }
    return 'basic';
  }

  onBossDefeated(): void {
    this.state = 'boss-choice';
    this.emit('boss-defeated', { loopCount: this.runState.loop.count });
  }

  /** Track boss kills for diminishing loop growth (persisted via resumeRun) */
  private bossKillCount: number = 0;

  /** Expose bossKillCount so the scene layer can persist it across save/load. */
  getBossKillCount(): number {
    return this.bossKillCount;
  }

  onBossChoice(choice: 'exit' | 'continue'): RunEndResult | void {
    if (choice === 'exit') {
      this.state = 'run-ended';
      // Pull live XP from RunState (LoopRunState no longer carries hero.xp;
      // BossExitScene reads runXP from the same source for its banking path).
      const runXP = hasActiveRun() ? (getRun().hero.runXP ?? 0) : 0;
      const result = resolveRunEnd(
        'safe',
        this.runState.economy.materials,
        runXP,
      );
      this.emit('run-exited', result);
      return result;
    }

    // Snapshot the length BEFORE the splice/grow so GameScene can advance
    // worldOffset by the distance the hero actually traversed up to the boss
    // tile. Once we mutate loop.length below, that information is lost.
    const traversedLength = this.runState.loop.length;

    // Continue: grow loop by diminishing amount based on boss kills
    const growth = getLoopGrowth(this.bossKillCount);
    this.bossKillCount++;
    // Bump difficulty for the remainder of the current loop immediately —
    // onLoopCompleted only fires once the next loop wraps, so without this
    // any encounter between boss defeat and next wrap would still scale
    // off the pre-kill multiplier.
    const diffConfig = getDifficultyConfig();
    this.runState.loop.difficultyMultiplier = 1 + this.bossKillCount * diffConfig.percentPerBossKill;
    const maxLen = (diffConfig as any).loopGrowth?.maxTileLength ?? 40;
    const actualGrowth = Math.min(growth, maxLen - this.runState.loop.length);
    const newTiles: TileSlot[] = Array.from(
      { length: Math.max(0, actualGrowth) },
      () => createTileSlot('basic')
    );
    // Insert before the last position (boss position)
    const insertAt = this.runState.loop.length - 1;
    this.runState.loop.tiles.splice(insertAt, 0, ...newTiles);
    this.runState.loop.length += Math.max(0, actualGrowth);

    // Drop the boss tile that was just defeated — otherwise it gets reset by
    // the next onLoopCompleted and re-fought. The next bossEveryNLoops cycle
    // will spawn a fresh one.
    const bossIdx = this.runState.loop.tiles.findIndex(t => t.type === 'boss');
    if (bossIdx !== -1) {
      this.runState.loop.tiles.splice(bossIdx, 1);
      this.runState.loop.length = this.runState.loop.tiles.length;
    }

    // Reset traversal position so the freshly-inserted basic tiles aren't
    // skipped on this loop (the player was sitting near loop end at the
    // boss tile). lastTileIndex must also reset so onTileEntered re-fires.
    this.runState.loop.positionInLoop = 0;
    this.lastTileIndex = -1;

    this.state = 'planning';
    this.emit('planning-phase-started', { loopCount: this.runState.loop.count, traversedLength });
  }

  placeTile(slotIndex: number, tileKey: string): boolean {
    if (this.state !== 'planning') return false;

    const tile = this.runState.loop.tiles[slotIndex];
    if (!tile) return false;

    // Prevent placing tiles on slots with pre-assigned enemies (feedback #16)
    if (tile.enemyId) return false;

    // Prevent placing on boss or buffer tiles
    if (tile.type === 'boss' || tile.type === 'buffer') return false;

    // Wave 5: slot must be empty to accept a new tile. Use removeTile first.
    // Empty here means a basic slot — reserved slots are basic with reserved:true.
    if (tile.type !== 'basic') return false;

    // Wave 5: enforce reservation rules. The picker is supposed to gate this
    // visually too, but the engine also rejects mismatches as a safety net.
    const newConfig = getTileConfig(tileKey);
    const isSubtile = newConfig.type === 'subtile';
    if (isSubtile) {
      // Subtiles only into reserved slots, AND need at least one adjacent
      // combat or boss tile (the AOE anchor).
      if (!tile.reserved) return false;
      if (!this.hasAdjacentCombatOrBoss(slotIndex)) return false;
    } else {
      // Non-subtiles can't land on a reserved slot.
      if (tile.reserved) return false;
    }

    const newTile = createTileSlot(tileKey);
    this.runState.loop.tiles[slotIndex] = newTile;

    // A new combat (terrain) tile reserves its empty neighbors. Subtile and
    // event/treasure placements don't project reservations.
    this.recomputeReservations();
    return true;
  }

  /**
   * Wave 5: explicit tile removal. Returns the slot to basic + refunds
   * floor(cost * 0.5) tile points. Recomputes reservations and cascades
   * orphan-subtile cleanup (any subtile that loses its last adjacent
   * combat/boss is also auto-removed with the same 50% refund).
   *
   * Refuses to remove buffer / boss / basic tiles. Returns true if a
   * tile was actually removed.
   */
  removeTile(slotIndex: number): boolean {
    if (this.state !== 'planning') return false;
    const tile = this.runState.loop.tiles[slotIndex];
    if (!tile) return false;
    if (tile.type === 'basic' || tile.type === 'buffer' || tile.type === 'boss') return false;

    this.refundTileAndClear(slotIndex);
    this.recomputeReservations();
    this.cascadeOrphanSubtiles();
    return true;
  }

  private refundTileAndClear(slotIndex: number): void {
    const tile = this.runState.loop.tiles[slotIndex];
    if (!tile || tile.type === 'basic' || tile.type === 'buffer' || tile.type === 'boss') return;
    const kindKey = tile.kind ?? tile.terrain ?? tile.type;
    try {
      const config = getTileConfig(kindKey);
      const refund = Math.floor(config.tilePointCost * 0.5);
      this.runState.economy.tilePoints += refund;
    } catch {
      // Unknown tile kind shouldn't happen, but never block removal on it.
    }
    this.runState.loop.tiles[slotIndex] = {
      type: 'basic',
      defeatedThisLoop: false,
    };
  }

  /**
   * Recompute the `reserved` flag on every empty (basic, non-buffer) slot.
   * A slot is reserved iff it is empty AND at least one immediate neighbor
   * is a combat (terrain) tile. Boss tiles do NOT project reservations
   * outward per design (Wave 5).
   */
  private recomputeReservations(): void {
    const tiles = this.runState.loop.tiles;
    for (let i = 0; i < tiles.length; i++) {
      const slot = tiles[i];
      if (slot.type !== 'basic' || slot.enemyId) continue;
      const leftIsCombat = i > 0 && tiles[i - 1].type === 'terrain';
      const rightIsCombat = i + 1 < tiles.length && tiles[i + 1].type === 'terrain';
      slot.reserved = leftIsCombat || rightIsCombat;
    }
  }

  /**
   * After a removal, any subtile that no longer has an adjacent combat or
   * boss tile is "orphaned" and self-removes with the same 50% TP refund.
   * Reservations are recomputed once more after the cascade in case the
   * cascade unblocks further reservations.
   */
  private cascadeOrphanSubtiles(): void {
    const tiles = this.runState.loop.tiles;
    let removed = false;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].type !== 'subtile') continue;
      if (!this.hasAdjacentCombatOrBoss(i)) {
        this.refundTileAndClear(i);
        removed = true;
      }
    }
    if (removed) this.recomputeReservations();
  }

  private hasAdjacentCombatOrBoss(slotIndex: number): boolean {
    const tiles = this.runState.loop.tiles;
    for (const offset of [-1, 1]) {
      const j = slotIndex + offset;
      if (j < 0 || j >= tiles.length) continue;
      const t = tiles[j].type;
      if (t === 'terrain' || t === 'boss') return true;
    }
    return false;
  }
}
