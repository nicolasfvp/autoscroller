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
import { scaleEnemy } from '../data/EnemyDefinitions';
import { loadMetaState } from '../systems/MetaPersistence';
import { COLORS, LAYOUT } from '../ui/StyleConstants';
import { getSpritePrefix } from '../systems/hero/ClassRegistry';

export class CombatScene extends Scene {
  private engine!: CombatEngine;
  private hud!: CombatHUD;
  private cardQueue!: CardQueueDisplay;
  private combatEffects!: CombatEffects;

  // Visual representations
  private heroSprite!: Phaser.GameObjects.Sprite;
  private enemySprite!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  private enemyIdleKey = '';
  private enemyAttackKey = '';
  private enemyDeathKey = '';
  private heroLabel!: Phaser.GameObjects.Text;
  private enemyLabel!: Phaser.GameObjects.Text;

  // Game speed multiplier (1x or 2x from settings)
  private gameSpeed: number = 1;
  private transitioning = false;

  // Event handler references for cleanup
  private onCardPlayed!: (data: GameEvents['combat:card-played']) => void;
  private onSynergyTriggered!: (data: GameEvents['combat:synergy-triggered']) => void;
  private onCardSkipped!: (data: GameEvents['combat:card-skipped']) => void;
  private onDeckReshuffled!: (data: GameEvents['combat:deck-reshuffled']) => void;
  private onEnemyAttack!: (data: GameEvents['combat:enemy-attack']) => void;
  private onCombatEnd!: (data: GameEvents['combat:end']) => void;

  constructor() {
    super('CombatScene');
  }

