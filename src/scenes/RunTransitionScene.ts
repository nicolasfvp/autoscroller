import { Scene } from 'phaser';
import { FONTS } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';
import { hasActiveRun, getRun } from '../state/RunState';
import { t } from '../i18n/i18n';

export class RunTransitionScene extends Scene {
  constructor() {
    super(SCENE_KEYS.RUN_TRANSITION);
  }

  create(data: { seed: string, manualSeed: boolean }): void {
    // Game world is always authored at 800×600; cameras.main.width reflects
    // the supersampled backing-store (UI_SCALE×), not the game-space size.
    const W = 800;
    const H = 600;
    // 1. FAST DARK FADE (Background starts transparent and goes to dark fast)
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x05050a);
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
    vignette.fillRect(0, 0, W, H);
    vignette.setDepth(10);
    vignette.setAlpha(0);
    this.tweens.add({ targets: vignette, alpha: 1, duration: 800 });

    // Simple floating particles (embers/dust)
    for (let i = 0; i < 40; i++) {
      const px = Math.random() * W;
      const py = Math.random() * H;
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

    const text = this.add.text(W / 2, H / 2 - 20, t('runTransition.embarkingTitle'), {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#c8a020',
      fontFamily: FONTS.body,
      letterSpacing: 6,
    }).setOrigin(0.5).setDepth(20);

    const subtext = this.add.text(W / 2, H / 2 + 30, t('runTransition.worldShifting'), {
      fontSize: '18px',
      fontStyle: 'italic',
      color: '#998877',
      fontFamily: FONTS.body,
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

    // Hero chibi — static first frame, slides in from left
    const className = hasActiveRun() ? (getRun().hero.className ?? 'warrior') : 'warrior';
    const spriteKey = `hero_chibi_${className}`;
    const displayH = 96;

    // y=545: matches GameScene hero world y=420 (455-35) with followOffset 280+halfH
    const heroY = 545;
    const hero = this.add.sprite(-60, heroY, spriteKey, 0)
      .setDisplaySize(displayH, displayH)
      .setOrigin(0.5, 1.0)
      .setDepth(15)
      .setAlpha(0);

    // Walk hero to x=400 (center), matching where GameScene camera places the hero
    this.tweens.add({ targets: hero, alpha: 1, duration: 400, delay: 200 });
    this.tweens.add({
      targets: hero,
      x: W / 2,
      duration: 1800,
      delay: 200,
      ease: 'Sine.easeOut',
    });

    // Show the seed discretely
    this.add.text(W / 2, H - 20, t('runTransition.worldSeed', { seed: data.seed }), {
      fontSize: '11px',
      color: '#2a1a10',
      fontFamily: FONTS.body,
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
