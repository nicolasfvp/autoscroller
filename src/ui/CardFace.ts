// Unified card face renderer.
//
// Every card visual in the game (in-hand, deckbuilder, library, popup, etc.)
// routes through this module. The mold is drawn entirely with Phaser
// graphics (NOT a sprite), so frame and overlays share the same coordinate
// system — slot positions cannot drift from where the slot rectangles are
// actually painted. Colors and proportions are inspired by Slay the Spire.
//
// Callers pass a base pixel size; the user's `metaState.cardScale` setting
// (range 0.75–1.25) is then multiplied in.

import { getCardById } from '../data/DataLoader';
import { getMetaStateSync } from '../systems/MetaPersistence';
import { ELEMENTS, resolveIconKey, type ElementId } from '../systems/ElementSystem';
import { formatCardDescription } from '../systems/cards/CardText';
import { getTokenStyle, renderTokenText } from './IconTokens';
import { getRun } from '../state/RunState';
import { getEffectiveStats, isShiftHeld, subscribeCardDynamic } from './CardDynamic';
import type { CardCost, CardDefinition, CardEffect } from '../data/types';

// ── Color palette (STS-inspired warm dark leather) ───────────────────────
const COLOR = {
  BODY: 0x241f1a,
  BORDER: 0x8a7548,
  HEADER_BG: 0x2e2620,
  SLOT_OUTLINE: 0x8a7548,
  SLOT_FILL_DARK: 0x141010,
  ART_BG: 0x0d0a08,
  ART_INNER_STROKE: 0x5a4a30,
  NAME_BANNER: 0xd4c5a0,
  NAME_BANNER_DIVIDER: 0x6b5a3a,
  NAME_TEXT_DARK: 0x2a1f10,
  NAME_TEXT_UPG: 0x7a4a10,
  DESC_PANEL: 0x1c1815,
  DESC_BORDER: 0x6b5a3a,
  DESC_TEXT: 0xd4c8a8,
} as const;

// ── Layout proportions (percent of card width/height) ────────────────────
// Single source of truth — used both to PAINT the mold and to POSITION the
// overlays. Tweaking any of these moves both at once, no drift possible.
const PAD = 0.03;        // outer padding to leave the border breathing room
const HEADER_H = 0.13;
const HEADER_GAP_BELOW = 0.015;
const ART_H = 0.36;
const ART_GAP_BELOW = 0.015;
const NAME_H = 0.085;
const NAME_GAP_BELOW = 0.015;
const ELEM_H = 0.075;
const ELEM_GAP_BELOW = 0.015;
// Description fills the rest down to PAD bottom margin.

const HEADER_TOP_PCT = PAD;
const HEADER_BOTTOM_PCT = HEADER_TOP_PCT + HEADER_H;
const ART_TOP_PCT = HEADER_BOTTOM_PCT + HEADER_GAP_BELOW;
const ART_BOTTOM_PCT = ART_TOP_PCT + ART_H;
const NAME_TOP_PCT = ART_BOTTOM_PCT + ART_GAP_BELOW;
const NAME_BOTTOM_PCT = NAME_TOP_PCT + NAME_H;
const ELEM_TOP_PCT = NAME_BOTTOM_PCT + NAME_GAP_BELOW;
const ELEM_BOTTOM_PCT = ELEM_TOP_PCT + ELEM_H;
const DESC_TOP_PCT = ELEM_BOTTOM_PCT + ELEM_GAP_BELOW;
const DESC_BOTTOM_PCT = 1 - PAD;

const SIDE_PAD_PCT = PAD;     // horizontal slot inset

// Header sub-slot widths (primary / secondary / cooldown) in % of card width.
const PRIMARY_LEFT_PCT = SIDE_PAD_PCT;
const PRIMARY_RIGHT_PCT = 0.24;
const SECONDARY_LEFT_PCT = 0.27;
const SECONDARY_RIGHT_PCT = 0.73;
const COOLDOWN_LEFT_PCT = 0.76;
const COOLDOWN_RIGHT_PCT = 1 - SIDE_PAD_PCT;

