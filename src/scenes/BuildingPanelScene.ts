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
    let bgKey = 'wood_texture_big';
    if (this.buildingKey === 'library') bgKey = 'library_table';
    else if (this.buildingKey === 'workshop') bgKey = 'workshop_table';
    else if (this.buildingKey === 'forge') bgKey = 'forge_table';
    else if (this.buildingKey === 'shrine') bgKey = 'shrine_table';
    else if (this.buildingKey === 'storehouse') bgKey = 'vault_table';

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
    const hasBakedTitle = ['library', 'workshop', 'forge', 'shrine', 'storehouse'].includes(this.buildingKey);
    if (!hasBakedTitle) {
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

    let descY = 120;
    let descX = 400;
    if (this.buildingKey === 'library') descY = 165;
    else if (this.buildingKey === 'workshop') {
      descY = 190;
      descX += 15; // move slightly to the right to align with the baked title
    } else if (this.buildingKey === 'forge') {
      descY = 155; // push further down to clear the baked header ornament
    } else if (this.buildingKey === 'shrine' || this.buildingKey === 'storehouse') {
      descY = 190;
    }

    // Description
    this.add.text(descX, descY, BUILDING_DESCRIPTIONS[this.buildingKey] ?? '', {
      fontSize: '16px',
      color: '#e6c88a', // standard yellow
      fontStyle: 'bold',
      stroke: '#2e1b0f',
      strokeThickness: 2,
      fontFamily,
      shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true }
    }).setOrigin(0.5);

    // Current tier
    this.add.text(descX, descY + 28, `Level ${currentLevel} / ${maxLevel}`, { // pushed down slightly to account for bold/stroke
      fontSize: '16px',
      color: '#e6c88a', 
      fontStyle: 'bold',
      stroke: '#2e1b0f',
      strokeThickness: 2,
      fontFamily,
      shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true }
    }).setOrigin(0.5);

    if (this.buildingKey !== 'workshop') {
      // Progress bar background (dark wood/brown inset)
      this.add.rectangle(400, descY + 50, 400, 14, 0x1a0f0a).setStrokeStyle(2, 0x3e2723); // pushed down to 50

      // Progress bar fill (parchment/light wood color to match mockup)
      const fillWidth = maxLevel > 0 ? (currentLevel / maxLevel) * 396 : 0;
      if (fillWidth > 0) {
        this.add.rectangle(400 - (396 - fillWidth) / 2, descY + 50, fillWidth, 10, 0xdab988); // pale parchment fill
      }
    }

    let unlocksY = descY + 80;
    let unlocksX = 400;
    if (this.buildingKey === 'workshop') {
      unlocksY = descY + 65; 
      unlocksX += 15; 
    }

    // Upgrade preview section
    this.add.text(unlocksX, unlocksY, 'Unlocks:', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#e6c88a', // standard yellow
      stroke: '#2e1b0f',
      strokeThickness: 3,
      fontFamily,
      shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true }
    }).setOrigin(0.5);

    let itemY = unlocksY + 34;
    const tierSpacing = tierData.tiers.length > 6 ? 26 : 30; // slightly more breathing room

    for (const tier of tierData.tiers) {
      const isUnlocked = tier.level <= currentLevel;
      const isNext = tier.level === currentLevel + 1;

      // Solid Parchment background strip (Narrower)
      const stripWidth = this.buildingKey === 'workshop' ? 220 : 340;
      this.add.rectangle(unlocksX, itemY, stripWidth, 24, 0xeee8d5, 1.0).setStrokeStyle(1, 0xdab988);

      const textStartX = unlocksX - (stripWidth / 2) + 20;

      // Tier label
      const prefix = isUnlocked ? '\u2713 ' : '';
      const tierLabel = `${prefix}Tier ${tier.level}:`;
      this.add.text(textStartX, itemY, tierLabel, {
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
          ? allItems.join(' • ')
          : '???';
        this.add.text(textStartX + 65, itemY, itemText, {
          fontSize: '12px',
          fontStyle: 'bold',
          color: isNext ? colorHex : isUnlocked ? '#5d4037' : '#888888',
          fontFamily,
        }).setOrigin(0, 0.5);
      }

      itemY += tierSpacing;
    }

    // Scale down UI for workshop to fit between the anvils
    const isWorkshop = this.buildingKey === 'workshop';
    const scale = isWorkshop ? 0.75 : 1.0;
    
    const buttonY = isWorkshop ? Math.max(380, itemY + 20) : Math.max(430, itemY + 10);

    let buttonX = 400;
    if (isWorkshop) buttonX += 12; // move slightly left (was 25, now 12)

    // Upgrade button or "Fully Upgraded"
    if (currentLevel >= maxLevel) {
      this.add.text(buttonX, buttonY, 'Fully Upgraded', {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#e6c88a',
        stroke: '#2e1b0f',
        strokeThickness: 3,
        fontFamily,
        shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true }
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
      const btnText = this.add.text(buttonX, buttonY, 'Upgrade Building', {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#e6c88a', // Always use the standard gold
        stroke: '#2e1b0f',
        strokeThickness: 3,
        fontFamily,
        shadow: { offsetX: 1, offsetY: 1, color: '#1a0d06', blur: 2, fill: true }
      }).setOrigin(0.5).setInteractive({ useHandCursor: canAfford });
      
      if (!canAfford) {
        btnText.setAlpha(0.6); // Dim the text if disabled instead of changing its color
      }

      if (canAfford) {
        btnText.on('pointerover', () => {
          btnText.setColor('#ffffff');
          this.tweens.add({ targets: btnText, scaleX: 1.05, scaleY: 1.05, duration: 100 });
        });
        btnText.on('pointerout', () => {
          btnText.setColor('#e6c88a');
          this.tweens.add({ targets: btnText, scaleX: 1, scaleY: 1, duration: 100 });
        });
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
      
      const itemWidth = 80;
      const totalCostWidth = costEntries.length * itemWidth;
      let costX = -(totalCostWidth / 2) + (itemWidth / 2);
      
      const costY = buttonY + (isWorkshop ? 38 : 50); 

      const costContainer = this.add.container(buttonX, costY);
      costContainer.setScale(scale);

      // Render a SINGLE board background for all costs
      // Offset X slightly because the icon_table PNG might have asymmetrical empty space
      if (costEntries.length > 0) {
        costContainer.add(this.add.image(6, 0, 'icon_table').setDisplaySize(totalCostWidth + 50, 64));
      }

      costEntries.forEach(([mat, required]) => {
        const owned = this.metaState.materials[mat] ?? 0;
        const hasEnough = owned >= required;
        const color = hasEnough ? '#ffffff' : '#ff5555';
        
        // Render icon if available
        const hasIcon = ['iron', 'crystal', 'scroll', 'wood', 'stone', 'bone', 'essence'].includes(mat.toLowerCase());
        if (hasIcon) {
          costContainer.add(this.add.image(costX - 16, 0, `mat_${mat.toLowerCase()}`).setDisplaySize(24, 24));
          costContainer.add(this.add.text(costX + 14, 2, `${required}`, {
            fontSize: '18px',
            fontStyle: 'bold',
            color,
            stroke: '#000000',
            strokeThickness: 3,
            fontFamily,
          }).setOrigin(0.5));
        } else {
          // Text only
          costContainer.add(this.add.text(costX, 0, `${mat}: ${required}`, {
            fontSize: '14px',
            fontStyle: 'bold',
            color,
            stroke: '#000000',
            strokeThickness: 3,
            fontFamily,
          }).setOrigin(0.5));
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
