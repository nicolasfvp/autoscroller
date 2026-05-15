// Deck builder overlay -- pre-run starter deck selection with element ratio + presets.
// 3xN scrollable grid of available cards, hover tooltip with effects/elements,
// click-to-add (from grid) / click-to-remove (from deck slots), preset save/load.
// See docs/CARDS_SYSTEM.md §6.

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

const FF = FONTS.family;
const WHITE = '#ffffff';
const GOLD = COLORS.accent;
const DIM = COLORS.textSecondary;

// Grid geometry
const CARD_W = 140;
const CARD_H = 90;
const GRID_COLS = 3;
const GRID_X = 30;
const GRID_Y = 150;
const GRID_GAP = 8;
const GRID_VIEWPORT_W = GRID_COLS * CARD_W + (GRID_COLS - 1) * GRID_GAP;
const GRID_VIEWPORT_H = 380;

// Filter chip row geometry
const FILTER_Y = 115;
const FILTER_CHIP_W = 50;
const FILTER_CHIP_H = 20;
const FILTER_GAP = 4;

const ALL_ELEMENTS: ElementId[] = ['attack', 'defense', 'agility', 'counter', 'fire', 'water', 'air', 'earth'];

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
  private filterContainer!: Phaser.GameObjects.Container;
  private activeFilters: Set<ElementId> = new Set();

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
    this.renderFilterChips();
    this.renderCardGrid();
    this.renderDeckPanel();
    this.renderValidationAndActions();
    this.renderTooltip();
    this.bindScroll();
    this.refresh();
  }

  // ────────────────────────────────────────────────
  // Element filter chips
  // ────────────────────────────────────────────────

  private renderFilterChips(): void {
    this.add.text(GRID_X, FILTER_Y - 16, 'Filter by element:', {
      fontSize: '11px', fontStyle: 'bold', color: DIM, fontFamily: FF,
    });

    this.filterContainer = this.add.container(0, 0);

    // 8 element chips
    ALL_ELEMENTS.forEach((id, idx) => {
      const x = GRID_X + idx * (FILTER_CHIP_W + FILTER_GAP);
      const chipContainer = this.add.container(x + FILTER_CHIP_W / 2, FILTER_Y);
      const color = parseInt(ELEMENTS[id].color.replace('#', ''), 16);
      const bg = this.add.rectangle(0, 0, FILTER_CHIP_W, FILTER_CHIP_H, color, 0.2)
        .setStrokeStyle(1, color, 0.6);
      const label = this.add.text(0, 0, ELEMENTS[id].name.slice(0, 5), {
        fontSize: '10px', fontStyle: 'bold', color: WHITE, fontFamily: FF,
      }).setOrigin(0.5);
      chipContainer.add([bg, label]);
      chipContainer.setData('elementId', id);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.toggleFilter(id));
      bg.on('pointerover', () => bg.setStrokeStyle(2, 0xffffff, 1));
      bg.on('pointerout',  () => this.refreshChip(chipContainer));
      this.filterContainer.add(chipContainer);
    });

    // "All" reset button
    const allX = GRID_X + 8 * (FILTER_CHIP_W + FILTER_GAP);
    const allContainer = this.add.container(allX + FILTER_CHIP_W / 2, FILTER_Y);
    const allBg = this.add.rectangle(0, 0, FILTER_CHIP_W, FILTER_CHIP_H, 0x4a4a60, 0.85)
      .setStrokeStyle(1, 0xffd700, 0.6);
    const allLabel = this.add.text(0, 0, 'All', {
      fontSize: '10px', fontStyle: 'bold', color: GOLD, fontFamily: FF,
    }).setOrigin(0.5);
    allContainer.add([allBg, allLabel]);
    allBg.setInteractive({ useHandCursor: true });
    allBg.on('pointerdown', () => { this.activeFilters.clear(); this.rebuildGrid(); this.refreshAllChips(); });
    allBg.on('pointerover', () => allBg.setStrokeStyle(2, 0xffffff, 1));
    allBg.on('pointerout',  () => allBg.setStrokeStyle(1, 0xffd700, 0.6));
  }

  private toggleFilter(id: ElementId): void {
    if (this.activeFilters.has(id)) this.activeFilters.delete(id);
    else this.activeFilters.add(id);
    this.rebuildGrid();
    this.refreshAllChips();
  }

  private refreshChip(container: Phaser.GameObjects.Container): void {
    const id = container.getData('elementId') as ElementId;
    const bg = container.list[0] as Phaser.GameObjects.Rectangle;
    const color = parseInt(ELEMENTS[id].color.replace('#', ''), 16);
    if (this.activeFilters.has(id)) {
      bg.setFillStyle(color, 0.85);
      bg.setStrokeStyle(2, 0xffffff, 1);
    } else {
      bg.setFillStyle(color, 0.2);
      bg.setStrokeStyle(1, color, 0.6);
    }
  }

  private refreshAllChips(): void {
    if (!this.filterContainer) return;
    this.filterContainer.list.forEach((obj) => {
      if (obj instanceof Phaser.GameObjects.Container) this.refreshChip(obj);
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
    const tier1 = getAllCards().filter((c) => c.tier === 1);
    if (this.activeFilters.size === 0) return tier1;
    // Intersection: card must contain ALL selected elements at least once.
    return tier1.filter((c) => {
      const elems = (c.elements ?? []) as ElementId[];
      for (const f of this.activeFilters) {
        if (!elems.includes(f)) return false;
      }
      return true;
    });
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
    const container = this.add.container(x, y);

    const dominantColor = this.dominantElementColor(card);
    const bg = this.add.rectangle(CARD_W / 2, CARD_H / 2, CARD_W, CARD_H, dominantColor, 0.18)
      .setStrokeStyle(1.5, dominantColor, 0.85);

    const name = this.add.text(CARD_W / 2, 12, card.name, {
      fontSize: '11px', fontStyle: 'bold', color: WHITE, fontFamily: FF,
      align: 'center', wordWrap: { width: CARD_W - 8 },
    }).setOrigin(0.5, 0);

    // Element icons (small colored dots in a row)
    const elems = (card.elements ?? []) as ElementId[];
    const dotR = 6;
    const dotGap = 4;
    const dotsTotalW = elems.length * dotR * 2 + (elems.length - 1) * dotGap;
    const startDotX = CARD_W / 2 - dotsTotalW / 2 + dotR;
    elems.forEach((e, idx) => {
      const dx = startDotX + idx * (dotR * 2 + dotGap);
      const color = parseInt(ELEMENTS[e].color.replace('#', ''), 16);
      const dot = this.add.circle(dx, 38, dotR, color).setStrokeStyle(1, 0xffffff, 0.6);
      container.add(dot);
    });

    // Brief effect summary
    const effectsLine = this.summarizeEffects(card);
    const summary = this.add.text(CARD_W / 2, 56, effectsLine, {
      fontSize: '9px', color: WHITE, fontFamily: FF,
      align: 'center', wordWrap: { width: CARD_W - 8 },
    }).setOrigin(0.5, 0);

    // Cost / cooldown
    const costLine = this.formatCostLine(card);
    this.add.text(CARD_W / 2, CARD_H - 12, costLine, {
      fontSize: '9px', color: GOLD, fontFamily: FF,
    }).setOrigin(0.5).setData('_inCell', true);

    container.add([bg, name, summary]);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      bg.setStrokeStyle(2, 0xffffff, 1);
      this.showTooltip(card, x, y);
    });
    bg.on('pointerout', () => {
      bg.setStrokeStyle(1.5, dominantColor, 0.85);
      this.hideTooltip();
    });
    bg.on('pointerdown', () => {
      if (this.currentDeck.length < STARTER_DECK_SIZE) {
        this.currentDeck.push(card.id);
        this.refresh();
      }
    });

    return { card, container, bg };
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

  private summarizeEffects(card: CardDefinition): string {
    if (!card.effects?.length) return '—';
    const fx = card.effects[0];
    switch (fx.type) {
      case 'damage':   return `Deal ${fx.value} dmg`;
      case 'heal':     return `Heal ${fx.value}`;
      case 'armor':    return `+${fx.value} armor`;
      case 'stamina':  return `+${fx.value} stam`;
      case 'mana':     return `+${fx.value} mana`;
      case 'dot':      return `${fx.stack || 'DoT'} ${fx.value}`;
      case 'buff':     return `+${fx.value} ${fx.scale?.stat ?? 'stat'}`;
      case 'debuff':   return `Enemy -${fx.value} def`;
      case 'stack':    return `+${fx.value} ${fx.stack ?? 'stack'}`;
      default:         return fx.type;
    }
  }

  private describeEffects(card: CardDefinition): string {
    if (!card.effects?.length) return '—';
    return card.effects.map((fx) => {
      const tgt = fx.target === 'enemy' ? '→ enemy' : '→ self';
      let line = '';
      switch (fx.type) {
        case 'damage':  line = `Deal ${fx.value} damage ${tgt}`; break;
        case 'heal':    line = `Heal ${fx.value} HP`; break;
        case 'armor':   line = `Gain ${fx.value} armor`; break;
        case 'stamina': line = `+${fx.value} stamina`; break;
        case 'mana':    line = `+${fx.value} mana`; break;
        case 'dot':     line = `Apply ${fx.value} ${fx.stack || 'DoT'} stacks ${tgt}`; break;
        case 'buff':    line = `+${fx.value} ${fx.scale?.stat ?? 'stat'} buff`; break;
        case 'debuff':  line = `Enemy -${fx.value} def`; break;
        case 'stack':   line = `+${fx.value} ${fx.stack ?? 'stack'}`; break;
        default:        line = `${fx.type} ${fx.value}`;
      }
      if (fx.scale) line += ` (+${fx.scale.value} per ${fx.scale.stat})`;
      return line;
    }).join('\n');
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
