// CardLibraryScene — browse-only card library rendered as an open tome.
// Launched as an overlay over a parent scene (Shop / Forge / etc.); pauses
// the parent on open and resumes it on close.
//
// Chrome is owned by BookLayout (procedural book with parchment pages, gold
// borders, ribbon, page-flip animation). This scene supplies:
//   • filter bar (mounted between the title and the book top)
//   • per-spread card placement (3x2 cards per page = 12 per spread)
//   • lock state for cards flagged as `locked` in their CardDefinition
//   • a pre-resolved upgrade-flag Set so CardFace doesn't re-walk the active
//     deck for every card on every repaint.

import Phaser from 'phaser';
import { SCENE_KEYS } from '../state/SceneKeys';
import { FONTS, LAYOUT } from '../ui/StyleConstants';
import { getAllCards, getCardById } from '../data/DataLoader';
import { STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';
import { createCardFace, disableCardFaceInput } from '../ui/CardFace';
import type { KeywordTooltipHandle } from '../ui/KeywordTooltip';
import { getRun } from '../state/RunState';
import {
  CardFilterBar,
  applyFilters,
  sortCards,
  type CardFilters,
  type CardSortMode,
} from '../ui/CardFilterBar';
import { addGlossaryButton } from '../ui/GlossaryButton';
import type { CardDefinition } from '../data/types';
import { BookLayout, type BookRenderContext, type BookPageBounds } from '../ui/BookLayout';
import { hasElementsForRecipe, type ElementInventory } from '../systems/ShardSystem';
import { ELEMENTS, elementCounts, resolveIconKey, type ElementId } from '../systems/ElementSystem';

const FF = FONTS.family;
const COLS = 3;
const ROWS = 3;
const PER_SPREAD = COLS * ROWS; // only left page; right page shows detail
const CARD_SCALE = 0.46;
const CARD_W = STANDARD_CARD_WIDTH * CARD_SCALE;
const CARD_H = STANDARD_CARD_HEIGHT * CARD_SCALE;

export interface CardLibrarySceneInitData {
  parentKey: string;
  /** Forge mode: clicking a card opens a detail view with a "send to anvil"
   *  button (craftable) or a have/need element breakdown (not craftable);
   *  uncraftable recipes render faded in the grid. Defaults to false. */
  forgeMode?: boolean;
}

export class CardLibraryScene extends Phaser.Scene {
  private parentKey: string = SCENE_KEYS.SHOP;
  private forgeMode = false;
  private craftableOnly = false;
  private elementInv: ElementInventory = {};
  private book: BookLayout | null = null;
  private filterBar: CardFilterBar | null = null;
  private allCards: CardDefinition[] = [];
  private filteredCards: CardDefinition[] = [];
  private currentFilters: CardFilters | null = null;
  private sortMode: CardSortMode = 'tier';
  private upgradedIds: Set<string> = new Set();
  private selectedCardId: string | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private wheelHandler: ((p: Phaser.Input.Pointer, go: unknown, dx: number, dy: number) => void) | null = null;
  private detailContainer: Phaser.GameObjects.Container | null = null;
  // Active keyword-glossary tooltip for the open detail view. Stored so its
  // pending timer is cancelled when the view closes or reopens (it self-mounts
  // after a short delay, so a stale handle could still fire otherwise).
  private detailTip: KeywordTooltipHandle | null = null;
  // Active ESC-to-close handler for the open detail view. Stored so it can be
  // unregistered when the view closes via a click (the once() listener would
  // otherwise linger until the next ESC press and accumulate across opens).
  private escHandler: (() => void) | null = null;

  constructor() {
    super(SCENE_KEYS.LIBRARY);
  }

  init(data: CardLibrarySceneInitData): void {
    this.parentKey = data?.parentKey ?? SCENE_KEYS.SHOP;
    this.forgeMode = data?.forgeMode ?? false;
    this.craftableOnly = false;
  }

  create(): void {
    // Render above the parent scene that launched us.
    this.scene.bringToTop();

    // Forge mode lists only forgeable recipes (cards with a 1–3 element recipe).
    this.allCards = this.forgeMode
      ? getAllCards().filter((c) => this.isForgeable(c))
      : getAllCards();
    this.elementInv = this.captureElementInv();
    this.filteredCards = sortCards(this.allCards, this.sortMode);
    this.buildUpgradedSet();

    this.book = new BookLayout(this, {
      onClose: () => this.closeLibrary(),
    });

    // Filter bar replaces the title/subtitle — sits at the very top with padding.
    this.filterBar = new CardFilterBar(
      this, 40, 12, 720,
      (f) => this.onFiltersChanged(f),
      (mode) => this.onSortChanged(mode),
    );

    // Forge mode: "Craftable only" checkbox, top-left above the filter bar.
    if (this.forgeMode) this.buildCraftableToggle();

    // "?" glossary button so players can look up stack/stat tokens while
    // browsing the library. Top-right, clear of the filter bar and book.
    addGlossaryButton(this, LAYOUT.canvasWidth - 30, 30, 6000);

    this.updateBookContent();
    this.installInputBindings();

    this.events.once('shutdown', () => this.teardown());
  }

  // ── Input ─────────────────────────────────────────────────

  private installInputBindings(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') this.book?.flipForward();
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') this.book?.flipBackward();
      else if (e.key === 'Escape') this.closeLibrary();
    };
    window.addEventListener('keydown', this.keydownHandler);

    this.wheelHandler = (_p, _go, _dx, dy) => {
      if (dy > 0) this.book?.flipForward();
      else if (dy < 0) this.book?.flipBackward();
    };
    this.input.on('wheel', this.wheelHandler);
  }

  // ── Lifecycle ─────────────────────────────────────────────

  private teardown(): void {
    if (this.escHandler) { this.input.keyboard?.off('keydown-ESC', this.escHandler); this.escHandler = null; }
    if (this.detailTip) { this.detailTip.cancel(); this.detailTip = null; }
    if (this.detailContainer) { this.detailContainer.destroy(true); this.detailContainer = null; }
    if (this.filterBar) {
      this.filterBar.destroy();
      this.filterBar = null;
    }
    this.book?.destroy();
    this.book = null;
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.wheelHandler) {
      this.input.off('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
  }

  private closeLibrary(): void {
    const parent = this.parentKey;
    this.scene.stop();
    // Resume only if the parent scene exists; calling resume on a non-paused
    // scene is a no-op but logs noisy warnings.
    if (parent && this.scene.get(parent)) {
      this.scene.resume(parent);
    }
  }

  // ── Filter / content ──────────────────────────────────────

  private onFiltersChanged(filters: CardFilters): void {
    this.currentFilters = filters;
    this.recomputeCards();
  }

  private onSortChanged(mode: CardSortMode): void {
    this.sortMode = mode;
    this.recomputeCards();
  }

  /** Re-apply the active filters then sort, and repaint the book. */
  private recomputeCards(): void {
    let filtered = this.currentFilters
      ? applyFilters(this.allCards, this.currentFilters)
      : this.allCards;
    if (this.forgeMode && this.craftableOnly) {
      filtered = filtered.filter((c) => this.canCraft(c));
    }
    this.filteredCards = sortCards(filtered, this.sortMode);
    this.updateBookContent();
  }

  private cardCountText(): string {
    const noun = this.forgeMode ? 'recipes' : 'cards';
    return `${this.filteredCards.length} / ${this.allCards.length} ${noun}`;
  }

  private updateBookContent(): void {
    if (!this.book) return;
    const totalSpreads = Math.max(1, Math.ceil(this.filteredCards.length / PER_SPREAD));
    this.book.setContent(totalSpreads, (ctx) => this.renderSpread(ctx));
    this.book.setSubtitle(this.cardCountText());
  }

  private renderSpread(ctx: BookRenderContext): void {
    if (this.filteredCards.length === 0) {
      const empty = this.add.text(
        ctx.leftBounds.centerX, ctx.leftBounds.centerY,
        'No cards match\nthe current filters.',
        { fontSize: '16px', color: '#6e4a1a', fontFamily: FF, align: 'center', fontStyle: 'italic' },
      ).setOrigin(0.5);
      ctx.leftPage.add(empty);
      return;
    }

    const start = ctx.spreadIndex * PER_SPREAD;
    const pageCards = this.filteredCards.slice(start, start + PER_SPREAD);

    // Auto-select first card on this spread if nothing selected yet.
    if (!this.selectedCardId && pageCards.length > 0) {
      this.selectedCardId = pageCards[0].id;
    }

    this.renderLeftGrid(pageCards, ctx);
    if (this.selectedCardId) {
      this.renderCardDetail(this.selectedCardId, ctx.rightPage, ctx.rightBounds);
    }
  }

  private renderLeftGrid(
    cards: CardDefinition[],
    ctx: BookRenderContext,
  ): void {
    const container = ctx.leftPage;
    const bounds = ctx.leftBounds;
    // Same layout as CollectionScene renderCardsGrid: fixed 10px gaps, +15/+5 offsets
    const gapX = 10;
    const gapY = 10;
    const totalW = COLS * CARD_W + (COLS - 1) * gapX;
    const totalH = ROWS * CARD_H + (ROWS - 1) * gapY;
    const startX = bounds.centerX - totalW / 2 + CARD_W / 2 + 15;
    const startY = bounds.centerY - totalH / 2 + CARD_H / 2 + 5;

    cards.forEach((card, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = startX + col * (CARD_W + gapX);
      const y = startY + row * (CARD_H + gapY);

      const isSel = this.selectedCardId === card.id;
      const visual = createCardFace(this, x, y, card.id, {
        baseSize: 'small',
        scale: CARD_SCALE,
        hover: false,
        upgraded: this.upgradedIds.has(card.id),
      });
      if (this.forgeMode && !this.canCraft(card)) visual.setAlpha(0.4);
      container.add(visual);

      if (isSel) {
        const selBorder = this.add.rectangle(x, y, CARD_W + 4, CARD_H + 4, 0xc89a3c, 0)
          .setStrokeStyle(2.5, 0xf0c060, 1);
        ctx.leftPage.add(selBorder);
        selBorder.setDepth(-1);
      }

      if (card.locked === true) {
        visual.setAlpha(0.4);
        disableCardFaceInput(visual);
      } else {
        visual.setInteractive({ useHandCursor: true });
        visual.on('pointerdown', () => this.selectCard(card.id));
      }
    });
  }

  private selectCard(cardId: string): void {
    if (this.selectedCardId === cardId) return;
    this.selectedCardId = cardId;
    this.book?.setSpreadIndex(this.book.getSpreadIndex());
  }

  private renderCardDetail(
    cardId: string,
    container: Phaser.GameObjects.Container,
    bounds: BookPageBounds,
  ): void {
    const cardX = bounds.centerX - 30;
    const cardY = -3.3;
    const face = createCardFace(this, cardX, cardY, cardId, {
      baseSize: { w: 214, h: 339 },
      hover: false,
      upgraded: this.upgradedIds.has(cardId),
    });
    disableCardFaceInput(face);
    container.add(face);

    const card = getCardById(cardId);
    if (card && this.forgeMode) {
      const craftable = this.canCraft(card);
      const BTN_Y = 215;
      if (craftable) {
        this.addSendToAnvilButton(container, cardX, BTN_Y, card);
      } else {
        container.add(this.makeElementNeedOverlay(card, cardX, BTN_Y));
      }
    }
  }

  // ── Forge mode ────────────────────────────────────────────

  /** True when a card has a valid 1–3 element recipe and isn't locked. */
  private isForgeable(card: CardDefinition): boolean {
    const n = card.elements?.length ?? 0;
    return n >= 1 && n <= 3 && card.locked !== true;
  }

  /** True when the run currently holds enough elements to forge the recipe. */
  private canCraft(card: CardDefinition): boolean {
    return this.isForgeable(card)
      && hasElementsForRecipe(this.elementInv, card.elements as ElementId[]);
  }

  private captureElementInv(): ElementInventory {
    try {
      return (getRun().economy.elements ?? {}) as ElementInventory;
    } catch {
      return {};
    }
  }


  /** Build the "Send to Anvil" action button using the same btn_forge_action asset as ForgeScene. */
  private addSendToAnvilButton(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    card: CardDefinition,
  ): void {
    const img = this.add.image(x, y, 'btn_forge_action').setScale(0.038)
      .setInteractive({ useHandCursor: true });
    img.on('pointerover', () => img.setTint(0xffffcc));
    img.on('pointerout',  () => img.clearTint());
    img.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      ptr.event.stopPropagation();
      this.forgeCardToAnvil(card);
    });
    parent.add(img);
  }

  /** Load the card's recipe onto the forge anvil and return to the forge. */
  private forgeCardToAnvil(card: CardDefinition): void {
    const elements = (card.elements ?? []) as ElementId[];
    if (elements.length < 1) return;
    const forge = this.scene.get(SCENE_KEYS.FORGE) as unknown as
      { loadRecipeFromLibrary?: (e: ElementId[]) => void } | undefined;
    forge?.loadRecipeFromLibrary?.(elements);
    this.closeLibrary();
  }

  /** Element have/need badge (used in the uncraftable detail view). */
  private makeElementNeedOverlay(
    card: CardDefinition,
    cx: number,
    cy: number,
  ): Phaser.GameObjects.Container {
    const counts = elementCounts((card.elements ?? []) as ElementId[]);
    const needed = (Object.keys(counts) as ElementId[]).filter((e) => counts[e] > 0);
    const c = this.add.container(cx, cy);

    const ICON = 20;
    const GAP = 8;
    const PAD = 7;
    const rowW = needed.length * ICON + Math.max(0, needed.length - 1) * GAP;
    const panelW = rowW + PAD * 2;
    const panelH = ICON + 16 + PAD * 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x080808, 0.82);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 5);
    bg.lineStyle(1.5, 0x9a6030, 0.95);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 5);
    c.add(bg);

    let ix = -rowW / 2 + ICON / 2;
    const iconY = -panelH / 2 + PAD + ICON / 2;
    const textY = iconY + ICON / 2 + 8;
    for (const e of needed) {
      const need = counts[e];
      const have = this.elementInv[e] ?? 0;
      const ok = have >= need;
      const spriteKey = resolveIconKey(this.textures, e)
        ?? (this.textures.exists(`elem_${e}`) ? `elem_${e}` : null);
      if (spriteKey) {
        const img = this.add.image(ix, iconY, spriteKey).setDisplaySize(ICON, ICON);
        if (!ok) img.setAlpha(0.55);
        c.add(img);
      } else {
        const color = Number.parseInt(ELEMENTS[e].color.replace('#', ''), 16);
        c.add(this.add.circle(ix, iconY, ICON / 2, color).setStrokeStyle(1, 0xc8922a));
      }
      c.add(this.add.text(ix, textY, `${have}/${need}`, {
        fontSize: '11px', fontStyle: 'bold', fontFamily: FF,
        color: ok ? '#88dd88' : '#ff6655', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5));
      ix += ICON + GAP;
    }
    return c;
  }

  /** "Craftable only" checkbox shown in forge mode. */
  private buildCraftableToggle(): void {
    const x = 44;
    const y = 56;
    const sz = 16;
    const box = this.add.rectangle(x, y, sz, sz, 0x2a1408, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(1.5, 0x7a4820)
      .setInteractive({ useHandCursor: true })
      .setDepth(50);
    const check = this.add.text(x + sz / 2, y + sz / 2, '✓', {
      fontSize: '13px', fontStyle: 'bold', color: '#ffd700', fontFamily: FF,
    }).setOrigin(0.5).setDepth(51).setVisible(this.craftableOnly);
    const label = this.add.text(x + sz + 8, y + sz / 2, 'Craftable only', {
      fontSize: '12px', fontStyle: 'bold', color: '#ffffff', fontFamily: FF,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(51).setInteractive({ useHandCursor: true });

    const toggle = () => {
      this.craftableOnly = !this.craftableOnly;
      check.setVisible(this.craftableOnly);
      this.recomputeCards();
    };
    box.on('pointerdown', toggle);
    label.on('pointerdown', toggle);
  }

  /** Pre-resolve which card ids are currently upgraded in the active run.
   *  Passed to CardVisual to skip CardFace's per-card O(deckSize) scan. */
  private buildUpgradedSet(): void {
    this.upgradedIds.clear();
    try {
      const run = getRun();
      run.deck.active.forEach((id, i) => {
        if (run.deck.upgraded[i]) this.upgradedIds.add(id);
      });
    } catch {
      /* outside a run — no upgrades to flag */
    }
  }
}
