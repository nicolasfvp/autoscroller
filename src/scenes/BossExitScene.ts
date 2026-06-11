import { Scene } from 'phaser';
import { getRun, clearRun } from '../state/RunState';
import { getBossExitChoiceData } from '../systems/BossSystem';
import { LoopRunner, type LoopRunState } from '../systems/LoopRunner';
import { bankRunRewards } from '../systems/MetaProgressionSystem';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import { saveManager } from '../core/SaveManager';
import { COLORS, FONTS, LAYOUT } from '../ui/StyleConstants';
import { SCENE_KEYS, stopAllRunScenes } from '../state/SceneKeys';
import { t } from '../i18n/i18n';

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

  create(data: { loopRunner: LoopRunner; loopRunState: LoopRunState }): void {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    this.loopRunner = data.loopRunner;
    this.selectedChoice = null;

    const fontFamily = FONTS.body;

    // Overlay panel
    this.add.rectangle(400, 300, 600, 400, COLORS.panel, LAYOUT.panelAlpha).setInteractive();

    // Title
    this.add.bitmapText(400, 125, 'game_font_gold', t('bossExit.bossDefeated'), 32).setOrigin(0.5);

    // Get choice data
    const run = getRun();
    const choiceData = getBossExitChoiceData(run);

    // Exit Run panel (left)
    this.exitPanel = this.add.container(270, 280);
    const exitBg = this.add.rectangle(0, 0, 240, 220, 0x1a3a1a);
    exitBg.setInteractive({ useHandCursor: true });
    this.exitPanel.add(exitBg);

    this.exitPanel.add(this.add.text(0, -75, t('bossExit.exitRun'), {
      fontSize: '24px', fontStyle: 'bold', color: '#00ff00', fontFamily,
    }).setOrigin(0.5));

    this.exitPanel.add(this.add.text(0, -35, t('bossExit.exitRunDesc'), {
      fontSize: '16px', color: COLORS.textPrimary, fontFamily, align: 'center',
      wordWrap: { width: 200 },
    }).setOrigin(0.5));

    const reward = choiceData.safeExitReward;
    const materialLines = Object.entries(reward.materials)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ') || t('bossExit.none');
    this.exitPanel.add(this.add.text(0, 20, materialLines, {
      fontSize: '12px', color: '#00ff00', fontFamily, align: 'center',
      wordWrap: { width: 200 },
    }).setOrigin(0.5));
    this.exitPanel.add(this.add.text(0, 50, t('bossExit.xpReward', { xp: reward.xp }), {
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

    this.continuePanel.add(this.add.text(0, -75, t('bossExit.continue'), {
      fontSize: '24px', fontStyle: 'bold', color: '#ff6600', fontFamily,
    }).setOrigin(0.5));

    this.continuePanel.add(this.add.text(0, -35, t('bossExit.continueDesc'), {
      fontSize: '16px', color: COLORS.textPrimary, fontFamily, align: 'center',
      wordWrap: { width: 200 },
    }).setOrigin(0.5));

    this.continuePanel.add(this.add.text(0, 30, t('bossExit.continueRisk'), {
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

    // Confirm button — visible but dimmed until a selection is made so the
    // player can see the affordance up-front (UX: no "where do I confirm?").
    this.confirmBtn = this.add.text(400, 430, t('bossExit.confirm'), {
      fontSize: '24px', fontStyle: 'bold', color: COLORS.accent, fontFamily,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0.4);

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

    this.confirmBtn!.setAlpha(1);
  }

  private async confirmSelection(): Promise<void> {
    if (!this.selectedChoice) return;
    // Guard against double-fire: Enter+click or Space+click during the
    // async safe-exit path can otherwise enter twice and double-bank
    // materials before the camera fade actually starts.
    if (this.transitioning) return;
    this.transitioning = true;

    if (this.selectedChoice === 'exit') {
      this.loopRunner.onBossChoice('exit');

      // Bank 100% materials and XP for safe exit
      const run = getRun();
      const targetScene = run.mode === 'daily' ? SCENE_KEYS.MAIN_MENU : SCENE_KEYS.CITY_HUB;
      const materialsEarned: Record<string, number> = { ...(run.economy.materials ?? {}) };
      const xpEarned = run.hero.runXP ?? 0;
      try {
        const metaState = await loadMetaState();
        const updatedState = bankRunRewards(
          materialsEarned,
          xpEarned,
          'safe',
          {
            seed: run.runId,
            loopsCompleted: Math.max(0, run.loop.count - 1),
            bossesDefeated: run.loop.bossesDefeated ?? 0,
          },
          metaState,
          run.hero.className ?? 'warrior',
          run.economy.gatheringBoost ?? 0,
        );
        await saveMetaState(updatedState);
        await saveManager.clearByMode(run.mode);
      } catch (e) {
        console.error('[BossExit] Failed to bank rewards:', e);
      }
      clearRun();
      stopAllRunScenes(this, SCENE_KEYS.BOSS_EXIT);
      this.scene.stop(SCENE_KEYS.BOSS_EXIT);
      this.scene.start(targetScene);
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
