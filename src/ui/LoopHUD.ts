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
  private hpBarBgAsset!: Phaser.GameObjects.Image;
  private hpText!: Phaser.GameObjects.Text;

  private tpText!: Phaser.GameObjects.Text;
  private materialsRow!: Phaser.GameObjects.Text;

  private shopToggleBg!: Phaser.GameObjects.Graphics;
  private shopToggleText!: Phaser.GameObjects.Text;

  private pendingBadge!: Phaser.GameObjects.Text;
  private pendingBg!: Phaser.GameObjects.Graphics;

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
  private readonly HP_BAR_X: number;
  private readonly HP_BAR_W: number;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.setScrollFactor(0).setDepth(100);

    const LP = LoopHUD;

    // ── Left panel ─────────────────────────────────────────────
    // Use the healthbar asset as the entire background for the left panel
    const leftPanelBg = scene.add.image(LP.LP_X + LP.LP_W / 2, LP.LP_Y + LP.LP_H / 2, 'healthbar').setDisplaySize(LP.LP_W, LP.LP_H);
    this.add(leftPanelBg);

    // Gold
    const goldIconX = LP.LP_X + 20;
    const goldIconY = LP.LP_Y + 26;
    scene.add.text(goldIconX, goldIconY, '◆', {
      fontFamily: FF, fontSize: '17px', color: '#ffd700',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    this.add(scene.add.text(goldIconX, goldIconY, '◆', {
      fontFamily: FF, fontSize: '17px', color: '#ffd700',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5));

    this.goldText = scene.add.text(goldIconX + 22, goldIconY, '0', {
      fontFamily: FF, fontSize: '17px', fontStyle: 'bold', color: '#ffd700',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    this.add(this.goldText);

    // Loop label (centered in panel)
    this.loopText = scene.add.text(LP.LP_X + LP.LP_W / 2, goldIconY, 'Loop 1', {
      fontFamily: FF, fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5);
    this.add(this.loopText);

    // Difficulty badge (right side of left panel)
    this.diffBadgeBg = scene.add.graphics();
    this.add(this.diffBadgeBg);
    this.diffBadgeText = scene.add.text(LP.LP_X + LP.LP_W - 10, goldIconY, 'x1.0', {
      fontFamily: FF, fontSize: '13px', fontStyle: 'bold', color: '#ffaa44',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0.5);
    this.add(this.diffBadgeText);

    // HP bar
    const barX = LP.LP_X + 12;
    const barY = LP.LP_Y + 76; // Positioned in the lower slot of the panel
    const barW = LP.LP_W - 24;
    const barH = 20;
    this.HP_BAR_X = barX;
    this.HP_BAR_W = barW;

    // Green fill (no extra background needed, as the panel itself provides the frame)
    this.hpBar = scene.add.rectangle(barX, barY, barW, barH, 0x22dd44).setOrigin(0, 0.5);
    this.add(this.hpBar);

    // Little HP heart icon (offset slightly so it doesn't overlap the border)
    scene.add.text(barX + 8, barY, '♥', {
      fontFamily: FF, fontSize: '11px', color: '#ff4444',
    }).setOrigin(0, 0.5);
    this.add(scene.add.text(barX + 8, barY, '♥', {
      fontFamily: FF, fontSize: '11px', color: '#ff4444',
    }).setOrigin(0, 0.5));

    this.hpText = scene.add.text(barX + barW / 2, barY, '100/100', {
      fontFamily: FF, fontSize: '13px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    this.add(this.hpText);

    // Pending cards badge (below left panel)
    this.pendingBg = scene.add.graphics();
    this.add(this.pendingBg);
    this.pendingBadge = scene.add.text(LP.LP_X + LP.LP_W / 2, LP.LP_Y + LP.LP_H + 10, '', {
      fontFamily: FF, fontSize: '12px', fontStyle: 'bold', color: '#ff8800',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setVisible(false);
    this.add(this.pendingBadge);

    // ── Right panel ────────────────────────────────────────────
    this.rightPanelContainer = scene.add.container(0, 0);
    this.rightPanelContainer.setVisible(false); // Hidden as requested by user
    this.add(this.rightPanelContainer);

    const rpBg = scene.add.graphics();
    rpBg.fillStyle(0x0a1628, 0.82);
    rpBg.fillRoundedRect(LP.RP_X, LP.RP_Y, LP.RP_W, LP.RP_H, 8);
    rpBg.lineStyle(1.5, 0x00e5ff, 0.55);
    rpBg.strokeRoundedRect(LP.RP_X, LP.RP_Y, LP.RP_W, LP.RP_H, 8);
    this.rightPanelContainer.add(rpBg);

    // TP display
    const tpIcon = scene.add.text(LP.RP_X + 16, LP.RP_Y + 26, '⬡', {
      fontFamily: FF, fontSize: '16px', color: '#00e5ff',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.rightPanelContainer.add(tpIcon);

    this.tpText = scene.add.text(LP.RP_X + 36, LP.RP_Y + 26, '0 TP', {
      fontFamily: FF, fontSize: '18px', fontStyle: 'bold', color: '#00e5ff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    this.rightPanelContainer.add(this.tpText);

    // Materials row
    this.materialsRow = scene.add.text(LP.RP_X + 16, LP.RP_Y + 62, '', {
      fontFamily: FF, fontSize: '13px', color: '#cccccc',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.rightPanelContainer.add(this.materialsRow);

    // Shop toggle — pill button on right side of right panel
    const shopX = LP.RP_X + LP.RP_W - 14;
    const shopY = LP.RP_Y + 26;
    this.shopToggleBg = scene.add.graphics();
    this.rightPanelContainer.add(this.shopToggleBg);

    this.shopToggleText = scene.add.text(shopX, shopY, 'Shop ✔', {
      fontFamily: FF, fontSize: '12px', fontStyle: 'bold', color: '#00ff88',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    this.rightPanelContainer.add(this.shopToggleText);

    // Deck & Relic icon buttons (bottom of right panel)
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
    deckBtn.on('pointerover',  () => deckBtn.setScale(deckBtn.scale * 1.15));
    deckBtn.on('pointerout',   () => deckBtn.setScale(1));
    relicBtn.on('pointerover', () => relicBtn.setScale(relicBtn.scale * 1.15));
    relicBtn.on('pointerout',  () => relicBtn.setScale(1));
    this.rightPanelContainer.add([deckBtn, relicBtn]);

    this.shopToggleText.on('pointerdown', () => {
      const run = getRun();
      run.stopAtShop = !run.stopAtShop;
      this.updateShopToggle(run.stopAtShop);
    });
    this.shopToggleText.on('pointerover', () => this.shopToggleText.setAlpha(0.8));
    this.shopToggleText.on('pointerout',  () => this.shopToggleText.setAlpha(1));

    this.drawShopToggle(true);

    // ── Loop progress bar (center gap between panels) ────────────
    this.buildLoopProgressBar(scene);

    scene.add.existing(this);
  }

  // ── Helpers ────────────────────────────────────────────────────

  /** Draws a glassmorphism panel using Graphics */
  private drawPanel(
    scene: Phaser.Scene,
    x: number, y: number, w: number, h: number,
    fillColor: number, borderColor: number,
  ): void {
    const g = scene.add.graphics();
    g.fillStyle(fillColor, 0.82);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(1.5, borderColor, 0.55);
    g.strokeRoundedRect(x, y, w, h, 8);
    this.add(g);
  }

  private buildLoopProgressBar(scene: Phaser.Scene): void {
    const P = LoopHUD;
    const cx = P.PROG_X + P.PROG_W / 2;   // 400
    const cy = P.PROG_Y + P.PROG_H / 2;   // 62

    // Use the healthbar asset as the entire background for the progress panel
    const pgBg = scene.add.image(cx, cy, 'healthbar').setDisplaySize(P.PROG_W, P.PROG_H);
    this.add(pgBg);

    // "LOOP PROGRESS" label
    this.add(scene.add.text(cx, P.PROG_Y + 28, 'LOOP PROGRESS', {
      fontFamily: FF, fontSize: '14px', fontStyle: 'bold',
      color: '#ffcc88', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5));

    // Progress bar geometry (fits inside the lower slot of the panel)
    const barX = P.PROG_X + 12;
    const barY = P.PROG_Y + 76;
    const barW = P.PROG_W - 24;
    const barH = 20;

    // Bar fill (starts at 0 width)
    this.loopProgressFill = scene.add.rectangle(barX, barY, 0, barH, 0x00ddcc).setOrigin(0, 0.5);
    this.add(this.loopProgressFill);

    // Percentage text inside the bar
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
    this.shopToggleBg.setInteractive(
      new Phaser.Geom.Rectangle(bx - btnW / 2, by - btnH / 2, btnW, btnH),
      Phaser.Geom.Rectangle.Contains,
    );
    this.shopToggleBg.on('pointerdown', () => {
      const run = getRun();
      run.stopAtShop = !run.stopAtShop;
      this.updateShopToggle(run.stopAtShop);
    });
  }

  // ── Public API ─────────────────────────────────────────────────

  update(runState: RunState, positionInLoop: number = 0, loopTotalPixels: number = 1): void {
    // Gold
    const newGold = runState.economy.gold;
    if (newGold !== this.displayedGold) {
      this.tweenValue('gold', this.displayedGold, newGold,
        (v) => this.goldText.setText(String(v)),
        () => { this.displayedGold = newGold; });
    }

    // Loop & difficulty
    this.loopText.setText(`Loop ${runState.loop.count}`);
    this.diffBadgeText.setText(`x${runState.loop.difficulty.toFixed(1)}`);

    // Loop progress bar
    const progress = loopTotalPixels > 0 ? Math.min(1, positionInLoop / loopTotalPixels) : 0;
    const pct = Math.round(progress * 100);
    this.loopProgressFill.width = (LoopHUD.PROG_W - 24) * progress;
    // Color: teal at start → gold near end
    const fillColor = progress < 0.75 ? 0x00ddcc : progress < 0.92 ? 0xf0a020 : 0xff6644;
    this.loopProgressFill.setFillStyle(fillColor);
    this.loopProgressText.setText(`${pct}%`).setColor(pct >= 90 ? '#ff8844' : '#00ddcc');

    // HP
    const newHP    = runState.hero.currentHP;
    const newMaxHP = runState.hero.maxHP;
    this.displayedMaxHP = newMaxHP;
    if (newHP !== this.displayedHP) {
      this.tweenValue('hp', this.displayedHP, newHP, (v) => {
        const ratio = Math.max(0, v / this.displayedMaxHP);
        this.hpBar.width = Math.max(0, this.HP_BAR_W * ratio);
        this.hpBar.setFillStyle(this.hpColor(ratio));
        this.hpText.setText(`${v}/${this.displayedMaxHP}`);
      }, () => { this.displayedHP = newHP; });
    }

    // TP
    const newTP = runState.economy.tilePoints;
    if (newTP !== this.displayedTP) {
      this.tweenValue('tp', this.displayedTP, newTP,
        (v) => this.tpText.setText(`${v} TP`),
        () => { this.displayedTP = newTP; });
    }

    // Materials
    const MAT: Record<string, string> = {
      wood: '🪵', stone: '🪨', iron: '⚙', crystal: '💎', bone: '🦴', herbs: '🌿', essence: '✨',
    };
    const mats = Object.entries(runState.economy.materials ?? {}).filter(([, v]) => v > 0);
    this.materialsRow.setText(
      mats.length > 0
        ? mats.slice(0, 5).map(([k, v]) => `${MAT[k] ?? k[0]}${v}`).join('  ')
        : '',
    );

    // Shop toggle
    this.updateShopToggle(runState.stopAtShop);

    // Pending cards badge
    const pending = runState.deck.droppedCards?.length ?? 0;
    if (pending > 0) {
      this.pendingBadge.setText(`📦 ${pending} new card${pending > 1 ? 's' : ''}`);
      this.pendingBadge.setVisible(true);
    } else {
      this.pendingBadge.setVisible(false);
    }
  }

  private updateShopToggle(enabled: boolean): void {
    this.drawShopToggle(enabled);
    if (enabled) {
      this.shopToggleText.setText('Shop ✔').setColor('#00ff88');
    } else {
      this.shopToggleText.setText('Shop ✘').setColor('#ff4466');
    }
  }

  private tweenValue(
    key: 'gold' | 'hp' | 'tp',
    from: number, to: number,
    onUpdate: (v: number) => void,
    onComplete: () => void,
  ): void {
    const ref = key === 'gold' ? this.goldTween : key === 'hp' ? this.hpTween : this.tpTween;
    if (ref) ref.stop();

    const tween = this.scene.tweens.addCounter({
      from, to, duration: 280,
      onUpdate: (t) => onUpdate(Math.round(t.getValue())),
      onComplete: () => { onUpdate(to); onComplete(); },
    });

    if (key === 'gold') this.goldTween = tween;
    else if (key === 'hp') this.hpTween = tween;
    else this.tpTween = tween;
  }

  private hpColor(ratio: number): number {
    if (ratio > 0.5) return 0x22dd44;
    if (ratio > 0.25) return 0xffaa00;
    return 0xff3333;
  }
}
