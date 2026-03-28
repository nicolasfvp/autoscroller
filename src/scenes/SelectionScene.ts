import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';

/**
 * SelectionScene -- card/heir reward selection.
 * Placeholder for Phase 2 reward system.
 */
export class SelectionScene extends Scene {
  private transitioning = false;

  constructor() {
    super('SelectionScene');
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
    this.add.text(400, 100, 'Selection', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: COLORS.accent,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    // Context
    this.add.text(400, 180, `Generation: ${run.generation}`, {
      fontSize: '16px',
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    // Placeholder
    this.add.text(400, 300, 'Selection system: Phase 2', {
      fontSize: '14px',
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Continue button
    createButton(this, 400, 420, 'Continue', () => {
      this.fadeToScene('GameScene');
    }, 'primary');

    this.events.on('shutdown', this.cleanup, this);
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
