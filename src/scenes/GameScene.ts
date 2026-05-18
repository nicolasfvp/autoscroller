import { Scene } from 'phaser';
import { getRun, type RunState } from '../state/RunState';
import { saveManager } from '../core/SaveManager';
import { LoopRunner, TILE_SIZE, type LoopRunState } from '../systems/LoopRunner';
import { getDifficultyConfig } from '../systems/DifficultyScaler';
import { LoopHUD } from '../ui/LoopHUD';
import { LoopCelebration } from '../ui/LoopCelebration';
import { TileVisual } from '../ui/TileVisual';
import { COLORS, LAYOUT } from '../ui/StyleConstants';
import { getSpritePrefix } from '../systems/hero/ClassRegistry';
import { AudioManager } from '../systems/AudioManager';
import { drainPendingLoot, hasPendingLoot, addPendingLoot } from '../systems/PendingLoot';
import { showLootNotifications } from '../ui/LootNotification';
import { generateTreasureLoot } from '../systems/TreasureLoot';
import { resolveInlineEvent, setActiveBuffs as setEventBuffs } from '../systems/InlineEvents';
import { SeededRNG } from '../systems/SeededRNG';
import { setActiveRNG, rand } from '../systems/SharedRNG';
import { setActiveBuffs as setCardBuffs, clearActiveBuffs as clearCardBuffs } from '../systems/combat/CardResolver';
import { setActiveBuffs as setLootBuffs } from '../systems/CombatLoot';
import { setActiveBuffs as setRestBuffs } from '../systems/RestSiteSystem';
import { setActiveBuffs as setMetaBuffs } from '../systems/MetaProgressionSystem';
import type { SynergyBuff } from '../systems/SynergyResolver';
import { SCENE_KEYS, stopAllRunScenes } from '../state/SceneKeys';

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
  private heroSprite!: Phaser.GameObjects.Sprite;
  private hud!: LoopHUD;
  private celebration = new LoopCelebration();

  // Tile pool: globalIndex -> TileVisual
  private tilePool = new Map<number, TileVisual>();

  // World position tracking
  private worldOffset: number = 0;
  private celebrationPlaying: boolean = false;

  // Game speed multiplier (1x or 2x from settings)
  private gameSpeed: number = 1;
  private transitioning = false;

  // Temporary slow debuff from events
  private slowTimer: number = 0;

  // Auto-save subscription (cleared on shutdown to avoid stacked listeners)
  private autoSaveUnsubscribe?: () => void;
  
  // Parallax Backgrounds
  private bgSky?: Phaser.GameObjects.TileSprite;
  private bgDesert?: Phaser.GameObjects.TileSprite;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  private introPlaying = false;

  create(data?: { seed?: string; manualSeed?: boolean; introSlide?: boolean }): void {
    this.transitioning = false;
    this.introPlaying = !!data?.introSlide;

    // Reset all run-related overlays to prevent leaks from previous runs
    stopAllRunScenes(this, SCENE_KEYS.GAME);

    // 1. Setup Backgrounds BEFORE mask logic
    this.cameras.main.setBackgroundColor(COLORS.background);
    
    // Explicitly create backgrounds here to ensure they are visible under the mask
    if (this.textures.exists('bg_desert_sky')) {
      this.bgSky = this.add.tileSprite(400, 300, 800, 600, 'bg_desert_sky').setScrollFactor(0).setDepth(-11);
    }
    if (this.textures.exists('bg_desert')) {
      this.bgDesert = this.add.tileSprite(400, 300, 800, 600, 'bg_desert').setScrollFactor(0).setDepth(-10);
    } else if (this.textures.exists('bg_run')) {
      this.add.image(400, 300, 'bg_run').setScrollFactor(0).setDepth(-10).setDisplaySize(800, 600);
    }

    if (this.introPlaying) {
      // Ensure GameScene is on top of RunTransitionScene
      this.scene.bringToTop();

      // Use make.graphics so it's not added to the display list, only used as a mask
      const maskGfx = this.add.graphics();
      maskGfx.setVisible(false); // CRITICAL: Do not render the mask itself
      maskGfx.setScrollFactor(0); 
      const mask = maskGfx.createGeometryMask();
      this.cameras.main.setMask(mask);

      const edgeLine = this.add.rectangle(0, 300, 2, 600, 0xe6c88a, 0.6).setDepth(1000).setScrollFactor(0);

      const maskState = { width: 0 };
      this.tweens.add({
        targets: maskState,
        width: 800,
        duration: 1500,
        ease: 'Linear',
        onUpdate: () => {
          maskGfx.clear();
          maskGfx.fillStyle(0xffffff);
          maskGfx.fillRect(0, 0, maskState.width, 600);
          edgeLine.x = maskState.width;
        },
        onComplete: () => {
          this.cameras.main.clearMask();
          maskGfx.destroy();
          edgeLine.destroy();
          this.introPlaying = false;
          // Resume hero animation
          const sp = getSpritePrefix(getRun().hero.className ?? 'warrior');
          this.heroSprite?.play(`${sp}_walk`, true);
        }
      });
    } else {
      this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);
    }

    // Transition to the main gameplay music
    AudioManager.transitionTo(this, 'walk_forward', { volume: 0.3, duration: 1500 });
    AudioManager.transitionAmbience(this, 'ambience_wind', { volume: 0.1 });

    const run = getRun();

    // Install the run's seeded RNG as the module-level SharedRNG. Source of
    // truth is run.seed; data.seed is a fallback for legacy callers that
    // started GameScene without populating run.seed first.
    const seedSource = run.seed ?? data?.seed ?? Date.now().toString(36);
    setActiveRNG(new SeededRNG(seedSource));

    // Load map speed from RunState (independent of combat speed)
    this.gameSpeed = run.mapSpeed ?? 1;

    // Build LoopRunState adapter from global RunState
    const initialTileInventory = Object.entries(run.economy.tileInventory ?? {})
      .filter(([, count]) => count > 0)
      .map(([tileType, count]) => ({ tileType, count }));

    this.loopRunState = {
      loop: {
        count: run.loop.count || 1,
        length: run.loop.tileLength || getDifficultyConfig().baseLoopLength,
        tiles: [...(run.loop.tiles || [])],
        positionInLoop: run.loop.positionInLoop || 0,
        difficultyMultiplier: run.loop.difficultyMultiplier || 1.0,
      },
      economy: {
        gold: run.economy.gold,
        tilePoints: run.economy.tilePoints,
        materials: { ...(run.economy.materials || {}) },
      },
      tileInventory: initialTileInventory,
      hero: { xp: run.hero.runXP || 0 }
    };

    this.loopRunner = new LoopRunner((event: string, data: any) => {
      this.handleLoopEvent(event, data);
    }, () => rand());
    
    // If we're starting fresh, startRun. Otherwise, resumeRun.
    if (this.loopRunState.loop.tiles.length === 0) {
      this.loopRunner.startRun(this.loopRunState);
    } else {
      this.loopRunner.resumeRun(this.loopRunState, run.loop.bossKillCount || 0);
    }

    this.worldOffset = 0;
    this.celebrationPlaying = false;

    // Hero animations (class-aware sprite keys)
    const sp = getSpritePrefix(run.hero.className ?? 'warrior');
    const walkKey = `${sp}_walk`;
    const idleKey = `${sp}_idle`;
    const attackKey = `${sp}_attack`;
    const deathKey = `${sp}_death`;
    if (!this.anims.exists(walkKey)) {
      this.anims.create({ key: walkKey, frames: this.anims.generateFrameNumbers(walkKey, {}), frameRate: 8, repeat: -1 });
      this.anims.create({ key: idleKey, frames: this.anims.generateFrameNumbers(idleKey, {}), frameRate: 4, repeat: -1 });
      this.anims.create({ key: attackKey, frames: this.anims.generateFrameNumbers(attackKey, {}), frameRate: 10, repeat: 0 });
      this.anims.create({ key: deathKey, frames: this.anims.generateFrameNumbers(deathKey, {}), frameRate: 8, repeat: 0 });
    }

    // Hero sprite
    this.heroSprite = this.add.sprite(100, 455, idleKey);
    this.heroSprite.setOrigin(0.5, 1.0);
    this.heroSprite.setScale(1.5);
    this.heroSprite.setDepth(50);
    
    // Play idle during intro, walk otherwise
    this.heroSprite.play(this.introPlaying ? idleKey : walkKey);

    // Camera follow (push target lower on screen via offsetY)
    // Lerp set to 1 to avoid camera lagging behind the moving hero
    this.cameras.main.startFollow(this.heroSprite, true, 1.0, 1.0, 0, 280);

    // Create UI components with safety guards
    try {
      this.hud = new LoopHUD(this);
    } catch (err) {
      console.error("Loop HUD initialization failed:", err);
    }

    // Map speed slider lives in SpeedPanelScene (persistent bottom-left
    // panel). It writes run.mapSpeed directly; this scene re-reads that on
    // every update() so changes apply immediately.

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-D', () => {
      if (!this.scene.isPaused()) {
        this.scene.pause();
        this.scene.launch(SCENE_KEYS.DECK_CUSTOMIZATION);
      }
    });

    this.input.keyboard?.on('keydown-R', () => {
      if (!this.scene.isPaused()) {
        this.scene.pause();
        this.scene.launch(SCENE_KEYS.RELIC_VIEWER);
      }
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.scene.isPaused()) {
        this.scene.pause();
        this.scene.launch(SCENE_KEYS.PAUSE);
      }
    });

    // Resume handler (return from combat/shop/etc overlay)
    this.events.on('resume', () => this.syncStateAfterTransition());
    this.events.on('wake', () => this.syncStateAfterTransition());

    // Auto-save: persist after combat ends or a loop wraps. SaveManager
    // honors MetaState.autoSave === false internally (lazy read with a
    // short cache), so SettingsScene toggles take effect without a scene
    // reload and without us caching the value here.
    this.autoSaveUnsubscribe = saveManager.setupAutoSave(() => getRun());

    // Initial visual setup: ensure tiles and HUD are populated immediately
    this.updateTilePool();
    
    const runInitial = getRun();
    this.syncRunState();
    
    const loopInitial = this.loopRunState.loop;
    const nonBufferInitial = loopInitial.tiles.filter((t: any) => t.type !== 'buffer').length;
    const loopTotalPxInitial = nonBufferInitial * TILE_SIZE;
    const posInLoopInitial = Math.max(0, loopInitial.positionInLoop - (loopInitial.tiles.length - nonBufferInitial) * TILE_SIZE);
    if (this.hud) this.hud.update(runInitial, posInLoopInitial, loopTotalPxInitial);

    // Cleanup
    this.events.on('shutdown', this.cleanup, this);
  }

  private syncStateAfterTransition(): void {
    const run = getRun();
    this.loopRunState.economy.gold = run.economy.gold;
    this.loopRunState.economy.tilePoints = run.economy.tilePoints;
    for (const [mat, amount] of Object.entries(run.economy.materials ?? {})) {
      this.loopRunState.economy.materials[mat] = amount;
    }
    this.loopRunState.tileInventory = Object.entries(run.economy.tileInventory ?? {})
      .filter(([, count]) => count > 0)
      .map(([tileType, count]) => ({ tileType, count }));

    if (hasPendingLoot() && !this.celebrationPlaying) {
      const items = drainPendingLoot();
      showLootNotifications(this, this.heroSprite.x, this.heroSprite.y, items);
    }

    for (const [, tv] of this.tilePool) tv.destroy();
    this.tilePool.clear();

    if (this.hud) this.hud.update(run);
    this.gameSpeed = run.mapSpeed ?? 1;

    const state = this.loopRunner.getState();
    if (state === 'tile-interaction') {
      if (run.loop.lastBossDefeated) {
        run.loop.lastBossDefeated = false;
        this.loopRunner.onBossDefeated();
      } else {
        this.loopRunner.resumeTraversal();
      }
    }
  }

  update(time: number, delta: number): void {
    if (this.transitioning || this.introPlaying) return;

    let run: RunState;
    try {
      run = getRun();
      if (!run) return;
    } catch {
      return; // Run was cleared, stop updating
    }

    // Apply slow debuff — use map speed from RunState (feedback #10, #28).
    // Background tabs force 1x: avoids time-warping when player returns after
    // long absence (browser-throttled ticks accumulate large deltas).
    const inBackground = typeof document !== 'undefined' && document.hidden;
    let speedMult = inBackground ? 1 : (run.mapSpeed ?? this.gameSpeed);
    if (this.slowTimer > 0) {
      this.slowTimer -= delta;
      speedMult *= 0.4;
    }

    // Tick the loop runner (game speed multiplier from settings)
    this.loopRunner.tick(delta * speedMult);

    // Update hero world position
    const heroWorldX = this.worldOffset + this.loopRunState.loop.positionInLoop;
    this.heroSprite.x = heroWorldX + 100; // +100 offset so hero starts visible

    // Parallax update
    if (this.bgSky) {
      this.bgSky.tilePositionX = heroWorldX * 0.1; // Slower sky
    }
    if (this.bgDesert) {
      this.bgDesert.tilePositionX = heroWorldX * 0.5; // Faster foreground
    }

    // Update tile visuals
    this.updateTilePool();

    // Update HUD with synced RunState + loop progress
    this.syncRunState();
    const loop = this.loopRunState.loop;
    const nonBufferCount = loop.tiles.filter((t: any) => t.type !== 'buffer').length;
    const loopTotalPx = nonBufferCount * TILE_SIZE;
    // positionInLoop counts world pixels since loop start; subtract buffer tiles
    const posInLoop = Math.max(0, loop.positionInLoop - (loop.tiles.length - nonBufferCount) * TILE_SIZE);
    if (this.hud) this.hud.update(run, posInLoop, loopTotalPx);
  }

  /** Sync LoopRunState values back to global RunState */
  private syncRunState(): void {
    const run = getRun();
    run.loop.count = this.loopRunState.loop.count;
    run.loop.difficulty = this.loopRunState.loop.difficultyMultiplier;
    // Persist tiles + position + bossKillCount so save/load can resume.
    run.loop.tiles = [...this.loopRunState.loop.tiles];
    run.loop.tileLength = this.loopRunState.loop.length;
    run.loop.positionInLoop = this.loopRunState.loop.positionInLoop;
    run.loop.difficultyMultiplier = this.loopRunState.loop.difficultyMultiplier;
    run.loop.bossKillCount = this.loopRunner.getBossKillCount();
    // Re-serialize tileInventory (Array -> Record). Reset and rewrite so
    // entries that were spent and dropped to count==0 are removed.
    const inv: Record<string, number> = {};
    for (const entry of this.loopRunState.tileInventory) {
      if (entry.count > 0) inv[entry.tileType] = entry.count;
    }
    run.economy.tileInventory = inv;
    run.economy.gold = this.loopRunState.economy.gold;
    run.economy.tilePoints = this.loopRunState.economy.tilePoints;
    // Sync materials from loop runner to global state
    for (const [mat, amount] of Object.entries(this.loopRunState.economy.materials)) {
      run.economy.materials[mat] = amount;
    }
  }

  /** Sync RunState economy back to LoopRunState */
  private syncEconomyToLoopState(run: ReturnType<typeof getRun>): void {
    this.loopRunState.economy.gold = run.economy.gold;
    this.loopRunState.economy.tilePoints = run.economy.tilePoints;
  }

  /** Drain pending loot and show floating notifications above hero */
  private showPendingNotifications(): void {
    if (hasPendingLoot()) {
      const items = drainPendingLoot();
      showLootNotifications(this, this.heroSprite.x, this.heroSprite.y, items);
    }
  }

  private handleLoopEvent(event: string, data: any): void {
    switch (event) {
      case 'combat-start': {
        this.scene.pause(SCENE_KEYS.GAME);
        this.scene.launch(SCENE_KEYS.COMBAT, { 
          enemyId: data.enemyId, 
          isBoss: data.isBoss, 
          terrain: data.terrain ?? 'basic' 
        });
        break;
      }
      case 'open-scene': {
        const run = getRun();

        // ── Rest: heal 30% inline ──
        if (data.scene === 'RestSiteScene') {
          const heal = Math.floor(run.hero.maxHP * 0.3);
          run.hero.currentHP = Math.min(run.hero.currentHP + heal, run.hero.maxHP);
          run.hero.currentStamina = run.hero.maxStamina;
          run.hero.currentMana = run.hero.maxMana;
          addPendingLoot([{ label: `+${heal} HP, full STA/MP (rest)`, color: '#00ff00' }]);
          this.showPendingNotifications();
          // Force immediate HUD update so HP bar reflects heal (feedback #31)
          this.syncRunState();
          if (this.hud) this.hud.update(run);
          this.loopRunner.resumeTraversal();
          break;
        }

        // ── Event: inline random effect ──
        if (data.scene === 'EventScene') {
          const result = resolveInlineEvent(run);
          this.syncEconomyToLoopState(run);
          this.showPendingNotifications();
          // If the event triggers combat, launch it
          if (result.combatEnemyId) {
            this.scene.pause(SCENE_KEYS.GAME);
            this.scene.launch(SCENE_KEYS.COMBAT, { enemyId: result.combatEnemyId, isBoss: false });
          } else {
            // Apply slow debuff if any
            if (result.slowDurationMs) {
              this.slowTimer = result.slowDurationMs;
            }
            this.loopRunner.resumeTraversal();
          }
          break;
        }

        // ── Treasure: inline loot ──
        if (data.scene === 'TreasureScene') {
          generateTreasureLoot(run);
          this.syncEconomyToLoopState(run);
          this.showPendingNotifications();
          this.loopRunner.resumeTraversal();
          break;
        }

        // Default: open scene (any future scenes)
        this.scene.launch(data.scene);
        this.scene.pause();
        break;
      }
      case 'loop-completed': {
        this.celebrationPlaying = true;

        // Snapshot the pre-mutation loop length the hero actually traversed.
        // LoopRunner has already mutated loop.length by the time this event
        // fires (boss push/splice in onLoopCompleted), so using the live
        // value would advance worldOffset by the wrong amount and desync the
        // tile pool. Fall back to current length for legacy emitters.
        const traversedLength: number = data?.traversedLength ?? this.loopRunState.loop.length;

        for (const [gi, tv] of this.tilePool) {
          const len = this.loopRunState.loop.length;
          const dataIndex = ((gi % len) + len) % len;
          const slot = this.loopRunState.loop.tiles[dataIndex];
          if (slot) tv.updateTile(slot, dataIndex);
        }

        const diffConfig = getDifficultyConfig();
        const tpEarned = diffConfig.baseTilePointsPerLoop + Math.floor(data.loopCount * diffConfig.tilePointScalePerLoop);

        this.celebration.play(this, data.loopCount, tpEarned, () => {
          this.celebrationPlaying = false;
          // Accumulate world offset for seamless wrap ONLY after celebration is done.
          // Use the pre-mutation length captured above so a boss-loop transition
          // (N → N+1 tiles) advances by N, not N+1.
          this.worldOffset += traversedLength * TILE_SIZE;

          // "Don't stop here for N" auto-skip: PlanningOverlay sets
          // run.skipLoopsRemaining; we consume one each loop, but the planning
          // phase that puts the player into a boss loop always stops.
          const run = getRun();
          const isBossLoopNext = this.loopRunState.loop.count % diffConfig.bossEveryNLoops === 0;
          const skipRemaining = run.skipLoopsRemaining ?? 0;
          if (skipRemaining > 0 && !isBossLoopNext) {
            run.skipLoopsRemaining = skipRemaining - 1;
            this.loopRunner.confirmPlanning();
          } else {
            run.skipLoopsRemaining = 0;
            this.scene.launch(SCENE_KEYS.PLANNING, { loopRunner: this.loopRunner, loopRunState: this.loopRunState });
            this.scene.sleep();
          }

          // Clear pool AFTER worldOffset advance so the re-render aligns with
          // the new hero position when GameScene wakes back up.
          for (const [, tv] of this.tilePool) tv.destroy();
          this.tilePool.clear();
        });
        break;
      }
      case 'planning-phase-started': {
        // Two emitters:
        //  - onLoopCompleted: no traversedLength payload; worldOffset is
        //    advanced by the paired 'loop-completed' callback above.
        //  - onBossChoice('continue'): includes traversedLength because no
        //    'loop-completed' fired (boss was defeated mid-loop and tiles
        //    were grown/spliced before positionInLoop reset to 0). Advance
        //    worldOffset here so the hero doesn't visually snap backward.
        if (typeof data?.traversedLength === 'number') {
          this.worldOffset += data.traversedLength * TILE_SIZE;
          for (const [, tv] of this.tilePool) tv.destroy();
          this.tilePool.clear();
        }
        break;
      }
      case 'boss-defeated': {
        this.scene.pause();
        this.scene.launch(SCENE_KEYS.BOSS_EXIT, { loopRunner: this.loopRunner, loopRunState: this.loopRunState });
        break;
      }
      case 'loop-started': {
        // Loop resumed after planning -- broadcast adjacency buffs to the
        // systems that consume them (combat damage, loot rolls, events,
        // rest healing, run-end XP banking). Cleared again on shutdown.
        const buffs: SynergyBuff[] = data?.buffs ?? this.loopRunner.getActiveBuffs();
        this.applyBuffsToSystems(buffs);
        break;
      }
      case 'run-exited': {
        // Safe exit flow is owned by BossExitScene: it banks rewards, clears
        // the run, and fades to CityHub directly. GameScene was paused when
        // BossExit launched, so no transition is needed here.
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
      this.add.existing(tv);
      tv.setDepth(10);
      this.tilePool.set(gi, tv);
    }
  }


  private applyBuffsToSystems(buffs: SynergyBuff[]): void {
    setCardBuffs(buffs);
    setLootBuffs(buffs);
    setEventBuffs(buffs);
    setRestBuffs(buffs);
    setMetaBuffs(buffs);
  }

  private cleanup(): void {
    if (this.autoSaveUnsubscribe) {
      this.autoSaveUnsubscribe();
      this.autoSaveUnsubscribe = undefined;
    }
    for (const [, tv] of this.tilePool) {
      tv.destroy();
    }
    this.tilePool.clear();
    // Drop the module-level RNG so it can't bleed into the next run / a
    // standalone scene that opens after game shutdown.
    setActiveRNG(null);
    // Clear adjacency buffs so they don't survive into a next run/scene.
    clearCardBuffs();
    setLootBuffs([]);
    setEventBuffs([]);
    setRestBuffs([]);
    setMetaBuffs([]);
  }
}
