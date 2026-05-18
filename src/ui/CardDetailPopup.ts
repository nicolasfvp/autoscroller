// CardDetailPopup -- full-screen overlay showing enlarged card with all details.
// Triggered by clicking any card visual in the game.

import Phaser from 'phaser';
import { getCardById } from '../data/DataLoader';
import { getRun } from '../state/RunState';
import { COLORS, FONTS } from './StyleConstants';
import { createDelayedBackdrop } from './Backdrop';
import { attachKeywordTooltip } from './KeywordTooltip';
import { hideFilterBarInputs, showFilterBarInputs } from './FilterBarVisibility';
import type { CardCategory } from '../data/types';

const RARITY_COLORS: Record<string, number> = {
  common: 0xcccccc,
  uncommon: 0x33cc33,
  rare: 0xff6600,
  epic: 0xaa00ff,
};

const RARITY_LABELS: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
};

const CATEGORY_COLORS: Record<CardCategory, number> = {
  attack: 0xcc3333,
  defense: 0x3366cc,
  magic: 0x9933cc,
};

const CATEGORY_LABELS: Record<CardCategory, string> = {
  attack: 'Attack',
  defense: 'Defense',
  magic: 'Magic',
};

const TARGETING_LABELS: Record<string, string> = {
  single: 'Single Target',
  aoe: 'All Enemies',
  'lowest-hp': 'Lowest HP',
  random: 'Random',
  self: 'Self',
};

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

  // Check if card is upgraded. With per-position tracking we need a deck
  // index; if the caller doesn't supply one (e.g. previewing a card outside
  // the deck), fall back to "any copy of this id is upgraded" so popups
  // opened from buy-card / loot screens still show upgrade overlays when
  // the player owns an upgraded copy.
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

  // Resolve effective card values (apply upgrade overlay)
  const effectiveDesc = (isUpgraded && card.upgraded?.description) ? card.upgraded.description : card.description;
  const effectiveCooldown = (isUpgraded && card.upgraded?.cooldown != null) ? card.upgraded.cooldown : card.cooldown;
  const effectiveCost = (isUpgraded && card.upgraded?.cost) ? card.upgraded.cost : card.cost;
  const effectiveEffects = (isUpgraded && card.upgraded?.effects) ? card.upgraded.effects : card.effects;

  const popup = scene.add.container(0, 0);
  popup.setDepth(500);

  // Full-screen dimmed backdrop -- 100ms delay before interactive prevents
  // the same pointerdown that opened the popup from closing it.
  // The keyword tooltip handle is assigned below; the backdrop closes
  // the popup AND cancels the pending tooltip timer so it doesn't fire
  // (or fire and immediately get torn down with the popup).
  const backdrop = createDelayedBackdrop(scene, 100, 0.7);
  let tip: { cancel: () => void } | null = null;
  // Hide any floating HTML <input>s (search bars) while the popup is open,
  // since DOM elements outside the canvas always render above canvas content
  // regardless of Phaser depth.
  hideFilterBarInputs();
  backdrop.on('pointerdown', () => {
    if (tip) tip.cancel();
    showFilterBarInputs();
    popup.destroy(true);
  });
  popup.once('destroy', () => showFilterBarInputs());
  popup.add(backdrop);

  // Card panel
  const panelW = 320;
  const panelH = 420;
  const px = 400;
  const py = 280;

  const panel = scene.add.rectangle(px, py, panelW, panelH, 0x1a1a2e, 0.98);
  const rarityColor = RARITY_COLORS[card.rarity] ?? RARITY_COLORS.common;
  panel.setStrokeStyle(3, rarityColor);
  popup.add(panel);

  // Category color strip at top
  const catColor = CATEGORY_COLORS[card.category] ?? 0x888888;
  const strip = scene.add.rectangle(px, py - panelH / 2 + 4, panelW - 6, 8, catColor);
  popup.add(strip);

  const fontFamily = FONTS.family;
  let yPos = py - panelH / 2 + 30;

  // Card name
  const displayName = isUpgraded ? `${card.name}+` : card.name;
  const nameColor = isUpgraded ? COLORS.accent : COLORS.textPrimary;
  const nameText = scene.add.text(px, yPos, displayName, {
    fontSize: '28px',
    fontStyle: 'bold',
    color: nameColor,
    fontFamily,
  }).setOrigin(0.5);
  popup.add(nameText);

  yPos += 30;

  // Rarity + Category badges
  const rarityHex = '#' + rarityColor.toString(16).padStart(6, '0');
  const catHex = '#' + catColor.toString(16).padStart(6, '0');
  const rarityLabel = RARITY_LABELS[card.rarity] ?? card.rarity;
  const catLabel = CATEGORY_LABELS[card.category] ?? card.category;

  const badgeText = scene.add.text(px, yPos, `${rarityLabel} ${catLabel}`, {
    fontSize: '14px',
    color: rarityHex,
    fontFamily,
  }).setOrigin(0.5);
  popup.add(badgeText);

  yPos += 30;

  // Divider
  const divider1 = scene.add.rectangle(px, yPos, panelW - 40, 1, 0x444444);
  popup.add(divider1);
  yPos += 16;

  // Description
  const descText = scene.add.text(px, yPos, effectiveDesc, {
    fontSize: '16px',
    color: COLORS.textPrimary,
    fontFamily,
    wordWrap: { width: panelW - 40 },
    align: 'center',
    lineSpacing: 4,
  }).setOrigin(0.5, 0);
  popup.add(descText);

  yPos += descText.height + 20;

  // Divider
  const divider2 = scene.add.rectangle(px, yPos, panelW - 40, 1, 0x444444);
  popup.add(divider2);
  yPos += 16;

  // Stats section
  const statsLeft = px - panelW / 2 + 30;
  const statsRight = px + panelW / 2 - 30;

  // Cooldown
  const cdLabel = scene.add.text(statsLeft, yPos, 'Cooldown', {
    fontSize: '14px', color: COLORS.textSecondary, fontFamily,
  });
  popup.add(cdLabel);
  const cdVal = scene.add.text(statsRight, yPos, `${effectiveCooldown}s`, {
    fontSize: '14px', color: COLORS.textPrimary, fontFamily,
  }).setOrigin(1, 0);
  popup.add(cdVal);
  yPos += 22;

  // Targeting
  const targLabel = scene.add.text(statsLeft, yPos, 'Targeting', {
    fontSize: '14px', color: COLORS.textSecondary, fontFamily,
  });
  popup.add(targLabel);
  const targVal = scene.add.text(statsRight, yPos, TARGETING_LABELS[card.targeting] ?? card.targeting, {
    fontSize: '14px', color: COLORS.textPrimary, fontFamily,
  }).setOrigin(1, 0);
  popup.add(targVal);
  yPos += 22;

  // Cost
  if (effectiveCost) {
    const costLabel = scene.add.text(statsLeft, yPos, 'Cost', {
      fontSize: '14px', color: COLORS.textSecondary, fontFamily,
    });
    popup.add(costLabel);

    let costStr = '';
    let costColor: string = COLORS.textPrimary;
    if (effectiveCost.stamina) { costStr = `${effectiveCost.stamina} Stamina`; costColor = '#ff8c00'; }
    else if (effectiveCost.mana) { costStr = `${effectiveCost.mana} Mana`; costColor = '#6a5acd'; }
    else if (effectiveCost.defense) { costStr = `${effectiveCost.defense} Defense`; costColor = '#3366cc'; }

    const costVal = scene.add.text(statsRight, yPos, costStr, {
      fontSize: '14px', color: costColor, fontFamily,
    }).setOrigin(1, 0);
    popup.add(costVal);
    yPos += 22;
  }

  // Effects breakdown removed: the card's `description` already reads as a
  // curated player-facing summary (e.g. "Deal 4. Pyre 3. Burn 3.") so a
  // raw type/value dump below it is redundant AND was rendering DoT cards
  // as "Dot: 3 (Enemy)" which the player has no way to decode.
  void effectiveEffects;
  void catHex;

  // Upgraded indicator
  if (isUpgraded) {
    const upgText = scene.add.text(px, py + panelH / 2 - 20, 'UPGRADED', {
      fontSize: '12px', color: COLORS.accent, fontFamily, fontStyle: 'bold',
    }).setOrigin(0.5);
    popup.add(upgText);
  }

  // Dismiss hint
  const hint = scene.add.text(px, py + panelH / 2 + 20, 'Click anywhere to close', {
    fontSize: '12px', color: COLORS.textSecondary, fontFamily, fontStyle: 'italic',
  }).setOrigin(0.5);
  popup.add(hint);

  // Schedule keyword glossary tooltip (2s delay; cancelled if popup
  // closes early via backdrop click).
  tip = attachKeywordTooltip(scene, popup, effectiveDesc, {
    x: px, y: py, w: panelW, h: panelH,
  });

  // Entrance animation
  popup.setAlpha(0);
  scene.tweens.add({
    targets: popup,
    alpha: 1,
    duration: 150,
    ease: 'Sine.easeOut',
  });

  return popup;
}
