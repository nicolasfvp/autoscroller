// TutorialOverlay — per-scene scripted-tutorial UI.
//
// Each participating scene calls TutorialOverlay.mountIfActive(this) in
// create() and (importantly) registers the spotlight rects for the steps
// it owns via overlay.setStepRect(stepId, rect). The overlay subscribes
// to director changes and re-renders on every step transition; the
// registered rects survive the transitions so a single mount handles
// multi-step scenes (Planning has five steps under one mount).
//
// When a pre-rendered text-box image exists for a step (loaded by Preloader
// as tutorial_text_<step_id>), it replaces the programmatic panel+text.
// Falls back to the text-based panel for any step without an image asset.

import Phaser from 'phaser';
import { tutorialDirector, type TutorialStep } from '../systems/tutorial/TutorialDirector';
import { COLORS, FONTS, LAYOUT } from './StyleConstants';

const OVERLAY_DEPTH = 15000;
const SPOTLIGHT_PAD = 8;
const PANEL_W = 460;
const PANEL_MIN_H = 130;
const PANEL_MARGIN = 18;

// Target display width for pre-rendered step images
const IMAGE_DISPLAY_W = Math.round(PANEL_W * 0.85);
// Global vertical offset for image panels
const IMAGE_OFFSET_Y = -30;

// Per-step position overrides for image panels.
// offsetY: added on top of IMAGE_OFFSET_Y.
// anchor: 'bottom-left' | 'top-right' override the horizontal centering.
const STEP_IMAGE_OVERRIDES: Record<string, { offsetY?: number; anchor?: 'bottom-left' | 'top-right' }> = {
  'deck-review':    { offsetY: +30 },
  'planning-intro': { offsetY: -20 },
  'place-tile':     { offsetY: +30 },
  'shop-buy-relic': { anchor: 'bottom-left' },
  'shop-buy-elements': { anchor: 'top-right' },
  'forge-craft':    { offsetY: +20 },
  'boss-preview':   { offsetY: +30 },
};

