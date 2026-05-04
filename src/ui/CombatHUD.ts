// CombatHUD -- redesigned glassmorphism combat overlay.
// Hero panel (left) | Cooldown arc (center) | Enemy panel (right)

import type { CombatState } from '../systems/combat/CombatState';
import { FONTS } from './StyleConstants';

const FF = FONTS.family;
const STROKE = { stroke: '#000000', strokeThickness: 3 };

// Panel geometry
const LP = { x: 8,   y: 8,  w: 238, h: 132 };   // Hero (left)
const RP = { x: 554, y: 8,  w: 238, h: 70 };    // Enemy (right, tightly packed)
const BAR_W = LP.w - 28;                         // 210px bar width

export class CombatHUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;

  // Hero bars
  private hpBar!:      Phaser.GameObjects.Rectangle;
  private staminaBar!: Phaser.GameObjects.Rectangle;
  private manaBar!:    Phaser.GameObjects.Rectangle;
  private hpText!:     Phaser.GameObjects.Text;
  private staminaText!:Phaser.GameObjects.Text;
  private manaText!:   Phaser.GameObjects.Text;

  // Enemy
  private enemyNameText!: Phaser.GameObjects.Text;
  private enemyHpBar!:    Phaser.GameObjects.Rectangle;
  private enemyHpText!:   Phaser.GameObjects.Text;

  // Cooldown arc
  private cooldownGraphics!: Phaser.GameObjects.Graphics;
  private cooldownText!:     Phaser.GameObjects.Text;

  // Display values (for tween delta checks)
  private displayedHeroHp  = 0;
  private displayedStamina = 0;
  private displayedMana    = 0;
  private displayedEnemyHp = 0;

  private heroMaxHP      = 1;
  private heroMaxStamina = 1;
  private heroMaxMana    = 1;
  private enemyMaxHP     = 1;

  private hpTween?:      Phaser.Tweens.Tween;
  private staminaTween?: Phaser.Tweens.Tween;
  private manaTween?:    Phaser.Tweens.Tween;
  private enemyHpTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.buildHeroPanel();
    this.buildEnemyPanel();
    this.buildCooldownArc();
  }

  // ── Hero panel ─────────────────────────────────────────────────

  private buildHeroPanel(): void {
    const s = this.scene;

    // Use the healthbar background asset with a blue filter as requested by the user
    const lpBg = s.add.image(LP.x + LP.w / 2, LP.y + LP.h / 2, 'healthbar').setDisplaySize(LP.w, LP.h);
    lpBg.setTint(0xaaaaff); // Blue filter
    this.container.add(lpBg);

    const bx = LP.x + 14;   // bar left edge
    const by = LP.y + 38;   // first bar center Y
    const gap = 36;

    // HP
    this.buildBar(bx, by,         BAR_W, 28, 0x22cc44, '♥ HP');
    this.hpBar  = this.getLastFill();
    this.hpText = this.buildBarLabel(bx + BAR_W / 2, by);

    // Stamina
    this.buildBar(bx, by + gap,   BAR_W, 22, 0xf0a020, '⚡ STA');
    this.staminaBar  = this.getLastFill();
    this.staminaText = this.buildBarLabel(bx + BAR_W / 2, by + gap);

    // Mana
    this.buildBar(bx, by + gap*2, BAR_W, 22, 0x9966ff, '✦ MP');
    this.manaBar  = this.getLastFill();
    this.manaText = this.buildBarLabel(bx + BAR_W / 2, by + gap * 2);
  }

  private buildBar(
    x: number, y: number, w: number, h: number,
    color: number, label: string,
  ): void {
    const s = this.scene;

    // Label (positioned cleanly above the left side of the bar)
    const lbl = s.add.text(x + 4, y - h / 2 - 2, label, {
      fontFamily: FF, fontSize: '10px', fontStyle: 'bold',
      color: '#dddddd', ...STROKE, strokeThickness: 2,
    }).setOrigin(0, 1);
    this.container.add(lbl);

    // Background asset (frame)
    const bg = s.add.image(x + w / 2, y, 'healthbar').setDisplaySize(w, h);
    // Fill (padded to fit inside the well, revealing golden corners/borders)
    const padX = 8;
    const padY = 4;
    const fill = s.add.rectangle(x + padX, y, w - padX * 2, h - padY * 2, color).setOrigin(0, 0.5);

    this.container.add([bg, fill]);
    // Store fill reference via a small hack — expose it to the calling scope
    this._lastFill = fill;
  }

  private _lastFill!: Phaser.GameObjects.Rectangle;
  private getLastFill() { return this._lastFill; }

  private buildBarLabel(cx: number, cy: number): Phaser.GameObjects.Text {
    const t = this.scene.add.text(cx, cy, '', {
      fontFamily: FF, fontSize: '11px', fontStyle: 'bold',
      color: '#ffffff', ...STROKE, strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    this.container.add(t);
    return t;
  }

  // ── Enemy panel ────────────────────────────────────────────────

  private buildEnemyPanel(): void {
    const s = this.scene;

    // Enemy panel background using achievements asset, tinted red
    const rpBg = s.add.image(RP.x + RP.w / 2, RP.y + RP.h / 2, 'achievements_bg').setDisplaySize(RP.w, RP.h);
    rpBg.setTint(0xffbbbb);
    this.container.add(rpBg);

    // Enemy name
    this.enemyNameText = s.add.text(RP.x + RP.w / 2, RP.y + 18, '', {
      fontFamily: FF, fontSize: '18px', fontStyle: 'bold',
      color: '#ff6666', ...STROKE,
    }).setOrigin(0.5, 0.5);
    this.container.add(this.enemyNameText);

    // Enemy HP bar
    const bx = RP.x + 14;
    const by = RP.y + 48;
    const padX = 8;
    const padY = 4;
    const ebg = s.add.image(bx + BAR_W / 2, by, 'healthbar').setDisplaySize(BAR_W, 28);
    this.enemyHpBar = s.add.rectangle(bx + padX, by, BAR_W - padX * 2, 28 - padY * 2, 0xdd2222).setOrigin(0, 0.5);

    this.enemyHpText = s.add.text(bx + BAR_W / 2, by, '', {
      fontFamily: FF, fontSize: '11px', fontStyle: 'bold',
      color: '#ffffff', ...STROKE, strokeThickness: 2,
    }).setOrigin(0.5, 0.5);

    this.container.add([ebg, this.enemyHpBar, this.enemyHpText]);

    // "♟ HP" micro-label above bar
    this.container.add(s.add.text(bx, by - 9, '♥ HP', {
      fontFamily: FF, fontSize: '9px', color: '#aa4444', ...STROKE, strokeThickness: 2,
    }).setOrigin(0, 1));
  }

  // ── Cooldown arc ───────────────────────────────────────────────

  private buildCooldownArc(): void {
    const s = this.scene;
    this.cooldownGraphics = s.add.graphics();
    this.container.add(this.cooldownGraphics);

    this.cooldownText = s.add.text(400, 48, '', {
      fontFamily: FF, fontSize: '15px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.container.add(this.cooldownText);
  }

  // ── Public update ──────────────────────────────────────────────

  update(state: CombatState, heroCooldown: number, heroMaxCooldown: number): void {
    this.heroMaxHP      = state.heroMaxHP;
    this.heroMaxStamina = state.heroMaxStamina;
    this.heroMaxMana    = state.heroMaxMana;
    this.enemyMaxHP     = state.enemyMaxHP;

    // Hero bars
    const newHP = Math.ceil(state.heroHP);
    if (newHP !== this.displayedHeroHp) {
      this.tweenBar('hp', this.displayedHeroHp, newHP, state.heroMaxHP,
        this.hpBar, this.hpText,
        (r) => r > 0.5 ? 0x22cc44 : r > 0.25 ? 0xf0a020 : 0xff3333,
        () => { this.displayedHeroHp = newHP; });
    }

    const newSTA = Math.ceil(state.heroStamina);
    if (newSTA !== this.displayedStamina) {
      this.tweenBar('stamina', this.displayedStamina, newSTA, state.heroMaxStamina,
        this.staminaBar, this.staminaText, () => 0xf0a020,
        () => { this.displayedStamina = newSTA; });
    }

    const newMP = Math.ceil(state.heroMana);
    if (newMP !== this.displayedMana) {
      this.tweenBar('mana', this.displayedMana, newMP, state.heroMaxMana,
        this.manaBar, this.manaText, () => 0x9966ff,
        () => { this.displayedMana = newMP; });
    }

    // Enemy
    this.enemyNameText.setText(state.enemyName);
    const newEHP = Math.ceil(state.enemyHP);
    if (newEHP !== this.displayedEnemyHp) {
      this.tweenBar('enemyHp', this.displayedEnemyHp, newEHP, state.enemyMaxHP,
        this.enemyHpBar, this.enemyHpText, () => 0xdd2222,
        () => { this.displayedEnemyHp = newEHP; });
    }

    // Cooldown arc
    this.cooldownGraphics.clear();
    if (heroMaxCooldown > 0) {
      const progress = Math.max(0, Math.min(1, 1 - heroCooldown / heroMaxCooldown));
      const cx = 400; const cy = 48; const R = 30;

      // Dark bg ring
      this.cooldownGraphics.fillStyle(0x0a0a1a, 0.75);
      this.cooldownGraphics.fillCircle(cx, cy, R + 3);
      this.cooldownGraphics.lineStyle(1.5, 0x4a9eff, 0.4);
      this.cooldownGraphics.strokeCircle(cx, cy, R + 3);

      // Gray empty arc
      this.cooldownGraphics.fillStyle(0x222233, 0.8);
      this.cooldownGraphics.fillCircle(cx, cy, R);

      // Gold filled arc
      if (progress > 0) {
        this.cooldownGraphics.fillStyle(0xffd700, progress >= 1 ? 1.0 : 0.85);
        this.cooldownGraphics.slice(cx, cy, R,
          -Math.PI / 2,
          -Math.PI / 2 + 2 * Math.PI * progress,
          false,
        );
        this.cooldownGraphics.fillPath();
      }

      // Center dot
      this.cooldownGraphics.fillStyle(0x0a0a1a, 1);
      this.cooldownGraphics.fillCircle(cx, cy, 5);

      const remaining = Math.max(0, heroCooldown / 1000);
      this.cooldownText.setText(remaining > 0 ? remaining.toFixed(1) : '▶');
    }
  }

  // ── Tween helper ───────────────────────────────────────────────

  private tweenBar(
    key: 'hp' | 'stamina' | 'mana' | 'enemyHp',
    from: number, to: number, max: number,
    bar: Phaser.GameObjects.Rectangle,
    text: Phaser.GameObjects.Text,
    getColor: (ratio: number) => number,
    onComplete: () => void,
  ): void {
    const map: Record<string, Phaser.Tweens.Tween | undefined> = {
      hp: this.hpTween, stamina: this.staminaTween,
      mana: this.manaTween, enemyHp: this.enemyHpTween,
    };
    map[key]?.stop();
    onComplete();

    const tween = this.scene.tweens.addCounter({
      from, to, duration: 280,
      onUpdate: (t) => {
        const v = Math.round(t.getValue());
        const r = Math.max(0, v / max);
        bar.width = Math.max(0, (BAR_W - 16) * r); // 16 = padX * 2
        bar.setFillStyle(getColor(r));
        text.setText(`${v}/${max}`);
      },
      onComplete: () => {
        const r = Math.max(0, to / max);
        bar.width = Math.max(0, (BAR_W - 16) * r);
        bar.setFillStyle(getColor(r));
        text.setText(`${to}/${max}`);
      },
    });

    if (key === 'hp')      this.hpTween = tween;
    else if (key === 'stamina') this.staminaTween = tween;
    else if (key === 'mana')    this.manaTween    = tween;
    else                        this.enemyHpTween = tween;
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
