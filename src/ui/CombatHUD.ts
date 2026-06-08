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

// ── Panel geometry ─────────────────────────────────────────────
// Hero panel: combat_hero_panel.png (1435×714, aspect ≈2.01). The three stat
// bars render BEHIND the art and show through baked-in transparent windows.
const LP = { x: 8, y: 8, w: 250, h: 124 };
// Bar windows (measured from the PNG alpha → normalized → screen px).
const H_WIN_L = 0.2369;                       // window left  ÷ panelW
const H_WIN_R = 0.8843;                       // window right ÷ panelW
const H_BAR_X    = LP.x + H_WIN_L * LP.w;     // bar left anchor
const H_BAR_MAXW = (H_WIN_R - H_WIN_L) * LP.w;
const H_BAR_CX   = H_BAR_X + H_BAR_MAXW / 2;
const H_WIN_H    = 0.150 * LP.h;              // window thickness
const H_ROW_CY   = [0.2171, 0.4706, 0.7283].map((n) => LP.y + n * LP.h);

// Enemy panel: combat_monster_panel.png (1593×564, aspect ≈2.83). One HP bar
// behind a transparent window; the left square holds the name/portrait.
const RP = { x: 532, y: 8, w: 260, h: 92 };
const E_WIN_L = 0.4149;
const E_WIN_R = 0.9228;
const E_BAR_X    = RP.x + E_WIN_L * RP.w;
const E_BAR_MAXW = (E_WIN_R - E_WIN_L) * RP.w;
const E_BAR_CX   = E_BAR_X + E_BAR_MAXW / 2;
const E_ROW_CY   = RP.y + 0.5567 * RP.h;
const E_WIN_H    = 0.2163 * RP.h;
// Portrait box (left square)
const E_PORTRAIT_CX = RP.x + ((0.0126 + 0.4143) / 2) * RP.w;
const E_PORTRAIT_CY = RP.y + RP.h / 2;
const E_PORTRAIT_W  = (0.4143 - 0.0126) * RP.w - 10;
// Name sits just above the HP bar, centred over the bar window
const E_NAME_X = E_BAR_CX;
const E_NAME_Y = RP.y + (0.5567 - 0.2163 / 2) * RP.h - 3;

// Bar palette: dark troughs so the transparent windows never reveal the arena
// background, plus the Street-Fighter "lost health" light-blue ghost colour.
// Trough: very dark base under the entire bar window
const TROUGH_HP   = 0x200808;
const TROUGH_STA  = 0x181000;
const TROUGH_MANA = 0x0e0820;
// Ghost colours — contrasting with each bar so lost health is clearly visible
const GHOST_HP   = 0xff8800; // HP verde  → ghost laranja
const GHOST_STA  = 0xffee44; // STA laranja → ghost amarelo claro
const GHOST_MANA = 0x44ddff; // Mana roxa  → ghost ciano
const GHOST_ENEMY_HP = 0xff8800; // HP vermelho → ghost laranja
const GHOST_ALPHA = 0.80;

// Status-chip row geometry (effect icons row under each panel)
const CHIP_POOL_SIZE = 10;
const CHIP_HEIGHT = 36;
const CHIP_GAP = 4;
const CHIP_ROW_GAP = 40;
// Slot proportions of the combat_chip_panel asset (657x254, divider at ~50%)
const CHIP_ICON_SLOT_RATIO = 0.38; // left slot width as fraction of total
const HERO_CHIPS  = { x: LP.x + 14, y: LP.y + LP.h + CHIP_HEIGHT / 2 - 4, maxWidth: LP.w - 8 };
const ENEMY_CHIPS = { x: RP.x + 4, y: RP.y + RP.h + CHIP_HEIGHT / 2 - 1, maxWidth: RP.w - 8 };

interface ChipDisplay {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  bgPanel?: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
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

  // Hero bars (fill = current value, ghost = lingering "lost" segment)
  private hpBar!:      Phaser.GameObjects.Rectangle;
  private staminaBar!: Phaser.GameObjects.Rectangle;
  private manaBar!:    Phaser.GameObjects.Rectangle;
  private hpGhost!:      Phaser.GameObjects.Rectangle;
  private staminaGhost!: Phaser.GameObjects.Rectangle;
  private manaGhost!:    Phaser.GameObjects.Rectangle;
  private hpText!:     Phaser.GameObjects.Text;
  private staminaText!:Phaser.GameObjects.Text;
  private manaText!:   Phaser.GameObjects.Text;

