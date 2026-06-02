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
import { TutorialOverlay } from '../ui/TutorialOverlay';
import { getTemplatesForClass, TUTORIAL_TEMPLATE_ID } from '../data/DeckTemplates';

export class CharacterSelectScene extends Scene {
  private selectedIndex = 0;
  // statusContainers[i] = painel de status do personagem i (para highlight)
  private statusContainers: Phaser.GameObjects.Container[] = [];
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
    this.statusContainers = [];
    this.statusBaseScales.length = 0;
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    this.add.image(400, 300, 'bg_character_selection').setDisplaySize(800, 600);

    // Flame decorations
    if (this.textures.exists('flame_selection')) {
      const FLAME_FPS = 12;
      const FLAME_FRAMES = 10;
      if (!this.anims.exists('flame_sel_a')) {
        this.anims.create({
          key: 'flame_sel_a',
          frames: this.anims.generateFrameNumbers('flame_selection', { start: 0, end: FLAME_FRAMES - 1 }),
          frameRate: FLAME_FPS, repeat: -1,
        });
      }
      if (!this.anims.exists('flame_sel_b')) {
        this.anims.create({
          key: 'flame_sel_b',
          frames: this.anims.generateFrameNumbers('flame_selection', { start: 0, end: FLAME_FRAMES - 1 }),
          frameRate: FLAME_FPS, repeat: -1,
        });
      }
      const flameA = this.add.sprite(82.2, 282.6, 'flame_selection').setOrigin(0, 0.5).setScale(0.1467);
      flameA.play('flame_sel_a');
      const flameB = this.add.sprite(714.6, 284.7, 'flame_selection').setOrigin(1, 0.5).setScale(0.1354);
      flameB.play({ key: 'flame_sel_b', startFrame: 4 });
    }

    this.add.bitmapText(LAYOUT.centerX, 50, 'game_font_white', 'Choose Your Hero', 40).setOrigin(0.5);

    const layout = computeCardLayout(LAYOUT.canvasWidth, CLASSES.length);
    const cardWidth  = layout.cardW;
    const cardHeight = layout.cardH;

    // Posições independentes: sprite e painel de status são containers separados
    const SPRITE_POSITIONS = [
      { x: 289.6, y: 314.9, scale: 0.8167 },
      { x: 512.6, y: 320.2, scale: 0.8171 },
    ] as const;

    const STATUS_POSITIONS = [
      { x: 281.2, y: 438.4, scale: 1.0022 },
      { x: 521.5, y: 437.3, scale: 0.9266 },
    ] as const;

    CLASSES.forEach((cls, i) => {
      const sprPos    = SPRITE_POSITIONS[i]  ?? { x: 200 + i * 360, y: 230, scale: 0.8167 };
      const statusPos = STATUS_POSITIONS[i] ?? { x: 200 + i * 360, y: 460, scale: 0.8167 };

      try {
        // Container do sprite — posicionável independentemente
        const spriteContainer = this.createSpriteContainer(sprPos.x, sprPos.y, cardWidth, cardHeight, cls, i);
        spriteContainer.setScale(sprPos.scale);

        // Container do painel de status — posicionável independentemente
        const statusContainer = this.createStatusContainer(statusPos.x, statusPos.y, cardWidth, cardHeight, cls, i);
        statusContainer.setScale(statusPos.scale);
        this.statusBaseScales.push(statusPos.scale);
        this.statusContainers.push(statusContainer);
      } catch (err) {
        console.error('[CharacterSelect] card creation failed for', cls.id, err);
      }
    });

    if (tutorialDirector.isActive()) {
      const warriorIdx = CLASSES.findIndex(c => c.id === 'warrior');
      this.selectedIndex = Math.max(0, warriorIdx);
    }

