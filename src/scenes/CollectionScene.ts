import { Scene } from 'phaser';
import { loadMetaState } from '../systems/MetaPersistence';
import { getCollectionStatus, getCompletionPercent, getItemDetails, type CollectionStatus, type CategoryStatus } from '../systems/CollectionRegistry';
import { MetaState } from '../state/MetaState';
import { COLORS, FONTS, LAYOUT } from '../ui/StyleConstants';

const TAB_NAMES = ['Cards', 'Relics', 'Tiles', 'Events', 'Bosses'] as const;
type TabName = typeof TAB_NAMES[number];

const TAB_KEYS: Record<TabName, keyof CollectionStatus> = {
  Cards: 'cards',
  Relics: 'relics',
  Tiles: 'tiles',
  Events: 'events',
  Bosses: 'bosses',
};

const TAB_COLORS: Record<TabName, number> = {
  Cards: 0xcc3333,
  Relics: 0x9370db,
  Tiles: 0x228B22,
  Events: 0xff8c00,
  Bosses: 0x6a5acd,
};

export class CollectionScene extends Scene {
  private metaState!: MetaState;
  private collectionStatus!: CollectionStatus;
  private activeTab: TabName = 'Cards';
  private gridContainer!: Phaser.GameObjects.Container;
  private tabObjects: Phaser.GameObjects.Rectangle[] = [];
  private tabTexts: Phaser.GameObjects.Text[] = [];
  private transitioning = false;
  private detailPopup: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('CollectionScene');
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
    this.cameras.main.setBackgroundColor(COLORS.background);

