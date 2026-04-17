import { Scene } from 'phaser';
import { LoopRunner, type LoopRunState } from '../systems/LoopRunner';
import { getAllPlaceableTiles, getTileConfig } from '../systems/TileRegistry';
import { resolveAdjacencySynergies } from '../systems/SynergyResolver';
import { TileVisual } from '../ui/TileVisual';

/**
 * PlanningOverlay -- planning phase UI with miniature loop grid and tile inventory panel.
 * Launched on top of paused GameScene. Delegates tile placement to LoopRunner.
 */
export class PlanningOverlay extends Scene {
  private loopRunner!: LoopRunner;
  private loopRunState!: LoopRunState;
  private selectedTileKey: string | null = null;
  private tileVisuals: TileVisual[] = [];
  private inventoryCards: Phaser.GameObjects.Container[] = [];
  private selectedCardIndex: number = -1;
  private tpBalanceText!: Phaser.GameObjects.Text;
  private scrollOffset: number = 0;
  private gridContainer!: Phaser.GameObjects.Container;

  constructor() {
    super('PlanningOverlay');
  }

  create(data: { loopRunner: LoopRunner; loopRunState: LoopRunState }): void {
    this.loopRunner = data.loopRunner;
    this.loopRunState = data.loopRunState;
    this.selectedTileKey = null;
    this.selectedCardIndex = -1;
    this.scrollOffset = 0;
    this.tileVisuals = [];
    this.inventoryCards = [];

    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';

    // Semi-transparent overlay
    this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);

    // Title
    this.add.text(400, 30, 'Planning Phase', {
      fontSize: '24px', fontStyle: 'bold', color: '#ffffff', fontFamily,
    }).setOrigin(0.5);

    // Instruction
    this.add.text(400, 58, 'Place tiles on empty slots to shape your loop.', {
      fontSize: '16px', color: '#aaaaaa', fontFamily,
    }).setOrigin(0.5);

    // Loop layout strip at y=160
    this.gridContainer = this.add.container(0, 0);
    this.buildLoopGrid();

    // Tile inventory panel at y=300
    this.buildInventoryPanel(fontFamily);

    // "Start Loop" button at y=540
    const startBtn = this.add.text(400, 540, 'Start Loop', {
      fontSize: '24px', fontStyle: 'bold', color: '#ffd700', fontFamily,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerover', () => startBtn.setColor('#ffffff'));
    startBtn.on('pointerout', () => startBtn.setColor('#ffd700'));
    startBtn.on('pointerdown', () => {
      this.loopRunner.confirmPlanning();
      this.tweens.add({
        targets: this.cameras.main,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.scene.stop();
          this.scene.resume('GameScene');
        },
      });
    });

    // Enable drag scroll for long loops
    this.setupDragScroll();

    this.events.on('shutdown', this.cleanup, this);
  }

  private buildLoopGrid(): void {
    const tiles = this.loopRunState.loop.tiles;
    const scale = 0.5;
    const tileSize = 40;
    const gap = 4;
    const totalWidth = tiles.length * tileSize + (tiles.length - 1) * gap;
    const startX = (800 - Math.min(totalWidth, 700)) / 2 + tileSize / 2;
    const y = 160;

    // Clear existing
    for (const tv of this.tileVisuals) {
      tv.destroy();
    }
    this.tileVisuals = [];
    this.gridContainer.removeAll(true);

    // Build synergy data
    const synergies = resolveAdjacencySynergies(tiles);
    const synergyByTile = new Map<number, { left: boolean; right: boolean }>();
    for (const buff of synergies) {
      const existing = synergyByTile.get(buff.tileIndex) ?? { left: false, right: false };
      existing.right = true;
      synergyByTile.set(buff.tileIndex, existing);
      // Next tile gets left synergy
      const nextIdx = (buff.tileIndex + 1) % tiles.length;
      const nextExisting = synergyByTile.get(nextIdx) ?? { left: false, right: false };
      nextExisting.left = true;
      synergyByTile.set(nextIdx, nextExisting);
    }

    for (let i = 0; i < tiles.length; i++) {
      const x = startX + i * (tileSize + gap) + this.scrollOffset;
      const tv = new TileVisual(this, x, y, tiles[i], scale, i, true);
      this.gridContainer.add(tv);
      this.tileVisuals.push(tv);

      // Set synergy edges
      const syn = synergyByTile.get(i);
      if (syn) {
        if (syn.left && syn.right) tv.setSynergyEdge('both');
        else if (syn.left) tv.setSynergyEdge('left');
        else if (syn.right) tv.setSynergyEdge('right');
      }

      // Make basic slots clickable for placement
      if (tiles[i].type === 'basic') {
        tv.setAlpha(0.6);
        tv.onClick(() => this.onSlotClicked(i));
      }
    }
  }

  private onSlotClicked(slotIndex: number): void {
    if (!this.selectedTileKey) return;

    const success = this.loopRunner.placeTile(slotIndex, this.selectedTileKey);
    if (success) {
      // Deduct tile points if purchasing (not from inventory)
      const config = getTileConfig(this.selectedTileKey);
      const invEntry = this.loopRunState.tileInventory.find(t => t.tileType === this.selectedTileKey);
      if (invEntry && invEntry.count > 0) {
        invEntry.count--;
      } else {
        this.loopRunState.economy.tilePoints -= config.tilePointCost;
      }
      // Refresh grid and inventory
      this.buildLoopGrid();
      this.refreshInventory();
      this.selectedTileKey = null;
      this.selectedCardIndex = -1;
    } else {
      // Toast: slot occupied
      this.showToast('This slot already has a tile.');
    }
  }

