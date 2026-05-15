import Phaser from 'phaser';

export const COLORS = {
  background: 0x1a1a2e,
  panel: 0x222222,
  accent: '#ffd700',
  accentHover: '#ffffff',
  textPrimary: '#ffffff',
  textSecondary: '#aaaaaa',
  danger: '#ff0000',
  synergy: '#ff00ff',
  xp: '#00ccff',
  material: '#e040fb',
} as const;

export const FONTS = {
  family: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
  title: { fontSize: '32px', fontStyle: 'bold' },
  heading: { fontSize: '24px', fontStyle: 'bold' },
  body: { fontSize: '16px' },
  small: { fontSize: '14px' },
} as const;

export const LAYOUT = {
  canvasWidth: 800,
  canvasHeight: 600,
  centerX: 400,
  centerY: 300,
  panelAlpha: 0.9,
  fadeDuration: 400,
} as const;

/**
 * Phase 9 (Design v2): status-stat + new-tile semantic palette.
 *
 * Each entry is a single-use semantic token (never reused as a generic accent).
 * Hex values are LOCKED by design/04_neutral_and_combos.md §7 (tiles) and the
 * Phase 9 UI-SPEC §Color (VIT/DEX/INT/SPI codes).
 *
 * DO NOT modify the existing COLORS / FONTS / LAYOUT exports above -- those are
 * the v1 design system. SHADOWBLADE_PALETTE is the v2 extension. (Name kept
 * for back-compat; Shadowblade-specific entries removed.)
 */
export const SHADOWBLADE_PALETTE = {
  vit: 0xff6666,
  dex: 0xf0a020,
  int: 0x9966ff,
  spi: 0x22cc44,
  library: 0x7E5BEF,         // LOCKED -- design/04 §7
  arena: 0xC12B2B,           // LOCKED
  shrineOfPact: 0x5A2A6B,    // LOCKED
} as const;

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  onClick: () => void,
  style: 'primary' | 'secondary' = 'primary'
): Phaser.GameObjects.Text {
  const isPrimary = style === 'primary';
  const btn = scene.add.text(x, y, text, {
    fontSize: isPrimary ? '24px' : '16px',
    fontStyle: isPrimary ? 'bold' : undefined,
    color: COLORS.accent,
    fontFamily: FONTS.family,
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  btn.on('pointerover', () => {
    btn.setColor(COLORS.accentHover);
    btn.setScale(1.05);
  });
  btn.on('pointerout', () => {
    btn.setColor(COLORS.accent);
    btn.setScale(1.0);
  });
  btn.on('pointerdown', () => onClick());

  return btn;
}
