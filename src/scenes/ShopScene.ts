import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { ShopSystem } from '../systems/ShopSystem';
import { getRelicById } from '../data/DataLoader';
import { FONTS } from '../ui/StyleConstants';
import { AudioManager } from '../systems/AudioManager';
import { SCENE_KEYS } from '../state/SceneKeys';
import {
  ELEMENTS,
  ALL_ELEMENT_IDS,
  type ElementId,
} from '../systems/ElementSystem';
import { createCardVisual } from '../ui/CardVisual';

const ELEMENT_SELL_PRICE = 25;
const ELEMENT_BUY_PRICE = 50;

// ── Design tokens ────────────────────────────────────────────
const FF    = FONTS.family;
const GOLD  = '#ffd700';
const WHITE = '#ffffff';
const DIM   = '#998877';
const CYAN  = '#66ddff';
const RED   = '#ff6655';

// ── Panel geometry (centered on 800px canvas) ─────────────────
const PANEL_W     = 470;
const PANEL_CX    = 400;
const PANEL_LEFT  = PANEL_CX - PANEL_W / 2;
const PANEL_RIGHT = PANEL_CX + PANEL_W / 2;
const PAD         = 16;

type ShopCategory = 'remove' | 'relics' | 'elements';

const CATEGORIES: { key: ShopCategory; icon: string; label: string; desc: string }[] = [
  { key: 'elements',  icon: '🔮', label: 'Trade Elements', desc: `Sell elements for ${ELEMENT_SELL_PRICE}g, buy for ${ELEMENT_BUY_PRICE}g` },
  { key: 'remove',    icon: '🗑',  label: 'Remove Cards',   desc: 'Thin your deck for consistency' },
  { key: 'relics',    icon: '💎', label: 'Buy Relics',     desc: 'Passive artifacts with powerful effects' },
];

function colX(col: number, cols: number, itemW: number, gapW: number): number {
  const total = cols * itemW + (cols - 1) * gapW;
  const left  = PANEL_LEFT + (PANEL_W - total) / 2;
  return left + col * (itemW + gapW) + itemW / 2;
}

function cardSlot(
  scene: Scene, x: number, y: number, w: number, h: number,
  canAfford: boolean, onBuy: () => void,
): Phaser.GameObjects.Rectangle {
  const fill   = canAfford ? 0x3d2010 : 0x1e1008;
  const border = canAfford ? 0x9a6030 : 0x4a3020;
  const alpha  = canAfford ? 0.92 : 0.5;
  const bg = scene.add.rectangle(x, y, w, h, fill, alpha).setStrokeStyle(1.5, border);
  if (canAfford) {
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x5a3018, 0.98));
    bg.on('pointerout',  () => bg.setFillStyle(fill, alpha));
    bg.on('pointerdown', onBuy);
  }
  return bg;
}

export class ShopScene extends Scene {
  private goldText!: Phaser.GameObjects.Text;
  private tpText!: Phaser.GameObjects.Text;
  private menuContainer!: Phaser.GameObjects.Container;
  private modalContainer!: Phaser.GameObjects.Container;
  /** Scene to wake/resume when the shop closes. Defaults to GameScene. */
  private parentSceneKey: string = SCENE_KEYS.GAME;

  constructor() { super(SCENE_KEYS.SHOP); }

  init(data?: { parentScene?: string }): void {
    this.parentSceneKey = data?.parentScene ?? SCENE_KEYS.GAME;
  }

