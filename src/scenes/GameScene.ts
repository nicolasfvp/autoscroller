import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { LoopRunner, TILE_SIZE, type LoopRunState } from '../systems/LoopRunner';
import { getDifficultyConfig } from '../systems/DifficultyScaler';
import { LoopHUD } from '../ui/LoopHUD';
import { LoopCelebration } from '../ui/LoopCelebration';
import { TileVisual } from '../ui/TileVisual';

/**
 * GameScene -- thin Phaser wrapper over LoopRunner.
 * Renders hero autoscrolling through tiles, delegates all logic to LoopRunner.
 *
 * Hero never teleports backward. Tiles cycle via modulo. worldOffset accumulates
 * on each loop wrap so the hero's visual X increases continuously.
 */
export class GameScene extends Scene {
  private loopRunner!: LoopRunner;
  private loopRunState!: LoopRunState;
  private heroSprite!: Phaser.GameObjects.Rectangle;
  private hud!: LoopHUD;
  private celebration = new LoopCelebration();

  // Tile pool: globalIndex -> TileVisual
  private tilePool = new Map<number, TileVisual>();

  // World position tracking
  private worldOffset: number = 0;
  private celebrationPlaying: boolean = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const run = getRun();

    // Background
    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Build LoopRunState adapter from global RunState
    this.loopRunState = {
      loop: {
        count: run.loop.count || 1,
        length: run.loop.tileLength || getDifficultyConfig().baseLoopLength,
        tiles: [],
        positionInLoop: 0,
        difficultyMultiplier: run.loop.difficulty || 1.0,
      },
      economy: {
        gold: run.economy.gold,
        tilePoints: run.economy.tilePoints,
        metaLoot: (run.economy as any).metaLoot ?? 0,
      },
      tileInventory: [],
      hero: { xp: run.hero.runXP ?? 0 },
    };

    // Create LoopRunner with emit callback
    this.loopRunner = new LoopRunner((event: string, data: any) => {
      this.handleLoopEvent(event, data);
    });
    this.loopRunner.startRun(this.loopRunState);

    this.worldOffset = 0;
    this.celebrationPlaying = false;

    // Hero sprite: simple colored rectangle
    this.heroSprite = this.add.rectangle(100, 410, 32, 48, 0x00aaff);
    this.heroSprite.setDepth(50);

    // Camera follow
    this.cameras.main.startFollow(this.heroSprite, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(100, 100);

    // HUD
    this.hud = new LoopHUD(this);

    // Resume handler (return from combat/shop/etc overlay)
    this.events.on('resume', () => {
      // Sync economy back from global RunState
      const run = getRun();
      this.loopRunState.economy.gold = run.economy.gold;
      this.loopRunState.economy.tilePoints = run.economy.tilePoints;

      // If LoopRunner is in tile-interaction state, resume traversal
      if (this.loopRunner.getState() === 'tile-interaction') {
        this.loopRunner.resumeTraversal();
      }
      // If planning state, launch PlanningOverlay
      if (this.loopRunner.getState() === 'planning') {
        this.scene.pause();
        this.scene.launch('PlanningOverlay', { loopRunner: this.loopRunner, loopRunState: this.loopRunState });
      }
    });

    // Cleanup
    this.events.on('shutdown', this.cleanup, this);
  }

  update(_time: number, delta: number): void {
    if (this.scene.isPaused() || this.celebrationPlaying) return;

    // Tick the loop runner
    this.loopRunner.tick(delta);

    // Update hero world position
    const heroWorldX = this.worldOffset + this.loopRunState.loop.positionInLoop;
    this.heroSprite.x = heroWorldX + 100; // +100 offset so hero starts visible

    // Update tile visuals
    this.updateTilePool();

    // Update HUD with synced RunState
    this.syncRunState();
    const run = getRun();
    this.hud.update(run);
  }

  /** Sync LoopRunState values back to global RunState */
  private syncRunState(): void {
    const run = getRun();
    run.loop.count = this.loopRunState.loop.count;
    run.loop.difficulty = this.loopRunState.loop.difficultyMultiplier;
    run.economy.gold = this.loopRunState.economy.gold;
    run.economy.tilePoints = this.loopRunState.economy.tilePoints;
    (run.economy as any).metaLoot = this.loopRunState.economy.metaLoot;
  }

  private handleLoopEvent(event: string, data: any): void {
    switch (event) {
      case 'combat-start': {
        this.scene.pause();
        this.scene.launch('CombatScene', { enemyId: data.enemyId, isBoss: data.isBoss });
        break;
      }
      case 'open-scene': {
        this.scene.pause();
        this.scene.launch(data.scene);
        break;
      }
      case 'loop-completed': {
        this.celebrationPlaying = true;

        // Accumulate world offset for seamless wrap
        this.worldOffset += this.loopRunState.loop.length * TILE_SIZE;

        // Clean up all tile visuals for fresh rendering
        for (const [, tv] of this.tilePool) {
          tv.destroy();
        }
        this.tilePool.clear();

        const diffConfig = getDifficultyConfig();
        const tpEarned = diffConfig.baseTilePointsPerLoop + Math.floor(data.loopCount * diffConfig.tilePointScalePerLoop);

        this.celebration.play(this, data.loopCount, tpEarned, () => {
          this.celebrationPlaying = false;
          // Planning phase: pause and launch overlay
          this.scene.pause();
          this.scene.launch('PlanningOverlay', { loopRunner: this.loopRunner, loopRunState: this.loopRunState });
        });
        break;
      }
      case 'planning-phase-started': {
        // Handled by loop-completed celebration callback
        break;
      }
      case 'boss-defeated': {
        this.scene.pause();
        this.scene.launch('BossExitScene', { loopRunner: this.loopRunner, loopRunState: this.loopRunState });
        break;
      }
      case 'loop-started': {
        // Loop resumed after planning -- synergy buffs active
        break;
      }
      case 'run-exited': {
        // Transition to GameOverScene with safe exit data
        this.scene.start('GameOverScene', data);
        break;
      }
    }
  }

  /** Tile pool: maintain ~30 visible TileVisuals around hero */
  private updateTilePool(): void {
    const heroWorldX = this.heroSprite.x;
    const loopLength = this.loopRunState.loop.length;
    const tiles = this.loopRunState.loop.tiles;
    if (!tiles || tiles.length === 0) return;

    // Calculate global tile index of hero
    const heroGlobalIndex = Math.floor((heroWorldX - 100) / TILE_SIZE);

    const rangeStart = heroGlobalIndex - 15;
    const rangeEnd = heroGlobalIndex + 15;

    // Remove tiles outside range
    for (const [gi, tv] of this.tilePool) {
      if (gi < rangeStart || gi > rangeEnd) {
        tv.destroy();
        this.tilePool.delete(gi);
      }
    }

    // Add tiles in range
    for (let gi = rangeStart; gi <= rangeEnd; gi++) {
      if (this.tilePool.has(gi)) continue;

      const tileDataIndex = ((gi % loopLength) + loopLength) % loopLength; // safe modulo
      const tileSlot = tiles[tileDataIndex];
      if (!tileSlot) continue;

      const worldX = gi * TILE_SIZE + 100; // +100 to match hero offset
      const tv = new TileVisual(this, worldX + TILE_SIZE / 2, 450, tileSlot, 1, tileDataIndex);
      tv.setDepth(10);
      this.tilePool.set(gi, tv);
    }
  }

  private cleanup(): void {
    for (const [, tv] of this.tilePool) {
      tv.destroy();
    }
    this.tilePool.clear();
  }
}
