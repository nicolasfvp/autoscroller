import { Scene } from 'phaser';
import { loadMetaState } from '../systems/MetaPersistence';
import { getCollectionStatus, getCompletionPercent, type CollectionStatus, type CategoryStatus } from '../systems/CollectionRegistry';
import { MetaState } from '../state/MetaState';

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

  constructor() {
    super('CollectionScene');
  }

  async create(): Promise<void> {
    this.metaState = await loadMetaState();
    this.collectionStatus = getCollectionStatus(this.metaState);
    const percent = getCompletionPercent(this.metaState);
    this.activeTab = 'Cards';

    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';

    // Background
    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Title
    this.add.text(24, 24, 'Collection', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff',
      fontFamily,
    });

    // Completion percentage
    this.add.text(180, 30, `${percent}% Complete`, {
      fontSize: '14px',
      color: '#ffd700',
      fontFamily,
    });

    // Close button
    const closeBtn = this.add.text(776, 24, 'X', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => {
      this.scene.start('CityHub');
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
        color: isActive ? '#ffffff' : '#aaaaaa',
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

    // Grid container
    this.gridContainer = this.add.container(0, 0);

    this.renderGrid();
  }

  private updateTabs(): void {
    for (let i = 0; i < TAB_NAMES.length; i++) {
      const tabName = TAB_NAMES[i];
      const isActive = tabName === this.activeTab;
      const color = isActive ? TAB_COLORS[tabName] : 0x333333;
      this.tabObjects[i].setFillStyle(color);
      this.tabTexts[i].setColor(isActive ? '#ffffff' : '#aaaaaa');
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
    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
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
        this.gridContainer.add(card);

        const name = this.add.text(x, y + 10, item.name, {
          fontSize: '12px',
          color: '#ffffff',
          fontFamily,
          wordWrap: { width: itemW - 8 },
          align: 'center',
        }).setOrigin(0.5);
        this.gridContainer.add(name);
      } else {
        const card = this.add.rectangle(x, y, itemW, itemH, 0x444444);
        this.gridContainer.add(card);

        const locked = this.add.text(x, y - 10, '???', {
          fontSize: '16px',
          color: '#aaaaaa',
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(locked);

        if (item.unlockHint) {
          const hint = this.add.text(x, y + 20, item.unlockHint, {
            fontSize: '10px',
            color: '#aaaaaa',
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
    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
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
        const relic = this.add.rectangle(x, y, itemSize, itemSize, 0x222222);
        relic.setStrokeStyle(2, 0x9370db);
        this.gridContainer.add(relic);

        const name = this.add.text(x, y, item.name, {
          fontSize: '14px',
          color: '#ffffff',
          fontFamily,
          wordWrap: { width: itemSize - 8 },
          align: 'center',
        }).setOrigin(0.5);
        this.gridContainer.add(name);
      } else {
        const relic = this.add.rectangle(x, y, itemSize, itemSize, 0x444444);
        this.gridContainer.add(relic);

        const locked = this.add.text(x, y - 10, '???', {
          fontSize: '16px',
          color: '#aaaaaa',
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(locked);

        if (item.unlockHint) {
          const hint = this.add.text(x, y + 16, item.unlockHint, {
            fontSize: '10px',
            color: '#aaaaaa',
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
    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
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
          color: '#ffffff',
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
          color: '#aaaaaa',
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(locked);

        if (item.unlockHint) {
          const hint = this.add.text(x, y + 16, item.unlockHint, {
            fontSize: '10px',
            color: '#aaaaaa',
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
    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
    const startY = 100;

    status.items.forEach((item, index) => {
      const y = startY + index * 68;

      const bg = this.add.rectangle(400, y + 30, 700, 60, 0x333333, 0.8);
      this.gridContainer.add(bg);

      if (item.isUnlocked) {
        const title = this.add.text(80, y + 18, item.name, {
          fontSize: '16px',
          color: '#ffffff',
          fontFamily,
        });
        this.gridContainer.add(title);

        const desc = this.add.text(80, y + 38, 'Random event encounter', {
          fontSize: '14px',
          color: '#aaaaaa',
          fontFamily,
        });
        this.gridContainer.add(desc);
      } else {
        const locked = this.add.text(80, y + 18, '???', {
          fontSize: '16px',
          color: '#aaaaaa',
          fontFamily,
        });
        this.gridContainer.add(locked);

        const hint = this.add.text(80, y + 38, 'Discover during a run', {
          fontSize: '14px',
          color: '#aaaaaa',
          fontFamily,
        });
        this.gridContainer.add(hint);
      }
    });
  }

  private renderBossesRow(status: CategoryStatus): void {
    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
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
          color: '#ffffff',
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(name);

        const type = this.add.text(x, y + 10, 'Boss', {
          fontSize: '14px',
          color: '#aaaaaa',
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(type);
      } else {
        const bg = this.add.rectangle(x, y, itemW, itemH, 0x444444);
        this.gridContainer.add(bg);

        const locked = this.add.text(x, y, '???', {
          fontSize: '24px',
          color: '#aaaaaa',
          fontFamily,
        }).setOrigin(0.5);
        this.gridContainer.add(locked);
      }
    });
  }
}
