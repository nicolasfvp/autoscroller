import { Scene } from 'phaser';
import { getRun, type RunState } from '../state/RunState';
import { saveManager } from '../core/SaveManager';
import { LoopRunner, TILE_SIZE, type LoopRunState } from '../systems/LoopRunner';
import { getDifficultyConfig } from '../systems/DifficultyScaler';
import { LoopHUD } from '../ui/LoopHUD';
import { LoopCelebration } from '../ui/LoopCelebration';
import { TileVisual, WorldTileVisual } from '../ui/TileVisual';
import { COLORS, LAYOUT } from '../ui/StyleConstants';
import { getSpritePrefix } from '../systems/hero/ClassRegistry';
import { AudioManager } from '../systems/AudioManager';
import { drainPendingLoot, drainPendingKills } from '../systems/PendingLoot';
import { generateTreasureLoot } from '../systems/TreasureLoot';
import { resolveInlineEvent } from '../systems/InlineEvents';
import { SeededRNG } from '../systems/SeededRNG';
import { setActiveRNG, rand } from '../systems/SharedRNG';
import { SCENE_KEYS, stopAllRunScenes } from '../state/SceneKeys';
import { dailyRunBroadcaster } from '../systems/DailyRunBroadcaster';
import { dailyRunTicker } from '../systems/DailyRunTicker';
import { DailyTickerPanel } from '../ui/DailyTickerPanel';
import { ensureNickname } from '../systems/DailySeed';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';
import { TutorialOverlay } from '../ui/TutorialOverlay';
import { saveMetaState, loadMetaState } from '../systems/MetaPersistence';

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
  private heroWalkTimer: Phaser.Time.TimerEvent | null = null;
  private hud!: LoopHUD;
  private celebration = new LoopCelebration();

  // Tile pool: globalIndex -> TileVisual
  private tilePool = new Map<number, TileVisual>();

  // World position tracking
  private worldOffset: number = 0;

  // Game speed multiplier (1x or 2x from settings)
  private gameSpeed: number = 1;
  private transitioning = false;

  // Temporary slow debuff from events
  private slowTimer: number = 0;

  // Auto-save subscription (cleared on shutdown to avoid stacked listeners)
  private autoSaveUnsubscribe?: () => void;

  // Parallax Backgrounds — two image copies per layer for seamless horizontal scroll
  private bgSkyImgs: Phaser.GameObjects.Image[] = [];
  private bgFieldImgs: Phaser.GameObjects.Image[] = [];
  private bgImgW = 0; // scaled width of one bg image copy

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

    // Reset bg arrays in case scene is restarted (new run after death)
    this.bgSkyImgs = [];
    this.bgFieldImgs = [];
    this.bgImgW = 0;

    // Explicitly create backgrounds here to ensure they are visible under the mask
    const screenW = this.cameras.main.width;
    const screenH = this.cameras.main.height;
    const bgScale = 0.334;
    const bgY     = 346.7;

    if (this.textures.exists('bg_sky')) {
      this.textures.get('bg_sky').setFilter(Phaser.Textures.FilterMode.NEAREST);
      const skySrc = this.textures.get('bg_sky').source[0];
      const skyImgW = skySrc.width * bgScale;
      for (let i = 0; i < 2; i++) {
        const img = this.add.image(skyImgW * i + skyImgW / 2, 193.9, 'bg_sky')
          .setScrollFactor(0).setDepth(-11).setScale(bgScale);
        this.bgSkyImgs.push(img);
      }
    }

    if (this.textures.exists('bg_green_field')) {
      this.textures.get('bg_green_field').setFilter(Phaser.Textures.FilterMode.NEAREST);
      const gfSrc = this.textures.get('bg_green_field').source[0];
      const imgW  = gfSrc.width * bgScale;
      this.bgImgW = imgW;
      for (let i = 0; i < 2; i++) {
        const img = this.add.image(imgW * i + imgW / 2, bgY, 'bg_green_field')
          .setScrollFactor(0).setDepth(-10).setScale(bgScale);
        this.bgFieldImgs.push(img);
      }
    } else if (this.textures.exists('bg_run')) {
      this.bgFieldImgs.push(
        this.add.image(screenW / 2, screenH / 2, 'bg_run')
          .setScrollFactor(0).setDepth(-10).setDisplaySize(screenW, screenH)
      );
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

      const camH = this.cameras.main.height;
      const camW = this.cameras.main.width;
      const edgeLine = this.add.rectangle(0, camH / 2, 2, camH, 0xe6c88a, 0.6).setDepth(1000).setScrollFactor(0);

      const maskState = { width: 0 };
      this.tweens.add({
        targets: maskState,
        width: camW,
        duration: 1500,
        ease: 'Linear',
        onUpdate: () => {
          maskGfx.clear();
          maskGfx.fillStyle(0xffffff);
          maskGfx.fillRect(0, 0, maskState.width, camH);
          edgeLine.x = maskState.width;
        },
        onComplete: () => {
          this.cameras.main.clearMask();
          maskGfx.destroy();
          edgeLine.destroy();
          this.introPlaying = false;
          // Swap chibi → normal walk spritesheet; restore the correct walk scale
          const sp = getSpritePrefix(getRun().hero.className ?? 'warrior');
          const walkAnim = `${sp}_walk`;
          const idleK = `${sp}_idle`;
          // walkFrameH captured from outer create() scope — avoids realHeight lookup failures
          this.heroSprite?.setScale(walkFrameH > 100 ? 96 / walkFrameH : 1.5);
          if (this.heroSprite && this.textures.exists(walkAnim)) {
            this.heroSprite.setTexture(walkAnim).play(walkAnim, true);
          } else if (this.heroSprite && this.textures.exists(idleK)) {
            this.heroSprite.setTexture(idleK);
            const idle2K = `${sp}_idle2`;
            if (!this.heroWalkTimer && this.textures.exists(idle2K)) {
              let frame = 0;
              this.heroWalkTimer = this.time.addEvent({
                delay: 200, loop: true,
                callback: () => { frame ^= 1; this.heroSprite?.setTexture(frame === 0 ? idleK : idle2K); },
              });
            }
          }
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

    // Hero animations (class-aware sprite keys)
    const sp = getSpritePrefix(run.hero.className ?? 'warrior');
    const walkKey = `${sp}_walk`;
    const idleKey = `${sp}_idle`;
    const attackKey = `${sp}_attack`;
    const deathKey = `${sp}_death`;
    // Only create spritesheet animations for keys that are actually spritesheets.
    // hero_idle / hero_idle2 are plain images; hero_walk is a 6-frame sheet.
    // hero_death doesn't exist (the create() guard below skips absent keys).
    for (const [key, frameRate, repeat] of [
      [walkKey,    8, -1],
      [attackKey, 10,  0],
      [deathKey,   8,  0],
    ] as [string, number, number][]) {
      if (!this.anims.exists(key) && this.textures.exists(key) && this.textures.get(key).frameTotal > 1) {
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(key, {}), frameRate, repeat });
      }
    }

    // Hero sprite — starts hidden during intro; shown after wipe completes
    const chibKey = `hero_chibi_${run.hero.className ?? 'warrior'}`;
    const initialTexture = this.textures.exists(idleKey) ? idleKey : '__DEFAULT';
    this.heroSprite = this.add.sprite(100, 420, initialTexture);
    this.heroSprite.setOrigin(0.5, 1.0);
    // Normalize hero to ~96px tall. Walk spritesheets are single-row (all frames same height
    // as the source texture). source[0].height is always the frame height for single-row sheets.
    const walkTex = this.textures.exists(walkKey) ? this.textures.get(walkKey) : null;
    const walkFrameH = walkTex && walkTex.frameTotal > 1
      ? (walkTex.source[0]?.height ?? 64)
      : 64;
    this.heroSprite.setScale(walkFrameH > 100 ? 96 / walkFrameH : 1.5);
    this.heroSprite.setDepth(50);

    // During intro use chibi pocket texture — scale to match the walk sprite's visual height.
    // source[0].height = full PNG height = frame height (single-row sheets).
    const chibTex = this.textures.exists(chibKey) ? this.textures.get(chibKey) : null;
    const chibFrameH = chibTex ? (chibTex.source[0]?.height ?? 256) : 256;
    if (this.introPlaying && this.textures.exists(chibKey)) {
      const chibAnimKey = `transition_walk_${run.hero.className ?? 'warrior'}`;
      this.heroSprite.setTexture(chibKey);
      this.heroSprite.setScale(96 / chibFrameH);
      if (this.anims.exists(chibAnimKey)) this.heroSprite.play(chibAnimKey, true);
    }

    if (this.introPlaying) {
      // Hero hidden — shown and animated in the onComplete callback
    } else if (this.anims.exists(walkKey)) {
      this.heroSprite.play(walkKey, true);
    } else {
      // Fake walk by toggling between idle frames (warrior uses plain images)
      const idle2Key = `${sp}_idle2`;
      if (this.textures.exists(idle2Key)) {
        let frame = 0;
        this.heroWalkTimer = this.time.addEvent({
          delay: 200, loop: true,
          callback: () => { frame ^= 1; this.heroSprite?.setTexture(frame === 0 ? idleKey : idle2Key); },
        });
      }
    }

    // Camera follow (push target lower on screen via offsetY)
    // Lerp set to 1 to avoid camera lagging behind the moving hero.
    // followOffset must include half-viewport-in-game-space because our camera
    // uses origin (0,0) (see main.ts), so the camera's "look at" point is the
    // top-left of the viewport, not the center. Original offset (0, 280) is
    // preserved on top: x = 0 + halfW (center hero horizontally), y = 280 + halfH
    // (keep hero ~97% down the viewport).
    const cam = this.cameras.main;
    const halfW = (cam.width / cam.zoom) / 2;
    const halfH = (cam.height / cam.zoom) / 2;
    cam.startFollow(this.heroSprite, true, 1.0, 1.0, halfW, 245 + halfH);

    // Create UI components with safety guards
    try {
      this.hud = new LoopHUD(this);
    } catch (err) {
      console.error("Loop HUD initialization failed:", err);
    }

    // Map speed slider lives in SpeedPanelScene (persistent bottom-left
    // panel). It writes run.mapSpeed directly; this scene re-reads that on
    // every update() so changes apply immediately.

    // Resume handler (return from combat/shop/etc overlay)
    this.events.on('resume', () => this.syncStateAfterTransition());
    this.events.on('wake', () => this.syncStateAfterTransition());

    // Auto-save: persist after combat ends or a loop wraps. SaveManager
    // honors MetaState.autoSave === false internally (lazy read with a
    // short cache), so SettingsScene toggles take effect without a scene
    // reload and without us caching the value here.
    this.autoSaveUnsubscribe = saveManager.setupAutoSave(() => getRun());

    // Daily Run wiring — only when this run was started in daily mode.
    // Ticker + broadcaster live at module level so they survive the
    // GameScene <-> CombatScene swap; the panel UI self-destructs on
    // scene shutdown so we don't need to hold the reference.
    if (run.mode === 'daily') {
      const nickname = ensureNickname();
      dailyRunBroadcaster.start(run.runId, nickname);
      dailyRunTicker.start();
      new DailyTickerPanel(this, { selfRunId: run.runId });
    }

    // Keyboard shortcuts: ESC opens Pause, D opens Deck, R opens Relics.
    // Guard each with !isPaused() so a held key doesn't stack overlays while
    // the previous one is mounting.
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.scene.isPaused()) {
        this.scene.pause();
        this.scene.launch(SCENE_KEYS.PAUSE);
      }
    });

    // Scripted tutorial overlay — only mounts if the director has a step
    // targeting GameScene. Also persists tutorialSeen=true when the
    // director hits the end of the script.
    TutorialOverlay.mountIfActive(this);
    if (tutorialDirector.isActive()) {
      const unsub = tutorialDirector.subscribe(() => {
        if (!tutorialDirector.isActive()) {
          // Tutorial just finished — persist the seen flag so future boots
          // skip the scripted flow. Fire-and-forget; failure isn't fatal.
          (async () => {
            try {
              const meta = await loadMetaState();
              if (!meta.tutorialSeen) {
                meta.tutorialSeen = true;
                await saveMetaState(meta);
              }
            } catch (err) {
              console.warn('[GameScene] tutorialSeen persist failed:', err);
            }
          })();
          unsub();
        }
      });
      this.events.once('shutdown', unsub);
    }

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

    for (const [, tv] of this.tilePool) tv.destroy();
    this.tilePool.clear();

    if (this.hud) this.hud.update(run);
    this.gameSpeed = run.mapSpeed ?? 1;

    if (run.loop.bossChoiceContinue) {
      run.loop.bossChoiceContinue = false;
      this.loopRunner.onBossChoice('continue');
      return;
    }

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

  update(_time: number, delta: number): void {
    if (this.transitioning || this.introPlaying) return;

    let run: RunState;
    try {
      run = getRun();
      if (!run) return;
    } catch {
      return; // Run was cleared, stop updating
    }

    // Tutorial gate: while a click-advance step targets GameScene (map-intro,
    // complete), freeze the world entirely so the hero can't autoscroll into a
    // combat tile before the player has read and dismissed the lesson. Bail
    // before ticking the loop runner AND before moving the hero so the map sits
    // completely still. CombatScene applies the same gate to its own tick, so
    // run and battle are both frozen during their respective tutorial modals.
    if (tutorialDirector.shouldPauseScene(SCENE_KEYS.GAME)) {
      return;
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

    // Parallax update — seamless horizontal wrap, no gap
    // offset = how far copy0 has shifted right from its origin (0..imgW)
    // copy0 left edge at: offset - imgW  (so at offset=0 copy0 starts at -imgW, fully off left)
    // Actually: offset is the left edge of copy0 in [0..imgW), copy1 is always copy0 - imgW
    // Both together cover [offset-imgW .. offset+imgW], screen is [0..screenW]
    const parallaxUpdate = (imgs: Phaser.GameObjects.Image[], imgW: number, factor: number) => {
      if (imgs.length < 2 || imgW <= 0) return;
      // offset: moves from 0 to imgW as hero scrolls one full image width
      const offset = ((-(heroWorldX * factor) % imgW) + imgW) % imgW;
      // overlap by 1px to prevent sub-pixel seam from texture filtering
      const x0 = Math.round(offset + imgW / 2);
      imgs[0].x = x0;
      imgs[1].x = x0 - imgW + 1;
    };
    parallaxUpdate(this.bgFieldImgs, this.bgImgW, 0.3);
    if (this.bgSkyImgs.length === 2) {
      const skyImgW = this.bgSkyImgs[0].displayWidth;
      parallaxUpdate(this.bgSkyImgs, skyImgW, 0.05);
    }


    // Update tile visuals
    this.updateTilePool();

    // Update HUD with synced RunState + loop progress
    this.syncRunState();
    const loop = this.loopRunState.loop;
    const nonBufferCount = loop.tiles.filter((t: any) => t.type !== 'buffer').length;
    const loopTotalPx = nonBufferCount * TILE_SIZE;
    const posInLoop = Math.max(0, loop.positionInLoop - (loop.tiles.length - nonBufferCount) * TILE_SIZE);
    if (this.hud) this.hud.update(run, posInLoop, loopTotalPx);
  }

  adjustBgScale(delta: number): void {
    const all = [...this.bgFieldImgs, ...this.bgSkyImgs];
    for (const img of all) {
      img.setScale(Math.max(0.05, img.scaleX + delta));
    }
    console.log('[BG] scale:', all[0]?.scaleX.toFixed(3));
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

  /** Drain pending loot — no-op, loot is shown in LoopSummaryScene. */
  private showPendingNotifications(): void { /* accumulated for LoopSummaryScene */ }

  private handleLoopEvent(event: string, data: any): void {
    switch (event) {
      case 'combat-start': {
        // Tutorial: auto-clear 'map-intro' the moment combat begins so the
        // overlay isn't fighting the scene swap for input focus.
        tutorialDirector.advanceIfMatches('map-intro');
        this.scene.pause(SCENE_KEYS.GAME);
        this.scene.launch(SCENE_KEYS.COMBAT, {
          enemyId: data.enemyId,
          isBoss: data.isBoss,
          isElite: data.isElite,
          terrain: data.terrain ?? 'basic',
          // Wave 4 wiring: forward the resolved subtile effect list for this
          // combat target. Wave 6 consumes the bag in CombatScene.init to
          // pre-apply enemy/hero stacks and arm build amplifiers.
          subtileEffects: data.subtileEffects ?? [],
        });
        break;
      }
      case 'open-scene': {
        const run = getRun();

        // Wave 3: rest tile + RestSiteScene removed. The auto-heal that used
        // to fire here now runs in ShopScene.applyLoopEndAutoHeal on shop entry.

        // ── Event: inline random effect ──
        if (data.kind === 'event') {
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
        if (data.kind === 'treasure') {
          generateTreasureLoot(run);
          this.syncEconomyToLoopState(run);
          this.showPendingNotifications();
          this.loopRunner.resumeTraversal();
          break;
        }
        break;
      }
      case 'loop-completed': {

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
          // Accumulate world offset for seamless wrap ONLY after celebration is done.
          // Use the pre-mutation length captured above so a boss-loop transition
          // (N → N+1 tiles) advances by N, not N+1.
          this.worldOffset += traversedLength * TILE_SIZE;
          // A boss loop changes the tile count (boss tile pushed/dropped), so
          // the accumulated offset is no longer a multiple of the new loop
          // length and the tile pool's modulo mapping falls out of phase —
          // the hero ends up rendered tiles away from the enemy it fights.
          // Re-snap the phase so the hero lands on data-index 0 of the new loop.
          this.alignWorldOffset();

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
            const lootItems = drainPendingLoot();
            const monstersDefeated = drainPendingKills();
            this.scene.launch(SCENE_KEYS.LOOP_SUMMARY, {
              loopRunner: this.loopRunner,
              loopRunState: this.loopRunState,
              lootItems,
              monstersDefeated,
              tpEarned,
              loopCount: data.loopCount,
            });
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
        //  - onBossChoice('continue'): includes traversedLength. Advance
        //    worldOffset and open the LoopSummary → Planning flow, same as
        //    the normal loop-completed path (boss-continue skips loop-completed
        //    so we handle the full transition here).
        if (typeof data?.traversedLength === 'number') {
          this.worldOffset += data.traversedLength * TILE_SIZE;
          // boss-continue both grows the loop and drops the boss tile, so the
          // loop length changed — re-align the offset's modulo phase (see
          // alignWorldOffset) before rebuilding the pool, or the hero renders
          // tiles away from where it actually is.
          this.alignWorldOffset();
          for (const [, tv] of this.tilePool) tv.destroy();
          this.tilePool.clear();

          const diffConfig = getDifficultyConfig();
          const tpEarned = diffConfig.baseTilePointsPerLoop + Math.floor((data.loopCount ?? 0) * diffConfig.tilePointScalePerLoop);
          const lootItems = drainPendingLoot();
          const monstersDefeated = drainPendingKills();
          this.scene.launch(SCENE_KEYS.LOOP_SUMMARY, {
            loopRunner: this.loopRunner,
            loopRunState: this.loopRunState,
            lootItems,
            monstersDefeated,
            tpEarned,
            loopCount: data.loopCount ?? this.loopRunState.loop.count,
          });
          this.scene.sleep();
        }
        break;
      }
      case 'boss-defeated': {
        this.scene.pause();
        this.scene.launch(SCENE_KEYS.BOSS_EXIT, { loopRunner: this.loopRunner, loopRunState: this.loopRunState });
        break;
      }
      case 'loop-started': {
        // Synergy buff distribution removed in Wave 2. Subtile effects are
        // computed and dispatched per-combat in Wave 4+ via a different path.
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
      const tv = new WorldTileVisual(this, worldX + TILE_SIZE / 2, 490, tileSlot, tileDataIndex);
      this.add.existing(tv);
      tv.setDepth(10);
      this.tilePool.set(gi, tv);
    }
  }

  /**
   * Snap worldOffset UP so the tile pool's modulo mapping lands the hero on
   * data-index 0 at the start of the new loop.
   *
   * updateTilePool maps a global tile index `gi` to a data index via
   * `gi % loopLength`, and the hero's global index at loop start
   * (positionInLoop === 0) is `worldOffset / TILE_SIZE`. For the hero to stand
   * on the tile whose enemy the LoopRunner actually triggers, that origin must
   * be a multiple of the *current* loop length. Same-length loops keep this
   * true for free, but a boss loop adds a tile (and boss-continue grows the
   * loop), leaving the accumulated offset off-phase — which renders the hero a
   * dozen tiles away from the enemy it's fighting. Rounding UP keeps the hero
   * moving forward only, and the jump is hidden behind the loop-summary /
   * planning gap (pool is cleared and rebuilt at that point anyway).
   */
  private alignWorldOffset(): void {
    const length = this.loopRunState.loop.length;
    if (length <= 0) return;
    const origin = Math.round(this.worldOffset / TILE_SIZE);
    const alignedOrigin = Math.ceil(origin / length) * length;
    this.worldOffset = alignedOrigin * TILE_SIZE;
  }


  private cleanup(): void {
    if (this.heroWalkTimer) {
      this.heroWalkTimer.destroy();
      this.heroWalkTimer = null;
    }
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
  }
}
