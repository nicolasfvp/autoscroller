// CardLibraryScene — browse-only card library overlay.
// Launches over a parent scene (Shop / Forge / etc.); pauses parent on open,
// resumes on close. Renders every CardDefinition through the existing
// CardVisual factory in a scrollable 6-wide grid, gated by CardFilterBar.

import Phaser from 'phaser';
import { SCENE_KEYS } from '../state/SceneKeys';
import { FONTS } from '../ui/StyleConstants';
import { getAllCards } from '../data/DataLoader';
import { createCardVisual, STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';
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

export interface CardLibrarySceneInitData {
  parentKey: string;
}

export class CardLibraryScene extends Phaser.Scene {
  private parentKey: string = SCENE_KEYS.SHOP;
  private filterBar: CardFilterBar | null = null;
  private gridContainer: Phaser.GameObjects.Container | null = null;
  private gridMaskGfx: Phaser.GameObjects.Graphics | null = null;
  private allCards: CardDefinition[] = [];
  private filteredCards: CardDefinition[] = [];
  private scrollY = 0;
  private wheelHandler: ((p: unknown, go: unknown, dx: number, dy: number) => void) | null = null;
  private escKey: Phaser.Input.Keyboard.Key | null = null;

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

    // ESC key also closes — bind once and stash so we can unbind on shutdown.
    if (this.input.keyboard) {
      this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      this.escKey.on('down', this.handleEsc, this);
    }

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
    maskGfx.fillRect(20, GRID_VIEW_TOP, 760, GRID_VIEW_BOTTOM - GRID_VIEW_TOP);
    this.gridContainer.setMask(maskGfx.createGeometryMask());
    this.gridMaskGfx = maskGfx;

    // Mouse-wheel scroll.
    this.wheelHandler = (_p, _go, _dx, dy) => {
      const maxScroll = Math.max(0, this.getGridContentHeight() - (GRID_VIEW_BOTTOM - GRID_VIEW_TOP));
      this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY + dy * 0.5));
      if (this.gridContainer) this.gridContainer.y = -this.scrollY;
    };
    this.input.on('wheel', this.wheelHandler);

    this.renderGrid();

    this.events.once('shutdown', () => this.cleanup());
  }

  private cardCountText!: Phaser.GameObjects.Text;

  // ── Filter / render ─────────────────────────────────────

  private onFiltersChanged(filters: CardFilters): void {
    this.filteredCards = applyFilters(this.allCards, filters);
    this.scrollY = 0;
    if (this.gridContainer) this.gridContainer.y = 0;
    this.renderGrid();
    this.updateCardCount();
  }

  private updateCardCount(): void {
    if (!this.cardCountText) return;
    this.cardCountText.setText(`${this.filteredCards.length} / ${this.allCards.length} cards`);
  }

  private renderGrid(): void {
    if (!this.gridContainer) return;
    this.gridContainer.removeAll(true);

    const totalRowWidth = COLS * THUMB_W + (COLS - 1) * COL_GAP;
    const startX = (800 - totalRowWidth) / 2 + THUMB_W / 2;
    const startY = GRID_VIEW_TOP + 8 + THUMB_H / 2;

    this.filteredCards.forEach((card, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = startX + col * (THUMB_W + COL_GAP);
      const y = startY + row * (THUMB_H + ROW_GAP);

      const visual = createCardVisual(this, x, y, card.id, { scale: THUMB_SCALE });
      // Locked T3: dim & overlay a lock icon. Click still opens the detail
      // popup (informational only) per spec.
      const isLocked = card.tier === 3 && card.locked === true;
      if (isLocked) {
        visual.setAlpha(0.4);
        const lock = this.add.text(x, y, '🔒', {
          fontSize: '24px', fontFamily: FF, color: '#ffffff',
        }).setOrigin(0.5);
        this.gridContainer!.add(lock);
      }
      // Cards already self-bind to showCardDetail in CardVisual, but they
      // capture the spawning scene; that's still this scene, so re-binding
      // would only duplicate listeners. We leave the built-in handler.
      this.gridContainer!.add(visual);
    });

    if (this.filteredCards.length === 0) {
      const empty = this.add.text(400, (GRID_VIEW_TOP + GRID_VIEW_BOTTOM) / 2, 'No cards match the current filters.', {
        fontSize: '14px', color: '#aaaaaa', fontFamily: FF, fontStyle: 'italic',
      }).setOrigin(0.5);
      this.gridContainer.add(empty);
    }
  }

  private getGridContentHeight(): number {
    const rows = Math.ceil(this.filteredCards.length / COLS);
    if (rows === 0) return 0;
    return rows * THUMB_H + (rows - 1) * ROW_GAP + 16;
  }

  // ── Close / lifecycle ───────────────────────────────────

  private handleEsc(): void {
    this.closeLibrary();
  }

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
    if (this.escKey) {
      this.escKey.off('down', this.handleEsc, this);
      // Phaser's Key objects are GC'd with the keyboard plugin; no manual destroy.
      this.escKey = null;
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
  }
}