// ── Base sizes ───────────────────────────────────────────────────────────
export const CARD_BASE_SIZES = {
  small: { w: 150, h: 240 },
  medium: { w: 220, h: 352 },
  popup: { w: 340, h: 540 },
} as const;

export type CardBaseSize = keyof typeof CARD_BASE_SIZES;

export const STANDARD_CARD_WIDTH = CARD_BASE_SIZES.small.w;
export const STANDARD_CARD_HEIGHT = CARD_BASE_SIZES.small.h;

export interface CardFaceOptions {
  baseSize?: CardBaseSize | { w: number; h: number };
  scale?: number;
  hover?: boolean;
  onClick?: (() => void) | true;
  upgraded?: boolean;
}

interface SlotBox { x: number; y: number; w: number; h: number; cx: number; cy: number }

/**
 * Disable click/hover input on a card visual produced by createCardFace.
 * Clears pointer listeners (popup, hover) and removes interactivity.
 */
export function disableCardFaceInput(visual: Phaser.GameObjects.Container): void {
  visual.removeAllListeners('pointerdown');
  visual.removeAllListeners('pointerup');
  visual.removeAllListeners('pointerover');
  visual.removeAllListeners('pointerout');
  visual.removeAllListeners('pointermove');
  if (visual.input) visual.disableInteractive();
}

/**
 * Render a card face as a Phaser Container at the given world position.
 */
