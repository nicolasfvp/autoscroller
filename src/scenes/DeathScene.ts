// DeathScene -- run statistics on death.
// Shows "Run Over", cause of death, accumulated stats, material retention summary.

import { Scene } from 'phaser';
import { getRun, clearRun } from '../state/RunState';
import { bankRunRewards, getStorehouseEffects } from '../systems/MetaProgressionSystem';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import { saveManager } from '../core/SaveManager';
import type { CombatStats } from '../systems/combat/CombatStats';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';
import { SCENE_KEYS, stopAllRunScenes } from '../state/SceneKeys';

export class DeathScene extends Scene {
  private transitioning = false;

  constructor() {
    super(SCENE_KEYS.DEATH);
  }

  private fadeToScene(sceneKey: string, data?: any): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      stopAllRunScenes(this, SCENE_KEYS.DEATH);
      this.scene.start(sceneKey, data);
    });
  }

  async create(data?: { enemyName?: string; stats?: CombatStats }): Promise<void> {
    this.scene.bringToTop();
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    const run = getRun();
    const enemyName = data?.enemyName ?? 'Unknown';
    const combatStats = data?.stats;
    const globalStats = run.stats;

    // Background: Dark abyss
    this.cameras.main.setBackgroundColor('#0a0a0a');

    // Subtle blood spatters/runes background
    const bgGfx = this.add.graphics();
    bgGfx.fillStyle(0x440000, 0.2);
    for (let i = 0; i < 12; i++) {
      const rx = Math.random() * 800;
      const ry = Math.random() * 600;
      const rSize = 20 + Math.random() * 60;
      bgGfx.fillCircle(rx, ry, rSize);
    }
    bgGfx.lineStyle(2, 0x333333, 0.3);
    for (let i = 0; i < 20; i++) {
      const rx = Math.random() * 800;
      const ry = Math.random() * 600;
      bgGfx.strokeRect(rx, ry, 10, 10);
    }

    // ── Title ───────────────────────────────────────────────────
    this.add.text(400, 70, 'RUN OVER', {
      fontFamily: FONTS.family, fontSize: '64px', fontStyle: 'bold',
      color: '#ff2222', stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(400, 120, `Defeated by ${enemyName}`, {
      fontFamily: FONTS.family, fontSize: '20px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // ── Central Panel ───────────────────────────────────────────
    const PX = 400; const PY = 330;
    const PW = 520; const PH = 320;

    const panelGfx = this.add.graphics();
    // Outer metallic frame
    panelGfx.lineStyle(4, 0x444444, 1);
    panelGfx.fillStyle(0x1a1a1a, 0.95);
    panelGfx.fillRoundedRect(PX - PW / 2, PY - PH / 2, PW, PH, 12);
    panelGfx.strokeRoundedRect(PX - PW / 2, PY - PH / 2, PW, PH, 12);

    // Inner purple glow border
    panelGfx.lineStyle(2, 0x8822ff, 0.6);
    panelGfx.strokeRoundedRect(PX - PW / 2 + 6, PY - PH / 2 + 6, PW - 12, PH - 12, 8);

    // ── Stats Rows ──────────────────────────────────────────────
    const startX = PX - PW / 2 + 40;
    let currentY = PY - PH / 2 + 40;
    const gap = 36;

    const createStatRow = (icon: string, label: string, value: string | number) => {
      this.add.text(startX, currentY, icon, { fontFamily: FONTS.family, fontSize: '24px' }).setOrigin(0, 0.5);
      this.add.text(startX + 40, currentY, label, {
        fontFamily: FONTS.family, fontSize: '20px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0, 0.5);
      this.add.text(PX + PW / 2 - 40, currentY, value.toString(), {
        fontFamily: FONTS.family, fontSize: '20px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(1, 0.5);
      currentY += gap;
    };

    createStatRow('🔗', 'Loops Completed', run.loop.count);
    createStatRow('⚔️', 'Total Damage Dealt', globalStats.damageDealt || (combatStats?.damageDealt ?? 0));
    createStatRow('🃏', 'Total Cards Played', globalStats.cardsPlayed || (combatStats?.cardsPlayed ?? 0));
    createStatRow('🔥', 'Total Combos', globalStats.combosTriggered || (combatStats?.synergiesTriggered ?? 0));

    // ── Resources Section (Retention) ───────────────────────────
    const metaState = await loadMetaState();
    const storehouseLevel = metaState.buildings.storehouse?.level ?? 0;
    const { deathRetention } = getStorehouseEffects(storehouseLevel);
    const retentionPct = Math.round(deathRetention * 100);

    currentY += 10;
    this.add.text(startX, currentY, `\u2705 You Keep (${retentionPct}%):`, {
      fontFamily: FONTS.family, fontSize: '18px', fontStyle: 'bold', color: '#00ff00'
    }).setOrigin(0, 0.5);

    // Materials logic
    const materialsEarned = { ...(run.economy.materials ?? {}) };
    const xpEarned = run.hero.runXP ?? 0;

    const materialsToShow = Object.entries(materialsEarned).filter(([, v]) => v > 0);

    if (materialsToShow.length === 0) {
      this.add.text(startX + 180, currentY, 'None', {
        fontFamily: FONTS.family, fontSize: '16px', color: '#888888'
      }).setOrigin(0, 0.5);
    } else {
      // Two-column layout: up to 3 rows per column so all earned materials are
      // visible even when the player banked herbs/bone/iron/crystal in one run.
      const colWidth = 160;
      const rowHeight = 22;
      const baseX = startX + 150;
      const baseY = currentY;
      materialsToShow.forEach(([mat, amount], i) => {
        const col = Math.floor(i / 3);
        const row = i % 3;
        const cellX = baseX + col * colWidth;
        const cellY = baseY + row * rowHeight;
        const texture = this.textures.exists(`mat_${mat}`) ? `mat_${mat}` : 'mat_stone';
        this.add.image(cellX - 20, cellY, texture).setDisplaySize(18, 18);

        // Mirror the at-least-1 banking rule so the preview matches the
        // value the player actually gets in MetaState.
        let retained = Math.floor(amount * deathRetention);
        if (retained === 0 && amount > 0 && deathRetention > 0) retained = 1;

        this.add.text(cellX, cellY, `${mat}: ${retained}`, {
          fontFamily: FONTS.family, fontSize: '13px', color: '#ffffff'
        }).setOrigin(0, 0.5);
      });
      // Shift downstream text past the tallest column.
      const rowsUsed = Math.min(3, materialsToShow.length);
      currentY += (rowsUsed - 1) * rowHeight;
    }

    // ── Footer Messages ─────────────────────────────────────────
    currentY += 45;
    this.add.text(PX, currentY, '💀 All unbanked XP has been lost.', {
      fontFamily: FONTS.family, fontSize: '18px', fontStyle: 'bold', color: '#ff4444'
    }).setOrigin(0.5);

    const unlockNotice = this.add.text(PX, currentY + 30, 'New unlocks available! Return to the city.', {
      fontFamily: FONTS.family, fontSize: '16px', fontStyle: 'bold', color: '#ffcc00'
    }).setOrigin(0.5);
    this.tweens.add({ targets: unlockNotice, alpha: 0.5, duration: 800, yoyo: true, repeat: -1 });

    // ── Return Button ───────────────────────────────────────────
    createButton(this, 400, 540, 'Return to City', async () => {
      stopAllRunScenes(this, SCENE_KEYS.DEATH);
      await saveManager.clear();
      clearRun();
      this.fadeToScene(SCENE_KEYS.CITY_HUB);
    }, 'primary');

    // ── Bank Rewards ────────────────────────────────────────────
    const updatedState = bankRunRewards(
      materialsEarned, xpEarned, 'death',
      { seed: run.runId, loopsCompleted: Math.max(0, run.loop.count - 1), bossesDefeated: run.loop.bossesDefeated ?? 0 },
      metaState, run.hero.className ?? 'warrior', run.economy.gatheringBoost ?? 0
    );
    await saveMetaState(updatedState);

    this.events.on('shutdown', this.cleanup, this);
  }

  private cleanup(): void {
    // No eventBus listeners
  }
}
