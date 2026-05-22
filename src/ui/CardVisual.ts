// Reusable card visual component -- Phaser Container factory.
// Renders a card to match the detailed mock-up with headers, images, cooldowns, and effects.

import { getCardById } from '../data/DataLoader';
import { getRun } from '../state/RunState';
import { showCardDetail } from './CardDetailPopup';
import { attachKeywordHover } from './KeywordTooltip';
import { SCENE_KEYS } from '../state/SceneKeys';
import { ELEMENTS, type ElementId } from '../systems/ElementSystem';
import type { CardCategory, CardDefinition } from '../data/types';

// ── Constants ─────────────────────────────────────────

const RARITY_COLORS: Record<string, number> = {
  common: 0x888888,
  uncommon: 0x2e8b57,
  rare: 0x0044cc,
  epic: 0x9400d3,
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

  // Base Background
  const bg = scene.add.rectangle(0, 0, w, h, CARD_BG);
  // Optional outer rim glow
  bg.setStrokeStyle(2, rarityColor);
  container.add(bg);

  if (!card) return container;

  const iconEmoji = CATEGORY_EMOJIS[card.category] || '❓';

  // ── Art zone: top 80% of card ─────────────────────────
  const IMG_H = Math.round(h * 0.8);        // 192 px
  const IMG_TOP = -h / 2;                    // -120
  const imgCenterY = IMG_TOP + IMG_H / 2;   // -24

  // Dark base (shown when no texture is loaded)
  container.add(scene.add.rectangle(0, imgCenterY, w, IMG_H, 0x111118));

  // Card image fills the full art zone
  const imgKey = `card_${card.id}`;
  if (scene.textures.exists(imgKey)) {
    const img = scene.add.image(0, imgCenterY, imgKey);
    img.setDisplaySize(w, IMG_H);
    container.add(img);
  } else {
    container.add(
      scene.add.text(0, imgCenterY, iconEmoji, { fontSize: '48px', color: '#ffffff' })
        .setOrigin(0.5)
        .setAlpha(0.6),
    );
  }

  // Soft gradient at the bottom of the art so the info strip text is legible
  const gOverlay = scene.add.graphics();
  gOverlay.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.75, 0.75);
  gOverlay.fillRect(-w / 2, IMG_TOP + IMG_H - 36, w, 36);
  container.add(gOverlay);

  // Element dots — top-left corner overlay
  const elems = ((card.elements ?? []) as ElementId[]).filter((e) => !!ELEMENTS[e]);
  if (elems.length > 0) {
    const dotR = 4;
    const dotGap = 3;
    let dotX = -w / 2 + 8 + dotR;
    const dotY = IMG_TOP + 12;
    for (const e of elems) {
      const elemColor = parseInt(ELEMENTS[e].color.replace('#', ''), 16);
      container.add(scene.add.circle(dotX, dotY, dotR, elemColor).setStrokeStyle(1, 0xffffff, 0.5));
      dotX += dotR * 2 + dotGap;
    }
  }

  // Rarity label — top-right corner overlay
  const rarityHex = '#' + rarityColor.toString(16).padStart(6, '0');
  container.add(
    scene.add.text(w / 2 - 5, IMG_TOP + 5, (card.rarity || 'common').toUpperCase(), {
      fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold',
      color: rarityHex, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0),
  );

  // Cooldown badge — bottom-right of art zone
  const cooldown = getEffectiveCooldown(card);
  if (cooldown) {
    const cdW = 36, cdH = 16;
    const cdX = w / 2 - cdW - 4;
    const cdY = IMG_TOP + IMG_H - cdH - 4;
    const cdBg = scene.add.graphics();
    cdBg.fillStyle(0x000000, 0.8);
    cdBg.fillRoundedRect(cdX, cdY, cdW, cdH, 4);
    cdBg.lineStyle(1, 0xaaaaaa, 0.6);
    cdBg.strokeRoundedRect(cdX, cdY, cdW, cdH, 4);
    container.add(cdBg);
    container.add(
      scene.add.text(cdX + cdW / 2, cdY + cdH / 2, `⏱ ${cooldown}s`, {
        fontSize: '9px', color: '#ffffff',
      }).setOrigin(0.5),
    );
  }

  // ── Info strip: bottom 20% (48 px) ────────────────────
  const INFO_TOP = IMG_TOP + IMG_H;           // 72
  const INFO_H = h / 2 - INFO_TOP;           // 48
  const infoCenterY = INFO_TOP + INFO_H / 2; // 96

  container.add(scene.add.rectangle(0, infoCenterY, w, INFO_H, 0x0a0a14, 0.92));

  // Upgraded state
  let isUpgraded = false;
  try {
    const run = getRun();
    isUpgraded = run.deck.active.some((id, i) => id === cardId && run.deck.upgraded[i]);
  } catch { /**/ }
  const displayName = isUpgraded ? `${card.name}+` : card.name;

  // Card name
  container.add(
    scene.add.text(0, INFO_TOP + 6, displayName, {
      fontSize: '12px', fontStyle: 'bold', fontFamily: 'monospace',
      color: isUpgraded ? '#ffd700' : '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0),
  );

  // Main effect value (e.g. "4 DMG")
  const mainEff = getMainEffect(card, isUpgraded);
  if (mainEff) {
    container.add(
      scene.add.text(0, INFO_TOP + 22, `${mainEff.val} ${mainEff.label}`, {
        fontSize: '13px', fontStyle: 'bold', fontFamily: 'monospace',
        color: mainEff.color, stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 0),
    );
  }

  // Cost (compact)
  const cost = isUpgraded && card.upgraded?.cost ? card.upgraded.cost : card.cost;
  if (cost) {
    const costParts: string[] = [];
    if (cost.mana) costParts.push(`-${cost.mana} MP`);
    if (cost.defense) costParts.push(`-${cost.defense} DEF`);
    if (cost.stamina) costParts.push(`-${cost.stamina} STA`);
    if (costParts.length > 0) {
      container.add(
        scene.add.text(0, INFO_TOP + 36, costParts.join('  '), {
          fontSize: '9px', fontFamily: 'monospace',
          color: '#ffcc66', stroke: '#000000', strokeThickness: 1,
        }).setOrigin(0.5, 0),
      );
    }
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

  // Keyword glossary tooltip on 2-second hover. Skipped in CombatScene —
  // cards play automatically there and a wide hover panel would clutter the
  // battle view. Tooltip self-destroys on pointerout and on container
  // destroy, so no lifecycle hook is needed at the call site.
  if (scene.scene.key !== SCENE_KEYS.COMBAT && card) {
    const effectiveDesc = getEffectiveDesc(card, false);
    attachKeywordHover(scene, container, effectiveDesc, {
      x, y, w: w * scale, h: h * scale,
    });
  }

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

// Per-stack display palette so the main label matches the keyword color
// used elsewhere in the UI (status DoTs and keyword tooltip).
const STACK_DISPLAY: Record<string, { label: string; color: string }> = {
  burn:   { label: 'BURN',   color: '#ff8c00' },
  bleed:  { label: 'BLEED',  color: '#ff5555' },
  poison: { label: 'POISON', color: '#88dd55' },
  slow:   { label: 'SLOW',   color: '#66ccff' },
  stun:   { label: 'STUN',   color: '#cccccc' },
  rage:   { label: 'RAGE',   color: '#ff7733' },
};

function getMainEffect(card: CardDefinition, isUpgraded: boolean) {
  const effects = isUpgraded && card.upgraded?.effects ? card.upgraded.effects : card.effects;
  if (!effects || effects.length === 0) return null;
  const primary = effects[0];

  switch (primary.type) {
    case 'damage': return { val: primary.value, label: 'DMG', color: '#ff6666' };
    case 'armor':  return { val: primary.value, label: 'ARM', color: '#66bbff' };
    case 'heal':   return { val: primary.value, label: 'HP',  color: '#66ff66' };
    case 'mana':   return { val: primary.value, label: 'MP',  color: '#cc66ff' };
    case 'stamina':return { val: primary.value, label: 'STA', color: '#ffcc66' };
    case 'dot':
    case 'stack': {
      // Use the named stack (Burn/Bleed/Poison/Slow/Stun/Rage) as the label
      // rather than the raw effect type. "DOT" by itself is meaningless to the
      // player; the stack name reads as the card's intent.
      const stack = (primary as { stack?: string }).stack;
      if (stack && STACK_DISPLAY[stack]) return { val: primary.value, ...STACK_DISPLAY[stack] };
      return { val: primary.value, label: 'STACK', color: '#ffffff' };
    }
    case 'cleanse': return { val: primary.value, label: 'CLEAR', color: '#ffffff' };
    case 'aura':    return { val: primary.value, label: 'AURA',  color: '#bb99ff' };
  }
  return { val: primary.value, label: primary.type.toUpperCase(), color: '#ffffff' };
}
