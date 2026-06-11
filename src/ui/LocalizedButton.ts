// Locale-aware image button.
//
// Many scenes use pre-rendered button art (btn_*.png) that has ENGLISH text
// baked into the image. Those can't be re-translated at runtime. This helper
// shows the baked image in English locale, and in pt-BR renders a wood-texture
// + translated-text button of the SAME on-screen dimensions (so scene layout
// is preserved — the size is derived from the image's natural aspect ratio).

import Phaser from 'phaser';
import { FONTS } from './StyleConstants';
import { getLocale } from '../i18n/i18n';

export interface LocalizedButtonOpts {
  /** Explicit height; otherwise derived from the image's aspect ratio. */
  height?: number;
  fontSize?: number;
  /** Tint applied to the wood texture in the pt-BR text variant. */
  variant?: 'normal' | 'danger' | 'primary';
}

/**
 * Create a button at (x, y). In English it draws `imageKey` scaled to
 * `displayWidth`; in pt-BR it draws a wood+text button (same size) showing
 * `label`. Returns the interactive container (origin-centered).
 */
export function localizedImageButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  imageKey: string,
  label: string,
  displayWidth: number,
  onClick: () => void,
  opts: LocalizedButtonOpts = {},
): Phaser.GameObjects.Container {
  const cont = scene.add.container(x, y);
  const hasTex = scene.textures.exists(imageKey);

  // Size: preserve the baked image's aspect so the text variant occupies the
  // same footprint and nothing in the scene shifts.
  let w = displayWidth;
  let h = opts.height ?? displayWidth * 0.26;
  if (hasTex && opts.height === undefined) {
    const src = scene.textures.get(imageKey).getSourceImage() as { width: number; height: number };
    if (src && src.width) h = displayWidth * (src.height / src.width);
  }

  if (getLocale() === 'pt-br' || !hasTex) {
    const tint = opts.variant === 'danger' ? 0xff8866 : opts.variant === 'primary' ? 0xffd680 : undefined;
    if (scene.textures.exists('wood_texture')) {
      const bg = scene.add.image(0, 0, 'wood_texture').setDisplaySize(w, h);
      if (tint !== undefined) bg.setTint(tint);
      cont.add(bg);
    } else {
      cont.add(scene.add.rectangle(0, 0, w, h, 0x2a1a0a));
    }
    cont.add(scene.add.rectangle(0, 0, w, h, 0x000000, 0).setStrokeStyle(2, 0xd4a04a, 0.95));
    cont.add(scene.add.text(0, 0, label, {
      fontSize: `${opts.fontSize ?? Math.max(13, Math.round(h * 0.42))}px`,
      fontStyle: 'bold',
      color: '#f0d080',
      fontFamily: FONTS.body,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: { width: w - 16 },
    }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true));
  } else {
    cont.add(scene.add.image(0, 0, imageKey).setDisplaySize(w, h));
  }

  cont.setSize(w, h).setInteractive({ useHandCursor: true });
  cont.on('pointerover', () => scene.tweens.add({ targets: cont, scale: 1.05, duration: 100 }));
  cont.on('pointerout', () => scene.tweens.add({ targets: cont, scale: 1, duration: 100 }));
  cont.on('pointerdown', onClick);
  return cont;
}