  private fadeToScene(sceneKey: string, data?: any): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });
  }

  create(data: { enemyId: string; terrain?: string }): void {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    const run = getRun();
    run.isInCombat = true;

    // Load game speed from settings (non-blocking)
    this.gameSpeed = 1;
    loadMetaState().then((metaState) => {
      this.gameSpeed = metaState.gameSpeed ?? 1;
    });

    // Background — terrain-based battle background
    this.cameras.main.setBackgroundColor(COLORS.background);
    const terrain = data.terrain ?? 'basic';
    const battleBgKey = `bg_battle_${terrain}`;
    if (this.textures.exists(battleBgKey)) {
      this.add.image(400, 300, battleBgKey).setDisplaySize(800, 600).setDepth(0);
    }

    // Look up and scale enemy
    const enemyDef = getEnemyById(data.enemyId);
    if (!enemyDef) {
      // Fallback: return to game if enemy not found
      run.isInCombat = false;
      this.fadeToScene('GameScene');
      return;
    }

    const scaled = scaleEnemy(enemyDef, run.loop.difficulty);
    // Create a scaled enemy definition for CombatState
    const scaledEnemy = {
      ...enemyDef,
      baseHP: scaled.hp,
      baseDefense: scaled.defense,
      attack: { ...enemyDef.attack, damage: scaled.damage },
    };

    // Create combat state and engine
    const combatState = createCombatState(run, scaledEnemy);
    this.engine = new CombatEngine(combatState);

    // ── Hero & Enemy visual representations ──────────────
    // Hero (left side) - animated sprite at 4x scale (64x64 -> 256x256)
    const sp = getSpritePrefix(run.hero.className ?? 'warrior');
    const heroIdleKey = `${sp}_idle`;
    const heroAttackKey = `${sp}_attack`;
    const heroDeathKey = `${sp}_death`;
    if (!this.anims.exists(heroIdleKey) && this.textures.exists(heroIdleKey)) {
      this.anims.create({ key: heroIdleKey, frames: this.anims.generateFrameNumbers(heroIdleKey, {}), frameRate: 4, repeat: -1 });
    }
    if (!this.anims.exists(heroAttackKey) && this.textures.exists(heroAttackKey)) {
      this.anims.create({ key: heroAttackKey, frames: this.anims.generateFrameNumbers(heroAttackKey, {}), frameRate: 10, repeat: 0 });
    }
    if (!this.anims.exists(heroDeathKey) && this.textures.exists(heroDeathKey)) {
      this.anims.create({ key: heroDeathKey, frames: this.anims.generateFrameNumbers(heroDeathKey, {}), frameRate: 8, repeat: 0 });
    }
    
    // Check if texture exists, else fallback to knight_idle
    if (this.textures.exists(heroIdleKey)) {
      this.heroSprite = this.add.sprite(200, 350, heroIdleKey).setDepth(10).setScale(4);
      this.heroSprite.play(heroIdleKey);
    } else {
      this.heroSprite = this.add.sprite(200, 350, 'knight_idle').setDisplaySize(128, 128).setDepth(10);
    }
    
    this.heroLabel = this.add.text(200, 200, 'Hero', {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary,
    }).setOrigin(0.5).setDepth(10);

    // Enemy (right side) - animated sprite or colored square fallback
    this.enemyIdleKey = `${enemyDef.id}_idle`;
    this.enemyAttackKey = `${enemyDef.id}_attack`;
    this.enemyDeathKey = `${enemyDef.id}_death`;
    const idleKey = this.enemyIdleKey;
    const attackKey = this.enemyAttackKey;
    const deathKey = this.enemyDeathKey;

    const spriteKey = (enemyDef as any).spriteKey;
    const enemyColor = enemyDef.color ?? 0xff0000;

    if (this.textures.exists(idleKey)) {
      if (!this.anims.exists(idleKey)) {
        this.anims.create({ key: idleKey, frames: this.anims.generateFrameNumbers(idleKey, {}), frameRate: 4, repeat: -1 });
      }
      if (!this.anims.exists(attackKey) && this.textures.exists(attackKey)) {
        this.anims.create({ key: attackKey, frames: this.anims.generateFrameNumbers(attackKey, {}), frameRate: 10, repeat: 0 });
      }
      if (!this.anims.exists(deathKey) && this.textures.exists(deathKey)) {
        this.anims.create({ key: deathKey, frames: this.anims.generateFrameNumbers(deathKey, {}), frameRate: 8, repeat: 0 });
      }
      this.enemySprite = this.add.sprite(550, 350, idleKey).setDepth(10).setScale(4);
      (this.enemySprite as Phaser.GameObjects.Sprite).play(idleKey);
    } else if (spriteKey && this.textures.exists(spriteKey)) {
      this.enemySprite = this.add.sprite(550, 350, spriteKey).setDisplaySize(128, 128).setDepth(10);
    } else {
      // Fallback: colored rectangle when sprite assets are missing
      this.enemySprite = this.add.rectangle(550, 350, 64, 64, enemyColor).setDepth(10);
    }
    this.enemyLabel = this.add.text(550, 300, enemyDef.name, {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary,
    }).setOrigin(0.5).setDepth(10);

    // "VS" divider
    this.add.text(375, 350, 'VS', {
      fontSize: '24px', fontStyle: 'bold', color: COLORS.accent,
    }).setOrigin(0.5).setDepth(10).setAlpha(0.6);

    // Create UI components
    this.hud = new CombatHUD(this);
    this.cardQueue = new CardQueueDisplay(this);
    this.combatEffects = new CombatEffects(this);

    // Initial queue display
    this.cardQueue.update(combatState, 0);

    // Subscribe to EventBus events
    this.onCardPlayed = (eventData) => {
      this.cardQueue.onCardPlayed(0);
      // Play hero attack animation and flash enemy on hit
      if (eventData.damage > 0) {
        // Play hero attack animation if possible
        const sp = getSpritePrefix((getRun() as any).hero?.className ?? 'warrior');
        const heroAttackKey = `${sp}_attack`;
        const heroIdleKey = `${sp}_idle`;
        if (this.anims.exists(heroAttackKey)) {
          this.heroSprite.play(heroAttackKey);
          this.heroSprite.once('animationcomplete', () => {
             if (this.heroSprite && this.anims.exists(heroIdleKey)) this.heroSprite.play(heroIdleKey);
          });
        }
        this.combatEffects.floatingNumber(550, 320, eventData.damage, '#ffffff', '-');
        if (this.enemySprite instanceof Phaser.GameObjects.Sprite) {
          this.enemySprite.setTint(0xffffff);
          this.time.delayedCall(200, () => {
            if (this.enemySprite instanceof Phaser.GameObjects.Sprite) this.enemySprite.clearTint();
          });
        } else if (this.enemySprite instanceof Phaser.GameObjects.Rectangle) {
          this.enemySprite.setFillStyle(0xffffff);
          const savedColor = enemyDef.color ?? 0xff0000;
          this.time.delayedCall(200, () => {
            if (this.enemySprite instanceof Phaser.GameObjects.Rectangle) this.enemySprite.setFillStyle(savedColor);
          });
        }
      }
      // Update HUD and queue after a short delay for animation
      this.time.delayedCall(350, () => {
        if (this.engine && !this.engine.isComplete()) {
          this.cardQueue.update(this.engine.getState(), this.engine.getDeckPointer());
        }
      });
    };
    eventBus.on('combat:card-played', this.onCardPlayed);

    this.onSynergyTriggered = (eventData) => {
      showSynergyFlash(
        this,
        eventData.bonus.type,
        eventData.bonus.value,
        eventData.displayName,
      );
    };
    eventBus.on('combat:synergy-triggered', this.onSynergyTriggered);

    this.onCardSkipped = (_eventData) => {
      this.cardQueue.onCardSkipped(0);
    };
    eventBus.on('combat:card-skipped', this.onCardSkipped);

    this.onDeckReshuffled = (_eventData) => {
      this.cardQueue.onDeckReshuffled();
    };
    eventBus.on('combat:deck-reshuffled', this.onDeckReshuffled);

    this.onEnemyAttack = (eventData) => {
      // Floating damage number on hero side
      this.combatEffects.floatingNumber(200, 320, eventData.damage, '#ff0000', '-');
      this.combatEffects.screenShake(3, 150);
      // Flash hero red briefly on hit
      this.heroSprite.setTint(0xff0000);
      this.time.delayedCall(300, () => {
        if (this.heroSprite) {
          this.heroSprite.clearTint();
        }
      });
      // Play enemy attack animation
      if (this.enemySprite instanceof Phaser.GameObjects.Sprite && this.anims.exists(this.enemyAttackKey)) {
        this.enemySprite.play(this.enemyAttackKey);
        this.enemySprite.once('animationcomplete', () => {
          if (this.enemySprite instanceof Phaser.GameObjects.Sprite && this.anims.exists(this.enemyIdleKey)) {
            this.enemySprite.play(this.enemyIdleKey);
          }
        });
      }
    };
    eventBus.on('combat:enemy-attack', this.onEnemyAttack);

    this.onCombatEnd = (eventData) => {
      const resultText = eventData.result === 'victory' ? 'VICTORY' : 'DEFEAT';
      const resultColor = eventData.result === 'victory' ? COLORS.accent : COLORS.danger;

      // Play death animation for the losing side
      if (eventData.result === 'victory') {
        // Enemy dies - play enemy death animation
        if (this.enemySprite instanceof Phaser.GameObjects.Sprite && this.anims.exists(this.enemyDeathKey)) {
          this.enemySprite.play(this.enemyDeathKey);
        }
      } else {
        // Hero dies - play hero death animation
        if (this.anims.exists(heroDeathKey)) {
          this.heroSprite.play(heroDeathKey);
        }
      }

      const displayText = this.add.text(400, 300, resultText, {
        fontSize: '32px',
        fontStyle: 'bold',
        color: resultColor,
      }).setOrigin(0.5).setDepth(600);

      // Hold 1s then transition (enough time for death anim at 8fps with 7 frames = ~875ms)
      this.time.delayedCall(1000, () => {
        displayText.destroy();
        const currentRun = getRun();
        currentRun.isInCombat = false;

        if (eventData.result === 'victory') {
          // Award XP
          earnXP(currentRun, getXPForEnemy(enemyDef.type));
          // Write HP, stamina, and mana back to RunState for 50% recovery between fights
          const finalState = this.engine.getState();
          currentRun.hero.currentHP = finalState.heroHP;
          currentRun.hero.currentStamina = finalState.heroStamina;
          currentRun.hero.currentMana = finalState.heroMana;
          // Flag boss defeat for GameScene to trigger BossExitScene
          if (enemyDef.type === 'boss') {
            (currentRun as any)._lastBossDefeated = true;
          }

          // Transition to PostCombatScene
          const stats = this.engine.getStats();
          this.fadeToScene('PostCombatScene', {
            stats,
            enemyType: enemyDef.type,
            xpEarned: getXPForEnemy(enemyDef.type),
          });
        } else {
          // Defeat
          loseAllRunXP(currentRun);
          this.fadeToScene('DeathScene', {
            enemyName: enemyDef.name,
            stats: this.engine.getStats(),
          });
        }
      });
    };
    eventBus.on('combat:end', this.onCombatEnd);

    // Register cleanup
    this.events.on('shutdown', this.cleanup, this);
  }

  update(_time: number, delta: number): void {
    if (this.engine && !this.engine.isComplete()) {
      this.engine.tick(delta * this.gameSpeed);

      // Update HUD each frame
      this.hud.update(
        this.engine.getState(),
        this.engine.getHeroCooldownTimer(),
        this.engine.getHeroMaxCooldown(),
      );
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

    // Ensure isInCombat is reset
    try {
      const run = getRun();
      run.isInCombat = false;
    } catch {
      // No active run
    }
  }
}