  private buildInventoryPanel(fontFamily: string): void {
    // Panel background
    this.add.rectangle(400, 390, 700, 200, 0x222222, 0.85);

    // Title
    this.add.text(66, 300, 'Tile Inventory', {
      fontSize: '24px', fontStyle: 'bold', color: '#ffffff', fontFamily,
    });

    // Tile point balance
    this.tpBalanceText = this.add.text(734, 300, `${this.loopRunState.economy.tilePoints} TP`, {
      fontSize: '24px', color: '#00e5ff', fontFamily,
    }).setOrigin(1, 0);

    this.refreshInventory();
  }

  private refreshInventory(): void {
    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';

    // Clear existing cards
    for (const card of this.inventoryCards) {
      card.destroy();
    }
    this.inventoryCards = [];

    // Update TP balance
    this.tpBalanceText.setText(`${this.loopRunState.economy.tilePoints} TP`);

    const placeableTiles = getAllPlaceableTiles();
    const startX = 80;
    const cardWidth = 80;
    const cardHeight = 120;
    const gap = 8;
    const y = 400;

    placeableTiles.forEach((tileConfig, idx) => {
      const x = startX + idx * (cardWidth + gap);
      const container = this.add.container(x, y);

      // Card background
      const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x333333);
      container.add(bg);

      // Tile color preview (40x40)
      const preview = this.add.rectangle(0, -30, 40, 40, tileConfig.color);
      container.add(preview);

      // Name
      const nameText = this.add.text(0, 10, tileConfig.name, {
        fontSize: '14px', color: '#ffffff', fontFamily,
      }).setOrigin(0.5);
      container.add(nameText);

      // Cost
      const costText = this.add.text(0, 28, `${tileConfig.tilePointCost} TP`, {
        fontSize: '14px', color: '#00e5ff', fontFamily,
      }).setOrigin(0.5);
      container.add(costText);

      // Check inventory for free copies
      const tileKey = (tileConfig as any).key ?? tileConfig.terrain ?? tileConfig.name.toLowerCase();
      const invEntry = this.loopRunState.tileInventory.find(t => t.tileType === tileKey);
      const freeCount = invEntry?.count ?? 0;
      if (freeCount > 0) {
        const countText = this.add.text(0, 44, `x${freeCount}`, {
          fontSize: '14px', color: '#aaaaaa', fontFamily,
        }).setOrigin(0.5);
        container.add(countText);
      }

      // Check affordability
      const canAfford = freeCount > 0 || this.loopRunState.economy.tilePoints >= tileConfig.tilePointCost;
      if (!canAfford) {
        container.setAlpha(0.4);
        costText.setColor('#ff0000');
      } else {
        // Make interactive
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => this.selectInventoryTile(idx, (tileConfig as any).key ?? tileConfig.terrain ?? tileConfig.name.toLowerCase()));
      }

      this.inventoryCards.push(container);
    });
  }

  private selectInventoryTile(cardIndex: number, tileKey: string): void {
    // Deselect previous
    if (this.selectedCardIndex >= 0 && this.inventoryCards[this.selectedCardIndex]) {
      this.inventoryCards[this.selectedCardIndex].setScale(1);
    }

    if (this.selectedCardIndex === cardIndex) {
      // Toggle off
      this.selectedTileKey = null;
      this.selectedCardIndex = -1;
      return;
    }

    this.selectedTileKey = tileKey;
    this.selectedCardIndex = cardIndex;

    // Highlight selected card
    if (this.inventoryCards[cardIndex]) {
      this.inventoryCards[cardIndex].setScale(1.05);
    }
  }

  private setupDragScroll(): void {
    const tiles = this.loopRunState.loop.tiles;
    const tileSize = 40;
    const gap = 4;
    const totalWidth = tiles.length * tileSize + (tiles.length - 1) * gap;

    if (totalWidth <= 700) return; // No scroll needed

    let dragging = false;
    let startPointerX = 0;
    let startOffset = 0;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > 120 && pointer.y < 220) {
        dragging = true;
        startPointerX = pointer.x;
        startOffset = this.scrollOffset;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const dx = pointer.x - startPointerX;
      const maxScroll = 0;
      const minScroll = -(totalWidth - 700);
      this.scrollOffset = Math.max(minScroll, Math.min(maxScroll, startOffset + dx));

      // Update tile positions
      for (let i = 0; i < this.tileVisuals.length; i++) {
        const baseX = (800 - Math.min(totalWidth, 700)) / 2 + tileSize / 2 + i * (tileSize + gap);
        this.tileVisuals[i].x = baseX + this.scrollOffset;
      }
    });

    this.input.on('pointerup', () => {
      dragging = false;
    });
  }

  private showToast(message: string): void {
    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
    const toast = this.add.text(400, 560, message, {
      fontSize: '14px', color: '#ff0000', fontFamily,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      duration: 1500,
      onComplete: () => toast.destroy(),
    });
  }

  private cleanup(): void {
    this.tileVisuals = [];
    this.inventoryCards = [];
  }
}