export function createCardFace(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cardId: string,
  options: CardFaceOptions = {},
): Phaser.GameObjects.Container {
  const card = getCardById(cardId);
  const container = scene.add.container(x, y);
  if (!card) return container;

  const base = typeof options.baseSize === 'object'
    ? options.baseSize
    : CARD_BASE_SIZES[options.baseSize ?? 'small'];

  let userScale = 1;
  try { userScale = getMetaStateSync().cardScale ?? 1; } catch { /**/ }
  const finalScale = (options.scale ?? 1) * userScale;
  const w = base.w * finalScale;
  const h = base.h * finalScale;
  const isUpgraded = options.upgraded ?? resolveUpgradeFlag(cardId);

  // Build slot rectangles in container-local coords (origin = center of card).
  const pctX = (p: number) => -w / 2 + p * w;
  const pctY = (p: number) => -h / 2 + p * h;
  const slot = (lP: number, tP: number, rP: number, bP: number): SlotBox => ({
    x: pctX(lP),
    y: pctY(tP),
    w: (rP - lP) * w,
    h: (bP - tP) * h,
    cx: pctX((lP + rP) / 2),
    cy: pctY((tP + bP) / 2),
  });

  const primarySlot   = slot(PRIMARY_LEFT_PCT,   HEADER_TOP_PCT, PRIMARY_RIGHT_PCT,   HEADER_BOTTOM_PCT);
  const secondarySlot = slot(SECONDARY_LEFT_PCT, HEADER_TOP_PCT, SECONDARY_RIGHT_PCT, HEADER_BOTTOM_PCT);
  const cooldownSlot  = slot(COOLDOWN_LEFT_PCT,  HEADER_TOP_PCT, COOLDOWN_RIGHT_PCT,  HEADER_BOTTOM_PCT);

  // Layout choice is baseSize-driven (not per-card measure). Mixing per-card
  // fit checks gave inconsistent silhouettes — long-desc cards (Pyre) stayed
  // compact even in the popup, and short-desc cards (Quickstep) showed a
  // description panel even in the small queue thumbnail. Rule:
  //   - small  → compact (no description panel; art swallows the bottom)
  //   - medium → full (with description)
  //   - popup  → full (with description)
  const trialDescSlot = slot(SIDE_PAD_PCT, DESC_TOP_PCT, 1 - SIDE_PAD_PCT, DESC_BOTTOM_PCT);
  const sizeKey = typeof options.baseSize === 'string' ? options.baseSize : 'small';
  const descFits = sizeKey !== 'small' && hasDescription(card, isUpgraded);

  let artSlot: SlotBox;
  let nameSlot: SlotBox;
  let elemSlot: SlotBox;
  let descSlot: SlotBox | null;

  if (descFits) {
    artSlot  = slot(SIDE_PAD_PCT, ART_TOP_PCT,  1 - SIDE_PAD_PCT, ART_BOTTOM_PCT);
    nameSlot = slot(SIDE_PAD_PCT, NAME_TOP_PCT, 1 - SIDE_PAD_PCT, NAME_BOTTOM_PCT);
    elemSlot = slot(SIDE_PAD_PCT, ELEM_TOP_PCT, 1 - SIDE_PAD_PCT, ELEM_BOTTOM_PCT);
    descSlot = trialDescSlot;
  } else {
    // Bottom-anchor name + elem; art swallows everything between header and name.
    const elemBottomPct = 1 - PAD;
    const elemTopPct    = elemBottomPct - ELEM_H;
    const nameBottomPct = elemTopPct - ELEM_GAP_BELOW;
    const nameTopPct    = nameBottomPct - NAME_H;
    const artBottomPct  = nameTopPct - NAME_GAP_BELOW;
    artSlot  = slot(SIDE_PAD_PCT, ART_TOP_PCT, 1 - SIDE_PAD_PCT, artBottomPct);
    nameSlot = slot(SIDE_PAD_PCT, nameTopPct,  1 - SIDE_PAD_PCT, nameBottomPct);
    elemSlot = slot(SIDE_PAD_PCT, elemTopPct,  1 - SIDE_PAD_PCT, elemBottomPct);
    descSlot = null;
  }

  // ─── 1. Paint the mold (body, header band, slot outlines, banner, panel) ───
  paintMold(scene, container, w, h, finalScale, {
    primarySlot, secondarySlot, cooldownSlot, artSlot, nameSlot, elemSlot, descSlot,
  });

  // ─── 2. Overlays — same coords as the painted slots ──────────────────────
  drawPrimaryCost(scene, container, card, isUpgraded, primarySlot);
  drawSecondaryCosts(scene, container, card, isUpgraded, secondarySlot);
  drawCooldown(scene, container, card, isUpgraded, cooldownSlot);
  // Cover-fit center crop for every size. The small in-hand slot is nearly
  // 1:1 so the square source is shown almost in full; the wider popup slot
  // crops top/bottom to fill horizontally (action stays in view because all
  // generated art is composed with the action dead-center).
  drawArt(scene, container, card, artSlot);
  drawName(scene, container, card, isUpgraded, nameSlot);
  drawElements(scene, container, card, elemSlot);
  if (descSlot) drawDescription(scene, container, card, isUpgraded, descSlot, finalScale);

  // ─── 3. Interactivity ────────────────────────────────────────────────────
  // Container is sized w × h with hard-coded originX/Y = 0.5 (see Phaser's
  // Container source). At hit-test time Phaser computes the pointer's
  // container-local position via the inverse transform and then NORMALIZES
  // it by adding (displayOriginX, displayOriginY) = (w/2, h/2). So a pointer
  // sitting on the visible center of the card maps to (w/2, h/2) in the
  // coordinate space the hit area is tested in — not (0, 0).
  //
  // The hit area Rectangle must therefore be (0, 0, w, h), NOT centered.
  // The previous (-w/2, -h/2, w, h) form caught only the top-left quadrant
  // because after the origin-shift its valid range was (0, 0) ↔ (w/2, h/2).
  container.setSize(w, h);
  if (options.onClick !== undefined || options.hover !== false) {
    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      cursor: 'pointer',
    });
  }
  if (options.hover !== false) attachHover(scene, container, y);
  if (options.onClick) {
    container.on('pointerdown', () => {
      if (typeof options.onClick === 'function') options.onClick();
    });
  }

  container.setData('cardId', cardId);
  container.setData('card', card);
  return container;
}

// ── Mold painter ─────────────────────────────────────────────────────────

