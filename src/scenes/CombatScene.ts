// CombatScene -- thin wrapper that creates CombatEngine, subscribes to events,
// renders via CardQueueDisplay, CombatHUD, and SynergyFlash components.

import { Scene } from 'phaser';
import { eventBus, type GameEvents } from '../core/EventBus';
import { getRun } from '../state/RunState';
import { getEnemyById, getCardById } from '../data/DataLoader';
import { keywordIntro } from '../systems/keywordIntro/KeywordIntroService';
import { formatCardDescription } from '../systems/cards/CardText';
import { createCombatState, type CombatState } from '../systems/combat/CombatState';
import { CombatEngine } from '../systems/combat/CombatEngine';
import type { SubtileEffect } from '../systems/SubtileResolver';
import { CombatHUD } from '../ui/CombatHUD';
import { CardQueueDisplay } from '../ui/CardQueueDisplay';
import { setLiveStats, clearLiveStats } from '../ui/CardDynamic';
import { readStat } from '../systems/hero/HeroStatsResolver';
import { showSynergyFlash } from '../ui/SynergyFlash';
import { CombatEffects } from '../effects/CombatEffects';
import { earnXP, getXPForEnemy, loseAllRunXP } from '../systems/hero/XPSystem';
import { scaleEnemyForLoop } from '../systems/DifficultyScaler';
import { COLORS, LAYOUT } from '../ui/StyleConstants';
import { getSpritePrefix } from '../systems/hero/ClassRegistry';
import { generateAndApplyCombatLoot } from '../systems/CombatLoot';
import { AudioManager } from '../systems/AudioManager';
import { SCENE_KEYS } from '../state/SceneKeys';
import { dailyRunTicker } from '../systems/DailyRunTicker';
import { DailyTickerPanel } from '../ui/DailyTickerPanel';
import { addGlossaryButton } from '../ui/GlossaryButton';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';
import { TutorialOverlay } from '../ui/TutorialOverlay';

export class CombatScene extends Scene {
  private engine!: CombatEngine;
  private hud!: CombatHUD;
  private cardQueue!: CardQueueDisplay;
  private combatEffects!: CombatEffects;

  // Visual representations
  private heroSprite!: Phaser.GameObjects.Sprite;
  private enemySprite!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private enemyTextureKey = '';

  private gameSpeed: number = 1;
  private enemyIdleTimer: Phaser.Time.TimerEvent | null = null;
  private initData!: { enemyId: string; isBoss?: boolean; isElite?: boolean; terrain?: string; subtileEffects?: SubtileEffect[] };

  private onCardPlayed = (data: GameEvents['combat:card-played']) => {
    if (this.cardQueue) this.cardQueue.onCardPlayed(0);
    // Contextual keyword teaching: if this card introduces a keyword the
    // player hasn't learned, the intro service queues an overlay that
    // pauses combat until dismissed. Combine the static description with
    // the dynamic CardText render so engine-generated keyword tokens
    // (Burn N, Scales STR, Vengeance) trigger the same first-encounter
    // pause as author-written ones.
    const cardDef = getCardById(data.cardId);
    if (cardDef) {
      const rendered = formatCardDescription({
        effects: cardDef.effects,
        exhaust: cardDef.exhaust,
        spend_armor: cardDef.spend_armor,
      });
      const fullText = `${cardDef.description ?? ''} ${rendered}`.trim();
      keywordIntro.handleCardPlayed(this, fullText);
    }
    if (data.damage > 0) {
      AudioManager.playSFX(this, data.cardId.toLowerCase().includes('fireball') ? 'sfx_fireball' : 'sfx_slash', 0.4);
      const sp = getSpritePrefix(getRun().hero.className ?? 'warrior');
      const heroAttackKey = `${sp}_attack`;
      const heroIdleKey = `${sp}_idle`;
      if (this.anims.exists(heroAttackKey)) {
        this.heroSprite.play(heroAttackKey);
        this.heroSprite.once('animationcomplete', () => { if (this.heroSprite && this.anims.exists(heroIdleKey)) this.heroSprite.play(heroIdleKey); });
      }
      if (this.combatEffects) this.combatEffects.floatingNumber(600, 320, data.damage, '#ffffff', '-');
      if (this.enemySprite instanceof Phaser.GameObjects.Sprite || this.enemySprite instanceof Phaser.GameObjects.Image) {
        this.enemySprite.setTintFill(0xffffff);
        this.time.delayedCall(100, () => { if (this.enemySprite instanceof Phaser.GameObjects.Sprite || this.enemySprite instanceof Phaser.GameObjects.Image) this.enemySprite.clearTint(); });
      }
    }
    this.time.delayedCall(350, () => { if (this.engine && !this.engine.isComplete()) this.cardQueue?.update(this.engine.getState(), this.engine.getDeckPointer()); });
  };

