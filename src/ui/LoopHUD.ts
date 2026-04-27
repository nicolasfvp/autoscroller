import Phaser from 'phaser';
import { getRun, type RunState } from '../state/RunState';
import { COLORS, FONTS } from './StyleConstants';

/** Stroke style applied to every text for readability over bright biomes */
const TEXT_STROKE = { stroke: '#000000', strokeThickness: 3 };

/**
 * LoopHUD -- fixed HUD overlay for GameScene.
 * Displays: gold, loop counter, difficulty, HP bar, tile points, materials.
 * Numeric values use tweened counters (300ms count up/down).
 */
export class LoopHUD extends Phaser.GameObjects.Container {
  private goldText: Phaser.GameObjects.Text;
  private loopText: Phaser.GameObjects.Text;
  private difficultyText: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Rectangle;
  private hpBg: Phaser.GameObjects.Rectangle;
  private hpText: Phaser.GameObjects.Text;
  private tpText: Phaser.GameObjects.Text;
  private materialsText: Phaser.GameObjects.Text;
  private shopToggleText: Phaser.GameObjects.Text;
  private shopToggleBg: Phaser.GameObjects.Rectangle;


  // Pending cards badge
  private pendingBadge!: Phaser.GameObjects.Text;

  // Tweened counter tracking
  private displayedGold: number = 0;
  private displayedHP: number = 0;
  private displayedMaxHP: number = 0;
  private displayedTP: number = 0;

  // Active tween references (to stop before starting new ones)
  private goldTween?: Phaser.Tweens.Tween;
  private hpTween?: Phaser.Tweens.Tween;
  private tpTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.setScrollFactor(0);
    this.setDepth(100);

    // Left panel background
    const panelBg = scene.add.image(12, 12, 'wood_texture').setOrigin(0, 0).setDisplaySize(260, 80);
    this.add(panelBg);

    // Row 1 (y=24): Gold & Loop
    const labelStyle = { fontFamily: FONTS.family, fontSize: '18px', color: COLORS.textSecondary, fontStyle: 'bold', ...TEXT_STROKE };
    const valStyle = { fontFamily: FONTS.family, fontSize: '18px', color: COLORS.textPrimary, fontStyle: 'bold', ...TEXT_STROKE };

    const goldIcon = scene.add.text(24, 24, '\u25C6', { ...valStyle, color: COLORS.accent });
    this.add(goldIcon);

    this.goldText = scene.add.text(48, 24, '0', { ...valStyle, color: COLORS.accent });
    this.add(this.goldText);

    this.loopText = scene.add.text(140, 24, 'Loop 1', { ...labelStyle, color: '#ffffff' });
    this.add(this.loopText);

    this.difficultyText = scene.add.text(255, 26, 'x1.0', { fontFamily: FONTS.family, fontSize: '14px', color: COLORS.textSecondary, ...TEXT_STROKE }).setOrigin(1, 0);
    this.add(this.difficultyText);

    // Row 2 (y=64): HP bar
    const hpBars = this.createBar(scene, 24, 64, 236, 16, 0x00cc44);
    this.hpBg = hpBars.bg;
    this.hpBar = hpBars.fill;

