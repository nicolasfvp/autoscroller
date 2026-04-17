// Reusable card visual component -- Phaser Container factory.
// Renders a card to match the detailed mock-up with headers, images, cooldowns, and effects.

import { getCardById } from '../data/DataLoader';
import { getRun } from '../state/RunState';
import { showCardDetail } from './CardDetailPopup';
import type { CardCategory, CardDefinition } from '../data/types';

// ── Constants ─────────────────────────────────────────

const RARITY_COLORS: Record<string, number> = {
  common: 0x888888,
  uncommon: 0x2e8b57,
  rare: 0x0044cc,
  epic: 0x9400d3,
};

const CATEGORY_COLORS: Record<CardCategory, number> = {
  attack: 0xcc3333,
  defense: 0x3366cc,
  magic: 0x9933cc,
};

const CATEGORY_EMOJIS: Record<CardCategory, string> = {
  attack: '⚔️',
  defense: '🛡️',
  magic: '✨',
};

const CARD_BG = 0x1e1e28;
export const STANDARD_CARD_WIDTH = 150;
export const STANDARD_CARD_HEIGHT = 240;

export interface CardVisualOptions {
  enlarged?: boolean;
  scale?: number;
}

/**
 * Create a reusable card visual as a Phaser Container.
 */
export function createCardVisual(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cardId: string,
  options?: CardVisualOptions,
): Phaser.GameObjects.Container {
  const card = getCardById(cardId);
  const scale = options?.scale ?? (options?.enlarged ? 1.5 : 1);
  const w = STANDARD_CARD_WIDTH;
  const h = STANDARD_CARD_HEIGHT;

  const container = scene.add.container(x, y);
  
  // Default values if card is missing
  const rarityColor = card ? (RARITY_COLORS[card.rarity] ?? RARITY_COLORS.common) : RARITY_COLORS.common;
  const categoryColor = card ? (CATEGORY_COLORS[card.category] ?? 0x888888) : 0x888888;

  // Base Background
  const bg = scene.add.rectangle(0, 0, w, h, CARD_BG);
  // Optional outer rim glow
  bg.setStrokeStyle(2, rarityColor);
  container.add(bg);

  if (!card) return container;

  // Header Area (Top)
  const iconEmoji = CATEGORY_EMOJIS[card.category] || '❓';
  const headerIcon = scene.add.text(-w / 2 + 8, -h / 2 + 8, iconEmoji, {
    fontSize: '14px',
  }).setOrigin(0, 0);
  container.add(headerIcon);

  const rarityHex = '#' + rarityColor.toString(16).padStart(6, '0');
  const rarityLabel = scene.add.text(w / 2 - 8, -h / 2 + 10, (card.rarity || 'common').toUpperCase(), {
    fontSize: '10px',
    fontFamily: 'monospace',
    color: rarityHex,
    fontStyle: 'bold',
  }).setOrigin(1, 0);
  container.add(rarityLabel);

  // Image Area Gradient
  const imgAreaTop = -h / 2 + 28;
  const imgAreaHeight = 85;
  const imgAreaY = imgAreaTop + imgAreaHeight / 2;
  
  const g = scene.add.graphics();
  // Fill gradient style: Dark at top, category color at bottom
  g.fillGradientStyle(0x111118, 0x111118, categoryColor, categoryColor, 1, 1, 0.4, 0.4);
  g.fillRect(-w / 2 + 2, imgAreaTop, w - 4, imgAreaHeight);
  container.add(g);

  // Pixel art main image
  const imgKey = `card_${card.id}`;
  if (scene.textures.exists(imgKey)) {
    const img = scene.add.image(0, imgAreaY - 5, imgKey);
    // Limit bounds so it doesn't overflow
    if (img.width > w - 10 || img.height > imgAreaHeight - 10) {
      const scaleX = (w - 10) / img.width;
      const scaleY = (imgAreaHeight - 10) / img.height;
      img.setScale(Math.min(scaleX, scaleY));
    }
    container.add(img);
  } else {
    // Fallback if no asset loaded yet
    const bigIcon = scene.add.text(0, imgAreaY - 5, iconEmoji, {
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5);
    bigIcon.setAlpha(0.6);
    container.add(bigIcon);
  }

  // Cooldown Badge
  const cooldown = getEffectiveCooldown(card);
  if (cooldown) {
    const cdBgWidth = 34;
    const cdBgHeight = 16;
    const cdBg = scene.add.graphics();
    cdBg.fillStyle(0x000000, 0.8);
    const cdStartX = w / 2 - cdBgWidth - 6;
    const cdStartY = imgAreaTop + imgAreaHeight - cdBgHeight - 4;
    cdBg.fillRoundedRect(cdStartX, cdStartY, cdBgWidth, cdBgHeight, 4);
    cdBg.lineStyle(1, 0xaaaaaa, 0.8);
    cdBg.strokeRoundedRect(cdStartX, cdStartY, cdBgWidth, cdBgHeight, 4);
    container.add(cdBg);

    const cdText = scene.add.text(w / 2 - 23, cdStartY + cdBgHeight / 2, `⏱ ${cooldown}s`, {
      fontSize: '9px',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add(cdText);
  }

  // Name Strip
  const nameStripY = -8;
  const nameStripH = 26;
  const nameBg = scene.add.rectangle(0, nameStripY, w - 4, nameStripH, categoryColor, 0.3);
  container.add(nameBg);

  let isUpgraded = false;
  try {
    const run = getRun();
    isUpgraded = run.deck.upgradedCards?.includes(cardId) ?? false;
  } catch {
    //
  }
  const displayName = isUpgraded ? `${card.name}+` : card.name;
  const nameColorStr = isUpgraded ? '#ffd700' : '#ffffff';
  
  const nameText = scene.add.text(0, nameStripY, displayName, {
    fontSize: '14px',
    fontStyle: 'bold',
    fontFamily: 'monospace',
    color: nameColorStr,
  }).setOrigin(0.5);
  container.add(nameText);

  // Main Effect Breakdown
  const mainEffectY = 30;
  const mainEff = getMainEffect(card, isUpgraded);
  if (mainEff) {
    // Number text
    const effVal = scene.add.text(-6, mainEffectY, String(mainEff.val), {
      fontSize: '16px',
      fontStyle: 'bold',
      fontFamily: 'monospace',
      color: mainEff.color,
    }).setOrigin(1, 0.5);
    container.add(effVal);

    // Label text
    const effLabel = scene.add.text(-2, mainEffectY, mainEff.label, {
      fontSize: '14px',
      fontStyle: 'bold',
      fontFamily: 'monospace',
      color: mainEff.color,
    }).setOrigin(0, 0.5);
    container.add(effLabel);
  }
  
  // Description
  const descY = 56;
  const descText = scene.add.text(0, descY, getEffectiveDesc(card, isUpgraded), {
    fontSize: '9px',
    color: '#aaaaaa',
    fontFamily: 'monospace',
    align: 'center',
    wordWrap: { width: w - 16 }
  }).setOrigin(0.5, 0);
  container.add(descText);

  // Cost Banner
  const cost = isUpgraded && card.upgraded?.cost ? card.upgraded.cost : card.cost;
  if (cost) {
    const costStripH = 22;
    const costBg = scene.add.rectangle(0, h / 2 - costStripH / 2, w - 4, costStripH, 0x000000, 0.6);
    container.add(costBg);

    const costStrings = [];
    if (cost.mana) costStrings.push(`-${cost.mana} Mana`);
    if (cost.defense) costStrings.push(`-${cost.defense} Defense`);
    if (cost.stamina) costStrings.push(`-${cost.stamina} Stamina`);

    const costText = scene.add.text(0, h / 2 - costStripH / 2, costStrings.join(', '), {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#ffcc66',
    }).setOrigin(0.5);
    container.add(costText);
  }

  // Set sizing and interactivity
  container.setScale(scale);
  container.setSize(w, h);
  container.setInteractive({ cursor: 'pointer' });

  // Hover animations
  const startY = y;
  container.on('pointerover', () => {
    scene.tweens.add({
      targets: container,
      scaleX: scale * 1.05,
      scaleY: scale * 1.05,
      y: startY - 8,
      duration: 150,
      ease: 'Sine.easeOut',
    });
    bg.setStrokeStyle(3, 0xffffff);
  });
  
  container.on('pointerout', () => {
    scene.tweens.add({
      targets: container,
      scaleX: scale,
      scaleY: scale,
      y: startY,
      duration: 150,
      ease: 'Sine.easeOut',
    });
    bg.setStrokeStyle(2, rarityColor);
  });

  // Action
  container.on('pointerdown', () => {
    showCardDetail(scene, cardId);
  });

  container.setData('cardId', cardId);
  container.setData('card', card);

  return container;
}

// ── Helpers ─────────────────────────────────────────

function getEffectiveDesc(card: CardDefinition, isUpgraded: boolean): string {
  if (isUpgraded && card.upgraded?.description) return card.upgraded.description;
  return card.description;
}

function getEffectiveCooldown(card: CardDefinition): number | undefined {
  if (card.upgraded && card.upgraded.cooldown !== undefined) return card.upgraded.cooldown;
  return card.cooldown;
}

function getMainEffect(card: CardDefinition, isUpgraded: boolean) {
  const effects = isUpgraded && card.upgraded?.effects ? card.upgraded.effects : card.effects;
  if (!effects || effects.length === 0) return null;
  const primary = effects[0];

  switch (primary.type) {
    case 'damage': return { val: primary.value, label: 'DMG', color: '#ff6666' };
    case 'armor': return { val: primary.value, label: 'ARM', color: '#66bbff' };
    case 'heal': return { val: primary.value, label: 'HP', color: '#66ff66' };
    case 'mana': return { val: primary.value, label: 'MP', color: '#cc66ff' };
    case 'stamina': return { val: primary.value, label: 'STA', color: '#ffcc66' };
  }
  return { val: primary.value, label: primary.type.toUpperCase(), color: '#ffffff' };
}
