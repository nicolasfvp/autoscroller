import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { getBossExitChoiceData } from '../systems/BossSystem';
import { LoopRunner, type LoopRunState } from '../systems/LoopRunner';

/**
 * BossExitScene -- boss exit choice overlay with two-panel layout.
 * Shows Exit Run (safe, green) vs Continue (risk, red).
 * Delegates logic to BossSystem and LoopRunner.
 */
export class BossExitScene extends Scene {
  private loopRunner!: LoopRunner;
  private selectedChoice: 'exit' | 'continue' | null = null;
  private confirmBtn: Phaser.GameObjects.Text | null = null;
  private exitPanel!: Phaser.GameObjects.Container;
  private continuePanel!: Phaser.GameObjects.Container;

  constructor() {
    super('BossExitScene');
  }

  create(data: { loopRunner: LoopRunner; loopRunState: LoopRunState }): void {
    this.loopRunner = data.loopRunner;
    this.selectedChoice = null;

    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';

    // Overlay panel
    this.add.rectangle(400, 300, 600, 400, 0x222222, 0.9).setInteractive();

    // Title
    this.add.text(400, 125, 'Boss Defeated!', {
      fontSize: '32px', fontStyle: 'bold', color: '#ffd700', fontFamily,
    }).setOrigin(0.5);

    // Get choice data
    const run = getRun();
    const bossAdapter = {
      hero: { hp: run.hero.currentHP, maxHp: run.hero.maxHP, xp: run.hero.runXP ?? 0 },
      loop: { count: run.loop.count },
      economy: {
        gold: run.economy.gold,
        tilePoints: run.economy.tilePoints,
        metaLoot: (run.economy as any).metaLoot ?? 0,
      },
    };
    const choiceData = getBossExitChoiceData(bossAdapter);

    // Exit Run panel (left)
    this.exitPanel = this.add.container(270, 280);
    const exitBg = this.add.rectangle(0, 0, 240, 220, 0x1a3a1a);
    exitBg.setInteractive({ useHandCursor: true });
    this.exitPanel.add(exitBg);

    this.exitPanel.add(this.add.text(0, -75, 'Exit Run', {
      fontSize: '24px', fontStyle: 'bold', color: '#00ff00', fontFamily,
    }).setOrigin(0.5));

    this.exitPanel.add(this.add.text(0, -35, 'Bank all meta-loot\nand XP safely.', {
      fontSize: '16px', color: '#ffffff', fontFamily, align: 'center',
      wordWrap: { width: 200 },
    }).setOrigin(0.5));

    const reward = choiceData.safeExitReward;
    this.exitPanel.add(this.add.text(0, 30, `+${reward.metaLoot} Meta-Loot\n+${reward.xp} XP`, {
      fontSize: '14px', color: '#00ff00', fontFamily, align: 'center',
    }).setOrigin(0.5));

    // Hover
    exitBg.on('pointerover', () => {
      exitBg.setStrokeStyle(2, 0x00ff00);
      this.tweens.add({ targets: this.exitPanel, scaleX: 1.03, scaleY: 1.03, duration: 100 });
    });
    exitBg.on('pointerout', () => {
      if (this.selectedChoice !== 'exit') {
        exitBg.setStrokeStyle(0);
        this.tweens.add({ targets: this.exitPanel, scaleX: 1, scaleY: 1, duration: 100 });
      }
    });
    exitBg.on('pointerdown', () => this.selectChoice('exit'));

    // Continue panel (right)
    this.continuePanel = this.add.container(530, 280);
    const continueBg = this.add.rectangle(0, 0, 240, 220, 0x3a1a1a);
    continueBg.setInteractive({ useHandCursor: true });
    this.continuePanel.add(continueBg);

    this.continuePanel.add(this.add.text(0, -75, 'Continue', {
      fontSize: '24px', fontStyle: 'bold', color: '#ff6600', fontFamily,
    }).setOrigin(0.5));

    this.continuePanel.add(this.add.text(0, -35, 'The loop grows by 3 tiles.\nRisk everything.', {
      fontSize: '16px', color: '#ffffff', fontFamily, align: 'center',
      wordWrap: { width: 200 },
    }).setOrigin(0.5));

    this.continuePanel.add(this.add.text(0, 30, 'Death means 25%\nmeta-loot, zero XP.', {
      fontSize: '14px', color: '#ff0000', fontFamily, align: 'center',
    }).setOrigin(0.5));

    // Hover
    continueBg.on('pointerover', () => {
      continueBg.setStrokeStyle(2, 0xff6600);
      this.tweens.add({ targets: this.continuePanel, scaleX: 1.03, scaleY: 1.03, duration: 100 });
    });
    continueBg.on('pointerout', () => {
      if (this.selectedChoice !== 'continue') {
        continueBg.setStrokeStyle(0);
        this.tweens.add({ targets: this.continuePanel, scaleX: 1, scaleY: 1, duration: 100 });
      }
    });
    continueBg.on('pointerdown', () => this.selectChoice('continue'));

    // Confirm button (hidden until selection)
    this.confirmBtn = this.add.text(400, 430, 'Confirm', {
      fontSize: '24px', fontStyle: 'bold', color: '#ffd700', fontFamily,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);

    this.confirmBtn.on('pointerdown', () => this.confirmSelection());

    this.events.on('shutdown', this.cleanup, this);
  }

  private selectChoice(choice: 'exit' | 'continue'): void {
    this.selectedChoice = choice;

    if (choice === 'exit') {
      this.exitPanel.setAlpha(1);
      (this.exitPanel.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(3, 0xffd700);
      this.continuePanel.setAlpha(0.6);
      (this.continuePanel.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(0);
      this.confirmBtn!.setColor('#00ff00');
    } else {
      this.continuePanel.setAlpha(1);
      (this.continuePanel.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(3, 0xffd700);
      this.exitPanel.setAlpha(0.6);
      (this.exitPanel.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(0);
      this.confirmBtn!.setColor('#ff6600');
    }

    this.confirmBtn!.setVisible(true);
  }

  private confirmSelection(): void {
    if (!this.selectedChoice) return;

    if (this.selectedChoice === 'exit') {
      this.loopRunner.onBossChoice('exit');
      // Transition to GameOverScene
      this.scene.stop();
      this.scene.stop('GameScene');
      this.scene.start('GameOverScene');
    } else {
      this.loopRunner.onBossChoice('continue');
      // Resume GameScene -- LoopRunner is now in 'planning' state
      this.scene.stop();
      this.scene.resume('GameScene');
    }
  }

  private cleanup(): void {
    this.confirmBtn = null;
  }
}
