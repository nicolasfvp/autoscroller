// CombatHUD -- redesigned glassmorphism combat overlay.
// Hero panel (left) | Cooldown arc (center) | Enemy panel (right)

import type { CombatState } from '../systems/combat/CombatState';
import { FONTS } from './StyleConstants';
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

// Panel geometry
const LP       = { x: 8,   y: 8, w: 230, h: 131 };  // Hero (left) — sized to status_panel.png
const RP       = { x: 532, y: 8, w: 260, h: 56  };  // Enemy (right, symmetric width)
const ICON_COL = 53;                                  // dark-slot left offset (px analysis: 52.8)
const BAR_W    = 172;                                 // dark-slot width  (px analysis: 172.1)
const E_BAR_W  = RP.w - 28;                          // 232px enemy bar width

// Status-chip row geometry (effect icons row under each panel)
const CHIP_POOL_SIZE = 10;
const CHIP_HEIGHT = 20;
const CHIP_GAP = 4;
const CHIP_ROW_GAP = 22;
const HERO_CHIPS = { x: LP.x + 4, y: LP.y + LP.h + 22, maxWidth: LP.w - 8 };
const ENEMY_CHIPS = { x: RP.x + 4, y: RP.y + RP.h + 6, maxWidth: RP.w - 8 };

interface ChipDisplay {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  /** Current tooltip string for this slot (updated each layout pass). */
  tooltip: string;
}

