// CardDetailPopup -- full-screen overlay showing enlarged card with all details.
// Triggered by clicking any card visual in the game.

import Phaser from 'phaser';
import { getCardById } from '../data/DataLoader';
import { getRun } from '../state/RunState';
import { FONTS } from './StyleConstants';
import { createDelayedBackdrop } from './Backdrop';
import { attachKeywordTooltip } from './KeywordTooltip';
import { hideFilterBarInputs, showFilterBarInputs } from './FilterBarVisibility';
import { formatCardDescription } from '../systems/cards/CardText';
import { ELEMENTS, type ElementId } from '../systems/ElementSystem';
import { getTokenStyle, renderTokenText } from './IconTokens';
import type { CardCategory, CardCost, CardDefinition, CardEffect } from '../data/types';

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
  const effectiveCooldown = (isUpgraded && card.upgraded?.cooldown != null) ? card.upgraded.cooldown : card.cooldown;
  const effectiveCost = (isUpgraded && card.upgraded?.cost) ? card.upgraded.cost : card.cost;
  const effectiveEffects = (isUpgraded && card.upgraded?.effects) ? card.upgraded.effects : card.effects;
  // v4: render description through dynamic formatter so the popup matches the
  // card visual exactly (no chance of static text drifting from real effects).
  const effectiveDesc = formatCardDescription({
    effects: effectiveEffects,
    exhaust: card.exhaust,
    spend_armor: card.spend_armor,
    cooldown_scale: card.cooldown_scale,
  });

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
  // Left column: card art at natural proportions (150×192), with the standard
  // face's header strip drawn above it. Right column: text info.
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

  // ── Left column: card visual, full unoccluded art ──────
  // Unlike the standard face (CardVisual) which overlays the header on the
  // art for space, the popup has plenty of room — the header strip sits
  // ABOVE the art so the art renders clean, full-size, no cuts.
  const HEADER_H = 38;
  const HEADER_BOTTOM_PAD = 6;
  const ELEM_STRIP_H = 32;
  const headerTop = contentTop;
  const imgTop = contentTop + HEADER_H + HEADER_BOTTOM_PAD;
  const imgCY = imgTop + CARD_IMG_H / 2;

  // Art frame backing.
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
  artBorder.strokeRect(leftColCX - CARD_IMG_W / 2 - 2, imgTop - 2, CARD_IMG_W + 4, CARD_IMG_H + 4);
  popup.add(artBorder);

  // Header strip — cooldown (left) + cost rows (right). Elements moved to
  // a bottom strip below the art.
  drawHeaderStrip(scene, popup, {
    centerX: leftColCX,
    top: headerTop,
    width: CARD_IMG_W,
    height: HEADER_H,
    bottomPad: HEADER_BOTTOM_PAD,
    rarityColor,
    cooldown: effectiveCooldown,
    costRows: buildCostRows(card, isUpgraded),
  });

  // Element badges — bottom strip beneath the art, 2× original = 24 px each.
  const elems = ((card.elements ?? []) as ElementId[]).filter((e) => !!ELEMENTS[e]);
  if (elems.length > 0) {
    const elemStripTop = imgTop + CARD_IMG_H + 2;
    const elemSize = 24;
    const elemGap = 3;
    const rowW = elems.length * elemSize + (elems.length - 1) * elemGap;
    let elemX = leftColCX - rowW / 2 + elemSize / 2;
    const elemY = elemStripTop + ELEM_STRIP_H / 2;
    for (const e of elems) {
      const spriteKey = scene.textures.exists(`icon_${e}`)
        ? `icon_${e}`
        : scene.textures.exists(`elem_${e}`)
          ? `elem_${e}`
          : null;
      if (spriteKey) {
        const img = scene.add.image(elemX, elemY, spriteKey);
        img.setDisplaySize(elemSize, elemSize);
        popup.add(img);
      } else {
        const elemColor = parseInt(ELEMENTS[e].color.replace('#', ''), 16);
        popup.add(
          scene.add.circle(elemX, elemY, elemSize / 2, elemColor)
            .setStrokeStyle(2, 0xffffff, 0.7),
        );
      }
      elemX += elemSize + elemGap;
    }
  }

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

  // Description body — runs through renderTokenText so bracketed icon tokens
  // (e.g. `[burn]`, `[str]`) render in their palette color. When the source
  // string contains no brackets (current CardText output is human prose), the
  // helper degrades to a plain colored line.
  const descContainer = renderTokenText(scene, rightColLeft, yPos, effectiveDesc, {
    fontSize: '13px', color: '#bbbbcc', fontFamily,
    wrapWidth: rightColW - 4,
    align: 'center', lineSpacing: 3,
  });
  popup.add(descContainer);
  const descHeight = (descContainer.getData('tokenTextHeight') as number | undefined) ?? 0;
  yPos += descHeight + 12;

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
  // Left column footprint: art (with header overlaying its top) plus the
  // element strip below the art. Effective bottom is art top + art height +
  // element strip height (when elements exist).
  const elemStripHeight = elems.length > 0 ? ELEM_STRIP_H + 2 : 0;
  const leftColBottom = imgTop + CARD_IMG_H + elemStripHeight;
  const contentBottom = Math.max(leftColBottom, yPos);
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

