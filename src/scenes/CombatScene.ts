// CombatScene -- thin wrapper that creates CombatEngine, subscribes to events,
// renders via CardQueueDisplay, CombatHUD, and SynergyFlash components.

import { Scene } from 'phaser';
import { eventBus, type GameEvents } from '../core/EventBus';
import { getRun } from '../state/RunState';
import { getEnemyById } from '../data/DataLoader';
import { createCombatState } from '../systems/combat/CombatState';
import { CombatEngine } from '../systems/combat/CombatEngine';
import { CombatHUD } from '../ui/CombatHUD';
import { CardQueueDisplay } from '../ui/CardQueueDisplay';
import { showSynergyFlash } from '../ui/SynergyFlash';
import { CombatEffects } from '../effects/CombatEffects';
import { earnXP, getXPForEnemy, loseAllRunXP } from '../systems/hero/XPSystem';
import { scaleEnemyForLoop } from '../systems/DifficultyScaler';
import { COLORS, LAYOUT } from '../ui/StyleConstants';
import { getSpritePrefix } from '../systems/hero/ClassRegistry';
import { generateAndApplyCombatLoot } from '../systems/CombatLoot';
import { AudioManager } from '../systems/AudioManager';
import { SCENE_KEYS } from '../state/SceneKeys';

export class CombatScene extends Scene {
  private engine!: CombatEngine;
  private hud!: CombatHUD;
  private cardQueue!: CardQueueDisplay;
  private combatEffects!: CombatEffects;

  // Visual representations
  private heroSprite!: Phaser.GameObjects.Sprite;
  private enemySprite!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  private enemyTextureKey = '';

  private gameSpeed: number = 1;
  private transitioning = false;
  private initData!: { enemyId: string; isBoss?: boolean; terrain?: string };

