// CardVisual -- thin wrapper around the unified CardFace renderer.
//
// Historically this module owned its own layout. The 2026-05-23 refactor
// collapsed small- and full-card layouts into a single mold (see
// CardFace.ts), so CardVisual now exists only to preserve the public API
// that existing scenes (DeckBuilder, Shop, Library, Forge, etc.) import.

import { createCardFace, type CardFaceOptions } from './CardFace';
import { showCardDetail } from './CardDetailPopup';

export { STANDARD_CARD_WIDTH, STANDARD_CARD_HEIGHT } from './CardFace';

export interface CardVisualOptions {
  /** Legacy flag — when true, renders at 1.5x. */
  enlarged?: boolean;
  /** Multiplier on top of metaState.cardScale. Default 1. */
  scale?: number;
  /** Pre-resolved upgrade flag. When provided, skips CardFace's O(N) run-deck
   *  scan — pass this from grid views that pre-build an upgrade Set. */
  upgraded?: boolean;
}

/**
 * Create a card visual at the small base size (150×240) and wire it to
 * open the detail popup on click. Callers that want a no-popup variant
 * should `visual.removeAllListeners('pointerdown')` after construction.
 */
export function createCardVisual(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cardId: string,
  options?: CardVisualOptions,
): Phaser.GameObjects.Container {
  const scale = options?.scale ?? (options?.enlarged ? 1.5 : 1);
  const faceOpts: CardFaceOptions = {
    baseSize: 'small',
    scale,
    hover: true,
    onClick: () => showCardDetail(scene, cardId),
    upgraded: options?.upgraded,
  };
  return createCardFace(scene, x, y, cardId, faceOpts);
}
