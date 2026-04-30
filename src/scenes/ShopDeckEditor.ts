// ShopDeckEditor -- full-screen deck reorder overlay with card-grid drag-and-drop.
// Cards are displayed as visual cards in a grid. Dragging a card shows an enlarged
// version with description that follows the mouse. Other cards shift to make space.

import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { REORDER_SESSION_COST } from '../systems/deck/DeckSystem';
import { getCardById } from '../data/DataLoader';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';
import type { CardCategory } from '../data/types';

const COLS = 6;
const CARD_W = 80;
const CARD_H = 106;
const GAP = 10;
const GRID_TOP = 110;

const RARITY_COLORS: Record<string, number> = {
  common: 0xcccccc, uncommon: 0x33cc33, rare: 0xff6600, epic: 0xaa00ff,
};

const CATEGORY_COLORS: Record<CardCategory, number> = {
  attack: 0xcc3333, defense: 0x3366cc, magic: 0x9933cc,
};

export class ShopDeckEditor extends Scene {
  private deckOrder: string[] = [];
  private cardSlots: Phaser.GameObjects.Container[] = [];
  private gridContainer!: Phaser.GameObjects.Container;
  private dragCard: Phaser.GameObjects.Container | null = null;
  private dragIndex = -1;
  private hoverIndex = -1;
  private goldText!: Phaser.GameObjects.Text;
  private paid = false;
  private scrollY = 0;
  private maxScroll = 0;

  constructor() {
    super('ShopDeckEditor');
  }

