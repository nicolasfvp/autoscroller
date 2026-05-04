import { createBasicLoop, createBufferTiles, createTileSlot, getTileConfig, type TileSlot, type TileInventoryEntry } from './TileRegistry';
import { resolveAdjacencySynergies, type SynergyBuff } from './SynergyResolver';
import { getLoopSpeed, getDifficultyConfig, getLoopGrowth } from './DifficultyScaler';
import { getEnemyPoolForTerrain } from './LootGenerator';
import { resolveRunEnd, type RunEndResult } from './RunEndResolver';

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
    this.rng = rng ?? (() => Math.random());
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
    this.runState.loop.length = config.baseLoopLength;
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

    const config = getTileConfig(tile.terrain ?? tile.type);
    const diffConfig = getDifficultyConfig();

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
        this.emit('combat-start', { enemyId: tile.enemyId ?? 'boss_demon', isBoss: true, tileIndex });
        break;
      }
      case 'shop':
      case 'rest':
      case 'event':
      case 'treasure': {
        tile.defeatedThisLoop = true;
        this.state = 'tile-interaction';
        const sceneMap: Record<string, string> = {
          shop: 'ShopScene',
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
    loop.count++;

    // Award tile points
    const diffConfig = getDifficultyConfig();
    this.runState.economy.tilePoints += diffConfig.baseTilePointsPerLoop + Math.floor(loop.count * diffConfig.tilePointScalePerLoop);

    // Reset defeated flags (buffer tiles stay permanently defeated)
    for (const tile of loop.tiles) {
      if (tile.type !== 'buffer') tile.defeatedThisLoop = false;
    }

    // Update difficulty multiplier
    loop.difficultyMultiplier = 1 + (loop.count - 1) * diffConfig.percentPerLoop;

    // Check if boss loop: add boss as extra tile
    if (loop.count % diffConfig.bossEveryNLoops === 0) {
      loop.tiles.push(createTileSlot('boss'));
    }

    // Strip old buffer prefix and re-add fresh ones so the landmark positions stay consistent
    const nonBuffer = loop.tiles.filter(t => t.type !== 'buffer');
    const freshBuffer = createBufferTiles(BUFFER_TILE_COUNT);
    loop.tiles = [...freshBuffer, ...nonBuffer];
    loop.length = loop.tiles.length;

    // Reset position to beginning of loop
    this.runState.loop.positionInLoop = 0;
    this.lastTileIndex = -1;

    if (loop.count % diffConfig.bossEveryNLoops === 0) {
      this.assignEnemies();
    }

    this.assignEnemies();
    this.emit('loop-completed', { loopCount: loop.count });
    this.state = 'planning';
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
          tile.enemyId = 'boss_demon';
          break;
        }
      }
    }
  }

  onBossDefeated(): void {
    this.state = 'boss-choice';
    this.emit('boss-defeated', { loopCount: this.runState.loop.count });
  }

  /** Track boss kills for diminishing loop growth */
  private bossKillCount: number = 0;

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

    // Continue: grow loop by diminishing amount based on boss kills
    const growth = getLoopGrowth(this.bossKillCount);
    this.bossKillCount++;
    const diffConfig = getDifficultyConfig();
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

    this.state = 'planning';
    this.emit('planning-phase-started', { loopCount: this.runState.loop.count });
  }

  placeTile(slotIndex: number, tileKey: string): boolean {
    if (this.state !== 'planning') return false;

    const tile = this.runState.loop.tiles[slotIndex];
    if (!tile) return false;

    // Prevent placing tiles on slots with pre-assigned enemies (feedback #16)
    if (tile.enemyId) return false;

    // Prevent placing on boss or buffer tiles
    if (tile.type === 'boss' || tile.type === 'buffer') return false;

    // If slot is occupied by a non-basic tile, return it to inventory (feedback #24)
    if (tile.type !== 'basic') {
      const existing = this.runState.tileInventory.find(t => t.tileType === tile.type);
      if (existing) {
        existing.count++;
      } else {
        this.runState.tileInventory.push({ tileType: tile.type, count: 1 });
      }
    }

    const newTile = createTileSlot(tileKey);
    this.runState.loop.tiles[slotIndex] = newTile;
    return true;
  }
}
