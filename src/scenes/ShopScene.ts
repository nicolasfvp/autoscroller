import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { resolvedMaxHP } from '../systems/hero/HeroStatsResolver';
import { ShopSystem, MIN_DECK_SIZE, type ShopRelic } from '../systems/ShopSystem';
import { getRelicById, getCardById } from '../data/DataLoader';
import { relicSynergizesWithDeck } from '../systems/cards/SynergyDetection';
import type { CardDefinition } from '../data/types';
import { FONTS } from '../ui/StyleConstants';
import { AudioManager } from '../systems/AudioManager';
import { SCENE_KEYS } from '../state/SceneKeys';
import {
  ELEMENTS,
  ALL_ELEMENT_IDS,
  resolveIconKey,
  type ElementId,
} from '../systems/ElementSystem';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';
import { TutorialOverlay } from '../ui/TutorialOverlay';

const ELEMENT_SELL_PRICE = 25;
const ELEMENT_BUY_PRICE  = 50;

const FF   = FONTS.family;
const GOLD = '#ffd700';
const WHITE = '#ffffff';
const DIM  = '#998877';
const RED  = '#ff6655';

// ── Layout ────────────────────────────────────────────────────────────────────
// Asset natural sizes (px):
//   big_panel.png       956×990   → setScale(0.4934) → displayed 472×488
//   shop-section.png    343×105   → setScale(0.5093) → displayed 175×53 per tab
//   asset description   427×585   → setScale(0.6546) → displayed 280×383
//   item_selection.png  806×99    → scale to row width
//   buy-button.png      270×50    → setScale(163/270 = 0.604) → displayed 163×30

const PL = { x: 18,  y: 61, w: 449, h: 474 } as const;  // big_panel at scale 0.4934
const PR = { x: 479, y: 112, w: 280, h: 383 } as const;  // asset description at scale 0.6546

const BORDER     = 0xd4a855;
const PANEL_FILL = 0x080604;

// Tabs: shop-section.png (343×105) at scale 0.5093 → each tab 175×53
// Absolute center X positions per tab (from debug layout)
const TAB_CENTERS_X = [155.5, 335.3] as const;
const TAB_H    = 53;
const LIST_TOP = 145;  // first row top y (from debug layout)

// Rows: item_selection.png (806×99) displayed at row width × ROW_H
const ROW_H = 49;

// Right-panel positions (calibrated via debug layout)
const PR_CX      = 619;
const PR_IMG_CY  = 212;   // icon center
const PR_NAME_Y  = 294;   // item name
const PR_DESC_Y  = 343;   // lore/description
const PR_STATS_Y = 413;   // stats rows (Owned / Value)
const PR_BUY_Y   = 465;   // buy button
const PR_SELL_Y  = 503;   // sell button

// Footer
const FOOTER_Y  = 578;
const REMOVE_CX = 112;
const GOLD_CX   = 585;
const LEAVE_CX  = 730;

// Shard lore descriptions (Dark Souls style)
const SHARD_LORE: Record<string, string> = {
  attack:  'Raw martial focus crystallized in mineral form. Sharpens the edge of every strike dealt.',
  defense: 'Iron-hard essence of resilience. Fortifies armor and dulls the weight of incoming blows.',
  agility: 'A shard of pure swiftness. Quickens every action and turns near-misses into full dodges.',
  counter: 'Retaliation made manifest. Turns the weight of the enemy\'s own strikes back upon them.',
  fire:    'A crystallized essence of pure fire. Seeps into wounds, burning long after the strike.',
  water:   'Distilled tide in solid form. Mends flesh and shields the soul from further harm.',
  air:     'A breath of the high winds frozen in crystal. Multiplies speed beyond mortal limits.',
  earth:   'Stone-solid resolve bound in shard. Crushes foes beneath an immovable weight.',
};

type ShopTab = 'relics' | 'shards';

export class ShopScene extends Scene {
  private parentSceneKey: string = SCENE_KEYS.GAME;
  private cachedRelicRoll?: ShopRelic[];
  /** Tutorial: counts element purchases so 'shop-buy-elements' advances on the 2nd. */
  private tutorialElementsBought = 0;

  private _tab: ShopTab = 'shards';
  private _selectedShardId: ElementId = 'fire';
  private _selectedRelicIdx = 0;

  private _mainLayer!: Phaser.GameObjects.Container;

