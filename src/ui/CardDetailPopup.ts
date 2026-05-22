// CardDetailPopup -- full-screen overlay showing enlarged card with all details.
// Triggered by clicking any card visual in the game.

import Phaser from 'phaser';
import { getCardById } from '../data/DataLoader';
import { getRun } from '../state/RunState';
import { FONTS } from './StyleConstants';
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
  popup.add(backdrop);  // index 0 — darkens scene behind popup

  const panelW = 440;
  const px = 400;
  const panelTop = 110;
  const fontFamily = FONTS.family;

  const rarityColor = RARITY_COLORS[card.rarity] ?? RARITY_COLORS.common;
  const catColor = CATEGORY_COLORS[card.category] ?? 0x888888;

  // ── Layout geometry ───────────────────────────────────
  // Left column: card art at natural proportions (150×192)
  // Right column: text info
  const CARD_IMG_W = 150;
  const CARD_IMG_H = 192;
  const LEFT_COL_W = CARD_IMG_W + 20;           // 170px
  const panelLeft = px - panelW / 2;            // 180
  const leftColCX = panelLeft + LEFT_COL_W / 2; // 265
  const rightColLeft = panelLeft + LEFT_COL_W + 8;      // 358
  const rightColRight = px + panelW / 2 - 14;           // 606
  const rightColCX = (rightColLeft + rightColRight) / 2; // 482
  const rightColW = rightColRight - rightColLeft;        // 248

  const contentTop = panelTop + 24;  // below strip (8px) + padding (16px)

  // ── Left column: card image ───────────────────────────
  const imgCY = contentTop + CARD_IMG_H / 2;

  popup.add(scene.add.rectangle(leftColCX, imgCY, CARD_IMG_W + 4, CARD_IMG_H + 4, 0x060608));

  const imgKey = `card_${card.id}`;
  if (scene.textures.exists(imgKey)) {
    const img = scene.add.image(leftColCX, imgCY, imgKey);
    img.setDisplaySize(CARD_IMG_W, CARD_IMG_H);
    popup.add(img);
  } else {
    const FALLBACK_EMOJI: Record<string, string> = { attack: '⚔️', defense: '🛡️', magic: '✨' };
    popup.add(
      scene.add.text(leftColCX, imgCY, FALLBACK_EMOJI[card.category] ?? '❓', {
        fontSize: '64px',
      }).setOrigin(0.5).setAlpha(0.4),
    );
  }

  const artBorder = scene.add.graphics();
  artBorder.lineStyle(2, rarityColor, 0.7);
  artBorder.strokeRect(leftColCX - CARD_IMG_W / 2 - 2, contentTop - 2, CARD_IMG_W + 4, CARD_IMG_H + 4);
  popup.add(artBorder);

  // ── Right column: info ────────────────────────────────
  let yPos = contentTop;

  const displayName = isUpgraded ? `${card.name}+` : card.name;
  popup.add(
    scene.add.text(rightColCX, yPos, displayName, {
      fontSize: '21px', fontStyle: 'bold', fontFamily,
      color: isUpgraded ? '#ffd700' : '#ffffff',
      stroke: '#000000', strokeThickness: 4,
      wordWrap: { width: rightColW }, align: 'center',
    }).setOrigin(0.5, 0),
  );
  yPos += 28;

  const rarityHex = '#' + rarityColor.toString(16).padStart(6, '0');
  const rarityLabel = RARITY_LABELS[card.rarity] ?? card.rarity;
  const catLabel = CATEGORY_LABELS[card.category] ?? card.category;
  popup.add(
    scene.add.text(rightColCX, yPos, `${rarityLabel}  ·  ${catLabel}`, {
      fontSize: '12px', color: rarityHex, fontFamily,
    }).setOrigin(0.5, 0),
  );
  yPos += 20;

  popup.add(scene.add.rectangle(rightColCX, yPos, rightColW, 1, 0x333355));
  yPos += 12;

  const descText = scene.add.text(rightColCX, yPos, effectiveDesc, {
    fontSize: '13px', color: '#bbbbcc', fontFamily,
    wordWrap: { width: rightColW - 4 },
    align: 'center', lineSpacing: 3,
  }).setOrigin(0.5, 0);
  popup.add(descText);
  yPos += descText.height + 12;

  popup.add(scene.add.rectangle(rightColCX, yPos, rightColW, 1, 0x333355));
  yPos += 12;

  const addStat = (label: string, value: string, valColor: string = '#ffffff') => {
    popup.add(scene.add.text(rightColLeft, yPos, label, { fontSize: '12px', color: '#778899', fontFamily }));
    popup.add(scene.add.text(rightColRight, yPos, value, {
      fontSize: '12px', fontStyle: 'bold', color: valColor, fontFamily,
    }).setOrigin(1, 0));
    yPos += 20;
  };

  if (effectiveCooldown) addStat('Cooldown', `${effectiveCooldown}s`, '#ffd700');
  addStat('Targeting', TARGETING_LABELS[card.targeting] ?? card.targeting, '#88bbff');
  if (effectiveCost) {
    let costStr = '';
    let costColor = '#ffcc66';
    if (effectiveCost.stamina) { costStr = `-${effectiveCost.stamina} Stamina`; costColor = '#ff8c00'; }
    else if (effectiveCost.mana) { costStr = `-${effectiveCost.mana} Mana`; costColor = '#9966ff'; }
    else if (effectiveCost.defense) { costStr = `-${effectiveCost.defense} Defense`; costColor = '#6699ff'; }
    if (costStr) addStat('Cost', costStr, costColor);
  }

  // ── Dynamic panel height ──────────────────────────────
  // Height is determined by whichever column is taller.
  const contentBottom = Math.max(contentTop + CARD_IMG_H, yPos);
  const panelH = (contentBottom - panelTop) + 28;
  const py = panelTop + panelH / 2;
  const panelBot = panelTop + panelH;

  // Panel background and strip inserted at z=1/2 (behind content, above backdrop)
  const panel = scene.add.rectangle(px, py, panelW, panelH, 0x11111e, 0.97);
  panel.setStrokeStyle(3, rarityColor);
  popup.addAt(panel, 1);
  popup.addAt(scene.add.rectangle(px, panelTop + 4, panelW - 6, 8, catColor), 2);

  // Dismiss hint below panel
  popup.add(
    scene.add.text(px, panelBot + 16, 'Click anywhere to close', {
      fontSize: '11px', color: '#555566', fontFamily, fontStyle: 'italic',
    }).setOrigin(0.5),
  );

  tip = attachKeywordTooltip(scene, popup, effectiveDesc, { x: px, y: py, w: panelW, h: panelH });

  popup.setAlpha(0);
  scene.tweens.add({ targets: popup, alpha: 1, duration: 150, ease: 'Sine.easeOut' });

  return popup;
}
