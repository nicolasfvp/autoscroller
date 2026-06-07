// ShopRemoveCardScene -- full-screen deck card removal flow.
//
// Layout mirrors DeckCustomizationScene so the player sees the same view of
// their deck they're used to (5×N grid, responsive scale). Click any card
// to open a confirmation overlay; confirming deducts gold via
// ShopSystem.removeCard and returns to the parent shop.

import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { ShopSystem, MIN_DECK_SIZE } from '../systems/ShopSystem';
import { AudioManager } from '../systems/AudioManager';
import { FONTS, LAYOUT, COLORS } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';
import { createCardVisual, STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from '../ui/CardVisual';
import { disableCardFaceInput } from '../ui/CardFace';

const HEADER_BOTTOM = 44;
const DECK_TOP = 56;
const DECK_BOTTOM = 560;
const HINT_Y = 585;

const COLS = 5;
const COL_GAP = 16;
const TIER_BREAKPOINTS = [
  { upTo: 5,  scale: 0.85, rowGap: 18 },
  { upTo: 10, scale: 0.65, rowGap: 20 },
  { upTo: 15, scale: 0.52, rowGap: 22 },
] as const;

const CHROME = {
  bgTint: 0x0e0c0a,
  panelStroke: 0x6b5a3a,
} as const;

export class ShopRemoveCardScene extends Scene {
  private deckOrder: string[] = [];
  private cardSlots: Phaser.GameObjects.Container[] = [];
  private parentScene: string = SCENE_KEYS.SHOP;
  private cost: number = 0;
  private confirmOverlay?: Phaser.GameObjects.Container;
  private cardScale: number = TIER_BREAKPOINTS[0].scale;
  private cardW: number = STANDARD_CARD_WIDTH * TIER_BREAKPOINTS[0].scale;
  private cardH: number = STANDARD_CARD_HEIGHT * TIER_BREAKPOINTS[0].scale;
  private rowGap: number = TIER_BREAKPOINTS[0].rowGap;

  constructor() {
    super('ShopRemoveCardScene');
  }

  create(data?: { parentScene?: string }): void {
    this.scene.bringToTop();
    this.parentScene = data?.parentScene ?? SCENE_KEYS.SHOP;

    const run = getRun();
    this.deckOrder = [...run.deck.active];
    this.cost = ShopSystem.getRemoveCardCost(run.economy.removalsThisShop ?? 0);
    this.cardSlots = [];
    this.confirmOverlay = undefined;

    this.buildBackground();
    this.buildHeader();
    this.buildDeckGrid();
    this.buildHint();

    this.events.on('shutdown', this.cleanup, this);
  }

  // ── Chrome ──────────────────────────────────────────────────────────────
  private buildBackground(): void {
    this.cameras.main.setBackgroundColor(CHROME.bgTint);
    const bgKey = this.textures.exists('bg_deck_editor_v2')
      ? 'bg_deck_editor_v2'
      : (this.textures.exists('bg_deck_builder') ? 'bg_deck_builder' : null);
    if (bgKey) {
      const bg = this.add.image(LAYOUT.centerX, LAYOUT.centerY, bgKey);
      bg.setDisplaySize(LAYOUT.canvasWidth, LAYOUT.canvasHeight);
      bg.setAlpha(0.78);
      bg.setDepth(-10);
    }
    this.add.rectangle(
      LAYOUT.centerX, LAYOUT.centerY,
      LAYOUT.canvasWidth, LAYOUT.canvasHeight,
      0x000000, 0.34,
    ).setDepth(-9);
  }

  private buildHeader(): void {
    this.add.rectangle(LAYOUT.centerX, HEADER_BOTTOM / 2, LAYOUT.canvasWidth, HEADER_BOTTOM, 0x14100c, 0.86)
      .setStrokeStyle(1, CHROME.panelStroke);

    this.add.text(LAYOUT.centerX, HEADER_BOTTOM / 2, 'REMOVE A CARD', {
      fontSize: '22px', fontStyle: 'bold', color: COLORS.accent,
      fontFamily: FONTS.body, stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true);

    const cancelImg = this.add.image(0, 0, 'btn_cancel_remove').setScale(110 / 1821);
    const cancelCont = this.add.container(70, HEADER_BOTTOM / 2, [cancelImg])
      .setSize(110, 52).setInteractive({ useHandCursor: true });
    cancelCont.on('pointerover', () => this.tweens.add({ targets: cancelCont, scale: 1.05, duration: 100 }));
    cancelCont.on('pointerout',  () => this.tweens.add({ targets: cancelCont, scale: 1,    duration: 100 }));
    cancelCont.on('pointerdown', () => this.close());

    this.add.text(740, HEADER_BOTTOM / 2, `Cost: ${this.cost}g`, {
      fontSize: '15px', fontStyle: 'bold', color: '#ffe28a',
      fontFamily: FONTS.body, stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0.5);
  }

  // ── Deck grid (5×N, responsive) ─────────────────────────────────────────
  private rowCount(total: number): number {
    return Math.max(1, Math.ceil(total / COLS));
  }

  private resolveTier(total: number): void {
    const tier = TIER_BREAKPOINTS.find(t => total <= t.upTo) ?? TIER_BREAKPOINTS[TIER_BREAKPOINTS.length - 1];
    this.cardScale = tier.scale;
    this.cardW = STANDARD_CARD_WIDTH * tier.scale;
    this.cardH = STANDARD_CARD_HEIGHT * tier.scale;
    this.rowGap = tier.rowGap;
  }

  private cardsInRow(r: number, total: number): number {
    const lastRow = Math.max(0, Math.ceil(total / COLS) - 1);
    if (total === 0) return 0;
    if (r < lastRow) return COLS;
    const tail = total - r * COLS;
    return Math.max(0, Math.min(COLS, tail));
  }

  private getGridTop(total: number): number {
    const rows = this.rowCount(total);
    const totalH = rows * this.cardH + (rows - 1) * this.rowGap;
    const bandH = DECK_BOTTOM - DECK_TOP;
    return DECK_TOP + (bandH - totalH) / 2;
  }

  private getSlotPos(i: number, total: number): { x: number; y: number } {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const rowN = Math.max(1, this.cardsInRow(r, total));
    const rowW = rowN * this.cardW + (rowN - 1) * COL_GAP;
    const rowLeft = (LAYOUT.canvasWidth - rowW) / 2;
    const x = rowLeft + c * (this.cardW + COL_GAP) + this.cardW / 2;
    const y = this.getGridTop(total) + r * (this.cardH + this.rowGap) + this.cardH / 2;
    return { x, y };
  }

  private buildDeckGrid(): void {
    const total = this.deckOrder.length;
    this.resolveTier(total);

    if (total === 0) {
      this.add.text(LAYOUT.centerX, LAYOUT.centerY, 'Deck is empty.', {
        fontSize: '20px', color: '#998877', fontFamily: FONTS.body,
        fontStyle: 'italic',
      }).setOrigin(0.5);
      return;
    }

    const run = getRun();
    const canAfford = run.economy.gold >= this.cost;
    const minDeck = run.deck.active.length <= MIN_DECK_SIZE;
    const cardsEnabled = canAfford && !minDeck;

    for (let i = 0; i < total; i++) {
      const pos = this.getSlotPos(i, total);
      const cardId = this.deckOrder[i];
      const deckIndex = i;

      const visual = createCardVisual(this, pos.x, pos.y, cardId, { scale: this.cardScale });
      visual.removeAllListeners('pointerdown');
      visual.removeAllListeners('pointerover');
      visual.removeAllListeners('pointerout');

      if (!cardsEnabled) {
        visual.setAlpha(0.55);
      } else {
        visual.on('pointerover', () => {
          this.tweens.add({ targets: visual, scale: 1.08, duration: 120, ease: 'Cubic.easeOut' });
        });
        visual.on('pointerout', () => {
          this.tweens.add({ targets: visual, scale: 1, duration: 120, ease: 'Cubic.easeOut' });
        });
        visual.on('pointerdown', () => this.openConfirm(cardId, deckIndex));
      }

      this.cardSlots.push(visual);
    }
  }

  private buildHint(): void {
    const run = getRun();
    const canAfford = run.economy.gold >= this.cost;
    const minDeck = run.deck.active.length <= MIN_DECK_SIZE;
    let msg: string;
    if (minDeck) {
      msg = 'Deck is at the minimum size — cannot remove any more cards.';
    } else if (!canAfford) {
      msg = `You need ${this.cost}g to remove a card.`;
    } else {
      msg = `Click a card to choose it, then confirm to banish it for ${this.cost}g.`;
    }
    this.add.text(LAYOUT.centerX, HINT_Y, msg, {
      fontSize: '12px', color: '#bba98a', fontFamily: FONTS.body,
      fontStyle: 'italic',
    }).setOrigin(0.5);
  }

  // ── Confirmation overlay ───────────────────────────────────────────────
  private openConfirm(cardId: string, deckIndex: number): void {
    if (this.confirmOverlay) this.confirmOverlay.destroy(true);
    const overlay = this.add.container(0, 0).setDepth(800);

    overlay.add(this.add.rectangle(
      LAYOUT.centerX, LAYOUT.centerY,
      LAYOUT.canvasWidth, LAYOUT.canvasHeight,
      0x000000, 0.82,
    ));

    // Gothic banish frame — twisted iron spires, blood-wax seals at the
    // corners, ember glow, smoke wisping at the bottom. Asset is pre-alpha
    // baked (no SCREEN needed). Sized to fully contain the title + card
    // preview + price + buttons block.
    if (this.textures.exists('banish_confirm_panel')) {
      overlay.add(
        this.add.image(LAYOUT.centerX, LAYOUT.centerY, 'banish_confirm_panel')
          .setDisplaySize(460, 560),
      );
    }

    overlay.add(this.add.text(LAYOUT.centerX, 100, 'BANISH THIS CARD?', {
      fontSize: '24px', fontStyle: 'bold', color: '#ffd0c0',
      fontFamily: FONTS.body, stroke: '#1a0500', strokeThickness: 5,
    }).setOrigin(0.5).setShadow(2, 2, '#000', 4, true, true));

    const preview = createCardVisual(this, LAYOUT.centerX, 280, cardId, { scale: 1.0 });
    disableCardFaceInput(preview);
    overlay.add(preview);

    overlay.add(this.add.text(LAYOUT.centerX, 420, `−${this.cost} gold`, {
      fontSize: '20px', fontStyle: 'bold', color: '#ff8866',
      fontFamily: FONTS.body, stroke: '#1a0500', strokeThickness: 4,
    }).setOrigin(0.5).setShadow(1, 1, '#000', 3, true, true));

    const banishImg = this.add.image(0, 0, 'btn_banish_remove').setScale(140 / 2103);
    const banishCont = this.add.container(LAYOUT.centerX - 80, 490, [banishImg])
      .setSize(140, 50).setInteractive({ useHandCursor: true });
    banishCont.on('pointerover', () => this.tweens.add({ targets: banishCont, scale: 1.05, duration: 100 }));
    banishCont.on('pointerout',  () => this.tweens.add({ targets: banishCont, scale: 1,    duration: 100 }));
    banishCont.on('pointerdown', () => {
      const run = getRun();
      const current = run.economy.removalsThisShop ?? 0;
      if (ShopSystem.removeCard(run, deckIndex, current)) {
        run.economy.removalsThisShop = current + 1;
        AudioManager.playSFX(this, 'sfx_cashing', 0.6);
      }
      overlay.destroy(true);
      this.confirmOverlay = undefined;
      this.close();
    });
    overlay.add(banishCont);

    const keepImg = this.add.image(0, 0, 'btn_keep_remove').setScale(140 / 1774);
    const keepCont = this.add.container(LAYOUT.centerX + 80, 490, [keepImg])
      .setSize(140, 70).setInteractive({ useHandCursor: true });
    keepCont.on('pointerover', () => this.tweens.add({ targets: keepCont, scale: 1.05, duration: 100 }));
    keepCont.on('pointerout',  () => this.tweens.add({ targets: keepCont, scale: 1,    duration: 100 }));
    keepCont.on('pointerdown', () => {
      overlay.destroy(true);
      this.confirmOverlay = undefined;
    });
    overlay.add(keepCont);

    this.confirmOverlay = overlay;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────
  private close(): void {
    const parent = this.parentScene;
    const isSleeping = this.scene.isSleeping(parent);
    this.scene.stop();
    if (isSleeping) this.scene.wake(parent);
    else this.scene.resume(parent);
  }

  private cleanup(): void {
    for (const s of this.cardSlots) s.destroy(true);
    this.cardSlots = [];
    if (this.confirmOverlay) {
      this.confirmOverlay.destroy(true);
      this.confirmOverlay = undefined;
    }
  }
}
