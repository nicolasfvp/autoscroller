// Reusable card visual component -- Phaser Container factory.
// Renders a card with rarity border, type indicator, name, cost, cooldown.

import { getCardById } from '../data/DataLoader';
import type { CardCategory } from '../data/types';

// ── Color Constants ─────────────────────────────────────────

const RARITY_COLORS: Record<string, number> = {
  common: 0xcccccc,
  uncommon: 0x33cc33,
  rare: 0xff6600,
};

const CATEGORY_COLORS: Record<CardCategory, number> = {
  attack: 0xcc3333,
  defense: 0x3366cc,
  magic: 0x9933cc,
};

const CARD_BG = 0x222222;
const STANDARD_WIDTH = 72;
const STANDARD_HEIGHT = 96;
const ENLARGED_SCALE = 1.5;

export interface CardVisualOptions {
  enlarged?: boolean;
}

/**
 * Create a reusable card visual as a Phaser Container.
 * Standard size: 72x96. Enlarged: 108x144 (1.5x).
 */
export function createCardVisual(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cardId: string,
  options?: CardVisualOptions,
): Phaser.GameObjects.Container {
  const card = getCardById(cardId);
  const enlarged = options?.enlarged ?? false;
  const scale = enlarged ? ENLARGED_SCALE : 1;
  const w = STANDARD_WIDTH * scale;
  const h = STANDARD_HEIGHT * scale;

  const container = scene.add.container(x, y);

  // Background rectangle
  const bg = scene.add.rectangle(0, 0, w, h, CARD_BG);
  const rarityColor = card ? (RARITY_COLORS[card.rarity] ?? RARITY_COLORS.common) : RARITY_COLORS.common;
  bg.setStrokeStyle(2, rarityColor);
  container.add(bg);

  // Type indicator strip at top
  const categoryColor = card ? (CATEGORY_COLORS[card.category] ?? 0x888888) : 0x888888;
  const strip = scene.add.rectangle(0, -h / 2 + 2, w - 4, 4, categoryColor);
  container.add(strip);

  // Card name
  const name = card ? card.name : cardId;
  const nameText = scene.add.text(0, -4, name, {
    fontSize: `${Math.round(16 * scale)}px`,
    color: '#ffffff',
    wordWrap: { width: w - 8 },
    align: 'center',
  }).setOrigin(0.5);
  container.add(nameText);

  // Cost indicator (bottom-left)
  if (card?.cost) {
    const costVal = card.cost.mana ?? card.cost.stamina ?? 0;
    const costColor = card.cost.mana ? '#6a5acd' : '#ff8c00';
    const costText = scene.add.text(
      -w / 2 + 4,
      h / 2 - 4,
      `${costVal}`,
      { fontSize: `${Math.round(14 * scale)}px`, color: costColor },
    ).setOrigin(0, 1);
    container.add(costText);
  }

  // Cooldown indicator (bottom-right)
  if (card) {
    const cdText = scene.add.text(
      w / 2 - 4,
      h / 2 - 4,
      `${card.cooldown}s`,
      { fontSize: `${Math.round(14 * scale)}px`, color: '#aaaaaa' },
    ).setOrigin(1, 1);
    container.add(cdText);
  }

  // Interactive hover state
  container.setSize(w, h);
  container.setInteractive();
  container.on('pointerover', () => {
    scene.tweens.add({
      targets: container,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 200,
      ease: 'Sine.easeOut',
    });
    bg.setStrokeStyle(2, 0xffffff);
  });
  container.on('pointerout', () => {
    scene.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Sine.easeOut',
    });
    bg.setStrokeStyle(2, rarityColor);
  });

  // Store card data for external access
  container.setData('cardId', cardId);
  container.setData('card', card);

  return container;
}
