// BookLayout — reusable "open tome" UI for the Collection / Card Library scenes.
//
// Shape: a leather-bound book lying open on a desk, two facing parchment
// pages, gilded gold borders, ribbon bookmark, section bookmarks across the
// top, page-flip arrows at the bottom. With the painted `book_open` art the
// chrome comes from the image; otherwise it is rendered procedurally.
//
// Callers supply a render callback that populates the two page containers
// for the current spread index. flipForward / flipBackward animate the
// page-flip; on WebGL with the painted art this is a true page curl — a
// Mesh plane (centred on its leaf, SPINE_X ± LEAF_W/2) whose vertices roll
// over a constant-curvature arc, front face showing the outgoing page and
// back face the incoming one, so the leaf physically crosses the book and
// lands on the opposite side. Anything else falls back to a scaleX fold.
//
// Tabs (when the art is present) render as bookmarks tucked between stacked
// page-edge layers at the top of the book: the first section's bookmark sits
// on the closest layer, each later section recedes one layer deeper (higher,
// smaller, darker), and switching sections turns the leaf with the same curl.
//
// Why a separate helper instead of inlining per scene: CollectionScene and
// CardLibraryScene both want the same chrome and the same animation, just
// with different content. Owning the chrome in one place keeps them in sync.

import Phaser from 'phaser';
import { FONTS } from './StyleConstants';

const FF = FONTS.family;

const CANVAS_W = 800;
const CANVAS_H = 600;
// Geometry tuned to the generated `book_open` art (measured via
// scripts/_measure_book.py): painted pages sit at x∈[73,356] / [442,726] in
// 800-space, spine centered at 400, parchment spans y∈[134,547]. When the art
// is absent we fall back to procedural chrome drawn with these same constants.
const BOOK_TOP = 134;
const BOOK_BOTTOM = 547;
const BOOK_HEIGHT = BOOK_BOTTOM - BOOK_TOP;
const SPINE_X = 400;
const PAGE_WIDTH = 283;
const PAGE_GAP = 44;
const PAGE_INNER_PADDING_X = 24;
const PAGE_INNER_PADDING_TOP = 28;
const PAGE_INNER_PADDING_BOTTOM = 50; // extra room for page indicator + arrows

// Placement of the `book_open` backdrop image (full art, slight non-uniform
// stretch to fit the canvas). Kept as constants so the page-flip snapshot can
// map a page's on-screen region back into the source art.
const BOOK_IMG_CX = 400;
const BOOK_IMG_CY = 344;
const BOOK_IMG_W = 800;
const BOOK_IMG_H = 466;

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

// Backdrop dimmer drawn over the painted book; the leaf snapshots replicate
// it so the flying page matches the on-screen parchment brightness exactly.
const VIGNETTE_ALPHA = 0.55;

// ── Page-curl flip (Mesh) ─────────────────────────────────
// The turning leaf spans from the spine to the page's outer edge.
const LEAF_W = PAGE_GAP + PAGE_WIDTH;
const LEAF_H = BOOK_HEIGHT + 16;
const CURL_SEGMENTS = 30;
const CURL_DURATION = 620;
// Tangent angle at the page tip/root follows pi * t^pow: the tip (smaller
// exponent) leads the motion, the root lags, and their difference is the
// bend of the constant-curvature arc the paper takes.
const CURL_TIP_POW = 0.78;
const CURL_ROOT_POW = 1.5;
// How strongly a column darkens as it turns edge-on (the crease shading).
const CURL_SHADE = 0.38;
// Half-width (in radians of tangent angle) of the front→back alpha
// crossover around the fold line. The column is edge-on there, so the
// blend itself is invisible.
const CURL_FADE_BAND = 0.07;
const TEX_LEAF_FRONT = '__book_leaf_front';
const TEX_LEAF_BACK = '__book_leaf_back';
const TEX_LEAF_STATIC = '__book_leaf_static';
const TEX_CURL_SHADOW = '__book_curl_shadow';

