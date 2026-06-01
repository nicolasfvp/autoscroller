import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
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
const ELEMENT_BUY_PRICE = 50;

const FF    = FONTS.family;
const GOLD  = '#ffd700';
const WHITE = '#ffffff';
const DIM   = '#998877';
const RED   = '#ff6655';

const CANVAS_W = 800;

// Vertical regions on the 800×600 canvas. Top banner stays, relics under it,
// elements in the middle band, and the bottom bar holds the compact
// Remove-Card seal (left) plus the gold + Leave Shop badges (right).
const BANNER_Y = 50;
const BANNER_W = 640;
const BANNER_H = 140;
const RELIC_TOP = 132;
const ELEMENT_TOP = 295;
// Bottom-left remove-card service tile.
const SERVICE_CX = 175;
const SERVICE_CY = 555;
const SERVICE_W = 300;
const SERVICE_H = 90;
// Bottom-right gold + Leave badges.
const BOTTOM_BAR_Y = 570;
const GOLD_CX = 600;
const LEAVE_CX = 728;

export class ShopScene extends Scene {
  private parentSceneKey: string = SCENE_KEYS.GAME;
  private goldText!: Phaser.GameObjects.Text;
  private mainLayer!: Phaser.GameObjects.Container;
  private tooltipLayer!: Phaser.GameObjects.Container;
  private cachedRelicRoll?: ShopRelic[];
  /** Tutorial: counts element purchases so 'shop-buy-elements' advances on the 2nd. */
  private tutorialElementsBought = 0;

  constructor() { super(SCENE_KEYS.SHOP); }

