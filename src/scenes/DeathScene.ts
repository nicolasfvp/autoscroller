// DeathScene -- run statistics on death.
// Shows "Run Over", cause of death, accumulated stats, XP warning.

import { Scene } from 'phaser';
import { getRun, clearRun } from '../state/RunState';
import { loseAllRunXP } from '../systems/hero/XPSystem';
import type { CombatStats } from '../systems/combat/CombatStats';

export class DeathScene extends Scene {
  constructor() {
    super('DeathScene');
  }

  create(data?: { enemyName?: string; stats?: CombatStats }): void {
    const run = getRun();
    const enemyName = data?.enemyName ?? 'Unknown';
    const stats = data?.stats;

    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Title
    this.add.text(400, 80, 'Run Over', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ff0000',
    }).setOrigin(0.5);

    // Cause of death
    this.add.text(400, 120, `Defeated by ${enemyName}`, {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Stats panel
    this.add.rectangle(400, 300, 400, 280, 0x222222, 0.85);

    // Stats
    const startY = 200;
    const gap = 48;
    const labelX = 240;
    const valueX = 560;

    const statRows: Array<{ label: string; value: string; color: string }> = [
      { label: 'Loops Completed', value: `${run.loop.count}`, color: '#ffffff' },
      { label: 'Total Damage Dealt', value: `${stats?.damageDealt ?? 0}`, color: '#ffffff' },
      { label: 'Total Cards Played', value: `${stats?.cardsPlayed ?? 0}`, color: '#ffffff' },
      { label: 'Total Combos', value: `${stats?.synergiesTriggered ?? 0}`, color: '#ff00ff' },
    ];

    for (let i = 0; i < statRows.length; i++) {
      const row = statRows[i];
      const y = startY + i * gap;

      // Label
      this.add.text(labelX, y, row.label, {
        fontSize: '16px',
        color: '#aaaaaa',
      }).setOrigin(0, 0.5);

      // Value
      this.add.text(valueX, y, row.value, {
        fontSize: '24px',
        color: row.color,
      }).setOrigin(1, 0.5);
    }

    // XP warning
    this.add.text(400, 420, 'All unbanked XP has been lost.', {
      fontSize: '16px',
      color: '#ff0000',
    }).setOrigin(0.5);

    // "Return to Menu" button
    const menuBtn = this.add.text(400, 520, 'Return to Menu', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => menuBtn.setColor('#ffffff'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#ffd700'));
    menuBtn.on('pointerdown', () => {
      loseAllRunXP(run);
      clearRun();
      this.scene.start('MainMenu');
    });

    this.events.on('shutdown', this.cleanup, this);
  }

  private cleanup(): void {
    // No eventBus listeners
  }
}
