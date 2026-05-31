// GlossaryPanel -- persistent keyword reference modal. Surfaced via the
// circular "?" GlossaryButton from any scene that shows cards or runs
// combat. Read-only: lists every keyword in KEYWORD_DEFINITIONS, grouped
// by category (Stack / Modifier / Stat), in a scrollable centered panel.
//
// Lifecycle: openGlossary(scene) creates a high-depth container overlay on
// the calling scene; it tears itself down on close button, click-outside,
// ESC, or scene shutdown. Multiple openings are guarded so a double-click
// can't stack two panels.

import Phaser from 'phaser';
import { COLORS, FONTS, LAYOUT } from './StyleConstants';
import { KEYWORD_DEFINITIONS, type KeywordDef } from './KeywordDefinitions';
import { keywordIntro } from '../systems/keywordIntro/KeywordIntroService';

const OVERLAY_DEPTH = 11000;
const BACKDROP_ALPHA = 0.72;

const PANEL_W = 720;
const PANEL_H = 520;
const PANEL_X = (LAYOUT.canvasWidth - PANEL_W) / 2;
const PANEL_Y = (LAYOUT.canvasHeight - PANEL_H) / 2;

const PANEL_PADDING = 20;
const HEADER_H = 44;
const CONTENT_X = PANEL_X + PANEL_PADDING;
const CONTENT_Y = PANEL_Y + HEADER_H + 4;
const CONTENT_W = PANEL_W - PANEL_PADDING * 2;
const CONTENT_H = PANEL_H - HEADER_H - PANEL_PADDING - 8;

const CATEGORY_LABEL: Record<KeywordDef['category'], string> = {
  stack: 'Stack',
  modifier: 'Modifier',
  stat: 'Stat',
};

const CATEGORY_COLOR: Record<KeywordDef['category'], string> = {
  stack: '#ff8c00',
  modifier: '#ffd700',
  stat: '#66ccff',
};

const CATEGORY_ORDER: KeywordDef['category'][] = ['stack', 'modifier', 'stat'];

const KEYWORD_FONT = 14;
const DEFINITION_FONT = 12;
const SECTION_HEADER_FONT = 16;
const SECTION_HEADER_GAP_TOP = 6;
const SECTION_HEADER_GAP_BOTTOM = 6;
const KEYWORD_TO_DEF_GAP = 2;
const ENTRY_GAP = 8;

interface GlossaryHandle {
  close: () => void;
}

let openHandle: GlossaryHandle | null = null;

/**
 * Open the glossary modal on top of the given scene. Idempotent — calling
 * again while one is already open is a no-op (the existing one stays).
 */
