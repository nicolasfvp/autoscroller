// GlossaryButton -- small circular "?" affordance that opens the keyword
// glossary modal. Mounted by any scene that benefits from a persistent
// reference panel: DeckCustomization, Combat.
//
// Visual: 28×28 circle, dark fill + accent stroke, "?" glyph centered.
// Hover brightens stroke + glyph; click opens the glossary.

import Phaser from 'phaser';
import { COLORS, FONTS } from './StyleConstants';
import { openGlossary } from './GlossaryPanel';

const BUTTON_RADIUS = 14;
const BUTTON_FILL = 0x1a1a2e;
const BUTTON_STROKE = 0x9a6030;
const BUTTON_STROKE_HOVER = 0xffd700;

/**
 * Add a "?" button at the given canvas-space position. Returns the
 * Container so callers can attach it to a parent, reposition, or destroy.
 *
 * `depth` controls draw order (default 5000 — above HUD, below modals).
 */
export function addGlossaryButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 5000,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y).setDepth(depth);

  const circle = scene.add.circle(0, 0, BUTTON_RADIUS, BUTTON_FILL, 0.92)
    .setStrokeStyle(2, BUTTON_STROKE);
  container.add(circle);

  const glyph = scene.add.text(0, 1, '?', {
    fontSize: '18px',
    fontStyle: 'bold',
    color: COLORS.accent,
    fontFamily: FONTS.family,
  }).setOrigin(0.5);
  container.add(glyph);

  // Use the circle for hit testing so the click area matches the visual.
  circle.setInteractive(
    new Phaser.Geom.Circle(0, 0, BUTTON_RADIUS),
    Phaser.Geom.Circle.Contains,
  );
  circle.input!.cursor = 'pointer';

  circle.on('pointerover', () => {
    circle.setStrokeStyle(2, BUTTON_STROKE_HOVER);
    glyph.setColor(COLORS.accentHover);
  });
  circle.on('pointerout', () => {
    circle.setStrokeStyle(2, BUTTON_STROKE);
    glyph.setColor(COLORS.accent);
  });
  circle.on('pointerdown', () => openGlossary(scene));

  return container;
}