    this.highlightSelected();
    const overlay = TutorialOverlay.mountIfActive(this);
    if (overlay && tutorialDirector.isActive()) {
      const warriorStatus = this.statusContainers[this.selectedIndex];
      if (warriorStatus) {
        const sw = cardWidth  * (STATUS_POSITIONS[this.selectedIndex]?.scale ?? 0.8167);
        const sh = (cardHeight * 0.45) * (STATUS_POSITIONS[this.selectedIndex]?.scale ?? 0.8167);
        overlay.setStepRect('pick-warrior', {
          x: warriorStatus.x - sw / 2,
          y: warriorStatus.y - sh / 2,
          width: sw,
          height: sh,
        });
      }
    }

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
    this.input.on('pointermove', () => { this.lastInputWasMouse = true; });
  }

  // Container com apenas o sprite do personagem — sem fundo, sem painel
  private createSpriteContainer(
    x: number, y: number, w: number, h: number,
    cls: ClassOption, index: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    if (cls.idleFrames?.every(k => this.textures.exists(k))) {
      const img = this.add.image(0, 0, cls.idleFrames[0])
        .setScale(cls.spriteScale ?? 0.55).setOrigin(0.5, 1);
      container.add(img);
      let frameIdx = 0;
      this.time.addEvent({
        delay: 500, loop: true,
        callback: () => { frameIdx = 1 - frameIdx; img.setTexture(cls.idleFrames![frameIdx]); },
      });
    } else if (this.textures.exists(cls.spriteKey)) {
      const animFrameCount = this.textures.get(cls.spriteKey).frameTotal - 1;
      if (animFrameCount > 0) {
        const animKey = `select_${cls.id}_idle`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(cls.spriteKey, { start: 0, end: animFrameCount - 1 }),
            frameRate: cls.spriteFrameRate ?? 4,
            repeat: -1,
          });
        }
        const sprite = this.add.sprite(0, 0, cls.spriteKey)
          .setScale(cls.spriteScale ?? 3).setOrigin(0.5, 1);
        if (cls.spriteTint !== undefined) sprite.setTint(cls.spriteTint);
        sprite.play(animKey);
        container.add(sprite);
      } else {
        const img = this.add.image(0, 0, cls.spriteKey, 0)
          .setScale(cls.spriteScale ?? 0.55).setOrigin(0.5, 1);
        container.add(img);
      }
    } else {
      container.add(this.add.rectangle(0, 0, 64, 64, cls.fallbackColor));
    }

    // Hit area invisível sobre o sprite — clique seleciona/confirma
    const sprH = h * 0.55;
    const hitArea = this.add.rectangle(0, -sprH / 2, w, sprH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', () => {
      this.lastInputWasMouse = true;
      if (this.selectedIndex === index) {
        this.confirmSelection();
      } else {
        this.selectedIndex = index;
        this.highlightSelected();
      }
    });
    hitArea.on('pointerover', () => {
      if (!this.lastInputWasMouse) return;
      this.selectedIndex = index;
      this.highlightSelected();
    });

    return container;
  }

  // Container com apenas o painel de status — hitArea, imagem/fallback, interatividade
  private createStatusContainer(
    x: number, y: number, w: number, h: number,
    cls: ClassOption, index: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const STATUS_H = h * 0.45;

    // list[0]: hitArea (invisível, cobre o painel inteiro)
    const hitArea = this.add.rectangle(0, 0, w, STATUS_H, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    container.add(hitArea);

    // list[1]: painel de status (imagem ou fallback programático)
    const statusKey = `${cls.id}_status`;
    if (this.textures.exists(statusKey)) {
      const statusImg = this.add.image(0, 0, statusKey).setDisplaySize(w, STATUS_H);
      container.add(statusImg); // list[1]
    } else {
      const infoPanel = this.add.rectangle(0, 0, w, STATUS_H, 0x1a1a2e)
        .setStrokeStyle(3, 0xd4a04a);
      container.add(infoPanel); // list[1]
      const TOP = -STATUS_H / 2 + 20;
      container.add(
        this.add.text(0, TOP, cls.name, {
          fontSize: '18px', fontStyle: 'bold', color: '#f0d080',
          stroke: '#000000', strokeThickness: 4, fontFamily: FONTS.family, resolution: 3,
        }).setOrigin(0.5, 0),
      );
      container.add(
        this.add.text(0, TOP + 26, cls.description, {
          fontSize: '13px', color: '#cccccc', stroke: '#000000', strokeThickness: 2,
          fontFamily: FONTS.family, align: 'center', resolution: 3,
        }).setOrigin(0.5, 0),
      );
      const SB = TOP + 68;
      this.addStatBar(container, 'HP',  cls.stats.hp,      100, 0xff4444, SB);
      this.addStatBar(container, 'STA', cls.stats.stamina,  60, 0xffaa00, SB + 26);
      this.addStatBar(container, 'MP',  cls.stats.mana,     60, 0x4488ff, SB + 52);
      container.add(
        this.add.text(0, SB + 80, `Deck: ${cls.deckHint}`, {
          fontSize: '12px', color: '#aaaaaa', stroke: '#000000', strokeThickness: 2,
          fontFamily: FONTS.family, align: 'center', wordWrap: { width: w - 20 }, resolution: 3,
        }).setOrigin(0.5, 0),
      );
    }

    hitArea.on('pointerdown', () => {
      if (this.selectedIndex === index) {
        this.confirmSelection();
      } else {
        this.selectedIndex = index;
        this.highlightSelected();
      }
    });
    hitArea.on('pointerover', () => {
      if (!this.lastInputWasMouse) return;
      this.selectedIndex = index;
      this.highlightSelected();
    });

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
    container.add(
      this.add.text(-barWidth / 2 - labelW, yOffset, label, {
        fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
        fontFamily: FONTS.family, resolution: 3,
      }).setOrigin(0, 0.5),
    );
    container.add(this.add.rectangle(0, yOffset, barWidth + 4, barHeight + 4, 0x000000));
    container.add(this.add.rectangle(0, yOffset, barWidth, barHeight, 0x333333));
    const fillWidth = (value / max) * barWidth;
    container.add(
      this.add.rectangle(-barWidth / 2 + fillWidth / 2, yOffset, fillWidth, barHeight, color),
    );
    container.add(
      this.add.text(barWidth / 2 + 10, yOffset, `${value}`, {
        fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
        fontFamily: FONTS.family, resolution: 3,
      }).setOrigin(0, 0.5),
    );
  }

  private readonly statusBaseScales: number[] = [];

  private highlightSelected(): void {
    this.statusContainers.forEach((container, i) => {
      const base = this.statusBaseScales[i] ?? 1;
      const statusGO = container.list[1] as Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
      if (i === this.selectedIndex) {
        container.setScale(base * 1.06);
        if ((statusGO as Phaser.GameObjects.Image).setTint) {
          (statusGO as Phaser.GameObjects.Image).setTint(0xfff0c0);
        } else {
          (statusGO as Phaser.GameObjects.Rectangle).setStrokeStyle(4, 0xffd700);
        }
      } else {
        container.setScale(base);
        if ((statusGO as Phaser.GameObjects.Image).clearTint) {
          (statusGO as Phaser.GameObjects.Image).clearTint();
        } else {
          (statusGO as Phaser.GameObjects.Rectangle).setStrokeStyle(3, 0xd4a04a);
        }
      }
    });
  }

  private templatePickerOpen = false;

  private async confirmSelection(): Promise<void> {
    if (this.transitioning || this.templatePickerOpen) return;
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
    const templates = getTemplatesForClass(selected.id);
    const randomTpl = templates[Math.floor(Math.random() * templates.length)];
    const randomDeck = randomTpl ? [...randomTpl.cardIds] : undefined;
    this.startRun(meta, selected.id, randomDeck);
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
