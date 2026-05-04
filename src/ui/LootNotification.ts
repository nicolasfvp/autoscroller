// Floating loot notifications -- redesigned to appear as sleek glassmorphism panels
// in the center of the screen, providing clear feedback on rewards.

import { Scene } from 'phaser';
import type { LootEntry } from '../systems/PendingLoot';
import { FONTS } from './StyleConstants';

const DURATION = 2500;
const STAGGER_DELAY = 200;

/**
 * Show sleek notification panels in the center-top of the screen.
 * Panels appear one after another, slide slightly and fade.
 */
export function showLootNotifications(
  scene: Scene,
  _unusedWorldX: number,
  _unusedWorldY: number,
  items: LootEntry[],
): void {
  items.forEach((item, i) => {
    scene.time.delayedCall(i * STAGGER_DELAY, () => {
      createNotificationPanel(scene, item, i);
    });
  });
}

function createNotificationPanel(scene: Scene, item: LootEntry, index: number): void {
  const cx = 400;
  const cy = 200 + index * 50; // Stagger vertically to prevent overlap
  
  const container = scene.add.container(cx, cy).setScrollFactor(0).setDepth(1000).setAlpha(0);
  
  // Calculate width based on text
  const text = scene.add.text(0, 0, item.label, {
    fontFamily: FONTS.family,
    fontSize: '20px',
    fontStyle: 'bold',
    color: item.color || '#ffffff',
    stroke: '#221100',
    strokeThickness: 4,
  }).setOrigin(0.5).setShadow(0, 2, '#000000', 3, true, true);
  
  const bgW = Math.max(160, text.width + 50);
  const bgH = 46;
  
  // Use the new achievements background asset
  const bg = scene.add.image(0, 0, 'achievements_bg').setDisplaySize(bgW, bgH);
  
  container.add([bg, text]);
  
  // Slide-in and fade-out animation
  scene.tweens.add({
    targets: container,
    y: cy - 40,
    alpha: { from: 0, to: 1 },
    scale: { from: 0.8, to: 1 },
    duration: 400,
    ease: 'Back.easeOut',
    onComplete: () => {
      // Hold then fade
      scene.tweens.add({
        targets: container,
        y: cy - 80,
        alpha: 0,
        delay: DURATION - 800,
        duration: 400,
        ease: 'Cubic.easeIn',
        onComplete: () => container.destroy(),
      });
    }
  });
}
