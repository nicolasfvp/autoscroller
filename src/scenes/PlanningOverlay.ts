import { Scene } from 'phaser';
import { LoopRunner, type LoopRunState, TILE_SIZE } from '../systems/LoopRunner';
import { getAllPlaceableTiles, getTileConfig, type TileSlot } from '../systems/TileRegistry';
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



    // Loop layout strip at y=160
    this.gridContainer = this.add.container(0, 0);
    this.buildLoopGrid();

    // Tile inventory panel at y=300
    this.buildInventoryPanel(fontFamily);

    // Deck / Relic viewer shortcuts (feedback #3)
    const deckBtn = this.add.text(60, 30, '[D] Deck', {
      fontSize: '14px', color: '#aaccff', fontFamily,
    }).setInteractive({ useHandCursor: true });
    deckBtn.on('pointerdown', () => {
      this.scene.pause();
      this.scene.launch('DeckCustomizationScene');
    });

    const relicBtn = this.add.text(60, 50, '[R] Relics', {
      fontSize: '14px', color: '#aaccff', fontFamily,
    }).setInteractive({ useHandCursor: true });
    relicBtn.on('pointerdown', () => {
      this.scene.pause();
      this.scene.launch('RelicViewerScene');
    });

    this.input.keyboard?.on('keydown-D', () => {
      this.scene.pause();
      this.scene.launch('DeckCustomizationScene');
    });
    this.input.keyboard?.on('keydown-R', () => {
      this.scene.pause();
      this.scene.launch('RelicViewerScene');
    });

    // "Start Loop" button at y=540 — LEFT CLICK ONLY (feedback #30)
    const startBtn = this.add.text(400, 540, 'Start Loop', {
      fontSize: '24px', fontStyle: 'bold', color: '#ffd700', fontFamily,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerover', () => startBtn.setColor('#ffffff'));
    startBtn.on('pointerout', () => startBtn.setColor('#ffd700'));
    startBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return; // Left click only (feedback #30)
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
      // Refresh grid and inventory — keep tile selected for multi-placement (feedback #4)
      this.buildLoopGrid();
      this.refreshInventory();
      // Only deselect if we can no longer afford or have copies
      const config2 = getTileConfig(this.selectedTileKey!);
      const invEntry2 = this.loopRunState.tileInventory.find(t => t.tileType === this.selectedTileKey);
      const canStillPlace = (invEntry2 && invEntry2.count > 0) || this.loopRunState.economy.tilePoints >= config2.tilePointCost;
      if (!canStillPlace) {
        this.selectedTileKey = null;
        this.selectedCardIndex = -1;
      }
    } else {
      // Toast: slot occupied
      this.showToast('This slot already has a tile.');
    }
  }

  private buildInventoryPanel(fontFamily: string): void {
    // Panel background
    this.add.image(400, 390, 'wood_texture').setDisplaySize(700, 200);

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
    const cardWidth = 80;
    const cardHeight = 140;
    const gap = 12;
    const totalContentWidth = placeableTiles.length * cardWidth + (placeableTiles.length - 1) * gap;
    const startX = 400 - (totalContentWidth / 2) + (cardWidth / 2);
    const y = 400;

    placeableTiles.forEach((tileConfig, idx) => {
      const x = startX + idx * (cardWidth + gap);
      const container = this.add.container(x, y);

      // Card background
      const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x333333);
      container.add(bg);

      // Tile color preview (40x40)
      const tileKey = (tileConfig as any).key ?? tileConfig.terrain ?? tileConfig.name.toLowerCase();
      const pseudoSlot: TileSlot = {
        type: tileConfig.type,
        terrain: tileConfig.terrain,
        defeatedThisLoop: false
      };
      
      // Use the actual visual representation of the tile (scaled to fit)
      const scale = 60 / TILE_SIZE;
      // Ajustando o offset Y para acomodar a imagem maior (de -20 para -10)
      const preview = new TileVisual(this, 0, -10, pseudoSlot, scale, 0, false, true);
      
      // se for um bloco especial ou de terreno, esconde a areia/bloco para deixar só o item
      if (['shop', 'rest', 'event', 'treasure', 'boss', 'terrain'].includes(pseudoSlot.type)) {
        preview.hideFloor();
      }
      container.add(preview);

      // Name
      const nameText = this.add.text(0, 25, tileConfig.name, {
        fontSize: '14px', color: '#ffffff', fontFamily,
      }).setOrigin(0.5);
      container.add(nameText);

      // Cost
      const costText = this.add.text(0, 45, `${tileConfig.tilePointCost} TP`, {
        fontSize: '14px', color: '#00e5ff', fontFamily,
      }).setOrigin(0.5);
      container.add(costText);

      // Check inventory for free copies
      const invEntry = this.loopRunState.tileInventory.find(t => t.tileType === tileKey);
      const freeCount = invEntry?.count ?? 0;
      if (freeCount > 0) {
        const countText = this.add.text(0, 60, `x${freeCount}`, {
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
