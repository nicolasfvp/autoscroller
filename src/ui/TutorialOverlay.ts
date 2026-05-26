// TutorialOverlay — per-scene scripted-tutorial UI.
//
// Each participating scene calls TutorialOverlay.mountIfActive(this) in
// create() and (importantly) registers the spotlight rects for the steps
// it owns via overlay.setStepRect(stepId, rect). The overlay subscribes
// to director changes and re-renders on every step transition; the
// registered rects survive the transitions so a single mount handles
// multi-step scenes (Planning has five steps under one mount).
//
// Modes resolved per step:
//   - click + no spotlight  → centered modal, full-screen blocker, Next btn
//   - click + spotlight     → spotlight cutout, four-edge blockers, Next btn
//   - event + spotlight     → spotlight cutout, four-edge blockers
//   - event + no spotlight  → panel only, NO blocker (lets the scene's
//     interactive elements drive the advance event)
//
// The "no blocker" fallback is what stops the tutorial from dead-locking
// when a step's intended target wasn't registered yet.

import Phaser from 'phaser';
import { tutorialDirector, type TutorialStep } from '../systems/tutorial/TutorialDirector';
import { COLORS, FONTS, LAYOUT } from './StyleConstants';

const OVERLAY_DEPTH = 15000;
const SPOTLIGHT_PAD = 8;
const PANEL_W = 460;
const PANEL_MIN_H = 130;
const PANEL_MARGIN = 18;

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
  /** Edge-rect blockers — recreated every render. */
  private blockers: Phaser.GameObjects.Rectangle[] = [];
  private panelBg: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private nextBtn: Phaser.GameObjects.Text | null = null;
  private unsubscribe: () => void;
  /** Per-step spotlight overrides registered by the scene that owns them. */
  private stepRects: Map<string, SpotlightRect> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(OVERLAY_DEPTH);
    this.container.setScrollFactor(0);

    this.dimGfx = scene.add.graphics();
    this.dimGfx.setScrollFactor(0);
    this.container.add(this.dimGfx);

    this.panelBg = scene.add.rectangle(0, 0, PANEL_W, PANEL_MIN_H, 0x1a1a2e, 0.96)
      .setStrokeStyle(2, 0xffd700)
      .setOrigin(0.5, 0)
      .setInteractive();
    this.panelBg.setScrollFactor(0);
    // Swallow clicks that land on the panel body so they don't fall through
    // to a spotlight-exposed scene element behind it.
    this.panelBg.on('pointerdown', () => { /* swallow */ });
    this.container.add(this.panelBg);

    this.titleText = scene.add.text(0, 0, '', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: COLORS.accent,
      fontFamily: FONTS.family,
      wordWrap: { width: PANEL_W - 32 },
    }).setOrigin(0.5, 0);
    this.titleText.setScrollFactor(0);
    this.container.add(this.titleText);

    this.bodyText = scene.add.text(0, 0, '', {
      fontSize: '12px',
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
      align: 'left',
      lineSpacing: 3,
      wordWrap: { width: PANEL_W - 36 },
    }).setOrigin(0.5, 0);
    this.bodyText.setScrollFactor(0);
    this.container.add(this.bodyText);

    this.unsubscribe = tutorialDirector.subscribe(() => this.refresh());
    this.refresh();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  /** Register the spotlight rect for a specific step id on this scene.
   *  Safe to call before the step is current — stored for later. */
  setStepRect(stepId: string, rect: SpotlightRect): void {
    this.stepRects.set(stepId, rect);
    // Re-render in case the step is already current.
    this.refresh();
  }

  /** Force a re-render against the director's current step. */
  refresh(): void {
    const step = tutorialDirector.getStepForScene(this.scene.scene.key);
    if (!step) {
      this.hide();
      return;
    }
    this.renderStep(step);
  }

  private hide(): void {
    this.container.setVisible(false);
    this.clearBlockers();
    // Drop panel hit-test and any leftover Next button so an invisible
    // overlay can't intercept clicks meant for the scene below.
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
      .setOrigin(0, 0).setInteractive();
    r.setScrollFactor(0);
    r.on('pointerdown', () => { /* swallow */ });
    this.container.add(r);
    this.blockers.push(r);
  }

  private effectiveSpotlight(step: TutorialStep): SpotlightRect | null {
    return this.stepRects.get(step.id) ?? step.spotlight ?? null;
  }

  private renderStep(step: TutorialStep): void {
    this.container.setVisible(true);
    this.clearBlockers();
    this.ensurePanelInteractive();

    const spot = this.effectiveSpotlight(step);

    // Dim + blocker layout.
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

      // Edge blockers around the spotlight — clicks reach scene only inside.
      this.addBlocker(0, 0, LAYOUT.canvasWidth, py);
      this.addBlocker(0, py + ph, LAYOUT.canvasWidth, LAYOUT.canvasHeight - (py + ph));
      this.addBlocker(0, py, px, ph);
      this.addBlocker(px + pw, py, LAYOUT.canvasWidth - (px + pw), ph);
    } else if (step.advance === 'click') {
      // Modal — full dim, full blocker. The Next button stays clickable
      // because it sits at a higher depth than the blocker. Alpha 0.85 so
      // the panel reads as the only thing demanding attention.
      this.dimGfx.fillStyle(0x000000, 0.85);
      this.dimGfx.fillRect(0, 0, LAYOUT.canvasWidth, LAYOUT.canvasHeight);
      this.addBlocker(0, 0, LAYOUT.canvasWidth, LAYOUT.canvasHeight);
    } else {
      // Event-advance step with no registered spotlight — show a passive
      // panel and DON'T block input. Better to under-gate than dead-lock.
      this.dimGfx.fillStyle(0x000000, 0.25);
      // Dim only the panel band so the scene stays visible.
      // (Light dim helps the panel pop without obscuring controls.)
    }

    // Title + body.
    this.titleText.setText(step.title);
    this.bodyText.setText(step.body);

    // Lay out the panel — anchor to keep it away from the spotlight.
    this.layoutPanel(step, spot);

    // Next button — only for 'click' advance.
    this.destroyNextBtn();
    if (step.advance === 'click' && !step.hideNext) {
      this.nextBtn = this.scene.add.text(0, 0, 'Next →', {
        fontSize: '15px',
        fontStyle: 'bold',
        color: COLORS.accent,
        fontFamily: FONTS.family,
        backgroundColor: '#3a2008',
        padding: { left: 18, right: 18, top: 6, bottom: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.nextBtn.setScrollFactor(0);
      this.nextBtn.on('pointerover', () => this.nextBtn?.setColor(COLORS.accentHover));
      this.nextBtn.on('pointerout', () => this.nextBtn?.setColor(COLORS.accent));
      this.nextBtn.on('pointerdown', () => tutorialDirector.advance());
      this.container.add(this.nextBtn);

      const bodyBottom = this.bodyText.y + this.bodyText.height;
      this.nextBtn.x = this.titleText.x;
      this.nextBtn.y = bodyBottom + 18;

      const panelH = (this.nextBtn.y + this.nextBtn.height / 2 + 14) - this.panelBg.y;
      this.panelBg.height = Math.max(PANEL_MIN_H, panelH);
    }

    // Panel pieces above the dim layer.
    this.container.bringToTop(this.panelBg);
    this.container.bringToTop(this.titleText);
    this.container.bringToTop(this.bodyText);
    if (this.nextBtn) this.container.bringToTop(this.nextBtn);
  }

  private layoutPanel(step: TutorialStep, spot: SpotlightRect | null): void {
    // Wrap the body to whichever width we're about to use. Side-anchored
    // panels are narrower than the default; reset wrap each render so a
    // previous step's narrow wrap doesn't persist.
    let wrapW = PANEL_W - 36;
    this.bodyText.setStyle({ wordWrap: { width: wrapW } });
    this.bodyText.setText(step.body);

    const innerPad = 14;
    const titleH = this.titleText.height || 22;
    const buildPanelH = () => {
      const h = innerPad + titleH + 6 + this.bodyText.height + innerPad;
      return step.advance === 'click' && !step.hideNext
        ? Math.max(PANEL_MIN_H, h + 44)
        : Math.max(PANEL_MIN_H, h);
    };

    let panelW = PANEL_W;
    let panelH = buildPanelH();
    let panelCenterX = LAYOUT.canvasWidth / 2;
    let panelTopY: number;

    const anchor = step.panelAnchor ?? (spot
      ? this.pickSpotAnchor(spot, panelH)
      : (step.advance === 'event' ? 'top-fixed' : 'center'));

    if (anchor === 'top-fixed') {
      panelTopY = 12;
    } else if (!spot && anchor === 'bottom') {
      // 'bottom' on a spotlightless step → pin to canvas bottom so the
      // top of the screen stays unobstructed.
      panelTopY = LAYOUT.canvasHeight - 12 - panelH;
    } else if (anchor === 'center' || !spot) {
      panelTopY = (LAYOUT.canvasHeight - panelH) / 2;
    } else if (anchor === 'top') {
      panelTopY = spot.y - panelH - PANEL_MARGIN;
      if (panelTopY < 12) panelTopY = spot.y + spot.height + PANEL_MARGIN;
    } else if (anchor === 'left' || anchor === 'right') {
      // Side anchor — narrow panel that sits next to the spotlight, keeping
      // the spotlighted UI fully visible.
      panelW = 280;
      wrapW = panelW - 36;
      this.bodyText.setStyle({ wordWrap: { width: wrapW } });
      this.bodyText.setText(step.body);
      panelH = buildPanelH();
      const sideMargin = 14;
      if (anchor === 'left') {
        panelCenterX = Math.max(panelW / 2 + sideMargin, spot.x - sideMargin - panelW / 2);
      } else {
        panelCenterX = Math.min(LAYOUT.canvasWidth - panelW / 2 - sideMargin, spot.x + spot.width + sideMargin + panelW / 2);
      }
      // Vertically center the panel on the spotlight when possible.
      panelTopY = spot.y + spot.height / 2 - panelH / 2;
    } else {
      // 'bottom'
      panelTopY = spot.y + spot.height + PANEL_MARGIN;
      if (panelTopY + panelH > LAYOUT.canvasHeight - 12) {
        panelTopY = spot.y - panelH - PANEL_MARGIN;
      }
    }
    if (panelTopY < 12) panelTopY = 12;
    if (panelTopY + panelH > LAYOUT.canvasHeight - 12) {
      panelTopY = LAYOUT.canvasHeight - 12 - panelH;
    }

    this.panelBg.x = panelCenterX;
    this.panelBg.y = panelTopY;
    this.panelBg.width = panelW;
    this.panelBg.height = panelH;

    this.titleText.x = panelCenterX;
    this.titleText.y = panelTopY + innerPad;
    this.titleText.setStyle({ wordWrap: { width: panelW - 32 } });

    this.bodyText.x = panelCenterX;
    this.bodyText.y = this.titleText.y + titleH + 4;
  }

  /**
   * Decide whether the panel fits above, below, or to the side of the
   * spotlight. Vertical placement is preferred when the spotlight is short;
   * side placement is used when the spotlight dominates the vertical axis
   * (e.g. PlanningOverlay's place-tile band that spans 340px).
   */
  private pickSpotAnchor(spot: SpotlightRect, panelH: number): 'top' | 'bottom' | 'left' | 'right' {
    const aboveFits = spot.y - PANEL_MARGIN - panelH >= 12;
    const belowFits = spot.y + spot.height + PANEL_MARGIN + panelH <= LAYOUT.canvasHeight - 12;
    if (belowFits) return 'bottom';
    if (aboveFits) return 'top';
    // Neither vertical option fits — go to whichever side has more room.
    const rightRoom = LAYOUT.canvasWidth - (spot.x + spot.width);
    const leftRoom = spot.x;
    return rightRoom >= leftRoom ? 'right' : 'left';
  }

  private destroyNextBtn(): void {
    if (this.nextBtn) {
      this.nextBtn.destroy();
      this.nextBtn = null;
    }
  }

  destroy(): void {
    this.unsubscribe();
    this.container.destroy(true);
  }

  /** Mount on a scene if the director is active. We mount even when no step
   *  currently targets this scene because mid-scene transitions (e.g. a
   *  Planning step advances while another Planning step is queued) need an
   *  existing overlay listening to refire. The overlay self-hides when no
   *  step applies. Returns null if the tutorial isn't active. */
  static mountIfActive(scene: Phaser.Scene): TutorialOverlay | null {
    if (!tutorialDirector.isActive()) return null;
    return new TutorialOverlay(scene);
  }
}
