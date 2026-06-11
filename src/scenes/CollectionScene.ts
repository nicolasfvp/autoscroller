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
  getCollectionStatus, getItemDetails,
  type CollectionStatus, type CategoryStatus,
} from '../systems/CollectionRegistry';
import { MetaState } from '../state/MetaState';
import { FONTS, LAYOUT } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';
import { STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';
import { createCardFace } from '../ui/CardFace';
import { getCardById } from '../data/DataLoader';
import { formatCardDescription } from '../systems/cards/CardText';
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


// Grid layout for listDetail tabs (left page).
const LIST_GRID_COLS = 3;
const LIST_GRID_ROWS_BOSSES = 3;  // 9 slots — fits 7+ bosses
const LIST_GRID_ROWS_OTHER  = 4;  // 12 slots — fits relics/tiles
const LIST_GRID_ROWS_CARDS  = 3;  // 9 slots per page (3×3 mini card grid)
const LIST_GRID_PER_PAGE_BOSSES = LIST_GRID_COLS * LIST_GRID_ROWS_BOSSES;
const LIST_GRID_PER_PAGE_OTHER  = LIST_GRID_COLS * LIST_GRID_ROWS_OTHER;
const LIST_GRID_PER_PAGE_CARDS  = LIST_GRID_COLS * LIST_GRID_ROWS_CARDS;

// Parchment-friendly ink colors (the painted pages are light, so text is dark).
const INK = '#1a0e08';
const INK_SOFT = '#3a2218';
const INK_TITLE = '#0d0604';

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

    const tabs: BookTab[] = TAB_NAMES.map((name) => {
      const status = this.collectionStatus[TAB_KEYS[name]];
      return { key: name, label: name, badge: `${status.unlocked} / ${status.total}` };
    });

    this.book = new BookLayout(this, {
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

    {
      const perPage = tab === 'Cards'
        ? LIST_GRID_PER_PAGE_CARDS
        : tab === 'Bosses' ? LIST_GRID_PER_PAGE_BOSSES : LIST_GRID_PER_PAGE_OTHER;
      const totalSpreads = Math.max(1, Math.ceil(items.length / perPage));
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

  // ── listDetail mode (Cards / Relics / Tiles / Bosses) ───────

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
    this.renderListGrid(tab, items, ctx);
  }

  private renderListGrid(
    tab: TabName,
    items: CategoryStatus['items'],
    ctx: BookRenderContext,
  ): void {
    if (tab === 'Cards') { this.renderCardsGrid(items, ctx); return; }

    const FF = FONTS.family;
    const bounds = ctx.leftBounds;
    const rows = tab === 'Bosses' ? LIST_GRID_ROWS_BOSSES : LIST_GRID_ROWS_OTHER;
    const perPage = LIST_GRID_COLS * rows;
    const start = ctx.spreadIndex * perPage;
    const slice = items.slice(start, start + perPage);

    const colGap = tab === 'Relics' ? 4 : 0;
    const usableCellW = (bounds.innerW - colGap * (LIST_GRID_COLS - 1)) / LIST_GRID_COLS;
    const cellH = bounds.innerH / rows;
    const iconSize = Math.min(usableCellW, cellH) * 0.58 * 1.3;
    const nameFontSize = tab === 'Relics' ? Math.round(15 * 0.7) : 15;
    const cardH = iconSize + nameFontSize + 14;
    const offsetY = tab === 'Bosses' ? 40 : 25;

    slice.forEach((item, i) => {
      const col = i % LIST_GRID_COLS;
      const row = Math.floor(i / LIST_GRID_COLS);
      const cx = bounds.innerX + col * (usableCellW + colGap) + usableCellW / 2;
      const cy = bounds.innerY + row * cellH + offsetY;
      const isSel = this.selectedId[tab] === item.id;

      const bg = this.add.rectangle(cx, cy + cardH / 2, usableCellW - 4, cardH, 0xc89a3c, isSel ? 0.35 : 0.0001);
      if (isSel) bg.setStrokeStyle(1.5, 0x8a6420, 0.9);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { if (this.selectedId[tab] !== item.id) bg.setFillStyle(0xc89a3c, 0.15); });
      bg.on('pointerout',  () => { if (this.selectedId[tab] !== item.id) bg.setFillStyle(0xc89a3c, 0.0001); });
      bg.on('pointerdown', () => this.selectRow(tab, item.id));
      ctx.leftPage.add(bg);

      const iconY = cy + iconSize / 2 + 4;
      const key = this.thumbKey(tab, item.id);
      if (item.isUnlocked && this.textures.exists(key)) {
        this.addFittedImage(ctx.leftPage, key, cx, iconY, iconSize, iconSize);
      } else {
        const fb = this.add.rectangle(cx, iconY, iconSize, iconSize, 0x2a1a10).setStrokeStyle(1, 0x6e4a1a);
        ctx.leftPage.add(fb);
        ctx.leftPage.add(this.add.text(cx, iconY, item.isUnlocked ? '•' : '?', {
          fontSize: '18px', color: '#9d7e44', fontFamily: FF,
        }).setOrigin(0.5));
      }

      const nameY = cy + iconSize + 8;
      const displayName = item.isUnlocked ? item.name : '???';
      ctx.leftPage.add(this.add.text(cx, nameY, displayName, {
        fontSize: `${nameFontSize}px`,
        color: item.isUnlocked ? INK : INK_SOFT,
        fontFamily: FF,
        align: 'center',
        wordWrap: tab === 'Relics' ? undefined : { width: usableCellW - 4 },
        fixedWidth: tab === 'Relics' ? usableCellW - 4 : 0,
      }).setOrigin(0.5, 0));
    });
  }

  private renderCardsGrid(
    items: CategoryStatus['items'],
    ctx: BookRenderContext,
  ): void {
    const bounds = ctx.leftBounds;
    const cols = LIST_GRID_COLS;
    const rows = LIST_GRID_ROWS_CARDS;
    const perPage = LIST_GRID_PER_PAGE_CARDS;
    const start = ctx.spreadIndex * perPage;
    const slice = items.slice(start, start + perPage);

    const cardScale = 0.46;
    const cardW = STANDARD_CARD_WIDTH * cardScale;
    const cardH = STANDARD_CARD_HEIGHT * cardScale;
    const gapX = 10;
    const gapY = 10;
    const totalW = cols * cardW + (cols - 1) * gapX;
    const totalH = rows * cardH + (rows - 1) * gapY;
    const startX = bounds.centerX - totalW / 2 + cardW / 2 + 15;
    const startY = bounds.centerY - totalH / 2 + cardH / 2 + 5;

    slice.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);
      const isSel = this.selectedId['Cards'] === item.id;

      const visual = createCardFace(this, cx, cy, item.id, {
        baseSize: 'small', scale: cardScale, hover: false,
      });
      if (!item.isUnlocked) {
        visual.setAlpha(0.4);
      } else {
        visual.setInteractive({ useHandCursor: true });
        visual.on('pointerdown', () => this.selectRow('Cards', item.id));
      }
      ctx.leftPage.add(visual);

      if (isSel) {
        const selBorder = this.add.rectangle(cx, cy, cardW + 4, cardH + 4, 0xc89a3c, 0)
          .setStrokeStyle(2.5, 0xf0c060, 1);
        ctx.leftPage.add(selBorder);
        selBorder.setDepth(-1);
      }
    });
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
    if (tab === 'Cards') { this.renderCardDetail(id, container, bounds); return; }
    const details = getItemDetails(id, this.metaState);
    if (!details) return;
    if (tab === 'Relics') this.renderRelicDetail(details, container, bounds);
    else if (tab === 'Bosses') this.renderBossDetail(details, container, bounds);
    else if (tab === 'Tiles') this.renderTileDetail(details, container, bounds);
  }

  private renderCardDetail(
    cardId: string,
    container: Phaser.GameObjects.Container,
    bounds: BookPageBounds,
  ): void {
    const FF = FONTS.family;

    // Card centered on page. desc text x=185.5 (from debug JSON) confirms
    // bounds.centerX is the correct horizontal anchor for this page.
    // Card y: desc text is at y=178.5 (top of text block); card bottom = desc top
    // → cardY = 178.5 - 339/2 = 9.0  (center of card)
    const cardX = bounds.centerX - 30;
    const cardY = -3.3;            // from debug JSON y=-3.3 of the card mold
    const face = createCardFace(this, cardX, cardY, cardId, {
      baseSize: { w: 214, h: 339 },
      hover: false,
    });
    container.add(face);

    // desc text: x=185.5, y=178.5, fontSize=13, wrapWidth=207 (from debug JSON)
    const card = getCardById(cardId);
    if (card) {
      const effects = card.effects ?? [];
      const descText = formatCardDescription({ effects, exhaust: card.exhaust, spend_armor: card.spend_armor });
      if (descText) {
        container.add(this.add.text(bounds.centerX - 30, 178.5, descText, {
          fontSize: '13px', color: '#d4c8a8', fontFamily: FF,
          align: 'center', wordWrap: { width: 207 }, lineSpacing: 2,
        }).setOrigin(0.5, 0));
      }
    }

    const cardItem = this.collectionStatus.cards.items.find(i => i.id === cardId);
    if (cardItem && !cardItem.isUnlocked) {
      face.setAlpha(0.4);
    }
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
      fontSize: '44px', color: INK_SOFT, fontFamily: FF,
    }).setOrigin(0.5));
    container.add(this.add.text(cx, bounds.innerY + 250, 'Locked', {
      fontSize: '16px', color: INK_SOFT, fontFamily: FF,
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
    const data = details.data ?? {};

    // Icon: x=144, y=-59.9, displaySize=143×143 (from debug overlay)
    if (!this.addFittedImage(container, `relic_${details.id}`, 144, -59.9, 143, 143)) {
      const fb = this.add.rectangle(144, -59.9, 143, 143, 0x3a2218).setStrokeStyle(2, 0xc89a3c);
      container.add(fb);
    }

    // Name: x=144, y=19.9, wrapWidth=235
    container.add(this.add.text(144, 19.9, details.name, {
      fontSize: '18px', color: INK_TITLE, fontFamily: FF,
      align: 'center', wordWrap: { width: 235 },
    }).setOrigin(0.5, 0));

    // Meta (rarity • trigger): x=144.7, y=49.9, wrapWidth=235
    const meta = [data.rarity, data.trigger].filter(Boolean)
      .map((s: any) => String(s).replace(/_/g, ' ').toUpperCase()).join('   •   ');
    if (meta) {
      container.add(this.add.text(144.7, 49.9, meta, {
        fontSize: '11px', color: this.rarityColor(data.rarity), fontFamily: FF,
        align: 'center', wordWrap: { width: 235 },
      }).setOrigin(0.5, 0));
    }

    // Description: x=144.7, y=76.5, wrapWidth=255
    if (data.description) {
      container.add(this.add.text(144.7, 76.5, String(data.description), {
        fontSize: '13px', color: INK, fontFamily: FF, align: 'center',
        wordWrap: { width: 255 }, lineSpacing: 3,
      }).setOrigin(0.5, 0));
    }
  }

  private renderBossDetail(
    details: NonNullable<ReturnType<typeof getItemDetails>>,
    container: Phaser.GameObjects.Container,
    _bounds: BookPageBounds,
  ): void {
    const FF = FONTS.family;
    const data = details.data ?? {};

    const box = 176;
    const portrait = this.addFittedImage(container, `monster_${details.id}`, 146.6, -95.5, box, box);
    if (!portrait) {
      const fb = this.add.rectangle(146.6, -95.5, box, box, 0x4a1a1a).setStrokeStyle(2, 0xc89a3c);
      container.add(fb);
    }

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

    const name = this.add.text(151.3, -16.5, details.name, {
      fontSize: '20px', color: INK_TITLE, fontFamily: FF,
      align: 'center', wordWrap: { width: 235 },
    }).setOrigin(0.5, 0);
    container.add(name);

    const statLine = `HP ${data.hp ?? '?'}    ATK ${data.atk ?? '?'}    DEF ${data.defense ?? 0}`;
    const stats = this.add.text(149.3, 6.5, statLine, {
      fontSize: '13px', color: INK_SOFT, fontFamily: FF,
      wordWrap: { width: 144 },
    }).setOrigin(0.5, 0);
    container.add(stats);

    if (data.lore) {
      const lore = this.add.text(149.3, 32.8, String(data.lore), {
        fontSize: '13px', color: INK, fontFamily: FF, align: 'center',
        wordWrap: { width: 295 }, lineSpacing: 4,
      }).setOrigin(0.5, 0);
      container.add(lore);
    }
  }

  private renderTileDetail(
    details: NonNullable<ReturnType<typeof getItemDetails>>,
    container: Phaser.GameObjects.Container,
    _bounds: BookPageBounds,
  ): void {
    const FF = FONTS.family;
    const data = details.data ?? {};

    // Icon: same coordinates as relic detail (debug overlay)
    const art = this.addFittedImage(container, `tile_${details.id}`, 144, -59.9, 143, 143);
    if (art && !details.isUnlocked) art.setAlpha(0.35);
    if (!art) {
      const fb = this.add.rectangle(144, -59.9, 143, 143, 0x3a2218).setStrokeStyle(2, 0xc89a3c);
      container.add(fb);
    }

    // Name: x=144, y=19.9
    container.add(this.add.text(144, 19.9, details.name, {
      fontSize: '18px', color: INK_TITLE, fontFamily: FF,
      align: 'center', wordWrap: { width: 235 },
    }).setOrigin(0.5, 0));

    // Status (Unlocked / hint): x=144.7, y=49.9
    const statusText = details.isUnlocked ? 'Unlocked' : (details.unlockHint ?? 'Locked');
    container.add(this.add.text(144.7, 49.9, statusText, {
      fontSize: '11px',
      color: details.isUnlocked ? '#2e6e2e' : INK_SOFT, fontFamily: FF,
      align: 'center', wordWrap: { width: 235 },
    }).setOrigin(0.5, 0));

    // Description/lore: x=144.7, y=76.5, wrapWidth=255
    if (data.description) {
      container.add(this.add.text(144.7, 76.5, String(data.description), {
        fontSize: '13px', color: INK, fontFamily: FF, align: 'center',
        wordWrap: { width: 255 }, lineSpacing: 3,
      }).setOrigin(0.5, 0));
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
