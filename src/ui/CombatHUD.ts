// Combat HUD -- HP/Stamina/Mana bars + enemy info + cooldown arc.
// Positioned at top of screen, always visible during combat.

import type { CombatState } from '../systems/combat/CombatState';

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
    const hpLabel = this.scene.add.text(x, y, 'HP', { fontSize: '14px', color: '#ffffff' });
    this.container.add(hpLabel);

    // HP bar background
    this.hpBarBg = this.scene.add.rectangle(x + 30 + 80, y + 6, 160, 12, 0x333333).setOrigin(0.5);
    this.container.add(this.hpBarBg);

    // HP bar fill
    this.hpBar = this.scene.add.rectangle(x + 30, y + 6, 160, 12, 0x00ff00).setOrigin(0, 0.5);
    this.container.add(this.hpBar);

    // HP text
    this.hpText = this.scene.add.text(x + 30 + 164, y, '', { fontSize: '14px', color: '#ffffff' });
    this.container.add(this.hpText);

    y += 20;

    // Stamina label
    const staLabel = this.scene.add.text(x, y, 'STA', { fontSize: '14px', color: '#ff8c00' });
    this.container.add(staLabel);

    // Stamina bar bg
    this.staminaBarBg = this.scene.add.rectangle(x + 30 + 60, y + 4, 120, 8, 0x333333).setOrigin(0.5);
    this.container.add(this.staminaBarBg);

    // Stamina bar fill
    this.staminaBar = this.scene.add.rectangle(x + 30, y + 4, 120, 8, 0xff8c00).setOrigin(0, 0.5);
    this.container.add(this.staminaBar);

    // Stamina text
    this.staminaText = this.scene.add.text(x + 30 + 124, y, '', { fontSize: '14px', color: '#ff8c00' });
    this.container.add(this.staminaText);

    y += 16;

    // Mana label
    const manaLabel = this.scene.add.text(x, y, 'MP', { fontSize: '14px', color: '#6a5acd' });
    this.container.add(manaLabel);

    // Mana bar bg
    this.manaBarBg = this.scene.add.rectangle(x + 30 + 60, y + 4, 120, 8, 0x333333).setOrigin(0.5);
    this.container.add(this.manaBarBg);

    // Mana bar fill
    this.manaBar = this.scene.add.rectangle(x + 30, y + 4, 120, 8, 0x6a5acd).setOrigin(0, 0.5);
    this.container.add(this.manaBar);

    // Mana text
    this.manaText = this.scene.add.text(x + 30 + 124, y, '', { fontSize: '14px', color: '#6a5acd' });
    this.container.add(this.manaText);
  }

  private createEnemySection(): void {
    const x = 520;
    const y = 8;

    // Enemy name
    this.enemyNameText = this.scene.add.text(x, y, '', { fontSize: '16px', color: '#ffffff' });
    this.container.add(this.enemyNameText);

    // Enemy HP bar bg
    this.enemyHpBarBg = this.scene.add.rectangle(x + 80, y + 24, 160, 12, 0x333333).setOrigin(0.5);
    this.container.add(this.enemyHpBarBg);

    // Enemy HP bar fill
    this.enemyHpBar = this.scene.add.rectangle(x, y + 24, 160, 12, 0xff0000).setOrigin(0, 0.5);
    this.container.add(this.enemyHpBar);

    // Enemy HP text
    this.enemyHpText = this.scene.add.text(x + 164, y + 18, '', { fontSize: '14px', color: '#ffffff' });
    this.container.add(this.enemyHpText);
  }

  private createCooldownArc(): void {
    this.cooldownGraphics = this.scene.add.graphics();
    this.container.add(this.cooldownGraphics);

    this.cooldownText = this.scene.add.text(400, 28, '', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.container.add(this.cooldownText);
  }

  /**
   * Update all HUD elements from current combat state.
   */
  update(state: CombatState, heroCooldown: number, heroMaxCooldown: number): void {
    // Hero HP
    const hpPct = Math.max(0, state.heroHP / state.heroMaxHP);
    this.hpBar.width = 160 * hpPct;
    if (hpPct > 0.5) this.hpBar.setFillStyle(0x00ff00);
    else if (hpPct > 0.25) this.hpBar.setFillStyle(0xffaa00);
    else this.hpBar.setFillStyle(0xff0000);
    this.hpText.setText(`${Math.ceil(state.heroHP)}/${state.heroMaxHP}`);

    // Stamina
    const staPct = Math.max(0, state.heroStamina / state.heroMaxStamina);
    this.staminaBar.width = 120 * staPct;
    this.staminaText.setText(`${Math.ceil(state.heroStamina)}/${state.heroMaxStamina}`);

    // Mana
    const manaPct = Math.max(0, state.heroMana / state.heroMaxMana);
    this.manaBar.width = 120 * manaPct;
    this.manaText.setText(`${Math.ceil(state.heroMana)}/${state.heroMaxMana}`);

    // Enemy
    this.enemyNameText.setText(state.enemyName);
    const enemyHpPct = Math.max(0, state.enemyHP / state.enemyMaxHP);
    this.enemyHpBar.width = 160 * enemyHpPct;
    this.enemyHpText.setText(`${Math.ceil(state.enemyHP)}/${state.enemyMaxHP}`);

    // Cooldown arc
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

  destroy(): void {
    this.container.destroy(true);
  }
}
