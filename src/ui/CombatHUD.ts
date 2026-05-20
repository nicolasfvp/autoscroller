// CombatHUD -- redesigned glassmorphism combat overlay.
// Hero panel (left) | Cooldown arc (center) | Enemy panel (right)

import type { CombatState } from '../systems/combat/CombatState';
import { FONTS, SHADOWBLADE_PALETTE } from './StyleConstants';
import { computeHeroChips, computeEnemyChips, type EffectChip } from './EffectIcons';

/**
 * Pure visibility logic for HUD widgets. Extracted so the toggle logic is
 * unit-testable without a Phaser scene. Returns flags only -- callers apply
 * them to GameObject.setVisible().
 */
export interface HUDVisibilityInput {
  heroClassName?: string;
}
export interface HUDVisibility {
  staminaLabel: string;
}
export function computeHUDVisibility(_state: HUDVisibilityInput): HUDVisibility {
  return {
    staminaLabel: '⚡ STA',
  };
}

const FF = FONTS.family;
const STROKE = { stroke: '#000000', strokeThickness: 3 };

// Panel geometry
const LP = { x: 8,   y: 8,  w: 238, h: 188 };   // Hero (left) — armor row + STR/VIT/DEX/INT/SPI row
const RP = { x: 554, y: 8,  w: 238, h: 70 };    // Enemy (right, tightly packed)
const BAR_W = LP.w - 28;                         // 210px bar width

// Status-chip row geometry (effect icons row under each panel)
const CHIP_POOL_SIZE = 10;
const CHIP_HEIGHT = 20;
const CHIP_GAP = 4;
const CHIP_ROW_GAP = 22;
const HERO_CHIPS = { x: LP.x + 4, y: LP.y + LP.h + 6, maxWidth: LP.w - 8 };
const ENEMY_CHIPS = { x: RP.x + 4, y: RP.y + RP.h + 6, maxWidth: RP.w - 8 };

