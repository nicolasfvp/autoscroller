import { Scene } from 'phaser';
import { createNewRun, setRun, getRun } from '../state/RunState';
import { saveManager } from '../core/SaveManager';
import { COLORS, FONTS, LAYOUT } from '../ui/StyleConstants';

interface ClassOption {
  id: string;
  name: string;
  description: string;
  spriteKey: string;
  stats: { hp: number; stamina: number; mana: number };
  deckHint: string;
}

const CLASSES: ClassOption[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    description: 'Balanced melee fighter.\nHigh HP and stamina.',
    spriteKey: 'hero_idle',
    stats: { hp: 100, stamina: 50, mana: 30 },
    deckHint: 'Strikes, Defends, Heavy Hit',
  },
  {
    id: 'mage',
    name: 'Mage',
    description: 'Powerful spellcaster.\nHigh mana, low HP.',
    spriteKey: 'mage_idle',
    stats: { hp: 70, stamina: 30, mana: 60 },
    deckHint: 'Fireballs, Heals, Mana Drain',
  },
];

export class CharacterSelectScene extends Scene {
  private selectedIndex = 0;
  private classCards: Phaser.GameObjects.Container[] = [];
  private transitioning = false;

  constructor() {
    super('CharacterSelectScene');
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
    this.selectedIndex = 0;
    this.classCards = [];
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.setBackgroundColor(COLORS.background);

    // Title
    this.add.text(LAYOUT.centerX, 50, 'Choose Your Hero', {
      ...FONTS.title,
      color: COLORS.accent,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    // Render class cards side by side
    const cardWidth = 280;
    const cardHeight = 400;
    const gap = 40;
    const totalWidth = CLASSES.length * cardWidth + (CLASSES.length - 1) * gap;
    const startX = LAYOUT.centerX - totalWidth / 2 + cardWidth / 2;

    CLASSES.forEach((cls, i) => {
      const x = startX + i * (cardWidth + gap);
      const y = LAYOUT.centerY + 20;
      const card = this.createClassCard(x, y, cardWidth, cardHeight, cls, i);
      this.classCards.push(card);
    });

    this.highlightSelected();

    // Keyboard navigation
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.highlightSelected();
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.selectedIndex = Math.min(CLASSES.length - 1, this.selectedIndex + 1);
      this.highlightSelected();
    });
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.confirmSelection();
    });
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.confirmSelection();
    });

    // Hint
    this.add.text(LAYOUT.centerX, 570, 'Arrow keys to browse, Enter to select', {
      ...FONTS.small,
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);
  }

  private createClassCard(
    x: number, y: number, w: number, h: number,
    cls: ClassOption, index: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Card background
    const bg = this.add.rectangle(0, 0, w, h, COLORS.panel, 0.9);
    bg.setStrokeStyle(2, 0x444444);
    bg.setInteractive({ useHandCursor: true });
    container.add(bg);

    // Click to select + confirm
    bg.on('pointerdown', () => {
      if (this.selectedIndex === index) {
        this.confirmSelection();
      } else {
        this.selectedIndex = index;
        this.highlightSelected();
      }
    });
    bg.on('pointerover', () => {
      this.selectedIndex = index;
      this.highlightSelected();
    });

    // Character sprite preview (animated)
    if (this.textures.exists(cls.spriteKey)) {
      const animKey = `select_${cls.id}_idle`;
      if (!this.anims.exists(animKey)) {
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(cls.spriteKey, {}),
          frameRate: 4,
          repeat: -1,
        });
      }
      const sprite = this.add.sprite(0, -100, cls.spriteKey).setScale(3);
      sprite.play(animKey);
      container.add(sprite);
    } else {
      // Fallback colored square
      const fallback = this.add.rectangle(0, -100, 64, 64, cls.id === 'warrior' ? 0x4488ff : 0x9944ff);
      container.add(fallback);
    }

    // Class name
    this.add.text(0, -30, cls.name, {
      ...FONTS.heading,
      color: COLORS.accent,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);
    container.add(container.list[container.list.length - 1]);

    // Description
    const desc = this.add.text(0, 10, cls.description, {
      ...FONTS.body,
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
      align: 'center',
    }).setOrigin(0.5);
    container.add(desc);

    // Stats bars
    const statsY = 60;
    this.addStatBar(container, 'HP', cls.stats.hp, 100, 0xff4444, statsY);
    this.addStatBar(container, 'STA', cls.stats.stamina, 60, 0xffaa00, statsY + 28);
    this.addStatBar(container, 'MP', cls.stats.mana, 60, 0x4488ff, statsY + 56);

    // Deck hint
    const deckLabel = this.add.text(0, 140, `Deck: ${cls.deckHint}`, {
      ...FONTS.small,
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
      align: 'center',
      wordWrap: { width: w - 30 },
    }).setOrigin(0.5);
    container.add(deckLabel);

    return container;
  }

  private addStatBar(
    container: Phaser.GameObjects.Container,
    label: string, value: number, max: number,
    color: number, yOffset: number,
  ): void {
    const barWidth = 160;
    const barHeight = 14;
    const labelW = 36;

    // Label
    const txt = this.add.text(-barWidth / 2 - labelW, yOffset, label, {
      fontSize: '12px',
      color: '#aaaaaa',
      fontFamily: FONTS.family,
    }).setOrigin(0, 0.5);
    container.add(txt);

    // Background bar
    const bgBar = this.add.rectangle(0, yOffset, barWidth, barHeight, 0x333333);
    container.add(bgBar);

    // Filled bar
    const fillWidth = (value / max) * barWidth;
    const fillBar = this.add.rectangle(
      -barWidth / 2 + fillWidth / 2, yOffset,
      fillWidth, barHeight, color,
    );
    container.add(fillBar);

    // Value text
    const valTxt = this.add.text(barWidth / 2 + 8, yOffset, `${value}`, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: FONTS.family,
    }).setOrigin(0, 0.5);
    container.add(valTxt);
  }

  private highlightSelected(): void {
    this.classCards.forEach((card, i) => {
      const bg = card.list[0] as Phaser.GameObjects.Rectangle;
      if (i === this.selectedIndex) {
        bg.setStrokeStyle(3, 0xffd700);
      } else {
        bg.setStrokeStyle(2, 0x444444);
      }
    });
  }

  private async confirmSelection(): Promise<void> {
    const selected = CLASSES[this.selectedIndex];
    setRun(createNewRun(1, selected.id));
    await saveManager.save(getRun());
    this.fadeToScene('TutorialScene');
  }
}
