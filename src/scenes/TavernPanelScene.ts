import { Scene } from 'phaser';
import { MetaState } from '../state/MetaState';
import { SeededRNG } from '../systems/SeededRNG';
import { createNewRun, setRun, hasActiveRun, getRun } from '../state/RunState';
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';

export class TavernPanelScene extends Scene {
  private metaState!: MetaState;
  private seedInputValue: string = '';

  constructor() {
    super('TavernPanelScene');
  }

  create(data: { metaState: MetaState }): void {
    this.metaState = data.metaState;
    this.seedInputValue = '';

    const fontFamily = FONTS.family;

    // Semi-transparent backdrop -- delay interactivity to prevent same-frame click-through
    const backdrop = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.5);
    this.time.delayedCall(100, () => {
      backdrop.setInteractive();
      backdrop.on('pointerdown', () => this.closePanel());
    });

    // Panel
    const panel = this.add.rectangle(400, 300, 500, 420, COLORS.panel, 0.95);
    panel.setInteractive(); // absorb clicks

    // Title
    this.add.text(400, 115, 'Tavern', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ff8c00',
      fontFamily,
    }).setOrigin(0.5);

    // Description
    this.add.text(400, 143, 'Prepare for your next expedition.', {
      fontSize: '16px',
      color: COLORS.textSecondary,
      fontFamily,
    }).setOrigin(0.5);

    // Seed input label
    this.add.text(400, 170, 'Seed (optional)', {
      fontSize: '14px',
      color: COLORS.textSecondary,
      fontFamily,
    }).setOrigin(0.5);

    // Seed input using Phaser DOM element
    const inputElement = this.add.dom(400, 200).createFromHTML(
      `<input type="text" id="seed-input" placeholder="Enter seed or leave blank"
        style="width:300px;height:36px;background:#333333;color:#ffffff;border:2px solid #555555;
        border-radius:4px;padding:0 8px;font-size:14px;font-family:${fontFamily};text-align:center;outline:none;"
        />`
    );

    // Focus styling
    const inputEl = inputElement.getChildByID('seed-input') as HTMLInputElement | null;
    if (inputEl) {
      inputEl.addEventListener('focus', () => {
        inputEl.style.borderColor = '#ffd700';
      });
      inputEl.addEventListener('blur', () => {
        inputEl.style.borderColor = '#555555';
      });
      inputEl.addEventListener('input', () => {
        this.seedInputValue = inputEl.value;
      });
    }

    // Start Run button
    createButton(this, 400, 260, 'Start Run', () => {
      const seedValue = this.seedInputValue.trim() || undefined;
      const rng = new SeededRNG(seedValue);

      // Create a new run preserving the chosen class
      const chosenClass = hasActiveRun() ? (getRun().hero.className ?? 'warrior') : 'warrior';
      const run = createNewRun(1, chosenClass);
      setRun(run);

      // Stop this overlay and CityHub, start GameScene
      this.scene.stop('CityHub');
      this.scene.stop();
      this.scene.start('GameScene', { seed: rng.seed, manualSeed: !!seedValue });
    }, 'primary');

    // Run History section
    this.add.text(200, 290, 'Run History', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: COLORS.textPrimary,
      fontFamily,
    });

    // History list area
    this.add.rectangle(400, 380, 440, 100, 0x333333, 0.5);

    const runHistory = this.metaState.runHistory;
    if (runHistory.length === 0) {
      this.add.text(400, 380, 'No completed runs yet.', {
        fontSize: '16px',
        color: COLORS.textSecondary,
        fontFamily,
      }).setOrigin(0.5);
    } else {
      // Find best run (most loops)
      const bestRun = runHistory.reduce((best, entry) =>
        entry.loopsCompleted > best.loopsCompleted ? entry : best, runHistory[0]
      );

      // Show most recent 5, newest first
      const recentRuns = [...runHistory].reverse().slice(0, 5);
      let histY = 345;
      for (let i = 0; i < recentRuns.length; i++) {
        const entry = recentRuns[i];
        const runNumber = runHistory.length - i;
        const isBest = entry === bestRun;
        const text = `Run #${runNumber}: Loop ${entry.loopsCompleted}, ${entry.exitType}`;

        this.add.text(200, histY, text, {
          fontSize: '14px',
          color: isBest ? COLORS.accent : COLORS.textPrimary,
          fontFamily,
        });
        histY += 18;
      }
    }

    // Close button
    const closeBtn = this.add.text(630, 100, 'X', {
      fontSize: '16px',
      color: COLORS.textSecondary,
      fontFamily,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.closePanel());
  }

  private closePanel(): void {
    // Re-enable CityHub input and stop this overlay
    const cityHub = this.scene.get('CityHub');
    if (cityHub && cityHub.input) {
      cityHub.input.enabled = true;
    }
    this.scene.stop();
  }
}
