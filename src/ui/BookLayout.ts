// BookLayout — reusable "open tome" UI for the Collection / Card Library scenes.
//
// Shape: a leather-bound book lying open on a desk, two facing parchment
// pages, gilded gold borders, ribbon bookmark, chapter tabs across the top,
// page-flip arrows at the bottom. The book chrome is rendered procedurally
// (no external asset generation required) on top of the existing painted
// `bg_card_library` backdrop.
//
// Callers supply a render callback that populates the two page containers
// for the current spread index. flipForward / flipBackward animate the
// page-flip via a scaleX tween anchored at the spine, then re-invoke the
// renderer for the new spread mid-animation.
//
// Why a separate helper instead of inlining per scene: CollectionScene and
// CardLibraryScene both want the same chrome and the same animation, just
// with different content. Owning the chrome in one place keeps them in sync.

import Phaser from 'phaser';
import { FONTS } from './StyleConstants';

const FF = FONTS.family;

const CANVAS_W = 800;
const CANVAS_H = 600;
const BOOK_TOP = 130;
const BOOK_BOTTOM = 558;
const BOOK_HEIGHT = BOOK_BOTTOM - BOOK_TOP;
const SPINE_X = 400;
const PAGE_WIDTH = 335;
const PAGE_GAP = 6;
const PAGE_INNER_PADDING_X = 24;
const PAGE_INNER_PADDING_TOP = 28;
const PAGE_INNER_PADDING_BOTTOM = 50; // extra room for page indicator + arrows

// Colors
const PARCHMENT_LIGHT = 0xefdcb0;
const PARCHMENT_MID = 0xd4b97a;
const PARCHMENT_DARK = 0x9d7e44;
const LEATHER_DARK = 0x231510;
const LEATHER_MID = 0x3a2218;
const LEATHER_LIGHT = 0x5a3422;
const GOLD_BRIGHT = 0xf5d273;
const GOLD_MID = 0xc89a3c;
const GOLD_DARK = 0x8a6420;
const SPINE_SHADOW = 0x1a0d06;
const RIBBON_RED = 0x7a1e1e;
const RIBBON_HIGHLIGHT = 0x9a2828;

const TAB_WIDTH = 130;
const TAB_HEIGHT = 42;

export interface BookTab {
  key: string;
  label: string;
  badge?: string;
}

/** Bounds for a single page, expressed in container-local coords (the page
 *  container is positioned at the spine, so x is relative to the spine and
 *  y is relative to the book's vertical center). */
export interface BookPageBounds {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  innerX: number;   // top-left of usable inner content (after padding)
  innerY: number;
  innerW: number;
  innerH: number;
}

export interface BookRenderContext {
  spreadIndex: number;
  totalSpreads: number;
  leftPage: Phaser.GameObjects.Container;
  rightPage: Phaser.GameObjects.Container;
  leftBounds: BookPageBounds;
  rightBounds: BookPageBounds;
}

export interface BookLayoutOptions {
  tabs?: BookTab[];
  initialTabKey?: string;
  onTabChange?: (key: string) => void;
  onClose?: () => void;
  /** Title rendered above the book (e.g. "Library"). */
  title?: string;
  /** Optional small text under the title (e.g. "42% complete"). */
  subtitle?: string;
}