export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class TutorialOverlay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private dimGfx: Phaser.GameObjects.Graphics;
  private blockers: Phaser.GameObjects.Rectangle[] = [];

  // Image-based panel (used when pre-rendered asset exists)
  private panelImage: Phaser.GameObjects.Image;

  // Text-based panel (fallback)
  private panelBg: Phaser.GameObjects.Rectangle;
  private panelBgImg: Phaser.GameObjects.Image | null = null;
  private titleText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;

  private nextBtn: Phaser.GameObjects.Text | null = null;
  private unsubscribe: () => void;
  private stepRects: Map<string, SpotlightRect> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(OVERLAY_DEPTH);
    this.container.setScrollFactor(0);

    this.dimGfx = scene.add.graphics();
    this.dimGfx.setScrollFactor(0);
    this.container.add(this.dimGfx);

    // Image panel (hidden until a matching texture is confirmed)
    this.panelImage = scene.add.image(0, 0, '__DEFAULT')
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setVisible(false)
      .setInteractive();
    this.panelImage.on('pointerdown', () => { /* swallow */ });
    this.container.add(this.panelImage);

    // Text fallback panel — transparent hit rectangle; image drawn behind it
    this.panelBg = scene.add.rectangle(0, 0, PANEL_W, PANEL_MIN_H, 0x000000, 0)
      .setOrigin(0.5, 0)
      .setInteractive();
    this.panelBg.setScrollFactor(0);
    this.panelBg.on('pointerdown', () => { /* swallow */ });

    if (scene.textures.exists('tutorial_text_panel')) {
      this.panelBgImg = scene.add.image(0, 0, 'tutorial_text_panel')
        .setOrigin(0.5, 0).setScrollFactor(0).setVisible(false);
      this.container.add(this.panelBgImg);
    }
    this.container.add(this.panelBg);

    this.titleText = scene.add.text(0, 0, '', {
      fontSize: '18px', fontStyle: 'bold',
      color: COLORS.accent, fontFamily: FONTS.body,
      wordWrap: { width: PANEL_W - 32 },
    }).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(this.titleText);

    this.bodyText = scene.add.text(0, 0, '', {
      fontSize: '12px', color: COLORS.textPrimary,
      fontFamily: FONTS.body, align: 'left',
      lineSpacing: 3, wordWrap: { width: PANEL_W - 36 },
    }).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(this.bodyText);

    this.unsubscribe = tutorialDirector.subscribe(() => this.refresh());
    this.refresh();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  setStepRect(stepId: string, rect: SpotlightRect): void {
    this.stepRects.set(stepId, rect);
    this.refresh();
  }

  refresh(): void {
    const step = tutorialDirector.getStepForScene(this.scene.scene.key);
    if (!step) { this.hide(); return; }
    this.renderStep(step);
  }

  private syncPanelBgImg(): void {
    if (!this.panelBgImg) return;
    // tutorial_text_panel native: 1986 × 792. Scale to match panelBg width.
    const sc = this.panelBg.width / 1986;
    this.panelBgImg.setScale(sc);
    this.panelBgImg.x = this.panelBg.x;
    this.panelBgImg.y = this.panelBg.y;
  }

  private hide(): void {
    this.container.setVisible(false);
    this.clearBlockers();
    if (this.panelBg.input) this.panelBg.disableInteractive();
    this.destroyNextBtn();
  }

  private ensurePanelInteractive(): void {
    if (!this.panelBg.input) {
      this.panelBg.setInteractive();
      this.panelBg.on('pointerdown', () => { /* swallow */ });
    }
  }

  private clearBlockers(): void {
    for (const b of this.blockers) b.destroy();
    this.blockers = [];
  }

  private addBlocker(x: number, y: number, w: number, h: number): void {
    if (w <= 0 || h <= 0) return;
    const r = this.scene.add.rectangle(x, y, w, h, 0x000000, 0)
      .setOrigin(0, 0).setInteractive().setScrollFactor(0);
    r.on('pointerdown', () => { /* swallow */ });
    this.container.add(r);
    this.blockers.push(r);
  }

  private effectiveSpotlight(step: TutorialStep): SpotlightRect | null {
    return this.stepRects.get(step.id) ?? step.spotlight ?? null;
  }

  private getTextureKey(stepId: string): string {
    return `tutorial_text_${stepId.replace(/-/g, '_')}`;
  }

  private renderStep(step: TutorialStep): void {
    this.container.setVisible(true);
    this.clearBlockers();
    this.ensurePanelInteractive();

    const spot = this.effectiveSpotlight(step);
    const texKey = this.getTextureKey(step.id);
    const useImage = this.scene.textures.exists(texKey);

    // Dim + blocker layout
    this.dimGfx.clear();
    if (spot) {
      const px = spot.x - SPOTLIGHT_PAD;
      const py = spot.y - SPOTLIGHT_PAD;
      const pw = spot.width + SPOTLIGHT_PAD * 2;
      const ph = spot.height + SPOTLIGHT_PAD * 2;
      this.dimGfx.fillStyle(0x000000, 0.62);
      this.dimGfx.fillRect(0, 0, LAYOUT.canvasWidth, py);
      this.dimGfx.fillRect(0, py + ph, LAYOUT.canvasWidth, LAYOUT.canvasHeight - (py + ph));
      this.dimGfx.fillRect(0, py, px, ph);
      this.dimGfx.fillRect(px + pw, py, LAYOUT.canvasWidth - (px + pw), ph);
      this.dimGfx.lineStyle(3, 0xffd700, 0.95);
      this.dimGfx.strokeRect(px, py, pw, ph);
      this.addBlocker(0, 0, LAYOUT.canvasWidth, py);
      this.addBlocker(0, py + ph, LAYOUT.canvasWidth, LAYOUT.canvasHeight - (py + ph));
      this.addBlocker(0, py, px, ph);
      this.addBlocker(px + pw, py, LAYOUT.canvasWidth - (px + pw), ph);
    } else if (step.advance === 'click') {
      this.dimGfx.fillStyle(0x000000, 0.85);
      this.dimGfx.fillRect(0, 0, LAYOUT.canvasWidth, LAYOUT.canvasHeight);
      this.addBlocker(0, 0, LAYOUT.canvasWidth, LAYOUT.canvasHeight);
    } else {
      this.dimGfx.fillStyle(0x000000, 0.25);
    }

    // Show image or text panel
    this.panelImage.setVisible(useImage);
    this.panelBg.setVisible(!useImage);
    if (this.panelBgImg) this.panelBgImg.setVisible(!useImage);
    this.titleText.setVisible(!useImage);
    this.bodyText.setVisible(!useImage);

    if (useImage) {
      this.panelImage.setTexture(texKey);
      this.panelImage.setScale(IMAGE_DISPLAY_W / this.panelImage.width);
    } else {
      this.titleText.setText(step.title);
      this.bodyText.setText(step.body);
    }

    const panelTopY = this.layoutPanel(step, spot, useImage);

    // Next button (click-advance steps only)
    this.destroyNextBtn();
    if (step.advance === 'click' && !step.hideNext) {
      const panelCenterX = LAYOUT.canvasWidth / 2;
      const btnY = useImage
        ? panelTopY + IMAGE_OFFSET_Y + this.panelImage.displayHeight + 18
        : this.bodyText.y + this.bodyText.height + 36;

      const btnW = 153;
      if (this.scene.textures.exists('btn_next')) {
        const img = this.scene.add.image(panelCenterX, btnY, 'btn_next')
          .setInteractive({ useHandCursor: true }).setScrollFactor(0);
        const s = btnW / img.width;
        img.setScale(s);
        img.on('pointerover', () => { img.setAlpha(0.85); img.setScale(s * 1.05); });
        img.on('pointerout',  () => { img.setAlpha(1);    img.setScale(s); });
        img.on('pointerdown', () => tutorialDirector.advance());
        this.nextBtn = img as unknown as Phaser.GameObjects.Text;
        this.container.add(img);
      } else {
        this.nextBtn = this.scene.add.text(panelCenterX, btnY, 'Next →', {
          fontSize: '15px', fontStyle: 'bold',
          color: COLORS.accent, fontFamily: FONTS.body,
          backgroundColor: '#3a2008',
          padding: { left: 18, right: 18, top: 6, bottom: 6 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0);
        this.nextBtn.on('pointerover', () => this.nextBtn?.setColor(COLORS.accentHover));
        this.nextBtn.on('pointerout',  () => this.nextBtn?.setColor(COLORS.accent));
        this.nextBtn.on('pointerdown', () => tutorialDirector.advance());
        this.container.add(this.nextBtn);
      }

      if (!useImage) {
        const panelH = (btnY + (this.nextBtn.height / 2) + 14) - this.panelBg.y;
        this.panelBg.height = Math.max(PANEL_MIN_H, panelH);
        this.syncPanelBgImg();
      }
    }

    // Bring panel elements above dim
    this.container.bringToTop(useImage ? this.panelImage : this.panelBg);
    if (!useImage) {
      if (this.panelBgImg) this.container.bringToTop(this.panelBgImg);
      this.container.bringToTop(this.panelBg);
      this.container.bringToTop(this.titleText);
      this.container.bringToTop(this.bodyText);
    }
    if (this.nextBtn) this.container.bringToTop(this.nextBtn);
  }

  /** Lay out the panel and return the computed panelTopY. */
  private layoutPanel(step: TutorialStep, spot: SpotlightRect | null, useImage: boolean): number {
    const imgOverride = useImage ? (STEP_IMAGE_OVERRIDES[step.id] ?? {}) : {};
    const innerPad = 14;
    const hasNextBtn = step.advance === 'click' && !step.hideNext;

    let panelH: number;
    let panelW: number;

    if (useImage) {
      panelW = IMAGE_DISPLAY_W;
      panelH = this.panelImage.displayHeight + (hasNextBtn ? 50 : 0);
    } else {
      let wrapW = PANEL_W - 36;
      this.bodyText.setStyle({ wordWrap: { width: wrapW } });
      this.bodyText.setText(step.body);
      const titleH = this.titleText.height || 22;
      const buildH = () => {
        const h = innerPad + titleH + 6 + this.bodyText.height + innerPad;
        return hasNextBtn ? Math.max(PANEL_MIN_H, h + 44) : Math.max(PANEL_MIN_H, h);
      };
      panelH = buildH();
      panelW = PANEL_W;
    }

    const panelCenterX = LAYOUT.canvasWidth / 2;

    const anchor = step.panelAnchor ?? (spot
      ? this.pickSpotAnchor(spot, panelH)
      : (step.advance === 'event' ? 'top-fixed' : 'center'));

    let panelTopY: number;
    if (anchor === 'top-fixed') {
      panelTopY = 12;
    } else if (!spot && anchor === 'bottom') {
      panelTopY = LAYOUT.canvasHeight - 12 - panelH;
    } else if (anchor === 'center' || !spot) {
      panelTopY = (LAYOUT.canvasHeight - panelH) / 2;
    } else if (anchor === 'top') {
      panelTopY = spot.y - panelH - PANEL_MARGIN;
      if (panelTopY < 12) panelTopY = spot.y + spot.height + PANEL_MARGIN;
    } else if (anchor === 'left' || anchor === 'right') {
      if (!useImage) {
        panelW = 280;
        this.bodyText.setStyle({ wordWrap: { width: panelW - 36 } });
        this.bodyText.setText(step.body);
        const titleH = this.titleText.height || 22;
        panelH = innerPad + titleH + 6 + this.bodyText.height + innerPad + (hasNextBtn ? 44 : 0);
        panelH = Math.max(PANEL_MIN_H, panelH);
      }
      const sideMargin = 14;
      const cx = anchor === 'left'
        ? Math.max(panelW / 2 + sideMargin, spot.x - sideMargin - panelW / 2)
        : Math.min(LAYOUT.canvasWidth - panelW / 2 - sideMargin, spot.x + spot.width + sideMargin + panelW / 2);
      panelTopY = spot.y + spot.height / 2 - panelH / 2;
      // Position objects with side-anchor center X
      if (useImage) {
        this.panelImage.x = cx;
        this.panelImage.y = Math.max(12, panelTopY) + IMAGE_OFFSET_Y + (imgOverride.offsetY ?? 0);
      } else {
        this.panelBg.x = cx; this.panelBg.y = Math.max(12, panelTopY);
        this.panelBg.width = panelW; this.panelBg.height = panelH;
        this.syncPanelBgImg();
        this.titleText.x = cx; this.titleText.y = Math.max(12, panelTopY) + innerPad;
        this.titleText.setStyle({ wordWrap: { width: panelW - 32 } });
        this.bodyText.x = cx; this.bodyText.y = this.titleText.y + (this.titleText.height || 22) + 4;
      }
      return Math.max(12, panelTopY);
    } else {
      panelTopY = spot.y + spot.height + PANEL_MARGIN;
      if (panelTopY + panelH > LAYOUT.canvasHeight - 12) panelTopY = spot.y - panelH - PANEL_MARGIN;
    }

    if (panelTopY < 12) panelTopY = 12;
    if (panelTopY + panelH > LAYOUT.canvasHeight - 12) panelTopY = LAYOUT.canvasHeight - 12 - panelH;

    if (useImage) {
      const totalOffsetY = IMAGE_OFFSET_Y + (imgOverride.offsetY ?? 0);
      const imgH = this.panelImage.displayHeight;
      const SIDE_PAD = 14;
      if (imgOverride.anchor === 'bottom-left') {
        this.panelImage.x = IMAGE_DISPLAY_W / 2 + SIDE_PAD;
        this.panelImage.y = LAYOUT.canvasHeight - imgH - SIDE_PAD;
      } else if (imgOverride.anchor === 'top-right') {
        this.panelImage.x = LAYOUT.canvasWidth - IMAGE_DISPLAY_W / 2 - SIDE_PAD;
        this.panelImage.y = SIDE_PAD;
      } else {
        this.panelImage.x = panelCenterX;
        this.panelImage.y = panelTopY + totalOffsetY;
      }
    } else {
      this.panelBg.x = panelCenterX; this.panelBg.y = panelTopY;
      this.panelBg.width = panelW; this.panelBg.height = panelH;
      this.syncPanelBgImg();
      this.titleText.x = panelCenterX; this.titleText.y = panelTopY + innerPad;
      this.titleText.setStyle({ wordWrap: { width: panelW - 32 } });
      this.bodyText.x = panelCenterX; this.bodyText.y = this.titleText.y + (this.titleText.height || 22) + 4;
    }

    return panelTopY;
  }

  private pickSpotAnchor(spot: SpotlightRect, panelH: number): 'top' | 'bottom' | 'left' | 'right' {
    const aboveFits = spot.y - PANEL_MARGIN - panelH >= 12;
    const belowFits = spot.y + spot.height + PANEL_MARGIN + panelH <= LAYOUT.canvasHeight - 12;
    if (belowFits) return 'bottom';
    if (aboveFits) return 'top';
    return (LAYOUT.canvasWidth - (spot.x + spot.width)) >= spot.x ? 'right' : 'left';
  }

  private destroyNextBtn(): void {
    if (this.nextBtn) { this.nextBtn.destroy(); this.nextBtn = null; }
  }

  destroy(): void {
    this.unsubscribe();
    this.container.destroy(true);
  }

  static mountIfActive(scene: Phaser.Scene): TutorialOverlay | null {
    if (!tutorialDirector.isActive()) return null;
    return new TutorialOverlay(scene);
  }
}
