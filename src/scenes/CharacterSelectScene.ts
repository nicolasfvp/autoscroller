import { Scene } from 'phaser';
import { createNewRun, setRun, getRun } from '../state/RunState';
import { saveManager } from '../core/SaveManager';
import { loadMetaState } from '../systems/MetaPersistence';
import { FONTS, LAYOUT } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';
import {
  CLASS_CARDS as CLASSES,
  computeCardLayout,
  type ClassOption,
} from './CharacterSelectScene.helpers';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';
import { getTemplatesForClass, TUTORIAL_TEMPLATE_ID } from '../data/DeckTemplates';

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
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    // Background Image
    this.add.image(400, 300, 'bg_character_selection').setDisplaySize(800, 600);

    // Title
    this.add.text(LAYOUT.centerX, 50, 'Choose Your Hero', {
      fontSize: '40px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
      fontFamily: FONTS.family,
      resolution: 3,
    }).setOrigin(0.5);

    const layout = computeCardLayout(LAYOUT.canvasWidth, CLASSES.length);
    const cardWidth = layout.cardW;
    const cardHeight = layout.cardH;
    const gap = layout.gap;
    const startX = layout.margin + cardWidth / 2;

    CLASSES.forEach((cls, i) => {
      const x = startX + i * (cardWidth + gap);
      const y = LAYOUT.centerY + 35;
      try {
        const card = this.createClassCard(x, y, cardWidth, cardHeight, cls, i);
        this.classCards.push(card);
      } catch (err) {
        console.error('[CharacterSelect] card creation failed for', cls.id, err);
      }
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
    // Reset to mouse mode when the pointer actually moves — this prevents
    // a stale pointerover event from overriding keyboard navigation when
    // the cursor happens to sit over a non-active card.
    this.input.on('pointermove', () => { this.lastInputWasMouse = true; });

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

    // ── Sprite zone (top 60% of card) ────────────────────────────
    // Card half-height = 230. Name band occupies -230 to -202 (28px).
    // Sprite is centered at y=-90 so it sits just below the name band.
    const SPRITE_Y = -90;
    if (cls.idleFrames?.every(k => this.textures.exists(k))) {
      const img = this.add.image(0, SPRITE_Y, cls.idleFrames[0]).setScale(cls.spriteScale ?? 0.55);
      container.add(img);
      let frame = 0;
      this.time.addEvent({
        delay: 500, loop: true,
        callback: () => { frame = 1 - frame; img.setTexture(cls.idleFrames![frame]); },
      });
    } else if (this.textures.exists(cls.spriteKey)) {
      // frameTotal includes __BASE; subtract 1 to get animation frame count.
      const animFrameCount = this.textures.get(cls.spriteKey).frameTotal - 1;
      if (animFrameCount > 0) {
        // Multi-frame spritesheet: use Phaser animation system.
        const animKey = `select_${cls.id}_idle`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(cls.spriteKey, { start: 0, end: animFrameCount - 1 }),
            frameRate: cls.spriteFrameRate ?? 4,
            repeat: -1,
          });
        }
        const sprite = this.add.sprite(0, SPRITE_Y, cls.spriteKey).setScale(cls.spriteScale ?? 3);
        if (cls.spriteTint !== undefined) sprite.setTint(cls.spriteTint);
        sprite.play(animKey);
        container.add(sprite);
      } else {
        // Single frame or parse failure: show frame 0 as a static image.
        const img = this.add.image(0, SPRITE_Y, cls.spriteKey, 0).setScale(cls.spriteScale ?? 0.55);
        container.add(img);
      }
    } else {
      const fallback = this.add.rectangle(0, SPRITE_Y, 64, 64, cls.fallbackColor);
      container.add(fallback);
    }

    // Character name — rendered after sprite so it appears on top
    const NAME_Y = -216;
    const nameBg = this.add.rectangle(0, NAME_Y, w - 24, 28, 0x000000, 0.6);
    container.add(nameBg);
    const nameLabel = this.add.text(0, NAME_Y, cls.name, {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#f0d080',
      stroke: '#000000',
      strokeThickness: 4,
      fontFamily: FONTS.family,
      resolution: 3,
    }).setOrigin(0.5);
    container.add(nameLabel);

    // ── Info zone (bottom 40% of card) ───────────────────────────
    const INFO_TOP = 30;
    const infoPanelH = h / 2 - INFO_TOP + 10;
    const infoPanel = this.add.rectangle(0, INFO_TOP + infoPanelH / 2, w - 24, infoPanelH, 0x2a2e3b);
    container.add(infoPanel);

    // Description
    const desc = this.add.text(0, INFO_TOP + 18, cls.description, {
      fontSize: '15px',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 2,
      fontFamily: FONTS.family,
      align: 'center',
      resolution: 3,
    }).setOrigin(0.5, 0);
    container.add(desc);

    // Stats bars (below description, 26px gap between rows)
    const STATS_TOP = INFO_TOP + 72;
    this.addStatBar(container, 'HP',  cls.stats.hp,      100, 0xff4444, STATS_TOP);
    this.addStatBar(container, 'STA', cls.stats.stamina,  60, 0xffaa00, STATS_TOP + 26);
    this.addStatBar(container, 'MP',  cls.stats.mana,     60, 0x4488ff, STATS_TOP + 52);

    // Deck hint
    const deckLabel = this.add.text(0, STATS_TOP + 80, `Deck: ${cls.deckHint}`, {
      fontSize: '13px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
      fontFamily: FONTS.family,
      align: 'center',
      wordWrap: { width: w - 30 },
      resolution: 3,
    }).setOrigin(0.5, 0);
    container.add(deckLabel);

    return container;
  }

  private addStatBar(
    container: Phaser.GameObjects.Container,
    label: string, value: number, max: number,
    color: number, yOffset: number,
  ): void {
    const barWidth = 116;
    const barHeight = 14;
    const labelW = 34;

    // Label
    const txt = this.add.text(-barWidth / 2 - labelW, yOffset, label, {
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      fontFamily: FONTS.family,
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
      fontFamily: FONTS.family,
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

  private templatePickerOpen = false;

  private async confirmSelection(): Promise<void> {
    if (this.transitioning || this.templatePickerOpen) return;
    // Tutorial gate: only warrior is accepted; skip the template picker,
    // build the run with the fixed tutorial deck, then launch the deck
    // panel so the player can review/reorder their starter cards before
    // the run begins.
    if (tutorialDirector.isActive()) {
      const sel = CLASSES[this.selectedIndex];
      if (sel?.id !== 'warrior') return;
      tutorialDirector.advanceIfMatches('pick-warrior');
      let meta;
      try {
        meta = await loadMetaState();
      } catch (err) {
        console.error('[CharacterSelect] loadMetaState failed', err);
        return;
      }
      const tutorialDeck = (getTemplatesForClass('warrior')
        .find(t => t.id === TUTORIAL_TEMPLATE_ID)?.cardIds) ?? [];
      try {
        setRun(createNewRun(meta, 1, 'warrior', undefined, tutorialDeck));
        await saveManager.save(getRun());
      } catch (err) {
        console.error('[CharacterSelect] tutorial startRun failed', err);
        return;
      }
      this.transitioning = true;
      this.scene.launch(SCENE_KEYS.DECK_CUSTOMIZATION, { tutorialOrigin: true });
      return;
    }

    const selected = CLASSES[this.selectedIndex];
    let meta;
    try {
      meta = await loadMetaState();
    } catch (err) {
      console.error('[CharacterSelect] loadMetaState failed', err);
      return;
    }

    // Launch the starting-deck picker as an overlay. We don't pause this
    // scene — a re-entry guard (templatePickerOpen) prevents stray ENTER /
    // double-click from stacking instances.
    this.templatePickerOpen = true;

    this.scene.launch(SCENE_KEYS.STARTING_DECK, {
      className: selected.id,
      onConfirm: (deck: string[]) => {
        this.templatePickerOpen = false;
        // Microtask hand-off so the picker can scene.stop() before we mutate
        // active-scene state.
        Promise.resolve().then(() => this.startRun(meta, selected.id, deck));
      },
      onCancel: () => {
        this.templatePickerOpen = false;
      },
    });
  }

  private async startRun(
    meta: Awaited<ReturnType<typeof loadMetaState>>,
    className: string,
    customStarterDeck?: string[],
  ): Promise<void> {
    if (this.transitioning) return;
    try {
      setRun(createNewRun(meta, 1, className, undefined, customStarterDeck));
      await saveManager.save(getRun());
    } catch (err) {
      console.error('[CharacterSelect] startRun failed', err);
      this.templatePickerOpen = false;
      return;
    }
    if (this.scene.isActive(SCENE_KEYS.STARTING_DECK)) {
      this.scene.stop(SCENE_KEYS.STARTING_DECK);
    }
    this.fadeToScene(SCENE_KEYS.TUTORIAL);
  }
}