  init(data?: { parentScene?: string }): void {
    this.parentSceneKey = data?.parentScene ?? SCENE_KEYS.GAME;
    this.cachedRelicRoll = undefined;
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
      this.mainLayer = this.add.container(0, 0);
      this.tooltipLayer = this.add.container(0, 0).setDepth(900);

      this.buildHeader();
      this.buildRelics();
      this.buildElements();
      this.buildServices();
      this.buildLeaveButton();

      // Scripted tutorial: spotlight each step's target and let TutorialOverlay
      // block everything else. Per-action gating below (buy relic → buy 2
      // elements → leave) backs this up so off-script clicks inside a spotlight
      // (e.g. selling an element) are also refused.
      const overlay = TutorialOverlay.mountIfActive(this);
      if (overlay) {
        // Single forced relic renders centred at x≈400, y≈231.
        overlay.setStepRect('shop-buy-relic', { x: 322, y: 142, width: 156, height: 182 });
        // The 8-element row + its buy/sell steppers span the mid band.
        overlay.setStepRect('shop-buy-elements', { x: 40, y: 296, width: 720, height: 184 });
        // Leave Shop button, bottom-right.
        overlay.setStepRect('shop-leave', { x: 654, y: 548, width: 150, height: 44 });
      }

      this.events.on('shutdown', this.cleanup, this);
    } catch (err) {
      console.error('[ShopScene] Critical error in create():', err);
      this.close();
    }
  }

  // ── Backdrop ──────────────────────────────────────────────
  private drawBackdrop(): void {
    const bgKey = this.textures.exists('bg_shop_v2')
      ? 'bg_shop_v2'
      : (this.textures.exists('bg_shop_scene') ? 'bg_shop_scene' : null);
    if (bgKey) {
      this.add.image(400, 300, bgKey).setDisplaySize(800, 600).setDepth(-3);
    } else {
      this.add.rectangle(400, 300, 800, 600, 0x1a0c04, 1).setDepth(-3);
    }
    // Soft atmospheric overlay — dims the bg so foreground items pop.
    this.add.rectangle(400, 300, 800, 600, 0x080400, 0.42).setDepth(-2);
  }

  // ── Header (banner on top, gold badge in bottom-right) ────
  private buildHeader(): void {
    const run = getRun();

    if (this.textures.exists('shop_title_banner')) {
      this.add.image(400, BANNER_Y, 'shop_title_banner')
        .setDisplaySize(BANNER_W, BANNER_H);
    }
    this.add.bitmapText(400, BANNER_Y - 4, 'game_font_gold', 'THE MERCHANT', 28).setOrigin(0.5);
    this.add.text(400, BANNER_Y + 22, 'Wares from beyond the loop', {
      fontSize: '12px', fontStyle: 'italic', color: '#e8c98c',
      fontFamily: FF, stroke: '#1a0500', strokeThickness: 3,
    }).setOrigin(0.5);

    // Gold badge floats in the bottom-right next to the Leave Shop button.
    this.goldText = this.makeCurrencyBadge(GOLD_CX, BOTTOM_BAR_Y, '♦', `${run.economy.gold}g`, GOLD, 0x4a2810);
  }

  /** Small image-backed currency pill. Uses panel_wood_button as a stretched
   *  wooden plaque (no plain css chrome). Returns the value text so callers
   *  can update it later. */
  private makeCurrencyBadge(
    cx: number, cy: number,
    icon: string, value: string, color: string, tint: number,
  ): Phaser.GameObjects.Text {
    const w = 132, h = 34;
    if (this.textures.exists('panel_wood_button')) {
      this.add.image(cx, cy, 'panel_wood_button')
        .setDisplaySize(w * 1.3, h * 1.8)
        .setTint(tint);
    }
    this.add.text(cx - w / 2 + 14, cy, icon, {
      fontSize: '18px', fontStyle: 'bold', color,
      fontFamily: FF, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    return this.add.text(cx + 12, cy, value, {
      fontSize: '15px', fontStyle: 'bold', color,
      fontFamily: FF, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
  }

  // ── Tutorial gating ───────────────────────────────────────
  /** Current scripted-tutorial step targeting the shop, or null (normal play
   *  or any non-shop step). */
  private shopTutorialStep(): string | null {
    if (!tutorialDirector.isActive()) return null;
    return tutorialDirector.getStepForScene(SCENE_KEYS.SHOP)?.id ?? null;
  }

  /**
   * Whether a shop action is permitted right now. Outside the tutorial every
   * action is allowed; during it only the on-script action for the current
   * step is — the sequence is buy a relic → buy 2 elements → leave, and
   * selling / removing cards are never part of it.
   */
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

  /**
   * Tutorial relic offer: a single affordable common relic. Forcing one option
   * keeps the "buy a relic" step unambiguous and guarantees the scripted gold
   * budget (relic 90 + 2 elements 100 + forge 50) balances regardless of the
   * random pool roll. Warrior-tutorial relic; falls back to the normal roll if
   * the data is somehow missing.
   */
  private tutorialRelicRoll(run: ReturnType<typeof getRun>): ShopRelic[] {
    const relicId = 'whetstone_shard';
    const d = getRelicById(relicId);
    if (!d || run.relics.includes(relicId)) {
      return ShopSystem.getShopRelics(run, run.pool.relics);
    }
    return [{ relicId, name: d.name, price: ShopSystem.getRelicPrice('common', 0) }];
  }

  // ── Relics ────────────────────────────────────────────────
  private buildRelics(): void {
    const run = getRun();
    if (!this.cachedRelicRoll) {
      this.cachedRelicRoll = this.shopTutorialStep() !== null
        ? this.tutorialRelicRoll(run)
        : ShopSystem.getShopRelics(run, run.pool.relics);
    }
    const relics = this.cachedRelicRoll;

    // Section sub-title (rendered as scrolled gold text, not a flat bar).
    this.mainLayer.add(this.add.text(400, RELIC_TOP - 4, '✦  Relics for Sale  ✦', {
      fontSize: '15px', fontStyle: 'bold', color: '#ffe55a',
      fontFamily: FF, stroke: '#1a0500', strokeThickness: 4,
    }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true));

    if (relics.length === 0) {
      this.mainLayer.add(this.add.text(400, (RELIC_TOP + ELEMENT_TOP) / 2, 'Sold out.', {
        fontSize: '15px', fontStyle: 'italic', color: DIM, fontFamily: FF,
      }).setOrigin(0.5));
      return;
    }

    // Resolve deck cards once for synergy check.
    const deckCards: CardDefinition[] = [];
    for (const id of run.deck.active) {
      const c = getCardById(id);
      if (c) deckCards.push(c);
    }

    // Frame sizing scales with count so 5–7 relics all fit nicely.
    const count = relics.length;
    const maxW = 720;
    const gap = 12;
    const frameW = Math.min(125, Math.floor((maxW - gap * (count - 1)) / count));
    const frameH = Math.round(frameW * 1.30);
    const totalW = count * frameW + (count - 1) * gap;
    const left = (CANVAS_W - totalW) / 2 + frameW / 2;
    const cy = RELIC_TOP + 18 + frameH / 2;

    relics.forEach((r, i) => {
      const x = left + i * (frameW + gap);
      const d = getRelicById(r.relicId);
      const ok = run.economy.gold >= r.price;
      const synergizes = ok && !!d?.description && relicSynergizesWithDeck(d.description, deckCards);
      this.buildRelicFrame(x, cy, frameW, frameH, r, d, ok, synergizes);
    });
  }

  private buildRelicFrame(
    x: number, y: number, w: number, h: number,
    r: ShopRelic, d: ReturnType<typeof getRelicById>,
    ok: boolean, synergizes: boolean,
  ): void {
    const group = this.add.container(x, y);

    // Frame is displayed at a modest scale-up of the slot. Source has 25%
    // black mat around the visible wood frame; the inner wood inset (where
    // the relic illustration lives) is ~36% × 27% of the displayed image,
    // centered. Only the relic art renders inside the inset — name lives
    // above the frame and price lives below, both anchored by percent of
    // dispH so they reflow when the slot resizes.
    const dispW = w * 1.20;
    const dispH = h * 1.20;

    if (this.textures.exists('shop_item_frame')) {
      const frame = this.add.image(0, 0, 'shop_item_frame')
        .setDisplaySize(dispW, dispH);
      if (!ok) frame.setTint(0x555555);
      group.add(frame);
    }

    // Relic illustration — centered inside the wood inset.
    const imgSize = Math.round(dispH * 0.26);
    const imgKey = `relic_${r.relicId}`;
    if (this.textures.exists(imgKey)) {
      const im = this.add.image(0, 0, imgKey).setDisplaySize(imgSize, imgSize);
      if (!ok) im.setTint(0x444444);
      group.add(im);
    } else {
      group.add(this.add.text(0, 0, '◆', {
        fontSize: `${imgSize}px`, color: ok ? GOLD : DIM, fontFamily: FF,
      }).setOrigin(0.5));
    }

    // Name hugging the top edge of the visible wood inset (outside it).
    const name = this.add.text(0, -dispH * 0.24, d?.name ?? r.name, {
      fontSize: '11px', fontStyle: 'bold',
      color: ok ? GOLD : DIM, fontFamily: FF,
      stroke: '#000', strokeThickness: 3,
      wordWrap: { width: dispW * 0.95 }, align: 'center',
    }).setOrigin(0.5);
    group.add(name);

    // Gold price hugging the bottom edge of the visible wood inset.
    const priceText = this.add.text(0, dispH * 0.26, `${r.price} g`, {
      fontSize: '13px', fontStyle: 'bold',
      color: ok ? '#ffe55a' : RED, fontFamily: FF,
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setShadow(1, 1, '#000', 2, true, true);
    group.add(priceText);

    // Synergy badge — small glowing star pinned to top-right of visible frame.
    if (synergizes) {
      const star = this.add.text(dispW * 0.22, -dispH * 0.18, '★', {
        fontSize: '18px', fontStyle: 'bold', color: '#ffd700',
        fontFamily: FF, stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      this.tweens.add({
        targets: star, scale: { from: 0.85, to: 1.15 },
        yoyo: true, repeat: -1, duration: 800, ease: 'Sine.easeInOut',
      });
      group.add(star);
    }

    // Tutorial gate: during the shop steps a relic may only be bought on the
    // 'shop-buy-relic' step. Affordability (`ok`) still drives the visuals.
    const buyable = ok && this.tutAllows('relic');

    // Hit area = the full vertical extent so name + frame + price are clickable.
    const hit = new Phaser.Geom.Rectangle(-dispW * 0.45, -dispH * 0.42, dispW * 0.90, dispH * 0.84);
    group.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    if (buyable) (group as any).input.cursor = 'pointer';

    const baseScale = 1;
    group.on('pointerover', () => {
      this.showRelicTooltip(x, y - dispH * 0.25, r, d, ok);
      if (buyable) {
        this.tweens.add({ targets: group, scale: 1.06, duration: 140, ease: 'Cubic.easeOut' });
      }
    });
    group.on('pointerout', () => {
      this.hideTooltip();
      this.tweens.add({ targets: group, scale: baseScale, duration: 140, ease: 'Cubic.easeOut' });
    });
    if (buyable) {
      group.on('pointerdown', () => {
        const run = getRun();
        if (ShopSystem.buyRelic(run, r.relicId, r.price)) {
          this.cachedRelicRoll = (this.cachedRelicRoll ?? []).filter(x => x.relicId !== r.relicId);
          AudioManager.playSFX(this, 'sfx_cashing', 0.6);
          // Tutorial: relic bought → advance to the buy-elements step.
          tutorialDirector.advanceIfMatches('shop-buy-relic');
          this.refreshAll();
        }
      });
    }

    this.mainLayer.add(group);
  }

  // ── Elements ──────────────────────────────────────────────
  private buildElements(): void {
    const run = getRun();
    const inv = (run.economy.elements ?? (run.economy.elements = {})) as Record<ElementId, number>;

    this.mainLayer.add(this.add.text(400, ELEMENT_TOP - 2, `✦  Elemental Essences  ✦  (sell ${ELEMENT_SELL_PRICE}g · buy ${ELEMENT_BUY_PRICE}g)`, {
      fontSize: '14px', fontStyle: 'bold', color: '#ffe55a',
      fontFamily: FF, stroke: '#1a0500', strokeThickness: 4,
    }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true));

    const count = ALL_ELEMENT_IDS.length;
    const maxW = 770;
    const gap = 4;
    const frameW = Math.floor((maxW - gap * (count - 1)) / count);
    // Taller, more substantial element tiles now that the header is gone.
    const frameH = Math.round(frameW * 1.55);
    const totalW = count * frameW + (count - 1) * gap;
    const left = (CANVAS_W - totalW) / 2 + frameW / 2;
    const cy = ELEMENT_TOP + 18 + frameH / 2;

    ALL_ELEMENT_IDS.forEach((id, i) => {
      const x = left + i * (frameW + gap);
      this.buildElementFrame(x, cy, frameW, frameH, id, inv);
    });
  }

  private buildElementFrame(
    x: number, y: number, w: number, h: number,
    id: ElementId, inv: Record<ElementId, number>,
  ): void {
    const run = getRun();
    const elem = ELEMENTS[id];
    const owned = inv[id] ?? 0;

    const group = this.add.container(x, y);
    const dispW = w * 1.20;
    const dispH = h * 1.20;

    if (this.textures.exists('shop_item_frame')) {
      const frame = this.add.image(0, 0, 'shop_item_frame')
        .setDisplaySize(dispW, dispH);
      group.add(frame);
    }

    // Element name hugging the top edge of the visible wood inset.
    group.add(this.add.text(0, -dispH * 0.26, elem.name, {
      fontSize: '12px', fontStyle: 'bold', color: WHITE,
      fontFamily: FF, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));

    // Icon — prefer the painterly v2 token if loaded; fall back to legacy.
    const iconKey = resolveIconKey(this.textures, id);
    const iconSize = Math.round(Math.min(dispW, dispH) * 0.42);
    if (iconKey) {
      group.add(this.add.image(0, 0, iconKey).setDisplaySize(iconSize, iconSize));
    } else {
      group.add(this.add.text(0, 0, '◆', {
        fontSize: `${iconSize}px`, color: elem.color, fontFamily: FF,
      }).setOrigin(0.5));
    }

    // Stepper layout below the frame: [sell] ×count [buy] on a single row.
    // The owned count lives between the two action buttons; each button shows
    // just its gold delta. Sell on the left (decrements count, +gold), Buy on
    // the right (increments count, −gold). No vertical stacking → no overlap.
    const canSell = owned > 0;
    const canBuy = run.economy.gold >= ELEMENT_BUY_PRICE;
    // Tutorial gate: during the scripted shop visit only BUYING is on-script
    // (on the 'shop-buy-elements' step); selling stays disabled throughout.
    const sellEnabled = canSell && this.tutAllows('sell-element');
    const buyEnabled = canBuy && this.tutAllows('buy-element');
    const stepperY = dispH * 0.32;
    const btnW = 30;
    const btnH = 18;
    const btnOffset = Math.min(w / 2 - 2, 32);

    const sellBtn = this.makeMiniButton(-btnOffset, stepperY, btnW, btnH, `+${ELEMENT_SELL_PRICE}g`, sellEnabled, '#aaffaa', 0x2e5a18);
    const buyBtn  = this.makeMiniButton( btnOffset, stepperY, btnW, btnH, `−${ELEMENT_BUY_PRICE}g`,  buyEnabled,  GOLD,       0x6c3e1a);
    group.add([sellBtn.container, buyBtn.container]);

    // Owned count in the middle of the stepper row.
    group.add(this.add.text(0, stepperY, `×${owned}`, {
      fontSize: '13px', fontStyle: 'bold',
      color: owned > 0 ? GOLD : DIM, fontFamily: FF,
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));

    if (sellEnabled) {
      sellBtn.hit.on('pointerdown', () => {
        inv[id] = (inv[id] ?? 0) - 1;
        run.economy.gold += ELEMENT_SELL_PRICE;
        AudioManager.playSFX(this, 'sfx_cashing', 0.6);
        this.refreshAll();
      });
    }
    if (buyEnabled) {
      buyBtn.hit.on('pointerdown', () => {
        run.economy.gold -= ELEMENT_BUY_PRICE;
        inv[id] = (inv[id] ?? 0) + 1;
        AudioManager.playSFX(this, 'sfx_cashing', 0.6);
        // Tutorial: count element purchases; the 2nd advances to the leave step.
        if (this.shopTutorialStep() === 'shop-buy-elements') {
          this.tutorialElementsBought++;
          if (this.tutorialElementsBought >= 2) {
            tutorialDirector.advanceIfMatches('shop-buy-elements');
          }
        }
        this.refreshAll();
      });
    }

    this.mainLayer.add(group);
  }

  /** Small image-textured mini button. Uses bar_wood (or wood_texture) as the
   *  plank surface so we never fall back to plain rects. */
  private makeMiniButton(
    x: number, y: number, w: number, h: number,
    label: string, enabled: boolean, color: string, hoverTint: number,
  ): { container: Phaser.GameObjects.Container; hit: Phaser.GameObjects.Image } {
    const c = this.add.container(x, y);
    const tex = this.textures.exists('bar_wood')
      ? 'bar_wood'
      : (this.textures.exists('wood_texture') ? 'wood_texture' : null);
    // bar_wood has carved gold corners and a slim wood plank in the middle.
    // Display the image slightly larger than the hit footprint so the carved
    // detail reads at small button sizes — small multipliers here so two
    // mini buttons sitting on the same row (the element stepper) don't
    // visually overlap each other or bleed into the count text between them.
    const bgW = w * 1.20;
    const bgH = h * 1.50;
    let bg: Phaser.GameObjects.Image;
    if (tex) {
      bg = this.add.image(0, 0, tex).setDisplaySize(bgW, bgH);
      bg.setTint(enabled ? 0xffffff : 0x666666);
    } else {
      bg = this.add.image(0, 0, '__WHITE').setDisplaySize(bgW, bgH);
      bg.setTint(enabled ? 0x6b3a18 : 0x2a1a10);
    }
    c.add(bg);
    c.add(this.add.text(0, 0, label, {
      fontSize: '10px', fontStyle: 'bold',
      color: enabled ? color : '#666',
      fontFamily: FF, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));
    if (enabled) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setTint(hoverTint));
      bg.on('pointerout', () => bg.setTint(0xffffff));
    }
    return { container: c, hit: bg };
  }

  // ── Services (Remove Card) ────────────────────────────────
  private buildServices(): void {
    const run = getRun();
    const cost = ShopSystem.getRemoveCardCost(run.economy.removalsThisShop ?? 0);
    // Tutorial gate: the remove-card service is never part of the scripted visit.
    const canAfford = run.economy.gold >= cost && run.deck.active.length > MIN_DECK_SIZE
      && this.tutAllows('remove');

    const cx = SERVICE_CX;
    const cy = SERVICE_CY;
    const w = SERVICE_W, h = SERVICE_H;

    const sealGroup = this.add.container(cx, cy);
    if (this.textures.exists('shop_remove_seal')) {
      const seal = this.add.image(0, 0, 'shop_remove_seal')
        .setDisplaySize(w * 1.05, h * 1.25);
      if (!canAfford) seal.setTint(0x666666);
      sealGroup.add(seal);
    }

    sealGroup.add(this.add.text(0, -8, 'REMOVE CARD', {
      fontSize: '15px', fontStyle: 'bold',
      color: canAfford ? GOLD : DIM, fontFamily: FF,
      stroke: '#1a0500', strokeThickness: 4,
    }).setOrigin(0.5).setShadow(2, 2, '#000', 2, true, true));

    sealGroup.add(this.add.text(0, 10, canAfford
        ? `${cost} g`
        : (run.deck.active.length <= MIN_DECK_SIZE ? 'Min deck size' : `Need ${cost} g`),
      {
        fontSize: '11px', fontStyle: 'italic',
        color: canAfford ? '#e8c98c' : RED, fontFamily: FF,
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5));

    const hit = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
    sealGroup.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    if (canAfford) (sealGroup as any).input.cursor = 'pointer';

    sealGroup.on('pointerover', () => {
      if (canAfford) this.tweens.add({ targets: sealGroup, scale: 1.04, duration: 150 });
    });
    sealGroup.on('pointerout', () => {
      this.tweens.add({ targets: sealGroup, scale: 1, duration: 150 });
    });
    if (canAfford) {
      sealGroup.on('pointerdown', () => this.launchRemoveScene());
    }

    this.mainLayer.add(sealGroup);
  }

  // ── Remove flow — launches a dedicated full-screen scene ──
  private launchRemoveScene(): void {
    this.scene.pause();
    this.scene.launch(SCENE_KEYS.SHOP_REMOVE_CARD, { parentScene: SCENE_KEYS.SHOP });
    // When the player returns (Cancel or after a successful Banish), refresh
    // gold, deck-dependent relic synergy hints, and the seal's affordability.
    this.events.once('resume', () => this.refreshAll());
  }

  // ── Tooltip (relic hover) ─────────────────────────────────
  private showRelicTooltip(
    x: number, y: number,
    r: ShopRelic, d: ReturnType<typeof getRelicById>,
    ok: boolean,
  ): void {
    this.hideTooltip();
    const w = 220;
    const padX = 14, padY = 12;
    const desc = d?.description ?? '...';

    // Build text objects first so we can size the background to fit.
    const nameText = this.add.text(0, 0, d?.name ?? r.name, {
      fontSize: '13px', fontStyle: 'bold', color: '#ffe188', fontFamily: FF,
    }).setOrigin(0.5, 0);
    const descText = this.add.text(0, 0, desc, {
      fontSize: '11px', color: '#e8dbc4', fontFamily: FF,
      wordWrap: { width: w - padX * 2 }, align: 'center',
    }).setOrigin(0.5, 0);
    const denyText = !ok ? this.add.text(0, 0, 'Cannot afford', {
      fontSize: '10px', fontStyle: 'italic', color: '#ff8a8a', fontFamily: FF,
    }).setOrigin(0.5, 0) : null;

    const gap = 4;
    const contentH = nameText.height + gap + descText.height + (denyText ? gap + denyText.height : 0);
    const h = contentH + padY * 2;

    // Anchor above the frame; flip below if it would clip top.
    let ty = y - h / 2 - 6;
    if (ty - h / 2 < 4) ty = y + h / 2 + 6;

    // Clean translucent dark panel — no border, no decoration. Drawn via
    // Graphics so we get rounded corners at exact size.
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a14, 0.86);
    bg.fillRoundedRect(x - w / 2, ty - h / 2, w, h, 8);
    this.tooltipLayer.add(bg);

    // Stack name → desc → (deny) inside the panel.
    let ty0 = ty - h / 2 + padY;
    nameText.setPosition(x, ty0);
    this.tooltipLayer.add(nameText);
    ty0 += nameText.height + gap;
    descText.setPosition(x, ty0);
    this.tooltipLayer.add(descText);
    if (denyText) {
      ty0 += descText.height + gap;
      denyText.setPosition(x, ty0);
      this.tooltipLayer.add(denyText);
    }
  }

  private hideTooltip(): void {
    if (this.tooltipLayer) this.tooltipLayer.removeAll(true);
  }

  // ── Leave button ──────────────────────────────────────────
  private buildLeaveButton(): void {
    // Bottom-right, next to the gold badge.
    const cx = LEAVE_CX, cy = BOTTOM_BAR_Y;
    const w = 130, h = 32;
    const btn = this.add.container(cx, cy);
    if (this.textures.exists('panel_wood_button')) {
      btn.add(this.add.image(0, 0, 'panel_wood_button')
        .setDisplaySize(w * 1.3, h * 1.8));
    }
    const label = this.add.text(0, 0, '← Leave Shop', {
      fontSize: '15px', fontStyle: 'bold', color: GOLD,
      fontFamily: FF, stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setShadow(2, 2, '#000', 2, true, true);
    btn.add(label);
    const hit = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
    btn.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    (btn as any).input.cursor = 'pointer';
    btn.on('pointerover', () => label.setColor(WHITE));
    btn.on('pointerout', () => label.setColor(GOLD));
    btn.on('pointerdown', () => {
      // Tutorial gate: can't leave until the scripted buys are done (the
      // overlay also blocks this button until the 'shop-leave' step).
      if (!this.tutAllows('leave')) return;
      this.close();
    });
    this.mainLayer.add(btn);
  }

  // ── Refresh ───────────────────────────────────────────────
  private refreshAll(): void {
    const run = getRun();
    this.goldText.setText(`${run.economy.gold}g`);
    this.mainLayer.destroy(true);
    this.mainLayer = this.add.container(0, 0);
    // buildHeader builds the bottom-right gold badge directly on the scene
    // root (not mainLayer), so it survives the mainLayer destroy and only the
    // goldText value needs refreshing. The leave button likewise lives at the
    // bottom-right of mainLayer and gets rebuilt here.
    this.buildRelics();
    this.buildElements();
    this.buildServices();
    this.buildLeaveButton();
  }

  /**
   * Wave 3: loop-end auto-heal that replaces the deleted rest tile.
   * Base 30% HP recovery (matches the old rest_choice 'rest' value).
   * Hearty Meal relic adds +50% heal and +2 stamina, mirroring its prior
   * behavior on rest tiles. Lodestone Pendant still fires independently
   * in LoopRunner.onLoopCompleted, so it is not re-applied here.
   */
  private applyLoopEndAutoHeal(run: ReturnType<typeof getRun>): void {
    const baseRecoveryPct = 0.3;
    const heartyMeal = (run.relics ?? []).includes('hearty_meal');
    const recoveryPct = baseRecoveryPct * (heartyMeal ? 1.5 : 1.0);
    const heal = Math.floor(run.hero.maxHP * recoveryPct);
    run.hero.currentHP = Math.min(run.hero.currentHP + heal, run.hero.maxHP);
    if (heartyMeal) {
      run.hero.currentStamina = Math.min(run.hero.maxStamina, run.hero.currentStamina + 2);
    }
  }

  private close(): void {
    // Tutorial: leaving the shop completes 'shop-leave' and hands back to
    // planning with the forge step armed. No-op outside the tutorial.
    tutorialDirector.advanceIfMatches('shop-leave');
    const parent = this.parentSceneKey;
    const isSleeping = this.scene.isSleeping(parent);
    this.scene.stop();
    if (isSleeping) this.scene.wake(parent); else this.scene.resume(parent);
  }

  private cleanup(): void {
    if (this.tooltipLayer) { this.tooltipLayer.destroy(true); this.tooltipLayer = null as any; }
    if (this.mainLayer)    { this.mainLayer.destroy(true);    this.mainLayer = null as any; }
  }
}