interface ChipDisplay {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
}

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

  // Hero armor readout (below HP). Shown only when armor > 0.
  private armorIcon!:   Phaser.GameObjects.Text;
  private armorValue!: Phaser.GameObjects.Text;

  // Hero attribute readouts (STR/VIT/DEX/INT/SPI). Live-update from CombatState.
  private statTexts: { [k: string]: Phaser.GameObjects.Text } = {};
  private displayedStats: Record<string, number> = { str: -1, vit: -1, dex: -1, int: -1, spi: -1 };

  // Enemy
  private enemyNameText!: Phaser.GameObjects.Text;
  private enemyHpBar!:    Phaser.GameObjects.Rectangle;
  private enemyHpText!:   Phaser.GameObjects.Text;

  // Cooldown arc
  private cooldownGraphics!: Phaser.GameObjects.Graphics;
  private cooldownText!:     Phaser.GameObjects.Text;

  // Status effect chip pools (one row per side, pre-allocated)
  private heroChipPool: ChipDisplay[] = [];
  private enemyChipPool: ChipDisplay[] = [];

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

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.buildHeroPanel();
    this.buildEnemyPanel();
    this.buildCooldownArc();
    this.buildChipPools();
  }

  // ── Hero panel ─────────────────────────────────────────────────

  private buildHeroPanel(): void {
    const s = this.scene;

    // Use the healthbar background asset with a blue filter as requested by the user
    const lpBg = s.add.image(LP.x + LP.w / 2, LP.y + LP.h / 2, 'healthbar').setDisplaySize(LP.w, LP.h);
    lpBg.setTint(0xaaaaff); // Blue filter
    this.container.add(lpBg);

    const bx = LP.x + 14;   // bar left edge
    const hpY     = LP.y + 38;
    const armorY  = LP.y + 66;
    const staY    = LP.y + 92;
    const mpY     = LP.y + 124;

    // HP
    this.buildBar(bx, hpY, BAR_W, 28, 0x22cc44, '♥ HP');
    this.hpBar  = this.getLastFill();
    this.hpText = this.buildBarLabel(bx + BAR_W / 2, hpY);

    // Armor (icon + numeric value, no bar — armor has no max).
    this.armorIcon = s.add.text(bx + 4, armorY, '🛡 ARMOR', {
      fontFamily: FF, fontSize: '11px', fontStyle: 'bold',
      color: '#9fd6ff', ...STROKE, strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.armorValue = s.add.text(bx + BAR_W - 4, armorY, '0', {
      fontFamily: FF, fontSize: '14px', fontStyle: 'bold',
      color: '#dbeeff', ...STROKE, strokeThickness: 2,
    }).setOrigin(1, 0.5);
    this.armorIcon.setVisible(false);
    this.armorValue.setVisible(false);
    this.container.add([this.armorIcon, this.armorValue]);

    // Stamina
    this.buildBar(bx, staY, BAR_W, 22, 0xf0a020, '⚡ STA');
    this.staminaBar  = this.getLastFill();
    this.staminaText = this.buildBarLabel(bx + BAR_W / 2, staY);

    // Mana
    this.buildBar(bx, mpY, BAR_W, 22, 0x9966ff, '✦ MP');
    this.manaBar  = this.getLastFill();
    this.manaText = this.buildBarLabel(bx + BAR_W / 2, mpY);

    // Attribute row: STR / VIT / DEX / INT / SPI
    const statRowY = LP.y + 164;
    const stats: Array<{ key: 'str' | 'vit' | 'dex' | 'int' | 'spi'; code: string; color: number }> = [
      { key: 'str', code: 'STR', color: 0xff8844 },
      { key: 'vit', code: 'VIT', color: SHADOWBLADE_PALETTE.vit },
      { key: 'dex', code: 'DEX', color: SHADOWBLADE_PALETTE.dex },
      { key: 'int', code: 'INT', color: SHADOWBLADE_PALETTE.int },
      { key: 'spi', code: 'SPI', color: SHADOWBLADE_PALETTE.spi },
    ];
    const cellW = BAR_W / stats.length;
    stats.forEach((stat, i) => {
      const cellX = bx + cellW * i;
      const codeText = s.add.text(cellX + 4, statRowY, stat.code, {
        fontFamily: FF, fontSize: '10px', fontStyle: 'bold',
        color: '#' + stat.color.toString(16).padStart(6, '0'),
        ...STROKE, strokeThickness: 2,
      }).setOrigin(0, 0.5);
      const valText = s.add.text(cellX + cellW - 4, statRowY, '0', {
        fontFamily: FF, fontSize: '12px', fontStyle: 'bold',
        color: '#ffffff', ...STROKE, strokeThickness: 2,
      }).setOrigin(1, 0.5);
      this.container.add([codeText, valText]);
      this.statTexts[stat.key] = valText;
    });
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

  // ── Status-effect chips ────────────────────────────────────────

  private buildChipPools(): void {
    for (let i = 0; i < CHIP_POOL_SIZE; i++) {
      this.heroChipPool.push(this.buildChip());
      this.enemyChipPool.push(this.buildChip());
    }
  }

  private buildChip(): ChipDisplay {
    const s = this.scene;
    const c = s.add.container(0, 0).setVisible(false);
    const bg = s.add.rectangle(0, 0, 50, CHIP_HEIGHT, 0x0a0a1a, 0.78)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x4a9eff, 0.5);
    const icon = s.add.text(4, 0, '', {
      fontFamily: FF, fontSize: '13px',
      color: '#ffffff',
    }).setOrigin(0, 0.5);
    const label = s.add.text(22, 0, '', {
      fontFamily: FF, fontSize: '11px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0.5);
    c.add([bg, icon, label]);
    this.container.add(c);
    return { container: c, bg, icon, label };
  }

  private layoutChips(
    chips: EffectChip[],
    pool: ChipDisplay[],
    baseX: number,
    baseY: number,
    maxWidth: number,
  ): void {
    let x = 0;
    let row = 0;
    for (let i = 0; i < pool.length; i++) {
      const slot = pool[i];
      const chip = chips[i];
      if (!chip) {
        slot.container.setVisible(false);
        continue;
      }
      slot.icon.setText(chip.icon);
      slot.label.setText(chip.label);
      slot.label.setColor(chip.color);
      const w = Math.max(36, 22 + slot.label.width + 6);
      slot.bg.width = w;
      if (x > 0 && x + w > maxWidth) {
        x = 0;
        row += 1;
      }
      slot.container.setPosition(baseX + x, baseY + row * CHIP_ROW_GAP);
      slot.container.setVisible(true);
      x += w + CHIP_GAP;
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

    // Armor readout: hidden when zero, shown otherwise.
    const armor = Math.max(0, Math.floor(state.heroDefense ?? 0));
    const armorVisible = armor > 0;
    this.armorIcon.setVisible(armorVisible);
    this.armorValue.setVisible(armorVisible);
    if (armorVisible) this.armorValue.setText(String(armor));

    // Attribute readouts.
    const attrValues: Record<string, number> = {
      str: state.heroStrength ?? 0,
      vit: state.heroVitality ?? 0,
      dex: state.heroDexterity ?? 0,
      int: state.heroIntellect ?? 0,
      spi: state.heroSpirit ?? 0,
    };
    for (const key of Object.keys(attrValues)) {
      const v = attrValues[key];
      if (v !== this.displayedStats[key]) {
        this.displayedStats[key] = v;
        this.statTexts[key]?.setText(String(v));
      }
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

    // Status effect chips (auras, stacks, triggered effects)
    this.layoutChips(computeHeroChips(state), this.heroChipPool, HERO_CHIPS.x, HERO_CHIPS.y, HERO_CHIPS.maxWidth);
    this.layoutChips(computeEnemyChips(state), this.enemyChipPool, ENEMY_CHIPS.x, ENEMY_CHIPS.y, ENEMY_CHIPS.maxWidth);

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
    // Stop in-flight stat tweens before tearing down the container. Without
    // this, a mid-tween shutdown calls onUpdate after the Rectangle has been
    // destroyed and throws "cannot read property of undefined".
    this.hpTween?.stop();
    this.staminaTween?.stop();
    this.manaTween?.stop();
    this.enemyHpTween?.stop();
    this.hpTween = undefined;
    this.staminaTween = undefined;
    this.manaTween = undefined;
    this.enemyHpTween = undefined;

    this.container.destroy(true);
  }
}
