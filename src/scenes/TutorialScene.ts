import { Scene } from 'phaser';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import type { MetaState } from '../state/MetaState';

/**
 * TutorialScene -- 6-screen tutorial with accurate game content.
 * First-run gate: skips to CityHub if tutorialSeen is true.
 * Skippable via Skip Tutorial button.
 */
export class TutorialScene extends Scene {
  private step: number = 0;
  private metaState!: MetaState;
  private bodyText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private stepCounter!: Phaser.GameObjects.Text;
  private skipBtn!: Phaser.GameObjects.Text;

  private readonly tutorialTexts: string[] = [
    'Welcome to Rogue Scroll!\n\nYou are a hero traveling through an endless loop of tiles.\nYour cards fight automatically -- your job is to prepare.',

    'Tile Placement\n\nEach loop, place terrain tiles on the path.\nRed tiles = Combat\nBlue tiles = Rest\nGold tiles = Shop\nPurple tiles = Events\nYellow tiles = Treasure\nDark Red tiles = Boss',

    'Deck Ordering\n\nCards play from top to bottom automatically.\nOrder matters! Place synergy combos together.\nVisit the Shop to add, remove, or reorder cards.',

    'Auto-Combat\n\nYour hero plays cards on cooldown.\nLight cards are fast, heavy cards are slow.\nWatch for COMBO highlights when synergies trigger!',

    'The Shop\n\nBuy new cards and relics.\nRemove weak cards (costs gold).\nReorder your deck for better combos.\nUpgrade cards to make them stronger.',

    'Good luck, hero!\n\nDefeat the boss to exit safely with full rewards.\nDeath returns only a fraction of your earnings.\n\nPress SPACE to begin.',
  ];

  constructor() {
    super('TutorialScene');
  }

  async create(): Promise<void> {
    this.step = 0;

    // Load meta state for first-run gate
    this.metaState = await loadMetaState();

    // First-run gate: skip if already seen
    if (this.metaState.tutorialSeen) {
      this.scene.start('CityHub');
      return;
    }

    // Background
    this.cameras.main.setBackgroundColor(COLORS.background);

    // Title
    this.add.text(LAYOUT.centerX, 80, 'Tutorial', {
      ...FONTS.title,
      color: COLORS.accent,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    // Body text
    this.bodyText = this.add.text(LAYOUT.centerX, LAYOUT.centerY, this.tutorialTexts[0], {
      ...FONTS.body,
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
      align: 'center',
      wordWrap: { width: 600 },
    }).setOrigin(0.5);

    // Hint text
    this.hintText = this.add.text(LAYOUT.centerX, 500, 'Click or press SPACE to continue', {
      ...FONTS.small,
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
      fontStyle: 'italic',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: this.hintText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Step counter
    this.stepCounter = this.add.text(LAYOUT.centerX, 530, `1 / ${this.tutorialTexts.length}`, {
      ...FONTS.small,
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    // Skip Tutorial button (bottom-right)
    this.skipBtn = createButton(this, 700, 560, 'Skip Tutorial', () => this.skipTutorial(), 'secondary');

    // Navigation
    this.input.keyboard?.on('keydown-SPACE', () => this.nextStep());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Don't advance if clicking the skip button area
      if (pointer.x > 640 && pointer.y > 540) return;
      this.nextStep();
    });

    this.events.on('shutdown', this.cleanup, this);
  }

  private nextStep(): void {
    this.step++;
    if (this.step >= this.tutorialTexts.length) {
      this.completeTutorial();
    } else {
      this.bodyText.setText(this.tutorialTexts[this.step]);
      this.stepCounter.setText(`${this.step + 1} / ${this.tutorialTexts.length}`);
    }
  }

  private async completeTutorial(): Promise<void> {
    this.metaState.tutorialSeen = true;
    await saveMetaState(this.metaState);
    this.scene.start('CityHub');
  }

  private async skipTutorial(): Promise<void> {
    this.metaState.tutorialSeen = true;
    await saveMetaState(this.metaState);
    this.scene.start('CityHub');
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
