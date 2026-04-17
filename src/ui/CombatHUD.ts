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
    const x = 8;
    let y = 8;

    // HP label
    const hpLabel = this.scene.add.text(x, y, 'HP', {
      ...FONTS.small, color: COLORS.textPrimary, fontFamily: FONTS.family,
    });
    this.container.add(hpLabel);

    // HP bar background
    this.hpBarBg = this.scene.add.rectangle(x + 30 + 80, y + 6, 160, 12, 0x333333).setOrigin(0.5);
    this.container.add(this.hpBarBg);

    // HP bar fill
    this.hpBar = this.scene.add.rectangle(x + 30, y + 6, 160, 12, 0x00ff00).setOrigin(0, 0.5);
    this.container.add(this.hpBar);

    // HP text
    this.hpText = this.scene.add.text(x + 30 + 164, y, '', {
      ...FONTS.small, color: COLORS.textPrimary, fontFamily: FONTS.family,
    });
    this.container.add(this.hpText);

    y += 20;

    // Stamina label
    const staLabel = this.scene.add.text(x, y, 'STA', {
      ...FONTS.small, color: '#ff8c00', fontFamily: FONTS.family,
    });
    this.container.add(staLabel);

    // Stamina bar bg
    this.staminaBarBg = this.scene.add.rectangle(x + 30 + 60, y + 4, 120, 8, 0x333333).setOrigin(0.5);
    this.container.add(this.staminaBarBg);

    // Stamina bar fill
    this.staminaBar = this.scene.add.rectangle(x + 30, y + 4, 120, 8, 0xff8c00).setOrigin(0, 0.5);
    this.container.add(this.staminaBar);

    // Stamina text
    this.staminaText = this.scene.add.text(x + 30 + 124, y, '', {
      ...FONTS.small, color: '#ff8c00', fontFamily: FONTS.family,
    });
    this.container.add(this.staminaText);

    y += 16;

    // Mana label
    const manaLabel = this.scene.add.text(x, y, 'MP', {
      ...FONTS.small, color: '#6a5acd', fontFamily: FONTS.family,
    });
    this.container.add(manaLabel);

    // Mana bar bg
    this.manaBarBg = this.scene.add.rectangle(x + 30 + 60, y + 4, 120, 8, 0x333333).setOrigin(0.5);
    this.container.add(this.manaBarBg);

    // Mana bar fill
    this.manaBar = this.scene.add.rectangle(x + 30, y + 4, 120, 8, 0x6a5acd).setOrigin(0, 0.5);
    this.container.add(this.manaBar);

    // Mana text
    this.manaText = this.scene.add.text(x + 30 + 124, y, '', {
      ...FONTS.small, color: '#6a5acd', fontFamily: FONTS.family,
    });
    this.container.add(this.manaText);
  }

  private createEnemySection(): void {
    const x = 520;
    const y = 8;

    // Enemy name
    this.enemyNameText = this.scene.add.text(x, y, '', {
      ...FONTS.body, color: COLORS.textPrimary, fontFamily: FONTS.family,
    });
    this.container.add(this.enemyNameText);

    // Enemy HP bar bg
    this.enemyHpBarBg = this.scene.add.rectangle(x + 80, y + 24, 160, 12, 0x333333).setOrigin(0.5);
    this.container.add(this.enemyHpBarBg);

    // Enemy HP bar fill
    this.enemyHpBar = this.scene.add.rectangle(x, y + 24, 160, 12, 0xff0000).setOrigin(0, 0.5);
    this.container.add(this.enemyHpBar);

    // Enemy HP text
    this.enemyHpText = this.scene.add.text(x + 164, y + 18, '', {
      ...FONTS.small, color: COLORS.textPrimary, fontFamily: FONTS.family,
    });
    this.container.add(this.enemyHpText);
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
