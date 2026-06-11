import Phaser from 'phaser';
import { COLORS, FONTS, LAYOUT } from './StyleConstants';
import { getKeywordDefinitions, getTokenGlossary, type KeywordDef } from './KeywordDefinitions';
import { renderTokenText } from './IconTokens';
import { keywordIntro } from '../systems/keywordIntro/KeywordIntroService';
import { t, getLocale } from '../i18n/i18n';

const OVERLAY_DEPTH = 11000;
const BACKDROP_ALPHA = 0.72;

const PANEL_W = 700;
const PANEL_H = 510;
const PANEL_X = (LAYOUT.canvasWidth - PANEL_W) / 2;
const PANEL_Y = (LAYOUT.canvasHeight - PANEL_H) / 2;

const PAD_H = 22;   // horizontal padding (inside gold border)
const PAD_V = 16;   // vertical padding top/bottom (inside border)
const HEADER_H = 46;

const CONTENT_X = PANEL_X + PAD_H;
const CONTENT_Y = PANEL_Y + HEADER_H + PAD_V;
const CONTENT_W = PANEL_W - PAD_H * 2;
const CONTENT_H = PANEL_H - HEADER_H - PAD_V * 2;

const CATEGORY_LABEL: Record<KeywordDef['category'], string> = {
  stack: t('glossary.categoryStacks'),
  modifier: t('glossary.categoryKeywords'),
  stat: t('glossary.categoryStats'),
};

const CATEGORY_COLOR: Record<KeywordDef['category'], string> = {
  stack: '#ff8c00',
  modifier: '#ffd700',
  stat: '#66ccff',
};

const KEYWORD_ICON: Partial<Record<string, string>> = {
  Burn:       'icon_burn',
  Bleed:      'icon_bleed',
  Poison:     'icon_poison',
  Stun:       'icon_stun',
  Slow:       'icon_slow',
  Rage:       'icon_rage',
  Armor:      'icon_armor',
  Strength:   'icon_str',
  Dexterity:  'icon_dex',
  Intellect:  'icon_int',
  Vitality:   'icon_vit',
  Spirit:     'icon_spi',
  Exhaust:    'icon_exhaust',
};

const CATEGORY_ORDER: KeywordDef['category'][] = ['stack', 'stat', 'modifier'];

const KEYWORD_FONT   = 14;
const DEF_FONT       = 12;
const SEC_FONT       = 15;
const SEC_GAP_TOP    = 8;
const SEC_GAP_BOTTOM = 4;
const KW_DEF_GAP     = 2;
const ENTRY_GAP      = 8;
const ICON_SIZE      = 18;
const ICON_GAP       = 6;

interface GlossaryHandle { close: () => void; }
let openHandle: GlossaryHandle | null = null;

