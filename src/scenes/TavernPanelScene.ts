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
    const panel = this.add.image(400, 300, 'wood_texture_big').setDisplaySize(500, 420);
    panel.setInteractive(); // absorb clicks

    // Máscara para bordas arredondadas
    const shape = this.make.graphics();
    shape.fillStyle(0xffffff);
    shape.fillRoundedRect(150, 90, 500, 420, 24); // 24 de raio
    panel.setMask(shape.createGeometryMask());

    // Title (now larger, above or atop the panel, medieval styled)
    this.add.text(400, 55, 'Tavern', {
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#fdf6e3', // light cream
      stroke: '#3e2723', // dark wood border
      strokeThickness: 6,
      fontFamily: '"Impact", "Arial Black", sans-serif',
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', fill: true }
    }).setOrigin(0.5);

    // Description
    this.add.text(400, 143, 'Prepare for your next expedition.', {
      fontSize: '16px',
      color: '#ffeebb', // pale cream
      fontFamily,
    }).setOrigin(0.5);

    // Seed input label
    this.add.text(400, 170, 'Seed (optional)', {
      fontSize: '14px',
      color: '#ffeebb',
      fontFamily,
    }).setOrigin(0.5);

    // Seed input using Phaser DOM element (dark brown style)
    const inputElement = this.add.dom(400, 200).createFromHTML(
      `<input type="text" id="seed-input" placeholder="Enter seed or leave blank"
        style="width:300px;height:36px;background:#3e2723;color:#ffeebb;border:2px solid #5d4037;
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
        inputEl.style.borderColor = '#5d4037';
      });
      inputEl.addEventListener('input', () => {
        this.seedInputValue = inputEl.value;
      });
    }

    // Start Run button (Custom Wood Style)
    const btnContainer = this.add.container(400, 260);
    const btnBg = this.add.rectangle(0, 0, 240, 44, 0x8d6e63).setStrokeStyle(3, 0x3e2723).setInteractive({ useHandCursor: true });
    const btnText = this.add.text(0, 0, 'Start Run', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#3e2723', // dark brown text
      fontFamily,
    }).setOrigin(0.5);
    btnContainer.add([btnBg, btnText]);

    btnBg.on('pointerover', () => btnBg.setFillStyle(0xa1887f));
    btnBg.on('pointerout', () => btnBg.setFillStyle(0x8d6e63));
    btnBg.on('pointerdown', () => {
      const seedValue = this.seedInputValue.trim() || undefined;
      const rng = new SeededRNG(seedValue);

      // Create a new run preserving the chosen class
      const chosenClass = hasActiveRun() ? (getRun().hero.className ?? 'warrior') : 'warrior';
      const run = createNewRun(this.metaState, 1, chosenClass);
      setRun(run);

      // Stop this overlay and CityHub, start GameScene
      this.scene.stop('CityHub');
      this.scene.stop();
      this.scene.start('GameScene', { seed: rng.seed, manualSeed: !!seedValue });
    });

    // Run History section
    this.add.text(400, 320, 'Run History', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#fdf6e3', // clean cream text, no stroke
      fontFamily,
    }).setOrigin(0.5);

    // History list area (pale parchment style for high contrast, low saturation)
    this.add.rectangle(400, 400, 460, 110, 0xeee8d5, 1.0); // very pale, desaturated beige

    const runHistory = this.metaState.runHistory;
    if (runHistory.length === 0) {
      this.add.text(400, 400, 'No completed runs yet.', {
        fontSize: '16px',
        color: '#3e2723', // dark brown
        fontFamily,
      }).setOrigin(0.5);
    } else {
      // Find best run (most loops)
      const bestRun = runHistory.reduce((best, entry) =>
        entry.loopsCompleted > best.loopsCompleted ? entry : best, runHistory[0]
      );

      // Show most recent 5, newest first
      const recentRuns = [...runHistory].reverse().slice(0, 5);
      let histY = 360;
      for (let i = 0; i < recentRuns.length; i++) {
        const entry = recentRuns[i];
        const runNumber = runHistory.length - i;
        const isBest = entry === bestRun;
        const text = `Run #${runNumber}: Loop ${entry.loopsCompleted}, ${entry.exitType}`;

        this.add.text(400, histY, text, {
          fontSize: '14px',
          color: isBest ? '#990000' : '#3e2723', // Dark red for best, dark brown for normal
          fontStyle: isBest ? 'bold' : 'normal',
          fontFamily,
        }).setOrigin(0.5);
        histY += 18;
      }
    }

    // Close button
    const closeBtnBg = this.add.circle(620, 50, 16, 0xcc0000).setStrokeStyle(2, 0x3e2723).setInteractive({ useHandCursor: true });
    const closeBtnTxt = this.add.text(620, 50, 'X', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      fontFamily,
    }).setOrigin(0.5);

    closeBtnBg.on('pointerover', () => closeBtnBg.setFillStyle(0xff3333));
    closeBtnBg.on('pointerout', () => closeBtnBg.setFillStyle(0xcc0000));
    closeBtnBg.on('pointerdown', () => this.closePanel());
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
