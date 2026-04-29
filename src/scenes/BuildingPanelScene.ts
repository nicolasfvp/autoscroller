import { Scene } from 'phaser';
import { MetaState } from '../state/MetaState';
import { upgradeBuilding, getBuildingTierData } from '../systems/MetaProgressionSystem';
import { saveMetaState } from '../systems/MetaPersistence';
import { playUnlockCelebration } from '../ui/UnlockCelebration';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';

const BUILDING_COLORS: Record<string, number> = {
  forge: 0xcc3333,
  library: 0x6a5acd,
  tavern: 0xff8c00,
  workshop: 0x228B22,
  shrine: 0x9370db,
  storehouse: 0x8B6914,
};

const BUILDING_DESCRIPTIONS: Record<string, string> = {
  forge: 'Unlock new cards for the loot pool.',
  library: 'Unlock passive skill tiers for the Warrior.',
  workshop: 'Unlock new tile types for your loops.',
  shrine: 'Unlock relics from ancient powers.',
  storehouse: 'Boost gathering rates and retain more on death.',
};

export class BuildingPanelScene extends Scene {
  private metaState!: MetaState;
  private buildingKey!: string;

  constructor() {
    super('BuildingPanelScene');
  }

  create(data: { buildingKey: string; metaState: MetaState }): void {
    this.buildingKey = data.buildingKey;
    this.metaState = data.metaState;

    this.renderPanel();
  }

  private renderPanel(): void {
    // Clear previous content
    this.children.removeAll(true);

    const fontFamily = FONTS.family;

    // Semi-transparent backdrop -- delay interactivity to prevent same-frame click-through
    const backdrop = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.75);
    this.time.delayedCall(100, () => {
      backdrop.setInteractive();
      backdrop.on('pointerdown', () => this.closePanel());
    });

    const tierData = getBuildingTierData(this.buildingKey);
    if (!tierData) return;

    // Fixed panel centered on screen
    const panelHeight = 540;
    const panelY = 300;

    // Panel (wood texture with rounded corners)
    const bgKey = this.buildingKey === 'library' ? 'library_table' : 'wood_texture_big';
    const panel = this.add.image(400, panelY, bgKey).setDisplaySize(500, panelHeight);
    panel.setInteractive(); // absorb clicks

    const shape = this.make.graphics();
    shape.fillStyle(0xffffff);
    shape.fillRoundedRect(150, 300 - (panelHeight/2), 500, panelHeight, 24);
    panel.setMask(shape.createGeometryMask());

    const currentLevel = (this.metaState.buildings as any)[this.buildingKey].level as number;
    const maxLevel = tierData.maxLevel;
    const color = BUILDING_COLORS[this.buildingKey] ?? 0xffffff;
    const colorHex = '#' + color.toString(16).padStart(6, '0');

    // Title (Medieval Style)
    if (this.buildingKey !== 'library') {
      this.add.text(400, 75, tierData.name, {
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#fdf6e3', // cream
        stroke: '#3e2723',
        strokeThickness: 6,
        fontFamily: '"Impact", "Arial Black", sans-serif',
        shadow: { offsetX: 2, offsetY: 2, color: '#000000', fill: true }
      }).setOrigin(0.5);
    }

    const descY = this.buildingKey === 'library' ? 165 : 120;

    // Description
    this.add.text(400, descY, BUILDING_DESCRIPTIONS[this.buildingKey] ?? '', {
      fontSize: '16px',
      color: '#ffeebb', // pale cream
      fontFamily,
    }).setOrigin(0.5);

    // Current tier
    this.add.text(400, descY + 25, `Level ${currentLevel} / ${maxLevel}`, {
      fontSize: '16px',
      color: '#ffeebb',
      fontFamily,
    }).setOrigin(0.5);

    // Progress bar background (dark wood/brown inset)
    this.add.rectangle(400, descY + 45, 400, 14, 0x1a0f0a).setStrokeStyle(2, 0x3e2723);

    // Progress bar fill (parchment/light wood color to match mockup)
    const fillWidth = maxLevel > 0 ? (currentLevel / maxLevel) * 396 : 0;
    if (fillWidth > 0) {
      this.add.rectangle(400 - (396 - fillWidth) / 2, descY + 45, fillWidth, 10, 0xdab988); // pale parchment fill
    }