interface MoldSlots {
  primarySlot: SlotBox; secondarySlot: SlotBox; cooldownSlot: SlotBox;
  artSlot: SlotBox; nameSlot: SlotBox; elemSlot: SlotBox; descSlot: SlotBox | null;
}

// Cache of RenderTexture backing-stores for our rasterized molds. Keyed by
// the same string the Phaser TextureManager stores under so we can quickly
// answer "did we already build this?" without re-parsing dimensions.
//
// Critical: each RenderTexture OWNS the canvas/WebGL surface that Phaser's
// saveTexture(key) registers as the named texture's source. If we destroyed
// the RT after saveTexture, the source pointer would dangle and any Image
// rendered later with that key would draw garbage. We therefore keep the RT
// alive for the lifetime of the page (it's off-display-list, so it doesn't
// participate in scene rendering or update — it's just a GPU-resident
// keep-alive).
const moldRenderTextures = new Map<string, Phaser.GameObjects.RenderTexture>();

function paintMold(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  w: number,
  h: number,
  scale: number,
  slots: MoldSlots,
): void {
  // The mold geometry (border, header band, slot frames, name banner, desc
  // panel) is purely a function of (w, h, scale, descFits). For a 164-card
  // library all cards share the same dimensions — without caching we'd
  // re-rasterize the same shape 164×. Cache it as a RenderTexture once per
  // distinct mold size and reuse via a cheap Image.
  const wi = Math.max(1, Math.round(w));
  const hi = Math.max(1, Math.round(h));
  const key = `__cardMold_${wi}x${hi}_s${scale.toFixed(2)}_d${slots.descSlot ? '1' : '0'}`;

  if (!moldRenderTextures.has(key) || !scene.textures.exists(key)) {
    rasterizeMold(scene, w, h, scale, slots, key);
  }

  // Image.setOrigin(0.5) matches the original center-anchored draw; the
  // texture spans wi×hi pixels which is identical to the body rect drawn
  // from (-w/2, -h/2) to (w/2, h/2) before this caching pass.
  const moldImg = scene.add.image(0, 0, key).setOrigin(0.5, 0.5);
  parent.add(moldImg);
}

