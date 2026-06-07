// GlossaryButton -- book icon button that opens the keyword glossary modal.
// Mounted by any scene that benefits from a persistent reference panel.
//
// Visual: book sprite icon with hover glow effect.

import Phaser from 'phaser';
import { openGlossary } from './GlossaryPanel';

const BUTTON_SIZE = 40;

/**
 * Add a book-icon glossary button at the given canvas-space position.
 *
 * `depth` controls draw order (default 5000 — above HUD, below modals).
 * `callbacks.onOpen` fires right before the glossary opens.
 * `callbacks.onClose` fires when the glossary closes.
 */
export function addGlossaryButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 5000,
  callbacks?: { onOpen?: () => void; onClose?: () => void },
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y).setDepth(depth);

  const icon = scene.add.image(0, 0, 'glossary_book_icon')
    .setDisplaySize(BUTTON_SIZE, BUTTON_SIZE)
    .setInteractive({ useHandCursor: true });
  container.add(icon);

  icon.on('pointerover', () => { icon.setTint(0xffd700); });
  icon.on('pointerout', () => { icon.clearTint(); });
  icon.on('pointerdown', () => {
    callbacks?.onOpen?.();
    openGlossary(scene, callbacks?.onClose);
  });

  return container;
}
