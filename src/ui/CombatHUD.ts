// Combat HUD -- HP/Stamina/Mana bars + enemy info + cooldown arc.
// Positioned at top of screen, always visible during combat.
// Numeric values use tweened counters (300ms count up/down).

import type { CombatState } from '../systems/combat/CombatState';
import { COLORS, FONTS } from './StyleConstants';

export class CombatHUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;

  // Hero bars
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private staminaBar!: Phaser.GameObjects.Rectangle;
  private staminaBarBg!: Phaser.GameObjects.Rectangle;
  private staminaText!: Phaser.GameObjects.Text;
  private manaBar!: Phaser.GameObjects.Rectangle;
  private manaBarBg!: Phaser.GameObjects.Rectangle;
  private manaText!: Phaser.GameObjects.Text;

  // Enemy section
  private enemyNameText!: Phaser.GameObjects.Text;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBarBg!: Phaser.GameObjects.Rectangle;
  private enemyHpText!: Phaser.GameObjects.Text;

  // Cooldown arc
  private cooldownGraphics!: Phaser.GameObjects.Graphics;
  private cooldownText!: Phaser.GameObjects.Text;

  // Tweened counter tracking
  private displayedHeroHp: number = 0;
  private displayedStamina: number = 0;
  private displayedMana: number = 0;
  private displayedEnemyHp: number = 0;

  // Max values for bar ratio calculations
  private heroMaxHP: number = 1;
  private heroMaxStamina: number = 1;
  private heroMaxMana: number = 1;
  private enemyMaxHP: number = 1;

  // Active tween references
  private hpTween?: Phaser.Tweens.Tween;
  private staminaTween?: Phaser.Tweens.Tween;
  private manaTween?: Phaser.Tweens.Tween;
  private enemyHpTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(100);

    this.createHeroSection();
    this.createEnemySection();
    this.createCooldownArc();
  }

  private createHeroSection(): void {
    const x = 16;
    let y = 24;

    const labelStyle = { fontFamily: 'Impact, sans-serif', fontSize: '18px', stroke: '#000000', strokeThickness: 3 };
    const valStyle = { fontFamily: 'Impact, sans-serif', fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 2 };

    // HP
    const hpLabel = this.scene.add.text(x, y, 'HP', { ...labelStyle, color: '#00ff00' }).setOrigin(0, 0.5);
    this.container.add(hpLabel);
    
    const hpBars = this.createBar(x + 40, y, 160, 16, 0x00ff00);
    this.hpBarBg = hpBars.bg;
    this.hpBar = hpBars.fill;

    this.hpText = this.scene.add.text(x + 40 + 80, y + 1, '', valStyle).setOrigin(0.5, 0.5);
    this.container.add(this.hpText);

    y += 24;

    // Stamina
    const staLabel = this.scene.add.text(x, y, 'STA', { ...labelStyle, color: '#ff8c00' }).setOrigin(0, 0.5);
    this.container.add(staLabel);
    
    const staBars = this.createBar(x + 40, y, 120, 14, 0xff8c00);
    this.staminaBarBg = staBars.bg;
    this.staminaBar = staBars.fill;

    this.staminaText = this.scene.add.text(x + 40 + 60, y + 1, '', { ...valStyle, fontSize: '14px' }).setOrigin(0.5, 0.5);
    this.container.add(this.staminaText);

    y += 20;

    // Mana
    const manaLabel = this.scene.add.text(x, y, 'MP', { ...labelStyle, color: '#6a5acd' }).setOrigin(0, 0.5);
    this.container.add(manaLabel);

    const manaBars = this.createBar(x + 40, y, 120, 14, 0x6a5acd);
    this.manaBarBg = manaBars.bg;
    this.manaBar = manaBars.fill;

    this.manaText = this.scene.add.text(x + 40 + 60, y + 1, '', { ...valStyle, fontSize: '14px' }).setOrigin(0.5, 0.5);
    this.container.add(this.manaText);
  }

  private createEnemySection(): void {
    const barWidth = 200;
    const x = 780 - barWidth; // Pushed to the right edge
    const y = 24;

    const labelStyle = { fontFamily: 'Impact, sans-serif', fontSize: '22px', color: '#ff4444', stroke: '#000000', strokeThickness: 4 };
    const valStyle = { fontFamily: 'Impact, sans-serif', fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 2 };

    // Enemy name
    this.enemyNameText = this.scene.add.text(780, y, '', labelStyle).setOrigin(1, 0.5);
    this.container.add(this.enemyNameText);

    // Enemy HP bar
    const enemyBars = this.createBar(x, y + 26, barWidth, 18, 0xff0000);
    this.enemyHpBarBg = enemyBars.bg;
    this.enemyHpBar = enemyBars.fill;

    this.enemyHpText = this.scene.add.text(x + barWidth / 2, y + 27, '', valStyle).setOrigin(0.5, 0.5);
    this.container.add(this.enemyHpText);
  }

  private createBar(x: number, y: number, width: number, height: number, color: number): { bg: Phaser.GameObjects.Rectangle, fill: Phaser.GameObjects.Rectangle } {
    const shadow = this.scene.add.rectangle(x + 4, y + 4, width, height, 0x000000, 0.5).setOrigin(0, 0.5);
    const bg = this.scene.add.rectangle(x, y, width, height, 0x222222).setOrigin(0, 0.5);
    const fill = this.scene.add.rectangle(x, y, width, height, color).setOrigin(0, 0.5);
    const frame = this.scene.add.rectangle(x, y, width, height).setOrigin(0, 0.5).setStrokeStyle(3, 0x000000);
    this.container.add([shadow, bg, fill, frame]);
    return { bg, fill };
  }

  private createCooldownArc(): void {
    this.cooldownGraphics = this.scene.add.graphics();
    this.container.add(this.cooldownGraphics);

    this.cooldownText = this.scene.add.text(400, 28, '', {
      ...FONTS.small, color: COLORS.textPrimary, fontFamily: FONTS.family,
    }).setOrigin(0.5);
    this.container.add(this.cooldownText);
  }

  /**
   * Update all HUD elements from current combat state.
   * Numeric changes are tweened over 300ms for smooth visuals.
   */
  update(state: CombatState, heroCooldown: number, heroMaxCooldown: number): void {
    // Store max values for bar ratio calculations in tween callbacks
    this.heroMaxHP = state.heroMaxHP;
    this.heroMaxStamina = state.heroMaxStamina;
    this.heroMaxMana = state.heroMaxMana;
    this.enemyMaxHP = state.enemyMaxHP;

    // Hero HP -- tweened
    const newHeroHp = Math.ceil(state.heroHP);
    if (newHeroHp !== this.displayedHeroHp) {
      this.tweenBar('hp', this.displayedHeroHp, newHeroHp, state.heroMaxHP, 160,
        this.hpBar, this.hpText, (ratio) => this.getHpColor(ratio),
        () => { this.displayedHeroHp = newHeroHp; });
    }

    // Stamina -- tweened
    const newStamina = Math.ceil(state.heroStamina);
    if (newStamina !== this.displayedStamina) {
      this.tweenBar('stamina', this.displayedStamina, newStamina, state.heroMaxStamina, 120,
        this.staminaBar, this.staminaText, () => 0xff8c00,
        () => { this.displayedStamina = newStamina; });
    }

    // Mana -- tweened
    const newMana = Math.ceil(state.heroMana);
    if (newMana !== this.displayedMana) {
      this.tweenBar('mana', this.displayedMana, newMana, state.heroMaxMana, 120,
        this.manaBar, this.manaText, () => 0x6a5acd,
        () => { this.displayedMana = newMana; });
    }

    // Enemy
    this.enemyNameText.setText(state.enemyName);
    const newEnemyHp = Math.ceil(state.enemyHP);
    if (newEnemyHp !== this.displayedEnemyHp) {
      this.tweenBar('enemyHp', this.displayedEnemyHp, newEnemyHp, state.enemyMaxHP, 160,
        this.enemyHpBar, this.enemyHpText, () => 0xff0000,
        () => { this.displayedEnemyHp = newEnemyHp; });
    }

    // Cooldown arc (not tweened -- real-time indicator)
    this.cooldownGraphics.clear();
    if (heroMaxCooldown > 0) {
      const progress = Math.max(0, Math.min(1, 1 - heroCooldown / heroMaxCooldown));
      const cx = 400;
      const cy = 28;
      const radius = 24;

      // Background circle
      this.cooldownGraphics.fillStyle(0x333333, 0.5);
      this.cooldownGraphics.fillCircle(cx, cy, radius);

      // Progress arc
      if (progress > 0) {
        this.cooldownGraphics.fillStyle(0xffd700, 0.8);
        this.cooldownGraphics.slice(
          cx, cy, radius,
          -Math.PI / 2,
          -Math.PI / 2 + (2 * Math.PI * progress),
          false,
        );
        this.cooldownGraphics.fillPath();
      }

      // Remaining seconds
      const remaining = Math.max(0, heroCooldown / 1000);
      this.cooldownText.setText(remaining > 0 ? remaining.toFixed(1) : '');
    }
  }

  /**
   * Tween a bar + text from -> to over 300ms.
   * Stops any existing tween for the given key.
   */
  private tweenBar(
    key: 'hp' | 'stamina' | 'mana' | 'enemyHp',
    from: number,
    to: number,
    max: number,
    barMaxWidth: number,
    bar: Phaser.GameObjects.Rectangle,
    text: Phaser.GameObjects.Text,
    getColor: (ratio: number) => number,
    onComplete: () => void,
  ): void {
    // Stop existing tween
    const tweenMap: Record<string, Phaser.Tweens.Tween | undefined> = {
      hp: this.hpTween, stamina: this.staminaTween,
      mana: this.manaTween, enemyHp: this.enemyHpTween,
    };
    if (tweenMap[key]) tweenMap[key]!.stop();

    // Mark the target value immediately so we don't restart the tween every frame
    onComplete();

    const tween = this.scene.tweens.addCounter({
      from,
      to,
      duration: 300,
      onUpdate: (t) => {
        const val = Math.round(t.getValue());
        const ratio = Math.max(0, val / max);
        bar.width = barMaxWidth * ratio;
        bar.setFillStyle(getColor(ratio));
        text.setText(`${val}/${max}`);
      },
      onComplete: () => {
        // Ensure final value is exact
        const ratio = Math.max(0, to / max);
        bar.width = barMaxWidth * ratio;
        bar.setFillStyle(getColor(ratio));
        text.setText(`${to}/${max}`);
      },
    });

    if (key === 'hp') this.hpTween = tween;
    else if (key === 'stamina') this.staminaTween = tween;
    else if (key === 'mana') this.manaTween = tween;
    else this.enemyHpTween = tween;
  }

  private getHpColor(ratio: number): number {
    if (ratio > 0.5) return 0x00ff00;
    if (ratio > 0.25) return 0xffaa00;
    return 0xff0000;
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
