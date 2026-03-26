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

export class CombatScene extends Scene {
  private engine!: CombatEngine;
  private hud!: CombatHUD;
  private cardQueue!: CardQueueDisplay;
  private combatEffects!: CombatEffects;

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

  create(data: { enemyId: string }): void {
    const run = getRun();
    run.isInCombat = true;

    // Background
    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Look up and scale enemy
    const enemyDef = getEnemyById(data.enemyId);
    if (!enemyDef) {
      // Fallback: return to game if enemy not found
      run.isInCombat = false;
      this.scene.start('Game');
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

    // Create UI components
    this.hud = new CombatHUD(this);
    this.cardQueue = new CardQueueDisplay(this);
    this.combatEffects = new CombatEffects(this);

    // Initial queue display
    this.cardQueue.update(combatState, 0);

    // Subscribe to EventBus events
    this.onCardPlayed = (_eventData) => {
      this.cardQueue.onCardPlayed(0);
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
      this.combatEffects.floatingNumber(200, 200, eventData.damage, '#ff0000', '-');
      this.combatEffects.screenShake(3, 150);
    };
    eventBus.on('combat:enemy-attack', this.onEnemyAttack);

    this.onCombatEnd = (eventData) => {
      const resultText = eventData.result === 'victory' ? 'VICTORY' : 'DEFEAT';
      const resultColor = eventData.result === 'victory' ? '#ffd700' : '#ff0000';

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
          // Write HP back to RunState
          const finalState = this.engine.getState();
          currentRun.hero.currentHP = finalState.heroHP;

          // Transition to PostCombatScene
          const stats = this.engine.getStats();
          this.scene.start('PostCombatScene', {
            stats,
            enemyType: enemyDef.type,
            xpEarned: getXPForEnemy(enemyDef.type),
          });
        } else {
          // Defeat
          loseAllRunXP(currentRun);
          this.scene.start('DeathScene', {
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
      this.engine.tick(delta);

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
