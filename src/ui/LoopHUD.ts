import Phaser from 'phaser';
import { type RunState, getRun } from '../state/RunState';
import { FONTS } from './StyleConstants';
// Re-export Phase 9 helpers from a Phaser-free module so tests can import
// without booting Phaser. The runtime path here still uses them.

import { extractStatusRowData } from './LoopHUD.helpers';
import { resolveHeroStats } from '../systems/hero/HeroStatsResolver';
import { buildLoopRewardChips, type RewardChip } from './LoopRewardChips';
import { resolveIconKey } from '../systems/ElementSystem';

export { extractStatusRowData, STATUS_ROW_COLORS } from './LoopHUD.helpers';
export type { StatusRowData } from './LoopHUD.helpers';

const FF = FONTS.family; // Cinzel — bitmapFont not usable here (emojis)

/**
 * LoopHUD -- redesigned fixed HUD overlay for GameScene.
 * Two glassmorphism panels: left (gold / loop / HP), right (TP / materials / shop).
 */
export class LoopHUD extends Phaser.GameObjects.Container {
  // Character panel — combat hero_panel art with HP/STA/MP bars showing through
  // transparent windows, plus the animated chibi pocket sprite in the left slot.
  // Replaces the old Loop/gold/HP panel.
  private charBars: {
    hp?: { fill: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; trackX: number; trackW: number; y: number };
    sta?: { fill: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; trackX: number; trackW: number; y: number };
    mp?: { fill: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; trackX: number; trackW: number; y: number };
  } = {};

  // Loop reward chips — persistent icon|value pills under the hero panel showing
  // this loop's accumulated gains (gold, shards, materials, kills…). Pre-allocated
  // pool; populated each frame from the PendingLoot queue.
  private rewardChipPool: Array<{
    container: Phaser.GameObjects.Container;
    panel: Phaser.GameObjects.Image;
    icon: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text;
    signature: string;
  }> = [];
  private rewardChipsSig = '';

  private tpText!: Phaser.GameObjects.Text;
  private materialsRow!: Phaser.GameObjects.Text;

  private shopToggleBg!: Phaser.GameObjects.Graphics;
  private shopToggleText!: Phaser.GameObjects.Text;
  private rightPanelContainer!: Phaser.GameObjects.Container;


  // Phase 9 (Design v2): STR/VIT/DEX/INT/SPI status row
  private statTexts: { str?: Phaser.GameObjects.Text; vit?: Phaser.GameObjects.Text; dex?: Phaser.GameObjects.Text; int?: Phaser.GameObjects.Text; spi?: Phaser.GameObjects.Text } = {};



  // Loop progress bar (between panels)
  private loopProgressFill!: Phaser.GameObjects.Rectangle;
  private loopProgressText!: Phaser.GameObjects.Text;
  /** Max fill width of the loop-progress bar (set in buildLoopProgressBar). */
  private loopProgressMaxW = 0;
  /** Last progress fraction applied, to skip redundant per-frame setSize calls. */
  private loopProgressFrac = 0;
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

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.setScrollFactor(0).setDepth(100);

    const LP = LoopHUD;

    // ── Left panel — character panel (class + chibi + HP/STA/MP bars) ──
    // Mirrors PlanningOverlay.buildCharacterPanel so the scroll HUD shows the
    // same hero summary as the tile-selection screen's top-right panel.
    this.buildCharacterPanel(scene);

    // Loop reward chips strip, directly under the hero panel.
    this.buildRewardChipPool(scene);

    // ── Right panel ────────────────────────────────────────────
    const leftPanelKey = scene.textures.exists('hud_panel_left') ? 'hud_panel_left' : 'ui_panel';
    this.rightPanelContainer = scene.add.container(0, 0);
    this.rightPanelContainer.setVisible(false);
    this.add(this.rightPanelContainer);

    const rpBg = scene.add.image(LP.RP_X + LP.RP_W / 2, LP.RP_Y + LP.RP_H / 2, leftPanelKey);
    rpBg.setScale(Math.min(LP.RP_W / rpBg.width, LP.RP_H / rpBg.height));
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
    const currentValue = Number.parseInt(txt.text, 10);
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


