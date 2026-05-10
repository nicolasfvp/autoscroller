import Phaser from 'phaser';

/**
 * Creates a fullscreen rectangle that only becomes interactive after `ms`
 * milliseconds. Prevents the same pointerdown that opened the popup from
 * also closing it (click-through race).
 */
export function createDelayedBackdrop(
  scene: Phaser.Scene,
  ms: number = 100,
  alpha: number = 0.7,
  color: number = 0x000000,
  width: number = 800,
  height: number = 600,
  cx: number = 400,
  cy: number = 300,
): Phaser.GameObjects.Rectangle {
  const rect = scene.add.rectangle(cx, cy, width, height, color, alpha);
  scene.time.delayedCall(ms, () => {
    if (!rect.scene) return;
    rect.setInteractive();
  });
  return rect;
}
