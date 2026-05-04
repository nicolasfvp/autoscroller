import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { ShopSystem } from '../systems/ShopSystem';
import { getCardById, getRelicById } from '../data/DataLoader';
import { FONTS } from '../ui/StyleConstants';
import { AudioManager } from '../systems/AudioManager';

// ── Design tokens ────────────────────────────────────────────
const FF    = FONTS.family;
const GOLD  = '#ffd700';
const WHITE = '#ffffff';
const DIM   = '#998877';
const CYAN  = '#66ddff';
const RED   = '#ff6655';
const GREEN = '#88ee88';

// ── Panel geometry (centered on 800px canvas) ─────────────────
const PANEL_W     = 470;
const PANEL_CX    = 400;
const PANEL_LEFT  = PANEL_CX - PANEL_W / 2;  // 165
const PANEL_RIGHT = PANEL_CX + PANEL_W / 2;  // 635
const PAD         = 16;

type ShopCategory = 'buyCards' | 'upgrade' | 'remove' | 'relics';

// ── Menu categories ───────────────────────────────────────────
const CATEGORIES: { key: ShopCategory; icon: string; label: string; desc: string }[] = [
  { key: 'buyCards',  icon: '🃏', label: 'Buy Cards',     desc: 'Expand your deck with new cards' },
  { key: 'upgrade',   icon: '⬆',  label: 'Upgrade Cards', desc: 'Power up cards you already own' },
  { key: 'remove',    icon: '🗑',  label: 'Remove Cards',  desc: 'Thin your deck for consistency' },
  { key: 'relics',    icon: '💎', label: 'Buy Relics',    desc: 'Passive artifacts with powerful effects' },
];

// ── Helpers ──────────────────────────────────────────────────
function colX(col: number, cols: number, itemW: number, gapW: number): number {
  const total = cols * itemW + (cols - 1) * gapW;
  const left  = PANEL_LEFT + (PANEL_W - total) / 2;
  return left + col * (itemW + gapW) + itemW / 2;
}

function cardSlot(
  scene: Scene, x: number, y: number, w: number, h: number,
  canAfford: boolean, onBuy: () => void,
): Phaser.GameObjects.Rectangle {
  const fill   = canAfford ? 0x3d2010 : 0x1e1008;
  const border = canAfford ? 0x9a6030 : 0x4a3020;
  const alpha  = canAfford ? 0.92 : 0.5;
  const bg = scene.add.rectangle(x, y, w, h, fill, alpha).setStrokeStyle(1.5, border);
  if (canAfford) {
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x5a3018, 0.98));
    bg.on('pointerout',  () => bg.setFillStyle(fill, alpha));
    bg.on('pointerdown', onBuy);
  }
  return bg;
}

// ── Scene ────────────────────────────────────────────────────
export class ShopScene extends Scene {
  private goldText!: Phaser.GameObjects.Text;
  private tpText!: Phaser.GameObjects.Text;
  private menuContainer!: Phaser.GameObjects.Container;
  private modalContainer!: Phaser.GameObjects.Container;

  constructor() { super('ShopScene'); }

