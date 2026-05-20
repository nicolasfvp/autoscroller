import { Scene } from 'phaser';
import { loadMetaState } from '../systems/MetaPersistence';
import { getCollectionStatus, getCompletionPercent, getItemDetails, type CollectionStatus, type CategoryStatus } from '../systems/CollectionRegistry';
import { MetaState } from '../state/MetaState';
import { COLORS, FONTS, LAYOUT } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';
import { CardFilterBar } from '../ui/CardFilterBar';
import { applyFilters, type CardFilters } from '../ui/CardFilterBar.pure';
import { getAllCards } from '../data/DataLoader';
import { createCardVisual, STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';

const TAB_NAMES = ['Cards', 'Relics', 'Tiles', 'Bosses'] as const;
type TabName = typeof TAB_NAMES[number];

const TAB_KEYS: Record<TabName, keyof CollectionStatus> = {
  Cards: 'cards',
  Relics: 'relics',
  Tiles: 'tiles',
  Bosses: 'bosses',
};

export class CollectionScene extends Scene {
  private metaState!: MetaState;
  private collectionStatus!: CollectionStatus;
  private activeTab: TabName = 'Cards';
  private gridContainer!: Phaser.GameObjects.Container;
  private tabObjects: Phaser.GameObjects.Image[] = [];
  private tabTexts: Phaser.GameObjects.Text[] = [];
  private transitioning = false;
  private detailPopup: Phaser.GameObjects.Container | null = null;
  private scrollY = 0;
  private wheelHandler: ((p: unknown, go: unknown, dx: number, dy: number) => void) | null = null;
  // Graphics objects used to back GeometryMasks. `this.make.graphics` creates
  // GameObjects that are NOT added to the display list and therefore NOT
  // auto-destroyed when the scene shuts down — we have to destroy them
  // ourselves to avoid leaking textures/buffers on re-entry.
  private panelMaskGfx: Phaser.GameObjects.Graphics | null = null;
  private scrollMaskGfx: Phaser.GameObjects.Graphics | null = null;
  // Card filter bar (only active on the Cards tab). Re-rendering the grid
  // filters items by the current CardFilters; locked cards still render
  // locked but are subject to the same element/tier/search gates.
  private cardFilterBar: CardFilterBar | null = null;
  private cardFilters: CardFilters = {
    element: 'All',
    tiers: new Set<1 | 2 | 3>([1, 2, 3]),
    search: '',
  };

  constructor() {
    super(SCENE_KEYS.COLLECTION);
  }

  private fadeToScene(sceneKey: string, data?: any): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });
  }

  async create(): Promise<void> {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    this.metaState = await loadMetaState();
    this.collectionStatus = getCollectionStatus(this.metaState);
    const percent = getCompletionPercent(this.metaState);
    this.activeTab = 'Cards';

    const fontFamily = FONTS.family;

    // Background
    this.add.image(400, 300, 'bg_character_selection').setDisplaySize(800, 600);

    // Main Wood Panel
    const panel = this.add.image(400, 300, 'wood_texture_big').setDisplaySize(760, 560);
    const shape = this.make.graphics();
    shape.fillStyle(0xffffff);
    shape.fillRoundedRect(20, 20, 760, 560, 16);
    panel.setMask(shape.createGeometryMask());
    this.panelMaskGfx = shape;

    // Title (Top Center Headline Image)
    this.add.image(400, 55, 'collection_headline').setOrigin(0.5);

    // Completion percentage (Top right corner of panel)
    this.add.text(40, 55, `${percent}% Complete`, {
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#dab988',
      stroke: '#000000',
      strokeThickness: 3,
      fontFamily,
    }).setOrigin(0, 0.5);

    // Nice Red Close Button
    const closeBtnBg = this.add.circle(750, 55, 16, 0xcc0000).setStrokeStyle(2, 0x3e2723).setInteractive({ useHandCursor: true });
    this.add.text(750, 55, 'X', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      fontFamily,
    }).setOrigin(0.5);

    closeBtnBg.on('pointerover', () => closeBtnBg.setFillStyle(0xff3333));
    closeBtnBg.on('pointerout', () => closeBtnBg.setFillStyle(0xcc0000));
    closeBtnBg.on('pointerdown', () => this.fadeToScene(SCENE_KEYS.CITY_HUB));

    // Tab bar
    this.tabObjects = [];
    this.tabTexts = [];

    // Total width available is ~750. We have 5 tabs.
    const tabW = 148;
    const tabH = 50;
    const tabY = 110;
    const tabGap = -2; // Negative gap to compensate for PNG transparent padding
    const startTabX = 400 - ((TAB_NAMES.length * tabW) + ((TAB_NAMES.length - 1) * tabGap)) / 2;

    for (let i = 0; i < TAB_NAMES.length; i++) {
      const tabName = TAB_NAMES[i];
      const tabKey = TAB_KEYS[tabName];
      const status = this.collectionStatus[tabKey];
      const isActive = tabName === this.activeTab;
      
      const img = this.add.image(startTabX + i * (tabW + tabGap) + tabW/2, tabY, 'wood_board_collection').setDisplaySize(tabW, tabH);
      img.setInteractive({ useHandCursor: true });
      if (isActive) {
        img.setTint(0xff9999);
      }
      this.tabObjects.push(img);

      const label = `${tabName} (${status.unlocked}/${status.total})`;
      const text = this.add.text(startTabX + i * (tabW + tabGap) + tabW/2, tabY, label, {
        fontSize: '18px',
        fontStyle: 'bold',
        color: isActive ? '#ffffff' : '#e6c88a',
        stroke: '#2e1b0f',
        strokeThickness: 2,
        shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true },
        fontFamily,
      }).setOrigin(0.5);
      this.tabTexts.push(text);

      img.on('pointerdown', () => {
        this.activeTab = tabName;
        this.scrollY = 0;
        this.gridContainer.y = 0;
        this.updateTabs();
        // The filter bar is built for the Cards tab; it remains mounted on
        // all tabs (destroying/recreating would leak DOM listeners) but only
        // re-renders the grid when Cards is active. Filters are ignored for
        // Relics/Tiles/Bosses items.
        this.renderGrid();
      });
    }

    // Card filter bar — only meaningful on the Cards tab. Hidden when other
    // tabs are active. Sits between the tab row (y=110) and the grid panel.
    this.cardFilterBar = new CardFilterBar(this, 40, 138, 720, (filters) => {
      this.cardFilters = filters;
      if (this.activeTab === 'Cards') {
        // Reset scroll so the user lands at the top of the filtered set.
        this.scrollY = 0;
        this.gridContainer.y = 0;
        this.renderGrid();
      }
    });

    // Inner dark background for the grid area (simulating the indented board).
    // Shifted down ~20px to make room for the filter bar above.
    this.add.rectangle(400, 380, 720, 400, 0x1a0f0a, 0.8).setStrokeStyle(2, 0x3e2723);

    // Grid container with scroll support
    this.gridContainer = this.add.container(0, 0);

    // Scroll mask — top edge shifted to clear the filter bar.
    const maskGfx = this.make.graphics({ x: 0, y: 0 });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(40, 185, 720, 395);
    this.gridContainer.setMask(maskGfx.createGeometryMask());
    this.scrollMaskGfx = maskGfx;

    // Mouse wheel scroll for grid — track scrollY on the scene so the
    // grid offset persists across tab switches; remove the old handler
    // on shutdown so relaunching the scene doesn't stack listeners.
    this.scrollY = 0;
    if (this.wheelHandler) this.input.off('wheel', this.wheelHandler);
    this.wheelHandler = (_p, _go, _dx, dy) => {
      const maxScroll = Math.max(0, this.getGridHeight() - 430);
      this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY + dy * 0.5));
      this.gridContainer.y = -this.scrollY;
    };
    this.input.on('wheel', this.wheelHandler);

    this.events.once('shutdown', () => {
      if (this.wheelHandler) {
        this.input.off('wheel', this.wheelHandler);
        this.wheelHandler = null;
      }
      // Off-display-list Graphics created via this.make.graphics() must be
      // destroyed manually — Phaser only auto-destroys GameObjects that are
      // in the scene's display list.
      if (this.panelMaskGfx) {
        this.panelMaskGfx.destroy();
        this.panelMaskGfx = null;
      }
      if (this.scrollMaskGfx) {
        this.scrollMaskGfx.destroy();
        this.scrollMaskGfx = null;
      }
      // CardFilterBar appends a native <input> to document.body and binds
      // window listeners — its destroy() unwinds both. Skipping this leaks
      // an orphaned input each time the scene relaunches.
      if (this.cardFilterBar) {
        this.cardFilterBar.destroy();
        this.cardFilterBar = null;
      }
    });

    this.renderGrid();
  }

  /** Estimate total grid height based on active tab */
  private getGridHeight(): number {
    const tabKey = TAB_KEYS[this.activeTab];
    const status = this.collectionStatus[tabKey];
    // On the Cards tab the visible row count depends on the current filter,
    // so use the filtered length to compute scroll extents.
    const itemCount = this.activeTab === 'Cards'
      ? this.filterCardItems(status.items).length
      : status.items.length;
    switch (this.activeTab) {
      case 'Cards': return Math.ceil(itemCount / 5) * 200 + 80;
      case 'Relics': return Math.ceil(itemCount / 6) * 160 + 80;
      case 'Tiles': return Math.ceil(itemCount / 6) * 160 + 80;
      case 'Bosses': return 350;
      default: return 600;
    }
  }

  private updateTabs(): void {
    for (let i = 0; i < TAB_NAMES.length; i++) {
      const tabName = TAB_NAMES[i];
      const isActive = tabName === this.activeTab;
      
      const img = this.tabObjects[i];
      if (isActive) {
        img.setTint(0xff9999);
      } else {
        img.clearTint();
      }
      this.tabTexts[i].setColor(isActive ? '#ffffff' : '#fdf6e3');
    }
  }

  private renderGrid(): void {
    this.gridContainer.removeAll(true);

    const tabKey = TAB_KEYS[this.activeTab];
    const status = this.collectionStatus[tabKey];

    switch (this.activeTab) {
      case 'Cards':
        this.renderCardsGrid(status);
        break;
      case 'Relics':
        this.renderRelicsGrid(status);
        break;
      case 'Tiles':
        this.renderTilesGrid(status);
        break;
      case 'Bosses':
        this.renderBossesRow(status);
        break;
    }
  }

  private renderCardsGrid(status: CategoryStatus): void {
    const fontFamily = FONTS.family;
    const isCardsTab = this.activeTab === 'Cards';
    // Cards tab uses the shared CardVisual at scale 0.55 → 83×132 footprint;
    // 5 columns fit the 720-wide panel comfortably with breathing room.
    const cardScale = 0.55;
    const cardW = STANDARD_CARD_WIDTH * cardScale;   // 82.5
    const cardH = STANDARD_CARD_HEIGHT * cardScale;  // 132
    const cols = isCardsTab ? 5 : 6;
    const itemW = isCardsTab ? cardW : 90;
    const itemH = isCardsTab ? cardH : 100;
    const gapX = isCardsTab ? 24 : 12;
    const gapY = isCardsTab ? 40 : 60;

    const totalWidth = cols * itemW + (cols - 1) * gapX;
    const startX = 400 - (totalWidth / 2) + (itemW / 2);
    // Shifted down 40px from 220 to clear the inline CardFilterBar above.
    // For the cards grid the taller vertical card needs ~half the card height
    // of headroom below the filter bar (centered y); start a bit higher.
    const startY = isCardsTab ? 250 : 260;
    // Apply card filters on the Cards tab. We map status items → CardDefinition
    // by id, then run them through `applyFilters`, and finally keep only the
    // status items whose ids survived the filter. Items whose ids don't appear
    // in `getAllCards()` (legacy / placeholder rows) are kept under "All".
    const items = isCardsTab
      ? this.filterCardItems(status.items)
      : status.items;
    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (itemW + gapX);
      const y = startY + row * (itemH + gapY);

      if (item.isUnlocked) {
        const isCard = isCardsTab;
        let interactableObj;

        if (isCard) {
          // Unified card visual — CardVisual already binds pointerdown to
          // showCardDetail, but the Collection wants its own popup, so we
          // attach an override handler with priority over its built-in one.
          const visual = createCardVisual(this, x, y, item.id, { scale: cardScale });
          this.gridContainer.add(visual);
          interactableObj = visual;
        } else if (this.activeTab === 'Relics' || this.activeTab === 'Tiles') {
          // Render Relic or Tile Asset
          const assetPrefix = this.activeTab === 'Relics' ? 'relic_' : 'tile_';
          const imgKey = `${assetPrefix}${item.id}`;
          
          const img = this.add.image(x, y, imgKey);
          if (this.textures.exists(imgKey)) {
            img.setDisplaySize(itemW - 10, itemH - 10);
          } else {
            // Fallback for missing tile textures
            img.setVisible(false);
            const fallback = this.add.rectangle(x, y, itemW - 10, itemH - 10, 0x333333);
            this.gridContainer.add(fallback);
          }
          
          img.setInteractive({ useHandCursor: true });
          this.gridContainer.add(img);
          interactableObj = img;

          // Frame
          const frameColor = this.activeTab === 'Relics' ? 0xcc0000 : 0x00aa00;
          const frame = this.add.rectangle(x, y, itemW, itemH).setStrokeStyle(3, frameColor);
          this.gridContainer.add(frame);

          // Name below
          const textY = y + (itemH / 2) + 6;
          const name = this.add.text(x, textY, item.name, {
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#e6c88a',
            stroke: '#2e1b0f',
            strokeThickness: 2,
            shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true },
            fontFamily,
            align: 'center',
            wordWrap: { width: itemW + gapX }
          }).setOrigin(0.5, 0);
          this.gridContainer.add(name);
        } else {
          // Plain Red Box for Tiles
          const card = this.add.rectangle(x, y, itemW, itemH, 0xcc0000).setStrokeStyle(3, 0x3e2723);
          card.setInteractive({ useHandCursor: true });
          this.gridContainer.add(card);
          interactableObj = card;

          const name = this.add.text(x, y, item.name, {
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#e6c88a',
            stroke: '#2e1b0f',
            strokeThickness: 2,
            shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true },
            fontFamily,
            wordWrap: { width: itemW - 10 },
            align: 'center',
          }).setOrigin(0.5);
          this.gridContainer.add(name);
        }

        // Cards: CardVisual self-binds to showCardDetail (the shared popup);
        // we keep that as the click handler so card detail is uniform across
        // the app. Relics / Tiles / Bosses still use the Collection's custom
        // detail popup since CardVisual doesn't apply to them.
        if (!isCard) {
          interactableObj.on('pointerdown', () => this.showDetailPopup(item.id));
        }
      } else {
        // Locked rendering — for the Cards tab show a dimmed CardVisual + lock
        // icon (same pattern as CardLibraryScene). Other tabs keep the prior
        // "???" placeholder since there's no full-card visual for them.
        if (isCardsTab) {
          const visual = createCardVisual(this, x, y, item.id, { scale: cardScale });
          visual.setAlpha(0.4);
          visual.disableInteractive();
          this.gridContainer.add(visual);
          const lock = this.add.text(x, y, '🔒', {
            fontSize: '24px', fontFamily, color: '#ffffff',
          }).setOrigin(0.5);
          this.gridContainer.add(lock);
          if (item.unlockHint) {
            const hint = this.add.text(x, y + itemH / 2 + 4, item.unlockHint, {
              fontSize: '10px', color: '#888888',
              fontFamily: 'Arial, sans-serif',
              wordWrap: { width: itemW + gapX }, align: 'center',
            }).setOrigin(0.5, 0);
            this.gridContainer.add(hint);
          }
        } else {
          const card = this.add.rectangle(x, y, itemW, itemH, 0x2a1a10).setStrokeStyle(2, 0x111111);
          this.gridContainer.add(card);

          const locked = this.add.text(x, y - 15, '???', {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#aaaaaa',
            fontFamily,
          }).setOrigin(0.5);
          this.gridContainer.add(locked);

          if (item.unlockHint) {
            const hint = this.add.text(x, y + 20, item.unlockHint, {
              fontSize: '10px',
              color: '#888888',
              fontFamily: 'Arial, sans-serif',
              wordWrap: { width: itemW - 4 },
              align: 'center',
            }).setOrigin(0.5);
            this.gridContainer.add(hint);
          }
        }
      }
    });
  }

  /**
   * Intersect collection items with cards passing the current CardFilters.
   * The collection lists every card (locked and unlocked); filtering applies
   * uniformly so locked cards still render in their locked style — but only
   * the locked cards matching the filter survive. Items whose ids do not
   * resolve to a known card are kept under the default "All" / all-tiers /
   * empty-search filter so the collection remains accurate for content that
   * isn't covered by the cards database.
   */
  private filterCardItems<T extends { id: string }>(items: T[]): T[] {
    const f = this.cardFilters;
    const isDefault =
      f.element === 'All' && f.tiers.size === 3 && (!f.search || !f.search.trim());
    if (isDefault) return items;
    const allCards = getAllCards();
    const byId = new Map(allCards.map((c) => [c.id, c]));
    const allowedIds = new Set(applyFilters(allCards, f).map((c) => c.id));
    return items.filter((item) => {
      const card = byId.get(item.id);
      // Unknown ids (legacy / non-card entries) fall through filtering rather
      // than disappearing entirely.
      if (!card) return true;
      return allowedIds.has(item.id);
    });
  }

  private renderRelicsGrid(status: CategoryStatus): void {
    // Reusing the same beautiful grid layout for consistency
    this.renderCardsGrid(status);
  }

  private renderTilesGrid(status: CategoryStatus): void {
    this.renderCardsGrid(status);
  }

  private renderBossesRow(status: CategoryStatus): void {
    const fontFamily = FONTS.family;
    const itemW = 160;
    const itemH = 120;
    const gap = 16;
    const totalWidth = status.items.length * itemW + (status.items.length - 1) * gap;
    const startX = 400 - (totalWidth / 2) + (itemW / 2);

    status.items.forEach((item, index) => {
      const x = startX + index * (itemW + gap);
      const y = 250;

      if (item.isUnlocked) {
        const bg = this.add.rectangle(x, y, itemW, itemH, 0xcc0000).setStrokeStyle(3, 0x3e2723);
        this.gridContainer.add(bg);

        const name = this.add.text(x, y - 20, item.name, {
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#e6c88a',
          stroke: '#2e1b0f',
          strokeThickness: 3,
          shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true },
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(name);

        const type = this.add.text(x, y + 20, 'Boss', {
          fontSize: '16px',
          color: '#dab988',
          fontFamily: 'Arial, sans-serif',
        }).setOrigin(0.5);
        this.gridContainer.add(type);
      } else {
        const bg = this.add.rectangle(x, y, itemW, itemH, 0x2a1a10).setStrokeStyle(2, 0x111111);
        this.gridContainer.add(bg);

        const locked = this.add.text(x, y, '???', {
          fontSize: '32px',
          fontStyle: 'bold',
          color: '#aaaaaa',
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(locked);
      }
    });
  }

  // ── Detail popup (feedback #7) ──

  private showDetailPopup(itemId: string): void {
    this.closeDetailPopup();

    const details = getItemDetails(itemId, this.metaState);
    if (!details) return;

    const fontFamily = FONTS.family;
    const container = this.add.container(400, 300).setDepth(500);

    // Dark overlay (click to close)
    const overlay = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.6)
      .setInteractive();
    overlay.on('pointerdown', () => this.closeDetailPopup());
    container.add(overlay);

    // Panel
    const panelW = 360;
    const panelH = 280;
    const panel = this.add.rectangle(0, 0, panelW, panelH, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xffd700);
    container.add(panel);

    // Title
    container.add(this.add.text(0, -panelH / 2 + 24, details.name, {
      fontSize: '22px', fontStyle: 'bold', color: COLORS.accent, fontFamily,
    }).setOrigin(0.5));

    // Description / stats
    let yOff = -panelH / 2 + 60;
    const data = details.data;

    if (data.description) {
      container.add(this.add.text(0, yOff, data.description, {
        fontSize: '14px', color: COLORS.textPrimary, fontFamily,
        wordWrap: { width: panelW - 32 }, align: 'center', lineSpacing: 3,
      }).setOrigin(0.5, 0));
      yOff += 60;
    }

    // Card-specific stats
    if (data.category) {
      const stats: string[] = [];
      stats.push(`Category: ${data.category}`);
      stats.push(`Rarity: ${data.rarity ?? 'common'}`);
      stats.push(`Cooldown: ${data.cooldown ?? 0}s`);
      if (data.cost?.stamina) stats.push(`Stamina: ${data.cost.stamina}`);
      if (data.cost?.mana) stats.push(`Mana: ${data.cost.mana}`);
      if (data.targeting) stats.push(`Target: ${data.targeting}`);

      container.add(this.add.text(0, yOff, stats.join('  \u2022  '), {
        fontSize: '12px', color: COLORS.textSecondary, fontFamily,
        wordWrap: { width: panelW - 32 }, align: 'center',
      }).setOrigin(0.5, 0));
      yOff += 40;
    }

    // Relic-specific effect
    if (data.effect) {
      container.add(this.add.text(0, yOff, `Effect: ${data.effect}`, {
        fontSize: '13px', color: '#00ccff', fontFamily,
        wordWrap: { width: panelW - 32 }, align: 'center',
      }).setOrigin(0.5, 0));
      yOff += 40;
    }

    // Close hint
    container.add(this.add.text(0, panelH / 2 - 24, 'Click anywhere to close', {
      fontSize: '11px', color: COLORS.textSecondary, fontFamily,
    }).setOrigin(0.5));

    // Scale-in animation
    container.setScale(0.8);
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
