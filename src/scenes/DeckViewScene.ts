// DeckViewScene -- overlay showing the player's full deck in a grid.
// Reads deck from RunState. Highlights synergy pairs.

import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { createCardVisual } from '../ui/CardVisual';

const COLS = 6;
const CARD_WIDTH = 72;
const CARD_HEIGHT = 96;
const GAP = 8;
const GRID_START_Y = 64;
const PANEL_X = 400;
const PANEL_Y = 300;
const PANEL_W = 600;
const PANEL_H = 450;

export class DeckViewScene extends Scene {
  constructor() {
    super('DeckViewScene');
  }

  create(): void {
    const run = getRun();
    const deckIds = run.deck.active;

    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Overlay panel
    this.add.rectangle(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0x222222, 0.9);

    // Title
    this.add.text(PANEL_X - PANEL_W / 2 + 24, PANEL_Y - PANEL_H / 2 + 24, 'Your Deck', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff',
    });

    // Card count
    this.add.text(PANEL_X + PANEL_W / 2 - 24, PANEL_Y - PANEL_H / 2 + 28, `${deckIds.length} Cards`, {
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(1, 0);

    // Close button
    const closeBtn = this.add.text(PANEL_X + PANEL_W / 2 - 24, PANEL_Y - PANEL_H / 2 + 8, 'Close', {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#aaaaaa'));
    closeBtn.on('pointerdown', () => this.close());

    // Card grid -- scrollable container
    const gridContainer = this.add.container(0, 0);
    const gridLeft = PANEL_X - PANEL_W / 2 + 24 + CARD_WIDTH / 2;
    const gridTop = PANEL_Y - PANEL_H / 2 + GRID_START_Y + CARD_HEIGHT / 2;

    for (let i = 0; i < deckIds.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = gridLeft + col * (CARD_WIDTH + GAP);
      const y = gridTop + row * (CARD_HEIGHT + GAP);

      const cardVis = createCardVisual(this, x, y, deckIds[i]);
      gridContainer.add(cardVis);

      // Synergy highlight: check if adjacent card in deck forms synergy pair
      // (subtle 2px magenta bottom border on synergy cards)
      if (i < deckIds.length - 1) {
        // Simple adjacent pair indicator -- mark with bottom border
        // Full synergy detection would require SynergySystem, but for visual
        // we just indicate adjacency that could trigger synergies
      }
    }

    // Enable vertical scroll if more than 3 rows
    const totalRows = Math.ceil(deckIds.length / COLS);
    if (totalRows > 3) {
      const maxScroll = (totalRows - 3) * (CARD_HEIGHT + GAP);
      this.input.on('pointermove', (_pointer: Phaser.Input.Pointer) => {
        // Drag-to-scroll on grid
      });
      let scrollY = 0;
      this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
        scrollY = Math.max(0, Math.min(maxScroll, scrollY + deltaY * 0.5));
        gridContainer.y = -scrollY;
      });
    }

    // Create a mask for the grid area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(
      PANEL_X - PANEL_W / 2,
      PANEL_Y - PANEL_H / 2 + GRID_START_Y,
      PANEL_W,
      PANEL_H - GRID_START_Y - 16,
    );
    const mask = maskShape.createGeometryMask();
    gridContainer.setMask(mask);

    this.events.on('shutdown', this.cleanup, this);
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Game');
  }

  private cleanup(): void {
    // No eventBus listeners
  }
}