export function openGlossary(scene: Phaser.Scene): GlossaryHandle {
  if (openHandle) return openHandle;

  const overlay = scene.add.container(0, 0).setDepth(OVERLAY_DEPTH);

  const backdrop = scene.add.rectangle(
    0,
    0,
    LAYOUT.canvasWidth,
    LAYOUT.canvasHeight,
    0x000000,
    BACKDROP_ALPHA,
  )
    .setOrigin(0, 0)
    .setInteractive();
  overlay.add(backdrop);

  const panelBg = scene.add.rectangle(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0x1a1a2e, 0.98)
    .setOrigin(0, 0)
    .setStrokeStyle(2, 0x9a6030);
  overlay.add(panelBg);

  const title = scene.add.text(PANEL_X + PANEL_PADDING, PANEL_Y + 12, 'Keywords', {
    fontSize: '20px',
    fontStyle: 'bold',
    color: COLORS.accent,
    fontFamily: FONTS.body,
  }).setOrigin(0, 0);
  overlay.add(title);

  const hint = scene.add.text(
    PANEL_X + PANEL_PADDING,
    PANEL_Y + 18,
    '',
    { fontSize: '11px', color: COLORS.textSecondary, fontFamily: FONTS.body },
  );
  hint.setText('Scroll for more • ESC to close');
  hint.setPosition(PANEL_X + PANEL_W - PANEL_PADDING - hint.width, PANEL_Y + 22);
  overlay.add(hint);

  const closeBtn = scene.add.text(
    PANEL_X + PANEL_W - PANEL_PADDING,
    PANEL_Y + 12,
    '×',
    {
      fontSize: '24px',
      fontStyle: 'bold',
      color: COLORS.accent,
      fontFamily: FONTS.body,
    },
  ).setOrigin(1, 0).setInteractive({ useHandCursor: true });
  closeBtn.on('pointerover', () => closeBtn.setColor(COLORS.accentHover));
  closeBtn.on('pointerout', () => closeBtn.setColor(COLORS.accent));
  overlay.add(closeBtn);

  const divider = scene.add.rectangle(
    PANEL_X + PANEL_PADDING,
    PANEL_Y + HEADER_H,
    PANEL_W - PANEL_PADDING * 2,
    1,
    0x444466,
  ).setOrigin(0, 0);
  overlay.add(divider);

  // Scroll viewport: a content container masked to CONTENT_W × CONTENT_H.
  // The mask is a Graphics with a hit-tested rectangle that the wheel
  // listener uses to constrain scroll to the panel region.
  const contentContainer = scene.add.container(0, 0);
  const maskGraphics = scene.make.graphics({ x: 0, y: 0 });
  maskGraphics.fillStyle(0xffffff);
  maskGraphics.fillRect(CONTENT_X, CONTENT_Y, CONTENT_W, CONTENT_H);
  const mask = maskGraphics.createGeometryMask();
  contentContainer.setMask(mask);
  overlay.add(contentContainer);

  // Filter the master list to keywords the player has encountered so the
  // panel surfaces only learned terms (beginner-mode "curiosidade saudável"
  // — new players see a short list that grows as they play). The intro
  // service is hydrated lazily; the helper just returns an empty set when
  // init() hasn't completed yet, so the worst case is a one-time empty
  // panel that fills out on the next open.
  const seenSet = keywordIntro.getSeenKeywords();
  const visibleDefs = KEYWORD_DEFINITIONS.filter((def) => seenSet.has(def.keyword));

  if (visibleDefs.length === 0) {
    const emptyMsg = scene.add.text(
      LAYOUT.canvasWidth / 2,
      PANEL_Y + PANEL_H / 2,
      'No keywords learned yet.\n\nPlay a card with a new keyword in combat — the game will\npause and teach it to you the first time.',
      {
        fontSize: '13px',
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        align: 'center',
        lineSpacing: 4,
      },
    ).setOrigin(0.5);
    overlay.add(emptyMsg);
  }

  const grouped: Record<KeywordDef['category'], KeywordDef[]> = {
    stack: [],
    modifier: [],
    stat: [],
  };
  for (const def of visibleDefs) grouped[def.category].push(def);

  let cursorY = CONTENT_Y;
  for (const category of CATEGORY_ORDER) {
    const list = grouped[category];
    if (list.length === 0) continue;

    cursorY += SECTION_HEADER_GAP_TOP;
    const sectionTitle = scene.add.text(
      CONTENT_X,
      cursorY,
      `${CATEGORY_LABEL[category]} (${list.length})`,
      {
        fontSize: `${SECTION_HEADER_FONT}px`,
        fontStyle: 'bold',
        color: CATEGORY_COLOR[category],
        fontFamily: FONTS.body,
      },
    ).setOrigin(0, 0);
    contentContainer.add(sectionTitle);
    cursorY += sectionTitle.height + SECTION_HEADER_GAP_BOTTOM;

    for (const kw of list) {
      const nameText = scene.add.text(CONTENT_X, cursorY, kw.keyword, {
        fontSize: `${KEYWORD_FONT}px`,
        fontStyle: 'bold',
        color: CATEGORY_COLOR[category],
        fontFamily: FONTS.body,
      }).setOrigin(0, 0);
      contentContainer.add(nameText);
      cursorY += nameText.height + KEYWORD_TO_DEF_GAP;

      const defText = scene.add.text(CONTENT_X, cursorY, kw.definition, {
        fontSize: `${DEFINITION_FONT}px`,
        color: COLORS.textPrimary,
        fontFamily: FONTS.body,
        wordWrap: { width: CONTENT_W },
        lineSpacing: 2,
      }).setOrigin(0, 0);
      contentContainer.add(defText);
      cursorY += defText.height + ENTRY_GAP;
    }
  }

  const totalContentHeight = cursorY - CONTENT_Y;
  const maxScroll = Math.max(0, totalContentHeight - CONTENT_H);
  let scrollOffset = 0;

  const applyScroll = () => {
    contentContainer.setY(-scrollOffset);
  };

  const wheelHandler = (
    _pointer: Phaser.Input.Pointer,
    _objects: Phaser.GameObjects.GameObject[],
    _dx: number,
    dy: number,
  ) => {
    if (maxScroll <= 0) return;
    scrollOffset = Phaser.Math.Clamp(scrollOffset + dy * 0.5, 0, maxScroll);
    applyScroll();
  };
  scene.input.on('wheel', wheelHandler);

  // Close on backdrop click (the panel itself eats the click).
  panelBg.setInteractive();
  backdrop.on('pointerdown', () => close());
  panelBg.on('pointerdown', () => { /* swallow */ });

  closeBtn.on('pointerdown', () => close());

  const escHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };
  window.addEventListener('keydown', escHandler);

  const onShutdown = () => close();
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  scene.events.once(Phaser.Scenes.Events.DESTROY, onShutdown);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', escHandler);
    scene.input.off('wheel', wheelHandler);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    scene.events.off(Phaser.Scenes.Events.DESTROY, onShutdown);
    if (overlay.active) overlay.destroy(true);
    if (openHandle && openHandle.close === handle.close) openHandle = null;
  };

  const handle: GlossaryHandle = { close };
  openHandle = handle;
  return handle;
}

/** Closes any open glossary. Safe to call when none is open. */
export function closeGlossary(): void {
  if (openHandle) openHandle.close();
}
