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
// Tabs (when the art is present) render as bookmarks across the top of the
// book: the first section sits closest, each later section recedes (higher,
// smaller, darker) for faux depth, and switching sections turns the leaf with
// the same curl.
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
const SPINE_X = 410;
const PAGE_WIDTH = 283;
const PAGE_GAP = 44;
const PAGE_INNER_PADDING_X = 24;
const PAGE_INNER_PADDING_TOP = 28;
const PAGE_INNER_PADDING_BOTTOM = 50; // extra room for page indicator + arrows

// Page stacks (visual depth layers under each open page). The SAME thick stack
// (`large`) is used on both sides, fixed. The "open progress" depth effect comes
// from sliding the flat `page` (and gutter) horizontally by a constant step per
// tab (see PAGE_LAYOUT_X_BASE / PAGE_LAYOUT_X_STEP below).
const PAGE_STACK_LARGE = 'page-stack-large';
// Fixed stack x positions (local to pageStackLayer; spine at x=0), tuned in the
// overlay. Left is pushed slightly further out than the right.
const STACK_LEFT_X = -275.5;
const STACK_RIGHT_X = 255.5;
// HORIZONTAL (x) layout of the gutter + two flat pages. The "open progress"
// depth effect is now PROCEDURAL: the FIRST tab uses the hand-tuned baseline
// below (from the Cards debug-overlay export), and every later tab slides the
// whole group — gutter and both pages — by a constant step (+x = rightward) per
// tab. The internal page gap (pageRight − pageLeft) is therefore CONSTANT across
// tabs (always the Cards gap), exactly as requested. Only x varies; y stays at
// the constants in renderPageStacks().
interface PageLayoutX { gutter: number; pageLeft: number; pageRight: number; }
// Baseline = first tab (Cards), tuned by hand in the debug overlay.
const PAGE_LAYOUT_X_BASE: PageLayoutX = { gutter: -11.7, pageLeft: -188.9, pageRight: 156.9 };
// Step is 0: all tabs share the same page/gutter positions.
const PAGE_LAYOUT_X_STEP = 0;
// Compute a tab's x layout from its position in tab order (0-based).
function pageLayoutXForIndex(tabIndex: number): PageLayoutX {
  const shift = Math.max(0, tabIndex) * PAGE_LAYOUT_X_STEP;
  return {
    gutter: PAGE_LAYOUT_X_BASE.gutter + shift,
    pageLeft: PAGE_LAYOUT_X_BASE.pageLeft + shift,
    pageRight: PAGE_LAYOUT_X_BASE.pageRight + shift,
  };
}
const PAGE_SINGLE_TEXTURE = 'page';
// Central gutter: the inner crease where the two facing pages dive into the spine
const PAGE_GUTTER_TEXTURE = 'page-gutter';
// Resting flat-page placement (shared by the static stacks AND the turning-leaf
// snapshot so the curling page is the SAME `page` art the resting pages use).
const PAGE_SCALE = 0.35;
const PAGE_LEFT_Y = 2;    // flat page y offset (left side)
const PAGE_RIGHT_Y = 1.3; // flat page y offset (right side)
// Display size of the flat `page` asset at PAGE_SCALE (source 961×1269 — the real
// page.png size). The leaf DynamicTexture is sized to THIS so the `page` art fills
// it edge-to-edge with no dark book-art padding framing the sheet.
const PAGE_DISPLAY_W = 961 * PAGE_SCALE;  // ≈ 336.35
const PAGE_DISPLAY_H = 1269 * PAGE_SCALE; // ≈ 444.15

// Geometry of the turning leaf for ONE flip. Derived from the `page` asset's
// resting rectangle so the curling sheet traces the SAME rect as the page at
// rest (the curl pivots at the page's inner edge and the tip lands at its outer
// edge). All x values are SCREEN-x; `rootX` is the fold pivot, `width` the leaf
// length, `dir` the roll direction (+1 right / −1 left). `texLeftX`/`texTopY`
// are the top-left of the leaf texture in screen space (for snapshot mapping).
interface LeafGeom {
  rootX: number;
  width: number;
  dir: number;
  texLeftX: number;
  texTopY: number;
}

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
// The turning leaf is the flat `page` asset's resting rect (see computeLeafGeom):
// it folds at the page's inner edge and the tip lands at its outer edge.
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

