// DeathScene -- run statistics on death.
// Shows "Run Over", cause of death, accumulated stats, material retention summary.

import { Scene } from 'phaser';
import { getRun, clearRun } from '../state/RunState';
import { loseAllRunXP } from '../systems/hero/XPSystem';
import { bankRunRewards, getStorehouseEffects } from '../systems/MetaProgressionSystem';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import type { CombatStats } from '../systems/combat/CombatStats';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';

export class DeathScene extends Scene {
  private transitioning = false;

  constructor() {
    super('DeathScene');
  }

  private fadeToScene(sceneKey: string, data?: any): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('GameScene');
      this.scene.start(sceneKey, data);
    });
  }

  async create(data?: { enemyName?: string; stats?: CombatStats }): Promise<void> {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    const run = getRun();
    const enemyName = data?.enemyName ?? 'Unknown';
    const stats = data?.stats;

    this.cameras.main.setBackgroundColor(COLORS.background);

    const fontFamily = FONTS.family;

    // Title
    this.add.text(400, 60, 'Run Over', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: COLORS.danger,
      fontFamily,
    }).setOrigin(0.5);

    // Cause of death
    this.add.text(400, 95, `Defeated by ${enemyName}`, {
      fontSize: '16px',
      color: COLORS.textSecondary,
      fontFamily,
    }).setOrigin(0.5);

    // Stats panel
    this.add.rectangle(400, 270, 400, 320, COLORS.panel, LAYOUT.panelAlpha);

    // Stats
    const startY = 145;
    const gap = 38;
    const labelX = 240;
    const valueX = 560;

    // Calculate materials retained on death (10% base, storehouse may increase)
    const materialsEarned: Record<string, number> = { ...(run.economy.materials ?? {}) };
    const xpEarned = run.hero.runXP ?? 0;
    const metaState = await loadMetaState();
    const storehouseLevel = metaState.buildings.storehouse?.level ?? 0;
    const { deathRetention } = getStorehouseEffects(storehouseLevel);
    const retentionPct = Math.round(deathRetention * 100);

    const retainedEntries = Object.entries(materialsEarned)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}: ${Math.floor(v * deathRetention)}`);
    const retainedLines = retainedEntries.length > 0 ? retainedEntries.join(', ') : 'None';

    const statRows: Array<{ label: string; value: string; color: string }> = [
      { label: 'Loops Completed', value: `${run.loop.count}`, color: COLORS.textPrimary },
      { label: 'Total Damage Dealt', value: `${stats?.damageDealt ?? 0}`, color: COLORS.textPrimary },
      { label: 'Total Cards Played', value: `${stats?.cardsPlayed ?? 0}`, color: COLORS.textPrimary },
      { label: 'Total Combos', value: `${stats?.synergiesTriggered ?? 0}`, color: COLORS.synergy },
      { label: `\u2705 You Keep (${retentionPct}%)`, value: retainedLines, color: '#00ff00' },
    ];

    for (let i = 0; i < statRows.length; i++) {
      const row = statRows[i];
      const y = startY + i * gap;

      // Label
      this.add.text(labelX, y, row.label, {
        fontSize: '16px',
        color: COLORS.textSecondary,
        fontFamily,
      }).setOrigin(0, 0.5);

      // Value
      this.add.text(valueX, y, row.value, {
        fontSize: '24px',
        color: row.color,
        fontFamily,
      }).setOrigin(1, 0.5);
    }

    // XP warning
    this.add.text(400, startY + statRows.length * gap + 10, 'All unbanked XP has been lost.', {
      fontSize: '16px',
      color: COLORS.danger,
      fontFamily,
    }).setOrigin(0.5);

    // Bank run rewards to meta state (metaState already loaded above for storehouse)
    const updatedState = bankRunRewards(
      materialsEarned,
      xpEarned,
      'death',
      {
        seed: (run as any).seed ?? 'unknown',
        loopsCompleted: run.loop.count,
        bossesDefeated: 0,
      },
      metaState
    );
    await saveMetaState(updatedState);

    // Unlock notification
    const unlockY = startY + statRows.length * gap + 45;
    const unlockNotice = this.add.text(400, unlockY, 'New unlocks available! Return to the city.', {
      fontSize: '16px',
      color: COLORS.accent,
      fontFamily,
    }).setOrigin(0.5);

    // Pulse tween
    this.tweens.add({
      targets: unlockNotice,
      alpha: { from: 1, to: 0.5 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // "Return to City" button
    createButton(this, 400, 520, 'Return to City', () => {
      loseAllRunXP(run);
      clearRun();
      this.fadeToScene('CityHub');
    }, 'primary');

    this.events.on('shutdown', this.cleanup, this);
  }

  private cleanup(): void {
    // No eventBus listeners
  }
}
