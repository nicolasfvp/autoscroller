import { Scene } from 'phaser';
import { eventBus, type GameEvents } from '../core/EventBus';
import { getRun } from '../state/RunState';
import { saveManager } from '../core/SaveManager';
import { MapManager } from '../objects/MapManager';
import { Player } from '../objects/Player';
import { getRandomEnemy } from '../data/EnemyDefinitions';
import { RelicHudStrip } from '../ui/RelicHudStrip';
import { SeedDisplay } from '../ui/SeedDisplay';

export class Game extends Scene {
  // Gameplay objects
  private mapManager!: MapManager;
  private player!: Player;
  private lastLoop: number = 0;
  private inEncounter: boolean = false;

  // Named event handler references for cleanup
  private onGoldChanged!: (data: GameEvents['gold:changed']) => void;
  private onHeroDamaged!: (data: GameEvents['hero:damaged']) => void;
  private onHeroHealed!: (data: GameEvents['hero:healed']) => void;
  private onLoopCompleted!: (data: GameEvents['loop:completed']) => void;
  private onSaveCompleted!: (data: GameEvents['save:completed']) => void;

  // HUD elements
  private goldText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private loopText!: Phaser.GameObjects.Text;
  private saveIndicator!: Phaser.GameObjects.Text;
  private relicHudStrip!: RelicHudStrip;

  constructor() {
    super('Game');
  }

  create(data?: { seed?: string; manualSeed?: boolean }): void {
    const run = getRun();
    this.inEncounter = false;

    // Background
    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // ── Gameplay objects ──────────────────────────────────
    this.mapManager = new MapManager(this);
    this.player = new Player(this, 100, 410);

    // Camera follows player with slight delay
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1, 0, -160);
    this.cameras.main.setDeadzone(100, 100);

    // Track current loop
    this.lastLoop = this.mapManager.getCurrentLoop(this.player.x);
    this.mapManager.updateLoopEndTile(this.lastLoop);

    // ── HUD Panel ──────────────────────────────────────────
    this.add.rectangle(8, 8, 200, 80, 0x222222, 0.85)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // Gold display
    this.goldText = this.add.text(16, 16, `Gold: ${run.economy.gold}`, {
      fontSize: '14px',
      color: '#ffd700',
    }).setScrollFactor(0).setDepth(100);

    // Loop counter
    this.loopText = this.add.text(16, 36, `Loop: ${run.loop.count}`, {
      fontSize: '14px',
      color: '#ffffff',
    }).setScrollFactor(0).setDepth(100);