function rasterizeMold(
  scene: Phaser.Scene,
  w: number,
  h: number,
  scale: number,
  slots: MoldSlots,
  key: string,
): void {
  // make.graphics (not add.graphics) keeps the Graphics off the display
  // list — we only need it as a draw source for the RenderTexture and don't
  // want it to flash on-screen for a frame.
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const borderW = Math.max(1.5, 2 * scale);
  const radius = Math.max(4, 8 * scale);

  // Body + outer border (coords match the original: -w/2..+w/2, -h/2..+h/2).
  g.fillStyle(COLOR.BODY, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  g.lineStyle(borderW, COLOR.BORDER, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);

  // Header band background
  const headerTop = -h / 2 + h * HEADER_TOP_PCT;
  const headerBottomY = -h / 2 + h * HEADER_BOTTOM_PCT;
  g.fillStyle(COLOR.HEADER_BG, 1);
  g.fillRect(-w / 2 + w * SIDE_PAD_PCT, headerTop, w * (1 - 2 * SIDE_PAD_PCT), headerBottomY - headerTop);

  // Header divider line
  g.lineStyle(1, COLOR.BORDER, 0.7);
  g.lineBetween(
    -w / 2 + w * SIDE_PAD_PCT, headerBottomY + (h * HEADER_GAP_BELOW) / 2,
    w / 2 - w * SIDE_PAD_PCT,  headerBottomY + (h * HEADER_GAP_BELOW) / 2,
  );

  // Header sub-slot outlines (primary / secondary / cooldown)
  const slotRadius = Math.max(2, 4 * scale);
  const outlineThin = Math.max(1, 1 * scale);
  g.lineStyle(outlineThin, COLOR.SLOT_OUTLINE, 0.7);
  for (const s of [slots.primarySlot, slots.secondarySlot, slots.cooldownSlot]) {
    g.strokeRoundedRect(s.x, s.y, s.w, s.h, slotRadius);
  }

  // Art frame — dark fill + inner stroke
  g.fillStyle(COLOR.ART_BG, 1);
  g.fillRoundedRect(slots.artSlot.x, slots.artSlot.y, slots.artSlot.w, slots.artSlot.h, slotRadius);
  g.lineStyle(outlineThin, COLOR.ART_INNER_STROKE, 1);
  g.strokeRoundedRect(slots.artSlot.x, slots.artSlot.y, slots.artSlot.w, slots.artSlot.h, slotRadius);

  // Name banner — parchment cream strip with bronze dividers
  g.fillStyle(COLOR.NAME_BANNER, 1);
  g.fillRect(slots.nameSlot.x, slots.nameSlot.y, slots.nameSlot.w, slots.nameSlot.h);
  g.lineStyle(outlineThin, COLOR.NAME_BANNER_DIVIDER, 1);
  g.strokeRect(slots.nameSlot.x, slots.nameSlot.y, slots.nameSlot.w, slots.nameSlot.h);

  // Description panel — recessed dark rectangle with bronze border. Skipped
  // when the card is too small to fit any description text (responsive mode).
  if (slots.descSlot) {
    g.fillStyle(COLOR.DESC_PANEL, 1);
    g.fillRoundedRect(slots.descSlot.x, slots.descSlot.y, slots.descSlot.w, slots.descSlot.h, slotRadius);
    g.lineStyle(outlineThin, COLOR.DESC_BORDER, 0.9);
    g.strokeRoundedRect(slots.descSlot.x, slots.descSlot.y, slots.descSlot.w, slots.descSlot.h, slotRadius);
  }

  // Snapshot the Graphics into a RenderTexture sized exactly w×h. The mold
  // geometry was authored centered at (0, 0); shift by (w/2, h/2) so it
  // lands inside the RT's (0, 0)..(w, h) bounds.
  //
  // The RT is added off-display-list (addToScene=false) and parked in a
  // module-level Map so the GPU surface backing `saveTexture(key)` stays
  // alive for the lifetime of the page. See moldRenderTextures comment for
  // why we cannot destroy the RT here.
  const wi = Math.max(1, Math.round(w));
  const hi = Math.max(1, Math.round(h));
  const rt = scene.make.renderTexture({ x: 0, y: 0, width: wi, height: hi }, false);
  rt.draw(g, w / 2, h / 2);
  rt.saveTexture(key);
  moldRenderTextures.set(key, rt);
  g.destroy();
}

// ── Slot drawers ─────────────────────────────────────────────────────────

function drawPrimaryCost(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  card: CardDefinition,
  isUpgraded: boolean,
  slot: SlotBox,
): void {
  const cost: CardCost | undefined = isUpgraded && card.upgraded?.cost ? card.upgraded.cost : card.cost;
  let qty = 0;
  let token: string | null = null;
  if (cost?.stamina) { qty = cost.stamina; token = 'stam'; }
  else if (cost?.mana) { qty = cost.mana; token = 'mana'; }
  else if (cost?.defense) { qty = cost.defense; token = 'defense'; }
  if (!token) return;

  drawCostCell(scene, parent, slot, String(qty), token, Math.min(slot.w, slot.h) * 0.8);
}

function drawSecondaryCosts(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  card: CardDefinition,
  isUpgraded: boolean,
  slot: SlotBox,
): void {
  const rows = buildSecondaryCostRows(card, isUpgraded);
  if (rows.length === 0) return;

  // Responsive sizing: 1–2 fixed large, 3 shrink, 4 shrink more.
  const fitWidth = slot.w / rows.length - 2;
  const maxByH = slot.h * 0.85;
  const baseIcon = Math.min(maxByH, fitWidth);
  const shrink =
    rows.length <= 2 ? 1 :
    rows.length === 3 ? 0.82 :
    0.68;
  const iconSize = baseIcon * shrink;
  const gap = Math.max(2, iconSize * 0.08);
  const totalW = rows.length * iconSize + (rows.length - 1) * gap;
  let cx = slot.cx - totalW / 2 + iconSize / 2;
  for (const row of rows) {
    const sub: SlotBox = { x: 0, y: 0, w: iconSize, h: iconSize, cx, cy: slot.cy };
    drawCostCell(scene, parent, sub, row.qty, row.token, iconSize);
    cx += iconSize + gap;
  }
}

function drawCooldown(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  card: CardDefinition,
  isUpgraded: boolean,
  slot: SlotBox,
): void {
  const cd = (isUpgraded && card.upgraded?.cooldown != null) ? card.upgraded.cooldown : card.cooldown;
  if (!cd) return;
  const label = `${cd}s`;
  // Size text by both slot height and width so multi-char labels (e.g.
  // "1.2s") don't overflow into the search bar or art zone.
  const sizeByH = slot.h * 0.45;
  const sizeByW = (slot.w * 0.9) / Math.max(label.length * 0.62, 1);
  const fontSize = Math.max(7, Math.floor(Math.min(sizeByH, sizeByW)));
  parent.add(
    scene.add.text(slot.cx, slot.cy, label, {
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      fontFamily: 'monospace',
      color: '#f5e7c1',
      stroke: '#000000',
      strokeThickness: Math.max(1, fontSize * 0.12),
    }).setOrigin(0.5),
  );
}

function drawArt(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  card: CardDefinition,
  slot: SlotBox,
  fitMode: 'cover' | 'contain' = 'cover',
): void {
  const key = `card_${card.id}`;
  if (!scene.textures.exists(key)) {
    const fallback: Record<string, string> = { attack: '⚔️', defense: '🛡️', magic: '✨' };
    parent.add(
      scene.add.text(slot.cx, slot.cy, fallback[card.category] ?? '❓', {
        fontSize: `${Math.round(slot.h * 0.5)}px`,
      }).setOrigin(0.5).setAlpha(0.5),
    );
    return;
  }

  const img = scene.add.image(slot.cx, slot.cy, key).setOrigin(0.5);
  const sw = img.width;
  const sh = img.height;
  const slotW = Math.max(1, slot.w - 4);
  const slotH = Math.max(1, slot.h - 4);

  if (fitMode === 'cover') {
    // Pick a centered crop region of the source texture whose aspect matches
    // the slot, then scale the cropped rect up to fill the slot. setCrop
    // operates on source-texture pixels; scaleX/scaleY then map cropW/cropH
    // onto slotW/slotH so the displayed result is exactly slot-sized with
    // the action centered (action is dead-center in every generated PNG).
    const imageAspect = sw / sh;
    const slotAspect = slotW / slotH;
    let cropW: number, cropH: number, cropX: number, cropY: number;
    if (slotAspect >= imageAspect) {
      cropW = sw;
      cropH = sw / slotAspect;
      cropX = 0;
      cropY = (sh - cropH) / 2;
    } else {
      cropH = sh;
      cropW = sh * slotAspect;
      cropY = 0;
      cropX = (sw - cropW) / 2;
    }
    img.setCrop(cropX, cropY, cropW, cropH);
    img.setScale(slotW / cropW, slotH / cropH);
  } else {
    // Contain-fit: full image visible. Letterboxing falls onto the slot's
    // ART_BG (already dark) so the bars read as part of the frame.
    const scale = Math.min(slotW / sw, slotH / sh);
    img.setScale(scale);
  }

  parent.add(img);
}

function drawName(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  card: CardDefinition,
  isUpgraded: boolean,
  slot: SlotBox,
): void {
  const displayName = isUpgraded ? `${card.name}+` : card.name;
  // Font size capped so long names still fit. Banner is 8.5% tall — text
  // gets ~70% of that. Drop baseline slightly so descenders sit inside.
  const fontSize = Math.max(8, Math.round(slot.h * 0.62));
  const colorHex = isUpgraded ? `#${COLOR.NAME_TEXT_UPG.toString(16).padStart(6, '0')}` : `#${COLOR.NAME_TEXT_DARK.toString(16).padStart(6, '0')}`;
  parent.add(
    scene.add.text(slot.cx, slot.cy, displayName, {
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      fontFamily: 'monospace',
      color: colorHex,
      align: 'center',
    }).setOrigin(0.5, 0.55),  // 0.55 nudges baseline down so descenders fit
  );
}

function drawElements(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  card: CardDefinition,
  slot: SlotBox,
): void {
  const elems = ((card.elements ?? []) as ElementId[]).filter((e) => !!ELEMENTS[e]);
  if (elems.length === 0) return;
  const elemSize = slot.h * 0.9;
  const gap = elemSize * 0.45;
  const totalW = elems.length * elemSize + (elems.length - 1) * gap;
  let cx = slot.cx - totalW / 2 + elemSize / 2;
  for (const e of elems) {
    const spriteKey = resolveIconKey(scene.textures, e)
      ?? (scene.textures.exists(`elem_${e}`) ? `elem_${e}` : null);
    if (spriteKey) {
      const img = scene.add.image(cx, slot.cy, spriteKey);
      img.setDisplaySize(elemSize, elemSize);
      parent.add(img);
    } else {
      const color = parseInt(ELEMENTS[e].color.replace('#', ''), 16);
      parent.add(scene.add.circle(cx, slot.cy, elemSize / 2, color).setStrokeStyle(1, COLOR.BORDER));
    }
    cx += elemSize + gap;
  }
}

/**
 * Returns true if the description text can be rendered inside `slot` without
 * overflowing. Used to make tiny cards drop the description entirely so they
 * don't ship illegible/clipped prose. Renders the text invisibly off-camera,
 * measures via `tokenTextHeight`, then destroys the temp container.
 */
function hasDescription(card: CardDefinition, isUpgraded: boolean): boolean {
  const effects = (isUpgraded && card.upgraded?.effects) ? card.upgraded.effects : card.effects;
  const desc = formatCardDescription({
    effects,
    exhaust: card.exhaust,
    spend_armor: card.spend_armor,
  });
  return !!desc;
}

function drawDescription(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  card: CardDefinition,
  isUpgraded: boolean,
  slot: SlotBox,
  scale: number,
): void {
  const effects = (isUpgraded && card.upgraded?.effects) ? card.upgraded.effects : card.effects;
  // Font sized to fill the panel comfortably — larger at popup scale,
  // still readable on the small in-hand card.
  const fontSize = Math.max(9, Math.round(slot.h * 0.17 + scale * 1.5));
  const colorHex = `#${COLOR.DESC_TEXT.toString(16).padStart(6, '0')}`;
  const inset = Math.max(4, slot.w * 0.04);

  let block: Phaser.GameObjects.Container | null = null;
  const build = (): void => {
    if (block) { block.destroy(); block = null; }
    // Dynamic mode: each scaled number shows RESOLVED (bigger + colored, as a
    // [[v:N:stat]] token) by default; while SHIFT is held it becomes the
    // "(base + N per [stat])" equation in place. Stats come from CardDynamic
    // (live combat stats, else the run's resolved stats).
    const desc = formatCardDescription(
      { effects, exhaust: card.exhaust, spend_armor: card.spend_armor },
      { dynamic: { stats: getEffectiveStats(), shift: isShiftHeld() } },
    );
    if (!desc) return;

    const text = renderTokenText(scene, slot.x + inset, slot.y + inset, desc, {
      fontSize: `${fontSize}px`,
      color: colorHex,
      fontFamily: 'monospace',
      wrapWidth: slot.w - inset * 2,
      align: 'center',
      lineSpacing: 2,
    });
    // Vertically center the rendered text inside the slot.
    const textHeight = (text.getData('tokenTextHeight') as number | undefined) ?? 0;
    if (textHeight > 0 && textHeight < slot.h) {
      text.y = slot.cy - textHeight / 2;
    } else {
      text.y = slot.y + inset;
    }
    text.x = slot.cx - (slot.w - inset * 2) / 2;
    parent.add(text);
    block = text;
  };

  build();
  // Rebuild when SHIFT toggles (number <-> equation) or live stats change.
  const unsub = subscribeCardDynamic(build);
  parent.once('destroy', unsub);
}

// ── Cost cell ────────────────────────────────────────────────────────────

function drawCostCell(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  slot: SlotBox,
  qty: string,
  token: string,
  iconSize: number,
): void {
  const style = getTokenStyle(token);
  const color = style?.color ?? '#ffffff';
  const fallbackLabel = style?.label ?? token.toUpperCase();

  const spriteKey = resolveIconKey(scene.textures, token);
  if (spriteKey) {
    const img = scene.add.image(slot.cx, slot.cy, spriteKey);
    img.setDisplaySize(iconSize, iconSize);
    parent.add(img);
  } else {
    parent.add(
      scene.add.text(slot.cx, slot.cy, fallbackLabel, {
        fontSize: `${Math.round(iconSize * 0.4)}px`,
        fontStyle: 'bold',
        fontFamily: 'monospace',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5),
    );
  }

  // Quantity overlay — small bold number at top-right of the icon. Hidden
  // for badge-only entries like 'exhaust' (empty qty).
  if (qty && qty !== '0') {
    const qFont = Math.max(8, Math.round(iconSize * 0.42));
    const qx = slot.cx + iconSize * 0.32;
    const qy = slot.cy - iconSize * 0.34;
    parent.add(
      scene.add.text(qx, qy, qty, {
        fontSize: `${qFont}px`,
        fontStyle: 'bold',
        fontFamily: 'monospace',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5),
    );
  }
}

// ── Secondary cost extraction ────────────────────────────────────────────

interface SecondaryRow { token: string; qty: string }

function buildSecondaryCostRows(card: CardDefinition, isUpgraded: boolean): SecondaryRow[] {
  const rows: SecondaryRow[] = [];
  const effects = isUpgraded && card.upgraded?.effects ? card.upgraded.effects : card.effects;

  if (effects) {
    for (const fx of effects as CardEffect[]) {
      if (fx.type !== 'stack' || !fx.consume_stack || !fx.stack) continue;
      const amount = Math.abs(fx.value);
      rows.push({ token: fx.stack, qty: amount >= 99 ? 'X' : String(amount) });
    }
    for (const fx of effects as CardEffect[]) {
      if (fx.type !== 'convert_stack' || !fx.from) continue;
      if (rows.some(r => r.token === fx.from)) continue;
      const v = fx.value ?? 0;
      rows.push({ token: fx.from, qty: v >= 99 ? 'X' : String(v) });
    }
    const pyrePattern = (effects as CardEffect[]).some(fx =>
      fx.type === 'damage'
      && fx.condition?.enemy_has_stack === 'burn'
      && fx.condition?.per_stack === true,
    );
    if (pyrePattern && !rows.some(r => r.token === 'burn')) {
      rows.push({ token: 'burn', qty: 'X' });
    }
  }

  if (card.spend_armor !== undefined) {
    rows.push({ token: 'armor', qty: card.spend_armor === 'all' ? 'X' : String(card.spend_armor) });
  }
  if (card.exhaust) {
    rows.push({ token: 'exhaust', qty: '' });
  }
  return rows;
}

// ── Hover animation ──────────────────────────────────────────────────────

function attachHover(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  _startY: number,
): void {
  const w = CARD_BASE_SIZES.small.w * container.scaleX;
  const h = CARD_BASE_SIZES.small.h * container.scaleY;
  const border = scene.add.rectangle(0, 0, w, h, 0x000000, 0)
    .setStrokeStyle(3, 0xffd700, 1)
    .setVisible(false);
  container.add(border);

  container.on('pointerover', () => { border.setVisible(true); });
  container.on('pointerout',  () => { border.setVisible(false); });
  container.once('destroy', () => border.destroy());
}

function resolveUpgradeFlag(cardId: string): boolean {
  try {
    const run = getRun();
    return run.deck.active.some((id, i) => id === cardId && run.deck.upgraded[i]);
  } catch {
    return false;
  }
}
