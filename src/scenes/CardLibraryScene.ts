// CardLibraryScene — browse-only card library overlay.
// Launches over a parent scene (Shop / Forge / etc.); pauses parent on open,
// resumes on close. Renders every CardDefinition through the existing
// CardVisual factory in a scrollable 6-wide grid, gated by CardFilterBar.
//
// The grid is **virtualized**: mounted CardVisuals are limited to the rows
// currently visible (± a 1-row buffer) instead of all 164 cards at once. On
// scroll/filter change we diff the visible-index set against the currently-
// mounted Map and only create/destroy the deltas. With ~6 columns × ~3 visible
// rows + buffer that caps the live GameObject count around 24-30 cards instead
// of 164, which was the principal lag source in this scene.

import Phaser from 'phaser';
import { SCENE_KEYS } from '../state/SceneKeys';
import { FONTS } from '../ui/StyleConstants';
import { getAllCards } from '../data/DataLoader';
import { createCardVisual, STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';
import { getRun } from '../state/RunState';
// Note: CardVisual already self-binds pointerdown -> showCardDetail, so we
// don't need to import the popup helper directly here.
import {
  CardFilterBar,
  applyFilters,
  type CardFilters,
} from '../ui/CardFilterBar';
import type { CardDefinition } from '../data/types';

const FF = FONTS.family;
const COLS = 6;
const THUMB_SCALE = 0.6;            // CardVisual at 60% — 90×144 footprint.
const THUMB_W = STANDARD_CARD_WIDTH * THUMB_SCALE;
const THUMB_H = STANDARD_CARD_HEIGHT * THUMB_SCALE;
const COL_GAP = 8;
const ROW_GAP = 12;

const GRID_VIEW_TOP    = 152;       // y-coord where the scroll-viewport starts
const GRID_VIEW_BOTTOM = 560;       // y-coord where the scroll-viewport ends
const ROW_HEIGHT       = THUMB_H + ROW_GAP;
const VIEW_HEIGHT      = GRID_VIEW_BOTTOM - GRID_VIEW_TOP;
const VIRT_ROW_BUFFER  = 1;         // extra rows above & below the viewport

export interface CardLibrarySceneInitData {
  parentKey: string;
}

interface MountedCell {
  container: Phaser.GameObjects.Container;
  lockIcon: Phaser.GameObjects.Text | null;
}

export class CardLibraryScene extends Phaser.Scene {
  private parentKey: string = SCENE_KEYS.SHOP;
  private filterBar: CardFilterBar | null = null;
  private gridContainer: Phaser.GameObjects.Container | null = null;
  private gridMaskGfx: Phaser.GameObjects.Graphics | null = null;
  private emptyText: Phaser.GameObjects.Text | null = null;
  private allCards: CardDefinition[] = [];
  private filteredCards: CardDefinition[] = [];
  private scrollY = 0;
  private wheelHandler: ((p: unknown, go: unknown, dx: number, dy: number) => void) | null = null;

  // Virtualization state: only filteredCards indices in `mountedCells` are
  // currently realized as GameObjects. Updated via updateVisibleCells().
  private mountedCells: Map<number, MountedCell> = new Map();
  // Pre-resolved upgrade flags so CardFace doesn't re-walk run.deck.active
  // for every card every render (was O(filteredCards × deckSize)).
  private upgradedIds: Set<string> = new Set();

  constructor() {
    super(SCENE_KEYS.LIBRARY);
  }

  init(data: CardLibrarySceneInitData): void {
    this.parentKey = data?.parentKey ?? SCENE_KEYS.SHOP;
  }

  create(): void {
    // Render above the parent scene that launched us (Forge/Shop/etc.).
    // Without this, the launched scene draws underneath the parent's display
    // list and looks like nothing happened.
    this.scene.bringToTop();

    this.scrollY = 0;
    this.allCards = getAllCards();
    this.filteredCards = this.allCards.slice();
    this.buildUpgradedSet();

    // Dim backdrop — full-screen, absorbs clicks so the parent scene's
    // pointerover handlers don't fire while the library is open.
    const backdrop = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.85)
      .setInteractive();
    backdrop.on('pointerdown', () => { /* swallow clicks */ });

    // Library panel (full-screen with a thin frame).
    this.add.rectangle(400, 300, 780, 580, 0x130800, 0.96).setStrokeStyle(2, 0x9a6030);

    // Title.
    this.add.text(400, 36, '📖 Card Library', {
      fontSize: '22px', fontStyle: 'bold', color: '#ffd700', fontFamily: FF,
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    // Close button (top-right).
    const closeBg = this.add.circle(760, 36, 16, 0xcc0000)
      .setStrokeStyle(2, 0x3e2723)
      .setInteractive({ useHandCursor: true });
    this.add.text(760, 36, 'X', {
      fontSize: '16px', fontStyle: 'bold', color: '#ffffff', fontFamily: FF,
    }).setOrigin(0.5);
    closeBg.on('pointerover', () => closeBg.setFillStyle(0xff3333));
    closeBg.on('pointerout',  () => closeBg.setFillStyle(0xcc0000));
    closeBg.on('pointerdown', () => this.closeLibrary());

    // Filter bar — width 720, anchored top-left at x=40, y=70.
    this.filterBar = new CardFilterBar(this, 40, 70, 720, (filters) => this.onFiltersChanged(filters));

    // Card count label, updated when filters change.
    this.cardCountText = this.add.text(40, 124, '', {
      fontSize: '12px', color: '#aaaaaa', fontFamily: FF,
    });
    this.updateCardCount();

    // Scrollable grid container.
    this.gridContainer = this.add.container(0, 0);
    const maskGfx = this.make.graphics({ x: 0, y: 0 });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(20, GRID_VIEW_TOP, 760, VIEW_HEIGHT);
    this.gridContainer.setMask(maskGfx.createGeometryMask());
    this.gridMaskGfx = maskGfx;

    // Mouse-wheel scroll. Virtualization re-runs after every scroll so cells
    // entering the viewport mount and cells leaving unmount.
    this.wheelHandler = (_p, _go, _dx, dy) => {
      const maxScroll = Math.max(0, this.getGridContentHeight() - VIEW_HEIGHT);
      this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY + dy * 0.5));
      if (this.gridContainer) this.gridContainer.y = -this.scrollY;
      this.updateVisibleCells();
    };
    this.input.on('wheel', this.wheelHandler);

    this.refreshGrid();

    this.events.once('shutdown', () => this.cleanup());
  }

  private cardCountText!: Phaser.GameObjects.Text;

  // ── Pre-resolution helpers ──────────────────────────────

  /**
   * Build a Set of card IDs that are currently upgraded in the active run.
   * CardFace's default resolveUpgradeFlag walks run.deck.active per card; that
   * loop becomes O(filteredCards × deckSize) when called from every render —
   * roughly 164 × ~20 = 3,280 comparisons in the worst case. Doing it once
   * here and passing the resolved boolean cuts that to O(filteredCards).
   */
  private buildUpgradedSet(): void {
    this.upgradedIds.clear();
    try {
      const run = getRun();
      run.deck.active.forEach((id, i) => {
        if (run.deck.upgraded[i]) this.upgradedIds.add(id);
      });
    } catch { /* outside a run — no upgrades to flag */ }
  }

  // ── Filter / render ─────────────────────────────────────

  private onFiltersChanged(filters: CardFilters): void {
    this.filteredCards = applyFilters(this.allCards, filters);
    this.scrollY = 0;
    if (this.gridContainer) this.gridContainer.y = 0;
    this.refreshGrid();
    this.updateCardCount();
  }

  private updateCardCount(): void {
    if (!this.cardCountText) return;
    this.cardCountText.setText(`${this.filteredCards.length} / ${this.allCards.length} cards`);
  }

  /**
   * Tear down every mounted cell and rebuild only the visible window. Called
   * after a filter change (since indices now point at different cards), or
   * after the first mount.
   */
  private refreshGrid(): void {
    if (!this.gridContainer) return;
    // Destroy currently-mounted cells; their cardIds may no longer match the
    // new filteredCards[idx], so they aren't safe to recycle.
    for (const cell of this.mountedCells.values()) {
      if (cell.lockIcon) cell.lockIcon.destroy();
      cell.container.destroy(true);
    }
    this.mountedCells.clear();

    if (this.emptyText) {
      this.emptyText.destroy();
      this.emptyText = null;
    }
    if (this.filteredCards.length === 0) {
      this.emptyText = this.add.text(400, (GRID_VIEW_TOP + GRID_VIEW_BOTTOM) / 2, 'No cards match the current filters.', {
        fontSize: '14px', color: '#aaaaaa', fontFamily: FF, fontStyle: 'italic',
      }).setOrigin(0.5);
      this.gridContainer.add(this.emptyText);
      return;
    }

    this.updateVisibleCells();
  }

  /**
   * Compute which card indices fall inside the scroll viewport (plus a 1-row
   * buffer on each side) and reconcile the mountedCells Map: unmount cells
   * that scrolled out, mount cells that scrolled in. Cells whose visibility
   * didn't change are left untouched (no destroy/recreate churn during scroll).
   */
  private updateVisibleCells(): void {
    if (!this.gridContainer) return;

    const startX = (800 - (COLS * THUMB_W + (COLS - 1) * COL_GAP)) / 2 + THUMB_W / 2;
    const startY = GRID_VIEW_TOP + 8 + THUMB_H / 2;

    // Visible row window in filteredCards-row space (scroll-aware).
    const firstVisibleRow = Math.max(0, Math.floor(this.scrollY / ROW_HEIGHT) - VIRT_ROW_BUFFER);
    const lastVisibleRow  = Math.ceil((this.scrollY + VIEW_HEIGHT) / ROW_HEIGHT) + VIRT_ROW_BUFFER;
    const totalRows = Math.ceil(this.filteredCards.length / COLS);
    const clampedLastRow = Math.min(lastVisibleRow, totalRows - 1);

    const firstIdx = firstVisibleRow * COLS;
    const lastIdx  = Math.min(clampedLastRow * COLS + (COLS - 1), this.filteredCards.length - 1);

    // Drop cells that are outside the new window.
    for (const [idx, cell] of this.mountedCells) {
      if (idx < firstIdx || idx > lastIdx) {
        if (cell.lockIcon) cell.lockIcon.destroy();
        cell.container.destroy(true);
        this.mountedCells.delete(idx);
      }
    }

    // Mount cells that should be visible but aren't yet.
    for (let idx = firstIdx; idx <= lastIdx; idx++) {
      if (this.mountedCells.has(idx)) continue;
      const card = this.filteredCards[idx];
      if (!card) continue;

      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = startX + col * (THUMB_W + COL_GAP);
      const y = startY + row * (THUMB_H + ROW_GAP);

      const visual = createCardVisual(this, x, y, card.id, {
        scale: THUMB_SCALE,
        upgraded: this.upgradedIds.has(card.id),
      });
      this.gridContainer.add(visual);

      let lockIcon: Phaser.GameObjects.Text | null = null;
      if (card.locked === true) {
        visual.setAlpha(0.4);
        lockIcon = this.add.text(x, y, '🔒', {
          fontSize: '24px', fontFamily: FF, color: '#ffffff',
        }).setOrigin(0.5);
        this.gridContainer.add(lockIcon);
      }

      this.mountedCells.set(idx, { container: visual, lockIcon });
    }
  }

  private getGridContentHeight(): number {
    const rows = Math.ceil(this.filteredCards.length / COLS);
    if (rows === 0) return 0;
    return rows * THUMB_H + (rows - 1) * ROW_GAP + 16;
  }

  // ── Close / lifecycle ───────────────────────────────────

  private closeLibrary(): void {
    const parent = this.parentKey;
    this.scene.stop();
    // Only resume if the parent scene is actually paused; otherwise calling
    // resume on a running scene is a no-op but logs noisy warnings.
    if (parent && this.scene.get(parent)) {
      this.scene.resume(parent);
    }
  }

  private cleanup(): void {
    if (this.wheelHandler) {
      this.input.off('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    if (this.filterBar) {
      // Container.destroy unbinds the bar's DOM input.
      this.filterBar.destroy();
      this.filterBar = null;
    }
    if (this.gridMaskGfx) {
      // Off-display-list — must be destroyed manually.
      this.gridMaskGfx.destroy();
      this.gridMaskGfx = null;
    }
    if (this.gridContainer) {
      this.gridContainer.destroy(true);
      this.gridContainer = null;
    }
    this.mountedCells.clear();
    this.emptyText = null;
  }
}
