import { Scene } from 'phaser';
import { MetaState } from '../state/MetaState';
import { upgradeBuilding, getBuildingTierData } from '../systems/MetaProgressionSystem';
import { saveMetaState } from '../systems/MetaPersistence';
import { playUnlockCelebration } from '../ui/UnlockCelebration';

const BUILDING_COLORS: Record<string, number> = {
  forge: 0xcc3333,
  library: 0x6a5acd,
  tavern: 0xff8c00,
  workshop: 0x228B22,
  shrine: 0x9370db,
};

const BUILDING_DESCRIPTIONS: Record<string, string> = {
  forge: 'Unlock new cards for the loot pool.',
  library: 'Unlock passive skill tiers for the Warrior.',
  workshop: 'Unlock new tile types for your loops.',
  shrine: 'Unlock relics from ancient powers.',
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

    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';

    // Semi-transparent backdrop -- delay interactivity to prevent same-frame click-through
    const backdrop = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.5);
    this.time.delayedCall(100, () => {
      backdrop.setInteractive();
      backdrop.on('pointerdown', () => this.closePanel());
    });

    // Panel
    const panel = this.add.rectangle(400, 300, 500, 420, 0x222222, 0.95);
    panel.setInteractive(); // absorb clicks

    const tierData = getBuildingTierData(this.buildingKey);
    if (!tierData) return;

    const currentLevel = (this.metaState.buildings as any)[this.buildingKey].level as number;
    const maxLevel = tierData.maxLevel;
    const color = BUILDING_COLORS[this.buildingKey] ?? 0xffffff;
    const colorHex = '#' + color.toString(16).padStart(6, '0');

    // Title
    this.add.text(400, 115, tierData.name, {
      fontSize: '24px',
      fontStyle: 'bold',
      color: colorHex,
      fontFamily,
    }).setOrigin(0.5);

    // Description
    this.add.text(400, 143, BUILDING_DESCRIPTIONS[this.buildingKey] ?? '', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily,
    }).setOrigin(0.5);

    // Current tier
    this.add.text(400, 167, `Level ${currentLevel} / ${maxLevel}`, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily,
    }).setOrigin(0.5);

    // Progress bar background
    this.add.rectangle(400, 187, 400, 8, 0x444444);

    // Progress bar fill
    const fillWidth = maxLevel > 0 ? (currentLevel / maxLevel) * 400 : 0;
    if (fillWidth > 0) {
      this.add.rectangle(400 - (400 - fillWidth) / 2, 187, fillWidth, 8, color);
    }

    // Upgrade preview section
    this.add.text(200, 210, 'Unlocks:', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff',
      fontFamily,
    });

    let itemY = 245;
    for (const tier of tierData.tiers) {
      const isUnlocked = tier.level <= currentLevel;
      const isNext = tier.level === currentLevel + 1;
      const alpha = isUnlocked ? 0.5 : isNext ? 1.0 : 0.4;

      // Tier label
      const prefix = isUnlocked ? '\u2713 ' : '';
      const tierLabel = `${prefix}Tier ${tier.level}:`;
      this.add.text(210, itemY, tierLabel, {
        fontSize: '14px',
        color: isUnlocked ? '#aaaaaa' : '#ffffff',
        fontFamily,
      }).setAlpha(alpha);

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
        this.add.text(300, itemY, itemText, {
          fontSize: '14px',
          color: isNext ? colorHex : isUnlocked ? '#aaaaaa' : '#666666',
          fontFamily,
        }).setAlpha(alpha);
      }

      itemY += 28;
    }

    // Upgrade button or "Fully Upgraded"
    if (currentLevel >= maxLevel) {
      this.add.text(400, 370, 'Fully Upgraded', {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#aaaaaa',
        fontFamily,
      }).setOrigin(0.5);
    } else {
      const nextTier = tierData.tiers.find((t: any) => t.level === currentLevel + 1);
      const cost = nextTier?.cost ?? 0;
      const canAfford = this.metaState.metaLoot >= cost;

      const upgradeBtn = this.add.text(400, 370, 'Upgrade Building', {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffd700',
        fontFamily,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      if (!canAfford) {
        upgradeBtn.setAlpha(0.4);
      }

      // Cost label
      this.add.text(400, 400, `${cost} Meta-Loot`, {
        fontSize: '14px',
        color: canAfford ? '#e040fb' : '#ff0000',
        fontFamily,
      }).setOrigin(0.5);

      if (!canAfford) {
        this.add.text(400, 420, `Need ${cost} Meta-Loot to upgrade.`, {
          fontSize: '14px',
          color: '#ff0000',
          fontFamily,
        }).setOrigin(0.5);
      }

      upgradeBtn.on('pointerdown', async () => {
        if (!canAfford) return;
        const result = upgradeBuilding(this.buildingKey, this.metaState);
        if (result.success && result.updatedState) {
          this.metaState = result.updatedState;
          await saveMetaState(this.metaState);

          // Play unlock celebration for new items
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

          // Re-render panel with updated state
          this.time.delayedCall(1600, () => {
            this.renderPanel();
          });
        }
      });
    }

    // Close button
    const closeBtn = this.add.text(630, 100, 'X', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.closePanel());
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
