import Phaser from 'phaser';
import { getRun, type RunState } from '../state/RunState';
import { FONTS } from './StyleConstants';
import { ALL_ELEMENT_IDS, ELEMENTS, type ElementId } from '../systems/ElementSystem';
// Re-export Phase 9 helpers from a Phaser-free module so tests can import
// without booting Phaser. The runtime path here still uses them.
import { extractStatusRowData, STATUS_ROW_COLORS } from './LoopHUD.helpers';
export { extractStatusRowData, STATUS_ROW_COLORS } from './LoopHUD.helpers';
export type { StatusRowData } from './LoopHUD.helpers';

interface ElementBadgeRefs {
  id: ElementId;
  bg: Phaser.GameObjects.Rectangle;
  counter: Phaser.GameObjects.Text;
}

const FF = FONTS.family;

/**
 * LoopHUD -- redesigned fixed HUD overlay for GameScene.
 * Two glassmorphism panels: left (gold / loop / HP), right (TP / materials / shop).
 */
export class LoopHUD extends Phaser.GameObjects.Container {
  private goldText!: Phaser.GameObjects.Text;
  private loopText!: Phaser.GameObjects.Text;
  private diffBadgeText!: Phaser.GameObjects.Text;
  private diffBadgeBg!: Phaser.GameObjects.Graphics;

  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;

  private tpText!: Phaser.GameObjects.Text;
  private materialsRow!: Phaser.GameObjects.Text;

  private shopToggleBg!: Phaser.GameObjects.Graphics;
  private shopToggleText!: Phaser.GameObjects.Text;
  private rightPanelContainer!: Phaser.GameObjects.Container;

  private pendingBadge!: Phaser.GameObjects.Text;
  private pendingBg!: Phaser.GameObjects.Graphics;

  // Phase 9 (Design v2): VIT/DEX/INT/SPI status row
  private statTexts: { vit?: Phaser.GameObjects.Text; dex?: Phaser.GameObjects.Text; int?: Phaser.GameObjects.Text; spi?: Phaser.GameObjects.Text } = {};

  // Phase 10: per-element shard + element-unit counter row (sits below the panels)
  private elementBadges: ElementBadgeRefs[] = [];

  // Loop progress bar (between panels)
  private loopProgressFill!: Phaser.GameObjects.Rectangle;
  private loopProgressText!: Phaser.GameObjects.Text;
  private static readonly PROG_X  = 300;
  private static readonly PROG_Y  = 10;
  private static readonly PROG_W  = 200;
  private static readonly PROG_H  = 104;

  // Tweened display values
  private displayedGold = 0;
  private displayedHP    = 0;
  private displayedMaxHP = 0;
  private displayedTP    = 0;

  private goldTween?: Phaser.Tweens.Tween;
  private hpTween?:   Phaser.Tweens.Tween;
  private tpTween?:   Phaser.Tweens.Tween;

  // Panel constants
  private static readonly LP_X  = 10;
  private static readonly LP_Y  = 10;
  private static readonly LP_W  = 280;
  private static readonly LP_H  = 104;

  private static readonly RP_X  = 530;
  private static readonly RP_Y  = 10;
  private static readonly RP_W  = 260;
  private static readonly RP_H  = 104;

  // HP bar inner bounds (world coords)
  private readonly HP_BAR_W: number;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.setScrollFactor(0).setDepth(100);

    const LP = LoopHUD;

    // ── Left panel ─────────────────────────────────────────────
    const leftPanelBg = scene.add.image(LP.LP_X + LP.LP_W / 2, LP.LP_Y + LP.LP_H / 2, 'healthbar').setDisplaySize(LP.LP_W, LP.LP_H);
    this.add(leftPanelBg);

