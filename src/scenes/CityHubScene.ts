import { Scene } from 'phaser';
import { loadMetaState } from '../systems/MetaPersistence';
import { MetaState } from '../state/MetaState';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';
import { AudioManager } from '../systems/AudioManager';

const BUILDING_COLORS: Record<string, number> = {
  forge: 0xcc3333,
  library: 0x6a5acd,
  tavern: 0xff8c00,
  workshop: 0x228B22,
  shrine: 0x9370db,
  storehouse: 0x8B6914,
};



const BUILDING_NAMES: Record<string, string> = {
  forge: 'FORGE',
  library: 'LIBRARY',
  tavern: 'TAVERN',
  workshop: 'WORKSHOP',
  shrine: 'ORACLE',
  storehouse: 'VAULT',
};

interface BuildingLayout {
  key: string;
  x: number;
  y: number;
}

const BUILDING_LAYOUT: BuildingLayout[] = [
  { key: 'library', x: 400, y: 160 },
  { key: 'forge', x: 220, y: 310 },
  { key: 'tavern', x: 400, y: 310 },
  { key: 'workshop', x: 580, y: 310 },
  { key: 'shrine', x: 310, y: 460 },
  { key: 'storehouse', x: 490, y: 460 },
];

export class CityHubScene extends Scene {
  private metaState!: MetaState;
  private hoverLabel: Phaser.GameObjects.Text | null = null;
  private transitioning = false;

  constructor() {
    super('CityHub');
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

    // Background
    this.cameras.main.setBackgroundColor(COLORS.background);
    if (this.textures.exists('bg_city')) {
      this.add.image(400, 300, 'bg_city').setDisplaySize(800, 600).setDepth(-10);
    }

    // Stop Theme Song and Play Town Song with crossfade
    AudioManager.transitionTo(this, 'town_song', { volume: 0.4, duration: 1500 });

    const fontFamily = FONTS.family;

    // Top bar: material inventory (top-left)
    const tableImg = this.add.image(10, 10, 'icons_up_table').setOrigin(0, 0).setDepth(50);
    // Let's adjust scale and position slightly based on typical asset size
    tableImg.setScale(0.7); // Reduced table size further

    const materialsLeft = ['stone', 'essence', 'herbs'];
    const materialsRight = ['bone', 'wood', 'iron'];
    
    // Base positions relative to the table
    const startX = 35; 
    const startY = 36; // moved slightly up
    const rowHeight = 26; // increased spacing a bit
    const colWidth = 90;

    const renderMat = (matKey: string, x: number, y: number) => {
      const val = (this.metaState.materials as any)[matKey] || 0;
      const hasImage = ['stone', 'wood', 'iron', 'crystal', 'bone', 'scroll'].includes(matKey);
      
      if (hasImage) {
        this.add.image(x, y, `mat_${matKey}`).setDisplaySize(18, 18).setOrigin(0.5, 0.5).setDepth(51);
      } else {
        let iconStr = '';
        if (matKey === 'essence') iconStr = '✨';
        else if (matKey === 'herbs') iconStr = '🌿';
        
        this.add.text(x, y, iconStr, {
          fontSize: '16px', // larger emojis
          fontFamily
        }).setOrigin(0.5, 0.5).setDepth(51);
      }

      // Text always aligned perfectly at x + 10
      const textX = x + 10;
      this.add.text(textX, y, `${matKey}: ${val}`, {
        fontSize: '12px',
        color: '#e6c88a',
        stroke: '#2e1b0f',
        strokeThickness: 2,
        fontStyle: 'bold',
        fontFamily,
        shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true }
      }).setOrigin(0, 0.5).setDepth(51);
    };

    materialsLeft.forEach((mat, i) => {
      renderMat(mat, startX, startY + i * rowHeight);
    });

    materialsRight.forEach((mat, i) => {
      renderMat(mat, startX + colWidth, startY + i * rowHeight);
    });

    // Render crystal centered at the bottom row
    renderMat('crystal', startX + (colWidth / 2) - 5, startY + 3 * rowHeight);

