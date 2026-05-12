import { Scene } from 'phaser';
import { createNewRun, setRun, getRun } from '../state/RunState';
import { saveManager } from '../core/SaveManager';
import { loadMetaState } from '../systems/MetaPersistence';
import { LAYOUT } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';
import {
  CLASS_CARDS as CLASSES,
  computeCardLayout,
  type ClassOption,
} from './CharacterSelectScene.helpers';

export class CharacterSelectScene extends Scene {
  private selectedIndex = 0;
  private classCards: Phaser.GameObjects.Container[] = [];
  private transitioning = false;
  private lastInputWasMouse = false;

  constructor() {
    super(SCENE_KEYS.CHARACTER_SELECT);
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

    // Background Image
    this.add.image(400, 300, 'bg_character_selection').setDisplaySize(800, 600);

    // Title
    this.add.text(LAYOUT.centerX, 50, 'Choose Your Hero', {
      fontSize: '40px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
      fontFamily: '"Impact", sans-serif',
      resolution: 3,
    }).setOrigin(0.5);

    // Phase 9 (Design v2): 3 cards (Warrior, Mage, Shadowblade) require a
    // downscaled layout per UI-SPEC §Spacing FLAG -- old 280×40 layout
    // overflows the 800px canvas with 3 cards.
    const layout = computeCardLayout(LAYOUT.canvasWidth, CLASSES.length);
    const cardWidth = layout.cardW;
    const cardHeight = layout.cardH;
    const gap = layout.gap;
    const startX = layout.margin + cardWidth / 2;

    CLASSES.forEach((cls, i) => {
      const x = startX + i * (cardWidth + gap);
      const y = LAYOUT.centerY + 20;
      const card = this.createClassCard(x, y, cardWidth, cardHeight, cls, i);
      this.classCards.push(card);
    });

    this.highlightSelected();

    // Keyboard navigation
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.lastInputWasMouse = false;
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.highlightSelected();
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.lastInputWasMouse = false;
      this.selectedIndex = Math.min(CLASSES.length - 1, this.selectedIndex + 1);
      this.highlightSelected();
    });
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.confirmSelection();
    });
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.confirmSelection();
    });

    // Reset to mouse mode when the pointer actually moves — this prevents
    // a stale pointerover event from overriding keyboard navigation when
    // the cursor happens to sit over a non-active card.
    this.input.on('pointermove', () => { this.lastInputWasMouse = true; });

    // Hint
    this.add.text(LAYOUT.centerX, 570, 'Arrow keys to browse, Enter to select', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: '"Impact", sans-serif',
      resolution: 3,
    }).setOrigin(0.5);
  }

  private createClassCard(
    x: number, y: number, w: number, h: number,
    cls: ClassOption, index: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Frame (outer thick border)
    const frame = this.add.rectangle(0, 0, w, h, 0x5a5e6b);
    frame.setStrokeStyle(6, 0x8a8e9b);
    container.add(frame);

    // Inner panel
    const bg = this.add.rectangle(0, 0, w - 24, h - 24, 0x4a4e5b);
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
      // Only follow the cursor's selection when the user is actually
      // driving with the mouse — a stale pointerover (mouse parked over
      // a card) shouldn't fight keyboard navigation.
      if (!this.lastInputWasMouse) return;
      this.selectedIndex = index;
      this.highlightSelected();
    });

    // Character sprite preview (animated). Phase 9 (D-08): Shadowblade
    // reuses mage_idle with a #7E5BEF tint as placeholder art.
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
      const sprite = this.add.sprite(0, -90, cls.spriteKey).setScale(3);
      if (cls.spriteTint !== undefined) sprite.setTint(cls.spriteTint);
      sprite.play(animKey);
      container.add(sprite);
    } else {
      // Fallback colored square (per class fallbackColor)
      const fallback = this.add.rectangle(0, -90, 64, 64, cls.fallbackColor);
      container.add(fallback);
    }

    // Description
    const desc = this.add.text(0, 20, cls.description, {
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      fontFamily: '"Impact", sans-serif',
      align: 'center',
      resolution: 3,
    }).setOrigin(0.5);
    container.add(desc);

    // Stats bars
    const statsY = 60;
    this.addStatBar(container, 'HP', cls.stats.hp, 100, 0xff4444, statsY);
    this.addStatBar(container, 'STA', cls.stats.stamina, 60, 0xffaa00, statsY + 28);
    this.addStatBar(container, 'MP', cls.stats.mana, 60, 0x4488ff, statsY + 56);

    // Deck hint
    const deckLabel = this.add.text(0, 140, `Deck: ${cls.deckHint}`, {
      fontSize: '15px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      fontFamily: '"Impact", sans-serif',
      align: 'center',
      wordWrap: { width: w - 30 },
      resolution: 3,
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
    const barHeight = 16;
    const labelW = 36;

    // Label
    const txt = this.add.text(-barWidth / 2 - labelW, yOffset, label, {
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      fontFamily: '"Impact", sans-serif',
      resolution: 3,
    }).setOrigin(0, 0.5);
    container.add(txt);

    // Black outline
    const outline = this.add.rectangle(0, yOffset, barWidth + 4, barHeight + 4, 0x000000);
    container.add(outline);

    // Dark grey bg
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
    const valTxt = this.add.text(barWidth / 2 + 10, yOffset, `${value}`, {
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      fontFamily: '"Impact", sans-serif',
      resolution: 3,
    }).setOrigin(0, 0.5);
    container.add(valTxt);
  }

  private highlightSelected(): void {
    this.classCards.forEach((card, i) => {
      const frame = card.list[0] as Phaser.GameObjects.Rectangle;
      const inner = card.list[1] as Phaser.GameObjects.Rectangle;
      if (i === this.selectedIndex) {
        frame.setFillStyle(0x3388ff);
        frame.setStrokeStyle(6, 0x00ccff);
        inner.setFillStyle(0x2a446b);
      } else {
        frame.setFillStyle(0x5a5e6b);
        frame.setStrokeStyle(6, 0x8a8e9b);
        inner.setFillStyle(0x4a4e5b);
      }
    });
  }

  private async confirmSelection(): Promise<void> {
    const selected = CLASSES[this.selectedIndex];
    const meta = await loadMetaState();
    setRun(createNewRun(meta, 1, selected.id));
    await saveManager.save(getRun());
    this.fadeToScene(SCENE_KEYS.TUTORIAL);
  }
}