    this.hpText = scene.add.text(24 + 118, 64, '100/100', { fontFamily: FONTS.family, fontSize: '12px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5, 0.5);
    this.add(this.hpText);

    // Right panel background (TP, Shop toggle)
    const rightPanelBg = scene.add.image(528, 12, 'wood_texture').setOrigin(0, 0).setDisplaySize(260, 80);
    this.add(rightPanelBg);

    const tpIcon = scene.add.text(540, 24, 'TP:', { ...labelStyle, color: '#00e5ff' });
    this.add(tpIcon);

    this.tpText = scene.add.text(575, 24, '0', { ...valStyle, color: '#00e5ff' });
    this.add(this.tpText);

    this.materialsText = scene.add.text(540, 52, '', {
      fontFamily: FONTS.family, fontSize: '12px', color: COLORS.textSecondary, ...TEXT_STROKE
    });
    this.add(this.materialsText);

    // Shop toggle button — renamed for clarity (feedback #8)
    this.shopToggleBg = scene.add.rectangle(720, 24, 56, 20, 0x004400, 0.8)
      .setStrokeStyle(1, 0x00aa00)
      .setInteractive({ useHandCursor: true });
    this.add(this.shopToggleBg);

    this.shopToggleText = scene.add.text(720, 24, 'Shop \u2714', {
      fontFamily: FONTS.family, fontSize: '11px', color: '#00ff00', fontStyle: 'bold', ...TEXT_STROKE
    }).setOrigin(0.5);
    this.add(this.shopToggleText);

    this.shopToggleBg.on('pointerdown', () => {
      const run = getRun();
      run.stopAtShop = !run.stopAtShop;
      this.updateShopToggle(run.stopAtShop);
    });



    // ── Pending cards badge (feedback #11) ──
    this.pendingBadge = scene.add.text(255, 72, '', {
      fontFamily: FONTS.family, fontSize: '13px', color: '#ff8800', fontStyle: 'bold', ...TEXT_STROKE
    });
    this.add(this.pendingBadge);

    scene.add.existing(this);
  }

  private createBar(scene: Phaser.Scene, x: number, y: number, width: number, height: number, color: number): { bg: Phaser.GameObjects.Rectangle, fill: Phaser.GameObjects.Rectangle } {
    const bg = scene.add.rectangle(x, y, width, height, 0x333333).setOrigin(0, 0.5);
    const fill = scene.add.rectangle(x, y, width, height, color).setOrigin(0, 0.5);
    const frame = scene.add.rectangle(x, y, width, height).setOrigin(0, 0.5).setStrokeStyle(1, 0x555555);
    this.add([bg, fill, frame]);
    return { bg, fill };
  }

  update(runState: RunState): void {
    // Gold -- tweened counter
    const newGold = runState.economy.gold;
    if (newGold !== this.displayedGold) {
      this.tweenValue('gold', this.displayedGold, newGold, (val) => {
        this.goldText.setText(String(val));
      }, () => {
        this.displayedGold = newGold;
      });
    }

    // Loop & difficulty (instant, non-numeric labels)
    this.loopText.setText(`Loop ${runState.loop.count}`);
    this.difficultyText.setText(`x${runState.loop.difficulty.toFixed(1)}`);

    // HP -- tweened counter + bar
    const newHP = runState.hero.currentHP;
    const newMaxHP = runState.hero.maxHP;
    this.displayedMaxHP = newMaxHP;
    if (newHP !== this.displayedHP) {
      this.tweenValue('hp', this.displayedHP, newHP, (val) => {
        const hpRatio = Math.max(0, val / this.displayedMaxHP);
        this.hpBar.width = 160 * hpRatio;
        this.hpBar.setFillStyle(this.getHpColor(hpRatio));
        this.hpText.setText(`${val}/${this.displayedMaxHP}`);
      }, () => {
        this.displayedHP = newHP;
      });
    }

    // Tile points -- tweened counter
    const newTP = runState.economy.tilePoints;
    if (newTP !== this.displayedTP) {
      this.tweenValue('tp', this.displayedTP, newTP, (val) => {
        this.tpText.setText(`${val} TP`);
      }, () => {
        this.displayedTP = newTP;
      });
    }

    // Materials display: emoji icons for clarity (feedback #14)
    const MAT_ICONS: Record<string, string> = { wood: '\uD83E\uDEB5', stone: '\uD83E\uDEA8', iron: '\u2699', crystal: '\uD83D\uDC8E', bone: '\uD83E\uDDB4', herbs: '\uD83C\uDF3F', essence: '\u2728' };
    const matEntries = Object.entries(runState.economy.materials ?? {}).filter(([, v]) => v > 0);
    const matStr = matEntries.length > 0
      ? matEntries.slice(0, 4).map(([k, v]) => `${MAT_ICONS[k] ?? k[0].toUpperCase()}${v}`).join(' ')
      : '';
    this.materialsText.setText(matStr);

    // Shop toggle visual sync
    this.updateShopToggle(runState.stopAtShop);


    // Pending cards badge (feedback #11)
    const pendingCount = runState.deck.droppedCards?.length ?? 0;
    if (pendingCount > 0) {
      this.pendingBadge.setText(`\uD83D\uDCE6 ${pendingCount} new`);
      this.pendingBadge.setVisible(true);
    } else {
      this.pendingBadge.setVisible(false);
    }
  }

  private updateShopToggle(enabled: boolean): void {
    if (enabled) {
      this.shopToggleText.setText('Shop \u2714');
      this.shopToggleText.setColor('#00ff00');
      this.shopToggleBg.setFillStyle(0x004400, 0.8);
      this.shopToggleBg.setStrokeStyle(1, 0x00aa00);
    } else {
      this.shopToggleText.setText('Shop \u2718');
      this.shopToggleText.setColor('#ff4444');
      this.shopToggleBg.setFillStyle(0x440000, 0.8);
      this.shopToggleBg.setStrokeStyle(1, 0xaa0000);
    }
  }

  /**
   * Tween a numeric value from -> to over 300ms, calling onUpdate each frame
   * and onComplete when done. Stops any existing tween for the given key.
   */
  private tweenValue(
    key: 'gold' | 'hp' | 'tp',
    from: number,
    to: number,
    onUpdate: (val: number) => void,
    onComplete: () => void,
  ): void {
    // Stop existing tween for this key
    const tweenRef = key === 'gold' ? this.goldTween : key === 'hp' ? this.hpTween : this.tpTween;
    if (tweenRef) tweenRef.stop();

    const tween = this.scene.tweens.addCounter({
      from,
      to,
      duration: 300,
      onUpdate: (t) => {
        onUpdate(Math.round(t.getValue()));
      },
      onComplete: () => {
        onUpdate(to); // ensure final value is exact
        onComplete();
      },
    });

    if (key === 'gold') this.goldTween = tween;
    else if (key === 'hp') this.hpTween = tween;
    else this.tpTween = tween;
  }

  private getHpColor(ratio: number): number {
    if (ratio > 0.5) return 0x00ff00;
    if (ratio > 0.25) return 0xffaa00;
    return 0xff0000;
  }
}
