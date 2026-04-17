// DeckCustomizationScene -- deck viewer with drag-and-drop for dropped cards.
// Active deck cards are displayed but NOT draggable.
// Dropped (loot) cards appear in a separate strip and CAN be dragged into the deck.
// Uses the same drag-and-drop pattern as ShopDeckEditor.

import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
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

// ── Dropped cards strip constants ──
const STRIP_TOP = 110;
const STRIP_CARD_W = 64;
const STRIP_CARD_H = 86;
const STRIP_GAP = 8;
const STRIP_HEIGHT = STRIP_CARD_H + 20;

export class DeckCustomizationScene extends Scene {
  // Active deck state (working copy)
  private deckOrder: string[] = [];
  private cardSlots: Phaser.GameObjects.Container[] = [];
  private gridContainer!: Phaser.GameObjects.Container;

  // Dropped cards strip
  private droppedStrip!: Phaser.GameObjects.Container;

  // Drag state
  private dragCard: Phaser.GameObjects.Container | null = null;
  private dragFromDropped = false;
  private dragDroppedIndex = -1;
  private dragCardId = '';
  private hoverIndex = -1;

  private scrollY = 0;
  private maxScroll = 0;

  constructor() {
    super('DeckCustomizationScene');
  }

  create(): void {
    const run = getRun();
    this.deckOrder = [...run.deck.active];
    this.scrollY = 0;

    this.cameras.main.setBackgroundColor(COLORS.background);
    const fontFamily = FONTS.family;

    const hasDropped = run.deck.droppedCards.length > 0;

    // Title
    this.add.text(LAYOUT.centerX, 20, 'Your Deck', {
      ...FONTS.title, color: COLORS.accent, fontFamily,
    }).setOrigin(0.5);

    // Stats bar
    const deckIds = run.deck.active;
    const attacks = deckIds.filter(id => getCardById(id)?.category === 'attack').length;
    const defenses = deckIds.filter(id => getCardById(id)?.category === 'defense').length;
    const spells = deckIds.filter(id => getCardById(id)?.category === 'magic').length;

    this.add.text(LAYOUT.centerX, 54, `${deckIds.length} Cards  |  Atk: ${attacks}  |  Def: ${defenses}  |  Mag: ${spells}`, {
      ...FONTS.small, color: COLORS.textSecondary, fontFamily,
    }).setOrigin(0.5);

    // Instructions
    if (hasDropped) {
      this.add.text(LAYOUT.centerX, 76, `Loot Cards (${run.deck.droppedCards.length}) — drag into deck to add`, {
        fontSize: '13px', color: '#ffaa00', fontFamily, fontStyle: 'italic',
      }).setOrigin(0.5);
      this.add.text(LAYOUT.centerX, 94, 'Deck cards shift to make room. Only loot cards can be dragged.', {
        fontSize: '11px', color: COLORS.textSecondary, fontFamily, fontStyle: 'italic',
      }).setOrigin(0.5);
    } else {
      this.add.text(LAYOUT.centerX, 76, 'Cards from loot drops will appear here for you to add.', {
        fontSize: '11px', color: COLORS.textSecondary, fontFamily, fontStyle: 'italic',
      }).setOrigin(0.5);
    }

    // ── Dropped cards strip ──
    this.droppedStrip = this.add.container(0, 0);
    if (hasDropped) {
      this.buildDroppedStrip(run.deck.droppedCards);
    }

    // ── Active deck grid ──
    this.gridContainer = this.add.container(0, 0);
    this.rebuildGrid();

    // Scroll
    const gridTop = this.getGridTop();
    const totalRows = Math.ceil(this.deckOrder.length / COLS);
    const visibleH = LAYOUT.canvasHeight - gridTop - 50;
    this.maxScroll = Math.max(0, totalRows * (CARD_H + GAP) - visibleH);

    if (this.maxScroll > 0) {
      this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
        if (this.dragCard) return;
        this.scrollY = Math.max(0, Math.min(this.maxScroll, this.scrollY + dy * 0.5));
        this.gridContainer.y = -this.scrollY;
      });
    }

    // Mask for grid area
    const maskGfx = this.make.graphics({ x: 0, y: 0 });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(0, gridTop - 10, LAYOUT.canvasWidth, visibleH + 10);
    this.gridContainer.setMask(maskGfx.createGeometryMask());

    // ── Pointer handlers ──
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragCard) return;
      this.dragCard.x = pointer.x;
      this.dragCard.y = pointer.y;

      const gridY = pointer.y + this.scrollY;
      const newHover = this.getSlotIndex(pointer.x, gridY);
      if (newHover !== this.hoverIndex) {
        this.hoverIndex = newHover;
        this.animateSlots();
      }
    });

    this.input.on('pointerup', () => {
      if (!this.dragCard) return;
      this.dropCard();
    });

    // ── Buttons ──
    createButton(this, LAYOUT.centerX, LAYOUT.canvasHeight - 25, 'Close (D)', () => this.close(), 'primary');
    this.input.keyboard?.on('keydown-D', () => this.close());
    this.input.keyboard?.on('keydown-ESC', () => this.close());

    this.events.on('shutdown', this.cleanup, this);
  }

  // ── Layout helpers ──

  private getGridTop(): number {
    const run = getRun();
    return run.deck.droppedCards.length > 0 ? STRIP_TOP + STRIP_HEIGHT + 4 : GRID_TOP;
  }

  private getGridLeft(): number {
    return LAYOUT.centerX - ((COLS * (CARD_W + GAP) - GAP) / 2);
  }

  private getSlotPos(index: number): { x: number; y: number } {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const gridTop = this.getGridTop();
    return {
      x: this.getGridLeft() + col * (CARD_W + GAP) + CARD_W / 2,
      y: gridTop + row * (CARD_H + GAP) + CARD_H / 2,
    };
  }

  private getSlotIndex(px: number, gridY: number): number {
    const gridLeft = this.getGridLeft();
    const gridTop = this.getGridTop();
    const col = Math.floor((px - gridLeft) / (CARD_W + GAP));
    const row = Math.floor((gridY - gridTop) / (CARD_H + GAP));
    const clampCol = Math.max(0, Math.min(COLS - 1, col));
    const clampRow = Math.max(0, row);
    const idx = clampRow * COLS + clampCol;
    return Math.max(0, Math.min(this.deckOrder.length, idx));
  }

  // ── Dropped cards strip ──

  private buildDroppedStrip(droppedIds: string[]): void {
    this.droppedStrip.removeAll(true);

    const totalW = droppedIds.length * (STRIP_CARD_W + STRIP_GAP) - STRIP_GAP;
    const startX = Math.max(16, LAYOUT.centerX - totalW / 2) + STRIP_CARD_W / 2;

    // Background
    const bgW = Math.min(totalW + 24, LAYOUT.canvasWidth - 16);
    this.droppedStrip.add(
      this.add.rectangle(LAYOUT.centerX, STRIP_TOP + STRIP_CARD_H / 2, bgW, STRIP_HEIGHT, 0x332200, 0.5)
        .setStrokeStyle(1, 0x665500)
    );

    for (let i = 0; i < droppedIds.length; i++) {
      const x = startX + i * (STRIP_CARD_W + STRIP_GAP);
      const y = STRIP_TOP + STRIP_CARD_H / 2;
      const slot = this.createMiniCard(droppedIds[i], x, y, -1, true);
      slot.setScale(STRIP_CARD_W / CARD_W);
      slot.setData('droppedIndex', i);
      this.droppedStrip.add(slot);
    }
  }

  // ── Active deck grid ──

  private rebuildGrid(): void {
    for (const slot of this.cardSlots) slot.destroy(true);
    this.cardSlots = [];

    for (let i = 0; i < this.deckOrder.length; i++) {
      const pos = this.getSlotPos(i);
      const slot = this.createMiniCard(this.deckOrder[i], pos.x, pos.y, i, false);
      this.gridContainer.add(slot);
      this.cardSlots.push(slot);
    }
  }

  private createMiniCard(
    cardId: string, x: number, y: number,
    deckIndex: number, isDraggable: boolean,
  ): Phaser.GameObjects.Container {
    const card = getCardById(cardId);
    const container = this.add.container(x, y);

    // BG
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x222222);
    const rarityColor = card ? (RARITY_COLORS[card.rarity] ?? RARITY_COLORS.common) : RARITY_COLORS.common;
    bg.setStrokeStyle(2, isDraggable ? 0xffd700 : rarityColor);
    container.add(bg);

    // Category strip
    const catColor = card ? (CATEGORY_COLORS[card.category] ?? 0x888888) : 0x888888;
    container.add(this.add.rectangle(0, -CARD_H / 2 + 3, CARD_W - 4, 6, catColor));

    // Order number (only for deck cards)
    if (deckIndex >= 0) {
      container.add(this.add.text(-CARD_W / 2 + 4, -CARD_H / 2 + 8, `${deckIndex + 1}`, {
        fontSize: '10px', color: COLORS.textSecondary, fontFamily: FONTS.family,
      }));
    }

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

    // Interactive
    container.setSize(CARD_W, CARD_H);
    container.setInteractive({ useHandCursor: isDraggable });

    if (isDraggable) {
      container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        const droppedIdx = container.getData('droppedIndex') as number;
        this.startDragFromDropped(droppedIdx, cardId, pointer);
      });
    }

    return container;
  }

  // ── Drag from dropped strip ──

  private startDragFromDropped(droppedIndex: number, cardId: string, pointer: Phaser.Input.Pointer): void {
    this.dragFromDropped = true;
    this.dragDroppedIndex = droppedIndex;
    this.dragCardId = cardId;
    this.hoverIndex = this.deckOrder.length; // default: end of deck

    // Create enlarged drag visual
    this.dragCard = this.createDragVisual(cardId, pointer.x, pointer.y);
  }

  private createDragVisual(cardId: string, x: number, y: number): Phaser.GameObjects.Container {
    const card = getCardById(cardId);
    const w = 160;
    const h = 200;
    const container = this.add.container(x, y);
    container.setDepth(1000);

    const rarityColor = card ? (RARITY_COLORS[card.rarity] ?? RARITY_COLORS.common) : RARITY_COLORS.common;
    const bg = this.add.rectangle(0, 0, w, h, 0x1a1a2e, 0.95);
    bg.setStrokeStyle(3, rarityColor);
    container.add(bg);

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

    container.setAlpha(0.95);
    this.tweens.add({ targets: container, scaleX: 1.02, scaleY: 1.02, duration: 100 });

    return container;
  }

  // ── Animate deck slots to open gap at hoverIndex ──

  private animateSlots(): void {
    const gapAt = Math.min(this.hoverIndex, this.deckOrder.length);

    for (let i = 0; i < this.deckOrder.length; i++) {
      const slot = this.cardSlots[i];
      if (!slot) continue;

      // Shift cards at/after gap one position forward
      const visualIdx = i >= gapAt ? i + 1 : i;
      const targetPos = this.getSlotPos(visualIdx);
      this.tweens.add({
        targets: slot,
        x: targetPos.x,
        y: targetPos.y,
        duration: 150,
        ease: 'Sine.easeOut',
        overwrite: true,
      });
    }
  }

  // ── Drop card into deck ──

  private dropCard(): void {
    if (!this.dragCard) return;

    this.dragCard.destroy(true);
    this.dragCard = null;

    if (this.dragFromDropped && this.dragDroppedIndex >= 0) {
      const run = getRun();

      // Remove from droppedCards
      if (this.dragDroppedIndex < run.deck.droppedCards.length) {
        run.deck.droppedCards.splice(this.dragDroppedIndex, 1);
      }

      // Insert into active deck at hover position
      const insertAt = Math.min(this.hoverIndex, this.deckOrder.length);
      this.deckOrder.splice(insertAt, 0, this.dragCardId);
      run.deck.active = [...this.deckOrder];

      // Reset drag state
      this.dragFromDropped = false;
      this.dragDroppedIndex = -1;
      this.dragCardId = '';
      this.hoverIndex = -1;

      // Full scene restart so layout recalculates (strip may disappear)
      this.scene.restart();
      return;
    }

    // Reset drag state
    this.dragFromDropped = false;
    this.dragDroppedIndex = -1;
    this.dragCardId = '';
    this.hoverIndex = -1;

    // Rebuild grid
    this.rebuildGrid();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  private cleanup(): void {
    if (this.dragCard) {
      this.dragCard.destroy(true);
      this.dragCard = null;
    }
    this.cardSlots = [];
  }
}