  constructor() { super(SCENE_KEYS.SHOP); }

  init(data?: { parentScene?: string }): void {
    this.parentSceneKey  = data?.parentScene ?? SCENE_KEYS.GAME;
    this.cachedRelicRoll = undefined;
    // During 'shop-buy-relic' tutorial step start on RELICS tab — the RELICS
    // tab button lives in the left panel which is outside the spotlight rect,
    // so the player would be softlocked if we left them on SHARDS.
    this._tab = tutorialDirector.getCurrentStep()?.id === 'shop-buy-relic' ? 'relics' : 'shards';
    this._selectedShardId = 'fire';
    this._selectedRelicIdx = 0;
    this.tutorialElementsBought = 0;
  }

  create(): void {
    try {
      const run = getRun();
      run.economy.removalsThisShop = 0;
      run.economy.reordersThisShop = 0;
      this.applyLoopEndAutoHeal(run);
      ShopSystem.notifyShopVisited();
      this.scene.bringToTop();

      this.drawBackdrop();
      this.buildAll();

      // Scripted tutorial: spotlight each step's target and let TutorialOverlay
      // block everything else. Per-action gating below (buy relic → buy 2
      // elements → leave) backs this up so off-script clicks inside a spotlight
      // (e.g. selling an element) are also refused.
      const overlay = TutorialOverlay.mountIfActive(this);
      if (overlay) {
        // Both panels: player must select a relic from the left list, then click
        // BUY in the right panel — so the spotlight must cover the full width.
        overlay.setStepRect('shop-buy-relic', {
          x: PL.x, y: PL.y,
          width: PR.x + PR.w - PL.x,
          height: Math.max(PL.y + PL.h, PR.y + PR.h) - PL.y,
        });
        // Both panels: player must select a shard from the list and click BUY.
        overlay.setStepRect('shop-buy-elements', {
          x: PL.x, y: PL.y,
          width: PR.x + PR.w - PL.x,
          height: Math.max(PL.y + PL.h, PR.y + PR.h) - PL.y,
        });
        // Leave Shop button, bottom-right.
        overlay.setStepRect('shop-leave', { x: 654, y: 548, width: 150, height: 44 });
      }

      this.events.on('shutdown', this.cleanup, this);
    } catch (err) {
      console.error('[ShopScene] create error:', err);
      this.close();
    }
  }

  // ── Full rebuild ──────────────────────────────────────────────────────────
  private buildAll(): void {
    // Keep the tab in sync with the tutorial script so the player is never
    // stranded on the wrong tab after a step transition (e.g. finishing
    // shop-buy-relic leaves _tab='relics', but shop-buy-elements needs SHARDS).
    const tStep = this.shopTutorialStep();
    if (tStep === 'shop-buy-relic' && this._tab !== 'relics') this._tab = 'relics';
    if (tStep === 'shop-buy-elements' && this._tab !== 'shards') {
      this._tab = 'shards';
      this._selectedShardId = 'fire';
    }

    this._mainLayer?.destroy(true);
    this._mainLayer = this.add.container(0, 0);

    this.buildHeader();
    this.buildFrame();
    this.buildTabBar();
    this.buildItemList();
    this.buildDetailPanel();
    this.buildFooter();
  }

  // ── Backdrop ──────────────────────────────────────────────────────────────
  private drawBackdrop(): void {
    const bgKey = this.textures.exists('bg_shop_v2') ? 'bg_shop_v2'
      : (this.textures.exists('bg_shop_scene') ? 'bg_shop_scene' : null);
    if (bgKey) {
      this.add.image(400, 300, bgKey).setDisplaySize(800, 600).setDepth(-3);
    } else {
      this.add.rectangle(400, 300, 800, 600, 0x1a0c04).setDepth(-3);
    }
    this.add.rectangle(400, 300, 800, 600, 0x080400, 0.52).setDepth(-2);
  }

  // ── Header ────────────────────────────────────────────────────────────────
  private buildHeader(): void {
    this._mainLayer.add(
      this.add.bitmapText(401, 30, 'game_font_gold', 'THE MERCHANT', 24).setOrigin(0.5)
    );
    this._mainLayer.add(
      this.add.text(401, 53, 'Wares from beyond the loop', {
        fontSize: '11px', fontStyle: 'italic', color: '#c8a86a',
        fontFamily: FF, stroke: '#0a0500', strokeThickness: 3,
      }).setOrigin(0.5)
    );
  }

