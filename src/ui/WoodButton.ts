import Phaser from 'phaser';
import { FONTS } from './StyleConstants';

interface WoodButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  variant?: 'primary' | 'secondary' | 'danger';
}

const VARIANT_COLORS: Record<string, { bg: number; hover: number; text: string }> = {
  primary:   { bg: 0x4a3520, hover: 0x6a5030, text: '#ffd700' },
  secondary: { bg: 0x2a2a2a, hover: 0x3a3a3a, text: '#cccccc' },
  danger:    { bg: 0x5a1a1a, hover: 0x7a2a2a, text: '#ff6666' },
};

export function createWoodButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: WoodButtonOptions = {},
): Phaser.GameObjects.Container {
  const { width = 160, height = 36, fontSize = 14, variant = 'primary' } = opts;
  const colors = VARIANT_COLORS[variant] ?? VARIANT_COLORS.primary;

  const container = scene.add.container(x, y);

  const bg = scene.add.rectangle(0, 0, width, height, colors.bg)
    .setStrokeStyle(2, 0x8b6914)
    .setOrigin(0.5);

  const text = scene.add.text(0, 0, label, {
    fontSize: `${fontSize}px`,
    color: colors.text,
    fontFamily: FONTS.family,
    fontStyle: 'bold',
  }).setOrigin(0.5);

  container.add([bg, text]);
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });

  container.on('pointerover', () => bg.setFillStyle(colors.hover));
  container.on('pointerout',  () => bg.setFillStyle(colors.bg));
  container.on('pointerdown', () => onClick());

  return container;
}
