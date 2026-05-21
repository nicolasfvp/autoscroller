// Deck builder overlay -- pre-run starter deck selection with element ratio + presets.
// 4xN scrollable grid of available cards centered in the left zone, hover tooltip
// with effects/elements, click-to-add (from grid) / click-to-remove (from deck slots),
// preset save/load. See docs/CARDS_SYSTEM.md §6.

import { Scene } from 'phaser';
import { SCENE_KEYS } from '../state/SceneKeys';
import { COLORS, FONTS, createButton } from '../ui/StyleConstants';
import { getAllCards } from '../data/DataLoader';
import {
  validateStarterDeck,
  type DeckPreset,
} from '../systems/DeckBuilder';
import {
  STARTER_DECK_SIZE,
  CLASS_DECK_RATIO,
  PRESETS_PER_CLASS,
  ELEMENTS,
  type ElementId,
} from '../systems/ElementSystem';
import { saveMetaState } from '../systems/MetaPersistence';
import type { MetaState } from '../state/MetaState';
import type { CardDefinition } from '../data/types';
import { CardFilterBar } from '../ui/CardFilterBar';
import { applyFilters, type CardFilters } from '../ui/CardFilterBar.pure';
import { createCardVisual, STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';
import { scheduleKeywordPanel, type KeywordTooltipHandle } from '../ui/KeywordTooltip';
import { addGlossaryButton } from '../ui/GlossaryButton';
import { cardSynergizesWithDeck } from '../systems/cards/SynergyDetection';
import { keywordIntro } from '../systems/keywordIntro/KeywordIntroService';
import { countElementCategories } from '../systems/ElementSystem';
import { LAYOUT } from '../ui/StyleConstants';

const FF = FONTS.family;
const WHITE = '#ffffff';
const GOLD = COLORS.accent;
const DIM = COLORS.textSecondary;

// Grid geometry — 6×N scrollable grid of CardVisuals at scale 0.55. The slot
// panel is a narrow column at the right edge (~80 px), so the grid claims the
// rest of the canvas width.
const CARD_SCALE = 0.55;
const CARD_W = STANDARD_CARD_WIDTH * CARD_SCALE;   // 82.5
const CARD_H = STANDARD_CARD_HEIGHT * CARD_SCALE;  // 132
const GRID_COLS = 6;
const GRID_GAP = 8;
const GRID_VIEWPORT_W = GRID_COLS * CARD_W + (GRID_COLS - 1) * GRID_GAP; // 535
const GRID_X = 20;
const GRID_Y = 145;
const GRID_VIEWPORT_H = 380;

// CardFilterBar row — element dropdown / tier checkboxes / search. Spans the
// same width as the grid so it reads as one column of controls.
const CARD_FILTER_BAR_Y = 108;
const FILTER_BAR_W = GRID_VIEWPORT_W;
const FILTER_BAR_X = GRID_X;

// Deck slot column — narrow strip of full CardVisuals on the right edge. The
// slot footprint matches the rendered card; no extra horizontal padding.
const SLOT_CARD_SCALE = 0.4;
const SLOT_CARD_W = STANDARD_CARD_WIDTH * SLOT_CARD_SCALE;   // 60
const SLOT_CARD_H = STANDARD_CARD_HEIGHT * SLOT_CARD_SCALE;  // 96
const SLOT_PANEL_W = SLOT_CARD_W + 12;                       // 72
const SLOT_PANEL_X = 743;                                    // panel center x
const SLOT_Y = 80;                                           // top of first slot
const SLOT_GAP = 4;

// Hover preview — pops up next to the small grid card on hover. Position is
// computed dynamically per-hover so the preview sits beside the actual source
// card rather than at a fixed scene location.
const PREVIEW_SCALE = 0.9;
const PREVIEW_DEPTH = 200;
const PREVIEW_GAP = 14;
// Reserve width for the keyword glossary panel (~220 px + 12 gap) so the
// dynamic right/left decision keeps the keyword tooltip on-canvas too.
const PREVIEW_TOOLTIP_BUDGET = 240;

interface CardCell {
  card: CardDefinition;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  /** True when this card shares ≥1 keyword with ≥2 cards in currentDeck. */
  synergy: boolean;
}

export class DeckBuilderScene extends Scene {
  private className: string = 'warrior';
  private currentDeck: string[] = [];
  private selectedPresetIndex: number = 0;
  private onConfirm: ((deck: string[]) => void) | null = null;
  private onCancel: (() => void) | null = null;
  private metaState: MetaState | null = null;

  private gridContainer!: Phaser.GameObjects.Container;
  private gridMask!: Phaser.Display.Masks.GeometryMask;
  private gridScrollY: number = 0;
  private gridMaxScroll: number = 0;
  private gridHeaderText!: Phaser.GameObjects.Text;
  private gridScrollHint?: Phaser.GameObjects.Text;
  private cardFilterBar: CardFilterBar | null = null;
  private cardFilters: CardFilters = {
    element: 'All',
    tiers: new Set<0 | 1 | 2 | 3>([0, 1, 2, 3]),
    search: '',
  };

  private deckSlotContainers: Phaser.GameObjects.Container[] = [];
  private presetButtons: Phaser.GameObjects.Container[] = [];
  private validationText!: Phaser.GameObjects.Text;
  private elementBudgetText!: Phaser.GameObjects.Text;
  private startBtn!: Phaser.GameObjects.Text;

  // Hover preview — a full-scale CardVisual that pops in when the player hovers
  // a card cell in the grid. Replaces the old text-based info tooltip; the
  // keyword glossary panel anchors against this preview so it always reads to
  // the side of the actual card rather than overlapping the grid cell.
  private hoverPreview: Phaser.GameObjects.Container | null = null;
  private hoverPreviewTooltip: KeywordTooltipHandle | null = null;
  private hoverPreviewCardId: string | null = null;

  private cardCells: CardCell[] = [];

  constructor() {
    super(SCENE_KEYS.DECK_BUILDER);
  }

  create(data: {
    className: string;
    presets?: DeckPreset[];
    metaState?: MetaState;
    onConfirm?: (deck: string[]) => void;
    onCancel?: () => void;
  }): void {
    this.className = data.className ?? 'warrior';
    this.onConfirm = data.onConfirm ?? null;
    this.onCancel = data.onCancel ?? null;
    this.metaState = data.metaState ?? null;
    this.gridScrollY = 0;

    // Phaser reuses the scene instance across remounts. Class-field arrays
    // keep references to game objects destroyed at shutdown, so reset them
    // before re-rendering or `updatePresetTab` will crash on a stale container.
    this.presetButtons = [];
    this.deckSlotContainers = [];
    this.cardCells = [];
    this.cardFilters = {
      element: 'All',
      tiers: new Set<0 | 1 | 2 | 3>([0, 1, 2, 3]),
      search: '',
    };
    // Old bar reference from a previous mount must be cleared — the actual
    // GameObject was destroyed by Phaser when the scene shut down, but we
    // recreate it below and don't want a stale handle.
    this.cardFilterBar = null;

    const presets = this.getPresets();
    this.selectedPresetIndex = 0;
    this.currentDeck = presets[0]?.cardIds ? [...presets[0].cardIds] : [];

    this.scene.bringToTop();

    // Backdrop — absorbs all clicks behind the overlay
    const backdrop = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.92);
    this.time.delayedCall(50, () => {
      backdrop.setInteractive();
      backdrop.on('pointerdown', () => { /* eat clicks */ });
    });

    // Title
    this.add.text(400, 22, `Build Your Deck — ${this.className === 'mage' ? 'Mage' : 'Warrior'}`, {
      fontSize: '22px', fontStyle: 'bold', color: GOLD, fontFamily: FF,
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    // Cancel (top-right) — resumes parent
    const cancelBtn = this.add.text(770, 22, '✕ Cancel', {
      fontSize: '14px', fontStyle: 'bold', color: '#ff9999', fontFamily: FF,
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerover', () => cancelBtn.setColor(WHITE));
    cancelBtn.on('pointerout', () => cancelBtn.setColor('#ff9999'));
    cancelBtn.on('pointerdown', () => this.cancel());

    // Keyword glossary "?" button — left of Cancel so it stays accessible
    // while the deck builder is open. Hydrate the seen-keyword cache so the
    // panel filters correctly the first time the player opens it from here.
    void keywordIntro.init();
    addGlossaryButton(this, 665, 22);

    // Hint
    const ratio = CLASS_DECK_RATIO[this.className];
    this.add.text(400, 50, `Pick ${STARTER_DECK_SIZE} starter cards (Tier 0-1) · 10 elements total · ${this.className} ratio P[${ratio.physicalMin}-${ratio.physicalMax}] / E[${ratio.elementalMin}-${ratio.elementalMax}]`, {
      fontSize: '11px', color: DIM, fontFamily: FF,
    }).setOrigin(0.5);

    this.renderPresetTabs();
    this.renderCardFilterBar();
    this.renderCardGrid();
    this.renderDeckPanel();
    this.renderValidationAndActions();
    this.bindScroll();
    this.refresh();

    // CardFilterBar appends a native <input> to document.body. Destroy it
    // when the scene shuts down so a relaunch doesn't stack ghost inputs
    // across the page. The bar already wires its own shutdown listener,
    // but we own the field reference, so clear it here too.
    this.events.once('shutdown', () => {
      if (this.cardFilterBar) {
        this.cardFilterBar.destroy();
        this.cardFilterBar = null;
      }
      // Tear down any in-flight hover preview so a re-entry doesn't leak the
      // overlay or its pending keyword-tooltip timer onto a destroyed scene.
      this.hideHoverPreview();
    });
  }

  // ────────────────────────────────────────────────
  // Reusable CardFilterBar (element + tier + search)
  // ────────────────────────────────────────────────

  private renderCardFilterBar(): void {
    this.cardFilterBar = new CardFilterBar(this, FILTER_BAR_X, CARD_FILTER_BAR_Y, FILTER_BAR_W, (filters) => {
      this.cardFilters = filters;
      this.rebuildGrid();
    });
  }

  // ────────────────────────────────────────────────
  // Preset tabs (top row, 5 horizontal buttons)
  // ────────────────────────────────────────────────

  private getPresets(): DeckPreset[] {
    return (this.metaState as any)?.deckPresets?.[this.className] ?? [];
  }

  private renderPresetTabs(): void {
    const startX = 30;
    const y = 82;
    const tabW = 90;
    const tabH = 24;
    const gap = 6;

    this.add.text(startX, y - 18, 'Presets:', {
      fontSize: '11px', fontStyle: 'bold', color: DIM, fontFamily: FF,
    });

    for (let i = 0; i < PRESETS_PER_CLASS; i++) {
      const x = startX + i * (tabW + gap);
      const container = this.add.container(x + tabW / 2, y);
      const bg = this.add.rectangle(0, 0, tabW, tabH, 0x2a2a40, 0.85).setStrokeStyle(1, 0x4a4a60);
      const label = this.add.text(0, 0, '', {
        fontSize: '11px', color: DIM, fontFamily: FF,
      }).setOrigin(0.5);
      container.add([bg, label]);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.loadPreset(i));
      bg.on('pointerover', () => bg.setStrokeStyle(2, 0xffffff, 1));
      bg.on('pointerout',  () => this.updatePresetTab(i));
      this.presetButtons.push(container);
    }
  }

  private updatePresetTab(i: number): void {
    const container = this.presetButtons[i];
    if (!container) return;
    const bg = container.list[0] as Phaser.GameObjects.Rectangle;
    const label = container.list[1] as Phaser.GameObjects.Text;
    const presets = this.getPresets();
    const p = presets[i];
    const hasCards = (p?.cardIds?.length ?? 0) > 0;
    const isSelected = i === this.selectedPresetIndex;
    bg.setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xffd700 : 0x4a4a60);
    bg.setFillStyle(isSelected ? 0x3a3a55 : 0x2a2a40, 0.85);
    label.setText(p?.name ?? `Empty ${i + 1}`);
    label.setColor(hasCards ? (isSelected ? GOLD : WHITE) : DIM);
  }

  private loadPreset(i: number): void {
    const presets = this.getPresets();
    const p = presets[i];
    this.selectedPresetIndex = i;
    this.currentDeck = p?.cardIds ? [...p.cardIds] : [];
    this.refresh();
  }

  // ────────────────────────────────────────────────
  // 3xN scrollable card grid (left side)
  // ────────────────────────────────────────────────

  private renderCardGrid(): void {
    // Background panel for the grid viewport
    this.add.rectangle(
      GRID_X + GRID_VIEWPORT_W / 2,
      GRID_Y + GRID_VIEWPORT_H / 2,
      GRID_VIEWPORT_W + 16, GRID_VIEWPORT_H + 16,
      0x141420, 0.85,
    ).setStrokeStyle(1, 0x4a4a60);

    this.gridHeaderText = this.add.text(GRID_X, GRID_Y - 18, 'Available Starter Cards', {
      fontSize: '13px', fontStyle: 'bold', color: WHITE, fontFamily: FF,
    });

    this.gridContainer = this.add.container(0, 0);
    // Mask so cells outside the viewport don't show
    const shape = this.make.graphics({ x: 0, y: 0 });
    shape.fillStyle(0xffffff);
    shape.fillRect(GRID_X, GRID_Y, GRID_VIEWPORT_W, GRID_VIEWPORT_H);
    this.gridMask = shape.createGeometryMask();
    this.gridContainer.setMask(this.gridMask);

    this.rebuildGrid();
  }

  private getFilteredCards(): CardDefinition[] {
    // Starter pool is Tier 0 (single-element teaching cards) + Tier 1. Element
    // dropdown + name search still apply via the filter bar.
    const starterPool = getAllCards().filter((c) => c.tier === 0 || c.tier === 1);
    return applyFilters(starterPool, this.cardFilters);
  }

  private rebuildGrid(): void {
    // Tear down current cells
    this.cardCells.forEach((cell) => cell.container.destroy(true));
    this.cardCells = [];
    this.gridScrollY = 0;
    this.gridContainer.setY(0);

    const filtered = this.getFilteredCards();
    this.gridHeaderText.setText(`Available Starter Cards (${filtered.length})`);

    filtered.forEach((card, idx) => {
      const col = idx % GRID_COLS;
      const row = Math.floor(idx / GRID_COLS);
      const x = GRID_X + col * (CARD_W + GRID_GAP);
      const y = GRID_Y + row * (CARD_H + GRID_GAP);
      const cell = this.createCardCell(card, x, y);
      this.gridContainer.add(cell.container);
      this.cardCells.push(cell);
    });

    const totalRows = Math.ceil(filtered.length / GRID_COLS);
    const totalH = totalRows * CARD_H + (totalRows - 1) * GRID_GAP;
    this.gridMaxScroll = Math.max(0, totalH - GRID_VIEWPORT_H);

    if (!this.gridScrollHint) {
      this.gridScrollHint = this.add.text(GRID_X + GRID_VIEWPORT_W / 2, GRID_Y + GRID_VIEWPORT_H + 8, '↕ Mouse wheel to scroll', {
        fontSize: '10px', color: DIM, fontFamily: FF,
      }).setOrigin(0.5);
    }
    this.gridScrollHint.setVisible(this.gridMaxScroll > 0);

    this.updateCellInteractivity();
  }

  /**
   * Phaser hit areas don't honor masks — a scrolled-off cell's bg still
   * intercepts pointer events at its world position. Walk every cell and
   * toggle setInteractive based on whether the cell is inside the viewport.
   */
  private updateCellInteractivity(): void {
    const viewTop = GRID_Y;
    const viewBottom = GRID_Y + GRID_VIEWPORT_H;
    for (const cell of this.cardCells) {
      const worldY = cell.container.y + this.gridContainer.y;
      const cellTop = worldY;
      const cellBottom = worldY + CARD_H;
      const inView = cellBottom > viewTop && cellTop < viewBottom;
      if (inView) {
        if (!cell.bg.input?.enabled) cell.bg.setInteractive({ useHandCursor: true });
      } else {
        cell.bg.disableInteractive();
      }
    }
  }

  private createCardCell(card: CardDefinition, x: number, y: number): CardCell {
    // Container parent so grid math (positions, scrolling) stays unchanged.
    // The CardVisual is anchored at the cell center; an invisible hit-box
    // rectangle (`bg`) holds the cell's interactivity so the existing
    // updateCellInteractivity() viewport-toggle logic still works.
    const container = this.add.container(x, y);

    // Centered CardVisual — fills the cell. We strip its built-in pointer
    // handlers so the deck-builder's own click-to-pick behavior runs instead
    // of opening the card detail popup.
    const visual = createCardVisual(this, CARD_W / 2, CARD_H / 2, card.id, { scale: CARD_SCALE });
    visual.removeAllListeners('pointerdown');
    visual.removeAllListeners('pointerover');
    visual.removeAllListeners('pointerout');
    visual.disableInteractive();
    container.add(visual);

    // Invisible hit-box on top — drives cell-level pointer events. Kept as a
    // Rectangle (not the visual) so updateCellInteractivity()'s disable/enable
    // toggling stays simple.
    const bg = this.add.rectangle(CARD_W / 2, CARD_H / 2, CARD_W, CARD_H, 0x000000, 0)
      .setStrokeStyle(1.5, 0xffffff, 0);
    container.add(bg);

    // Build the CardCell record up-front so hover handlers can read its
    // `synergy` flag (mutated later by refreshCellSynergy) without rewiring.
    const cell: CardCell = { card, container, bg, synergy: false };

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      if (cell.synergy) bg.setStrokeStyle(3, 0xffd700, 1);
      else bg.setStrokeStyle(2, 0xffffff, 1);
      // Resolve the bg's actual scene-space center (accounts for the
      // gridContainer's scroll offset) so the preview pops up next to the
      // physically-rendered grid card, not its untranslated cell coordinate.
      const m = bg.getWorldTransformMatrix();
      this.showHoverPreview(card, m.tx, m.ty);
    });
    bg.on('pointerout', () => {
      if (cell.synergy) bg.setStrokeStyle(2, 0xffd700, 0.85);
      else bg.setStrokeStyle(1.5, 0xffffff, 0);
      this.hideHoverPreview();
    });

    // Keyword glossary tooltip is owned by the hover preview overlay instead
    // of the small grid cell — keeps the panel anchored to the enlarged card
    // and prevents it from clipping past the tiny grid footprint.

    bg.on('pointerdown', () => {
      // Element-budget validation: don't allow picking a card that overflows
      // the 10-element starter budget. Dim/disable behavior is applied via
      // alpha in refreshCellAffordability() — the click guard here is a
      // belt-and-braces backstop so a stale alpha can't sneak a pick through.
      if (!this.canPickCard(card)) return;
      if (this.currentDeck.length < STARTER_DECK_SIZE) {
        this.currentDeck.push(card.id);
        this.refresh();
      }
    });

    return cell;
  }

  /**
   * Tag each grid cell with a synergy flag (≥1 shared keyword with ≥2 deck
   * cards). Repaint the bg stroke to a soft gold glow on matches; clear it
   * back to invisible otherwise. Hover handlers consult cell.synergy to keep
   * the gold tint over the standard white-highlight on pointerover.
   */
  private refreshCellSynergy(): void {
    const deckCards: CardDefinition[] = [];
    for (const id of this.currentDeck) {
      const c = getAllCards().find((cc) => cc.id === id);
      if (c) deckCards.push(c);
    }
    for (const cell of this.cardCells) {
      cell.synergy = cardSynergizesWithDeck(cell.card, deckCards);
      if (cell.synergy) cell.bg.setStrokeStyle(2, 0xffd700, 0.85);
      else cell.bg.setStrokeStyle(1.5, 0xffffff, 0);
    }
  }

  /**
   * Affordability check used by createCardCell click-guard and the per-cell
   * alpha dimming pass. A card is pickable if (a) the deck has room and
   * (b) adding its elements wouldn't exceed the 10-element starter budget.
   */
  private canPickCard(card: CardDefinition): boolean {
    if (this.currentDeck.length >= STARTER_DECK_SIZE) return false;
    const cardElems = (card.elements ?? []) as ElementId[];
    const cardCount = countElementCategories(cardElems).total;
    let currentTotal = 0;
    for (const id of this.currentDeck) {
      const c = getAllCards().find((cc) => cc.id === id);
      if (!c) continue;
      currentTotal += countElementCategories((c.elements ?? []) as ElementId[]).total;
    }
    return currentTotal + cardCount <= 10;
  }

  /**
   * Dim cards the player can't currently pick (deck full OR would overflow
   * the element budget). Re-run on every refresh so dims stay in sync with
   * the in-flight deck.
   */
  private refreshCellAffordability(): void {
    for (const cell of this.cardCells) {
      const ok = this.canPickCard(cell.card);
      cell.container.setAlpha(ok ? 1.0 : 0.4);
    }
  }

  private bindScroll(): void {
    this.input.on('wheel', (_p: any, _g: any, _dx: number, dy: number) => {
      // Only scroll when the pointer is over the grid viewport — otherwise the
      // wheel happens for tooltip area / filter chips etc.
      const pointer = this.input.activePointer;
      const inViewport =
        pointer.x >= GRID_X && pointer.x <= GRID_X + GRID_VIEWPORT_W &&
        pointer.y >= GRID_Y && pointer.y <= GRID_Y + GRID_VIEWPORT_H;
      if (!inViewport) return;

      this.gridScrollY = Math.max(0, Math.min(this.gridMaxScroll, this.gridScrollY + dy));
      this.gridContainer.setY(-this.gridScrollY);
      this.hideHoverPreview();
      this.updateCellInteractivity();
    });
  }

  // ────────────────────────────────────────────────
  // Deck slots panel (right side)
  // ────────────────────────────────────────────────

  private renderDeckPanel(): void {
    const totalH = SLOT_CARD_H * STARTER_DECK_SIZE + SLOT_GAP * (STARTER_DECK_SIZE - 1);
    this.add.rectangle(
      SLOT_PANEL_X,
      SLOT_Y + totalH / 2,
      SLOT_PANEL_W + 16,
      totalH + 16,
      0x141420, 0.85,
    ).setStrokeStyle(1, 0x4a4a60);

    this.add.text(SLOT_PANEL_X, SLOT_Y - 24, 'Deck', {
      fontSize: '13px', fontStyle: 'bold', color: WHITE, fontFamily: FF,
    }).setOrigin(0.5, 1);
    this.add.text(SLOT_PANEL_X, SLOT_Y - 10, 'click to remove', {
      fontSize: '9px', color: DIM, fontFamily: FF,
    }).setOrigin(0.5, 1);

    for (let i = 0; i < STARTER_DECK_SIZE; i++) {
      // Slot container centered on (SLOT_PANEL_X, slotY). Each slot owns its
      // empty-state background rectangle as the first child; updateDeckSlots
      // adds/removes a CardVisual child on top depending on whether the slot
      // is filled.
      const slotY = SLOT_Y + i * (SLOT_CARD_H + SLOT_GAP) + SLOT_CARD_H / 2;
      const container = this.add.container(SLOT_PANEL_X, slotY);
      const bg = this.add.rectangle(0, 0, SLOT_CARD_W + 8, SLOT_CARD_H + 4, 0x1a1a30, 0.7)
        .setStrokeStyle(1, 0x3a3a55);
      const label = this.add.text(0, 0, `Slot ${i + 1}`, {
        fontSize: '12px', color: DIM, fontFamily: FF,
      }).setOrigin(0.5);
      container.add([bg, label]);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        if (this.currentDeck[i]) {
          this.currentDeck.splice(i, 1);
          this.refresh();
        }
      });
      this.deckSlotContainers.push(container);
    }
  }

  private updateDeckSlots(): void {
    for (let i = 0; i < STARTER_DECK_SIZE; i++) {
      const container = this.deckSlotContainers[i];
      if (!container) continue;
      const bg = container.list[0] as Phaser.GameObjects.Rectangle;
      const label = container.list[1] as Phaser.GameObjects.Text;
      // Remove any previously-mounted CardVisual or extra child from a prior
      // render. The bg + label live at indices 0/1; everything past that is a
      // CardVisual we created last refresh and need to tear down.
      while (container.list.length > 2) {
        const extra = container.list[container.list.length - 1];
        container.remove(extra, true);
      }

      const cardId = this.currentDeck[i];
      if (cardId) {
        // Filled slot: hide the placeholder label/bg styling and mount a full
        // CardVisual (all features — image, name, cost, description, dots).
        bg.setFillStyle(0x000000, 0).setStrokeStyle(0);
        label.setVisible(false);

        const card = getAllCards().find((c) => c.id === cardId);
        const color = card ? this.dominantElementColor(card) : 0x3a3a55;
        bg.setStrokeStyle(1.5, color, 0.85);

        // Create the full card visual at slot scale. The CardVisual factory
        // attaches its own pointerdown (opens detail popup) and pointerover/out
        // (scale tween + 2s keyword tooltip). Strip those — the deck slot's
        // click semantics are "remove from deck" and it must not pop a card
        // detail / hover panel that fights with the click target.
        const visual = createCardVisual(this, 0, 0, cardId, { scale: SLOT_CARD_SCALE });
        visual.removeAllListeners('pointerdown');
        visual.removeAllListeners('pointerover');
        visual.removeAllListeners('pointerout');
        visual.disableInteractive();
        container.add(visual);
      } else {
        bg.setFillStyle(0x1a1a30, 0.7).setStrokeStyle(1, 0x3a3a55);
        label.setText(`Slot ${i + 1}`);
        label.setColor(DIM);
        label.setVisible(true);
      }
    }
  }

  // ────────────────────────────────────────────────
  // Hover preview — full-size CardVisual that pops up beside the grid card.
  // The keyword tooltip mounts off the preview's bounds, so the panel always
  // appears to the side of an "actual card" instead of clipping the tiny
  // grid cell footprint.
  // ────────────────────────────────────────────────

  private showHoverPreview(card: CardDefinition, sourceCenterX: number, sourceCenterY: number): void {
    if (this.hoverPreviewCardId === card.id && this.hoverPreview) return;
    this.hideHoverPreview();
    this.hoverPreviewCardId = card.id;

    // Place the preview beside the actual hovered grid card. Try the right
    // side first; mirror to the left if the preview + its keyword tooltip
    // would clip past the canvas edge. The keyword panel mirrors itself
    // independently, but we still keep a tooltip budget here so the preview
    // doesn't push the panel off-canvas when it would have otherwise fit.
    const w = STANDARD_CARD_WIDTH * PREVIEW_SCALE;
    const h = STANDARD_CARD_HEIGHT * PREVIEW_SCALE;

    let previewX = sourceCenterX + CARD_W / 2 + PREVIEW_GAP + w / 2;
    const rightEdgeWithTooltip = previewX + w / 2 + PREVIEW_TOOLTIP_BUDGET;
    if (rightEdgeWithTooltip > LAYOUT.canvasWidth - 4) {
      previewX = sourceCenterX - CARD_W / 2 - PREVIEW_GAP - w / 2;
    }
    previewX = Math.max(w / 2 + 4, Math.min(LAYOUT.canvasWidth - w / 2 - 4, previewX));

    const previewY = Math.max(
      h / 2 + 4,
      Math.min(LAYOUT.canvasHeight - h / 2 - 4, sourceCenterY),
    );

    const visual = createCardVisual(this, previewX, previewY, card.id, { scale: PREVIEW_SCALE });
    // The preview is a passive overlay: it must not absorb pointer events
    // (would block the grid cell's pointerout), open the detail popup, or
    // schedule its own competing keyword tooltip.
    visual.removeAllListeners('pointerdown');
    visual.removeAllListeners('pointerover');
    visual.removeAllListeners('pointerout');
    visual.disableInteractive();
    visual.setDepth(PREVIEW_DEPTH);
    this.hoverPreview = visual;

    // Schedule the keyword glossary panel against the preview's bounds so it
    // mounts to the side of the full card. The scheduler's standard 2s delay
    // applies here exactly as elsewhere in the UI.
    this.hoverPreviewTooltip = scheduleKeywordPanel(this, card.description, () => ({
      x: previewX, y: previewY, w, h,
    }));
  }

  private hideHoverPreview(): void {
    if (this.hoverPreviewTooltip) {
      this.hoverPreviewTooltip.cancel();
      this.hoverPreviewTooltip = null;
    }
    if (this.hoverPreview) {
      this.hoverPreview.destroy(true);
      this.hoverPreview = null;
    }
    this.hoverPreviewCardId = null;
  }

  // ────────────────────────────────────────────────
  // Validation + actions
  // ────────────────────────────────────────────────

  private renderValidationAndActions(): void {
    this.elementBudgetText = this.add.text(400, 540, '', {
      fontSize: '12px', fontStyle: 'bold', color: WHITE, fontFamily: FF,
    }).setOrigin(0.5);
    this.validationText = this.add.text(400, 558, '', {
      fontSize: '11px', color: '#ff9999', fontFamily: FF, align: 'center',
      wordWrap: { width: 750 },
    }).setOrigin(0.5);

    createButton(this, 100, 580, 'Clear', () => { this.currentDeck = []; this.refresh(); }, 'secondary');
    createButton(this, 300, 580, 'Save Preset', () => this.savePreset(), 'secondary');
    this.startBtn = createButton(this, 600, 580, '▶ Start Run', () => this.confirmDeck(), 'primary');
  }

  private async savePreset(): Promise<void> {
    const meta = this.metaState;
    if (!meta) return;
    const anyMeta = meta as any;
    if (!anyMeta.deckPresets) anyMeta.deckPresets = {};
    if (!Array.isArray(anyMeta.deckPresets[this.className])) anyMeta.deckPresets[this.className] = [];
    const arr = anyMeta.deckPresets[this.className] as DeckPreset[];
    while (arr.length <= this.selectedPresetIndex) {
      arr.push({ name: `Preset ${arr.length + 1}`, cardIds: [] });
    }
    // Mutate the existing entry in place so any UI references stay valid.
    arr[this.selectedPresetIndex].cardIds = [...this.currentDeck];

    try {
      await saveMetaState(meta);
    } catch {
      // ignore — UI already reflects the in-memory change
    }
    this.refresh();
  }

  private confirmDeck(): void {
    const v = validateStarterDeck(this.currentDeck, this.className);
    if (!v.valid) return;
    const cb = this.onConfirm;
    this.onConfirm = null; // guard double-fire
    if (cb) cb([...this.currentDeck]);
  }

  private cancel(): void {
    const cb = this.onCancel;
    this.onCancel = null;
    if (cb) cb();
    this.scene.stop();
  }

  // ────────────────────────────────────────────────
  // Refresh + helpers
  // ────────────────────────────────────────────────

  private refresh(): void {
    for (let i = 0; i < PRESETS_PER_CLASS; i++) this.updatePresetTab(i);
    this.updateDeckSlots();
    // Repaint cell alpha against the current in-flight deck so cards that
    // would push the element budget over 10 dim out and become un-clickable.
    this.refreshCellAffordability();
    // Repaint synergy glow against the current in-flight deck.
    this.refreshCellSynergy();
    const v = validateStarterDeck(this.currentDeck, this.className);
    this.elementBudgetText.setText(`Cards: ${v.size}/${STARTER_DECK_SIZE}  |  Elements: ${v.totalElements}/10  |  Physical: ${v.physical}  |  Elemental: ${v.elemental}`);
    if (v.valid) {
      this.validationText.setText('Deck is valid! Click ▶ Start Run.');
      this.validationText.setColor('#99ff99');
      this.startBtn.setColor(GOLD);
      this.startBtn.setAlpha(1);
    } else {
      this.validationText.setText(v.errors.join(' · '));
      this.validationText.setColor('#ff9999');
      this.startBtn.setColor(DIM);
      this.startBtn.setAlpha(0.5);
    }
  }

  private dominantElementColor(card: CardDefinition): number {
    const elems = (card.elements ?? []) as ElementId[];
    if (!elems.length) return 0x4a4a60;
    // Pick the first element's color as dominant for simplicity.
    return parseInt(ELEMENTS[elems[0]].color.replace('#', ''), 16);
  }
}