  // ── Panel frames ──────────────────────────────────────────────────────────
  private buildFrame(): void {
    // Left list panel — big_panel.png (956×990) scale 0.4934, center at (244.6, 317.3)
    if (this.textures.exists('shop_panel_list')) {
      this._mainLayer.add(
        this.add.image(244.6, 317.3, 'shop_panel_list')
          .setScale(0.4934)
      );
    } else {
      const g = this.add.graphics();
      g.fillStyle(PANEL_FILL, 0.96); g.fillRect(PL.x, PL.y, PL.w, PL.h);
      g.lineStyle(2, BORDER, 1);     g.strokeRect(PL.x, PL.y, PL.w, PL.h);
      this._mainLayer.add(g);
    }

    // Right detail panel — asset description.png (427×585) scale 0.6415
    if (this.textures.exists('shop_panel_detail')) {
      this._mainLayer.add(
        this.add.image(PR.x + PR.w / 2, PR.y + PR.h / 2, 'shop_panel_detail')
          .setScale(0.6415)
      );
    } else {
      const g2 = this.add.graphics();
      g2.fillStyle(PANEL_FILL, 0.96); g2.fillRect(PR.x, PR.y, PR.w, PR.h);
      g2.lineStyle(2, BORDER, 1);     g2.strokeRect(PR.x, PR.y, PR.w, PR.h);
      this._mainLayer.add(g2);
    }

    // Horizontal rule below tabs (thin accent line)
    const gl = this.add.graphics();
    gl.lineStyle(1, BORDER, 0.35);
    gl.lineBetween(PL.x + 4, LIST_TOP, PL.x + PL.w - 4, LIST_TOP);
    this._mainLayer.add(gl);
  }

