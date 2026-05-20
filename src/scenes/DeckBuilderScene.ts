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
import { formatCardDescription } from '../systems/cards/CardText';
import { CardFilterBar } from '../ui/CardFilterBar';
import { applyFilters, type CardFilters } from '../ui/CardFilterBar.pure';
import { createCardVisual, STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';
import { attachKeywordHover } from '../ui/KeywordTooltip';
import { countElementCategories } from '../systems/ElementSystem';

const FF = FONTS.family;
const WHITE = '#ffffff';
const GOLD = COLORS.accent;
const DIM = COLORS.textSecondary;

// Grid geometry — CardVisual at scale 0.55 (82.5×132 footprint), 4 columns
// centered in the left zone (slot panel sits at x=510-770).
const CARD_SCALE = 0.55;
const CARD_W = STANDARD_CARD_WIDTH * CARD_SCALE;   // 82.5
const CARD_H = STANDARD_CARD_HEIGHT * CARD_SCALE;  // 132
const GRID_COLS = 4;
const GRID_GAP = 8;
const GRID_VIEWPORT_W = GRID_COLS * CARD_W + (GRID_COLS - 1) * GRID_GAP; // 354
const LEFT_ZONE_W = 500;                                                 // ends just before slot panel @ 510
const GRID_X = Math.round((LEFT_ZONE_W - GRID_VIEWPORT_W) / 2);          // 73
const GRID_Y = 175;
const GRID_VIEWPORT_H = 355;

// CardFilterBar row — element dropdown / tier checkboxes / search.
const CARD_FILTER_BAR_Y = 108;
const FILTER_BAR_W = 470;
const FILTER_BAR_X = Math.round((LEFT_ZONE_W - FILTER_BAR_W) / 2);       // 15

// Deck slot geometry
const SLOT_X = 510;
const SLOT_Y = 120;
const SLOT_W = 260;
const SLOT_H = 60;
const SLOT_GAP = 6;

interface CardCell {
  card: CardDefinition;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
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
    tiers: new Set<1 | 2 | 3>([1, 2, 3]),
    search: '',
  };

  private deckSlotContainers: Phaser.GameObjects.Container[] = [];
  private presetButtons: Phaser.GameObjects.Container[] = [];
  private validationText!: Phaser.GameObjects.Text;
  private elementBudgetText!: Phaser.GameObjects.Text;
  private startBtn!: Phaser.GameObjects.Text;

  private tooltipContainer!: Phaser.GameObjects.Container;
  private tooltipBg!: Phaser.GameObjects.Rectangle;
  private tooltipName!: Phaser.GameObjects.Text;
  private tooltipElements!: Phaser.GameObjects.Text;
  private tooltipEffects!: Phaser.GameObjects.Text;
  private tooltipCost!: Phaser.GameObjects.Text;

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
      tiers: new Set<1 | 2 | 3>([1, 2, 3]),
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

    // Hint
    const ratio = CLASS_DECK_RATIO[this.className];
    this.add.text(400, 50, `Pick ${STARTER_DECK_SIZE} Tier-1 cards · 10 elements total · ${this.className} ratio P[${ratio.physicalMin}-${ratio.physicalMax}] / E[${ratio.elementalMin}-${ratio.elementalMax}]`, {
      fontSize: '11px', color: DIM, fontFamily: FF,
    }).setOrigin(0.5);

    this.renderPresetTabs();
    this.renderCardFilterBar();
    this.renderCardGrid();
    this.renderDeckPanel();
    this.renderValidationAndActions();
    this.renderTooltip();
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

    this.gridHeaderText = this.add.text(GRID_X, GRID_Y - 18, 'Available Tier 1 Cards', {
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
    // Starter deck is Tier-1 only by rule. Pre-restrict the pool to Tier 1 so
    // the bar's tier checkboxes only meaningfully gate within {1}; element
    // dropdown + name search still apply.
    const tier1 = getAllCards().filter((c) => c.tier === 1);
    return applyFilters(tier1, this.cardFilters);
  }

  private rebuildGrid(): void {
    // Tear down current cells
    this.cardCells.forEach((cell) => cell.container.destroy(true));
    this.cardCells = [];
    this.gridScrollY = 0;
    this.gridContainer.setY(0);

    const filtered = this.getFilteredCards();
    this.gridHeaderText.setText(`Available Tier 1 Cards (${filtered.length})`);

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

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      bg.setStrokeStyle(2, 0xffffff, 1);
      this.showTooltip(card, x, y);
    });
    bg.on('pointerout', () => {
      bg.setStrokeStyle(1.5, 0xffffff, 0);
      this.hideTooltip();
    });

    // 2-second keyword glossary panel — attaches to the hit-box bg because
    // the underlying CardVisual is disableInteractive()'d in this scene.
    // Anchor is resolved lazily so the panel follows the cell as the grid
    // scrolls (gridContainer.y shifts with the wheel).
    attachKeywordHover(this, bg, card.description, () => {
      const m = bg.getWorldTransformMatrix();
      return { x: m.tx, y: m.ty, w: CARD_W, h: CARD_H };
    });

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

    return { card, container, bg };
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
      this.hideTooltip();
      this.updateCellInteractivity();
    });
  }

  // ────────────────────────────────────────────────
  // Deck slots panel (right side)
  // ────────────────────────────────────────────────

  private renderDeckPanel(): void {
    this.add.rectangle(
      SLOT_X + SLOT_W / 2,
      SLOT_Y + (SLOT_H * STARTER_DECK_SIZE + SLOT_GAP * (STARTER_DECK_SIZE - 1)) / 2,
      SLOT_W + 16,
      SLOT_H * STARTER_DECK_SIZE + SLOT_GAP * (STARTER_DECK_SIZE - 1) + 16,
      0x141420, 0.85,
    ).setStrokeStyle(1, 0x4a4a60);

    this.add.text(SLOT_X, SLOT_Y - 18, 'Your Deck (click to remove)', {
      fontSize: '13px', fontStyle: 'bold', color: WHITE, fontFamily: FF,
    });

    for (let i = 0; i < STARTER_DECK_SIZE; i++) {
      const y = SLOT_Y + i * (SLOT_H + SLOT_GAP);
      const container = this.add.container(SLOT_X, y);
      const bg = this.add.rectangle(SLOT_W / 2, SLOT_H / 2, SLOT_W, SLOT_H, 0x1a1a30, 0.7)
        .setStrokeStyle(1, 0x3a3a55);
      const label = this.add.text(SLOT_W / 2, SLOT_H / 2, `Slot ${i + 1}`, {
        fontSize: '13px', color: DIM, fontFamily: FF,
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
      // remove any extra children (dots) from previous render
      while (container.list.length > 2) container.remove(container.list[2], true);

      const cardId = this.currentDeck[i];
      if (cardId) {
        const card = getAllCards().find((c) => c.id === cardId);
        const color = card ? this.dominantElementColor(card) : 0x3a3a55;
        bg.setFillStyle(color, 0.3).setStrokeStyle(1.5, color, 0.85);
        label.setText(card?.name ?? cardId);
        label.setColor(WHITE);
        label.setX(20);
        label.setOrigin(0, 0.5);
        // element dots on the right
        const elems = (card?.elements ?? []) as ElementId[];
        const dotR = 5;
        const dotGap = 4;
        const dotsTotalW = elems.length * dotR * 2 + (elems.length - 1) * dotGap;
        const startDotX = SLOT_W - 14 - dotsTotalW + dotR;
        elems.forEach((e, idx) => {
          const dx = startDotX + idx * (dotR * 2 + dotGap);
          const elemColor = parseInt(ELEMENTS[e].color.replace('#', ''), 16);
          const dot = this.add.circle(dx, SLOT_H / 2, dotR, elemColor).setStrokeStyle(1, 0xffffff, 0.6);
          container.add(dot);
        });
      } else {
        bg.setFillStyle(0x1a1a30, 0.7).setStrokeStyle(1, 0x3a3a55);
        label.setText(`Slot ${i + 1}`);
        label.setColor(DIM);
        label.setX(SLOT_W / 2);
        label.setOrigin(0.5);
      }
    }
  }

  // ────────────────────────────────────────────────
  // Tooltip (floating)
  // ────────────────────────────────────────────────

  private renderTooltip(): void {
    this.tooltipContainer = this.add.container(0, 0);
    this.tooltipContainer.setDepth(100);
    this.tooltipBg = this.add.rectangle(0, 0, 250, 140, 0x0a0a18, 0.97).setStrokeStyle(2, 0xffd700);
    this.tooltipName = this.add.text(0, 0, '', {
      fontSize: '14px', fontStyle: 'bold', color: GOLD, fontFamily: FF,
    }).setOrigin(0.5, 0);
    this.tooltipElements = this.add.text(0, 0, '', {
      fontSize: '11px', color: WHITE, fontFamily: FF,
    }).setOrigin(0.5, 0);
    this.tooltipEffects = this.add.text(0, 0, '', {
      fontSize: '11px', color: WHITE, fontFamily: FF,
      align: 'center', wordWrap: { width: 230 },
    }).setOrigin(0.5, 0);
    this.tooltipCost = this.add.text(0, 0, '', {
      fontSize: '11px', color: '#aaccff', fontFamily: FF,
    }).setOrigin(0.5, 0);
    this.tooltipContainer.add([this.tooltipBg, this.tooltipName, this.tooltipElements, this.tooltipEffects, this.tooltipCost]);
    this.tooltipContainer.setVisible(false);
  }

  private showTooltip(card: CardDefinition, cardX: number, cardY: number): void {
    const elems = ((card.elements ?? []) as ElementId[]).map((e) => ELEMENTS[e].name).join(' + ');
    const effects = this.describeEffects(card);
    const cost = this.formatCostLine(card);

    this.tooltipName.setText(card.name);
    this.tooltipElements.setText(`Elements: ${elems || '—'}`);
    this.tooltipEffects.setText(effects);
    this.tooltipCost.setText(cost);

    // Resize bg to fit
    const w = 260;
    const lines = effects.split('\n').length;
    const h = 100 + lines * 14;
    this.tooltipBg.setSize(w, h);

    // Position to the right of the card (or left if near edge)
    let tx = cardX + CARD_W + 12;
    if (tx + w / 2 > 790) tx = cardX - 12 - w / 2;
    else tx += w / 2;
    const ty = Math.max(60, Math.min(540 - h, cardY - this.gridScrollY + CARD_H / 2));

    this.tooltipContainer.setPosition(tx, ty - h / 2);
    this.tooltipBg.setPosition(0, h / 2);
    this.tooltipName.setPosition(0, 10);
    this.tooltipElements.setPosition(0, 32);
    this.tooltipEffects.setPosition(0, 52);
    this.tooltipCost.setPosition(0, 52 + lines * 14 + 6);
    this.tooltipContainer.setVisible(true);
  }

  private hideTooltip(): void {
    this.tooltipContainer.setVisible(false);
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

  private describeEffects(card: CardDefinition): string {
    const text = formatCardDescription(card);
    if (!text) return '—';
    // The shared formatter joins fragments with ". " — tooltip wants one per line.
    return text.replace(/\. /g, '\n').replace(/\.$/, '');
  }

  private formatCostLine(card: CardDefinition): string {
    const parts: string[] = [];
    if (card.cost?.stamina) parts.push(`${card.cost.stamina} stam`);
    if (card.cost?.mana)    parts.push(`${card.cost.mana} mana`);
    if (card.cost?.defense) parts.push(`${card.cost.defense} def`);
    const cost = parts.length ? parts.join(' / ') : 'Free';
    return `${cost}  ·  ${card.cooldown.toFixed(1)}s CD`;
  }
}