  private onSynergyTriggered = (e: GameEvents['combat:synergy-triggered']) => showSynergyFlash(this, e.bonus.type, e.bonus.value, e.displayName);

  private onCardSkipped = () => this.cardQueue?.onCardSkipped(0);

  private onDeckReshuffled = () => this.cardQueue?.onDeckReshuffled();

  private onEnemyAttack = (data: GameEvents['combat:enemy-attack']) => {
    if (data.damage > 0) AudioManager.playSFX(this, 'sfx_hurt', 0.6);
    if (this.combatEffects) { this.combatEffects.floatingNumber(200, 320, data.damage, '#ff0000', '-'); this.combatEffects.screenShake(3, 150); }
    this.heroSprite.setTint(0xff0000);
    this.time.delayedCall(300, () => { if (this.heroSprite) this.heroSprite.clearTint(); });
    // Enemy no longer plays an attack animation
    // Just a small visual jump toward the player if it's an image/sprite
    if ((this.enemySprite instanceof Phaser.GameObjects.Sprite || this.enemySprite instanceof Phaser.GameObjects.Image)) {
      this.tweens.add({
        targets: this.enemySprite,
        x: '-=20',
        yoyo: true,
        duration: 100
      });
    }
  };

  private onCombatEnd = (eventData: GameEvents['combat:end']) => {
    // Tutorial: combat-intro auto-advances on victory so the player isn't
    // stuck staring at a "read this" panel after winning. KeywordIntroService
    // handles the keyword teaching itself.
    if (tutorialDirector.isActive() && eventData.result === 'victory') {
      tutorialDirector.advanceIfMatches('combat-intro');
    }
    const currentRun = getRun();
    currentRun.isInCombat = false;
    const finalState = this.engine.getState();
    currentRun.hero.currentHP = Math.max(0, finalState.heroHP);
    currentRun.hero.currentStamina = finalState.heroStamina;
    currentRun.hero.currentMana = finalState.heroMana;

    const sp = getSpritePrefix(currentRun.hero.className ?? 'warrior');
    const heroDeathKey = `${sp}_death`;

    if (eventData.result === 'victory') {
      if ((this.enemySprite instanceof Phaser.GameObjects.Sprite || this.enemySprite instanceof Phaser.GameObjects.Image)) {
        this.tweens.add({
          targets: this.enemySprite,
          alpha: 0,
          duration: 500
        });
      }
    } else {
      if (this.anims.exists(heroDeathKey)) this.heroSprite.play(heroDeathKey);
    }

    const resultText = eventData.result === 'victory' ? 'VICTORY' : 'DEFEAT';
    const resultColor = eventData.result === 'victory' ? COLORS.accent : COLORS.danger;
    const displayText = this.add.text(400, 300, resultText, {
      fontSize: '56px', fontFamily: '"Impact", "Arial Black", sans-serif', fontStyle: 'bold',
      color: resultColor, stroke: '#000000', strokeThickness: 6, shadow: { offsetX: 3, offsetY: 3, color: '#000000', fill: true }
    }).setOrigin(0.5).setDepth(600);

    this.time.delayedCall(1000, () => {
      if (displayText) displayText.destroy();
      const enemyDef = getEnemyById(this.initData.enemyId);
      if (!enemyDef) return;

      if (eventData.result === 'victory') {
        const scaled = scaleEnemyForLoop(
          enemyDef,
          currentRun.loop.count,
          enemyDef.type === 'boss',
          currentRun.loop.difficultyMultiplier,
        );
        const xpEarned = getXPForEnemy(this.initData?.isElite && enemyDef.type !== 'boss' ? 'elite' : enemyDef.type);
        earnXP(currentRun, xpEarned);
        if (enemyDef.type === 'boss') {
          currentRun.loop.lastBossDefeated = true;
          currentRun.loop.bossesDefeated = (currentRun.loop.bossesDefeated ?? 0) + 1;
        }
        // C2 relics: kill-bonus relics queued gold onto CombatState; add it to
        // the base reward so it flows through normal loot processing (which
        // also pipes the right notification).
        const goldBonus = finalState.pendingGoldBonus ?? 0;
        generateAndApplyCombatLoot(currentRun, enemyDef.name, enemyDef.id, enemyDef.type, this.initData.terrain ?? 'basic', scaled.goldReward + goldBonus, xpEarned);
        this.scene.stop();
        this.scene.resume(SCENE_KEYS.GAME);
      } else {
        loseAllRunXP(currentRun);
        this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(SCENE_KEYS.DEATH, { enemyName: enemyDef.name, stats: this.engine.getStats() }));
      }
    });
  };

  constructor() {
    super(SCENE_KEYS.COMBAT);
  }

  init(data: { enemyId: string; isBoss?: boolean; isElite?: boolean; terrain?: string; subtileEffects?: SubtileEffect[] }): void {
    this.initData = data;
  }


  /**
   * Apply pre-fight subtile effects to the freshly-built CombatState.
   * Runs once before the engine starts, mutating the state in place.
   *
   * Pre-fight stack init  : ambush / magma_burst / mana_well / tactical
   * Build amplifiers (Wave 8 fields): burn_altar / bleed_totem / resonance
   * War Horn is consumed upstream in LoopRunner.getCombatSpawnChance.
   */
  private applySubtileEffects(state: CombatState, effects: SubtileEffect[]): void {
    for (const e of effects) {
      const n = e.stacks;
      switch (e.effect) {
        case 'ambush':
          state.slowStacks += 2 * n;
          state.bleedStacks += 3 * n;
          break;
        case 'magma_burst':
          state.burnStacks += 5 * n;
          break;
        case 'mana_well':
          state.heroMana += 2 * n;
          break;
        case 'tactical':
          // "Free defense card pre-played" — model as +5 armor per stack
          // at fight start, mirroring a basic defense card's payout.
          state.heroDefense += 5 * n;
          break;
        case 'burn_altar':
          state.subtileBurnApplyBonus += n;
          break;
        case 'bleed_totem':
          state.subtileBleedTickBonus += n;
          break;
        case 'resonance':
          state.subtileSpellDamageMult += 0.15 * n;
          break;
        // war_horn handled upstream in LoopRunner.
        default:
          break;
      }
    }
  }

  create(): void {
    this.cleanup();
    const data = this.initData;
    if (!data || !data.enemyId) {
       this.scene.stop();
       this.scene.resume(SCENE_KEYS.GAME);
       return;
    }
    this.scene.bringToTop();
    this.cameras.main.setBackgroundColor(0x000000);
    // Hydrate the seen-keywords set from MetaState. Fire-and-forget — by the
    // time the first card resolves (≥ first card cooldown), IDB will have
    // returned and the intro service can gate appropriately. If the player
    // somehow plays a card before init finishes, the service silently skips
    // (returns no-op) and the keyword stays unseen for next time.
    void keywordIntro.init();

    try {
      const run = getRun();
      run.isInCombat = true;

      try {
        AudioManager.stopAmbience(this, 500);
      } catch (e) { console.warn("Audio stop failed", e); }

      this.gameSpeed = run.combatSpeed ?? 1;
      this.cameras.main.setBackgroundColor(COLORS.background);
      this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

      const terrain = data.terrain ?? 'basic';
      const battleBgKey = `bg_battle_${terrain}`;
      if (this.textures.exists(battleBgKey)) {
        this.add.image(400, 300, battleBgKey).setDisplaySize(800, 600).setDepth(0);
      }

      const enemyDef = getEnemyById(data.enemyId);
      if (!enemyDef) {
        run.isInCombat = false;
        this.scene.stop();
        this.scene.resume(SCENE_KEYS.GAME);
        return;
      }

      const scaled = scaleEnemyForLoop(
        enemyDef,
        run.loop.count,
        enemyDef.type === 'boss',
        run.loop.difficultyMultiplier,
      );
      // Elite premium: tougher, hits harder, renamed + retyped so it grants
      // elite XP and reads as "Elite <name>" in the HUD.
      const elite = !!data.isElite && enemyDef.type !== 'boss';
      const scaledEnemy = {
        ...enemyDef,
        type: elite ? 'elite' : enemyDef.type,
        name: elite ? `Elite ${enemyDef.name}` : enemyDef.name,
        baseHP: elite ? Math.round(scaled.hp * 1.6) : scaled.hp,
        baseDefense: scaled.defense,
        attack: { ...enemyDef.attack, damage: elite ? Math.round(scaled.damage * 1.3) : scaled.damage },
      };

      const combatState = createCombatState(run, scaledEnemy);
      // Wave 6: apply pre-fight subtile effects before the engine takes over.
      this.applySubtileEffects(combatState, data.subtileEffects ?? []);
      this.engine = new CombatEngine(combatState);
      // Seed card headline numbers with the fight's starting stats so the
      // initial queue renders correct values before the first tick.
      this.pushLiveStats();

      const sp = getSpritePrefix(run.hero.className ?? 'warrior');
      const heroIdleKey = `${sp}_idle`;
      const heroAttackKey = `${sp}_attack`;

      if (this.textures.exists(heroIdleKey)) {
        const idleFrameCount = this.textures.get(heroIdleKey).frameTotal - 1;
        const idleIsSpritesheet = idleFrameCount > 1;
        this.heroSprite = this.add.sprite(200, 330, heroIdleKey).setDepth(10).setScale(idleIsSpritesheet ? 0.495 : 0.7);
        this.add.ellipse(200, 472, 110, 22, 0x000000, 0.35).setDepth(9);

        const idle2Key = `${sp}_idle2`;
        const hasIdle2 = this.textures.exists(idle2Key);
        let idleFrame = 0;
        let isAttacking = false;

        if (idleIsSpritesheet) {
          const idleAnimKey = `${heroIdleKey}_loop`;
          if (!this.anims.exists(idleAnimKey)) {
            this.anims.create({
              key: idleAnimKey,
              frames: this.anims.generateFrameNumbers(heroIdleKey, { start: 0, end: idleFrameCount - 1 }),
              frameRate: 8,
              repeat: -1,
            });
          }
          this.heroSprite.play(idleAnimKey);
        } else {
          this.time.addEvent({
            delay: 250, loop: true,
            callback: () => {
              if (!this.heroSprite || isAttacking || !hasIdle2) return;
              idleFrame = 1 - idleFrame;
              this.heroSprite.setTexture(idleFrame === 0 ? heroIdleKey : idle2Key);
            },
          });
        }

        const playAttackAnimation = () => {
          if (!this.heroSprite || isAttacking) return;
          isAttacking = true;
          if (this.textures.exists(heroAttackKey) && !this.anims.exists(heroAttackKey)) {
            const attackFrameCount = this.textures.get(heroAttackKey).frameTotal - 1;
            if (attackFrameCount > 0) {
              this.anims.create({
                key: heroAttackKey,
                frames: this.anims.generateFrameNumbers(heroAttackKey, { start: 0, end: attackFrameCount - 1 }),
                frameRate: 12,
                repeat: 0,
              });
            }
          }
          if (this.anims.exists(heroAttackKey)) {
            if (idleIsSpritesheet) {
              this.heroSprite.setX(this.heroSprite.x + 18);
              this.heroSprite.setY(this.heroSprite.y + 8);
              this.heroSprite.setScale(this.heroSprite.scaleX * (268 / 278));
            }
            this.heroSprite.play(heroAttackKey);
            this.heroSprite.once('animationcomplete', () => {
              isAttacking = false;
              if (!this.heroSprite) return;
              if (idleIsSpritesheet) {
                this.heroSprite.setX(this.heroSprite.x - 18);
                this.heroSprite.setY(this.heroSprite.y - 8);
                this.heroSprite.setScale(0.495);
                this.heroSprite.play(`${heroIdleKey}_loop`);
              } else {
                this.heroSprite.setTexture(idleFrame === 0 ? heroIdleKey : idle2Key);
              }
            });
          } else {
            isAttacking = false;
          }
        };

        const origOnCardPlayed = this.onCardPlayed;
        this.onCardPlayed = (data: GameEvents['combat:card-played']) => {
          if (this.cardQueue) this.cardQueue.onCardPlayed(0);
          const cardDef = getCardById(data.cardId);
          if (cardDef) {
            const rendered = formatCardDescription({
              effects: cardDef.effects,
              exhaust: cardDef.exhaust,
              spend_armor: cardDef.spend_armor,
            });
            const fullText = `${cardDef.description ?? ''} ${rendered}`.trim();
            keywordIntro.handleCardPlayed(this, fullText);
          }
          playAttackAnimation();
          if (data.damage > 0) {
            AudioManager.playSFX(this, data.cardId.toLowerCase().includes('fireball') ? 'sfx_fireball' : 'sfx_slash', 0.4);
            if (this.combatEffects) this.combatEffects.floatingNumber(600, 320, data.damage, '#ffffff', '-');
            if (this.enemySprite instanceof Phaser.GameObjects.Sprite || this.enemySprite instanceof Phaser.GameObjects.Image) {
              this.enemySprite.setTintFill(0xffffff);
              this.time.delayedCall(100, () => { if (this.enemySprite instanceof Phaser.GameObjects.Sprite || this.enemySprite instanceof Phaser.GameObjects.Image) this.enemySprite.clearTint(); });
            }
          }
          this.time.delayedCall(350, () => { if (this.engine && !this.engine.isComplete()) this.cardQueue?.update(this.engine.getState(), this.engine.getDeckPointer()); });
        };
        eventBus.off('combat:card-played', origOnCardPlayed);
        eventBus.on('combat:card-played', this.onCardPlayed);
      } else {
        this.heroSprite = this.add.sprite(300, 340, 'knight_idle').setDisplaySize(250, 250).setDepth(10);
      }
      
      // Phase 9 (CR-01 fix): monster texture keys namespaced `monster_*` to
      // avoid colliding with hero spritesheets (enemy 'mage' vs hero Mage).
      // Source rename in Preloader.ts; render sites here + TileVisual.ts.
      this.enemyTextureKey = `monster_${enemyDef.id}`;

      if (this.textures.exists(this.enemyTextureKey)) {
        this.enemySprite = this.add.image(600, 340, this.enemyTextureKey).setDepth(10).setDisplaySize(250, 250);
        this.add.ellipse(600, 472, 110, 22, 0x000000, 0.35).setDepth(9);
        const key2 = `${this.enemyTextureKey}_2`;
        if (this.textures.exists(key2)) {
          let frame = 0;
          this.enemyIdleTimer = this.time.addEvent({
            delay: 500, loop: true,
            callback: () => {
              if (this.enemySprite instanceof Phaser.GameObjects.Image) {
                frame = 1 - frame;
                this.enemySprite.setTexture(frame === 0 ? this.enemyTextureKey : key2);
              }
            },
          });
        }
      } else {
        this.enemySprite = this.add.rectangle(600, 350, 64, 64, enemyDef.color ?? 0xff0000).setDepth(10);
      }

      this.hud = new CombatHUD(this);
      this.cardQueue = new CardQueueDisplay(this);
      this.combatEffects = new CombatEffects(this);
      // Initialize HUD and Queue with initial state
      this.hud.update(this.engine.getState(), this.engine.getHeroCooldownTimer(), this.engine.getHeroMaxCooldown());
      this.cardQueue.update(this.engine.getState(), this.engine.getDeckPointer());

      // Keyword glossary "?" — top-right corner. Depth above HUD so it stays
      // tappable when the HUD overlays the upper-right area.
      addGlossaryButton(this, 775, 20, 600);
      // Speed slider lives in the persistent SpeedPanelScene; it writes to
      // run.combatSpeed directly so this scene's `gameSpeed` is re-read each
      // tick (see update()) rather than wired through a per-scene slider.

      eventBus.on('combat:card-played', this.onCardPlayed);
      eventBus.on('combat:synergy-triggered', this.onSynergyTriggered);
      eventBus.on('combat:card-skipped', this.onCardSkipped);
      eventBus.on('combat:deck-reshuffled', this.onDeckReshuffled);
      eventBus.on('combat:enemy-attack', this.onEnemyAttack);
      eventBus.on('combat:end', this.onCombatEnd);

      // Daily Run ticker overlay — visible during combat too so the player
      // can see other racers tick up while they're fighting. Panel
      // self-destructs on scene shutdown via Phaser events.
      if (run.mode === 'daily') {
        dailyRunTicker.start();
        new DailyTickerPanel(this, { selfRunId: run.runId });
      }

      // Scripted tutorial overlay (combat-intro / combat-keyword steps).
      // Both are 'click' advance so they show a centered modal with Next;
      // auto-advance fires on combat victory if the player hasn't clicked.
      TutorialOverlay.mountIfActive(this);

      this.events.on('shutdown', this.cleanup, this);
    } catch (err) {
      console.error('[CombatScene] Critical error in create():', err);
      const run = getRun(); run.isInCombat = false;
      this.scene.stop(); this.scene.resume(SCENE_KEYS.GAME);
    }
  }

  update(_time: number, delta: number): void {
    if (this.engine && !this.engine.isComplete()) {
      // Pause the simulation while a contextual keyword-intro overlay OR
      // a click-advance tutorial modal is up. Same gating pattern: hold the
      // engine so the enemy doesn't kill the player while they're reading.
      if (keywordIntro.isPaused() || tutorialDirector.shouldPauseScene(SCENE_KEYS.COMBAT)) {
        if (this.hud) this.hud.update(this.engine.getState(), this.engine.getHeroCooldownTimer(), this.engine.getHeroMaxCooldown());
        return;
      }
      // Re-read combatSpeed every tick: the persistent SpeedPanelScene writes
      // to run.combatSpeed without notifying us, so polling is the contract.
      try { this.gameSpeed = getRun().combatSpeed ?? this.gameSpeed; } catch { /* run cleared */ }
      // Background tabs force 1x: avoids time-warping when player returns after
      // long absence (browser-throttled ticks accumulate large deltas).
      const inBackground = typeof document !== 'undefined' && document.hidden;
      const speed = inBackground ? 1 : this.gameSpeed;
      this.engine.tick(delta * speed);
      if (this.hud) this.hud.update(this.engine.getState(), this.engine.getHeroCooldownTimer(), this.engine.getHeroMaxCooldown());
      // Feed live effective stats so card headline numbers track status changes
      // (buffs, auras, stat_gain) in real time.
      this.pushLiveStats();
    }
  }

  /** Push the hero's current effective stats to CardDynamic so every visible
   *  card face refreshes its headline number. Reads the same stat values the
   *  resolver scales with (base + auras + per-combat stat gains). */
  private pushLiveStats(): void {
    if (!this.engine) return;
    const s = this.engine.getState();
    setLiveStats({
      str: readStat(s, 'str'),
      vit: readStat(s, 'vit'),
      dex: readStat(s, 'dex'),
      int: readStat(s, 'int'),
      spi: readStat(s, 'spi'),
    });
  }

  private cleanup(): void {
    eventBus.off('combat:card-played', this.onCardPlayed);
    eventBus.off('combat:synergy-triggered', this.onSynergyTriggered);
    eventBus.off('combat:card-skipped', this.onCardSkipped);
    eventBus.off('combat:deck-reshuffled', this.onDeckReshuffled);
    eventBus.off('combat:enemy-attack', this.onEnemyAttack);
    eventBus.off('combat:end', this.onCombatEnd);
    if (this.enemyIdleTimer) { this.enemyIdleTimer.destroy(); this.enemyIdleTimer = null; }
    if (this.hud) this.hud.destroy();
    if (this.cardQueue) this.cardQueue.destroy();
    // Out of combat, card headline numbers fall back to the run's resolved stats.
    clearLiveStats();
    try { const run = getRun(); run.isInCombat = false; } catch {}
  }
}