    // HP bar background
    this.add.rectangle(16, 60, 160, 12, 0x333333)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // HP bar fill
    const hpRatio = run.hero.currentHP / run.hero.maxHP;
    this.hpBar = this.add.rectangle(16, 60, 160 * hpRatio, 12, this.getHpColor(hpRatio))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // HP text
    this.hpText = this.add.text(180, 58, `${run.hero.currentHP}/${run.hero.maxHP}`, {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // ── Save Indicator ─────────────────────────────────────
    this.saveIndicator = this.add.text(784, 584, 'Saved', {
      fontSize: '14px',
      color: '#ffd700',
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(200).setAlpha(0);

    // ── Wire auto-save ─────────────────────────────────────
    saveManager.setupAutoSave(() => getRun());

    // ── Event handlers ─────────────────────────────────────
    this.onGoldChanged = (data) => {
      this.goldText.setText(`Gold: ${data.total}`);
    };
    eventBus.on('gold:changed', this.onGoldChanged);

    this.onHeroDamaged = (data) => {
      this.updateHpBar(data.currentHP, data.maxHP);
    };
    eventBus.on('hero:damaged', this.onHeroDamaged);

    this.onHeroHealed = (data) => {
      const run = getRun();
      this.updateHpBar(data.currentHP, run.hero.maxHP);
    };
    eventBus.on('hero:healed', this.onHeroHealed);

    this.onLoopCompleted = (data) => {
      this.loopText.setText(`Loop: ${data.loopNumber}`);
    };
    eventBus.on('loop:completed', this.onLoopCompleted);

    this.onSaveCompleted = (_data) => {
      this.showSaveIndicator();
    };
    eventBus.on('save:completed', this.onSaveCompleted);

    // ── Relic HUD Strip ────────────────────────────────────
    this.relicHudStrip = new RelicHudStrip(this, 600, 80);
    this.relicHudStrip.updateRelics(run.relics);

    // ── Seed Display ─────────────────────────────────────
    if (data?.seed && data?.manualSeed) {
      new SeedDisplay(this, data.seed);
    }



    // ── Keyboard shortcuts ─────────────────────────────────
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

    // ── Resume handler (return from combat/shop/etc) ──────
    this.events.on('resume', () => {
      this.inEncounter = false;
    });

    // Register cleanup
    this.events.on('shutdown', this.cleanup, this);
  }

  update(time: number, delta: number): void {
    if (this.scene.isPaused() || this.inEncounter) return;

    this.player.update(time, delta);
    this.mapManager.update(this.player.x);

    // Check loop progression
    const currentLoop = this.mapManager.getCurrentLoop(this.player.x);
    if (currentLoop > this.lastLoop) {
      this.lastLoop = currentLoop;
      this.mapManager.updateLoopEndTile(currentLoop);

      // Update RunState loop count
      const run = getRun();
      run.loop.count = currentLoop;
      eventBus.emit('loop:completed', { loopNumber: currentLoop, difficulty: run.loop.difficulty });
    }

    // Check tile encounters
    const tileData = this.mapManager.getTileDataAt(this.player.x);
    if (tileData && !tileData.isDefeated) {
      if (tileData.type === 'combat' || tileData.type === 'elite' || tileData.type === 'boss') {
        this.inEncounter = true;
        tileData.isDefeated = true;

        // Pick enemy based on tile type
        const enemyType = tileData.type === 'boss' ? 'boss' : tileData.type === 'elite' ? 'elite' : 'normal';
        const enemy = getRandomEnemy(enemyType);

        this.scene.pause();
        this.scene.launch('CombatScene', { enemyId: enemy.id });
      } else if (tileData.type === 'shop') {
        this.inEncounter = true;
        tileData.isDefeated = true;
        this.scene.pause();
        this.scene.launch('ShopScene');
      } else if (tileData.type === 'rest') {
        this.inEncounter = true;
        tileData.isDefeated = true;
        this.scene.pause();
        this.scene.launch('RestScene');
      } else if (tileData.type === 'event') {
        this.inEncounter = true;
        tileData.isDefeated = true;
        this.scene.pause();
        this.scene.launch('EventScene');
      }
    }
  }

  private updateHpBar(currentHP: number, maxHP: number): void {
    const ratio = Math.max(0, currentHP / maxHP);
    this.hpBar.width = 160 * ratio;
    this.hpBar.setFillStyle(this.getHpColor(ratio));
    this.hpText.setText(`${currentHP}/${maxHP}`);
  }

  private getHpColor(ratio: number): number {
    if (ratio > 0.5) return 0x00ff00;
    if (ratio > 0.25) return 0xffaa00;
    return 0xff0000;
  }

  private showSaveIndicator(): void {
    this.tweens.killTweensOf(this.saveIndicator);
    this.saveIndicator.setAlpha(0);
    this.tweens.chain({
      targets: this.saveIndicator,
      tweens: [
        { alpha: 1, duration: 200 },
        { alpha: 1, duration: 1500 },
        { alpha: 0, duration: 500 },
      ],
    });
  }

  private cleanup(): void {
    eventBus.off('gold:changed', this.onGoldChanged);
    eventBus.off('hero:damaged', this.onHeroDamaged);
    eventBus.off('hero:healed', this.onHeroHealed);
    eventBus.off('loop:completed', this.onLoopCompleted);
    eventBus.off('save:completed', this.onSaveCompleted);
  }
}
