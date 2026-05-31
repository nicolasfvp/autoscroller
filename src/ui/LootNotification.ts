import { Scene } from 'phaser';
import type { LootEntry } from '../systems/PendingLoot';
import { FONTS } from './StyleConstants';

const APPEAR_MS  = 300;
const HOLD_MS    = 900;
const FADE_MS    = 300;

export function showLootNotifications(
  scene: Scene,
  _unusedWorldX: number,
  _unusedWorldY: number,
  items: LootEntry[],
): void {
  if (items.length === 0) return;
  showNext(scene, items, 0);
}

function showNext(scene: Scene, items: LootEntry[], index: number): void {
  if (index >= items.length) return;
  createNotificationPanel(scene, items[index], () => showNext(scene, items, index + 1));
}

function createNotificationPanel(scene: Scene, item: LootEntry, onDone: () => void): void {
  const cx = 400;
  const cy = 200;

  const container = scene.add.container(cx, cy).setScrollFactor(0).setDepth(1000).setAlpha(0);

  const text = scene.add.text(0, 0, item.label, {
    fontFamily: FONTS.body,
    fontSize: '20px',
    fontStyle: 'bold',
    color: item.color || '#ffffff',
    stroke: '#221100',
    strokeThickness: 4,
  }).setOrigin(0.5).setShadow(0, 2, '#000000', 3, true, true);

  const bgW = Math.max(160, text.width + 50);
  const bgH = 46;
  const bg = scene.add.image(0, 0, 'achievements_bg').setDisplaySize(bgW, bgH);

  container.add([bg, text]);

  scene.tweens.add({
    targets: container,
    y: cy - 40,
    alpha: { from: 0, to: 1 },
    scale: { from: 0.8, to: 1 },
    duration: APPEAR_MS,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: container,
        y: cy - 80,
        alpha: 0,
        delay: HOLD_MS,
        duration: FADE_MS,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          container.destroy();
          onDone();
        },
      });
    },
  });
}
