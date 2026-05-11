import { RelicTooltip } from './RelicTooltip';
import relicsData from '../data/json/relics.json';

const RARITY_COLORS: Record<string, number> = {
  common: 0xcccccc,
  uncommon: 0x33cc33,
  rare: 0xff6600,
  epic: 0xff6600,
  legendary: 0xffd700,
};

/**
 * RelicHudStrip -- compact horizontal relic display for Game Scene HUD.
 * Shows up to 8 relics as 28x28 icons with hover tooltips.
 */
export class RelicHudStrip extends Phaser.GameObjects.Container {
  private tooltip: RelicTooltip;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setScrollFactor(0);
    this.setDepth(100);

    this.tooltip = new RelicTooltip(scene);
  }

  updateRelics(relicIds: string[]): void {
    this.removeAll(true);
    const maxVisible = 8;
    const size = 28;
    const gap = 4;

    const visibleRelics = relicIds.slice(0, maxVisible);
    visibleRelics.forEach((id, i) => {
      const relicDef = (relicsData as any[]).find((r: any) => r.id === id);
      const rarity = relicDef?.rarity ?? 'common';
      const rarityColor = RARITY_COLORS[rarity] ?? 0xcccccc;
      const name = relicDef?.name ?? id;
      const effect = relicDef?.description ?? '';
      const source = relicDef?.unlockSource ? `${relicDef.unlockSource} Lv.${relicDef.unlockTier}` : 'Starter';

      const offsetX = i * (size + gap);

      // Background rectangle
      const bg = this.scene.add.rectangle(offsetX, 0, size, size, 0x222222);
      bg.setStrokeStyle(2, rarityColor);
      bg.setInteractive({ useHandCursor: true });
      this.add(bg);

      // Relic Image
      // Textures are 256x256, target size is ~24x24 so we scale by 24/256 ≈ 0.09375
      const relicImg = this.scene.add.image(offsetX, 0, `relic_${id}`);
      relicImg.setDisplaySize(24, 24);
      this.add(relicImg);

      // Hover: show tooltip
      bg.on('pointerover', () => {
        const worldX = this.x + offsetX;
        const worldY = this.y - size / 2 - 36;
        this.tooltip.show(worldX, worldY, name, effect, source, rarityColor);
      });

      bg.on('pointerout', () => {
        this.tooltip.hide();
      });
    });
  }
}
