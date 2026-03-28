// PostCombatScene -- overlay showing combat results summary.
// Reads CombatStats passed from CombatScene via scene data.

import { Scene } from 'phaser';
import type { CombatStats } from '../systems/combat/CombatStats';
import { shouldOfferReward, type RNG } from '../systems/deck/LootSystem';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';

/** Simple Math.random-based RNG for runtime use */
const mathRng: RNG = { next: () => Math.random() };

export class PostCombatScene extends Scene {
  private transitioning = false;

  constructor() {
    super('PostCombatScene');
  }

  private fadeToScene(sceneKey: string, data?: any): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });
  }

  create(data: { stats: CombatStats; enemyType: string; xpEarned: number }): void {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    const stats = data.stats;
    const xpEarned = data.xpEarned ?? 0;

    this.cameras.main.setBackgroundColor(COLORS.background);

    // Overlay panel
    this.add.rectangle(400, 300, 500, 380, COLORS.panel, LAYOUT.panelAlpha);

    // Title
    this.add.text(400, 140, 'Battle Summary', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    // Stats grid
    const startY = 190;
    const gap = 32;
    const labelX = 220;
    const valueX = 580;

    const statRows: Array<{ label: string; value: string; color: string }> = [
      { label: 'Damage Dealt', value: `${stats.damageDealt}`, color: COLORS.textPrimary },
      { label: 'Damage Taken', value: `${stats.damageReceived}`, color: stats.damageReceived > 0 ? COLORS.danger : COLORS.textPrimary },
      { label: 'Cards Played', value: `${stats.cardsPlayed}`, color: COLORS.textPrimary },
      { label: 'Combos', value: `${stats.synergiesTriggered}`, color: stats.synergiesTriggered > 0 ? COLORS.synergy : COLORS.textPrimary },
      { label: 'XP Earned', value: `${xpEarned}`, color: COLORS.xp },
    ];

    for (let i = 0; i < statRows.length; i++) {
      const row = statRows[i];
      const y = startY + i * gap;

      this.add.text(labelX, y, row.label, {
        fontSize: '16px',
        color: COLORS.textSecondary,
        fontFamily: FONTS.family,
      }).setOrigin(0, 0.5);

      this.add.text(valueX, y, row.value, {
        fontSize: '16px',
        color: row.color,
        fontFamily: FONTS.family,
      }).setOrigin(1, 0.5);
    }

    // Continue button
    createButton(this, 400, 420, 'Continue', () => {
      const enemyType = (data.enemyType ?? 'normal') as 'normal' | 'elite' | 'boss';
      if (shouldOfferReward(enemyType, mathRng)) {
        this.fadeToScene('RewardScene');
      } else {
        this.scene.stop();
        this.scene.resume('GameScene');
      }
    }, 'primary');

    this.events.on('shutdown', this.cleanup, this);
  }

  private cleanup(): void {
    // No eventBus listeners
  }
}