  create(): void {
    const run = getRun();
    this.deckOrder = [...run.deck.active];
    this.paid = false;
    this.scrollY = 0;

    this.cameras.main.setBackgroundColor(COLORS.background);
    const fontFamily = FONTS.family;

    // Title
    this.add.text(LAYOUT.centerX, 24, 'Reorder Deck', {
      ...FONTS.title, color: COLORS.accent, fontFamily,
    }).setOrigin(0.5);

    // Gold
    this.goldText = this.add.text(LAYOUT.canvasWidth - 20, 24, `Gold: ${run.economy.gold}`, {
      ...FONTS.small, color: COLORS.accent, fontFamily,
    }).setOrigin(1, 0);

    // Instructions
    this.add.text(LAYOUT.centerX, 58, 'Drag cards to reorder your deck. Order determines play sequence.', {
      fontSize: '13px', color: COLORS.textSecondary, fontFamily, fontStyle: 'italic',
    }).setOrigin(0.5);

    // Cost info
    const costInfo = this.paid
      ? 'Reorder active — drag freely'
      : `First move costs ${REORDER_SESSION_COST} gold`;
    this.add.text(LAYOUT.centerX, 78, costInfo, {
      fontSize: '12px', color: COLORS.textSecondary, fontFamily,
    }).setOrigin(0.5);

    // Grid container
    this.gridContainer = this.add.container(0, 0);

    // Build card grid
    this.rebuildGrid();

    // Scroll
    const totalRows = Math.ceil(this.deckOrder.length / COLS);
    const visibleH = LAYOUT.canvasHeight - GRID_TOP - 50;
    this.maxScroll = Math.max(0, totalRows * (CARD_H + GAP) - visibleH);

    if (this.maxScroll > 0) {
      this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
        if (this.dragCard) return; // don't scroll while dragging
        this.scrollY = Math.max(0, Math.min(this.maxScroll, this.scrollY + dy * 0.5));
        this.gridContainer.y = -this.scrollY;
      });
    }

    // Mask
    const maskGfx = this.make.graphics({ x: 0, y: 0 });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(0, GRID_TOP - 10, LAYOUT.canvasWidth, visibleH + 10);
    this.gridContainer.setMask(maskGfx.createGeometryMask());

    // Pointer move — update drag card position
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragCard) return;
      this.dragCard.x = pointer.x;
      this.dragCard.y = pointer.y;

      // Calculate hover index for gap insertion
      const gridY = pointer.y + this.scrollY;
      const newHover = this.getSlotIndex(pointer.x, gridY);
      if (newHover !== this.hoverIndex) {
        this.hoverIndex = newHover;
        this.animateSlots();
      }
    });

    // Pointer up — drop card
    this.input.on('pointerup', () => {
      if (!this.dragCard) return;
      this.dropCard();
    });

    // Buttons
    createButton(this, LAYOUT.centerX - 100, LAYOUT.canvasHeight - 25, 'Done', () => this.close(), 'primary');
    createButton(this, LAYOUT.centerX + 100, LAYOUT.canvasHeight - 25, 'Cancel', () => this.cancel(), 'secondary');

    this.input.keyboard?.on('keydown-ESC', () => this.cancel());
    this.events.on('shutdown', this.cleanup, this);
  }

  private getGridLeft(): number {
    return LAYOUT.centerX - ((COLS * (CARD_W + GAP) - GAP) / 2);
  }

  private getSlotPos(index: number): { x: number; y: number } {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const gridLeft = this.getGridLeft();
    return {
      x: gridLeft + col * (CARD_W + GAP) + CARD_W / 2,
      y: GRID_TOP + row * (CARD_H + GAP) + CARD_H / 2,
    };
  }

  private getSlotIndex(px: number, gridY: number): number {
    const gridLeft = this.getGridLeft();
    const col = Math.floor((px - gridLeft) / (CARD_W + GAP));
    const row = Math.floor((gridY - GRID_TOP) / (CARD_H + GAP));
    const clampCol = Math.max(0, Math.min(COLS - 1, col));
    const clampRow = Math.max(0, row);
    const idx = clampRow * COLS + clampCol;
    return Math.max(0, Math.min(this.deckOrder.length, idx));
  }

  private rebuildGrid(): void {
    // Destroy old slots
    for (const slot of this.cardSlots) slot.destroy(true);
    this.cardSlots = [];

    for (let i = 0; i < this.deckOrder.length; i++) {
      const pos = this.getSlotPos(i);
      const slot = this.createMiniCard(this.deckOrder[i], pos.x, pos.y, i);
      this.gridContainer.add(slot);
      this.cardSlots.push(slot);
    }
  }

  private createMiniCard(cardId: string, x: number, y: number, index: number): Phaser.GameObjects.Container {
    const card = getCardById(cardId);
    const container = this.add.container(x, y);

    // BG
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x222222);
    const rarityColor = card ? (RARITY_COLORS[card.rarity] ?? RARITY_COLORS.common) : RARITY_COLORS.common;
    bg.setStrokeStyle(2, rarityColor);
    container.add(bg);

    // Category strip
    const catColor = card ? (CATEGORY_COLORS[card.category] ?? 0x888888) : 0x888888;
    container.add(this.add.rectangle(0, -CARD_H / 2 + 3, CARD_W - 4, 6, catColor));

    // Order number
    container.add(this.add.text(-CARD_W / 2 + 4, -CARD_H / 2 + 8, `${index + 1}`, {
      fontSize: '10px', color: COLORS.textSecondary, fontFamily: FONTS.family,
    }));

    // Name
    const isUpgraded = (() => { try { return getRun().deck.upgradedCards?.includes(cardId) ?? false; } catch { return false; } })();
    const displayName = isUpgraded ? `${card?.name ?? cardId}+` : (card?.name ?? cardId);
    const nameColor = isUpgraded ? COLORS.accent : '#ffffff';
    container.add(this.add.text(0, 2, displayName, {
      fontSize: '13px', color: nameColor, fontFamily: FONTS.family,
      wordWrap: { width: CARD_W - 8 }, align: 'center',
    }).setOrigin(0.5));

    // Cost
    if (card?.cost) {
      const costVal = card.cost.mana ?? card.cost.stamina ?? card.cost.defense ?? 0;
      const costColor = card.cost.mana ? '#6a5acd' : card.cost.defense ? '#3366cc' : '#ff8c00';
      container.add(this.add.text(-CARD_W / 2 + 4, CARD_H / 2 - 4, `${costVal}`, {
        fontSize: '11px', color: costColor, fontFamily: FONTS.family,
      }).setOrigin(0, 1));
    }

    // Cooldown
    if (card) {
      container.add(this.add.text(CARD_W / 2 - 4, CARD_H / 2 - 4, `${card.cooldown}s`, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: FONTS.family,
      }).setOrigin(1, 1));
    }

    // Interactive — start drag on pointerdown
    container.setSize(CARD_W, CARD_H);
    container.setInteractive({ useHandCursor: true });
    container.setData('index', index);
    container.setData('cardId', cardId);

    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.startDrag(index, pointer);
    });

    return container;
  }

  private startDrag(index: number, pointer: Phaser.Input.Pointer): void {
    // Pay gold on first drag
    if (!this.paid) {
      const run = getRun();
      if (run.economy.gold < REORDER_SESSION_COST) {
        this.showFlash('Not enough gold!');
        return;
      }
      run.economy.gold -= REORDER_SESSION_COST;
      this.paid = true;
      this.goldText.setText(`Gold: ${run.economy.gold}`);
    }

    this.dragIndex = index;
    this.hoverIndex = index;

    // Hide the slot being dragged
    if (this.cardSlots[index]) {
      this.cardSlots[index].setAlpha(0.3);
    }

    // Create enlarged drag visual with description
    const cardId = this.deckOrder[index];
    this.dragCard = this.createDragVisual(cardId, pointer.x, pointer.y);
  }

  private createDragVisual(cardId: string, x: number, y: number): Phaser.GameObjects.Container {
    const card = getCardById(cardId);
    const w = 160;
    const h = 200;
    const container = this.add.container(x, y);
    container.setDepth(1000);

    // BG
    const rarityColor = card ? (RARITY_COLORS[card.rarity] ?? RARITY_COLORS.common) : RARITY_COLORS.common;
    const bg = this.add.rectangle(0, 0, w, h, 0x1a1a2e, 0.95);
    bg.setStrokeStyle(3, rarityColor);
    container.add(bg);

    // Category strip
    const catColor = card ? (CATEGORY_COLORS[card.category] ?? 0x888888) : 0x888888;
    container.add(this.add.rectangle(0, -h / 2 + 4, w - 6, 8, catColor));

    const fontFamily = FONTS.family;
    let yOff = -h / 2 + 24;

    // Name
    const isUpgraded = (() => { try { return getRun().deck.upgradedCards?.includes(cardId) ?? false; } catch { return false; } })();
    const name = isUpgraded ? `${card?.name ?? cardId}+` : (card?.name ?? cardId);
    container.add(this.add.text(0, yOff, name, {
      fontSize: '18px', fontStyle: 'bold', color: isUpgraded ? COLORS.accent : '#ffffff', fontFamily,
    }).setOrigin(0.5, 0));
    yOff += 24;

    // Description
    if (card) {
      const desc = (isUpgraded && card.upgraded?.description) ? card.upgraded.description : card.description;
      const descText = this.add.text(0, yOff, desc, {
        fontSize: '13px', color: COLORS.textPrimary, fontFamily,
        wordWrap: { width: w - 16 }, align: 'center', lineSpacing: 2,
      }).setOrigin(0.5, 0);
      container.add(descText);
      yOff += descText.height + 10;
    }

    // Stats line
    if (card) {
      const stats: string[] = [];
      stats.push(`${card.cooldown}s`);
      if (card.cost?.stamina) stats.push(`${card.cost.stamina} Sta`);
      if (card.cost?.mana) stats.push(`${card.cost.mana} Mana`);
      if (card.cost?.defense) stats.push(`${card.cost.defense} Def`);
      stats.push(card.targeting === 'single' ? 'Single' : card.targeting === 'aoe' ? 'AoE' : card.targeting);

      container.add(this.add.text(0, yOff, stats.join(' · '), {
        fontSize: '11px', color: COLORS.textSecondary, fontFamily,
      }).setOrigin(0.5, 0));
    }

    // Shadow effect
    container.setAlpha(0.95);
    this.tweens.add({ targets: container, scaleX: 1.02, scaleY: 1.02, duration: 100 });

    return container;
  }

  /** Animate existing slots to open/close gap at hoverIndex */
  private animateSlots(): void {
    // Build visual order: deckOrder without the dragged card, insert gap at hoverIndex
    const displayOrder: number[] = [];
    for (let i = 0; i < this.deckOrder.length; i++) {
      if (i === this.dragIndex) continue;
      displayOrder.push(i);
    }

    // Insert gap position
    const gapAt = Math.min(this.hoverIndex, displayOrder.length);

    let visualIdx = 0;
    for (let i = 0; i < displayOrder.length; i++) {
      if (i === gapAt) visualIdx++; // skip one slot for the gap
      const realIdx = displayOrder[i];
      const slot = this.cardSlots[realIdx];
      if (!slot) continue;

      const targetPos = this.getSlotPos(visualIdx);
      this.tweens.add({
        targets: slot,
        x: targetPos.x,
        y: targetPos.y,
        duration: 150,
        ease: 'Sine.easeOut',
        overwrite: true,
      });
      visualIdx++;
    }
  }

  private dropCard(): void {
    if (this.dragIndex < 0 || !this.dragCard) return;

    // Destroy drag visual
    this.dragCard.destroy(true);
    this.dragCard = null;

    // Compute new order
    const cardId = this.deckOrder[this.dragIndex];
    const newOrder = [...this.deckOrder];
    newOrder.splice(this.dragIndex, 1);
    const insertAt = Math.min(this.hoverIndex, newOrder.length);
    newOrder.splice(insertAt, 0, cardId);
    this.deckOrder = newOrder;

    this.dragIndex = -1;
    this.hoverIndex = -1;

    // Rebuild
    this.rebuildGrid();
  }

  private showFlash(msg: string): void {
    const flash = this.add.text(LAYOUT.centerX, LAYOUT.centerY, msg, {
      fontSize: '18px', color: COLORS.danger, fontFamily: FONTS.family,
    }).setOrigin(0.5).setDepth(900);
    this.tweens.add({ targets: flash, alpha: 0, duration: 1000, onComplete: () => flash.destroy() });
  }

  private close(): void {
    // Apply the reorder if paid. Gold was already deducted when the first drag started.
    if (this.paid) {
      const run = getRun();
      run.deck.active = [...this.deckOrder];
    }
    this.scene.stop();
    this.scene.resume('ShopScene');
  }

  private cancel(): void {
    // Revert — don't apply changes. Gold already spent is lost (session cost).
    this.scene.stop();
    this.scene.resume('ShopScene');
  }

  private cleanup(): void {
    if (this.dragCard) {
      this.dragCard.destroy(true);
      this.dragCard = null;
    }
    this.cardSlots = [];
  }
}
