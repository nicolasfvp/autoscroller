import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { saveManager } from '../core/SaveManager';
import { LoopRunner, TILE_SIZE, type LoopRunState } from '../systems/LoopRunner';
import { getDifficultyConfig } from '../systems/DifficultyScaler';
import { LoopHUD } from '../ui/LoopHUD';
import { LoopCelebration } from '../ui/LoopCelebration';
import { TileVisual } from '../ui/TileVisual';
import { MapSpeedSlider } from '../ui/MapSpeedSlider';
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
  private speedSlider!: MapSpeedSlider;
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
    super('GameScene');
  }

  private fadeToScene(sceneKey: string, data?: any): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });
  }

  create(data?: { seed?: string; manualSeed?: boolean }): void {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

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

    // Background
    this.cameras.main.setBackgroundColor(COLORS.background);
    
    // Create Parallax Backgrounds
    if (this.textures.exists('bg_desert_sky')) {
      this.bgSky = this.add.tileSprite(400, 300, 800, 600, 'bg_desert_sky')
        .setScrollFactor(0)
        .setDepth(-11);
    }
    if (this.textures.exists('bg_desert')) {
      this.bgDesert = this.add.tileSprite(400, 300, 800, 600, 'bg_desert')
        .setScrollFactor(0)
        .setDepth(-10);
    } else if (this.textures.exists('bg_run')) {
      // Fallback
      const bgImg = this.add.image(400, 300, 'bg_run').setScrollFactor(0).setDepth(-10);
      bgImg.setDisplaySize(800, 600);
    }

    // Build LoopRunState adapter from global RunState
    // Hydrate tileInventory from RunState (Record<string,number> -> Array)
    const initialTileInventory = Object.entries(run.economy.tileInventory ?? {})
      .filter(([, count]) => count > 0)
      .map(([tileType, count]) => ({ tileType, count }));

    // Resume in-progress run iff we have meaningful loop progress AND a
    // persisted tile layout to rebuild from. Otherwise treat as a fresh run.
    const hasPersistedProgress = (run.loop.count ?? 0) > 1
      && Array.isArray(run.loop.tiles) && run.loop.tiles.length > 0;

    this.loopRunState = {
      loop: {
        count: hasPersistedProgress ? run.loop.count : 1,
        length: run.loop.tileLength || getDifficultyConfig().baseLoopLength,
        tiles: hasPersistedProgress ? [...run.loop.tiles] : [],
        positionInLoop: hasPersistedProgress ? (run.loop.positionInLoop ?? 0) : 0,
        difficultyMultiplier: hasPersistedProgress ? (run.loop.difficultyMultiplier ?? run.loop.difficulty ?? 1) : (run.loop.difficulty || 1.0),
      },
      economy: {
        gold: run.economy.gold,
        tilePoints: run.economy.tilePoints,
        materials: run.economy.materials ?? {},
      },
      tileInventory: initialTileInventory,
      hero: { xp: run.hero.runXP ?? 0 },
    };

    // Create LoopRunner with emit callback. Pass the shared seeded source so
    // tile/enemy assignment is deterministic for replays.
    this.loopRunner = new LoopRunner((event: string, data: any) => {
      this.handleLoopEvent(event, data);
    }, () => rand());
    if (hasPersistedProgress) {
      this.loopRunner.resumeRun(this.loopRunState, run.loop.bossKillCount ?? 0);
    } else {
      this.loopRunner.startRun(this.loopRunState);
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
    this.heroSprite = this.add.sprite(100, 455, idleKey); // Afunda mais para o centro do bloco (que fica em Y=450)
    this.heroSprite.setOrigin(0.5, 1.0); // Senta o pé exatamente na coordenada y inferior
    this.heroSprite.setScale(1.5); // Baixou novamente para caber proporcional às tendas
    this.heroSprite.setDepth(50);
    this.heroSprite.play(walkKey);

    // Camera follow (push target lower on screen via offsetY)
    // Lerp set to 1 to avoid camera lagging behind the moving hero
    this.cameras.main.startFollow(this.heroSprite, true, 1.0, 1.0, 0, 280);

    // HUD
    this.hud = new LoopHUD(this);

    // Map speed slider (independent of combatSpeed)
    this.speedSlider = new MapSpeedSlider(this, 400, 580, run.mapSpeed ?? 1, (speed) => {
      const r = getRun();
      r.mapSpeed = speed;
      this.gameSpeed = speed;
    });

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-D', () => {
      if (!this.scene.isPaused()) {
        this.scene.pause();
        this.scene.launch('DeckCustomizationScene');
      }
    });

    this.input.keyboard?.on('keydown-R', () => {
      if (!this.scene.isPaused()) {
        this.scene.pause();
        this.scene.launch('RelicViewerScene');
      }
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.scene.isPaused()) {
        this.scene.pause();
        this.scene.launch('PauseScene');
      }
    });

    // Resume handler (return from combat/shop/etc overlay)
    this.events.on('resume', () => {
      // Sync economy back from global RunState
      const run = getRun();
      this.loopRunState.economy.gold = run.economy.gold;
      this.loopRunState.economy.tilePoints = run.economy.tilePoints;
      // Sync materials both ways
      for (const [mat, amount] of Object.entries(run.economy.materials ?? {})) {
        this.loopRunState.economy.materials[mat] = amount;
      }
      // Refresh tileInventory from RunState so combat tile drops show up in planning.
      this.loopRunState.tileInventory = Object.entries(run.economy.tileInventory ?? {})
        .filter(([, count]) => count > 0)
        .map(([tileType, count]) => ({ tileType, count }));

      // Show pending loot notifications above hero
      if (hasPendingLoot()) {
        const items = drainPendingLoot();
        showLootNotifications(this, this.heroSprite.x, this.heroSprite.y, items);
      }

      // Flush tile pool so world tiles re-render with updated data
      for (const [, tv] of this.tilePool) {
        tv.destroy();
      }
      this.tilePool.clear();

      // Force HUD update to keep gold/HP synced after scene transitions (feedback #32)
      this.hud.update(run);

      // Re-sync map speed in case it was changed elsewhere
      if (this.speedSlider) {
        this.speedSlider.setSpeed(run.mapSpeed ?? 1);
        this.gameSpeed = run.mapSpeed ?? 1;
      }

      // If LoopRunner is in tile-interaction state, check if boss was defeated
      if (this.loopRunner.getState() === 'tile-interaction') {
        if (run.loop.lastBossDefeated) {
          run.loop.lastBossDefeated = false;
          this.loopRunner.onBossDefeated();
          // boss-defeated event handler will launch BossExitScene
        } else {
          this.loopRunner.resumeTraversal();
        }
      }
      // If planning state, launch PlanningOverlay
      if (this.loopRunner.getState() === 'planning') {
        this.scene.pause();
        this.scene.launch('PlanningOverlay', { loopRunner: this.loopRunner, loopRunState: this.loopRunState });
      }
    });

    // Auto-save: persist after combat ends or a loop wraps. SaveManager
    // honors MetaState.autoSave === false internally (lazy read with a
    // short cache), so SettingsScene toggles take effect without a scene
    // reload and without us caching the value here.
    this.autoSaveUnsubscribe = saveManager.setupAutoSave(() => getRun());

    // Cleanup
    this.events.on('shutdown', this.cleanup, this);
  }

  update(_time: number, delta: number): void {
    if (this.scene.isPaused() || this.celebrationPlaying) return;

    // Apply slow debuff — use map speed from RunState (feedback #10, #28)
    const currentRun = getRun();
    let speedMult = currentRun.mapSpeed ?? this.gameSpeed;
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
    const run = getRun();
    const loop = this.loopRunState.loop;
    const nonBufferCount = loop.tiles.filter((t: any) => t.type !== 'buffer').length;
    const loopTotalPx = nonBufferCount * TILE_SIZE;
    // positionInLoop counts world pixels since loop start; subtract buffer tiles
    const posInLoop = Math.max(0, loop.positionInLoop - (loop.tiles.length - nonBufferCount) * TILE_SIZE);
    this.hud.update(run, posInLoop, loopTotalPx);
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
        this.scene.pause();
        this.scene.launch('CombatScene', { enemyId: data.enemyId, isBoss: data.isBoss, terrain: data.terrain ?? 'basic' });
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
          this.hud.update(run);
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
            this.scene.pause();
            this.scene.launch('CombatScene', { enemyId: result.combatEnemyId, isBoss: false });
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

        // ── Shop: check toggle ──
        if (data.scene === 'ShopScene' && !run.stopAtShop) {
          this.loopRunner.resumeTraversal();
          break;
        }

        // Default: open scene (shop when enabled, or any future scenes)
        this.scene.pause();
        this.scene.launch(data.scene);
        break;
      }
      case 'loop-completed': {
        this.celebrationPlaying = true;

        // Accumulate world offset for seamless wrap
        this.worldOffset += this.loopRunState.loop.length * TILE_SIZE;

        // F.3: Don't destroy every TileVisual on every wrap. The post-wrap
        // hero position pushes the visible globalIndex range forward by a
        // full loop, so the natural range-trim in updateTilePool() drops
        // stale entries on the next update tick. Tile data may have changed
        // (defeatedThisLoop reset, boss tile add/remove) — flush any tile
        // visuals whose underlying TileSlot identity changed by re-mapping
        // their data instead of destroying.
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
        // Loop resumed after planning -- broadcast adjacency buffs to the
        // systems that consume them (combat damage, loot rolls, events,
        // rest healing, run-end XP banking). Cleared again on shutdown.
        const buffs: SynergyBuff[] = data?.buffs ?? this.loopRunner.getActiveBuffs();
        this.applyBuffsToSystems(buffs);
        break;
      }
      case 'run-exited': {
        // Transition to GameOverScene with safe exit data
        this.fadeToScene('GameOverScene', data);
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
