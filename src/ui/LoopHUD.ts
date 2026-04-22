import Phaser from 'phaser';
import { getRun, type RunState } from '../state/RunState';
import { COLORS, FONTS } from './StyleConstants';

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
    const panelBg = scene.add.rectangle(12, 12, 260, 80, 0x000000, 0.6).setOrigin(0, 0);
    this.add(panelBg);

    // Row 1 (y=24): Gold & Loop
    const labelStyle = { fontFamily: FONTS.family, fontSize: '18px', color: COLORS.textSecondary, fontStyle: 'bold' };
    const valStyle = { fontFamily: FONTS.family, fontSize: '18px', color: COLORS.textPrimary, fontStyle: 'bold' };

    const goldIcon = scene.add.text(24, 24, '\u25C6', { ...valStyle, color: COLORS.accent });
    this.add(goldIcon);

    this.goldText = scene.add.text(48, 24, '0', { ...valStyle, color: COLORS.accent });
    this.add(this.goldText);

    this.loopText = scene.add.text(140, 24, 'Loop 1', { ...labelStyle, color: '#ffffff' });
    this.add(this.loopText);

    this.difficultyText = scene.add.text(255, 26, 'x1.0', { fontFamily: FONTS.family, fontSize: '14px', color: COLORS.textSecondary }).setOrigin(1, 0);
    this.add(this.difficultyText);

    // Row 2 (y=64): HP bar
    const hpBars = this.createBar(scene, 24, 64, 236, 16, 0x00cc44);
    this.hpBg = hpBars.bg;
    this.hpBar = hpBars.fill;

    this.hpText = scene.add.text(24 + 118, 64, '100/100', { fontFamily: FONTS.family, fontSize: '12px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5, 0.5);
    this.add(this.hpText);

    // Right-side panel
    const rightPanelBg = scene.add.rectangle(570, 12, 218, 80, 0x000000, 0.6).setOrigin(0, 0);
    this.add(rightPanelBg);

    const tpIcon = scene.add.text(585, 24, 'TP:', { ...labelStyle, color: '#00e5ff' });
    this.add(tpIcon);

    this.tpText = scene.add.text(620, 24, '0', { ...valStyle, color: '#00e5ff' });
    this.add(this.tpText);

    this.materialsText = scene.add.text(585, 52, '', {
      fontFamily: FONTS.family, fontSize: '12px', color: COLORS.textSecondary
    });
    this.add(this.materialsText);

    // Shop toggle button
    this.shopToggleBg = scene.add.rectangle(680, 70, 80, 20, 0x004400, 0.8)
      .setStrokeStyle(1, 0x00aa00)
      .setInteractive({ useHandCursor: true });
    this.add(this.shopToggleBg);

    this.shopToggleText = scene.add.text(680, 70, 'Shop: ON', {
      fontFamily: FONTS.family, fontSize: '12px', color: '#00ff00', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add(this.shopToggleText);

    this.shopToggleBg.on('pointerdown', () => {
      const run = getRun();
      run.stopAtShop = !run.stopAtShop;
      this.updateShopToggle(run.stopAtShop);
    });

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

    // Materials display: compact format with first letter abbreviation
    const ABBREV: Record<string, string> = { wood: 'W', stone: 'S', iron: 'I', crystal: 'C', bone: 'B', herbs: 'H', essence: 'E' };
    const matEntries = Object.entries(runState.economy.materials ?? {}).filter(([, v]) => v > 0);
    const matStr = matEntries.length > 0
      ? matEntries.slice(0, 4).map(([k, v]) => `${ABBREV[k] ?? k[0].toUpperCase()}:${v}`).join(' ')
      : '';
    this.materialsText.setText(matStr);

    // Shop toggle visual sync
    this.updateShopToggle(runState.stopAtShop);
  }

  private updateShopToggle(enabled: boolean): void {
    if (enabled) {
      this.shopToggleText.setText('Shop: ON');
      this.shopToggleText.setColor('#00ff00');
      this.shopToggleBg.setFillStyle(0x004400, 0.8);
      this.shopToggleBg.setStrokeStyle(1, 0x00aa00);
    } else {
      this.shopToggleText.setText('Shop: OFF');
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
