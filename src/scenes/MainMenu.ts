import { Scene } from 'phaser';
import { saveManager } from '../core/SaveManager';
import { createNewRun, setRun, getRun } from '../state/RunState';
import type { RunState } from '../state/RunState';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';

export class MainMenu extends Scene {
  private savedRun: RunState | null = null;
  private confirmOverlay: Phaser.GameObjects.Container | null = null;
  private transitioning = false;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    this.savedRun = this.registry.get('savedRun') as RunState | null;
    this.confirmOverlay = null;

    // Background
    this.cameras.main.setBackgroundColor(COLORS.background);

    // Title
    this.add.text(LAYOUT.centerX, 150, 'Rogue Scroll', {
      ...FONTS.title,
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    if (this.savedRun) {
      // Continue Run button (primary, accent)
      createButton(this, LAYOUT.centerX, 300, 'Continue Run', () => this.continueRun(), 'primary');

      // New Run button (secondary, below)
      createButton(this, LAYOUT.centerX, 360, 'New Run', () => this.showDeleteConfirmation(), 'secondary');
    } else {
      // No saved run -- show only New Run as primary
      createButton(this, LAYOUT.centerX, 300, 'New Run', () => this.startNewRun(), 'primary');
    }

    this.events.on('shutdown', this.cleanup, this);
  }

  private fadeToScene(sceneKey: string, data?: any): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });
  }

  private continueRun(): void {
    if (this.savedRun) {
      setRun(this.savedRun);
      this.fadeToScene('GameScene');
    }
  }

  private showDeleteConfirmation(): void {
    if (this.confirmOverlay) return;

    this.confirmOverlay = this.add.container(0, 0);

    // Dim background
    const dimBg = this.add.rectangle(LAYOUT.centerX, LAYOUT.centerY, LAYOUT.canvasWidth, LAYOUT.canvasHeight, 0x000000, 0.7);
    dimBg.setInteractive(); // block click-through
    this.confirmOverlay.add(dimBg);

    // Confirmation panel
    const panel = this.add.rectangle(LAYOUT.centerX, LAYOUT.centerY, 500, 200, COLORS.panel, 0.95);
    this.confirmOverlay.add(panel);

    const msg = this.add.text(LAYOUT.centerX, 260, 'This will permanently erase your current run. Continue?', {
      ...FONTS.body,
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
      align: 'center',
      wordWrap: { width: 440 },
    }).setOrigin(0.5);
    this.confirmOverlay.add(msg);

    // Yes, Delete button
    const yesBtn = createButton(this, 320, 330, 'Yes, Delete', () => this.startNewRun(), 'secondary');
    this.confirmOverlay.add(yesBtn);

    // Keep My Run button
    const noBtn = this.add.text(480, 330, 'Keep My Run', {
      ...FONTS.body,
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    noBtn.on('pointerover', () => noBtn.setColor(COLORS.accentHover));
    noBtn.on('pointerout', () => noBtn.setColor(COLORS.textSecondary));
    noBtn.on('pointerdown', () => this.hideConfirmation());
    this.confirmOverlay.add(noBtn);
  }

  private hideConfirmation(): void {
    if (this.confirmOverlay) {
      this.confirmOverlay.destroy(true);
      this.confirmOverlay = null;
    }
  }

  private async startNewRun(): Promise<void> {
    await saveManager.clear();
    this.fadeToScene('CharacterSelectScene');
  }

  private cleanup(): void {
    this.confirmOverlay = null;
    this.savedRun = null;
  }
}