export function openGlossary(scene: Phaser.Scene, onClose?: () => void): GlossaryHandle {
  if (openHandle) return openHandle;

  const overlay = scene.add.container(0, 0).setDepth(OVERLAY_DEPTH);

  // Semi-transparent full-screen backdrop
  const backdrop = scene.add.rectangle(0, 0, LAYOUT.canvasWidth, LAYOUT.canvasHeight, 0x000000, BACKDROP_ALPHA)
    .setOrigin(0, 0).setInteractive();
  overlay.add(backdrop);

  // Programmatic panel — very dark fill + double gold border
  const gfx = scene.add.graphics();
  // Main fill
  gfx.fillStyle(0x08080f, 0.97);
  gfx.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
  // Outer gold border
  gfx.lineStyle(3, 0xc8920a, 1);
  gfx.strokeRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
  // Inner accent line
  gfx.lineStyle(1, 0x6b4a10, 0.8);
  gfx.strokeRect(PANEL_X + 5, PANEL_Y + 5, PANEL_W - 10, PANEL_H - 10);
  overlay.add(gfx);

  // Invisible hit-area so clicks on the panel don't reach the backdrop
  const panelHit = scene.add.rectangle(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0, 0)
    .setOrigin(0, 0).setInteractive();
  overlay.add(panelHit);

  // Title — centered
  const title = scene.add.text(PANEL_X + PANEL_W / 2, PANEL_Y + PAD_V, t('glossary.title'), {
    fontSize: '22px', fontStyle: 'bold', color: COLORS.accent, fontFamily: FONTS.body,
  }).setOrigin(0.5, 0);
  overlay.add(title);

  // Divider below title
  const divider = scene.add.rectangle(PANEL_X + PAD_H, PANEL_Y + HEADER_H, CONTENT_W, 1, 0xc8920a, 0.7)
    .setOrigin(0, 0);
  overlay.add(divider);

  // Close button — top-right, inside border
  const closeBtn = scene.add.text(PANEL_X + PANEL_W - PAD_H, PANEL_Y + PAD_V, '×', {
    fontSize: '26px', fontStyle: 'bold', color: COLORS.accent, fontFamily: FONTS.body,
  }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
  closeBtn.on('pointerover', () => closeBtn.setColor(COLORS.accentHover));
  closeBtn.on('pointerout',  () => closeBtn.setColor(COLORS.accent));
  overlay.add(closeBtn);

  // Scrollable content container with geometry mask
  const contentContainer = scene.add.container(0, 0);
  const maskGfx = scene.make.graphics({ x: 0, y: 0 });
  maskGfx.fillStyle(0xffffff);
  maskGfx.fillRect(CONTENT_X, CONTENT_Y, CONTENT_W, CONTENT_H);
  contentContainer.setMask(maskGfx.createGeometryMask());
  overlay.add(contentContainer);

  // Build content
  const seenSet = keywordIntro.getSeenKeywords();
  const loc = getLocale();
  const tokenGlossary = getTokenGlossary(loc);
  const grouped: Record<KeywordDef['category'], KeywordDef[]> = {
    stack:    tokenGlossary.filter((d) => d.category === 'stack'),
    modifier: getKeywordDefinitions(loc).filter((def) => seenSet.has(def.keyword)),
    stat:     tokenGlossary.filter((d) => d.category === 'stat'),
  };

  let cursorY = CONTENT_Y;
  for (const category of CATEGORY_ORDER) {
    const list = grouped[category];
    if (list.length === 0) continue;

    cursorY += SEC_GAP_TOP;
    const secTitle = scene.add.text(CONTENT_X, cursorY,
      `${CATEGORY_LABEL[category]} (${list.length})`,
      { fontSize: `${SEC_FONT}px`, fontStyle: 'bold', color: CATEGORY_COLOR[category], fontFamily: FONTS.body },
    ).setOrigin(0, 0);
    contentContainer.add(secTitle);
    cursorY += secTitle.height + SEC_GAP_BOTTOM;

    for (const kw of list) {
      const iconKey = KEYWORD_ICON[kw.keyword];
      const hasIcon = iconKey ? scene.textures.exists(iconKey) : false;
      const nameX   = hasIcon ? CONTENT_X + ICON_SIZE + ICON_GAP : CONTENT_X;

      const nameText = scene.add.text(nameX, cursorY, kw.keyword, {
        fontSize: `${KEYWORD_FONT}px`, fontStyle: 'bold', color: CATEGORY_COLOR[category], fontFamily: FONTS.body,
      }).setOrigin(0, 0);
      contentContainer.add(nameText);

      if (hasIcon && iconKey) {
        const iconImg = scene.add.image(CONTENT_X + ICON_SIZE / 2, cursorY + nameText.height / 2, iconKey)
          .setDisplaySize(ICON_SIZE, ICON_SIZE).setOrigin(0.5);
        contentContainer.add(iconImg);
      }

      cursorY += nameText.height + KW_DEF_GAP;

      // renderTokenText so bracketed tokens in the definition (e.g. [armor],
      // [HP]) render as their colored icons instead of literal "[armor]" text.
      const defBlock = renderTokenText(scene, CONTENT_X, cursorY, kw.definition, {
        fontSize: `${DEF_FONT}px`,
        color: COLORS.textPrimary,
        fontFamily: FONTS.body,
        wrapWidth: CONTENT_W,
        lineSpacing: 2,
      });
      contentContainer.add(defBlock);
      const defHeight = (defBlock.getData('tokenTextHeight') as number | undefined) ?? 0;
      cursorY += defHeight + ENTRY_GAP;
    }
  }

  const totalH  = cursorY - CONTENT_Y;
  const maxScroll = Math.max(0, totalH - CONTENT_H);
  let scrollOffset = 0;

  // Scroll arrow indicator (visible when more content below)
  const scrollArrow = scene.add.text(
    PANEL_X + PANEL_W / 2,
    PANEL_Y + PANEL_H - PAD_V - 4,
    t('glossary.scrollForMore'),
    { fontSize: '11px', color: '#9a6030', fontFamily: FONTS.body },
  ).setOrigin(0.5, 1).setAlpha(maxScroll > 0 ? 1 : 0);
  overlay.add(scrollArrow);
  if (maxScroll > 0) {
    scene.tweens.add({ targets: scrollArrow, alpha: 0.2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  const applyScroll = () => {
    contentContainer.setY(-scrollOffset);
    // hide arrow when reached the bottom
    scrollArrow.setAlpha(scrollOffset >= maxScroll - 2 ? 0 : 1);
  };

  const wheelHandler = (_p: Phaser.Input.Pointer, _o: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
    if (maxScroll <= 0) return;
    scrollOffset = Phaser.Math.Clamp(scrollOffset + dy * 0.5, 0, maxScroll);
    applyScroll();
  };
  scene.input.on('wheel', wheelHandler);

  backdrop.on('pointerdown', () => close());
  panelHit.on('pointerdown', () => { /* swallow */ });
  closeBtn.on('pointerdown', () => close());

  const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  window.addEventListener('keydown', escHandler);

  const onShutdown = () => close();
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  scene.events.once(Phaser.Scenes.Events.DESTROY,  onShutdown);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', escHandler);
    scene.input.off('wheel', wheelHandler);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    scene.events.off(Phaser.Scenes.Events.DESTROY,  onShutdown);
    if (overlay.active) overlay.destroy(true);
    if (openHandle && openHandle.close === handle.close) openHandle = null;
    onClose?.();
  };

  const handle: GlossaryHandle = { close };
  openHandle = handle;
  return handle;
}

export function closeGlossary(): void {
  if (openHandle) openHandle.close();
}
