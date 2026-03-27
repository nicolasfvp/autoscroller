import { Scene } from 'phaser';
import { loadMetaState } from '../systems/MetaPersistence';
import { MetaState } from '../state/MetaState';

const BUILDING_COLORS: Record<string, number> = {
  forge: 0xcc3333,
  library: 0x6a5acd,
  tavern: 0xff8c00,
  workshop: 0x228B22,
  shrine: 0x9370db,
};

const BUILDING_ICONS: Record<string, string> = {
  forge: 'F',
  library: 'L',
  tavern: 'T',
  workshop: 'W',
  shrine: 'S',
};

const BUILDING_NAMES: Record<string, string> = {
  forge: 'Forge',
  library: 'Library',
  tavern: 'Tavern',
  workshop: 'Workshop',
  shrine: 'Shrine',
};

interface BuildingLayout {
  key: string;
  x: number;
  y: number;
}

const BUILDING_LAYOUT: BuildingLayout[] = [
  { key: 'library', x: 400, y: 120 },
  { key: 'forge', x: 200, y: 260 },
  { key: 'tavern', x: 400, y: 260 },
  { key: 'workshop', x: 600, y: 260 },
  { key: 'shrine', x: 400, y: 400 },
];

export class CityHubScene extends Scene {
  private metaState!: MetaState;
  private hoverLabel: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('CityHub');
  }

  async create(): Promise<void> {
    this.metaState = await loadMetaState();

    // Background
    this.cameras.main.setBackgroundColor(0x1a1a2e);

    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';

    // Top bar: meta-loot balance (top-left)
    this.add.text(24, 24, `\u2605 ${this.metaState.metaLoot} Meta-Loot`, {
      fontSize: '16px',
      color: '#e040fb',
      fontFamily,
    });

    // Top bar: class XP display (top-right)
    this.add.text(776, 24, `Warrior Lv.${this.metaState.classXP.warrior}`, {
      fontSize: '16px',
      color: '#00ccff',
      fontFamily,
    }).setOrigin(1, 0);

    // Hover label (reused across buildings)
    this.hoverLabel = this.add.text(0, 0, '', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily,
    }).setOrigin(0.5, 1).setDepth(200).setVisible(false);

    // Buildings
    for (const layout of BUILDING_LAYOUT) {
      this.createBuilding(layout, fontFamily);
    }

    // Bottom bar: Collection button
    const collectionBtn = this.add.text(48, 560, 'Collection', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
      fontFamily,
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true });

    collectionBtn.on('pointerover', () => collectionBtn.setColor('#ffffff'));
    collectionBtn.on('pointerout', () => collectionBtn.setColor('#ffd700'));
    collectionBtn.on('pointerdown', () => {
      this.scene.start('CollectionScene');
    });

    // Navigation hint
    this.add.text(400, 560, 'Click a building to interact', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily,
    }).setOrigin(0.5, 1);
  }

  private createBuilding(layout: BuildingLayout, fontFamily: string): void {
    const { key, x, y } = layout;
    const level = (this.metaState.buildings as any)[key].level as number;
    const isTierZero = level === 0;
    const color = isTierZero ? 0x444444 : BUILDING_COLORS[key];
    const icon = isTierZero ? '?' : BUILDING_ICONS[key];
    const iconColor = isTierZero ? '#aaaaaa' : '#ffffff';

    // Building rectangle
    const rect = this.add.rectangle(x, y, 100, 100, color, 0.9);
    rect.setInteractive({ useHandCursor: true });

    // Dashed border for tier 0
    if (isTierZero) {
      rect.setStrokeStyle(2, 0xaaaaaa);
    }

    // Building icon
    this.add.text(x, y, icon, {
      fontSize: '32px',
      fontStyle: 'bold',
      color: iconColor,
      fontFamily,
    }).setOrigin(0.5);

    // Tier indicator below building
    const tierColorHex = '#' + BUILDING_COLORS[key].toString(16).padStart(6, '0');
    this.add.text(x, y + 64, `Lv.${level}`, {
      fontSize: '14px',
      color: isTierZero ? '#aaaaaa' : tierColorHex,
      fontFamily,
    }).setOrigin(0.5, 0);

    // Hover effects
    rect.on('pointerover', () => {
      rect.setStrokeStyle(2, 0xffffff);
      this.tweens.add({ targets: rect, scaleX: 1.05, scaleY: 1.05, duration: 100 });
      if (this.hoverLabel) {
        this.hoverLabel.setText(`${BUILDING_NAMES[key]} (Lv.${level})`);
        this.hoverLabel.setPosition(x, y - 60);
        this.hoverLabel.setVisible(true);
      }
    });

    rect.on('pointerout', () => {
      if (isTierZero) {
        rect.setStrokeStyle(2, 0xaaaaaa);
      } else {
        rect.setStrokeStyle(0);
      }
      this.tweens.add({ targets: rect, scaleX: 1, scaleY: 1, duration: 100 });
      if (this.hoverLabel) {
        this.hoverLabel.setVisible(false);
      }
    });

    // Click handler
    rect.on('pointerdown', () => {
      // Disable CityHub input while overlay is open to prevent click-through
      this.input.enabled = false;

      if (key === 'tavern') {
        this.scene.launch('TavernPanelScene', { metaState: this.metaState });
      } else {
        this.scene.launch('BuildingPanelScene', {
          buildingKey: key,
          metaState: this.metaState,
        });
      }
    });
  }
}
