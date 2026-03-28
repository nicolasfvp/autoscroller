import { Scene } from 'phaser';
import { getRun, clearRun } from '../state/RunState';
import { getBossExitChoiceData } from '../systems/BossSystem';
import { LoopRunner, type LoopRunState } from '../systems/LoopRunner';
import { bankRunRewards } from '../systems/MetaProgressionSystem';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import { COLORS, FONTS, LAYOUT } from '../ui/StyleConstants';

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
  private transitioning = false;

  constructor() {
    super('BossExitScene');
  }

  private fadeToScene(sceneKey: string, data?: any): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });
  }

  create(data: { loopRunner: LoopRunner; loopRunState: LoopRunState }): void {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    this.loopRunner = data.loopRunner;
    this.selectedChoice = null;

    const fontFamily = FONTS.family;

    // Overlay panel
    this.add.rectangle(400, 300, 600, 400, COLORS.panel, LAYOUT.panelAlpha).setInteractive();

    // Title
    this.add.text(400, 125, 'Boss Defeated!', {
      fontSize: '32px', fontStyle: 'bold', color: COLORS.accent, fontFamily,
    }).setOrigin(0.5);

    // Get choice data
    const run = getRun();
    const bossAdapter = {
      hero: { hp: run.hero.currentHP, maxHp: run.hero.maxHP, xp: run.hero.runXP ?? 0 },
      loop: { count: run.loop.count },
      economy: {
        gold: run.economy.gold,
        tilePoints: run.economy.tilePoints,
        materials: run.economy.materials ?? {},
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

    this.exitPanel.add(this.add.text(0, -35, 'Bank all materials\nand XP safely.', {
      fontSize: '16px', color: COLORS.textPrimary, fontFamily, align: 'center',
      wordWrap: { width: 200 },
    }).setOrigin(0.5));

    const reward = choiceData.safeExitReward;
    const materialLines = Object.entries(reward.materials)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ') || 'None';
    this.exitPanel.add(this.add.text(0, 20, materialLines, {
      fontSize: '12px', color: '#00ff00', fontFamily, align: 'center',
      wordWrap: { width: 200 },
    }).setOrigin(0.5));
    this.exitPanel.add(this.add.text(0, 50, `+${reward.xp} XP`, {
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
      fontSize: '16px', color: COLORS.textPrimary, fontFamily, align: 'center',
      wordWrap: { width: 200 },
    }).setOrigin(0.5));

    this.continuePanel.add(this.add.text(0, 30, 'Death means 10%\nmaterials, zero XP.', {
      fontSize: '14px', color: COLORS.danger, fontFamily, align: 'center',
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
      fontSize: '24px', fontStyle: 'bold', color: COLORS.accent, fontFamily,
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

  private async confirmSelection(): Promise<void> {
    if (!this.selectedChoice) return;

    if (this.selectedChoice === 'exit') {
      this.loopRunner.onBossChoice('exit');

      // Bank 100% materials and XP for safe exit
      const run = getRun();
      const materialsEarned: Record<string, number> = { ...(run.economy.materials ?? {}) };
      const xpEarned = run.hero.runXP ?? 0;
      const metaState = await loadMetaState();
      const updatedState = bankRunRewards(
        materialsEarned,
        xpEarned,
        'safe',
        {
          seed: (run as any).seed ?? 'unknown',
          loopsCompleted: run.loop.count,
          bossesDefeated: (run as any).bossesDefeated ?? 1,
        },
        metaState
      );
      await saveMetaState(updatedState);

      clearRun();
      this.scene.stop('GameScene');
      this.fadeToScene('CityHub');
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