// ── Bookmark banners (art mode) ───────────────────────────
// Each section is a hanging cloth banner (text + emblem baked into the art).
// Layout: a fixed, evenly-spaced ROW of banners pinned to the TOP of the screen.
// All banners share the same base size; the active one is scaled up a touch and
// brought to the front, the rest sit slightly smaller/dimmer behind it.
const BM_BANNER_W = 57;        // base display width (was 81, reduced 30%)
const BM_BANNER_ASPECT = 1.18; // height / width of the banner art
const BM_TOP_BASE = 6;         // y of every banner's top (rod hangs near the screen top)
const BM_ROW_GAP = 8;          // horizontal gap between adjacent banners in the row
const BM_ACTIVE_SCALE = 1.18;  // active banner is a little bigger than the rest
const BM_IDLE_BRIGHT = 0.82;   // inactive banners are slightly dimmed
const BM_RISE = 4;             // active banner is lifted this much on selection
const BM_HOVER_RISE = 3;
// Per-section banner art (text + emblem baked in), keyed by tab.key.
const BOOKMARK_RIBBONS: Record<string, string> = {
  Cards: 'ribbon_card',
  Relics: 'ribbon_relics',
  Tiles: 'ribbon_tiles',
  Bosses: 'ribbon_bosses',
};
// Muted section hues — fallback only (procedural bookmark when no art).
const BOOKMARK_TINTS = [0x9a4a3a, 0x44607e, 0x55713f, 0x6f4f82];
// Procedural-fallback bookmark dimensions (used only when the banner art and
// the old bookmark_tab asset are both absent).
const BM_WIDTH = 104;
const BM_LENGTH = 72;

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
  private pageStackLayer!: Phaser.GameObjects.Container; // Contains page stacks + inactive bookmarks
  private tabRecords = new Map<string, {
    container: Phaser.GameObjects.Container;
    label: Phaser.GameObjects.Text;
    badge?: Phaser.GameObjects.Text;
    applyState: (state: 'idle' | 'hover' | 'active') => void;
    // Dynamic-bookmark layout state (art mode only): index in tab order, the
    // hit zone, the bookmark's visible height, and a tinted-repaint hook so
    // layoutBookmarks() can re-place + re-depth each tab when selection moves.
    index?: number;
    hitZone?: Phaser.GameObjects.Zone;
    visibleH?: number;
    paint?: (bright: number, active: boolean) => void;
    depthBright?: number;
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
    const swap = (): void => {
      this.setActiveTabInternal(key);
      this.opts.onTabChange?.(key);
    };
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

    // Page stack layer (holds page depth stacks + inactive bookmarks).
    // Positioned below page containers in z-order but above book image.
    this.pageStackLayer = this.scene.add.container(SPINE_X, bookY);
    this.root.add(this.pageStackLayer);

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

  /** Art mode: section bookmark BANNERS in a fixed row pinned to the top.
   *
   *  Each tab is a hanging cloth banner (title + emblem baked into the art),
   *  built once here, neutrally; layoutBookmarks() then places it in its fixed
   *  slot in an evenly-spaced row at the top of the screen. All banners share the
   *  same base size; the active one is scaled up a touch, lit, and brought to the
   *  front, the rest sit slightly smaller/dimmer behind it. */
  private buildBookmarkTabs(tabs: BookTab[]): void {
    const bannerH = BM_BANNER_W * BM_BANNER_ASPECT;
    const visibleH = bannerH; // banner origin is its top; whole banner is visible

    tabs.forEach((tab, i) => {
      const hue = BOOKMARK_TINTS[i % BOOKMARK_TINTS.length];
      const ribbonKey = BOOKMARK_RIBBONS[tab.key];
      const useBanner = !!ribbonKey && this.scene.textures.exists(ribbonKey);

      // Created at the spine; layoutBookmarks() moves it to its real slot.
      // Origin top-center so the banner hangs DOWN from BM_TOP_BASE.
      const container = this.scene.add.container(SPINE_X, BM_TOP_BASE);

      // No Phaser title label when the banner art carries it (text is baked).
      let label: Phaser.GameObjects.Text;
      let paint: (bright: number, active: boolean) => void;
      if (useBanner) {
        const img = this.scene.add.image(0, 0, ribbonKey)
          .setOrigin(0.5, 0)
          .setDisplaySize(BM_BANNER_W, bannerH);
        container.add(img);
        // Depth darkening via a grey tint (banner keeps its baked colours).
        paint = (bright, _active) => {
          const g = Phaser.Math.Clamp(Math.round(255 * bright), 0, 255);
          img.setTint((g << 16) | (g << 8) | g);
        };
        // A hidden Text we still own (kept for the badge anchor / API parity).
        label = this.scene.add.text(0, 0, '', { fontFamily: FF }).setVisible(false);
        container.add(label);
      } else {
        // Fallback: procedural leather tab + Phaser title.
        const gfx = this.scene.add.graphics();
        container.add(gfx);
        paint = (bright, active) => this.drawBookmarkBg(gfx, hue, bright, active);
        label = this.scene.add.text(0, BM_LENGTH / 2, tab.label, {
          fontSize: '15px', fontStyle: 'bold', color: '#f0d68a',
          stroke: '#1a0a04', strokeThickness: 3, fontFamily: FF,
        }).setOrigin(0.5);
        container.add(label);
      }

      // Badge counter suppressed (labels baked into ribbon art are sufficient).
      let badge: Phaser.GameObjects.Text | undefined;

      // applyState reads the banner's CURRENT dynamic baseY/depth (set by
      // layoutBookmarks via the record) so hover/active respect its live slot.
      const applyState = (state: 'idle' | 'hover' | 'active'): void => {
        const rec = this.tabRecords.get(tab.key)!;
        const baseY = rec.index === undefined ? BM_TOP_BASE : (container.getData('baseY') ?? BM_TOP_BASE);
        const idleBright = rec.depthBright ?? BM_IDLE_BRIGHT;
        const rise = state === 'active' ? BM_RISE : state === 'hover' ? BM_HOVER_RISE : 0;
        this.scene.tweens.add({
          targets: container,
          y: baseY - rise,
          duration: 130,
          ease: 'Sine.easeOut',
        });
        const bright = state === 'active' ? 1.0 : state === 'hover' ? Math.min(1, idleBright + 0.12) : idleBright;
        paint(bright, state === 'active');
        if (!useBanner) {
          label.setColor(state === 'active' ? '#fff3d0' : '#f0d68a');
          label.setAlpha(state === 'active' ? 1 : Math.max(0.5, idleBright));
        }
        // Counter only shows on the pulled-out (active) banner.
        badge?.setVisible(state === 'active');
      };

      // Hit zone covers the banner (origin top-center → offset down half height).
      const hitZone = this.scene.add.zone(SPINE_X, BM_TOP_BASE + visibleH / 2, BM_BANNER_W, visibleH)
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
      this.tabRecords.set(tab.key, {
        container, label, badge, applyState,
        index: i, hitZone, visibleH, paint, depthBright: 1,
      });
    });

    // Initial placement (no active tab yet → treat index 0 as active so the
    // layout is sane before setActiveTabInternal runs).
    this.layoutBookmarks(false);
  }

  /** Place every bookmark in a fixed, evenly-spaced row pinned to the top.
   *
   *  All banners share the same fixed slot and base size; the row is centred on
   *  the spine and the order follows tab order (left→right). The ACTIVE banner
   *  is scaled up a touch (BM_ACTIVE_SCALE), lit, lifted slightly and brought to
   *  the very front; every inactive banner stays at base scale, slightly dimmed,
   *  and is moved just behind the pages so the active one clearly reads on top.
   *  `animate` slides them; pass false for an instant initial placement. */
  private layoutBookmarks(animate = true): void {
    if (this.tabRecords.size === 0) return;
    const activeIdx = Math.max(0, this.tabOrder.indexOf(this.activeTab));

    const recs = [...this.tabRecords.values()].filter(r => r.index !== undefined);
    const n = recs.length;
    // Slot pitch sized to the (larger) active banner so it never overlaps a
    // neighbour. The whole row is centred on the spine.
    const slot = BM_BANNER_W * BM_ACTIVE_SCALE + BM_ROW_GAP;
    const rowStart = SPINE_X - (n - 1) * slot / 2;

    // Place inactive first, then the active one last so bringToTop wins.
    const ordered = [...recs].sort((a, b) =>
      (a.index === activeIdx ? 1 : 0) - (b.index === activeIdx ? 1 : 0));

    for (const rec of ordered) {
      const i = rec.index!;
      const isActive = i === activeIdx;
      const x = rowStart + i * slot;

      const baseY = BM_TOP_BASE;
      const scale = isActive ? BM_ACTIVE_SCALE : 1;
      const bright = isActive ? 1.0 : BM_IDLE_BRIGHT;

      rec.depthBright = bright;
      rec.container.setData('baseY', baseY);
      rec.container.setScale(scale);
      rec.hitZone?.setPosition(x, baseY + (rec.visibleH ?? 0) * scale / 2).setScale(scale);

      // Active banner on top; inactive ones tucked just behind the pages.
      if (isActive) {
        this.root.bringToTop(rec.container);
      } else {
        this.root.moveBelow(rec.container, this.leftPage);
      }

      if (animate) {
        this.scene.tweens.add({
          targets: rec.container,
          x, y: baseY - (isActive ? BM_RISE : 0),
          duration: 220,
          ease: 'Sine.easeOut',
        });
      } else {
        rec.container.setPosition(x, baseY - (isActive ? BM_RISE : 0));
      }
      rec.paint?.(bright, isActive);
      rec.label.setAlpha(isActive ? 1 : Math.max(0.5, bright));
    }
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
    const navY = BOOK_BOTTOM - 22 + 65;

    this.pageIndicator = this.scene.add.text(SPINE_X - 20, navY - 20, 'Page 1 / 1', {
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#3a2218',
      stroke: '#f5d273',
      strokeThickness: 2,
      fontFamily: FF,
    }).setOrigin(0.5);
    this.root.add(this.pageIndicator);

    // Invisible arrow containers kept so flipForward/flipBackward still work via keyboard/wheel.
    this.prevArrow = this.scene.add.container(-9999, -9999);
    this.nextArrow = this.scene.add.container(-9999, -9999);
    this.root.add(this.prevArrow);
    this.root.add(this.nextArrow);

    this.updateNavState();
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

  /** Render the page stacks that give the open tome its thickness: a stacked
   *  page-edge block plus a flat page on each side, four images total, always
   *  present. The stack art is a block of page-edges; the flat page sits on top
   *  so each side reads as "the current leaf, backed by the leaves behind it".
   *
   *  All coords are local to pageStackLayer (anchored at the spine / book
   *  center). Tune the POS constants below to position the art; the left side is
   *  an exact mirror of the right via flipX (each Image owns its own flip flag,
   *  so the shared texture is never mutated). */
  private renderPageStacks(): void {
    this.pageStackLayer.removeAll(true);

    // ── Tunable layout (local coords; spine at x=0, book center at y=0) ──
    // Values below are the RIGHT side (tuned via the debug overlay). The LEFT
    // side is an exact mirror: x is negated and the image is flipX'd.
    const STACK_SCALE = 0.35;
    const STACK_Y = 1.3;
    // Central gutter (single image straddling the spine; behind everything else).
    const GUTTER_Y = 6.6;
    const GUTTER_W = 102;
    const GUTTER_H = 413;

    // Same thick stack on BOTH sides, fixed. The depth/"open progress" effect
    // comes from the per-tab X positions of the gutter and pages (hand-tuned).
    const stackKey = PAGE_STACK_LARGE;
    const layout = pageLayoutXForIndex(this.tabOrder.indexOf(this.activeTab));

    const hasGutter = this.scene.textures.exists(PAGE_GUTTER_TEXTURE);
    const hasStack = this.scene.textures.exists(stackKey);
    const hasPage = this.scene.textures.exists(PAGE_SINGLE_TEXTURE);

    // Gutter first → sits at the very back of this layer, near the spine, so the
    // two pages appear to dive into the binding valley. Its x is tuned per tab.
    if (hasGutter) {
      this.pageStackLayer.add(
        this.scene.add.image(layout.gutter, GUTTER_Y, PAGE_GUTTER_TEXTURE).setDisplaySize(GUTTER_W, GUTTER_H),
      );
    }

    // Stack: same `large` block on each side, fixed x (left original, right
    // flipX'd). Positions tuned in the overlay (STACK_LEFT_X / STACK_RIGHT_X).
    if (hasStack) {
      this.pageStackLayer.add(
        this.scene.add.image(STACK_LEFT_X, STACK_Y, stackKey).setScale(STACK_SCALE),
      );
      this.pageStackLayer.add(
        this.scene.add.image(STACK_RIGHT_X, STACK_Y, stackKey).setScale(STACK_SCALE).setFlipX(true),
      );
    }

    // Flat page on each side; only x varies per tab (the depth effect). y is
    // fixed per side. Left original, right flipX'd.
    if (hasPage) {
      this.pageStackLayer.add(
        this.scene.add.image(layout.pageLeft, PAGE_LEFT_Y, PAGE_SINGLE_TEXTURE).setScale(PAGE_SCALE),
      );
      this.pageStackLayer.add(
        this.scene.add.image(layout.pageRight, PAGE_RIGHT_Y, PAGE_SINGLE_TEXTURE).setScale(PAGE_SCALE).setFlipX(true),
      );
    }
  }

  private setActiveTabInternal(key: string): void {
    if (this.activeTab === key) return;
    this.activeTab = key;
    // Art mode uses dynamic bookmarks: layoutBookmarks owns position, depth,
    // paint and the active rise, so re-laying-out is the whole state change.
    if (this.useArt) {
      // Page-stack thickness depends on the active tab (book "open progress").
      this.renderPageStacks();
      this.layoutBookmarks(true);
      return;
    }
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

    this.renderPageStacks();

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
   *  Textures: both faces are the FLIPPING side's page (so the turning sheet
   *  reads as that page, not the opposite one) — front = old content, back =
   *  new content with mirrored U (the reverse of the same sheet). The page being
   *  landed on keeps its OLD pixels via a static snapshot overlay (the opposite
   *  side's old page) until the leaf covers it. Faces never self-overlap in the visible
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
    const flipSide: 'left' | 'right' = isNext ? 'right' : 'left';
    const landSide: 'left' | 'right' = isNext ? 'left' : 'right';

    // Leaf geometry derived from the `page` asset's resting rect, so the curling
    // sheet traces the SAME rectangle as the resting page (the fix for the
    // horizontal offset). Both sides share the same |rootX| / width by symmetry,
    // but we compute per side to honor the per-tab x and per-side y.
    const flipGeom = this.computeLeafGeom(flipSide);
    const landGeom = this.computeLeafGeom(landSide);
    // Mesh center y = page resting center (per side).
    const cyOf = (side: 'left' | 'right'): number =>
      bookY + (side === 'right' ? PAGE_RIGHT_Y : PAGE_LEFT_Y);

    // ── Pre-swap phase (may throw → caller falls back cleanly) ──
    this.ensureCurlShadowTexture();
    const frontDT = this.freshDynamicTexture(TEX_LEAF_FRONT);
    const staticDT = this.freshDynamicTexture(TEX_LEAF_STATIC);
    const backDT = this.freshDynamicTexture(TEX_LEAF_BACK);
    this.fillLeafTexture(frontDT, flipSide, flippingPage, flipGeom);
    this.fillLeafTexture(staticDT, landSide, landingPage, landGeom);

    // Static snapshot keeps the OLD landing-side pixels visible while the real
    // container underneath is repainted with the incoming spread. Placed at the
    // landing leaf's texture center (top-left + half size).
    const overlay = this.scene.add.image(
      landGeom.texLeftX + landGeom.width / 2, cyOf(landSide), TEX_LEAF_STATIC,
    );
    const shadow = this.scene.add.image(SPINE_X + flipGeom.rootX + flipGeom.dir * flipGeom.width, bookY, TEX_CURL_SHADOW)
      .setDisplaySize(110, PAGE_DISPLAY_H)
      .setAlpha(0);
    const frontMesh = this.makeLeafMesh(TEX_LEAF_FRONT, flipGeom, cyOf(flipSide), false);
    const backMesh = this.makeLeafMesh(TEX_LEAF_BACK, flipGeom, cyOf(flipSide), true);
    const W = flipGeom.width;
    // The arc math lands the leaf mirrored about flipGeom.rootX (the flipping
    // side's inner edge). But it must come to rest at the LANDING page's resting
    // rect, whose inner edge is landGeom.rootX. Slide the whole mesh by the gap
    // between the two inner edges, ramped 0→1 with t, so the fold meets the
    // gutter and the page lands exactly on the opposite resting page.
    const meshBaseX = frontMesh.x; // = SPINE_X + flipGeom.rootX + dir*W/2
    const landingShift = landGeom.rootX - flipGeom.rootX;
    // v.x is in pixels: [-W/2, +W/2]. Normalise to [0,1] where 0 = root (fold
    // pivot, inner edge) and 1 = outer edge, accounting for roll direction.
    const gridPos = (m: Phaser.GameObjects.Mesh): number[] =>
      m.vertices.map((v) => (v.x + W / 2) / W);
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
        // Normalized distance from the fold root along the paper (0 = root, 1 = edge).
        const dn = isNext ? pos[i] : 1 - pos[i];
        const d = dn * W;
        const phi = rootA + bend * dn; // local tangent angle of the paper
        let x: number;
        let z: number;
        if (bend < 1e-4) {
          x = d * Math.cos(rootA);
          z = d * Math.sin(rootA);
        } else {
          const r = W / bend; // radius of the constant-curvature arc
          x = r * (Math.sin(phi) - Math.sin(rootA));
          z = r * (Math.cos(rootA) - Math.cos(phi));
        }
        // v.x is in pixels relative to the mesh center (which sits at the leaf's
        // geometric center, rootX + dir*W/2). x runs 0 (root) → W (edge); pixel
        // offset from mesh center = dir*(x - W/2).
        v.x = sideSign * (x - W / 2);
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
      // Slide the leaf so its fold/landing meets the opposite page's inner edge.
      const shift = landingShift * t;
      frontMesh.setX(meshBaseX + shift);
      backMesh.setX(meshBaseX + shift);
      // Ground shadow tracks the airborne tip of the leaf.
      const tipA = Math.PI * Math.pow(t, CURL_TIP_POW);
      const rootA = Math.PI * Math.pow(t, CURL_ROOT_POW);
      const bend = tipA - rootA;
      const tipX = bend < 1e-4
        ? W * Math.cos(rootA)
        : (W / bend) * (Math.sin(tipA) - Math.sin(rootA));
      const lift = Math.sin(Math.PI * t);
      shadow.setX(SPINE_X + flipGeom.rootX + shift + sideSign * tipX);
      shadow.setDisplaySize(90 + 130 * lift, PAGE_DISPLAY_H);
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
      // Back face: render the flipping page content pre-mirrored into the texture
      // so that mirrorU on the mesh cancels it out — content reads correctly.
      this.fillLeafTextureMirrored(backDT, flipSide, flippingPage, flipGeom);
      // Landing page fades in during the second half of the curl.
      landingPage.setAlpha(0);
      const proxy = { t: 0 };
      this.scene.tweens.add({
        targets: proxy,
        t: 1,
        duration: CURL_DURATION,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          apply(proxy.t);
          // Fade the landing page in over the last 50% of the animation.
          landingPage.setAlpha(Phaser.Math.Clamp((proxy.t - 0.5) / 0.5, 0, 1));
        },
        onComplete: () => {
          landingPage.setAlpha(1);
          finish();
        },
      });
    } catch {
      landingPage.setAlpha(1);
      finish();
    }
  }

  /** (Re)create a page-sized DynamicTexture under a fixed key. Sized to the flat
   *  `page` asset so the leaf texture is exactly the turning sheet. */
  private freshDynamicTexture(key: string): Phaser.Textures.DynamicTexture {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const dt = this.scene.textures.addDynamicTexture(key, PAGE_DISPLAY_W, PAGE_DISPLAY_H);
    if (!dt) throw new Error(`BookLayout: could not create ${key}`);
    return dt;
  }

  /** Resting rect of the flat `page` for a side → leaf geometry for the curl.
   *  The leaf is the page rectangle; the fold pivots at the page's INNER edge
   *  (toward the gutter) and the tip lands at its OUTER edge. */
  private computeLeafGeom(side: 'left' | 'right'): LeafGeom {
    const bookY = (BOOK_TOP + BOOK_BOTTOM) / 2;
    const layout = pageLayoutXForIndex(this.tabOrder.indexOf(this.activeTab));
    const cx = side === 'right' ? layout.pageRight : layout.pageLeft;
    const half = PAGE_DISPLAY_W / 2;
    // dir = roll direction outward from the gutter. Right page rolls +x, left −x.
    const dir = side === 'right' ? 1 : -1;
    // Inner edge (fold root): the edge nearest the gutter/spine.
    const rootX = cx - dir * half;          // screen-x rel. to SPINE_X
    const cyTop = bookY + (side === 'right' ? PAGE_RIGHT_Y : PAGE_LEFT_Y) - PAGE_DISPLAY_H / 2;
    // Texture top-left in screen space: leftmost x of the page rect.
    const texLeftX = SPINE_X + cx - half;
    return { rootX, width: PAGE_DISPLAY_W, dir, texLeftX, texTopY: cyTop };
  }

  /** Compose one leaf so the TURNING page reads as the same flat `page` art the
   *  resting pages use: the painted-book art region as a base (fills the spine-to-
   *  page gap with the binding), then the `page` asset positioned exactly where it
   *  rests in the stack, then the page container's content on top. The page art is
   *  drawn AFTER the vignette (and not dimmed by it), matching the live z-order
   *  where the flat pages sit above the vignette. */
  private fillLeafTexture(
    dt: Phaser.Textures.DynamicTexture,
    side: 'left' | 'right',
    page: Phaser.GameObjects.Container,
    geom: LeafGeom,
  ): void {
    const bookY = (BOOK_TOP + BOOK_BOTTOM) / 2;
    // The leaf texture is the page rect: top-left at screen (texLeftX, texTopY).
    const left = geom.texLeftX;
    const top = geom.texTopY;
    dt.clear();
    // Base: painted book region + vignette (so any non-opaque page edge still
    // reads as parchment/binding rather than transparency).
    dt.draw(this.bookImage!, BOOK_IMG_CX - left, BOOK_IMG_CY - top);
    dt.fill(0x000000, VIGNETTE_ALPHA, 0, 0, PAGE_DISPLAY_W, PAGE_DISPLAY_H);

    // The flat `page` asset fills the whole leaf (above the vignette, undimmed —
    // same as on screen). This IS the turning sheet, so it traces the page rect.
    if (this.scene.textures.exists(PAGE_SINGLE_TEXTURE)) {
      const pageImg = this.scene.add.image(0, 0, PAGE_SINGLE_TEXTURE)
        .setScale(PAGE_SCALE)
        .setFlipX(side === 'right');
      // Page center sits at the leaf-texture center by construction.
      dt.draw(pageImg, PAGE_DISPLAY_W / 2, PAGE_DISPLAY_H / 2);
      pageImg.destroy();
    }

    // Page content (cards / relics / …) on top of the sheet.
    const wasVisible = page.visible;
    page.setVisible(true);
    dt.draw(page, SPINE_X - left, bookY - top);
    page.setVisible(wasVisible);
  }

  /** Same as fillLeafTexture but renders the page content horizontally mirrored
   *  into the texture. Used for the back face so that mirrorU on the Mesh cancels
   *  it out — content reads correctly when the leaf is face-down on the far side. */
  private fillLeafTextureMirrored(
    dt: Phaser.Textures.DynamicTexture,
    side: 'left' | 'right',
    page: Phaser.GameObjects.Container,
    geom: LeafGeom,
  ): void {
    const bookY = (BOOK_TOP + BOOK_BOTTOM) / 2;
    const left = geom.texLeftX;
    const top = geom.texTopY;
    dt.clear();
    dt.draw(this.bookImage!, BOOK_IMG_CX - left, BOOK_IMG_CY - top);
    dt.fill(0x000000, VIGNETTE_ALPHA, 0, 0, PAGE_DISPLAY_W, PAGE_DISPLAY_H);

    if (this.scene.textures.exists(PAGE_SINGLE_TEXTURE)) {
      const pageImg = this.scene.add.image(0, 0, PAGE_SINGLE_TEXTURE)
        .setScale(PAGE_SCALE)
        .setFlipX(side === 'right');
      dt.draw(pageImg, PAGE_DISPLAY_W / 2, PAGE_DISPLAY_H / 2);
      pageImg.destroy();
    }

    // Pre-mirror the page content horizontally so that the mesh's mirrorU cancels
    // it out. With scaleX = -1 the container mirrors around its own world x
    // (SPINE_X). In texture-local coords the pivot is at (SPINE_X - left), so the
    // mirrored draw origin is at 2*(SPINE_X - left) from the normal draw position.
    const wasVisible = page.visible;
    const prevScaleX = page.scaleX;
    page.setVisible(true);
    page.scaleX = -prevScaleX;
    const texPivotX = SPINE_X - left;
    dt.draw(page, texPivotX * 2, bookY - top);
    page.scaleX = prevScaleX;
    page.setVisible(wasVisible);
  }

  /** Page-rect grid Mesh in pixel-accurate ortho projection, centred on the leaf
   *  (the page's resting rect: SPINE_X + rootX + dir*width/2, cy). `mirrorU` flips
   *  the texture horizontally (the back face must land readable on the far side). */
  private makeLeafMesh(
    texKey: string, geom: LeafGeom, cy: number, mirrorU: boolean,
  ): Phaser.GameObjects.Mesh {
    const W = geom.width;
    const H = PAGE_DISPLAY_H;
    // Mesh centred at the leaf's geometric centre. setOrtho(W, H): vx = v.x (px).
    // Verts span v.x ∈ [-W/2, +W/2]; root (inner edge) and edge map via gridPos.
    const leafCX = SPINE_X + geom.rootX + geom.dir * W / 2;
    const mesh = this.scene.add.mesh(leafCX, cy, texKey);
    // A freshly-created Mesh adopts the renderer size, NOT the texture size — that
    // mismatch blows the projection up. Pin to the leaf so vx = v.x (1:1 px).
    mesh.setSize(W, H);
    mesh.setOrtho(W, H);
    Phaser.Geom.Mesh.GenerateGridVerts({
      mesh,
      texture: texKey,
      width: W,
      height: H,
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