  // Hero armor readout (below HP). Shown only when armor > 0.

  // Enemy
  private _enemyTextureKey = '';
  private enemyPortrait?: Phaser.GameObjects.Image;
  private portraitMaskGfx?: Phaser.GameObjects.Graphics;
  private enemyNameText!: Phaser.GameObjects.Text;
  private enemyHpBar!:    Phaser.GameObjects.Rectangle;
  private enemyHpGhost!:  Phaser.GameObjects.Rectangle;
  private enemyHpText!:   Phaser.GameObjects.Text;

  // Hourglass timer
  private hourglassSprite?: Phaser.GameObjects.Sprite;
  private enemyHourglassSprite?: Phaser.GameObjects.Sprite;
  private cooldownGraphics!: Phaser.GameObjects.Graphics;
  private cooldownText!:     Phaser.GameObjects.Text;
  private enemyCooldownText!: Phaser.GameObjects.Text;
  private hourglassFlipAngle   = 0;
  private isFlipping           = false;
  private _hgTopFrame          = 6;  // índice do último frame válido do spritesheet (derivado no build)
  private _lastHgFrame         = 0;  // último frame exibido do hourglass do herói
  private _hgResetHold         = 0;  // ticks segurando o frame drenado à espera do giro
  private _lastCardPlayCount   = 0;
  private _onFlipChange?: (flipping: boolean) => void;
  private _destroyed         = false;

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
  private hpGhostTween?:      Phaser.Tweens.Tween;
  private staminaGhostTween?: Phaser.Tweens.Tween;
  private manaGhostTween?:    Phaser.Tweens.Tween;
  private enemyHpGhostTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, enemyTextureKey = '') {
    this.scene = scene;
    this._enemyTextureKey = enemyTextureKey;
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

    // Stat bars sit BEHIND the panel art (trough → ghost → fill); the asset on
    // top reveals each bar through its baked-in transparent window.
    const makeBar = (cy: number, fillColor: number, troughColor: number, valSize: string, ghostColor: number) => {
      const trough = s.add.rectangle(H_BAR_CX, cy, H_BAR_MAXW, H_WIN_H, troughColor).setOrigin(0.5);
      const ghost  = s.add.rectangle(H_BAR_X, cy, 0, H_WIN_H, ghostColor).setOrigin(0, 0.5).setAlpha(0);
      const fill   = s.add.rectangle(H_BAR_X, cy, 0, H_WIN_H, fillColor).setOrigin(0, 0.5);
      const val    = s.add.text(H_BAR_CX, cy, '', {
        fontFamily: FF, fontSize: valSize, fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
      this.container.add([trough, ghost, fill]);
      return { ghost, fill, val };
    };

    const hp  = makeBar(H_ROW_CY[0], 0x22cc44, TROUGH_HP,   '13px', GHOST_HP);
    const sta = makeBar(H_ROW_CY[1], 0xf0a020, TROUGH_STA,  '12px', GHOST_STA);
    const mp  = makeBar(H_ROW_CY[2], 0x9966ff, TROUGH_MANA, '12px', GHOST_MANA);
    this.hpBar = hp.fill;       this.hpGhost = hp.ghost;       this.hpText = hp.val;
    this.staminaBar = sta.fill; this.staminaGhost = sta.ghost; this.staminaText = sta.val;
    this.manaBar = mp.fill;     this.manaGhost = mp.ghost;     this.manaText = mp.val;

    // Panel art on top of the bars
    const panelImg = s.textures.exists('combat_hero_panel')
      ? s.add.image(LP.x + LP.w / 2, LP.y + LP.h / 2, 'combat_hero_panel').setDisplaySize(LP.w, LP.h)
      : s.add.rectangle(LP.x + LP.w / 2, LP.y + LP.h / 2, LP.w, LP.h, 0x080810, 0.88) as unknown as Phaser.GameObjects.Image;
    this.container.add(panelImg);

    // Value labels render above the art
    this.container.add([hp.val, sta.val, mp.val]);

  }

  // ── Enemy panel ────────────────────────────────────────────────

  private buildEnemyPanel(): void {
    const s = this.scene;

    // HP bar behind the panel art (trough → ghost → fill)
    const trough = s.add.rectangle(E_BAR_CX, E_ROW_CY, E_BAR_MAXW, E_WIN_H, TROUGH_HP).setOrigin(0.5);
    this.enemyHpGhost = s.add.rectangle(E_BAR_X, E_ROW_CY, 0, E_WIN_H, GHOST_ENEMY_HP).setOrigin(0, 0.5).setAlpha(0);
    this.enemyHpBar   = s.add.rectangle(E_BAR_X, E_ROW_CY, 0, E_WIN_H, 0xdd2222).setOrigin(0, 0.5);
    this.container.add([trough, this.enemyHpGhost, this.enemyHpBar]);

    // Monster portrait added FIRST so the panel art renders on top (container
    // children render in insertion order — last = frontmost).
    const pBoxW = E_PORTRAIT_W - 6;
    const pBoxH = RP.h - 8;
    const portraitKey = this._enemyTextureKey.replace(/^monster_/, 'portrait_');
    const textureKey  = s.textures.exists(portraitKey)       ? portraitKey
                      : s.textures.exists(this._enemyTextureKey) ? this._enemyTextureKey
                      : '';
    if (textureKey) {
      const pX = E_PORTRAIT_CX - 9;
      this.enemyPortrait = s.add.image(pX, E_PORTRAIT_CY, textureKey)
        .setDisplaySize(61, 61);
      this.portraitMaskGfx = s.make.graphics({ x: 0, y: 0 });
      this.portraitMaskGfx.fillStyle(0xffffff);
      this.portraitMaskGfx.fillRect(pX - pBoxW / 2, E_PORTRAIT_CY - pBoxH / 2, pBoxW, pBoxH);
      this.enemyPortrait.setMask(this.portraitMaskGfx.createGeometryMask());
      this.container.add(this.enemyPortrait);
    }

    // Panel art — added AFTER portrait so it renders on top, with the portrait
    // showing through the transparent portrait-box window in the artwork.
    const panelImg = s.textures.exists('combat_monster_panel')
      ? s.add.image(RP.x + RP.w / 2, RP.y + RP.h / 2, 'combat_monster_panel').setDisplaySize(RP.w, RP.h)
      : s.add.rectangle(RP.x + RP.w / 2, RP.y + RP.h / 2, RP.w, RP.h, 0x080810, 0.88) as unknown as Phaser.GameObjects.Image;
    this.container.add(panelImg);

    // Enemy name just above the HP bar, centred over the bar window
    this.enemyNameText = s.add.text(E_NAME_X, E_NAME_Y, '', {
      fontFamily: FF, fontSize: '17px', fontStyle: 'bold',
      color: '#ffaaaa', stroke: '#000000', strokeThickness: 4,
      align: 'center', wordWrap: { width: E_BAR_MAXW - 8 },
    }).setOrigin(0.5, 1);
    this.container.add(this.enemyNameText);

    // HP value centred inside the bar
    this.enemyHpText = s.add.text(E_BAR_CX, E_ROW_CY, '', {
      fontFamily: FF, fontSize: '11px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.container.add(this.enemyHpText);
  }

  // ── Hourglass timer ────────────────────────────────────────────

  private buildCooldownArc(): void {
    const s = this.scene;
    const HG_SCALE  = (110 / 496) * 0.7;   // 30% menor
    const HG_H      = 496 * HG_SCALE;
    const HERO_X    = 369;
    const ENEMY_X   = 471;
    const HG_Y      = 490;
    const PANEL_Y   = HG_Y + HG_H / 2 + 18;
    const PANEL_W   = 77;
    const PANEL_H   = 21;

    if (s.textures.exists('hourglass_timer')) {
      // frameTotal inclui o __BASE, então o último índice de frame real é frameTotal - 2.
      this._hgTopFrame = Math.max(0, s.textures.get('hourglass_timer').frameTotal - 2);

      // Herói — esquerda
      this.hourglassSprite = s.add.sprite(HERO_X, HG_Y, 'hourglass_timer', 0)
        .setScale(HG_SCALE)
        .setOrigin(0.5, 0.5)
        .setDepth(101);
      this.container.add(this.hourglassSprite);

      // Inimigo — direita, filtro vermelho
      this.enemyHourglassSprite = s.add.sprite(ENEMY_X, HG_Y, 'hourglass_timer', 0)
        .setScale(HG_SCALE)
        .setOrigin(0.5, 0.5)
        .setDepth(101)
        .setTint(0xff4444);
      this.container.add(this.enemyHourglassSprite);
    } else {
      this.cooldownGraphics = s.add.graphics();
      this.container.add(this.cooldownGraphics);
    }

    // Painel herói
    if (s.textures.exists('timer_panel')) {
      const tp = s.add.image(HERO_X, PANEL_Y, 'timer_panel').setDisplaySize(PANEL_W, PANEL_H).setDepth(100);
      this.container.add(tp);
    }
    this.cooldownText = s.add.text(HERO_X, PANEL_Y, '', {
      fontFamily: 'VT323', fontSize: '16px',
      color: '#ffd700', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.container.add(this.cooldownText);

    // Painel inimigo
    if (s.textures.exists('timer_panel')) {
      const tp2 = s.add.image(ENEMY_X, PANEL_Y, 'timer_panel').setDisplaySize(PANEL_W, PANEL_H).setDepth(100).setTint(0xff6666);
      this.container.add(tp2);
    }
    this.enemyCooldownText = s.add.text(ENEMY_X, PANEL_Y, '', {
      fontFamily: 'VT323', fontSize: '16px',
      color: '#ff9999', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.container.add(this.enemyCooldownText);
  }

  setFlipCallback(cb: (flipping: boolean) => void): void {
    this._onFlipChange = cb;
  }

  private triggerHourglassFlip(): void {
    if (this._destroyed || !this.hourglassSprite || this.isFlipping) return;
    this.hourglassSprite.setFrame(this._hgTopFrame); // trava no último frame; só sai dele após o giro
    this._lastHgFrame = this._hgTopFrame;
    this.isFlipping = true;
    this._onFlipChange?.(true);
    this.hourglassFlipAngle += 360;
    this.scene.tweens.add({
      targets: this.hourglassSprite,
      angle: this.hourglassFlipAngle,
      duration: 600,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        if (this._destroyed) return;
        // O giro terminou: agora sim o frame volta ao primeiro sprite.
        this.hourglassSprite?.setFrame(0);
        this._lastHgFrame = 0;
        this._hgResetHold = 0;
        this.isFlipping = false;
        this._onFlipChange?.(false);
      },
    });
  }

  showCooldownBurst(cooldownMs: number): void {
    const cdSec = cooldownMs / 1000;
    const label = Number.isInteger(cdSec) ? `+${cdSec}` : `+${cdSec.toFixed(1)}`;
    // Appear inside the left icon slot of the timer panel (hourglass at x=400,y=55)
    const txt = this.scene.add.text(375, 55, label, {
      fontFamily: 'VT323', fontSize: '18px',
      color: '#ffd700', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(150).setScrollFactor(0);

    this.scene.tweens.add({
      targets: txt,
      y: txt.y - 20,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
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
    const usePanelAsset = s.textures.exists('combat_chip_panel');
    let bg: Phaser.GameObjects.Rectangle;
    let bgPanel: Phaser.GameObjects.Image | undefined;

    if (usePanelAsset) {
      bgPanel = s.add.image(0, 0, 'combat_chip_panel').setOrigin(0, 0.5);
      bg = s.add.rectangle(0, 0, 50, CHIP_HEIGHT, 0x000000, 0).setOrigin(0, 0.5);
    } else {
      bg = s.add.rectangle(0, 0, 50, CHIP_HEIGHT, 0x0a0a1a, 0.78)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, 0x4a9eff, 0.5);
    }

    const icon = s.add.image(0, 0, '__WHITE')
      .setDisplaySize(20, 20).setOrigin(0.5, 0.5).setVisible(false);
    const label = s.add.text(0, 0, '', {
      fontFamily: FF, fontSize: '16px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5);

    if (bgPanel) {
      c.add([bgPanel, bg, icon, label]);
    } else {
      c.add([bg, icon, label]);
    }
    this.container.add(c);

    const slot: ChipDisplay = { container: c, bg, bgPanel, icon, label, tooltip: '' };

    bg.setInteractive({ useHandCursor: false });
    bg.on('pointerover', () => {
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
        slot.icon.setVisible(false);
        slot.tooltip = '';
        continue;
      }
      if (this.scene.textures.exists(chip.iconKey)) {
        slot.icon.setTexture(chip.iconKey).setDisplaySize(20, 20).setVisible(true);
      } else {
        slot.icon.setVisible(false);
      }
      slot.label.setText(chip.label);
      slot.label.setColor(chip.color);
      slot.tooltip = chip.tooltip;

      const hasIcon = slot.icon.visible;
      const iconSlotW = hasIcon ? Math.round(CHIP_HEIGHT * (657 / 254) * CHIP_ICON_SLOT_RATIO) : 0;
      const textW = Math.max(28, slot.label.width + 8);
      const w = iconSlotW + textW;

      if (slot.bgPanel) {
        slot.bgPanel.setDisplaySize(w, CHIP_HEIGHT);
        slot.icon.setPosition(iconSlotW / 2 - 2, 0);
        slot.label.setOrigin(0.5, 0.5).setPosition(iconSlotW + textW / 2 - 5, 0);
      } else {
        slot.icon.setPosition(hasIcon ? 12 : 0, 0);
        slot.label.setPosition(hasIcon ? 26 : 4, 0);
      }

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

  update(state: CombatState, heroCooldown: number, heroMaxCooldown: number, _gameSpeed = 1, cardPlayCount = 0, enemyCooldown = 0, enemyMaxCooldown = 0): void {
    // Hero bars. Track displayed* against the tween *target* (updated at
    // tween start) so consecutive update() ticks during an in-flight tween
    // don't restart it every frame and leave the value stuck at zero.
    const newHP = Math.ceil(state.heroHP);
    if (newHP !== this.targetHeroHp) {
      const from = this.displayedHeroHp;
      this.targetHeroHp = newHP;
      this.tweenBar('hp', from, newHP, state.heroMaxHP,
        this.hpBar, this.hpGhost, this.hpText,
        (r) => r > 0.5 ? 0x22cc44 : r > 0.25 ? 0xf0a020 : 0xff3333);
    }

    const newSTA = Math.ceil(state.heroStamina);
    if (newSTA !== this.targetStamina) {
      const from = this.displayedStamina;
      this.targetStamina = newSTA;
      this.tweenBar('stamina', from, newSTA, state.heroMaxStamina,
        this.staminaBar, this.staminaGhost, this.staminaText, () => 0xf0a020);
    }

    const newMP = Math.ceil(state.heroMana);
    if (newMP !== this.targetMana) {
      const from = this.displayedMana;
      this.targetMana = newMP;
      this.tweenBar('mana', from, newMP, state.heroMaxMana,
        this.manaBar, this.manaGhost, this.manaText, () => 0x9966ff);
    }

    // Enemy
    this.enemyNameText.setText(state.enemyName);
    const newEHP = Math.ceil(state.enemyHP);
    if (newEHP !== this.targetEnemyHp) {
      const from = this.displayedEnemyHp;
      this.targetEnemyHp = newEHP;
      this.tweenBar('enemyHp', from, newEHP, state.enemyMaxHP,
        this.enemyHpBar, this.enemyHpGhost, this.enemyHpText, () => 0xdd2222);
    }

    // Status effect chips
    this.layoutChips(computeHeroChips(state), this.heroChipPool, HERO_CHIPS.x, HERO_CHIPS.y, HERO_CHIPS.maxWidth);
    this.layoutChips(computeEnemyChips(state), this.enemyChipPool, ENEMY_CHIPS.x, ENEMY_CHIPS.y, ENEMY_CHIPS.maxWidth);

    // Hourglass timer
    if (heroMaxCooldown > 0) {
      const remaining = Math.max(0, heroCooldown) / 1000;
      this.cooldownText.setText(remaining.toFixed(1));

      if (this.hourglassSprite) {
        // Trigger flip when card is played (engine cooldown is now paused during flip).
        if (cardPlayCount > this._lastCardPlayCount) {
          this._lastCardPlayCount = cardPlayCount;
          this.triggerHourglassFlip();
        }

        if (this.isFlipping) {
          // Frame gerenciado por triggerHourglassFlip — não sobrescrever.
        } else {
          const top = this._hgTopFrame;
          const progress = Math.max(0, Math.min(1, 1 - heroCooldown / heroMaxCooldown));
          const totalFrames = heroMaxCooldown <= 500 ? 3
            : heroMaxCooldown <= 1000 ? 5
            : heroMaxCooldown <= 2000 ? 6
            : 8;
          const fi = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
          const frameIdx = Math.round(fi * (top / (totalFrames - 1)));

          // Latch: o frame só pode cair de "drenado" (top) para "cheio" (0) como
          // parte do giro. Quando o cooldown reseta (frame alto -> baixo) sem
          // que um giro tenha começado, seguramos no frame drenado por alguns
          // ticks à espera do flip. Se nenhum giro vier (skip/retry por stun,
          // carta sem custo, deck vazio), liberamos para não travar para sempre.
          const wasDrained = this._lastHgFrame >= top;
          const isResetDrop = wasDrained && frameIdx <= 1;

          if (frameIdx >= top) this._hgResetHold = 4;

          if (isResetDrop && this._hgResetHold > 0) {
            this._hgResetHold--;
            this.hourglassSprite.setFrame(top); // segura drenado; o giro fará o top->0
          } else {
            this._lastHgFrame = frameIdx;
            this.hourglassSprite.setFrame(frameIdx);
          }
        }
      } else if (this.cooldownGraphics) {
        // Fallback arc
        this.cooldownGraphics.clear();
        const progress = Math.max(0, Math.min(1, 1 - heroCooldown / heroMaxCooldown));
        const cx = 400; const cy = 48; const R = 30;
        this.cooldownGraphics.fillStyle(0x0a0a1a, 0.75);
        this.cooldownGraphics.fillCircle(cx, cy, R + 3);
        this.cooldownGraphics.lineStyle(1.5, 0x4a9eff, 0.4);
        this.cooldownGraphics.strokeCircle(cx, cy, R + 3);
        this.cooldownGraphics.fillStyle(0x222233, 0.8);
        this.cooldownGraphics.fillCircle(cx, cy, R);
        if (progress > 0) {
          this.cooldownGraphics.fillStyle(0xffd700, progress >= 1 ? 1.0 : 0.85);
          this.cooldownGraphics.slice(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * progress, false);
          this.cooldownGraphics.fillPath();
        }
        this.cooldownGraphics.fillStyle(0x0a0a1a, 1);
        this.cooldownGraphics.fillCircle(cx, cy, 5);
      }
    }

    // Enemy hourglass timer
    if (this.enemyHourglassSprite && enemyMaxCooldown > 0) {
      const remaining = Math.max(0, enemyCooldown) / 1000;
      this.enemyCooldownText.setText(remaining.toFixed(1));
      const progress = Math.max(0, Math.min(1, 1 - enemyCooldown / enemyMaxCooldown));
      const totalFrames = enemyMaxCooldown <= 500 ? 3
        : enemyMaxCooldown <= 1000 ? 5
        : enemyMaxCooldown <= 2000 ? 6
        : 8;
      const fi = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
      const frameIdx = Math.round(fi * (this._hgTopFrame / (totalFrames - 1)));
      this.enemyHourglassSprite.setFrame(frameIdx);
    }
  }

  // ── Tween helper ───────────────────────────────────────────────

  // Street-Fighter-style bar: on damage the coloured fill snaps to the new
  // value while a light-blue "ghost" lingers at the old length then drains
  // down to meet it. Healing grows the fill smoothly with no ghost.
  private tweenBar(
    key: 'hp' | 'stamina' | 'mana' | 'enemyHp',
    from: number, to: number, max: number,
    bar: Phaser.GameObjects.Rectangle,
    ghost: Phaser.GameObjects.Rectangle,
    text: Phaser.GameObjects.Text,
    getColor: (ratio: number) => number,
  ): void {
    this.mainTween(key)?.stop();
    this.ghostTween(key)?.stop();

    const maxW = key === 'enemyHp' ? E_BAR_MAXW : H_BAR_MAXW;
    const clamp = (v: number) => (max > 0 ? Math.max(0, Math.min(1, v / max)) : 0);
    const wTo = maxW * clamp(to);

    text.setText(`${to}/${max}`);
    bar.setFillStyle(getColor(clamp(to)));

    if (to < from) {
      // Damage: fill snaps to new value; ghost (semi-transparent echo of fill
      // colour) holds the old width and drains down to meet it.
      bar.width = wTo;
      ghost.width = Math.max(ghost.width, maxW * clamp(from));
      ghost.setAlpha(GHOST_ALPHA);
      this.setGhostTween(key, this.scene.tweens.add({
        targets: ghost, width: wTo, delay: 180, duration: 520, ease: 'Cubic.easeIn',
        onComplete: () => { if (ghost.width <= 1) ghost.setAlpha(0); },
      }));
    } else {
      // Heal / refill: grow the fill smoothly; hide ghost.
      const startW = bar.width;
      this.setMainTween(key, this.scene.tweens.addCounter({
        from: startW, to: wTo, duration: 240, ease: 'Cubic.easeOut',
        onUpdate: (t) => { bar.width = t.getValue() ?? wTo; },
        onComplete: () => { bar.width = wTo; },
      }));
      ghost.width = wTo;
      ghost.setAlpha(0);
    }

    if (key === 'hp') this.displayedHeroHp = to;
    else if (key === 'stamina') this.displayedStamina = to;
    else if (key === 'mana') this.displayedMana = to;
    else this.displayedEnemyHp = to;
  }

  private mainTween(key: string): Phaser.Tweens.Tween | undefined {
    return key === 'hp' ? this.hpTween : key === 'stamina' ? this.staminaTween
      : key === 'mana' ? this.manaTween : this.enemyHpTween;
  }
  private ghostTween(key: string): Phaser.Tweens.Tween | undefined {
    return key === 'hp' ? this.hpGhostTween : key === 'stamina' ? this.staminaGhostTween
      : key === 'mana' ? this.manaGhostTween : this.enemyHpGhostTween;
  }
  private setMainTween(key: string, t: Phaser.Tweens.Tween): void {
    if (key === 'hp') this.hpTween = t;
    else if (key === 'stamina') this.staminaTween = t;
    else if (key === 'mana') this.manaTween = t;
    else this.enemyHpTween = t;
  }
  private setGhostTween(key: string, t: Phaser.Tweens.Tween): void {
    if (key === 'hp') this.hpGhostTween = t;
    else if (key === 'stamina') this.staminaGhostTween = t;
    else if (key === 'mana') this.manaGhostTween = t;
    else this.enemyHpGhostTween = t;
  }

  destroy(): void {
    // Stop in-flight stat tweens before tearing down the container. Without
    // this, a mid-tween shutdown calls onUpdate after the Rectangle has been
    // destroyed and throws "cannot read property of undefined".
    this.hpTween?.stop();
    this.staminaTween?.stop();
    this.manaTween?.stop();
    this.enemyHpTween?.stop();
    this.hpGhostTween?.stop();
    this.staminaGhostTween?.stop();
    this.manaGhostTween?.stop();
    this.enemyHpGhostTween?.stop();
    this.hpTween = undefined;
    this.staminaTween = undefined;
    this.manaTween = undefined;
    this.enemyHpTween = undefined;

    this._destroyed = true;
    if (this.hourglassSprite) {
      this.scene.tweens.killTweensOf(this.hourglassSprite);
    }

    // Tooltip objects live on the scene (not the HUD container) so they render
    // above it — destroy them explicitly.
    this.chipTooltipBg?.destroy();
    this.chipTooltipText?.destroy();
    this.portraitMaskGfx?.destroy();

    this.container.destroy(true);
  }
}
