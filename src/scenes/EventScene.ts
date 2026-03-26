import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import {
  getRandomEvent,
  isChoiceAvailable,
  resolveEventChoice,
  type EventDefinition,
  type EventOutcome,
} from '../systems/EventResolver';

/**
 * EventScene -- event overlay with narrative text and choices.
 * Delegates logic to EventResolver. Pauses GameScene on open, resumes on close.
 */
export class EventScene extends Scene {
  private currentEvent!: EventDefinition;
  private choiceButtons: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('EventScene');
  }

  create(): void {
    this.choiceButtons = [];
    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';

    // Overlay panel
    this.add.rectangle(400, 300, 550, 400, 0x222222, 0.9).setInteractive();

    // Title
    this.add.text(400, 120, 'Event', {
      fontSize: '24px', fontStyle: 'bold', color: '#9370db', fontFamily,
    }).setOrigin(0.5);

    // Get random event
    this.currentEvent = getRandomEvent();

    // Event title
    this.add.text(400, 150, this.currentEvent.title, {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff', fontFamily,
    }).setOrigin(0.5);

    // Narrative text
    this.add.text(150, 175, this.currentEvent.description, {
      fontSize: '16px', color: '#ffffff', fontFamily,
      wordWrap: { width: 500 },
    });

    // Build RunState adapter for availability checks
    const run = getRun();
    const runAdapter = {
      hero: { hp: run.hero.currentHP, maxHp: run.hero.maxHP },
      deck: { cards: run.deck.active.map(id => ({ id, name: id })), order: [...run.deck.active] },
      economy: {
        gold: run.economy.gold,
        tilePoints: run.economy.tilePoints,
        metaLoot: (run.economy as any).metaLoot ?? 0,
      },
      relics: [...run.relics],
    };

    // Choice buttons
    const startY = 240;
    this.currentEvent.choices.forEach((choice, i) => {
      const y = startY + i * 52;
      const container = this.add.container(400, y);

      // Button background
      const bg = this.add.rectangle(0, 0, 480, 44, 0x333333);
      container.add(bg);

      // Choice text
      const choiceText = this.add.text(-220, 0, choice.text, {
        fontSize: '16px', color: '#ffffff', fontFamily,
      }).setOrigin(0, 0.5);
      container.add(choiceText);

      const available = isChoiceAvailable(choice, runAdapter);

      if (!available) {
        container.setAlpha(0.4);
        // Show requirement
        const reqText = choice.requirement?.minGold
          ? `(Requires: ${choice.requirement.minGold} Gold)`
          : choice.requirement?.minHP
            ? `(Requires: ${choice.requirement.minHP} HP)`
            : '';
        if (reqText) {
          const req = this.add.text(220, 0, reqText, {
            fontSize: '12px', color: '#ff0000', fontFamily,
          }).setOrigin(1, 0.5);
          container.add(req);
        }
      } else {
        bg.setInteractive({ useHandCursor: true });

        bg.on('pointerover', () => bg.setFillStyle(0x444444));
        bg.on('pointerout', () => bg.setFillStyle(0x333333));

        bg.on('pointerdown', () => {
          this.onChoiceSelected(i);
        });
      }

      // Staggered entrance
      container.setAlpha(0);
      container.x = 430;
      this.tweens.add({
        targets: container,
        alpha: available ? 1 : 0.4,
        x: 400,
        duration: 200,
        delay: i * 200,
      });

      this.choiceButtons.push(container);
    });

    this.events.on('shutdown', this.cleanup, this);
  }

  private onChoiceSelected(choiceIndex: number): void {
    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';

    // Fade out non-selected choices
    this.choiceButtons.forEach((container, i) => {
      if (i !== choiceIndex) {
        this.tweens.add({ targets: container, alpha: 0, duration: 300 });
      } else {
        // Highlight selected
        (container.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0xffd700);
      }
    });

    // Build adapter and resolve
    const run = getRun();
    const adapter = {
      hero: { hp: run.hero.currentHP, maxHp: run.hero.maxHP },
      deck: { cards: run.deck.active.map(id => ({ id, name: id })), order: [...run.deck.active] },
      economy: {
        gold: run.economy.gold,
        tilePoints: run.economy.tilePoints,
        metaLoot: (run.economy as any).metaLoot ?? 0,
      },
      relics: [...run.relics],
    };

    const outcome: EventOutcome = resolveEventChoice(this.currentEvent.id, choiceIndex, adapter);

    // Sync adapter back
    run.hero.currentHP = adapter.hero.hp;
    run.hero.maxHP = adapter.hero.maxHp;
    run.economy.gold = adapter.economy.gold;
    run.economy.tilePoints = adapter.economy.tilePoints;
    (run.economy as any).metaLoot = adapter.economy.metaLoot;
    run.deck.active = [...adapter.deck.order];
    run.relics = [...adapter.relics];

    // Show outcome panel
    const outcomeY = 380;
    let outcomeStr = '';
    for (const effect of outcome.effects) {
      const prefix = effect.applied
        ? (effect.type.startsWith('gain') || effect.type === 'add_card' || effect.type === 'gain_relic' ? '+' : '-')
        : '';
      outcomeStr += `${prefix} ${effect.type}: ${effect.value}\n`;
    }
    if (!outcomeStr) outcomeStr = outcome.description;

    const outcomeText = this.add.text(400, outcomeY, outcome.description, {
      fontSize: '16px', color: '#ffffff', fontFamily,
      wordWrap: { width: 480 },
      align: 'center',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: outcomeText,
      alpha: 1,
      duration: 300,
    });

    // "Continue" button
    const continueBtn = this.add.text(400, 460, 'Continue', {
      fontSize: '24px', fontStyle: 'bold', color: '#ffd700', fontFamily,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

    this.tweens.add({
      targets: continueBtn,
      alpha: 1,
      duration: 300,
      delay: 200,
    });

    continueBtn.on('pointerover', () => continueBtn.setColor('#ffffff'));
    continueBtn.on('pointerout', () => continueBtn.setColor('#ffd700'));
    continueBtn.on('pointerdown', () => this.close());
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  private cleanup(): void {
    this.choiceButtons = [];
  }
}
