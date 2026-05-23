// Reusable card visual component -- Phaser Container factory.
// Renders a card to match the standard-face spec in docs/CARD_AUDIT §1.1:
//   ┌───────────────────────────────┐
//   │ [⏱Ns]  [elem icons]  [cost]   │  ← header row
//   ├───────────────────────────────┤
//   │              ART              │
//   ├───────────────────────────────┤
//   │           NAME                │
//   └───────────────────────────────┘
//
// Standard face shows only the name in the info strip — the full prose body
// and per-stat rows live in the extended view (CardDetailPopup). The visual
// summary tokens described in §1.5 are deferred to a follow-up; this commit
// covers the header overhaul (cost/elements/cooldown placement).

import { getCardById } from '../data/DataLoader';
import { getRun } from '../state/RunState';
import { showCardDetail } from './CardDetailPopup';
import { attachKeywordHover } from './KeywordTooltip';
import { SCENE_KEYS } from '../state/SceneKeys';
import { ELEMENTS, type ElementId } from '../systems/ElementSystem';
import { formatCardDescription } from '../systems/cards/CardText';
import { getTokenStyle } from './IconTokens';
import type { CardCategory, CardCost, CardDefinition, CardEffect } from '../data/types';

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

  // Upgrade flag (used by name + cost overlay below).
  let isUpgraded = false;
  try {
    const run = getRun();
    isUpgraded = run.deck.active.some((id, i) => id === cardId && run.deck.upgraded[i]);
  } catch { /**/ }

  // ── Header strip (top): cooldown TL + cost block TR ──────────────────
  // Header is a darkened band at the top of the card. The art bleeds under
  // it (cut by the header at the middle-top), and a small padding row
  // separates the visible art from the header for breathing room.
  const HEADER_H = 38;
  const HEADER_TOP = -h / 2;                     // -120
  const HEADER_PAD = 4;
  const HEADER_BOTTOM_PAD = 6;                   // padding from top strip → visible art

  // ── Art zone: upsized to ~77% of card height ──────────────────────────
  // Art now bleeds across most of the card; the header overlay at the top
  // visually "cuts" the middle-top section. Bottom info strip is halved
  // (55 px instead of 110) so the art has room to breathe.
  const IMG_H = 185;
  const IMG_TOP = -h / 2;                        // -120
  const imgCenterY = IMG_TOP + IMG_H / 2;        // -27.5

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

  // Header backing — a solid darkened strip that "cuts" the top of the art.
  // The strip is opaque so the art bleeds under it but isn't visible there;
  // a HEADER_BOTTOM_PAD row of card-bg color sits right below the header,
  // creating a visible padding gap before the main art content appears.
  const hOverlay = scene.add.graphics();
  hOverlay.fillStyle(0x000000, 0.95);
  hOverlay.fillRect(-w / 2, HEADER_TOP, w, HEADER_H);
  // Padding strip — same bg color as the card so the art "starts" lower.
  hOverlay.fillStyle(CARD_BG, 1);
  hOverlay.fillRect(-w / 2, HEADER_TOP + HEADER_H, w, HEADER_BOTTOM_PAD);
  // Thin rarity-color line as a divider between header and padding.
  hOverlay.lineStyle(1, rarityColor, 0.7);
  hOverlay.lineBetween(-w / 2, HEADER_TOP + HEADER_H, w / 2, HEADER_TOP + HEADER_H);
  container.add(hOverlay);

  // Cooldown badge — TOP-LEFT. Scaled up to match the new 3× cost icons.
  const cooldown = getEffectiveCooldown(card);
  if (cooldown) {
    const cdW = 48, cdH = 22;
    const cdX = -w / 2 + HEADER_PAD;
    const cdY = HEADER_TOP + (HEADER_H - cdH) / 2;
    const cdBg = scene.add.graphics();
    cdBg.fillStyle(0x000000, 0.85);
    cdBg.fillRoundedRect(cdX, cdY, cdW, cdH, 4);
    cdBg.lineStyle(1, 0xaaaaaa, 0.7);
    cdBg.strokeRoundedRect(cdX, cdY, cdW, cdH, 4);
    container.add(cdBg);
    container.add(
      scene.add.text(cdX + cdW / 2, cdY + cdH / 2, `⏱ ${cooldown}s`, {
        fontSize: '13px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5),
    );
  }

  // (Elements are rendered in the bottom info strip below the name — see
  // below. The header just hosts cooldown + cost block.)
  const elems = ((card.elements ?? []) as ElementId[]).filter((e) => !!ELEMENTS[e]);

  // Cost block — TOP-RIGHT. Stacks vertically; each row is `quantity[icon]`.
  // Pulls from card.cost (stamina/mana/defense), consume_stack effects, the
  // top-level spend_armor flag, and exhaust. See CARD_AUDIT §1.2.
  //
  // Icons sized 2.5× the previous 11 px = 27 px so they read clearly without
  // crowding the art. Value text is also 2.5× (was 9 px → now 22 px), bold
  // and colored to match the token's palette. Rows may extend below the
  // header band for high-cost cards (Marsh Squall, Tremor Detonate).
  const costRows = buildCostRows(card, isUpgraded);
  if (costRows.length > 0) {
    const rowFontSize = 22;
    const iconSize = 27;
    const rowLineHeight = iconSize + 2;
    const iconGap = 2;
    const rightEdge = w / 2 - HEADER_PAD;
    let rowY = HEADER_TOP + 4;
    for (const row of costRows) {
      const spriteKey = `icon_${row.token}`;
      const rowCenterY = rowY + iconSize / 2;
      if (scene.textures.exists(spriteKey)) {
        // Sprite path: icon on the right, colored qty text to its left.
        const iconX = rightEdge - iconSize / 2;
        const img = scene.add.image(iconX, rowCenterY, spriteKey);
        img.setDisplaySize(iconSize, iconSize);
        container.add(img);
        if (row.qty) {
          container.add(
            scene.add.text(iconX - iconSize / 2 - iconGap, rowCenterY, row.qty, {
              fontSize: `${rowFontSize}px`,
              fontFamily: 'monospace',
              fontStyle: 'bold',
              color: row.color,
              stroke: '#000000',
              strokeThickness: 4,
            }).setOrigin(1, 0.5),
          );
        }
      } else {
        // Fallback: colored caps label (legacy behavior, scaled up too).
        const rowTxt = scene.add.text(rightEdge, rowCenterY, `${row.qty}${row.fallbackLabel}`, {
          fontSize: `${rowFontSize}px`,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          color: row.color,
          stroke: '#000000',
          strokeThickness: 4,
        }).setOrigin(1, 0.5);
        container.add(rowTxt);
      }
      rowY += rowLineHeight;
    }
  }

  // ── Info strip: bottom — name on top, element row below ─────────
  // Halved (was 110 → now 55) so the upsized art has more room. Name sits
  // at the top of the strip; element row sits at the bottom.
  const INFO_TOP = IMG_TOP + IMG_H;              // -120 + 185 = 65
  const INFO_H = h / 2 - INFO_TOP;               // 120 - 65 = 55

  container.add(scene.add.rectangle(0, INFO_TOP + INFO_H / 2, w, INFO_H, 0x0a0a14, 0.95));

  const displayName = isUpgraded ? `${card.name}+` : card.name;

  // Name — top of info strip, centered horizontally, nudged up to give
  // breathing room between it and the element row.
  const nameY = INFO_TOP + 7;
  container.add(
    scene.add.text(0, nameY, displayName, {
      fontSize: '12px', fontStyle: 'bold', fontFamily: 'monospace',
      color: isUpgraded ? '#ffd700' : '#ffffff',
      stroke: '#000000', strokeThickness: 3,
      align: 'center',
      wordWrap: { width: w - 8 },
    }).setOrigin(0.5, 0.5),
  );

  // Element badges — bottom-middle of info strip. Sized at 2× the original
  // 12 px = 24 px per user spec (smaller than the cost icons so they don't
  // crowd the name).
  if (elems.length > 0) {
    const elemSize = 24;
    const elemGap = 3;
    const rowW = elems.length * elemSize + (elems.length - 1) * elemGap;
    let elemX = -rowW / 2 + elemSize / 2;
    const elemY = INFO_TOP + INFO_H - elemSize / 2 - 3;
    for (const e of elems) {
      const spriteKey = scene.textures.exists(`icon_${e}`)
        ? `icon_${e}`
        : scene.textures.exists(`elem_${e}`)
          ? `elem_${e}`
          : null;
      if (spriteKey) {
        const img = scene.add.image(elemX, elemY, spriteKey);
        img.setDisplaySize(elemSize, elemSize);
        container.add(img);
      } else {
        const elemColor = parseInt(ELEMENTS[e].color.replace('#', ''), 16);
        container.add(
          scene.add.circle(elemX, elemY, elemSize / 2, elemColor)
            .setStrokeStyle(2, 0xffffff, 0.7),
        );
      }
      elemX += elemSize + elemGap;
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
  // v4: render through the dynamic formatter so static cards.json descriptions
  // and the live UI can never diverge. Honors per-position upgrade by swapping
  // in card.upgraded.effects when the upgrade flag is set.
  const effects = (isUpgraded && card.upgraded?.effects) ? card.upgraded.effects : card.effects;
  return formatCardDescription({
    effects,
    exhaust: card.exhaust,
    spend_armor: card.spend_armor,
    cooldown_scale: card.cooldown_scale,
  });
}

function getEffectiveCooldown(card: CardDefinition): number | undefined {
  if (card.upgraded && card.upgraded.cooldown !== undefined) return card.upgraded.cooldown;
  return card.cooldown;
}

// Per-stack display palette so the main label matches the keyword color
// used elsewhere in the UI (status DoTs and keyword tooltip). Re-exported
// for legacy call sites; IconTokens.TOKEN_STYLES is the authoritative
// source of truth for the broader palette.
export const STACK_DISPLAY: Record<string, { label: string; color: string }> = {
  burn:   { label: 'BURN',   color: '#ff8c00' },
  bleed:  { label: 'BLEED',  color: '#ff5555' },
  poison: { label: 'POISON', color: '#88dd55' },
  slow:   { label: 'SLOW',   color: '#66ccff' },
  stun:   { label: 'STUN',   color: '#cccccc' },
  rage:   { label: 'RAGE',   color: '#ff7733' },
};

/**
 * Build the cost block rows for the standard face header (top-right).
 * Each row is `quantity[token]` rendered as bracket-stripped caps (BURN, STAM,
 * etc.). Sources:
 *   - card.cost.stamina / .mana / .defense  → numeric resource cost
 *   - effect with consume_stack:true + negative value → N[stack] or X[stack]
 *   - card.spend_armor → N[armor] or X[armor]
 *   - card.exhaust → [exhaust] badge (no quantity)
 */
interface CostRow {
  /** Token id, e.g. "stam", "burn", "exhaust" — used to look up `icon_<token>`. */
  token: string;
  /** Quantity rendered to the LEFT of the icon (empty string for badge-only). */
  qty: string;
  /** Fallback label used when no `icon_<token>` texture is loaded. */
  fallbackLabel: string;
  /** Fallback color matching the token style. */
  color: string;
}

function buildCostRows(card: CardDefinition, isUpgraded: boolean): CostRow[] {
  const rows: CostRow[] = [];
  const cost: CardCost | undefined = isUpgraded && card.upgraded?.cost ? card.upgraded.cost : card.cost;
  const effects = isUpgraded && card.upgraded?.effects ? card.upgraded.effects : card.effects;

  const push = (qty: string | number, token: string) => {
    const style = getTokenStyle(token);
    if (!style) return;
    rows.push({ token, qty: String(qty), fallbackLabel: style.label, color: style.color });
  };

  // Resource costs from card.cost (numeric — no "all" semantics here).
  if (cost?.stamina) push(cost.stamina, 'stam');
  if (cost?.mana) push(cost.mana, 'mana');
  if (cost?.defense) push(cost.defense, 'defense');

  // Stack consumptions from effects (consume_stack: true + value < 0).
  if (effects) {
    for (const fx of effects as CardEffect[]) {
      if (fx.type !== 'stack' || !fx.consume_stack || !fx.stack) continue;
      const amount = Math.abs(fx.value);
      const qty = amount >= 99 ? 'X' : String(amount);
      push(qty, fx.stack);
    }
  }

  // Card-level armor spend (Citadel Inferno style detonators).
  if (card.spend_armor !== undefined) {
    const qty = card.spend_armor === 'all' ? 'X' : String(card.spend_armor);
    push(qty, 'armor');
  }

  // Exhaust badge — no quantity, just the token glyph.
  if (card.exhaust) {
    const style = getTokenStyle('exhaust');
    if (style) rows.push({ token: 'exhaust', qty: '', fallbackLabel: style.label, color: style.color });
  }

  return rows;
}
