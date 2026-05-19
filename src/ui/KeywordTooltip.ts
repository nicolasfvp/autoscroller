// KeywordTooltip -- lateral glossary panel that mounts beside a card after
// 2 seconds of continuous hover. Informational only: the panel has no
// interactive elements and self-destroys when hover ends or the parent
// scene shuts down.
//
// Two entry points:
//   - attachKeywordHover(scene, cardContainer, description, anchorBounds):
//     wires up pointerover/pointerout/destroy on the card so the tooltip
//     appears after 2s of hovering and disappears on hover-out. The caller
//     supplies the card's bounding box in scene-space so the panel can be
//     positioned beside it.
//   - attachKeywordTooltip(scene, popupContainer, description, popupBounds):
//     legacy popup-attached form. Kept for the detail-popup integration.
//
// Both forms detect zero keywords up front and no-op cleanly.
//
// Combat exclusion lives in the call site (CardVisual checks SCENE_KEYS.COMBAT
// before attaching).

import Phaser from 'phaser';
import { COLORS, FONTS, LAYOUT } from './StyleConstants';
import { detectKeywords, type KeywordDef } from './KeywordDefinitions';
import { hideFilterBarInputs, showFilterBarInputs } from './FilterBarVisibility';

const PANEL_WIDTH = 220;
const PANEL_PADDING = 12;
const TEXT_WRAP_WIDTH = PANEL_WIDTH - PANEL_PADDING * 2;
const TITLE_FONT_SIZE = 16;
const KEYWORD_FONT_SIZE = 14;
const DEFINITION_FONT_SIZE = 12;
const ENTRY_SPACING = 8;
const KEYWORD_TO_DEF_GAP = 2;
const TITLE_TO_BODY_GAP = 10;
const HOVER_DELAY_MS = 2000;
const TOOLTIP_DEPTH = 9000;

const CATEGORY_COLOR: Record<KeywordDef['category'], string> = {
  stack: '#ff8c00',
  modifier: '#ffd700',
  stat: '#66ccff',
};

export interface KeywordTooltipHandle {
  cancel: () => void;
}

interface AnchorBounds {
  x: number; // center
  y: number; // center
  w: number;
  h: number;
}

/**
 * Wire keyword-tooltip-on-hover behavior to a card visual container.
 *
 * On pointerover: starts a 2-second timer. After 2s, mounts the glossary
 * panel beside the card (right side preferred, mirrored to left if it
 * would clip past the canvas edge). On pointerout / destroy: cancels the
 * pending timer AND destroys any mounted panel.
 *
 * `anchorBounds` may be a static rectangle or a getter resolved at panel-
 * mount time — the deck editor uses the getter form so the panel tracks
 * the card across scroll / parent-container translation.
 *
 * Returns a handle whose cancel() unwires the listeners and tears down any
 * mounted panel — call this if the consumer wants to detach early.
 */
export function attachKeywordHover(
  scene: Phaser.Scene,
  cardContainer: Phaser.GameObjects.Container,
  cardDescription: string,
  anchorBounds: AnchorBounds | (() => AnchorBounds),
): KeywordTooltipHandle {
  const keywords = detectKeywords(cardDescription);
  if (keywords.length === 0) {
    return { cancel: () => { /* noop */ } };
  }

  let timer: Phaser.Time.TimerEvent | null = null;
  let panel: Phaser.GameObjects.Container | null = null;
  let detached = false;
  let hidingInputs = false;

  const tearDownPanel = () => {
    if (panel && panel.active) panel.destroy(true);
    panel = null;
    if (hidingInputs) {
      showFilterBarInputs();
      hidingInputs = false;
    }
  };

  const cancelTimer = () => {
    if (timer) { timer.remove(false); timer = null; }
  };

  const onOver = () => {
    if (detached) return;
    cancelTimer();
    tearDownPanel();
    timer = scene.time.delayedCall(HOVER_DELAY_MS, () => {
      if (detached) return;
      if (!cardContainer.active) return;
      const anchor = typeof anchorBounds === 'function' ? anchorBounds() : anchorBounds;
      panel = mountStandalonePanel(scene, keywords, anchor);
      hideFilterBarInputs();
      hidingInputs = true;
    });
  };

  const onOut = () => {
    cancelTimer();
    tearDownPanel();
  };

  cardContainer.on('pointerover', onOver);
  cardContainer.on('pointerout', onOut);
  cardContainer.once('destroy', () => {
    detached = true;
    cancelTimer();
    tearDownPanel();
  });

  return {
    cancel: () => {
      detached = true;
      cancelTimer();
      tearDownPanel();
      cardContainer.off('pointerover', onOver);
      cardContainer.off('pointerout', onOut);
    },
  };
}

/**
 * Schedule a keyword tooltip to appear after the standard 2s delay, with the
 * anchor resolved lazily at fire time. Used by the deck editor's drag flow:
 * the drag visual is non-interactive (no pointerover/out), so the standard
 * hover-attached form doesn't apply — the caller starts the timer at drag
 * begin and cancels via the returned handle at drag end.
 */
