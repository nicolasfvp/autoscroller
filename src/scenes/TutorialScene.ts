import { Scene } from 'phaser';

/**
 * TutorialScene -- static tutorial text.
 * No RunState dependency. Standalone informational scene.
 */
export class TutorialScene extends Scene {
  private step: number = 0;
  private readonly tutorialTexts: string[] = [
    'Welcome to Rogue Scroll!\n\nYou are a hero traveling through an endless loop.',
    'Use tiles on the map to progress.\n\nRed tiles = Combat\nBlue tiles = Rest\nGold tiles = Shop',
    'In combat, cards from your deck are played automatically.\n\nManage your stamina and mana carefully!',
    'After each run, choose an heir with special traits\nto continue your journey.',
    'Good luck, hero!\n\nPress SPACE to begin your adventure.',
  ];

  constructor() {
    super('TutorialScene');
  }

  create(): void {
    this.step = 0;

    this.cameras.main.setBackgroundColor(0x1a1a2e);

    this.add.text(400, 100, 'Tutorial', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5);

    this.showStep();

    this.input.keyboard?.on('keydown-SPACE', () => this.nextStep());
    this.input.on('pointerdown', () => this.nextStep());

    this.events.on('shutdown', this.cleanup, this);
  }

  private showStep(): void {
    this.add.text(400, 300, this.tutorialTexts[this.step], {
      fontSize: '16px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 600 },
    }).setOrigin(0.5);

    const hint = this.add.text(400, 500, 'Click or press SPACE to continue', {
      fontSize: '14px',
      color: '#aaaaaa',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: hint,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }

  private nextStep(): void {
    this.step++;
    if (this.step >= this.tutorialTexts.length) {
      this.scene.start('Game');
    } else {
      this.scene.restart();
    }
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
