import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { openTreasure, type TreasureResult, type TreasureItem } from '../systems/TreasureSystem';

/**
 * TreasureScene -- treasure overlay with loot display and Take All.
 * Delegates logic to TreasureSystem. Pauses GameScene on open, resumes on close.
 */
export class TreasureScene extends Scene {
  constructor() {
    super('TreasureScene');
  }

  create(): void {
    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';

    // Overlay panel
    this.add.rectangle(400, 300, 500, 350, 0x222222, 0.9).setInteractive();

    // Title
    this.add.text(400, 145, 'Treasure!', {
      fontSize: '24px', fontStyle: 'bold', color: '#ff8c00', fontFamily,
    }).setOrigin(0.5);

    // "You found:"
    this.add.text(400, 175, 'You found:', {
      fontSize: '16px', color: '#aaaaaa', fontFamily,
    }).setOrigin(0.5);

    // Get treasure
    const run = getRun();
    const adapter = {
      deck: { cards: run.deck.active.map(id => ({ id, name: id })), order: [...run.deck.active] },
      economy: {
        gold: run.economy.gold,
        tilePoints: run.economy.tilePoints,
        metaLoot: (run.economy as any).metaLoot ?? 0,
      },
      tileInventory: Object.entries(run.economy.tileInventory)
        .filter(([_, count]) => count > 0)
        .map(([tileType, count]) => ({ tileType, count })),
      relics: [...run.relics],
    };

    const result: TreasureResult = openTreasure(adapter, run.loop.count || 1);

    // Sync adapter back
    run.economy.gold = adapter.economy.gold;
    run.economy.tilePoints = adapter.economy.tilePoints;
    (run.economy as any).metaLoot = adapter.economy.metaLoot;
    run.deck.active = [...adapter.deck.order];
    run.relics = [...adapter.relics];
    // Sync tile inventory
    run.economy.tileInventory = {};
    for (const entry of adapter.tileInventory) {
      run.economy.tileInventory[entry.tileType] = entry.count;
    }

    if (result.items.length === 0) {
      // Empty state
      this.add.text(400, 260, 'Empty Chest', {
        fontSize: '24px', color: '#aaaaaa', fontFamily,
      }).setOrigin(0.5);
      this.add.text(400, 295, 'The chest was already looted.', {
        fontSize: '16px', color: '#aaaaaa', fontFamily,
      }).setOrigin(0.5);

      const continueBtn = this.add.text(400, 420, 'Continue', {
        fontSize: '24px', fontStyle: 'bold', color: '#ffd700', fontFamily,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      continueBtn.on('pointerover', () => continueBtn.setColor('#ffffff'));
      continueBtn.on('pointerout', () => continueBtn.setColor('#ffd700'));
      continueBtn.on('pointerdown', () => this.close());
      return;
    }

    // Loot items
    const itemContainers: Phaser.GameObjects.Container[] = [];
    result.items.forEach((item, i) => {
      const y = 210 + i * 40;
      const container = this.add.container(400, y);

      // Icon circle
      const iconColor = this.getItemColor(item);
      const icon = this.add.circle(-180, 0, 12, iconColor);
      container.add(icon);

      // Item name
      const nameText = this.add.text(-155, 0, item.name, {
        fontSize: '16px', color: '#ffffff', fontFamily,
      }).setOrigin(0, 0.5);
      container.add(nameText);

      // Value text
      const valueStr = item.amount ? `+${item.amount} ${item.type}` : item.type;
      const valueText = this.add.text(180, 0, valueStr, {
        fontSize: '14px', color: '#aaaaaa', fontFamily,
      }).setOrigin(1, 0.5);
      container.add(valueText);

      // Staggered entrance
      container.setAlpha(0);
      container.x = 420;
      this.tweens.add({
        targets: container,
        alpha: 1,
        x: 400,
        duration: 200,
        delay: i * 200,
      });

      itemContainers.push(container);
    });

    // "Take All" button (appears after last item animates in)
    const takeAllBtn = this.add.text(400, 420, 'Take All', {
      fontSize: '24px', fontStyle: 'bold', color: '#ffd700', fontFamily,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

    this.tweens.add({
      targets: takeAllBtn,
      alpha: 1,
      duration: 200,
      delay: result.items.length * 200 + 100,
    });

    takeAllBtn.on('pointerover', () => takeAllBtn.setColor('#ffffff'));
    takeAllBtn.on('pointerout', () => takeAllBtn.setColor('#ffd700'));
    takeAllBtn.on('pointerdown', () => {
      // Slide items left and fade out
      itemContainers.forEach((container, i) => {
        this.tweens.add({
          targets: container,
          x: container.x - 40,
          alpha: 0,
          duration: 150,
          delay: i * 150,
        });
      });
      this.tweens.add({
        targets: takeAllBtn,
        alpha: 0,
        duration: 150,
        delay: itemContainers.length * 150,
        onComplete: () => this.close(),
      });
    });

    this.events.on('shutdown', this.cleanup, this);
  }

  private getItemColor(item: TreasureItem): number {
    switch (item.type) {
      case 'gold': return 0xffd700;
      case 'card': return 0xffffff;
      case 'relic': return 0x00ccff;
      case 'tile': return 0x228b22;
      default: return 0xaaaaaa;
    }
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  private cleanup(): void {
    // No external listeners to clean
  }
}
