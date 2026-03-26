import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { applyRestChoice, getRestChoices, type RestChoice, type RestResult } from '../systems/RestSiteSystem';

/**
 * RestSiteScene -- rest site overlay with 3-choice cards.
 * Delegates logic to RestSiteSystem. Pauses GameScene on open, resumes on close.
 */
export class RestSiteScene extends Scene {
  private selectedChoice: RestChoice | null = null;
  private chooseBtn: Phaser.GameObjects.Text | null = null;
  private cardContainers: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('RestSiteScene');
  }

  create(): void {
    this.selectedChoice = null;
    this.cardContainers = [];

    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';

    // Overlay panel
    this.add.rectangle(400, 300, 500, 350, 0x222222, 0.9).setInteractive();

    // Title
    this.add.text(400, 145, 'Rest Site', {
      fontSize: '24px', fontStyle: 'bold', color: '#4169e1', fontFamily,
    }).setOrigin(0.5);

    // Instruction
    this.add.text(400, 175, 'Choose one action.', {
      fontSize: '16px', color: '#aaaaaa', fontFamily,
    }).setOrigin(0.5);

    // Three option cards
    const choices = getRestChoices();
    const cardWidth = 140;
    const cardHeight = 180;
    const gap = 24;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * gap;
    const startX = 400 - totalWidth / 2 + cardWidth / 2;

    choices.forEach((choice, i) => {
      const x = startX + i * (cardWidth + gap);
      const y = 300;
      const container = this.add.container(x, y);
      container.setAlpha(0);

      // Card background
      const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x333333);
      bg.setInteractive({ useHandCursor: true });
      container.add(bg);

      // Option name
      const nameText = this.add.text(0, -60, choice.name, {
        fontSize: '24px', fontStyle: 'bold', color: '#ffffff', fontFamily,
      }).setOrigin(0.5);
      container.add(nameText);

      // Description
      const descText = this.add.text(0, 10, choice.description, {
        fontSize: '16px', color: '#aaaaaa', fontFamily,
        wordWrap: { width: 120 },
        align: 'center',
      }).setOrigin(0.5);
      container.add(descText);

      // Staggered entrance
      this.tweens.add({
        targets: container,
        alpha: 1,
        x: container.x,
        duration: 300,
        delay: i * 100,
        ease: 'Power2',
      });

      // Hover
      bg.on('pointerover', () => {
        bg.setStrokeStyle(2, 0xffffff);
        this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 100 });
      });
      bg.on('pointerout', () => {
        if (this.selectedChoice !== choice.id) {
          bg.setStrokeStyle(0);
          this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
        }
      });

      // Click to select
      bg.on('pointerdown', () => {
        this.selectedChoice = choice.id;
        // Highlight selected, dim others
        this.cardContainers.forEach((c, ci) => {
          if (ci === i) {
            c.setAlpha(1);
            (c.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(3, 0xffd700);
          } else {
            c.setAlpha(0.5);
            (c.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(0);
          }
        });
        // Show Choose button
        if (this.chooseBtn) this.chooseBtn.setVisible(true);
      });

      this.cardContainers.push(container);
    });

    // "Choose" button (hidden until selection)
    this.chooseBtn = this.add.text(400, 420, 'Choose', {
      fontSize: '24px', fontStyle: 'bold', color: '#ffd700', fontFamily,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);

    this.chooseBtn.on('pointerover', () => this.chooseBtn!.setColor('#ffffff'));
    this.chooseBtn.on('pointerout', () => this.chooseBtn!.setColor('#ffd700'));
    this.chooseBtn.on('pointerdown', () => this.confirmChoice());

    this.events.on('shutdown', this.cleanup, this);
  }

  private confirmChoice(): void {
    if (!this.selectedChoice) return;

    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
    const run = getRun();

    // Build adapter for RestSiteSystem
    const adapter = {
      hero: {
        hp: run.hero.currentHP,
        maxHp: run.hero.maxHP,
        stamina: run.hero.currentStamina,
        maxStamina: run.hero.maxStamina,
        mana: run.hero.currentMana,
        maxMana: run.hero.maxMana,
      },
      deck: {
        cards: run.deck.active.map(id => ({ id, name: id })),
        order: [...run.deck.active],
      },
    };

    const result: RestResult = applyRestChoice(this.selectedChoice, adapter);

    // Sync adapter back to RunState
    run.hero.currentHP = adapter.hero.hp;
    run.hero.maxHP = adapter.hero.maxHp;
    run.hero.currentStamina = adapter.hero.stamina;
    run.hero.maxStamina = adapter.hero.maxStamina;
    run.hero.currentMana = adapter.hero.mana;
    run.hero.maxMana = adapter.hero.maxMana;

    // Fade out cards
    for (const card of this.cardContainers) {
      this.tweens.add({ targets: card, alpha: 0, duration: 300 });
    }
    if (this.chooseBtn) this.chooseBtn.setVisible(false);

    // Show result text
    const resultColor = result.choice === 'rest' ? '#00ff00' : '#ffffff';
    const resultText = this.add.text(400, 300, result.description, {
      fontSize: '16px', color: resultColor, fontFamily,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: resultText,
      alpha: 1,
      duration: 300,
    });

    // Auto-close after 2s or click
    const closeTimer = this.time.delayedCall(2000, () => this.close());
    this.input.once('pointerdown', () => {
      closeTimer.remove();
      this.close();
    });
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  private cleanup(): void {
    this.cardContainers = [];
    this.chooseBtn = null;
  }
}