  private onCardPlayed = (data: GameEvents['combat:card-played']) => {
    if (this.cardQueue) this.cardQueue.onCardPlayed(0);
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
        this.time.delayedCall(100, () => { if (this.enemySprite) this.enemySprite.clearTint(); });
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
        const xpEarned = getXPForEnemy(enemyDef.type);
        earnXP(currentRun, xpEarned);
        if (enemyDef.type === 'boss') {
          currentRun.loop.lastBossDefeated = true;
          currentRun.loop.bossesDefeated = (currentRun.loop.bossesDefeated ?? 0) + 1;
        }
        generateAndApplyCombatLoot(currentRun, enemyDef.name, enemyDef.id, enemyDef.type, this.initData.terrain ?? 'basic', scaled.goldReward, xpEarned);
        this.scene.stop();
        this.scene.resume(SCENE_KEYS.GAME);
      } else {
        loseAllRunXP(currentRun);
        this.transitioning = true;
        this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(SCENE_KEYS.DEATH, { enemyName: enemyDef.name, stats: this.engine.getStats() }));
      }
    });
  };

  constructor() {
    super(SCENE_KEYS.COMBAT);
  }
 
  init(data: { enemyId: string; isBoss?: boolean; terrain?: string }): void {
    this.initData = data;
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
    this.transitioning = false;
    this.cameras.main.setBackgroundColor(0x000000);

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
      const scaledEnemy = {
        ...enemyDef,
        baseHP: scaled.hp,
        baseDefense: scaled.defense,
        attack: { ...enemyDef.attack, damage: scaled.damage },
      };

      const combatState = createCombatState(run, scaledEnemy);
      this.engine = new CombatEngine(combatState);

      const sp = getSpritePrefix(run.hero.className ?? 'warrior');
      const heroIdleKey = `${sp}_idle`;
      const heroAttackKey = `${sp}_attack`;
      const heroDeathKey = `${sp}_death`;
      
      if (this.textures.exists(heroIdleKey)) {
        if (!this.anims.exists(heroIdleKey)) this.anims.create({ key: heroIdleKey, frames: this.anims.generateFrameNumbers(heroIdleKey, {}), frameRate: 4, repeat: -1 });
        if (!this.anims.exists(heroAttackKey)) this.anims.create({ key: heroAttackKey, frames: this.anims.generateFrameNumbers(heroAttackKey, {}), frameRate: 10, repeat: 0 });
        if (!this.anims.exists(heroDeathKey)) this.anims.create({ key: heroDeathKey, frames: this.anims.generateFrameNumbers(heroDeathKey, {}), frameRate: 8, repeat: 0 });
        this.heroSprite = this.add.sprite(200, 350, heroIdleKey).setDepth(10).setScale(4);
        this.heroSprite.play(heroIdleKey);
      } else {
        this.heroSprite = this.add.sprite(200, 350, 'knight_idle').setDisplaySize(128, 128).setDepth(10);
      }
      
      // Phase 9 (CR-01 fix): monster texture keys namespaced `monster_*` to
      // avoid colliding with hero spritesheets (enemy 'mage' vs hero Mage).
      // Source rename in Preloader.ts; render sites here + TileVisual.ts.
      this.enemyTextureKey = `monster_${enemyDef.id}`;

      if (this.textures.exists(this.enemyTextureKey)) {
        this.enemySprite = this.add.image(600, 350, this.enemyTextureKey).setDepth(10).setScale(4);
      } else {
        this.enemySprite = this.add.rectangle(600, 350, 64, 64, enemyDef.color ?? 0xff0000).setDepth(10);
      }

      this.hud = new CombatHUD(this);
      this.cardQueue = new CardQueueDisplay(this);
      this.combatEffects = new CombatEffects(this);
      // Speed slider lives in the persistent SpeedPanelScene; it writes to
      // run.combatSpeed directly so this scene's `gameSpeed` is re-read each
      // tick (see update()) rather than wired through a per-scene slider.

      eventBus.on('combat:card-played', this.onCardPlayed);
      eventBus.on('combat:synergy-triggered', this.onSynergyTriggered);
      eventBus.on('combat:card-skipped', this.onCardSkipped);
      eventBus.on('combat:deck-reshuffled', this.onDeckReshuffled);
      eventBus.on('combat:enemy-attack', this.onEnemyAttack);
      eventBus.on('combat:end', this.onCombatEnd);

      this.events.on('shutdown', this.cleanup, this);
    } catch (err) {
      console.error('[CombatScene] Critical error in create():', err);
      const run = getRun(); run.isInCombat = false;
      this.scene.stop(); this.scene.resume(SCENE_KEYS.GAME);
    }
  }

  update(_time: number, delta: number): void {
    if (this.engine && !this.engine.isComplete()) {
      // Re-read combatSpeed every tick: the persistent SpeedPanelScene writes
      // to run.combatSpeed without notifying us, so polling is the contract.
      try { this.gameSpeed = getRun().combatSpeed ?? this.gameSpeed; } catch { /* run cleared */ }
      // Background tabs force 1x: avoids time-warping when player returns after
      // long absence (browser-throttled ticks accumulate large deltas).
      const inBackground = typeof document !== 'undefined' && document.hidden;
      const speed = inBackground ? 1 : this.gameSpeed;
      this.engine.tick(delta * speed);
      if (this.hud) this.hud.update(this.engine.getState(), this.engine.getHeroCooldownTimer(), this.engine.getHeroMaxCooldown());
    }
  }

  private cleanup(): void {
    eventBus.off('combat:card-played', this.onCardPlayed);
    eventBus.off('combat:synergy-triggered', this.onSynergyTriggered);
    eventBus.off('combat:card-skipped', this.onCardSkipped);
    eventBus.off('combat:deck-reshuffled', this.onDeckReshuffled);
    eventBus.off('combat:enemy-attack', this.onEnemyAttack);
    eventBus.off('combat:end', this.onCombatEnd);
    if (this.hud) this.hud.destroy();
    if (this.cardQueue) this.cardQueue.destroy();
    try { const run = getRun(); run.isInCombat = false; } catch {}
  }
}
