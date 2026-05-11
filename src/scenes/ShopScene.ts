import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { ShopSystem } from '../systems/ShopSystem';
import { getCardById, getRelicById } from '../data/DataLoader';
import { FONTS } from '../ui/StyleConstants';
import { AudioManager } from '../systems/AudioManager';
import { SCENE_KEYS } from '../state/SceneKeys';

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

type ShopCategory = 'buyCards' | 'upgrade' | 'remove' | 'relics';

const CATEGORIES: { key: ShopCategory; icon: string; label: string; desc: string }[] = [
  { key: 'buyCards',  icon: '🃏', label: 'Buy Cards',     desc: 'Expand your deck with new cards' },
  { key: 'upgrade',   icon: '⬆',  label: 'Upgrade Cards', desc: 'Power up cards you already own' },
  { key: 'remove',    icon: '🗑',  label: 'Remove Cards',  desc: 'Thin your deck for consistency' },
  { key: 'relics',    icon: '💎', label: 'Buy Relics',    desc: 'Passive artifacts with powerful effects' },
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

  constructor() { super(SCENE_KEYS.SHOP); }

  create(): void {
    console.log('[ShopScene] Creating scene...');
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
      console.log('[ShopScene] Scene created successfully.');
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
      case 'buyCards': this.modalBuyCards(); break;
      case 'upgrade': this.modalUpgrade(); break;
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

  private modalBuyCards(): void {
    const run = getRun(); const cards = ShopSystem.getShopCards(run, run.pool.cards, run.loop.count);
    this.createShopModal({
      title: '🃏 Buy Cards', emptyMessage: 'No cards available.', items: cards, cols: 3, cellW: 110, cellH: 150, reopenKey: 'buyCards',
      canAfford: (c) => run.economy.gold >= c.price, onSelect: (c) => ShopSystem.buyCard(run, c.cardId, c.price),
      renderCell: (c, _i, x, cy, ok) => {
        if (this.textures.exists(`card_${c.cardId}`)) { const img = this.add.image(x, cy - 15, `card_${c.cardId}`).setDisplaySize(100, 105); if (!ok) img.setTint(0x555555); this.modalContainer.add(img); }
        const n = this.add.text(x, cy - 65, c.name, { fontSize: '12px', fontStyle: 'bold', color: ok ? WHITE : DIM, fontFamily: FF, stroke: '#000', strokeThickness: 2, wordWrap: { width: 100 } }).setOrigin(0.5);
        const p = this.add.text(x, cy + 62, `${c.price} Gold`, { fontSize: '13px', fontStyle: 'bold', color: ok ? GOLD : RED, fontFamily: FF }).setOrigin(0.5);
        this.modalContainer.add([n, p]);
      }
    });
  }

  private modalUpgrade(): void {
    const run = getRun(); const items = run.deck.active.map((id, i) => ({ id, i })).filter(x => !run.deck.upgraded[x.i]);
    this.createShopModal({
      title: '⬆ Upgrade Cards', emptyMessage: 'No cards left to upgrade.', items, cols: 3, cellW: 110, cellH: 150, maxRows: 2, reopenKey: 'upgrade',
      canAfford: (x) => run.economy.gold >= ShopSystem.getUpgradePrice(getCardById(x.id)?.rarity ?? 'common'),
      onSelect: (x) => ShopSystem.upgradeCard(run, x.i, getCardById(x.id)?.rarity ?? 'common'),
      renderCell: (x, _i, xPos, cy, ok) => {
        const c = getCardById(x.id); const p = ShopSystem.getUpgradePrice(c?.rarity ?? 'common');
        if (this.textures.exists(`card_${x.id}`)) { const img = this.add.image(xPos, cy - 15, `card_${x.id}`).setDisplaySize(100, 105); if (!ok) img.setTint(0x555555); this.modalContainer.add(img); }
        const n = this.add.text(xPos, cy - 65, c?.name ?? x.id, { fontSize: '12px', fontStyle: 'bold', color: ok ? WHITE : DIM, fontFamily: FF, stroke: '#000', strokeThickness: 2, wordWrap: { width: 100 } }).setOrigin(0.5);
        const s = this.add.text(xPos, cy + 62, `${p} Gold`, { fontSize: '13px', fontStyle: 'bold', color: ok ? GOLD : RED, fontFamily: FF }).setOrigin(0.5);
        this.modalContainer.add([n, s]);
      }
    });
  }

  private modalRemove(): void {
    const run = getRun(); const count = run.economy.removalsThisShop ?? 0; const cost = ShopSystem.getRemoveCardCost(count);
    this.createShopModal({
      title: `🗑 Remove Cards (${cost} Gold)`, items: run.deck.active, cols: 3, cellW: 110, cellH: 150, maxRows: 3, reopenKey: 'remove',
      canAfford: () => run.economy.gold >= cost && run.deck.active.length > 3,
      onSelect: (_, i) => { if (ShopSystem.removeCard(run, i, count)) { run.economy.removalsThisShop = count + 1; return true; } return false; },
      renderCell: (id, _i, x, cy, ok, bg) => {
        if (ok) bg.setStrokeStyle(2, 0xaa3322);
        if (this.textures.exists(`card_${id}`)) { const img = this.add.image(x, cy - 15, `card_${id}`).setDisplaySize(100, 105); if (!ok) img.setTint(0x555555); this.modalContainer.add(img); }
        const n = this.add.text(x, cy - 65, getCardById(id)?.name ?? id, { fontSize: '12px', fontStyle: 'bold', color: ok ? WHITE : DIM, fontFamily: FF, stroke: '#000', strokeThickness: 2, wordWrap: { width: 100 } }).setOrigin(0.5);
        this.modalContainer.add(n);
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
    const gameKey = SCENE_KEYS.GAME; const isSleeping = this.scene.isSleeping(gameKey);
    this.scene.stop();
    if (isSleeping) this.scene.wake(gameKey); else this.scene.resume(gameKey);
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