export function scheduleKeywordPanel(
  scene: Phaser.Scene,
  cardDescription: string,
  getAnchor: () => AnchorBounds,
): KeywordTooltipHandle {
  const keywords = detectKeywords(cardDescription);
  if (keywords.length === 0) {
    return { cancel: () => { /* noop */ } };
  }
  let panel: Phaser.GameObjects.Container | null = null;
  let cancelled = false;
  const timer = scene.time.delayedCall(HOVER_DELAY_MS, () => {
    if (cancelled) return;
    panel = mountStandalonePanel(scene, keywords, getAnchor());
  });
  return {
    cancel: () => {
      cancelled = true;
      timer.remove(false);
      if (panel && panel.active) panel.destroy(true);
      panel = null;
    },
  };
}

/**
 * Schedule a keyword tooltip to appear next to a card detail popup after a
 * 2-second delay. Mounted as a child of the popup container so it tears
 * down with it. Kept for parity with the CardDetailPopup integration.
 */
export function attachKeywordTooltip(
  scene: Phaser.Scene,
  popup: Phaser.GameObjects.Container,
  cardDescription: string,
  popupBounds: AnchorBounds,
): KeywordTooltipHandle {
  const keywords = detectKeywords(cardDescription);
  if (keywords.length === 0) {
    return { cancel: () => { /* noop */ } };
  }

  let cancelled = false;
  const timer = scene.time.delayedCall(HOVER_DELAY_MS, () => {
    if (cancelled) return;
    if (!popup.active) return;
    const panel = mountStandalonePanel(scene, keywords, popupBounds);
    popup.add(panel);
  });

  return {
    cancel: () => {
      cancelled = true;
      timer.remove(false);
    },
  };
}

function mountStandalonePanel(
  scene: Phaser.Scene,
  keywords: KeywordDef[],
  anchor: AnchorBounds,
): Phaser.GameObjects.Container {
  const panel = scene.add.container(0, 0).setDepth(TOOLTIP_DEPTH);
  const fontFamily = FONTS.family;

  const title = scene.add.text(0, 0, 'Keywords', {
    fontSize: `${TITLE_FONT_SIZE}px`,
    fontStyle: 'bold',
    color: COLORS.accent,
    fontFamily,
  }).setOrigin(0, 0);

  type Entry = {
    nameText: Phaser.GameObjects.Text;
    defText: Phaser.GameObjects.Text;
    blockHeight: number;
  };

  const entries: Entry[] = [];
  for (const kw of keywords) {
    const nameText = scene.add.text(0, 0, kw.keyword, {
      fontSize: `${KEYWORD_FONT_SIZE}px`,
      fontStyle: 'bold',
      color: CATEGORY_COLOR[kw.category],
      fontFamily,
    }).setOrigin(0, 0);

    const defText = scene.add.text(0, 0, kw.definition, {
      fontSize: `${DEFINITION_FONT_SIZE}px`,
      color: COLORS.textPrimary,
      fontFamily,
      wordWrap: { width: TEXT_WRAP_WIDTH },
      lineSpacing: 2,
    }).setOrigin(0, 0);

    const blockHeight = nameText.height + KEYWORD_TO_DEF_GAP + defText.height;
    entries.push({ nameText, defText, blockHeight });
  }

  let contentHeight = title.height + TITLE_TO_BODY_GAP;
  for (let i = 0; i < entries.length; i++) {
    contentHeight += entries[i].blockHeight;
    if (i < entries.length - 1) contentHeight += ENTRY_SPACING;
  }
  const panelHeight = contentHeight + PANEL_PADDING * 2;

  const anchorRight = anchor.x + anchor.w / 2;
  const anchorLeft = anchor.x - anchor.w / 2;
  const anchorTop = anchor.y - anchor.h / 2;
  const GAP = 12;

  let panelX: number;
  const rightCandidate = anchorRight + GAP;
  if (rightCandidate + PANEL_WIDTH <= LAYOUT.canvasWidth) {
    panelX = rightCandidate;
  } else {
    panelX = Math.max(4, anchorLeft - GAP - PANEL_WIDTH);
  }

  // Vertically pin the panel top to the anchor top, but clamp so it doesn't
  // run off the bottom of the canvas (relevant for hover tooltips on small
  // cards near the lower edge).
  const panelY = Math.max(4, Math.min(
    anchorTop,
    LAYOUT.canvasHeight - panelHeight - 4,
  ));

  const bg = scene.add.rectangle(panelX, panelY, PANEL_WIDTH, panelHeight, 0x1a1a2e, 0.98)
    .setOrigin(0, 0)
    .setStrokeStyle(2, 0x444466);
  panel.add(bg);

  let cursorY = panelY + PANEL_PADDING;
  const contentX = panelX + PANEL_PADDING;
  title.setPosition(contentX, cursorY);
  panel.add(title);
  cursorY += title.height + TITLE_TO_BODY_GAP;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    e.nameText.setPosition(contentX, cursorY);
    panel.add(e.nameText);
    cursorY += e.nameText.height + KEYWORD_TO_DEF_GAP;

    e.defText.setPosition(contentX, cursorY);
    panel.add(e.defText);
    cursorY += e.defText.height;

    if (i < entries.length - 1) cursorY += ENTRY_SPACING;
  }

  panel.setAlpha(0);
  scene.tweens.add({
    targets: panel,
    alpha: 1,
    duration: 150,
    ease: 'Sine.easeOut',
  });

  return panel;
}