// ── Bookmark tabs (art mode) ──────────────────────────────
// Stacked page-edge strips at the top of the book; bookmark i is tucked
// behind strip i, so deeper sections visibly emerge from further inside.
const BM_WIDTH = 104;
const BM_LENGTH = 72;          // local length; the tail hides behind the strips
const BM_TOP_BASE = 80;        // top y of the frontmost bookmark
const BM_TOP_STEP = -2;        // deeper bookmarks recede upward slightly
const BM_RISE = 12;            // active bookmark is "pulled out" this much
const BM_HOVER_RISE = 5;
const BM_DEPTH_SCALE = 0.04;   // per-layer shrink
const BM_DEPTH_DARKEN = 0.13;  // per-layer darkening
const STRIP_TOP_BASE = 130;    // frontmost page-edge strip
const STRIP_STEP = 6;          // deeper strips recede upward
const STRIP_H = 7;
const STRIP_INSET_STEP = 12;   // deeper strips narrow toward the center
// Muted section hues (leather dye) applied per bookmark, in tab order.
const BOOKMARK_TINTS = [0x9a4a3a, 0x44607e, 0x55713f, 0x6f4f82];

function scaleColor(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

function mixColor(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 0xff) * (1 - t) + ((b >> 16) & 0xff) * t);
  const g = Math.round(((a >> 8) & 0xff) * (1 - t) + ((b >> 8) & 0xff) * t);
  const bl = Math.round((a & 0xff) * (1 - t) + (b & 0xff) * t);
  return (r << 16) | (g << 8) | bl;
}

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
  /** True when the painted `book_open` art is available: the leather cover,
   *  spine, parchment and ribbon come from the image instead of being drawn. */
  private useArt = false;
  private bookImage: Phaser.GameObjects.Image | null = null;
  private leftPage!: Phaser.GameObjects.Container;
  private rightPage!: Phaser.GameObjects.Container;
  private leftPageBounds!: BookPageBounds;
  private rightPageBounds!: BookPageBounds;
  private tabRecords = new Map<string, {
    container: Phaser.GameObjects.Container;
    label: Phaser.GameObjects.Text;
    badge?: Phaser.GameObjects.Text;
    applyState: (state: 'idle' | 'hover' | 'active') => void;
  }>();
  private tabOrder: string[] = [];
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
    this.useArt = scene.textures.exists('book_open');
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
    const fromIdx = this.tabOrder.indexOf(this.activeTab);
    const toIdx = this.tabOrder.indexOf(key);
    const swap = (): void => {
      this.setActiveTabInternal(key);
      this.opts.onTabChange?.(key);
    };
    // Jumping to another section turns a leaf too — later sections live
    // deeper in the book, so the curl direction follows the tab order.
    if (fromIdx !== -1 && toIdx !== -1 && this.canCurl()) {
      try {
        this.flipCurl(toIdx > fromIdx ? 'next' : 'prev', swap);
        return;
      } catch {
        // Pre-swap setup failed; fall through to the instant swap.
      }
    }
    swap();
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
    // Leaf snapshots live in the global TextureManager; drop them in case the
    // scene shut down mid-flip.
    this.removeLeafTextures();
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
    // Painted open book sits on top of the room backdrop. It supplies the
    // leather cover, spine, parchment pages, gold borders and ribbon, so the
    // procedural chrome below becomes a no-op while the art is present.
    if (this.useArt) {
      this.bookImage = this.scene.add.image(BOOK_IMG_CX, BOOK_IMG_CY, 'book_open')
        .setDisplaySize(BOOK_IMG_W, BOOK_IMG_H);
      this.root.add(this.bookImage);
    }
    // Vignette
    const vignette = this.scene.add.rectangle(400, 300, CANVAS_W, CANVAS_H, 0x000000, VIGNETTE_ALPHA);
    this.root.add(vignette);
  }

  private buildBookChrome(): void {
    // The painted book already carries the cover, spine and drop shadow.
    if (this.useArt) return;
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

    // Parchment + gold borders come from the art when present; otherwise draw
    // them procedurally into the page containers so they flip with the page.
    if (!this.useArt) {
      this.drawPageBackground(this.leftPage, leftCx, 0);
      this.drawPageBackground(this.rightPage, rightCx, 0);
    }

    this.root.add(this.leftPage);
    this.root.add(this.rightPage);

    // Ribbon — only when there's no art (the painted book already has one).
    // Drawn AFTER pages so it sits over them. Lives in rootContainer (not page
    // containers) because it's part of the book chrome, not page content.
    if (!this.useArt) {
      const ribbon = this.scene.add.graphics();
      ribbon.fillStyle(RIBBON_RED, 1);
      ribbon.fillRect(SPINE_X - 7, BOOK_TOP - 14, 14, 78);
      ribbon.fillTriangle(SPINE_X - 7, BOOK_TOP + 64, SPINE_X, BOOK_TOP + 56, SPINE_X + 7, BOOK_TOP + 64);
      ribbon.fillStyle(RIBBON_HIGHLIGHT, 1);
      ribbon.fillRect(SPINE_X - 7, BOOK_TOP - 14, 4, 78);
      ribbon.fillStyle(0x4a0c0c, 0.7);
      ribbon.fillRect(SPINE_X + 3, BOOK_TOP - 14, 4, 78);
      this.root.add(ribbon);
    }

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
    this.tabOrder = tabs.map((t) => t.key);
    if (this.useArt) this.buildBookmarkTabs(tabs);
    else this.buildClassicTabs(tabs);
  }

  /** Procedural fallback (no painted book art): the original leather tabs. */
  private buildClassicTabs(tabs: BookTab[]): void {
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

      const applyState = (state: 'idle' | 'hover' | 'active'): void => {
        this.drawTabBg(bg, state === 'active', state === 'hover');
        label.setColor(state === 'active' ? '#fff3d0' : '#f0d68a');
      };

      // Hit-testing on a Container with setSize uses (x,y,w,h) as TOP-LEFT —
      // it ignores that our children are centered at the container origin, so
      // the clickable region ends up offset down-and-right of the visible tab.
      // Use a dedicated Zone (which honors setOrigin) for input instead.
      const hitZone = this.scene.add.zone(x, tabY, TAB_WIDTH, TAB_HEIGHT)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      hitZone.on('pointerover', () => {
        if (this.activeTab !== tab.key) applyState('hover');
      });
      hitZone.on('pointerout', () => {
        applyState(this.activeTab === tab.key ? 'active' : 'idle');
      });
      hitZone.on('pointerdown', () => this.setActiveTab(tab.key));

      this.root.add(container);
      this.root.add(hitZone);
      this.tabRecords.set(tab.key, { container, label, badge, applyState });
    });
  }

  /** Art mode: tabs become bookmarks tucked between stacked page-edge layers.
   *  Section i emerges from behind strip i — the first section sits on the
   *  closest layer, later sections recede (higher, smaller, darker), giving
   *  the book physical depth. The active bookmark is pulled out (rises). */
  private buildBookmarkTabs(tabs: BookTab[]): void {
    const tabGap = 6;
    const totalW = tabs.length * TAB_WIDTH + (tabs.length - 1) * tabGap;
    const startX = SPINE_X - totalW / 2 + TAB_WIDTH / 2;
    const useAsset = this.scene.textures.exists('bookmark_tab');

    // Build back-to-front: deepest bookmark first, then its strip, so each
    // bookmark's tail disappears behind its own page layer and every layer
    // in front of it.
    for (let i = tabs.length - 1; i >= 0; i--) {
      const tab = tabs[i];
      // Slight convergence toward the spine for deeper layers (faux perspective).
      const x = Phaser.Math.Linear(startX + i * (TAB_WIDTH + tabGap), SPINE_X, 0.02 * i);
      const baseY = BM_TOP_BASE + i * BM_TOP_STEP;
      const stripTop = STRIP_TOP_BASE - i * STRIP_STEP;
      const depthScale = 1 - i * BM_DEPTH_SCALE;
      const idleBright = 1 - i * BM_DEPTH_DARKEN;
      const hue = BOOKMARK_TINTS[i % BOOKMARK_TINTS.length];

      const container = this.scene.add.container(x, baseY).setScale(depthScale);

      let paint: (bright: number, active: boolean) => void;
      if (useAsset) {
        const img = this.scene.add.image(0, 0, 'bookmark_tab')
          .setOrigin(0.5, 0)
          .setDisplaySize(BM_WIDTH + 10, BM_LENGTH + 6);
        container.add(img);
        paint = (bright, _active) => img.setTint(scaleColor(mixColor(0xffffff, hue, 0.45), bright));
      } else {
        const gfx = this.scene.add.graphics();
        container.add(gfx);
        paint = (bright, active) => this.drawBookmarkBg(gfx, hue, bright, active);
      }

      // Label centered in the part that stays visible above the strip.
      const visibleH = stripTop - baseY;
      const label = this.scene.add.text(0, visibleH / 2, tab.label, {
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
        badge = this.scene.add.text(0, visibleH / 2 + 14, tab.badge, {
          fontSize: '10px',
          color: '#e8d2a0',
          fontFamily: FF,
        }).setOrigin(0.5).setVisible(false);
        container.add(badge);
      }

      const applyState = (state: 'idle' | 'hover' | 'active'): void => {
        const rise = state === 'active' ? BM_RISE : state === 'hover' ? BM_HOVER_RISE : 0;
        this.scene.tweens.add({
          targets: container,
          y: baseY - rise,
          duration: 130,
          ease: 'Sine.easeOut',
        });
        const bright = state === 'active' ? 1.06 : state === 'hover' ? idleBright + 0.08 : idleBright;
        paint(bright, state === 'active');
        label.setColor(state === 'active' ? '#fff3d0' : '#f0d68a');
        label.setAlpha(state === 'active' ? 1 : 0.86 - 0.04 * i);
        // Counter "164 / 164" only shows on the pulled-out bookmark; the rise
        // makes room for it and the rest stay uncluttered.
        badge?.setVisible(state === 'active');
        label.setY(state === 'active' ? visibleH / 2 + 2 : visibleH / 2);
      };
      paint(idleBright, false);

      const hitZone = this.scene.add.zone(x, baseY + visibleH / 2, BM_WIDTH * depthScale, visibleH + BM_RISE)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      hitZone.on('pointerover', () => {
        if (this.activeTab !== tab.key) applyState('hover');
      });
      hitZone.on('pointerout', () => {
        applyState(this.activeTab === tab.key ? 'active' : 'idle');
      });
      hitZone.on('pointerdown', () => this.setActiveTab(tab.key));

      this.root.add(container);
      this.root.add(hitZone);
      this.tabRecords.set(tab.key, { container, label, badge, applyState });

      // Page-edge strip in front of this bookmark's tail.
      this.root.add(this.makePageEdgeStrip(i, stripTop));
    }
  }

  /** One stacked page-block edge at the top of the book: a thin parchment
   *  strip, darker and narrower the deeper the layer. */
  private makePageEdgeStrip(i: number, top: number): Phaser.GameObjects.Graphics {
    const inset = 14 + i * STRIP_INSET_STEP;
    const left = 84 + inset;
    const width = (716 - inset) - left;
    const depthF = 1 - i * 0.16;
    const gfx = this.scene.add.graphics();
    gfx.fillStyle(scaleColor(PARCHMENT_DARK, depthF * 0.8), 1);
    gfx.fillRoundedRect(left, top, width, STRIP_H, 3);
    gfx.fillStyle(scaleColor(PARCHMENT_MID, depthF), 1);
    gfx.fillRoundedRect(left + 1, top + 1, width - 2, STRIP_H - 3, 2);
    return gfx;
  }

  /** Procedural bookmark (used until the painted `bookmark_tab` asset exists):
   *  a dyed-leather tab with rounded top, gold trim and a grommet. Local
   *  coords: origin at top-center, tail extends down BM_LENGTH. */
  private drawBookmarkBg(gfx: Phaser.GameObjects.Graphics, hue: number, bright: number, active: boolean): void {
    gfx.clear();
    const w = BM_WIDTH;
    const leather = scaleColor(mixColor(LEATHER_MID, hue, 0.55), bright);
    const shadowEdge = scaleColor(leather, 0.62);
    const highlight = scaleColor(leather, 1.35);
    gfx.fillStyle(leather, 1);
    gfx.fillRoundedRect(-w / 2, 0, w, BM_LENGTH, { tl: 9, tr: 9, bl: 0, br: 0 });
    // Rounded shading: lit left edge, shadowed right edge.
    gfx.fillStyle(highlight, 0.35);
    gfx.fillRoundedRect(-w / 2 + 2, 2, 7, BM_LENGTH - 4, { tl: 7, tr: 0, bl: 0, br: 0 });
    gfx.fillStyle(shadowEdge, 0.55);
    gfx.fillRoundedRect(w / 2 - 9, 2, 7, BM_LENGTH - 4, { tl: 0, tr: 7, bl: 0, br: 0 });
    // Gold trim
    gfx.lineStyle(active ? 2 : 1.5, active ? GOLD_BRIGHT : GOLD_DARK, 1);
    gfx.strokeRoundedRect(-w / 2 + 3, 3, w - 6, BM_LENGTH - 6, { tl: 7, tr: 7, bl: 0, br: 0 });
    // Grommet near the top — where a real bookmark cord would pass through.
    gfx.fillStyle(active ? GOLD_BRIGHT : GOLD_MID, 1);
    gfx.fillCircle(0, 9, 3);
    gfx.fillStyle(SPINE_SHADOW, 1);
    gfx.fillCircle(0, 9, 1.4);
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
      rec.applyState(k === key ? 'active' : 'idle');
    }
  }

  private repaint(): void {
    this.leftPage.removeAll(true);
    this.rightPage.removeAll(true);
    // Re-draw page backgrounds (children were destroyed above) — only when the
    // parchment is procedural; with art the pages stay transparent.
    if (!this.useArt) {
      const leftCx = -(PAGE_GAP + PAGE_WIDTH / 2);
      const rightCx = PAGE_GAP + PAGE_WIDTH / 2;
      this.drawPageBackground(this.leftPage, leftCx, 0);
      this.drawPageBackground(this.rightPage, rightCx, 0);
    }

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

  /** Dispatch to the Mesh page-curl when the painted book art is available
   *  and we're on the WebGL renderer; otherwise use the robust scaleX fold.
   *  The curl path also falls back if its setup throws, so a weak/odd
   *  machine never gets stuck mid-flip. */
  private flip(direction: 'next' | 'prev'): void {
    if (this.canCurl()) {
      const swap = (): void => {
        this.spreadIndex += direction === 'next' ? 1 : -1;
        this.repaint();
      };
      try {
        this.flipCurl(direction, swap);
        return;
      } catch {
        // Setup failed before the content swap — clean slate, use the simple
        // fold below. (Past that point, flipCurl owns completion itself.)
      }
    }
    this.flipSimple(direction);
  }

  private canCurl(): boolean {
    return this.useArt && !!this.bookImage && this.scene.game.renderer.type === Phaser.WEBGL;
  }

  /** Two-phase scaleX tween anchored at the spine: the page being turned
   *  collapses toward the spine (1 → 0), content swaps, then expands (0 → 1).
   *  The opposite page does a softer alpha cross-fade so the spread reads as
   *  a unit while still showing one page as the dominant motion. */
  private flipSimple(direction: 'next' | 'prev'): void {
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

  /** True page curl. The turning leaf is two Mesh planes (front and back
   *  faces), each centred on its own side of the spine (SPINE_X ± LEAF_W/2).
   *  Every frame each vertex column is placed on a constant-curvature arc:
   *  the tangent angle at the page root sweeps 0→π while the tip leads it,
   *  so the paper bows, rolls over the spine and lands flat on the opposite
   *  side — exactly where the (already repainted) real page waits, making
   *  the hand-off pixel-perfect.
   *
   *  Textures: front = outgoing page (art + vignette + old content), back =
   *  incoming far-side page (art + vignette + new content, mirrored U). The
   *  page being landed on keeps its OLD pixels via a static snapshot overlay
   *  until the leaf covers it. Faces never self-overlap inside the visible
   *  region of either mesh (x is monotonic while a side faces the camera),
   *  so no depth sorting games are needed — just back mesh above front.
   *
   *  Throws only BEFORE `swapContent` runs; after that it owns completion. */
  private flipCurl(direction: 'next' | 'prev', swapContent: () => void): void {
    const isNext = direction === 'next';
    const sideSign = isNext ? 1 : -1;
    const bookY = (BOOK_TOP + BOOK_BOTTOM) / 2;
    const flippingPage = isNext ? this.rightPage : this.leftPage;
    const landingPage = isNext ? this.leftPage : this.rightPage;

    // ── Pre-swap phase (may throw → caller falls back cleanly) ──
    this.ensureCurlShadowTexture();
    const frontDT = this.freshDynamicTexture(TEX_LEAF_FRONT);
    const staticDT = this.freshDynamicTexture(TEX_LEAF_STATIC);
    const backDT = this.freshDynamicTexture(TEX_LEAF_BACK);
    this.fillLeafTexture(frontDT, isNext ? 'right' : 'left', flippingPage);
    this.fillLeafTexture(staticDT, isNext ? 'left' : 'right', landingPage);

    // Static snapshot keeps the OLD landing-side pixels visible while the
    // real container underneath is repainted with the incoming spread.
    const overlay = this.scene.add.image(SPINE_X - sideSign * (LEAF_W / 2), bookY, TEX_LEAF_STATIC);
    const shadow = this.scene.add.image(SPINE_X + sideSign * LEAF_W, bookY, TEX_CURL_SHADOW)
      .setDisplaySize(110, LEAF_H)
      .setAlpha(0);
    const frontMesh = this.makeLeafMesh(TEX_LEAF_FRONT, isNext, false);
    const backMesh = this.makeLeafMesh(TEX_LEAF_BACK, isNext, true);
    // v.x is in pixels: [-LEAF_W/2, +LEAF_W/2]. Normalise to [0,1] where
    // 0 = spine side and 1 = outer edge. For the right page, spine is at
    // x = -LEAF_W/2 and edge at +LEAF_W/2; flip for left page.
    const gridPos = (m: Phaser.GameObjects.Mesh): number[] =>
      m.vertices.map((v) => (v.x + LEAF_W / 2) / LEAF_W);
    const frontPos = gridPos(frontMesh);
    const backPos = gridPos(backMesh);
    this.root.add(overlay);
    this.root.add(shadow);
    this.root.add(frontMesh);
    this.root.add(backMesh);

    const applyCurl = (mesh: Phaser.GameObjects.Mesh, pos: number[], isBack: boolean, t: number): void => {
      const tipA = Math.PI * Math.pow(t, CURL_TIP_POW);
      const rootA = Math.PI * Math.pow(t, CURL_ROOT_POW);
      const bend = tipA - rootA;
      const verts = mesh.vertices;
      for (let i = 0; i < verts.length; i++) {
        const v = verts[i];
        // Normalized distance from the spine along the paper (0 = spine, 1 = edge).
        const dn = isNext ? pos[i] : 1 - pos[i];
        const d = dn * LEAF_W;
        const phi = rootA + bend * dn; // local tangent angle of the paper
        let x: number;
        let z: number;
        if (bend < 1e-4) {
          x = d * Math.cos(rootA);
          z = d * Math.sin(rootA);
        } else {
          const r = LEAF_W / bend; // radius of the constant-curvature arc
          x = r * (Math.sin(phi) - Math.sin(rootA));
          z = r * (Math.cos(rootA) - Math.cos(phi));
        }
        // v.x is in pixels. x goes from 0 (spine) to LEAF_W (outer edge).
        // Mesh origin is at SPINE_X; right page: spine = -LEAF_W/2, edge = +LEAF_W/2.
        // So pixel offset from mesh center = x - LEAF_W/2 (right page) or LEAF_W/2 - x (left).
        v.x = sideSign * (x - LEAF_W / 2);
        v.z = z * 0.25;
        // Front face visible while the column faces the camera (phi < π/2);
        // crossover happens edge-on so the blend itself is invisible.
        const frontA = Phaser.Math.Clamp(0.5 + (Math.PI / 2 - phi) / (2 * CURL_FADE_BAND), 0, 1);
        v.alpha = isBack ? 1 - frontA : frontA;
        const g = Math.round(255 * (1 - CURL_SHADE * Math.sin(phi)));
        v.color = (g << 16) | (g << 8) | g;
      }
    };

    const apply = (t: number): void => {
      applyCurl(frontMesh, frontPos, false, t);
      applyCurl(backMesh, backPos, true, t);
      // Ground shadow tracks the airborne tip of the leaf.
      const tipA = Math.PI * Math.pow(t, CURL_TIP_POW);
      const rootA = Math.PI * Math.pow(t, CURL_ROOT_POW);
      const bend = tipA - rootA;
      const tipX = bend < 1e-4
        ? LEAF_W * Math.cos(rootA)
        : (LEAF_W / bend) * (Math.sin(tipA) - Math.sin(rootA));
      const lift = Math.sin(Math.PI * t);
      shadow.setX(SPINE_X + sideSign * tipX);
      shadow.setDisplaySize(90 + 130 * lift, LEAF_H);
      shadow.setAlpha(0.45 * lift);
    };
    apply(0);

    this.flipping = true;

    // ── Post-swap phase: content already advanced — never rethrow. ──
    const finish = (): void => {
      overlay.destroy();
      shadow.destroy();
      frontMesh.destroy();
      backMesh.destroy();
      this.removeLeafTextures();
      this.flipping = false;
      this.updateNavState();
    };
    try {
      swapContent();
      this.fillLeafTexture(backDT, isNext ? 'left' : 'right', landingPage);
      const proxy = { t: 0 };
      this.scene.tweens.add({
        targets: proxy,
        t: 1,
        duration: CURL_DURATION,
        ease: 'Sine.easeInOut',
        onUpdate: () => apply(proxy.t),
        onComplete: finish,
      });
    } catch {
      // Content is swapped; abandon the animation but leave a sane book.
      finish();
    }
  }

  /** (Re)create a leaf-sized DynamicTexture under a fixed key. */
  private freshDynamicTexture(key: string): Phaser.Textures.DynamicTexture {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const dt = this.scene.textures.addDynamicTexture(key, LEAF_W, LEAF_H);
    if (!dt) throw new Error(`BookLayout: could not create ${key}`);
    return dt;
  }

  /** Compose one leaf: painted book art region + the vignette dim over it +
   *  the page container's content, matching the on-screen layering exactly. */
  private fillLeafTexture(
    dt: Phaser.Textures.DynamicTexture,
    side: 'left' | 'right',
    page: Phaser.GameObjects.Container,
  ): void {
    const bookY = (BOOK_TOP + BOOK_BOTTOM) / 2;
    const left = side === 'right' ? SPINE_X : SPINE_X - LEAF_W;
    const top = bookY - LEAF_H / 2;
    dt.clear();
    dt.draw(this.bookImage!, BOOK_IMG_CX - left, BOOK_IMG_CY - top);
    dt.fill(0x000000, VIGNETTE_ALPHA, 0, 0, LEAF_W, LEAF_H);
    const wasVisible = page.visible;
    page.setVisible(true);
    dt.draw(page, SPINE_X - left, bookY - top);
    page.setVisible(wasVisible);
  }

  /** Leaf-sized grid Mesh in pixel-accurate ortho projection, centred on the
   *  leaf (SPINE_X ± LEAF_W/2). `mirrorU` flips the texture horizontally (the
   *  back face of the leaf must land readable on the opposite side). */
  private makeLeafMesh(texKey: string, isNext: boolean, mirrorU: boolean): Phaser.GameObjects.Mesh {
    const bookY = (BOOK_TOP + BOOK_BOTTOM) / 2;
    // Mesh centred at the leaf's geometric centre (SPINE_X ± LEAF_W/2).
    // setOrtho(LEAF_W, LEAF_H): vx = (v.x / LEAF_W) * LEAF_W = v.x (pixels from mesh centre).
    // Verts with width:LEAF_W span v.x ∈ [-LEAF_W/2, +LEAF_W/2]; spine = -LEAF_W/2, edge = +LEAF_W/2.
    const leafCX = SPINE_X + (isNext ? 1 : -1) * LEAF_W / 2;
    const mesh = this.scene.add.mesh(leafCX, bookY, texKey);
    // A freshly-created Mesh adopts the renderer size (e.g. 1200×900), NOT the
    // texture size — that mismatch is what blows the projection up. Pin the
    // Mesh dimensions to the leaf so vx = (v.x / LEAF_W) * LEAF_W = v.x (1:1 px).
    mesh.setSize(LEAF_W, LEAF_H);
    mesh.setOrtho(LEAF_W, LEAF_H);
    Phaser.Geom.Mesh.GenerateGridVerts({
      mesh,
      texture: texKey,
      width: LEAF_W,
      height: LEAF_H,
      widthSegments: CURL_SEGMENTS,
      heightSegments: 1,
    });
    mesh.hideCCW = false;
    mesh.ignoreDirtyCache = true;
    if (mirrorU) {
      for (const v of mesh.vertices) v.u = 1 - v.u;
    }
    return mesh;
  }

  /** Soft horizontal gradient (transparent→black→transparent) used as the
   *  moving ground shadow under the airborne leaf. Built once, procedurally. */
  private ensureCurlShadowTexture(): void {
    if (this.scene.textures.exists(TEX_CURL_SHADOW)) return;
    const canvas = this.scene.textures.createCanvas(TEX_CURL_SHADOW, 64, 32);
    if (!canvas) throw new Error('BookLayout: could not create curl shadow texture');
    const ctx = canvas.getContext();
    const grd = ctx.createLinearGradient(0, 0, 64, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.6)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 32);
    canvas.refresh();
  }

  private removeLeafTextures(): void {
    for (const key of [TEX_LEAF_FRONT, TEX_LEAF_BACK, TEX_LEAF_STATIC]) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
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
