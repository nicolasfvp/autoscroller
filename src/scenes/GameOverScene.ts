import { Scene } from 'phaser';
import { getRun, clearRun } from '../state/RunState';
import { saveManager } from '../core/SaveManager';
import { FONTS, LAYOUT, createButton } from '../ui/StyleConstants';
import { SCENE_KEYS, stopAllRunScenes } from '../state/SceneKeys';

/**
 * GameOverScene -- displays final run statistics.
 * Offers New Run and Main Menu buttons.
 */
export class GameOverScene extends Scene {
  private transitioning = false;

  constructor() {
    super(SCENE_KEYS.GAME_OVER);
  }

  private fadeToScene(sceneKey: string, data?: any): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });
  }

  create(data?: { defeatedBy?: string }): void {
    this.scene.bringToTop();
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    const run = getRun();
    const stats = run.stats;

    // Background: Dark abyss
    this.cameras.main.setBackgroundColor('#0a0a0a');

    // Subtle blood spatters/runes background
    const bgGfx = this.add.graphics();
    bgGfx.fillStyle(0x440000, 0.2);
    // Draw some random "blood" blobs
    for (let i = 0; i < 12; i++) {
      const rx = Math.random() * 800;
      const ry = Math.random() * 600;
      const rSize = 20 + Math.random() * 60;
      bgGfx.fillCircle(rx, ry, rSize);
    }
    // Subtle rune-like symbols (simplified as lines/points)
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

    const defeatedText = data?.defeatedBy ? `Defeated by ${data.defeatedBy}` : 'The journey has ended...';
    this.add.text(400, 120, defeatedText, {
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
      this.add.text(startX, currentY, icon, { fontSize: '24px' }).setOrigin(0, 0.5);
      this.add.text(startX + 40, currentY, label, {
        fontFamily: FONTS.family, fontSize: '20px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0, 0.5);
      this.add.text(PX + PW / 2 - 40, currentY, value.toString(), {
        fontFamily: FONTS.family, fontSize: '20px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(1, 0.5);
      currentY += gap;
    };

    createStatRow('🔗', 'Loops Completed', run.loop.count);
    createStatRow('⚔️', 'Total Damage Dealt', stats.damageDealt);
    createStatRow('🃏', 'Total Cards Played', stats.cardsPlayed);
    createStatRow('🔥', 'Total Combos', stats.combosTriggered);

    // ── Resources Section ───────────────────────────────────────
    currentY += 10;
    this.add.text(startX, currentY, '✅ You Keep:', {
      fontFamily: FONTS.family, fontSize: '18px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0, 0.5);

    // Resource: Stone
    const stoneAmt = run.economy.materials['stone'] || 0;
    this.add.image(startX + 130, currentY, 'mat_stone').setDisplaySize(24, 24);
    // Draw a small progress bar
    panelGfx.fillStyle(0x333333);
    panelGfx.fillRect(startX + 150, currentY - 6, 80, 12);
    panelGfx.fillStyle(0x22cc44);
    panelGfx.fillRect(startX + 150, currentY - 6, 40, 12); // dummy progress for effect
    this.add.text(startX + 240, currentY, `${stoneAmt} Stones`, {
      fontFamily: FONTS.family, fontSize: '16px', color: '#ffffff'
    }).setOrigin(0, 0.5);

    currentY += 30;
    // Resource: Essence
    const essenceAmt = run.economy.materials['essence'] || 0;
    this.add.image(startX + 130, currentY, 'mat_essence').setDisplaySize(24, 24);
    panelGfx.fillStyle(0x333333);
    panelGfx.fillRect(startX + 150, currentY - 6, 80, 12);
    panelGfx.fillStyle(0x8822ff);
    panelGfx.fillRect(startX + 150, currentY - 6, 65, 12); // dummy progress
    this.add.text(startX + 240, currentY, `${essenceAmt} Essence`, {
      fontFamily: FONTS.family, fontSize: '16px', color: '#ffffff'
    }).setOrigin(0, 0.5);

    // ── Footer Messages ─────────────────────────────────────────
    currentY += 45;
    this.add.text(PX, currentY, '💀 All unbanked XP has been lost.', {
      fontFamily: FONTS.family, fontSize: '18px', fontStyle: 'bold', color: '#ff4444'
    }).setOrigin(0.5);

    this.add.text(PX, currentY + 30, 'New unlocks available! Return to the city.', {
      fontFamily: FONTS.family, fontSize: '16px', fontStyle: 'bold', color: '#ffcc00'
    }).setOrigin(0.5);

    // ── Return Button ───────────────────────────────────────────
    createButton(this, 400, 540, 'Return to City', async () => {
      stopAllRunScenes(this, SCENE_KEYS.GAME_OVER);
      await saveManager.clear();
      clearRun();
      this.fadeToScene(SCENE_KEYS.CITY_HUB);
    }, 'primary');
    
    // Style the button specifically if needed (optional since we have createButton)
    // In our style system 'primary' is already prominent.

    this.events.on('shutdown', this.cleanup, this);
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
