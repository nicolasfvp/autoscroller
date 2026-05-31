// KeywordIntroOverlay -- single-keyword "first-encounter" teaching modal.
//
// Shown by KeywordIntroService when the player resolves a card that
// references a keyword they haven't learned yet. While the overlay is
// visible the combat tick loop is paused (CombatScene.update reads
// keywordIntro.isPaused()).
//
// UX: small centered panel with the keyword name (category-colored),
// the canonical definition, and a "Got it!" button. ESC also dismisses.

import Phaser from 'phaser';
import { COLORS, FONTS, LAYOUT } from './StyleConstants';
import type { KeywordDef } from './KeywordDefinitions';

const OVERLAY_DEPTH = 12000;
const BACKDROP_ALPHA = 0.62;

const PANEL_W = 440;
const PANEL_H = 220;
const PANEL_X = (LAYOUT.canvasWidth - PANEL_W) / 2;
const PANEL_Y = (LAYOUT.canvasHeight - PANEL_H) / 2;

const CATEGORY_COLOR: Record<KeywordDef['category'], string> = {
  stack: '#ff8c00',
  modifier: '#ffd700',
  stat: '#66ccff',
};

const CATEGORY_LABEL: Record<KeywordDef['category'], string> = {
  stack: 'Stack',
  modifier: 'Modifier',
  stat: 'Stat',
};

export function openKeywordIntroOverlay(
  scene: Phaser.Scene,
  keyword: KeywordDef,
  onDismiss: () => void,
): void {
  const overlay = scene.add.container(0, 0).setDepth(OVERLAY_DEPTH);

  const backdrop = scene.add.rectangle(
    0, 0,
    LAYOUT.canvasWidth, LAYOUT.canvasHeight,
    0x000000, BACKDROP_ALPHA,
  ).setOrigin(0, 0).setInteractive();
  overlay.add(backdrop);

  // Dark/gold panel frame — matches the game's unified UI style.
  const frameKey = scene.textures.exists('panel_keyword_frame') ? 'panel_keyword_frame' : '__DEFAULT';
  const panelBg = scene.add.image(PANEL_X + PANEL_W / 2, PANEL_Y + PANEL_H / 2, frameKey)
    .setDisplaySize(PANEL_W, PANEL_H)
    .setInteractive();
  overlay.add(panelBg);

  // "New [Category]" badge — small, muted
  const badge = scene.add.text(
    PANEL_X + 18,
    PANEL_Y + 16,
    `New ${CATEGORY_LABEL[keyword.category]}`,
    {
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#aaaaaa',
      fontFamily: FONTS.body,
      stroke: '#000000',
      strokeThickness: 2,
    },
  ).setOrigin(0, 0);
  overlay.add(badge);

  // Keyword name — category-colored, prominent
  const name = scene.add.text(
    PANEL_X + 18,
    PANEL_Y + 34,
    keyword.keyword,
    {
      fontSize: '26px',
      fontStyle: 'bold',
      color: CATEGORY_COLOR[keyword.category],
      fontFamily: FONTS.body,
      stroke: '#000000',
      strokeThickness: 3,
    },
  ).setOrigin(0, 0);
  overlay.add(name);

  // Divider line
  const divider = scene.add.rectangle(PANEL_X + PANEL_W / 2, PANEL_Y + 78, PANEL_W - 36, 1, 0xffd700, 0.4);
  overlay.add(divider);

  // Definition — warm amber to match the tutorial text box style
  const definition = scene.add.text(
    PANEL_X + 18,
    PANEL_Y + 88,
    keyword.definition,
    {
      fontSize: '13px',
      color: '#e6c88a',
      fontFamily: FONTS.body,
      wordWrap: { width: PANEL_W - 36 },
      lineSpacing: 4,
    },
  ).setOrigin(0, 0);
  overlay.add(definition);

  // "Got it!" button — centered near panel bottom
  const btnY = PANEL_Y + PANEL_H - 30;
  const btn = scene.add.text(
    PANEL_X + PANEL_W / 2,
    btnY,
    'Got it!  (Enter)',
    {
      fontSize: '15px',
      fontStyle: 'bold',
      color: COLORS.accent,
      fontFamily: FONTS.body,
      backgroundColor: '#2a1a00',
      padding: { left: 18, right: 18, top: 6, bottom: 6 },
    },
  ).setOrigin(0.5).setInteractive({ useHandCursor: true });
  btn.on('pointerover', () => btn.setColor(COLORS.accentHover));
  btn.on('pointerout', () => btn.setColor(COLORS.accent));
  overlay.add(btn);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', keyHandler);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    scene.events.off(Phaser.Scenes.Events.DESTROY, onShutdown);
    if (overlay.active) overlay.destroy(true);
    onDismiss();
  };

  const keyHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      close();
    }
  };
  window.addEventListener('keydown', keyHandler);

  const onShutdown = () => close();
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  scene.events.once(Phaser.Scenes.Events.DESTROY, onShutdown);

  btn.on('pointerdown', close);
  // Swallow clicks on the panel itself so backdrop-click-to-dismiss doesn't
  // fire when the player clicks on the panel body. Backdrop click also
  // dismisses (consistent with the glossary modal pattern).
  backdrop.on('pointerdown', close);
  panelBg.on('pointerdown', () => { /* swallow */ });

  // Fade-in (subtle — the player just resolved a card and is reading).
  overlay.setAlpha(0);
  scene.tweens.add({
    targets: overlay,
    alpha: 1,
    duration: 180,
    ease: 'Sine.easeOut',
  });
}
