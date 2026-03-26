// ShopDeckEditor -- shop deck management overlay.
// Supports drag-and-drop reorder and card removal with gold costs.

import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { removeCard, reorderDeck, getRemovalCost, REORDER_SESSION_COST } from '../systems/deck/DeckSystem';
import { getCardById } from '../data/DataLoader';
import { DragDropDeckEditor } from '../ui/DragDropDeckEditor';

const PANEL_X = 400;
const PANEL_Y = 300;
const PANEL_W = 640;
const PANEL_H = 460;

export class ShopDeckEditor extends Scene {
  private deckEditor: DragDropDeckEditor | null = null;
  private reorderActive = false;
  private reorderPaid = false;
  private pendingOrder: string[] = [];

  // UI elements that need updating
  private goldText: Phaser.GameObjects.Text | null = null;
  private actionBtn: Phaser.GameObjects.Text | null = null;
  private statusLabel: Phaser.GameObjects.Text | null = null;
  private confirmOverlay: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('ShopDeckEditor');
  }

  create(): void {
    this.reorderActive = false;
    this.reorderPaid = false;
    this.pendingOrder = [];

    const run = getRun();

    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Overlay panel
    this.add.rectangle(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0x222222, 0.9);

    // Title
    this.add.text(PANEL_X - PANEL_W / 2 + 24, PANEL_Y - PANEL_H / 2 + 24, 'Reorder Deck', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff',
    });

    // Gold display (top-right)
    this.goldText = this.add.text(PANEL_X + PANEL_W / 2 - 24, PANEL_Y - PANEL_H / 2 + 28, `Gold: ${run.economy.gold}`, {
      fontSize: '14px',
      color: '#ffd700',
    }).setOrigin(1, 0);

    // Close button
    const closeBtn = this.add.text(PANEL_X + PANEL_W / 2 - 24, PANEL_Y - PANEL_H / 2 + 8, 'Close', {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#aaaaaa'));
    closeBtn.on('pointerdown', () => this.close());

    // Status label (shows "Drag cards to reorder." when active)
    this.statusLabel = this.add.text(PANEL_X, PANEL_Y - PANEL_H / 2 + 60, '', {
      fontSize: '16px',
      color: '#ffd700',
    }).setOrigin(0.5);

    // Create DragDropDeckEditor
    const editorX = PANEL_X - PANEL_W / 2 + 30;
    const editorY = PANEL_Y - PANEL_H / 2 + 80;
    this.pendingOrder = [...run.deck.active];

    this.deckEditor = new DragDropDeckEditor(
      this,
      editorX,
      editorY,
      run.deck.active,
      (newOrder) => {
        this.pendingOrder = newOrder;
      },
    );

    // Reorder button
    this.actionBtn = this.add.text(PANEL_X, PANEL_Y + PANEL_H / 2 - 40, `Start Reorder (${REORDER_SESSION_COST} Gold)`, {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.actionBtn.on('pointerover', () => this.actionBtn?.setColor('#ffffff'));
    this.actionBtn.on('pointerout', () => this.actionBtn?.setColor('#ffd700'));
    this.actionBtn.on('pointerdown', () => this.handleActionButton());

    // Add remove buttons for each card
    this.createRemoveButtons(editorX, editorY);

    this.events.on('shutdown', this.cleanup, this);
  }

  private createRemoveButtons(editorX: number, editorY: number): void {
    const run = getRun();
    const cost = getRemovalCost(run);

    for (let i = 0; i < run.deck.active.length; i++) {
      const cardId = run.deck.active[i];
      const y = editorY + i * 52; // ITEM_HEIGHT(48) + GAP(4)

      const removeBtn = this.add.text(editorX + 580 - 8, y, `Remove (${cost} Gold)`, {
        fontSize: '14px',
        color: '#ff0000',
      }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

      removeBtn.on('pointerover', () => removeBtn.setColor('#ff6666'));
      removeBtn.on('pointerout', () => removeBtn.setColor('#ff0000'));
      removeBtn.on('pointerdown', () => this.showRemoveConfirmation(cardId, cost));
    }
  }

  private handleActionButton(): void {
    const run = getRun();

    if (!this.reorderActive) {
      // Start reorder mode
      if (run.economy.gold < REORDER_SESSION_COST) {
        this.showFlashMessage('Not enough gold.');
        return;
      }
      this.reorderActive = true;
      this.reorderPaid = true;
      if (this.deckEditor) this.deckEditor.setDragEnabled(true);
      if (this.statusLabel) this.statusLabel.setText('Drag cards to reorder.');
      if (this.actionBtn) this.actionBtn.setText('Done Reordering');
    } else {
      // Finalize reorder
      if (this.reorderPaid) {
        reorderDeck(this.pendingOrder, run);
        this.updateGold();
      }
      this.reorderActive = false;
      if (this.deckEditor) this.deckEditor.setDragEnabled(false);
      if (this.statusLabel) this.statusLabel.setText('');
      if (this.actionBtn) this.actionBtn.setText(`Start Reorder (${REORDER_SESSION_COST} Gold)`);
    }
  }

  private showRemoveConfirmation(cardId: string, cost: number): void {
    const run = getRun();
    if (run.economy.gold < cost) {
      this.showFlashMessage('Not enough gold.');
      return;
    }

    const card = getCardById(cardId);
    const cardName = card?.name ?? cardId;

    // Confirmation overlay
    this.confirmOverlay = this.add.container(PANEL_X, PANEL_Y);
    this.confirmOverlay.setDepth(500);

    const bg = this.add.rectangle(0, 0, 300, 160, 0x333333, 0.95);
    this.confirmOverlay.add(bg);

    const msg = this.add.text(0, -30, `Remove ${cardName}? This costs ${cost} gold and cannot be undone.`, {
      fontSize: '16px',
      color: '#ffffff',
      wordWrap: { width: 260 },
      align: 'center',
    }).setOrigin(0.5);
    this.confirmOverlay.add(msg);

    // "Yes, Remove" button
    const yesBtn = this.add.text(-60, 40, 'Yes, Remove', {
      fontSize: '14px',
      color: '#ff0000',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    yesBtn.on('pointerdown', () => {
      removeCard(cardId, run);
      this.updateGold();
      this.destroyConfirmOverlay();
      // Refresh the scene
      this.scene.restart();
    });
    this.confirmOverlay.add(yesBtn);

    // "Keep Card" button
    const noBtn = this.add.text(60, 40, 'Keep Card', {
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    noBtn.on('pointerdown', () => {
      this.destroyConfirmOverlay();
    });
    this.confirmOverlay.add(noBtn);
  }

  private destroyConfirmOverlay(): void {
    if (this.confirmOverlay) {
      this.confirmOverlay.destroy(true);
      this.confirmOverlay = null;
    }
  }

  private showFlashMessage(msg: string): void {
    const flash = this.add.text(PANEL_X, PANEL_Y + PANEL_H / 2 - 70, msg, {
      fontSize: '16px',
      color: '#ff0000',
    }).setOrigin(0.5).setDepth(300);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 800,
      onComplete: () => flash.destroy(),
    });
  }

  private updateGold(): void {
    const run = getRun();
    if (this.goldText) this.goldText.setText(`Gold: ${run.economy.gold}`);
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Game');
  }

  private cleanup(): void {
    if (this.deckEditor) {
      this.deckEditor.destroy();
      this.deckEditor = null;
    }
    this.destroyConfirmOverlay();
    this.goldText = null;
    this.actionBtn = null;
    this.statusLabel = null;
  }
}
