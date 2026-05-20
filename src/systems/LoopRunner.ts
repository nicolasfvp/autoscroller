import { createBasicLoop, createBufferTiles, createTileSlot, type TileSlot, type TileInventoryEntry } from './TileRegistry';
import { resolveAdjacencySynergies, type SynergyBuff } from './SynergyResolver';
import { getLoopSpeed, getDifficultyConfig, getLoopGrowth } from './DifficultyScaler';
import { getEnemyPoolForTerrain } from './LootGenerator';
import { resolveRunEnd, type RunEndResult } from './RunEndResolver';
import { rand } from './SharedRNG';

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
  hero?: { xp: number };
}

export { TILE_SIZE };

export class LoopRunner {
  private state: LoopState = 'idle';
  private lastTileIndex: number = -1;
  private runState!: LoopRunState;
  private activeBuffs: SynergyBuff[] = [];
  private emit: LoopEventCallback;
  private rng: () => number;

  constructor(emit: LoopEventCallback, rng?: () => number) {
    this.emit = emit;
    // Default to the module-level SharedRNG so a single seeded source flows
    // through enemy assignment without each caller threading rng explicitly.
    this.rng = rng ?? (() => rand());
  }

  getState(): LoopState {
    return this.state;
  }

  getActiveBuffs(): SynergyBuff[] {
    return this.activeBuffs;
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
    this.activeBuffs = [];
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
    this.activeBuffs = resolveAdjacencySynergies(runState.loop.tiles);
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

    switch (tile.type) {
      case 'basic': {
        // Combat only if enemy was pre-assigned
        if (tile.enemyId) {
          tile.defeatedThisLoop = true;
          this.state = 'tile-interaction';
          this.emit('combat-start', { enemyId: tile.enemyId, isBoss: false, tileIndex });
        }
        break;
      }
      case 'terrain': {
        tile.defeatedThisLoop = true;
        this.state = 'tile-interaction';
        const terrainKey = tile.terrain!;
        this.emit('combat-start', { enemyId: tile.enemyId, isBoss: false, tileIndex, terrain: terrainKey });
        break;
      }
      case 'boss': {
        tile.defeatedThisLoop = true;
        this.state = 'tile-interaction';
        this.emit('combat-start', { enemyId: tile.enemyId ?? 'doom_knight', isBoss: true, tileIndex });
        break;
      }
      case 'rest':
      case 'event':
      case 'treasure': {
        tile.defeatedThisLoop = true;
        this.state = 'tile-interaction';
        const sceneMap: Record<string, string> = {
          rest: 'RestSiteScene',
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
    this.activeBuffs = resolveAdjacencySynergies(this.runState.loop.tiles);
    this.assignEnemies();
    this.state = 'traversing';
    this.emit('loop-started', { loopCount: this.runState.loop.count, buffs: this.activeBuffs });
  }

  /** Pre-assign enemies to combat/terrain/boss/basic tiles for world-map display */
  private assignEnemies(): void {
    const loop = this.runState.loop;
    const diffConfig = getDifficultyConfig();
    for (const tile of loop.tiles) {
      // Non-combat tiles never need enemy assignment — skip them up front
      // so we don't burn rng() calls (would also drift the seeded RNG state
      // once B.7/B.8 lands).
      if (tile.type === 'buffer' || tile.type === 'shop' ||
          tile.type === 'rest' || tile.type === 'event' ||
          tile.type === 'treasure') {
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
          const pool = getEnemyPoolForTerrain(tile.terrain!, loop.count);
          tile.enemyId = pool[Math.floor(this.rng() * pool.length)];
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
      const result = resolveRunEnd(
        'safe',
        this.runState.economy.materials,
        this.runState.hero?.xp ?? 0
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

    // If slot is occupied by a non-basic tile, return it to inventory (feedback #24).
    // Inventory is keyed on the *specific* tile kind (forest, swamp, shop, …),
    // not on tile.type — terrain tiles all have type === 'terrain' so using
    // that as the key collapses every terrain into a single 'terrain' entry.
    if (tile.type !== 'basic') {
      const inventoryKey = tile.terrain ?? tile.type;
      const existing = this.runState.tileInventory.find(t => t.tileType === inventoryKey);
      if (existing) {
        existing.count++;
      } else {
        this.runState.tileInventory.push({ tileType: inventoryKey, count: 1 });
      }
    }

    const newTile = createTileSlot(tileKey);
    this.runState.loop.tiles[slotIndex] = newTile;
    return true;
  }
}