export class BookLayout {
  private scene: Phaser.Scene;
  private opts: BookLayoutOptions;
  private root: Phaser.GameObjects.Container;
  private leftPage!: Phaser.GameObjects.Container;
  private rightPage!: Phaser.GameObjects.Container;
  private leftPageBounds!: BookPageBounds;
  private rightPageBounds!: BookPageBounds;
  private tabRecords = new Map<string, {
    container: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
    badge?: Phaser.GameObjects.Text;
  }>();
  private activeTab = '';
  private spreadIndex = 0;
  private totalSpreads = 1;
  private renderer: ((ctx: BookRenderContext) => void) | null = null;
  private flipping = false;
  private pageIndicator!: Phaser.GameObjects.Text;
  private prevArrow!: Phaser.GameObjects.Container;
  private nextArrow!: Phaser.GameObjects.Container;
  private subtitleText: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, opts: BookLayoutOptions = {}) {
    this.scene = scene;
    this.opts = opts;
    this.root = scene.add.container(0, 0);

    this.buildBackdrop();
    this.buildBookChrome();
    this.buildPages();
    this.buildTitle();
    this.buildTabs();
    this.buildNavigation();
    this.buildCloseButton();

    if (opts.initialTabKey) {
      // Set without invoking onTabChange (caller drives initial state explicitly)
      this.setActiveTabInternal(opts.initialTabKey);
    }
  }

  // ── Public API ────────────────────────────────────────────

  setRenderer(cb: (ctx: BookRenderContext) => void): void {
    this.renderer = cb;
    this.repaint();
  }

  setTotalSpreads(total: number): void {
    this.totalSpreads = Math.max(1, total);
    if (this.spreadIndex >= this.totalSpreads) {
      this.spreadIndex = this.totalSpreads - 1;
    }
    if (this.spreadIndex < 0) this.spreadIndex = 0;
    this.updateNavState();
  }

  /** Jump to a spread without animation (used on tab change / filter reset). */
  setSpreadIndex(idx: number): void {
    this.spreadIndex = Math.max(0, Math.min(idx, this.totalSpreads - 1));
    this.repaint();
  }

  /** Atomic content swap: set the spread count, jump to spread 0, install a
   *  new renderer, and repaint exactly once. Used on tab changes so we don't
   *  paint twice with intermediate state. */
  setContent(totalSpreads: number, renderer: (ctx: BookRenderContext) => void): void {
    this.totalSpreads = Math.max(1, totalSpreads);
    this.spreadIndex = 0;
    this.renderer = renderer;
    this.repaint();
  }

  setActiveTab(key: string): void {
    if (this.activeTab === key || this.flipping) return;
    this.setActiveTabInternal(key);
    this.opts.onTabChange?.(key);
  }

  setTabBadge(key: string, badge: string): void {
    const rec = this.tabRecords.get(key);
    if (rec?.badge) rec.badge.setText(badge);
  }

  setSubtitle(text: string): void {
    if (this.subtitleText) this.subtitleText.setText(text);
  }

  flipForward(): void {
    if (this.flipping || this.spreadIndex >= this.totalSpreads - 1) return;
    this.flip('next');
  }

  flipBackward(): void {
    if (this.flipping || this.spreadIndex <= 0) return;
    this.flip('prev');
  }

  getActiveTab(): string { return this.activeTab; }
  getSpreadIndex(): number { return this.spreadIndex; }
  getTotalSpreads(): number { return this.totalSpreads; }

  destroy(): void {
    this.root.destroy(true);
    this.tabRecords.clear();
  }

  // ── Build steps ───────────────────────────────────────────

  private buildBackdrop(): void {
    if (this.scene.textures.exists('bg_card_library')) {
      const bg = this.scene.add.image(400, 300, 'bg_card_library').setDisplaySize(CANVAS_W, CANVAS_H);
      this.root.add(bg);
    } else {
      const bg = this.scene.add.rectangle(400, 300, CANVAS_W, CANVAS_H, 0x1a0e08);
      this.root.add(bg);
    }
    // Vignette
    const vignette = this.scene.add.rectangle(400, 300, CANVAS_W, CANVAS_H, 0x000000, 0.55);
    this.root.add(vignette);
  }

  private buildBookChrome(): void {
    const bookY = (BOOK_TOP + BOOK_BOTTOM) / 2;
    const coverW = (PAGE_WIDTH + PAGE_GAP) * 2 + 24;
    const coverH = BOOK_HEIGHT + 22;

    // Drop shadow under book
    const shadow = this.scene.add.ellipse(SPINE_X, BOOK_BOTTOM + 10, coverW + 20, 28, 0x000000, 0.55);
    this.root.add(shadow);

    // Leather cover
    const cover = this.scene.add.graphics();
    cover.fillStyle(LEATHER_DARK, 1);
    cover.fillRoundedRect(SPINE_X - coverW / 2, bookY - coverH / 2, coverW, coverH, 14);
    // Subtle leather highlight along top
    cover.fillStyle(LEATHER_LIGHT, 0.25);
    cover.fillRoundedRect(SPINE_X - coverW / 2 + 4, bookY - coverH / 2 + 4, coverW - 8, 18, 8);
    // Outer trim
    cover.lineStyle(2, GOLD_DARK, 0.7);
    cover.strokeRoundedRect(SPINE_X - coverW / 2 + 2, bookY - coverH / 2 + 2, coverW - 4, coverH - 4, 12);
    this.root.add(cover);

    // Spine (the dark gutter between the pages)
    const spine = this.scene.add.graphics();
    spine.fillStyle(SPINE_SHADOW, 1);
    spine.fillRect(SPINE_X - 10, BOOK_TOP - 4, 20, BOOK_HEIGHT + 8);
    spine.fillStyle(0x000000, 0.6);
    spine.fillRect(SPINE_X - 1, BOOK_TOP - 4, 2, BOOK_HEIGHT + 8);
    this.root.add(spine);
  }

  private buildPages(): void {
    const bookY = (BOOK_TOP + BOOK_BOTTOM) / 2;
    const leftCx = -(PAGE_GAP + PAGE_WIDTH / 2);
    const rightCx = PAGE_GAP + PAGE_WIDTH / 2;

    // Page containers positioned AT the spine so scaleX tweens are anchored there.
    this.leftPage = this.scene.add.container(SPINE_X, bookY);
    this.rightPage = this.scene.add.container(SPINE_X, bookY);

    this.drawPageBackground(this.leftPage, leftCx, 0);
    this.drawPageBackground(this.rightPage, rightCx, 0);

    this.root.add(this.leftPage);
    this.root.add(this.rightPage);

    // Ribbon — drawn AFTER pages so it sits over them. Lives in rootContainer
    // (not page containers) because it's part of the book chrome, not page content.
    const ribbon = this.scene.add.graphics();
    ribbon.fillStyle(RIBBON_RED, 1);
    ribbon.fillRect(SPINE_X - 7, BOOK_TOP - 14, 14, 78);
    ribbon.fillTriangle(SPINE_X - 7, BOOK_TOP + 64, SPINE_X, BOOK_TOP + 56, SPINE_X + 7, BOOK_TOP + 64);
    ribbon.fillStyle(RIBBON_HIGHLIGHT, 1);
    ribbon.fillRect(SPINE_X - 7, BOOK_TOP - 14, 4, 78);
    ribbon.fillStyle(0x4a0c0c, 0.7);
    ribbon.fillRect(SPINE_X + 3, BOOK_TOP - 14, 4, 78);
    this.root.add(ribbon);

    // Bounds in container-LOCAL coordinates. Renderer should create children
    // at these coords and add to the appropriate page container.
    const halfH = BOOK_HEIGHT / 2;
    this.leftPageBounds = {
      centerX: leftCx,
      centerY: 0,
      width: PAGE_WIDTH,
      height: BOOK_HEIGHT,
      innerX: leftCx - PAGE_WIDTH / 2 + PAGE_INNER_PADDING_X,
      innerY: -halfH + PAGE_INNER_PADDING_TOP,
      innerW: PAGE_WIDTH - 2 * PAGE_INNER_PADDING_X,
      innerH: BOOK_HEIGHT - PAGE_INNER_PADDING_TOP - PAGE_INNER_PADDING_BOTTOM,
    };
    this.rightPageBounds = {
      centerX: rightCx,
      centerY: 0,
      width: PAGE_WIDTH,
      height: BOOK_HEIGHT,
      innerX: rightCx - PAGE_WIDTH / 2 + PAGE_INNER_PADDING_X,
      innerY: -halfH + PAGE_INNER_PADDING_TOP,
      innerW: PAGE_WIDTH - 2 * PAGE_INNER_PADDING_X,
      innerH: BOOK_HEIGHT - PAGE_INNER_PADDING_TOP - PAGE_INNER_PADDING_BOTTOM,
    };
  }

  /** Draw parchment + gold border + corner ornaments INTO the page container
   *  using container-local coords. Including this in the page container means
   *  it scales with the flip animation (the page itself flips, not just cards). */
  private drawPageBackground(parent: Phaser.GameObjects.Container, cx: number, cy: number): void {
    const x = cx - PAGE_WIDTH / 2;
    const y = cy - BOOK_HEIGHT / 2;
    const w = PAGE_WIDTH;
    const h = BOOK_HEIGHT;

    const gfx = this.scene.add.graphics();

    // Subtle drop shadow off the outer edge (away from spine)
    const outerDir = cx > 0 ? 3 : -3;
    gfx.fillStyle(0x000000, 0.35);
    gfx.fillRoundedRect(x + outerDir, y + 4, w, h, 4);

    // Parchment — three layered fills to fake an aged-paper gradient
    gfx.fillStyle(PARCHMENT_DARK, 1);
    gfx.fillRoundedRect(x, y, w, h, 4);
    gfx.fillStyle(PARCHMENT_MID, 1);
    gfx.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 3);
    gfx.fillStyle(PARCHMENT_LIGHT, 1);
    gfx.fillRoundedRect(x + 6, y + 6, w - 12, h - 12, 2);

    // Gilded inner frame — outer dark line + inner bright line for depth
    gfx.lineStyle(2, GOLD_DARK, 1);
    gfx.strokeRoundedRect(x + 12, y + 14, w - 24, h - 28, 2);
    gfx.lineStyle(1, GOLD_BRIGHT, 1);
    gfx.strokeRoundedRect(x + 14, y + 16, w - 28, h - 32, 2);

    parent.add(gfx);

    // Corner flourishes
    this.drawCornerOrnament(parent, x + 22, y + 24, 1, 1);
    this.drawCornerOrnament(parent, x + w - 22, y + 24, -1, 1);
    this.drawCornerOrnament(parent, x + 22, y + h - 24, 1, -1);
    this.drawCornerOrnament(parent, x + w - 22, y + h - 24, -1, -1);
  }

  private drawCornerOrnament(
    parent: Phaser.GameObjects.Container,
    x: number, y: number, sx: number, sy: number,
  ): void {
    const gfx = this.scene.add.graphics();
    // Center jewel
    gfx.fillStyle(GOLD_BRIGHT, 1);
    gfx.fillCircle(x, y, 3);
    gfx.fillStyle(GOLD_DARK, 1);
    gfx.fillCircle(x, y, 1.4);
    // Horizontal scroll
    gfx.lineStyle(1.5, GOLD_BRIGHT, 1);
    gfx.lineBetween(x + sx * 3, y, x + sx * 16, y);
    gfx.lineStyle(1, GOLD_DARK, 0.9);
    gfx.lineBetween(x + sx * 3, y + 1.5 * sy, x + sx * 15, y + 1.5 * sy);
    // Vertical scroll
    gfx.lineStyle(1.5, GOLD_BRIGHT, 1);
    gfx.lineBetween(x, y + sy * 3, x, y + sy * 10);
    gfx.lineStyle(1, GOLD_DARK, 0.9);
    gfx.lineBetween(x + 1.5 * sx, y + sy * 3, x + 1.5 * sx, y + sy * 9);
    // Outer pip
    gfx.fillStyle(GOLD_BRIGHT, 1);
    gfx.fillCircle(x + sx * 17, y, 1.6);
    gfx.fillCircle(x, y + sy * 11, 1.6);
    parent.add(gfx);
  }

  private buildTitle(): void {
    const title = this.opts.title ?? '';
    if (title) {
      const t = this.scene.add.text(SPINE_X, 32, title, {
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#f5d273',
        stroke: '#1a0a04',
        strokeThickness: 4,
        shadow: { offsetX: 1, offsetY: 2, color: '#000000', blur: 4, fill: true },
        fontFamily: FF,
      }).setOrigin(0.5);
      this.root.add(t);
    }
    if (this.opts.subtitle) {
      this.subtitleText = this.scene.add.text(SPINE_X, 54, this.opts.subtitle, {
        fontSize: '12px',
        color: '#d4b97a',
        fontFamily: FF,
      }).setOrigin(0.5);
      this.root.add(this.subtitleText);
    }
  }

  private buildTabs(): void {
    const tabs = this.opts.tabs ?? [];
    if (tabs.length === 0) return;

    const tabGap = 6;
    const totalW = tabs.length * TAB_WIDTH + (tabs.length - 1) * tabGap;
    const startX = SPINE_X - totalW / 2 + TAB_WIDTH / 2;
    const tabY = BOOK_TOP - TAB_HEIGHT / 2 + 6; // overlap into book slightly

    tabs.forEach((tab, i) => {
      const x = startX + i * (TAB_WIDTH + tabGap);
      const container = this.scene.add.container(x, tabY);

      const bg = this.scene.add.graphics();
      this.drawTabBg(bg, false, false);
      container.add(bg);

      const label = this.scene.add.text(0, tab.badge ? -5 : 0, tab.label, {
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#f0d68a',
        stroke: '#1a0a04',
        strokeThickness: 3,
        fontFamily: FF,
      }).setOrigin(0.5);
      container.add(label);

      let badge: Phaser.GameObjects.Text | undefined;
      if (tab.badge) {
        badge = this.scene.add.text(0, 10, tab.badge, {
          fontSize: '10px',
          color: '#c9a874',
          fontFamily: FF,
        }).setOrigin(0.5);
        container.add(badge);
      }

      // Hit-testing on a Container with setSize uses (x,y,w,h) as TOP-LEFT —
      // it ignores that our children are centered at the container origin, so
      // the clickable region ends up offset down-and-right of the visible tab.
      // Use a dedicated Zone (which honors setOrigin) for input instead.
      const hitZone = this.scene.add.zone(x, tabY, TAB_WIDTH, TAB_HEIGHT)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      hitZone.on('pointerover', () => {
        if (this.activeTab !== tab.key) this.drawTabBg(bg, false, true);
      });
      hitZone.on('pointerout', () => {
        this.drawTabBg(bg, this.activeTab === tab.key, false);
      });
      hitZone.on('pointerdown', () => this.setActiveTab(tab.key));

      this.root.add(container);
      this.root.add(hitZone);
      this.tabRecords.set(tab.key, { container, bg, label, badge });
    });
  }

  private drawTabBg(gfx: Phaser.GameObjects.Graphics, active: boolean, hovered: boolean): void {
    gfx.clear();
    const fill = active ? LEATHER_LIGHT : (hovered ? 0x4d2c1c : LEATHER_MID);
    gfx.fillStyle(fill, 1);
    gfx.fillRoundedRect(-TAB_WIDTH / 2, -TAB_HEIGHT / 2, TAB_WIDTH, TAB_HEIGHT, { tl: 10, tr: 10, bl: 0, br: 0 });
    // Subtle leather highlight at top
    gfx.fillStyle(0xffffff, active ? 0.08 : 0.04);
    gfx.fillRoundedRect(-TAB_WIDTH / 2 + 4, -TAB_HEIGHT / 2 + 3, TAB_WIDTH - 8, 8, 6);
    // Gold trim top
    gfx.lineStyle(2, active ? GOLD_BRIGHT : GOLD_DARK, 1);
    gfx.beginPath();
    gfx.moveTo(-TAB_WIDTH / 2 + 10, -TAB_HEIGHT / 2);
    gfx.lineTo(TAB_WIDTH / 2 - 10, -TAB_HEIGHT / 2);
    gfx.strokePath();
    // Brass stud rivets
    gfx.fillStyle(GOLD_MID, 1);
    gfx.fillCircle(-TAB_WIDTH / 2 + 8, TAB_HEIGHT / 2 - 6, 2);
    gfx.fillCircle(TAB_WIDTH / 2 - 8, TAB_HEIGHT / 2 - 6, 2);
    gfx.fillStyle(GOLD_BRIGHT, 1);
    gfx.fillCircle(-TAB_WIDTH / 2 + 8, TAB_HEIGHT / 2 - 6, 0.8);
    gfx.fillCircle(TAB_WIDTH / 2 - 8, TAB_HEIGHT / 2 - 6, 0.8);
  }

  private buildNavigation(): void {
    const navY = BOOK_BOTTOM - 22;

    this.pageIndicator = this.scene.add.text(SPINE_X, navY, 'Page 1 / 1', {
      fontSize: '14px',
      fontStyle: 'italic bold',
      color: '#3a2218',
      stroke: '#f5d273',
      strokeThickness: 2,
      fontFamily: FF,
    }).setOrigin(0.5);
    this.root.add(this.pageIndicator);

    // Arrows positioned at bottom inner corners of each page
    const arrowY = navY;
    this.prevArrow = this.makeNavArrow(
      SPINE_X - PAGE_GAP - PAGE_WIDTH + 36, arrowY, 'prev', () => this.flipBackward(),
    );
    this.nextArrow = this.makeNavArrow(
      SPINE_X + PAGE_GAP + PAGE_WIDTH - 36, arrowY, 'next', () => this.flipForward(),
    );
    this.root.add(this.prevArrow);
    this.root.add(this.nextArrow);

    this.updateNavState();
  }

  private makeNavArrow(
    x: number, y: number, dir: 'prev' | 'next', onClick: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const radius = 16;
    const gfx = this.scene.add.graphics();
    gfx.fillStyle(LEATHER_LIGHT, 1);
    gfx.fillCircle(0, 0, radius);
    gfx.lineStyle(2, GOLD_MID, 1);
    gfx.strokeCircle(0, 0, radius);
    gfx.fillStyle(GOLD_BRIGHT, 1);
    if (dir === 'prev') {
      gfx.fillTriangle(-5, 0, 5, -7, 5, 7);
    } else {
      gfx.fillTriangle(5, 0, -5, -7, -5, 7);
    }
    c.add(gfx);
    // Separate Zone for hit testing — see the tab builder for why.
    const hitZone = this.scene.add.zone(x, y, radius * 2, radius * 2)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    hitZone.on('pointerover', () => c.setScale(1.12));
    hitZone.on('pointerout', () => c.setScale(1));
    hitZone.on('pointerdown', () => onClick());
    this.root.add(hitZone);
    return c;
  }

  private buildCloseButton(): void {
    if (!this.opts.onClose) return;
    const x = CANVAS_W - 32;
    const y = 32;
    const radius = 16;

    const c = this.scene.add.container(x, y);
    const gfx = this.scene.add.graphics();
    gfx.fillStyle(0xcc0000, 1);
    gfx.fillCircle(0, 0, radius);
    gfx.lineStyle(2, 0x3e2723, 1);
    gfx.strokeCircle(0, 0, radius);
    c.add(gfx);
    const t = this.scene.add.text(0, 0, 'X', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff', fontFamily: FF,
    }).setOrigin(0.5);
    c.add(t);
    const hitZone = this.scene.add.zone(x, y, radius * 2, radius * 2)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    hitZone.on('pointerover', () => { gfx.clear(); gfx.fillStyle(0xff3333, 1); gfx.fillCircle(0, 0, radius); gfx.lineStyle(2, 0x3e2723, 1); gfx.strokeCircle(0, 0, radius); });
    hitZone.on('pointerout',  () => { gfx.clear(); gfx.fillStyle(0xcc0000, 1); gfx.fillCircle(0, 0, radius); gfx.lineStyle(2, 0x3e2723, 1); gfx.strokeCircle(0, 0, radius); });
    hitZone.on('pointerdown', () => this.opts.onClose?.());
    this.root.add(c);
    this.root.add(hitZone);
  }

  // ── Internals ─────────────────────────────────────────────

  private setActiveTabInternal(key: string): void {
    if (this.activeTab === key) return;
    this.activeTab = key;
    for (const [k, rec] of this.tabRecords) {
      this.drawTabBg(rec.bg, k === key, false);
      rec.label.setColor(k === key ? '#fff3d0' : '#f0d68a');
    }
  }

  private repaint(): void {
    this.leftPage.removeAll(true);
    this.rightPage.removeAll(true);
    // Re-draw page backgrounds (children were destroyed above)
    const leftCx = -(PAGE_GAP + PAGE_WIDTH / 2);
    const rightCx = PAGE_GAP + PAGE_WIDTH / 2;
    this.drawPageBackground(this.leftPage, leftCx, 0);
    this.drawPageBackground(this.rightPage, rightCx, 0);

    this.leftPage.scaleX = 1;
    this.rightPage.scaleX = 1;
    this.leftPage.alpha = 1;
    this.rightPage.alpha = 1;

    this.renderer?.({
      spreadIndex: this.spreadIndex,
      totalSpreads: this.totalSpreads,
      leftPage: this.leftPage,
      rightPage: this.rightPage,
      leftBounds: this.leftPageBounds,
      rightBounds: this.rightPageBounds,
    });
    this.updateNavState();
  }

  /** Two-phase scaleX tween anchored at the spine: the page being turned
   *  collapses toward the spine (1 → 0), content swaps, then expands (0 → 1).
   *  The opposite page does a softer alpha cross-fade so the spread reads as
   *  a unit while still showing one page as the dominant motion. */
  private flip(direction: 'next' | 'prev'): void {
    this.flipping = true;
    const flippingPage = direction === 'next' ? this.rightPage : this.leftPage;
    const otherPage = direction === 'next' ? this.leftPage : this.rightPage;

    // Phase 1 — collapse flipping page to spine, dim other
    this.scene.tweens.add({
      targets: flippingPage,
      scaleX: 0,
      duration: 220,
      ease: 'Sine.easeIn',
    });
    this.scene.tweens.add({
      targets: otherPage,
      alpha: 0.25,
      duration: 220,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.spreadIndex += direction === 'next' ? 1 : -1;
        this.repaint();
        // After repaint scales/alphas reset, but we want flippingPage to be
        // collapsed at 0 so the unfolding tween shows the new content emerging.
        flippingPage.scaleX = 0;
        otherPage.alpha = 0.25;

        // Phase 2 — unfold new content
        this.scene.tweens.add({
          targets: flippingPage,
          scaleX: 1,
          duration: 240,
          ease: 'Sine.easeOut',
          onComplete: () => {
            this.flipping = false;
            this.updateNavState();
          },
        });
        this.scene.tweens.add({
          targets: otherPage,
          alpha: 1,
          duration: 240,
          ease: 'Sine.easeOut',
        });
      },
    });
  }

  private updateNavState(): void {
    this.pageIndicator.setText(`Page ${this.spreadIndex + 1} / ${this.totalSpreads}`);
    this.prevArrow.setAlpha(this.spreadIndex > 0 ? 1 : 0.3);
    this.nextArrow.setAlpha(this.spreadIndex < this.totalSpreads - 1 ? 1 : 0.3);
  }
}

// Public re-exports of constants needed by callers planning their item grids.
export const BOOK_PAGE_INNER_PADDING_BOTTOM = PAGE_INNER_PADDING_BOTTOM;
export const BOOK_LAYOUT_CONSTANTS = {
  SPINE_X,
  BOOK_TOP,
  BOOK_BOTTOM,
  BOOK_HEIGHT,
  PAGE_WIDTH,
  PAGE_GAP,
  CANVAS_W,
  CANVAS_H,
} as const;