// Shared hover tooltip geometry.
const TOOLTIP_DEPTH = 200;       // above the HUD container (depth 100)
const TOOLTIP_MAX_W = 220;

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

  // Shared hover tooltip for status chips (lazy-shown on pointerover).
  private chipTooltipBg!: Phaser.GameObjects.Rectangle;
  private chipTooltipText!: Phaser.GameObjects.Text;

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
    this.buildChipTooltip();
    this.buildChipPools();
  }

  // ── Chip hover tooltip ─────────────────────────────────────────
  // A single shared bg+text pair, hidden by default. Reused by every chip so
  // we don't allocate per-chip tooltip objects. Lives at a depth above the
  // HUD container; positioned just under the hovered chip on pointerover.
  private buildChipTooltip(): void {
    const s = this.scene;
    this.chipTooltipBg = s.add.rectangle(0, 0, 10, 10, 0x05050f, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x4a9eff, 0.7)
      .setDepth(TOOLTIP_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);
    this.chipTooltipText = s.add.text(0, 0, '', {
      fontFamily: FF, fontSize: '11px',
      color: '#ffffff', stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: TOOLTIP_MAX_W - 12 },
    })
      .setOrigin(0, 0)
      .setDepth(TOOLTIP_DEPTH + 1)
      .setScrollFactor(0)
      .setVisible(false);
  }

  private showChipTooltip(text: string, chipX: number, chipY: number): void {
    if (!text) return;
    this.chipTooltipText.setText(text);
    const padX = 6;
    const padY = 4;
    const w = Math.min(TOOLTIP_MAX_W, this.chipTooltipText.width + padX * 2);
    const h = this.chipTooltipText.height + padY * 2;
    // Position below the chip; clamp to the canvas so edge chips stay on-screen.
    let tx = chipX;
    let ty = chipY + CHIP_HEIGHT;
    const maxX = (this.scene.scale?.width ?? 800) - w - 2;
    if (tx > maxX) tx = Math.max(2, maxX);
    this.chipTooltipBg.setPosition(tx, ty).setSize(w, h).setVisible(true);
    this.chipTooltipText.setPosition(tx + padX, ty + padY).setVisible(true);
  }

  private hideChipTooltip(): void {
    this.chipTooltipBg.setVisible(false);
    this.chipTooltipText.setVisible(false);
  }

  // ── Hero panel ─────────────────────────────────────────────────

  private buildHeroPanel(): void {
    const s = this.scene;

    // status_panel.png provides the background with baked-in icons per row
    const panelImg = s.textures.exists('status_panel')
      ? s.add.image(LP.x + LP.w / 2, LP.y + LP.h / 2, 'status_panel').setDisplaySize(LP.w, LP.h)
      : s.add.rectangle(LP.x + LP.w / 2, LP.y + LP.h / 2, LP.w, LP.h, 0x080810, 0.88) as unknown as Phaser.GameObjects.Image;
    this.container.add(panelImg);

    // Bar slot geometry derived from the image's icon-cell width (ICON_COL)
    const barX = LP.x + ICON_COL;
    const padX = 0;
    const hpY  = LP.y + 22;   // row 1 centre
    const staY = LP.y + 60;   // row 2 centre
    const mpY  = LP.y + 103;  // row 3 centre

    const makeBar = (y: number, fillColor: number, h: number, valSize: string) => {
      const fill = s.add.rectangle(barX + padX, y, 0, h - 4, fillColor).setOrigin(0, 0.5);
      const val  = s.add.text(barX + BAR_W / 2, y, '', {
        fontFamily: FF, fontSize: valSize, fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 0.5);
      this.container.add([fill, val]);
      return { fill, val };
    };

    const hp  = makeBar(hpY,  0x22cc44, 24, '13px');
    this.hpBar = hp.fill; this.hpText = hp.val;

    const sta = makeBar(staY, 0xf0a020, 20, '12px');
    this.staminaBar = sta.fill; this.staminaText = sta.val;

    const mp  = makeBar(mpY,  0x9966ff, 20, '12px');
    this.manaBar = mp.fill; this.manaText = mp.val;

    // Armor readout placed just below the panel (hidden when armor = 0)
    const armorY = LP.y + LP.h + 6;
    this.armorIcon = s.add.text(LP.x + 10, armorY, '🛡', {
      fontFamily: FF, fontSize: '10px', fontStyle: 'bold',
      color: '#88ccff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setVisible(false);
    this.armorValue = s.add.text(LP.x + 22, armorY, '0', {
      fontFamily: FF, fontSize: '12px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setVisible(false);
    this.container.add([this.armorIcon, this.armorValue]);
  }

  // ── Enemy panel ────────────────────────────────────────────────

  private buildEnemyPanel(): void {
    const s = this.scene;

    // Dark panel background + red accent strip (mirrors hero panel style)
    const rpBg = s.add.rectangle(RP.x + RP.w / 2, RP.y + RP.h / 2, RP.w, RP.h, 0x080810, 0.88);
    rpBg.setStrokeStyle(1.5, 0x4a2a2a);
    this.container.add(rpBg);
    this.container.add(s.add.rectangle(RP.x + RP.w / 2, RP.y + 3, RP.w - 4, 4, 0xdd3333, 0.9));

    // Enemy name
    this.enemyNameText = s.add.text(RP.x + RP.w / 2, RP.y + 16, '', {
      fontFamily: FF, fontSize: '14px', fontStyle: 'bold',
      color: '#ff7777', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5);
    this.container.add(this.enemyNameText);

    // Enemy HP bar
    const bx  = RP.x + 14;
    const by  = RP.y + 38;
    const padX = 5;
    const trough = s.add.rectangle(bx + E_BAR_W / 2, by, E_BAR_W, 22, 0x111122, 1).setStrokeStyle(1, 0x333355);
    this.enemyHpBar  = s.add.rectangle(bx + padX, by, 0, 14, 0xdd2222).setOrigin(0, 0.5);
    this.enemyHpText = s.add.text(bx + E_BAR_W / 2, by, '', {
      fontFamily: FF, fontSize: '12px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5);

    this.container.add([trough, this.enemyHpBar, this.enemyHpText]);

    // "♥ HP" micro-label above bar
    this.container.add(s.add.text(bx, by - 9, '♥ HP', {
      fontFamily: FF, fontSize: '9px', color: '#aa4444', stroke: '#000000', strokeThickness: 2,
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

    const slot: ChipDisplay = { container: c, bg, icon, label, tooltip: '' };

    // Hover affordance: show the chip's tooltip string (e.g. "Burn: …") near
    // the chip. The bg's hit area is updated each layout pass when its width
    // changes (setSize keeps Phaser's input hit-rect in sync).
    bg.setInteractive({ useHandCursor: false });
    bg.on('pointerover', () => {
      // Chip container is at the chip's top-left x; bg origin y is centered, so
      // the chip's visual top is container.y - CHIP_HEIGHT/2.
      this.showChipTooltip(slot.tooltip, c.x, c.y - CHIP_HEIGHT / 2);
    });
    bg.on('pointerout', () => this.hideChipTooltip());

    return slot;
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
        slot.tooltip = '';
        continue;
      }
      slot.icon.setText(chip.icon);
      slot.label.setText(chip.label);
      slot.label.setColor(chip.color);
      slot.tooltip = chip.tooltip;
      const w = Math.max(36, 22 + slot.label.width + 6);
      // setSize (not just .width) so the Rectangle geometry updates, then keep
      // the input hit-area Rectangle in sync with the new width.
      slot.bg.setSize(w, CHIP_HEIGHT);
      const hit = slot.bg.input?.hitArea as Phaser.Geom.Rectangle | undefined;
      if (hit) { hit.width = w; hit.height = CHIP_HEIGHT; }
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
        const fillW = (key === 'enemyHp' ? E_BAR_W : BAR_W) - 12;
        bar.width = Math.max(0, fillW * r);
        bar.setFillStyle(getColor(r));
        text.setText(`${v}/${max}`);

        if (key === 'hp') this.displayedHeroHp = v;
        else if (key === 'stamina') this.displayedStamina = v;
        else if (key === 'mana') this.displayedMana = v;
        else this.displayedEnemyHp = v;
      },
      onComplete: () => {
        const r = Math.max(0, to / max);
        const fillW = (key === 'enemyHp' ? E_BAR_W : BAR_W) - 12;
        bar.width = Math.max(0, fillW * r);
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

    // Tooltip objects live on the scene (not the HUD container) so they render
    // above it — destroy them explicitly.
    this.chipTooltipBg?.destroy();
    this.chipTooltipText?.destroy();

    this.container.destroy(true);
  }
}
