import { Scene } from 'phaser';
import { FONTS } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';

export class RunTransitionScene extends Scene {
  constructor() {
    super(SCENE_KEYS.RUN_TRANSITION);
  }

  create(data: { seed: string, manualSeed: boolean }): void {
    // 1. FAST DARK FADE (Background starts transparent and goes to dark fast)
    const overlay = this.add.rectangle(400, 300, 800, 600, 0x05050a);
    overlay.setAlpha(0);
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 300, // FAST
      ease: 'Power2'
    });

    // Vignette effect
    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.8, 0.8);
    vignette.fillRect(0, 0, 800, 600);
    vignette.setDepth(10);
    vignette.setAlpha(0);
    this.tweens.add({ targets: vignette, alpha: 1, duration: 800 });

    // Simple floating particles (embers/dust)
    for (let i = 0; i < 40; i++) {
      const px = Math.random() * 800;
      const py = Math.random() * 600;
      const size = 1 + Math.random() * 3;
      const circle = this.add.circle(px, py, size, 0xe6c88a, 0.3);
      
      this.tweens.add({
        targets: circle,
        x: px + (Math.random() - 0.5) * 50,
        y: py - 100 - Math.random() * 100,
        alpha: 0,
        duration: 3000 + Math.random() * 2000,
        repeat: -1,
        ease: 'Linear'
      });
    }

    const text = this.add.text(400, 280, 'EMBARKING ON EXPEDITION', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#e6c88a',
      fontFamily: FONTS.family,
      letterSpacing: 6,
    }).setOrigin(0.5).setDepth(20);

    const subtext = this.add.text(400, 330, 'The world is shifting...', {
      fontSize: '18px',
      fontStyle: 'italic',
      color: '#998877',
      fontFamily: FONTS.family,
    }).setOrigin(0.5).setDepth(20);

    text.setAlpha(0);
    subtext.setAlpha(0);
    this.tweens.add({
      targets: [text, subtext],
      alpha: { from: 0, to: 1 },
      duration: 1000,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: [text, subtext],
          alpha: { from: 1, to: 0.6 },
          yoyo: true,
          repeat: -1,
          duration: 1500,
          ease: 'Sine.easeInOut'
        });
      }
    });

    // Show the seed discretely
    this.add.text(400, 560, `World Seed: ${data.seed}`, {
      fontSize: '11px',
      color: '#2a1a10',
      fontFamily: FONTS.family,
    }).setOrigin(0.5).setDepth(20);

    // Transition to the GameScene after a short delay
    this.time.delayedCall(2800, () => {
        // We don't fade out this scene, we let GameScene slide in OVER it
        // launch() adds the scene on top, but we also call bringToTop in GameScene.create
        this.scene.launch(SCENE_KEYS.GAME, { ...data, introSlide: true });
        
        // Ensure this scene stays active long enough for the 1.5s slide
        this.time.delayedCall(1600, () => {
            this.scene.stop();
        });
    });
  }
}
