// Floating loot notifications -- sequential text that rises and fades above a world position.
// Each notification appears after the previous one starts fading, creating a stacked effect.

import { Scene } from 'phaser';
import type { LootEntry } from '../systems/PendingLoot';

const RISE_DISTANCE = 50;
const DURATION = 1500;
const STAGGER_DELAY = 400;

/**
 * Show sequential floating loot notifications above a world position.
 * Texts appear one after another, float upward, and fade out.
 */
export function showLootNotifications(
  scene: Scene,
  worldX: number,
  worldY: number,
  items: LootEntry[],
): void {
  items.forEach((item, i) => {
    scene.time.delayedCall(i * STAGGER_DELAY, () => {
      const text = scene.add.text(worldX, worldY - 40, item.label, {
        fontSize: '16px',
        fontStyle: 'bold',
        color: item.color,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(200);

      scene.tweens.add({
        targets: text,
        y: worldY - 40 - RISE_DISTANCE,
        alpha: 0,
        duration: DURATION,
        ease: 'Cubic.easeOut',
        onComplete: () => text.destroy(),
      });
    });
  });
}
