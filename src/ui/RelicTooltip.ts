import { FONTS } from '../ui/StyleConstants';
import { t } from '../i18n/i18n';
﻿/**
 * RelicTooltip -- hover tooltip showing relic name, effect, and source.
 * Positioned 8px above hovered relic.
 */
export class RelicTooltip extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private effectText: Phaser.GameObjects.Text;
  private sourceText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);

    const fontFamily = FONTS.body;

    // Both panel textures load with the light-chrome tier; fall back to a
    // tinted solid (never the green missing-texture box) if neither is present.
    const tooltipKey = scene.textures.exists('panel_hover_frame') ? 'panel_hover_frame'
      : scene.textures.exists('panel_hover') ? 'panel_hover' : '__WHITE';
    this.bg = scene.add.image(0, 0, tooltipKey).setDisplaySize(180, 96);
    if (tooltipKey === '__WHITE') this.bg.setTint(0x1a0f04).setAlpha(0.95);
    this.add(this.bg);

    this.nameText = scene.add.text(0, -26, '', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily,
    }).setOrigin(0.5, 0.5);
    this.add(this.nameText);

    this.effectText = scene.add.text(0, -2, '', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily,
    }).setOrigin(0.5, 0.5);
    this.add(this.effectText);

    this.sourceText = scene.add.text(0, 22, '', {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily,
    }).setOrigin(0.5, 0.5);
    this.add(this.sourceText);

    this.setScrollFactor(0);
    this.setDepth(200);
    this.setVisible(false);
  }

  show(x: number, y: number, name: string, effect: string, source: string, rarityColor: number): void {
    const colorHex = '#' + rarityColor.toString(16).padStart(6, '0');
    this.nameText.setText(name);
    this.nameText.setColor(colorHex);
    this.effectText.setText(effect);
    this.sourceText.setText(t('relicTip.fromSource', { source }));

    // Auto-width based on longest text
    const maxWidth = Math.max(
      this.nameText.width,
      this.effectText.width,
      this.sourceText.width,
      180
    );
    this.bg.setDisplaySize(maxWidth + 48, 96);

    // Position 8px above hovered relic
    this.setPosition(x, y - 8);
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }
}
