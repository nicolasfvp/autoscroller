import { Scene } from 'phaser';
import { LoopRunner, type LoopRunState, TILE_SIZE } from '../systems/LoopRunner';
import { getAllPlaceableTiles, getTileConfig, type TileSlot } from '../systems/TileRegistry';
import { resolveAdjacencySynergies } from '../systems/SynergyResolver';
import { TileVisual } from '../ui/TileVisual';
import { getRun } from '../state/RunState';

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
  private gridGeometry!: { cellW: number; period: number; centerX: number };

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

    // Background - Custom asset for tile selection
    if (this.textures.exists('bg_tile_selection')) {
      this.add.image(400, 300, 'bg_tile_selection').setDisplaySize(800, 600);
    } else {
      // Semi-transparent overlay fallback
      this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
    }

    // Loop layout strip at y=240
    this.gridContainer = this.add.container(0, 0);
    this.buildLoopGrid();

    // Tile inventory panel at y=300
    this.buildInventoryPanel(fontFamily);

    // Deck / Relic icons at top center with table background
    const tableY = 65;
    const iconY = 55;
    if (this.textures.exists('deck_relic_table')) {
      this.add.image(400, tableY, 'deck_relic_table').setDisplaySize(220, 100);
    }

    const deckIcon = this.add.image(360, iconY, 'deck_icon').setDisplaySize(60, 60).setInteractive({ useHandCursor: true });
    this.add.text(360, iconY + 35, '[D]', { fontSize: '12px', color: '#ffffff', fontFamily }).setOrigin(0.5);
    
    deckIcon.on('pointerover', () => {
      deckIcon.setScale(deckIcon.scale * 1.1);
      deckIcon.setTint(0xdddddd);
    });
    deckIcon.on('pointerout', () => {
      deckIcon.setScale(deckIcon.scale / 1.1);
      deckIcon.clearTint();
    });
    deckIcon.on('pointerdown', () => {
      this.scene.sleep();
      this.scene.launch('DeckCustomizationScene', { parentScene: 'PlanningOverlay' });
    });

    const relicIcon = this.add.image(440, iconY, 'relic_icon').setDisplaySize(60, 60).setInteractive({ useHandCursor: true });
    this.add.text(440, iconY + 35, '[R]', { fontSize: '12px', color: '#ffffff', fontFamily }).setOrigin(0.5);
    
    relicIcon.on('pointerover', () => {
      relicIcon.setScale(relicIcon.scale * 1.1);
      relicIcon.setTint(0xdddddd);
    });
    relicIcon.on('pointerout', () => {
      relicIcon.setScale(relicIcon.scale / 1.1);
      relicIcon.clearTint();
    });
    relicIcon.on('pointerdown', () => {
      this.scene.sleep();
      this.scene.launch('RelicViewerScene', { parentScene: 'PlanningOverlay' });
    });

    this.input.keyboard?.on('keydown-D', () => {
      this.scene.sleep();
      this.scene.launch('DeckCustomizationScene', { parentScene: 'PlanningOverlay' });
    });
    this.input.keyboard?.on('keydown-R', () => {
      this.scene.sleep();
      this.scene.launch('RelicViewerScene', { parentScene: 'PlanningOverlay' });
    });

    // "Start Loop" text button at y=540 (styled like Tile Inventory)
    const startBtn = this.add.text(400, 540, 'Start Loop', {
      fontSize: '32px', 
      fontStyle: 'bold', 
      color: '#ffd700', 
      fontFamily,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setShadow(2, 2, '#000000', 2, true, true);

    startBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return; // Left click only
      // Sync spent TP/gold back to RunState before resuming GameScene, so
      // the resume handler doesn't refund the just-spent points by copying
      // a stale RunState.economy back into loopRunState.
      const run = getRun();
      run.economy.gold = this.loopRunState.economy.gold;
      run.economy.tilePoints = this.loopRunState.economy.tilePoints;
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
    const scale = 0.7;
    const tileSize = Math.round(TILE_SIZE * scale);
    const gap = 8;
    const cellW = tileSize + gap;
    // Show every slot — buffers included — so the displayed loop matches
    // the actual loop length the hero will traverse. Buffers stay
    // non-clickable; they're just no longer invisible.
    const period = tiles.length * cellW;
    const centerX = 400;
    const y = 240;

    this.gridGeometry = { cellW, period, centerX };

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
      // Initial position; updateTilePositions() handles the wrap math.
      const tv = new TileVisual(this, 0, y, tiles[i], scale, i, true);
      tv.setData('beltSlot', i);
      this.gridContainer.add(tv);
      this.tileVisuals.push(tv);

      // Set synergy edges
      const syn = synergyByTile.get(i);
      if (syn) {
        if (syn.left && syn.right) tv.setSynergyEdge('both');
        else if (syn.left) tv.setSynergyEdge('left');
        else if (syn.right) tv.setSynergyEdge('right');
      }

      // Buffer tiles are part of the path but not editable — dim them so
      // players can see they exist without thinking they can be replaced.
      if (tiles[i].type === 'buffer') {
        tv.setAlpha(0.35);
        continue;
      }

      // Make basic slots clickable for placement
      if (tiles[i].type === 'basic') {
        tv.setAlpha(0.6);
        tv.onClick(() => this.onSlotClicked(i));
      }
    }

    this.updateTilePositions();
  }

  /**
   * Reposition every belt tile so the strip behaves as an infinite loop:
   * tile 0 follows the last tile and vice versa. The belt spans `period`
   * pixels; each tile at slot k naturally sits at `centerX - period/2 +
   * cellW/2 + k * cellW`. Adding scrollOffset and wrapping into the
   * visible window range keeps a copy of the strip on screen no matter
   * how far the user drags.
   */
  private updateTilePositions(): void {
    if (!this.gridGeometry) return;
    const { cellW, period, centerX } = this.gridGeometry;
    if (period <= 0) return;

    // Wrap window: anything outside [-cellW, 800 + cellW] gets shifted by
    // ±period until it lands inside. `cellW` of slack on either side keeps
    // tiles entering/leaving from being clipped before they reach the edge.
    const leftBound = -cellW;
    const rightBound = 800 + cellW;
    const baseLeft = centerX - period / 2 + cellW / 2;

    for (const tv of this.tileVisuals) {
      const slot = tv.getData('beltSlot') as number;
      let x = baseLeft + slot * cellW + this.scrollOffset;
      // Normalize to [leftBound, leftBound + period)
      x = ((x - leftBound) % period + period) % period + leftBound;
      // After normalization x is in [leftBound, leftBound+period); if the
      // belt is shorter than the screen this still gives a contiguous strip.
      if (x > rightBound) x -= period;
      tv.x = x;
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
      // Differentiate the failure reason — enemy-locked vs boss/buffer vs occupied —
      // so players don't think "already has a tile" when the real reason is
      // "this combat tile is locked because an enemy is already pre-assigned".
      const slot = this.loopRunState.loop.tiles[slotIndex];
      if (!slot) {
        this.showToast('Invalid slot.');
      } else if (slot.type === 'boss') {
        this.showToast('Boss tiles cannot be replaced.');
      } else if (slot.type === 'buffer') {
        this.showToast('Buffer tiles cannot be replaced.');
      } else if (slot.enemyId) {
        this.showToast('This tile already has an enemy — fight it first.');
      } else {
        this.showToast('This slot already has a tile.');
      }
    }
  }

  private buildInventoryPanel(fontFamily: string): void {
    // Panel background
    const board = this.add.image(400, 420, 'tile_selection_board');
    // Reducing size as requested
    board.setDisplaySize(720, 190);


    // Tile point balance - repositioned and styled
    this.tpBalanceText = this.add.text(720, 360, `${this.loopRunState.economy.tilePoints} TP`, {
      fontSize: '22px', color: '#00e5ff', fontFamily,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(1, 0.5);

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

    // ── Responsive sizing: shrink tiles to always fit within the panel ──
    const MAX_W       = 720;                       // usable horizontal space
    const MIN_FRAME   = 62;                        // smallest frame we'll go
    const IDEAL_FRAME = 80;
    const IDEAL_GAP   = 12;

    // How many tiles fit in one row at the ideal size?
    const idealTotalW = placeableTiles.length * IDEAL_FRAME + (placeableTiles.length - 1) * IDEAL_GAP;
    let frameWidth: number;
    let gap: number;
    let cols: number;
    let rows: number;

    if (idealTotalW <= MAX_W) {
      // All tiles fit in 1 row at ideal size
      frameWidth = IDEAL_FRAME;
      gap        = IDEAL_GAP;
      cols       = placeableTiles.length;
      rows       = 1;
    } else {
      // Try shrinking down to MIN_FRAME first
      const shrunkGap   = 8;
      const shrunkTotal = placeableTiles.length * MIN_FRAME + (placeableTiles.length - 1) * shrunkGap;
      if (shrunkTotal <= MAX_W) {
        // Fits in 1 row when shrunk
        frameWidth = Math.floor((MAX_W - (placeableTiles.length - 1) * shrunkGap) / placeableTiles.length);
        frameWidth = Math.max(MIN_FRAME, Math.min(IDEAL_FRAME, frameWidth));
        gap        = shrunkGap;
        cols       = placeableTiles.length;
        rows       = 1;
      } else {
        // Wrap to 2 rows
        cols       = Math.ceil(placeableTiles.length / 2);
        rows       = 2;
        gap        = 8;
        frameWidth = Math.floor((MAX_W - (cols - 1) * gap) / cols);
        frameWidth = Math.max(MIN_FRAME, Math.min(IDEAL_FRAME, frameWidth));
      }
    }

    const frameHeight = frameWidth;
    const rowSpacing  = frameHeight + 52; // frame + name + cost text below

    const totalRowW = cols * frameWidth + (cols - 1) * gap;
    const startX    = 400 - totalRowW / 2 + frameWidth / 2;
    // Centre vertically in the board area
    const rowStartY = rows === 2 ? 400 : 420;

    placeableTiles.forEach((tileConfig, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x   = startX + col * (frameWidth + gap);
      const y   = rowStartY + row * rowSpacing;
      const container = this.add.container(x, y);

      // Card background
      const frame = this.add.image(0, 0, 'tile_frame').setDisplaySize(frameWidth, frameHeight);
      container.add(frame);

      // Tile preview — getAllPlaceableTiles guarantees `key` is set
      const tileKey = tileConfig.key;
      const pseudoSlot: TileSlot = {
        type: tileConfig.type,
        terrain: tileConfig.terrain,
        defeatedThisLoop: false
      };
      
      const previewSize = Math.round(frameWidth * 0.65);
      const scale = previewSize / TILE_SIZE;
      const preview = new TileVisual(this, 0, 0, pseudoSlot, scale, 0, false, true);
      
      if (['shop', 'rest', 'event', 'treasure', 'boss', 'terrain'].includes(pseudoSlot.type)) {
        preview.hideFloor();
      }
      container.add(preview);

      // Name - below frame
      const fontSize = frameWidth >= 74 ? '14px' : '11px';
      const nameText = this.add.text(0, frameHeight / 2 + 8, tileConfig.name, {
        fontSize, color: '#ffdca0', fontFamily,
      }).setOrigin(0.5);
      container.add(nameText);

      // Cost - below name
      const costText = this.add.text(0, frameHeight / 2 + 24, `${tileConfig.tilePointCost} TP`, {
        fontSize, color: '#ff4444', fontFamily, fontStyle: 'bold'
      }).setOrigin(0.5);
      container.add(costText);

      // Free copies badge
      const invEntry = this.loopRunState.tileInventory.find(t => t.tileType === tileKey);
      const freeCount = invEntry?.count ?? 0;
      if (freeCount > 0) {
        const countText = this.add.text(frameWidth / 2 - 8, -frameHeight / 2 + 8, `x${freeCount}`, {
          fontSize: '13px', color: '#ffffff', fontFamily, fontStyle: 'bold',
          backgroundColor: '#333333', padding: { x: 3, y: 2 }
        }).setOrigin(1, 0);
        container.add(countText);
      }

      // Affordability
      const canAfford = freeCount > 0 || this.loopRunState.economy.tilePoints >= tileConfig.tilePointCost;
      if (!canAfford) {
        container.setAlpha(0.5);
        costText.setColor('#880000');
      } else {
        frame.setInteractive({ useHandCursor: true });
        
        frame.on('pointerover', () => {
          const hoverScale = this.selectedCardIndex === idx ? 1.15 : 1.1;
          container.setScale(hoverScale);
          frame.setTint(0xdddddd);
        });
        
        frame.on('pointerout', () => {
          const baseScale = this.selectedCardIndex === idx ? 1.05 : 1.0;
          container.setScale(baseScale);
          frame.clearTint();
        });

        frame.on('pointerdown', () => this.selectInventoryTile(idx, tileConfig.key));
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
    let dragging = false;
    let dragMoved = false;
    let startPointerX = 0;
    let startOffset = 0;
    const DRAG_THRESHOLD = 4; // pixels — below this, treat as a click

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > 200 && pointer.y < 300) {
        dragging = true;
        dragMoved = false;
        startPointerX = pointer.x;
        startOffset = this.scrollOffset;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const dx = pointer.x - startPointerX;
      if (Math.abs(dx) > DRAG_THRESHOLD) dragMoved = true;
      // No clamp — the belt wraps via updateTilePositions().
      this.scrollOffset = startOffset + dx;
      this.updateTilePositions();
    });

    this.input.on('pointerup', () => {
      dragging = false;
      // Fold scrollOffset back into [0, period) so future drags don't grow
      // unbounded and lose precision over many loops.
      if (this.gridGeometry && this.gridGeometry.period > 0 && dragMoved) {
        const p = this.gridGeometry.period;
        this.scrollOffset = ((this.scrollOffset % p) + p) % p;
      }
    });

    // Mouse wheel scrolls horizontally too — handy for trackpads.
    this.input.on('wheel', (
      pointer: Phaser.Input.Pointer,
      _objects: Phaser.GameObjects.GameObject[],
      _dx: number,
      dy: number,
    ) => {
      if (pointer.y < 200 || pointer.y > 300) return;
      this.scrollOffset -= dy;
      this.updateTilePositions();
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
