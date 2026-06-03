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
import { hasElementsForRecipe, type ElementInventory } from '../systems/ShardSystem';
import { ELEMENTS, elementCounts, resolveIconKey, type ElementId } from '../systems/ElementSystem';

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
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private wheelHandler: ((p: Phaser.Input.Pointer, go: unknown, dx: number, dy: number) => void) | null = null;
  private detailContainer: Phaser.GameObjects.Container | null = null;
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
      title: this.forgeMode ? 'Forge Recipes' : 'Card Library',
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

  private showCardDetail(cardId: string): void {
    if (this.detailContainer) this.detailContainer.destroy(true);
    this.detailContainer = this.add.container(0, 0).setDepth(200);
    const dim = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.80).setInteractive();
    const card = createCardVisual(this, 400, 285, cardId, { scale: 1.2 });
    const close = () => { this.detailContainer?.destroy(true); this.detailContainer = null; };
    dim.on('pointerdown', close);
    this.registerDetailEsc(close);
    this.detailContainer.add([dim, card]);
  }

  /** Register an ESC-to-close handler for a detail view, replacing any prior
   *  one so pending once() listeners can't accumulate across opens. */
  private registerDetailEsc(close: () => void): void {
    if (this.escHandler) this.input.keyboard?.off('keydown-ESC', this.escHandler);
    this.escHandler = close;
    this.input.keyboard?.once('keydown-ESC', close);
  }

  private teardown(): void {
    if (this.escHandler) { this.input.keyboard?.off('keydown-ESC', this.escHandler); this.escHandler = null; }
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

      if (this.forgeMode) {
        this.renderForgeCard(card, x, y, container);
        return;
      }

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
      } else {
        visual.setInteractive({ useHandCursor: true });
        visual.on('pointerdown', () => this.showCardDetail(card.id));
      }
    });
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

  /** Render one card in forge mode: uncraftable recipes render faded. Clicking
   *  any card opens the forge-aware detail view (where the "send to anvil"
   *  button — or the have/need breakdown — lives). */
  private renderForgeCard(
    card: CardDefinition,
    x: number,
    y: number,
    container: Phaser.GameObjects.Container,
  ): void {
    const visual = createCardVisual(this, x, y, card.id, {
      scale: CARD_SCALE,
      upgraded: this.upgradedIds.has(card.id),
    });
    container.add(visual);
    // Replace the default popup with our forge-aware detail view.
    disableCardFaceInput(visual);
    visual.setInteractive({ useHandCursor: true });
    visual.on('pointerdown', () => this.showForgeCardDetail(card));
    if (!this.canCraft(card)) visual.setAlpha(0.4);
  }

  /** Expanded ("clicked") card view for forge mode. Shows the big card plus a
   *  "Send to Anvil" button when craftable, or the elements the hero has
   *  (have/need) with a hint when not. */
  private showForgeCardDetail(card: CardDefinition): void {
    if (this.detailContainer) this.detailContainer.destroy(true);
    this.detailContainer = this.add.container(0, 0).setDepth(200);
    const close = () => { this.detailContainer?.destroy(true); this.detailContainer = null; };

    const dim = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.82).setInteractive();
    dim.on('pointerdown', close);
    this.registerDetailEsc(close);
    this.detailContainer.add(dim);

    const craftable = this.canCraft(card);
    const cardVisual = createCardVisual(this, 400, 248, card.id, { scale: 1.2 });
    disableCardFaceInput(cardVisual);
    if (!craftable) cardVisual.setAlpha(0.55);
    this.detailContainer.add(cardVisual);

    const bottom = cardVisual.getBounds().bottom;
    const belowY = Math.min(514, bottom + 36);

    if (craftable) {
      this.addSendToAnvilButton(this.detailContainer, 400, belowY, card);
    } else {
      this.detailContainer.add(this.makeElementNeedOverlay(card, 400, belowY));
      this.detailContainer.add(this.add.text(400, belowY + 44, 'Not enough shards to forge', {
        fontSize: '13px', fontStyle: 'bold', fontFamily: FF, color: '#ff8866',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5));
    }
  }

  /** Build the "Send to Anvil" action button into the detail view. */
  private addSendToAnvilButton(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    card: CardDefinition,
  ): void {
    const w = 214;
    const h = 46;
    const bg = this.add.graphics();
    const paint = (fill: number, line: number) => {
      bg.clear();
      bg.fillStyle(fill, 1); bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      bg.lineStyle(2, line, 1); bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    };
    paint(0x3a2218, 0xf5d273);
    const label = this.add.text(x, y, '⚒  Send to Anvil', {
      fontSize: '18px', fontStyle: 'bold', fontFamily: FF, color: '#ffe9a0',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    const hit = this.add.rectangle(x, y, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    parent.add([bg, label, hit]);

    hit.on('pointerover', () => { paint(0x4a2c18, 0xffe9a0); label.setColor('#ffffff'); });
    hit.on('pointerout',  () => { paint(0x3a2218, 0xf5d273); label.setColor('#ffe9a0'); });
    // pointerdown + stopPropagation (not pointerup) so the action fires before
    // the full-screen dim's own pointerdown-to-close can intercept it.
    hit.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev?: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      this.forgeCardToAnvil(card);
    });
  }

  /** Queue the card's recipe on the forge anvil and return to the forge. */
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