// ─── Shared helpers (mirror CardVisual's standard-face header) ──────────────

interface HeaderStripOpts {
  centerX: number;
  top: number;
  width: number;
  height: number;
  bottomPad: number;
  rarityColor: number;
  cooldown?: number;
  costRows: CostRow[];
}

/**
 * Renders the popup header — cooldown badge (top-left) + cost block (top-
 * right) — into a parent container. Sits ABOVE the art (not overlaying it),
 * since the popup has plenty of vertical space.
 *
 * The header runs against the panel's own dark background, so no extra
 * backing fill is needed — just the badges and a rarity-color divider line.
 */
function drawHeaderStrip(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  opts: HeaderStripOpts,
): void {
  const HEADER_PAD = 4;
  const leftX = opts.centerX - opts.width / 2;
  const rightX = opts.centerX + opts.width / 2 - HEADER_PAD;
  void opts.bottomPad;  // no longer drawn; kept in the interface for back-compat

  // Thin rarity-color divider below the header so the eye gets a clean
  // separation between cost/cooldown badges and the art beneath.
  const divider = scene.add.graphics();
  divider.lineStyle(1, opts.rarityColor, 0.6);
  divider.lineBetween(leftX, opts.top + opts.height, leftX + opts.width, opts.top + opts.height);
  parent.add(divider);

  // Cooldown badge — top-left (48×22, 13 px label)
  if (opts.cooldown) {
    const cdW = 48, cdH = 22;
    const cdX = leftX + HEADER_PAD;
    const cdY = opts.top + (opts.height - cdH) / 2;
    const cdBg = scene.add.graphics();
    cdBg.fillStyle(0x000000, 0.85);
    cdBg.fillRoundedRect(cdX, cdY, cdW, cdH, 4);
    cdBg.lineStyle(1, 0xaaaaaa, 0.7);
    cdBg.strokeRoundedRect(cdX, cdY, cdW, cdH, 4);
    parent.add(cdBg);
    parent.add(
      scene.add.text(cdX + cdW / 2, cdY + cdH / 2, `⏱ ${opts.cooldown}s`, {
        fontSize: '13px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5),
    );
  }

  // Cost rows — top-right (27 px sprite icon + 22 px colored qty text)
  const iconSize = 27;
  const rowLineHeight = iconSize + 2;
  const iconGap = 2;
  let rowY = opts.top + 4;
  for (const row of opts.costRows) {
    const spriteKey = `icon_${row.token}`;
    const rowCenterY = rowY + iconSize / 2;
    if (scene.textures.exists(spriteKey)) {
      const iconX = rightX - iconSize / 2;
      const img = scene.add.image(iconX, rowCenterY, spriteKey);
      img.setDisplaySize(iconSize, iconSize);
      parent.add(img);
      if (row.qty) {
        parent.add(
          scene.add.text(iconX - iconSize / 2 - iconGap, rowCenterY, row.qty, {
            fontSize: '22px',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            color: row.color,
            stroke: '#000000',
            strokeThickness: 4,
          }).setOrigin(1, 0.5),
        );
      }
    } else {
      // Fallback: colored caps label.
      parent.add(
        scene.add.text(rightX, rowCenterY, `${row.qty}${row.fallbackLabel}`, {
          fontSize: '22px',
          fontFamily: 'monospace',
          fontStyle: 'bold',
          color: row.color,
          stroke: '#000000',
          strokeThickness: 4,
        }).setOrigin(1, 0.5),
      );
    }
    rowY += rowLineHeight;
  }
}

interface CostRow {
  token: string;
  qty: string;
  fallbackLabel: string;
  color: string;
}

/**
 * Build the cost block rows for a card (mirrors CardVisual.buildCostRows).
 * Returns the token id so the renderer can prefer `icon_<token>` sprites and
 * fall back to colored caps text when no sprite is loaded.
 */
function buildCostRows(card: CardDefinition, isUpgraded: boolean): CostRow[] {
  const rows: CostRow[] = [];
  const cost: CardCost | undefined = isUpgraded && card.upgraded?.cost ? card.upgraded.cost : card.cost;
  const effects = isUpgraded && card.upgraded?.effects ? card.upgraded.effects : card.effects;

  const push = (qty: string | number, token: string) => {
    const style = getTokenStyle(token);
    if (!style) return;
    rows.push({ token, qty: String(qty), fallbackLabel: style.label, color: style.color });
  };

  if (cost?.stamina) push(cost.stamina, 'stam');
  if (cost?.mana) push(cost.mana, 'mana');
  if (cost?.defense) push(cost.defense, 'defense');

  if (effects) {
    for (const fx of effects as CardEffect[]) {
      if (fx.type !== 'stack' || !fx.consume_stack || !fx.stack) continue;
      const amount = Math.abs(fx.value);
      const qty = amount >= 99 ? 'X' : String(amount);
      push(qty, fx.stack);
    }
  }

  if (card.spend_armor !== undefined) {
    const qty = card.spend_armor === 'all' ? 'X' : String(card.spend_armor);
    push(qty, 'armor');
  }

  if (card.exhaust) {
    const style = getTokenStyle('exhaust');
    if (style) rows.push({ token: 'exhaust', qty: '', fallbackLabel: style.label, color: style.color });
  }

  return rows;
}
