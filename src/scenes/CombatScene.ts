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

export class CombatScene extends Scene {
  private engine!: CombatEngine;
  private hud!: CombatHUD;
  private cardQueue!: CardQueueDisplay;
  private combatEffects!: CombatEffects;

  // Visual representations
  private heroSprite!: Phaser.GameObjects.Rectangle;
  private enemySprite!: Phaser.GameObjects.Rectangle;
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

  create(data: { enemyId: string }): void {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    const run = getRun();
    run.isInCombat = true;

    // Load game speed from settings (non-blocking)
    this.gameSpeed = 1;
    loadMetaState().then((metaState) => {
      this.gameSpeed = metaState.gameSpeed ?? 1;
    });

    // Background
    this.cameras.main.setBackgroundColor(COLORS.background);

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
    // Hero (left side) - blue square with label
    this.heroSprite = this.add.rectangle(200, 350, 64, 64, 0x4488ff).setDepth(10);
    this.heroLabel = this.add.text(200, 300, 'Hero', {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary,
    }).setOrigin(0.5).setDepth(10);

    // Enemy (right side) - colored square with name
    const enemyColor = enemyDef.color ?? 0xff0000;
    this.enemySprite = this.add.rectangle(550, 350, 64, 64, enemyColor).setDepth(10);
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
      // Flash enemy white on hit
      if (eventData.damage > 0) {
        this.combatEffects.floatingNumber(550, 320, eventData.damage, '#ffffff', '-');
        this.enemySprite.setFillStyle(0xffffff);
        this.time.delayedCall(200, () => {
          if (this.enemySprite) this.enemySprite.setFillStyle(enemyColor);
        });
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
      // Flash hero red briefly
      this.heroSprite.setFillStyle(0xff0000);
      this.time.delayedCall(200, () => {
        if (this.heroSprite) this.heroSprite.setFillStyle(0x4488ff);
      });
    };
    eventBus.on('combat:enemy-attack', this.onEnemyAttack);

    this.onCombatEnd = (eventData) => {
      const resultText = eventData.result === 'victory' ? 'VICTORY' : 'DEFEAT';
      const resultColor = eventData.result === 'victory' ? COLORS.accent : COLORS.danger;

      const displayText = this.add.text(400, 300, resultText, {
        fontSize: '32px',
        fontStyle: 'bold',
        color: resultColor,
      }).setOrigin(0.5).setDepth(600);

      // Hold 1s then transition
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
