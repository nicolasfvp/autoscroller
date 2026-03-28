import { Scene } from 'phaser';
import { getRun, createNewRun, setRun, clearRun } from '../state/RunState';
import { saveManager } from '../core/SaveManager';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';

/**
 * GameOverScene -- displays final run statistics.
 * Offers New Run and Main Menu buttons.
 */
export class GameOverScene extends Scene {
  private transitioning = false;

  constructor() {
    super('GameOverScene');
  }

  private fadeToScene(sceneKey: string, data?: any): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });
  }

  create(): void {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    const run = getRun();

    this.cameras.main.setBackgroundColor(COLORS.background);

    // Title
    this.add.text(400, 80, 'GAME OVER', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: COLORS.danger,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    // Run statistics
    this.add.text(400, 160, 'Run Statistics', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    this.add.text(400, 210, `Loops Completed: ${run.loop.count}`, {
      fontSize: '16px',
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    this.add.text(400, 240, `Gold Earned: ${run.economy.gold}`, {
      fontSize: '16px',
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    this.add.text(400, 270, `Cards in Deck: ${run.deck.active.length}`, {
      fontSize: '16px',
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    this.add.text(400, 300, `Relics: ${run.relics.length}`, {
      fontSize: '16px',
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    // New Run button
    createButton(this, 300, 420, 'New Run', async () => {
      await saveManager.clear();
      setRun(createNewRun());
      this.fadeToScene('CityHub');
    }, 'primary');

    // Main Menu button
    createButton(this, 500, 420, 'Main Menu', async () => {
      await saveManager.clear();
      clearRun();
      this.fadeToScene('MainMenu');
    }, 'primary');

    this.events.on('shutdown', this.cleanup, this);
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