    // Top bar: class XP display (top-right)
    this.add.text(776, 24, `Warrior Lv.${this.metaState.classXP.warrior}`, {
      fontSize: '16px',
      color: '#e6c88a',
      stroke: '#2e1b0f',
      strokeThickness: 2,
      fontStyle: 'bold',
      fontFamily,
      shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true }
    }).setOrigin(1, 0);

    // Title
    this.add.text(400, 50, '〰 THE VILLAGE 〰', {
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#e6c88a',
      stroke: '#2e1b0f',
      strokeThickness: 3,
      fontFamily,
      shadow: { offsetX: 2, offsetY: 2, color: '#1a0d06', blur: 4, fill: true }
    }).setOrigin(0.5, 0.5).setDepth(10);

    // Hover label (reused across buildings, though maybe not needed with new layout)
    this.hoverLabel = this.add.text(0, 0, '', {
      fontSize: '16px',
      color: '#e6c88a',
      stroke: '#2e1b0f',
      strokeThickness: 2,
      fontStyle: 'bold',
      fontFamily,
      shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true }
    }).setOrigin(0.5, 1).setDepth(200).setVisible(false);

    // Buildings
    for (const layout of BUILDING_LAYOUT) {
      this.createBuilding(layout, fontFamily);
    }

    // Bottom bar: Collection button
    const collectionBtn = createButton(this, 48, 560, 'Collection', () => {
      this.fadeToScene('CollectionScene');
    }, 'primary');
    collectionBtn.setOrigin(0, 1)
      .setColor('#e6c88a')
      .setStroke('#2e1b0f', 2)
      .setShadow(1, 1, '#1a0d06', 2, true, true)
      .setFontStyle('bold');

    // Change Hero button (feedback #36)
    const changeHeroBtn = createButton(this, 752, 560, 'Change Hero', () => {
      this.fadeToScene('CharacterSelectScene');
    }, 'secondary');
    changeHeroBtn.setOrigin(1, 1)
      .setColor('#e6c88a')
      .setStroke('#2e1b0f', 2)
      .setShadow(1, 1, '#1a0d06', 2, true, true)
      .setFontStyle('bold');


  }

  private createBuilding(layout: BuildingLayout, fontFamily: string): void {
    const { key, x, y } = layout;
    const level = (this.metaState.buildings as any)[key].level as number;
    const isTierZero = level === 0;

    // Use a container for the building elements
    const container = this.add.container(x, y);

    // Building background frame
    const frame = this.add.image(0, 0, 'base_icon_place');
    frame.setDisplaySize(115, 115);
    
    container.add(frame);

    // Building icon image
    const iconImage = this.add.image(0, -8, `icon_${key}`);
    iconImage.setDisplaySize(70, 70);
    container.add(iconImage);

    // Building name over bottom of frame
    const nameText = this.add.text(0, 38, BUILDING_NAMES[key], {
      fontSize: '15px',
      color: '#e6c88a',
      stroke: '#2e1b0f',
      strokeThickness: 2,
      fontStyle: 'bold',
      fontFamily,
      shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true }
    }).setOrigin(0.5, 0.5);
    container.add(nameText);

    // Tier indicator below building (outside frame)
    const levelText = this.add.text(0, 60, `Level ${level}`, {
      fontSize: '18px', 
      color: '#e6c88a', // dull yellow/gold from main menu
      stroke: '#2e1b0f',
      strokeThickness: 2,
      fontStyle: 'bold',
      fontFamily,
      shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true }
    }).setOrigin(0.5, 0);
    container.add(levelText);

    // Make frame interactive
    frame.setInteractive({ useHandCursor: true });

    // Hover effects
    frame.on('pointerover', () => {
      // Adding a slight glow/brightness on hover
      frame.setTint(0xffffcc);
      iconImage.setTint(0xffffcc);
      this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });

    frame.on('pointerout', () => {
      // Reset tint
      frame.clearTint();
      iconImage.clearTint();
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
    });

    // Click handler
    frame.on('pointerdown', () => {
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
