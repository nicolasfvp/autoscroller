// CollectionScene — the player's compendium. Rendered as an open tome with
// four chapter tabs (Cards / Relics / Tiles / Bosses).
//
// Two layout modes, chosen per tab:
//   • grid       (Cards)               — a paginated grid spread across both
//                                         pages; cards keep their own popup.
//   • listDetail (Relics/Tiles/Bosses) — a paginated list on the LEFT page and
//                                         the selected entry's detail on the
//                                         RIGHT page (in-book, no modal). Boss
//                                         detail plays the monster idle loop.
// Chrome + page-flip are owned by BookLayout; this scene supplies the per-spread
// renderer and the detail composition.

import Phaser from 'phaser';
import { loadMetaState } from '../systems/MetaPersistence';
import {
  getCollectionStatus, getCompletionPercent, getItemDetails,
  type CollectionStatus, type CategoryStatus,
} from '../systems/CollectionRegistry';
import { MetaState } from '../state/MetaState';
import { FONTS, LAYOUT } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';
import { createCardVisual, STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';
import { disableCardFaceInput } from '../ui/CardFace';
import { BookLayout, type BookRenderContext, type BookPageBounds, type BookTab } from '../ui/BookLayout';
import { addGlossaryButton } from '../ui/GlossaryButton';

const TAB_NAMES = ['Cards', 'Relics', 'Tiles', 'Bosses'] as const;
type TabName = typeof TAB_NAMES[number];

const TAB_KEYS: Record<TabName, keyof CollectionStatus> = {
  Cards: 'cards',
  Relics: 'relics',
  Tiles: 'tiles',
  Bosses: 'bosses',
};

// Layout strategy per tab.
const LAYOUT_MODE: Record<TabName, 'grid' | 'listDetail'> = {
  Cards: 'grid',
  Relics: 'listDetail',
  Tiles: 'listDetail',
  Bosses: 'listDetail',
};

// Grid mode (Cards): per-page shape; the spread shows 2× this.
const GRID_SHAPE: Record<TabName, { cols: number; rows: number }> = {
  Cards: { cols: 3, rows: 2 },
  Relics: { cols: 4, rows: 3 },
  Tiles: { cols: 4, rows: 3 },
  Bosses: { cols: 2, rows: 2 },
};

// listDetail mode: rows shown on the left page per spread.
const ROWS_PER_LIST_PAGE = 10;

// Parchment-friendly ink colors (the painted pages are light, so text is dark).
const INK = '#3a2218';
const INK_SOFT = '#6e4a1a';
const INK_TITLE = '#2a1206';

export class CollectionScene extends Phaser.Scene {
  private metaState!: MetaState;
  private collectionStatus!: CollectionStatus;
  private book: BookLayout | null = null;
  private transitioning = false;
  // Per-tab current selection (listDetail mode), preserved across flips/tab swaps.
  private selectedId: Partial<Record<TabName, string>> = {};
  // Idle-animation timer for the boss detail portrait; cleared on every re-render.
  private detailIdleTimer: Phaser.Time.TimerEvent | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private wheelHandler: ((p: Phaser.Input.Pointer, go: unknown, dx: number, dy: number) => void) | null = null;

  constructor() {
    super(SCENE_KEYS.COLLECTION);
  }

  async create(): Promise<void> {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    this.metaState = await loadMetaState();
    this.collectionStatus = getCollectionStatus(this.metaState);
    const percent = getCompletionPercent(this.metaState);

    const tabs: BookTab[] = TAB_NAMES.map((name) => {
      const status = this.collectionStatus[TAB_KEYS[name]];
      return { key: name, label: name, badge: `${status.unlocked} / ${status.total}` };
    });

    this.book = new BookLayout(this, {
      title: 'Compendium',
      subtitle: `${percent}% complete`,
      tabs,
      initialTabKey: 'Cards',
      onTabChange: (key) => this.setTabContent(key as TabName),
      onClose: () => this.fadeToScene(SCENE_KEYS.CITY_HUB),
    });

    this.setTabContent('Cards');
    this.installInputBindings();

    // "?" glossary button so players can look up stack/stat tokens while
    // browsing the compendium. Top-right, above the book chrome.
    addGlossaryButton(this, LAYOUT.canvasWidth - 30, 30, 6000);

    this.events.once('shutdown', () => this.teardown());
  }

  private installInputBindings(): void {
    // Arrow keys flip pages; PgUp/PgDn also work.
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        this.book?.flipForward();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        this.book?.flipBackward();
      } else if (e.key === 'Escape') {
        this.fadeToScene(SCENE_KEYS.CITY_HUB);
      }
    };
    window.addEventListener('keydown', this.keydownHandler);

    // Mouse wheel: scroll-down = next page, scroll-up = prev. Standard
    // book-reading metaphor in card-game collections.
    this.wheelHandler = (_p, _go, _dx, dy) => {
      if (dy > 0) this.book?.flipForward();
      else if (dy < 0) this.book?.flipBackward();
    };
    this.input.on('wheel', this.wheelHandler);
  }

  private teardown(): void {
    this.clearDetailIdleTimer();
    this.book?.destroy();
    this.book = null;
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.wheelHandler) {
      this.input.off('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
  }

  private fadeToScene(sceneKey: string, data?: object): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(sceneKey, data));
  }

  // ── Tab dispatch ──────────────────────────────────────────

  private setTabContent(tab: TabName): void {
    if (!this.book) return;
    this.clearDetailIdleTimer();
    const items = this.collectionStatus[TAB_KEYS[tab]].items;

    if (LAYOUT_MODE[tab] === 'grid') {
      const shape = GRID_SHAPE[tab];
      const perSpread = shape.cols * shape.rows * 2;
      const totalSpreads = Math.max(1, Math.ceil(items.length / perSpread));
      this.book.setContent(totalSpreads, (ctx) => this.renderSpread(tab, items, ctx));
    } else {
      const totalSpreads = Math.max(1, Math.ceil(items.length / ROWS_PER_LIST_PAGE));
      // Default selection = first unlocked entry (fallback: first entry).
      if (!this.selectedId[tab]) {
        this.selectedId[tab] = items.find(i => i.isUnlocked)?.id ?? items[0]?.id;
      }
      this.book.setContent(totalSpreads, (ctx) => this.renderListDetailSpread(tab, items, ctx));
    }
  }

  private clearDetailIdleTimer(): void {
    if (this.detailIdleTimer) {
      this.detailIdleTimer.remove(false);
      this.detailIdleTimer = null;
    }
  }

  // ── Grid mode (Cards) ─────────────────────────────────────

  private renderSpread(
    tab: TabName,
    items: CategoryStatus['items'],
    ctx: BookRenderContext,
  ): void {
    const { cols, rows } = GRID_SHAPE[tab];
    const perPage = cols * rows;
    const spreadStart = ctx.spreadIndex * perPage * 2;

    const leftItems = items.slice(spreadStart, spreadStart + perPage);
    const rightItems = items.slice(spreadStart + perPage, spreadStart + perPage * 2);

    this.renderPageItems(tab, leftItems, ctx.leftPage, ctx.leftBounds);
    this.renderPageItems(tab, rightItems, ctx.rightPage, ctx.rightBounds);
  }

  private renderPageItems(
    tab: TabName,
    items: CategoryStatus['items'],
    container: Phaser.GameObjects.Container,
    bounds: BookPageBounds,
  ): void {
    if (items.length === 0) return;
    const { cols, rows } = GRID_SHAPE[tab];
    const { itemW, itemH, scale } = this.itemDimensions(tab);

    // Fit-to-page: pick gap so the grid fills (without exceeding) the inner
    // bounds, then clamp to a sensible cap so a 1-item page doesn't sprawl.
    const fitGapX = cols > 1 ? (bounds.innerW - cols * itemW) / (cols - 1) : 0;
    const fitGapY = rows > 1 ? (bounds.innerH - rows * itemH) / (rows - 1) : 0;
    const gapX = Math.max(8, Math.min(fitGapX, itemW * 0.45));
    const gapY = Math.max(12, Math.min(fitGapY, itemH * 0.45));
    const effW = cols * itemW + (cols - 1) * gapX;
    const effH = rows * itemH + (rows - 1) * gapY;
    const startX = bounds.centerX - effW / 2 + itemW / 2;
    const startY = bounds.centerY - effH / 2 + itemH / 2;

    items.forEach((item, idx) => {
      if (idx >= cols * rows) return;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = startX + col * (itemW + gapX);
      const y = startY + row * (itemH + gapY);

      if (item.isUnlocked) {
        this.renderUnlocked(tab, item, x, y, scale, container);
      } else {
        this.renderLocked(tab, item, x, y, itemH, scale, container);
      }
    });
  }

  private itemDimensions(tab: TabName): { itemW: number; itemH: number; scale: number } {
    switch (tab) {
      case 'Cards':
      default: {
        const scale = 0.5;
        return { itemW: STANDARD_CARD_WIDTH * scale, itemH: STANDARD_CARD_HEIGHT * scale, scale };
      }
    }
  }

  // Grid mode is Cards-only; relics/tiles/bosses use listDetail and open their
  // detail on the right page instead of a popup.
  private renderUnlocked(
    tab: TabName,
    item: CategoryStatus['items'][number],
    x: number, y: number, scale: number,
    container: Phaser.GameObjects.Container,
  ): void {
    if (tab !== 'Cards') return;
    // CardVisual self-binds pointerdown -> showCardDetail (the shared popup).
    const visual = createCardVisual(this, x, y, item.id, { scale });
    container.add(visual);
  }

  private renderLocked(
    tab: TabName,
    item: CategoryStatus['items'][number],
    x: number, y: number, itemH: number, scale: number,
    container: Phaser.GameObjects.Container,
  ): void {
    if (tab !== 'Cards') return;
    const FF = FONTS.family;
    const visual = createCardVisual(this, x, y, item.id, { scale });
    visual.setAlpha(0.35);
    disableCardFaceInput(visual);
    container.add(visual);
    const lock = this.add.text(x, y, '🔒', {
      fontSize: '22px', fontFamily: FF, color: '#ffffff',
    }).setOrigin(0.5);
    container.add(lock);
    if (item.unlockHint) {
      const hint = this.add.text(x, y + itemH / 2 + 6, item.unlockHint, {
        fontSize: '9px', color: INK_SOFT, fontFamily: FF,
        wordWrap: { width: STANDARD_CARD_WIDTH * scale + 6 }, align: 'center',
      }).setOrigin(0.5, 0);
      container.add(hint);
    }
  }

  // ── listDetail mode (Relics / Tiles / Bosses) ─────────────

  private renderListDetailSpread(
    tab: TabName,
    items: CategoryStatus['items'],
    ctx: BookRenderContext,
  ): void {
    // Always reset the idle timer first — repaint() destroyed the old portrait.
    this.clearDetailIdleTimer();

    const selId = this.selectedId[tab] ?? items.find(i => i.isUnlocked)?.id ?? items[0]?.id;
    if (selId && !this.selectedId[tab]) this.selectedId[tab] = selId;

    this.renderList(tab, items, ctx);
    if (selId) this.renderDetail(tab, selId, ctx.rightPage, ctx.rightBounds);
  }

  private renderList(
    tab: TabName,
    items: CategoryStatus['items'],
    ctx: BookRenderContext,
  ): void {
    const bounds = ctx.leftBounds;
    const start = ctx.spreadIndex * ROWS_PER_LIST_PAGE;
    const slice = items.slice(start, start + ROWS_PER_LIST_PAGE);
    const rowH = bounds.innerH / ROWS_PER_LIST_PAGE;

    slice.forEach((item, i) => {
      const y = bounds.innerY + rowH / 2 + i * rowH;
      this.renderListRow(tab, item, ctx.leftPage, bounds, y, rowH);
    });
  }

  private renderListRow(
    tab: TabName,
    item: CategoryStatus['items'][number],
    container: Phaser.GameObjects.Container,
    bounds: BookPageBounds,
    y: number,
    rowH: number,
  ): void {
    const FF = FONTS.family;
    const isSel = this.selectedId[tab] === item.id;

    const rowBg = this.add.rectangle(bounds.centerX, y, bounds.innerW, rowH - 4, 0xc89a3c, isSel ? 0.35 : 0.0001);
    if (isSel) rowBg.setStrokeStyle(1.5, 0x8a6420, 0.9);
    rowBg.setInteractive({ useHandCursor: true });
    rowBg.on('pointerover', () => { if (this.selectedId[tab] !== item.id) rowBg.setFillStyle(0xc89a3c, 0.15); });
    rowBg.on('pointerout', () => { if (this.selectedId[tab] !== item.id) rowBg.setFillStyle(0xc89a3c, 0.0001); });
    rowBg.on('pointerdown', () => this.selectRow(tab, item.id));
    container.add(rowBg);

    const thumb = Math.min(rowH - 8, 30);
    const thumbX = bounds.innerX + thumb / 2;
    const key = this.thumbKey(tab, item.id);
    if (item.isUnlocked && this.textures.exists(key)) {
      this.addFittedImage(container, key, thumbX, y, thumb, thumb);
    } else {
      const box = this.add.rectangle(thumbX, y, thumb, thumb, 0x2a1a10).setStrokeStyle(1, 0x6e4a1a);
      container.add(box);
      const mark = this.add.text(thumbX, y, item.isUnlocked ? '•' : '?', {
        fontSize: '12px', fontStyle: 'bold', color: '#9d7e44', fontFamily: FF,
      }).setOrigin(0.5);
      container.add(mark);
    }

    const nameX = bounds.innerX + thumb + 8;
    const name = this.add.text(nameX, y, item.isUnlocked ? item.name : '???', {
      fontSize: '12px', fontStyle: 'bold',
      color: item.isUnlocked ? INK : INK_SOFT,
      fontFamily: FF,
      wordWrap: { width: bounds.innerW - thumb - 16 },
    }).setOrigin(0, 0.5);
    container.add(name);
  }

  private thumbKey(tab: TabName, id: string): string {
    if (tab === 'Relics') return `relic_${id}`;
    if (tab === 'Tiles') return `tile_${id}`;
    return `monster_${id}`; // Bosses
  }

  /** Change the selection and re-render the current spread in place (no flip). */
  private selectRow(tab: TabName, id: string): void {
    if (this.selectedId[tab] === id) return;
    this.selectedId[tab] = id;
    this.book?.setSpreadIndex(this.book.getSpreadIndex());
  }

  // ── Detail compositions (right page) ──────────────────────

  private renderDetail(
    tab: TabName,
    id: string,
    container: Phaser.GameObjects.Container,
    bounds: BookPageBounds,
  ): void {
    const details = getItemDetails(id, this.metaState);
    if (!details) return;
    if (tab === 'Relics') this.renderRelicDetail(details, container, bounds);
    else if (tab === 'Bosses') this.renderBossDetail(details, container, bounds);
    else if (tab === 'Tiles') this.renderTileDetail(details, container, bounds);
  }

  private renderLockedDetail(
    details: ReturnType<typeof getItemDetails>,
    container: Phaser.GameObjects.Container,
    bounds: BookPageBounds,
  ): void {
    if (!details) return;
    const FF = FONTS.family;
    const cx = bounds.centerX;
    const box = this.add.rectangle(cx, bounds.innerY + 130, 150, 170, 0x2a1a10, 0.9)
      .setStrokeStyle(2, 0x6e4a1a);
    container.add(box);
    container.add(this.add.text(cx, bounds.innerY + 130, '???', {
      fontSize: '44px', fontStyle: 'bold', color: INK_SOFT, fontFamily: FF,
    }).setOrigin(0.5));
    container.add(this.add.text(cx, bounds.innerY + 250, 'Locked', {
      fontSize: '16px', fontStyle: 'bold', color: INK_SOFT, fontFamily: FF,
    }).setOrigin(0.5));
    if (details.unlockHint) {
      container.add(this.add.text(cx, bounds.innerY + 278, details.unlockHint, {
        fontSize: '12px', color: INK_SOFT, fontFamily: FF, align: 'center',
        wordWrap: { width: bounds.innerW },
      }).setOrigin(0.5, 0));
    }
  }

  private renderRelicDetail(
    details: NonNullable<ReturnType<typeof getItemDetails>>,
    container: Phaser.GameObjects.Container,
    bounds: BookPageBounds,
  ): void {
    if (!details.isUnlocked) { this.renderLockedDetail(details, container, bounds); return; }
    const FF = FONTS.family;
    const cx = bounds.centerX;
    const data = details.data ?? {};
    let cy = bounds.innerY + 6;

    const iconBox = 108;
    if (!this.addFittedImage(container, `relic_${details.id}`, cx, cy + iconBox / 2, iconBox, iconBox)) {
      const fb = this.add.rectangle(cx, cy + iconBox / 2, iconBox, iconBox, 0x3a2218).setStrokeStyle(2, 0xc89a3c);
      container.add(fb);
    }
    cy += iconBox + 12;

    const name = this.add.text(cx, cy, details.name, {
      fontSize: '18px', fontStyle: 'bold', color: INK_TITLE, fontFamily: FF,
      align: 'center', wordWrap: { width: bounds.innerW },
    }).setOrigin(0.5, 0);
    container.add(name);
    cy += name.height + 6;

    const meta = [data.rarity, data.trigger].filter(Boolean)
      .map((s: any) => String(s).replace(/_/g, ' ').toUpperCase()).join('   •   ');
    if (meta) {
      const m = this.add.text(cx, cy, meta, {
        fontSize: '11px', fontStyle: 'bold', color: this.rarityColor(data.rarity), fontFamily: FF,
        align: 'center', wordWrap: { width: bounds.innerW },
      }).setOrigin(0.5, 0);
      container.add(m);
      cy += m.height + 8;
    }

    if (data.description) {
      const d = this.add.text(cx, cy, String(data.description), {
        fontSize: '13px', color: INK, fontFamily: FF, align: 'center',
        wordWrap: { width: bounds.innerW }, lineSpacing: 3,
      }).setOrigin(0.5, 0);
      container.add(d);
      cy += d.height + 10;
    }

    if (data.stats && typeof data.stats === 'object') {
      const lines = Object.entries(data.stats)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
      if (lines.length) {
        const st = this.add.text(cx, cy, lines.join('\n'), {
          fontSize: '12px', color: INK_SOFT, fontFamily: FF, align: 'center', lineSpacing: 2,
        }).setOrigin(0.5, 0);
        container.add(st);
        cy += st.height + 6;
      }
    }
  }

  private renderBossDetail(
    details: NonNullable<ReturnType<typeof getItemDetails>>,
    container: Phaser.GameObjects.Container,
    bounds: BookPageBounds,
  ): void {
    const FF = FONTS.family;
    const cx = bounds.centerX;
    const data = details.data ?? {};
    let cy = bounds.innerY + 4;

    const box = 150;
    const portrait = this.addFittedImage(container, `monster_${details.id}`, cx, cy + box / 2, box, box);
    if (!portrait) {
      const fb = this.add.rectangle(cx, cy + box / 2, box, box, 0x4a1a1a).setStrokeStyle(2, 0xc89a3c);
      container.add(fb);
    }
    cy += box + 8;

    // Idle loop: cycle monster_<id>, monster_<id>_2, … at 6 fps when multi-frame.
    const frames = this.bossIdleFrames(details.id);
    if (portrait && frames.length > 1) {
      let fi = 0;
      this.detailIdleTimer = this.time.addEvent({
        delay: Math.round(1000 / 6),
        loop: true,
        callback: () => {
          if (!portrait.active) return;
          fi = (fi + 1) % frames.length;
          portrait.setTexture(frames[fi]);
        },
      });
    }

    const name = this.add.text(cx, cy, details.name, {
      fontSize: '20px', fontStyle: 'bold', color: INK_TITLE, fontFamily: FF,
      align: 'center', wordWrap: { width: bounds.innerW },
    }).setOrigin(0.5, 0);
    container.add(name);
    cy += name.height + 8;

    const statLine = `HP ${data.hp ?? '?'}    ATK ${data.atk ?? '?'}    DEF ${data.defense ?? 0}`;
    const stats = this.add.text(cx, cy, statLine, {
      fontSize: '13px', fontStyle: 'bold', color: INK_SOFT, fontFamily: FF,
    }).setOrigin(0.5, 0);
    container.add(stats);
    cy += stats.height + 6;

    if (data.effect) {
      const eff = this.add.text(cx, cy, `Behaviors: ${data.effect}`, {
        fontSize: '11px', fontStyle: 'italic', color: INK_SOFT, fontFamily: FF,
        align: 'center', wordWrap: { width: bounds.innerW },
      }).setOrigin(0.5, 0);
      container.add(eff);
      cy += eff.height + 10;
    }

    if (data.lore) {
      const lore = this.add.text(cx, cy, String(data.lore), {
        fontSize: '13px', color: INK, fontFamily: FF, align: 'center',
        wordWrap: { width: bounds.innerW }, lineSpacing: 4,
      }).setOrigin(0.5, 0);
      container.add(lore);
    }
  }

  private renderTileDetail(
    details: NonNullable<ReturnType<typeof getItemDetails>>,
    container: Phaser.GameObjects.Container,
    bounds: BookPageBounds,
  ): void {
    const FF = FONTS.family;
    const cx = bounds.centerX;
    const data = details.data ?? {};
    let cy = bounds.innerY + 8;

    const box = 112;
    const art = this.addFittedImage(container, `tile_${details.id}`, cx, cy + box / 2, box, box);
    if (art && !details.isUnlocked) art.setAlpha(0.35);
    if (!art) {
      const fb = this.add.rectangle(cx, cy + box / 2, box, box, 0x3a2218).setStrokeStyle(2, 0xc89a3c);
      container.add(fb);
    }
    cy += box + 12;

    const name = this.add.text(cx, cy, details.name, {
      fontSize: '18px', fontStyle: 'bold', color: INK_TITLE, fontFamily: FF,
      align: 'center', wordWrap: { width: bounds.innerW },
    }).setOrigin(0.5, 0);
    container.add(name);
    cy += name.height + 8;

    const statusText = details.isUnlocked ? 'Unlocked' : (details.unlockHint ?? 'Locked');
    const status = this.add.text(cx, cy, statusText, {
      fontSize: '12px', fontStyle: 'bold',
      color: details.isUnlocked ? '#2e6e2e' : INK_SOFT, fontFamily: FF,
      align: 'center', wordWrap: { width: bounds.innerW },
    }).setOrigin(0.5, 0);
    container.add(status);
    cy += status.height + 10;

    if (data.description) {
      const d = this.add.text(cx, cy, String(data.description), {
        fontSize: '13px', color: INK, fontFamily: FF, align: 'center',
        wordWrap: { width: bounds.innerW }, lineSpacing: 3,
      }).setOrigin(0.5, 0);
      container.add(d);
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  /** Add an image scaled to fit a box while preserving aspect ratio. Returns
   *  null (adding nothing) when the texture isn't loaded. */
  private addFittedImage(
    container: Phaser.GameObjects.Container,
    key: string, x: number, y: number, boxW: number, boxH: number,
  ): Phaser.GameObjects.Image | null {
    if (!this.textures.exists(key)) return null;
    const src = this.textures.get(key).getSourceImage() as { width: number; height: number };
    const scale = Math.min(boxW / src.width, boxH / src.height);
    const img = this.add.image(x, y, key).setScale(scale);
    container.add(img);
    return img;
  }

  /** Ordered idle frames for a boss: monster_<id>, monster_<id>_2, … while they
   *  exist. Single-frame bosses return one entry (rendered static). */
  private bossIdleFrames(id: string): string[] {
    const frames: string[] = [];
    if (this.textures.exists(`monster_${id}`)) frames.push(`monster_${id}`);
    for (let n = 2; n < 12; n++) {
      const k = `monster_${id}_${n}`;
      if (this.textures.exists(k)) frames.push(k);
      else break;
    }
    return frames;
  }

  private rarityColor(rarity?: string): string {
    switch ((rarity ?? '').toLowerCase()) {
      case 'common': return '#5a4a32';
      case 'uncommon': return '#2e6e2e';
      case 'rare': return '#2e5a8e';
      case 'epic': return '#7a3e9e';
      case 'legendary': return '#a8761e';
      default: return INK_SOFT;
    }
  }
}
