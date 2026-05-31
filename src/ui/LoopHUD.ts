import Phaser from 'phaser';
import { type RunState } from '../state/RunState';
import { FONTS } from './StyleConstants';
// Re-export Phase 9 helpers from a Phaser-free module so tests can import
// without booting Phaser. The runtime path here still uses them.

import { extractStatusRowData } from './LoopHUD.helpers';
import { resolveHeroStats } from '../systems/hero/HeroStatsResolver';

export { extractStatusRowData, STATUS_ROW_COLORS } from './LoopHUD.helpers';
export type { StatusRowData } from './LoopHUD.helpers';

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


  // Phase 9 (Design v2): STR/VIT/DEX/INT/SPI status row
  private statTexts: { str?: Phaser.GameObjects.Text; vit?: Phaser.GameObjects.Text; dex?: Phaser.GameObjects.Text; int?: Phaser.GameObjects.Text; spi?: Phaser.GameObjects.Text } = {};



  // Loop progress bar (between panels)
  private loopProgressFill!: Phaser.GameObjects.Rectangle;
  private loopProgressText!: Phaser.GameObjects.Text;
  private static readonly PROG_X  = 530;
  private static readonly PROG_Y  = 10;
  private static readonly PROG_W  = 260;
  private static readonly PROG_H  = 104;

  // Active tweens spawned by applyStatTween — tracked so we can stop them on
  // shutdown/destroy. Each entry is removed automatically in its onComplete.
  private pendingTweens: Set<Phaser.Tweens.Tween> = new Set();

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
    const leftPanelBg = scene.add.image(LP.LP_X + LP.LP_W / 2, LP.LP_Y + LP.LP_H / 2, 'ui_panel').setDisplaySize(LP.LP_W, LP.LP_H);
    this.add(leftPanelBg);

    // Top info row — gold (left), loop count (center), difficulty (right)
    const topRowY = LP.LP_Y + 32;
    const innerL  = LP.LP_X + 26;   // inner-left start (inside wooden border)
    const innerR  = LP.LP_X + LP.LP_W - 26; // inner-right end

    this.add(scene.add.text(innerL, topRowY, '◆', {
      fontFamily: FF, fontSize: '15px', color: '#ffd700',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5));

    this.goldText = scene.add.text(innerL + 18, topRowY, '0', {
      fontFamily: FF, fontSize: '15px', fontStyle: 'bold', color: '#ffd700',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    this.add(this.goldText);

    this.loopText = scene.add.text(LP.LP_X + LP.LP_W / 2, topRowY, 'Loop 1', {
      fontFamily: FF, fontSize: '16px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5);
    this.add(this.loopText);

    this.diffBadgeBg = scene.add.graphics();
    this.add(this.diffBadgeBg);
    this.diffBadgeText = scene.add.text(innerR, topRowY, 'x1.0', {
      fontFamily: FF, fontSize: '12px', fontStyle: 'bold', color: '#ffaa44',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0.5);
    this.add(this.diffBadgeText);

    // HP bar row — "♥ HP" label to the left, trough + fill bar + value text
    const hpY = LP.LP_Y + 72;
    const barX = innerL + 46;           // room for "♥ HP" label
    const barW = innerR - barX;         // fills to right inner edge
    const barH = 14;
    this.HP_BAR_W = barW;

    this.add(scene.add.text(innerL, hpY, '♥ HP', {
      fontFamily: FF, fontSize: '11px', fontStyle: 'bold', color: '#ff5555',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5));

    this.add(scene.add.rectangle(barX + barW / 2, hpY, barW, barH, 0x0a1a0a, 1)
      .setStrokeStyle(1, 0x224422));

    this.hpBar = scene.add.rectangle(barX, hpY, barW, barH, 0x22dd44).setOrigin(0, 0.5);
    this.add(this.hpBar);

    this.hpText = scene.add.text(barX + barW / 2, hpY, '100/100', {
      fontFamily: FF, fontSize: '12px', fontStyle: 'bold', color: '#ffffff',
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
    this.rightPanelContainer.setVisible(false);
    this.add(this.rightPanelContainer);

    const rpBg = scene.add.image(LP.RP_X + LP.RP_W / 2, LP.RP_Y + LP.RP_H / 2, 'ui_panel').setDisplaySize(LP.RP_W, LP.RP_H);
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
    // Shop tile was removed: shop is now only reachable from the PlanningOverlay,
    // so the legacy "Shop ✔ / Shop ✘" auto-stop toggle no longer has anything to
    // gate. Keep the offscreen text/graphics so updateShopToggle() still has a
    // target and the rest of the HUD layout is undisturbed.
    this.shopToggleBg = scene.add.graphics().setVisible(false);
    this.rightPanelContainer.add(this.shopToggleBg);

    this.shopToggleText = scene.add.text(shopX, shopY, '', {
      fontFamily: FF, fontSize: '12px', fontStyle: 'bold', color: '#00ff88',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0.5).setVisible(false);
    this.rightPanelContainer.add(this.shopToggleText);

    const btnSize = 24;
    const deckX   = LP.RP_X + LP.RP_W - 62;
    const relicX  = LP.RP_X + LP.RP_W - 36;
    const iconY   = LP.RP_Y + LP.RP_H - 28;

    const deckBtn  = scene.add.image(deckX,  iconY, 'deck_icon').setDisplaySize(btnSize, btnSize).setInteractive({ useHandCursor: true });
    const relicBtn = scene.add.image(relicX, iconY, 'relic_icon').setDisplaySize(btnSize, btnSize).setInteractive({ useHandCursor: true });

    deckBtn.on('pointerdown', () => {
      if (!scene.scene.isPaused()) { scene.scene.pause(); scene.scene.launch('DeckCustomizationScene'); }
    });
    relicBtn.on('pointerdown', () => {
      if (!scene.scene.isPaused()) { scene.scene.pause(); scene.scene.launch('RelicViewerScene'); }
    });
    this.rightPanelContainer.add([deckBtn, relicBtn]);

    // Shop toggle is hidden — see note above on the offscreen Text/Graphics.

    this.buildLoopProgressBar(scene);
    scene.add.existing(this);

    // Stop tracked tweens when the host scene shuts down, so mid-tween scene
    // teardown doesn't leave onUpdate callbacks running against destroyed Text
    // objects.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.stopAllTweens, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.stopAllTweens, this);
  }

  private stopAllTweens(): void {
    for (const tw of this.pendingTweens) {
      tw.stop();
    }
    this.pendingTweens.clear();
  }

  /** Override Container.destroy to also stop in-flight stat tweens. */
  destroy(fromScene?: boolean): void {
    this.stopAllTweens();
    super.destroy(fromScene);
  }



  /**
   * Phase 9 (Design v2): VIT/DEX/INT/SPI single-row status display.
   *
   * Positioned BELOW the left panel (y=124+ region) so it doesn't overlap
   * gold/loop/HP bar geometry. Universal — renders for all classes.
   * UI-SPEC §Spacing + §Typography + §Color.
   */
  /**
   * Phase 9 (Design v2): Tween a single status-stat number to a new value.
   *
   * 280ms counter tween + 1.1× scale pulse on the changed digit
   * per UI-SPEC §Interaction Contract.
   */
  private applyStatTween(key: 'str' | 'vit' | 'dex' | 'int' | 'spi', newValue: number): void {
    const txt = this.statTexts[key];
    if (!txt) return;
    const currentValue = parseInt(txt.text, 10);
    // Always write the final value first so the HUD is correct even if the
    // tween onUpdate is throttled or the scene ticks slower than expected.
    txt.setText(String(newValue));
    if (!Number.isFinite(currentValue) || currentValue === newValue) return;
    // Animate from the previous value purely for visual polish — the text
    // above is already correct, so a stalled tween won't leave stale numbers.
    const counter = this.scene.tweens.addCounter({
      from: currentValue, to: newValue, duration: 280,
      onUpdate: (tw) => {
        const v = tw.getValue();
        txt.setText(String(Math.round(v ?? newValue)));
      },
      onComplete: () => {
        txt.setText(String(newValue));
        this.pendingTweens.delete(counter);
      },
      onStop: () => {
        txt.setText(String(newValue));
        this.pendingTweens.delete(counter);
      },
    });
    this.pendingTweens.add(counter);

    const pulse = this.scene.tweens.add({
      targets: txt, scale: 1.1, duration: 140, yoyo: true,
      onComplete: () => { this.pendingTweens.delete(pulse); },
      onStop: () => { this.pendingTweens.delete(pulse); },
    });
    this.pendingTweens.add(pulse);
  }


  private buildLoopProgressBar(scene: Phaser.Scene): void {
    const P = LoopHUD;
    const cx = P.PROG_X + P.PROG_W / 2;
    const cy = P.PROG_Y + P.PROG_H / 2;
    const pgBg = scene.add.image(cx, cy, 'ui_panel').setDisplaySize(P.PROG_W, P.PROG_H);
    this.add(pgBg);

    this.add(scene.add.text(cx, P.PROG_Y + 32, 'LOOP PROGRESS', {
      fontFamily: FF, fontSize: '13px', fontStyle: 'bold',
      color: '#ffcc88', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5));

    const pBarX = P.PROG_X + 26;
    const pBarW = P.PROG_W - 52;
    const barY = P.PROG_Y + 70;
    const barH = 14;
    this.add(scene.add.rectangle(pBarX + pBarW / 2, barY, pBarW, barH, 0x0a1a18, 1)
      .setStrokeStyle(1, 0x224444));
    this.loopProgressFill = scene.add.rectangle(pBarX, barY, 0, barH, 0x00ddcc).setOrigin(0, 0.5);
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
    this.loopProgressFill.width = (LoopHUD.PROG_W - 52) * progress;
    this.loopProgressText.setText(`${pct}%`);
    // Phase 9 (WR-07 fix): clamp maxHP to 1 before division. A corrupted save
    // or transient mid-migration state with maxHP === 0 yields NaN, which
    // Phaser silently propagates into the rectangle's width and breaks the
    // bar. The text label still shows the raw `currentHP/maxHP` so the
    // underlying corruption is surfaced to the user, but the bar geometry
    // stays sane.
    // Use resolved maxHP so passive stat_bonus relics (bronze_scale, vitality_ring)
    // immediately reshape the bar denominator out of combat.
    const resolvedMaxHP = resolveHeroStats(runState).maxHP;
    const maxHPForBar = Math.max(1, resolvedMaxHP);
    this.hpBar.width = this.HP_BAR_W * (runState.hero.currentHP / maxHPForBar);
    this.hpText.setText(`${runState.hero.currentHP}/${resolvedMaxHP}`);
    this.tpText.setText(`${runState.economy.tilePoints} TP`);
    const MAT: Record<string, string> = { wood: '🪵', stone: '🪨', iron: '⚙', crystal: '💎', bone: '🦴', herbs: '🌿', essence: '✨' };
    const mats = Object.entries(runState.economy.materials ?? {}).filter(([, v]) => v > 0);
    this.materialsRow.setText(mats.slice(0, 5).map(([k, v]) => `${MAT[k] ?? k[0]}${v}`).join('  '));
    this.updateShopToggle(runState.stopAtShop);
    const pending = runState.deck.droppedCards?.length ?? 0;
    this.pendingBadge.setText(pending > 0 ? `📦 ${pending} new cards` : '').setVisible(pending > 0);


    // Phase 9 (Design v2): refresh STR/VIT/DEX/INT/SPI status row from resolveHeroStats.
    const status = extractStatusRowData(runState);
    this.applyStatTween('str', status.str);
    this.applyStatTween('vit', status.vit);
    this.applyStatTween('dex', status.dex);
    this.applyStatTween('int', status.int);
    this.applyStatTween('spi', status.spi);


  }

  private updateShopToggle(enabled: boolean): void {
    this.drawShopToggle(enabled);
    this.shopToggleText.setText(enabled ? 'Shop ✔' : 'Shop ✘').setColor(enabled ? '#00ff88' : '#ff4466');
  }
}
