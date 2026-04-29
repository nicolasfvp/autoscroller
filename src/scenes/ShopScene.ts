import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { ShopSystem } from '../systems/ShopSystem';
import { getCardById, getRelicById } from '../data/DataLoader';
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
    this.add.image(400, 300, 'wood_texture').setDisplaySize(650, 500).setInteractive();

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
    this.buildAllSections(fontFamily);

    // "Leave Shop" button
    createButton(this, 400, 530, 'Leave Shop', () => this.close(), 'primary');

    this.events.on('shutdown', this.cleanup, this);
  }

  /** Container holding all shop sections -- destroyed on refresh */
  private sectionsContainer!: Phaser.GameObjects.Container;

  private buildAllSections(fontFamily: string): void {
    if (this.sectionsContainer) {
      this.sectionsContainer.destroy(true);
    }
    this.sectionsContainer = this.add.container(0, 0);
    this.buildBuyCardsSection(fontFamily);
    this.buildRemoveCardsSection(fontFamily);
    this.buildReorderSection(fontFamily);
    this.buildUpgradeSection(fontFamily);
    this.buildBuyRelicsSection(fontFamily);
    this.buildSellTilesSection(fontFamily);
  }

  /** Refresh entire shop UI after any mutation (feedback #38) */
  private refreshShop(): void {
    this.refreshBalances();
    this.buildAllSections(FONTS.family);
  }

  private buildBuyCardsSection(fontFamily: string): void {
    const run = getRun();
    const runAdapter = this.getRunAdapter();
    const availableCards = run.pool.cards;
    const shopCards = ShopSystem.getShopCards(runAdapter, availableCards, run.loop.count);

    this.sectionsContainer.add(this.add.text(140, 110, 'Buy Cards', {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
    }));

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
      this.sectionsContainer.add([bg, label, price]);

      if (run.economy.gold < card.price) {
        bg.setAlpha(0.4); label.setAlpha(0.4); price.setAlpha(0.4);
      } else {
        bg.on('pointerdown', () => {
          const adapter = this.getRunAdapter();
          if (ShopSystem.buyCard(adapter, card.cardId, card.price)) {
            this.syncFromAdapter(adapter);
            this.refreshShop();
          }
        });
      }
    });
  }

  private buildRemoveCardsSection(fontFamily: string): void {
    const run = getRun();
    const deckCards = run.deck.active;
    const cost = ShopSystem.getRemoveCardCost(deckCards.length);

    this.sectionsContainer.add(this.add.text(140, 195, `Remove Cards (${cost} Gold each)`, {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
    }));

    // Show ALL deck cards, scrollable (feedback #20)
    const maxShow = Math.min(deckCards.length, 8);
    const cardW = 80;
    const cols = Math.min(maxShow, 4);
    for (let i = 0; i < maxShow; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 180 + col * (cardW + 10);
      const y = 228 + row * 32;
      const cardId = deckCards[i];
      const cardDef = getCardById(cardId);
      const displayName = cardDef?.name ?? cardId;
      const bg = this.add.rectangle(x, y, cardW, 26, 0x333333).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y, displayName, {
        fontSize: '11px', color: COLORS.textPrimary, fontFamily,
      }).setOrigin(0.5);
      this.sectionsContainer.add([bg, label]);

      if (run.economy.gold < cost || deckCards.length <= 3) {
        bg.setAlpha(0.4); label.setAlpha(0.4);
      } else {
        bg.on('pointerdown', () => {
          const adapter = this.getRunAdapter();
          if (ShopSystem.removeCard(adapter, i)) {
            this.syncFromAdapter(adapter);
            this.refreshShop();
          }
        });
      }
    }
  }

  private buildReorderSection(fontFamily: string): void {
    this.sectionsContainer.add(this.add.text(140, 270, 'Reorder Deck', {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
    }));

    const reorderBtn = this.add.text(320, 270, 'Open Deck Editor', {
      fontSize: '14px', color: COLORS.accent, fontFamily,
    }).setInteractive({ useHandCursor: true });
    this.sectionsContainer.add(reorderBtn);

    reorderBtn.on('pointerover', () => reorderBtn.setColor(COLORS.accentHover));
    reorderBtn.on('pointerout', () => reorderBtn.setColor(COLORS.accent));
    reorderBtn.on('pointerdown', () => {
      this.scene.pause();
      this.scene.launch('ShopDeckEditor');
      this.events.once('resume', () => {
        this.refreshShop();
      });
    });
  }

  private buildUpgradeSection(fontFamily: string): void {
    const run = getRun();
    const deckCards = run.deck.active;
    const upgradedCards = run.deck.upgradedCards ?? [];

    this.sectionsContainer.add(this.add.text(140, 300, 'Upgrade Cards', {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
    }));

    const maxShow = Math.min(deckCards.length, 8);
    const cols = Math.min(maxShow, 4);
    for (let i = 0; i < maxShow; i++) {
      const cardId = deckCards[i];
      const card = getCardById(cardId);
      const rarity = card?.rarity ?? 'common';
      const cardName = card?.name ?? cardId;
      const isUpgraded = upgradedCards.includes(cardId);
      const price = ShopSystem.getUpgradePrice(rarity);

      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 180 + col * 120;
      const y = 335 + row * 38;
      const bg = this.add.rectangle(x, y, 110, 32, 0x333333).setInteractive({ useHandCursor: true });
      const displayName = isUpgraded ? `${cardName}+` : cardName;
      const nameColor = isUpgraded ? '#888888' : '#ffffff';
      const label = this.add.text(x, y - 6, displayName, {
        fontSize: '11px', color: nameColor, fontFamily,
      }).setOrigin(0.5);
      this.sectionsContainer.add([bg, label]);

      if (isUpgraded) {
        const upgLabel = this.add.text(x, y + 8, 'UPGRADED', {
          fontSize: '9px', color: '#888888', fontFamily,
        }).setOrigin(0.5);
        bg.setAlpha(0.4); label.setAlpha(0.4); upgLabel.setAlpha(0.4);
        this.sectionsContainer.add(upgLabel);
      } else {
        const priceLabel = this.add.text(x, y + 8, `${price} Gold`, {
          fontSize: '9px', color: COLORS.accent, fontFamily,
        }).setOrigin(0.5);
        this.sectionsContainer.add(priceLabel);

        if (run.economy.gold < price) {
          bg.setAlpha(0.4); label.setAlpha(0.4); priceLabel.setAlpha(0.4);
        } else {
          bg.on('pointerdown', () => {
            if (ShopSystem.upgradeCard(run as any, cardId, rarity)) {
              this.refreshShop();
            }
          });
        }
      }
    }
  }

  private buildBuyRelicsSection(fontFamily: string): void {
    const run = getRun();
    const runAdapter = this.getRunAdapter();
    const availableRelics = run.pool.relics;
    const shopRelics = ShopSystem.getShopRelics(runAdapter, availableRelics);

    this.sectionsContainer.add(this.add.text(140, 385, 'Buy Relics', {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
    }));

    if (shopRelics.length === 0) {
      this.sectionsContainer.add(this.add.text(140, 415, 'No relics in stock this visit.', {
        fontSize: '14px', color: COLORS.textSecondary, fontFamily,
      }));
      return;
    }

    shopRelics.forEach((relic, i) => {
      const x = 220 + i * 180;
      const y = 430;
      const bg = this.add.rectangle(x, y, 160, 56, 0x333333).setInteractive({ useHandCursor: true });
      const relicDef = getRelicById(relic.relicId);
      const label = this.add.text(x, y - 16, relic.name, {
        fontSize: '14px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
      }).setOrigin(0.5);
      
      const effectDesc = relicDef?.effect ?? 'Unknown effect';
      const descLabel = this.add.text(x, y + 2, effectDesc, {
        fontSize: '10px', color: '#00ccff', fontFamily,
        wordWrap: { width: 152 }, align: 'center'
      }).setOrigin(0.5);

      const price = this.add.text(x, y + 20, `${relic.price} Gold`, {
        fontSize: '11px', color: COLORS.accent, fontFamily,
      }).setOrigin(0.5);

      this.sectionsContainer.add([bg, label, descLabel, price]);

      if (run.economy.gold < relic.price) {
        bg.setAlpha(0.4); label.setAlpha(0.4); descLabel.setAlpha(0.4); price.setAlpha(0.4);
      } else {
        bg.on('pointerdown', () => {
          const adapter = this.getRunAdapter();
          if (ShopSystem.buyRelic(adapter, relic.relicId, relic.price)) {
            this.syncFromAdapter(adapter);
            this.refreshShop();
          }
        });
      }
    });
  }

  private buildSellTilesSection(fontFamily: string): void {
    const run = getRun();

    this.sectionsContainer.add(this.add.text(140, 480, 'Sell Tiles', {
      fontSize: '16px', fontStyle: 'bold', color: COLORS.textPrimary, fontFamily,
    }));

    const tileInv = run.economy.tileInventory;
    const entries = Object.entries(tileInv || {}).filter(([_, count]) => count > 0);

    if (entries.length === 0) {
      this.sectionsContainer.add(this.add.text(140, 505, 'Your tile inventory is empty.', {
        fontSize: '14px', color: COLORS.textSecondary, fontFamily,
      }));
      return;
    }

    entries.forEach(([tileType, count], i) => {
      const x = 200 + i * 160;
      const y = 515;
      const sellPrice = ShopSystem.getTileSellPrice();
      const bg = this.add.rectangle(x, y, 140, 36, 0x333333).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y - 6, `${tileType} (${count})`, {
        fontSize: '12px', color: COLORS.textPrimary, fontFamily,
      }).setOrigin(0.5);
      const priceLabel = this.add.text(x, y + 10, `Sell: ${sellPrice} Gold`, {
        fontSize: '10px', color: COLORS.accent, fontFamily,
      }).setOrigin(0.5);

      this.sectionsContainer.add([bg, label, priceLabel]);

      bg.on('pointerdown', () => {
        const adapter = this.getRunAdapter();
        if (ShopSystem.sellTile(adapter, tileType)) {
          this.syncFromAdapter(adapter);
          this.refreshShop();
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
