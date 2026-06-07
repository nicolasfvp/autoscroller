// KeywordIntroOverlay -- single-keyword "first-encounter" teaching modal.
//
// When a baked image asset exists for the keyword (keyword_<name> texture),
// it is shown as a simple image — same approach as TutorialOverlay.
// Falls back to a programmatic panel for any keyword without a baked asset.

import Phaser from 'phaser';
import { COLORS, FONTS, LAYOUT } from './StyleConstants';
import type { KeywordDef } from './KeywordDefinitions';

const OVERLAY_DEPTH = 12000;
const BACKDROP_ALPHA = 0.62;

// Baked image display width (same ratio as tutorial panels)
const IMG_DISPLAY_W = 360;

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
  const cy = LAYOUT.canvasHeight / 2 - 20;

  const texKey = `keyword_${keyword.keyword.toLowerCase()}`;
  const useImage = scene.textures.exists(texKey);

  let panelTopY: number;
  let panelDisplayH: number;

  if (useImage) {
    // ── Baked image path ────────────────────────────────────────────
    const img = scene.add.image(0, 0, texKey).setOrigin(0.5, 0.5);
    const sc = IMG_DISPLAY_W / img.width;
    img.setScale(sc);
    panelDisplayH = Math.round(img.height * sc);
    panelTopY = cy - panelDisplayH / 2;
    img.x = cx;
    img.y = cy;
    img.setInteractive();
    img.on('pointerdown', () => { /* swallow */ });
    overlay.add(img);
  } else {
    // ── Programmatic fallback ────────────────────────────────────────
    const PANEL_W = 320;
    const PAD = 16;

    const nameColor = CATEGORY_COLOR[keyword.category];

    const badge = scene.add.text(cx - PANEL_W / 2 + PAD, cy - 80,
      CATEGORY_LABEL[keyword.category],
      { fontSize: '11px', fontStyle: 'italic', color: '#999999', fontFamily: FONTS.body },
    ).setOrigin(0, 0);

    const name = scene.add.text(cx - PANEL_W / 2 + PAD, cy - 62,
      keyword.keyword,
      { fontSize: '22px', fontStyle: 'bold', color: nameColor, fontFamily: FONTS.body,
        stroke: '#000000', strokeThickness: 3 },
    ).setOrigin(0, 0);

    const def = scene.add.text(cx - PANEL_W / 2 + PAD, cy - 20,
      keyword.definition,
      { fontSize: '13px', color: '#e6c88a', fontFamily: FONTS.body,
        wordWrap: { width: PANEL_W - PAD * 2 }, lineSpacing: 4 },
    ).setOrigin(0, 0);

    panelDisplayH = 160;
    panelTopY = cy - 90;

    const bg = scene.add.rectangle(cx, cy - 90 + panelDisplayH / 2,
      PANEL_W, panelDisplayH, 0x1a1008, 0.96,
    ).setOrigin(0.5, 0.5).setInteractive();
    bg.on('pointerdown', () => { /* swallow */ });
    bg.setStrokeStyle(2, 0xffd700, 1);

    overlay.add(bg);
    overlay.add(badge);
    overlay.add(name);
    overlay.add(def);
  }

  // ── "Got it!" button ─────────────────────────────────────────────
  const BTN_TARGET_W = 110;
  const btnY = panelTopY + panelDisplayH + 22;
  let btn: Phaser.GameObjects.Image | Phaser.GameObjects.Text;

  if (scene.textures.exists('btn_got_it')) {
    const imgBtn = scene.add.image(cx, btnY, 'btn_got_it')
      .setScale(BTN_TARGET_W / 1443)
      .setInteractive({ useHandCursor: true });
    imgBtn.on('pointerover', () => { imgBtn.setAlpha(0.82); imgBtn.setScale(BTN_TARGET_W / 1443 * 1.05); });
    imgBtn.on('pointerout',  () => { imgBtn.setAlpha(1);    imgBtn.setScale(BTN_TARGET_W / 1443); });
    overlay.add(imgBtn);
    btn = imgBtn;
  } else {
    const txtBtn = scene.add.text(cx, btnY, 'Got it!  (Enter)',
      { fontSize: '13px', fontStyle: 'bold', color: COLORS.accent,
        fontFamily: FONTS.body, backgroundColor: '#2a1a00',
        padding: { left: 12, right: 12, top: 4, bottom: 4 } },
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });
    txtBtn.on('pointerover', () => txtBtn.setColor(COLORS.accentHover));
    txtBtn.on('pointerout',  () => txtBtn.setColor(COLORS.accent));
    overlay.add(txtBtn);
    btn = txtBtn;
  }

  // ── Dismiss logic ─────────────────────────────────────────────────
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