  create(): void {
    const run = getRun();

    // Background
    this.add.image(400, 300, 'bg_shop_scene').setDisplaySize(800, 600);

    // Panel dark overlay
    this.add.rectangle(PANEL_CX, 300, PANEL_W, 600, 0x130800, 0.82);
    this.add.rectangle(PANEL_RIGHT, 300, 3, 600, 0x9a6030, 0.5);

    // Header strip
    this.add.rectangle(PANEL_CX, 24, PANEL_W, 48, 0x0a0400, 0.95);
    this.add.rectangle(PANEL_CX, 47, PANEL_W, 2, 0x9a6030, 0.7);

    this.add.text(PANEL_CX, 24, '⚒  Shop', {
      fontSize: '23px', fontStyle: 'bold', color: GOLD,
      fontFamily: FF, stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true);

    // Gold badge
    this.add.rectangle(PANEL_RIGHT - 4, 8, 130, 18, 0x3a2008, 0.92)
      .setOrigin(1, 0).setStrokeStyle(1, 0x9a6030);
    this.goldText = this.add.text(PANEL_RIGHT - 8, 9, `♦ ${run.economy.gold} Gold`, {
      fontSize: '12px', fontStyle: 'bold', color: GOLD,
      fontFamily: FF, stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0);

    this.add.rectangle(PANEL_RIGHT - 4, 27, 80, 16, 0x3a2008, 0.92)
      .setOrigin(1, 0).setStrokeStyle(1, 0x9a6030);
    this.tpText = this.add.text(PANEL_RIGHT - 8, 28, `${run.economy.tilePoints} TP`, {
      fontSize: '12px', color: CYAN, fontFamily: FF,
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0);

    // Build main menu
    this.buildMenu();

    // Leave Shop
    const leave = this.add.text(PANEL_CX, 592, 'Leave Shop', {
      fontSize: '21px', fontStyle: 'bold', color: GOLD,
      fontFamily: FF, stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true })
      .setShadow(2, 2, '#000', 2, true, true);
    leave.on('pointerover', () => leave.setColor(WHITE));
    leave.on('pointerout',  () => leave.setColor(GOLD));
    leave.on('pointerdown', () => this.close());

    this.events.on('shutdown', this.cleanup, this);
  }

  // ── Main Menu ─────────────────────────────────────────────────
  private buildMenu(): void {
    if (this.menuContainer) this.menuContainer.destroy(true);
    this.menuContainer = this.add.container(0, 0);

    const BTN_H  = 74;
    const BTN_W  = PANEL_W - 30;
    const BTN_X  = PANEL_CX;
    const START_Y = 110;
    const GAP    = 8;

    CATEGORIES.forEach((cat, i) => {
      const y = START_Y + i * (BTN_H + GAP) + BTN_H / 2;

      // Button background
      const bg = this.add.rectangle(BTN_X, y, BTN_W, BTN_H, 0x2a1408, 0.88)
        .setStrokeStyle(1.5, 0x7a4820).setInteractive({ useHandCursor: true });

      // Hover effects
      bg.on('pointerover', () => {
        bg.setFillStyle(0x4a2810, 0.95);
        bg.setStrokeStyle(2, 0xffd700);
      });
      bg.on('pointerout', () => {
        bg.setFillStyle(0x2a1408, 0.88);
        bg.setStrokeStyle(1.5, 0x7a4820);
      });
      bg.on('pointerdown', () => this.openModal(cat.key));

      // Icon
      const icon = this.add.text(PANEL_LEFT + PAD + 14, y, cat.icon, {
        fontSize: '26px', fontFamily: FF,
      }).setOrigin(0.5);

      // Label
      const label = this.add.text(PANEL_LEFT + PAD + 36, y - 12, cat.label, {
        fontSize: '17px', fontStyle: 'bold', color: GOLD,
        fontFamily: FF, stroke: '#000', strokeThickness: 3,
      });

      // Description
      const desc = this.add.text(PANEL_LEFT + PAD + 36, y + 10, cat.desc, {
        fontSize: '12px', color: DIM, fontFamily: FF,
      });

      // Arrow indicator
      const arrow = this.add.text(PANEL_RIGHT - PAD - 6, y, '▶', {
        fontSize: '16px', color: '#7a4820', fontFamily: FF,
      }).setOrigin(1, 0.5);

      this.menuContainer.add([bg, icon, label, desc, arrow]);
    });

    // Deck and Relic links (below menu buttons)
    const baseY = START_Y + CATEGORIES.length * (BTN_H + GAP) + 20;

    const deckBtn = this.add.text(PANEL_CX, baseY, '📖 Open Deck Editor', {
      fontSize: '13px', fontStyle: 'bold', color: '#aaddff',
      fontFamily: FF, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    
    deckBtn.on('pointerover', () => deckBtn.setColor(WHITE));
    deckBtn.on('pointerout',  () => deckBtn.setColor('#aaddff'));
    deckBtn.on('pointerdown', () => {
      this.scene.pause();
      this.scene.launch('DeckCustomizationScene', { parentScene: 'ShopScene' });
      this.events.once('resume', () => this.buildMenu());
    });

    const relicBtn = this.add.text(PANEL_CX, baseY + 25, '💎 Open Relics', {
      fontSize: '13px', fontStyle: 'bold', color: '#aaddff',
      fontFamily: FF, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    
    relicBtn.on('pointerover', () => relicBtn.setColor(WHITE));
    relicBtn.on('pointerout',  () => relicBtn.setColor('#aaddff'));
    relicBtn.on('pointerdown', () => {
      this.scene.pause();
      this.scene.launch('RelicViewerScene', { parentScene: 'ShopScene' });
      this.events.once('resume', () => this.buildMenu());
    });

    this.menuContainer.add([deckBtn, relicBtn]);
  }

  // ── Modal ─────────────────────────────────────────────────────
  private openModal(category: ShopCategory): void {
    this.menuContainer.setVisible(false);
    if (this.modalContainer) this.modalContainer.destroy(true);
    this.modalContainer = this.add.container(0, 0);

    // Modal background (full panel overlay)
    const modalBg = this.add.rectangle(PANEL_CX, 300, PANEL_W, 600, 0x0a0400, 0.96)
      .setStrokeStyle(2, 0x9a6030);
    this.modalContainer.add(modalBg);

    // Build content
    switch (category) {
      case 'buyCards':   this.modalBuyCards(); break;
      case 'upgrade':    this.modalUpgrade(); break;
      case 'remove':     this.modalRemove(); break;
      case 'relics':     this.modalRelics(); break;
    }

    // Back button
    const back = this.add.text(PANEL_CX, 574, '← Back to Shop', {
      fontSize: '16px', fontStyle: 'bold', color: '#aaddff',
      fontFamily: FF, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setColor(WHITE));
    back.on('pointerout',  () => back.setColor('#aaddff'));
    back.on('pointerdown', () => this.closeModal());
    this.modalContainer.add(back);
  }

  private closeModal(): void {
    if (this.modalContainer) this.modalContainer.destroy(true);
    this.menuContainer.setVisible(true);
    this.refreshBalances();
    this.buildMenu();
  }

  // ── Modal: Buy Cards ──────────────────────────────────────────
  private modalBuyCards(): void {
    const run   = getRun();
    const cards = ShopSystem.getShopCards(this.getRunAdapter(), run.pool.cards, run.loop.count);

    this.modalTitle('🃏 Buy Cards');
    const COLS = 3; const CW = 134; const CH = 60; const GAP = 6;
    let y = 105;

    if (cards.length === 0) {
      this.modalEmpty('No cards available this visit.');
      return;
    }

    cards.forEach((card, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x   = colX(col, COLS, CW, GAP);
      const cy  = y + row * (CH + GAP) + CH / 2;
      const ok  = run.economy.gold >= card.price;

      const bg = cardSlot(this, x, cy, CW, CH, ok, () => {
        const adp = this.getRunAdapter();
        if (ShopSystem.buyCard(adp, card.cardId, card.price)) {
          AudioManager.playSFX(this, 'sfx_cashing', 0.6);
          this.syncFromAdapter(adp); this.closeModal(); this.openModal('buyCards');
        }
      });
      const name = this.add.text(x, cy - 13, card.name, {
        fontSize: '13px', fontStyle: 'bold', color: ok ? WHITE : DIM,
        fontFamily: FF, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);
      const price = this.add.text(x, cy + 9, `${card.price} Gold`, {
        fontSize: '12px', color: ok ? GOLD : RED, fontFamily: FF,
      }).setOrigin(0.5);
      this.modalContainer.add([bg, name, price]);
    });
  }

  // ── Modal: Upgrade Cards ──────────────────────────────────────
  private modalUpgrade(): void {
    const run      = getRun();
    const upgraded = run.deck.upgradedCards ?? [];
    const deckCards = run.deck.active;

    this.modalTitle('⬆ Upgrade Cards');
    const COLS = 3; const CW = 134; const CH = 58; const GAP = 6;
    let y = 105;

    deckCards.forEach((cardId, i) => {
      const col    = i % COLS;
      const row    = Math.floor(i / COLS);
      if (row > 2) return; // max 3 rows
      const card   = getCardById(cardId);
      const rarity = card?.rarity ?? 'common';
      const isUpg  = upgraded.includes(cardId);
      const price  = ShopSystem.getUpgradePrice(rarity);
      const ok     = !isUpg && run.economy.gold >= price;
      const x      = colX(col, COLS, CW, GAP);
      const cy     = y + row * (CH + GAP) + CH / 2;

      const bg = cardSlot(this, x, cy, CW, CH, ok, () => {
        if (ShopSystem.upgradeCard(run as any, cardId, rarity)) {
          AudioManager.playSFX(this, 'sfx_cashing', 0.6);
          this.closeModal(); this.openModal('upgrade');
        }
      });
      if (isUpg) bg.setStrokeStyle(1.5, 0x44aa44);

      const display = isUpg ? `${card?.name ?? cardId}+` : (card?.name ?? cardId);
      const name = this.add.text(x, cy - 13, display, {
        fontSize: '12px', fontStyle: 'bold',
        color: isUpg ? GREEN : (ok ? WHITE : DIM),
        fontFamily: FF, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);
      const subT = this.add.text(x, cy + 9, isUpg ? 'Upgraded ✓' : `${price} Gold`, {
        fontSize: '11px',
        color: isUpg ? GREEN : (ok ? GOLD : RED), fontFamily: FF,
      }).setOrigin(0.5);
      this.modalContainer.add([bg, name, subT]);
    });
  }

  // ── Modal: Remove Cards ───────────────────────────────────────
  private modalRemove(): void {
    const run   = getRun();
    const cost  = ShopSystem.getRemoveCardCost(run.deck.active.length);
    const cards = run.deck.active;

    this.modalTitle(`🗑 Remove Cards  (${cost} Gold each)`);
    const COLS = 3; const CW = 134; const CH = 42; const GAP = 6;
    let y = 105;

    cards.forEach((cardId, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      if (row > 3) return; // max 4 rows
      const cardDef = getCardById(cardId);
      const ok = run.economy.gold >= cost && run.deck.active.length > 3;
      const x  = colX(col, COLS, CW, GAP);
      const cy = y + row * (CH + GAP) + CH / 2;

      const bg = cardSlot(this, x, cy, CW, CH, ok, () => {
        const adp = this.getRunAdapter();
        if (ShopSystem.removeCard(adp, i)) {
          AudioManager.playSFX(this, 'sfx_cashing', 0.6);
          this.syncFromAdapter(adp); this.closeModal(); this.openModal('remove');
        }
      });
      if (ok) bg.setStrokeStyle(1.5, 0xaa3322);

      const name = this.add.text(x, cy, cardDef?.name ?? cardId, {
        fontSize: '12px', color: ok ? WHITE : DIM,
        fontFamily: FF, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);
      this.modalContainer.add([bg, name]);
    });
  }

  // ── Modal: Buy Relics ─────────────────────────────────────────
  private modalRelics(): void {
    const run    = getRun();
    const relics = ShopSystem.getShopRelics(this.getRunAdapter(), run.pool.relics);

    this.modalTitle('💎 Buy Relics');

    if (relics.length === 0) {
      this.modalEmpty('No relics in stock this visit.');
      return;
    }

    const COLS = 2; const RW = 202; const RH = 76; const GAP = 8;
    let y = 110;

    relics.forEach((relic, i) => {
      const col    = i % COLS;
      const row    = Math.floor(i / COLS);
      const ok     = run.economy.gold >= relic.price;
      const relDef = getRelicById(relic.relicId);
      const x      = colX(col, COLS, RW, GAP);
      const cy     = y + row * (RH + GAP) + RH / 2;

      const bg = cardSlot(this, x, cy, RW, RH, ok, () => {
        const adp = this.getRunAdapter();
        if (ShopSystem.buyRelic(adp, relic.relicId, relic.price)) {
          AudioManager.playSFX(this, 'sfx_cashing', 0.6);
          this.syncFromAdapter(adp); this.closeModal(); this.openModal('relics');
        }
      });
      bg.setStrokeStyle(1.5, ok ? 0xbb8800 : 0x4a3020);

      const name = this.add.text(x, cy - 24, relic.name, {
        fontSize: '14px', fontStyle: 'bold', color: ok ? GOLD : DIM,
        fontFamily: FF, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);
      const effect = relDef?.effect ?? 'Unknown effect';
      const desc = this.add.text(x, cy - 4, effect, {
        fontSize: '10px', color: ok ? CYAN : DIM, fontFamily: FF,
        wordWrap: { width: RW - 12 }, align: 'center',
      }).setOrigin(0.5);
      const priceT = this.add.text(x, cy + 28, `${relic.price} Gold`, {
        fontSize: '13px', fontStyle: 'bold', color: ok ? GOLD : RED, fontFamily: FF,
      }).setOrigin(0.5);
      this.modalContainer.add([bg, name, desc, priceT]);
    });
  }

  // ── Modal Helpers ─────────────────────────────────────────────
  private modalTitle(text: string): void {
    // Decorative top bar
    this.add.rectangle(PANEL_CX, 60, PANEL_W - 12, 38, 0x3a2008, 0.9)
      .setStrokeStyle(1.5, 0x9a6030);
    const title = this.add.text(PANEL_CX, 60, text, {
      fontSize: '18px', fontStyle: 'bold', color: GOLD,
      fontFamily: FF, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setShadow(1, 1, '#000', 2, true, true);
    this.add.rectangle(PANEL_CX, 82, PANEL_W - 12, 1, 0x9a6030, 0.5);
    this.modalContainer.add([title]);
  }

  private modalEmpty(msg: string): void {
    const t = this.add.text(PANEL_CX, 280, msg, {
      fontSize: '15px', color: DIM, fontFamily: FF, align: 'center',
    }).setOrigin(0.5);
    this.modalContainer.add(t);
  }

  // ── Adapters ──────────────────────────────────────────────────
  private getRunAdapter(): any {
    const run = getRun();
    return {
      deck: { cards: [], order: [...run.deck.active] },
      economy: { gold: run.economy.gold, tilePoints: run.economy.tilePoints },
      tileInventory: Object.entries(run.economy.tileInventory)
        .filter(([, c]) => c > 0)
        .map(([tileType, count]) => ({ tileType, count })),
      relics: [...run.relics],
    };
  }

  private syncFromAdapter(adapter: any): void {
    const run = getRun();
    run.economy.gold = adapter.economy.gold;
    run.economy.tilePoints = adapter.economy.tilePoints;
    run.deck.active = [...adapter.deck.order];
    run.relics = [...adapter.relics];
    run.economy.tileInventory = {};
    for (const entry of adapter.tileInventory) {
      run.economy.tileInventory[entry.tileType] = entry.count;
    }
  }

  private refreshBalances(): void {
    const run = getRun();
    this.goldText.setText(`♦ ${run.economy.gold} Gold`);
    this.tpText.setText(`${run.economy.tilePoints} TP`);
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  private cleanup(): void { /* nothing */ }
}