  create(): void {
    try {
      const run = getRun();
      run.economy.removalsThisShop = 0;
      run.economy.reordersThisShop = 0;

      this.scene.bringToTop();

      // Background fallback dimming
      this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
      if (this.textures.exists('bg_shop_scene')) {
        this.add.image(400, 300, 'bg_shop_scene').setDisplaySize(800, 600).setDepth(-1);
      }

      this.add.rectangle(PANEL_CX, 300, PANEL_W, 600, 0x130800, 0.82);
      this.add.rectangle(PANEL_RIGHT, 300, 3, 600, 0x9a6030, 0.5);

      this.add.rectangle(PANEL_CX, 24, PANEL_W, 48, 0x0a0400, 0.95);
      this.add.rectangle(PANEL_CX, 47, PANEL_W, 2, 0x9a6030, 0.7);

      this.add.text(PANEL_CX, 24, 'SHOP', {
        fontSize: '23px', fontStyle: 'bold', color: GOLD,
        fontFamily: FF, stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true);

      this.add.rectangle(PANEL_RIGHT - 4, 8, 130, 18, 0x3a2008, 0.92).setOrigin(1, 0).setStrokeStyle(1, 0x9a6030);
      this.goldText = this.add.text(PANEL_RIGHT - 8, 9, `♦ ${run.economy.gold} Gold`, {
        fontSize: '12px', fontStyle: 'bold', color: GOLD, fontFamily: FF, stroke: '#000', strokeThickness: 2,
      }).setOrigin(1, 0);

      this.add.rectangle(PANEL_RIGHT - 4, 27, 80, 16, 0x3a2008, 0.92).setOrigin(1, 0).setStrokeStyle(1, 0x9a6030);
      this.tpText = this.add.text(PANEL_RIGHT - 8, 28, `${run.economy.tilePoints} TP`, {
        fontSize: '12px', color: CYAN, fontFamily: FF, stroke: '#000', strokeThickness: 2,
      }).setOrigin(1, 0);

      this.buildMenu();

      const leave = this.add.text(PANEL_CX, 592, 'Leave Shop', {
        fontSize: '21px', fontStyle: 'bold', color: GOLD, fontFamily: FF, stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true }).setShadow(2, 2, '#000', 2, true, true);
      leave.on('pointerover', () => leave.setColor(WHITE));
      leave.on('pointerout',  () => leave.setColor(GOLD));
      leave.on('pointerdown', () => this.close());

      this.events.on('shutdown', this.cleanup, this);
    } catch (err) {
      console.error('[ShopScene] Critical error in create():', err);
      this.close();
    }
  }

  private buildMenu(): void {
    try {
      if (this.menuContainer) this.menuContainer.removeAll(true);
      else this.menuContainer = this.add.container(0, 0);

      const BTN_H  = 74;
      const BTN_W  = PANEL_W - 30;
      const BTN_X  = PANEL_CX;
      const START_Y = 110;
      const GAP    = 8;

      CATEGORIES.forEach((cat, i) => {
        const y = START_Y + i * (BTN_H + GAP) + BTN_H / 2;
        const bg = this.add.rectangle(BTN_X, y, BTN_W, BTN_H, 0x2a1408, 0.88).setStrokeStyle(1.5, 0x7a4820).setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => { bg.setFillStyle(0x4a2810, 0.95); bg.setStrokeStyle(2, 0xffd700); });
        bg.on('pointerout', () => { bg.setFillStyle(0x2a1408, 0.88); bg.setStrokeStyle(1.5, 0x7a4820); });
        bg.on('pointerdown', () => this.openModal(cat.key));

        const icon = this.add.text(PANEL_LEFT + PAD + 14, y, cat.icon, { fontSize: '26px', fontFamily: FF }).setOrigin(0.5);
        const label = this.add.text(PANEL_LEFT + PAD + 36, y - 12, cat.label, { fontSize: '17px', fontStyle: 'bold', color: GOLD, fontFamily: FF, stroke: '#000', strokeThickness: 3 });
        const desc = this.add.text(PANEL_LEFT + PAD + 36, y + 10, cat.desc, { fontSize: '12px', color: DIM, fontFamily: FF });
        const arrow = this.add.text(PANEL_RIGHT - PAD - 6, y, '▶', { fontSize: '16px', color: '#7a4820', fontFamily: FF }).setOrigin(1, 0.5);
        this.menuContainer.add([bg, icon, label, desc, arrow]);
      });

      this.menuContainer.setVisible(true);

      const baseY = START_Y + CATEGORIES.length * (BTN_H + GAP) + 20;
      const deckBtn = this.add.text(PANEL_CX, baseY, 'Open Deck Editor', { fontSize: '13px', fontStyle: 'bold', color: '#aaddff', fontFamily: FF, stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      deckBtn.on('pointerover', () => deckBtn.setColor(WHITE));
      deckBtn.on('pointerout',  () => deckBtn.setColor('#aaddff'));
      deckBtn.on('pointerdown', () => {
        this.scene.pause();
        this.scene.launch(SCENE_KEYS.DECK_CUSTOMIZATION, { parentScene: SCENE_KEYS.SHOP });
        this.events.once('resume', () => this.buildMenu());
      });

      const relicBtn = this.add.text(PANEL_CX, baseY + 25, 'Open Relics', { fontSize: '13px', fontStyle: 'bold', color: '#aaddff', fontFamily: FF, stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      relicBtn.on('pointerover', () => relicBtn.setColor(WHITE));
      relicBtn.on('pointerout',  () => relicBtn.setColor('#aaddff'));
      relicBtn.on('pointerdown', () => {
        this.scene.pause();
        this.scene.launch(SCENE_KEYS.RELIC_VIEWER, { parentScene: SCENE_KEYS.SHOP });
        this.events.once('resume', () => this.buildMenu());
      });
      this.menuContainer.add([deckBtn, relicBtn]);
    } catch (err) { console.error('[ShopScene] buildMenu failed:', err); }
  }

  private openModal(category: ShopCategory): void {
    this.menuContainer.setVisible(false);
    if (this.modalContainer) this.modalContainer.destroy(true);
    this.modalContainer = this.add.container(0, 0);
    this.modalContainer.add(this.add.rectangle(PANEL_CX, 300, PANEL_W, 600, 0x0a0400, 0.96).setStrokeStyle(2, 0x9a6030));

    switch (category) {
      case 'elements': this.modalElements(); break;
      case 'remove': this.modalRemove(); break;
      case 'relics': this.modalRelics(); break;
    }

    const back = this.add.text(PANEL_CX, 574, '← Back to Shop', { fontSize: '16px', fontStyle: 'bold', color: '#aaddff', fontFamily: FF, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setColor(WHITE));
    back.on('pointerout',  () => back.setColor('#aaddff'));
    back.on('pointerdown', () => this.closeModal());
    this.modalContainer.add(back);
  }

  private closeModal(): void {
    if (this.modalContainer) { this.modalContainer.destroy(true); this.modalContainer = null as any; }
    this.menuContainer.setVisible(true);
    this.refreshBalances();
    this.buildMenu();
  }

  private createShopModal<T>(opts: {
    title: string; emptyMessage?: string; items: T[]; cols: number; cellW: number; cellH: number; gap?: number; startY?: number; maxRows?: number;
    canAfford: (item: T, i: number) => boolean; onSelect: (item: T, i: number) => boolean; reopenKey: ShopCategory;
    renderCell: (item: T, i: number, x: number, cy: number, ok: boolean, bg: Phaser.GameObjects.Rectangle) => void;
  }): void {
    const { title, emptyMessage, items, cols, cellW, cellH } = opts;
    const gap = opts.gap ?? 6; const startY = opts.startY ?? 105; const maxRows = opts.maxRows ?? Infinity;
    this.modalTitle(title);
    if (items.length === 0 && emptyMessage) { this.modalEmpty(emptyMessage); return; }
    items.forEach((item, i) => {
      const row = Math.floor(i / cols); if (row >= maxRows) return;
      const x = colX(i % cols, cols, cellW, gap); const cy = startY + row * (cellH + gap) + cellH / 2;
      const ok = opts.canAfford(item, i);
      const bg = cardSlot(this, x, cy, cellW, cellH, ok, () => {
        if (opts.onSelect(item, i)) { AudioManager.playSFX(this, 'sfx_cashing', 0.6); this.closeModal(); this.openModal(opts.reopenKey); }
      });
      this.modalContainer.add(bg); opts.renderCell(item, i, x, cy, ok, bg);
    });
  }

  /**
   * Trade Elements modal — flat per-element rate (no inventory limits, no
   * loop scaling). Sell 1 element for ELEMENT_SELL_PRICE gold, buy 1 element
   * for ELEMENT_BUY_PRICE gold. Eight elements rendered as 4×2 cells.
   */
  private modalElements(): void {
    this.modalTitle(`🔮 Trade Elements (sell ${ELEMENT_SELL_PRICE}g · buy ${ELEMENT_BUY_PRICE}g)`);

    const run = getRun();
    const elementInv = (run.economy.elements ?? (run.economy.elements = {})) as Record<ElementId, number>;

    const startY = 110;
    const cellW = 210;
    const cellH = 84;
    const colGap = 8;
    const rowGap = 8;
    const cols = 2;

    ALL_ELEMENT_IDS.forEach((id, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = colX(col, cols, cellW, colGap);
      const y = startY + row * (cellH + rowGap) + cellH / 2;
      const elem = ELEMENTS[id];
      const elemColor = parseInt(elem.color.replace('#', ''), 16);

      this.modalContainer.add(
        this.add.rectangle(x, y, cellW, cellH, elemColor, 0.18)
          .setStrokeStyle(1.5, elemColor, 0.85),
      );

      this.modalContainer.add(this.add.text(x - cellW / 2 + 10, y - cellH / 2 + 8, elem.name, {
        fontSize: '15px', fontStyle: 'bold', color: WHITE, fontFamily: FF,
      }));

      const owned = elementInv[id] ?? 0;
      const ownedText = this.add.text(x + cellW / 2 - 10, y - cellH / 2 + 8, `x${owned}`, {
        fontSize: '15px', fontStyle: 'bold', color: GOLD, fontFamily: FF,
      }).setOrigin(1, 0);
      this.modalContainer.add(ownedText);

      const canSell = owned > 0;
      const sellBtn = this.add.rectangle(x - cellW / 4, y + 14, cellW / 2 - 14, 30, canSell ? 0x3a5028 : 0x1f1f1f, 0.92)
        .setStrokeStyle(1.5, canSell ? 0x88dd66 : 0x444444);
      const sellLabel = this.add.text(x - cellW / 4, y + 14, `Sell  +${ELEMENT_SELL_PRICE}g`, {
        fontSize: '13px', fontStyle: 'bold', color: canSell ? '#aaffaa' : DIM, fontFamily: FF,
      }).setOrigin(0.5);
      if (canSell) {
        sellBtn.setInteractive({ useHandCursor: true });
        sellBtn.on('pointerover', () => sellBtn.setFillStyle(0x4c6a32, 0.98));
        sellBtn.on('pointerout',  () => sellBtn.setFillStyle(0x3a5028, 0.92));
        sellBtn.on('pointerdown', () => {
          elementInv[id] = (elementInv[id] ?? 0) - 1;
          run.economy.gold += ELEMENT_SELL_PRICE;
          AudioManager.playSFX(this, 'sfx_cashing', 0.6);
          this.closeModal(); this.openModal('elements');
        });
      }
      this.modalContainer.add([sellBtn, sellLabel]);

      const canBuy = run.economy.gold >= ELEMENT_BUY_PRICE;
      const buyBtn = this.add.rectangle(x + cellW / 4, y + 14, cellW / 2 - 14, 30, canBuy ? 0x4a2810 : 0x1f1f1f, 0.92)
        .setStrokeStyle(1.5, canBuy ? 0xffaa44 : 0x444444);
      const buyLabel = this.add.text(x + cellW / 4, y + 14, `Buy  −${ELEMENT_BUY_PRICE}g`, {
        fontSize: '13px', fontStyle: 'bold', color: canBuy ? GOLD : DIM, fontFamily: FF,
      }).setOrigin(0.5);
      if (canBuy) {
        buyBtn.setInteractive({ useHandCursor: true });
        buyBtn.on('pointerover', () => buyBtn.setFillStyle(0x6c3e1a, 0.98));
        buyBtn.on('pointerout',  () => buyBtn.setFillStyle(0x4a2810, 0.92));
        buyBtn.on('pointerdown', () => {
          run.economy.gold -= ELEMENT_BUY_PRICE;
          elementInv[id] = (elementInv[id] ?? 0) + 1;
          AudioManager.playSFX(this, 'sfx_cashing', 0.6);
          this.closeModal(); this.openModal('elements');
        });
      }
      this.modalContainer.add([buyBtn, buyLabel]);
    });
  }

  private modalRemove(): void {
    const run = getRun(); const count = run.economy.removalsThisShop ?? 0; const cost = ShopSystem.getRemoveCardCost(count);
    this.createShopModal({
      title: `🗑 Remove Cards (${cost} Gold)`, items: run.deck.active, cols: 4, cellW: 95, cellH: 140, maxRows: 4, reopenKey: 'remove',
      canAfford: () => run.economy.gold >= cost && run.deck.active.length > 3,
      onSelect: (_, i) => { if (ShopSystem.removeCard(run, i, count)) { run.economy.removalsThisShop = count + 1; return true; } return false; },
      renderCell: (id, _i, x, cy, ok, bg) => {
        if (ok) bg.setStrokeStyle(2, 0xaa3322);
        const v = createCardVisual(this, x, cy - 8, id, { scale: 0.45 });
        v.disableInteractive();
        if (!ok) v.setAlpha(0.5);
        this.modalContainer.add(v);
      }
    });
  }

  private modalRelics(): void {
    const run = getRun(); const relics = ShopSystem.getShopRelics(run, run.pool.relics);
    this.createShopModal({
      title: '💎 Buy Relics', emptyMessage: 'Out of stock.', items: relics, cols: 2, cellW: 202, cellH: 76, reopenKey: 'relics',
      canAfford: (r) => run.economy.gold >= r.price, onSelect: (r) => ShopSystem.buyRelic(run, r.relicId, r.price),
      renderCell: (r, _i, x, cy, ok, bg) => {
        bg.setStrokeStyle(1.5, ok ? 0xbb8800 : 0x4a3020); const d = getRelicById(r.relicId);
        const img = this.add.image(x - 65, cy, `relic_${r.relicId}`).setDisplaySize(48, 48); if (!ok) img.setTint(0x555555);
        const n = this.add.text(x + 15, cy - 20, d?.name ?? r.name, { fontSize: '14px', fontStyle: 'bold', color: ok ? GOLD : DIM, fontFamily: FF, stroke: '#000', strokeThickness: 2 }).setOrigin(0.5);
        const ds = this.add.text(x + 15, cy + 2, d?.description ?? '...', { fontSize: '10px', color: ok ? CYAN : DIM, fontFamily: FF, wordWrap: { width: 126 }, align: 'center' }).setOrigin(0.5);
        const p = this.add.text(x + 15, cy + 24, `${r.price} Gold`, { fontSize: '13px', fontStyle: 'bold', color: ok ? GOLD : RED, fontFamily: FF }).setOrigin(0.5);
        this.modalContainer.add([img, n, ds, p]);
      }
    });
  }

  private modalTitle(text: string): void {
    const bar = this.add.rectangle(PANEL_CX, 60, PANEL_W - 12, 38, 0x3a2008, 0.9).setStrokeStyle(1.5, 0x9a6030);
    const t = this.add.text(PANEL_CX, 60, text, { fontSize: '18px', fontStyle: 'bold', color: GOLD, fontFamily: FF, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setShadow(1, 1, '#000', 2, true, true);
    const div = this.add.rectangle(PANEL_CX, 82, PANEL_W - 12, 1, 0x9a6030, 0.5);
    this.modalContainer.add([bar, t, div]);
  }

  private modalEmpty(msg: string): void {
    const t = this.add.text(PANEL_CX, 280, msg, { fontSize: '15px', color: DIM, fontFamily: FF, align: 'center' }).setOrigin(0.5);
    this.modalContainer.add(t);
  }

  private refreshBalances(): void {
    const run = getRun(); this.goldText.setText(`♦ ${run.economy.gold} Gold`); this.tpText.setText(`${run.economy.tilePoints} TP`);
  }

  private close(): void {
    // Wake/resume whichever scene launched us. PlanningOverlay sleeps before
    // launching the shop; GameScene pauses. Use isSleeping vs. isPaused to
    // pick the right method.
    const parent = this.parentSceneKey;
    const isSleeping = this.scene.isSleeping(parent);
    this.scene.stop();
    if (isSleeping) this.scene.wake(parent); else this.scene.resume(parent);
  }

  private cleanup(): void {
    if (this.menuContainer) {
      this.menuContainer.destroy(true);
      this.menuContainer = null as any;
    }
    if (this.modalContainer) {
      this.modalContainer.destroy(true);
      this.modalContainer = null as any;
    }
  }
}