    // Title and completion on same line, properly spaced
    this.add.text(400, 24, 'Collection', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: COLORS.textPrimary,
      fontFamily,
    }).setOrigin(0.5, 0);

    // Completion percentage (below title, centered)
    this.add.text(400, 52, `${percent}% Complete`, {
      fontSize: '14px',
      color: COLORS.accent,
      fontFamily,
    }).setOrigin(0.5, 0);

    // Close button
    const closeBtn = this.add.text(776, 24, 'X', {
      fontSize: '16px',
      color: COLORS.textSecondary,
      fontFamily,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => {
      this.fadeToScene('CityHub');
    });

    // Tab bar
    this.tabObjects = [];
    this.tabTexts = [];
    let tabX = 40;
    for (let i = 0; i < TAB_NAMES.length; i++) {
      const tabName = TAB_NAMES[i];
      const tabKey = TAB_KEYS[tabName];
      const status = this.collectionStatus[tabKey];
      const isActive = tabName === this.activeTab;
      const color = isActive ? TAB_COLORS[tabName] : 0x333333;

      const rect = this.add.rectangle(tabX + 60, 56, 120, 32, color);
      rect.setInteractive({ useHandCursor: true });
      this.tabObjects.push(rect);

      const label = `${tabName} (${status.unlocked}/${status.total})`;
      const text = this.add.text(tabX + 60, 56, label, {
        fontSize: '14px',
        color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
        fontFamily,
      }).setOrigin(0.5);
      this.tabTexts.push(text);

      rect.on('pointerdown', () => {
        this.activeTab = tabName;
        this.updateTabs();
        this.renderGrid();
      });

      tabX += 124; // 120 + 4px gap
    }

    // Grid container with scroll support (feedback #6)
    this.gridContainer = this.add.container(0, 0);

    // Scroll mask
    const maskGfx = this.make.graphics({ x: 0, y: 0 });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(0, 80, 800, 500);
    this.gridContainer.setMask(maskGfx.createGeometryMask());

    // Mouse wheel scroll for grid
    let scrollY = 0;
    this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
      const maxScroll = Math.max(0, this.getGridHeight() - 480);
      scrollY = Math.max(0, Math.min(maxScroll, scrollY + dy * 0.5));
      this.gridContainer.y = -scrollY;
    });

    this.renderGrid();
  }

  /** Estimate total grid height based on active tab */
  private getGridHeight(): number {
    const tabKey = TAB_KEYS[this.activeTab];
    const status = this.collectionStatus[tabKey];
    const itemCount = status.items.length;
    switch (this.activeTab) {
      case 'Cards': return Math.ceil(itemCount / 6) * 104;
      case 'Relics': return Math.ceil(itemCount / 4) * 96;
      case 'Tiles': return Math.ceil(itemCount / 5) * 96;
      case 'Events': return itemCount * 68;
      case 'Bosses': return 300;
      default: return 600;
    }
  }

  private updateTabs(): void {
    for (let i = 0; i < TAB_NAMES.length; i++) {
      const tabName = TAB_NAMES[i];
      const isActive = tabName === this.activeTab;
      const color = isActive ? TAB_COLORS[tabName] : 0x333333;
      this.tabObjects[i].setFillStyle(color);
      this.tabTexts[i].setColor(isActive ? COLORS.textPrimary : COLORS.textSecondary);
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
      case 'Events':
        this.renderEventsList(status);
        break;
      case 'Bosses':
        this.renderBossesRow(status);
        break;
    }
  }

  private renderCardsGrid(status: CategoryStatus): void {
    const fontFamily = FONTS.family;
    const cols = 6;
    const itemW = 72;
    const itemH = 96;
    const gap = 8;
    const startX = 80;
    const startY = 100;

    status.items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (itemW + gap) + itemW / 2;
      const y = startY + row * (itemH + gap) + itemH / 2;

      if (item.isUnlocked) {
        const card = this.add.rectangle(x, y, itemW, itemH, 0xcc3333, 0.8);
        card.setStrokeStyle(2, 0xcccccc);
        card.setInteractive({ useHandCursor: true });
        this.gridContainer.add(card);

        const name = this.add.text(x, y + 10, item.name, {
          fontSize: '12px',
          color: COLORS.textPrimary,
          fontFamily,
          wordWrap: { width: itemW - 8 },
          align: 'center',
        }).setOrigin(0.5);
        this.gridContainer.add(name);

        // Click for details (feedback #7)
        card.on('pointerdown', () => this.showDetailPopup(item.id));
      } else {
        const card = this.add.rectangle(x, y, itemW, itemH, 0x444444);
        this.gridContainer.add(card);

        const locked = this.add.text(x, y - 10, '???', {
          fontSize: '16px',
          color: COLORS.textSecondary,
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(locked);

        if (item.unlockHint) {
          const hint = this.add.text(x, y + 20, item.unlockHint, {
            fontSize: '10px',
            color: COLORS.textSecondary,
            fontFamily,
            wordWrap: { width: itemW - 4 },
            align: 'center',
          }).setOrigin(0.5);
          this.gridContainer.add(hint);
        }
      }
    });
  }

  private renderRelicsGrid(status: CategoryStatus): void {
    const fontFamily = FONTS.family;
    const cols = 4;
    const itemSize = 80;
    const gap = 16;
    const startX = 140;
    const startY = 100;

    status.items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (itemSize + gap) + itemSize / 2;
      const y = startY + row * (itemSize + gap) + itemSize / 2;

      if (item.isUnlocked) {
        const relic = this.add.rectangle(x, y, itemSize, itemSize, COLORS.panel);
        relic.setStrokeStyle(2, 0x9370db);
        relic.setInteractive({ useHandCursor: true });
        this.gridContainer.add(relic);

        const name = this.add.text(x, y, item.name, {
          fontSize: '14px',
          color: COLORS.textPrimary,
          fontFamily,
          wordWrap: { width: itemSize - 8 },
          align: 'center',
        }).setOrigin(0.5);
        this.gridContainer.add(name);

        // Click for details (feedback #7)
        relic.on('pointerdown', () => this.showDetailPopup(item.id));
      } else {
        const relic = this.add.rectangle(x, y, itemSize, itemSize, 0x444444);
        this.gridContainer.add(relic);

        const locked = this.add.text(x, y - 10, '???', {
          fontSize: '16px',
          color: COLORS.textSecondary,
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(locked);

        if (item.unlockHint) {
          const hint = this.add.text(x, y + 16, item.unlockHint, {
            fontSize: '10px',
            color: COLORS.textSecondary,
            fontFamily,
            wordWrap: { width: itemSize - 4 },
            align: 'center',
          }).setOrigin(0.5);
          this.gridContainer.add(hint);
        }
      }
    });
  }

  private renderTilesGrid(status: CategoryStatus): void {
    const fontFamily = FONTS.family;
    const cols = 5;
    const itemSize = 80;
    const gap = 16;
    const startX = 100;
    const startY = 100;

    status.items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (itemSize + gap) + itemSize / 2;
      const y = startY + row * (itemSize + gap) + itemSize / 2;

      if (item.isUnlocked) {
        const tile = this.add.rectangle(x, y, itemSize, itemSize, 0x228B22, 0.8);
        tile.setStrokeStyle(1, 0x33cc33);
        this.gridContainer.add(tile);

        const name = this.add.text(x, y, item.name, {
          fontSize: '12px',
          color: COLORS.textPrimary,
          fontFamily,
          wordWrap: { width: itemSize - 8 },
          align: 'center',
        }).setOrigin(0.5);
        this.gridContainer.add(name);
      } else {
        const tile = this.add.rectangle(x, y, itemSize, itemSize, 0x444444);
        this.gridContainer.add(tile);

        const locked = this.add.text(x, y - 10, '???', {
          fontSize: '16px',
          color: COLORS.textSecondary,
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(locked);

        if (item.unlockHint) {
          const hint = this.add.text(x, y + 16, item.unlockHint, {
            fontSize: '10px',
            color: COLORS.textSecondary,
            fontFamily,
            wordWrap: { width: itemSize - 4 },
            align: 'center',
          }).setOrigin(0.5);
          this.gridContainer.add(hint);
        }
      }
    });
  }

  private renderEventsList(status: CategoryStatus): void {
    const fontFamily = FONTS.family;
    const startY = 100;

    status.items.forEach((item, index) => {
      const y = startY + index * 68;

      const bg = this.add.rectangle(400, y + 30, 700, 60, 0x333333, 0.8);
      this.gridContainer.add(bg);

      if (item.isUnlocked) {
        const title = this.add.text(80, y + 18, item.name, {
          fontSize: '16px',
          color: COLORS.textPrimary,
          fontFamily,
        });
        this.gridContainer.add(title);

        const desc = this.add.text(80, y + 38, 'Random event encounter', {
          fontSize: '14px',
          color: COLORS.textSecondary,
          fontFamily,
        });
        this.gridContainer.add(desc);
      } else {
        const locked = this.add.text(80, y + 18, '???', {
          fontSize: '16px',
          color: COLORS.textSecondary,
          fontFamily,
        });
        this.gridContainer.add(locked);

        const hint = this.add.text(80, y + 38, 'Discover during a run', {
          fontSize: '14px',
          color: COLORS.textSecondary,
          fontFamily,
        });
        this.gridContainer.add(hint);
      }
    });
  }

  private renderBossesRow(status: CategoryStatus): void {
    const fontFamily = FONTS.family;
    const itemW = 160;
    const itemH = 120;
    const gap = 16;
    const totalWidth = status.items.length * itemW + (status.items.length - 1) * gap;
    const startX = (800 - totalWidth) / 2;

    status.items.forEach((item, index) => {
      const x = startX + index * (itemW + gap) + itemW / 2;
      const y = 200;

      if (item.isUnlocked) {
        const bg = this.add.rectangle(x, y, itemW, itemH, 0x333333, 0.8);
        bg.setStrokeStyle(1, 0x6a5acd);
        this.gridContainer.add(bg);

        const name = this.add.text(x, y - 20, item.name, {
          fontSize: '20px',
          fontStyle: 'bold',
          color: COLORS.textPrimary,
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(name);

        const type = this.add.text(x, y + 10, 'Boss', {
          fontSize: '14px',
          color: COLORS.textSecondary,
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(type);
      } else {
        const bg = this.add.rectangle(x, y, itemW, itemH, 0x444444);
        this.gridContainer.add(bg);

        const locked = this.add.text(x, y, '???', {
          fontSize: '24px',
          color: COLORS.textSecondary,
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
