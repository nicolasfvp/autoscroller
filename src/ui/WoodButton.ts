// WoodButton — themed button using wood_texture + gold trim.
// Falls back to a stroked rectangle when the asset is missing so a missing
// bundle file doesn't soft-brick the UI.

import Phaser from 'phaser';
import { FONTS } from './StyleConstants';

export type WoodButtonVariant = 'normal' | 'primary' | 'danger';

const VARIANT_TINT: Record<WoodButtonVariant, number> = {
  normal:  0xffffff,
  primary: 0xffd680,   // warm gold tint for primary CTA
  danger:  0xff8866,   // ember/red tint for destructive actions
};

const VARIANT_TEXT: Record<WoodButtonVariant, string> = {
  normal:  '#f0d080',
  primary: '#ffe66d',
  danger:  '#ffd0c0',
};

export interface WoodButtonOpts {
  width?:   number;
  height?:  number;
  fontSize?: number;
  variant?: WoodButtonVariant;
}

export interface WoodButtonHandle {
  container: Phaser.GameObjects.Container;
  setText(text: string): void;
  setVariant(variant: WoodButtonVariant): void;
  setEnabled(enabled: boolean): void;
  destroy(): void;
}

export function createWoodButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: WoodButtonOpts = {},
): WoodButtonHandle {
  const width    = opts.width    ?? 240;
  const height   = opts.height   ?? 56;
  const fontSize = opts.fontSize ?? 22;
  let variant: WoodButtonVariant = opts.variant ?? 'normal';
  let enabled = true;

  const container = scene.add.container(x, y);

  // Invisible hit rectangle — avoids picking up transparent edge pixels of the asset.
  const hit = scene.add.rectangle(0, 0, width, height, 0x000000, 0)
    .setInteractive({ useHandCursor: true });

  const hasWood = scene.textures.exists('wood_texture');
  let bgImage: Phaser.GameObjects.Image | null = null;
  let bgRect:  Phaser.GameObjects.Rectangle | null = null;
  if (hasWood) {
    bgImage = scene.add.image(0, 0, 'wood_texture').setDisplaySize(width, height);
    bgImage.setTint(VARIANT_TINT[variant]);
  } else {
    bgRect = scene.add.rectangle(0, 0, width, height, 0x2a1a0a);
  }
  // Gold trim — always drawn so the button looks framed even without the texture.
  const trim = scene.add.rectangle(0, 0, width, height, 0x000000, 0)
    .setStrokeStyle(2, 0xd4a04a, 0.95);
  const bg = (bgImage ?? bgRect) as Phaser.GameObjects.GameObject;

  const text = scene.add.text(0, 0, label, {
    fontSize:        `${fontSize}px`,
    fontStyle:       'bold',
    color:           VARIANT_TEXT[variant],
    fontFamily:      FONTS.family,
    stroke:          '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true);

  container.add([bg, trim, hit, text]);

  let pressed = false;

  hit.on('pointerover', () => {
    if (!enabled) return;
    container.setScale(1.04);
    if (bgImage) {
      bgImage.setTint(Phaser.Display.Color.IntegerToColor(VARIANT_TINT[variant]).brighten(15).color);
    }
  });
  hit.on('pointerout', () => {
    container.setScale(1);
    if (bgImage) bgImage.setTint(VARIANT_TINT[variant]);
    pressed = false;
  });
  hit.on('pointerdown', () => {
    if (!enabled) return;
    pressed = true;
    container.setScale(0.96);
  });
  hit.on('pointerup', () => {
    if (!enabled) return;
    container.setScale(1.04);
    if (!pressed) return;
    pressed = false;
    onClick();
  });

  return {
    container,
    setText:    (s: string) => text.setText(s),
    setVariant: (v: WoodButtonVariant) => {
      variant = v;
      if (bgImage) bgImage.setTint(VARIANT_TINT[v]);
      text.setColor(VARIANT_TEXT[v]);
    },
    setEnabled: (e: boolean) => {
      enabled = e;
      container.setAlpha(e ? 1 : 0.5);
    },
    destroy: () => container.destroy(true),
  };
}
