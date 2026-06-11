// CollectionScene — the player's compendium. Rendered as an open tome with
// four chapter tabs (Cards / Relics / Tiles / Bosses), paginated card spreads,
// and a page-flip animation. Chrome is owned by BookLayout; this scene just
// supplies the per-spread renderer and the detail popup.

import Phaser from 'phaser';
import { loadMetaState } from '../systems/MetaPersistence';
import {
  getCollectionStatus, getCompletionPercent, getItemDetails,
  type CollectionStatus, type CategoryStatus,
} from '../systems/CollectionRegistry';
import { MetaState } from '../state/MetaState';
import { COLORS, FONTS, LAYOUT } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';
import { createCardVisual, STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';
import { disableCardFaceInput } from '../ui/CardFace';
import { BookLayout, type BookRenderContext, type BookPageBounds, type BookTab } from '../ui/BookLayout';
import { addGlossaryButton } from '../ui/GlossaryButton';
import { t } from '../i18n/i18n';

const TAB_NAMES = ['Cards', 'Relics', 'Tiles', 'Bosses'] as const;
type TabName = typeof TAB_NAMES[number];

const TAB_KEYS: Record<TabName, keyof CollectionStatus> = {
  Cards: 'cards',
  Relics: 'relics',
  Tiles: 'tiles',
  Bosses: 'bosses',
};

// Per-tab grid shape (per page). The spread shows 2× this.
const GRID_SHAPE: Record<TabName, { cols: number; rows: number }> = {
  Cards: { cols: 3, rows: 2 },
  Relics: { cols: 4, rows: 3 },
  Tiles: { cols: 4, rows: 3 },
  Bosses: { cols: 2, rows: 2 },
};

export class CollectionScene extends Phaser.Scene {
  private metaState!: MetaState;
  private collectionStatus!: CollectionStatus;
  private book: BookLayout | null = null;
  private transitioning = false;
  private detailPopup: Phaser.GameObjects.Container | null = null;
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
      return { key: name, label: t(`collection.tab${name}`), badge: `${status.unlocked} / ${status.total}` };
    });

    this.book = new BookLayout(this, {
      title: t('collection.title'),
      subtitle: t('collection.subtitleComplete', { percent }),
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
    if (this.detailPopup) this.detailPopup.destroy(true);
    this.detailPopup = null;
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

  private setTabContent(tab: TabName): void {
    if (!this.book) return;
    const status = this.collectionStatus[TAB_KEYS[tab]];
    const items = status.items;
    const shape = GRID_SHAPE[tab];
    const perPage = shape.cols * shape.rows;
    const perSpread = perPage * 2;
    const totalSpreads = Math.max(1, Math.ceil(items.length / perSpread));

    this.book.setContent(totalSpreads, (ctx) => this.renderSpread(tab, items, ctx));
  }

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
        this.renderUnlocked(tab, item, x, y, itemW, itemH, scale, container);
      } else {
        this.renderLocked(tab, item, x, y, itemW, itemH, scale, container);
      }
    });
  }

  private itemDimensions(tab: TabName): { itemW: number; itemH: number; scale: number } {
    switch (tab) {
      case 'Cards': {
        const scale = 0.5;
        return { itemW: STANDARD_CARD_WIDTH * scale, itemH: STANDARD_CARD_HEIGHT * scale, scale };
      }
      case 'Bosses':
        return { itemW: 130, itemH: 100, scale: 1 };
      case 'Relics':
      case 'Tiles':
      default:
        return { itemW: 60, itemH: 72, scale: 1 };
    }
  }

  private renderUnlocked(
    tab: TabName,
    item: CategoryStatus['items'][number],
    x: number, y: number, itemW: number, itemH: number, scale: number,
    container: Phaser.GameObjects.Container,
  ): void {
    const FF = FONTS.family;

    if (tab === 'Cards') {
      // CardVisual self-binds pointerdown -> showCardDetail (the shared
      // popup). We keep that as-is so card detail is uniform across the app.
      const visual = createCardVisual(this, x, y, item.id, { scale });
      container.add(visual);
      return;
    }

    if (tab === 'Relics' || tab === 'Tiles') {
      const prefix = tab === 'Relics' ? 'relic_' : 'tile_';
      const key = `${prefix}${item.id}`;
      let interactable: Phaser.GameObjects.GameObject;
      if (this.textures.exists(key)) {
        const img = this.add.image(x, y, key).setDisplaySize(itemW - 6, itemH - 6);
        container.add(img);
        interactable = img;
      } else {
        const fallback = this.add.rectangle(x, y, itemW - 6, itemH - 6, 0x3a2218);
        container.add(fallback);
        interactable = fallback;
      }
      const frame = this.add.rectangle(x, y, itemW, itemH).setStrokeStyle(2, 0xc89a3c);
      container.add(frame);
      const name = this.add.text(x, y + itemH / 2 + 3, item.name, {
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#3a2218',
        fontFamily: FF,
        align: 'center',
        wordWrap: { width: itemW + 6 },
      }).setOrigin(0.5, 0);
      container.add(name);
      (interactable as Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle)
        .setInteractive({ useHandCursor: true });
      interactable.on('pointerdown', () => this.showDetailPopup(item.id));
      return;
    }

    // Bosses — render the monster portrait if available, fallback to a
    // colored plaque if the texture didn't load.
    const monsterKey = `monster_${item.id}`;
    const portraitH = itemH - 24; // reserve bottom strip for the name plate
    let interactable: Phaser.GameObjects.GameObject;
    if (this.textures.exists(monsterKey)) {
      const portrait = this.add.image(x, y - 6, monsterKey)
        .setDisplaySize(itemW - 12, portraitH);
      container.add(portrait);
      interactable = portrait;
    } else {
      const fallback = this.add.rectangle(x, y - 6, itemW - 12, portraitH, 0x4a1a1a);
      container.add(fallback);
      interactable = fallback;
    }
    const frame = this.add.rectangle(x, y, itemW, itemH).setStrokeStyle(2, 0xc89a3c);
    container.add(frame);
    // Name plate at the bottom — dark band so the title stays legible over
    // whatever the portrait shows.
    const plate = this.add.rectangle(x, y + itemH / 2 - 10, itemW - 4, 18, 0x1a0a04, 0.85);
    container.add(plate);
    const name = this.add.text(x, y + itemH / 2 - 10, item.name, {
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#f5d273',
      fontFamily: FF,
      align: 'center',
      wordWrap: { width: itemW - 6 },
    }).setOrigin(0.5);
    container.add(name);
    (interactable as Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle)
      .setInteractive({ useHandCursor: true });
    interactable.on('pointerdown', () => this.showDetailPopup(item.id));
  }

  private renderLocked(
    tab: TabName,
    item: CategoryStatus['items'][number],
    x: number, y: number, itemW: number, itemH: number, scale: number,
    container: Phaser.GameObjects.Container,
  ): void {
    const FF = FONTS.family;

    if (tab === 'Cards') {
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
          fontSize: '9px', color: '#6e4a1a', fontFamily: FF,
          wordWrap: { width: itemW + 6 }, align: 'center',
        }).setOrigin(0.5, 0);
        container.add(hint);
      }
      return;
    }

    // Relic / Tile / Boss locked rendering
    const bg = this.add.rectangle(x, y, itemW, itemH, 0x2a1a10).setStrokeStyle(1.5, 0x6e4a1a);
    container.add(bg);
    const label = this.add.text(x, y - 4, t('collection.lockedPlaceholder'), {
      fontSize: tab === 'Bosses' ? '24px' : '14px',
      fontStyle: 'bold',
      color: '#9d7e44',
      fontFamily: FF,
    }).setOrigin(0.5);
    container.add(label);
    if (item.unlockHint) {
      const hint = this.add.text(x, y + itemH / 2 - 12, item.unlockHint, {
        fontSize: '8px', color: '#6e4a1a', fontFamily: FF,
        wordWrap: { width: itemW - 6 }, align: 'center',
      }).setOrigin(0.5);
      container.add(hint);
    }
  }

  // ── Detail popup ──────────────────────────────────────────

  private showDetailPopup(itemId: string): void {
    this.closeDetailPopup();

    const details = getItemDetails(itemId, this.metaState);
    if (!details) return;

    const FF = FONTS.family;
    const container = this.add.container(400, 300).setDepth(500);

    const overlay = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.6).setInteractive();
    overlay.on('pointerdown', () => this.closeDetailPopup());
    container.add(overlay);

    const panelW = 360;
    const panelH = 300;
    const panel = this.add.rectangle(0, 0, panelW, panelH, 0x1a0e08, 0.96)
      .setStrokeStyle(2, 0xc89a3c);
    container.add(panel);
    // Inner gold frame
    const inner = this.add.rectangle(0, 0, panelW - 16, panelH - 16)
      .setStrokeStyle(1, 0xf5d273);
    container.add(inner);

    container.add(this.add.text(0, -panelH / 2 + 24, details.name, {
      fontSize: '22px', fontStyle: 'bold', color: COLORS.accent, fontFamily: FF,
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));

    let yOff = -panelH / 2 + 60;
    const data = details.data;

    if (data.description) {
      container.add(this.add.text(0, yOff, data.description, {
        fontSize: '14px', color: COLORS.textPrimary, fontFamily: FF,
        wordWrap: { width: panelW - 32 }, align: 'center', lineSpacing: 3,
      }).setOrigin(0.5, 0));
      yOff += 60;
    }

    if (data.category) {
      const stats: string[] = [];
      stats.push(t('collection.statCategory', { category: data.category }));
      stats.push(t('collection.statCooldown', { cooldown: data.cooldown ?? 0 }));
      if (data.cost?.stamina) stats.push(t('collection.statStamina', { stamina: data.cost.stamina }));
      if (data.cost?.mana) stats.push(t('collection.statMana', { mana: data.cost.mana }));
      if (data.targeting) stats.push(t('collection.statTarget', { targeting: data.targeting }));
      container.add(this.add.text(0, yOff, stats.join('  •  '), {
        fontSize: '12px', color: COLORS.textSecondary, fontFamily: FF,
        wordWrap: { width: panelW - 32 }, align: 'center',
      }).setOrigin(0.5, 0));
      yOff += 40;
    }

    if (data.effect) {
      container.add(this.add.text(0, yOff, t('collection.statEffect', { effect: data.effect }), {
        fontSize: '13px', color: '#00ccff', fontFamily: FF,
        wordWrap: { width: panelW - 32 }, align: 'center',
      }).setOrigin(0.5, 0));
      yOff += 40;
    }

    container.add(this.add.text(0, panelH / 2 - 24, t('collection.clickToClose'), {
      fontSize: '11px', color: COLORS.textSecondary, fontFamily: FF, fontStyle: 'italic',
    }).setOrigin(0.5));

    container.setScale(0.85);
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 200, ease: 'Back.easeOut',
    });

    this.detailPopup = container;
  }

  private closeDetailPopup(): void {
    if (!this.detailPopup) return;
    const popup = this.detailPopup;
    this.detailPopup = null;
    this.tweens.add({
      targets: popup,
      alpha: 0, scaleX: 0.9, scaleY: 0.9,
      duration: 150,
      onComplete: () => popup.destroy(true),
    });
  }
}
