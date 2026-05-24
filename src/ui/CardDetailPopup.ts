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

/**
 * Show a card detail popup overlay on the given scene.
 * Click anywhere on the backdrop to dismiss.
 * Returns the container so the caller can destroy it if needed.
 */
export function showCardDetail(
  scene: Phaser.Scene,
  cardId: string,
  deckIndex?: number,
): Phaser.GameObjects.Container {
  const card = getCardById(cardId);
  if (!card) return scene.add.container(0, 0);

  // Resolve per-position upgrade flag, falling back to "any copy upgraded".
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

  const backdrop = createDelayedBackdrop(scene, 100, 0.7);
  let tip: { cancel: () => void } | null = null;
  hideFilterBarInputs();
  backdrop.on('pointerdown', () => {
    if (tip) tip.cancel();
    showFilterBarInputs();
    popup.destroy(true);
  });
  popup.once('destroy', () => showFilterBarInputs());
  popup.add(backdrop);

  // Centered on the scene in game-space (800×600). cam.width returns the
  // viewport in canvas-pixel space (post-UI_SCALE), so we divide by zoom to
  // convert back to game-space coordinates the card face expects.
  const cam = scene.cameras.main;
  const cx = cam.width / cam.zoom / 2;
  const cy = cam.height / cam.zoom / 2;

  const face = createCardFace(scene, cx, cy, cardId, {
    baseSize: 'popup',
    hover: false,
    upgraded: isUpgraded,
  });
  popup.add(face);

  // Keyword tooltip — attach over the card so hovering a token reveals the
  // glossary definition without needing to read the description twice.
  const effects = (isUpgraded && card.upgraded?.effects) ? card.upgraded.effects : card.effects;
  const desc = formatCardDescription({
    effects,
    exhaust: card.exhaust,
    spend_armor: card.spend_armor,
    cooldown_scale: card.cooldown_scale,
  });
  tip = attachKeywordTooltip(scene, popup, desc, {
    x: cx, y: cy, w: 400, h: 640,
  });

  popup.setAlpha(0);
  scene.tweens.add({ targets: popup, alpha: 1, duration: 150, ease: 'Sine.easeOut' });

  return popup;
}
