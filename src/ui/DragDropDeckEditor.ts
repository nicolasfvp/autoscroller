// DragDropDeckEditor -- draggable vertical card list component.
// Supports drag-and-drop reorder with drop indicator.

import { getCardById } from '../data/DataLoader';

const ITEM_WIDTH = 580;
const ITEM_HEIGHT = 48;
const ITEM_GAP = 4;
const MIN_ITEM_HEIGHT = 44; // accessibility touch target

const CATEGORY_COLORS: Record<string, number> = {
  attack: 0xcc3333,
  defense: 0x3366cc,
  magic: 0x9933cc,
};

export class DragDropDeckEditor {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private deckIds: string[];
  private onReorder: (newOrder: string[]) => void;
  private items: Phaser.GameObjects.Container[] = [];
  private dragEnabled = false;
  private dropIndicator: Phaser.GameObjects.Rectangle | null = null;
  private baseY: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    deckIds: string[],
    onReorder: (newOrder: string[]) => void,
  ) {
    this.scene = scene;
    this.baseY = y;
    this.deckIds = [...deckIds];
    this.onReorder = onReorder;
    this.container = scene.add.container(x, y);

    // Drop indicator line (hidden by default)
    this.dropIndicator = scene.add.rectangle(x + ITEM_WIDTH / 2, 0, ITEM_WIDTH, 4, 0xffd700);
    this.dropIndicator.setVisible(false).setDepth(998);

    this.rebuild();
  }

  private rebuild(): void {
    // Destroy old items
    for (const item of this.items) {
      item.destroy();
    }
    this.items = [];

    for (let i = 0; i < this.deckIds.length; i++) {
      const cardId = this.deckIds[i];
      const card = getCardById(cardId);
      const y = i * (Math.max(ITEM_HEIGHT, MIN_ITEM_HEIGHT) + ITEM_GAP);

      const itemContainer = this.scene.add.container(0, y);
      itemContainer.setSize(ITEM_WIDTH, ITEM_HEIGHT);

      // Background
      const bg = this.scene.add.rectangle(ITEM_WIDTH / 2, 0, ITEM_WIDTH, ITEM_HEIGHT, 0x333333, 0.6);
      itemContainer.add(bg);

      // Type indicator circle
      const catColor = card ? (CATEGORY_COLORS[card.category] ?? 0x888888) : 0x888888;
      const circle = this.scene.add.circle(16, 0, 4, catColor);
      itemContainer.add(circle);

      // Drag handle (shown when drag mode active)
      const handle = this.scene.add.text(36, 0, ':::', {
        fontSize: '16px',
        color: '#aaaaaa',
      }).setOrigin(0, 0.5).setVisible(this.dragEnabled);
      itemContainer.add(handle);
      itemContainer.setData('handle', handle);

      // Card name
      const nameX = this.dragEnabled ? 60 : 36;
      const nameText = this.scene.add.text(nameX, 0, card?.name ?? cardId, {
        fontSize: '16px',
        color: '#ffffff',
      }).setOrigin(0, 0.5);
      itemContainer.add(nameText);

      // Cooldown (right side)
      if (card) {
        const cdText = this.scene.add.text(ITEM_WIDTH - 80, 0, `${card.cooldown}s`, {
          fontSize: '14px',
          color: '#aaaaaa',
        }).setOrigin(0, 0.5);
        itemContainer.add(cdText);
      }

      // Cost (far right)
      if (card?.cost) {
        const costVal = card.cost.mana ?? card.cost.stamina ?? 0;
        const costColor = card.cost.mana ? '#6a5acd' : '#ff8c00';
        const costText = this.scene.add.text(ITEM_WIDTH - 24, 0, `${costVal}`, {
          fontSize: '14px',
          color: costColor,
        }).setOrigin(0.5);
        itemContainer.add(costText);
      }

      // Store index for drag tracking
      itemContainer.setData('index', i);
      itemContainer.setData('cardId', cardId);

      // Set up dragging
      if (this.dragEnabled) {
        itemContainer.setInteractive({
          draggable: true,
          hitArea: new Phaser.Geom.Rectangle(0, -ITEM_HEIGHT / 2, ITEM_WIDTH, ITEM_HEIGHT),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        });
      }

      this.container.add(itemContainer);
      this.items.push(itemContainer);
    }

    // Set up drag events on the scene if enabled
    if (this.dragEnabled) {
      this.setupDragEvents();
    }
  }

  private setupDragEvents(): void {
    this.scene.input.on('dragstart', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container) => {
      if (!this.items.includes(gameObject)) return;
      gameObject.setDepth(999);
      gameObject.setScale(1.02);
    });

    this.scene.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container, _dragX: number, dragY: number) => {
      if (!this.items.includes(gameObject)) return;
      // Constrain X to list position, allow Y movement
      gameObject.y = dragY - this.baseY;

      // Show drop indicator
      const dropIndex = this.getDropIndex(dragY - this.baseY);
      if (this.dropIndicator) {
        const indicatorY = this.baseY + dropIndex * (ITEM_HEIGHT + ITEM_GAP) - ITEM_GAP / 2;
        this.dropIndicator.y = indicatorY;
        this.dropIndicator.setVisible(true);
      }
    });

    this.scene.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container) => {
      if (!this.items.includes(gameObject)) return;
      gameObject.setDepth(0);
      gameObject.setScale(1);

      if (this.dropIndicator) {
        this.dropIndicator.setVisible(false);
      }

      // Calculate new index
      const oldIndex = gameObject.getData('index') as number;
      const newIndex = this.getDropIndex(gameObject.y);

      if (oldIndex !== newIndex && newIndex >= 0 && newIndex <= this.deckIds.length) {
        // Splice to new position
        const [removed] = this.deckIds.splice(oldIndex, 1);
        const insertAt = newIndex > oldIndex ? newIndex - 1 : newIndex;
        this.deckIds.splice(insertAt, 0, removed);
        this.onReorder([...this.deckIds]);
      }

      this.rebuild();
    });
  }

  private getDropIndex(y: number): number {
    const slot = Math.round(y / (ITEM_HEIGHT + ITEM_GAP));
    return Math.max(0, Math.min(this.deckIds.length, slot));
  }

  /**
   * Toggle drag mode on/off.
   */
  setDragEnabled(enabled: boolean): void {
    this.dragEnabled = enabled;
    this.rebuild();
  }

  /**
   * Update the deck IDs and rebuild.
   */
  updateDeck(newIds: string[]): void {
    this.deckIds = [...newIds];
    this.rebuild();
  }

  destroy(): void {
    for (const item of this.items) {
      item.destroy();
    }
    this.items = [];
    if (this.dropIndicator) {
      this.dropIndicator.destroy();
      this.dropIndicator = null;
    }
    this.container.destroy();
    // Clean up drag events
    this.scene.input.off('dragstart');
    this.scene.input.off('drag');
    this.scene.input.off('dragend');
  }
}