  // ── hero_panel.png geometry (1849×701) ──────────────────────────
  // Same combat hero panel art but with a left pocket slot. The three HP/STA/MP
  // bars render BEHIND the art and show through baked-in transparent windows;
  // the chibi pocket sits in the dark left slot. Values are normalized fractions
  // of the panel, measured from the asset's alpha channel.
  private static readonly HP_WIN_L = 0.412;   // bar window left  ÷ panelW
  private static readonly HP_WIN_R = 0.916;   // bar window right ÷ panelW
  private static readonly HP_ROW_CY = [0.221, 0.478, 0.741]; // HP / STA / MP centres ÷ panelH
  private static readonly HP_WIN_H = 0.150;   // bar window thickness ÷ panelH
  private static readonly HP_SLOT_CX = 0.165; // pocket-slot centre ÷ panelW
  private static readonly HP_SLOT_CY = 0.50;  // pocket-slot centre ÷ panelH

  /**
   * Character panel — the combat hero panel art (hero_panel.png) with HP/STA/MP
   * bars showing through transparent windows, plus the animated chibi "pocket"
   * sprite in the left slot. Bars are populated/animated in update().
   */
  private buildCharacterPanel(scene: Phaser.Scene): void {
    const LP = LoopHUD;
    const run = getRun();
    const hero = run.hero;

    const cx = LP.LP_X + LP.LP_W / 2;
    const cy = LP.LP_Y + LP.LP_H / 2;
    const panelW = LP.LP_W;
    const panelH = LP.LP_H;

    // Resolve bar-window geometry into screen pixels.
    const barX    = LP.LP_X + LoopHUD.HP_WIN_L * panelW;
    const barMaxW = (LoopHUD.HP_WIN_R - LoopHUD.HP_WIN_L) * panelW;
    const barCX   = barX + barMaxW / 2;
    const barH    = LoopHUD.HP_WIN_H * panelH;

    // ── Bars BEHIND the art (trough → fill), keyed HP / STA / MP ──
    const barDefs: [keyof typeof this.charBars, number, number][] = [
      ['hp',  0x22cc44, 0x200808],
      ['sta', 0xf0a020, 0x181000],
      ['mp',  0x9966ff, 0x0e0820],
    ];
    barDefs.forEach(([key, fillColor, troughColor], i) => {
      const by = LP.LP_Y + LoopHUD.HP_ROW_CY[i] * panelH;
      this.add(scene.add.rectangle(barCX, by, barMaxW, barH, troughColor).setOrigin(0.5));
      const fill = scene.add.rectangle(barX, by, 0, barH, fillColor).setOrigin(0, 0.5);
      this.add(fill);
      const text = scene.add.text(barCX, by, '0/0', {
        fontFamily: FF, fontSize: '12px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
      this.charBars[key] = { fill, text, trackX: barX, trackW: barMaxW, y: by };
    });

    // Panel art ON TOP of the bars (HP/STA/MP show through transparent windows).
    const panelKey = scene.textures.exists('hud_hero_panel')
      ? 'hud_hero_panel'
      : (scene.textures.exists('combat_hero_panel') ? 'combat_hero_panel' : 'hud_panel_left');
    const panelImg = scene.add.image(cx, cy, panelKey);
    panelImg.setDisplaySize(panelW, panelH);
    this.add(panelImg);

    // Chibi pocket sprite — added AFTER the art so it shows in the dark left
    // slot (the slot has an opaque dark background, not a transparent window,
    // so the sprite must render on top of the panel artwork to be visible).
    // Rendered as a static first frame — no idle animation in the HUD pocket.
    const className = hero.className ?? 'warrior';
    const spriteKey = `hero_chibi_${className}`;
    const slotX     = LP.LP_X + LoopHUD.HP_SLOT_CX * panelW;
    const slotY     = LP.LP_Y + LoopHUD.HP_SLOT_CY * panelH;
    const slotSize  = Math.round(panelH * 0.78);
    if (scene.textures.exists(spriteKey)) {
      const chibi = scene.add.sprite(slotX, slotY, spriteKey, 0);
      chibi.setDisplaySize(slotSize, slotSize);
      this.add(chibi);
    } else {
      this.add(scene.add.text(slotX, slotY, '?', {
        fontFamily: FF, fontSize: '20px', color: '#446688',
      }).setOrigin(0.5));
    }

    // Value labels render ABOVE everything.
    this.add(this.charBars.hp!.text);
    this.add(this.charBars.sta!.text);
    this.add(this.charBars.mp!.text);
  }

  // ── Loop reward chips (loop_chip_panel.png, 657×254) ────────────
  // Each chip is one panel: left slot = resource icon, right slot = amount.
  // Laid out in a row under the hero panel, wrapping to a second row if needed.
  // The asset divider sits at ~38% (same proportions as combat_chip_panel).
  private static readonly CHIP_H = 26;            // chip height in px
  private static readonly CHIP_GAP = 4;           // gap between chips
  private static readonly CHIP_ICON_RATIO = 0.38; // icon-slot width ÷ chip width
  private static readonly CHIP_POOL = 8;          // max simultaneous chips
  private static readonly CHIP_TOP = LoopHUD.LP_Y + LoopHUD.LP_H + 4; // strip Y (under hero panel)

  private buildRewardChipPool(scene: Phaser.Scene): void {
    const usePanel = scene.textures.exists('loop_chip_panel');
    for (let i = 0; i < LoopHUD.CHIP_POOL; i++) {
      const c = scene.add.container(0, 0).setVisible(false);
      const panel = usePanel
        ? scene.add.image(0, 0, 'loop_chip_panel').setOrigin(0, 0.5)
        : scene.add.image(0, 0, '__WHITE').setOrigin(0, 0.5).setTint(0x0a1a2a).setAlpha(0.85);
      const icon = scene.add.image(0, 0, '__WHITE')
        .setDisplaySize(16, 16).setOrigin(0.5).setVisible(false);
      const label = scene.add.text(0, 0, '', {
        fontFamily: FF, fontSize: '13px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
      c.add([panel, icon, label]);
      this.add(c);
      this.rewardChipPool.push({ container: c, panel, icon, label, signature: '' });
    }
  }

  /** Best texture key for a reward-chip resource, or null. */
  private resolveChipIcon(scene: Phaser.Scene, key: string): string | null {
    if (key === 'gold') return scene.textures.exists('icon_coin') ? 'icon_coin' : null;
    if (key === 'kills') {
      // Crossed-sword / attack token as a "defeated" proxy.
      return resolveIconKey(scene.textures, 'attack');
    }
    if (key.endsWith('_shard')) {
      return resolveIconKey(scene.textures, key.replace('_shard', ''));
    }
    if (key.startsWith('tile_')) {
      const t = key.replace('tile_', '');
      return scene.textures.exists(`tile_${t}`) ? `tile_${t}` : 'mat_scroll';
    }
    // Material or element id.
    const mat = `mat_${key}`;
    if (scene.textures.exists(mat)) return mat;
    return resolveIconKey(scene.textures, key);
  }

  /** Lay out the current loop's reward chips. Cheap no-op when unchanged. */
  private updateRewardChips(scene: Phaser.Scene): void {
    const chips = buildLoopRewardChips();
    // Signature = quick change-detector so we skip relayout on identical frames.
    const sig = chips.map((c) => `${c.key}:${c.value}`).join('|');
    if (sig === this.rewardChipsSig) return;
    this.rewardChipsSig = sig;

    const LP = LoopHUD;
    const baseX = LP.LP_X;
    let x = 0;
    let row = 0;
    const maxW = LP.LP_W;

    for (let i = 0; i < this.rewardChipPool.length; i++) {
      const slot = this.rewardChipPool[i];
      const chip: RewardChip | undefined = chips[i];
      if (!chip) {
        slot.container.setVisible(false);
        continue;
      }

      const iconKey = this.resolveChipIcon(scene, chip.key);
      const hasIcon = !!(iconKey && scene.textures.exists(iconKey));
      slot.label.setText(chip.value).setColor(chip.color);

      // Width: icon slot (proportional) + text slot.
      const iconSlotW = hasIcon
        ? Math.round(LP.CHIP_H * (657 / 254) * LP.CHIP_ICON_RATIO)
        : 0;
      const textW = Math.max(20, slot.label.width + 10);
      const w = iconSlotW + textW;

      slot.panel.setDisplaySize(w, LP.CHIP_H);

      if (hasIcon) {
        slot.icon.setTexture(iconKey!).setDisplaySize(16, 16)
          .setPosition(iconSlotW / 2, 0).setVisible(true);
      } else {
        slot.icon.setVisible(false);
      }
      slot.label.setPosition(iconSlotW + textW / 2, 0);

      // Wrap to a new row if this chip would overflow the panel width.
      if (x > 0 && x + w > maxW) { x = 0; row += 1; }
      slot.container.setPosition(baseX + x, LP.CHIP_TOP + LP.CHIP_H / 2 + row * (LP.CHIP_H + 4));
      slot.container.setVisible(true);
      x += w + LP.CHIP_GAP;
    }
  }

  /** Update one character-panel bar's fill width + value label. */
  private updateCharBar(
    bar: { fill: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; trackX: number; trackW: number } | undefined,
    cur: number,
    max: number,
  ): void {
    if (!bar) return;
    const frac = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
    bar.fill.width = bar.trackW * frac;
    bar.text.setText(`${cur}/${max}`);
  }

  // ── loop-Panel.png geometry (1878×567) ──────────────────────────
  // "LOOP PROGRESS" panel with a single transparent bar window. The fill bar
  // renders BEHIND the art and shows through the window, like the HP/STA/MP
  // bars on the hero panel. Values are normalized fractions of the panel,
  // measured from the asset's alpha channel.
  private static readonly PROG_WIN_L = 0.080; // bar window left  ÷ panelW
  private static readonly PROG_WIN_R = 0.935; // bar window right ÷ panelW
  private static readonly PROG_WIN_CY = 0.569; // bar window centre ÷ panelH
  private static readonly PROG_WIN_H = 0.213;  // bar window thickness ÷ panelH

  private buildLoopProgressBar(scene: Phaser.Scene): void {
    const P = LoopHUD;

    // Use the loop-Panel art with its baked-in title + bar window when present;
    // fall back to the older progress panel (with a programmatic title) otherwise.
    const hasLoopPanel = scene.textures.exists('hud_loop_panel');
    const cx = P.PROG_X + P.PROG_W / 2;
    const cy = P.PROG_Y + P.PROG_H / 2;

    if (hasLoopPanel) {
      // Bar window geometry → screen pixels.
      const barX    = P.PROG_X + LoopHUD.PROG_WIN_L * P.PROG_W;
      const barMaxW = (LoopHUD.PROG_WIN_R - LoopHUD.PROG_WIN_L) * P.PROG_W;
      const barCX   = barX + barMaxW / 2;
      const barY    = P.PROG_Y + LoopHUD.PROG_WIN_CY * P.PROG_H;
      const barH    = LoopHUD.PROG_WIN_H * P.PROG_H;

      // Trough → fill BEHIND the art.
      this.add(scene.add.rectangle(barCX, barY, barMaxW, barH, 0x0a1a18).setOrigin(0.5));
      this.loopProgressFill = scene.add.rectangle(barX, barY, 0, barH, 0x00ddcc).setOrigin(0, 0.5);
      this.loopProgressMaxW = barMaxW;
      this.add(this.loopProgressFill);

      // Panel art ON TOP (fill shows through the transparent window).
      const panelImg = scene.add.image(cx, cy, 'hud_loop_panel');
      panelImg.setDisplaySize(P.PROG_W, P.PROG_H);
      this.add(panelImg);

      // Percentage label ABOVE the art, centred on the bar.
      this.loopProgressText = scene.add.text(barCX, barY, '0%', {
        fontFamily: FF, fontSize: '12px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5, 0.5);
      this.add(this.loopProgressText);
      return;
    }

    const pgKey = scene.textures.exists('hud_panel_progress') ? 'hud_panel_progress' : 'ui_panel';
    const pgBg = scene.add.image(cx, cy, pgKey);
    pgBg.setScale(Math.min(P.PROG_W / pgBg.width, P.PROG_H / pgBg.height));
    this.add(pgBg);

    if (pgKey === 'ui_panel') {
      this.add(scene.add.text(cx, P.PROG_Y + 32, 'LOOP PROGRESS', {
        fontFamily: FF, fontSize: '13px', fontStyle: 'bold',
        color: '#ffcc88', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5, 0.5));
    }

    const pBarX = P.PROG_X + 26;
    const pBarW = P.PROG_W - 52;
    const barY = P.PROG_Y + 70;
    const barH = 14;
    this.add(scene.add.rectangle(pBarX + pBarW / 2, barY, pBarW, barH, 0x0a1a18, 1)
      .setStrokeStyle(1, 0x224444));
    this.loopProgressFill = scene.add.rectangle(pBarX, barY, 0, barH, 0x00ddcc).setOrigin(0, 0.5);
    this.loopProgressMaxW = pBarW;
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
    const progress = loopTotalPixels > 0 ? Math.min(1, positionInLoop / loopTotalPixels) : 0;
    const pct = Math.round(progress * 100);
    this.loopProgressText.setText(`${pct}%`);

    // Loop-fill: apply the width DIRECTLY each frame. Loop progress is a
    // continuous value that advances every frame as the hero walks, so a
    // per-change tween would be restarted before it could complete and the bar
    // would appear stuck near zero. (This differs from the HP bars, which only
    // change in discrete jumps on damage/heal and can afford a tween.) A Phaser
    // Rectangle's `width` setter alone does NOT re-render the geometry, so we
    // call setSize() — which does — keeping origin (0,0.5) so the left edge
    // stays anchored.
    if (progress !== this.loopProgressFrac) {
      this.loopProgressFrac = progress;
      this.loopProgressFill.setSize(this.loopProgressMaxW * progress, this.loopProgressFill.height);
    }

    // Character panel — HP/STA/MP bars. Use resolved maxHP so passive stat_bonus
    // relics (bronze_scale, vitality_ring) immediately reshape the HP bar
    // denominator out of combat. Clamp the denominator to 1 so a corrupted
    // maxHP===0 save can't propagate NaN into the bar width.
    const resolved = resolveHeroStats(runState);
    const hero = runState.hero;
    // HP bar: divide by the clamped maxHP so a corrupted maxHP===0 can't yield
    // NaN width, but show the real resolved maxHP in the label so the value is
    // surfaced honestly.
    const hpBar = this.charBars.hp;
    if (hpBar) {
      const frac = Math.max(0, Math.min(1, hero.currentHP / Math.max(1, resolved.maxHP)));
      hpBar.fill.width = hpBar.trackW * frac;
      hpBar.text.setText(`${hero.currentHP}/${resolved.maxHP}`);
    }
    this.updateCharBar(this.charBars.sta, hero.currentStamina, hero.maxStamina);
    this.updateCharBar(this.charBars.mp,  hero.currentMana,    hero.maxMana);
    const MAT: Record<string, string> = { wood: '🪵', stone: '🪨', iron: '⚙', crystal: '💎', bone: '🦴', herbs: '🌿', essence: '✨' };
    const mats = Object.entries(runState.economy.materials ?? {}).filter(([, v]) => v > 0);
    this.materialsRow.setText(mats.slice(0, 5).map(([k, v]) => `${MAT[k] ?? k[0]}${v}`).join('  '));
    this.updateShopToggle(runState.stopAtShop);

    // Phase 9 (Design v2): refresh STR/VIT/DEX/INT/SPI status row from resolveHeroStats.
    const status = extractStatusRowData(runState);
    this.applyStatTween('str', status.str);
    this.applyStatTween('vit', status.vit);
    this.applyStatTween('dex', status.dex);
    this.applyStatTween('int', status.int);
    this.applyStatTween('spi', status.spi);

    // Loop reward chips — this loop's accumulated gains under the hero panel.
    this.updateRewardChips(this.scene);
  }

  private updateShopToggle(enabled: boolean): void {
    this.drawShopToggle(enabled);
    const label = enabled ? 'Shop ✔' : 'Shop ✘';
    const color = enabled ? '#00ff88' : '#ff4466';
    this.shopToggleText.setText(label).setColor(color);
  }
}
