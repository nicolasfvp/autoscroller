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
import { getAllCards } from '../data/DataLoader';
import { createCardVisual, STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';
import { disableCardFaceInput } from '../ui/CardFace';
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

const FF = FONTS.family;
const COLS = 3;
const ROWS = 2;
const PER_PAGE = COLS * ROWS;
const PER_SPREAD = PER_PAGE * 2;
const CARD_SCALE = 0.5;
const CARD_W = STANDARD_CARD_WIDTH * CARD_SCALE;
const CARD_H = STANDARD_CARD_HEIGHT * CARD_SCALE;

export interface CardLibrarySceneInitData {
  parentKey: string;
}

export class CardLibraryScene extends Phaser.Scene {
  private parentKey: string = SCENE_KEYS.SHOP;
  private book: BookLayout | null = null;
  private filterBar: CardFilterBar | null = null;
  private allCards: CardDefinition[] = [];
  private filteredCards: CardDefinition[] = [];
  private currentFilters: CardFilters | null = null;
  private sortMode: CardSortMode = 'tier';
  private upgradedIds: Set<string> = new Set();
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private wheelHandler: ((p: Phaser.Input.Pointer, go: unknown, dx: number, dy: number) => void) | null = null;

  constructor() {
    super(SCENE_KEYS.LIBRARY);
  }

  init(data: CardLibrarySceneInitData): void {
    this.parentKey = data?.parentKey ?? SCENE_KEYS.SHOP;
  }

  create(): void {
    // Render above the parent scene that launched us.
    this.scene.bringToTop();

    this.allCards = getAllCards();
    this.filteredCards = sortCards(this.allCards, this.sortMode);
    this.buildUpgradedSet();

    this.book = new BookLayout(this, {
      title: 'Card Library',
      subtitle: this.cardCountText(),
      onClose: () => this.closeLibrary(),
    });

    // Filter bar sits in the empty gap above the book's chrome (no tabs in
    // the Library overlay, so this region is free). 720 wide × 44 tall.
    this.filterBar = new CardFilterBar(
      this, 40, 78, 720,
      (f) => this.onFiltersChanged(f),
      (mode) => this.onSortChanged(mode),
    );

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
    const filtered = this.currentFilters
      ? applyFilters(this.allCards, this.currentFilters)
      : this.allCards;
    this.filteredCards = sortCards(filtered, this.sortMode);
    this.updateBookContent();
  }

  private cardCountText(): string {
    return `${this.filteredCards.length} / ${this.allCards.length} cards`;
  }

  private updateBookContent(): void {
    if (!this.book) return;
    const totalSpreads = Math.max(1, Math.ceil(this.filteredCards.length / PER_SPREAD));
    this.book.setContent(totalSpreads, (ctx) => this.renderSpread(ctx));
    this.book.setSubtitle(this.cardCountText());
  }

  private renderSpread(ctx: BookRenderContext): void {
    if (this.filteredCards.length === 0) {
      // Place a "no results" message centered on the left page (container-local
      // coords — page containers are positioned at the spine).
      const empty = this.add.text(
        ctx.leftBounds.centerX, ctx.leftBounds.centerY,
        'No cards match\nthe current filters.',
        {
          fontSize: '16px', color: '#6e4a1a', fontFamily: FF,
          align: 'center', fontStyle: 'italic',
        },
      ).setOrigin(0.5);
      ctx.leftPage.add(empty);
      return;
    }

    const start = ctx.spreadIndex * PER_SPREAD;
    const leftCards = this.filteredCards.slice(start, start + PER_PAGE);
    const rightCards = this.filteredCards.slice(start + PER_PAGE, start + PER_SPREAD);
    this.renderPage(leftCards, ctx.leftPage, ctx.leftBounds);
    this.renderPage(rightCards, ctx.rightPage, ctx.rightBounds);
  }

  private renderPage(
    cards: CardDefinition[],
    container: Phaser.GameObjects.Container,
    bounds: BookPageBounds,
  ): void {
    if (cards.length === 0) return;
    const fitGapX = COLS > 1 ? (bounds.innerW - COLS * CARD_W) / (COLS - 1) : 0;
    const fitGapY = ROWS > 1 ? (bounds.innerH - ROWS * CARD_H) / (ROWS - 1) : 0;
    const gapX = Math.max(8, Math.min(fitGapX, CARD_W * 0.45));
    const gapY = Math.max(12, Math.min(fitGapY, CARD_H * 0.45));
    const effW = COLS * CARD_W + (COLS - 1) * gapX;
    const effH = ROWS * CARD_H + (ROWS - 1) * gapY;
    const startX = bounds.centerX - effW / 2 + CARD_W / 2;
    const startY = bounds.centerY - effH / 2 + CARD_H / 2;

    cards.forEach((card, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = startX + col * (CARD_W + gapX);
      const y = startY + row * (CARD_H + gapY);

      const visual = createCardVisual(this, x, y, card.id, {
        scale: CARD_SCALE,
        upgraded: this.upgradedIds.has(card.id),
      });
      container.add(visual);

      if (card.locked === true) {
        visual.setAlpha(0.4);
        disableCardFaceInput(visual);
        const lock = this.add.text(x, y, '🔒', {
          fontSize: '22px', fontFamily: FF, color: '#ffffff',
        }).setOrigin(0.5);
        container.add(lock);
      }
    });
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
