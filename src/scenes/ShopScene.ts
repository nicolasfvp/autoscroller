import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { ShopSystem } from '../systems/ShopSystem';
import { getCardById } from '../data/DataLoader';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';

/**
 * ShopScene -- overlay for deck management, relic purchasing, tile selling.
 * Delegates all logic to ShopSystem static methods.
 * Pauses GameScene on open, resumes on close.
 */
export class ShopScene extends Scene {
  private goldText!: Phaser.GameObjects.Text;
  private tpText!: Phaser.GameObjects.Text;
  constructor() {
    super('ShopScene');
  }

  create(): void {
    const run = getRun();
    const fontFamily = FONTS.family;

    // Overlay panel
    this.add.rectangle(400, 300, 650, 500, COLORS.panel, LAYOUT.panelAlpha).setInteractive();

    // Title
    this.add.text(400, 70, 'Shop', {
      fontSize: '24px', fontStyle: 'bold', color: COLORS.accent, fontFamily,
    }).setOrigin(0.5);

    // Gold balance (top-right)
    this.goldText = this.add.text(680, 65, `\u25C6 ${run.economy.gold}`, {
      fontSize: '16px', color: COLORS.accent, fontFamily,
    }).setOrigin(1, 0);

    // Tile point balance
    this.tpText = this.add.text(680, 85, `${run.economy.tilePoints} TP`, {
      fontSize: '14px', color: '#00e5ff', fontFamily,
    }).setOrigin(1, 0);

    // Build shop sections
    this.buildBuyCardsSection(fontFamily);
    this.buildRemoveCardsSection(fontFamily);
    this.buildReorderSection(fontFamily);
    this.buildUpgradeSection(fontFamily);
    this.buildBuyRelicsSection(fontFamily);
    this.buildSellTilesSection(fontFamily);

    // "Leave Shop" button
    createButton(this, 400, 530, 'Leave Shop', () => this.close(), 'primary');

    this.events.on('shutdown', this.cleanup, this);
  }