  // ── Tab bar ───────────────────────────────────────────────────────────────
  private buildTabBar(): void {
    const tabW = PL.w / 2;
    (['relics', 'shards'] as ShopTab[]).forEach((id, i) => {
      const active = this._tab === id;
      const tcx    = TAB_CENTERS_X[i];
      const tcy    = PL.y + TAB_H / 2;
      const tx     = tcx - tabW / 2;
      const label  = id === 'relics' ? 'RELICS' : 'SHARDS';

      if (this.textures.exists('shop_tab')) {
        // shop-section.png (343×105) at scale 0.5093
        this._mainLayer.add(
          this.add.image(tcx, tcy, 'shop_tab')
            .setScale(0.5093)
            .setTint(active ? 0xffffff : 0x444444)
            .setAlpha(active ? 1 : 0.75)
        );
      } else {
        const g = this.add.graphics();
        g.fillStyle(active ? 0x1c0f04 : 0x0b0702, 1);
        g.fillRect(tx, PL.y, tabW, TAB_H);
        g.lineStyle(1, active ? BORDER : 0x5a3e18, active ? 0.9 : 0.45);
        g.strokeRect(tx, PL.y, tabW, TAB_H);
        this._mainLayer.add(g);
      }

      this._mainLayer.add(
        this.add.text(tcx, tcy, label, {
          fontSize: '15px', fontStyle: 'bold',
          color: active ? GOLD : '#6a5030',
          fontFamily: FF, stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5)
      );

      if (!active) {
        const zone = this.add.zone(tx, PL.y, tabW, TAB_H)
          .setOrigin(0).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
          this._tab = id;
          if (id === 'shards') this._selectedShardId = 'fire';
          else this._selectedRelicIdx = 0;
          this.buildAll();
        });
        this._mainLayer.add(zone);
      }
    });
  }

  // ── Item list ─────────────────────────────────────────────────────────────
  private buildItemList(): void {
    if (this._tab === 'shards') this.buildShardList();
    else this.buildRelicList();
  }

  private buildShardList(): void {
    const run = getRun();
    const inv  = (run.economy.elements ?? (run.economy.elements = {})) as Record<ElementId, number>;

    ALL_ELEMENT_IDS.forEach((id, i) => {
      const elem       = ELEMENTS[id];
      const owned      = inv[id] ?? 0;
      const isSelected = id === this._selectedShardId;
      const rowY       = LIST_TOP + i * ROW_H;

      if (isSelected && this.textures.exists('shop_row_selected')) {
        // item_selection.png (806×99) — scale uniformly to row height; center on row
        this._mainLayer.add(
          this.add.image(PL.x + PL.w / 2, rowY + ROW_H / 2, 'shop_row_selected')
            .setScale(0.4985)
        );
      } else {
        const g = this.add.graphics();
        if (isSelected) {
          g.fillStyle(0x2c1804, 0.85);
          g.fillRect(PL.x + 2, rowY + 1, PL.w - 4, ROW_H - 2);
          g.lineStyle(1, BORDER, 0.85);
          g.strokeRect(PL.x + 2, rowY + 1, PL.w - 4, ROW_H - 2);
        } else if (i < ALL_ELEMENT_IDS.length - 1) {
          g.lineStyle(1, 0x2a1e12, 0.55);
          g.lineBetween(PL.x + 10, rowY + ROW_H - 1, PL.x + PL.w - 10, rowY + ROW_H - 1);
        }
        this._mainLayer.add(g);
      }

      const iconKey = resolveIconKey(this.textures, id);
      const iconCY  = rowY + ROW_H / 2;
      if (iconKey) {
        this._mainLayer.add(
          this.add.image(PL.x + 50, iconCY, iconKey).setDisplaySize(30, 30)
        );
      }

      this._mainLayer.add(
        this.add.text(PL.x + 67, iconCY, `${elem.name} Shard`, {
          fontSize: '13px', fontStyle: 'bold',
          color: isSelected ? GOLD : WHITE,
          fontFamily: FF, stroke: '#000', strokeThickness: 3,
        }).setOrigin(0, 0.5)
      );

      this._mainLayer.add(
        this.add.text(PL.x + PL.w - 85, iconCY, `x${owned}`, {
          fontSize: '12px',
          color: owned > 0 ? GOLD : DIM,
          fontFamily: FF, stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5)
      );

      const canBuy = run.economy.gold >= ELEMENT_BUY_PRICE;
      this._mainLayer.add(
        this.add.text(PL.x + PL.w - 35, iconCY, `${ELEMENT_BUY_PRICE} G`, {
          fontSize: '12px', fontStyle: 'bold',
          color: canBuy ? '#e8c060' : RED,
          fontFamily: FF, stroke: '#000', strokeThickness: 2,
        }).setOrigin(1, 0.5)
      );

      const zone = this.add.zone(PL.x, rowY, PL.w, ROW_H)
        .setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => { this._selectedShardId = id; this.buildAll(); });
      this._mainLayer.add(zone);
    });

  }

  // ── Tutorial gating ───────────────────────────────────────
  private shopTutorialStep(): string | null {
    if (!tutorialDirector.isActive()) return null;
    return tutorialDirector.getStepForScene(SCENE_KEYS.SHOP)?.id ?? null;
  }

  private tutAllows(action: 'relic' | 'buy-element' | 'sell-element' | 'remove' | 'leave'): boolean {
    const step = this.shopTutorialStep();
    if (step === null) return true;
    switch (action) {
      case 'relic':       return step === 'shop-buy-relic';
      case 'buy-element': return step === 'shop-buy-elements';
      case 'leave':       return step === 'shop-leave';
      case 'sell-element':
      case 'remove':      return false;
    }
  }

  private tutorialRelicRoll(run: ReturnType<typeof getRun>): ShopRelic[] {
    const relicId = 'whetstone_shard';
    const d = getRelicById(relicId);
    if (!d || run.relics.includes(relicId)) {
      return ShopSystem.getShopRelics(run, run.pool.relics);
    }
    return [{ relicId, name: d.name, price: ShopSystem.getRelicPrice('common', 0) }];
  }

  // ── Relics ────────────────────────────────────────────────
  private buildRelicList(): void {
    const run = getRun();
    if (!this.cachedRelicRoll) {
      this.cachedRelicRoll = this.shopTutorialStep() !== null
        ? this.tutorialRelicRoll(run)
        : ShopSystem.getShopRelics(run, run.pool.relics);
    }
    const relics = this.cachedRelicRoll;

    if (relics.length === 0) {
      this._mainLayer.add(
        this.add.text(PL.x + PL.w / 2, LIST_TOP + 110, 'Sold out.', {
          fontSize: '16px', fontStyle: 'italic', color: DIM, fontFamily: FF,
        }).setOrigin(0.5)
      );
      return;
    }

    const deckCards: CardDefinition[] = [];
    for (const id of run.deck.active) {
      const c = getCardById(id);
      if (c) deckCards.push(c);
    }

    relics.forEach((r, i) => {
      const d          = getRelicById(r.relicId);
      const isSelected = i === this._selectedRelicIdx;
      const ok         = run.economy.gold >= r.price;
      const synergizes = ok && !!d?.description && relicSynergizesWithDeck(d.description, deckCards);
      const rowY       = LIST_TOP + i * ROW_H;

      if (isSelected && this.textures.exists('shop_row_selected')) {
        // item_selection.png (806×99) — scale uniformly to row height; center on row
        this._mainLayer.add(
          this.add.image(PL.x + PL.w / 2, rowY + ROW_H / 2, 'shop_row_selected')
            .setScale(0.4985)
        );
      } else {
        const g = this.add.graphics();
        if (isSelected) {
          g.fillStyle(0x2c1804, 0.85);
          g.fillRect(PL.x + 2, rowY + 1, PL.w - 4, ROW_H - 2);
          g.lineStyle(1, BORDER, 0.85);
          g.strokeRect(PL.x + 2, rowY + 1, PL.w - 4, ROW_H - 2);
        } else if (i < relics.length - 1) {
          g.lineStyle(1, 0x2a1e12, 0.55);
          g.lineBetween(PL.x + 10, rowY + ROW_H - 1, PL.x + PL.w - 10, rowY + ROW_H - 1);
        }
        this._mainLayer.add(g);
      }

      const imgKey = `relic_${r.relicId}`;
      const iconCY = rowY + ROW_H / 2;
      if (this.textures.exists(imgKey)) {
        const img = this.add.image(PL.x + 50, iconCY, imgKey).setDisplaySize(30, 30);
        if (!ok) img.setTint(0x555555);
        this._mainLayer.add(img);
      }

      if (synergizes) {
        this._mainLayer.add(
          this.add.text(PL.x + 62, iconCY - 12, '★', {
            fontSize: '9px', color: GOLD,
            fontFamily: FF, stroke: '#000', strokeThickness: 2,
          }).setOrigin(0.5)
        );
      }

      this._mainLayer.add(
        this.add.text(PL.x + 67, iconCY, d?.name ?? r.name, {
          fontSize: '13px', fontStyle: 'bold',
          color: isSelected ? GOLD : (ok ? WHITE : DIM),
          fontFamily: FF, stroke: '#000', strokeThickness: 3,
        }).setOrigin(0, 0.5)
      );

      this._mainLayer.add(
        this.add.text(PL.x + PL.w - 35, iconCY, `${r.price} G`, {
          fontSize: '12px', fontStyle: 'bold',
          color: ok ? '#e8c060' : RED,
          fontFamily: FF, stroke: '#000', strokeThickness: 2,
        }).setOrigin(1, 0.5)
      );

      const zone = this.add.zone(PL.x, rowY, PL.w, ROW_H)
        .setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => { this._selectedRelicIdx = i; this.buildAll(); });
      this._mainLayer.add(zone);
    });
  }

  // ── Detail panel ──────────────────────────────────────────────────────────
  private buildDetailPanel(): void {
    if (this._tab === 'shards') this.buildShardDetail();
    else this.buildRelicDetail();
  }

  private buildShardDetail(): void {
    const run   = getRun();
    const id    = this._selectedShardId;
    const elem  = ELEMENTS[id];
    const inv   = (run.economy.elements ?? {}) as Record<ElementId, number>;
    const owned = inv[id] ?? 0;

    const iconKey = resolveIconKey(this.textures, id);
    if (iconKey) {
      this._mainLayer.add(
        this.add.image(PR_CX, PR_IMG_CY, iconKey).setScale(0.1163)
      );
    }

    this._mainLayer.add(
      this.add.text(PR_CX, PR_NAME_Y, `${elem.name} Shard`.toUpperCase(), {
        fontSize: '15px', fontStyle: 'bold', color: GOLD,
        fontFamily: FF, stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5, 0)
    );

    this._mainLayer.add(
      this.add.text(PR_CX, PR_DESC_Y, SHARD_LORE[id] ?? elem.identity, {
        fontSize: '12px', fontStyle: 'italic', color: '#c8b89a',
        fontFamily: FF, wordWrap: { width: 236 }, align: 'center',
      }).setOrigin(0.5, 0)
    );

    this.addStatRow('Owned', `x${owned}`,           PR_STATS_Y,      owned > 0 ? GOLD : DIM);
    this.addStatRow('Value', `${ELEMENT_BUY_PRICE} G`, PR_STATS_Y + 18, GOLD);

    const canBuy = run.economy.gold >= ELEMENT_BUY_PRICE && this.tutAllows('buy-element');
    const buyBtn = this.makeActionBtn(PR_CX, PR_BUY_Y, '[E]  BUY', canBuy, false, canBuy ? () => {
      run.economy.gold -= ELEMENT_BUY_PRICE;
      (run.economy.elements as any)[id] = owned + 1;
      AudioManager.playSFX(this, 'sfx_cashing', 0.6);
      if (this.shopTutorialStep() === 'shop-buy-elements') {
        this.tutorialElementsBought++;
        if (this.tutorialElementsBought >= 2) {
          tutorialDirector.advanceIfMatches('shop-buy-elements');
        }
      }
      this.buildAll();
    } : undefined);
    this._mainLayer.add(buyBtn);

    if (owned > 0 && this.tutAllows('sell-element')) {
      const sellBtn = this.makeActionBtn(PR_CX, PR_SELL_Y, `SELL  +${ELEMENT_SELL_PRICE} G`, true, true, () => {
        (run.economy.elements as any)[id] = owned - 1;
        run.economy.gold += ELEMENT_SELL_PRICE;
        AudioManager.playSFX(this, 'sfx_cashing', 0.6);
        this.buildAll();
      });
      this._mainLayer.add(sellBtn);
    }
  }

  private buildRelicDetail(): void {
    if (!this.cachedRelicRoll?.length) {
      this._mainLayer.add(
        this.add.text(PR_CX, PR.y + PR.h / 2, 'No relics\navailable', {
          fontSize: '13px', fontStyle: 'italic', color: DIM,
          fontFamily: FF, align: 'center',
        }).setOrigin(0.5)
      );
      return;
    }

    const run = getRun();
    const idx = Math.min(this._selectedRelicIdx, this.cachedRelicRoll.length - 1);
    const r   = this.cachedRelicRoll[idx];
    if (!r) return;
    const d  = getRelicById(r.relicId);
    const ok = run.economy.gold >= r.price;

    const imgKey = `relic_${r.relicId}`;
    if (this.textures.exists(imgKey)) {
      const img = this.add.image(PR_CX, PR_IMG_CY, imgKey).setDisplaySize(110, 110);
      if (!ok) img.setTint(0x666666);
      this._mainLayer.add(img);
    }

    this._mainLayer.add(
      this.add.text(PR_CX, PR_NAME_Y, (d?.name ?? r.name).toUpperCase(), {
        fontSize: '14px', fontStyle: 'bold',
        color: ok ? GOLD : DIM,
        fontFamily: FF, stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5, 0)
    );

    this._mainLayer.add(
      this.add.text(PR_CX, PR_DESC_Y, d?.description ?? '...', {
        fontSize: '12px', fontStyle: 'italic', color: '#c8b89a',
        fontFamily: FF, wordWrap: { width: 236 }, align: 'center',
      }).setOrigin(0.5, 0)
    );

    this.addStatRow('Price', `${r.price} G`, PR_STATS_Y, ok ? GOLD : RED);

    const buyable = ok && this.tutAllows('relic');
    const buyBtn = this.makeActionBtn(PR_CX, PR_BUY_Y, '[E]  BUY', buyable, false, buyable ? () => {
      const run = getRun();
      if (ShopSystem.buyRelic(run, r.relicId, r.price)) {
        this.cachedRelicRoll = (this.cachedRelicRoll ?? []).filter(x => x.relicId !== r.relicId);
        this._selectedRelicIdx = Math.max(0, this._selectedRelicIdx - 1);
        AudioManager.playSFX(this, 'sfx_cashing', 0.6);
        tutorialDirector.advanceIfMatches('shop-buy-relic');
        this.buildAll();
      }
    } : undefined);
    this._mainLayer.add(buyBtn);
  }

  // ── Detail helpers ────────────────────────────────────────────────────────
  private addStatRow(label: string, value: string, y: number, valColor: string): void {
    this._mainLayer.add(
      this.add.text(PR.x + 40, y, label, {
        fontSize: '11px', color: '#886655', fontFamily: FF,
      })
    );
    this._mainLayer.add(
      this.add.text(PR.x + PR.w - 31, y, value, {
        fontSize: '11px', fontStyle: 'bold', color: valColor,
        fontFamily: FF, stroke: '#000', strokeThickness: 2,
      }).setOrigin(1, 0)
    );
  }

  private makeActionBtn(
    cx: number, cy: number,
    label: string, enabled: boolean, isSell: boolean,
    onClick?: () => void,
  ): Phaser.GameObjects.Container {
    const w = 147, h = 27;
    const c = this.add.container(cx, cy);

    const useBuyAsset  = !isSell && this.textures.exists('shop_btn_buy');
    const useSellAsset =  isSell && this.textures.exists('shop_btn_sell');
    if (useBuyAsset) {
      this.addBuyAssetBg(c, w, enabled, onClick);
    } else if (useSellAsset) {
      this.addSellAssetBg(c, w, enabled, onClick);
    } else {
      this.addGraphicsBg(c, w, h, enabled, isSell, onClick);
      c.add(this.add.text(0, 0, label, {
        fontSize: '13px', fontStyle: 'bold',
        color: this.btnTextColor(enabled, isSell),
        fontFamily: FF, stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5));
    }
    return c;
  }

  private addBuyAssetBg(c: Phaser.GameObjects.Container, w: number, enabled: boolean, onClick?: () => void): void {
    const img = this.add.image(0, 0, 'shop_btn_buy').setScale(w / 270);
    if (!enabled) { img.setTint(0x444444); img.setAlpha(0.6); }
    c.add(img);
    if (!enabled) return;
    const bh = Math.round(50 * (w / 270));
    const zone = this.add.zone(0, 0, w, bh).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => img.setTint(0xddaa44));
    zone.on('pointerout',  () => img.clearTint());
    if (onClick) zone.on('pointerdown', onClick);
    c.add(zone);
  }

  private addSellAssetBg(c: Phaser.GameObjects.Container, w: number, enabled: boolean, onClick?: () => void): void {
    const img = this.add.image(0, 0, 'shop_btn_sell').setScale(w / 2103);
    if (!enabled) { img.setTint(0x444444); img.setAlpha(0.6); }
    c.add(img);
    if (!enabled) return;
    const bh = Math.round(466 * (w / 2103));
    const zone = this.add.zone(0, 0, w, bh).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => img.setTint(0xffee88));
    zone.on('pointerout',  () => img.clearTint());
    if (onClick) zone.on('pointerdown', onClick);
    c.add(zone);
  }

  private addGraphicsBg(c: Phaser.GameObjects.Container, w: number, h: number, enabled: boolean, isSell: boolean, onClick?: () => void): void {
    let fillN: number;
    let fillH: number;
    let borderN: number;
    if (isSell) {
      fillN = 0x0d1a07; fillH = 0x162808; borderN = 0x3aaa20;
    } else {
      fillN = enabled ? 0x221208 : 0x0a0806; fillH = 0x3a2010; borderN = enabled ? BORDER : 0x333333;
    }
    const borderA = enabled ? 0.9 : 0.4;
    const g = this.add.graphics();
    const draw = (fill: number) => {
      g.clear();
      g.fillStyle(fill, 1); g.fillRect(-w / 2, -h / 2, w, h);
      g.lineStyle(1, borderN, borderA); g.strokeRect(-w / 2, -h / 2, w, h);
    };
    draw(fillN);
    c.add(g);
    if (!enabled) return;
    const zone = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(fillH));
    zone.on('pointerout',  () => draw(fillN));
    if (onClick) zone.on('pointerdown', onClick);
    c.add(zone);
  }

  private btnTextColor(enabled: boolean, isSell: boolean): string {
    if (isSell) return '#99dd77';
    return enabled ? GOLD : DIM;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  private buildFooter(): void {
    const run = getRun();

    // Remove Card button — seal only, no "REMOVE CARD" text label
    const cost      = ShopSystem.getRemoveCardCost(run.economy.removalsThisShop ?? 0);
    const canRemove = run.economy.gold >= cost && run.deck.active.length > MIN_DECK_SIZE
      && this.tutAllows('remove');
    const rg = this.add.container(REMOVE_CX, FOOTER_Y);
    if (this.textures.exists('shop_remove_seal')) {
      const seal = this.add.image(0, 0, 'shop_remove_seal').setDisplaySize(200, 46);
      if (!canRemove) seal.setTint(0x444444);
      rg.add(seal);
    }
    rg.add(this.add.text(0, 0, canRemove ? `${cost} g`
      : (run.deck.active.length <= MIN_DECK_SIZE ? 'Min deck size' : `Need ${cost} g`), {
      fontSize: '11px', fontStyle: 'italic',
      color: canRemove ? '#e8c98c' : RED,
      fontFamily: FF, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5));
    rg.setInteractive(new Phaser.Geom.Rectangle(-100, -23, 200, 46), Phaser.Geom.Rectangle.Contains);
    if (canRemove) {
      (rg as any).input.cursor = 'pointer';
      rg.on('pointerover', () => this.tweens.add({ targets: rg, scale: 1.05, duration: 120 }));
      rg.on('pointerout',  () => this.tweens.add({ targets: rg, scale: 1,    duration: 120 }));
      rg.on('pointerdown', () => this.launchRemoveScene());
    }
    this._mainLayer.add(rg);

    // Gold panel — shop_gold_panel asset (same dark/gold style as buy-button)
    const GOLD_W = 148;
    const gb = this.add.container(GOLD_CX, FOOTER_Y);
    if (this.textures.exists('shop_gold_panel')) {
      const gp = this.add.image(0, 0, 'shop_gold_panel');
      gp.setScale(GOLD_W / gp.width);
      gb.add(gp);
    }
    gb.add(this.add.image(-GOLD_W / 2 + 18, 0, 'icon_coin').setDisplaySize(18, 18));
    gb.add(this.add.text(0, 0, `${run.economy.gold} g`, {
      fontSize: '14px', fontStyle: 'bold', color: GOLD,
      fontFamily: FF, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5));
    this._mainLayer.add(gb);

    // Leave button — btn_leave asset (scale to ~148×42)
    const LEAVE_W = 148;
    const lb = this.add.container(LEAVE_CX, FOOTER_Y);
    if (this.textures.exists('btn_leave')) {
      const li = this.add.image(0, 0, 'btn_leave');
      li.setScale(LEAVE_W / li.width);
      lb.add(li);
    }
    lb.setInteractive(new Phaser.Geom.Rectangle(-LEAVE_W / 2, -21, LEAVE_W, 42), Phaser.Geom.Rectangle.Contains);
    (lb as any).input.cursor = 'pointer';
    lb.on('pointerover', () => this.tweens.add({ targets: lb, scale: 1.05, duration: 100 }));
    lb.on('pointerout',  () => this.tweens.add({ targets: lb, scale: 1,    duration: 100 }));
    lb.on('pointerdown', () => { if (!this.tutAllows('leave')) return; this.close(); });
    this._mainLayer.add(lb);
  }

  // ── Remove Card sub-scene ─────────────────────────────────────────────────
  private launchRemoveScene(): void {
    this.scene.pause();
    this.scene.launch(SCENE_KEYS.SHOP_REMOVE_CARD, { parentScene: SCENE_KEYS.SHOP });
    this.events.once('resume', () => this.buildAll());
  }

  private applyLoopEndAutoHeal(run: ReturnType<typeof getRun>): void {
    const heartyMeal  = (run.relics ?? []).includes('hearty_meal');
    const pct         = 0.3 * (heartyMeal ? 1.5 : 1.0);
    // Heal a fraction of BASE maxHP but clamp to the LEVELED max so in-run level
    // HP is actually fillable (see resolvedMaxHP).
    run.hero.currentHP = Math.min(run.hero.currentHP + Math.floor(run.hero.maxHP * pct), resolvedMaxHP(run));
    if (heartyMeal) {
      run.hero.currentStamina = Math.min(run.hero.maxStamina, run.hero.currentStamina + 2);
    }
  }

  // ── Close ─────────────────────────────────────────────────────────────────
  private close(): void {
    tutorialDirector.advanceIfMatches('shop-leave');
    const parent = this.parentSceneKey;
    const isSleeping = this.scene.isSleeping(parent);
    this.scene.stop();
    if (isSleeping) this.scene.wake(parent); else this.scene.resume(parent);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  private cleanup(): void {
    if (this._mainLayer) { this._mainLayer.destroy(true); this._mainLayer = null as any; }
  }
}
