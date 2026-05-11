// CombatHUD -- redesigned glassmorphism combat overlay.
// Hero panel (left) | Cooldown arc (center) | Enemy panel (right)

import type { CombatState } from '../systems/combat/CombatState';
import { FONTS, SHADOWBLADE_PALETTE } from './StyleConstants';

/**
 * Phase 9 (Design v2): Pure visibility logic for class-conditional HUD widgets.
 *
 * Extracted so the toggle logic is unit-testable without a Phaser scene.
 * Returns flags only -- callers apply them to GameObject.setVisible().
 */
export interface HUDVisibilityInput {
  heroClassName?: string;
  stealthCharges?: number;
}
export interface HUDVisibility {
  showCP: boolean;
  showStealth: boolean;
  staminaLabel: string;
}
export function computeHUDVisibility(state: HUDVisibilityInput): HUDVisibility {
  const isSB = state.heroClassName === 'shadowblade';
  const stealth = state.stealthCharges ?? 0;
  return {
    showCP: isSB,
    showStealth: isSB && stealth > 0,
    staminaLabel: isSB ? '⚡ ENG' : '⚡ STA',
  };
}

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
  private targetHeroHp     = 0;
  private displayedStamina = 0;
  private targetStamina    = 0;
  private displayedMana    = 0;
  private targetMana       = 0;
  private displayedEnemyHp = 0;
  private targetEnemyHp    = 0;

  private hpTween?:      Phaser.Tweens.Tween;
  private staminaTween?: Phaser.Tweens.Tween;
  private manaTween?:    Phaser.Tweens.Tween;
  private enemyHpTween?: Phaser.Tweens.Tween;

  // ── Phase 9: Shadowblade class-conditional widgets ──────────────
  private staminaMicroLabel!: Phaser.GameObjects.Text;
  private cpPips: Phaser.GameObjects.Arc[] = [];
  private cpLabel!: Phaser.GameObjects.Text;
  private stealthPill!: Phaser.GameObjects.Rectangle;
  private stealthLabel!: Phaser.GameObjects.Text;
  private stealthPulseTween?: Phaser.Tweens.Tween;
  private lastCP = 0;
  private lastStealth = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.buildHeroPanel();
    this.buildEnemyPanel();
    this.buildCooldownArc();
    this.buildComboPointStrip();
    this.buildStealthIndicator();
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

    // Stamina (Shadowblade: label flips to ⚡ ENG in update())
    this.buildBar(bx, by + gap,   BAR_W, 22, 0xf0a020, '⚡ STA');
    this.staminaBar  = this.getLastFill();
    this.staminaMicroLabel = this._lastMicroLabel;
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
    this._lastMicroLabel = lbl;

    // Background asset (frame)
    const bg = s.add.image(x + w / 2, y, 'healthbar').setDisplaySize(w, h);
    // Fill starts empty so the first hud.update() frame can grow it from 0
    // without a visible "full bar then snap to value" flash on combat entry.
    const padX = 8;
    const padY = 4;
    const fill = s.add.rectangle(x + padX, y, 0, h - padY * 2, color).setOrigin(0, 0.5);

    this.container.add([bg, fill]);
    // Store fill reference via a small hack — expose it to the calling scope
    this._lastFill = fill;
  }

  private _lastFill!: Phaser.GameObjects.Rectangle;
  private _lastMicroLabel!: Phaser.GameObjects.Text;
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
    this.enemyHpBar = s.add.rectangle(bx + padX, by, 0, 28 - padY * 2, 0xdd2222).setOrigin(0, 0.5);

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

  // ── Phase 9: Combo Point pip strip (Shadowblade-only) ──────────
  // 5 pips × 12px diameter + 4 × 4px gap = 76px strip. Sits inside the
  // left panel (238×132) below the mana bar. UI-SPEC §Spacing.
  private buildComboPointStrip(): void {
    const s = this.scene;
    const PIP_DIAMETER = 12;
    const PIP_GAP = 4;
    const STRIP_X = LP.x + 16;    // inset from left panel edge
    const STRIP_Y = LP.y + 122;   // below mana bar (mana bar ends ~y=120)
    this.cpPips = [];
    for (let i = 0; i < 5; i++) {
      const x = STRIP_X + i * (PIP_DIAMETER + PIP_GAP) + PIP_DIAMETER / 2;
      const pip = s.add.circle(x, STRIP_Y, PIP_DIAMETER / 2, SHADOWBLADE_PALETTE.comboPointEmpty);
      pip.setStrokeStyle(1, SHADOWBLADE_PALETTE.comboPoint, 1);
      pip.setVisible(false);
      this.container.add(pip);
      this.cpPips.push(pip);
    }
    // CP count label (11px bold white, 2px black stroke -- matches buildBarLabel)
    this.cpLabel = s.add.text(STRIP_X + 5 * (PIP_DIAMETER + PIP_GAP) + 4, STRIP_Y, 'CP 0/5', {
      fontFamily: FF, fontSize: '11px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.cpLabel.setVisible(false);
    this.container.add(this.cpLabel);
  }

  // ── Phase 9: Stealth indicator pill (Shadowblade-only) ─────────
  private buildStealthIndicator(): void {
    const s = this.scene;
    const PILL_W = 76, PILL_H = 22;
    const X = LP.x + LP.w - PILL_W - 16;  // right-anchored inside left panel
    const Y = LP.y + 122;                  // same row as CP strip
    this.stealthPill = s.add.rectangle(X + PILL_W / 2, Y, PILL_W, PILL_H, SHADOWBLADE_PALETTE.stealth, 0.4);
    this.stealthPill.setStrokeStyle(1, SHADOWBLADE_PALETTE.stealth, 1);
    this.stealthPill.setVisible(false);
    this.container.add(this.stealthPill);

    this.stealthLabel = s.add.text(X + PILL_W / 2, Y, 'STEALTH ×0', {
      fontFamily: FF, fontSize: '11px', fontStyle: 'bold',
      color: '#c8a8ff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    this.stealthLabel.setVisible(false);
    this.container.add(this.stealthLabel);
  }

  // ── Phase 9: Shadowblade widget update (called from update()) ──
  private updateShadowbladeWidgets(state: CombatState): void {
    const vis = computeHUDVisibility({
      heroClassName: state.heroClass,
      stealthCharges: state.stealthCharges,
    });

    // Stamina micro-label swap (Energy flavor when Shadowblade)
    if (this.staminaMicroLabel) this.staminaMicroLabel.setText(vis.staminaLabel);

    // CP pip strip visibility + fill
    this.cpPips.forEach(p => p.setVisible(vis.showCP));
    this.cpLabel.setVisible(vis.showCP);
    if (vis.showCP) {
      const cp = state.comboPoints ?? 0;
      const cap = state.comboPointsCap ?? 5;
      for (let i = 0; i < this.cpPips.length; i++) {
        const filled = i < cp;
        this.cpPips[i].setFillStyle(filled ? SHADOWBLADE_PALETTE.comboPoint : SHADOWBLADE_PALETTE.comboPointEmpty);
      }
      this.cpLabel.setText(`CP ${cp}/${cap}`);
      // Motion: pip fill 180ms scale pulse on newly-filled pip(s)
      if (cp > this.lastCP) {
        for (let i = this.lastCP; i < cp && i < this.cpPips.length; i++) {
          const pip = this.cpPips[i];
          this.scene.tweens.add({ targets: pip, scale: 1.15, duration: 90, yoyo: true });
        }
      } else if (cp < this.lastCP) {
        // Drain: left-to-right white flash with 60ms stagger, 240ms total
        for (let i = 0; i < this.lastCP; i++) {
          const pip = this.cpPips[i];
          this.scene.tweens.add({
            targets: pip, alpha: 0.3, duration: 60, yoyo: true, delay: i * 60,
          });
        }
      }
      this.lastCP = cp;
    } else {
      this.lastCP = 0;
    }

    // Stealth indicator visibility + alpha pulse
    this.stealthPill.setVisible(vis.showStealth);
    this.stealthLabel.setVisible(vis.showStealth);
    if (vis.showStealth) {
      const charges = state.stealthCharges ?? 0;
      this.stealthLabel.setText(`STEALTH ×${charges}`);
      // 200ms fade-in on transition from 0
      if (this.lastStealth === 0) {
        this.stealthPill.setAlpha(0);
        this.stealthLabel.setAlpha(0);
        this.scene.tweens.add({
          targets: [this.stealthPill, this.stealthLabel],
          alpha: 1, duration: 200,
        });
      }
      // Maintain a 0.6Hz pulse (1670ms cycle) on alpha 0.7 ↔ 1.0 if not already running
      if (!this.stealthPulseTween || !this.stealthPulseTween.isPlaying()) {
        this.stealthPulseTween = this.scene.tweens.add({
          targets: this.stealthPill,
          alpha: { from: 0.7, to: 1.0 },
          duration: 833, yoyo: true, repeat: -1,
        });
      }
      this.lastStealth = charges;
    } else {
      if (this.stealthPulseTween) {
        this.stealthPulseTween.stop();
        this.stealthPulseTween = undefined;
      }
      this.lastStealth = 0;
    }
  }

  // ── Public update ──────────────────────────────────────────────

  update(state: CombatState, heroCooldown: number, heroMaxCooldown: number): void {
    // Hero bars. Track displayed* against the tween *target* (updated at
    // tween start) so consecutive update() ticks during an in-flight tween
    // don't restart it every frame and leave the value stuck at zero.
    const newHP = Math.ceil(state.heroHP);
    if (newHP !== this.targetHeroHp) {
      const from = this.displayedHeroHp;
      this.targetHeroHp = newHP;
      this.tweenBar('hp', from, newHP, state.heroMaxHP,
        this.hpBar, this.hpText,
        (r) => r > 0.5 ? 0x22cc44 : r > 0.25 ? 0xf0a020 : 0xff3333);
    }

    const newSTA = Math.ceil(state.heroStamina);
    if (newSTA !== this.targetStamina) {
      const from = this.displayedStamina;
      this.targetStamina = newSTA;
      this.tweenBar('stamina', from, newSTA, state.heroMaxStamina,
        this.staminaBar, this.staminaText, () => 0xf0a020);
    }

    const newMP = Math.ceil(state.heroMana);
    if (newMP !== this.targetMana) {
      const from = this.displayedMana;
      this.targetMana = newMP;
      this.tweenBar('mana', from, newMP, state.heroMaxMana,
        this.manaBar, this.manaText, () => 0x9966ff);
    }

    // Enemy
    this.enemyNameText.setText(state.enemyName);
    const newEHP = Math.ceil(state.enemyHP);
    if (newEHP !== this.targetEnemyHp) {
      const from = this.displayedEnemyHp;
      this.targetEnemyHp = newEHP;
      this.tweenBar('enemyHp', from, newEHP, state.enemyMaxHP,
        this.enemyHpBar, this.enemyHpText, () => 0xdd2222);
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

    // Phase 9 (Design v2): class-conditional widgets driven by CombatState.
    this.updateShadowbladeWidgets(state);
  }

  // ── Tween helper ───────────────────────────────────────────────

  private tweenBar(
    key: 'hp' | 'stamina' | 'mana' | 'enemyHp',
    from: number, to: number, max: number,
    bar: Phaser.GameObjects.Rectangle,
    text: Phaser.GameObjects.Text,
    getColor: (ratio: number) => number,
  ): void {
    const map: Record<string, Phaser.Tweens.Tween | undefined> = {
      hp: this.hpTween, stamina: this.staminaTween,
      mana: this.manaTween, enemyHp: this.enemyHpTween,
    };
    map[key]?.stop();

    const tween = this.scene.tweens.addCounter({
      from, to, duration: 280,
      onUpdate: (t) => {
        const v = Math.round(t.getValue() ?? 0);
        const r = Math.max(0, v / max);
        bar.width = Math.max(0, (BAR_W - 16) * r); // 16 = padX * 2
        bar.setFillStyle(getColor(r));
        text.setText(`${v}/${max}`);
        
        // Keep tracking the visual value for the next 'from' calculation
        if (key === 'hp') this.displayedHeroHp = v;
        else if (key === 'stamina') this.displayedStamina = v;
        else if (key === 'mana') this.displayedMana = v;
        else this.displayedEnemyHp = v;
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
