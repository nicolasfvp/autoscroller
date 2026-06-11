// DeckCustomizationScene -- the in-run deck editor.
//
// Layout (800×600 canvas):
//   [00-50]    Header strip — back · title · glossary
//   [60-578]   Active deck grid — 5 cols × up to 3 rows (max 15 cards)
//              · Cards centered both axes; rows expand as deck grows
//              · Order number floats ABOVE each card
//              · Hover any card to see a large preview beside it
//   [590-600]  Contextual hint line
//
// New cards (forge, shops, treasure) are added straight to the deck, so the
// editor is purely for reordering and reviewing — there is no loot bag.
//
// Drag-and-drop preserves the click offset on the card: wherever the player
// grabs the card, that point stays under the cursor for the whole drag.

import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { FONTS, LAYOUT, COLORS } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';
import { createCardVisual, STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';
import { disableCardFaceInput, createCardFace } from '../ui/CardFace';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';
import { TutorialOverlay } from '../ui/TutorialOverlay';
import { addGlossaryButton } from '../ui/GlossaryButton';
import { keywordIntro } from '../systems/keywordIntro/KeywordIntroService';
import { t } from '../i18n/i18n';
import { localizedImageButton } from '../ui/LocalizedButton';

// ── Layout zones ─────────────────────────────────────────────────────────
const HEADER_BOTTOM = 44;
const DECK_TOP = 56;
const DECK_BOTTOM = 578;
const HINT_Y = 593;

// Active-deck grid — 5 cols × up to 3 rows (max 15). The visual size of
// the cards is RESPONSIVE to deck length: a small deck spreads luxuriously,
// a full 15-card deck packs tight. The breakpoints are chosen so the
// rendered grid (with row gaps + badges above the first row) clears the
// header and the hint line in every configuration.
const COLS = 5;
const MAX_DECK = 15;
const COL_GAP = 16;
const TIER_BREAKPOINTS = [
  // up to N cards, card scale (× small base 150×240), row gap
  { upTo: 5,  scale: 0.85, rowGap: 18 },   // 1 row,  127.5 × 204
  { upTo: 10, scale: 0.65, rowGap: 20 },   // 2 rows, 97.5  × 156
  { upTo: 15, scale: 0.52, rowGap: 22 },   // 3 rows, 78    × 124.8
] as const;

// Order badge — small parchment chip floating above each card.
const BADGE_OFFSET = 8;

// Hover preview — the FULL popup-layout card (with description panel) shown
// next to the hovered card. The small in-hand layout drops the description
// for compactness; using baseSize 'popup' here gives the player the full read.
// Base popup is 340×540; we scale to ~0.7 → 238×378, which fits beside the
// small grid card and clears the canvas edges.
const HOVER_DELAY_MS = 220;
const HOVER_SCALE = 0.7;
const HOVER_W = 340 * HOVER_SCALE;   // 238
const HOVER_H = 540 * HOVER_SCALE;   // 378

// Chrome palette
const CHROME = {
  bgTint: 0x0e0c0a,
  panelStroke: 0x6b5a3a,
  ghost: 0xffd700,
} as const;

interface DragOffset { x: number; y: number }

export class DeckCustomizationScene extends Scene {
  // Active deck working copy
  private deckOrder: string[] = [];
  private upgradedOrder: boolean[] = [];
  private cardSlots: Phaser.GameObjects.Container[] = [];
  private orderBadges: Phaser.GameObjects.Container[] = [];
  private gridContainer!: Phaser.GameObjects.Container;
  private ghostSlot: Phaser.GameObjects.Graphics | null = null;

  // Hint
  private hintText!: Phaser.GameObjects.Text;

  // Hover preview state
  private hoverPreview: Phaser.GameObjects.Container | null = null;
  private hoverTimer: Phaser.Time.TimerEvent | null = null;

  // Drag state
  private dragCard: Phaser.GameObjects.Container | null = null;
  private dragOffset: DragOffset = { x: 0, y: 0 };
  private dragFromDeck = false;
  private dragDeckIndex = -1;
  private hoverIndex = -1;

  private parentScene: string = SCENE_KEYS.GAME;
  private tutorialOrigin = false;

  constructor() {
    super(SCENE_KEYS.DECK_CUSTOMIZATION);
  }

  create(data?: { parentScene?: string; tutorialOrigin?: boolean }): void {
    this.scene.bringToTop();
    const run = getRun();
    this.deckOrder = [...run.deck.active];
    this.upgradedOrder = [...run.deck.upgraded];
    this.resetDragState();
    this.parentScene = data?.parentScene ?? SCENE_KEYS.GAME;
    this.tutorialOrigin = !!data?.tutorialOrigin;

    this.buildBackground();
    this.buildHeader();
    this.buildDeckGrid();
    this.buildHint();

    void keywordIntro.init();
    this.attachPointerHandlers();
    this.events.on('shutdown', this.cleanup, this);

    TutorialOverlay.mountIfActive(this);
  }

  // ── Chrome ───────────────────────────────────────────────────────────────

  private buildBackground(): void {
    this.cameras.main.setBackgroundColor(CHROME.bgTint);
    const bgKey = this.textures.exists('bg_deck_editor_v2')
      ? 'bg_deck_editor_v2'
      : (this.textures.exists('bg_deck_builder') ? 'bg_deck_builder' : null);
    if (bgKey) {
      const bg = this.add.image(LAYOUT.centerX, LAYOUT.centerY, bgKey);
      bg.setDisplaySize(LAYOUT.canvasWidth, LAYOUT.canvasHeight);
      bg.setAlpha(0.78);
      bg.setDepth(-10);
    }
    this.add.rectangle(LAYOUT.centerX, LAYOUT.centerY, LAYOUT.canvasWidth, LAYOUT.canvasHeight, 0x000000, 0.34)
      .setDepth(-9);
  }

  private buildHeader(): void {
    this.add.rectangle(LAYOUT.centerX, HEADER_BOTTOM / 2, LAYOUT.canvasWidth, HEADER_BOTTOM, 0x14100c, 0.86)
      .setStrokeStyle(1, CHROME.panelStroke);

    this.add.text(LAYOUT.centerX, HEADER_BOTTOM / 2, t('deckCustom.title'), {
      fontSize: '22px', fontStyle: 'bold', color: COLORS.accent,
      fontFamily: FONTS.body, stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true);

    localizedImageButton(this, 72, LAYOUT.canvasHeight - 28, 'btn_back_settings', t('common.back'), 130, () => this.close(), { height: 51 });

    addGlossaryButton(this, 770, HEADER_BOTTOM / 2);
  }

  // ── Deck grid (5×3, centered both axes, no scroll) ──────────────────────

  // Cached per-rebuild — recomputed from current deck size so cards smoothly
  // resize as the deck grows / shrinks.
  private cardScale: number = TIER_BREAKPOINTS[0].scale;
  private cardW: number = STANDARD_CARD_WIDTH * TIER_BREAKPOINTS[0].scale;
  private cardH: number = STANDARD_CARD_HEIGHT * TIER_BREAKPOINTS[0].scale;
  private rowGap: number = TIER_BREAKPOINTS[0].rowGap;

  private buildDeckGrid(): void {
    this.gridContainer = this.add.container(0, 0);

    this.ghostSlot = this.add.graphics();
    this.ghostSlot.setVisible(false);
    this.ghostSlot.setDepth(5);
    this.gridContainer.add(this.ghostSlot);

    this.rebuildGrid();
  }

  /**
   * Pick the tier (scale + row gap) for the given deck size and cache it on
   * the instance. Called once per rebuildGrid so all helpers below see the
   * same dimensions for a given pass.
   */
  private resolveTier(total: number): void {
    const tier = TIER_BREAKPOINTS.find(t => total <= t.upTo) ?? TIER_BREAKPOINTS[TIER_BREAKPOINTS.length - 1];
    this.cardScale = tier.scale;
    this.cardW = STANDARD_CARD_WIDTH * tier.scale;
    this.cardH = STANDARD_CARD_HEIGHT * tier.scale;
    this.rowGap = tier.rowGap;
  }

  private rowCount(total = this.deckOrder.length): number {
    return Math.max(1, Math.ceil(total / COLS));
  }

  /**
   * Top-edge Y of the grid block — chosen so the visible rows are vertically
   * centered inside the deck band. As cards are added and another row opens,
   * existing cards smoothly slide up to keep the whole block centered.
   */
  private getGridTop(total = this.deckOrder.length): number {
    const rows = this.rowCount(total);
    const totalH = rows * this.cardH + (rows - 1) * this.rowGap;
    const bandH = DECK_BOTTOM - DECK_TOP;
    return DECK_TOP + (bandH - totalH) / 2;
  }

  /**
   * Cards in row r of a deck with N cards. The last row is partial when
   * N % COLS !== 0; earlier rows are always full.
   */
  private cardsInRow(r: number, total: number): number {
    const lastRow = Math.max(0, Math.ceil(total / COLS) - 1);
    if (total === 0) return 0;
    if (r < lastRow) return COLS;
    const tail = total - r * COLS;
    return Math.max(0, Math.min(COLS, tail));
  }

  /**
   * Position the i-th card occupies in a deck of `total` cards. Each row
   * is centered horizontally for its own card count — so a 3-card deck
   * sits centered on the canvas, and a 6-card deck has a full 5-card row
   * on top with a single-card row centered below.
   */
  private getSlotPos(i: number, total = this.deckOrder.length): { x: number; y: number } {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const rowN = Math.max(1, this.cardsInRow(r, total));
    const rowW = rowN * this.cardW + (rowN - 1) * COL_GAP;
    const rowLeft = (LAYOUT.canvasWidth - rowW) / 2;
    const x = rowLeft + c * (this.cardW + COL_GAP) + this.cardW / 2;
    const y = this.getGridTop(total) + r * (this.cardH + this.rowGap) + this.cardH / 2;
    return { x, y };
  }

  /**
   * Map a world point to an insert position 0..N. Finds the closest card,
   * then chooses "before" or "after" by the cursor's relation to that card's
   * center X. Pointer above the grid → 0; below the last row → N.
   */
  private getInsertIndex(worldX: number, worldY: number): number {
    const N = this.deckOrder.length;
    if (N === 0) return 0;
    const gridTop = this.getGridTop();
    if (worldY < gridTop) return 0;
    if (worldY > gridTop + this.rowCount() * (this.cardH + this.rowGap)) return N;

    let nearest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < N; i++) {
      const p = this.getSlotPos(i);
      const dx = p.x - worldX;
      const dy = p.y - worldY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; nearest = i; }
    }
    const np = this.getSlotPos(nearest);
    return worldX < np.x ? nearest : nearest + 1;
  }

  private isOverGrid(worldY: number): boolean {
    return worldY >= DECK_TOP - 4 && worldY <= DECK_BOTTOM + 4;
  }

  private rebuildGrid(): void {
    for (const slot of this.cardSlots) slot.destroy(true);
    for (const badge of this.orderBadges) badge.destroy(true);
    this.cardSlots = [];
    this.orderBadges = [];

    // Pick scale/gap for the current deck size, then place every slot using
    // those tier dimensions. This is what makes the layout "breathe" as the
    // deck grows: 1-row decks get large cards, 3-row decks pack tighter.
    this.resolveTier(this.deckOrder.length);

    for (let i = 0; i < this.deckOrder.length; i++) {
      const pos = this.getSlotPos(i);
      const slot = this.createMiniCard(this.deckOrder[i], pos.x, pos.y, i);
      this.gridContainer.add(slot);
      this.cardSlots.push(slot);

      const badge = this.createOrderBadge(i, pos.x, pos.y);
      this.gridContainer.add(badge);
      this.orderBadges.push(badge);
    }
  }

  /**
   * Order chip — sits ABOVE the card top edge so it never overlaps mana cost
   * or other header glyphs.
   */
  private createOrderBadge(index: number, cardCenterX: number, cardCenterY: number): Phaser.GameObjects.Container {
    const c = this.add.container(cardCenterX, cardCenterY - this.cardH / 2 - BADGE_OFFSET);
    c.add(this.add.rectangle(0, 0, 22, 16, 0x14100c, 0.95).setStrokeStyle(1, CHROME.panelStroke));
    c.add(this.add.text(0, 0, `${index + 1}`, {
      fontSize: '11px', fontStyle: 'bold', color: '#ffe28a',
      fontFamily: FONTS.body, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5));
    c.setDepth(10);
    return c;
  }

  private createMiniCard(
    cardId: string,
    x: number,
    y: number,
    deckIndex: number,
  ): Phaser.GameObjects.Container {
    const visual = createCardVisual(this, x, y, cardId, { scale: this.cardScale });
    visual.removeAllListeners('pointerdown');
    visual.removeAllListeners('pointerover');
    visual.removeAllListeners('pointerout');

    // Hover preview — fires after a short hold to avoid flashing during pans.
    visual.on('pointerover', () => {
      if (this.dragCard) return;
      this.scheduleHoverPreview(cardId, x, y);
    });
    visual.on('pointerout', () => {
      this.cancelHoverPreview();
    });

    visual.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.startDragFromDeck(deckIndex, cardId, pointer);
    });

    return visual;
  }

  // ── Hover preview (magnified card face) ─────────────────────────────────

  private scheduleHoverPreview(cardId: string, cardX: number, cardY: number): void {
    this.cancelHoverPreview();
    this.hoverTimer = this.time.delayedCall(HOVER_DELAY_MS, () => {
      if (this.dragCard) return;
      this.showHoverPreview(cardId, cardX, cardY);
    });
  }

  private showHoverPreview(cardId: string, cardX: number, cardY: number): void {
    this.cancelHoverPreview(true);

    // Anchor logic: prefer right of the card. If the preview would clip the
    // right edge, flip to the left. If both sides clip (extreme zoom), center.
    const marginX = 14;
    const marginY = 14;
    let px = cardX + this.cardW / 2 + marginX + HOVER_W / 2;
    if (px + HOVER_W / 2 > LAYOUT.canvasWidth - 8) {
      px = cardX - this.cardW / 2 - marginX - HOVER_W / 2;
    }
    if (px - HOVER_W / 2 < 8) {
      px = LAYOUT.centerX;
    }
    let py = cardY;
    py = Math.max(HOVER_H / 2 + marginY, Math.min(LAYOUT.canvasHeight - HOVER_H / 2 - marginY, py));

    const upgraded = (() => {
      const idx = this.deckOrder.indexOf(cardId);
      return idx >= 0 ? this.upgradedOrder[idx] : false;
    })();

    // baseSize: 'popup' renders the full card layout — header, art, name,
    // elements AND the description panel. 'small' would only give the
    // compact in-hand layout (art swallows the bottom; no description).
    const card = createCardFace(this, px, py, cardId, {
      baseSize: 'popup',
      scale: HOVER_SCALE,
      hover: false,
      upgraded,
    });
    disableCardFaceInput(card);
    card.setDepth(900);
    card.setAlpha(0);
    this.tweens.add({ targets: card, alpha: 1, duration: 90, ease: 'Sine.easeOut' });

    this.hoverPreview = card;
  }

  private cancelHoverPreview(keepTimerForReplace: boolean = false): void {
    if (!keepTimerForReplace && this.hoverTimer) {
      this.hoverTimer.remove(false);
      this.hoverTimer = null;
    }
    if (this.hoverPreview) {
      this.hoverPreview.destroy(true);
      this.hoverPreview = null;
    }
  }

  // ── Drag start ───────────────────────────────────────────────────────────

  private startDragFromDeck(deckIndex: number, cardId: string, pointer: Phaser.Input.Pointer): void {
    this.cancelHoverPreview();
    this.dragFromDeck = true;
    this.dragDeckIndex = deckIndex;
    this.hoverIndex = deckIndex;

    const slot = this.cardSlots[deckIndex];
    const badge = this.orderBadges[deckIndex];
    if (slot) slot.setVisible(false);
    if (badge) badge.setVisible(false);

    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cw = slot?.getWorldTransformMatrix();
    const centerX = cw?.tx ?? wp.x;
    const centerY = cw?.ty ?? wp.y;
    this.dragOffset = { x: wp.x - centerX, y: wp.y - centerY };
    this.dragCard = this.createDragVisual(cardId, centerX, centerY);
    this.showGhost(deckIndex);

    this.setHint(t('deckCustom.hintDrop'));
  }

  private createDragVisual(cardId: string, x: number, y: number): Phaser.GameObjects.Container {
    const visual = createCardVisual(this, x, y, cardId, { scale: this.cardScale * 1.15 });
    disableCardFaceInput(visual);
    visual.setDepth(1000);
    this.tweens.add({ targets: visual, scaleX: 1.0, scaleY: 1.0, duration: 80, ease: 'Sine.easeOut' });
    return visual;
  }

  // ── Pointer move / up ────────────────────────────────────────────────────

  private attachPointerHandlers(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragCard) return;
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.dragCard.x = wp.x - this.dragOffset.x;
      this.dragCard.y = wp.y - this.dragOffset.y;

      if (this.isOverGrid(wp.y)) {
        const newHover = this.getInsertIndex(wp.x, wp.y);
        if (newHover !== this.hoverIndex) {
          this.hoverIndex = newHover;
          this.animateSlots();
          this.showGhost(this.hoverIndex);
        }
      } else if (this.ghostSlot) {
        this.ghostSlot.setVisible(false);
      }
    });

    this.input.on('pointerup', () => {
      if (!this.dragCard) return;
      this.dropCard();
    });
  }

  // ── Animation: open a gap at hoverIndex ─────────────────────────────────

  private animateSlots(): void {
    // Re-position visible cards so a gap opens at hoverIndex. The deck count
    // stays at N during a reorder: the dragged card is hidden and the others
    // shift to leave slot `hoverIndex` empty (the ghost). The tier is fixed
    // throughout, so the animation stays smooth.
    const N = this.deckOrder.length;
    const gapAt = Math.min(this.hoverIndex, N);
    let visualCounter = 0;

    for (let i = 0; i < N; i++) {
      const slot = this.cardSlots[i];
      const badge = this.orderBadges[i];
      if (!slot) continue;
      if (i === this.dragDeckIndex) continue;

      if (visualCounter === gapAt) visualCounter++;

      const target = this.getSlotPos(visualCounter, N);
      this.tweens.add({
        targets: slot,
        x: target.x, y: target.y,
        duration: 140, ease: 'Sine.easeOut', overwrite: true,
      });
      if (badge) {
        this.tweens.add({
          targets: badge,
          x: target.x, y: target.y - this.cardH / 2 - BADGE_OFFSET,
          duration: 140, ease: 'Sine.easeOut', overwrite: true,
        });
      }
      visualCounter++;
    }
  }

  private showGhost(index: number): void {
    if (!this.ghostSlot) return;
    // Reorder keeps the deck count unchanged, so the ghost is placed within
    // the current N-card layout.
    const N = this.deckOrder.length;
    const idx = Math.min(index, N);
    const pos = this.getSlotPos(idx, N);
    const w = this.cardW + 4;
    const h = this.cardH + 4;
    this.ghostSlot.clear();
    this.ghostSlot.lineStyle(2, CHROME.ghost, 0.9);
    this.ghostSlot.strokeRoundedRect(pos.x - w / 2, pos.y - h / 2, w, h, 6);
    this.ghostSlot.setVisible(true);
  }

  // ── Drop ─────────────────────────────────────────────────────────────────

  private dropCard(): void {
    if (!this.dragCard) return;
    if (this.ghostSlot) this.ghostSlot.setVisible(false);

    this.dragCard.destroy(true);
    this.dragCard = null;

    if (this.dragFromDeck && this.dragDeckIndex >= 0) {
      const run = getRun();
      const [moved] = this.deckOrder.splice(this.dragDeckIndex, 1);
      const [movedFlag] = this.upgradedOrder.splice(this.dragDeckIndex, 1);
      let insertAt = Math.min(this.hoverIndex, this.deckOrder.length);
      if (this.hoverIndex > this.dragDeckIndex) insertAt = Math.max(0, insertAt - 1);
      this.deckOrder.splice(insertAt, 0, moved);
      this.upgradedOrder.splice(insertAt, 0, movedFlag);
      run.deck.active = [...this.deckOrder];
      run.deck.upgraded = [...this.upgradedOrder];

      this.resetDragState();
      this.rebuildGrid();
      this.setHint(this.getDefaultHint());
      return;
    }

    this.resetDragState();
    this.rebuildGrid();
  }

  // ── Hint ─────────────────────────────────────────────────────────────────

  private buildHint(): void {
    this.hintText = this.add.text(LAYOUT.centerX, HINT_Y, this.getDefaultHint(), {
      fontSize: '12px', color: '#a89878', fontFamily: FONTS.body,
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);
  }

  private getDefaultHint(): string {
    if (this.deckOrder.length >= MAX_DECK) return t('deckCustom.hintFull', { max: MAX_DECK });
    return t('deckCustom.hintDefault');
  }

  private setHint(msg: string): void {
    if (this.hintText) this.hintText.setText(msg);
  }

  // ── Close / cleanup ──────────────────────────────────────────────────────

  private close(): void {
    tutorialDirector.advanceIfMatches('deck-review');
    if (this.tutorialOrigin) {
      this.scene.stop(SCENE_KEYS.CHARACTER_SELECT);
      this.scene.stop();
      this.scene.start(SCENE_KEYS.GAME);
      return;
    }
    if (this.scene.isSleeping(this.parentScene)) {
      this.scene.wake(this.parentScene);
    } else {
      this.scene.resume(this.parentScene);
    }
    this.scene.stop();
  }

  private resetDragState(): void {
    this.dragFromDeck = false;
    this.dragDeckIndex = -1;
    this.hoverIndex = -1;
    this.dragOffset = { x: 0, y: 0 };
  }

  private cleanup(): void {
    if (this.dragCard) { this.dragCard.destroy(true); this.dragCard = null; }
    this.cancelHoverPreview();
    this.resetDragState();
    this.cardSlots = [];
    this.orderBadges = [];
    if (this.ghostSlot) { this.ghostSlot.destroy(); this.ghostSlot = null; }
  }
}
