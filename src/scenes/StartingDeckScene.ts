// Starting-deck picker — overlay launched by CharacterSelectScene after the
// player picks a class. Replaces the old DeckBuilderScene/build-from-pool flow
// with a curated list of pre-built deck templates per class.
//
// Each template renders as a horizontal row showing its 5 cards plus a name
// and one-line strategy hint. Click a row to select; click "Start Run" to
// confirm and hand the chosen deck back to CharacterSelectScene.

import { Scene } from 'phaser';
import { SCENE_KEYS } from '../state/SceneKeys';
import { COLORS, FONTS, LAYOUT } from '../ui/StyleConstants';
import { createWoodButton } from '../ui/WoodButton';
import { createCardVisual, STANDARD_CARD_WIDTH } from '../ui/CardVisual';
import { disableCardFaceInput } from '../ui/CardFace';
import { getTemplatesForClass, type DeckTemplate } from '../data/DeckTemplates';

const FF = FONTS.family;
const GOLD = COLORS.accent;
const DIM = COLORS.textSecondary;

const ROW_W = 720;
const ROW_H = 84;
const ROW_GAP = 8;
const ROWS_TOP = 90;
const ROWS_X = (LAYOUT.canvasWidth - ROW_W) / 2;

// Per-row mini card scale. STANDARD card = 150×240; 0.28 → 42×67 — fits five
// across in the right half of a row.
const MINI_SCALE = 0.28;
const MINI_W = STANDARD_CARD_WIDTH * MINI_SCALE;
const MINI_GAP = 4;

interface TemplateRow {
  template: DeckTemplate;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
}

export class StartingDeckScene extends Scene {
  private className: string = 'warrior';
  private templates: DeckTemplate[] = [];
  private selectedIndex = 0;
  private rows: TemplateRow[] = [];
  private onConfirm: ((deck: string[]) => void) | null = null;
  private onCancel: (() => void) | null = null;

  constructor() {
    super(SCENE_KEYS.STARTING_DECK);
  }

  create(data: {
    className: string;
    onConfirm?: (deck: string[]) => void;
    onCancel?: () => void;
  }): void {
    this.className = data.className ?? 'warrior';
    this.onConfirm = data.onConfirm ?? null;
    this.onCancel = data.onCancel ?? null;
    this.templates = getTemplatesForClass(this.className);
    this.selectedIndex = 0;
    this.rows = [];

    this.scene.bringToTop();

    // Backdrop
    if (this.textures.exists('bg_deck_builder')) {
      this.add.image(400, 300, 'bg_deck_builder').setDisplaySize(800, 600).setDepth(-2);
    }
    const dim = this.add.rectangle(400, 300, 800, 600, 0x1a1224, 0.92);
    this.time.delayedCall(50, () => {
      dim.setInteractive();
      dim.on('pointerdown', () => { /* eat clicks */ });
    });
    if (this.textures.exists('deck_frame')) {
      this.add.image(400, 300, 'deck_frame').setDisplaySize(792, 596).setDepth(-1);
    }

    const heroName = this.className === 'mage' ? 'Mage' : 'Warrior';
    this.add.text(400, 26, `Choose a Starting Deck — ${heroName}`, {
      fontSize: '22px', fontStyle: 'bold', color: GOLD, fontFamily: FF,
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true);

    this.add.text(400, 54, 'Pick a deck template — each is built around a different playstyle.', {
      fontSize: '12px', color: DIM, fontFamily: FF,
    }).setOrigin(0.5);

    createWoodButton(this, 750, 26, '✕ Cancel', () => this.cancel(),
      { width: 92, height: 28, fontSize: 13, variant: 'danger' });

    this.renderRows();

    createWoodButton(this, 400, 560, '▶ Start Run',
      () => this.confirm(),
      { width: 240, height: 38, fontSize: 18, variant: 'primary' });

    this.input.keyboard?.on('keydown-ESC', () => this.cancel());
    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());

    this.highlightSelected();
  }

  private renderRows(): void {
    this.templates.forEach((tpl, i) => {
      const y = ROWS_TOP + i * (ROW_H + ROW_GAP);
      const container = this.add.container(ROWS_X, y);

      const bg = this.add.rectangle(0, 0, ROW_W, ROW_H, 0x14080a, 0.78)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0x6b5a3a, 0.9)
        .setInteractive({ useHandCursor: true });
      container.add(bg);

      // Left column: name + description.
      const nameText = this.add.text(14, 10, tpl.name, {
        fontSize: '16px', fontStyle: 'bold', color: GOLD, fontFamily: FF,
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0, 0);
      container.add(nameText);

      const descText = this.add.text(14, 34, tpl.description, {
        fontSize: '11px', color: '#d4c8a8', fontFamily: FF,
        wordWrap: { width: 410 },
      }).setOrigin(0, 0);
      container.add(descText);

      // Right column: 5 mini card visuals.
      const totalMiniW = tpl.cardIds.length * MINI_W + (tpl.cardIds.length - 1) * MINI_GAP;
      const miniStartX = ROW_W - totalMiniW - 12;
      tpl.cardIds.forEach((cardId, idx) => {
        const cx = miniStartX + idx * (MINI_W + MINI_GAP) + MINI_W / 2;
        const cy = ROW_H / 2;
        const visual = createCardVisual(this, cx, cy, cardId, { scale: MINI_SCALE });
        disableCardFaceInput(visual);
        container.add(visual);
      });

      bg.on('pointerdown', () => this.select(i));
      bg.on('pointerover', () => { if (i !== this.selectedIndex) bg.setStrokeStyle(2, 0xffd700, 0.7); });
      bg.on('pointerout',  () => { if (i !== this.selectedIndex) bg.setStrokeStyle(2, 0x6b5a3a, 0.9); });

      this.rows.push({ template: tpl, container, bg });
    });
  }

  private select(i: number): void {
    if (i < 0 || i >= this.templates.length) return;
    this.selectedIndex = i;
    this.highlightSelected();
  }

  private move(delta: number): void {
    const next = (this.selectedIndex + delta + this.templates.length) % this.templates.length;
    this.select(next);
  }

  private highlightSelected(): void {
    this.rows.forEach((row, i) => {
      if (i === this.selectedIndex) {
        row.bg.setStrokeStyle(3, 0xffd700, 1).setFillStyle(0x2a1a08, 0.92);
      } else {
        row.bg.setStrokeStyle(2, 0x6b5a3a, 0.9).setFillStyle(0x14080a, 0.78);
      }
    });
  }

  private confirm(): void {
    const tpl = this.templates[this.selectedIndex];
    if (!tpl) return;
    const cb = this.onConfirm;
    this.onConfirm = null;
    if (cb) cb([...tpl.cardIds]);
  }

  private cancel(): void {
    const cb = this.onCancel;
    this.onCancel = null;
    if (cb) cb();
    this.scene.stop();
  }
}
