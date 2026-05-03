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
    this.add.image(400, 300, 'bg_character_selection').setDisplaySize(800, 600);

    // Main Wood Panel
    const panel = this.add.image(400, 300, 'wood_texture_big').setDisplaySize(760, 560);
    const shape = this.make.graphics();
    shape.fillStyle(0xffffff);
    shape.fillRoundedRect(20, 20, 760, 560, 16);
    panel.setMask(shape.createGeometryMask());

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
    const closeBtnTxt = this.add.text(750, 55, 'X', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      fontFamily,
    }).setOrigin(0.5);

    closeBtnBg.on('pointerover', () => closeBtnBg.setFillStyle(0xff3333));
    closeBtnBg.on('pointerout', () => closeBtnBg.setFillStyle(0xcc0000));
    closeBtnBg.on('pointerdown', () => this.fadeToScene('CityHub'));

    // Tab bar
    this.tabObjects = [];
    this.tabTexts = [];
    let tabX = 40;
    
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
        this.updateTabs();
        this.renderGrid();
      });
    }

    // Inner dark background for the grid area (simulating the indented board)
    this.add.rectangle(400, 355, 720, 430, 0x1a0f0a, 0.8).setStrokeStyle(2, 0x3e2723);

    // Grid container with scroll support
    this.gridContainer = this.add.container(0, 0);

    // Scroll mask
    const maskGfx = this.make.graphics({ x: 0, y: 0 });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(40, 140, 720, 430);
    this.gridContainer.setMask(maskGfx.createGeometryMask());

    // Mouse wheel scroll for grid
    let scrollY = 0;
    this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
      const maxScroll = Math.max(0, this.getGridHeight() - 430);
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
      case 'Cards': return Math.ceil(itemCount / 6) * 136 + 80;
      case 'Relics': return Math.ceil(itemCount / 6) * 136 + 80;
      case 'Tiles': return Math.ceil(itemCount / 6) * 136 + 80;
      case 'Events': return itemCount * 68 + 80;
      case 'Bosses': return 350;
      default: return 600;
    }
  }

  private updateTabs(): void {
    for (let i = 0; i < TAB_NAMES.length; i++) {
      const tabName = TAB_NAMES[i];
      const isActive = tabName === this.activeTab;
      
      const img = this.tabObjects[i] as Phaser.GameObjects.Image;
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
    const itemW = 90;
    const itemH = 100;
    const gapX = 12;
    const gapY = 36; // Extra vertical gap for names below cards
    
    const totalWidth = cols * itemW + (cols - 1) * gapX;
    const startX = 400 - (totalWidth / 2) + (itemW / 2);
    const startY = 200;

    status.items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (itemW + gapX);
      const y = startY + row * (itemH + gapY);

      if (item.isUnlocked) {
        const isCard = this.activeTab === 'Cards';
        let interactableObj;

        if (isCard) {
          // Render Card Illustration
          const img = this.add.image(x, y, `card_${item.id}`).setDisplaySize(itemW, itemH);
          img.setInteractive({ useHandCursor: true });
          this.gridContainer.add(img);
          interactableObj = img;

          // Red Frame
          const frame = this.add.rectangle(x, y, itemW, itemH).setStrokeStyle(3, 0xcc0000);
          this.gridContainer.add(frame);

          // Name at the bottom OUTSIDE the card
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
          }).setOrigin(0.5, 0); // Top-center alignment
          this.gridContainer.add(name);
        } else {
          // Plain Red Box for Relics / Tiles
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

        interactableObj.on('pointerdown', () => this.showDetailPopup(item.id));
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
    });
  }

  private renderRelicsGrid(status: CategoryStatus): void {
    // Reusing the same beautiful grid layout for consistency
    this.renderCardsGrid(status);
  }

  private renderTilesGrid(status: CategoryStatus): void {
    this.renderCardsGrid(status);
  }

  private renderEventsList(status: CategoryStatus): void {
    const fontFamily = FONTS.family;
    const startY = 160;

    status.items.forEach((item, index) => {
      const y = startY + index * 68;

      const bg = this.add.rectangle(400, y + 30, 700, 60, 0x2a1a10).setStrokeStyle(2, 0x3e2723);
      this.gridContainer.add(bg);

      if (item.isUnlocked) {
        const title = this.add.text(80, y + 18, item.name, {
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#e6c88a',
          stroke: '#2e1b0f',
          strokeThickness: 2,
          shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true },
          fontFamily,
        });
        this.gridContainer.add(title);

        const desc = this.add.text(80, y + 42, 'Random event encounter', {
          fontSize: '14px',
          color: '#dab988',
          fontFamily: 'Arial, sans-serif',
        });
        this.gridContainer.add(desc);
      } else {
        const locked = this.add.text(80, y + 18, '???', {
          fontSize: '20px',
          color: '#aaaaaa',
          fontFamily,
        });
        this.gridContainer.add(locked);

        const hint = this.add.text(80, y + 42, item.unlockHint || 'Discover during a run', {
          fontSize: '14px',
          color: '#888888',
          fontFamily: 'Arial, sans-serif',
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
