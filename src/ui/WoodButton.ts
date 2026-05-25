// WoodButton — themed button using the `panel_wood_button` asset (wooden plank
// with gold filigree corners). Replaces flat colored Rectangle buttons that
// looked like AI-mock chrome. Falls back to a stroked rectangle when the
// asset is missing so a missing bundle file doesn't soft-brick the UI.

import Phaser from 'phaser';
import { FONTS } from './StyleConstants';

export type WoodButtonVariant = 'normal' | 'primary' | 'danger';

const VARIANT_TINT: Record<WoodButtonVariant, number> = {
  normal: 0xffffff,
  primary: 0xffd680,   // warm gold tint for primary CTA
  danger: 0xff8866,    // ember/red tint for destructive actions
};

const VARIANT_TEXT: Record<WoodButtonVariant, string> = {
  normal: '#f0d080',
  primary: '#ffe66d',
  danger: '#ffd0c0',
};

export interface WoodButtonOpts {
  /** Button width — defaults to 240. */
  width?: number;
  /** Button height — defaults to 56. */
  height?: number;
  /** Font size in px — defaults to 22. */
  fontSize?: number;
  /** Visual variant. Defaults to 'normal'. */
  variant?: WoodButtonVariant;
}

export interface WoodButtonHandle {
  /** Root container — add to parent containers, or position via .setPosition. */
  container: Phaser.GameObjects.Container;
  /** Update the visible label. */
  setText(text: string): void;
  /** Update the variant (tint + label color). */
  setVariant(variant: WoodButtonVariant): void;
  /** Enable/disable click interaction. */
  setEnabled(enabled: boolean): void;
  /** Destroy the button and all its children. */
  destroy(): void;
}

/**
 * Create a wooden button anchored at (x, y) with the given label.
 * The image asset has gold filigree corners that look themed by default.
 */
export function createWoodButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: WoodButtonOpts = {},
): WoodButtonHandle {
  const width = opts.width ?? 240;
  const height = opts.height ?? 56;
  const fontSize = opts.fontSize ?? 22;
  let variant: WoodButtonVariant = opts.variant ?? 'normal';
  let enabled = true;

  const container = scene.add.container(x, y);

  // Hit target: invisible rectangle sized to the button bounds. Using the
  // image directly as the hit area picks up the transparent surrounding pixels
  // of the asset, which feels off.
  const hit = scene.add.rectangle(0, 0, width, height, 0x000000, 0)
    .setInteractive({ useHandCursor: true });

  // Background composition: a wood-texture tile sized to fit + a gold stroke
  // around it for the filigree-trim feel. The first iteration tried using the
  // Grok-generated `panel_wood_button` PNG directly, but Grok wrote a black
  // background instead of true transparency — every button rendered as a
  // wooden plank surrounded by a thick black box. The existing `wood_texture`
  // asset is small, transparent, and warm-toned; pairing it with a gold rect
  // stroke gives the same medieval feel without the broken alpha.
  const hasWood = scene.textures.exists('wood_texture');
  let bgImage: Phaser.GameObjects.Image | null = null;
  let bgRect: Phaser.GameObjects.Rectangle | null = null;
  if (hasWood) {
    bgImage = scene.add.image(0, 0, 'wood_texture').setDisplaySize(width, height);
    bgImage.setTint(VARIANT_TINT[variant]);
  } else {
    bgRect = scene.add.rectangle(0, 0, width, height, 0x2a1a0a);
  }
  // Always draw the gold trim regardless of the wood-texture path so the
  // button looks framed even if the texture is missing.
  const trim = scene.add.rectangle(0, 0, width, height, 0x000000, 0)
    .setStrokeStyle(2, 0xd4a04a, 0.95);
  const bg: Phaser.GameObjects.GameObject = (bgImage ?? bgRect)!;

  const text = scene.add.text(0, 0, label, {
    fontSize: `${fontSize}px`,
    fontStyle: 'bold',
    color: VARIANT_TEXT[variant],
    fontFamily: FONTS.family,
    stroke: '#000000',
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
    container.setScale(1.0);
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
    setText: (s: string) => text.setText(s),
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