    // Upgrade preview section
    this.add.text(400, descY + 80, 'Unlocks:', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#fdf6e3', // clean cream text, no stroke
      fontFamily,
    }).setOrigin(0.5);

    let itemY = descY + 110;
    const tierSpacing = tierData.tiers.length > 6 ? 25 : 28; // Compress slightly if there are many tiers

    for (const tier of tierData.tiers) {
      const isUnlocked = tier.level <= currentLevel;
      const isNext = tier.level === currentLevel + 1;

      // Solid Parchment background strip (Narrower)
      this.add.rectangle(400, itemY, 340, 24, 0xeee8d5, 1.0).setStrokeStyle(1, 0xdab988);

      // Tier label
      const prefix = isUnlocked ? '\u2713 ' : '';
      const tierLabel = `${prefix}Tier ${tier.level}:`;
      this.add.text(240, itemY, tierLabel, {
        fontSize: '13px',
        color: isUnlocked || isNext ? '#3e2723' : '#888888', // grey if locked
        fontFamily,
      }).setOrigin(0, 0.5);

      // List unlock items
      const unlocks = tier.unlocks || {};
      const allItems: string[] = [];
      for (const category of Object.keys(unlocks)) {
        for (const item of unlocks[category]) {
          allItems.push(item);
        }
      }

      if (allItems.length > 0) {
        const itemText = isUnlocked || isNext
          ? allItems.join(', ')
          : '???';
        this.add.text(310, itemY, itemText, {
          fontSize: '12px',
          fontStyle: 'bold',
          color: isNext ? colorHex : isUnlocked ? '#5d4037' : '#888888',
          fontFamily,
        }).setOrigin(0, 0.5);
      }

      itemY += tierSpacing;
    }

    const buttonY = Math.max(430, itemY + 10);

    // Upgrade button or "Fully Upgraded"
    if (currentLevel >= maxLevel) {
      this.add.text(400, buttonY, 'Fully Upgraded', {
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#fdf6e3',
        stroke: '#3e2723',
        strokeThickness: 3,
        fontFamily: '"Impact", "Arial Black", sans-serif',
      }).setOrigin(0.5);
    } else {
      const nextTier = tierData.tiers.find((t: any) => t.level === currentLevel + 1);
      const cost = (nextTier?.cost ?? {}) as Record<string, number>;
      // Check affordability against all required materials
      const missingMats: string[] = [];
      for (const [mat, required] of Object.entries(cost)) {
        if ((this.metaState.materials[mat] ?? 0) < required) {
          missingMats.push(mat);
        }
      }
      const canAfford = missingMats.length === 0;

      // Custom Button (No background rectangle, just floating styled text)
      const btnText = this.add.text(400, buttonY, 'Upgrade Building', {
        fontSize: '32px',
        fontStyle: 'bold',
        color: canAfford ? '#fdf6e3' : '#8a7369', // better contrast for disabled state
        stroke: canAfford ? '#3e2723' : '#2d1e18',
        strokeThickness: 5,
        fontFamily: '"Impact", "Arial Black", sans-serif',
        shadow: { offsetX: 2, offsetY: 2, color: '#000000', fill: true }
      }).setOrigin(0.5).setInteractive({ useHandCursor: canAfford });

      if (canAfford) {
        btnText.on('pointerover', () => btnText.setColor('#ffffff'));
        btnText.on('pointerout', () => btnText.setColor('#fdf6e3'));
        btnText.on('pointerdown', async () => {
          const result = upgradeBuilding(this.buildingKey, this.metaState);
          if (result.success && result.updatedState) {
            this.metaState = result.updatedState;
            await saveMetaState(this.metaState);

            const newUnlocks = result.newUnlocks;
            if (newUnlocks) {
              const allNewItems = [
                ...(newUnlocks.cards ?? []),
                ...(newUnlocks.relics ?? []),
                ...(newUnlocks.tiles ?? []),
                ...(newUnlocks.passives ?? []),
              ];
              if (allNewItems.length > 0) {
                playUnlockCelebration(this, allNewItems[0], BUILDING_COLORS[this.buildingKey]);
              }
            }

            this.time.delayedCall(1600, () => {
              this.renderPanel();
            });
          }
        });
      }

      // Multi-material cost display (under the button, moved up slightly)
      const costEntries = Object.entries(cost);
      
      const itemWidth = 110;
      const totalCostWidth = costEntries.length * itemWidth;
      let costX = 400 - (totalCostWidth / 2) + (itemWidth / 2);
      
      const costY = buttonY + 50; 

      // Render a SINGLE board background for all costs
      // Offset X slightly because the icon_table PNG might have asymmetrical empty space
      if (costEntries.length > 0) {
        this.add.image(406, costY, 'icon_table').setDisplaySize(totalCostWidth + 90, 64);
      }

      costEntries.forEach(([mat, required]) => {
        const owned = this.metaState.materials[mat] ?? 0;
        const hasEnough = owned >= required;
        const color = hasEnough ? '#ffffff' : '#ff5555';
        
        // Render icon if available
        const hasIcon = ['iron', 'crystal', 'scroll', 'wood', 'stone', 'bone'].includes(mat.toLowerCase());
        if (hasIcon) {
          this.add.image(costX - 12, costY, `mat_${mat.toLowerCase()}`).setDisplaySize(24, 24);
          this.add.text(costX + 12, costY + 2, `${required}`, {
            fontSize: '16px',
            fontStyle: 'bold',
            color,
            stroke: '#000000',
            strokeThickness: 3,
            fontFamily,
          }).setOrigin(0.5);
        } else {
          // Text only
          this.add.text(costX, costY, `${mat}: ${required}`, {
            fontSize: '14px',
            fontStyle: 'bold',
            color,
            stroke: '#000000',
            strokeThickness: 3,
            fontFamily,
          }).setOrigin(0.5);
        }
        
        costX += itemWidth;
      });
    }

    // Nice Red Close Button
    const closeBtnBg = this.add.circle(620, 50, 16, 0xcc0000).setStrokeStyle(2, 0x3e2723).setInteractive({ useHandCursor: true });
    const closeBtnTxt = this.add.text(620, 50, 'X', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      fontFamily,
    }).setOrigin(0.5);

    closeBtnBg.on('pointerover', () => closeBtnBg.setFillStyle(0xff3333));
    closeBtnBg.on('pointerout', () => closeBtnBg.setFillStyle(0xcc0000));
    closeBtnBg.on('pointerdown', () => this.closePanel());
  }

  private closePanel(): void {
    // Stop this overlay first, then restart CityHub to refresh its display
    // Use scene manager from the game to avoid calling start on a stopped scene
    const sceneManager = this.scene;
    sceneManager.stop('BuildingPanelScene');
    sceneManager.stop('CityHub');
    sceneManager.start('CityHub');
  }
}
