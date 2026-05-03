import { Scene } from 'phaser';
import { saveManager } from '../core/SaveManager';
import { createNewRun, setRun, getRun } from '../state/RunState';
import type { RunState } from '../state/RunState';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';
import { AudioManager } from '../systems/AudioManager';

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

    // Theme Song
    AudioManager.transitionTo(this, 'theme_song', { volume: 0.4, duration: 1500 });

    // Background
    this.cameras.main.setBackgroundColor(COLORS.background);
    if (this.textures.exists('homepage')) {
      this.add.image(LAYOUT.centerX, LAYOUT.centerY, 'homepage').setDisplaySize(LAYOUT.canvasWidth, LAYOUT.canvasHeight).setDepth(-10);
    }

    // Fog Effect using the provided asset
    // Instead of particles, use a couple of large images that slowly drift to avoid the "popping" and "multiple copies" effect
    for (let i = 0; i < 2; i++) {
      const fogImg = this.add.image(
        LAYOUT.canvasWidth / 2 + (i * LAYOUT.canvasWidth), 
        LAYOUT.canvasHeight - 150, 
        'fog'
      );
      // Scale to cover width if needed, adjust alpha
      fogImg.setDisplaySize(LAYOUT.canvasWidth * 1.5, LAYOUT.canvasHeight * 0.8);
      fogImg.setAlpha(0.3);
      fogImg.setBlendMode(Phaser.BlendModes.SCREEN);
      fogImg.setDepth(-5);

      this.tweens.add({
        targets: fogImg,
        x: fogImg.x - LAYOUT.canvasWidth,
        duration: 30000, // Very slow drift
        repeat: -1,      // Infinite repeat
        ease: 'Linear'
      });
      
      // Gentle vertical bobbing
      this.tweens.add({
        targets: fogImg,
        y: fogImg.y - 20,
        duration: 5000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }



    if (this.savedRun) {
      // Continue Run button
      this.createImgBtn(LAYOUT.centerX, 300, 'btn_continue_run', () => this.continueRun());
      // New Run button
      this.createImgBtn(LAYOUT.centerX, 360, 'btn_new_game', () => this.showDeleteConfirmation());
    } else {
      // No saved run -- show only New Run
      this.createImgBtn(LAYOUT.centerX, 300, 'btn_new_game', () => this.startNewRun());
    }

    this.events.on('shutdown', this.cleanup, this);
  }

  private createImgBtn(x: number, y: number, key: string, callback: () => void, scale: number = 0.5) {
    const btn = this.add.image(x, y, key)
      .setScale(scale)
      .setInteractive({ useHandCursor: true });
      
    btn.on('pointerover', () => this.tweens.add({ targets: btn, scale: scale * 1.05, duration: 100 }));
    btn.on('pointerout', () => this.tweens.add({ targets: btn, scale: scale, duration: 100 }));
    btn.on('pointerdown', () => {
      this.tweens.add({ targets: btn, scale: scale * 0.95, duration: 50, yoyo: true });
      callback();
    });
    return btn;
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
    const panel = this.add.image(LAYOUT.centerX, LAYOUT.centerY + 40, 'bg_base_option').setScale(1.45);
    this.confirmOverlay.add(panel);

    const msg = this.add.text(LAYOUT.centerX, LAYOUT.centerY + 40, 'This will permanently erase your current run. Continue?', {
      ...FONTS.body,
      fontSize: '24px', // slightly smaller text
      color: '#e6c88a', // dull yellow/gold
      stroke: '#2e1b0f', // soft dark brown stroke
      strokeThickness: 2,
      fontStyle: 'bold',
      fontFamily: FONTS.family,
      align: 'center',
      wordWrap: { width: 450 }, // adjusted width for 24px
    }).setOrigin(0.5).setShadow(1, 1, '#1a0d06', 2, true, true);
    this.confirmOverlay.add(msg);

    // Yes, Delete button (floating below the panel)
    const yesBtn = this.createImgBtn(260, 480, 'btn_yes_delete', () => this.startNewRun(), 0.55);
    this.confirmOverlay.add(yesBtn);

    // Keep My Run button (floating below the panel)
    const noBtn = this.createImgBtn(540, 480, 'btn_keep_my_run', () => this.hideConfirmation(), 0.55);
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
