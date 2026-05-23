import { Scene } from 'phaser';
import { LoopRunner, type LoopRunState, TILE_SIZE } from '../systems/LoopRunner';
import { getAllPlaceableTiles, getTileConfig, type TileSlot } from '../systems/TileRegistry';
import { TileVisual } from '../ui/TileVisual';
import { getRun } from '../state/RunState';
import { SCENE_KEYS } from '../state/SceneKeys';

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
  /** Wave 5: separate cards for the subtile-only second row. */
  private subtileInventoryCards: Phaser.GameObjects.Container[] = [];
  private selectedCardIndex: number = -1;
  /** Wave 5: when true, slot clicks remove placed tiles instead of placing. */
  private removeMode: boolean = false;
  private tpBalanceText!: Phaser.GameObjects.Text;
  private scrollOffset: number = 0;
  private gridContainer!: Phaser.GameObjects.Container;
  private gridGeometry!: { cellW: number; period: number; centerX: number };
  /** Reserved-slot decoration overlays, parallel to tileVisuals. Recreated by buildLoopGrid. */
  private reservedDecorations: Phaser.GameObjects.GameObject[] = [];
  /** Pending tooltip show; cancelled on pointerout. */
  private tooltipTimer?: Phaser.Time.TimerEvent;
  /** The currently displayed tooltip container (text + bg). Destroyed on hide. */
  private tooltipObj?: Phaser.GameObjects.Container;

  // Drag-scroll input handlers — stored so cleanup() can remove them. The
  // overlay's `scene.events` listeners use `this` as the context, but the
  // global input listeners need the original references to off() correctly.
  private onPointerDown?: (pointer: Phaser.Input.Pointer) => void;
  private onPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private onPointerUp?: () => void;
  private onWheel?: (
    pointer: Phaser.Input.Pointer,
    objects: Phaser.GameObjects.GameObject[],
    dx: number,
    dy: number,
  ) => void;

  constructor() {
    super(SCENE_KEYS.PLANNING);
  }

  create(data: { loopRunner: LoopRunner; loopRunState: LoopRunState }): void {
    this.scene.bringToTop();
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
      this.scene.launch(SCENE_KEYS.DECK_CUSTOMIZATION, { parentScene: SCENE_KEYS.PLANNING });
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
      this.scene.launch(SCENE_KEYS.RELIC_VIEWER, { parentScene: SCENE_KEYS.PLANNING });
    });

    this.input.keyboard?.on('keydown-D', () => {
      this.scene.sleep();
      this.scene.launch(SCENE_KEYS.DECK_CUSTOMIZATION, { parentScene: SCENE_KEYS.PLANNING });
    });
    this.input.keyboard?.on('keydown-R', () => {
      this.scene.sleep();
      this.scene.launch(SCENE_KEYS.RELIC_VIEWER, { parentScene: SCENE_KEYS.PLANNING });
    });

    // "Don't stop here for: 1 / 5 / 10 / 25" — auto-skips the next N planning
    // phases. Boss-loop planning (1 loop before the boss tile spawns) always
    // stops regardless of the chosen value; the skip counter is consumed by
    // GameScene's loop-completed handler.
    this.buildSkipLoopsRow(fontFamily);

    // Bottom row: Shop | Start Loop | Forge
    const startBtn = this.add.text(400, 545, 'Start Loop', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffd700',
      fontFamily,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setShadow(2, 2, '#000000', 2, true, true);

    const startLoop = () => {
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
          this.scene.wake(SCENE_KEYS.GAME);
        },
      });
    };

    startBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return; // Left click only
      startLoop();
    });

    this.buildShopForgeButtons(fontFamily);

    // Wave 5: Remove Mode toggle. Lives next to Start Loop on its own row
    // so it's discoverable without crowding the existing button line.
    this.buildRemoveModeButton(fontFamily);

    // Enable drag scroll for long loops
    this.setupDragScroll();

    this.events.on('shutdown', this.cleanup, this);

    // Re-sync economy + inventory from RunState when we wake (e.g. after the
    // Shop/Forge sub-scene closes). Without this, gold spent in the shop is
    // refunded next time Start Loop syncs LoopRunState → RunState.
    this.events.on('wake', () => this.syncFromRunStateOnWake());
  }

  private syncFromRunStateOnWake(): void {
    const run = getRun();
    this.loopRunState.economy.gold = run.economy.gold;
    this.loopRunState.economy.tilePoints = run.economy.tilePoints;
    // tileInventory shape: RunState stores Record<string,count>; LoopRunState
    // stores Array<{tileType,count}>. Re-derive the array view so the
    // inventory panel reflects anything purchased in the shop.
    this.loopRunState.tileInventory = Object.entries(run.economy.tileInventory ?? {})
      .filter(([, count]) => count > 0)
      .map(([tileType, count]) => ({ tileType, count }));
    this.refreshInventory();
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
    const y = 170;

    this.gridGeometry = { cellW, period, centerX };

    // Clear existing
    for (const tv of this.tileVisuals) {
      tv.destroy();
    }
    this.tileVisuals = [];
    for (const deco of this.reservedDecorations) deco.destroy();
    this.reservedDecorations = [];
    this.gridContainer.removeAll(true);

    for (let i = 0; i < tiles.length; i++) {
      const slot = tiles[i];
      // Initial position; updateTilePositions() handles the wrap math.
      const tv = new TileVisual(this, 0, y, slot, scale, i, true);
      tv.setData('beltSlot', i);
      this.gridContainer.add(tv);
      this.tileVisuals.push(tv);

      // Buffer tiles are part of the path but not editable and not shown —
      // they still occupy a slot so the displayed loop length matches the
      // hero's traversal, but they render invisibly.
      if (slot.type === 'buffer') {
        tv.setVisible(false);
        continue;
      }

      // Wave 5: reserved (empty) slot decoration. The slot already renders
      // a sparse "extension of host terrain" sprite (tile_reserved_<terrain>),
      // so the only added hint here is a faint cyan border so the player can
      // still spot reservation targets at a glance.
      if (slot.type === 'basic' && slot.reserved) {
        const glow = this.add.rectangle(0, y, tileSize + 4, tileSize + 4, 0x00ffcc, 0.18)
          .setStrokeStyle(1, 0x00ffcc, 0.7);
        glow.setData('beltSlot', i);
        this.gridContainer.add(glow);
        this.gridContainer.sendToBack(glow);
        this.reservedDecorations.push(glow);

        tv.onClick(() => this.onSlotClicked(i));
        continue;
      }

      // Empty (non-reserved) basic slots: clickable for normal-tile placement.
      if (slot.type === 'basic') {
        tv.setAlpha(0.6);
        tv.onClick(() => this.onSlotClicked(i));
        continue;
      }

      // Wave 5: placed (non-basic, non-buffer, non-boss) tiles are clickable
      // so Remove Mode can target them. Boss tiles stay locked.
      if (slot.type !== 'boss') {
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

    const placeAt = (obj: Phaser.GameObjects.GameObject & { x: number }, slot: number) => {
      let x = baseLeft + slot * cellW + this.scrollOffset;
      x = ((x - leftBound) % period + period) % period + leftBound;
      if (x > rightBound) x -= period;
      obj.x = x;
    };

    for (const tv of this.tileVisuals) {
      placeAt(tv, tv.getData('beltSlot') as number);
    }
    // Wave 5: keep reserved-slot decorations aligned with their host tile.
    for (const deco of this.reservedDecorations) {
      const slot = deco.getData('beltSlot') as number;
      placeAt(deco as Phaser.GameObjects.GameObject & { x: number }, slot);
    }
  }

  private onSlotClicked(slotIndex: number): void {
    // Wave 5: Remove Mode short-circuits placement. Clicking a placed
    // (non-basic, non-buffer, non-boss) tile triggers loopRunner.removeTile
    // which handles the 50% refund and orphan-subtile cascade.
    if (this.removeMode) {
      const removed = this.loopRunner.removeTile(slotIndex);
      if (removed) {
        this.buildLoopGrid();
        this.refreshInventory();
      } else {
        const slot = this.loopRunState.loop.tiles[slotIndex];
        if (slot?.type === 'boss') this.showToast('Boss tile cannot be removed.');
        else if (slot?.type === 'basic') this.showToast('Slot is already empty.');
        else this.showToast('Cannot remove that tile.');
      }
      return;
    }

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
    // Panel background — shifted up to make room for the subtile row beneath
    // the main tile row while keeping the "don't stop here for" + Remove Mode
    // toolbar at y=505 untouched.
    const board = this.add.image(400, 350, 'tile_selection_board');
    board.setDisplaySize(720, 190);


    // Tile point balance - repositioned and styled
    this.tpBalanceText = this.add.text(720, 290, `${this.loopRunState.economy.tilePoints} TP`, {
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
    // Wave 5: clear the parallel subtile row too.
    for (const card of this.subtileInventoryCards) {
      card.destroy();
    }
    this.subtileInventoryCards = [];

    // Update TP balance
    this.tpBalanceText.setText(`${this.loopRunState.economy.tilePoints} TP`);

    // Wave 5: split placeable tiles into the two pickers. Subtiles render
    // in a dedicated row below the main inventory and dim out when there
    // is no reserved slot to receive them.
    const allPlaceable = getAllPlaceableTiles();
    const placeableTiles = allPlaceable.filter(t => t.type !== 'subtile');
    const subtileTiles = allPlaceable.filter(t => t.type === 'subtile');

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
    const rowStartY = rows === 2 ? 330 : 350;

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
      const preview = new TileVisual(this, 0, 0, pseudoSlot, scale, 0, false);
      
      if (['rest', 'event', 'treasure', 'boss', 'terrain'].includes(pseudoSlot.type)) {
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

      // Affordability + Wave 5 context guards: normal tiles need a non-reserved
      // empty slot somewhere on the loop, and the picker is disabled entirely
      // while Remove Mode is active.
      const canAfford = freeCount > 0 || this.loopRunState.economy.tilePoints >= tileConfig.tilePointCost;
      const contextOk = !this.removeMode && this.hasOpenNormalSlot();
      const enabled = canAfford && contextOk;
      // Tooltip + hover effect wired on every card (interactive even when
      // unaffordable) so the player can read the blurb without committing
      // to a pick. Only the click handler is gated by `enabled`.
      frame.setInteractive({ useHandCursor: enabled });
      this.attachTooltip(frame, x, y - frameHeight / 2, tileConfig.description);
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
      if (!enabled) {
        container.setAlpha(0.5);
        if (!canAfford) costText.setColor('#880000');
      } else {
        frame.on('pointerdown', () => this.selectInventoryTile(idx, tileConfig.key));
      }

      this.inventoryCards.push(container);
    });

    // Wave 5: render the dedicated subtile row underneath the main panel.
    this.renderSubtileRow(subtileTiles, fontFamily);
  }

  /**
   * Wave 5: subtile picker. Renders below the main inventory panel as a
   * single row of smaller frames. Entries dim out when no reserved slot
   * exists to receive them (or when Remove Mode is active).
   */
  private renderSubtileRow(
    subtileTiles: ReturnType<typeof getAllPlaceableTiles>,
    fontFamily: string,
  ): void {
    if (subtileTiles.length === 0) return;

    const FRAME = 44;
    const GAP = 22;
    const total = subtileTiles.length * FRAME + (subtileTiles.length - 1) * GAP;
    const startX = 400 - total / 2 + FRAME / 2;
    const rowY = 445;

    const subtileSlotsExist = this.hasOpenReservedSlot();

    subtileTiles.forEach((tileConfig, idx) => {
      const x = startX + idx * (FRAME + GAP);
      const container = this.add.container(x, rowY);

      const frame = this.add.image(0, 0, 'tile_frame').setDisplaySize(FRAME, FRAME);
      container.add(frame);

      const pseudoSlot: TileSlot = {
        type: tileConfig.type,
        terrain: tileConfig.terrain,
        kind: tileConfig.key,           // needed so TileVisual resolves to the specific subtile_* config
        subtileEffect: tileConfig.effect,
        defeatedThisLoop: false,
      };
      const previewSize = Math.round(FRAME * 0.65);
      const scale = previewSize / TILE_SIZE;
      const preview = new TileVisual(this, 0, 0, pseudoSlot, scale, 0, false);
      container.add(preview);

      // Name label below the frame, cost label below the name.
      const nameText = this.add.text(0, FRAME / 2 + 6, tileConfig.name, {
        fontSize: '9px', color: '#ffdca0', fontFamily,
      }).setOrigin(0.5);
      container.add(nameText);

      const costText = this.add.text(0, FRAME / 2 + 18, `${tileConfig.tilePointCost} TP`, {
        fontSize: '10px', color: '#ff4444', fontFamily, fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(costText);

      const invEntry = this.loopRunState.tileInventory.find(t => t.tileType === tileConfig.key);
      const freeCount = invEntry?.count ?? 0;
      if (freeCount > 0) {
        const badge = this.add.text(FRAME / 2 - 4, -FRAME / 2 + 4, `x${freeCount}`, {
          fontSize: '10px', color: '#ffffff', fontFamily, fontStyle: 'bold',
          backgroundColor: '#333333', padding: { x: 2, y: 1 },
        }).setOrigin(1, 0);
        container.add(badge);
      }

      const canAfford = freeCount > 0 || this.loopRunState.economy.tilePoints >= tileConfig.tilePointCost;
      const contextOk = !this.removeMode && subtileSlotsExist;
      const enabled = canAfford && contextOk;
      // Tooltip + hover effect on every card so the player can read the
      // description regardless of affordability/context. Click is gated.
      frame.setInteractive({ useHandCursor: enabled });
      this.attachTooltip(frame, x, rowY - FRAME / 2, tileConfig.description);
      frame.on('pointerover', () => { container.setScale(1.1); frame.setTint(0xdddddd); });
      frame.on('pointerout',  () => { container.setScale(1);   frame.clearTint(); });
      if (!enabled) {
        container.setAlpha(0.5);
        if (!canAfford) costText.setColor('#880000');
      } else {
        // Subtile selection shares the same selectedTileKey + selectedCardIndex
        // pipeline, but tracks its container in subtileInventoryCards so
        // selectInventoryTile's deselection lookup can find the right ref.
        frame.on('pointerdown', () => this.selectSubtile(idx, tileConfig.key));
      }

      this.subtileInventoryCards.push(container);
    });
  }

  /**
   * Wave 5: subtile picker selection. Mirrors selectInventoryTile but
   * operates on the subtileInventoryCards array so highlight/deselect
   * find the correct container.
   */
  private selectSubtile(cardIndex: number, tileKey: string): void {
    // Deselect anything in either pool.
    if (this.selectedCardIndex >= 0) {
      const prevMain = this.inventoryCards[this.selectedCardIndex];
      const prevSub = this.subtileInventoryCards[this.selectedCardIndex];
      if (prevMain) prevMain.setScale(1);
      if (prevSub) prevSub.setScale(1);
    }

    if (this.selectedTileKey === tileKey) {
      // Toggle off
      this.selectedTileKey = null;
      this.selectedCardIndex = -1;
      return;
    }

    this.selectedTileKey = tileKey;
    this.selectedCardIndex = cardIndex;
    this.subtileInventoryCards[cardIndex]?.setScale(1.05);
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

    this.onPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > 130 && pointer.y < 230) {
        dragging = true;
        dragMoved = false;
        startPointerX = pointer.x;
        startOffset = this.scrollOffset;
      }
    };
    this.input.on('pointerdown', this.onPointerDown);

    this.onPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const dx = pointer.x - startPointerX;
      if (Math.abs(dx) > DRAG_THRESHOLD) dragMoved = true;
      // No clamp — the belt wraps via updateTilePositions().
      this.scrollOffset = startOffset + dx;
      this.updateTilePositions();
    };
    this.input.on('pointermove', this.onPointerMove);

    this.onPointerUp = () => {
      dragging = false;
      // Fold scrollOffset back into [0, period) so future drags don't grow
      // unbounded and lose precision over many loops.
      if (this.gridGeometry && this.gridGeometry.period > 0 && dragMoved) {
        const p = this.gridGeometry.period;
        this.scrollOffset = ((this.scrollOffset % p) + p) % p;
      }
    };
    this.input.on('pointerup', this.onPointerUp);

    // Mouse wheel scrolls horizontally too — handy for trackpads.
    this.onWheel = (
      pointer: Phaser.Input.Pointer,
      _objects: Phaser.GameObjects.GameObject[],
      _dx: number,
      dy: number,
    ) => {
      if (pointer.y < 130 || pointer.y > 230) return;
      this.scrollOffset -= dy;
      this.updateTilePositions();
    };
    this.input.on('wheel', this.onWheel);
  }

  /**
   * "Don't stop here for: 1 / 5 / 10 / 25" toggle row.
   * Sets `run.skipLoopsRemaining = N`, which GameScene consumes in its
   * loop-completed handler. Boss-loop planning ignores the counter.
   */
  private buildSkipLoopsRow(fontFamily: string): void {
    const run = getRun();
    const labelText = this.add.text(280, 505, "Don't stop here for:", {
      fontSize: '13px', color: '#ffdca0', fontFamily,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0.5);

    const optionValues = [1, 5, 10, 25];
    const optionTexts: Phaser.GameObjects.Text[] = [];

    const refresh = () => {
      const current = run.skipLoopsRemaining ?? 0;
      optionTexts.forEach((t, i) => {
        const isActive = optionValues[i] === current;
        t.setColor(isActive ? '#ffd700' : '#aaddff');
        t.setStyle({ fontStyle: isActive ? 'bold' : 'normal' });
      });
    };

    optionValues.forEach((value, idx) => {
      const x = 295 + idx * 50;
      const btn = this.add.text(x, 505, `${value}`, {
        fontSize: '16px', fontStyle: 'bold', color: '#aaddff', fontFamily,
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setScale(1.15));
      btn.on('pointerout', () => btn.setScale(1));
      btn.on('pointerdown', () => {
        const current = run.skipLoopsRemaining ?? 0;
        // Click the active option to clear it (toggle off).
        run.skipLoopsRemaining = current === value ? 0 : value;
        refresh();
      });
      optionTexts.push(btn);
    });

    // Discard parameter — text only exists to be visible.
    void labelText;
    refresh();
  }

  /** Wave 5: Remove Mode toggle. When active, slot clicks remove placed tiles. */
  private buildRemoveModeButton(fontFamily: string): void {
    const btn = this.add.text(720, 505, '🗑 Remove: OFF', {
      fontSize: '14px', fontStyle: 'bold', color: '#aaddff', fontFamily,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    const refresh = () => {
      btn.setText(this.removeMode ? '🗑 Remove: ON' : '🗑 Remove: OFF');
      btn.setColor(this.removeMode ? '#ff6655' : '#aaddff');
    };

    btn.on('pointerover', () => btn.setAlpha(0.85));
    btn.on('pointerout',  () => btn.setAlpha(1));
    btn.on('pointerdown', () => {
      this.removeMode = !this.removeMode;
      // Mutually exclusive with placement selection — entering remove mode
      // clears the picker, exiting leaves the player free to pick again.
      if (this.removeMode) {
        this.selectedTileKey = null;
        if (this.selectedCardIndex >= 0 && this.inventoryCards[this.selectedCardIndex]) {
          this.inventoryCards[this.selectedCardIndex].setScale(1);
        }
        if (this.selectedCardIndex >= 0 && this.subtileInventoryCards[this.selectedCardIndex]) {
          this.subtileInventoryCards[this.selectedCardIndex].setScale(1);
        }
        this.selectedCardIndex = -1;
      }
      refresh();
      this.refreshInventory();
    });

    refresh();
  }

  /** Wave 5: any empty basic slot that is NOT reserved — target for normal tiles. */
  private hasOpenNormalSlot(): boolean {
    return this.loopRunState.loop.tiles.some(t => t.type === 'basic' && !t.reserved && !t.enemyId);
  }

  /** Wave 5: any empty basic slot that IS reserved — target for subtile placement. */
  private hasOpenReservedSlot(): boolean {
    return this.loopRunState.loop.tiles.some(t => t.type === 'basic' && t.reserved === true && !t.enemyId);
  }

  /**
   * Attach 800ms-hover tooltip showing `description` to a frame. Cancels
   * on pointerout. Only fires when the tile config carries a description.
   */
  private attachTooltip(
    frame: Phaser.GameObjects.GameObject,
    worldX: number,
    worldY: number,
    description: string | undefined,
  ): void {
    if (!description) return;
    const interactive = frame as Phaser.GameObjects.GameObject & {
      on: (ev: string, fn: () => void) => void;
    };
    interactive.on('pointerover', () => {
      this.tooltipTimer?.remove();
      this.tooltipTimer = this.time.delayedCall(800, () => {
        this.showTooltip(worldX, worldY, description);
      });
    });
    interactive.on('pointerout', () => {
      this.tooltipTimer?.remove();
      this.tooltipTimer = undefined;
      this.hideTooltip();
    });
  }

  private showTooltip(anchorX: number, anchorY: number, text: string): void {
    this.hideTooltip();
    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
    // Build text first to measure size, then size the bg to fit.
    const label = this.add.text(0, 0, text, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily,
      wordWrap: { width: 220 },
      align: 'center',
    }).setOrigin(0.5);
    const pad = 8;
    const w = label.width + pad * 2;
    const h = label.height + pad * 2;
    const bg = this.add.rectangle(0, 0, w, h, 0x101010, 0.92)
      .setStrokeStyle(1, 0xffd700, 0.9);
    // Anchor above the frame; if it would clip the top of the screen,
    // flip below.
    let cy = anchorY - 44;
    if (cy - h / 2 < 8) cy = anchorY + 44;
    const container = this.add.container(anchorX, cy, [bg, label]);
    container.setDepth(2000);
    this.tooltipObj = container;
  }

  private hideTooltip(): void {
    if (this.tooltipObj) {
      this.tooltipObj.destroy(true);
      this.tooltipObj = undefined;
    }
  }

  /** "Shop" and "Forge" buttons on the planning overlay. Forge is its own scene now. */
  private buildShopForgeButtons(fontFamily: string): void {
    const shopBtn = this.add.text(150, 545, '🛒 Shop', {
      fontSize: '22px', fontStyle: 'bold', color: '#aaddff', fontFamily,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setShadow(2, 2, '#000000', 2, true, true);
    shopBtn.on('pointerover', () => shopBtn.setColor('#ffffff'));
    shopBtn.on('pointerout',  () => shopBtn.setColor('#aaddff'));
    shopBtn.on('pointerdown', () => this.openSubScene(SCENE_KEYS.SHOP));

    const forgeBtn = this.add.text(650, 545, '⚒ Forge', {
      fontSize: '22px', fontStyle: 'bold', color: '#aaddff', fontFamily,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setShadow(2, 2, '#000000', 2, true, true);
    forgeBtn.on('pointerover', () => forgeBtn.setColor('#ffffff'));
    forgeBtn.on('pointerout',  () => forgeBtn.setColor('#aaddff'));
    forgeBtn.on('pointerdown', () => this.openSubScene(SCENE_KEYS.FORGE));
  }

  private openSubScene(sceneKey: string): void {
    // Sync TP/gold back to RunState so the sub-scene sees the up-to-date
    // economy (planning may have spent TP placing tiles).
    const run = getRun();
    run.economy.gold = this.loopRunState.economy.gold;
    run.economy.tilePoints = this.loopRunState.economy.tilePoints;

    this.scene.sleep();
    this.scene.launch(sceneKey, { parentScene: SCENE_KEYS.PLANNING });
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
    // Cancel pending tooltip + drop any visible tooltip so the timer
    // doesn't fire into a destroyed scene.
    this.tooltipTimer?.remove();
    this.tooltipTimer = undefined;
    this.hideTooltip();

    // Destroy belt tile visuals; the container is destroyed below.
    for (const tv of this.tileVisuals) {
      tv.destroy();
    }
    this.tileVisuals = [];

    for (const card of this.inventoryCards) {
      card.destroy();
    }
    this.inventoryCards = [];
    // Wave 5: also clean up the subtile inventory row.
    for (const card of this.subtileInventoryCards) {
      card.destroy();
    }
    this.subtileInventoryCards = [];
    this.reservedDecorations = [];

    if (this.gridContainer) {
      this.gridContainer.destroy(true);
      this.gridContainer = undefined as unknown as Phaser.GameObjects.Container;
    }

    // Remove the global pointer/wheel handlers attached in setupDragScroll —
    // otherwise they re-stack each time the overlay is re-entered.
    if (this.onPointerDown) {
      this.input.off('pointerdown', this.onPointerDown);
      this.onPointerDown = undefined;
    }
    if (this.onPointerMove) {
      this.input.off('pointermove', this.onPointerMove);
      this.onPointerMove = undefined;
    }
    if (this.onPointerUp) {
      this.input.off('pointerup', this.onPointerUp);
      this.onPointerUp = undefined;
    }
    if (this.onWheel) {
      this.input.off('wheel', this.onWheel);
      this.onWheel = undefined;
    }
  }
}
