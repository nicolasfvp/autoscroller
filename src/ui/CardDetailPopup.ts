// CardDetailPopup -- full-screen overlay showing the same card face at
// popup base size (400×640). After the 2026-05-23 mold-unification refactor
// there's no separate "full" layout: the popup is just the standard card
// face rendered larger, with a dismissable backdrop.

import Phaser from 'phaser';
import { createDelayedBackdrop } from './Backdrop';
import { attachKeywordTooltip } from './KeywordTooltip';
import { hideFilterBarInputs, showFilterBarInputs } from './FilterBarVisibility';
import { formatCardDescription } from '../systems/cards/CardText';
import { getCardById } from '../data/DataLoader';
import { createCardFace } from './CardFace';
import { getRun } from '../state/RunState';

export interface ForgePopupOptions {
  cost: number;
  statusText: string;
  statusColor: string;
  canForge: boolean;
  onForge: () => void;
  onDismiss: () => void;
}

/**
 * Show a card detail popup overlay on the given scene.
 * Click anywhere on the backdrop to dismiss.
 * Returns the container so the caller can destroy it if needed.
 */
export function showCardDetail(
  scene: Phaser.Scene,
  cardId: string,
  deckIndex?: number,
  forgeOpts?: ForgePopupOptions,
  smallCard?: boolean,
  noBackdrop?: boolean,
): Phaser.GameObjects.Container {
  const card = getCardById(cardId);
  if (!card) return scene.add.container(0, 0);

  let isUpgraded = false;
  try {
    const run = getRun();
    if (typeof deckIndex === 'number'
      && deckIndex >= 0
      && deckIndex < run.deck.upgraded.length) {
      isUpgraded = run.deck.upgraded[deckIndex];
    } else {
      isUpgraded = run.deck.active.some((id, i) => id === cardId && run.deck.upgraded[i]);
    }
  } catch {
    // No active run
  }

  const popup = scene.add.container(0, 0);
  popup.setDepth(500);

  const dismiss = () => {
    if (tip) tip.cancel();
    showFilterBarInputs();
    popup.destroy(true);
    forgeOpts?.onDismiss();
  };

  let tip: { cancel: () => void } | null = null;
  hideFilterBarInputs();
  popup.once('destroy', () => showFilterBarInputs());

  if (!noBackdrop) {
    const backdrop = createDelayedBackdrop(scene, 100, 0.7);
    backdrop.on('pointerdown', dismiss);
    popup.add(backdrop);
  } else {
    // Sem backdrop: fechar ao clicar fora após delay anti-duplo-clique
    const onDown = () => dismiss();
    scene.time.delayedCall(150, () => {
      if (!popup.active) return;
      scene.input.once('pointerdown', onDown);
    });
    popup.once('destroy', () => scene.input.off('pointerdown', onDown));
  }

  const cam = scene.cameras.main;
  const cx = cam.width / cam.zoom / 2;
  const cy = cam.height / cam.zoom / 2;

  const isForge = !!forgeOpts || !!smallCard;
  // Combat popup reduced to 80% — Forge/Library keep old size (already compact).
  const cardScale = isForge ? 0.715 : 0.8;
  const cardY     = cy;

  const face = createCardFace(scene, cx, cardY, cardId, {
    baseSize: 'popup',
    hover: false,
    upgraded: isUpgraded,
    scale: cardScale,
  });
  popup.add(face);

  const effects = (isUpgraded && card.upgraded?.effects) ? card.upgraded.effects : card.effects;
  const desc = formatCardDescription({
    effects,
    exhaust: card.exhaust,
    spend_armor: card.spend_armor,
  });
  const popupW = 340 * cardScale;
  const popupH = 540 * cardScale;
  tip = attachKeywordTooltip(scene, popup, desc, {
    x: cx, y: cardY, w: popupW, h: popupH,
  });

  // ── Forge controls ─────────────────────────────────────────────────────────
  if (forgeOpts) {
    const BANNER_Y = cy + 195;

    if (scene.textures.exists('forge_status_banner')) {
      const bSrc = scene.textures.get('forge_status_banner').getSourceImage() as { width: number; height: number };
      popup.add(scene.add.image(cx, BANNER_Y, 'forge_status_banner').setScale(340 / bSrc.width));
    }

    popup.add(
      scene.add.text(cx - 65, BANNER_Y, `⚒ ${forgeOpts.cost} Gold`, {
        fontSize: '15px', fontStyle: 'bold', color: '#ffd700',
        fontFamily: 'VT323', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5),
    );

    popup.add(
      scene.add.text(cx + 60, BANNER_Y, forgeOpts.statusText, {
        fontSize: '13px', fontStyle: 'bold', color: forgeOpts.statusColor,
        fontFamily: 'VT323', stroke: '#000', strokeThickness: 3,
        wordWrap: { width: 110 },
      }).setOrigin(0.5),
    );

    const BTN_Y = BANNER_Y + 46;
    const makeBtn = (bx: number, texKey: string, onClick: () => void) => {
      const img = scene.add.image(bx, BTN_Y, texKey).setScale(0.0411)
        .setInteractive({ useHandCursor: true });
      img.on('pointerover', () => img.setTint(0xffffcc));
      img.on('pointerout',  () => img.clearTint());
      img.on('pointerdown', (ptr: Phaser.Input.Pointer) => { ptr.event.stopPropagation(); onClick(); });
      popup.add(img);
    };

    if (forgeOpts.canForge) {
      makeBtn(cx - 55, 'btn_forge_action', () => { popup.destroy(true); forgeOpts.onForge(); });
    }
    makeBtn(forgeOpts.canForge ? cx + 55 : cx, 'btn_dismiss', () => { popup.destroy(true); forgeOpts.onDismiss(); });
  }

  popup.setAlpha(0);
  scene.tweens.add({ targets: popup, alpha: 1, duration: 150, ease: 'Sine.easeOut' });

  return popup;
}
