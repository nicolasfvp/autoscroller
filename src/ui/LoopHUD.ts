import Phaser from 'phaser';
import { getRun, type RunState } from '../state/RunState';
import { FONTS } from './StyleConstants';

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

  // Loop progress bar (between panels)
  private loopProgressFill!: Phaser.GameObjects.Rectangle;
  private loopProgressText!: Phaser.GameObjects.Text;
  private static readonly PROG_X  = 300;
  private static readonly PROG_Y  = 10;
  private static readonly PROG_W  = 200;
  private static readonly PROG_H  = 104;

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
    scene.add.existing(this);
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
    this.hpBar.width = this.HP_BAR_W * (runState.hero.currentHP / runState.hero.maxHP);
    this.hpText.setText(`${runState.hero.currentHP}/${runState.hero.maxHP}`);
    this.tpText.setText(`${runState.economy.tilePoints} TP`);
    const MAT: Record<string, string> = { wood: '🪵', stone: '🪨', iron: '⚙', crystal: '💎', bone: '🦴', herbs: '🌿', essence: '✨' };
    const mats = Object.entries(runState.economy.materials ?? {}).filter(([, v]) => v > 0);
    this.materialsRow.setText(mats.slice(0, 5).map(([k, v]) => `${MAT[k] ?? k[0]}${v}`).join('  '));
    this.updateShopToggle(runState.stopAtShop);
    const pending = runState.deck.droppedCards?.length ?? 0;
    this.pendingBadge.setText(pending > 0 ? `📦 ${pending} new cards` : '').setVisible(pending > 0);
  }

  private updateShopToggle(enabled: boolean): void {
    this.drawShopToggle(enabled);
    this.shopToggleText.setText(enabled ? 'Shop ✔' : 'Shop ✘').setColor(enabled ? '#00ff88' : '#ff4466');
  }
}
