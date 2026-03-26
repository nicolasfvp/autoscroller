import { createBasicLoop, createTileSlot, getTileConfig, type TileSlot, type TileInventoryEntry } from './TileRegistry';
import { resolveAdjacencySynergies, type SynergyBuff } from './SynergyResolver';
import { getLoopSpeed, getDifficultyConfig } from './DifficultyScaler';
import { getEnemyPoolForTerrain } from './LootGenerator';
import { resolveRunEnd, type RunEndResult } from './RunEndResolver';

const TILE_SIZE = 80;

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
  metaLoot: number;
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
    this.runState.loop.tiles = createBasicLoop(config.baseLoopLength);
    this.runState.loop.positionInLoop = 0;
    this.runState.loop.difficultyMultiplier = 1.0;
    this.lastTileIndex = -1;
    this.activeBuffs = [];
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
        // 10% chance of combat
        if (this.rng() < diffConfig.basicTileCombatChance) {
          tile.defeatedThisLoop = true;
          this.state = 'tile-interaction';
          const pool = getEnemyPoolForTerrain('basic', this.runState.loop.count);
          const enemyId = pool[Math.floor(this.rng() * pool.length)];
          this.emit('combat-start', { enemyId, isBoss: false, tileIndex });
        }
        break;
      }
      case 'terrain': {
        tile.defeatedThisLoop = true;
        this.state = 'tile-interaction';
        const terrainKey = tile.terrain!;
        const pool = getEnemyPoolForTerrain(terrainKey, this.runState.loop.count);
        const enemyId = pool[Math.floor(this.rng() * pool.length)];
        this.emit('combat-start', { enemyId, isBoss: false, tileIndex, terrain: terrainKey });
        break;
      }
      case 'boss': {
        tile.defeatedThisLoop = true;
        this.state = 'tile-interaction';
        this.emit('combat-start', { enemyId: 'boss_demon', isBoss: true, tileIndex });
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

    // Award tile points: baseTilePointsPerLoop + floor(count * tilePointScalePerLoop)
    const diffConfig = getDifficultyConfig();
    this.runState.economy.tilePoints += diffConfig.baseTilePointsPerLoop + Math.floor(loop.count * diffConfig.tilePointScalePerLoop);

    // Reset defeated flags
    for (const tile of loop.tiles) {
      tile.defeatedThisLoop = false;
    }

    // Update difficulty multiplier
    loop.difficultyMultiplier = 1 + (loop.count - 1) * diffConfig.percentPerLoop;

    // Check if boss loop: inject boss at last position
    if (loop.count % diffConfig.bossEveryNLoops === 0) {
      loop.tiles[loop.length - 1] = createTileSlot('boss');
    }

    this.lastTileIndex = -1;
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
    this.state = 'traversing';
    this.emit('loop-started', { loopCount: this.runState.loop.count, buffs: this.activeBuffs });
  }

  onBossDefeated(): void {
    this.state = 'boss-choice';
    this.emit('boss-defeated', { loopCount: this.runState.loop.count });
  }

  onBossChoice(choice: 'exit' | 'continue'): RunEndResult | void {
    if (choice === 'exit') {
      this.state = 'run-ended';
      const result = resolveRunEnd(
        'safe',
        this.runState.economy.metaLoot,
        this.runState.hero?.xp ?? 0
      );
      this.emit('run-exited', result);
      return result;
    }

    // Continue: grow loop by +3 basic tiles before boss position
    const diffConfig = getDifficultyConfig();
    const newTiles: TileSlot[] = Array.from(
      { length: diffConfig.loopGrowthOnBossKill },
      () => createTileSlot('basic')
    );
    // Insert before the last position (boss position)
    const insertAt = this.runState.loop.length - 1;
    this.runState.loop.tiles.splice(insertAt, 0, ...newTiles);
    this.runState.loop.length += diffConfig.loopGrowthOnBossKill;

    this.state = 'planning';
    this.emit('planning-phase-started', { loopCount: this.runState.loop.count });
  }

  placeTile(slotIndex: number, tileKey: string): boolean {
    if (this.state !== 'planning') return false;

    const tile = this.runState.loop.tiles[slotIndex];
    if (!tile || tile.type !== 'basic') return false;

    const newTile = createTileSlot(tileKey);
    this.runState.loop.tiles[slotIndex] = newTile;
    return true;
  }
}