    const goldIconX = LP.LP_X + 20;
    const goldIconY = LP.LP_Y + 26;
    this.add(scene.add.text(goldIconX, goldIconY, '◆', {
      fontFamily: FF, fontSize: '17px', color: '#ffd700',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5));

    this.goldText = scene.add.text(goldIconX + 22, goldIconY, '0', {
      fontFamily: FF, fontSize: '17px', fontStyle: 'bold', color: '#ffd700',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    this.add(this.goldText);

    this.loopText = scene.add.text(LP.LP_X + LP.LP_W / 2, goldIconY, 'Loop 1', {
      fontFamily: FF, fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5);
    this.add(this.loopText);

    this.diffBadgeBg = scene.add.graphics();
    this.add(this.diffBadgeBg);
    this.diffBadgeText = scene.add.text(LP.LP_X + LP.LP_W - 10, goldIconY, 'x1.0', {
      fontFamily: FF, fontSize: '13px', fontStyle: 'bold', color: '#ffaa44',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0.5);
    this.add(this.diffBadgeText);

    const barX = LP.LP_X + 12;
    const barY = LP.LP_Y + 76;
    const barW = LP.LP_W - 24;
    const barH = 20;
    this.HP_BAR_W = barW;

    this.hpBar = scene.add.rectangle(barX, barY, barW, barH, 0x22dd44).setOrigin(0, 0.5);
    this.add(this.hpBar);

    this.add(scene.add.text(barX + 8, barY, '♥', {
      fontFamily: FF, fontSize: '11px', color: '#ff4444',
    }).setOrigin(0, 0.5));

    this.hpText = scene.add.text(barX + barW / 2, barY, '100/100', {
      fontFamily: FF, fontSize: '13px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    this.add(this.hpText);

    this.pendingBg = scene.add.graphics();
    this.add(this.pendingBg);
    this.pendingBadge = scene.add.text(LP.LP_X + LP.LP_W / 2, LP.LP_Y + LP.LP_H + 10, '', {
      fontFamily: FF, fontSize: '12px', fontStyle: 'bold', color: '#ff8800',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setVisible(false);
    this.add(this.pendingBadge);

    // ── Right panel ────────────────────────────────────────────
    this.rightPanelContainer = scene.add.container(0, 0);
    this.rightPanelContainer.setVisible(true);
    this.add(this.rightPanelContainer);

    const rpBg = scene.add.image(LP.RP_X + LP.RP_W / 2, LP.RP_Y + LP.RP_H / 2, 'healthbar').setDisplaySize(LP.RP_W, LP.RP_H);
    this.rightPanelContainer.add(rpBg);

    const tpIcon = scene.add.text(LP.RP_X + 20, LP.RP_Y + 26, '⬡', {
      fontFamily: FF, fontSize: '17px', color: '#00e5ff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    this.rightPanelContainer.add(tpIcon);

    this.tpText = scene.add.text(LP.RP_X + 42, LP.RP_Y + 26, '0 TP', {
      fontFamily: FF, fontSize: '17px', fontStyle: 'bold', color: '#00e5ff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    this.rightPanelContainer.add(this.tpText);

    this.materialsRow = scene.add.text(LP.RP_X + 20, LP.RP_Y + 62, '', {
      fontFamily: FF, fontSize: '13px', color: '#e6c88a',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.rightPanelContainer.add(this.materialsRow);

    const shopX = LP.RP_X + LP.RP_W - 14;
    const shopY = LP.RP_Y + 26;
    this.shopToggleBg = scene.add.graphics();
    this.rightPanelContainer.add(this.shopToggleBg);

    this.shopToggleText = scene.add.text(shopX, shopY, 'Shop ✔', {
      fontFamily: FF, fontSize: '12px', fontStyle: 'bold', color: '#00ff88',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    this.rightPanelContainer.add(this.shopToggleText);

    const btnSize = 24;
    const deckX   = LP.RP_X + LP.RP_W - 60;
    const relicX  = LP.RP_X + LP.RP_W - 25;
    const iconY   = LP.RP_Y + LP.RP_H - 22;

    const deckBtn  = scene.add.image(deckX,  iconY, 'deck_icon').setDisplaySize(btnSize, btnSize).setInteractive({ useHandCursor: true });
    const relicBtn = scene.add.image(relicX, iconY, 'relic_icon').setDisplaySize(btnSize, btnSize).setInteractive({ useHandCursor: true });

    deckBtn.on('pointerdown', () => {
      if (!scene.scene.isPaused()) { scene.scene.pause(); scene.scene.launch('DeckCustomizationScene'); }
    });
    relicBtn.on('pointerdown', () => {
      if (!scene.scene.isPaused()) { scene.scene.pause(); scene.scene.launch('RelicViewerScene'); }
    });
    this.rightPanelContainer.add([deckBtn, relicBtn]);

    this.shopToggleText.on('pointerdown', () => {
      const run = getRun();
      run.stopAtShop = !run.stopAtShop;
      this.updateShopToggle(run.stopAtShop);
    });
    this.drawShopToggle(true);

    this.buildLoopProgressBar(scene);
    this.buildStatusStatsRow(scene);
    this.buildElementsRow(scene);
    scene.add.existing(this);
  }

  /**
   * Phase 10: full-width element bar showing per-element shard + element-unit counters.
   * Each of the 8 elements gets a colored badge with format "ABV  S+E" where S is
   * the current shard count (0–9, auto-converts at 10) and E is the converted
   * element-unit count. Sits below the top panels at y ~ 168, above the game viewport.
   */
  private buildElementsRow(scene: Phaser.Scene): void {
    const Y = 168;
    const H = 22;
    const PANEL_W = 780;
    const PANEL_X = 10;

    // Background plate
    const plate = scene.add.rectangle(
      PANEL_X + PANEL_W / 2, Y + H / 2,
      PANEL_W, H + 4,
      0x0a0a14, 0.78,
    ).setStrokeStyle(1, 0x4a4a60);
    this.add(plate);

    const BADGE_W = (PANEL_W - 4 - 7 * 4) / 8; // 8 cells, 7 gaps of 4px, 2px padding each side
    const GAP = 4;

    ALL_ELEMENT_IDS.forEach((id, i) => {
      const x = PANEL_X + 2 + i * (BADGE_W + GAP);
      const elem = ELEMENTS[id];
      const color = parseInt(elem.color.replace('#', ''), 16);

      const bg = scene.add.rectangle(x + BADGE_W / 2, Y + H / 2, BADGE_W, H, color, 0.22)
        .setStrokeStyle(1, color, 0.7);
      this.add(bg);

      // 3-letter element code
      const code = scene.add.text(x + 6, Y + H / 2, elem.name.slice(0, 3).toUpperCase(), {
        fontFamily: FF, fontSize: '10px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0, 0.5);
      this.add(code);

      // counter "S+E" — S in white, E in gold via tinted span
      const counter = scene.add.text(x + BADGE_W - 6, Y + H / 2, '0+0', {
        fontFamily: FF, fontSize: '11px', fontStyle: 'bold',
        color: '#ffd700', stroke: '#000', strokeThickness: 2,
      }).setOrigin(1, 0.5);
      this.add(counter);

      this.elementBadges.push({ id, bg, counter });
    });
  }

  private updateElementsRow(runState: RunState): void {
    const shards = (runState.economy.shards ?? {}) as Record<string, number>;
    const elements = (runState.economy.elements ?? {}) as Record<string, number>;
    for (const badge of this.elementBadges) {
      const s = shards[badge.id] ?? 0;
      const e = elements[badge.id] ?? 0;
      badge.counter.setText(`${s}+${e}`);
      // Dim the badge when both counters are zero — keeps the eye on what the
      // player has actually collected.
      const empty = s === 0 && e === 0;
      badge.bg.setFillStyle(badge.bg.fillColor, empty ? 0.1 : 0.28);
    }
  }

  /**
   * Phase 9 (Design v2): VIT/DEX/INT/SPI single-row status display.
   *
   * Positioned BELOW the left panel (y=124+ region) so it doesn't overlap
   * gold/loop/HP bar geometry. Universal — renders for all classes.
   * UI-SPEC §Spacing + §Typography + §Color.
   */
  private buildStatusStatsRow(scene: Phaser.Scene): void {
    const P = LoopHUD;
    const ROW_X = P.LP_X + 12;
    const ROW_Y = P.LP_Y + P.LP_H + 32;  // below the pending-cards badge slot
    const SPACING = 64;  // ≈64px between each stat block (fits 4 in 280px panel)

    const stats: Array<{ code: string; color: number; key: 'vit' | 'dex' | 'int' | 'spi' }> = [
      { code: 'VIT', color: STATUS_ROW_COLORS.vit, key: 'vit' },
      { code: 'DEX', color: STATUS_ROW_COLORS.dex, key: 'dex' },
      { code: 'INT', color: STATUS_ROW_COLORS.int, key: 'int' },
      { code: 'SPI', color: STATUS_ROW_COLORS.spi, key: 'spi' },
    ];

    stats.forEach((s, i) => {
      const x = ROW_X + i * SPACING;
      // Letter code: 10px bold, colored per stat token, 2px black stroke
      const code = scene.add.text(x, ROW_Y, s.code, {
        fontFamily: FF, fontSize: '10px', fontStyle: 'bold',
        color: '#' + s.color.toString(16).padStart(6, '0'),
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0, 0.5);
      this.add(code);

      // Number: 13px bold white, 2px black stroke
      const num = scene.add.text(x + 28, ROW_Y, '0', {
        fontFamily: FF, fontSize: '13px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0, 0.5);
      this.add(num);
      this.statTexts[s.key] = num;
    });
  }

  /**
   * Phase 9 (Design v2): Tween a single status-stat number to a new value.
   *
   * 280ms counter tween + 1.1× scale pulse on the changed digit
   * per UI-SPEC §Interaction Contract.
   */
  private applyStatTween(key: 'vit' | 'dex' | 'int' | 'spi', newValue: number): void {
    const txt = this.statTexts[key];
    if (!txt) return;
    const currentValue = parseInt(txt.text, 10);
    if (!Number.isFinite(currentValue)) {
      txt.setText(String(newValue));
      return;
    }
    if (currentValue === newValue) return;
    this.scene.tweens.addCounter({
      from: currentValue, to: newValue, duration: 280,
      onUpdate: (tw) => {
        const v = tw.getValue();
        txt.setText(String(Math.round(v ?? newValue)));
      },
      onComplete: () => { txt.setText(String(newValue)); },
    });
    this.scene.tweens.add({ targets: txt, scale: 1.1, duration: 140, yoyo: true });
  }

  private buildLoopProgressBar(scene: Phaser.Scene): void {
    const P = LoopHUD;
    const cx = P.PROG_X + P.PROG_W / 2;
    const cy = P.PROG_Y + P.PROG_H / 2;
    const pgBg = scene.add.image(cx, cy, 'healthbar').setDisplaySize(P.PROG_W, P.PROG_H);
    this.add(pgBg);

    this.add(scene.add.text(cx, P.PROG_Y + 28, 'LOOP PROGRESS', {
      fontFamily: FF, fontSize: '14px', fontStyle: 'bold',
      color: '#ffcc88', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5));

    const barX = P.PROG_X + 12;
    const barY = P.PROG_Y + 76;
    const barH = 20;
    this.loopProgressFill = scene.add.rectangle(barX, barY, 0, barH, 0x00ddcc).setOrigin(0, 0.5);
    this.add(this.loopProgressFill);
    this.loopProgressText = scene.add.text(cx, barY, '0%', {
      fontFamily: FF, fontSize: '12px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5);
    this.add(this.loopProgressText);
  }

  private drawShopToggle(enabled: boolean): void {
    const LP  = LoopHUD;
    const btnW = 66;
    const btnH = 22;
    const bx = LP.RP_X + LP.RP_W - 14 - btnW / 2;
    const by = LP.RP_Y + 26;
    this.shopToggleBg.clear();
    const col = enabled ? 0x004422 : 0x440011;
    const border = enabled ? 0x00ff88 : 0xff4466;
    this.shopToggleBg.fillStyle(col, 0.85);
    this.shopToggleBg.fillRoundedRect(bx - btnW / 2, by - btnH / 2, btnW, btnH, 6);
    this.shopToggleBg.lineStyle(1.5, border, 0.9);
    this.shopToggleBg.strokeRoundedRect(bx - btnW / 2, by - btnH / 2, btnW, btnH, 6);
  }

  update(runState: RunState, positionInLoop: number = 0, loopTotalPixels: number = 1): void {
    this.goldText.setText(String(runState.economy.gold));
    this.loopText.setText(`Loop ${runState.loop.count}`);
    this.diffBadgeText.setText(`x${runState.loop.difficulty.toFixed(1)}`);
    const progress = loopTotalPixels > 0 ? Math.min(1, positionInLoop / loopTotalPixels) : 0;
    const pct = Math.round(progress * 100);
    this.loopProgressFill.width = (LoopHUD.PROG_W - 24) * progress;
    this.loopProgressText.setText(`${pct}%`);
    // Phase 9 (WR-07 fix): clamp maxHP to 1 before division. A corrupted save
    // or transient mid-migration state with maxHP === 0 yields NaN, which
    // Phaser silently propagates into the rectangle's width and breaks the
    // bar. The text label still shows the raw `currentHP/maxHP` so the
    // underlying corruption is surfaced to the user, but the bar geometry
    // stays sane.
    const maxHPForBar = Math.max(1, runState.hero.maxHP);
    this.hpBar.width = this.HP_BAR_W * (runState.hero.currentHP / maxHPForBar);
    this.hpText.setText(`${runState.hero.currentHP}/${runState.hero.maxHP}`);
    this.tpText.setText(`${runState.economy.tilePoints} TP`);
    const MAT: Record<string, string> = { wood: '🪵', stone: '🪨', iron: '⚙', crystal: '💎', bone: '🦴', herbs: '🌿', essence: '✨' };
    const mats = Object.entries(runState.economy.materials ?? {}).filter(([, v]) => v > 0);
    this.materialsRow.setText(mats.slice(0, 5).map(([k, v]) => `${MAT[k] ?? k[0]}${v}`).join('  '));
    this.updateShopToggle(runState.stopAtShop);
    const pending = runState.deck.droppedCards?.length ?? 0;
    this.pendingBadge.setText(pending > 0 ? `📦 ${pending} new cards` : '').setVisible(pending > 0);

    // Phase 9 (Design v2): refresh VIT/DEX/INT/SPI status row from resolveHeroStats.
    const status = extractStatusRowData(runState);
    this.applyStatTween('vit', status.vit);
    this.applyStatTween('dex', status.dex);
    this.applyStatTween('int', status.int);
    this.applyStatTween('spi', status.spi);

    // Phase 10: refresh per-element shard + element-unit badges.
    this.updateElementsRow(runState);
  }

  private updateShopToggle(enabled: boolean): void {
    this.drawShopToggle(enabled);
    this.shopToggleText.setText(enabled ? 'Shop ✔' : 'Shop ✘').setColor(enabled ? '#00ff88' : '#ff4466');
  }
}