  private buildBuyCardsSection(fontFamily: string): void {
    const run = getRun();
    const runAdapter = this.getRunAdapter();
    const availableCards = ['strike', 'defend', 'fury', 'heal', 'bash'];
    const shopCards = ShopSystem.getShopCards(runAdapter, availableCards, run.loop.count);

    this.add.text(140, 110, 'Buy Cards', {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
    });

    shopCards.forEach((card, i) => {
      const x = 180 + i * 140;
      const y = 155;
      const bg = this.add.rectangle(x, y, 120, 50, 0x333333).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y - 8, card.name, {
        fontSize: '14px', color: COLORS.textPrimary, fontFamily,
      }).setOrigin(0.5);
      const price = this.add.text(x, y + 12, `${card.price} Gold`, {
        fontSize: '12px', color: COLORS.accent, fontFamily,
      }).setOrigin(0.5);

      if (run.economy.gold < card.price) {
        bg.setAlpha(0.4); label.setAlpha(0.4); price.setAlpha(0.4);
      } else {
        bg.on('pointerdown', () => {
          const adapter = this.getRunAdapter();
          if (ShopSystem.buyCard(adapter, card.cardId, card.price)) {
            this.syncFromAdapter(adapter);
            this.refreshBalances();
            bg.setAlpha(0.3);
            bg.removeInteractive();
          }
        });
      }
    });
  }

  private buildRemoveCardsSection(fontFamily: string): void {
    const run = getRun();
    const deckCards = run.deck.active;
    const cost = ShopSystem.getRemoveCardCost(deckCards.length);

    this.add.text(140, 195, `Remove Cards (${cost} Gold each)`, {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
    });

    const maxShow = Math.min(deckCards.length, 4);
    for (let i = 0; i < maxShow; i++) {
      const x = 180 + i * 120;
      const y = 235;
      const cardId = deckCards[i];
      const bg = this.add.rectangle(x, y, 100, 36, 0x333333).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y, cardId, {
        fontSize: '12px', color: COLORS.textPrimary, fontFamily,
      }).setOrigin(0.5);

      if (run.economy.gold < cost || deckCards.length <= 3) {
        bg.setAlpha(0.4); label.setAlpha(0.4);
      } else {
        bg.on('pointerdown', () => {
          const adapter = this.getRunAdapter();
          if (ShopSystem.removeCard(adapter, i)) {
            this.syncFromAdapter(adapter);
            this.refreshBalances();
            bg.setAlpha(0.3);
            bg.removeInteractive();
          }
        });
      }
    }
  }

  private buildReorderSection(fontFamily: string): void {
    this.add.text(140, 270, 'Reorder Deck', {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
    });

    const reorderBtn = this.add.text(320, 270, 'Open Deck Editor', {
      fontSize: '14px', color: COLORS.accent, fontFamily,
    }).setInteractive({ useHandCursor: true });

    reorderBtn.on('pointerover', () => reorderBtn.setColor(COLORS.accentHover));
    reorderBtn.on('pointerout', () => reorderBtn.setColor(COLORS.accent));
    reorderBtn.on('pointerdown', () => {
      this.scene.pause();
      this.scene.launch('ShopDeckEditor');
      // When ShopDeckEditor stops, ShopScene resumes — refresh balances
      this.events.once('resume', () => {
        this.refreshBalances();
      });
    });
  }

  private buildUpgradeSection(fontFamily: string): void {
    const run = getRun();
    const deckCards = run.deck.active;
    const upgradedCards = run.deck.upgradedCards ?? [];

    this.add.text(140, 300, 'Upgrade Cards', {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
    });

    const maxShow = Math.min(deckCards.length, 4);
    for (let i = 0; i < maxShow; i++) {
      const cardId = deckCards[i];
      const card = getCardById(cardId);
      const rarity = card?.rarity ?? 'common';
      const cardName = card?.name ?? cardId;
      const isUpgraded = upgradedCards.includes(cardId);
      const price = ShopSystem.getUpgradePrice(rarity);

      const x = 180 + i * 120;
      const y = 340;
      const bg = this.add.rectangle(x, y, 110, 44, 0x333333).setInteractive({ useHandCursor: true });
      const displayName = isUpgraded ? `${cardName}+` : cardName;
      const nameColor = isUpgraded ? '#888888' : '#ffffff';
      const label = this.add.text(x, y - 8, displayName, {
        fontSize: '12px', color: nameColor, fontFamily,
      }).setOrigin(0.5);

      if (isUpgraded) {
        const upgLabel = this.add.text(x, y + 10, 'UPGRADED', {
          fontSize: '10px', color: '#888888', fontFamily,
        }).setOrigin(0.5);
        bg.setAlpha(0.4); label.setAlpha(0.4); upgLabel.setAlpha(0.4);
      } else {
        const priceLabel = this.add.text(x, y + 10, `${price} Gold`, {
          fontSize: '10px', color: COLORS.accent, fontFamily,
        }).setOrigin(0.5);

        if (run.economy.gold < price) {
          bg.setAlpha(0.4); label.setAlpha(0.4); priceLabel.setAlpha(0.4);
        } else {
          bg.on('pointerdown', () => {
            if (ShopSystem.upgradeCard(run as any, cardId, rarity)) {
              this.refreshBalances();
              label.setText(`${cardName}+`);
              label.setColor(COLORS.accent);
              priceLabel.setText('UPGRADED');
              priceLabel.setColor('#888888');
              bg.setAlpha(0.4);
              bg.removeInteractive();
            }
          });
        }
      }
    }
  }

  private buildBuyRelicsSection(fontFamily: string): void {
    const run = getRun();
    const runAdapter = this.getRunAdapter();
    const availableRelics = ['mysterious_amulet', 'ancient_relic', 'fire_charm'];
    const shopRelics = ShopSystem.getShopRelics(runAdapter, availableRelics);

    this.add.text(140, 385, 'Buy Relics', {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
    });

    if (shopRelics.length === 0) {
      this.add.text(140, 415, 'No relics in stock this visit.', {
        fontSize: '14px', color: COLORS.textSecondary, fontFamily,
      });
      return;
    }

    shopRelics.forEach((relic, i) => {
      const x = 220 + i * 180;
      const y = 420;
      const bg = this.add.rectangle(x, y, 160, 40, 0x333333).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y - 6, relic.name, {
        fontSize: '14px', color: COLORS.textPrimary, fontFamily,
      }).setOrigin(0.5);
      const price = this.add.text(x, y + 12, `${relic.price} Gold`, {
        fontSize: '12px', color: COLORS.accent, fontFamily,
      }).setOrigin(0.5);

      if (run.economy.gold < relic.price) {
        bg.setAlpha(0.4); label.setAlpha(0.4); price.setAlpha(0.4);
      } else {
        bg.on('pointerdown', () => {
          const adapter = this.getRunAdapter();
          if (ShopSystem.buyRelic(adapter, relic.relicId, relic.price)) {
            this.syncFromAdapter(adapter);
            this.refreshBalances();
            bg.setAlpha(0.3);
            bg.removeInteractive();
          }
        });
      }
    });
  }

  private buildSellTilesSection(fontFamily: string): void {
    const run = getRun();

    this.add.text(140, 455, 'Sell Tiles', {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
    });

    const tileInv = run.economy.tileInventory;
    const entries = Object.entries(tileInv).filter(([_, count]) => count > 0);

    if (entries.length === 0) {
      this.add.text(140, 480, 'No tiles to sell.', {
        fontSize: '14px', color: COLORS.textSecondary, fontFamily,
      });
      return;
    }

    entries.forEach(([tileType, count], i) => {
      const x = 220 + i * 160;
      const y = 485;
      const bg = this.add.rectangle(x, y, 140, 36, 0x333333).setInteractive({ useHandCursor: true });
      this.add.text(x - 50, y, `${tileType} x${count}`, {
        fontSize: '12px', color: COLORS.textPrimary, fontFamily,
      }).setOrigin(0, 0.5);

      bg.on('pointerdown', () => {
        const adapter = this.getRunAdapter();
        if (ShopSystem.sellTile(adapter, tileType)) {
          this.syncFromAdapter(adapter);
          this.refreshBalances();
          bg.setAlpha(0.3);
          bg.removeInteractive();
        }
      });
    });
  }

  /** Adapter: convert global RunState to ShopSystem's expected shape */
  private getRunAdapter(): any {
    const run = getRun();
    return {
      deck: { cards: [], order: [...run.deck.active] },
      economy: {
        gold: run.economy.gold,
        tilePoints: run.economy.tilePoints,
      },
      tileInventory: Object.entries(run.economy.tileInventory)
        .filter(([_, count]) => count > 0)
        .map(([tileType, count]) => ({ tileType, count })),
      relics: [...run.relics],
    };
  }

  /** Sync adapter changes back to global RunState */
  private syncFromAdapter(adapter: any): void {
    const run = getRun();
    run.economy.gold = adapter.economy.gold;
    run.economy.tilePoints = adapter.economy.tilePoints;
    run.deck.active = [...adapter.deck.order];
    run.relics = [...adapter.relics];
    // Sync tile inventory
    run.economy.tileInventory = {};
    for (const entry of adapter.tileInventory) {
      run.economy.tileInventory[entry.tileType] = entry.count;
    }
  }

  private refreshBalances(): void {
    const run = getRun();
    this.goldText.setText(`\u25C6 ${run.economy.gold}`);
    this.tpText.setText(`${run.economy.tilePoints} TP`);
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  private cleanup(): void {
    // No external listeners to clean
  }
}
