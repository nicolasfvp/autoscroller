// KeywordIntroOverlay -- single-keyword "first-encounter" teaching modal.
//
// When a baked image asset exists for the keyword (keyword_<name> texture),
// it is shown as a simple image — same approach as TutorialOverlay.
// Falls back to a programmatic panel for any keyword without a baked asset.

import Phaser from 'phaser';
import { COLORS, FONTS, LAYOUT } from './StyleConstants';
import { renderTokenText } from './IconTokens';
import type { KeywordDef } from './KeywordDefinitions';

const OVERLAY_DEPTH = 12000;
const BACKDROP_ALPHA = 0.62;

// Inner panel dimensions (portrait frame, same ratio as tutorial panels)
const PANEL_W = 360;
const PANEL_H = 440;

const CATEGORY_COLOR: Record<KeywordDef['category'], string> = {
  stack:    '#ff8c00',
  modifier: '#ffd700',
  stat:     '#66ccff',
};

const CATEGORY_LABEL: Record<KeywordDef['category'], string> = {
  stack:    'New Stack',
  modifier: 'New Modifier',
  stat:     'New Stat',
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

  const cx = LAYOUT.canvasWidth / 2;
  const cy = LAYOUT.canvasHeight / 2;

  // Use baked PNG asset when available (keyword_vengeance, keyword_brace, etc.)
  const bakedKey = `keyword_${keyword.keyword.toLowerCase()}`;
  if (scene.textures.exists(bakedKey)) {
    const img = scene.add.image(cx, cy, bakedKey).setInteractive();
    const src = scene.textures.get(bakedKey).getSourceImage() as HTMLImageElement;
    const displayW = Math.min(src.width, LAYOUT.canvasWidth * 0.9);
    img.setDisplaySize(displayW, displayW * (src.height / src.width));
    overlay.add(img);

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
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') close(); };
    window.addEventListener('keydown', keyHandler);
    const onShutdown = () => close();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    scene.events.once(Phaser.Scenes.Events.DESTROY, onShutdown);
    img.on('pointerdown', close);
    backdrop.on('pointerdown', close);
    overlay.setAlpha(0);
    scene.tweens.add({ targets: overlay, alpha: 1, duration: 180, ease: 'Sine.easeOut' });
    return;
  }

  // Fallback: programmatic panel for keywords without a baked asset.
  const innerPanel = scene.add.container(cx, cy - 30);
  innerPanel.setScale(0.65);
  overlay.add(innerPanel);

  const lX = -PANEL_W / 2;
  const lY = -PANEL_H / 2;

  const frameKey = scene.textures.exists('panel_keyword_frame') ? 'panel_keyword_frame' : '__DEFAULT';
  const panelBg = scene.add.image(0, 0, frameKey)
    .setDisplaySize(PANEL_W, PANEL_H)
    .setInteractive();
  innerPanel.add(panelBg);

  const badge = scene.add.text(lX + 18, lY + 16, `New ${CATEGORY_LABEL[keyword.category]}`, {
    fontSize: '11px', fontStyle: 'bold', color: '#aaaaaa',
    fontFamily: FONTS.body, stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0, 0);
  innerPanel.add(badge);

  const name = scene.add.text(lX + 18, lY + 34, keyword.keyword, {
    fontSize: '26px', fontStyle: 'bold', color: CATEGORY_COLOR[keyword.category],
    fontFamily: FONTS.body, stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0, 0);
  innerPanel.add(name);

  innerPanel.add(scene.add.rectangle(0, lY + 78, PANEL_W - 36, 1, 0xffd700, 0.4));

  const definition = renderTokenText(scene, lX + 18, lY + 88, keyword.definition, {
    fontSize: '13px', color: '#e6c88a', fontFamily: FONTS.body,
    wrapWidth: PANEL_W - 36, lineSpacing: 4,
  });
  innerPanel.add(definition);

  const btn = scene.add.text(0, lY + PANEL_H - 30, 'Got it!  (Enter)', {
    fontSize: '15px', fontStyle: 'bold', color: COLORS.accent,
    fontFamily: FONTS.body, backgroundColor: '#2a1a00',
    padding: { left: 18, right: 18, top: 6, bottom: 6 },
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  btn.on('pointerover', () => btn.setColor(COLORS.accentHover));
  btn.on('pointerout', () => btn.setColor(COLORS.accent));
  innerPanel.add(btn);

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
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') close();
  };
  window.addEventListener('keydown', keyHandler);

  const onShutdown = () => close();
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  scene.events.once(Phaser.Scenes.Events.DESTROY, onShutdown);

  btn.on('pointerdown', close);
  backdrop.on('pointerdown', close);

  overlay.setAlpha(0);
  scene.tweens.add({ targets: overlay, alpha: 1, duration: 180, ease: 'Sine.easeOut' });
}
