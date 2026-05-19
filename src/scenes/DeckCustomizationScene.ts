// DeckCustomizationScene -- deck viewer with drag-and-drop for dropped cards.
// Active deck cards are displayed but NOT draggable.
// Dropped (loot) cards appear in a separate strip and CAN be dragged into the deck.
// Uses the same drag-and-drop pattern as ShopDeckEditor.

import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { FONTS, LAYOUT } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';
import { createCardVisual, STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';
import { attachKeywordHover, scheduleKeywordPanel, type KeywordTooltipHandle } from '../ui/KeywordTooltip';
import { getCardById } from '../data/DataLoader';

const COLS = 6;
// Active-deck grid uses CardVisual at scale 0.5 → 75×120. Cell footprint
// reserves the same dimensions so grid math stays simple.
const CARD_SCALE = 0.5;
const CARD_W = STANDARD_CARD_WIDTH * CARD_SCALE;   // 75
const CARD_H = STANDARD_CARD_HEIGHT * CARD_SCALE;  // 120
const GAP = 10;

// ── Dropped cards strip constants ──
const STRIP_TOP = 160;
// Dropped strip uses a smaller scale so 6+ cards fit horizontally.
const STRIP_SCALE = 0.4;
const STRIP_CARD_W = STANDARD_CARD_WIDTH * STRIP_SCALE;   // 60
const STRIP_CARD_H = STANDARD_CARD_HEIGHT * STRIP_SCALE;  // 96
const STRIP_GAP = 8;
const STRIP_HEIGHT = STRIP_CARD_H + 20;

export class DeckCustomizationScene extends Scene {
  // Active deck state (working copy)
  private deckOrder: string[] = [];
  /** Parallel to deckOrder: upgrade flag per deck position. */
  private upgradedOrder: boolean[] = [];
  private cardSlots: Phaser.GameObjects.Container[] = [];
  private gridContainer!: Phaser.GameObjects.Container;

  // Dropped cards strip
  private droppedStrip!: Phaser.GameObjects.Container;

  // Drag state
  private dragCard: Phaser.GameObjects.Container | null = null;
  private dragFromDropped = false;
  private dragFromDeck = false;
  private dragDroppedIndex = -1;
  private dragDeckIndex = -1;
  private dragCardId = '';
  private hoverIndex = -1;
  /** Pending keyword tooltip for the active drag (fires after 2s). */
  private dragTooltip: KeywordTooltipHandle | null = null;

  private scrollY = 0;
  private maxScroll = 0;
  private parentScene: string = SCENE_KEYS.GAME;

  // Off-display-list Graphics backing the scroll mask. Phaser does not auto-
  // destroy `this.make.graphics()` objects because they are not in the
  // display list; store a ref so cleanup() can destroy it.
  private scrollMaskGfx: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super(SCENE_KEYS.DECK_CUSTOMIZATION);
  }

  create(data?: { parentScene?: string }): void {
    this.scene.bringToTop();
    const run = getRun();
    this.deckOrder = [...run.deck.active];
    this.upgradedOrder = [...run.deck.upgraded];
    this.scrollY = 0;
    // Scene instances are reused on re-entry; clear any stale drag flags
    // before binding handlers so the first click doesn't trip a leftover
    // bag-drop branch in dropCard().
    this.resetDragState();
    this.parentScene = data?.parentScene ?? SCENE_KEYS.GAME;

    this.cameras.main.setBackgroundColor(0x1a1a2e);
    if (this.textures.exists('deck_frame')) {
        const board = this.add.image(LAYOUT.centerX, LAYOUT.centerY - 10, 'deck_frame');
        board.setDisplaySize(760, 540); // Slightly wider but controlled
        board.setDepth(-1);
    }

    const fontFamily = FONTS.family;

    const hasDropped = run.deck.droppedCards.length > 0;

    // Stats board - Reduced size for a more compact look, moved down slightly
    if (this.textures.exists('deck_status_board')) {
      this.add.image(LAYOUT.centerX, 75, 'deck_status_board').setDisplaySize(450, 34);
    }

    const deckIds = run.deck.active;
    // Using symbols to mimic the icons in the mockup
    const statsText = `${deckIds.length} Cards  |  ⚔️ Atk: ${run.hero.strength}  |  🛡️ Def: ${run.hero.defenseMultiplier}  |  ✨ Mag: ${run.hero.maxMana}`;
    
    this.add.text(LAYOUT.centerX, 75, statsText, {
      fontSize: '15px',
      color: '#ffffff',
      fontFamily,
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);

    // ── Dropped cards strip ──
    this.droppedStrip = this.add.container(0, 0);
    if (hasDropped) {
      this.buildDroppedStrip(run.deck.droppedCards);
    }

    // ── Active deck grid ──
    this.gridContainer = this.add.container(0, 0);

    // Create a mask to keep cards within the ornate frame interior
    const maskGraphics = this.add.graphics();
    maskGraphics.fillStyle(0xffffff);
    // Adjusted for 760 width
    maskGraphics.fillRect(LAYOUT.centerX - 360, 160, 720, 400);
    maskGraphics.setVisible(false);
    const mask = new Phaser.Display.Masks.GeometryMask(this, maskGraphics);
    this.gridContainer.setMask(mask);

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
    this.scrollMaskGfx = maskGfx;

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
    this.input.keyboard?.on('keydown-D', () => this.close());
    this.input.keyboard?.on('keydown-ESC', () => this.close());

    this.events.on('shutdown', this.cleanup, this);
  }

  // ── Layout helpers ──

  private getGridTop(): number {
    const hasDropped = getRun().deck.droppedCards.length > 0;
    return hasDropped ? 280 : 180;
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
      const slot = this.createMiniCard(droppedIds[i], x, y, -1, true, STRIP_SCALE);
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
    scale: number = CARD_SCALE,
  ): Phaser.GameObjects.Container {
    // Unified card visual — replaces the custom deck_frame + bespoke text
    // layout. CardVisual already shows category strip, rarity outline, name,
    // cost, cooldown, and either the pixel-art image (when loaded) or the
    // procedural look (when missing).
    const visual = createCardVisual(this, x, y, cardId, { scale });
    // Override CardVisual's built-in pointerdown (which opens the card detail
    // popup). The Customization scene uses pointerdown to start a drag, not to
    // open a popup. We strip prior listeners and rebind our drag handlers.
    visual.removeAllListeners('pointerdown');
    visual.removeAllListeners('pointerover');
    visual.removeAllListeners('pointerout');

    // Re-wire the 2-second keyword tooltip — CardVisual attaches it on creation
    // but the removeAllListeners() calls above also strip its pointerover/out
    // bindings. Anchor is resolved lazily so the panel tracks scroll: deck
    // slots live inside gridContainer (which translates on scroll) and strip
    // slots live inside droppedStrip; both parents may offset the visual.
    const card = getCardById(cardId);
    if (card) {
      const w = STANDARD_CARD_WIDTH * scale;
      const h = STANDARD_CARD_HEIGHT * scale;
      attachKeywordHover(this, visual, card.description, () => ({
        x: visual.x + (visual.parentContainer?.x ?? 0),
        y: visual.y + (visual.parentContainer?.y ?? 0),
        w,
        h,
      }));
    }

    // Order number badge (top-left) for active-deck cards — kept because the
    // numbered position is meaningful to the player.
    if (deckIndex >= 0) {
      const halfW = (STANDARD_CARD_WIDTH * scale) / 2;
      const halfH = (STANDARD_CARD_HEIGHT * scale) / 2;
      const badge = this.add.text(x - halfW + 4, y - halfH + 2, `${deckIndex + 1}`, {
        fontSize: '11px', fontStyle: 'bold', color: '#ffffff',
        fontFamily: FONTS.family, stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0, 0).setDepth(1);
      // Attach the badge as a sibling that follows the container — we add
      // it to the same parent (the caller's container) but here we approximate
      // by storing it on the visual's data so callers can manage lifecycle.
      visual.setData('_orderBadge', badge);
      // The badge isn't a child of the container, so make sure it's destroyed
      // alongside it.
      visual.once('destroy', () => badge.destroy());
    }

    if (isDraggable) {
      visual.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        const droppedIdx = visual.getData('droppedIndex') as number;
        this.startDragFromDropped(droppedIdx, cardId, pointer);
      });
    } else {
      visual.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.startDragFromDeck(deckIndex, cardId, pointer);
      });
    }

    return visual;
  }

  // ── Drag from dropped strip ──

  private startDragFromDropped(droppedIndex: number, cardId: string, pointer: Phaser.Input.Pointer): void {
    this.dragFromDropped = true;
    this.dragDroppedIndex = droppedIndex;
    this.dragCardId = cardId;
    this.hoverIndex = this.deckOrder.length; // default: end of deck

    // Create enlarged drag visual
    this.dragCard = this.createDragVisual(cardId, pointer.x, pointer.y);
    this.scheduleDragTooltip(cardId);
  }

  private startDragFromDeck(deckIndex: number, cardId: string, pointer: Phaser.Input.Pointer): void {
    this.dragFromDeck = true;
    this.dragDeckIndex = deckIndex;
    this.dragCardId = cardId;
    this.hoverIndex = deckIndex;

    // Hide the original slot while dragging
    if (this.cardSlots[deckIndex]) this.cardSlots[deckIndex].setVisible(false);
    this.dragCard = this.createDragVisual(cardId, pointer.x, pointer.y);
    this.scheduleDragTooltip(cardId);
  }

  /**
   * Schedule the keyword glossary panel to appear after the standard 2-second
   * hold while a card is being dragged. The anchor is read lazily at fire
   * time so the panel mounts next to wherever the drag visual currently is.
   * Auto-cancelled in cancelDragTooltip() when the drag ends or the scene
   * shuts down.
   */
  private scheduleDragTooltip(cardId: string): void {
    this.cancelDragTooltip();
    const card = getCardById(cardId);
    if (!card) return;
    // The drag visual renders CardVisual at scale 0.9; mirror that here so
    // the anchor box matches the on-screen drag preview.
    const DRAG_SCALE = 0.9;
    const w = STANDARD_CARD_WIDTH * DRAG_SCALE;
    const h = STANDARD_CARD_HEIGHT * DRAG_SCALE;
    this.dragTooltip = scheduleKeywordPanel(this, card.description, () => ({
      x: this.dragCard?.x ?? 0,
      y: this.dragCard?.y ?? 0,
      w, h,
    }));
  }

  private cancelDragTooltip(): void {
    if (this.dragTooltip) {
      this.dragTooltip.cancel();
      this.dragTooltip = null;
    }
  }

  private createDragVisual(cardId: string, x: number, y: number): Phaser.GameObjects.Container {
    // Enlarged CardVisual for the floating drag preview — uses the same
    // procedural / png-backed look as the rest of the deck UI, just larger.
    const visual = createCardVisual(this, x, y, cardId, { scale: 0.9 });
    visual.removeAllListeners('pointerdown');
    visual.removeAllListeners('pointerover');
    visual.removeAllListeners('pointerout');
    visual.disableInteractive();
    visual.setDepth(1000);
    // Tiny scale-up confirmation tween — matches the prior pickup feel.
    this.tweens.add({ targets: visual, scaleX: 1.0, scaleY: 1.0, duration: 80 });
    return visual;
  }

  // ── Animate deck slots to open gap at hoverIndex ──

  private animateSlots(): void {
    const gapAt = Math.min(this.hoverIndex, this.deckOrder.length);
    let visualCounter = 0;

    for (let i = 0; i < this.deckOrder.length; i++) {
      const slot = this.cardSlots[i];
      if (!slot) continue;

      // Skip the card being dragged from the deck (it's hidden)
      if (this.dragFromDeck && i === this.dragDeckIndex) continue;

      // Open a gap at hover position
      if (visualCounter === gapAt) visualCounter++;

      const targetPos = this.getSlotPos(visualCounter);
      this.tweens.add({
        targets: slot,
        x: targetPos.x,
        y: targetPos.y,
        duration: 150,
        ease: 'Sine.easeOut',
        overwrite: true,
      });
      visualCounter++;
    }
  }

  // ── Drop card into deck ──

  private dropCard(): void {
    if (!this.dragCard) return;

    // Tear down any keyword tooltip that was scheduled or already mounted
    // for the drag — must run regardless of which drop branch we hit below.
    this.cancelDragTooltip();

    // Capture release position before destroying the drag visual — used to
    // gate bag→deck inserts so releasing outside the deck grid cancels.
    const releaseY = this.dragCard.y;
    this.dragCard.destroy(true);
    this.dragCard = null;

    if (this.dragFromDropped && this.dragDroppedIndex >= 0) {
      // Bag drag released above the deck grid (over the strip / header) —
      // treat as cancel: the card stays in the bag.
      if (releaseY < this.getGridTop()) {
        // animateSlots() had opened a gap at hoverIndex; reset and re-run so
        // the slots smoothly slide back to their natural positions before
        // we clear drag state.
        this.resetDragState();
        this.animateSlots();
        return;
      }
      const run = getRun();

      // Remove from droppedCards
      if (this.dragDroppedIndex < run.deck.droppedCards.length) {
        run.deck.droppedCards.splice(this.dragDroppedIndex, 1);
      }

      // Insert into active deck at hover position. Loot/dropped cards
      // arrive un-upgraded — push `false` into the parallel flag array.
      const insertAt = Math.min(this.hoverIndex, this.deckOrder.length);
      this.deckOrder.splice(insertAt, 0, this.dragCardId);
      this.upgradedOrder.splice(insertAt, 0, false);
      run.deck.active = [...this.deckOrder];
      run.deck.upgraded = [...this.upgradedOrder];

      this.resetDragState();

      // Full scene restart so layout recalculates (strip may disappear).
      // Pass parentScene via data so the restarted scene preserves the
      // close target (don't rely on closure capture of the previous run).
      this.scene.restart({ parentScene: this.parentScene });
      return;
    }

    if (this.dragFromDeck && this.dragDeckIndex >= 0) {
      const run = getRun();

      // Remove from original position and insert at hover. Move the
      // upgrade flag in lockstep so the upgrade follows its card.
      const [moved] = this.deckOrder.splice(this.dragDeckIndex, 1);
      const [movedFlag] = this.upgradedOrder.splice(this.dragDeckIndex, 1);
      let insertAt = Math.min(this.hoverIndex, this.deckOrder.length);
      // Adjust for the removed element
      if (this.hoverIndex > this.dragDeckIndex) insertAt = Math.max(0, insertAt - 1);
      this.deckOrder.splice(insertAt, 0, moved);
      this.upgradedOrder.splice(insertAt, 0, movedFlag);
      run.deck.active = [...this.deckOrder];
      run.deck.upgraded = [...this.upgradedOrder];

      this.resetDragState();
      this.rebuildGrid();
      return;
    }

    this.resetDragState();
    this.rebuildGrid();
  }

  private close(): void {
    // Different launchers leave the parent in different states:
    //   GameScene + LoopHUD → paused → needs resume()
    //   PlanningOverlay     → slept  → needs wake()
    // resume() and wake() each only act on their target state, so dispatch
    // on the live SceneManager status to avoid leaving the parent stuck.
    if (this.scene.isSleeping(this.parentScene)) {
      this.scene.wake(this.parentScene);
    } else {
      this.scene.resume(this.parentScene);
    }
    this.scene.stop();
  }

  private resetDragState(): void {
    this.dragFromDropped = false;
    this.dragFromDeck = false;
    this.dragDroppedIndex = -1;
    this.dragDeckIndex = -1;
    this.dragCardId = '';
    this.hoverIndex = -1;
  }

  private cleanup(): void {
    if (this.dragCard) {
      this.dragCard.destroy(true);
      this.dragCard = null;
    }
    // Cancel any pending/mounted drag tooltip so its timer doesn't fire on
    // a destroyed scene (and so a mounted panel doesn't leak across exits).
    this.cancelDragTooltip();
    // Phaser reuses scene instances on stop/launch, so stale drag flags from
    // an interrupted drag (ESC/D mid-drag) would otherwise leak into the next
    // entry and corrupt the next dropCard() call.
    this.resetDragState();
    this.cardSlots = [];

    // Destroy the off-display-list mask Graphics so re-entering the scene
    // doesn't leak a Graphics + its underlying mask render texture.
    if (this.scrollMaskGfx) {
      this.scrollMaskGfx.destroy();
      this.scrollMaskGfx = null;
    }
  }
}
